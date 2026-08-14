import { BUILD_COSTS, RESOURCE_KEYS } from "./resources.js";
import { isRapidMode } from "./gameModes.js";
import { INITIAL_PLAY_TURN, createPlayTurnState } from "./turnState.js";

export { INITIAL_PLAY_TURN };

function subtractCost(resources, cost) {
  const next = { ...resources };
  for (const [resource, amount] of Object.entries(cost)) {
    next[resource] = (next[resource] || 0) - amount;
  }
  return next;
}

function clonePlayerWithResources(player) {
  return { ...player, res: { ...player.res } };
}

function replacePlayer(game, actorIndex, player) {
  const players = game.players.slice();
  players[actorIndex] = player;
  return { ...game, players };
}

export function advanceSetupState(game) {
  const setup = {
    ...game.setup,
    needRoad: false,
    lastV: null,
    i: game.setup.i + 1,
  };
  let next = { ...game, setup };
  const setupCompleted = setup.i >= setup.seq.length;
  if (setupCompleted) {
    next = {
      ...next,
      phase: "play",
      turn: createPlayTurnState(),
    };
  }
  return { game: next, setupCompleted };
}

export function reduceRoadConstruction(game, actorIndex, edge) {
  if (game.phase === "setup") {
    const withRoad = {
      ...game,
      roads: { ...game.roads, [edge]: actorIndex },
    };
    const advanced = advanceSetupState(withRoad);
    return {
      ...advanced,
      event: {
        type: "SETUP_ROAD_BUILT",
        actorIndex,
        edge,
        setupCompleted: advanced.setupCompleted,
      },
    };
  }

  const currentPlayer = game.players[actorIndex];
  const player = clonePlayerWithResources(currentPlayer);
  const usedFreeRoad = (player.freeRoads || 0) > 0;
  if (usedFreeRoad) player.freeRoads -= 1;
  else player.res = subtractCost(player.res, BUILD_COSTS.estrada);

  const withPlayer = replacePlayer(game, actorIndex, player);
  const next = {
    ...withPlayer,
    roads: { ...game.roads, [edge]: actorIndex },
  };
  return {
    game: next,
    setupCompleted: false,
    event: { type: "ROAD_BUILT", actorIndex, edge, usedFreeRoad },
  };
}

export function reduceVillageConstruction(game, graph, actorIndex, vertex) {
  const rapidMode = isRapidMode(game.mode);
  const currentPlayer = game.players[actorIndex];
  const player = clonePlayerWithResources(currentPlayer);

  if (game.phase === "setup") {
    const secondPlacement = game.setup.i >= game.players.length;
    const resourceGains = Object.fromEntries(RESOURCE_KEYS.map((resource) => [resource, 0]));
    if (player.capV == null) player.capV = vertex;

    if (secondPlacement) {
      for (const hexKey of graph.verts[vertex]?.hexes || []) {
        const terrain = graph.hexMap[hexKey]?.terr;
        const resource = terrainResource(terrain);
        if (!resource) continue;
        player.res[resource] = (player.res[resource] || 0) + 1;
        resourceGains[resource] += 1;
      }
    }

    const withPlayer = replacePlayer(game, actorIndex, player);
    const next = {
      ...withPlayer,
      builds: {
        ...game.builds,
        [vertex]: { p: actorIndex, t: rapidMode ? 2 : 1 },
      },
      setup: {
        ...game.setup,
        lastV: vertex,
        needRoad: true,
      },
    };
    return {
      game: next,
      setupCompleted: false,
      event: {
        type: "SETUP_SETTLEMENT_BUILT",
        actorIndex,
        vertex,
        rapidMode,
        secondPlacement,
        resourceGains,
      },
    };
  }

  player.res = subtractCost(player.res, BUILD_COSTS.aldeia);
  const withPlayer = replacePlayer(game, actorIndex, player);
  const next = {
    ...withPlayer,
    builds: { ...game.builds, [vertex]: { p: actorIndex, t: 1 } },
  };
  return {
    game: next,
    setupCompleted: false,
    event: { type: "VILLAGE_BUILT", actorIndex, vertex },
  };
}

export function reducePalaceConstruction(game, actorIndex, vertex) {
  const currentPlayer = game.players[actorIndex];
  const player = clonePlayerWithResources(currentPlayer);
  player.res = subtractCost(player.res, BUILD_COSTS.palacio);
  const withPlayer = replacePlayer(game, actorIndex, player);
  const next = {
    ...withPlayer,
    builds: { ...game.builds, [vertex]: { p: actorIndex, t: 2 } },
  };
  return {
    game: next,
    setupCompleted: false,
    event: { type: "PALACE_BUILT", actorIndex, vertex },
  };
}

export const TERRAIN_RESOURCE_BY_TYPE = Object.freeze({
  floresta: "madeira",
  argila: "tijolo",
  prados: "cavalos",
  grutas: "ouro",
  montanhas: "obsidiana",
  deserto: null,
  gelo: null,
});

export function terrainResource(terrain) {
  return Object.prototype.hasOwnProperty.call(TERRAIN_RESOURCE_BY_TYPE, terrain)
    ? TERRAIN_RESOURCE_BY_TYPE[terrain]
    : null;
}
