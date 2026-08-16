import test from "node:test";
import assert from "node:assert/strict";
import { diceRollPresentationKey } from "../src/ui/game/diceRollPresentation.js";

test("dice throw presentation only arms after the current turn has actually rolled", () => {
  const game = { phase: "play", round: 3, turn: { pos: 1, rolled: false, dice: [6, 4] } };
  assert.equal(diceRollPresentationKey(game), null, "previous-turn dice stay visible without replaying the throw");
  game.turn.rolled = true;
  assert.equal(diceRollPresentationKey(game), "3:1:6-4");
});

test("dice throw presentation rejects incomplete or impossible dice", () => {
  assert.equal(diceRollPresentationKey({ phase: "play", turn: { pos: 0, rolled: true, dice: [1] } }), null);
  assert.equal(diceRollPresentationKey({ phase: "play", turn: { pos: 0, rolled: true, dice: [0, 7] } }), null);
  assert.equal(diceRollPresentationKey({ phase: "setup", turn: { pos: 0, rolled: true, dice: [2, 3] } }), null);
});
