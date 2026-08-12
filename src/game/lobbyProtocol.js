import { getLobbyStartStatus } from "./lobbyRules.js";
import { gameModeConfig } from "./gameModes.js";
import { activateBotController, PLAYER_CONTROLLER } from "./playerPresence.js";
import { findPlayerIndexById } from "./playerIdentity.js";

export const LOBBY_PROTOCOL_VERSION = 3;

export const LOBBY_ACTION = Object.freeze({
  SELECT_CHARACTER: "SELECT_CHARACTER",
  SET_READY: "SET_READY",
  SET_PERKS: "SET_PERKS",
  BEGIN_START: "BEGIN_START",
  KICK_PLAYER: "KICK_PLAYER",
  ADD_BOT: "ADD_BOT",
});

const ACTION_ID_PATTERN = /^action_[a-f0-9]{24}$/;
const CHARACTER_ID_PATTERN = /^[a-z0-9_-]{1,40}$/;
const PLAYER_ID_PATTERN = /^player_[a-f0-9]{24}$/;

export function validateLobbyActionEnvelope(message) {
  if (!message || typeof message !== "object")
    return { ok: false, reason: "INVALID_REQUEST" };
  if (message.t !== "lobby-action")
    return { ok: false, reason: "INVALID_REQUEST" };
  try {
    if (JSON.stringify(message).length > 2048)
      return { ok: false, reason: "REQUEST_TOO_LARGE" };
  } catch {
    return { ok: false, reason: "INVALID_REQUEST" };
  }
  if (message.lobbyProtocolVersion !== LOBBY_PROTOCOL_VERSION)
    return { ok: false, reason: "PROTOCOL_MISMATCH" };
  if (!ACTION_ID_PATTERN.test(message.actionId || ""))
    return { ok: false, reason: "INVALID_ACTION_ID" };
  if (!Number.isSafeInteger(message.expectedRevision) || message.expectedRevision < 0)
    return { ok: false, reason: "INVALID_REVISION" };
  if (!message.action || typeof message.action !== "object")
    return { ok: false, reason: "INVALID_ACTION" };
  if (!Object.values(LOBBY_ACTION).includes(message.action.type))
    return { ok: false, reason: "UNKNOWN_ACTION" };
  return { ok: true, reason: null };
}

export function applyLobbyAction(game, actorId, action, options = {}) {
  if (!game || game.phase !== "lobby" || !Array.isArray(game.players))
    return { ok: false, reason: "NOT_IN_LOBBY" };

  const actorIndex = findPlayerIndexById(game, actorId);
  if (actorIndex < 0)
    return { ok: false, reason: "UNAUTHENTICATED" };
  if (game.lobbyStarting && action.type !== LOBBY_ACTION.KICK_PLAYER)
    return { ok: false, reason: "ALREADY_STARTING" };

  const next = structuredClone(game);
  const player = next.players[actorIndex];

  switch (action.type) {
    case LOBBY_ACTION.SELECT_CHARACTER: {
      const characterId = action.characterId;
      const validCharacterIds = options.validCharacterIds instanceof Set
        ? options.validCharacterIds
        : new Set(options.validCharacterIds || []);
      if (!CHARACTER_ID_PATTERN.test(characterId || "") || !validCharacterIds.has(characterId))
        return { ok: false, reason: "INVALID_CHARACTER" };
      if (next.players.some((candidate, index) => index !== actorIndex && candidate.ch === characterId))
        return { ok: false, reason: "CHARACTER_UNAVAILABLE" };

      const oldCharacterId = player.ch;
      const wasConfirmed = player.characterConfirmed === true;
      const wasReady = player.ready === true;
      if (oldCharacterId === characterId && wasConfirmed && !wasReady)
        return { ok: true, game: next, actorIndex, noChange: true, event: null };
      player.ch = characterId;
      player.characterConfirmed = true;
      player.ready = false;
      return {
        ok: true,
        game: next,
        actorIndex,
        event: { type: "CHARACTER_SELECTED", oldCharacterId, characterId, wasConfirmed, wasReady },
      };
    }

    case LOBBY_ACTION.SET_READY: {
      if (player.connected === false)
        return { ok: false, reason: "PLAYER_DISCONNECTED" };
      if (typeof action.ready !== "boolean")
        return { ok: false, reason: "INVALID_READY_VALUE" };
      if (action.ready && player.characterConfirmed !== true)
        return { ok: false, reason: "CHARACTER_NOT_CONFIRMED" };
      if (player.ready === action.ready)
        return { ok: true, game: next, actorIndex, noChange: true, event: null };
      player.ready = action.ready;
      return {
        ok: true,
        game: next,
        actorIndex,
        event: { type: "READY_CHANGED", ready: action.ready },
      };
    }

    case LOBBY_ACTION.SET_PERKS: {
      if (actorIndex !== 0)
        return { ok: false, reason: "NOT_HOST" };
      if (typeof action.enabled !== "boolean")
        return { ok: false, reason: "INVALID_PERKS_VALUE" };
      if ((next.perksOn !== false) === action.enabled)
        return { ok: true, game: next, actorIndex, noChange: true, event: null };
      next.perksOn = action.enabled;
      next.players.forEach((candidate) => { candidate.ready = candidate.controller === PLAYER_CONTROLLER.BOT; });
      return {
        ok: true,
        game: next,
        actorIndex,
        event: { type: "PERKS_CHANGED", enabled: action.enabled },
      };
    }

    case LOBBY_ACTION.ADD_BOT: {
      if (actorIndex !== 0)
        return { ok: false, reason: "NOT_HOST" };
      if (next.players.length >= gameModeConfig(next.mode).maxPlayers)
        return { ok: false, reason: "LOBBY_FULL" };
      const characterId = action.characterId;
      const validCharacterIds = options.validCharacterIds instanceof Set
        ? options.validCharacterIds
        : new Set(options.validCharacterIds || []);
      if (!CHARACTER_ID_PATTERN.test(characterId || "") || !validCharacterIds.has(characterId))
        return { ok: false, reason: "INVALID_CHARACTER" };
      if (next.players.some((candidate) => candidate.ch === characterId))
        return { ok: false, reason: "CHARACTER_UNAVAILABLE" };
      if (typeof options.createPlayer !== "function")
        return { ok: false, reason: "BOT_UNAVAILABLE" };
      const bot = options.createPlayer(characterId, {
        characterConfirmed: true,
        connected: true,
      });
      activateBotController(bot, { now: Number.isFinite(options.now) ? options.now : Date.now() });
      bot.ready = true;
      next.players.push(bot);
      next.players.forEach((candidate) => {
        candidate.ready = candidate.controller === PLAYER_CONTROLLER.BOT;
      });
      return {
        ok: true,
        game: next,
        actorIndex,
        event: { type: "BOT_ADDED", targetPlayerId: bot.playerId, characterId },
      };
    }

    case LOBBY_ACTION.KICK_PLAYER: {
      if (actorIndex !== 0)
        return { ok: false, reason: "NOT_HOST" };
      if (!PLAYER_ID_PATTERN.test(action.targetPlayerId || ""))
        return { ok: false, reason: "INVALID_PLAYER" };
      const targetIndex = findPlayerIndexById(next, action.targetPlayerId);
      if (targetIndex <= 0)
        return { ok: false, reason: targetIndex === 0 ? "CANNOT_KICK_HOST" : "INVALID_PLAYER" };
      const [removedPlayer] = next.players.splice(targetIndex, 1);
      if (next.lobbyStarting) delete next.lobbyStarting;
      next.players.forEach((candidate) => { candidate.ready = candidate.controller === PLAYER_CONTROLLER.BOT; });
      return {
        ok: true,
        game: next,
        actorIndex,
        event: {
          type: "PLAYER_KICKED",
          targetPlayerId: removedPlayer.playerId,
          targetCharacterId: removedPlayer.ch,
          targetWasConnected: removedPlayer.connected !== false,
        },
      };
    }

    case LOBBY_ACTION.BEGIN_START: {
      const startStatus = getLobbyStartStatus(next, actorIndex);
      if (!startStatus.allowed)
        return { ok: false, reason: startStatus.reason, details: startStatus };
      const startedAt = Number.isFinite(options.now) ? options.now : Date.now();
      const introDurationMs = Number.isFinite(options.introDurationMs)
        ? Math.max(0, options.introDurationMs)
        : 1850;
      next.lobbyStarting = {
        actionId: options.actionId || null,
        startedAt,
        introEndsAt: startedAt + introDurationMs,
      };
      return {
        ok: true,
        game: next,
        actorIndex,
        event: { type: "LOBBY_STARTING" },
      };
    }

    default:
      return { ok: false, reason: "UNKNOWN_ACTION" };
  }
}
