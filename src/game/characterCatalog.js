import { getLocale, t } from "../locales/i18n.js";

const CHARACTER_DATA = [
  { id: "vlad", pc: "#5b6bff", n: "Vlad Drácula", c: "#2b2b52", ac: "#b9b9d4", em: "🦇" },
  { id: "maria", pc: "#ffd60a", n: "Princesa Maria", c: "#e0b23a", ac: "#6b4d05", em: "👑" },
  { id: "protheus", pc: "#ff3b30", n: "Rei Protheus", c: "#a8232b", ac: "#f0c9c9", em: "🍖" },
  { id: "romeo", pc: "#ff8a00", n: "Menino Romeo", c: "#a35c1a", ac: "#153a1c", em: "🌿" },
  { id: "makuru", pc: "#7cff2b", n: "Goblin Makuru", c: "#5a9e3a", ac: "#1e3a12", em: "🥷" },
  { id: "artheria", pc: "#00e5a0", n: "Elfa Artheria", c: "#2f7d4a", ac: "#e8d98a", em: "🏹" },
  { id: "muriel", pc: "#e63dff", n: "Feiticeira Muriel", c: "#7b3fc4", ac: "#ffd76b", em: "🔮" },
  { id: "bones", pc: "#e8f4ff", n: "Esqueleto Bones", c: "#d8e2f0", ac: "#2a3040", em: "💀" },
];

export const CHARACTERS = Object.freeze(CHARACTER_DATA.map((character) => Object.freeze({
  ...character,
  get t() { return t(`character.${character.id}.title`); },
  get q() {
    return Object.freeze([0, 1, 2].map((index) => t(`character.${character.id}.q${index}`)));
  },
})));

const CHARACTER_BY_ID = new Map(CHARACTERS.map((character) => [character.id, character]));

export function characterById(id) {
  return CHARACTER_BY_ID.get(id) || null;
}

export function characterName(id) {
  return characterById(id)?.n || String(id || "");
}

export function characterTitle(id, locale = getLocale()) {
  return characterById(id) ? t(`character.${id}.title`, undefined, locale) : "";
}

export function characterQuotes(id, locale = getLocale()) {
  if (!characterById(id)) return Object.freeze([]);
  return Object.freeze([0, 1, 2].map((index) => t(`character.${id}.q${index}`, undefined, locale)));
}

export function characterQuote(id, index = 0, locale = getLocale()) {
  const quotes = characterQuotes(id, locale);
  if (!quotes.length) return "";
  const normalized = Math.abs(Number(index) || 0) % quotes.length;
  return quotes[normalized];
}
