import { GAME_ACTION } from "./gameProtocol.js";
import {
  BUILD_COSTS,
  PIECE_LIMITS,
  RESOURCE_KEYS,
  canPay,
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
import { WAGON_COST } from "./explorationReducer.js";
import { WAR_UNIT_TYPES, troopCost } from "./warReducer.js";
import {
  botTradeUtilityThreshold,
} from "./botProfiles.js";

function resourceAmount(player, resource) {
  return Math.max(0, Number(player?.res?.[resource]) || 0);
}

function missingFromCost(player, cost) {
  return RESOURCE_KEYS.reduce((sum, resource) => (
    sum + Math.max(0, (cost?.[resource] || 0) - resourceAmount(player, resource))
  ), 0);
}

export function botGoalCatalog(game, actorIndex) {
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

  if (isExplorationMode(game.mode)) goals.push({ id: "carruagem", priority: 11, cost: WAGON_COST });
  if (isWarMode(game.mode)) {
    for (const subtype of WAR_UNIT_TYPES) {
      goals.push({ id: `tropa:${subtype}`, priority: 15, cost: troopCost(game, actorIndex, subtype) });
    }
  }
  return goals;
}

function resourceNeedFromGoals(player, goals, resource) {
  let score = 0;
  for (const goal of goals) {
    const deficit = Math.max(0, (goal.cost?.[resource] || 0) - resourceAmount(player, resource));
    if (!deficit) continue;
    const totalMissing = missingFromCost(player, goal.cost);
    score += goal.priority * deficit * (8 / Math.max(1, totalMissing));
  }
  return score;
}

export function botResourceNeed(game, actorIndex, resource) {
  const player = game.players?.[actorIndex];
  if (!player) return 0;
  return resourceNeedFromGoals(player, botGoalCatalog(game, actorIndex), resource);
}

export function botStrategicResourceValue(game, actorIndex, resource) {
  const player = game.players?.[actorIndex];
  return botResourceNeed(game, actorIndex, resource) * 18
    + Math.min(4, resourceAmount(player, resource)) * 8;
}

function goalUnlockBonusFromGoals(player, goals, beforeResources, afterResources) {
  const beforePlayer = { ...player, res: beforeResources };
  const afterPlayer = { ...player, res: afterResources };
  let bonus = 0;
  for (const goal of goals) {
    if (!canPay(beforePlayer, goal.cost) && canPay(afterPlayer, goal.cost)) {
      bonus = Math.max(bonus, goal.priority * 420);
    }
  }
  return bonus;
}

export function botGoalUnlockBonus(game, actorIndex, beforeResources, afterResources) {
  const player = game.players?.[actorIndex];
  if (!player) return 0;
  return goalUnlockBonusFromGoals(player, botGoalCatalog(game, actorIndex), beforeResources, afterResources);
}

export function applyBotResourceDelta(resources, give = {}, get = {}) {
  const next = { ...resources };
  for (const resource of RESOURCE_KEYS) {
    next[resource] = Math.max(0, (next[resource] || 0) - (give?.[resource] || 0) + (get?.[resource] || 0));
  }
  return next;
}

export function botTradeAcceptanceScore(game, actorIndex) {
  const trade = game?.trade;
  const player = game.players?.[actorIndex];
  if (!trade || !player) return -Infinity;
  let utility = 0;
  for (const resource of RESOURCE_KEYS) {
    utility += (trade.give?.[resource] || 0) * botStrategicResourceValue(game, actorIndex, resource);
    utility -= (trade.get?.[resource] || 0) * botStrategicResourceValue(game, actorIndex, resource);
  }
  const after = applyBotResourceDelta(player.res, trade.get, trade.give);
  utility += botGoalUnlockBonus(game, actorIndex, player.res, after);
  return utility;
}

export function botBankTradeScore(game, actorIndex, action, graph) {
  const player = game.players?.[actorIndex];
  if (!player) return 0;
  const ratio = bankRatio(game, graph, actorIndex, action.give);
  const giveValue = botStrategicResourceValue(game, actorIndex, action.give);
  const getValue = botStrategicResourceValue(game, actorIndex, action.get);
  const surplus = Math.max(0, resourceAmount(player, action.give) - ratio);
  const after = {
    ...player.res,
    [action.give]: Math.max(0, resourceAmount(player, action.give) - ratio),
    [action.get]: resourceAmount(player, action.get) + 1,
  };
  return (getValue - giveValue * 0.45) * 18
    + surplus * 40
    + botGoalUnlockBonus(game, actorIndex, player.res, after);
}

function proposalUtility(player, goals, strategicValues, giveResource, getResource) {
  if (!player || giveResource === getResource || resourceAmount(player, giveResource) <= 0) return -Infinity;
  const giveValue = strategicValues[giveResource] || 0;
  const getValue = strategicValues[getResource] || 0;
  const after = applyBotResourceDelta(player.res, { [giveResource]: 1 }, { [getResource]: 1 });
  const unlock = goalUnlockBonusFromGoals(player, goals, player.res, after);
  const surplus = Math.max(0, resourceAmount(player, giveResource) - 1);
  return (getValue - giveValue) + unlock + surplus * 24;
}

export function botTradeProposalSignature(action) {
  if (action?.type !== GAME_ACTION.PROPOSE_TRADE) return null;
  const give = RESOURCE_KEYS.map((resource) => `${resource}:${action.give?.[resource] || 0}`).join("|");
  const get = RESOURCE_KEYS.map((resource) => `${resource}:${action.get?.[resource] || 0}`).join("|");
  return `${action.toPlayerId || "all"}::${give}::${get}`;
}

/**
 * Produces a deliberately small, information-safe set of 1:1 broadcast trade
 * offers. Opponent resources are private, so proposals depend only on the
 * acting player's visible hand and goals; recipients decide using their own
 * private view. The policy memory limits retries after rejection.
 */
export function listBotTradeProposals(game, actorIndex, {
  profileId = "balanced",
  attemptedSignatures = [],
  maxCandidates = 4,
} = {}) {
  const player = game.players?.[actorIndex];
  if (!player || game.phase !== "play" || game.trade || !game.turn?.rolled || game.turn?.mustDragon) return [];
  const blocked = new Set(attemptedSignatures || []);
  const threshold = botTradeUtilityThreshold(profileId);
  const candidates = [];
  const goals = botGoalCatalog(game, actorIndex);
  const strategicValues = Object.fromEntries(RESOURCE_KEYS.map((resource) => [
    resource,
    resourceNeedFromGoals(player, goals, resource) * 18 + Math.min(4, resourceAmount(player, resource)) * 8,
  ]));

  for (const giveResource of RESOURCE_KEYS) {
    if (resourceAmount(player, giveResource) <= 0) continue;
    for (const getResource of RESOURCE_KEYS) {
      if (getResource === giveResource) continue;
      const utility = proposalUtility(player, goals, strategicValues, giveResource, getResource);
      if (!Number.isFinite(utility) || utility < threshold) continue;
      const action = {
        type: GAME_ACTION.PROPOSE_TRADE,
        toPlayerId: "all",
        give: { [giveResource]: 1 },
        get: { [getResource]: 1 },
      };
      const signature = botTradeProposalSignature(action);
      if (blocked.has(signature)) continue;
      candidates.push({ action, utility, signature });
    }
  }

  return candidates
    .sort((a, b) => b.utility - a.utility || a.signature.localeCompare(b.signature))
    .slice(0, Math.max(0, Number(maxCandidates) || 0))
    .map(({ action }) => action);
}
