import test from "node:test";
import assert from "node:assert/strict";
import { createGameActionDispatchGate } from "../src/ui/game/gameActionDispatchGate.js";

test("game action gate keeps at most one authoritative mutation in flight", async () => {
  let release;
  const calls = [];
  const gate = createGameActionDispatchGate((type) => {
    calls.push(type);
    return new Promise((resolve) => { release = resolve; });
  });

  const first = gate.dispatch("FIRST");
  await Promise.resolve();
  assert.equal(gate.isPending(), true);
  assert.equal(await gate.dispatch("SECOND"), false);
  assert.deepEqual(calls, ["FIRST"]);

  release({ ok: true });
  assert.deepEqual(await first, { ok: true });
  assert.equal(gate.isPending(), false);
});

test("game action gate unlocks after rejection or thrown dispatch", async () => {
  let attempt = 0;
  const gate = createGameActionDispatchGate(async () => {
    attempt += 1;
    if (attempt === 1) throw new Error("network");
    return true;
  });
  await assert.rejects(() => gate.dispatch("FIRST"), /network/);
  assert.equal(gate.isPending(), false);
  assert.equal(await gate.dispatch("SECOND"), true);
});
