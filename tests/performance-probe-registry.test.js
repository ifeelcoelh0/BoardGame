import test from "node:test";
import assert from "node:assert/strict";
import { registerPerformanceProbe } from "../src/ui/three/performanceProbeRegistry.js";

test("performance probes are opt-in and expose snapshots without game state", () => {
  const previousWindow = globalThis.window;
  globalThis.window = { location: { search: "?perf=1" } };
  try {
    const unregister = registerPerformanceProbe("lobby", () => ({ drawCalls: 123, textures: 9 }));
    assert.deepEqual(globalThis.window.__RDD_PERF__.snapshot(), {
      lobby: { drawCalls: 123, textures: 9 },
    });
    unregister();
    assert.equal(globalThis.window.__RDD_PERF__, undefined);
  } finally {
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
  }
});

test("performance probes stay absent without the perf flag", () => {
  const previousWindow = globalThis.window;
  globalThis.window = { location: { search: "" } };
  try {
    const unregister = registerPerformanceProbe("board", () => ({ drawCalls: 10 }));
    assert.equal(globalThis.window.__RDD_PERF__, undefined);
    unregister();
  } finally {
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
  }
});
