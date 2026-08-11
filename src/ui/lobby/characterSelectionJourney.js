import { APP_STAGE } from "../appFlow.js";

export const CHARACTER_SELECTION_ENTRY = Object.freeze({
  INITIAL: "initial",
  SWAP: "swap",
});

export function classifyCharacterSelectionEntry(player) {
  if (!player) return null;
  return player.characterConfirmed === true
    ? CHARACTER_SELECTION_ENTRY.SWAP
    : CHARACTER_SELECTION_ENTRY.INITIAL;
}

export function shouldAutoExitCharacterSelection({ stage, entry, player }) {
  return stage === APP_STAGE.CHARACTER_SELECTION
    && entry === CHARACTER_SELECTION_ENTRY.INITIAL
    && player?.characterConfirmed === true;
}
