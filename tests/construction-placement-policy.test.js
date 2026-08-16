import test from "node:test";
import assert from "node:assert/strict";
import { shouldContinueRoadPlacement } from "../src/ui/game/constructionPlacementPolicy.js";

test("normal road construction returns to the construction menu", () => {
  assert.equal(shouldContinueRoadPlacement({ setupMode: false, freeRoadsBefore: 0 }), false);
});

test("the first Road Builder road keeps placement active for the second free road", () => {
  assert.equal(shouldContinueRoadPlacement({ setupMode: false, freeRoadsBefore: 2 }), true);
});

test("the second Road Builder road closes placement after consuming the final free road", () => {
  assert.equal(shouldContinueRoadPlacement({ setupMode: false, freeRoadsBefore: 1 }), false);
});

test("setup road placement remains controlled by the setup sequence", () => {
  assert.equal(shouldContinueRoadPlacement({ setupMode: true, freeRoadsBefore: 0 }), true);
});
