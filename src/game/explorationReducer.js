import { pieceCount } from "./buildingRules.js";
import { TERRAIN_RESOURCE_BY_TYPE } from "./constructionReducer.js";
import { BUILD_COSTS, PIECE_LIMITS, canPay, payCost } from "./resources.js";

export const WAGON_COST = Object.freeze({ madeira: 1, cavalos: 2 });
export const EMPTY_WAGON_MOVES = 2;
export const LOADED_WAGON_MOVES = 1;
export const MAX_WAGONS_PER_GAME = 2;

const HEX_DIRECTIONS = Object.freeze([
  [1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1],
]);

function cloneGame(game) {
  if (typeof structuredClone === "function") return structuredClone(game);
  return JSON.parse(JSON.stringify(game));
}

function assertExploration(game) {
  if (game?.mode !== "exploracao") throw new Error("A ação só está disponível no modo Exploração.");
}

function assertActor(game, actorIndex) {
  if (!Number.isSafeInteger(actorIndex) || actorIndex < 0 || actorIndex >= (game.players?.length || 0)) {
    throw new RangeError("Jogador inválido para a ação de exploração.");
  }
}

export function explorationHex(game, key) {
  return game.board?.hexes?.find((hex) => hex.k === key) || null;
}

export function isHiddenExplorationHex(game, key) {
  return explorationHex(game, key)?.hid === true;
}

export function neighboringExplorationHexes(game, key) {
  const [q, r] = String(key).split(",").map(Number);
  if (!Number.isFinite(q) || !Number.isFinite(r)) return [];
  return HEX_DIRECTIONS
    .map(([dq, dr]) => `${q + dq},${r + dr}`)
    .filter((candidate) => Boolean(explorationHex(game, candidate)));
}

export function wagonMoves(wagon) {
  return wagon?.cargo ? LOADED_WAGON_MOVES : EMPTY_WAGON_MOVES;
}

export function wagonBuildCount(game, playerIndex) {
  return Number(game.wbuilt?.[playerIndex]) || 0;
}

export function playerWagons(game, playerIndex) {
  return Object.entries(game.wagons || {}).filter(([, wagon]) => wagon.p === playerIndex);
}

export function homeHexes(game, graph, playerIndex) {
  const result = new Set();
  for (const [vertex, building] of Object.entries(game.builds || {})) {
    if (building.p !== playerIndex) continue;
    for (const key of graph?.verts?.[vertex]?.hexes || []) {
      if (!isHiddenExplorationHex(game, key)) result.add(key);
    }
  }
  return result;
}

export function validWagonBuildHexes(game, graph, playerIndex) {
  assertActor(game, playerIndex);
  if (game.mode !== "exploracao") return [];
  if (playerWagons(game, playerIndex).length >= 1) return [];
  if (wagonBuildCount(game, playerIndex) >= MAX_WAGONS_PER_GAME) return [];
  if (!canPay(game.players[playerIndex], WAGON_COST)) return [];
  return [...homeHexes(game, graph, playerIndex)];
}

export function validWagonMoves(game, wagonId, playerIndex) {
  const wagon = game.wagons?.[wagonId];
  if (!wagon || wagon.p !== playerIndex || wagon.mv <= 0) return [];
  return neighboringExplorationHexes(game, wagon.at);
}

export function remoteVillageSpots(game, graph, wagonId) {
  const wagon = game.wagons?.[wagonId];
  const corners = graph?.hexMap?.[wagon?.at]?.corners || [];
  if (!wagon || !wagon.cargo) return [];
  return corners.filter((vertex) => {
    if (game.builds?.[vertex]) return false;
    const touchesVisibleHex = (graph?.verts?.[vertex]?.hexes || []).some((key) => !isHiddenExplorationHex(game, key));
    if (!touchesVisibleHex) return false;
    return !(graph?.verts?.[vertex]?.edges || []).some((edgeKey) => {
      const edge = graph?.edges?.[edgeKey];
      if (!edge) return false;
      const neighbor = edge.a === vertex ? edge.b : edge.a;
      return Boolean(game.builds?.[neighbor]);
    });
  });
}

export function reduceWagonConstruction(game, graph, actorIndex, hexKey) {
  assertExploration(game);
  assertActor(game, actorIndex);
  if (!validWagonBuildHexes(game, graph, actorIndex).includes(hexKey)) {
    throw new Error("Local inválido para construir a carruagem.");
  }
  const next = cloneGame(game);
  payCost(next.players[actorIndex], WAGON_COST);
  next.wseq = (next.wseq || 0) + 1;
  next.wbuilt ||= {};
  next.wagons ||= {};
  next.wbuilt[actorIndex] = wagonBuildCount(next, actorIndex) + 1;
  const wagonId = `w${next.wseq}`;
  next.wagons[wagonId] = { p: actorIndex, at: hexKey, cargo: 0, mv: EMPTY_WAGON_MOVES };
  return {
    game: next,
    event: {
      type: "WAGON_BUILT",
      actorIndex,
      wagonId,
      hex: hexKey,
      builtCount: next.wbuilt[actorIndex],
      lastAvailable: next.wbuilt[actorIndex] === MAX_WAGONS_PER_GAME,
    },
  };
}

function revealDestination(next, graph, actorIndex, hexKey) {
  const hex = explorationHex(next, hexKey);
  if (!hex?.hid) return null;
  hex.hid = false;
  const resource = TERRAIN_RESOURCE_BY_TYPE[hex.terr] || null;
  if (resource) next.players[actorIndex].res[resource] = (next.players[actorIndex].res[resource] || 0) + 1;
  const ports = [];
  for (let index = 0; index < (next.board?.ports || []).length; index += 1) {
    const port = next.board.ports[index];
    if (port.hid && graph?.edges?.[port.e]?.hexes?.includes(hexKey)) {
      port.hid = false;
      ports.push({ index, edge: port.e, type: port.type });
    }
  }
  return { hex: hexKey, terrain: hex.terr, resource, reward: resource ? 1 : 0, ports };
}

export function reduceWagonMove(game, graph, actorIndex, wagonId, destination) {
  assertExploration(game);
  assertActor(game, actorIndex);
  if (!validWagonMoves(game, wagonId, actorIndex).includes(destination)) {
    throw new Error("Movimento de carruagem inválido.");
  }
  const next = cloneGame(game);
  const wagon = next.wagons[wagonId];
  const fromHex = wagon.at;
  wagon.at = destination;
  const reveal = revealDestination(next, graph, actorIndex, destination);
  wagon.mv = reveal ? 0 : Math.max(0, wagon.mv - 1);
  return {
    game: next,
    event: {
      type: "WAGON_MOVED",
      actorIndex,
      wagonId,
      fromHex,
      toHex: destination,
      movesLeft: wagon.mv,
      reveal,
    },
  };
}

export function reduceColonistLoading(game, graph, actorIndex, wagonId) {
  assertExploration(game);
  assertActor(game, actorIndex);
  const wagon = game.wagons?.[wagonId];
  if (!wagon || wagon.p !== actorIndex || wagon.cargo || !homeHexes(game, graph, actorIndex).has(wagon.at)) {
    throw new Error("A carruagem não pode carregar colonos aqui.");
  }
  if (pieceCount(game, actorIndex, "aldeia") >= PIECE_LIMITS.aldeia) throw new Error("Limite de aldeias atingido.");
  if (!canPay(game.players[actorIndex], BUILD_COSTS.aldeia)) throw new Error("Recursos insuficientes para os colonos.");
  const next = cloneGame(game);
  payCost(next.players[actorIndex], BUILD_COSTS.aldeia);
  next.wagons[wagonId].cargo = 1;
  next.wagons[wagonId].mv = Math.min(next.wagons[wagonId].mv, LOADED_WAGON_MOVES);
  return { game: next, event: { type: "COLONISTS_LOADED", actorIndex, wagonId, hex: wagon.at } };
}

export function reduceRemoteVillageFoundation(game, graph, actorIndex, wagonId, vertex) {
  assertExploration(game);
  assertActor(game, actorIndex);
  const wagon = game.wagons?.[wagonId];
  if (!wagon || wagon.p !== actorIndex || !remoteVillageSpots(game, graph, wagonId).includes(vertex)) {
    throw new Error("Local inválido para fundar a aldeia distante.");
  }
  const next = cloneGame(game);
  const hex = next.wagons[wagonId].at;
  delete next.wagons[wagonId];
  next.builds ||= {};
  next.builds[vertex] = { p: actorIndex, t: 1 };
  return { game: next, event: { type: "REMOTE_VILLAGE_FOUNDED", actorIndex, wagonId, vertex, hex } };
}

export function reduceWagonTurnReset(game, playerIndex) {
  const next = cloneGame(game);
  for (const wagon of Object.values(next.wagons || {})) {
    wagon.mv = wagon.p === playerIndex ? wagonMoves(wagon) : 0;
  }
  return { game: next, event: { type: "WAGONS_RESET", playerIndex } };
}
