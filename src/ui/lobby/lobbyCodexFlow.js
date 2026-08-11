export const CODEX_PHASE = Object.freeze({
  SALON: "salon",
  ENTERING: "book-entering",
  CODEX: "codex",
  LEAVING: "book-leaving",
  CHARACTER_TRANSITION: "character-transition",
  CHARACTER_SELECTION: "character-selection",
});

export function initialCodexPhase({ bookOpen = false, selectingCharacter = false } = {}) {
  if (selectingCharacter) return CODEX_PHASE.CHARACTER_SELECTION;
  return bookOpen ? CODEX_PHASE.CODEX : CODEX_PHASE.SALON;
}

/** Synchronises animation phase with application-owned book/selection state. */
export function syncCodexPhase(phase, { bookOpen = false, selectingCharacter = false } = {}) {
  if (selectingCharacter) {
    return phase === CODEX_PHASE.CHARACTER_SELECTION ? phase : CODEX_PHASE.CHARACTER_TRANSITION;
  }
  if (bookOpen && (phase === CODEX_PHASE.SALON || phase === CODEX_PHASE.LEAVING)) return CODEX_PHASE.ENTERING;
  if (!bookOpen && phase === CODEX_PHASE.CODEX) return CODEX_PHASE.LEAVING;
  if (!bookOpen && (phase === CODEX_PHASE.CHARACTER_SELECTION || phase === CODEX_PHASE.CHARACTER_TRANSITION)) return CODEX_PHASE.SALON;
  return phase;
}

export function completeCodexRitual(phase, event, { bookOpen = false } = {}) {
  if (event === "entered" && phase === CODEX_PHASE.ENTERING && bookOpen) return CODEX_PHASE.CODEX;
  if (event === "left" && phase === CODEX_PHASE.LEAVING && !bookOpen) return CODEX_PHASE.SALON;
  if (event === "selection" && phase === CODEX_PHASE.CHARACTER_TRANSITION) return CODEX_PHASE.CHARACTER_SELECTION;
  return phase;
}

export function codexVisible(phase) {
  return phase === CODEX_PHASE.CODEX
    || phase === CODEX_PHASE.LEAVING
    || phase === CODEX_PHASE.CHARACTER_TRANSITION;
}

export function codexLeaving(phase) {
  return phase === CODEX_PHASE.LEAVING || phase === CODEX_PHASE.CHARACTER_TRANSITION;
}

export const CODEX_KEY_ACTION = Object.freeze({
  CLOSE: "close",
  PREVIOUS: "previous",
  NEXT: "next",
});

/** Keyboard intent is pure so navigation never depends on DOM timing. */
export function codexKeyboardAction(key, { editing = false, leaving = false } = {}) {
  if (leaving) return null;
  if (key === "Escape") return CODEX_KEY_ACTION.CLOSE;
  if (editing) return null;
  if (key === "ArrowLeft" || key === "PageUp") return CODEX_KEY_ACTION.PREVIOUS;
  if (key === "ArrowRight" || key === "PageDown") return CODEX_KEY_ACTION.NEXT;
  return null;
}
