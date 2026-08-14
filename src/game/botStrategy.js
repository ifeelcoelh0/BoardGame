import { GAME_ACTION } from "./gameProtocol.js";
import { makeBoardGraph } from "./boardGeometry.js";
import { vertexProductionScore } from "./productionPotential.js";
import {
  BUILD_COSTS,
  PIECE_LIMITS,
  RESOURCE_KEYS,
  canPay,
  handSize,
} from "./resources.js";
import {
  bankRatio,
  pieceCount,
  validPalaces,
} from "./buildingRules.js";
import {
  isExplorationMode,
  isRapidMode,
  isWarMode,
} from "./gameModes.js";
import {
  WAGON_COST,
  homeHexes,
} from "./explorationReducer.js";
import {
  WAR_UNIT_TYPES,
  giantHex,
  hexDistance,
  isTrollUnit,
  troopCost,
} from "./warReducer.js";

export const BOT_STRATEGY_VERSION = 1;

const ACTION_BASE_SCORE = Object.freeze({
  [GAME_ACTION.RESOLVE_DISCARD]: 100_000,
  [GAME_ACTION.RESOLVE_TSUNAMI]: 100_000,
  [GAME_ACTION.RESOLVE_QUEUE_RESOURCE]: 100_000,
  [GAME_ACTION.ROLL_DICE]: 95_000,
  [GAME_ACTION.PLACE_DRAGON]: 93_000,
  [GAME_ACTION.STEAL_RESOURCE]: 93_000,
  [GAME_ACTION.DEPLOY_UNIT]: 90_000,
  [GAME_ACTION.FOUND_REMOTE_VILLAGE]: 88_000,
  [GAME_ACTION.BUILD_PALACE]: 86_000,
  [GAME_ACTION.BUILD_VILLAGE]: 82_000,
  [GAME_ACTION.PLAY_DEV_CARD]: 69_000,
  [GAME_ACTION.RECRUIT_TROOP]: 67_000,
  [GAME_ACTION.UNIT_ACTION]: 64_000,
  [GAME_ACTION.LOAD_COLONISTS]: 63_000,
  [GAME_ACTION.BUILD_WAGON]: 61_000,
  [GAME_ACTION.BUILD_ROAD]: 57_000,
  [GAME_ACTION.BUY_DEV_CARD]: 54_000,
  [GAME_ACTION.BRIBE_UNIT]: 49_000,
  [GAME_ACTION.MOVE_WAGON]: 5_000,
  [GAME_ACTION.BANK_TRADE]: 4_000,
  [GAME_ACTION.ACCEPT_TRADE]: 3_000,
  [GAME_ACTION.DECLINE_TRADE]: 2_500,
  [GAME_ACTION.CANCEL_TRADE]: 2_000,
  [GAME_ACTION.REMATCH_READY]: 1_000,
  [GAME_ACTION.END_TURN]: 100,
});

function graphFor(game) {
  return makeBoardGraph(game?.board?.hexes || []);
}

function roadExpansionScore(game, graph, edgeKey) {
  const edge = graph?.edges?.[edgeKey];
  if (!edge) return 0;
  let score = 0;
  for (const vertex of [edge.a, edge.b]) {
    if (game.builds?.[vertex]) continue;
    score = Math.max(score, vertexProductionScore(game, graph, vertex));
    const openBranches = (graph?.verts?.[vertex]?.edges || [])
      .filter((candidate) => candidate !== edgeKey && game.roads?.[candidate] == null)
      .length;
    score += openBranches * 30;
  }
  return score;
}

function resourceAmount(player, resource) {
  return Math.max(0, Number(player?.res?.[resource]) || 0);
}

function missingFromCost(player, cost) {
  return RESOURCE_KEYS.reduce((sum, resource) => (
    sum + Math.max(0, (cost?.[resource] || 0) - resourceAmount(player, resource))
  ), 0);
}

function goalCatalog(game, actorIndex) {
  const player = game.players?.[actorIndex];
  if (!player) return [];
  const goals = [];

  const palaceRoom = pieceCount(game, actorIndex, "palacio") < PIECE_LIMITS.palacio
    && validPalaces(game, actorIndex).length > 0;
  const villageRoom = pieceCount(game, actorIndex, "aldeia") < PIECE_LIMITS.aldeia;
  const roadRoom = pieceCount(game, actorIndex, "estrada") < PIECE_LIMITS.estrada;

  if (palaceRoom) goals.push({ id: "palacio", priority: isRapidMode(game.mode) ? 15 : 13, cost: BUILD_COSTS.palacio });
  if (villageRoom) goals.push({ id: "aldeia", priority: isExplorationMode(game.mode) ? 13 : 12, cost: BUILD_COSTS.aldeia });
  if (game.deckCount > 0 || game.deck?.length > 0) goals.push({ id: "carta", priority: 8, cost: BUILD_COSTS.carta });
  if (roadRoom) goals.push({ id: "estrada", priority: 6, cost: BUILD_COSTS.estrada });

  if (isExplorationMode(game.mode)) {
    goals.push({ id: "carruagem", priority: 11, cost: WAGON_COST });
  }

  if (isWarMode(game.mode)) {
    for (const subtype of WAR_UNIT_TYPES) {
      goals.push({ id: `tropa:${subtype}`, priority: 15, cost: troopCost(game, actorIndex, subtype) });
    }
  }

  return goals;
}

function resourceNeed(game, actorIndex, resource) {
  const player = game.players?.[actorIndex];
  if (!player) return 0;
  let score = 0;
  for (const goal of goalCatalog(game, actorIndex)) {
    const deficit = Math.max(0, (goal.cost?.[resource] || 0) - resourceAmount(player, resource));
    if (!deficit) continue;
    const totalMissing = missingFromCost(player, goal.cost);
    score += goal.priority * deficit * (8 / Math.max(1, totalMissing));
  }
  return score;
}

function strategicResourceValue(game, actorIndex, resource) {
  const player = game.players?.[actorIndex];
  return resourceNeed(game, actorIndex, resource) * 18 + Math.min(4, resourceAmount(player, resource)) * 8;
}

function goalUnlockBonus(game, actorIndex, beforeResources, afterResources) {
  const player = game.players?.[actorIndex];
  if (!player) return 0;
  const beforePlayer = { ...player, res: beforeResources };
  const afterPlayer = { ...player, res: afterResources };
  let bonus = 0;
  for (const goal of goalCatalog(game, actorIndex)) {
    if (!canPay(beforePlayer, goal.cost) && canPay(afterPlayer, goal.cost)) {
      bonus = Math.max(bonus, goal.priority * 420);
    }
  }
  return bonus;
}

function applyResourceDelta(resources, give = {}, get = {}) {
  const next = { ...resources };
  for (const resource of RESOURCE_KEYS) {
    next[resource] = Math.max(0, (next[resource] || 0) - (give?.[resource] || 0) + (get?.[resource] || 0));
  }
  return next;
}

function tradeAcceptanceScore(game, actorIndex) {
  const trade = game?.trade;
  const player = game.players?.[actorIndex];
  if (!trade || !player) return -Infinity;
  let utility = 0;
  for (const resource of RESOURCE_KEYS) {
    utility += (trade.give?.[resource] || 0) * strategicResourceValue(game, actorIndex, resource);
    utility -= (trade.get?.[resource] || 0) * strategicResourceValue(game, actorIndex, resource);
  }
  const after = applyResourceDelta(player.res, trade.get, trade.give);
  utility += goalUnlockBonus(game, actorIndex, player.res, after);
  return utility;
}

function bankTradeScore(game, actorIndex, action, graph) {
  const player = game.players?.[actorIndex];
  if (!player) return 0;
  const ratio = bankRatio(game, graph, actorIndex, action.give);
  const giveValue = strategicResourceValue(game, actorIndex, action.give);
  const getValue = strategicResourceValue(game, actorIndex, action.get);
  const surplus = Math.max(0, resourceAmount(player, action.give) - ratio);
  const after = {
    ...player.res,
    [action.give]: Math.max(0, resourceAmount(player, action.give) - ratio),
    [action.get]: resourceAmount(player, action.get) + 1,
  };
  return (getValue - giveValue * 0.45) * 18 + surplus * 40 + goalUnlockBonus(game, actorIndex, player.res, after);
}

function dragonScore(game, actorIndex, action, graph) {
  const hex = graph?.hexMap?.[action.hex];
  if (!hex) return 0;
  let score = 0;
  for (const vertex of hex.corners || []) {
    const building = game.builds?.[vertex];
    if (!building) continue;
    const weight = building.t === 2 ? 2 : 1;
    score += building.p === actorIndex ? -1_800 * weight : 1_250 * weight;
  }
  return score;
}

function stealScore(game, actorIndex, action) {
  const victim = game.players?.[action.victimIndex];
  if (!victim || action.victimIndex === actorIndex) return -10_000;
  return handSize(victim) * 190 + (victim.developmentCardCount || 0) * 16;
}

function ownCard(game, actorIndex, cardId) {
  const player = game.players?.[actorIndex];
  return [...(player?.devOld || []), ...(player?.devNew || [])].find((card) => card?.id === cardId) || null;
}

function developmentCardScore(game, actorIndex, action) {
  const card = ownCard(game, actorIndex, action.cardId);
  if (!card) return 0;
  let score = 0;
  if (card.kind === "estradas") score += 6_000;
  if (card.kind === "descoberta") score += 5_500;
  if (card.kind === "monopolio") score += 4_800;
  if (card.kind === "tropa") score += isWarMode(game.mode) ? 8_000 : 5_300;
  if (card.kind === "marcha") score += isWarMode(game.mode) ? 7_500 : 0;
  if (card.kind === "espiao") {
    const target = game.players?.find((player) => player?.playerId === action.targetPlayerId);
    score += (target?.resourceCount || handSize(target)) * 180;
  }
  if (action.resource) score += resourceNeed(game, actorIndex, action.resource) * 60;
  if (action.firstResource) score += resourceNeed(game, actorIndex, action.firstResource) * 55;
  if (action.secondResource) score += resourceNeed(game, actorIndex, action.secondResource) * 55;
  return score;
}

function warActionScore(game, actorIndex, action) {
  if (!isWarMode(game.mode)) return 0;
  const player = game.players?.[actorIndex];
  if (!player) return 0;
  const giant = giantHex(game);

  if (action.type === GAME_ACTION.RECRUIT_TROOP) {
    const count = player.troops?.[action.subtype] || 0;
    let score = 8_000 - count * 420;
    if (game.troll?.awake && action.subtype === "catapulta") score += 3_000;
    return score;
  }

  if (action.type === GAME_ACTION.DEPLOY_UNIT) {
    if (isTrollUnit(game.units?.[action.hex])) return 8_000;
    if (giant) return Math.max(0, 8 - hexDistance(action.hex, giant)) * 560;
    return 500;
  }

  if (action.type === GAME_ACTION.UNIT_ACTION) {
    const target = game.units?.[action.toHex];
    if (giant && action.toHex === giant) return 12_000;
    if (isTrollUnit(target)) return 10_000;
    if (target && target.p !== actorIndex) return 7_500;
    if (giant) {
      const before = hexDistance(action.fromHex, giant);
      const after = hexDistance(action.toHex, giant);
      return (before - after) * 1_100;
    }
    return 400;
  }

  if (action.type === GAME_ACTION.BRIBE_UNIT) return 3_000;
  return 0;
}

function axialDistance(first, second) {
  const [q1, r1] = String(first).split(",").map(Number);
  const [q2, r2] = String(second).split(",").map(Number);
  if (![q1, r1, q2, r2].every(Number.isFinite)) return 99;
  const dq = q1 - q2;
  const dr = r1 - r2;
  return (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2;
}

function potentialRemoteVillageScore(game, graph, hexKey) {
  const corners = graph?.hexMap?.[hexKey]?.corners || [];
  let best = 0;
  for (const vertex of corners) {
    if (game.builds?.[vertex]) continue;
    const tooClose = (graph?.verts?.[vertex]?.edges || []).some((edgeKey) => {
      const edge = graph.edges?.[edgeKey];
      const neighbor = edge?.a === vertex ? edge.b : edge?.a;
      return neighbor && game.builds?.[neighbor];
    });
    if (!tooClose) best = Math.max(best, vertexProductionScore(game, graph, vertex));
  }
  return best;
}

function explorationActionScore(game, actorIndex, action, graph) {
  if (!isExplorationMode(game.mode)) return 0;
  const player = game.players?.[actorIndex];
  if (!player) return 0;

  if (action.type === GAME_ACTION.FOUND_REMOTE_VILLAGE) {
    return vertexProductionScore(game, graph, action.vertex) + 7_000;
  }
  if (action.type === GAME_ACTION.LOAD_COLONISTS) return 7_500;
  if (action.type === GAME_ACTION.BUILD_WAGON) return 4_500;
  if (action.type !== GAME_ACTION.MOVE_WAGON) return 0;

  const wagon = game.wagons?.[action.wagonId];
  if (!wagon) return -5_000;
  const destination = graph?.hexMap?.[action.hex];
  if (destination?.hid === true || destination?.terr === "oculto") return 9_000;

  if (wagon.cargo) {
    const spot = potentialRemoteVillageScore(game, graph, action.hex);
    return spot > 0 ? 4_500 + spot : -2_000;
  }

  const homes = [...homeHexes(game, graph, actorIndex)];
  if (canPay(player, BUILD_COSTS.aldeia) && homes.length) {
    const before = Math.min(...homes.map((home) => axialDistance(wagon.at, home)));
    const after = Math.min(...homes.map((home) => axialDistance(action.hex, home)));
    if (after === 0) return 7_000;
    if (after < before) return 3_200 + (before - after) * 900;
  }

  // Empty wagons should not endlessly wander across already-revealed terrain.
  return -6_000;
}


export function scoreBotAction(game, actorIndex, action, { graph = graphFor(game) } = {}) {
  let score = ACTION_BASE_SCORE[action?.type] ?? 0;
  const player = game.players?.[actorIndex];

  if (action.type === GAME_ACTION.BUILD_VILLAGE) {
    score += vertexProductionScore(game, graph, action.vertex);
  }
  if (action.type === GAME_ACTION.BUILD_PALACE) {
    score += vertexProductionScore(game, graph, action.vertex) * 0.65;
  }
  if (action.type === GAME_ACTION.BUILD_ROAD) {
    score += roadExpansionScore(game, graph, action.edge);
    if ((player?.freeRoads || 0) > 0) score += 7_000;
  }
  if (action.type === GAME_ACTION.RESOLVE_QUEUE_RESOURCE) {
    score += resourceNeed(game, actorIndex, action.resource) * 160;
  }
  if (action.type === GAME_ACTION.PLACE_DRAGON) score += dragonScore(game, actorIndex, action, graph);
  if (action.type === GAME_ACTION.STEAL_RESOURCE) score += stealScore(game, actorIndex, action);
  if (action.type === GAME_ACTION.BANK_TRADE) score += bankTradeScore(game, actorIndex, action, graph);
  if (action.type === GAME_ACTION.PLAY_DEV_CARD) score += developmentCardScore(game, actorIndex, action);
  if (action.type === GAME_ACTION.ACCEPT_TRADE) score += tradeAcceptanceScore(game, actorIndex);
  if (action.type === GAME_ACTION.DECLINE_TRADE) {
    const acceptScore = tradeAcceptanceScore(game, actorIndex);
    score += acceptScore <= 0 ? 5_000 : -5_000;
  }
  score += warActionScore(game, actorIndex, action);
  score += explorationActionScore(game, actorIndex, action, graph);
  return score;
}

export function rankBotActions(game, actorIndex, actions) {
  const graph = graphFor(game);
  return (actions || [])
    .map((action, index) => ({ action, score: scoreBotAction(game, actorIndex, action, { graph }), index }))
    .sort((a, b) => b.score - a.score || a.index - b.index);
}
