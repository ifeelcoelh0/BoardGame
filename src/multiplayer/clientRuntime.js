
export const CLIENT_RUNTIME_VERSION = 1;

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

export function createClientPeerRuntime({
  runtime,
  hostPeerId,
  peerConfig,
  connectionOptions = { reliable: true },
  PeerClass,
  peerOpenTimeoutMs = 9_000,
  welcomeTimeoutMs = 10_000,
  setTimer = setTimeout,
  clearTimer = clearTimeout,
  isReady = () => false,
  onPeerOpen,
  onPeerOpenTimeout,
  onConnectionOpen,
  onMessage,
  onConnectionClose,
  onConnectionError,
  onWelcomeTimeout,
  onPeerError,
  onUnhandledError,
} = {}) {
  if (!runtime) throw new TypeError("Runtime multiplayer em falta.");
  if (typeof PeerClass !== "function") throw new TypeError("Construtor Peer inválido.");

  const peer = new PeerClass(null, peerConfig);
  let destroyed = false;
  let peerOpened = false;
  let peerTimer = null;
  let welcomeTimer = null;
  let connection = null;

  runtime.peer = peer;
  runtime.host = false;

  const isCurrent = () => !destroyed && runtime.peer === peer;
  const send = (payload) => {
    if (!isCurrent() || runtime.hostConn !== connection || !connection?.open) return false;
    try {
      connection.send(payload);
      return true;
    } catch {
      return false;
    }
  };

  const controller = {
    kind: "client",
    peer,
    runtime,
    get connection() { return connection; },
    isCurrent,
    send,
    clearWelcomeTimeout() {
      if (welcomeTimer != null) clearTimer(welcomeTimer);
      welcomeTimer = null;
    },
    destroy({ closeConnection = false, destroyPeer = false } = {}) {
      if (destroyed) return;
      destroyed = true;
      if (peerTimer != null) clearTimer(peerTimer);
      if (welcomeTimer != null) clearTimer(welcomeTimer);
      peerTimer = null;
      welcomeTimer = null;
      if (closeConnection) safeClose(connection);
      if (destroyPeer) {
        try { peer.destroy?.(); } catch {}
      }
      if (runtime.transportController === controller) runtime.transportController = null;
    },
  };
  runtime.transportController = controller;

  peerTimer = setTimer(() => {
    if (!isCurrent() || peerOpened || isReady()) return;
    safeCall(onPeerOpenTimeout, { peer, controller }, onUnhandledError);
  }, peerOpenTimeoutMs);

  peer.on("open", (id) => {
    if (!isCurrent()) return;
    peerOpened = true;
    if (peerTimer != null) clearTimer(peerTimer);
    peerTimer = null;
    safeCall(onPeerOpen, { peer, id, controller }, onUnhandledError);

    connection = peer.connect(hostPeerId, connectionOptions);
    runtime.hostConn = connection;
    const context = {
      peer,
      controller,
      connection,
      send,
    };

    connection.on("open", () => {
      if (!isCurrent() || runtime.hostConn !== connection) return;
      safeCall(onConnectionOpen, context, onUnhandledError);
    });
    connection.on("data", (message) => {
      if (!isCurrent() || runtime.hostConn !== connection) return;
      safeCall(onMessage, { ...context, message }, onUnhandledError);
    });
    connection.on("close", () => {
      const notify = isCurrent();
      if (runtime.hostConn === connection) runtime.hostConn = null;
      if (notify) safeCall(onConnectionClose, context, onUnhandledError);
    });
    connection.on?.("error", (error) => {
      safeCall(onConnectionError, { ...context, error }, onUnhandledError);
    });

    welcomeTimer = setTimer(() => {
      if (!isCurrent() || runtime.hostConn !== connection || isReady()) return;
      safeCall(onWelcomeTimeout, context, onUnhandledError);
    }, welcomeTimeoutMs);
  });

  peer.on("error", (error) => {
    if (!isCurrent()) return;
    safeCall(onPeerError, { peer, controller, error, peerOpened }, onUnhandledError);
  });

  return controller;
}
