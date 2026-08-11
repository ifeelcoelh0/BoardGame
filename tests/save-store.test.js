import test from "node:test";
import assert from "node:assert/strict";
import { createInitialGame } from "../src/game/gameFactory.js";
import { assertGameInvariants, validateGameInvariants } from "../src/game/gameInvariants.js";
import { migrateSave } from "../src/game/migrations/migrateSave.js";
import { loadGameFromStorage, parseGameSave, saveGameToStorage } from "../src/game/saveStore.js";
import { SAVE_SCHEMA_VERSION } from "../src/game/saveSchema.js";

function ids(prefix) { let i = 0; return () => `${prefix}_${String(i++).padStart(24, "0")}`; }
function game() {
  return createInitialGame({ code: "ABCD", hostCharacterId: "vlad", idFactory: ids("player"), rng: () => 0.2 });
}
function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return { getItem: (k) => values.get(k) ?? null, setItem: (k,v) => values.set(k,String(v)), removeItem: (k) => values.delete(k), values };
}

test("save store accepts both current six-letter rooms and legacy four-letter rooms", () => {
  const storage = memoryStorage();
  const current = game();
  current.code = "ABCDEF";
  assert.equal(saveGameToStorage(current, storage).ok, true);
  assert.equal(loadGameFromStorage(storage, { code: "ABCDEF" }).game.code, "ABCDEF");

  const legacy = game();
  legacy.code = "ABCD";
  assert.equal(saveGameToStorage(legacy, storage).ok, true);
  assert.equal(loadGameFromStorage(storage, { code: "ABCD" }).game.code, "ABCD");
});

test("save atual recebe schema e passa invariantes", () => {
  const storage = memoryStorage();
  assert.equal(saveGameToStorage(game(), storage, { appVersion: "test" }).ok, true);
  const loaded = loadGameFromStorage(storage);
  assert.equal(loaded.ok, true);
  assert.equal(loaded.game.saveSchemaVersion, SAVE_SCHEMA_VERSION);
  assert.equal(loaded.game.appVersion, "test");
  assert.doesNotThrow(() => assertGameInvariants(loaded.game));
});

test("save antigo sem versão é migrado", () => {
  const old = game();
  delete old.saveSchemaVersion;
  delete old.players[0].connected;
  old.players[0].res = { madeira: 2 };
  delete old.presentation;
  old.log = [{ id: 10, msg: "Crónica antiga", pi: 0 }];
  old.ev = { id: 11, kind: "dados", pi: 0, title: "Antigo", text: "Evento" };
  old.cardEv = { id: 12, pi: 0, card: { id: "legacy-card" } };
  old.awardEv = { id: 13, kind: "road", pi: 0, prev: null, value: 5 };
  old.disaster = { id: 14, type: "peste", num: 2, det: [] };

  const migrated = migrateSave(old);

  assert.equal(migrated.saveSchemaVersion, SAVE_SCHEMA_VERSION);
  assert.equal(migrated.players[0].res.madeira, 2);
  assert.equal(migrated.players[0].res.ouro, 0);
  assert.equal(migrated.players[0].connected, true);
  assert.equal(migrated.presentation.log[0].msg, "Crónica antiga");
  assert.equal(migrated.presentation.story.id, 11);
  assert.equal(migrated.presentation.cardReveal.card.id, "legacy-card");
  assert.equal(migrated.presentation.award.kind, "road");
  assert.equal(migrated.presentation.disaster.type, "peste");
  for (const legacyField of ["log", "ev", "cardEv", "awardEv", "disaster"])
    assert.equal(legacyField in migrated, false);
});

test("save futuro é recusado", () => {
  const future = { ...game(), saveSchemaVersion: SAVE_SCHEMA_VERSION + 1 };
  const result = parseGameSave(JSON.stringify(future));
  assert.equal(result.ok, false);
  assert.equal(result.reason, "SAVE_TOO_NEW");
});

test("recursos negativos invalidam o save", () => {
  const corrupted = game();
  corrupted.players[0].res.madeira = -1;
  const result = validateGameInvariants(corrupted);
  assert.equal(result.ok, false);
  assert.equal(result.error.code, "INVALID_RESOURCE_COUNT");
});

test("presentation state corrompido é recusado antes de retomar o reino", () => {
  const corrupted = game();
  corrupted.presentation.version = 999;
  const result = validateGameInvariants(corrupted);
  assert.equal(result.ok, false);
  assert.equal(result.error.code, "INVALID_PRESENTATION_VERSION");
});

test("identidades e lugares duplicados são recusados", () => {
  const corrupted = game();
  corrupted.players.push(structuredClone(corrupted.players[0]));
  assert.throws(() => assertGameInvariants(corrupted), /mesma identidade/);
});

test("turno para jogador inexistente é recusado", () => {
  const corrupted = game();
  corrupted.turn.pos = 9;
  const result = parseGameSave(JSON.stringify(corrupted));
  assert.equal(result.ok, false);
  assert.equal(result.reason, "INVALID_TURN_PLAYER");
});

test("JSON corrompido não derruba o carregamento", () => {
  const result = parseGameSave("{não é json");
  assert.equal(result.ok, false);
  assert.equal(result.reason, "INVALID_SAVE");
});

test("índice guarda vários reinos e carrega o mais recente", async () => {
  const storage = memoryStorage();
  const first = game();
  first.code = "ABCD";
  const second = game();
  second.code = "WXYZ";
  assert.equal(saveGameToStorage(first, storage, { updatedAt: "2026-01-01T00:00:00.000Z" }).ok, true);
  assert.equal(saveGameToStorage(second, storage, { updatedAt: "2026-02-01T00:00:00.000Z" }).ok, true);
  const { listGameSaves } = await import("../src/game/saveStore.js");
  assert.deepEqual(listGameSaves(storage).map((entry) => entry.code), ["WXYZ", "ABCD"]);
  assert.equal(loadGameFromStorage(storage).game.code, "WXYZ");
  assert.equal(loadGameFromStorage(storage, { code: "ABCD" }).game.code, "ABCD");
});

test("save legado é indexado automaticamente ao carregar", async () => {
  const legacy = game();
  const storage = memoryStorage({ reinos_dragao_save: JSON.stringify(legacy) });
  const loaded = loadGameFromStorage(storage);
  assert.equal(loaded.ok, true);
  const { listGameSaves } = await import("../src/game/saveStore.js");
  assert.equal(listGameSaves(storage)[0].code, "ABCD");
});

test("save corrompido não elimina outros reinos do índice", async () => {
  const storage = memoryStorage();
  const valid = game();
  saveGameToStorage(valid, storage, { updatedAt: "2026-01-01T00:00:00.000Z" });
  storage.setItem("reinos_dragao_save_v2:WXYZ", "{corrompido");
  storage.setItem("reinos_dragao_save_index_v1", JSON.stringify({ version: 1, entries: [
    { code: "WXYZ", saveKey: "reinos_dragao_save_v2:WXYZ", updatedAt: "2026-02-01T00:00:00.000Z" },
    { code: "ABCD", saveKey: "reinos_dragao_save_v2:ABCD", updatedAt: "2026-01-01T00:00:00.000Z" }
  ] }));
  assert.equal(loadGameFromStorage(storage, { code: "WXYZ" }).ok, false);
  assert.equal(loadGameFromStorage(storage, { code: "ABCD" }).ok, true);
});

test("inspeção do índice distingue reinos válidos e corrompidos", async () => {
  const storage = memoryStorage();
  const valid = game();
  saveGameToStorage(valid, storage, { updatedAt: "2026-01-01T00:00:00.000Z" });
  storage.setItem("reinos_dragao_save_v2:WXYZ", "{corrompido");
  storage.setItem("reinos_dragao_save_index_v1", JSON.stringify({ version: 1, entries: [
    { code: "WXYZ", saveKey: "reinos_dragao_save_v2:WXYZ", updatedAt: "2026-02-01T00:00:00.000Z" },
    { code: "ABCD", saveKey: "reinos_dragao_save_v2:ABCD", updatedAt: "2026-01-01T00:00:00.000Z" }
  ] }));
  const { inspectGameSaves } = await import("../src/game/saveStore.js");
  const inspected = inspectGameSaves(storage);
  assert.equal(inspected[0].code, "WXYZ");
  assert.equal(inspected[0].valid, false);
  assert.equal(inspected[1].code, "ABCD");
  assert.equal(inspected[1].valid, true);
});
