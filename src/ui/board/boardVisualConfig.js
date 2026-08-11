import { HIDDEN_TERRAIN_TYPE } from "../../game/gameStateView.js";
import { TERRAIN_RESOURCE_BY_TYPE } from "../../game/constructionReducer.js";
import { TERRAIN_LABELS } from "../../presentation/gameLabels.js";

export const TERRAIN_VISUALS = {
  floresta: { res: TERRAIN_RESOURCE_BY_TYPE.floresta, n: TERRAIN_LABELS.floresta, f: ["#2f7a34", "#0a2410"], i: "🌲" },
  argila: { res: TERRAIN_RESOURCE_BY_TYPE.argila, n: TERRAIN_LABELS.argila, f: ["#e0662c", "#6e2210"], i: "🧱" },
  prados: { res: TERRAIN_RESOURCE_BY_TYPE.prados, n: TERRAIN_LABELS.prados, f: ["#2fbf95", "#0c4636"], i: "🐎" },
  grutas: { res: TERRAIN_RESOURCE_BY_TYPE.grutas, n: TERRAIN_LABELS.grutas, f: ["#e8c020", "#4a3402"], i: "✨" },
  montanhas: { res: TERRAIN_RESOURCE_BY_TYPE.montanhas, n: TERRAIN_LABELS.montanhas, f: ["#8244d6", "#1a0630"], i: "🌋" },
  deserto: { res: TERRAIN_RESOURCE_BY_TYPE.deserto, n: TERRAIN_LABELS.deserto, f: ["#9a9084", "#38332d"], i: "💀" },
  gelo: { res: TERRAIN_RESOURCE_BY_TYPE.gelo, n: TERRAIN_LABELS.gelo, f: ["#bfe6f2", "#1c4a5e"], i: "❄️" },
  [HIDDEN_TERRAIN_TYPE]: { res: null, n: TERRAIN_LABELS.oculto, f: ["#252934", "#090b10"], i: "❔" },
};

export const CHARACTER_PRIMARY_COLORS = {
  vlad: "#5b6bff",
  maria: "#ffd60a",
  protheus: "#ff3b30",
  romeo: "#ff8a00",
  makuru: "#7cff2b",
  artheria: "#00e5a0",
  muriel: "#e63dff",
  bones: "#e8f4ff",
};

export const CHARACTER_GLOW_COLORS = { ...CHARACTER_PRIMARY_COLORS };

export const NUMBER_PIPS = { 2: 1, 3: 2, 4: 3, 5: 4, 6: 5, 8: 5, 9: 4, 10: 3, 11: 2, 12: 1 };

export function boardCharacterVisual(id) {
  return { id, pc: CHARACTER_PRIMARY_COLORS[id] || "#d8d8d8" };
}

export function shadeColor(hex, amount) {
  const n = Number.parseInt(String(hex).slice(1), 16);
  const clamp = (value) => Math.max(0, Math.min(255, value));
  const r = clamp((n >> 16) + amount);
  const g = clamp(((n >> 8) & 255) + amount);
  const b = clamp((n & 255) + amount);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}
