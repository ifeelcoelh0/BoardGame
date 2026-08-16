import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("endgame keeps the synchronized match chat beside final statistics", () => {
  const experience = readFileSync(new URL("../src/ui/game/endgame/EndgameExperience.jsx", import.meta.url), "utf8");
  const screen = readFileSync(new URL("../src/ui/game/GameScreen.jsx", import.meta.url), "utf8");
  assert.match(experience, /EndgameChat/);
  assert.match(experience, /chat=\{chat\}/);
  assert.match(experience, /sendChat=\{sendChat\}/);
  assert.match(screen, /<EndgameExperience[^>]*chat=\{chat \|\| \[\]\}[^>]*sendChat=\{sendChat\}/s);
});
