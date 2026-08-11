import { DISASTER_DEFINITIONS } from "../game/disasterReducer.js";
import { characterById } from "../game/characterCatalog.js";

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
    eyebrow: "O SETE FOI LANÇADO",
    title: event.title || "O Dragão Desperta!",
    text: event.text || "O Dragão reclama a atenção de todos os reinos.",
    details: Array.isArray(event.lines) ? event.lines.slice() : [],
    subject: "Dragão de Fogo",
    playerIndex: Number.isSafeInteger(event.pi) ? event.pi : null,
    playerName: playerName(game, event.pi),
  });
}

export function disasterImportantEventModel(game, event) {
  if (!event?.type) return null;
  const definition = DISASTER_DEFINITIONS[event.type];
  const artKey = DISASTER_ART[event.type];
  if (!definition || !artKey) return null;
  return Object.freeze({
    kind: IMPORTANT_EVENT_KIND.DISASTER,
    tone: `disaster-${event.type}`,
    artKey,
    eyebrow: `PRESSÁGIO DO ${event.num ?? "?"}`,
    title: definition.n,
    text: definition.d,
    details: Array.isArray(event.det) ? event.det.slice() : [],
    subject: "Desastre",
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
  return Object.freeze({
    kind: IMPORTANT_EVENT_KIND.AWARD,
    tone: road ? "award-road" : "award-army",
    artKey: road ? "awardLongestRoad" : "awardLargestArmy",
    eyebrow: stolen ? "O TÍTULO MUDOU DE MÃOS" : "NOVO TÍTULO DO REINO",
    title: road ? "A Estrada Mais Longa" : "O Maior Exército",
    text: stolen
      ? `${currentName} tomou ${road ? "a Estrada Mais Longa" : "o Maior Exército"} a ${previousName}.`
      : road
        ? `${currentName} domina agora os caminhos do reino.`
        : `${currentName} comanda agora as maiores forças do reino.`,
    details: [],
    metric: road ? `${event.value} troços · +2 PV` : `${event.value} tropas · +2 PV`,
    playerIndex: event.pi,
    previousPlayerIndex: Number.isSafeInteger(event.prev) ? event.prev : null,
    playerName: currentName,
    previousPlayerName: previousName,
    signature: currentName,
  });
}
