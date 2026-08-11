const EVENT_ASSET_ROOT = "assets/events";

export const GAME_EVENT_ART = Object.freeze({
  dragonSeven: "dragao-sete.png",
  disasterGreed: "desastre-ganancia.png",
  disasterPlague: "desastre-peste.png",
  disasterTsunami: "desastre-tsunami.png",
  disasterTribute: "desastre-tributo.png",
  awardLargestArmy: "premio-maior-exercito.png",
  awardLongestRoad: "premio-estrada-mais-longa.png",
});

export function gameEventArtUrl(key, { base = import.meta.env?.BASE_URL || "/" } = {}) {
  const filename = GAME_EVENT_ART[key];
  if (!filename) return null;
  const prefix = String(base || "/").endsWith("/") ? String(base || "/") : `${base}/`;
  return `${prefix}${EVENT_ASSET_ROOT}/${filename}`;
}
