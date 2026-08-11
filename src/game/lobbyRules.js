import { GAME_MODE_CONFIG, gameModeConfig } from "./gameModes.js";

export const MODE_MIN_PLAYERS = Object.freeze(Object.fromEntries(
  Object.entries(GAME_MODE_CONFIG).map(([mode, config]) => [mode, config.minPlayers]),
));

export const MODE_MAX_PLAYERS = Object.freeze(Object.fromEntries(
  Object.entries(GAME_MODE_CONFIG).map(([mode, config]) => [mode, config.maxPlayers]),
));

export const TEST_REALM_MIN_PLAYERS = 2;

export function getLobbyRequiredPlayers(game) {
  if (game?.test === true) return TEST_REALM_MIN_PLAYERS;
  return gameModeConfig(game?.mode).minPlayers;
}

export function getLobbyStartStatus(game, seat) {
  if (!game || game.phase !== "lobby") return { allowed: false, reason: "NOT_IN_LOBBY" };
  if (seat !== 0) return { allowed: false, reason: "NOT_HOST" };
  if (game.lobbyStarting) return { allowed: false, reason: "ALREADY_STARTING" };

  const players = Array.isArray(game.players) ? game.players : [];
  const requiredPlayers = getLobbyRequiredPlayers(game);

  if (players.length < requiredPlayers) {
    return {
      allowed: false,
      reason: "NOT_ENOUGH_PLAYERS",
      currentPlayers: players.length,
      requiredPlayers,
    };
  }

  if (!players.every((player) => player?.connected !== false)) {
    return { allowed: false, reason: "PLAYERS_DISCONNECTED" };
  }

  if (!players.every((player) => player?.characterConfirmed === true)) {
    return { allowed: false, reason: "CHARACTERS_NOT_CONFIRMED" };
  }

  if (!players.every((player) => player?.ready === true)) {
    return { allowed: false, reason: "PLAYERS_NOT_READY" };
  }

  return { allowed: true, reason: null };
}

export function canStartLobby(game, seat) {
  return getLobbyStartStatus(game, seat).allowed;
}
