import { APP_VERSION } from "../appVersion.js";

export const SAVE_SCHEMA_VERSION = 2;
export const SAVE_STORAGE_KEY = "reinos_dragao_save";
export const SAVE_INDEX_STORAGE_KEY = "reinos_dragao_save_index_v1";
export { APP_VERSION };

export function saveStorageKeyForCode(code) {
  return `reinos_dragao_save_v2:${String(code || "").trim().toUpperCase()}`;
}

export function stampSaveMetadata(game, appVersion = null) {
  return {
    ...game,
    saveSchemaVersion: SAVE_SCHEMA_VERSION,
    appVersion: appVersion || game?.appVersion || APP_VERSION,
  };
}
