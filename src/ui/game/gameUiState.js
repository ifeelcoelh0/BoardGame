export const GAME_UI_FIELDS = Object.freeze([
  "selectedUnit",
  "actionPanelMinimized",
  "interactionMode",
  "showCards",
  "decision",
  "utilityPanel",
  "showLibrary",
  "selectedWagon",
  "zoomCard",
  "perkView",
  "selection",
  "tradeOffer",
]);

const FIELD_SET = new Set(GAME_UI_FIELDS);

export function createInitialGameUiState() {
  return {
    selectedUnit: null,
    actionPanelMinimized: false,
    interactionMode: null,
    showCards: false,
    decision: null,
    utilityPanel: null,
    showLibrary: false,
    selectedWagon: null,
    zoomCard: null,
    perkView: null,
    selection: {},
    tradeOffer: { give: {}, get: {}, to: null },
  };
}

function assertField(field) {
  if (!FIELD_SET.has(field)) throw new TypeError(`Campo de UI desconhecido: ${String(field)}`);
}

export function gameUiReducer(state, action) {
  if (!action || typeof action !== "object") throw new TypeError("Ação de UI inválida.");
  if (action.type === "set") {
    assertField(action.field);
    const current = state[action.field];
    const next = typeof action.value === "function" ? action.value(current) : action.value;
    if (Object.is(current, next)) return state;
    return { ...state, [action.field]: next };
  }
  if (action.type === "open-decision") {
    return { ...state, decision: action.decision ? { ...action.decision } : null };
  }
  if (action.type === "close-decision") {
    if (state.decision == null) return state;
    return { ...state, decision: null };
  }
  if (action.type === "close-transient") {
    return {
      ...state,
      interactionMode: null,
      selectedUnit: null,
      selectedWagon: null,
      decision: null,
      zoomCard: null,
    };
  }
  if (action.type === "reset-turn-interaction") {
    const cleanTradeOffer = { give: {}, get: {}, to: null };
    const alreadyClean = state.interactionMode == null
      && state.selectedUnit == null
      && state.selectedWagon == null
      && state.decision == null
      && Object.keys(state.selection || {}).length === 0
      && Object.keys(state.tradeOffer?.give || {}).length === 0
      && Object.keys(state.tradeOffer?.get || {}).length === 0
      && state.tradeOffer?.to == null;
    if (alreadyClean) return state;
    return {
      ...state,
      interactionMode: null,
      selectedUnit: null,
      selectedWagon: null,
      decision: null,
      actionPanelMinimized: false,
      selection: {},
      tradeOffer: cleanTradeOffer,
    };
  }
  throw new TypeError(`Ação de UI desconhecida: ${String(action.type)}`);
}

export function gameUiSet(field, value) {
  assertField(field);
  return { type: "set", field, value };
}

export function gameUiOpenDecision(decision) {
  if (!decision || typeof decision !== "object" || !decision.type) throw new TypeError("Decisão de UI inválida.");
  return { type: "open-decision", decision };
}

export function gameUiCloseDecision() {
  return { type: "close-decision" };
}
