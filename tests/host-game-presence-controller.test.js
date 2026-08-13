import test from "node:test";
import assert from "node:assert/strict";
import { createHostGamePresenceController } from "../src/multiplayer/hostGamePresenceController.js";
import { beginGameTurnReconnectWindow, markPlayerDisconnected } from "../src/game/playerPresence.js";
import { IDS, TOKEN_HASHES, makePlayer } from "./fixtures.js";
import { nextBotActorIndex } from "../src/multiplayer/hostBotController.js";

function makeGame() {
  const guest = makePlayer({
    playerId: IDS.guest1,
    seatId: IDS.seat1,
    ch: "rhaegal",
    sessionTokenHash: TOKEN_HASHES.guest1,
    connected: true,
  });
  return {
    code: "ABCD",
    phase: "play",
    winner: null,
    order: [0, 1],
    turn: { pos: 1 },
    players: [makePlayer(), guest],
  };
}

function makeHarness(initial = makeGame(), clock = { now: 1_000 }) {
  let game = structuredClone(initial);
  const logs = [];
  const scheduled = [];
  const cleared = [];
  const controller = createHostGamePresenceController({
    getGame: () => game,
    commit: async (next) => { game = structuredClone(next); return game; },
    enqueueAuthorityTask: async (task) => task(),
    clone: structuredClone,
    addLog: (_state, message, playerIndex) => logs.push({ message, playerIndex }),
    characterName: (id) => id,
    isHost: () => true,
    now: () => clock.now,
    setTimeoutFn: (fn, delay) => { const token = { fn, delay }; scheduled.push(token); return token; },
    clearTimeoutFn: (token) => cleared.push(token),
  });
  return { controller, logs, scheduled, cleared, getGame: () => game, clock };
}

test("disconnected active human becomes a bot only after the reconnect deadline", async () => {
  const game = makeGame();
  markPlayerDisconnected(game.players[1], { now: 1_000, phase: "play" });
  beginGameTurnReconnectWindow(game.players[1], { now: 1_000, graceMs: 90_000 });
  const harness = makeHarness(game);

  assert.equal(await harness.controller.activateBotAfterReconnectTimeout(IDS.guest1, 91_000), false);
  assert.equal(harness.getGame().players[1].controller, "human");

  harness.clock.now = 91_000;
  assert.equal(await harness.controller.activateBotAfterReconnectTimeout(IDS.guest1, 91_000), true);
  assert.equal(harness.getGame().players[1].controller, "bot");
  assert.equal(harness.getGame().players[1].connected, true);
  assert.equal(harness.getGame().players[1].turnReconnectDeadline, null);
  assert.equal(nextBotActorIndex(harness.getGame()), 1);
  assert.match(harness.logs[0].message, /bot assumiu/i);
});

test("presence controller schedules only the disconnected seat that must act", () => {
  const game = makeGame();
  markPlayerDisconnected(game.players[1], { now: 1_000, phase: "play" });
  beginGameTurnReconnectWindow(game.players[1], { now: 1_000, graceMs: 90_000 });
  const harness = makeHarness(game);

  harness.controller.sync(game);
  assert.equal(harness.controller.timerCount(), 1);
  assert.equal(harness.scheduled.length, 1);
  assert.equal(harness.scheduled[0].delay, 90_025);

  const next = structuredClone(game);
  next.turn.pos = 0;
  harness.controller.sync(next);
  assert.equal(harness.controller.timerCount(), 0);
  assert.equal(harness.cleared.length, 1);
});
