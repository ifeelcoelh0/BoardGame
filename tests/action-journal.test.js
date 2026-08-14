import test from "node:test";
import assert from "node:assert/strict";

import {
  ACTION_JOURNAL_VERSION,
  ACTION_SOURCE,
  appendAcceptedGameAction,
  assertActionJournal,
  canonicalJournalJson,
  createActionExecutionTrace,
  hashReplayState,
} from "../src/game/actionJournal.js";

function state(overrides = {}) {
  return {
    code: "ABCD",
    phase: "play",
    mode: "dragao",
    v: 12,
    players: [{ playerId: "player_111111111111111111111111", res: { ouro: 1 } }],
    board: { hexes: [{ k: "0,0", terr: "floresta", num: 8 }] },
    deck: [{ id: 1, kind: "vp" }],
    presentation: { version: 1, log: [] },
    ...structuredClone(overrides),
  };
}

test("journal canonicalization and replay-state hashes are stable across key order and journal metadata", () => {
  assert.equal(canonicalJournalJson({ b: 2, a: { d: 4, c: 3 } }), '{"a":{"c":3,"d":4},"b":2}');
  const first = state();
  const second = { ...state(), actionJournal: { version: 1, entries: [{ anything: true }] } };
  second.presentation = { version: 1, log: [{ id: 99, msg: "visual only" }] };
  second.v = 999;
  assert.equal(hashReplayState(first), hashReplayState(second));
});

test("execution traces record reducer RNG and generated ids without deciding the action itself", () => {
  const samples = [0.25, 0.75];
  let index = 0;
  const trace = createActionExecutionTrace({
    rng: () => samples[index++],
    createId: (prefix) => `${prefix}_fixed`,
  });
  assert.equal(trace.rng(), 0.25);
  assert.equal(trace.rng(), 0.75);
  assert.equal(trace.createId("trade"), "trade_fixed");
  assert.deepEqual(trace.snapshot(), {
    randomValues: [0.25, 0.75],
    generatedIds: [{ prefix: "trade", value: "trade_fixed" }],
  });
});

test("accepted actions create an append-only host journal with a private initial state and fingerprints", () => {
  const before = state();
  const after = state({ turn: { rolled: true, dice: [3, 4] } });
  const first = appendAcceptedGameAction(before, after, {
    actionId: `game_${"a".repeat(24)}`,
    source: ACTION_SOURCE.LOCAL_HUMAN,
    playerId: before.players[0].playerId,
    actorIndex: 0,
    action: { type: "ROLL_DICE" },
    revisionBefore: 12,
    revisionAfter: 13,
    occurredAt: 1_000,
    trace: { randomValues: [0.1, 0.2], generatedIds: [] },
    events: [{ type: "DICE_ROLLED", total: 7 }],
  });

  assert.equal(first.game.actionJournal.version, ACTION_JOURNAL_VERSION);
  assert.equal(first.game.actionJournal.initialRevision, 12);
  assert.equal(first.game.actionJournal.initialState.actionJournal, undefined);
  assert.equal(first.entry.seq, 1);
  assert.equal(first.entry.actionType, "ROLL_DICE");
  assert.equal(first.entry.revisionBefore, 12);
  assert.equal(first.entry.revisionAfter, 13);
  assert.deepEqual(first.entry.randomValues, [0.1, 0.2]);
  assert.match(first.entry.stateHashBefore, /^[a-f0-9]{16}$/);
  assert.match(first.entry.stateHashAfter, /^[a-f0-9]{16}$/);

  const secondAfter = structuredClone(first.game);
  secondAfter.turn = { rolled: true, dice: [3, 4], ended: true };
  const second = appendAcceptedGameAction(first.game, secondAfter, {
    actionId: `game_${"b".repeat(24)}`,
    source: ACTION_SOURCE.REMOTE_HUMAN,
    playerId: before.players[0].playerId,
    actorIndex: 0,
    action: { type: "END_TURN" },
    revisionBefore: 13,
    revisionAfter: 14,
    occurredAt: 1_250,
  });
  assert.equal(second.game.actionJournal.startedAt, 1_000);
  assert.equal(second.game.actionJournal.entries.length, 2);
  assert.equal(second.entry.seq, 2);
  assert.equal(second.entry.timestampMs, 250);
  assertActionJournal(second.game.actionJournal);
});

test("journal stores a sparse checkpoint when authoritative state changes between accepted actions", () => {
  const before = state();
  const firstAfter = state({ turn: { rolled: true, dice: [1, 2] } });
  const first = appendAcceptedGameAction(before, firstAfter, {
    actionId: `game_${"c".repeat(24)}`,
    source: ACTION_SOURCE.LOCAL_HUMAN,
    playerId: before.players[0].playerId,
    actorIndex: 0,
    action: { type: "ROLL_DICE" },
    revisionBefore: 12,
    revisionAfter: 13,
    occurredAt: 2_000,
  });
  first.game.v = 13;

  const externallyChanged = structuredClone(first.game);
  externallyChanged.players[0].connected = false;
  externallyChanged.v = 14;
  const secondAfter = structuredClone(externallyChanged);
  secondAfter.turn = { ...secondAfter.turn, ended: true };
  const second = appendAcceptedGameAction(externallyChanged, secondAfter, {
    actionId: `game_${"d".repeat(24)}`,
    source: ACTION_SOURCE.LOCAL_HUMAN,
    playerId: before.players[0].playerId,
    actorIndex: 0,
    action: { type: "END_TURN" },
    revisionBefore: 14,
    revisionAfter: 15,
    occurredAt: 2_100,
  });

  assert.ok(second.entry.checkpointState);
  assert.equal(second.entry.checkpointState.actionJournal, undefined);
  assert.equal(second.entry.checkpointState.players[0].connected, false);
  assert.equal(second.entry.stateHashBefore, hashReplayState(second.entry.checkpointState));
  assertActionJournal(second.game.actionJournal);
});
