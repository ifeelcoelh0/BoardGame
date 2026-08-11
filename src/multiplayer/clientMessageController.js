import { createTypedMessageRouter } from "./messageRouter.js";

export const CLIENT_MESSAGE_CONTROLLER_VERSION = 1;

export const CLIENT_MESSAGE_ROUTES = Object.freeze({
  "identity-welcome": "onIdentityWelcome",
  "session-result": "onSessionResult",
  "claim-result": "onClaimResult",
  "lobby-action-result": "onLobbyActionResult",
  "game-action-result": "onGameActionResult",
  "leave-result": "onLeaveResult",
  "session-replaced": "onSessionReplaced",
  "kicked-from-lobby": "onKickedFromLobby",
  state: "onState",
  emote: "onEmote",
  chat: "onChat",
});

export const CLIENT_MESSAGE_TYPES = Object.freeze(Object.keys(CLIENT_MESSAGE_ROUTES));

export function createClientMessageController(handlers = {}, options = {}) {
  return createTypedMessageRouter(CLIENT_MESSAGE_ROUTES, handlers, options);
}
