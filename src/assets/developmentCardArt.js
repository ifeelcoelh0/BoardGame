const CARD_ASSET_ROOT = "assets/cards/development";

const TROOP_ART = Object.freeze({
  vlad: Object.freeze({
    cavaleiro: "vlad-cavaleiro.png",
    arqueiro: "vlad-arqueiro.png",
    catapulta: "vlad-catapulta.png",
  }),
  maria: Object.freeze({
    cavaleiro: "maria-cavaleiro.png",
    arqueiro: "maria-arqueiro.png",
    catapulta: "maria-catapulta.png",
  }),
  protheus: Object.freeze({
    cavaleiro: "protheus-cavaleiro.png",
    arqueiro: "protheus-arqueiro.png",
    catapulta: "protheus-catapulta.png",
  }),
  romeo: Object.freeze({
    cavaleiro: "romeo-cavaleiro.png",
    arqueiro: "romeo-arqueiro.png",
    catapulta: "romeo-catapulta.png",
  }),
  makuru: Object.freeze({
    cavaleiro: "makuru-cavaleiro.png",
    arqueiro: "makuru-arqueiro.png",
    catapulta: "makuru-catapulta.png",
  }),
  artheria: Object.freeze({
    cavaleiro: "artheria-cavaleiro.png",
    arqueiro: "artheria-arqueiro.png",
    catapulta: "artheria-catapulta.png",
  }),
  muriel: Object.freeze({
    cavaleiro: "muriel-cavaleiro.png",
    arqueiro: "muriel-arqueiro.png",
    catapulta: "muriel-catapulta.png",
  }),
  bones: Object.freeze({
    cavaleiro: "bones-cavaleiro.png",
    arqueiro: "bones-arqueiro.png",
    catapulta: "bones-catapulta.png",
  }),
});

const CARD_ART = Object.freeze({
  monopolio: "monopolio.png",
  descoberta: "descoberta.png",
  estradas: "estradas.png",
  "vp:inteligencia": "vp-inteligencia.png",
  "vp:conhecimento": "vp-conhecimento.png",
  "vp:fe": "vp-fe.png",
  "vp:sorte": "vp-sorte.png",
  "vp:astucia": "vp-astucia.png",
});

export const DEVELOPMENT_CARD_ART_STATUS = Object.freeze({
  READY: "ready",
  MISSING: "missing",
});

export const DEVELOPMENT_CARD_MISSING_ART = Object.freeze([
  Object.freeze({ kind: "marcha", label: "Marcha Forçada" }),
  Object.freeze({ kind: "espiao", label: "Espião" }),
]);

function baseUrl() {
  return import.meta.env?.BASE_URL || "/";
}

function assetUrl(filename, base = baseUrl()) {
  const prefix = String(base || "/").endsWith("/") ? String(base || "/") : `${base}/`;
  return `${prefix}${CARD_ASSET_ROOT}/${filename}`;
}

export function developmentCardArtKey(card) {
  if (!card || typeof card !== "object") return null;
  if (card.kind === "tropa") return `tropa:${String(card.sub || "")}`;
  if (card.kind !== "vp") return String(card.kind || "");
  const sub = String(card.sub || "").toLocaleLowerCase("pt-PT");
  if (sub.includes("intelig")) return "vp:inteligencia";
  if (sub.includes("conhecimento")) return "vp:conhecimento";
  if (sub.includes("fé") || sub.includes("fe")) return "vp:fe";
  if (sub.includes("sorte")) return "vp:sorte";
  if (sub.includes("astúcia") || sub.includes("astucia")) return "vp:astucia";
  return null;
}

export function developmentCardArt(card, characterId, { base = baseUrl() } = {}) {
  if (!card || typeof card !== "object") {
    return Object.freeze({ status: DEVELOPMENT_CARD_ART_STATUS.MISSING, key: null, url: null });
  }
  if (card.kind === "tropa") {
    const filename = TROOP_ART[characterId]?.[card.sub] || null;
    return Object.freeze({
      status: filename ? DEVELOPMENT_CARD_ART_STATUS.READY : DEVELOPMENT_CARD_ART_STATUS.MISSING,
      key: `tropa:${String(card.sub || "")}`,
      url: filename ? assetUrl(filename, base) : null,
    });
  }
  const key = developmentCardArtKey(card);
  const filename = key ? CARD_ART[key] : null;
  return Object.freeze({
    status: filename ? DEVELOPMENT_CARD_ART_STATUS.READY : DEVELOPMENT_CARD_ART_STATUS.MISSING,
    key,
    url: filename ? assetUrl(filename, base) : null,
  });
}

export const DEVELOPMENT_TROOP_ART = TROOP_ART;
export const DEVELOPMENT_CARD_STATIC_ART = CARD_ART;
