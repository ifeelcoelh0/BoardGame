import { t } from "../locales/i18n.js";

const CARD_META = Object.freeze({
  cavaleiro: Object.freeze({ family: "troop" }),
  catapulta: Object.freeze({ family: "troop" }),
  arqueiro: Object.freeze({ family: "troop" }),
  inteligencia: Object.freeze({ family: "victory" }),
  conhecimento: Object.freeze({ family: "victory" }),
  fe: Object.freeze({ family: "victory" }),
  sorte: Object.freeze({ family: "victory" }),
  astucia: Object.freeze({ family: "victory" }),
  marcha: Object.freeze({ family: "war" }),
  espiao: Object.freeze({ family: "war" }),
  monopolio: Object.freeze({ family: "rare" }),
  descoberta: Object.freeze({ family: "utility" }),
  estradas: Object.freeze({ family: "utility" }),
});

function normalizeCardKey(card) {
  const kind = String(card?.kind || "").toLowerCase();
  const sub = String(card?.sub || "").toLowerCase();
  if (kind === "tropa") return sub || "cavaleiro";
  if (kind === "vp") {
    if (sub.includes("intelig")) return "inteligencia";
    if (sub.includes("conhec")) return "conhecimento";
    if (sub.includes("fé") || sub.includes("fe")) return "fe";
    if (sub.includes("sorte")) return "sorte";
    if (sub.includes("astúcia") || sub.includes("astucia")) return "astucia";
  }
  if (kind === "marcha") return "marcha";
  if (kind === "espiao" || kind === "espião") return "espiao";
  if (kind === "monopolio" || kind === "monopólio") return "monopolio";
  if (kind === "descoberta") return "descoberta";
  if (kind === "estradas") return "estradas";
  return kind || sub || "unknown";
}

export function developmentCardPresentation(card) {
  const key = normalizeCardKey(card);
  const meta = CARD_META[key];
  if (!meta) {
    return {
      title: t("cards.unknown.title"),
      family: "unknown",
      description: t("cards.unknown.description"),
    };
  }
  return {
    title: t(`cards.${key}.title`),
    family: meta.family,
    description: meta.family === "victory" ? t("cards.vp.description") : t(`cards.${key}.description`),
  };
}
