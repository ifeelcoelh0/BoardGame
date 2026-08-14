import { isWarMode } from "./gameModes.js";

export const STANDARD_VICTORY_TARGET = 10;
export const LONGEST_ROAD_MINIMUM = 5;
export const LARGEST_ARMY_MINIMUM = 3;

function cloneGame(game) {
  if (typeof structuredClone === "function") return structuredClone(game);
  return JSON.parse(JSON.stringify(game));
}

function assertPlayer(game, playerIndex) {
  if (!Number.isSafeInteger(playerIndex) || playerIndex < 0 || playerIndex >= (game?.players?.length || 0)) {
    throw new RangeError("Jogador inválido para calcular a pontuação.");
  }
}

function validHolder(game, holder) {
  return Number.isSafeInteger(holder?.p) && holder.p >= 0 && holder.p < (game.players?.length || 0);
}

export function troopTotal(player) {
  return (player?.troops?.cavaleiro || 0)
    + (player?.troops?.catapulta || 0)
    + (player?.troops?.arqueiro || 0);
}

export function hiddenVictoryPointCount(player) {
  return [...(player?.devNew || []), ...(player?.devOld || [])]
    .filter((card) => card?.kind === "vp").length;
}

export function longestRoadLength(game, graphOrPlayerIndex, maybePlayerIndex) {
  const playerIndex = maybePlayerIndex === undefined ? graphOrPlayerIndex : maybePlayerIndex;
  assertPlayer(game, playerIndex);
  const mine = Object.keys(game.roads || {}).filter((edge) => game.roads[edge] === playerIndex);
  if (!mine.length) return 0;

  const adjacency = {};
  mine.forEach((edge) => {
    const [first, second] = edge.split("|");
    if (!first || !second) return;
    (adjacency[first] ||= []).push([edge, second]);
    (adjacency[second] ||= []).push([edge, first]);
  });

  const blocked = (vertex) => game.builds?.[vertex] && game.builds[vertex].p !== playerIndex;
  let best = 0;
  const visit = (vertex, used, length) => {
    if (length > best) best = length;
    if (length > 0 && blocked(vertex)) return;
    for (const [edge, nextVertex] of adjacency[vertex] || []) {
      if (used.has(edge)) continue;
      used.add(edge);
      visit(nextVertex, used, length + 1);
      used.delete(edge);
    }
  };
  Object.keys(adjacency).forEach((vertex) => visit(vertex, new Set(), 0));
  return best;
}

export function determineLongestRoadAward(game) {
  const lengths = game.players.map((_, playerIndex) => longestRoadLength(game, playerIndex));
  let holder = validHolder(game, game.lr) && lengths[game.lr.p] >= LONGEST_ROAD_MINIMUM
    ? { p: game.lr.p, len: lengths[game.lr.p] }
    : null;

  game.players.forEach((_, playerIndex) => {
    const length = lengths[playerIndex];
    if (length >= LONGEST_ROAD_MINIMUM && (!holder || length > holder.len)) {
      holder = { p: playerIndex, len: length };
    }
  });
  return { holder, lengths };
}

export function determineLargestArmyAward(game) {
  const totals = game.players.map(troopTotal);
  let holder = validHolder(game, game.la)
    ? { p: game.la.p, n: totals[game.la.p] || 0 }
    : null;

  game.players.forEach((_, playerIndex) => {
    const total = totals[playerIndex];
    if (total >= LARGEST_ARMY_MINIMUM && (!holder || total > holder.n)) {
      holder = { p: playerIndex, n: total };
    }
  });
  return { holder, totals };
}

export function scoreBreakdown(game, playerIndex, { includeSecret = false } = {}) {
  assertPlayer(game, playerIndex);
  let buildings = 0;
  for (const building of Object.values(game.builds || {})) {
    if (building?.p === playerIndex) buildings += Number(building.t) || 0;
  }
  const longestRoad = game.lr?.p === playerIndex ? 2 : 0;
  const largestArmy = game.la?.p === playerIndex ? 2 : 0;
  let occupations = 0;
  if (isWarMode(game.mode)) {
    for (const [vertex, occupier] of Object.entries(game.occ || {})) {
      if (occupier === playerIndex && game.builds?.[vertex]) occupations += 1;
    }
  }
  const glory = isWarMode(game.mode) ? (Number(game.glory?.[playerIndex]) || 0) : 0;
  const secretVictoryPoints = includeSecret ? hiddenVictoryPointCount(game.players[playerIndex]) : 0;
  const publicTotal = buildings + longestRoad + largestArmy + occupations + glory;
  return {
    playerIndex,
    buildings,
    longestRoad,
    largestArmy,
    occupations,
    glory,
    secretVictoryPoints,
    publicTotal,
    total: publicTotal + secretVictoryPoints,
  };
}

export function calculateVictoryPoints(game, playerIndex, includeSecret = false) {
  return scoreBreakdown(game, playerIndex, { includeSecret }).total;
}

export function rankPlayers(game, { includeSecret = true } = {}) {
  return game.players
    .map((_, playerIndex) => ({
      ...scoreBreakdown(game, playerIndex, { includeSecret }),
      roadLength: longestRoadLength(game, playerIndex),
      armySize: troopTotal(game.players[playerIndex]),
    }))
    .sort((first, second) => second.total - first.total || first.playerIndex - second.playerIndex)
    .map((entry, rank) => ({ ...entry, rank: rank + 1 }));
}

export function reduceScoringAwards(game, { longestRoad = false, largestArmy = false } = {}) {
  const next = cloneGame(game);
  const events = [];

  if (longestRoad) {
    const previous = validHolder(next, next.lr) ? next.lr.p : null;
    const { holder, lengths } = determineLongestRoadAward(next);
    next.lr = holder;
    const current = holder?.p ?? null;
    if (current !== previous) {
      events.push({
        type: "LONGEST_ROAD_CHANGED",
        previousPlayerIndex: previous,
        playerIndex: current,
        length: holder?.len || 0,
        lengths,
      });
    }
  }

  if (largestArmy) {
    const previous = validHolder(next, next.la) ? next.la.p : null;
    const { holder, totals } = determineLargestArmyAward(next);
    next.la = holder;
    const current = holder?.p ?? null;
    if (current !== previous) {
      events.push({
        type: "LARGEST_ARMY_CHANGED",
        previousPlayerIndex: previous,
        playerIndex: current,
        size: holder?.n || 0,
        totals,
      });
    }
  }

  return { game: next, event: { type: "SCORING_AWARDS_UPDATED", events } };
}

export function reduceStandardVictory(game, actorIndex, { target = STANDARD_VICTORY_TARGET } = {}) {
  assertPlayer(game, actorIndex);
  const next = cloneGame(game);
  if (isWarMode(next.mode) || next.phase !== "play" || next.winner != null) {
    return { game: next, event: { type: "VICTORY_NOT_REACHED", actorIndex, target } };
  }
  const score = calculateVictoryPoints(next, actorIndex, true);
  if (score < target) {
    return { game: next, event: { type: "VICTORY_NOT_REACHED", actorIndex, score, target } };
  }
  next.phase = "ended";
  next.players.forEach((player) => { player.ready = false; });
  next.winner = actorIndex;
  next.endReason = "VICTORY_POINTS";
  return {
    game: next,
    event: { type: "GAME_WON", actorIndex, playerIndex: actorIndex, score, target, reason: "VICTORY_POINTS" },
  };
}

export function reduceRoundLimitVictory(game) {
  if (!isWarMode(game?.mode)) throw new Error("O fim por rondas só existe no modo Guerra.");
  const next = cloneGame(game);
  const ranking = rankPlayers(next, { includeSecret: true });
  if (!ranking.length) throw new Error("Não existem jogadores para determinar o vencedor.");
  const winner = ranking[0];
  const tiedPlayerIndices = ranking.filter((entry) => entry.total === winner.total).map((entry) => entry.playerIndex);
  next.phase = "ended";
  next.players.forEach((player) => { player.ready = false; });
  next.winner = winner.playerIndex;
  next.endReason = "ROUND_LIMIT";
  return {
    game: next,
    event: {
      type: "GAME_WON",
      actorIndex: winner.playerIndex,
      playerIndex: winner.playerIndex,
      score: winner.total,
      reason: "ROUND_LIMIT",
      ranking,
      tiedPlayerIndices,
      tieBreak: tiedPlayerIndices.length > 1 ? "PLAYER_INDEX" : null,
    },
  };
}

export function reduceScoringAfterAction(game, actorIndex, {
  longestRoad = false,
  largestArmy = false,
  checkVictory = true,
  target = STANDARD_VICTORY_TARGET,
} = {}) {
  assertPlayer(game, actorIndex);
  const events = [];
  let next = game;
  if (longestRoad || largestArmy) {
    const awards = reduceScoringAwards(next, { longestRoad, largestArmy });
    next = awards.game;
    events.push(...awards.event.events);
  } else {
    next = cloneGame(next);
  }
  if (checkVictory) {
    const victory = reduceStandardVictory(next, actorIndex, { target });
    next = victory.game;
    if (victory.event.type === "GAME_WON") events.push(victory.event);
  }
  return { game: next, event: { type: "SCORING_RESOLVED", actorIndex, events } };
}
