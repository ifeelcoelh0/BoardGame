import { t } from "../locales/i18n.js";

const ICONS = Object.freeze({
  vlad: "🧛",
  bones: "💀",
  artheria: "🏹",
  maria: "🛡️",
  makuru: "🌿",
  muriel: "🔮",
  romeo: "💋",
  protheus: "🐆",
});

export const CHARACTER_PERKS = Object.freeze(Object.fromEntries(
  Object.keys(ICONS).map((id) => [id, Object.freeze({
    i: ICONS[id],
    get n() { return t(`perk.${id}.name`); },
    get d() { return t(`perk.${id}.description`); },
  })]),
));

export function characterPerk(characterId) {
  return CHARACTER_PERKS[characterId] || null;
}
