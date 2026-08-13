import { calculateVictoryPoints } from "../game/scoringReducer.js";

export const FINALE_PUBLIC_VICTORY_POINTS = 9;

export function highestPublicVictoryPoints(game) {
  if (!game || !Array.isArray(game.players) || !game.players.length) return 0;
  let highest = 0;
  for (let index = 0; index < game.players.length; index += 1) {
    highest = Math.max(highest, calculateVictoryPoints(game, index, false));
  }
  return highest;
}

export function shouldEnterFinaleMusic(game, threshold = FINALE_PUBLIC_VICTORY_POINTS) {
  if (!game || game.phase === "lobby") return false;
  if (!Number.isFinite(threshold)) return false;
  return highestPublicVictoryPoints(game) >= threshold;
}
