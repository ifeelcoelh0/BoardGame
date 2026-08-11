import test from "node:test";
import assert from "node:assert/strict";
import { getLobbySelectionInteraction } from "../src/ui/lobby/lobbySelectionInteraction.js";

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
