import test from "node:test";
import assert from "node:assert/strict";
import { buildPerformanceReport } from "../src/ui/three/performanceHealth.js";
import { LOBBY_STARTUP, lobbyStartupPixelRatio, lobbyTargetFps } from "../src/ui/lobby/lobbySceneStartup.js";

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


test("lobby first-load warm-up caps pixel ratio and frame cadence before restoring selected quality", () => {
  assert.equal(lobbyStartupPixelRatio(2.5, 1.65), LOBBY_STARTUP.pixelRatioCap);
  assert.equal(lobbyStartupPixelRatio(0.8, 1.65), 0.8);
  const graphics = { lobby: { idleFps: 30, activeFps: 60, codexFps: 12 } };
  assert.equal(lobbyTargetFps({ startupComplete: false, codexActive: false, cameraMoving: false, scrollAnimating: false, graphics }), 20);
  assert.equal(lobbyTargetFps({ startupComplete: true, codexActive: false, cameraMoving: true, scrollAnimating: false, graphics }), 60);
  assert.equal(lobbyTargetFps({ startupComplete: true, codexActive: true, cameraMoving: false, scrollAnimating: false, graphics }), 12);
});
