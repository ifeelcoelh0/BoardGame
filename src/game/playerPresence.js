export const LOBBY_RECONNECT_GRACE_MS = 30_000;
export const GAME_FIRST_AFK_GRACE_MS = 90_000;
export const GAME_REPEAT_AFK_GRACE_MS = 30_000;
// Alias mantido para compatibilidade com código e saves da fase anterior.
export const GAME_TURN_RECONNECT_GRACE_MS = GAME_FIRST_AFK_GRACE_MS;

export const PLAYER_CONTROLLER = Object.freeze({
  HUMAN: "human",
  BOT: "bot",
});

export const PLAYER_CONTROL_STATUS = Object.freeze({
  ACTIVE: "active",
  DISCONNECTED: "disconnected",
  WAITING_RECONNECT: "waiting-reconnect",
  ACTION_SKIPPED: "action-skipped",
});

export function ensurePlayerPresence(player, { connected = true } = {}) {
  if (!player || typeof player !== "object") return player;
  if (typeof player.connected !== "boolean") player.connected = connected;

  // Bots ainda não estão ativos nesta versão. Saves experimentais da Parte 6A.2
  // são normalizados para controlo humano sem perder a identidade do jogador.
  player.controller = PLAYER_CONTROLLER.HUMAN;
  if (!Number.isFinite(player.disconnectedAt)) player.disconnectedAt = null;
  if (!Number.isFinite(player.reconnectDeadline)) player.reconnectDeadline = null;
  if (!Number.isFinite(player.turnReconnectDeadline)) player.turnReconnectDeadline = null;
  if (!Number.isSafeInteger(player.afkSkipCount) || player.afkSkipCount < 0)
    player.afkSkipCount = 0;
  if (!Number.isFinite(player.lastAfkSkipAt)) player.lastAfkSkipAt = null;

  // Campos antigos ficam neutralizados para permitir carregar saves transitórios.
  player.botActivatedAt = null;
  player.humanReconnectPending = false;
  player.botActionInProgress = false;

  const validStatuses = new Set(Object.values(PLAYER_CONTROL_STATUS));
  if (!validStatuses.has(player.controlStatus)) {
    player.controlStatus = player.connected
      ? PLAYER_CONTROL_STATUS.ACTIVE
      : PLAYER_CONTROL_STATUS.DISCONNECTED;
  }
  return player;
}

export function markPlayerConnected(player) {
  ensurePlayerPresence(player);
  player.connected = true;
  player.disconnectedAt = null;
  player.reconnectDeadline = null;
  player.turnReconnectDeadline = null;
  player.afkSkipCount = 0;
  player.lastAfkSkipAt = null;
  player.controlStatus = PLAYER_CONTROL_STATUS.ACTIVE;
  return player;
}

export function markPlayerDisconnected(player, {
  now = Date.now(),
  phase = "lobby",
  graceMs = LOBBY_RECONNECT_GRACE_MS,
} = {}) {
  ensurePlayerPresence(player);
  player.connected = false;
  player.disconnectedAt = now;
  player.reconnectDeadline = phase === "lobby" ? now + Math.max(0, graceMs) : null;
  player.turnReconnectDeadline = null;
  if (phase === "lobby") {
    player.ready = false;
    player.afkSkipCount = 0;
    player.lastAfkSkipAt = null;
  }
  player.controlStatus = PLAYER_CONTROL_STATUS.DISCONNECTED;
  return player;
}

export function gameAfkGraceMs(player) {
  ensurePlayerPresence(player);
  return player.afkSkipCount > 0
    ? GAME_REPEAT_AFK_GRACE_MS
    : GAME_FIRST_AFK_GRACE_MS;
}

export function beginGameTurnReconnectWindow(player, {
  now = Date.now(),
  graceMs = null,
} = {}) {
  ensurePlayerPresence(player);
  if (player.connected !== false) return player;
  const effectiveGraceMs = Number.isFinite(graceMs) ? graceMs : gameAfkGraceMs(player);
  if (!Number.isFinite(player.turnReconnectDeadline))
    player.turnReconnectDeadline = now + Math.max(0, effectiveGraceMs);
  player.controlStatus = PLAYER_CONTROL_STATUS.WAITING_RECONNECT;
  return player;
}

export function clearGameTurnReconnectWindow(player) {
  ensurePlayerPresence(player);
  player.turnReconnectDeadline = null;
  player.controlStatus = player.connected
    ? PLAYER_CONTROL_STATUS.ACTIVE
    : PLAYER_CONTROL_STATUS.DISCONNECTED;
  return player;
}

export function markAfkActionSkipped(player, { now = Date.now() } = {}) {
  ensurePlayerPresence(player);
  player.afkSkipCount += 1;
  player.lastAfkSkipAt = now;
  player.turnReconnectDeadline = null;
  player.controlStatus = player.connected
    ? PLAYER_CONTROL_STATUS.ACTIVE
    : PLAYER_CONTROL_STATUS.ACTION_SKIPPED;
  return player;
}

// Compatibilidade de importação com a fase anterior: bots já não são ativados.
export function activateBotController(player, { now = Date.now() } = {}) {
  return markAfkActionSkipped(player, { now });
}

export function restoreHumanController(player) {
  ensurePlayerPresence(player);
  player.controller = PLAYER_CONTROLLER.HUMAN;
  player.turnReconnectDeadline = null;
  player.controlStatus = player.connected
    ? PLAYER_CONTROL_STATUS.ACTIVE
    : PLAYER_CONTROL_STATUS.DISCONNECTED;
  return player;
}

export function isLobbyReservationExpired(player, now = Date.now()) {
  return player?.connected === false
    && Number.isFinite(player.reconnectDeadline)
    && player.reconnectDeadline <= now;
}

export function isGameTurnReconnectExpired(player, now = Date.now()) {
  return player?.connected === false
    && Number.isFinite(player.turnReconnectDeadline)
    && player.turnReconnectDeadline <= now;
}

export function lobbyReconnectSeconds(player, now = Date.now()) {
  if (player?.connected !== false || !Number.isFinite(player.reconnectDeadline)) return null;
  return Math.max(0, Math.ceil((player.reconnectDeadline - now) / 1000));
}

export function gameTurnReconnectSeconds(player, now = Date.now()) {
  if (player?.connected !== false || !Number.isFinite(player.turnReconnectDeadline)) return null;
  return Math.max(0, Math.ceil((player.turnReconnectDeadline - now) / 1000));
}
