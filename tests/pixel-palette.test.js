import test from "node:test";
import assert from "node:assert/strict";
import { remapPixelPalette } from "../src/ui/pixel/pixelPalette.js";

test("pixel palette remapping replaces only declared colours", () => {
  const source = Object.freeze({ r: "#b3372a", k: "#14141c", g: "#ffd23a" });
  const result = remapPixelPalette(source, { "#b3372a": "#3a86b3", "#ffd23a": "#aef3ff" });
  assert.deepEqual(result, { r: "#3a86b3", k: "#14141c", g: "#aef3ff" });
  assert.equal(Object.isFrozen(result), true);
  assert.deepEqual(source, { r: "#b3372a", k: "#14141c", g: "#ffd23a" });
});

test("pixel palette remapping rejects invalid contracts", () => {
  assert.throws(() => remapPixelPalette(null, {}), /paleta pixel/i);
  assert.throws(() => remapPixelPalette({}, null), /mapa de substituição/i);
});
