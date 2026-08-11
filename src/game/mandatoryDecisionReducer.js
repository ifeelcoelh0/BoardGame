import { activePorts } from "./buildingRules.js";
import {
  RESOURCE_KEYS,
  handSize,
  isResourceKey,
} from "./resources.js";
import {
  reduceTributeResourceChoice,
  reduceTsunamiPortChoice,
} from "./disasterReducer.js";

export const MANDATORY_DECISION = Object.freeze({
  DISCARD: "descarte",
  TSUNAMI: "tsunami",
  TRIBUTE: "tributo",
  BLESSING: "bencao",
});

function clonePlayer(player) {
  return {
    ...player,
    res: { ...(player?.res || {}) },
  };
}

function cloneStats(stats, playerCount) {
  const next = { ...(stats || {}) };
  for (const key of ["robbedFrom", "robbedBy", "dragonMoves", "blessings"]) {
    next[key] = [...(stats?.[key] || [])];
    while (next[key].length < playerCount) next[key].push(0);
  }
  return next;
}

function randomIndex(length, rng) {
  if (!Number.isSafeInteger(length) || length <= 0)
    throw new RangeError("Não é possível escolher de uma coleção vazia.");
  const sample = Number(rng());
  if (!Number.isFinite(sample)) throw new TypeError("O RNG da decisão devolveu um valor inválido.");
  const normalized = Math.max(0, Math.min(0.9999999999999999, sample));
  return Math.floor(normalized * length);
}

function queueHeadFor(game, actorIndex, type = null) {
  const pending = game?.queue?.[0];
  if (!pending || pending.p !== actorIndex) return null;
  if (type != null && pending.t !== type) return null;
  return pending;
}

export function requiredGameActorIndex(state) {
  if (!state || !Array.isArray(state.players) || state.phase === "lobby" || state.phase === "ended")
    return -1;
  const queuePlayer = state.queue?.[0]?.p;
  if (Number.isSafeInteger(queuePlayer) && state.players[queuePlayer]) return queuePlayer;
  if (state.phase === "setup") {
    const setupPlayer = state.setup?.seq?.[state.setup?.i];
    return Number.isSafeInteger(setupPlayer) && state.players[setupPlayer] ? setupPlayer : -1;
  }
  if (state.phase === "play") {
    const turnPlayer = state.order?.[state.turn?.pos];
    return Number.isSafeInteger(turnPlayer) && state.players[turnPlayer] ? turnPlayer : -1;
  }
  return -1;
}

export function validDragonHexes(game) {
  return (game?.board?.hexes || [])
    .filter((hex) => hex && hex.k !== game?.board?.dragon && hex.hid !== true)
    .map((hex) => hex.k);
}

export function reduceDiscardDecision(game, actorIndex, resources) {
  const pending = queueHeadFor(game, actorIndex, MANDATORY_DECISION.DISCARD);
  if (!pending || !Number.isSafeInteger(pending.need) || pending.need < 0)
    throw new Error("Não existe um descarte pendente para este jogador.");
  if (!resources || typeof resources !== "object" || Array.isArray(resources))
    throw new TypeError("O descarte deve indicar um mapa de recursos.");
  if (Object.keys(resources).some((resource) => !isResourceKey(resource)))
    throw new TypeError("O descarte contém um recurso inválido.");

  const players = game.players.slice();
  const player = clonePlayer(players[actorIndex]);
  let total = 0;
  for (const resource of RESOURCE_KEYS) {
    const amount = resources[resource] || 0;
    if (!Number.isSafeInteger(amount) || amount < 0 || amount > (player.res[resource] || 0))
      throw new RangeError("O descarte contém uma quantidade inválida.");
    total += amount;
  }
  if (total !== pending.need)
    throw new RangeError("A quantidade descartada não corresponde à decisão pendente.");

  for (const resource of RESOURCE_KEYS) player.res[resource] -= resources[resource] || 0;
  players[actorIndex] = player;
  return {
    game: { ...game, players, queue: game.queue.slice(1) },
    event: {
      type: "DISCARD_RESOLVED",
      actorIndex,
      amount: pending.need,
      resources: Object.fromEntries(RESOURCE_KEYS.map((resource) => [resource, resources[resource] || 0])),
    },
  };
}

export function reduceDragonPlacement(game, graph, actorIndex, hexKey, options = {}) {
  if (!validDragonHexes(game).includes(hexKey)) throw new Error("O Dragão não pode ser colocado nesse terreno.");
  const hex = graph?.hexMap?.[hexKey];
  if (!hex || !Array.isArray(hex.corners)) throw new Error("O terreno escolhido não existe no grafo.");

  const players = game.players.slice();
  const stats = cloneStats(game.stats, players.length);
  stats.dragonMoves[actorIndex] += 1;
  const adjacentPlayers = [...new Set(hex.corners
    .map((vertex) => game.builds?.[vertex])
    .filter(Boolean)
    .map((building) => building.p))];
  const victims = adjacentPlayers.filter((playerIndex) => (
    playerIndex !== actorIndex
    && !players[playerIndex]?.immune
    && handSize(players[playerIndex]) > 0
  ));
  const excluded = adjacentPlayers
    .filter((playerIndex) => playerIndex !== actorIndex && !victims.includes(playerIndex))
    .map((playerIndex) => ({
      playerIndex,
      reason: players[playerIndex]?.immune ? "IMMUNE" : "EMPTY_HAND",
    }));
  const turn = {
    ...game.turn,
    mustDragon: false,
    steal: victims.length
      ? { hex: hexKey, victims, at: Number((options.now || Date.now)()) }
      : null,
  };
  return {
    game: {
      ...game,
      board: { ...game.board, dragon: hexKey },
      turn,
      stats,
    },
    event: {
      type: "DRAGON_PLACED",
      actorIndex,
      hex: hexKey,
      victims,
      excluded,
    },
  };
}

export function reduceResourceSteal(game, actorIndex, victimIndex, options = {}) {
  const pending = game?.turn?.steal;
  if (!pending || !Array.isArray(pending.victims) || !pending.victims.includes(victimIndex))
    throw new Error("Não existe um roubo pendente contra esse jogador.");
  const victim = game.players?.[victimIndex];
  if (!victim || handSize(victim) <= 0) throw new Error("A vítima já não tem recursos para roubar.");

  const bag = [];
  for (const resource of RESOURCE_KEYS) {
    for (let index = 0; index < (victim.res?.[resource] || 0); index += 1) bag.push(resource);
  }
  const resource = bag[randomIndex(bag.length, options.rng || Math.random)];
  const players = game.players.slice();
  const actor = clonePlayer(players[actorIndex]);
  const nextVictim = clonePlayer(players[victimIndex]);
  actor.res[resource] = (actor.res[resource] || 0) + 1;
  nextVictim.res[resource] -= 1;
  players[actorIndex] = actor;
  players[victimIndex] = nextVictim;
  const stats = cloneStats(game.stats, players.length);
  stats.robbedFrom[victimIndex] += 1;
  stats.robbedBy[actorIndex] += 1;

  return {
    game: {
      ...game,
      players,
      stats,
      turn: { ...game.turn, steal: null },
    },
    event: {
      type: "RESOURCE_STOLEN",
      actorIndex,
      victimIndex,
    },
    privateResult: {
      type: "STOLEN_RESOURCE",
      resource,
      victimIndex,
    },
  };
}

export function reduceTsunamiDecision(game, graph, actorIndex, edge) {
  const pending = queueHeadFor(game, actorIndex, MANDATORY_DECISION.TSUNAMI);
  if (!pending) throw new Error("Não existe uma escolha de tsunami pendente para este jogador.");
  if (!activePorts(game, graph, actorIndex).some((port) => port.e === edge))
    throw new Error("O porto escolhido não está ativo.");
  return reduceTsunamiPortChoice(game, graph, actorIndex, edge);
}

export function reduceQueueResourceDecision(game, actorIndex, resource) {
  const pending = queueHeadFor(game, actorIndex);
  if (!pending || ![MANDATORY_DECISION.TRIBUTE, MANDATORY_DECISION.BLESSING].includes(pending.t))
    throw new Error("Não existe uma escolha de recurso pendente para este jogador.");
  if (!Number.isSafeInteger(pending.left) || pending.left <= 0)
    throw new Error("A decisão de recursos já terminou.");
  if (!isResourceKey(resource)) throw new TypeError("O recurso escolhido não existe.");

  if (pending.t === MANDATORY_DECISION.TRIBUTE) {
    const result = reduceTributeResourceChoice(game, actorIndex, resource);
    return {
      ...result,
      event: {
        ...result.event,
        type: "QUEUE_RESOURCE_RESOLVED",
        decisionType: MANDATORY_DECISION.TRIBUTE,
        actorIndex,
        resource,
        guard: false,
      },
    };
  }

  const players = game.players.slice();
  const player = clonePlayer(players[actorIndex]);
  player.res[resource] = (player.res[resource] || 0) + 1;
  players[actorIndex] = player;
  const stats = cloneStats(game.stats, players.length);
  stats.blessings[actorIndex] += 1;
  const remaining = pending.left - 1;
  const nextQueue = game.queue.slice();
  if (remaining <= 0) nextQueue.shift();
  else nextQueue[0] = { ...pending, left: remaining };

  return {
    game: { ...game, players, stats, queue: nextQueue },
    event: {
      type: "QUEUE_RESOURCE_RESOLVED",
      decisionType: MANDATORY_DECISION.BLESSING,
      actorIndex,
      resource,
      remaining: Math.max(0, remaining),
      completed: remaining <= 0,
      guard: pending.guard === true,
    },
  };
}

export function reduceMandatoryQueueSkip(game, actorIndex) {
  const pending = queueHeadFor(game, actorIndex);
  if (!pending) return { handled: false, game, event: null };
  const labels = {
    [MANDATORY_DECISION.DISCARD]: "descarte",
    [MANDATORY_DECISION.TSUNAMI]: "escolha de porto",
    [MANDATORY_DECISION.TRIBUTE]: "tributo",
    [MANDATORY_DECISION.BLESSING]: "bênção",
  };
  return {
    handled: true,
    game: { ...game, queue: game.queue.slice(1) },
    event: {
      type: "MANDATORY_DECISION_SKIPPED",
      actorIndex,
      decisionType: pending.t,
      label: labels[pending.t] || "decisão obrigatória",
    },
  };
}
