import test from "node:test";
import assert from "node:assert/strict";
import {
  getAcceptedActionResult,
  rememberAcceptedActionResult,
} from "../src/multiplayer/actionResultCache.js";

test("only accepted compact action results are cached", () => {
  const cache = new Map();
  const accepted = {
    t: "game-action-result",
    gameProtocolVersion: 7,
    actionId: "game_1",
    actionType: "ROLL_DICE",
    ok: true,
    revision: 12,
    g: { huge: "snapshot" },
  };
  assert.equal(rememberAcceptedActionResult(cache, "p:1", accepted, { now: 100, ttlMs: 1000 }), true);
  const cached = getAcceptedActionResult(cache, "p:1", { now: 200 });
  assert.equal(cached.ok, true);
  assert.equal(cached.revision, 12);
  assert.equal("g" in cached, false);

  assert.equal(rememberAcceptedActionResult(cache, "p:2", { ok: false, reason: "STALE_STATE", g: { huge: true } }), false);
  assert.equal(cache.has("p:2"), false);
});

test("accepted results survive invalid-action floods and expire by time", () => {
  const cache = new Map();
  rememberAcceptedActionResult(cache, "honest:action", { ok: true, actionId: "action", revision: 2 }, { now: 0, ttlMs: 10_000 });
  for (let index = 0; index < 5000; index += 1) {
    rememberAcceptedActionResult(cache, `attacker:${index}`, { ok: false, reason: "INVALID_ACTION" }, { now: index });
  }
  assert.equal(getAcceptedActionResult(cache, "honest:action", { now: 8_000 })?.revision, 2);
  assert.equal(getAcceptedActionResult(cache, "honest:action", { now: 10_001 }), null);
});
