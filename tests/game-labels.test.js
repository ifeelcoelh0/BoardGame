import test from "node:test";
import assert from "node:assert/strict";
import { setLocale } from "../src/locales/i18n.js";
import { TERRAIN_LABELS, WAR_UNIT_LABELS, WAR_UNIT_NAMES, terrainLabel, warUnitName } from "../src/presentation/gameLabels.js";

test("war and terrain labels follow the active locale without changing domain ids", () => {
  setLocale("en", { persist: false });
  assert.deepEqual({ ...WAR_UNIT_NAMES }, { cavaleiro: "Knight", catapulta: "Catapult", arqueiro: "Archer" });
  assert.equal(WAR_UNIT_LABELS.cavaleiro, "⚔️ Knight");
  assert.equal(warUnitName("arqueiro"), "Archer");
  assert.equal(TERRAIN_LABELS.floresta, "Shadow Forest");
  assert.equal(terrainLabel("gelo"), "Eternal Glacier");

  assert.equal(warUnitName("arqueiro", null, "pt-PT"), "Arqueiro");
  assert.equal(terrainLabel("floresta", null, "pt-PT"), "Floresta Sombria");
  assert.equal(warUnitName("desconhecido"), "desconhecido");
});
