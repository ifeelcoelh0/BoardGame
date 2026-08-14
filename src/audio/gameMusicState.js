import { calculateVictoryPoints } from "../game/scoringReducer.js";

export const ENDGAME_PUBLIC_VICTORY_POINTS = 8;
// Kept as a compatibility alias for callers from the first soundtrack pass.
export const FINALE_PUBLIC_VICTORY_POINTS = ENDGAME_PUBLIC_VICTORY_POINTS;

export function highestPublicVictoryPoints(game) {
  if (!game || !Array.isArray(game.players) || !game.players.length) return 0;
  let highest = 0;
  for (let index = 0; index < game.players.length; index += 1) {
    highest = Math.max(highest, calculateVictoryPoints(game, index, false));
  }
  return highest;
}

export function shouldEnterFinaleMusic(game, threshold = ENDGAME_PUBLIC_VICTORY_POINTS) {
  if (!game || game.phase === "lobby") return false;
  if (!Number.isFinite(threshold)) return false;
  return highestPublicVictoryPoints(game) >= threshold;
}
