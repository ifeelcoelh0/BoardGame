import {
  activateBotController,
  isGameTurnReconnectExpired,
} from "../game/playerPresence.js";
import { findPlayerIndexById } from "../game/playerIdentity.js";
import { requiredGameActorIndex } from "../game/mandatoryDecisionReducer.js";

export const HOST_GAME_PRESENCE_CONTROLLER_VERSION = 1;

/**
 * Owns host-side reconnect timers during setup/play. A disconnected human is
 * given their reconnect window only when the game actually requires an action
 * from that seat. When the window expires, control is transferred to the
 * normal bot controller; no game rule is bypassed and no action is skipped.
 */
export function createHostGamePresenceController(options = {}) {
  const {
    getGame,
    commit,
    enqueueAuthorityTask,
    clone,
    addLog = () => {},
    characterName = (characterId) => String(characterId || "jogador"),
    isHost = () => true,
    now = Date.now,
    setTimeoutFn = setTimeout,
    clearTimeoutFn = clearTimeout,
  } = options;

  if (typeof getGame !== "function" || typeof commit !== "function") {
    throw new TypeError("Host game presence controller requires getGame and commit.");
  }

  const queue = typeof enqueueAuthorityTask === "function"
    ? enqueueAuthorityTask
    : async (task) => task();
  const copy = typeof clone === "function"
    ? clone
    : (value) => JSON.parse(JSON.stringify(value));
  const timers = new Map();

  const clear = (playerId) => {
    const timer = timers.get(playerId);
    if (timer != null) clearTimeoutFn(timer);
    timers.delete(playerId);
  };

  const activateBotAfterReconnectTimeout = async (playerId, expectedDeadline = null) => {
    const current = getGame();
    if (!isHost() || !current || !["setup", "play"].includes(current.phase) || current.winner != null) {
      return false;
    }

    const actorIndex = requiredGameActorIndex(current);
    const playerIndex = findPlayerIndexById(current, playerId);
    if (playerIndex < 0 || playerIndex !== actorIndex) return false;

    const player = current.players[playerIndex];
    if (!player || player.connected !== false || player.controller === "bot") return false;
    if (expectedDeadline != null && player.turnReconnectDeadline !== expectedDeadline) return false;
    if (!isGameTurnReconnectExpired(player, now())) return false;

    const next = copy(current);
    const takeoverPlayer = next.players[playerIndex];
    activateBotController(takeoverPlayer, { now: now() });
    addLog(
      next,
      `🤖 ${characterName(takeoverPlayer.ch)} não regressou a tempo. Um bot assumiu o seu reino.`,
      playerIndex,
    );
    clear(playerId);
    await commit(next);
    return true;
  };

  const schedule = (playerId, deadline) => {
    clear(playerId);
    if (!Number.isFinite(deadline)) return;
    const delay = Math.max(0, deadline - now()) + 25;
    const timer = setTimeoutFn(() => {
      timers.delete(playerId);
      void queue(() => activateBotAfterReconnectTimeout(playerId, deadline));
    }, delay);
    timers.set(playerId, timer);
  };

  const sync = (state) => {
    if (!isHost() || !state || !["setup", "play"].includes(state.phase) || state.winner != null) {
      for (const playerId of [...timers.keys()]) clear(playerId);
      return;
    }

    const requiredIndex = requiredGameActorIndex(state);
    const requiredPlayer = requiredIndex >= 0 ? state.players[requiredIndex] : null;
    const active = new Set();
    if (
      requiredPlayer?.controller !== "bot"
      && requiredPlayer?.connected === false
      && Number.isFinite(requiredPlayer.turnReconnectDeadline)
    ) {
      active.add(requiredPlayer.playerId);
      schedule(requiredPlayer.playerId, requiredPlayer.turnReconnectDeadline);
    }

    for (const playerId of [...timers.keys()]) {
      if (!active.has(playerId)) clear(playerId);
    }
  };

  const dispose = () => {
    for (const playerId of [...timers.keys()]) clear(playerId);
  };

  return {
    clear,
    sync,
    dispose,
    activateBotAfterReconnectTimeout,
    timerCount: () => timers.size,
  };
}
