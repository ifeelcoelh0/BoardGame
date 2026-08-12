import test from "node:test";
import assert from "node:assert/strict";
import { getLobbySelectionInteraction } from "../src/ui/lobby/lobbySelectionInteraction.js";
import {
  SELECTION_GUIDE_STEPS,
  SIGNATURE_CANCEL_HIT_AREA,
  SIGNATURE_CONFIRM_HIT_AREA,
} from "../src/ui/lobby/lobbySelectionAffordance.js";

test("character portraits are interactive only before the signature scroll opens", () => {
  assert.deepEqual(
    getLobbySelectionInteraction({ selectionEnabled: true, scrollOpen: false }),
    {
      signatureLocked: false,
      portraitsInteractive: true,
      scrollTargetsInteractive: false,
      canCancelSignature: false,
      canConfirmSignature: false,
    },
  );
});

test("opening the signature scroll locks the character wall immediately", () => {
  const opening = getLobbySelectionInteraction({
    selectionEnabled: true,
    scrollOpen: true,
    scrollReady: false,
  });
  assert.equal(opening.signatureLocked, true);
  assert.equal(opening.portraitsInteractive, false);
  assert.equal(opening.scrollTargetsInteractive, false);

  const ready = getLobbySelectionInteraction({
    selectionEnabled: true,
    scrollOpen: true,
    scrollReady: true,
  });
  assert.equal(ready.portraitsInteractive, false);
  assert.equal(ready.scrollTargetsInteractive, true);
  assert.equal(ready.canConfirmSignature, true);
  assert.equal(ready.canCancelSignature, true);
});

test("signing keeps the wall locked and disables cancellation/duplicate confirmation", () => {
  const state = getLobbySelectionInteraction({
    selectionEnabled: true,
    scrollOpen: true,
    scrollReady: true,
    scrollSigning: true,
  });
  assert.equal(state.portraitsInteractive, false);
  assert.equal(state.canCancelSignature, false);
  assert.equal(state.canConfirmSignature, false);
});


test("the parchment itself is the easy confirmation target and close stays as a small corner affordance", () => {
  const confirmArea = SIGNATURE_CONFIRM_HIT_AREA.width * SIGNATURE_CONFIRM_HIT_AREA.height;
  const cancelArea = SIGNATURE_CANCEL_HIT_AREA.width * SIGNATURE_CANCEL_HIT_AREA.height;
  assert.ok(confirmArea >= cancelArea * 80);
  assert.ok(SIGNATURE_CANCEL_HIT_AREA.x > 0, "fechar deve viver do lado direito");
  assert.ok(SIGNATURE_CANCEL_HIT_AREA.y > 0.9, "fechar deve ficar perto do topo do pergaminho");
});

test("the character wall teaches the three existing gestures without adding a new flow", () => {
  assert.deepEqual(SELECTION_GUIDE_STEPS.map((step) => step.id), ["portrait", "scroll", "signature"]);
  assert.deepEqual(SELECTION_GUIDE_STEPS.map((step) => step.label), ["ESCOLHE", "ABRE", "ASSINA"]);
});
