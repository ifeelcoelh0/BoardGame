import test from "node:test";
import assert from "node:assert/strict";

import { LOBBY_ACTION, LOBBY_PROTOCOL_VERSION } from "../src/game/lobbyProtocol.js";
import { GAME_ACTION, GAME_PROTOCOL_VERSION } from "../src/game/gameProtocol.js";
import { IDENTITY_PROTOCOL_VERSION } from "../src/game/playerIdentity.js";
import { STATE_VIEW_VERSION } from "../src/game/gameStateView.js";
import { createHostActionController } from "../src/multiplayer/hostActionController.js";
import { createClientActionController } from "../src/multiplayer/clientActionController.js";
import { createMultiplayerRuntimeState, authenticateConnection } from "../src/multiplayer/runtimeState.js";
import { createPendingActionStore } from "../src/multiplayer/pendingActionStore.js";
import { IDS, makeGame, makeLobby } from "./fixtures.js";

function actionId(prefix, digit) {
  return `${prefix}_${String(digit).repeat(24)}`;
}

function fakeConnection() {
  return {
    open: true,
    sent: [],
    send(payload) { this.sent.push(payload); },
  };
}

function hostHarness(initialGame, overrides = {}) {
  let game = structuredClone(initialGame);
  let commits = 0;
  const runtime = createMultiplayerRuntimeState();
  runtime.host = true;
  const lobbyApplied = [];
  const gameApplied = [];
  const controller = createHostActionController({
    getRuntime: () => runtime,
    getGame: () => game,
    getLocalPlayerId: () => IDS.host,
    commit: async (next) => {
      commits += 1;
      game = structuredClone(next);
      game.v = (game.v || 0) + 1;
      return game;
    },
    enqueueAuthorityTask: async (task) => task(),
    validCharacterIds: new Set(["vlad", "rhaegal", "smaug", "drogon"]),
    onLobbyApplied: (_next, applied) => lobbyApplied.push(applied.event?.type || null),
    onGameApplied: (_next, applied) => gameApplied.push(applied.events?.[0]?.type || applied.event?.type || null),
    ...overrides,
  });
  return { runtime, controller, lobbyApplied, gameApplied, getGame: () => game, getCommits: () => commits };
}

test("host action controller applies and deduplicates accepted lobby actions", async () => {
  const harness = hostHarness(makeLobby());
  const message = {
    t: "lobby-action",
    protocolVersion: IDENTITY_PROTOCOL_VERSION,
    lobbyProtocolVersion: LOBBY_PROTOCOL_VERSION,
    actionId: actionId("action", 1),
    expectedRevision: 7,
    action: { type: LOBBY_ACTION.SET_READY, ready: false },
  };

  const first = await harness.controller.processLobbyAction(message);
  const second = await harness.controller.processLobbyAction(message);
  assert.equal(first.ok, true);
  assert.deepEqual(second, first);
  assert.equal(harness.getCommits(), 1);
  assert.equal(harness.getGame().players[0].ready, false);
  assert.deepEqual(harness.lobbyApplied, ["READY_CHANGED"]);
});

test("host action controller rejects stale actions without embedding a snapshot", async () => {
  const harness = hostHarness(makeLobby());
  const result = await harness.controller.processLobbyAction({
    t: "lobby-action",
    protocolVersion: IDENTITY_PROTOCOL_VERSION,
    lobbyProtocolVersion: LOBBY_PROTOCOL_VERSION,
    actionId: actionId("action", 2),
    expectedRevision: 6,
    action: { type: LOBBY_ACTION.SET_READY, ready: false },
  });
  assert.equal(result.ok, false);
  assert.equal(result.reason, "STALE_STATE");
  assert.equal(result.syncRequired, true);
  assert.equal(Object.hasOwn(result, "g"), false);
  assert.equal(harness.getCommits(), 0);
});

test("host action controller commits game reducer results and preserves private results", async () => {
  const harness = hostHarness(makeGame(), {
    applyGame: (game, actorId, action) => ({
      ok: true,
      game: { ...structuredClone(game), marker: `${actorId}:${action.type}` },
      events: [{ type: "TEST_EVENT" }],
      privateResult: { type: "PRIVATE_TEST", value: 3 },
    }),
  });
  const message = {
    t: "game-action",
    protocolVersion: IDENTITY_PROTOCOL_VERSION,
    gameProtocolVersion: GAME_PROTOCOL_VERSION,
    actionId: actionId("game", 3),
    expectedRevision: 12,
    action: { type: GAME_ACTION.ROLL_DICE },
  };
  const result = await harness.controller.processGameAction(message);
  const duplicate = await harness.controller.processGameAction(message);
  assert.equal(result.ok, true);
  assert.deepEqual(duplicate, result);
  assert.equal(result.privateResult.type, "PRIVATE_TEST");
  assert.equal(harness.getGame().marker, `${IDS.host}:${GAME_ACTION.ROLL_DICE}`);
  assert.deepEqual(harness.gameApplied, ["TEST_EVENT"]);
  assert.equal(harness.getGame().actionJournal.entries.length, 1);
  assert.equal(harness.getGame().actionJournal.entries[0].actionId, actionId("game", 3));
  assert.equal(harness.getGame().actionJournal.entries[0].source, "local-human");
  assert.equal(harness.getGame().actionJournal.entries[0].privateResult.type, "PRIVATE_TEST");
  assert.equal(harness.getCommits(), 1);
});

test("host state synchronization requires an authenticated compatible connection", () => {
  const harness = hostHarness(makeGame());
  const connection = fakeConnection();
  const sent = [];
  const request = {
    t: "state-request",
    protocolVersion: IDENTITY_PROTOCOL_VERSION,
    stateViewVersion: STATE_VIEW_VERSION,
  };
  assert.equal(harness.controller.onStateRequest({ connection, message: request, send: (value) => sent.push(value) }), false);
  authenticateConnection(harness.runtime, connection, IDS.guest1);
  assert.equal(harness.controller.onStateRequest({ connection, message: request, send: (value) => sent.push(value) }), true);
  assert.equal(sent[0].t, "state");
});

function clientHarness({ game = makeLobby(), host = false, localLobby, localGame } = {}) {
  let currentGame = structuredClone(game);
  const runtime = createMultiplayerRuntimeState();
  runtime.host = host;
  runtime.hostConn = fakeConnection();
  const events = [];
  let nextId = 1;
  const controller = createClientActionController({
    getRuntime: () => runtime,
    getGame: () => currentGame,
    getPlayerId: () => IDS.host,
    pendingLobbyActions: createPendingActionStore({ timeoutMs: 100_000 }),
    pendingGameActions: createPendingActionStore({ timeoutMs: 100_000 }),
    processLocalLobbyAction: localLobby,
    processLocalGameAction: localGame,
    requestAuthoritativeState: () => {
      runtime.hostConn.send({ t: "state-request" });
      return true;
    },
    createId: (prefix) => actionId(prefix, nextId++),
    setTimeoutFn: (fn) => { fn(); return 1; },
    emit: (event) => events.push(event),
  });
  return { runtime, controller, events, setGame: (next) => { currentGame = structuredClone(next); } };
}

test("client action controller sends a remote lobby action and resolves its ACK", async () => {
  const harness = clientHarness();
  const pending = harness.controller.dispatchLobbyAction(LOBBY_ACTION.SET_READY, { ready: false });
  const sent = harness.runtime.hostConn.sent[0];
  assert.equal(sent.t, "lobby-action");
  harness.controller.handleLobbyActionResult({
    t: "lobby-action-result",
    lobbyProtocolVersion: LOBBY_PROTOCOL_VERSION,
    actionId: sent.actionId,
    actionType: sent.action.type,
    ok: true,
    revision: 8,
  });
  assert.equal(await pending, true);
  assert.equal(harness.events.at(-1).type, "LOBBY_ACTION_ACCEPTED");
});

test("client retries an idempotent stale lobby action after requesting synchronization", async () => {
  const harness = clientHarness();
  const pending = harness.controller.dispatchLobbyAction(LOBBY_ACTION.SET_READY, { ready: false });
  const first = harness.runtime.hostConn.sent[0];
  harness.controller.handleLobbyActionResult({
    t: "lobby-action-result",
    lobbyProtocolVersion: LOBBY_PROTOCOL_VERSION,
    actionId: first.actionId,
    actionType: first.action.type,
    ok: false,
    reason: "STALE_STATE",
    revision: 8,
    syncRequired: true,
  });
  const retry = harness.runtime.hostConn.sent.find((message) => message.t === "lobby-action" && message.actionId !== first.actionId);
  assert.ok(retry);
  assert.equal(retry.expectedRevision, 8);
  assert.ok(harness.runtime.hostConn.sent.some((message) => message.t === "state-request"));
  harness.controller.handleLobbyActionResult({
    t: "lobby-action-result",
    lobbyProtocolVersion: LOBBY_PROTOCOL_VERSION,
    actionId: retry.actionId,
    actionType: retry.action.type,
    ok: true,
    revision: 9,
  });
  assert.equal(await pending, true);
});

test("duplicate clicks reuse the pending game action and emit immediate feedback", async () => {
  const harness = clientHarness({ game: makeGame() });
  const firstPromise = harness.controller.dispatchGameAction(GAME_ACTION.ROLL_DICE);
  const secondPromise = harness.controller.dispatchGameAction(GAME_ACTION.ROLL_DICE);
  assert.equal(harness.runtime.hostConn.sent.filter((message) => message.t === "game-action").length, 1);
  assert.equal(harness.events.at(-1).type, "DUPLICATE_ACTION_PENDING");
  const sent = harness.runtime.hostConn.sent.find((message) => message.t === "game-action");
  harness.controller.handleGameActionResult({
    t: "game-action-result",
    gameProtocolVersion: GAME_PROTOCOL_VERSION,
    actionId: sent.actionId,
    actionType: sent.action.type,
    ok: true,
    revision: 13,
  });
  assert.equal((await firstPromise).ok, true);
  assert.equal((await secondPromise).ok, true);
});

test("client translates rejected game actions into application events", async () => {
  const harness = clientHarness({ game: makeGame() });
  const pending = harness.controller.dispatchGameAction(GAME_ACTION.END_TURN);
  const sent = harness.runtime.hostConn.sent[0];
  harness.controller.handleGameActionResult({
    t: "game-action-result",
    gameProtocolVersion: GAME_PROTOCOL_VERSION,
    actionId: sent.actionId,
    actionType: sent.action.type,
    ok: false,
    reason: "NOT_CURRENT_PLAYER",
    revision: 12,
  });
  assert.equal(await pending, false);
  assert.equal(harness.events.at(-1).type, "GAME_ACTION_REJECTED");
  assert.match(harness.events.at(-1).userMessage, /Não é a tua vez/);
});



test("client allows REMATCH_READY after the authoritative game ended", async () => {
  const ended = makeGame();
  ended.phase = "ended";
  ended.winner = 0;
  const harness = clientHarness({ game: ended });
  const pending = harness.controller.dispatchGameAction(GAME_ACTION.REMATCH_READY);
  const sent = harness.runtime.hostConn.sent.find((message) => message.t === "game-action");
  assert.ok(sent);
  assert.equal(sent.action.type, GAME_ACTION.REMATCH_READY);
  harness.controller.handleGameActionResult({
    t: "game-action-result",
    gameProtocolVersion: GAME_PROTOCOL_VERSION,
    actionId: sent.actionId,
    actionType: sent.action.type,
    ok: true,
    revision: (ended.v || 0) + 1,
  });
  assert.equal((await pending).ok, true);
});

test("client rejects REMATCH_READY before endgame", async () => {
  const harness = clientHarness({ game: makeGame() });
  assert.equal(await harness.controller.dispatchGameAction(GAME_ACTION.REMATCH_READY), false);
  assert.equal(harness.runtime.hostConn.sent.some((message) => message.t === "game-action"), false);
});

test("host-local dispatch uses the same client ACK path", async () => {
  const harness = clientHarness({
    host: true,
    localLobby: async (message) => ({
      t: "lobby-action-result",
      lobbyProtocolVersion: LOBBY_PROTOCOL_VERSION,
      actionId: message.actionId,
      actionType: message.action.type,
      ok: true,
      revision: 8,
    }),
  });
  assert.equal(await harness.controller.dispatchLobbyAction(LOBBY_ACTION.SET_READY, { ready: false }), true);
  assert.equal(harness.runtime.hostConn.sent.length, 0);
  assert.equal(harness.events.at(-1).type, "LOBBY_ACTION_ACCEPTED");
});
