export const ACTION_JOURNAL_VERSION = 1;
export const ACTION_JOURNAL_MAX_ENTRIES = 20_000;

export const ACTION_SOURCE = Object.freeze({
  LOCAL_HUMAN: "local-human",
  REMOTE_HUMAN: "remote-human",
  BOT: "bot",
});

const HASH_64_OFFSET = 0xcbf29ce484222325n;
const HASH_64_PRIME = 0x100000001b3n;
const HASH_64_MASK = 0xffffffffffffffffn;
const HASH_PATTERN = /^[a-f0-9]{16}$/;

function clone(value) {
  if (value == null) return value;
  return globalThis.structuredClone
    ? structuredClone(value)
    : JSON.parse(JSON.stringify(value));
}

function jsonValue(value) {
  if (value == null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (Array.isArray(value)) return value.map((item) => jsonValue(item));
  if (typeof value !== "object") return null;
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .filter((key) => value[key] !== undefined && typeof value[key] !== "function")
      .map((key) => [key, jsonValue(value[key])]),
  );
}

export function normalizeJournalPayload(value) {
  return jsonValue(value);
}

function replayStateProjection(game) {
  const source = game && typeof game === "object" && !Array.isArray(game)
    ? Object.fromEntries(Object.entries(game).filter(([key]) => key !== "actionJournal"))
    : game;
  const projected = clone(source) || {};
  delete projected.presentation;
  delete projected.v;
  delete projected.appVersion;
  delete projected.saveSchemaVersion;
  delete projected.stateViewVersion;
  delete projected.viewerPlayerId;
  delete projected.deckCount;
  return normalizeJournalPayload(projected);
}

export function canonicalJournalJson(value) {
  return JSON.stringify(normalizeJournalPayload(value));
}

export function hashReplayState(game) {
  const text = canonicalJournalJson(replayStateProjection(game));
  let hash = HASH_64_OFFSET;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= BigInt(text.charCodeAt(index));
    hash = (hash * HASH_64_PRIME) & HASH_64_MASK;
  }
  return hash.toString(16).padStart(16, "0");
}

export function stripActionJournal(game) {
  if (!game || typeof game !== "object" || Array.isArray(game)) return clone(game);
  const source = Object.fromEntries(Object.entries(game).filter(([key]) => key !== "actionJournal"));
  return clone(source);
}

export function createActionExecutionTrace({ rng = Math.random, createId = null } = {}) {
  if (typeof rng !== "function") throw new TypeError("Action trace requires an RNG function.");
  if (createId != null && typeof createId !== "function") throw new TypeError("Action trace id factory must be a function.");
  const randomValues = [];
  const generatedIds = [];

  return Object.freeze({
    rng() {
      const value = rng();
      randomValues.push(value);
      return value;
    },
    createId(prefix) {
      if (!createId) throw new TypeError("No action id factory was configured.");
      const value = createId(prefix);
      generatedIds.push({ prefix: String(prefix || ""), value: String(value || "") });
      return value;
    },
    snapshot() {
      return {
        randomValues: [...randomValues],
        generatedIds: generatedIds.map((entry) => ({ ...entry })),
      };
    },
  });
}

function normalizedTimestamp(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? Math.floor(number) : 0;
}

function journalBase(before, occurredAt) {
  const existing = before?.actionJournal;
  if (existing?.version === ACTION_JOURNAL_VERSION && Array.isArray(existing.entries)) {
    return {
      version: ACTION_JOURNAL_VERSION,
      startedAt: normalizedTimestamp(existing.startedAt),
      initialRevision: Number.isSafeInteger(existing.initialRevision) ? existing.initialRevision : (before?.v || 0),
      initialState: stripActionJournal(existing.initialState),
      entries: existing.entries.map((entry) => clone(entry)),
    };
  }
  return {
    version: ACTION_JOURNAL_VERSION,
    startedAt: normalizedTimestamp(occurredAt),
    initialRevision: Number.isSafeInteger(before?.v) ? before.v : 0,
    initialState: stripActionJournal(before),
    entries: [],
  };
}

export function appendAcceptedGameAction(before, after, metadata = {}) {
  if (!before || !after || typeof before !== "object" || typeof after !== "object") {
    throw new TypeError("Action journal requires before and after game states.");
  }
  const occurredAt = normalizedTimestamp(metadata.occurredAt);
  const journal = journalBase(before, occurredAt);
  if (journal.entries.length >= ACTION_JOURNAL_MAX_ENTRIES) {
    throw new RangeError("Action journal entry limit reached.");
  }

  const revisionBefore = Number.isSafeInteger(metadata.revisionBefore)
    ? metadata.revisionBefore
    : (Number.isSafeInteger(before.v) ? before.v : 0);
  const revisionAfter = Number.isSafeInteger(metadata.revisionAfter)
    ? metadata.revisionAfter
    : revisionBefore + 1;
  const trace = metadata.trace || {};
  const entry = {
    seq: journal.entries.length + 1,
    actionId: String(metadata.actionId || ""),
    source: Object.values(ACTION_SOURCE).includes(metadata.source) ? metadata.source : ACTION_SOURCE.LOCAL_HUMAN,
    playerId: String(metadata.playerId || ""),
    actorIndex: Number.isSafeInteger(metadata.actorIndex) ? metadata.actorIndex : null,
    actionType: String(metadata.action?.type || metadata.actionType || ""),
    payload: normalizeJournalPayload(metadata.action || {}),
    revisionBefore,
    revisionAfter,
    timestampMs: Math.max(0, occurredAt - journal.startedAt),
    occurredAt,
    randomValues: Array.isArray(trace.randomValues) ? trace.randomValues.map((value) => Number(value)) : [],
    generatedIds: Array.isArray(trace.generatedIds)
      ? trace.generatedIds.map((item) => ({ prefix: String(item?.prefix || ""), value: String(item?.value || "") }))
      : [],
    events: normalizeJournalPayload(metadata.events || []),
    privateResult: metadata.privateResult == null ? null : normalizeJournalPayload(metadata.privateResult),
    stateHashBefore: hashReplayState(before),
    stateHashAfter: hashReplayState(after),
  };
  journal.entries.push(entry);

  const next = after === before ? clone(after) : after;
  next.actionJournal = journal;
  return { game: next, entry };
}

export function assertActionJournal(journal) {
  if (journal == null) return true;
  if (!journal || typeof journal !== "object" || Array.isArray(journal)) throw new TypeError("Invalid action journal.");
  if (journal.version !== ACTION_JOURNAL_VERSION) throw new TypeError("Unsupported action journal version.");
  if (!Number.isFinite(journal.startedAt) || journal.startedAt < 0) throw new TypeError("Invalid action journal start time.");
  if (!Number.isSafeInteger(journal.initialRevision) || journal.initialRevision < 0) throw new TypeError("Invalid action journal initial revision.");
  if (!journal.initialState || typeof journal.initialState !== "object" || Array.isArray(journal.initialState)) throw new TypeError("Invalid action journal initial state.");
  if (journal.initialState.actionJournal != null) throw new TypeError("Action journal initial state cannot contain a journal.");
  if (!Array.isArray(journal.entries) || journal.entries.length > ACTION_JOURNAL_MAX_ENTRIES) throw new TypeError("Invalid action journal entries.");

  journal.entries.forEach((entry, index) => {
    if (!entry || typeof entry !== "object") throw new TypeError("Invalid action journal entry.");
    if (entry.seq !== index + 1) throw new TypeError("Action journal sequence is not contiguous.");
    if (typeof entry.actionId !== "string" || !entry.actionId) throw new TypeError("Action journal entry has no action id.");
    if (!Object.values(ACTION_SOURCE).includes(entry.source)) throw new TypeError("Action journal entry has invalid source.");
    if (typeof entry.playerId !== "string" || !entry.playerId) throw new TypeError("Action journal entry has no player id.");
    if (entry.actorIndex != null && (!Number.isSafeInteger(entry.actorIndex) || entry.actorIndex < 0)) throw new TypeError("Action journal entry has invalid actor index.");
    if (typeof entry.actionType !== "string" || !entry.actionType) throw new TypeError("Action journal entry has no action type.");
    if (!Number.isSafeInteger(entry.revisionBefore) || !Number.isSafeInteger(entry.revisionAfter) || entry.revisionAfter < entry.revisionBefore) throw new TypeError("Action journal entry has invalid revisions.");
    if (!Number.isFinite(entry.timestampMs) || entry.timestampMs < 0 || !Number.isFinite(entry.occurredAt) || entry.occurredAt < 0) throw new TypeError("Action journal entry has invalid timing.");
    if (!Array.isArray(entry.randomValues) || entry.randomValues.some((value) => !Number.isFinite(value))) throw new TypeError("Action journal entry has invalid RNG trace.");
    if (!Array.isArray(entry.generatedIds)) throw new TypeError("Action journal entry has invalid generated ids.");
    if (!HASH_PATTERN.test(entry.stateHashBefore || "") || !HASH_PATTERN.test(entry.stateHashAfter || "")) throw new TypeError("Action journal entry has invalid state hashes.");
  });
  return true;
}
