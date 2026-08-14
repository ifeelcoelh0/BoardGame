export const DEFAULT_GAME_MODE = "dragao";

export const GAME_MODE_CONFIG = Object.freeze({
  dragao: Object.freeze({
    id: "dragao",
    minPlayers: 3,
    maxPlayers: 4,
    classicRules: false,
    rapidSetup: false,
    war: false,
    exploration: false,
    disasters: true,
  }),
  classico: Object.freeze({
    id: "classico",
    minPlayers: 3,
    maxPlayers: 4,
    classicRules: true,
    rapidSetup: false,
    war: false,
    exploration: false,
    disasters: false,
  }),
  rapido: Object.freeze({
    id: "rapido",
    minPlayers: 3,
    maxPlayers: 4,
    classicRules: false,
    rapidSetup: true,
    war: false,
    exploration: false,
    disasters: true,
  }),
  guerra: Object.freeze({
    id: "guerra",
    minPlayers: 3,
    maxPlayers: 4,
    classicRules: false,
    rapidSetup: false,
    war: true,
    exploration: false,
    disasters: false,
  }),
  exploracao: Object.freeze({
    id: "exploracao",
    minPlayers: 3,
    maxPlayers: 4,
    classicRules: true,
    rapidSetup: false,
    war: false,
    exploration: true,
    disasters: false,
  }),
});

export const GAME_MODE_IDS = Object.freeze(Object.keys(GAME_MODE_CONFIG));

export function isGameMode(mode) {
  return Object.prototype.hasOwnProperty.call(GAME_MODE_CONFIG, mode);
}

export function normalizeGameMode(mode) {
  return isGameMode(mode) ? mode : DEFAULT_GAME_MODE;
}

export function gameModeConfig(mode) {
  return GAME_MODE_CONFIG[normalizeGameMode(mode)];
}

export function isClassicMode(mode) {
  return gameModeConfig(mode).classicRules;
}

export function isRapidMode(mode) {
  return gameModeConfig(mode).rapidSetup;
}

export function isWarMode(mode) {
  return gameModeConfig(mode).war;
}

export function isExplorationMode(mode) {
  return gameModeConfig(mode).exploration;
}

export function usesDisasters(mode) {
  return gameModeConfig(mode).disasters;
}
