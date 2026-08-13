import { getLocale, t } from "../locales/i18n.js";

export const RESOURCE_DEFINITIONS = Object.freeze({
  madeira: Object.freeze({ get n() { return t("resources.madeira"); }, i: "🪵", c: "#7a5a35" }),
  tijolo: Object.freeze({ get n() { return t("resources.tijolo"); }, i: "🧱", c: "#a4572f" }),
  cavalos: Object.freeze({ get n() { return t("resources.cavalos"); }, i: "🐎", c: "#2fbf95" }),
  ouro: Object.freeze({ get n() { return t("resources.ouro"); }, i: "🪙", c: "#e8c020" }),
  obsidiana: Object.freeze({ get n() { return t("resources.obsidiana"); }, i: "⚫", c: "#8244d6" }),
});

export const RESOURCE_KEYS = Object.freeze(Object.keys(RESOURCE_DEFINITIONS));

export function resourceName(resource, locale = getLocale()) {
  return isResourceKey(resource) ? t(`resources.${resource}`, undefined, locale) : String(resource || "");
}

export const BUILD_COSTS = Object.freeze({
  estrada: Object.freeze({ madeira: 1, tijolo: 1 }),
  aldeia: Object.freeze({ madeira: 1, tijolo: 1, cavalos: 1, ouro: 1 }),
  palacio: Object.freeze({ obsidiana: 3, ouro: 2 }),
  carta: Object.freeze({ cavalos: 1, ouro: 1, obsidiana: 1 }),
});

export const PIECE_LIMITS = Object.freeze({
  estrada: 15,
  aldeia: 5,
  palacio: 4,
});

export function isResourceKey(resource) {
  return Object.prototype.hasOwnProperty.call(RESOURCE_DEFINITIONS, resource);
}

export function createEmptyResources() {
  return Object.fromEntries(RESOURCE_KEYS.map((resource) => [resource, 0]));
}

export function handSize(player) {
  if (Number.isSafeInteger(player?.resourceCount)) return player.resourceCount;
  return RESOURCE_KEYS.reduce((total, resource) => total + (player?.res?.[resource] || 0), 0);
}

export function canPay(player, cost) {
  if (!player?.res || !cost || typeof cost !== "object") return false;
  return Object.entries(cost).every(([resource, amount]) => (
    isResourceKey(resource)
    && Number.isSafeInteger(amount)
    && amount >= 0
    && (player.res[resource] || 0) >= amount
  ));
}

export function payCost(player, cost) {
  for (const [resource, amount] of Object.entries(cost)) {
    player.res[resource] -= amount;
  }
  return player;
}
