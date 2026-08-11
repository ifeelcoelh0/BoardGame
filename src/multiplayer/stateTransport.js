import { STATE_VIEW_VERSION, createGameStateView, createPublicGameStateView } from "../game/gameStateView.js";
import { authenticatedPlayerId, forEachConnection } from "./runtimeState.js";
import { createStateRequestMessage } from "./protocolMessages.js";

export function stateViewForConnection(game, runtime, connection) {
  const viewerPlayerId = connection ? authenticatedPlayerId(runtime, connection) : null;
  return viewerPlayerId ? createGameStateView(game, viewerPlayerId) : createPublicGameStateView(game);
}

export function payloadForConnection(payload, runtime, connection) {
  if (!payload || typeof payload !== "object" || !Object.prototype.hasOwnProperty.call(payload, "g") || !payload.g)
    return payload;
  return {
    ...payload,
    stateViewVersion: STATE_VIEW_VERSION,
    g: stateViewForConnection(payload.g, runtime, connection),
  };
}

export function broadcastGameState(runtime, game) {
  forEachConnection(runtime, (connection) => {
    try {
      connection.send(payloadForConnection({ t: "state", g: game }, runtime, connection));
    } catch {}
  });
}

export function requestAuthoritativeState(runtime) {
  const connection = runtime?.hostConn;
  if (runtime?.host || !connection?.open) return false;
  try {
    connection.send(createStateRequestMessage());
    return true;
  } catch {
    return false;
  }
}
