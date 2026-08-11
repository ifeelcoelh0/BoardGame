import { IDENTITY_PROTOCOL_VERSION } from "../game/playerIdentity.js";
import { LOBBY_PROTOCOL_VERSION } from "../game/lobbyProtocol.js";
import { GAME_PROTOCOL_VERSION } from "../game/gameProtocol.js";
import { STATE_VIEW_VERSION } from "../game/gameStateView.js";

export const MULTIPLAYER_PROTOCOL_BUNDLE_VERSION = 1;

export function createLobbyActionMessage({ actionId, expectedRevision, type, payload = {} }) {
  return {
    t: "lobby-action",
    protocolVersion: IDENTITY_PROTOCOL_VERSION,
    lobbyProtocolVersion: LOBBY_PROTOCOL_VERSION,
    actionId,
    expectedRevision,
    action: { type, ...payload },
  };
}

export function createGameActionMessage({ actionId, expectedRevision, type, payload = {} }) {
  return {
    t: "game-action",
    protocolVersion: IDENTITY_PROTOCOL_VERSION,
    gameProtocolVersion: GAME_PROTOCOL_VERSION,
    actionId,
    expectedRevision,
    action: { type, ...payload },
  };
}

export function createStateRequestMessage() {
  return {
    t: "state-request",
    protocolVersion: IDENTITY_PROTOCOL_VERSION,
    stateViewVersion: STATE_VIEW_VERSION,
  };
}

export function isLobbyActionResult(message) {
  return Boolean(message
    && message.t === "lobby-action-result"
    && message.lobbyProtocolVersion === LOBBY_PROTOCOL_VERSION
    && typeof message.actionId === "string");
}

export function isGameActionResult(message) {
  return Boolean(message
    && message.t === "game-action-result"
    && message.gameProtocolVersion === GAME_PROTOCOL_VERSION
    && typeof message.actionId === "string");
}
