import test from "node:test";
import assert from "node:assert/strict";
import {
  CODEX_PHASE,
  CODEX_KEY_ACTION,
  codexKeyboardAction,
  codexLeaving,
  codexVisible,
  completeCodexRitual,
  initialCodexPhase,
  syncCodexPhase,
} from "../src/ui/lobby/lobbyCodexFlow.js";

test("the lobby starts in the salon and enters the codex only after the camera ritual", () => {
  let phase = initialCodexPhase();
  assert.equal(phase, CODEX_PHASE.SALON);
  phase = syncCodexPhase(phase, { bookOpen: true });
  assert.equal(phase, CODEX_PHASE.ENTERING);
  assert.equal(codexVisible(phase), false);
  phase = completeCodexRitual(phase, "entered", { bookOpen: true });
  assert.equal(phase, CODEX_PHASE.CODEX);
  assert.equal(codexVisible(phase), true);
});

test("closing fades the codex while the camera returns to the salon", () => {
  let phase = CODEX_PHASE.CODEX;
  phase = syncCodexPhase(phase, { bookOpen: false });
  assert.equal(phase, CODEX_PHASE.LEAVING);
  assert.equal(codexVisible(phase), true);
  assert.equal(codexLeaving(phase), true);
  phase = completeCodexRitual(phase, "left", { bookOpen: false });
  assert.equal(phase, CODEX_PHASE.SALON);
});

test("character selection owns a distinct transition from codex to wall", () => {
  let phase = syncCodexPhase(CODEX_PHASE.CODEX, { bookOpen: false, selectingCharacter: true });
  assert.equal(phase, CODEX_PHASE.CHARACTER_TRANSITION);
  assert.equal(codexLeaving(phase), true);
  phase = completeCodexRitual(phase, "selection", { bookOpen: false });
  assert.equal(phase, CODEX_PHASE.CHARACTER_SELECTION);
  phase = syncCodexPhase(phase, { bookOpen: false, selectingCharacter: false });
  assert.equal(phase, CODEX_PHASE.SALON);
});


test("codex keyboard navigation ignores editing fields and locks out while leaving", () => {
  assert.equal(codexKeyboardAction("ArrowLeft"), CODEX_KEY_ACTION.PREVIOUS);
  assert.equal(codexKeyboardAction("ArrowRight"), CODEX_KEY_ACTION.NEXT);
  assert.equal(codexKeyboardAction("PageUp"), CODEX_KEY_ACTION.PREVIOUS);
  assert.equal(codexKeyboardAction("PageDown"), CODEX_KEY_ACTION.NEXT);
  assert.equal(codexKeyboardAction("Escape"), CODEX_KEY_ACTION.CLOSE);
  assert.equal(codexKeyboardAction("ArrowRight", { editing: true }), null);
  assert.equal(codexKeyboardAction("Escape", { editing: true }), CODEX_KEY_ACTION.CLOSE);
  assert.equal(codexKeyboardAction("Escape", { leaving: true }), null);
});
