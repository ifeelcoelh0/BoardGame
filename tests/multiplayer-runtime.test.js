import test from "node:test";
import assert from "node:assert/strict";
import {
  authenticateConnection,
  authenticatedPlayerId,
  connectionsForPlayer,
  createMultiplayerRuntimeState,
  destroyMultiplayerRuntime,
  enqueueAuthorityTask,
  hasConnection,
  registerConnection,
  replaceAuthenticatedConnection,
  unregisterConnection,
} from "../src/multiplayer/runtimeState.js";
import { createPendingActionStore } from "../src/multiplayer/pendingActionStore.js";
import {
  createGameActionMessage,
  createLobbyActionMessage,
  createStateRequestMessage,
  isGameActionResult,
  isLobbyActionResult,
} from "../src/multiplayer/protocolMessages.js";
import {
  broadcastGameState,
  payloadForConnection,
  requestAuthoritativeState,
  stateViewForConnection,
} from "../src/multiplayer/stateTransport.js";
import {
  forgetPlayerSession,
  loadPlayerSession,
  savePlayerSession,
} from "../src/multiplayer/sessionStore.js";
import { GAME_PROTOCOL_VERSION } from "../src/game/gameProtocol.js";
import { LOBBY_PROTOCOL_VERSION } from "../src/game/lobbyProtocol.js";
import { STATE_VIEW_VERSION } from "../src/game/gameStateView.js";
import { IDENTITY_PROTOCOL_VERSION } from "../src/game/playerIdentity.js";
import { IDS, MemorySessionStorage, makeGame } from "./fixtures.js";

function connection() {
  return {
    open: true,
    sent: [],
    closed: false,
    send(message) { this.sent.push(structuredClone(message)); },
    close() { this.closed = true; this.open = false; },
  };
}

test("runtime registers, authenticates and removes connections centrally", () => {
  const runtime = createMultiplayerRuntimeState();
  const conn = connection();
  assert.equal(registerConnection(runtime, conn), true);
  assert.equal(hasConnection(runtime, conn), true);
  assert.equal(authenticateConnection(runtime, conn, IDS.guest1), true);
  assert.equal(authenticatedPlayerId(runtime, conn), IDS.guest1);
  assert.deepEqual(connectionsForPlayer(runtime, IDS.guest1), [conn]);
  assert.equal(unregisterConnection(runtime, conn), IDS.guest1);
  assert.equal(hasConnection(runtime, conn), false);
  assert.equal(authenticatedPlayerId(runtime, conn), null);
});

test("a new authenticated connection replaces every previous connection for the player", () => {
  const runtime = createMultiplayerRuntimeState();
  const oldA = connection();
  const oldB = connection();
  const next = connection();
  authenticateConnection(runtime, oldA, IDS.guest1);
  authenticateConnection(runtime, oldB, IDS.guest1);
  const replaced = replaceAuthenticatedConnection(runtime, IDS.guest1, next);
  assert.deepEqual(new Set(replaced), new Set([oldA, oldB]));
  assert.equal(hasConnection(runtime, oldA), false);
  assert.equal(hasConnection(runtime, oldB), false);
  assert.equal(authenticatedPlayerId(runtime, next), IDS.guest1);
});

test("authority queue executes asynchronous mutations in order", async () => {
  const runtime = createMultiplayerRuntimeState();
  const order = [];
  const first = enqueueAuthorityTask(runtime, async () => {
    await Promise.resolve();
    order.push("first");
    return 1;
  });
  const second = enqueueAuthorityTask(runtime, async () => {
    order.push("second");
    return 2;
  });
  assert.deepEqual(await Promise.all([first, second]), [1, 2]);
  assert.deepEqual(order, ["first", "second"]);
});

test("destroying the runtime closes transport state and clears caches", () => {
  const runtime = createMultiplayerRuntimeState();
  const conn = connection();
  const hostConn = connection();
  let destroyed = false;
  runtime.peer = { destroy() { destroyed = true; } };
  runtime.hostConn = hostConn;
  runtime.host = true;
  runtime.lobbyActionResults.set("x", {});
  runtime.gameActionResults.set("y", {});
  authenticateConnection(runtime, conn, IDS.guest1);
  destroyMultiplayerRuntime(runtime);
  assert.equal(destroyed, true);
  assert.equal(conn.closed, true);
  assert.equal(hostConn.closed, true);
  assert.equal(runtime.host, false);
  assert.equal(runtime.conns.length, 0);
  assert.equal(runtime.auth.size, 0);
  assert.equal(runtime.lobbyActionResults.size, 0);
  assert.equal(runtime.gameActionResults.size, 0);
});

test("pending action store reuses a pending action by type and settles once", async () => {
  const timers = new Map();
  let nextTimer = 1;
  const store = createPendingActionStore({
    setTimer(callback) { const id = nextTimer++; timers.set(id, callback); return id; },
    clearTimer(id) { timers.delete(id); },
  });
  const promise = store.registerRemote("a", { type: "ROLL_DICE", message: { t: "x" } });
  assert.equal(store.findByType("ROLL_DICE")?.promise, promise);
  const pending = store.take("a");
  pending.resolve({ ok: true });
  assert.deepEqual(await promise, { ok: true });
  assert.equal(store.size, 0);
});

test("pending action store retries the exact envelope once and then times out", async () => {
  const callbacks = [];
  const failures = [];
  const conn = connection();
  const store = createPendingActionStore({
    timeoutMs: 10,
    maxAttempts: 2,
    setTimer(callback) { callbacks.push(callback); return callbacks.length; },
    clearTimer() {},
  });
  const promise = store.registerRemote("a", { type: "BUILD_ROAD", message: { actionId: "same" } });
  store.send("a", { getConnection: () => conn, onFailure: (reason) => failures.push(reason) });
  assert.equal(conn.sent.length, 1);
  callbacks.shift()();
  assert.equal(conn.sent.length, 2);
  assert.deepEqual(conn.sent[0], conn.sent[1]);
  callbacks.shift()();
  assert.equal(await promise, false);
  assert.deepEqual(failures, ["ACTION_TIMEOUT"]);
  assert.equal(store.size, 0);
});

test("pending action store fails immediately when the host connection is unavailable", async () => {
  const failures = [];
  const store = createPendingActionStore();
  const promise = store.registerRemote("a", { type: "SET_READY", message: {} });
  assert.equal(store.send("a", { getConnection: () => null, onFailure: (reason) => failures.push(reason) }), false);
  assert.equal(await promise, false);
  assert.deepEqual(failures, ["UNAUTHENTICATED"]);
});

test("clearAll cancels every pending promise", async () => {
  const store = createPendingActionStore();
  const a = store.registerRemote("a", { type: "A", message: {} });
  const b = store.registerRemote("b", { type: "B", message: {} });
  store.clearAll(false);
  assert.deepEqual(await Promise.all([a, b]), [false, false]);
  assert.equal(store.size, 0);
});

test("protocol builders use the current compatible version bundle", () => {
  const lobby = createLobbyActionMessage({ actionId: "action_" + "1".repeat(24), expectedRevision: 7, type: "SET_READY", payload: { ready: true } });
  assert.equal(lobby.protocolVersion, IDENTITY_PROTOCOL_VERSION);
  assert.equal(lobby.lobbyProtocolVersion, LOBBY_PROTOCOL_VERSION);
  assert.deepEqual(lobby.action, { type: "SET_READY", ready: true });

  const game = createGameActionMessage({ actionId: "game_" + "2".repeat(24), expectedRevision: 12, type: "ROLL_DICE" });
  assert.equal(game.protocolVersion, IDENTITY_PROTOCOL_VERSION);
  assert.equal(game.gameProtocolVersion, GAME_PROTOCOL_VERSION);
  assert.deepEqual(game.action, { type: "ROLL_DICE" });

  assert.deepEqual(createStateRequestMessage(), {
    t: "state-request",
    protocolVersion: IDENTITY_PROTOCOL_VERSION,
    stateViewVersion: STATE_VIEW_VERSION,
  });
});

test("result guards reject unrelated or outdated messages", () => {
  assert.equal(isLobbyActionResult({ t: "lobby-action-result", lobbyProtocolVersion: LOBBY_PROTOCOL_VERSION, actionId: "a" }), true);
  assert.equal(isLobbyActionResult({ t: "lobby-action-result", lobbyProtocolVersion: -1, actionId: "a" }), false);
  assert.equal(isGameActionResult({ t: "game-action-result", gameProtocolVersion: GAME_PROTOCOL_VERSION, actionId: "g" }), true);
  assert.equal(isGameActionResult({ t: "state", gameProtocolVersion: GAME_PROTOCOL_VERSION, actionId: "g" }), false);
});

test("state transport sends a different private view to each authenticated connection", () => {
  const runtime = createMultiplayerRuntimeState();
  runtime.host = true;
  const guest = connection();
  const publicConn = connection();
  authenticateConnection(runtime, guest, IDS.guest1);
  registerConnection(runtime, publicConn);
  const game = makeGame();

  const guestView = stateViewForConnection(game, runtime, guest);
  assert.equal(guestView.viewerPlayerId, IDS.guest1);
  assert.equal(guestView.players[1].res.madeira, 1);
  assert.equal(guestView.players[0].res.madeira, 0);

  const publicView = stateViewForConnection(game, runtime, publicConn);
  assert.equal(publicView.viewerPlayerId, null);
  assert.equal(publicView.players[0].res.madeira, 0);
  assert.equal(publicView.players[1].res.madeira, 0);

  const payload = payloadForConnection({ t: "state", g: game }, runtime, guest);
  assert.equal(payload.stateViewVersion, STATE_VIEW_VERSION);
  assert.equal(payload.g.viewerPlayerId, IDS.guest1);

  broadcastGameState(runtime, game);
  assert.equal(guest.sent.at(-1).g.viewerPlayerId, IDS.guest1);
  assert.equal(publicConn.sent.at(-1).g.viewerPlayerId, null);
});

test("state requests are sent only by connected guests", () => {
  const runtime = createMultiplayerRuntimeState();
  const conn = connection();
  runtime.hostConn = conn;
  assert.equal(requestAuthoritativeState(runtime), true);
  assert.deepEqual(conn.sent[0], createStateRequestMessage());
  runtime.host = true;
  assert.equal(requestAuthoritativeState(runtime), false);
});

test("session store can be injected and never leaks rooms across storage contexts", () => {
  const first = new MemorySessionStorage();
  const second = new MemorySessionStorage();
  const session = { playerId: IDS.host, seatId: IDS.seatHost, sessionToken: "f".repeat(64) };
  assert.equal(savePlayerSession(" abcd ", session, { storage: first }), true);
  assert.deepEqual(loadPlayerSession("ABCD", { storage: first }), session);
  assert.equal(loadPlayerSession("ABCD", { storage: second }), null);
  assert.equal(forgetPlayerSession("abcd", { storage: first }), true);
  assert.equal(loadPlayerSession("ABCD", { storage: first }), null);
});

import { createHostPeerRuntime } from "../src/multiplayer/hostRuntime.js";
import { createClientPeerRuntime } from "../src/multiplayer/clientRuntime.js";

class FakeEmitter {
  constructor() { this.handlers = new Map(); }
  on(type, handler) {
    const list = this.handlers.get(type) || [];
    list.push(handler);
    this.handlers.set(type, list);
    return this;
  }
  emit(type, value) {
    for (const handler of this.handlers.get(type) || []) handler(value);
  }
}

class FakeDataConnection extends FakeEmitter {
  constructor() {
    super();
    this.open = false;
    this.sent = [];
    this.closed = false;
  }
  send(message) { this.sent.push(structuredClone(message)); }
  close() {
    if (this.closed) return;
    this.closed = true;
    this.open = false;
    this.emit("close");
  }
  openNow() { this.open = true; this.emit("open"); }
}

class FakePeer extends FakeEmitter {
  static instances = [];
  constructor(id, config) {
    super();
    this.id = id;
    this.config = config;
    this.destroyed = false;
    this.connections = [];
    FakePeer.instances.push(this);
  }
  connect(id, options) {
    this.connectedPeerId = id;
    this.connectionOptions = options;
    const conn = new FakeDataConnection();
    this.connections.push(conn);
    return conn;
  }
  destroy() { this.destroyed = true; }
}

function controlledTimers() {
  const timers = new Map();
  let next = 1;
  return {
    timers,
    setTimer(callback) { const id = next++; timers.set(id, callback); return id; },
    clearTimer(id) { timers.delete(id); },
    runAll() { for (const [id, callback] of [...timers]) { timers.delete(id); callback(); } },
  };
}

test("host runtime owns PeerJS lifecycle and filters state per connection", async () => {
  FakePeer.instances.length = 0;
  const runtime = createMultiplayerRuntimeState();
  const timers = controlledTimers();
  const messages = [];
  const closes = [];
  const game = makeGame();
  createHostPeerRuntime({
    runtime,
    peerId: "room",
    peerConfig: { debug: 0 },
    PeerClass: FakePeer,
    setTimer: timers.setTimer,
    clearTimer: timers.clearTimer,
    onConnectionOpen: ({ connection, send }) => {
      authenticateConnection(runtime, connection, IDS.guest1);
      send({ t: "state", g: game });
    },
    onConnectionMessage: ({ message }) => messages.push(message),
    onConnectionClose: ({ playerId }) => closes.push(playerId),
  });
  const peer = FakePeer.instances.at(-1);
  peer.emit("open", "room");
  const conn = new FakeDataConnection();
  peer.emit("connection", conn);
  conn.openNow();
  assert.equal(conn.sent[0].g.viewerPlayerId, IDS.guest1);
  conn.emit("data", { t: "ping" });
  assert.deepEqual(messages, [{ t: "ping" }]);
  conn.close();
  assert.deepEqual(closes, [IDS.guest1]);
  assert.equal(hasConnection(runtime, conn), false);
});

test("host runtime rejects stale incoming connections and reports open timeout once", () => {
  FakePeer.instances.length = 0;
  const runtime = createMultiplayerRuntimeState();
  const timers = controlledTimers();
  let timedOut = 0;
  const controller = createHostPeerRuntime({
    runtime,
    peerId: "room",
    PeerClass: FakePeer,
    setTimer: timers.setTimer,
    clearTimer: timers.clearTimer,
    onOpenTimeout: () => { timedOut += 1; },
  });
  timers.runAll();
  assert.equal(timedOut, 1);
  controller.destroy();
  const stale = new FakeDataConnection();
  FakePeer.instances.at(-1).emit("connection", stale);
  assert.equal(stale.closed, true);
});

test("client runtime creates the host connection and owns open/data/close callbacks", () => {
  FakePeer.instances.length = 0;
  const runtime = createMultiplayerRuntimeState();
  const timers = controlledTimers();
  const received = [];
  let opened = 0;
  let closed = 0;
  createClientPeerRuntime({
    runtime,
    hostPeerId: "host-room",
    PeerClass: FakePeer,
    setTimer: timers.setTimer,
    clearTimer: timers.clearTimer,
    isReady: () => received.length > 0,
    onConnectionOpen: ({ send }) => { opened += 1; send({ t: "auth" }); },
    onMessage: ({ message }) => received.push(message),
    onConnectionClose: () => { closed += 1; },
  });
  const peer = FakePeer.instances.at(-1);
  peer.emit("open", "guest");
  const conn = peer.connections[0];
  assert.equal(runtime.hostConn, conn);
  assert.equal(peer.connectedPeerId, "host-room");
  conn.openNow();
  assert.equal(opened, 1);
  assert.deepEqual(conn.sent, [{ t: "auth" }]);
  conn.emit("data", { t: "identity-welcome" });
  assert.deepEqual(received, [{ t: "identity-welcome" }]);
  conn.close();
  assert.equal(closed, 1);
  assert.equal(runtime.hostConn, null);
});

test("client runtime distinguishes peer-open timeout from welcome timeout", () => {
  FakePeer.instances.length = 0;
  const peerTimers = controlledTimers();
  const runtimeA = createMultiplayerRuntimeState();
  let peerTimeouts = 0;
  createClientPeerRuntime({
    runtime: runtimeA,
    hostPeerId: "host",
    PeerClass: FakePeer,
    setTimer: peerTimers.setTimer,
    clearTimer: peerTimers.clearTimer,
    onPeerOpenTimeout: () => { peerTimeouts += 1; },
  });
  peerTimers.runAll();
  assert.equal(peerTimeouts, 1);

  const welcomeTimers = controlledTimers();
  const runtimeB = createMultiplayerRuntimeState();
  let welcomeTimeouts = 0;
  createClientPeerRuntime({
    runtime: runtimeB,
    hostPeerId: "host",
    PeerClass: FakePeer,
    setTimer: welcomeTimers.setTimer,
    clearTimer: welcomeTimers.clearTimer,
    isReady: () => false,
    onWelcomeTimeout: () => { welcomeTimeouts += 1; },
  });
  FakePeer.instances.at(-1).emit("open", "guest");
  welcomeTimers.runAll();
  assert.equal(welcomeTimeouts, 1);
});

test("destroying runtime suppresses transport close side effects", () => {
  FakePeer.instances.length = 0;
  const runtime = createMultiplayerRuntimeState();
  let closeNotifications = 0;
  createClientPeerRuntime({
    runtime,
    hostPeerId: "host",
    PeerClass: FakePeer,
    onConnectionClose: () => { closeNotifications += 1; },
  });
  const peer = FakePeer.instances.at(-1);
  peer.emit("open", "guest");
  const conn = peer.connections[0];
  conn.openNow();
  destroyMultiplayerRuntime(runtime);
  assert.equal(closeNotifications, 0);
  assert.equal(peer.destroyed, true);
});
