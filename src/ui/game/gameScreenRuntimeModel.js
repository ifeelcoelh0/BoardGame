export function currentGameActorIndex(game) {
  if (!game) return null;
  if (game.phase === "setup") return game.setup?.seq?.[game.setup?.i] ?? null;
  return game.order?.[game.turn?.pos] ?? null;
}

export function formatReconnectClock(seconds) {
  if (!Number.isFinite(seconds)) return null;
  const safe = Math.max(0, seconds);
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, "0")}`;
}
