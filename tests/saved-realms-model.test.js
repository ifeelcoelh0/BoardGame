import test from "node:test";
import assert from "node:assert/strict";
import { formatSavedRealmDate, phaseLabel, savedRealmStatus, savedRealmSummary } from "../src/ui/lobby/savedRealmsModel.js";

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

test("arquivos recebem uma ficha editorial sem expor o schema à página", () => {
  const summary = savedRealmSummary({
    code: "ABCDEF",
    valid: true,
    updatedAt: "2026-08-06T20:00:00.000Z",
    appVersion: "0.99.34",
    game: {
      phase: "play",
      mode: "guerra",
      round: 7,
      players: [{}, {}, {}],
    },
  });
  assert.equal(summary.code, "ABCDEF");
  assert.equal(summary.statusLabel, "Em partida");
  assert.equal(summary.modeLabel, "Guerra dos Reinos");
  assert.equal(summary.playerCount, 3);
  assert.equal(summary.round, 7);
  assert.equal(summary.appVersion, "0.99.34");
  assert.equal(summary.recoverable, true);
  assert.equal(summary.concluded, false);
});

test("partidas terminadas são contadas como concluídas", () => {
  const summary = savedRealmSummary({ valid: true, phase: "ended", game: { phase: "ended", mode: "dragao", players: [] } });
  assert.equal(summary.concluded, true);
  assert.equal(summary.statusLabel, "Partida terminada");
});
