/**
 * Audio decisions that depend on the local player's view of the synchronized game.
 * They stay outside reducers/presentation because cues such as "your turn" are
 * deliberately private: only the player whose browser owns `seat` should hear them.
 */
export function localTurnNotificationKey(game, seat) {
  if (!game || game.phase !== "play" || !Number.isSafeInteger(seat)) return null;
  const position = game.turn?.pos;
  if (!Number.isSafeInteger(position) || !Array.isArray(game.order)) return null;
  const playerIndex = game.order[position];
  if (playerIndex !== seat || game.players?.[seat]?.connected === false) return null;
  const round = Number.isSafeInteger(game.round) ? game.round : 0;
  return `${round}:${position}:${playerIndex}`;
}
