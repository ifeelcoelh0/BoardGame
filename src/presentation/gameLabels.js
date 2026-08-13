import { getLocale, t } from "../locales/i18n.js";

const WAR_UNIT_KEYS = Object.freeze({
  cavaleiro: "unit.knight",
  catapulta: "unit.catapult",
  arqueiro: "unit.archer",
});

const WAR_UNIT_ICONS = Object.freeze({
  cavaleiro: "⚔️",
  catapulta: "🪨",
  arqueiro: "🏹",
});

export const WAR_UNIT_NAMES = {};
for (const type of Object.keys(WAR_UNIT_KEYS)) {
  Object.defineProperty(WAR_UNIT_NAMES, type, {
    enumerable: true,
    configurable: false,
    get: () => t(WAR_UNIT_KEYS[type]),
  });
}
Object.freeze(WAR_UNIT_NAMES);

export const WAR_UNIT_LABELS = {};
for (const type of Object.keys(WAR_UNIT_KEYS)) {
  Object.defineProperty(WAR_UNIT_LABELS, type, {
    enumerable: true,
    configurable: false,
    get: () => `${WAR_UNIT_ICONS[type]} ${t(WAR_UNIT_KEYS[type])}`,
  });
}
Object.freeze(WAR_UNIT_LABELS);

export function warUnitName(type, fallback = null, locale = getLocale()) {
  const key = WAR_UNIT_KEYS[type];
  return key ? t(key, undefined, locale) : fallback ?? type ?? t("unit.troop", undefined, locale);
}

export function warUnitLabel(type, locale = getLocale()) {
  const icon = WAR_UNIT_ICONS[type] || "";
  const name = warUnitName(type, null, locale);
  return `${icon}${icon ? " " : ""}${name}`;
}

const TERRAIN_KEYS = Object.freeze({
  floresta: "terrain.forest",
  argila: "terrain.clay",
  prados: "terrain.meadows",
  grutas: "terrain.caves",
  montanhas: "terrain.mountains",
  deserto: "terrain.burned",
  gelo: "terrain.ice",
  oculto: "terrain.hidden",
});

export const TERRAIN_LABELS = {};
for (const type of Object.keys(TERRAIN_KEYS)) {
  Object.defineProperty(TERRAIN_LABELS, type, {
    enumerable: true,
    configurable: false,
    get: () => t(TERRAIN_KEYS[type]),
  });
}
Object.freeze(TERRAIN_LABELS);

export function terrainLabel(type, fallback = null, locale = getLocale()) {
  const key = TERRAIN_KEYS[type];
  return key ? t(key, undefined, locale) : fallback ?? type ?? t("terrain.unknown", undefined, locale);
}
