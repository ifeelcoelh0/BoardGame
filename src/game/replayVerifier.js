import { applyGameAction } from "./gameActionReducer.js";
import {
  assertActionJournal,
  canonicalJournalJson,
  hashReplayState,
  stripActionJournal,
} from "./actionJournal.js";

export const ACTION_REPLAY_FORMAT = "reinos-do-dragao-action-replay";
export const ACTION_REPLAY_VERSION = 1;
export const ACTION_REPLAY_VISIBILITY = "host-private";

function clone(value) {
  if (value == null) return value;
  return globalThis.structuredClone
    ? structuredClone(value)
    : JSON.parse(JSON.stringify(value));
}

function failure(code, entry = null, details = {}) {
  return {
    ok: false,
    code,
    seq: entry?.seq ?? null,
    actionId: entry?.actionId ?? null,
    actionType: entry?.actionType ?? null,
    ...details,
  };
}

function sameCanonical(first, second) {
  return canonicalJournalJson(first) === canonicalJournalJson(second);
}

class ReplayTraceError extends Error {
  constructor(code, details = {}) {
    super(code);
    this.name = "ReplayTraceError";
    this.code = code;
    this.details = details;
  }
}

function createReplayTrace(entry) {
  let randomIndex = 0;
  let idIndex = 0;
  const randomValues = entry.randomValues || [];
  const generatedIds = entry.generatedIds || [];

  return {
    rng() {
      if (randomIndex >= randomValues.length) {
        throw new ReplayTraceError("RNG_TRACE_EXHAUSTED", {
          consumed: randomIndex,
          available: randomValues.length,
        });
      }
      return randomValues[randomIndex++];
    },
    createId(prefix) {
      if (idIndex >= generatedIds.length) {
        throw new ReplayTraceError("ID_TRACE_EXHAUSTED", {
          consumed: idIndex,
          available: generatedIds.length,
          requestedPrefix: String(prefix || ""),
        });
      }
      const expected = generatedIds[idIndex++];
      const requestedPrefix = String(prefix || "");
      if (expected.prefix !== requestedPrefix) {
        throw new ReplayTraceError("ID_PREFIX_MISMATCH", {
          index: idIndex - 1,
          expected: expected.prefix,
          actual: requestedPrefix,
        });
      }
      return expected.value;
    },
    assertFullyConsumed() {
      if (randomIndex !== randomValues.length) {
        throw new ReplayTraceError("RNG_TRACE_UNUSED", {
          consumed: randomIndex,
          available: randomValues.length,
        });
      }
      if (idIndex !== generatedIds.length) {
        throw new ReplayTraceError("ID_TRACE_UNUSED", {
          consumed: idIndex,
          available: generatedIds.length,
        });
      }
    },
  };
}

function journalFrom(value) {
  if (value?.format === ACTION_REPLAY_FORMAT && value?.version === ACTION_REPLAY_VERSION) {
    return value.journal;
  }
  if (value?.actionJournal) return value.actionJournal;
  return value;
}

export function createActionReplayPackage(game, { createdAt = Date.now() } = {}) {
  const journal = game?.actionJournal;
  assertActionJournal(journal);
  if (!journal) throw new TypeError("No authoritative action journal is available to export.");
  const entries = journal.entries || [];
  return {
    format: ACTION_REPLAY_FORMAT,
    version: ACTION_REPLAY_VERSION,
    visibility: ACTION_REPLAY_VISIBILITY,
    createdAt: Math.max(0, Math.floor(Number(createdAt) || 0)),
    summary: {
      code: String(journal.initialState?.code || game?.code || ""),
      mode: String(journal.initialState?.mode || game?.mode || ""),
      initialRevision: journal.initialRevision,
      finalRevision: entries.at(-1)?.revisionAfter ?? journal.initialRevision,
      entryCount: entries.length,
      checkpointCount: entries.filter((entry) => entry.checkpointState != null).length,
      finalStateHash: entries.at(-1)?.stateHashAfter ?? hashReplayState(journal.initialState),
    },
    journal: clone(journal),
  };
}

export function serializeActionReplayPackage(value) {
  const replayPackage = value?.actionJournal && value?.format !== ACTION_REPLAY_FORMAT
    ? createActionReplayPackage(value)
    : value;
  const parsed = parseActionReplayPackage(
    typeof replayPackage === "string" ? replayPackage : JSON.stringify(replayPackage),
  );
  if (!parsed.ok) throw new TypeError(parsed.reason);
  return JSON.stringify(parsed.replay, null, 2);
}

export function parseActionReplayPackage(text) {
  if (typeof text !== "string" || !text.trim()) return { ok: false, reason: "EMPTY_REPLAY" };
  try {
    const replay = JSON.parse(text);
    if (!replay || replay.format !== ACTION_REPLAY_FORMAT || replay.version !== ACTION_REPLAY_VERSION) {
      return { ok: false, reason: "UNSUPPORTED_REPLAY_FORMAT" };
    }
    if (replay.visibility !== ACTION_REPLAY_VISIBILITY) {
      return { ok: false, reason: "INVALID_REPLAY_VISIBILITY" };
    }
    if (!replay.journal) return { ok: false, reason: "MISSING_ACTION_JOURNAL" };
    assertActionJournal(replay.journal);
    return { ok: true, replay };
  } catch (error) {
    return { ok: false, reason: "INVALID_REPLAY", error };
  }
}

/**
 * Replays the authoritative journal without re-deciding bot strategy or RNG.
 * The recorded player action is the input; the recorded RNG values, IDs and
 * action timestamp are injected back into the same central reducer.
 *
 * Sparse checkpointState values represent host-side state changes that happened
 * between accepted actions (for example disconnect/reconnect or bot takeover).
 * They are used only when the hash chain proves such a transition occurred.
 */
export function verifyActionReplay(value, { applyGame = applyGameAction } = {}) {
  let journal;
  try {
    journal = journalFrom(value);
    assertActionJournal(journal);
  } catch (error) {
    return failure("INVALID_JOURNAL", null, { reason: error?.message || String(error) });
  }
  if (!journal) return failure("INVALID_JOURNAL", null, { reason: "Missing action journal." });
  if (typeof applyGame !== "function") return failure("INVALID_APPLY_FUNCTION");

  let game = stripActionJournal(journal.initialState);
  let revision = journal.initialRevision;
  let checkpointsApplied = 0;
  let revisionGaps = 0;

  for (const entry of journal.entries) {
    if (entry.revisionAfter !== entry.revisionBefore + 1 || entry.revisionBefore < revision) {
      return failure("REVISION_CHAIN_MISMATCH", entry, {
        expectedMinimumRevisionBefore: revision,
        actualRevisionBefore: entry.revisionBefore,
        actualRevisionAfter: entry.revisionAfter,
      });
    }
    if (entry.revisionBefore > revision) revisionGaps += 1;
    if (entry.payload?.type !== entry.actionType) {
      return failure("ACTION_TYPE_MISMATCH", entry, {
        payloadType: entry.payload?.type || null,
      });
    }
    if (entry.timestampMs !== Math.max(0, entry.occurredAt - journal.startedAt)) {
      return failure("TIMESTAMP_MISMATCH", entry, {
        expectedTimestampMs: Math.max(0, entry.occurredAt - journal.startedAt),
        actualTimestampMs: entry.timestampMs,
      });
    }

    let beforeHash = hashReplayState(game);
    if (beforeHash !== entry.stateHashBefore) {
      if (!entry.checkpointState) {
        return failure("STATE_BEFORE_MISMATCH", entry, {
          expected: entry.stateHashBefore,
          actual: beforeHash,
          hint: "The journal predates sparse external-state checkpoints or has been altered.",
        });
      }
      const checkpointHash = hashReplayState(entry.checkpointState);
      if (checkpointHash !== entry.stateHashBefore) {
        return failure("CHECKPOINT_HASH_MISMATCH", entry, {
          expected: entry.stateHashBefore,
          actual: checkpointHash,
        });
      }
      game = stripActionJournal(entry.checkpointState);
      beforeHash = checkpointHash;
      checkpointsApplied += 1;
    } else if (entry.checkpointState) {
      const checkpointHash = hashReplayState(entry.checkpointState);
      if (checkpointHash !== entry.stateHashBefore) {
        return failure("CHECKPOINT_HASH_MISMATCH", entry, {
          expected: entry.stateHashBefore,
          actual: checkpointHash,
        });
      }
    }

    const trace = createReplayTrace(entry);
    let applied;
    try {
      applied = applyGame(game, entry.playerId, clone(entry.payload), {
        rng: trace.rng,
        now: () => entry.occurredAt,
        createId: trace.createId,
      });
      trace.assertFullyConsumed();
    } catch (error) {
      if (error instanceof ReplayTraceError) {
        return failure(error.code, entry, error.details);
      }
      return failure("APPLY_ERROR", entry, { reason: error?.message || String(error) });
    }

    if (!applied?.ok) {
      return failure("ACTION_REJECTED", entry, { reason: applied?.reason || "UNKNOWN" });
    }
    if (applied.actorIndex !== entry.actorIndex) {
      return failure("ACTOR_MISMATCH", entry, {
        expected: entry.actorIndex,
        actual: applied.actorIndex ?? null,
      });
    }
    if (!sameCanonical(applied.events || [], entry.events || [])) {
      return failure("EVENTS_MISMATCH", entry, {
        expected: clone(entry.events || []),
        actual: clone(applied.events || []),
      });
    }
    if (!sameCanonical(applied.privateResult ?? null, entry.privateResult ?? null)) {
      return failure("PRIVATE_RESULT_MISMATCH", entry, {
        expected: clone(entry.privateResult ?? null),
        actual: clone(applied.privateResult ?? null),
      });
    }

    const afterHash = hashReplayState(applied.game);
    if (afterHash !== entry.stateHashAfter) {
      return failure("STATE_AFTER_MISMATCH", entry, {
        expected: entry.stateHashAfter,
        actual: afterHash,
      });
    }

    game = stripActionJournal(applied.game);
    game.v = entry.revisionAfter;
    revision = entry.revisionAfter;
  }

  return {
    ok: true,
    code: "REPLAY_VERIFIED",
    entriesVerified: journal.entries.length,
    checkpointsApplied,
    revisionGaps,
    finalRevision: revision,
    finalStateHash: journal.entries.at(-1)?.stateHashAfter ?? hashReplayState(game),
    game,
  };
}
