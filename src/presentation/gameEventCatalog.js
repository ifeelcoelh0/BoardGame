import { characterById } from "../game/characterCatalog.js";
import { t } from "../locales/i18n.js";

export const IMPORTANT_EVENT_KIND = Object.freeze({
  DRAGON: "dragon",
  DISASTER: "disaster",
  AWARD: "award",
});

const DISASTER_ART = Object.freeze({
  ganancia: "disasterGreed",
  peste: "disasterPlague",
  tsunami: "disasterTsunami",
  tributo: "disasterTribute",
});

function playerName(game, playerIndex) {
  if (!Number.isSafeInteger(playerIndex)) return "";
  const player = game?.players?.[playerIndex];
  return characterById(player?.ch)?.n || player?.ch || "";
}

export function storyImportantEventModel(game, event) {
  if (!event || event.kind !== "dragao") return null;
  return Object.freeze({
    kind: IMPORTANT_EVENT_KIND.DRAGON,
    tone: "dragon",
    artKey: "dragonSeven",
    eyebrow: t("event.dragon.eyebrow"),
    title: event.title || t("event.dragon.title"),
    text: event.text || t("event.dragon.text"),
    details: Array.isArray(event.lines) ? event.lines.slice() : [],
    subject: t("event.dragon.subject"),
    playerIndex: Number.isSafeInteger(event.pi) ? event.pi : null,
    playerName: playerName(game, event.pi),
  });
}

export function disasterImportantEventModel(game, event) {
  if (!event?.type || !DISASTER_ART[event.type]) return null;
  const nameKey = `disaster.${event.type}.name`;
  const descriptionKey = `disaster.${event.type}.description`;
  return Object.freeze({
    kind: IMPORTANT_EVENT_KIND.DISASTER,
    tone: `disaster-${event.type}`,
    artKey: DISASTER_ART[event.type],
    eyebrow: t("event.disaster.eyebrow", { number: event.num ?? "?" }),
    title: t(nameKey),
    text: t(descriptionKey),
    details: Array.isArray(event.det) ? event.det.slice() : [],
    subject: t("event.disaster.subject"),
    playerIndex: null,
    playerName: "",
  });
}

export function awardImportantEventModel(game, event) {
  if (!event || !["road", "army"].includes(event.kind) || !Number.isSafeInteger(event.pi)) return null;
  const road = event.kind === "road";
  const previousName = Number.isSafeInteger(event.prev) ? playerName(game, event.prev) : "";
  const currentName = playerName(game, event.pi);
  const stolen = Boolean(previousName);
  const title = t(road ? "event.award.longestRoad" : "event.award.largestArmy");
  return Object.freeze({
    kind: IMPORTANT_EVENT_KIND.AWARD,
    tone: road ? "award-road" : "award-army",
    artKey: road ? "awardLongestRoad" : "awardLargestArmy",
    eyebrow: t(stolen ? "event.award.changedHands" : "event.award.newTitle"),
    title,
    text: stolen
      ? t("event.award.stolen", { current: currentName, title, previous: previousName })
      : t(road ? "event.award.roadHeld" : "event.award.armyHeld", { current: currentName }),
    details: [],
    metric: t(road ? "event.award.roadMetric" : "event.award.armyMetric", { value: event.value }),
    playerIndex: event.pi,
    previousPlayerIndex: Number.isSafeInteger(event.prev) ? event.prev : null,
    playerName: currentName,
    previousPlayerName: previousName,
    signature: currentName,
  });
}
