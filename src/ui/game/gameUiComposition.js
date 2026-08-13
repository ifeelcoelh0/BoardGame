import { t } from "../../locales/i18n.js";

export const ACTION_PRESENTATION = Object.freeze({
  HIDDEN: "hidden",
  ROLL: "roll",
  FULL: "full",
  MINIMIZED: "minimized",
  PLACEMENT: "placement",
});

const MAP_SELECTION_KEYS = Object.freeze({
  estrada: ["placement.road", "placement.roadHint"],
  aldeia: ["placement.village", "placement.villageHint"],
  palacio: ["placement.palace", "placement.palaceHint"],
  suborno: ["placement.bribe", "placement.bribeHint"],
  carruagem: ["placement.wagon", "placement.wagonHint"],
  mover: ["placement.moveWagon", "placement.moveWagonHint"],
  fundar: ["placement.foundVillage", "placement.foundVillageHint"],
});

export function mapSelectionPresentation(mode) {
  const keys = mode ? MAP_SELECTION_KEYS[mode] : null;
  return keys ? Object.freeze({ label: t(keys[0]), hint: t(keys[1]) }) : null;
}

export function deriveActionPresentation({ myTurn, phase, winner, actionModel, interactionMode, minimized = false, forcedBoardChoice = false }) {
  if (!myTurn || phase !== "play" || winner != null || !actionModel) return Object.freeze({ mode: ACTION_PRESENTATION.HIDDEN });
  if (forcedBoardChoice) return Object.freeze({ mode: ACTION_PRESENTATION.HIDDEN });
  const placement = mapSelectionPresentation(interactionMode);
  if (placement) return Object.freeze({ mode: ACTION_PRESENTATION.PLACEMENT, ...placement });
  if (actionModel.phase === "roll") return Object.freeze({ mode: ACTION_PRESENTATION.ROLL });
  if (minimized) return Object.freeze({ mode: ACTION_PRESENTATION.MINIMIZED });
  return Object.freeze({ mode: ACTION_PRESENTATION.FULL });
}
