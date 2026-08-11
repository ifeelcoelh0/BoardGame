import { createTypedMessageRouter } from "./messageRouter.js";

export const HOST_MESSAGE_CONTROLLER_VERSION = 1;

export const HOST_MESSAGE_ROUTES = Object.freeze({
  "session-auth": "onSessionAuth",
  "claim-seat": "onClaimSeat",
  "leave-seat": "onLeaveSeat",
  "lobby-action": "onLobbyAction",
  "game-action": "onGameAction",
  "state-request": "onStateRequest",
  state: "onLegacyState",
  emote: "onEmote",
  chat: "onChat",
});

export const HOST_MESSAGE_TYPES = Object.freeze(Object.keys(HOST_MESSAGE_ROUTES));

export function createHostMessageController(handlers = {}, options = {}) {
  return createTypedMessageRouter(HOST_MESSAGE_ROUTES, handlers, options);
}
