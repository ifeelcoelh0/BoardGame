export const ACTION_RESULT_CACHE_TTL_MS = 60_000;

const RESULT_FIELDS = Object.freeze([
  "t",
  "lobbyProtocolVersion",
  "gameProtocolVersion",
  "actionId",
  "actionType",
  "ok",
  "reason",
  "revision",
  "details",
  "privateResult",
]);

function compactResult(result) {
  const compact = {};
  for (const field of RESULT_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(result || {}, field)) compact[field] = result[field];
  }
  return compact;
}

export function pruneExpiredActionResults(cache, now = Date.now()) {
  if (!(cache instanceof Map)) return 0;
  let removed = 0;
  for (const [key, entry] of cache.entries()) {
    if (!entry || !Number.isFinite(entry.expiresAt) || entry.expiresAt <= now) {
      cache.delete(key);
      removed += 1;
    }
  }
  return removed;
}

export function rememberAcceptedActionResult(cache, cacheKey, result, {
  now = Date.now(),
  ttlMs = ACTION_RESULT_CACHE_TTL_MS,
} = {}) {
  if (!(cache instanceof Map) || typeof cacheKey !== "string" || result?.ok !== true) return false;
  pruneExpiredActionResults(cache, now);
  cache.set(cacheKey, {
    expiresAt: now + Math.max(1, Number(ttlMs) || ACTION_RESULT_CACHE_TTL_MS),
    result: compactResult(result),
  });
  return true;
}

export function getAcceptedActionResult(cache, cacheKey, { now = Date.now() } = {}) {
  if (!(cache instanceof Map) || typeof cacheKey !== "string") return null;
  const entry = cache.get(cacheKey);
  if (!entry) return null;
  if (!Number.isFinite(entry.expiresAt) || entry.expiresAt <= now) {
    cache.delete(cacheKey);
    return null;
  }
  return entry.result || null;
}
