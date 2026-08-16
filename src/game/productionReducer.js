import { RESOURCE_KEYS } from "./resources.js";
import { terrainResource } from "./constructionReducer.js";
import { isWarMode } from "./gameModes.js";

const RAIDER_PLAYER_INDEX = -9;

function emptyGainMap() {
  return Object.fromEntries(RESOURCE_KEYS.map((resource) => [resource, 0]));
}

function isRaider(unit) {
  return !!unit && unit.p === RAIDER_PLAYER_INDEX;
}

function raiderBlocksVertex(game, vertex) {
  return Object.values(game.units || {}).some((unit) => isRaider(unit) && unit.blk === vertex);
}

function cloneProductionStats(stats, playerCount) {
  const source = stats || {};
  return {
    ...source,
    produced: Array.from({ length: playerCount }, (_, index) => source.produced?.[index] || 0),
    dragonBlocked: Array.from({ length: playerCount }, (_, index) => source.dragonBlocked?.[index] || 0),
  };
}

export function calculateProduction(game, graph, roll) {
  const gains = game.players.map(() => emptyGainMap());
  const dragonBlocked = game.players.map(() => 0);
  const sources = game.players.map(() => []);
  const warMode = isWarMode(game.mode);

  for (const hex of game.board.hexes) {
    if (hex.num !== roll || hex.hid) continue;
    const resource = terrainResource(hex.terr);
    if (!resource) continue;
    const graphHex = graph.hexMap[hex.k];
    if (!graphHex) continue;

    for (const vertex of graphHex.corners) {
      const building = game.builds[vertex];
      if (!building) continue;
      const occupant = warMode && game.occ ? game.occ[vertex] : null;

      if (hex.k === game.board.dragon && !game.players[building.p]?.immune) {
        const blockedPlayer = occupant != null ? occupant : building.p;
        dragonBlocked[blockedPlayer] += occupant != null ? 1 : building.t;
        continue;
      }
      if (warMode && game.troll && raiderBlocksVertex(game, vertex)) continue;

      const recipient = occupant != null ? occupant : building.p;
      const amount = occupant != null ? 1 : building.t;
      gains[recipient][resource] += amount;
      sources[recipient].push({ hex: hex.k, vertex, resource, amount });
    }
  }

  return { gains, dragonBlocked, sources };
}

export function reduceProduction(game, graph, roll) {
  const production = calculateProduction(game, graph, roll);
  const players = game.players.slice();
  for (let index = 0; index < players.length; index += 1) {
    const gain = production.gains[index];
    const total = RESOURCE_KEYS.reduce((sum, resource) => sum + gain[resource], 0);
    if (!total) continue;
    const player = players[index];
    const resources = { ...player.res };
    for (const resource of RESOURCE_KEYS) {
      if (gain[resource]) resources[resource] = (resources[resource] || 0) + gain[resource];
    }
    players[index] = { ...player, res: resources };
  }

  const stats = cloneProductionStats(game.stats, game.players.length);
  for (let index = 0; index < players.length; index += 1) {
    const produced = RESOURCE_KEYS.reduce((sum, resource) => sum + production.gains[index][resource], 0);
    stats.produced[index] += produced;
    stats.dragonBlocked[index] += production.dragonBlocked[index];
  }

  return {
    game: { ...game, players, stats },
    ...production,
  };
}
