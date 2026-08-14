import test from "node:test";
import assert from "node:assert/strict";

import {
  ACTION_SOURCE,
  appendAcceptedGameAction,
  createActionExecutionTrace,
} from "../src/game/actionJournal.js";
import { applyGameAction } from "../src/game/gameActionReducer.js";
import { createInitialGame, createPlayer } from "../src/game/gameFactory.js";
import { GAME_ACTION } from "../src/game/gameProtocol.js";
import {
  ACTION_REPLAY_FORMAT,
  ACTION_REPLAY_VISIBILITY,
  createActionReplayPackage,
  parseActionReplayPackage,
  serializeActionReplayPackage,
  verifyActionReplay,
} from "../src/game/replayVerifier.js";
import { IDS, TOKEN_HASHES } from "./fixtures.js";

function fixedId(prefix) {
  return `${prefix}_${"f".repeat(24)}`;
}

function richResources() {
  return { madeira: 12, tijolo: 12, cavalos: 12, ouro: 12, obsidiana: 12 };
}

function playableGame() {
  const game = createInitialGame({
    code: "RPLY",
    hostCharacterId: "vlad",
    mode: "classico",
    rng: () => 0.25,
    idFactory: fixedId,
    hostIdentity: {
      playerId: IDS.host,
      seatId: IDS.seatHost,
      sessionTokenHash: TOKEN_HASHES.host,
      characterConfirmed: true,
      connected: true,
    },
  });
  game.players.push(createPlayer("maria", {
    playerId: IDS.guest1,
    seatId: IDS.seat1,
    sessionTokenHash: TOKEN_HASHES.guest1,
    characterConfirmed: true,
    connected: true,
  }, { idFactory: fixedId }));
  game.players.forEach((player) => {
    player.res = richResources();
    player.ready = true;
  });
  game.phase = "play";
  game.v = 20;
  game.order = [0, 1];
  game.setup = null;
  game.turn = {
    pos: 0,
    rolled: false,
    dice: null,
    devPlayed: false,
    mustDragon: false,
    steal: null,
    milN: 0,
    acted: {},
    deploy: null,
    troopPlayed: false,
    bribed: false,
    bonus: null,
  };
  game.queue = [];
  game.trade = null;
  game.stats = {};
  return game;
}

function sequence(values) {
  let index = 0;
  return () => {
    assert.ok(index < values.length, "test RNG exhausted");
    return values[index++];
  };
}

function record(game, actionId, playerId, action, {
  randomValues = [],
  generatedIds = [],
  occurredAt,
} = {}) {
  let idIndex = 0;
  const trace = createActionExecutionTrace({
    rng: sequence(randomValues),
    createId: (prefix) => {
      const expected = generatedIds[idIndex++];
      assert.ok(expected, `unexpected createId(${prefix})`);
      assert.equal(expected.prefix, prefix);
      return expected.value;
    },
  });
  const applied = applyGameAction(game, playerId, action, {
    rng: trace.rng,
    now: () => occurredAt,
    createId: trace.createId,
  });
  assert.equal(applied.ok, true, applied.reason);
  const journaled = appendAcceptedGameAction(game, applied.game, {
    actionId,
    source: ACTION_SOURCE.LOCAL_HUMAN,
    playerId,
    actorIndex: applied.actorIndex,
    action,
    revisionBefore: game.v,
    revisionAfter: game.v + 1,
    occurredAt,
    trace: trace.snapshot(),
    events: applied.events,
    privateResult: applied.privateResult,
  });
  journaled.game.v = game.v + 1;
  return journaled.game;
}

function recordedRealGame() {
  let game = playableGame();
  game = record(
    game,
    `game_${"1".repeat(24)}`,
    IDS.host,
    { type: GAME_ACTION.ROLL_DICE },
    { randomValues: [0.1, 0.2], occurredAt: 1_000 },
  );
  game = record(
    game,
    `game_${"2".repeat(24)}`,
    IDS.host,
    {
      type: GAME_ACTION.PROPOSE_TRADE,
      toPlayerId: IDS.guest1,
      give: { madeira: 1 },
      get: { ouro: 1 },
    },
    {
      generatedIds: [{ prefix: "trade", value: `trade_${"a".repeat(24)}` }],
      occurredAt: 1_250,
    },
  );
  return game;
}

test("real reducer replay reproduces recorded RNG, generated ids, events and final fingerprint", () => {
  const game = recordedRealGame();
  const result = verifyActionReplay(game);
  assert.equal(result.ok, true, result.code);
  assert.equal(result.entriesVerified, 2);
  assert.equal(result.checkpointsApplied, 0);
  assert.equal(result.finalRevision, 22);
  assert.equal(result.finalStateHash, game.actionJournal.entries.at(-1).stateHashAfter);
  assert.equal(result.game.trade.id, `trade_${"a".repeat(24)}`);
});

test("replay package is explicitly host-private, serializable and parseable", () => {
  const game = recordedRealGame();
  const replay = createActionReplayPackage(game, { createdAt: 9_999 });
  assert.equal(replay.format, ACTION_REPLAY_FORMAT);
  assert.equal(replay.visibility, ACTION_REPLAY_VISIBILITY);
  assert.equal(replay.summary.entryCount, 2);
  assert.equal(replay.summary.checkpointCount, 0);
  assert.equal(replay.summary.finalRevision, 22);

  const serialized = serializeActionReplayPackage(game);
  const parsed = parseActionReplayPackage(serialized);
  assert.equal(parsed.ok, true, parsed.reason);
  assert.equal(verifyActionReplay(parsed.replay).ok, true);
  assert.equal(parseActionReplayPackage(JSON.stringify({
    format: ACTION_REPLAY_FORMAT,
    version: 1,
    visibility: ACTION_REPLAY_VISIBILITY,
  })).reason, "MISSING_ACTION_JOURNAL");
});

test("replay verifier detects tampered RNG and state fingerprints", () => {
  const game = recordedRealGame();
  const rngTampered = structuredClone(game.actionJournal);
  rngTampered.entries[0].randomValues[0] = 0.9;
  const rngResult = verifyActionReplay(rngTampered);
  assert.equal(rngResult.ok, false);
  assert.equal(rngResult.seq, 1);
  assert.ok(["EVENTS_MISMATCH", "STATE_AFTER_MISMATCH"].includes(rngResult.code), rngResult.code);

  const hashTampered = structuredClone(game.actionJournal);
  hashTampered.entries[1].stateHashAfter = "0000000000000000";
  const hashResult = verifyActionReplay(hashTampered);
  assert.equal(hashResult.ok, false);
  assert.equal(hashResult.code, "STATE_AFTER_MISMATCH");
  assert.equal(hashResult.seq, 2);
});

test("replay verifier detects trace shape corruption and action-type corruption", () => {
  const game = recordedRealGame();
  const unusedRng = structuredClone(game.actionJournal);
  unusedRng.entries[1].randomValues.push(0.5);
  const rngResult = verifyActionReplay(unusedRng);
  assert.equal(rngResult.ok, false);
  assert.equal(rngResult.code, "RNG_TRACE_UNUSED");
  assert.equal(rngResult.seq, 2);

  const typeTampered = structuredClone(game.actionJournal);
  typeTampered.entries[1].actionType = GAME_ACTION.END_TURN;
  const typeResult = verifyActionReplay(typeTampered);
  assert.equal(typeResult.ok, false);
  assert.equal(typeResult.code, "ACTION_TYPE_MISMATCH");
  assert.equal(typeResult.seq, 2);
});

test("sparse checkpoints bridge authoritative host changes between accepted actions", () => {
  const base = {
    code: "CHKP",
    mode: "classico",
    phase: "play",
    v: 5,
    players: [{ playerId: IDS.host, connected: true }],
    counter: 0,
    presentation: { log: [] },
  };
  const applyCounter = (current, playerId, action) => ({
    ok: true,
    actorIndex: 0,
    actionType: action.type,
    events: [{ type: "COUNTER_CHANGED", value: current.counter + action.amount }],
    game: { ...structuredClone(current), counter: current.counter + action.amount },
  });

  const firstApplied = applyCounter(base, IDS.host, { type: "INC", amount: 1 });
  const first = appendAcceptedGameAction(base, firstApplied.game, {
    actionId: `game_${"3".repeat(24)}`,
    playerId: IDS.host,
    actorIndex: 0,
    action: { type: "INC", amount: 1 },
    revisionBefore: 5,
    revisionAfter: 6,
    occurredAt: 2_000,
    events: firstApplied.events,
  });
  first.game.v = 6;

  // Simulate a host-side presence/recovery mutation that is not a player action.
  const external = structuredClone(first.game);
  external.players[0].connected = false;
  external.hostRecoveryMarker = "disconnect";
  external.v = 7;
  const secondApplied = applyCounter(external, IDS.host, { type: "INC", amount: 2 });
  const second = appendAcceptedGameAction(external, secondApplied.game, {
    actionId: `game_${"4".repeat(24)}`,
    playerId: IDS.host,
    actorIndex: 0,
    action: { type: "INC", amount: 2 },
    revisionBefore: 7,
    revisionAfter: 8,
    occurredAt: 2_500,
    events: secondApplied.events,
  });
  second.game.v = 8;

  assert.ok(second.entry.checkpointState);
  assert.equal(second.entry.checkpointState.hostRecoveryMarker, "disconnect");
  const verified = verifyActionReplay(second.game, { applyGame: applyCounter });
  assert.equal(verified.ok, true, verified.code);
  assert.equal(verified.checkpointsApplied, 1);
  assert.equal(verified.game.counter, 3);
  assert.equal(verified.game.hostRecoveryMarker, "disconnect");
});
