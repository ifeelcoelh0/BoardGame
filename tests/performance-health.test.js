import test from "node:test";
import assert from "node:assert/strict";
import { buildPerformanceReport } from "../src/ui/three/performanceHealth.js";

test("performance health compares measured cadence with the configured target", () => {
  const report = buildPerformanceReport({
    board: { averageRenderedFps: 58, targetFps: 60, visibleElapsed: 10, drawCalls: 90, triangles: 120000, textures: 45, geometries: 55, pixelRatio: 1.5, graphicsQuality: "high" },
  }, { hardwareConcurrency: 8 });
  assert.equal(report.status, "good");
  assert.equal(report.probes[0].name, "board");
  assert.ok(report.probes[0].fpsRatio > 0.9);
});

test("performance health flags sustained cadence and GPU pressure without changing runtime behaviour", () => {
  const report = buildPerformanceReport({
    lobby: { averageRenderedFps: 20, targetIdleFps: 30, visibleElapsed: 6, drawCalls: 310, triangles: 900000, textures: 180 },
  });
  assert.equal(report.status, "poor");
  assert.ok(report.probes[0].issues.includes("fps-below-target"));
  assert.ok(report.probes[0].issues.includes("high-draw-calls"));
});
