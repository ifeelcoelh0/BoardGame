export const PLAYER_SESSION_STORAGE_KEY = "reinos_dragao_player_sessions_v1";

const PLAYER_ID_PATTERN = /^player_[a-f0-9]{24}$/;
const SEAT_ID_PATTERN = /^seat_[a-f0-9]{24}$/;
const TOKEN_PATTERN = /^[a-f0-9]{64}$/;

function storageFor(storage) {
  return storage || globalThis.sessionStorage || null;
}

function readSessions(storage) {
  try {
    const raw = storageFor(storage)?.getItem(PLAYER_SESSION_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeSessions(sessions, storage) {
  try {
    storageFor(storage)?.setItem(PLAYER_SESSION_STORAGE_KEY, JSON.stringify(sessions));
    return true;
  } catch {
    return false;
  }
}

function sessionKey(code) {
  return String(code || "").trim().toUpperCase();
}

export function isValidStoredPlayerSession(session) {
  return Boolean(session
    && typeof session === "object"
    && PLAYER_ID_PATTERN.test(session.playerId || "")
    && SEAT_ID_PATTERN.test(session.seatId || "")
    && TOKEN_PATTERN.test(session.sessionToken || ""));
}

export function loadPlayerSession(code, { storage } = {}) {
  const key = sessionKey(code);
  if (!key) return null;
  const session = readSessions(storage)[key];
  return isValidStoredPlayerSession(session) ? { ...session } : null;
}

export function savePlayerSession(code, session, { storage } = {}) {
  const key = sessionKey(code);
  if (!key || !isValidStoredPlayerSession(session)) return false;
  const sessions = readSessions(storage);
  sessions[key] = {
    playerId: session.playerId,
    seatId: session.seatId,
    sessionToken: session.sessionToken,
  };
  return writeSessions(sessions, storage);
}

export function forgetPlayerSession(code, { storage } = {}) {
  const key = sessionKey(code);
  if (!key) return false;
  const sessions = readSessions(storage);
  delete sessions[key];
  return writeSessions(sessions, storage);
}
