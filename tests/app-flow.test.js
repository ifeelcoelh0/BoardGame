import test from "node:test";
import assert from "node:assert/strict";

import {
  APP_FLOW_EVENT,
  APP_STAGE,
  appFlowReducer,
  createInitialAppFlow,
  hasAuthenticatedGameSeat,
  navigateTo,
  shouldRenderAuthenticatedGame,
  stageForAuthenticatedGame
} from "../src/ui/appFlow.js";

test("app flow starts in the foyer stage", () => {
  assert.deepEqual(createInitialAppFlow(), {
    stage: APP_STAGE.TITLE,
    previousStage: null,
    revision: 0
  });
});

test("app flow records deterministic high-level navigation history", () => {
  const initial = createInitialAppFlow();
  const selectingCharacter = appFlowReducer(initial, navigateTo(APP_STAGE.CHARACTER_SELECTION));
  const inLobby = appFlowReducer(selectingCharacter, navigateTo(APP_STAGE.LOBBY));

  assert.deepEqual(selectingCharacter, {
    stage: APP_STAGE.CHARACTER_SELECTION,
    previousStage: APP_STAGE.TITLE,
    revision: 1
  });
  assert.deepEqual(inLobby, {
    stage: APP_STAGE.LOBBY,
    previousStage: APP_STAGE.CHARACTER_SELECTION,
    revision: 2
  });
});

test("app flow ignores invalid and repeated navigation", () => {
  const initial = createInitialAppFlow();
  assert.equal(appFlowReducer(initial, navigateTo("unknown-stage")), initial);
  assert.equal(appFlowReducer(initial, navigateTo(APP_STAGE.TITLE)), initial);
  assert.equal(appFlowReducer(initial, null), initial);
});

test("app flow can reset to a safe stage", () => {
  const inGame = appFlowReducer(createInitialAppFlow(), navigateTo(APP_STAGE.GAME));
  const reset = appFlowReducer(inGame, {
    type: APP_FLOW_EVENT.RESET,
    stage: APP_STAGE.TITLE
  });

  assert.deepEqual(reset, {
    stage: APP_STAGE.TITLE,
    previousStage: null,
    revision: 0
  });
});


test("authenticated lobby players must confirm a character before entering the lobby", () => {
  const game = { phase: "lobby", players: [{ characterConfirmed: false }, { characterConfirmed: true }] };
  assert.equal(stageForAuthenticatedGame(game, 0), APP_STAGE.CHARACTER_SELECTION);
  assert.equal(stageForAuthenticatedGame(game, 1), APP_STAGE.LOBBY);
});

test("authenticated players enter the game stage after the lobby", () => {
  const game = { phase: "setup", players: [{ characterConfirmed: true }] };
  assert.equal(stageForAuthenticatedGame(game, 0), APP_STAGE.GAME);
  assert.equal(stageForAuthenticatedGame(null, 0), null);
});



test("an active match is never rendered before the local session has an authenticated seat", () => {
  const game = { phase: "play", players: [{ playerId: "host" }, { playerId: "guest" }] };
  assert.equal(hasAuthenticatedGameSeat(game, null), false);
  assert.equal(hasAuthenticatedGameSeat(game, -1), false);
  assert.equal(shouldRenderAuthenticatedGame(game, null), false);
  assert.equal(shouldRenderAuthenticatedGame(game, 1), true);
});

test("public active-game snapshots cannot cross the authenticated game-screen gate", () => {
  const publicSnapshot = { phase: "play", players: [{ playerId: "host" }, { playerId: "guest" }] };
  assert.equal(shouldRenderAuthenticatedGame(publicSnapshot, null), false);
  assert.equal(shouldRenderAuthenticatedGame(publicSnapshot, 99), false);
});
