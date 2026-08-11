import test from "node:test";
import assert from "node:assert/strict";
import {
  createInitialGameUiState,
  gameUiCloseDecision,
  gameUiOpenDecision,
  gameUiReducer,
  gameUiSet,
} from "../src/ui/game/gameUiState.js";

test("game UI state has one canonical transient state shape", () => {
  const state = createInitialGameUiState();
  assert.equal("muted" in state, false);
  assert.equal(state.interactionMode, null);
  assert.equal(state.showCards, false);
  assert.equal(state.decision, null);
  assert.deepEqual(state.tradeOffer, { give: {}, get: {}, to: null });
  assert.equal("showBank" in state, false);
  assert.equal("showTrade" in state, false);
  assert.equal("resourcePicker" in state, false);
  assert.equal("showChat" in state, false);
  assert.equal("showEmotes" in state, false);
  assert.equal("endMinimized" in state, false);
});

test("game UI setter supports values and functional transitions", () => {
  let state = createInitialGameUiState();
  state = gameUiReducer(state, gameUiSet("showCards", true));
  assert.equal(state.showCards, true);
  state = gameUiReducer(state, gameUiSet("showCards", (value) => !value));
  assert.equal(state.showCards, false);
  assert.throws(() => gameUiSet("unknown", true), /desconhecido/i);
});

test("local decisions use one exclusive state slot", () => {
  let state = createInitialGameUiState();
  state = gameUiReducer(state, gameUiOpenDecision({ type: "bank" }));
  assert.deepEqual(state.decision, { type: "bank" });
  state = gameUiReducer(state, gameUiOpenDecision({ type: "monopolio", cardId: 7 }));
  assert.deepEqual(state.decision, { type: "monopolio", cardId: 7 });
  state = gameUiReducer(state, gameUiCloseDecision());
  assert.equal(state.decision, null);
  assert.throws(() => gameUiOpenDecision(null), /inválida/i);
});

test("turn interaction reset clears turn-scoped state without closing persistent panels", () => {
  let state = createInitialGameUiState();
  state = gameUiReducer(state, gameUiSet("interactionMode", "estrada"));
  state = gameUiReducer(state, gameUiSet("selectedUnit", "0,0"));
  state = gameUiReducer(state, gameUiSet("selectedWagon", "wagon-1"));
  state = gameUiReducer(state, gameUiOpenDecision({ type: "bank" }));
  state = gameUiReducer(state, gameUiSet("selection", { madeira: 2 }));
  state = gameUiReducer(state, gameUiSet("tradeOffer", { give: { ouro: 1 }, get: { madeira: 1 }, to: 1 }));
  state = gameUiReducer(state, gameUiSet("utilityPanel", "resources"));
  state = gameUiReducer(state, { type: "reset-turn-interaction" });
  assert.equal(state.interactionMode, null);
  assert.equal(state.selectedUnit, null);
  assert.equal(state.selectedWagon, null);
  assert.equal(state.decision, null);
  assert.deepEqual(state.selection, {});
  assert.deepEqual(state.tradeOffer, { give: {}, get: {}, to: null });
  assert.equal(state.utilityPanel, "resources");
});

test("closing transient interaction also closes local decision state", () => {
  let state = createInitialGameUiState();
  state = gameUiReducer(state, gameUiOpenDecision({ type: "trade-proposal" }));
  state = gameUiReducer(state, { type: "close-transient" });
  assert.equal(state.decision, null);
});
