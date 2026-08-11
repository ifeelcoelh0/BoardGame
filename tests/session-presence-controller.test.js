import test from "node:test";
import assert from "node:assert/strict";
import {
  authenticateConnection,
  createMultiplayerRuntimeState,
  registerConnection,
  unregisterConnection,
} from "../src/multiplayer/runtimeState.js";
import { createHostSessionPresenceController } from "../src/multiplayer/hostSessionPresenceController.js";
import { createClientSessionPresenceController } from "../src/multiplayer/clientSessionPresenceController.js";
import { IDENTITY_PROTOCOL_VERSION } from "../src/game/playerIdentity.js";
import { STATE_VIEW_VERSION } from "../src/game/gameStateView.js";
import { IDS, TOKEN_HASHES, makeLobby, makePlayer } from "./fixtures.js";

function fakeConnection(id) {
  return {
    id,
    open: true,
    sent: [],
    closed: false,
    send(payload) { this.sent.push(payload); },
    close() { this.open = false; this.closed = true; },
  };
}

function makeHostHarness(initialGame) {
  let game = structuredClone(initialGame);
  const runtime = createMultiplayerRuntimeState();
  runtime.host = true;
  const logs = [];
  const timers = [];
  let idCounter = 0;
  const controller = createHostSessionPresenceController({
    getRuntime: () => runtime,
    identityProtocolVersion: IDENTITY_PROTOCOL_VERSION,
    getGame: () => game,
    commit: async (next) => { game = structuredClone(next); return game; },
    enqueueAuthorityTask: async (task) => task(),
    clone: structuredClone,
    hashSessionToken: async () => TOKEN_HASHES.guest1,
    characters: [
      { id: "vlad" }, { id: "rhaegal" }, { id: "smaug" }, { id: "drogon" },
    ],
    createPlayer: (characterId, identity) => makePlayer({
      ...identity,
      ch: characterId,
      ready: false,
      characterConfirmed: false,
      res: { madeira: 0, tijolo: 0, cavalos: 0, ouro: 0, obsidiana: 0 },
      devNew: [],
      devOld: [],
    }),
    addLog: (_state, message) => logs.push(message),
    characterName: (id) => id,
    clearLobbyPresenceTimer: (playerId) => timers.push(["clear-lobby", playerId]),
    clearGamePresenceTimer: (playerId) => timers.push(["clear-game", playerId]),
    scheduleLobbyPresenceTimer: (playerId, deadline) => timers.push(["schedule-lobby", playerId, deadline]),
    createId: (prefix) => `${prefix}_${String(++idCounter).padStart(24, "0")}`,
    now: () => 1_000,
    setTimeoutFn: (fn) => { fn(); return 1; },
  });
  return { runtime, controller, logs, timers, getGame: () => game };
}

test("host session controller reserves a seat and authenticates the connection", async () => {
  const host = makePlayer();
  const harness = makeHostHarness(makeLobby({ players: [host] }));
  const connection = fakeConnection("guest");
  registerConnection(harness.runtime, connection);
  const sent = [];

  await harness.controller.onClaimSeat({
    connection,
    message: {
      t: "claim-seat",
      protocolVersion: IDENTITY_PROTOCOL_VERSION,
      requestId: `claim_${"1".repeat(24)}`,
      sessionTokenHash: TOKEN_HASHES.guest1,
    },
    send: (payload) => sent.push(payload),
  });

  assert.equal(sent[0].ok, true);
  assert.equal(harness.getGame().players.length, 2);
  assert.equal(harness.getGame().players[1].connected, true);
  assert.equal(harness.runtime.auth.get(connection), sent[0].playerId);
});

test("host session controller reconnects a player and replaces the stale connection", async () => {
  const guest = makePlayer({
    playerId: IDS.guest1,
    seatId: IDS.seat1,
    ch: "rhaegal",
    sessionTokenHash: TOKEN_HASHES.guest1,
    connected: false,
    ready: false,
  });
  guest.disconnectedAt = 900;
  guest.reconnectDeadline = 5_000;
  const harness = makeHostHarness(makeLobby({ players: [makePlayer(), guest] }));
  const oldConnection = fakeConnection("old");
  const nextConnection = fakeConnection("next");
  authenticateConnection(harness.runtime, oldConnection, IDS.guest1);
  registerConnection(harness.runtime, nextConnection);
  const sent = [];

  await harness.controller.onSessionAuth({
    connection: nextConnection,
    message: {
      t: "session-auth",
      protocolVersion: IDENTITY_PROTOCOL_VERSION,
      playerId: IDS.guest1,
      sessionToken: "f".repeat(64),
    },
    send: (payload) => sent.push(payload),
  });

  assert.equal(sent[0].ok, true);
  assert.equal(oldConnection.sent[0].t, "session-replaced");
  assert.equal(oldConnection.closed, true);
  assert.equal(harness.getGame().players[1].connected, true);
  assert.equal(harness.runtime.auth.get(nextConnection), IDS.guest1);
});

test("host presence controller removes voluntary lobby exits and marks transport loss", async () => {
  const harness = makeHostHarness(makeLobby({ players: [makePlayer(), makePlayer({
    playerId: IDS.guest1,
    seatId: IDS.seat1,
    ch: "rhaegal",
    sessionTokenHash: TOKEN_HASHES.guest1,
  })] }));
  const connection = fakeConnection("guest");
  authenticateConnection(harness.runtime, connection, IDS.guest1);
  const leave = [];
  await harness.controller.onLeaveSeat({
    connection,
    message: { t: "leave-seat", protocolVersion: IDENTITY_PROTOCOL_VERSION, requestId: `leave_${"2".repeat(24)}` },
    send: (payload) => leave.push(payload),
  });
  assert.equal(leave[0].ok, true);
  assert.equal(harness.getGame().players.length, 1);

  const secondHarness = makeHostHarness(makeLobby({ players: [makePlayer(), makePlayer({
    playerId: IDS.guest1,
    seatId: IDS.seat1,
    ch: "rhaegal",
    sessionTokenHash: TOKEN_HASHES.guest1,
  })] }));
  const lost = fakeConnection("lost");
  authenticateConnection(secondHarness.runtime, lost, IDS.guest1);
  unregisterConnection(secondHarness.runtime, lost);
  assert.equal(await secondHarness.controller.onConnectionClosed(IDS.guest1), true);
  assert.equal(secondHarness.getGame().players[1].connected, false);
  assert.equal(secondHarness.getGame().players[1].ready, false);
  assert.ok(secondHarness.timers.some(([type]) => type === "schedule-lobby"));
});

test("host kick side effect notifies, unregisters and closes only the target", () => {
  const harness = makeHostHarness(makeLobby());
  const target = fakeConnection("target");
  const other = fakeConnection("other");
  authenticateConnection(harness.runtime, target, IDS.guest1);
  authenticateConnection(harness.runtime, other, IDS.guest2);

  assert.equal(harness.controller.applyKickSideEffect({ type: "PLAYER_KICKED", targetPlayerId: IDS.guest1 }), true);
  assert.equal(target.sent[0].t, "kicked-from-lobby");
  assert.equal(target.closed, true);
  assert.equal(harness.runtime.auth.has(target), false);
  assert.equal(other.closed, false);
});

test("client session controller translates welcome and successful authentication into application events", () => {
  const events = [];
  const game = makeLobby();
  game.stateViewVersion = STATE_VIEW_VERSION;
  const controller = createClientSessionPresenceController({
    roomCode: "ABCD",
    savedSession: { playerId: IDS.guest1, seatId: IDS.seat1, sessionToken: "e".repeat(64) },
    identityProtocolVersion: IDENTITY_PROTOCOL_VERSION,
    stateViewVersion: STATE_VIEW_VERSION,
    normalizeGame: structuredClone,
    getGame: () => game,
    emit: (event) => events.push(event),
  });

  controller.onIdentityWelcome({ message: {
    t: "identity-welcome",
    protocolVersion: IDENTITY_PROTOCOL_VERSION,
    stateViewVersion: STATE_VIEW_VERSION,
    g: game,
  } });
  controller.onSessionResult({ message: {
    t: "session-result",
    ok: true,
    playerId: IDS.guest1,
    seatId: IDS.seat1,
    g: game,
  } });

  assert.deepEqual(events.map((event) => event.type), ["SESSION_AUTH_REQUIRED", "SESSION_ACCEPTED"]);
  assert.equal(events[1].identity.sessionToken, "e".repeat(64));
  assert.equal(controller.isAuthenticated(), true);
  assert.equal(controller.isAuthResolved(), true);
});

test("client session controller requests a new claim and validates its result", () => {
  const events = [];
  const game = makeLobby({ players: [makePlayer()] });
  game.stateViewVersion = STATE_VIEW_VERSION;
  let pending = null;
  const controller = createClientSessionPresenceController({
    roomCode: "ABCD",
    identityProtocolVersion: IDENTITY_PROTOCOL_VERSION,
    stateViewVersion: STATE_VIEW_VERSION,
    normalizeGame: structuredClone,
    getGame: () => game,
    getPendingIdentity: () => pending,
    emit: (event) => events.push(event),
  });

  controller.onIdentityWelcome({ message: {
    t: "identity-welcome",
    protocolVersion: IDENTITY_PROTOCOL_VERSION,
    stateViewVersion: STATE_VIEW_VERSION,
    g: game,
  } });
  assert.equal(events.at(-1).type, "CLAIM_REQUIRED");

  pending = { requestId: `claim_${"3".repeat(24)}`, sessionToken: "d".repeat(64) };
  const claimedGame = makeLobby({ players: [makePlayer(), makePlayer({
    playerId: IDS.guest1,
    seatId: IDS.seat1,
    ch: "rhaegal",
    sessionTokenHash: TOKEN_HASHES.guest1,
  })] });
  controller.onClaimResult({ message: {
    t: "claim-result",
    ok: true,
    requestId: pending.requestId,
    playerId: IDS.guest1,
    seatId: IDS.seat1,
    g: claimedGame,
  } });
  assert.equal(events.at(-1).type, "CLAIM_ACCEPTED");
  assert.equal(events.at(-1).identity.sessionToken, "d".repeat(64));
});

test("client session controller translates replacement, kick and legacy state safely", () => {
  const events = [];
  const controller = createClientSessionPresenceController({
    roomCode: "ABCD",
    identityProtocolVersion: IDENTITY_PROTOCOL_VERSION,
    stateViewVersion: STATE_VIEW_VERSION,
    emit: (event) => events.push(event),
  });
  controller.onSessionReplaced();
  controller.onKickedFromLobby();
  controller.onState({ message: { t: "state", g: {} } });
  assert.deepEqual(events.map((event) => event.type), [
    "SESSION_REPLACED",
    "KICKED_FROM_LOBBY",
    "LEGACY_HOST_STATE",
  ]);
});

test("client rejects an incompatible build before installing the welcome state", () => {
  const events = [];
  const game = makeLobby();
  game.stateViewVersion = STATE_VIEW_VERSION;
  const controller = createClientSessionPresenceController({
    roomCode: "ABCD",
    identityProtocolVersion: IDENTITY_PROTOCOL_VERSION,
    stateViewVersion: STATE_VIEW_VERSION,
    buildCompatibilityVersion: 2,
    normalizeGame: structuredClone,
    emit: (event) => events.push(event),
  });

  controller.onIdentityWelcome({ message: {
    t: "identity-welcome",
    protocolVersion: IDENTITY_PROTOCOL_VERSION,
    stateViewVersion: STATE_VIEW_VERSION,
    buildCompatibilityVersion: 1,
    g: game,
  } });

  assert.equal(events[0].type, "CONNECTION_REJECTED");
  assert.equal(events[0].reason, "BUILD_MISMATCH");
  assert.match(events[0].userMessage, /versão diferente/i);
});

test("host rejects session authentication from an incompatible build", async () => {
  const harness = makeHostHarness(makeLobby());
  const controller = createHostSessionPresenceController({
    getRuntime: () => harness.runtime,
    identityProtocolVersion: IDENTITY_PROTOCOL_VERSION,
    buildCompatibilityVersion: 2,
    getGame: harness.getGame,
    commit: async (next) => next,
    hashSessionToken: async () => TOKEN_HASHES.guest1,
  });
  const connection = fakeConnection("incompatible");
  registerConnection(harness.runtime, connection);
  const sent = [];

  await controller.onSessionAuth({
    connection,
    message: {
      t: "session-auth",
      protocolVersion: IDENTITY_PROTOCOL_VERSION,
      buildCompatibilityVersion: 1,
      playerId: IDS.guest1,
      sessionToken: "f".repeat(64),
    },
    send: (payload) => sent.push(payload),
  });

  assert.equal(sent[0].ok, false);
  assert.equal(sent[0].reason, "BUILD_MISMATCH");
});
