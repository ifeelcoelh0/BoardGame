import { activePorts } from "./buildingRules.js";
import {
  RESOURCE_KEYS,
  isResourceKey,
} from "./resources.js";

export const DISASTER_DEFINITIONS = Object.freeze({
  ganancia: Object.freeze({
    n: "Ganância",
    i: "💰",
    d: "Cada desprotegido perde 1 recurso aleatório; os senhores do número sagrado dividem o saque — e quem ficar de mãos a abanar recebe 1 do banco.",
  }),
  peste: Object.freeze({
    n: "Peste Negra",
    i: "☠️",
    d: "Quarentena para todos os desprotegidos: nenhum pode jogar cartas de tropa durante 2 turnos.",
  }),
  tsunami: Object.freeze({
    n: "Tsunami",
    i: "🌊",
    d: "Cada desprotegido perde um porto à escolha por 3 turnos — ou, sem portos, as ondas levam-lhe 1 recurso.",
  }),
  tributo: Object.freeze({
    n: "Tributo Real",
    i: "👑",
    d: "Cada desprotegido paga 1 recurso aleatório; os senhores do número sagrado recebem 2 recursos à escolha.",
  }),
});

export const DISASTER_TYPES = Object.freeze(Object.keys(DISASTER_DEFINITIONS));

function randomIndex(length, rng) {
  if (!Number.isSafeInteger(length) || length <= 0) {
    throw new RangeError("Não é possível escolher de uma coleção vazia.");
  }
  const sample = rng();
  if (!Number.isFinite(sample)) throw new TypeError("O RNG do desastre devolveu um valor inválido.");
  return Math.min(length - 1, Math.max(0, Math.floor(sample * length)));
}

function pickRandom(values, rng) {
  return values[randomIndex(values.length, rng)];
}

function shuffled(values, rng) {
  const result = values.slice();
  for (let index = result.length - 1; index > 0; index -= 1) {
    const other = randomIndex(index + 1, rng);
    [result[index], result[other]] = [result[other], result[index]];
  }
  return result;
}

function resourcesWithStock(player) {
  return RESOURCE_KEYS.filter((resource) => (player?.res?.[resource] || 0) > 0);
}

function clonePlayer(player) {
  return {
    ...player,
    res: { ...(player?.res || {}) },
    portOff: Array.isArray(player?.portOff)
      ? player.portOff.map((entry) => ({ ...entry }))
      : [],
  };
}

function cloneDisasterState(game) {
  return {
    ...game,
    players: (game.players || []).map(clonePlayer),
    queue: Array.isArray(game.queue) ? game.queue.map((item) => ({ ...item })) : [],
    stats: {
      ...(game.stats || {}),
      disasters: (game.stats?.disasters || 0) + 1,
    },
  };
}

export function protectedPlayerIndexes(game, graph, sacredNumber) {
  const protectedPlayers = new Set();
  for (const hex of game?.board?.hexes || []) {
    if (hex.num !== sacredNumber) continue;
    const graphHex = graph?.hexMap?.[hex.k];
    if (!graphHex) continue;
    for (const vertex of graphHex.corners || []) {
      const building = game.builds?.[vertex];
      if (Number.isSafeInteger(building?.p) && building.p >= 0 && building.p < game.players.length) {
        protectedPlayers.add(building.p);
      }
    }
  }
  return [...protectedPlayers];
}

function chooseDisasterType(type, rng) {
  if (type == null) return pickRandom(DISASTER_TYPES, rng);
  if (!DISASTER_TYPES.includes(type)) throw new TypeError(`Desastre desconhecido: ${String(type)}`);
  return type;
}

function resourceLoss(next, playerIndex, reason, effects, rng) {
  const available = resourcesWithStock(next.players[playerIndex]);
  if (!available.length) {
    effects.push({ type: "EMPTY_RESOURCES", playerIndex, reason });
    return null;
  }
  const resource = pickRandom(available, rng);
  next.players[playerIndex].res[resource] -= 1;
  effects.push({ type: "RESOURCE_LOST", playerIndex, resource, reason });
  return resource;
}

function applyGreed(next, protectedPlayers, affectedPlayers, effects, rng) {
  const lootBag = [];
  for (const playerIndex of affectedPlayers) {
    const resource = resourceLoss(next, playerIndex, "GREED", effects, rng);
    if (resource) lootBag.push(resource);
  }

  const received = Object.fromEntries(protectedPlayers.map((playerIndex) => [playerIndex, 0]));
  let recipientOffset = protectedPlayers.length ? randomIndex(protectedPlayers.length, rng) : 0;
  for (const resource of shuffled(lootBag, rng)) {
    const playerIndex = protectedPlayers[recipientOffset % protectedPlayers.length];
    next.players[playerIndex].res[resource] = (next.players[playerIndex].res[resource] || 0) + 1;
    received[playerIndex] += 1;
    effects.push({ type: "RESOURCE_GRANTED", playerIndex, resource, source: "GREED_LOOT" });
    recipientOffset += 1;
  }

  for (const playerIndex of protectedPlayers) {
    if (received[playerIndex]) continue;
    const resource = pickRandom(RESOURCE_KEYS, rng);
    next.players[playerIndex].res[resource] = (next.players[playerIndex].res[resource] || 0) + 1;
    effects.push({ type: "RESOURCE_GRANTED", playerIndex, resource, source: "BANK_COMPENSATION" });
  }
}

function applyPlague(next, affectedPlayers, effects) {
  for (const playerIndex of affectedPlayers) {
    next.players[playerIndex].sick = 2;
    effects.push({ type: "QUARANTINED", playerIndex, turns: 2 });
  }
}

function applyTsunami(next, graph, affectedPlayers, effects, rng) {
  for (const playerIndex of affectedPlayers) {
    const ports = activePorts(next, graph, playerIndex);
    if (ports.length === 1) {
      next.players[playerIndex].portOff.push({ e: ports[0].e, left: 3 });
      effects.push({ type: "PORT_DISABLED", playerIndex, edge: ports[0].e, turns: 3 });
      continue;
    }
    if (ports.length > 1) {
      next.queue.push({ t: "tsunami", p: playerIndex });
      effects.push({
        type: "PORT_CHOICE_REQUIRED",
        playerIndex,
        edges: ports.map((port) => port.e),
      });
      continue;
    }
    const resource = resourceLoss(next, playerIndex, "TSUNAMI", effects, rng);
    if (!resource) effects.push({ type: "COAST_UNTOUCHED", playerIndex });
  }
}

function applyTribute(next, protectedPlayers, affectedPlayers, effects, rng) {
  for (const playerIndex of affectedPlayers) {
    resourceLoss(next, playerIndex, "TRIBUTE", effects, rng);
  }
  for (const playerIndex of protectedPlayers) {
    next.queue.push({ t: "tributo", p: playerIndex, left: 2 });
    effects.push({ type: "TRIBUTE_CHOICE_REQUIRED", playerIndex, amount: 2 });
  }
}

export function reduceDisaster(game, graph, sacredNumber, options = {}) {
  const rng = options.rng || Math.random;
  const now = options.now || Date.now;
  const next = cloneDisasterState(game);
  const protectedPlayers = protectedPlayerIndexes(next, graph, sacredNumber);
  const immunePlayers = next.players
    .map((player, playerIndex) => (player?.immune ? playerIndex : null))
    .filter((playerIndex) => playerIndex != null && !protectedPlayers.includes(playerIndex));
  const affectedPlayers = next.players
    .map((_, playerIndex) => playerIndex)
    .filter((playerIndex) => (
      !protectedPlayers.includes(playerIndex)
      && !immunePlayers.includes(playerIndex)
    ));

  const baseEvent = {
    type: "DISASTER_RESOLVED",
    sacredNumber,
    disasterId: Number(now()),
    protectedPlayers,
    immunePlayers,
    affectedPlayers,
    effects: [],
  };

  if (!protectedPlayers.length) {
    return {
      game: next,
      event: { ...baseEvent, outcome: "NO_PROTECTED", disasterType: null },
    };
  }
  if (!affectedPlayers.length) {
    return {
      game: next,
      event: { ...baseEvent, outcome: "NO_TARGETS", disasterType: null },
    };
  }

  const disasterType = chooseDisasterType(options.type, rng);
  const effects = [];
  if (disasterType === "ganancia") {
    applyGreed(next, protectedPlayers, affectedPlayers, effects, rng);
  } else if (disasterType === "peste") {
    applyPlague(next, affectedPlayers, effects);
  } else if (disasterType === "tsunami") {
    applyTsunami(next, graph, affectedPlayers, effects, rng);
  } else if (disasterType === "tributo") {
    applyTribute(next, protectedPlayers, affectedPlayers, effects, rng);
  }

  return {
    game: next,
    event: {
      ...baseEvent,
      outcome: "APPLIED",
      disasterType,
      effects,
    },
  };
}

export function reduceTsunamiPortChoice(game, graph, actorIndex, edge) {
  const pending = game.queue?.[0];
  if (!pending || pending.t !== "tsunami" || pending.p !== actorIndex) {
    throw new Error("Não existe uma escolha de tsunami pendente para este jogador.");
  }
  const port = activePorts(game, graph, actorIndex).find((candidate) => candidate.e === edge);
  if (!port) throw new Error("O porto escolhido não está ativo.");

  const players = game.players.slice();
  const player = clonePlayer(players[actorIndex]);
  player.portOff.push({ e: port.e, left: 3 });
  players[actorIndex] = player;
  return {
    game: { ...game, players, queue: game.queue.slice(1) },
    event: { type: "TSUNAMI_PORT_RESOLVED", playerIndex: actorIndex, edge: port.e, turns: 3 },
  };
}

export function reduceTributeResourceChoice(game, actorIndex, resource) {
  const pending = game.queue?.[0];
  if (!pending || pending.t !== "tributo" || pending.p !== actorIndex || pending.left <= 0) {
    throw new Error("Não existe um tributo pendente para este jogador.");
  }
  if (!isResourceKey(resource)) throw new TypeError("O recurso de tributo é inválido.");

  const players = game.players.slice();
  const player = clonePlayer(players[actorIndex]);
  player.res[resource] = (player.res[resource] || 0) + 1;
  players[actorIndex] = player;

  const remaining = pending.left - 1;
  const queue = game.queue.slice();
  if (remaining > 0) queue[0] = { ...pending, left: remaining };
  else queue.shift();

  return {
    game: { ...game, players, queue },
    event: {
      type: "TRIBUTE_RESOURCE_RESOLVED",
      playerIndex: actorIndex,
      resource,
      remaining,
      completed: remaining === 0,
    },
  };
}
