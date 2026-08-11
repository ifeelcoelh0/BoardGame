import test from "node:test";
import assert from "node:assert/strict";
import { createStateSyncController } from "../src/multiplayer/stateSyncController.js";
import { createHostSocialController, createClientSocialController } from "../src/multiplayer/socialEventController.js";

test("state sync resolves the seat from stable identity", () => {
  const events = [];
  const controller = createStateSyncController({
    normalizeGame: (game) => structuredClone(game),
    getPlayerId: () => "p2",
    getSeatId: () => "s2",
    findPlayerIndex: (game, id) => game.players.findIndex((p) => p.playerId === id),
    emit: (event) => events.push(event),
  });
  const result = controller.adopt({ players: [{ playerId: "p1", seatId: "s1" }, { playerId: "p2", seatId: "s2" }] });
  assert.equal(result.ok, true);
  assert.equal(result.seat, 1);
  assert.equal(events[0].type, "STATE_ADOPTED");
});

test("state sync refuses a mismatched seat id", () => {
  const controller = createStateSyncController({
    getPlayerId: () => "p2",
    getSeatId: () => "wrong",
    findPlayerIndex: (game, id) => game.players.findIndex((p) => p.playerId === id),
  });
  assert.equal(controller.adopt({ players: [{ playerId: "p2", seatId: "s2" }] }).seat, null);
});

test("host social controller replaces forged chat identity", () => {
  const emitted = [];
  const relayed = [];
  const game = { players: [{ playerId: "real", ch: "red" }] };
  const controller = createHostSocialController({
    getGame: () => game,
    authenticatedIndexForConnection: () => 0,
    characterName: () => "Dragão Vermelho",
    emit: (event) => emitted.push(event),
    relay: (message) => relayed.push(message),
  });
  assert.equal(controller.onChat({ connection: {}, message: { id: "m1", tx: "olá", playerId: "forged", i: 7 } }), true);
  assert.equal(emitted[0].message.playerId, "real");
  assert.equal(emitted[0].message.i, 0);
  assert.equal(relayed[0].name, "Dragão Vermelho");
});

test("host social controller rejects unauthenticated messages", () => {
  const controller = createHostSocialController({
    getGame: () => ({ players: [] }),
    authenticatedIndexForConnection: () => -1,
  });
  assert.equal(controller.onChat({ connection: {}, message: { id: "m1", tx: "x" } }), false);
  assert.equal(controller.onEmote({ connection: {}, message: { id: "m2", k: "gg" } }), false);
});

test("client social controller deduplicates and bounds seen ids", () => {
  let time = 10000;
  const events = [];
  const controller = createClientSocialController({
    getGame: () => ({ players: [{ playerId: "p1", ch: "red" }] }),
    getPlayerId: () => "p1",
    findPlayerIndex: (game, id) => game.players.findIndex((p) => p.playerId === id),
    now: () => time++,
    maxSeen: 2,
    emit: (event) => events.push(event),
  });
  assert.equal(controller.receiveChat({ id: "a", tx: "1", playerId: "p1" }), true);
  assert.equal(controller.receiveChat({ id: "a", tx: "1", playerId: "p1" }), false);
  controller.receiveChat({ id: "b", tx: "2", playerId: "p1" });
  controller.receiveChat({ id: "c", tx: "3", playerId: "p1" });
  assert.equal(controller.seenCount(), 2);
  assert.equal(events[0].isOwn, true);
});

test("client social send applies rate limits and emits locally", () => {
  let time = 10000;
  const sent = [];
  const events = [];
  let id = 0;
  const controller = createClientSocialController({
    getGame: () => ({ players: [] }),
    getPlayerId: () => "p1",
    findPlayerIndex: () => -1,
    now: () => time,
    createId: () => `id${++id}`,
    send: (message) => sent.push(message),
    emit: (event) => events.push(event),
  });
  assert.equal(controller.sendChat(" olá ", { playerId: "p1" }).ok, true);
  assert.equal(controller.sendChat("outra", { playerId: "p1" }).reason, "RATE_LIMIT");
  time += 801;
  assert.equal(controller.sendChat("outra", { playerId: "p1" }).ok, true);
  assert.equal(sent.length, 2);
  assert.equal(events.length, 2);
});
