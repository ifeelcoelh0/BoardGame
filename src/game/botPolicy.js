import { listLegalActions } from "./legalActions.js";
import { rankBotActions } from "./botStrategy.js";

export const BOT_POLICY_VERSION = 2;

function sampleIndex(length, rng) {
  if (length <= 1) return 0;
  const value = Number(rng());
  const normalized = Number.isFinite(value) ? Math.max(0, Math.min(0.9999999999999999, value)) : 0;
  return Math.floor(normalized * length);
}

/**
 * Bot V2. The policy receives only the caller-supplied state view, asks the
 * canonical legal-action API for executable choices and then ranks those
 * choices with a mode-aware heuristic. Hidden hands, deck order and fogged
 * terrain therefore remain unavailable by construction.
 */
export function chooseBotAction(gameView, actorIndex, { rng = Math.random } = {}) {
  const legal = listLegalActions(gameView, actorIndex);
  if (!legal.length) return null;

  const ranked = rankBotActions(gameView, actorIndex, legal);
  if (!ranked.length) return null;
  const bestScore = ranked[0].score;
  const best = ranked.filter((entry) => entry.score === bestScore);
  return best[sampleIndex(best.length, rng)]?.action || null;
}
