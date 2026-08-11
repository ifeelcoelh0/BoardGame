import { ensureGamePlayerIdentities } from "../playerIdentity.js";
import { normalizeGameMode } from "../gameModes.js";
import { createEmptyResources } from "../resources.js";
import { SAVE_SCHEMA_VERSION, stampSaveMetadata } from "../saveSchema.js";
import { migrateLegacyGamePresentation } from "../presentationState.js";

function clone(value) {
  return globalThis.structuredClone ? structuredClone(value) : JSON.parse(JSON.stringify(value));
}

function migrateUnversionedToV1(input) {
  const game = ensureGamePlayerIdentities(clone(input));
  game.mode = normalizeGameMode(game.mode);
  game.phase = ["lobby", "setup", "play", "ended"].includes(game.phase) ? game.phase : "lobby";
  game.v = Number.isSafeInteger(game.v) && game.v >= 1 ? game.v : 1;
  game.players = Array.isArray(game.players) ? game.players : [];
  for (const player of game.players) {
    player.res = { ...createEmptyResources(), ...(player.res || {}) };
    player.devNew = Array.isArray(player.devNew) ? player.devNew : [];
    player.devOld = Array.isArray(player.devOld) ? player.devOld : [];
    player.troops = { cavaleiro: 0, catapulta: 0, arqueiro: 0, ...(player.troops || {}) };
    player.portOff = Array.isArray(player.portOff) ? player.portOff : [];
  }
  game.builds ||= {};
  game.roads ||= {};
  game.units ||= {};
  game.occ ||= {};
  game.wagons ||= {};
  game.queue = Array.isArray(game.queue) ? game.queue : [];
  game.log = Array.isArray(game.log) ? game.log : [];
  game.turn ||= { pos: 0, rolled: false, dice: null };
  if (!Number.isSafeInteger(game.turn.pos) || game.turn.pos < 0 || game.turn.pos >= Math.max(1, game.players.length)) game.turn.pos = 0;
  game.saveSchemaVersion = 1;
  return game;
}

function migrateV1ToV2(input) {
  const game = clone(input);
  migrateLegacyGamePresentation(game);
  game.saveSchemaVersion = 2;
  return game;
}

export function migrateSave(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Formato de save inválido.");
  const version = Number.isSafeInteger(input.saveSchemaVersion) ? input.saveSchemaVersion : 0;
  if (version > SAVE_SCHEMA_VERSION) {
    const error = new Error("Este save foi criado por uma versão mais recente do jogo.");
    error.code = "SAVE_TOO_NEW";
    throw error;
  }
  let current = clone(input);
  let currentVersion = version;
  if (currentVersion === 0) {
    current = migrateUnversionedToV1(current);
    currentVersion = 1;
  }
  if (currentVersion === 1) {
    current = migrateV1ToV2(current);
    currentVersion = 2;
  }
  if (currentVersion === 2) {
    migrateLegacyGamePresentation(current);
  }
  return stampSaveMetadata(current);
}
