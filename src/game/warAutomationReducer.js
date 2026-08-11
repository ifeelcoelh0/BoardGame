import { RESOURCE_KEYS } from "./resources.js";
import { calculateVictoryPoints } from "./scoringReducer.js";
import {
  TROLL_PLAYER_INDEX,
  giantHex,
  hasWarPerk,
  hexDistance,
  isTrollUnit,
  neighboringHexes,
  releaseInvalidOccupations,
} from "./warReducer.js";

export const TROLL_WAKE_TURNS = 20;
export const TROLL_SPAWN_DISTANCE = 3;

function cloneGame(game) {
  if (typeof structuredClone === "function") return structuredClone(game);
  return JSON.parse(JSON.stringify(game));
}

function assertWarMode(game) {
  if (game?.mode !== "guerra") throw new Error("A automatização militar só está disponível no modo Guerra.");
}

function assertPlayer(game, playerIndex) {
  if (!Number.isSafeInteger(playerIndex) || playerIndex < 0 || playerIndex >= (game.players?.length || 0)) {
    throw new RangeError("Jogador inválido para a automatização militar.");
  }
}

function randomIndex(rng, length) {
  if (!Number.isSafeInteger(length) || length <= 0) throw new RangeError("Não existem opções aleatórias disponíveis.");
  const value = rng();
  if (!Number.isFinite(value) || value < 0 || value >= 1) throw new RangeError("O RNG deve devolver um número entre 0 (inclusive) e 1 (exclusive).");
  return Math.floor(value * length);
}

function pick(list, rng) {
  return list[randomIndex(rng, list.length)];
}

function hexOf(game, key) {
  return game.board?.hexes?.find((hex) => hex.k === key) || null;
}

function isHiddenHex(game, key) {
  return hexOf(game, key)?.hid === true;
}

export function warPublicScore(game, playerIndex) {
  assertPlayer(game, playerIndex);
  return calculateVictoryPoints(game, playerIndex, false);
}

export function trollHealthForPlayers(playerCount) {
  return playerCount >= 4 ? 19 : playerCount === 3 ? 17 : 13;
}

export function raiderLimit(game) {
  return (game.players?.length || 0) + 1;
}

export function raiderHexes(game) {
  return Object.keys(game.units || {}).filter((key) => isTrollUnit(game.units[key]));
}

export function pickTrollLair(game) {
  const dragon = game.board?.dragon;
  const candidates = (game.board?.hexes || []).filter((hex) => (
    hex.terr === "deserto"
    && hexDistance(hex.k, "0,0") >= 2
    && hex.k !== dragon
    && hex.k !== "0,0"
  ));
  const pool = candidates.length
    ? candidates
    : (game.board?.hexes || []).filter((hex) => hex.k !== "0,0" && hex.k !== dragon);
  pool.sort((first, second) => hexDistance(second.k, dragon) - hexDistance(first.k, dragon));
  return pool[0]?.k || "0,0";
}

function stepToward(game, fromHex, toHex) {
  let best = fromHex;
  let bestDistance = hexDistance(fromHex, toHex);
  neighboringHexes(game, fromHex).forEach((candidate) => {
    const distance = hexDistance(candidate, toHex);
    if (distance < bestDistance) {
      best = candidate;
      bestDistance = distance;
    }
  });
  return best;
}

function spawnRaider(game, graph, targetVertex, rng, events, source) {
  const goals = graph?.verts?.[targetVertex]?.hexes || [];
  if (!goals.length) return false;
  const distanceToTarget = (key) => Math.min(...goals.map((goal) => hexDistance(key, goal)));
  const free = (game.board?.hexes || [])
    .map((hex) => hex.k)
    .filter((key) => (
      !game.units?.[key]
      && key !== "0,0"
      && key !== giantHex(game)
      && !isHiddenHex(game, key)
    ));
  if (!free.length) return false;

  let candidates = free.filter((key) => distanceToTarget(key) === TROLL_SPAWN_DISTANCE);
  if (!candidates.length) {
    free.sort((first, second) => distanceToTarget(second) - distanceToTarget(first));
    candidates = [free[0]];
  }
  const at = pick(candidates, rng);
  game.units = game.units || {};
  game.units[at] = {
    p: TROLL_PLAYER_INDEX,
    t: "saqueador",
    tv: targetVertex,
    pause: Math.max(0, game.players.length - TROLL_SPAWN_DISTANCE),
  };
  events.push({ type: "RAIDER_SPAWNED", at, targetVertex, source });
  return true;
}

function leadingPlayerIndex(game) {
  let leader = 0;
  let best = -Infinity;
  game.players.forEach((_, index) => {
    const score = warPublicScore(game, index);
    if (score > best) {
      leader = index;
      best = score;
    }
  });
  return leader;
}

function spawnWave(game, graph, rng, events) {
  const targets = [];
  game.players.forEach((player) => {
    if (player.capV != null && game.builds?.[player.capV]) targets.push(player.capV);
  });
  const leader = leadingPlayerIndex(game);
  const leaderCapital = game.players[leader]?.capV;
  if (leaderCapital != null && game.builds?.[leaderCapital]) targets.push(leaderCapital);
  targets.forEach((targetVertex) => {
    if (raiderHexes(game).length < raiderLimit(game)) {
      spawnRaider(game, graph, targetVertex, rng, events, "WAVE");
    }
  });
}

function refillHorde(game, graph, rng, events) {
  const capitals = game.players
    .map((player) => player.capV)
    .filter((vertex) => vertex != null && game.builds?.[vertex]);
  if (!capitals.length) return 0;
  let added = 0;
  let guard = 0;
  while (raiderHexes(game).length < raiderLimit(game) && guard++ < 12) {
    const targetVertex = pick(capitals, rng);
    if (spawnRaider(game, graph, targetVertex, rng, events, "REFILL")) added += 1;
    else break;
  }
  if (added) events.push({ type: "HORDE_REFILLED", added });
  return added;
}

function arriveRaider(game, key, rng, events) {
  const unit = game.units?.[key];
  if (!unit || unit.blk) return;
  const building = game.builds?.[unit.tv];
  if (!building) return;
  unit.blk = unit.tv;
  unit.fresh = game.players.length;
  const player = game.players[building.p];
  const available = RESOURCE_KEYS.filter((resource) => (player.res?.[resource] || 0) > 0);
  let resource = null;
  if (available.length) {
    resource = pick(available, rng);
    player.res[resource] -= 1;
  }
  events.push({
    type: "RAIDER_ARRIVED",
    at: key,
    targetVertex: unit.tv,
    ownerIndex: building.p,
    buildingType: building.t,
    resource,
  });
}

function moveRaiders(game, graph, rng, events) {
  raiderHexes(game).forEach((key) => {
    const unit = game.units?.[key];
    if (!unit) return;
    if (unit.fresh) unit.fresh -= 1;
    if (unit.blk) {
      if (!game.builds?.[unit.blk]) delete unit.blk;
      return;
    }
    if (unit.pause > 0) {
      unit.pause -= 1;
      events.push({ type: "RAIDER_PAUSED", at: key, remaining: unit.pause });
      return;
    }
    const goals = graph?.verts?.[unit.tv]?.hexes || [];
    if (!goals.length) return;
    const distanceToTarget = (candidate) => Math.min(...goals.map((goal) => hexDistance(candidate, goal)));
    if (distanceToTarget(key) === 0) {
      arriveRaider(game, key, rng, events);
      return;
    }
    let best = null;
    let bestDistance = distanceToTarget(key);
    neighboringHexes(game, key).forEach((candidate) => {
      if (game.units?.[candidate] || candidate === giantHex(game) || isHiddenHex(game, candidate)) return;
      const distance = distanceToTarget(candidate);
      if (distance < bestDistance) {
        best = candidate;
        bestDistance = distance;
      }
    });
    if (!best) return;
    delete game.units[key];
    game.units[best] = unit;
    events.push({ type: "RAIDER_MOVED", fromHex: key, toHex: best, targetVertex: unit.tv });
    if (distanceToTarget(best) === 0) arriveRaider(game, best, rng, events);
  });
}

function wakeTroll(game, graph, actorIndex, rng, events) {
  const troll = game.troll;
  const playerCount = game.players.length;
  troll.awake = true;
  troll.lair = troll.lair || pickTrollLair(game);
  const lairHex = hexOf(game, troll.lair);
  if (lairHex) lairHex.lair = 1;
  const maxHp = trollHealthForPlayers(playerCount);
  troll.giant = {
    at: troll.lair,
    hp: maxHp,
    maxHp,
    pause: Math.max(0, playerCount - TROLL_SPAWN_DISTANCE),
  };
  events.push({ type: "TROLL_AWAKENED", actorIndex, lair: troll.lair, maxHp });
  spawnWave(game, graph, rng, events);
}

export function reduceTrollOmen(game, graph, actorIndex, { rng = Math.random } = {}) {
  assertWarMode(game);
  assertPlayer(game, actorIndex);
  const next = cloneGame(game);
  const events = [];
  const troll = next.troll;
  if (!troll || troll.defeated) return { game: next, event: { type: "TROLL_OMEN", actorIndex, events } };

  if (!troll.awake) {
    const cap = next.players.length;
    if ((troll.rush || 0) < cap) {
      troll.rush = (troll.rush || 0) + 1;
      events.push({ type: "TROLL_OMEN_RUSH", actorIndex, rush: troll.rush, cap });
    }
  } else if (raiderHexes(next).length < raiderLimit(next)) {
    const capitals = next.players
      .map((player) => player.capV)
      .filter((vertex) => vertex != null && next.builds?.[vertex]);
    if (capitals.length) {
      const targetVertex = pick(capitals, rng);
      if (spawnRaider(next, graph, targetVertex, rng, events, "OMEN")) {
        events.push({ type: "TROLL_OMEN_RAIDER", actorIndex, targetVertex });
      }
    }
  }
  return { game: next, event: { type: "TROLL_OMEN", actorIndex, events } };
}

export function reduceWarEndTurnSweep(game, graph, actorIndex) {
  assertWarMode(game);
  assertPlayer(game, actorIndex);
  const next = cloneGame(game);
  const events = [];
  const giant = giantHex(next);
  if (!giant) return { game: next, event: { type: "WAR_END_TURN_SWEEP", actorIndex, events } };

  Object.keys(next.units || {}).forEach((key) => {
    const unit = next.units[key];
    if (!unit || unit.p !== actorIndex || isTrollUnit(unit) || hexDistance(key, giant) !== 1) return;
    if (unit.atk) {
      delete unit.atk;
      events.push({ type: "GIANT_CAMPER_SPARED", actorIndex, at: key, unitType: unit.t });
      return;
    }
    delete next.units[key];
    events.push({ type: "GIANT_CAMPER_CRUSHED", actorIndex, at: key, unitType: unit.t });
  });
  const occupationReleases = releaseInvalidOccupations(next, graph);
  occupationReleases.forEach((release) => events.push({ type: "OCCUPATION_RELEASED", ...release, reason: "GIANT_SWEEP" }));
  return { game: next, event: { type: "WAR_END_TURN_SWEEP", actorIndex, events, occupationReleases } };
}

export function reduceWarSieges(game, graph, playerIndex, { rng = Math.random } = {}) {
  assertWarMode(game);
  assertPlayer(game, playerIndex);
  const next = cloneGame(game);
  next.occ = next.occ || {};
  next.glory = next.glory || {};
  next.gloried = next.gloried || {};
  const events = [];

  const occupationReleases = releaseInvalidOccupations(next, graph);
  occupationReleases.forEach((release) => events.push({ type: "OCCUPATION_RELEASED", ...release, reason: "START_TURN_RECHECK" }));

  const siegeCount = (vertex) => (graph?.verts?.[vertex]?.hexes || []).filter((key) => {
    const unit = next.units?.[key];
    return unit && unit.p === playerIndex && unit.t === "catapulta";
  }).length;

  Object.entries(next.builds || {}).forEach(([vertex, building]) => {
    if (building.p === playerIndex || next.occ[vertex] != null) return;
    const required = (building.t === 2 ? 2 : 1) + (hasWarPerk(next, building.p, "maria") ? 1 : 0);
    const catapults = siegeCount(vertex);
    if (catapults < required) return;
    next.occ[vertex] = playerIndex;
    const gloryKey = `${vertex}|${playerIndex}`;
    let gloryAwarded = false;
    if (!next.gloried[gloryKey]) {
      next.gloried[gloryKey] = 1;
      next.glory[playerIndex] = (next.glory[playerIndex] || 0) + 1;
      gloryAwarded = true;
    }
    events.push({
      type: "BUILDING_OCCUPIED",
      vertex,
      occupierIndex: playerIndex,
      ownerIndex: building.p,
      buildingType: building.t,
      catapults,
      required,
      gloryAwarded,
    });
  });

  const compromised = Object.keys(next.occ).filter((vertex) => (
    next.builds?.[vertex]
    && next.builds[vertex].p === playerIndex
    && next.occ[vertex] != null
  ));
  const resources = [];
  compromised.forEach(() => {
    const resource = pick(RESOURCE_KEYS, rng);
    next.players[playerIndex].res[resource] = (next.players[playerIndex].res[resource] || 0) + 1;
    resources.push(resource);
  });
  if (resources.length) events.push({ type: "OCCUPATION_CONTRABAND", playerIndex, resources });

  return {
    game: next,
    event: {
      type: "WAR_SIEGES_RESOLVED",
      playerIndex,
      events,
      occupationReleases,
      occupied: events.filter((event) => event.type === "BUILDING_OCCUPIED"),
      contraband: resources,
    },
  };
}

export function reduceTrollTurn(game, graph, turnPosition, { rng = Math.random } = {}) {
  assertWarMode(game);
  if (!Number.isSafeInteger(turnPosition) || turnPosition < 0 || turnPosition >= (game.order?.length || 0)) {
    throw new RangeError("Posição de turno inválida para a horda.");
  }
  const next = cloneGame(game);
  const events = [];
  const troll = next.troll;
  if (!troll || (troll.defeated && !raiderHexes(next).length)) {
    return { game: next, event: { type: "TROLL_TURN_RESOLVED", turnPosition, events } };
  }

  troll.turns = (troll.turns || 0) + 1;
  const need = TROLL_WAKE_TURNS - (troll.rush || 0);
  const actorIndex = next.order[turnPosition];
  if (!troll.awake) {
    if (!troll.warned && troll.turns >= need - next.players.length) {
      troll.warned = true;
      events.push({ type: "TROLL_WARNING", actorIndex, turns: troll.turns, wakesAt: need });
    }
    if (troll.turns >= need) wakeTroll(next, graph, actorIndex, rng, events);
    return { game: next, event: { type: "TROLL_TURN_RESOLVED", turnPosition, actorIndex, events } };
  }

  const giant = troll.giant;
  if (giant && !troll.defeated) {
    if (giant.pause > 0) {
      giant.pause -= 1;
      events.push({ type: "GIANT_PAUSED", at: giant.at, remaining: giant.pause });
    } else if (giant.at !== "0,0") {
      const fromHex = giant.at;
      const toHex = stepToward(next, giant.at, "0,0");
      if (toHex !== giant.at) {
        const victim = next.units?.[toHex];
        if (victim) {
          delete next.units[toHex];
          events.push({
            type: "GIANT_STOMPED_UNIT",
            at: toHex,
            playerIndex: isTrollUnit(victim) ? null : victim.p,
            unitType: victim.t,
            raider: isTrollUnit(victim),
          });
        }
        giant.at = toHex;
        events.push({ type: "GIANT_MOVED", fromHex, toHex });
      }
      if (giant.at === "0,0") events.push({ type: "GIANT_REACHED_HEART", actorIndex });
    }
  }

  moveRaiders(next, graph, rng, events);

  if (turnPosition === 0 && giant && !troll.defeated) {
    const melee = Object.keys(next.units || {}).filter((key) => {
      const unit = next.units[key];
      return unit && !isTrollUnit(unit) && unit.t !== "arqueiro" && hexDistance(key, giant.at) === 1;
    });
    if (melee.length) {
      const key = pick(melee, rng);
      const victim = next.units[key];
      delete next.units[key];
      events.push({ type: "GIANT_ROUND_SWEEP", at: key, playerIndex: victim.p, unitType: victim.t });
    }
    if (giant.at === "0,0") refillHorde(next, graph, rng, events);
  }

  const occupationReleases = releaseInvalidOccupations(next, graph);
  occupationReleases.forEach((release) => events.push({ type: "OCCUPATION_RELEASED", ...release, reason: "TROLL_AUTOMATION" }));
  return {
    game: next,
    event: {
      type: "TROLL_TURN_RESOLVED",
      turnPosition,
      actorIndex,
      events,
      occupationReleases,
    },
  };
}

export function reduceWarStartTurnAutomation(game, graph, playerIndex, turnPosition, { rng = Math.random } = {}) {
  if (game.order?.[turnPosition] !== playerIndex) throw new Error("A posição de turno não corresponde ao jogador ativo.");
  const sieges = reduceWarSieges(game, graph, playerIndex, { rng });
  const troll = reduceTrollTurn(sieges.game, graph, turnPosition, { rng });
  return {
    game: troll.game,
    event: {
      type: "WAR_START_TURN_AUTOMATION",
      playerIndex,
      turnPosition,
      siege: sieges.event,
      troll: troll.event,
      events: [...sieges.event.events, ...troll.event.events],
    },
  };
}
