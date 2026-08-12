import { GAME_ACTION } from "./gameProtocol.js";
import { makeBoardGraph } from "./boardGeometry.js";
import { RESOURCE_KEYS } from "./resources.js";
import { listLegalActions } from "./legalActions.js";

export const BOT_POLICY_VERSION = 1;

const BASE_SCORE = Object.freeze({
  [GAME_ACTION.RESOLVE_DISCARD]: 10_000,
  [GAME_ACTION.RESOLVE_TSUNAMI]: 10_000,
  [GAME_ACTION.RESOLVE_QUEUE_RESOURCE]: 10_000,
  [GAME_ACTION.ROLL_DICE]: 9_500,
  [GAME_ACTION.PLACE_DRAGON]: 9_300,
  [GAME_ACTION.STEAL_RESOURCE]: 9_300,
  [GAME_ACTION.DEPLOY_UNIT]: 9_200,
  [GAME_ACTION.BUILD_PALACE]: 8_200,
  [GAME_ACTION.BUILD_VILLAGE]: 7_800,
  [GAME_ACTION.PLAY_DEV_CARD]: 7_100,
  [GAME_ACTION.FOUND_REMOTE_VILLAGE]: 6_900,
  [GAME_ACTION.BUILD_ROAD]: 6_300,
  [GAME_ACTION.BUY_DEV_CARD]: 5_800,
  [GAME_ACTION.RECRUIT_TROOP]: 5_500,
  [GAME_ACTION.UNIT_ACTION]: 5_200,
  [GAME_ACTION.BRIBE_UNIT]: 4_900,
  [GAME_ACTION.LOAD_COLONISTS]: 4_800,
  [GAME_ACTION.BUILD_WAGON]: 4_600,
  [GAME_ACTION.MOVE_WAGON]: 4_100,
  [GAME_ACTION.BANK_TRADE]: 2_000,
  [GAME_ACTION.ACCEPT_TRADE]: 1_500,
  [GAME_ACTION.DECLINE_TRADE]: 1_400,
  [GAME_ACTION.CANCEL_TRADE]: 1_300,
  [GAME_ACTION.REMATCH_READY]: 1_000,
  [GAME_ACTION.END_TURN]: 0,
});


const DICE_PIPS = Object.freeze({
  2: 1, 3: 2, 4: 3, 5: 4, 6: 5,
  8: 5, 9: 4, 10: 3, 11: 2, 12: 1,
});

function settlementScore(game, vertex) {
  if (!vertex) return 0;
  const graph = makeBoardGraph(game?.board?.hexes || []);
  const adjacent = graph?.verts?.[vertex]?.hexes || [];
  let production = 0;
  const terrains = new Set();
  for (const hexKey of adjacent) {
    const hex = graph?.hexMap?.[hexKey];
    if (!hex || hex.hid === true || hex.terr === "oculto" || hex.terr === "deserto") continue;
    production += DICE_PIPS[hex.num] || 0;
    if (hex.terr) terrains.add(hex.terr);
  }
  // Production dominates; variety is a small tie-breaker. This is intentionally
  // based only on visible terrain in the bot's redacted state view.
  return production * 180 + terrains.size * 25;
}

function sampleIndex(length, rng) {
  if (length <= 1) return 0;
  const value = Number(rng());
  const normalized = Number.isFinite(value) ? Math.max(0, Math.min(0.9999999999999999, value)) : 0;
  return Math.floor(normalized * length);
}

function resourceNeedScore(player, resource) {
  const amount = player?.res?.[resource] || 0;
  return Math.max(0, 5 - amount) * 12;
}

function tradeScore(game, actorIndex, action) {
  const trade = game?.trade;
  if (!trade || action.type !== GAME_ACTION.ACCEPT_TRADE) return 0;
  const offered = RESOURCE_KEYS.reduce((sum, resource) => sum + (trade.give?.[resource] || 0), 0);
  const requested = RESOURCE_KEYS.reduce((sum, resource) => sum + (trade.get?.[resource] || 0), 0);
  const need = RESOURCE_KEYS.reduce((sum, resource) => (
    sum + resourceNeedScore(game.players?.[actorIndex], resource) * (trade.give?.[resource] || 0)
  ), 0);
  return (offered - requested) * 120 + need;
}

function actionScore(game, actorIndex, action) {
  let score = BASE_SCORE[action.type] ?? 100;
  const player = game.players?.[actorIndex];

  if (action.type === GAME_ACTION.BUILD_VILLAGE) {
    score += settlementScore(game, action.vertex);
  }
  if (action.type === GAME_ACTION.RESOLVE_QUEUE_RESOURCE) {
    score += resourceNeedScore(player, action.resource);
  }
  if (action.type === GAME_ACTION.BANK_TRADE) {
    score += resourceNeedScore(player, action.get) - resourceNeedScore(player, action.give);
  }
  if (action.type === GAME_ACTION.PLAY_DEV_CARD) {
    if (action.resource) score += resourceNeedScore(player, action.resource);
    if (action.firstResource) score += resourceNeedScore(player, action.firstResource);
    if (action.secondResource) score += resourceNeedScore(player, action.secondResource);
  }
  if (action.type === GAME_ACTION.ACCEPT_TRADE) score += tradeScore(game, actorIndex, action);
  if (action.type === GAME_ACTION.DECLINE_TRADE) {
    const accept = listLegalActions(game, actorIndex).some((candidate) => candidate.type === GAME_ACTION.ACCEPT_TRADE);
    if (!accept) score += 500;
  }
  return score;
}

/**
 * A deliberately simple first bot: it never reads more than the caller gives
 * it, prefers progress/VP actions, answers mandatory decisions immediately and
 * always retains END_TURN as a safe escape hatch.
 */
export function chooseBotAction(gameView, actorIndex, { rng = Math.random } = {}) {
  const legal = listLegalActions(gameView, actorIndex);
  if (!legal.length) return null;

  const scored = legal.map((action) => ({ action, score: actionScore(gameView, actorIndex, action) }));
  const bestScore = Math.max(...scored.map((entry) => entry.score));
  const best = scored.filter((entry) => entry.score === bestScore).map((entry) => entry.action);
  return best[sampleIndex(best.length, rng)] || null;
}
