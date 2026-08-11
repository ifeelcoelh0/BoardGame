import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_GRAPHICS_QUALITY,
  getGraphicsQualityProfile,
  normalizeGraphicsQuality,
  resolveGraphicsQualityProfile,
  scaledAmbientCount,
} from "../src/ui/three/graphicsQualityProfiles.js";

test("graphics profiles keep current visual quality as the default", () => {
  const high = getGraphicsQualityProfile();
  assert.equal(DEFAULT_GRAPHICS_QUALITY, "high");
  assert.equal(high.id, "high");
  assert.equal(high.renderer.lobbyPixelRatioCap, 1.65);
  assert.equal(high.renderer.boardPixelRatioCap, 2);
  assert.equal(high.lobby.idleFps, 30);
  assert.equal(high.board.fps, 60);
});

test("graphics profiles expose meaningful lower-cost knobs", () => {
  const high = getGraphicsQualityProfile("high");
  const medium = getGraphicsQualityProfile("medium");
  const low = getGraphicsQualityProfile("low");
  assert.ok(low.renderer.boardPixelRatioCap < medium.renderer.boardPixelRatioCap);
  assert.ok(medium.renderer.boardPixelRatioCap < high.renderer.boardPixelRatioCap);
  assert.ok(low.lobby.shadowHz < high.lobby.shadowHz);
  assert.ok(low.board.waterNormalEvery > high.board.waterNormalEvery);
  assert.equal(scaledAmbientCount(26, low, 10), 13);
  assert.equal(scaledAmbientCount(26, high, 10), 26);
});

test("invalid quality falls back to high and dev query can select a profile", () => {
  assert.equal(normalizeGraphicsQuality("potato"), "high");
  assert.equal(resolveGraphicsQualityProfile(null, "?gfx=medium").id, "medium");
  assert.equal(resolveGraphicsQualityProfile("low", "?gfx=high").id, "low");
});
