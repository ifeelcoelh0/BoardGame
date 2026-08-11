import {
  registerConnection,
  unregisterConnection,
} from "./runtimeState.js";
import { payloadForConnection } from "./stateTransport.js";

export const HOST_RUNTIME_VERSION = 1;

function safeCall(callback, payload, onUnhandledError) {
  if (typeof callback !== "function") return;
  try {
    const result = callback(payload);
    if (result && typeof result.then === "function") {
      result.catch((error) => onUnhandledError?.(error, payload));
    }
  } catch (error) {
    onUnhandledError?.(error, payload);
  }
}

function safeClose(connection) {
  try { connection?.close?.(); } catch {}
}

export function createHostPeerRuntime({
  runtime,
  peerId,
  peerConfig,
  PeerClass,
  openTimeoutMs = 9_000,
  setTimer = setTimeout,
  clearTimer = clearTimeout,
  onOpen,
  onOpenTimeout,
  onConnectionOpen,
  onConnectionMessage,
  onConnectionClose,
  onConnectionError,
  onPeerError,
  onUnhandledError,
} = {}) {
  if (!runtime) throw new TypeError("Runtime multiplayer em falta.");
  if (typeof PeerClass !== "function") throw new TypeError("Construtor Peer inválido.");

  const peer = new PeerClass(peerId, peerConfig);
  let opened = false;
  let destroyed = false;
  let openTimer = null;

  runtime.peer = peer;
  runtime.host = true;

  const isCurrent = () => !destroyed && runtime.peer === peer;
  const send = (connection, payload) => {
    if (!isCurrent() || !connection?.open) return false;
    try {
      connection.send(payloadForConnection(payload, runtime, connection));
      return true;
    } catch {
      return false;
    }
  };

  const controller = {
    kind: "host",
    peer,
    runtime,
    isCurrent,
    send,
    destroy({ closeConnections = false, destroyPeer = false } = {}) {
      if (destroyed) return;
      destroyed = true;
      if (openTimer != null) clearTimer(openTimer);
      openTimer = null;
      if (closeConnections) {
        for (const connection of [...(runtime.conns || [])]) safeClose(connection);
      }
      if (destroyPeer) {
        try { peer.destroy?.(); } catch {}
      }
      if (runtime.transportController === controller) runtime.transportController = null;
    },
  };
  runtime.transportController = controller;

  openTimer = setTimer(() => {
    if (!isCurrent() || opened) return;
    safeCall(onOpenTimeout, { peer, controller }, onUnhandledError);
  }, openTimeoutMs);

  peer.on("open", (id) => {
    if (!isCurrent()) return;
    opened = true;
    if (openTimer != null) clearTimer(openTimer);
    openTimer = null;
    safeCall(onOpen, { peer, id, controller }, onUnhandledError);
  });

  peer.on("connection", (connection) => {
    if (!isCurrent()) {
      safeClose(connection);
      return;
    }
    registerConnection(runtime, connection);
    const context = {
      peer,
      controller,
      connection,
      send: (payload) => send(connection, payload),
    };

    connection.on("open", () => {
      if (!isCurrent()) return;
      safeCall(onConnectionOpen, context, onUnhandledError);
    });
    connection.on("data", (message) => {
      if (!isCurrent()) return;
      safeCall(onConnectionMessage, { ...context, message }, onUnhandledError);
    });
    connection.on("close", () => {
      const notify = isCurrent();
      const playerId = unregisterConnection(runtime, connection);
      if (notify) safeCall(onConnectionClose, { ...context, playerId }, onUnhandledError);
    });
    connection.on?.("error", (error) => {
      safeCall(onConnectionError, { ...context, error }, onUnhandledError);
    });
  });

  peer.on("error", (error) => {
    if (!isCurrent()) return;
    safeCall(onPeerError, { peer, controller, error, opened }, onUnhandledError);
  });

  return controller;
}
