import { assertGameInvariants } from "./gameInvariants.js";
import { migrateSave } from "./migrations/migrateSave.js";
import { SAVE_INDEX_STORAGE_KEY, SAVE_STORAGE_KEY, saveStorageKeyForCode, stampSaveMetadata } from "./saveSchema.js";
import { isValidRoomCode, normalizeRoomCode } from "./roomCode.js";

const MAX_INDEX_ENTRIES = 12;

function readIndex(storage) {
  try {
    const raw = storage?.getItem(SAVE_INDEX_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.entries)) return { version: 1, entries: [] };
    return {
      version: 1,
      entries: parsed.entries.filter((entry) => entry && isValidRoomCode(entry.code)),
    };
  } catch {
    return { version: 1, entries: [] };
  }
}

function writeIndex(storage, entries) {
  const compact = entries
    .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))
    .slice(0, MAX_INDEX_ENTRIES);
  storage.setItem(SAVE_INDEX_STORAGE_KEY, JSON.stringify({ version: 1, entries: compact }));
  return compact;
}

export function serializeGameSave(game, { appVersion } = {}) {
  const stamped = stampSaveMetadata(game, appVersion);
  assertGameInvariants(stamped);
  return JSON.stringify(stamped);
}

export function parseGameSave(text) {
  if (typeof text !== "string" || !text.trim()) return { ok: false, reason: "EMPTY_SAVE" };
  try {
    const parsed = JSON.parse(text);
    const originalVersion = parsed.saveSchemaVersion;
    const game = migrateSave(parsed);
    assertGameInvariants(game);
    return { ok: true, game, migrated: originalVersion !== game.saveSchemaVersion };
  } catch (error) {
    return { ok: false, reason: error.code || "INVALID_SAVE", error };
  }
}

export function listGameSaves(storage = globalThis.localStorage) {
  if (!storage) return [];
  return readIndex(storage).entries.map((entry) => ({ ...entry }));
}

export function saveGameToStorage(game, storage = globalThis.localStorage, options = {}) {
  if (!storage) return { ok: false, reason: "STORAGE_UNAVAILABLE" };
  const code = normalizeRoomCode(options.code || game?.code);
  if (!isValidRoomCode(code)) return { ok: false, reason: "INVALID_ROOM_CODE" };
  try {
    const serialized = serializeGameSave(game, options);
    const updatedAt = options.updatedAt || new Date().toISOString();
    const saveKey = saveStorageKeyForCode(code);
    storage.setItem(saveKey, serialized);
    const existing = readIndex(storage).entries.filter((entry) => normalizeRoomCode(entry.code) !== code);
    const entries = writeIndex(storage, [{
      code,
      saveKey,
      role: options.role || "host",
      phase: game?.phase || "lobby",
      updatedAt,
      appVersion: JSON.parse(serialized).appVersion,
    }, ...existing]);
    // Keep the legacy slot current for older builds and one-step rollback.
    storage.setItem(SAVE_STORAGE_KEY, serialized);
    return { ok: true, code, updatedAt, entries };
  } catch (error) {
    return { ok: false, reason: error.code || "SAVE_FAILED", error };
  }
}

function loadRawSave(storage, code) {
  if (code) return storage.getItem(saveStorageKeyForCode(code));
  const [latest] = readIndex(storage).entries;
  if (latest?.saveKey) {
    const indexed = storage.getItem(latest.saveKey);
    if (indexed) return indexed;
  }
  return storage.getItem(SAVE_STORAGE_KEY);
}

export function loadGameFromStorage(storage = globalThis.localStorage, { code } = {}) {
  if (!storage) return { ok: false, reason: "STORAGE_UNAVAILABLE" };
  try {
    const normalizedCode = normalizeRoomCode(code);
    const raw = loadRawSave(storage, normalizedCode || null);
    if (!raw) return { ok: false, reason: "EMPTY_SAVE" };
    const result = parseGameSave(raw);
    if (!result.ok) return result;
    if (normalizedCode && normalizeRoomCode(result.game.code) !== normalizedCode) return { ok: false, reason: "SAVE_CODE_MISMATCH" };
    if (result.migrated) saveGameToStorage(result.game, storage, { code: result.game.code, appVersion: result.game.appVersion });
    else if (!readIndex(storage).entries.some((entry) => entry.code === normalizeRoomCode(result.game.code))) {
      saveGameToStorage(result.game, storage, { code: result.game.code, appVersion: result.game.appVersion });
    }
    return result;
  } catch (error) {
    return { ok: false, reason: "LOAD_FAILED", error };
  }
}

export function inspectGameSaves(storage = globalThis.localStorage) {
  return listGameSaves(storage).map((entry) => {
    const result = loadGameFromStorage(storage, { code: entry.code });
    return {
      ...entry,
      valid: result.ok,
      reason: result.ok ? null : result.reason,
      game: result.ok ? result.game : null,
    };
  });
}

export function clearGameSave(storage = globalThis.localStorage, { code } = {}) {
  if (!storage) return false;
  try {
    const normalizedCode = normalizeRoomCode(code);
    if (!normalizedCode) {
      for (const entry of readIndex(storage).entries) storage.removeItem(entry.saveKey);
      storage.removeItem(SAVE_INDEX_STORAGE_KEY);
      storage.removeItem(SAVE_STORAGE_KEY);
      return true;
    }
    storage.removeItem(saveStorageKeyForCode(normalizedCode));
    const remaining = readIndex(storage).entries.filter((entry) => entry.code !== normalizedCode);
    writeIndex(storage, remaining);
    const latestRaw = remaining[0]?.saveKey ? storage.getItem(remaining[0].saveKey) : null;
    if (latestRaw) storage.setItem(SAVE_STORAGE_KEY, latestRaw);
    else storage.removeItem(SAVE_STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}
