import test from "node:test";
import assert from "node:assert/strict";
import { WAR_UNIT_LABELS, WAR_UNIT_NAMES, warUnitName } from "../src/presentation/gameLabels.js";

test("war unit names and labels share one canonical vocabulary", () => {
  assert.deepEqual(WAR_UNIT_NAMES, { cavaleiro: "Cavaleiro", catapulta: "Catapulta", arqueiro: "Arqueiro" });
  assert.equal(WAR_UNIT_LABELS.cavaleiro, "⚔️ Cavaleiro");
  assert.equal(WAR_UNIT_LABELS.catapulta, "🪨 Catapulta");
  assert.equal(WAR_UNIT_LABELS.arqueiro, "🏹 Arqueiro");
  assert.equal(warUnitName("arqueiro"), "Arqueiro");
  assert.equal(warUnitName("desconhecido"), "desconhecido");
});
