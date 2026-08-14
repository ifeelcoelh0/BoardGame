import { GAME_ACTION } from "./gameProtocol.js";
import { makeBoardGraph } from "./boardGeometry.js";
import { vertexProductionScore } from "./productionPotential.js";
import {
  BUILD_COSTS,
  canPay,
  handSize,
} from "./resources.js";
import {
  isExplorationMode,
  isRapidMode,
  isWarMode,
} from "./gameModes.js";
import { homeHexes } from "./explorationReducer.js";
import {
  giantHex,
  hexDistance,
  isTrollUnit,
} from "./warReducer.js";
import {
  botActionBaseScore,
  botCardKindBias,
  normalizeBotProfileId,
} from "./botProfiles.js";
import {
  botBankTradeScore,
  botResourceNeed,
  botTradeAcceptanceScore,
} from "./botEconomy.js";

export const BOT_STRATEGY_VERSION = 2;

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

function developmentCardScore(game, actorIndex, action, profileId) {
  const card = ownCard(game, actorIndex, action.cardId);
  if (!card) return 0;
  let score = 0;
  if (card.kind === "estradas") score += 6_000;
  if (card.kind === "descoberta") score += 5_500;
  if (card.kind === "monopolio") score += 4_800;
  if (card.kind === "tropa") score += isWarMode(game.mode) ? 8_000 : 5_300;
  if (card.kind === "marcha") score += isWarMode(game.mode) ? 7_500 : 0;
  score += botCardKindBias(profileId, card.kind);
  if (card.kind === "espiao") {
    const target = game.players?.find((player) => player?.playerId === action.targetPlayerId);
    score += (target?.resourceCount || handSize(target)) * 180;
  }
  if (action.resource) score += botResourceNeed(game, actorIndex, action.resource) * 60;
  if (action.firstResource) score += botResourceNeed(game, actorIndex, action.firstResource) * 55;
  if (action.secondResource) score += botResourceNeed(game, actorIndex, action.secondResource) * 55;
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


export function scoreBotAction(game, actorIndex, action, { graph = graphFor(game), profileId = "balanced" } = {}) {
  const normalizedProfileId = normalizeBotProfileId(profileId);
  let score = botActionBaseScore(normalizedProfileId, action?.type);
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
    score += botResourceNeed(game, actorIndex, action.resource) * 160;
  }
  if (action.type === GAME_ACTION.PLACE_DRAGON) score += dragonScore(game, actorIndex, action, graph);
  if (action.type === GAME_ACTION.STEAL_RESOURCE) score += stealScore(game, actorIndex, action);
  if (action.type === GAME_ACTION.BANK_TRADE) score += botBankTradeScore(game, actorIndex, action, graph);
  if (action.type === GAME_ACTION.PLAY_DEV_CARD) score += developmentCardScore(game, actorIndex, action, normalizedProfileId);
  if (action.type === GAME_ACTION.ACCEPT_TRADE) score += botTradeAcceptanceScore(game, actorIndex);
  if (action.type === GAME_ACTION.DECLINE_TRADE) {
    const acceptScore = botTradeAcceptanceScore(game, actorIndex);
    score += acceptScore <= 0 ? 5_000 : -5_000;
  }
  score += warActionScore(game, actorIndex, action);
  score += explorationActionScore(game, actorIndex, action, graph);
  return score;
}

export function rankBotActions(game, actorIndex, actions, { profileId = "balanced" } = {}) {
  const graph = graphFor(game);
  const normalizedProfileId = normalizeBotProfileId(profileId);
  return (actions || [])
    .map((action, index) => ({ action, score: scoreBotAction(game, actorIndex, action, { graph, profileId: normalizedProfileId }), index }))
    .sort((a, b) => b.score - a.score || a.index - b.index);
}
