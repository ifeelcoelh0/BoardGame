export const WAR_UNIT_NAMES = Object.freeze({
  cavaleiro: "Cavaleiro",
  catapulta: "Catapulta",
  arqueiro: "Arqueiro",
});

export const WAR_UNIT_LABELS = Object.freeze({
  cavaleiro: `⚔️ ${WAR_UNIT_NAMES.cavaleiro}`,
  catapulta: `🪨 ${WAR_UNIT_NAMES.catapulta}`,
  arqueiro: `🏹 ${WAR_UNIT_NAMES.arqueiro}`,
});

export function warUnitName(type, fallback = null) {
  return WAR_UNIT_NAMES[type] ?? fallback ?? type ?? "Tropa";
}

export const TERRAIN_LABELS = Object.freeze({
  floresta: "Floresta Sombria",
  argila: "Poços de Argila",
  prados: "Prados Selvagens",
  grutas: "Grutas Douradas",
  montanhas: "Montanhas de Obsidiana",
  deserto: "Terras Ardidas",
  gelo: "Geleira Eterna",
  oculto: "Território Oculto",
});

export function terrainLabel(type, fallback = null) {
  return TERRAIN_LABELS[type] ?? fallback ?? type ?? "terreno desconhecido";
}
