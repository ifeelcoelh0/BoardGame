import test from "node:test";
import assert from "node:assert/strict";
import { ACTION_SOURCE, appendAcceptedGameAction, createActionExecutionTrace } from "../src/game/actionJournal.js";
import { applyGameAction } from "../src/game/gameActionReducer.js";
import { createInitialGame, createPlayer } from "../src/game/gameFactory.js";
import { GAME_ACTION } from "../src/game/gameProtocol.js";
import { recoverSavedGameForHost } from "../src/game/gameRecovery.js";
import { GAME_BOT_TAKEOVER_GRACE_MS, LOBBY_RECONNECT_GRACE_MS, activateBotController } from "../src/game/playerPresence.js";
import { verifyActionReplay } from "../src/game/replayVerifier.js";

function ids(prefix = "id") {
  let index = 0;
  return (kind = prefix) => `${kind}_${String(index++).padStart(24, "0")}`;
}

function player(characterId, suffix) {
  return createPlayer(characterId, {
    playerId: `player_${suffix}`,
    seatId: `seat_${suffix}`,
    sessionTokenHash: suffix.repeat(64).slice(0, 64),
    characterConfirmed: true,
  }, { idFactory: ids(suffix) });
}

function game({ phase = "play", mode = "classico" } = {}) {
  const current = createInitialGame({
    code: "ABCDEF",
    hostCharacterId: "vlad",
    hostIdentity: {
      playerId: "player_host",
      seatId: "seat_host",
      sessionTokenHash: "a".repeat(64),
      characterConfirmed: true,
    },
    mode,
    rng: () => 0.2,
    idFactory: ids("host"),
  });
  current.players.push(player("maria", "b"), player("bones", "c"));
  current.phase = phase;
  current.order = [0, 1, 2];
  current.turn.pos = 0;
  current.queue = [];
  current.trade = null;
  return current;
}

const recover = (current, at = 10_000) => recoverSavedGameForHost(current, {
  now: () => at,
  createId: () => `trade_${"d".repeat(24)}`,
});

test("lobby recovery clears an in-flight start and rebuilds live seat presence", () => {
  const current = game({ phase: "lobby" });
  current.lobbyStarting = { actionId: "lobby_start", introEndsAt: 99_999 };
  current.players[0].ready = true;
  current.players[1].ready = true;
  activateBotController(current.players[2], { now: 100 });
  current.players[2].ready = false;

  const { game: resumed, report } = recover(current, 20_000);

  assert.equal(resumed.lobbyStarting, undefined);
  assert.equal(report.lobbyStartCleared, true);
  assert.equal(resumed.players[0].connected, true);
  assert.equal(resumed.players[0].ready, true);
  assert.equal(resumed.players[1].connected, false);
  assert.equal(resumed.players[1].ready, false);
  assert.equal(resumed.players[1].reconnectDeadline, 20_000 + LOBBY_RECONNECT_GRACE_MS);
  assert.equal(resumed.players[1].turnReconnectDeadline, null);
  assert.equal(resumed.players[2].controller, "bot");
  assert.equal(resumed.players[2].connected, true);
  assert.equal(resumed.players[2].ready, true);
  assert.ok(current.lobbyStarting, "recovery must not mutate the persisted source object");
});

test("setup recovery preserves the exact placement step and starts a fresh wait only for the required guest", () => {
  const current = game({ phase: "setup" });
  current.setup = { seq: [1, 0, 2, 2, 0, 1], i: 0, step: "road", lastV: "vertex_1" };
  current.builds.vertex_1 = { p: 1, t: 1 };
  current.roads.edge_1 = { p: 0 };
  current.players[1].turnReconnectDeadline = 1;
  current.players[2].turnReconnectDeadline = 2;

  const setupBefore = structuredClone(current.setup);
  const buildsBefore = structuredClone(current.builds);
  const roadsBefore = structuredClone(current.roads);
  const { game: resumed, report } = recover(current, 30_000);

  assert.deepEqual(resumed.setup, setupBefore);
  assert.deepEqual(resumed.builds, buildsBefore);
  assert.deepEqual(resumed.roads, roadsBefore);
  assert.equal(report.requiredActorIndex, 1);
  assert.equal(resumed.players[1].turnReconnectDeadline, 30_000 + GAME_BOT_TAKEOVER_GRACE_MS);
  assert.equal(resumed.players[2].turnReconnectDeadline, null);
});

test("mandatory decisions survive reload without being consumed or reassigned", () => {
  const current = game({ phase: "play" });
  current.queue = [
    { t: "descarte", p: 1, need: 2 },
    { t: "bencao", p: 0, left: 1 },
  ];
  current.turn = {
    ...current.turn,
    rolled: true,
    dice: 7,
    mustDragon: true,
    steal: { hex: "0,0", victims: [2], at: 4_000 },
    devPlayed: true,
    freeRoads: 1,
  };
  const queueBefore = structuredClone(current.queue);
  const turnBefore = structuredClone(current.turn);

  const { game: resumed, report } = recover(current, 40_000);

  assert.deepEqual(resumed.queue, queueBefore);
  assert.deepEqual(resumed.turn, turnBefore);
  assert.equal(report.requiredActorIndex, 1);
  assert.equal(resumed.players[1].turnReconnectDeadline, 40_000 + GAME_BOT_TAKEOVER_GRACE_MS);
});

test("recovery closes a directed trade whose human recipient is now disconnected", () => {
  const current = game();
  current.trade = {
    id: `trade_${"1".repeat(24)}`,
    from: 0,
    fromPlayerId: current.players[0].playerId,
    to: 1,
    toPlayerId: current.players[1].playerId,
    give: { madeira: 1 },
    get: { tijolo: 1 },
    declined: [],
  };

  const { game: resumed, report } = recover(current);

  assert.equal(resumed.trade, null);
  assert.equal(report.tradeEvents.length, 1);
  assert.equal(report.tradeEvents[0].type, "PLAYER_TRADE_DECLINED_DISCONNECT");
});

test("broadcast trade auto-declines recovered human guests but stays open for a live bot", () => {
  const current = game();
  activateBotController(current.players[2], { now: 500 });
  current.trade = {
    id: `trade_${"2".repeat(24)}`,
    from: 0,
    fromPlayerId: current.players[0].playerId,
    to: "all",
    toPlayerId: "all",
    give: { madeira: 1 },
    get: { tijolo: 1 },
    declined: [],
  };

  const { game: resumed } = recover(current);

  assert.deepEqual(resumed.trade.declined, [1]);
  assert.equal(resumed.players[2].connected, true);
  assert.equal(resumed.trade.to, "all");
});

test("recovery cancels a trade proposed by a human guest that lost the transport", () => {
  const current = game();
  activateBotController(current.players[2], { now: 500 });
  current.trade = {
    id: `trade_${"3".repeat(24)}`,
    from: 1,
    fromPlayerId: current.players[1].playerId,
    to: 2,
    toPlayerId: current.players[2].playerId,
    give: { madeira: 1 },
    get: { tijolo: 1 },
    declined: [],
  };

  const { game: resumed, report } = recover(current);

  assert.equal(resumed.trade, null);
  assert.equal(report.tradeEvents[0].type, "PLAYER_TRADE_CANCELLED_DISCONNECT");
});

test("legacy trade identity references are repaired without changing the offer", () => {
  const current = game();
  activateBotController(current.players[1], { now: 1 });
  current.trade = {
    id: "legacy-trade",
    from: 0,
    fromPlayerId: "old-host-id",
    to: 1,
    toPlayerId: "old-guest-id",
    give: { ouro: 2 },
    get: { obsidiana: 1 },
    declined: [],
  };

  const { game: resumed, report } = recover(current);

  assert.equal(report.tradeIdentityRepaired, true);
  assert.equal(resumed.trade.id, `trade_${"d".repeat(24)}`);
  assert.equal(resumed.trade.fromPlayerId, resumed.players[0].playerId);
  assert.equal(resumed.trade.toPlayerId, resumed.players[1].playerId);
  assert.deepEqual(resumed.trade.give, { ouro: 2 });
  assert.deepEqual(resumed.trade.get, { obsidiana: 1 });
});

test("bot takeover survives host recovery while runtime-only bot flags are reset", () => {
  const current = game();
  activateBotController(current.players[1], { now: 7_000 });
  current.players[1].humanReconnectPending = true;
  current.players[1].botActionInProgress = true;

  const { game: resumed } = recover(current, 50_000);

  assert.equal(resumed.players[1].controller, "bot");
  assert.equal(resumed.players[1].botActivatedAt, 7_000);
  assert.equal(resumed.players[1].connected, true);
  assert.equal(resumed.players[1].humanReconnectPending, false);
  assert.equal(resumed.players[1].botActionInProgress, false);
});

test("ended-game recovery preserves the result but clears stale rematch readiness", () => {
  const current = game({ phase: "ended" });
  current.winner = 1;
  current.endReason = "VICTORY_POINTS";
  current.players.forEach((candidate) => { candidate.ready = true; });
  const winner = current.winner;
  const reason = current.endReason;

  const { game: resumed, report } = recover(current, 60_000);

  assert.equal(resumed.phase, "ended");
  assert.equal(resumed.winner, winner);
  assert.equal(resumed.endReason, reason);
  assert.deepEqual(resumed.players.map((candidate) => candidate.ready), [false, false, false]);
  assert.equal(report.rematchReadyCleared, 3);
});

test("war and exploration authoritative state are preserved verbatim across recovery", () => {
  for (const mode of ["guerra", "exploracao"]) {
    const current = game({ phase: "play", mode });
    current.units = { "0,0": { p: 0, t: "cavaleiro", mv: 1 } };
    current.occ = { "1,1": 1 };
    current.wagons = { w1: { p: 2, at: "2,0", cargo: 1, mv: 1 } };
    current.glory = { 0: 2, 1: 1 };
    if (mode === "guerra") {
      current.troll.awake = true;
      current.troll.turns = 12;
      current.gelo = { awake: true, active: true };
    }
    const preserved = Object.fromEntries(
      ["board", "units", "occ", "wagons", "glory", "troll", "gelo"].map((key) => [key, structuredClone(current[key])]),
    );

    const { game: resumed } = recover(current, 70_000);

    for (const [key, value] of Object.entries(preserved)) assert.deepEqual(resumed[key], value, `${mode}:${key}`);
  }
});



test("recovery clears stale presentation overlays but preserves the Chronicle log", () => {
  const current = game();
  current.presentation.log = [{ id: 1, msg: "Saved Chronicle", pi: 0, kind: "realm", emphasis: "ambient" }];
  current.presentation.story = { id: 2, title: "Old story" };
  current.presentation.cardReveal = { id: 3, pi: 1, card: { id: "old" } };
  current.presentation.award = { id: 4, kind: "road", pi: 0 };
  current.presentation.disaster = { id: 5, type: "peste" };

  const { game: resumed, report } = recover(current, 75_000);

  assert.equal(report.presentationEventsCleared, 4);
  assert.equal(resumed.presentation.story, null);
  assert.equal(resumed.presentation.cardReveal, null);
  assert.equal(resumed.presentation.award, null);
  assert.equal(resumed.presentation.disaster, null);
  assert.deepEqual(resumed.presentation.log, current.presentation.log);
});

test("recovery leaves the authoritative action journal untouched", () => {
  const current = game();
  const changed = structuredClone(current);
  changed.perksOn = false;
  const journaled = appendAcceptedGameAction(current, changed, {
    actionId: `game_${"e".repeat(24)}`,
    source: ACTION_SOURCE.LOCAL_HUMAN,
    playerId: current.players[0].playerId,
    actorIndex: 0,
    action: { type: "TEST_ACTION" },
    revisionBefore: current.v,
    revisionAfter: current.v + 1,
    occurredAt: 1_000,
  }).game;
  const journalBefore = structuredClone(journaled.actionJournal);

  const { game: resumed } = recover(journaled, 80_000);

  assert.deepEqual(resumed.actionJournal, journalBefore);
});


test("the first accepted action after recovery creates a replay checkpoint instead of breaking the journal", () => {
  let current = game();
  current.v = 20;
  current.turn.rolled = false;

  const rollTrace = createActionExecutionTrace({ rng: (() => {
    const values = [0.1, 0.2];
    let index = 0;
    return () => values[index++];
  })() });
  const rolled = applyGameAction(current, current.players[0].playerId, { type: GAME_ACTION.ROLL_DICE }, {
    rng: rollTrace.rng,
    now: () => 1_000,
  });
  assert.equal(rolled.ok, true, rolled.reason);
  current = appendAcceptedGameAction(current, rolled.game, {
    actionId: `game_${"4".repeat(24)}`,
    source: ACTION_SOURCE.LOCAL_HUMAN,
    playerId: current.players[0].playerId,
    actorIndex: rolled.actorIndex,
    action: { type: GAME_ACTION.ROLL_DICE },
    revisionBefore: 20,
    revisionAfter: 21,
    occurredAt: 1_000,
    trace: rollTrace.snapshot(),
    events: rolled.events,
    privateResult: rolled.privateResult,
  }).game;
  current.v = 21;

  const resumed = recover(current, 2_000).game;
  const ended = applyGameAction(resumed, resumed.players[0].playerId, { type: GAME_ACTION.END_TURN }, {
    now: () => 2_100,
  });
  assert.equal(ended.ok, true, ended.reason);
  const journaled = appendAcceptedGameAction(resumed, ended.game, {
    actionId: `game_${"5".repeat(24)}`,
    source: ACTION_SOURCE.LOCAL_HUMAN,
    playerId: resumed.players[0].playerId,
    actorIndex: ended.actorIndex,
    action: { type: GAME_ACTION.END_TURN },
    revisionBefore: 21,
    revisionAfter: 22,
    occurredAt: 2_100,
    events: ended.events,
    privateResult: ended.privateResult,
  }).game;
  journaled.v = 22;

  assert.ok(journaled.actionJournal.entries[1].checkpointState);
  const replay = verifyActionReplay(journaled);
  assert.equal(replay.ok, true, replay.code);
  assert.equal(replay.checkpointsApplied, 1);
});
