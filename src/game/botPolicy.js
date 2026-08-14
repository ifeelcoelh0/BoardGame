import { GAME_ACTION } from "./gameProtocol.js";
import { listLegalActions } from "./legalActions.js";
import { rankBotActions } from "./botStrategy.js";
import {
  botTradeProposalSignature,
  listBotTradeProposals,
} from "./botEconomy.js";
import {
  botTradeAttemptsPerTurn,
  botTradeConsiderationRate,
  normalizeBotProfileId,
} from "./botProfiles.js";

export const BOT_POLICY_VERSION = 3;

function sampleIndex(length, rng) {
  if (length <= 1) return 0;
  const value = Number(rng());
  const normalized = Number.isFinite(value) ? Math.max(0, Math.min(0.9999999999999999, value)) : 0;
  return Math.floor(normalized * length);
}

function decisionTurnKey(game, actorIndex) {
  if (game?.phase !== "play") return `${game?.phase || "unknown"}:${actorIndex}`;
  return `play:${game?.round || 0}:${game?.turn?.pos ?? -1}:${actorIndex}`;
}

export function createBotDecisionMemory() {
  return {
    turnKey: null,
    tradeAttempts: 0,
    tradeConsidered: false,
    tradeEnabledThisTurn: false,
    proposedTradeSignatures: [],
  };
}

function prepareMemory(memory, game, actorIndex) {
  if (!memory || typeof memory !== "object") return null;
  const turnKey = decisionTurnKey(game, actorIndex);
  if (memory.turnKey !== turnKey) {
    memory.turnKey = turnKey;
    memory.tradeAttempts = 0;
    memory.tradeConsidered = false;
    memory.tradeEnabledThisTurn = false;
    memory.proposedTradeSignatures = [];
  }
  if (!Array.isArray(memory.proposedTradeSignatures)) memory.proposedTradeSignatures = [];
  if (!Number.isSafeInteger(memory.tradeAttempts) || memory.tradeAttempts < 0) memory.tradeAttempts = 0;
  return memory;
}

function strategicCandidates(gameView, actorIndex, legal, profileId, memory, rng) {
  if (!legal.some((action) => action.type === GAME_ACTION.END_TURN)) return legal;
  if (!memory) return legal;
  if (!memory.tradeConsidered) {
    memory.tradeConsidered = true;
    memory.tradeEnabledThisTurn = Number(rng()) < botTradeConsiderationRate(profileId);
  }
  if (!memory.tradeEnabledThisTurn) return legal;
  const maxAttempts = botTradeAttemptsPerTurn(profileId);
  if (maxAttempts <= 0 || (memory.tradeAttempts || 0) >= maxAttempts) return legal;
  const proposals = listBotTradeProposals(gameView, actorIndex, {
    profileId,
    attemptedSignatures: memory?.proposedTradeSignatures || [],
  });
  return proposals.length ? [...legal, ...proposals] : legal;
}

/**
 * Bot V3. Canonical legal actions remain the source of executable game rules;
 * the policy adds only a bounded set of bot-generated trade proposals because
 * the full trade action space is intentionally too large for listLegalActions.
 *
 * `memory` is transient bot runtime state, not GameState. It prevents a bot
 * from repeating rejected offers forever without polluting saves/reducers or
 * changing what human players are allowed to do.
 */
export function chooseBotAction(gameView, actorIndex, {
  rng = Math.random,
  profileId = "balanced",
  memory = null,
} = {}) {
  const normalizedProfileId = normalizeBotProfileId(profileId);
  const preparedMemory = prepareMemory(memory, gameView, actorIndex);
  const legal = listLegalActions(gameView, actorIndex);
  if (!legal.length) return null;

  const candidates = strategicCandidates(gameView, actorIndex, legal, normalizedProfileId, preparedMemory, rng);
  const ranked = rankBotActions(gameView, actorIndex, candidates, { profileId: normalizedProfileId });
  if (!ranked.length) return null;
  const bestScore = ranked[0].score;
  const best = ranked.filter((entry) => entry.score === bestScore);
  const action = best[sampleIndex(best.length, rng)]?.action || null;

  if (action?.type === GAME_ACTION.PROPOSE_TRADE && preparedMemory) {
    const signature = botTradeProposalSignature(action);
    if (signature && !preparedMemory.proposedTradeSignatures.includes(signature)) {
      preparedMemory.proposedTradeSignatures.push(signature);
    }
    preparedMemory.tradeAttempts += 1;
  }
  return action;
}
