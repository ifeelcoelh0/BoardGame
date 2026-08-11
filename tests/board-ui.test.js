import test from "node:test";
import assert from "node:assert/strict";
import { stableSpotKey } from "../src/ui/board/boardUpdateSignature.js";
import { boardCharacterVisual, shadeColor, TERRAIN_VISUALS } from "../src/ui/board/boardVisualConfig.js";

test("stableSpotKey is order independent and does not mutate the input", () => {
  const spots = new Set(["h3", "h1", "h2"]);
  assert.equal(stableSpotKey(spots), "h1|h2|h3");
  assert.deepEqual([...spots], ["h3", "h1", "h2"]);
});

test("hidden terrain has a distinct visual sentinel", () => {
  assert.ok(TERRAIN_VISUALS.oculto);
  assert.equal(TERRAIN_VISUALS.oculto.res, null);
  assert.notEqual(TERRAIN_VISUALS.oculto.n, TERRAIN_VISUALS.deserto.n);
});

test("board character visuals and shade fallback remain deterministic", () => {
  assert.equal(boardCharacterVisual("vlad").pc, "#5b6bff");
  assert.equal(boardCharacterVisual("unknown").pc, "#d8d8d8");
  assert.equal(shadeColor("#808080", -16), "#707070");
});
