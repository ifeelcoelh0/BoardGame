import test from "node:test";
import assert from "node:assert/strict";
import { ACTION_PRESENTATION, deriveActionPresentation, mapSelectionPresentation } from "../src/ui/game/gameUiComposition.js";
import { stableBoardGeometryKey } from "../src/ui/board/boardUpdateSignature.js";
import { CHARACTER_SELECTION_ENTRY, classifyCharacterSelectionEntry, shouldAutoExitCharacterSelection } from "../src/ui/lobby/characterSelectionJourney.js";
import { APP_STAGE } from "../src/ui/appFlow.js";

const actionModel = Object.freeze({ phase: "actions" });

test("action presentation exposes only the UI needed for the current board interaction", () => {
  assert.equal(deriveActionPresentation({ myTurn: false, phase: "play", actionModel }).mode, ACTION_PRESENTATION.HIDDEN);
  assert.equal(deriveActionPresentation({ myTurn: true, phase: "play", actionModel: { phase: "roll" } }).mode, ACTION_PRESENTATION.ROLL);
  assert.equal(deriveActionPresentation({ myTurn: true, phase: "play", actionModel }).mode, ACTION_PRESENTATION.FULL);
  assert.equal(deriveActionPresentation({ myTurn: true, phase: "play", actionModel, minimized: true }).mode, ACTION_PRESENTATION.MINIMIZED);
  const placement = deriveActionPresentation({ myTurn: true, phase: "play", actionModel, interactionMode: "aldeia" });
  assert.equal(placement.mode, ACTION_PRESENTATION.PLACEMENT);
  assert.match(placement.label, /Aldeia/);
  assert.equal(mapSelectionPresentation("unknown"), null);
});

test("board geometry identity ignores ordinary state revisions but changes with actual terrain geometry", () => {
  const board = {
    hexes: [
      { k: "0,0", terr: "floresta", num: 8, hid: false },
      { k: "1,0", terr: "oculto", num: null, hid: true },
    ],
    ports: [{ e: "a|b", type: "madeira", hid: false }],
  };
  const clone = structuredClone(board);
  clone.hexes.reverse();
  clone.ports = clone.ports.map((port) => ({ ...port }));
  assert.equal(stableBoardGeometryKey(board), stableBoardGeometryKey(clone));

  const revealed = structuredClone(board);
  revealed.hexes[1] = { ...revealed.hexes[1], terr: "ouro", num: 5, hid: false };
  assert.notEqual(stableBoardGeometryKey(board), stableBoardGeometryKey(revealed));
});

test("initial character selection exits automatically after confirmation while a deliberate house swap stays explicit", () => {
  assert.equal(classifyCharacterSelectionEntry({ characterConfirmed: false }), CHARACTER_SELECTION_ENTRY.INITIAL);
  assert.equal(classifyCharacterSelectionEntry({ characterConfirmed: true }), CHARACTER_SELECTION_ENTRY.SWAP);
  assert.equal(shouldAutoExitCharacterSelection({
    stage: APP_STAGE.CHARACTER_SELECTION,
    entry: CHARACTER_SELECTION_ENTRY.INITIAL,
    player: { characterConfirmed: true },
  }), true);
  assert.equal(shouldAutoExitCharacterSelection({
    stage: APP_STAGE.CHARACTER_SELECTION,
    entry: CHARACTER_SELECTION_ENTRY.SWAP,
    player: { characterConfirmed: true },
  }), false);
});
