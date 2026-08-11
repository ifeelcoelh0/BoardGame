import test from "node:test";
import assert from "node:assert/strict";
import { formatSavedRealmDate, phaseLabel, savedRealmStatus } from "../src/ui/lobby/savedRealmsModel.js";

test("etapas guardadas recebem etiquetas legíveis", () => {
  assert.equal(phaseLabel("lobby"), "No salão");
  assert.equal(phaseLabel("play"), "Em partida");
  assert.equal(phaseLabel("future"), "Estado desconhecido");
});

test("save inválido nunca pode ser retomado", () => {
  assert.deepEqual(savedRealmStatus({ valid: false }), { label: "Save inválido", recoverable: false });
  assert.deepEqual(savedRealmStatus({ valid: true, game: { phase: "setup" } }), { label: "A preparar o reino", recoverable: true });
});

test("datas inválidas têm fallback legível", () => {
  assert.equal(formatSavedRealmDate("not-a-date"), "Data desconhecida");
  assert.match(formatSavedRealmDate("2026-08-06T20:00:00.000Z"), /06/);
});
