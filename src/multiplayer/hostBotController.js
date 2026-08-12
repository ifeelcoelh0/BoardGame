import { applyGameAction } from "../game/gameActionReducer.js";
import { chooseBotAction } from "../game/botPolicy.js";
import { createGameStateView } from "../game/gameStateView.js";
import { PLAYER_CONTROLLER } from "../game/playerPresence.js";
import { requiredGameActorIndex } from "../game/mandatoryDecisionReducer.js";

export const HOST_BOT_CONTROLLER_VERSION = 1;
export const DEFAULT_BOT_ACTION_DELAY_MS = 650;

function isBot(player) {
  return player?.controller === PLAYER_CONTROLLER.BOT;
}

export function nextBotActorIndex(game) {
  if (!game || !Array.isArray(game.players)) return -1;

  if (game.phase === "ended") {
    return game.players.findIndex((player) => isBot(player) && player.ready !== true);
  }

  const trade = game.trade;
  if (trade) {
    const tradeBot = game.players.findIndex((player, index) => (
      isBot(player)
      && index !== trade.from
      && (trade.to === index || trade.to === "all")
      && !(trade.declined || []).includes(index)
    ));
    if (tradeBot >= 0) return tradeBot;
  }

  const required = requiredGameActorIndex(game);
  return required >= 0 && isBot(game.players[required]) ? required : -1;
}

/**
 * Schedules exactly one bot action. The next committed revision schedules the
 * next step, which prevents long synchronous bot loops and keeps animations,
 * network broadcasts and saves observable between actions.
 */
export function scheduleHostBotAction({
  game,
  getGame,
  enqueueAuthorityTask,
  commit,
  onGameApplied = () => {},
  rng = Math.random,
  now = Date.now,
  delayMs = DEFAULT_BOT_ACTION_DELAY_MS,
  onError = () => {},
} = {}) {
  const initialActor = nextBotActorIndex(game);
  if (initialActor < 0 || typeof getGame !== "function" || typeof commit !== "function") return () => {};
  const queue = typeof enqueueAuthorityTask === "function" ? enqueueAuthorityTask : async (task) => task();
  let cancelled = false;
  const timer = setTimeout(() => {
    if (cancelled) return;
    void queue(async () => {
      if (cancelled) return false;
      const current = getGame();
      const actorIndex = nextBotActorIndex(current);
      if (actorIndex < 0) return false;
      const player = current.players[actorIndex];
      const view = createGameStateView(current, player.playerId);
      const action = chooseBotAction(view, actorIndex, { rng });
      if (!action) return false;
      const applied = applyGameAction(current, player.playerId, action, { rng, now });
      if (!applied.ok) {
        onError({ actorIndex, action, reason: applied.reason });
        return false;
      }
      await onGameApplied(applied.game, applied);
      await commit(applied.game);
      return true;
    });
  }, Math.max(0, Number(delayMs) || 0));
  return () => {
    cancelled = true;
    clearTimeout(timer);
  };
}
