import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_GAME_SETTINGS,
  GAME_SETTINGS_STORAGE_KEY,
  loadGameSettings,
  normalizeGameSettings,
  saveGameSettings,
  updateGameSetting,
} from "../src/settings/gameSettings.js";

function memoryStorage(seed = {}) {
  const data = new Map(Object.entries(seed));
  return {
    getItem: (key) => data.has(key) ? data.get(key) : null,
    setItem: (key, value) => data.set(key, String(value)),
    snapshot: () => Object.fromEntries(data),
  };
}

test("settings normalize quality, volumes and UI scale", () => {
  const value = normalizeGameSettings({ musicVolume: 2, effectsVolume: -1, voicesVolume: 0.42, graphicsQuality: "medium", uiScale: 3, fullscreenOnPlay: false, reducedMotion: true, muted: true });
  assert.equal(value.musicVolume, 1);
  assert.equal(value.effectsVolume, 0);
  assert.equal(value.voicesVolume, 0.42);
  assert.equal(value.graphicsQuality, "medium");
  assert.equal(value.uiScale, 1.2);
  assert.equal(Object.hasOwn(value, "fullscreenOnPlay"), false, "legacy auto-fullscreen preference is discarded");
  assert.equal(value.reducedMotion, true);
  assert.equal(value.muted, true);
});

test("settings persist in one canonical localStorage document", () => {
  const storage = memoryStorage();
  const next = updateGameSetting(DEFAULT_GAME_SETTINGS, "graphicsQuality", "low");
  assert.equal(saveGameSettings(next, storage), true);
  assert.equal(loadGameSettings(storage).graphicsQuality, "low");
  assert.ok(storage.snapshot()[GAME_SETTINGS_STORAGE_KEY]);
});

test("invalid persisted settings fall back safely", () => {
  const storage = memoryStorage({ [GAME_SETTINGS_STORAGE_KEY]: "not json" });
  assert.deepEqual(loadGameSettings(storage), normalizeGameSettings(DEFAULT_GAME_SETTINGS));
});
