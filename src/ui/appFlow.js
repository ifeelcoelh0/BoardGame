export const APP_STAGE = Object.freeze({
  TITLE: "title",
  JOINING_ROOM: "joining",
  RECONNECTING: "reconnecting",
  SESSION_REQUIRED: "session-required",
  CHARACTER_SELECTION: "character-selection",
  LOBBY: "lobby",
  GAME: "game"
});

const VALID_STAGES = new Set(Object.values(APP_STAGE));

export const APP_FLOW_EVENT = Object.freeze({
  NAVIGATE: "app-flow/navigate",
  RESET: "app-flow/reset"
});

export function createInitialAppFlow(stage = APP_STAGE.TITLE) {
  return {
    stage: VALID_STAGES.has(stage) ? stage : APP_STAGE.TITLE,
    previousStage: null,
    revision: 0
  };
}

export function appFlowReducer(state, event) {
  const current = state || createInitialAppFlow();

  if (!event || typeof event !== "object") return current;

  if (event.type === APP_FLOW_EVENT.RESET) {
    return createInitialAppFlow(event.stage);
  }

  if (event.type !== APP_FLOW_EVENT.NAVIGATE || !VALID_STAGES.has(event.stage)) {
    return current;
  }

  if (event.stage === current.stage) return current;

  return {
    stage: event.stage,
    previousStage: current.stage,
    revision: current.revision + 1
  };
}

export function navigateTo(stage) {
  return { type: APP_FLOW_EVENT.NAVIGATE, stage };
}

export function stageForAuthenticatedGame(game, seat) {
  if (!game || !Number.isInteger(seat) || !Array.isArray(game.players)) return null;
  if (game.phase !== "lobby") return APP_STAGE.GAME;
  return game.players[seat]?.characterConfirmed === true
    ? APP_STAGE.LOBBY
    : APP_STAGE.CHARACTER_SELECTION;
}
