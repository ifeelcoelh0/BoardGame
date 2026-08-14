import { requiredGameActorIndex } from "./mandatoryDecisionReducer.js";
import { ensureGamePlayerIdentities, createStableId } from "./playerIdentity.js";
import {
  LOBBY_RECONNECT_GRACE_MS,
  PLAYER_CONTROLLER,
  beginGameTurnReconnectWindow,
  clearGameTurnReconnectWindow,
  ensurePlayerPresence,
  markPlayerConnected,
  markPlayerDisconnected,
} from "./playerPresence.js";
import { reduceTradeForDisconnectedPlayer } from "./tradeReducer.js";

export const GAME_RECOVERY_VERSION = 1;

const TRADE_ID_RE = /^trade_[a-f0-9]{24}$/;

function clone(value) {
  if (value == null) return value;
  return globalThis.structuredClone
    ? structuredClone(value)
    : JSON.parse(JSON.stringify(value));
}

function normalizeTradeIdentityReferences(game, createId) {
  const trade = game?.trade;
  if (!trade) return false;
  let changed = false;
  if (!TRADE_ID_RE.test(trade.id || "")) {
    trade.id = createId("trade");
    changed = true;
  }
  if (Number.isSafeInteger(trade.from) && game.players?.[trade.from]) {
    const playerId = game.players[trade.from].playerId;
    if (trade.fromPlayerId !== playerId) {
      trade.fromPlayerId = playerId;
      changed = true;
    }
  }
  if (trade.to === "all") {
    if (trade.toPlayerId !== "all") {
      trade.toPlayerId = "all";
      changed = true;
    }
  } else if (Number.isSafeInteger(trade.to) && game.players?.[trade.to]) {
    const playerId = game.players[trade.to].playerId;
    if (trade.toPlayerId !== playerId) {
      trade.toPlayerId = playerId;
      changed = true;
    }
  }
  return changed;
}

/**
 * Rebuilds the reconnect window that belongs to the currently required actor.
 * This is runtime-derived state: stale deadlines from a previous browser
 * lifecycle are discarded, while the underlying mandatory decision is kept.
 */
export function normalizeGameTurnPresence(state, now = Date.now()) {
  if (!state || !Array.isArray(state.players)) return -1;
  const requiredIndex = requiredGameActorIndex(state);
  state.players.forEach((player, index) => {
    ensurePlayerPresence(player);
    const requiredNow = index === requiredIndex;
    if (requiredNow && player.connected === false) beginGameTurnReconnectWindow(player, { now });
    else clearGameTurnReconnectWindow(player);
  });
  return requiredIndex;
}

/**
 * Converts a persisted authoritative game into a safe host-runtime starting
 * point. It deliberately does not advance rules, consume mandatory decisions,
 * touch board/mode state, or rewrite the action journal.
 */
export function recoverSavedGameForHost(sourceGame, {
  now = Date.now,
  createId = createStableId,
} = {}) {
  if (!sourceGame || typeof sourceGame !== "object" || Array.isArray(sourceGame)) {
    throw new TypeError("A saved game is required for host recovery.");
  }
  if (typeof now !== "function") throw new TypeError("Recovery clock must be a function.");
  if (typeof createId !== "function") throw new TypeError("Recovery id factory must be a function.");

  const game = ensureGamePlayerIdentities(clone(sourceGame));
  if (!Array.isArray(game.players) || !game.players.length) {
    throw new Error("O reino não tem anfitrião.");
  }

  const recoveredAt = Number(now());
  if (!Number.isFinite(recoveredAt)) throw new TypeError("Recovery clock returned an invalid time.");

  const report = {
    recoveredAt,
    requiredActorIndex: -1,
    disconnectedPlayerIndices: [],
    tradeEvents: [],
    lobbyStartCleared: false,
    rematchReadyCleared: 0,
    tradeIdentityRepaired: false,
    presentationEventsCleared: 0,
  };

  report.tradeIdentityRepaired = normalizeTradeIdentityReferences(game, createId);
  if (game.presentation && typeof game.presentation === "object" && !Array.isArray(game.presentation)) {
    for (const field of ["story", "cardReveal", "award", "disaster"]) {
      if (game.presentation[field] != null) report.presentationEventsCleared += 1;
      game.presentation[field] = null;
    }
  }

  game.players.forEach((player) => ensurePlayerPresence(player));
  markPlayerConnected(game.players[0]);

  for (let index = 1; index < game.players.length; index += 1) {
    const player = game.players[index];
    if (player.controller === PLAYER_CONTROLLER.BOT) {
      markPlayerConnected(player);
      if (game.phase === "lobby") player.ready = true;
      continue;
    }

    markPlayerDisconnected(player, {
      now: recoveredAt,
      phase: game.phase,
      graceMs: LOBBY_RECONNECT_GRACE_MS,
    });
    report.disconnectedPlayerIndices.push(index);

    const tradePresence = reduceTradeForDisconnectedPlayer(game, index);
    if (tradePresence.event) {
      game.trade = tradePresence.game.trade;
      report.tradeEvents.push(tradePresence.event);
    }
  }

  if (game.phase === "lobby" && game.lobbyStarting) {
    delete game.lobbyStarting;
    report.lobbyStartCleared = true;
  }

  // Rematch readiness is a live connection intent, not durable match state.
  // Keeping it across a host reload can reopen a rematch with only the host
  // connected on the next commit, silently dropping disconnected players.
  if (game.phase === "ended") {
    for (const player of game.players) {
      if (player.ready === true) report.rematchReadyCleared += 1;
      player.ready = false;
    }
  }

  report.requiredActorIndex = normalizeGameTurnPresence(game, recoveredAt);
  return { game, report };
}
