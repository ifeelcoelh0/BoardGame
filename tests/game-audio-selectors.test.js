import test from "node:test";
import assert from "node:assert/strict";
import { localTurnNotificationKey } from "../src/audio/gameAudioSelectors.js";

function game(overrides = {}) {
  return {
    phase: "play",
    round: 3,
    order: [1, 0],
    turn: { pos: 1 },
    players: [{ connected: true }, { connected: true }],
    ...overrides,
  };
}

test("your-turn audio key exists only for the local active connected player", () => {
  assert.equal(localTurnNotificationKey(game(), 0), "3:1:0");
  assert.equal(localTurnNotificationKey(game(), 1), null);
  assert.equal(localTurnNotificationKey(game({ players: [{ connected: false }, { connected: true }] }), 0), null);
  assert.equal(localTurnNotificationKey(game({ phase: "setup" }), 0), null);
});

test("your-turn audio key changes when a new round/turn reaches the player", () => {
  assert.notEqual(
    localTurnNotificationKey(game({ round: 3 }), 0),
    localTurnNotificationKey(game({ round: 4 }), 0),
  );
});
