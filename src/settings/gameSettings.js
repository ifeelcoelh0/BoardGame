import { DEFAULT_GRAPHICS_QUALITY, normalizeGraphicsQuality } from "../ui/three/graphicsQualityProfiles.js";

export const GAME_SETTINGS_STORAGE_KEY = "reinos_dragao_settings_v1";

export const DEFAULT_GAME_SETTINGS = Object.freeze({
  muted: false,
  musicVolume: 1,
  effectsVolume: 1,
  voicesVolume: 1,
  graphicsQuality: DEFAULT_GRAPHICS_QUALITY,
  reducedMotion: false,
  uiScale: 1,
});

function clamp01(value, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(0, Math.min(1, number));
}

function clampScale(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return DEFAULT_GAME_SETTINGS.uiScale;
  return Math.max(0.85, Math.min(1.2, Math.round(number * 20) / 20));
}

export function normalizeGameSettings(value = null) {
  const source = value && typeof value === "object" ? value : {};
  return {
    muted: source.muted === true,
    musicVolume: clamp01(source.musicVolume, DEFAULT_GAME_SETTINGS.musicVolume),
    effectsVolume: clamp01(source.effectsVolume, DEFAULT_GAME_SETTINGS.effectsVolume),
    voicesVolume: clamp01(source.voicesVolume, DEFAULT_GAME_SETTINGS.voicesVolume),
    graphicsQuality: normalizeGraphicsQuality(source.graphicsQuality),
    reducedMotion: source.reducedMotion === true,
    uiScale: clampScale(source.uiScale),
  };
}

export function loadGameSettings(storage = globalThis.localStorage) {
  try {
    const raw = storage?.getItem?.(GAME_SETTINGS_STORAGE_KEY);
    if (!raw) return normalizeGameSettings(DEFAULT_GAME_SETTINGS);
    return normalizeGameSettings(JSON.parse(raw));
  } catch {
    return normalizeGameSettings(DEFAULT_GAME_SETTINGS);
  }
}

export function saveGameSettings(settings, storage = globalThis.localStorage) {
  const normalized = normalizeGameSettings(settings);
  try {
    storage?.setItem?.(GAME_SETTINGS_STORAGE_KEY, JSON.stringify(normalized));
    return true;
  } catch {
    return false;
  }
}

export function updateGameSetting(settings, key, value) {
  if (!Object.hasOwn(DEFAULT_GAME_SETTINGS, key)) return normalizeGameSettings(settings);
  return normalizeGameSettings({ ...settings, [key]: value });
}
