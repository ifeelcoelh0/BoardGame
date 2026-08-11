export function createStateSyncController({
  normalizeGame = (game) => game,
  getPlayerId = () => null,
  getSeatId = () => null,
  findPlayerIndex,
  emit = () => {},
} = {}) {
  if (typeof findPlayerIndex !== "function") {
    throw new TypeError("findPlayerIndex is required");
  }

  const adopt = (incoming, metadata = {}) => {
    if (!incoming || typeof incoming !== "object") {
      emit({ type: "STATE_REJECTED", reason: "INVALID_STATE", metadata });
      return { ok: false, reason: "INVALID_STATE" };
    }
    const game = normalizeGame(incoming);
    const playerId = getPlayerId();
    const seatId = getSeatId();
    const index = playerId ? findPlayerIndex(game, playerId) : -1;
    const identityMatches = index >= 0 && (!seatId || game.players?.[index]?.seatId === seatId);
    const seat = identityMatches ? index : null;
    const event = { type: "STATE_ADOPTED", game, seat, metadata };
    emit(event);
    return { ok: true, game, seat };
  };

  return { adopt };
}
