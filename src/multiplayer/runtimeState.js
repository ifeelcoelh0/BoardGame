export const MULTIPLAYER_RUNTIME_VERSION = 1;

export function createMultiplayerRuntimeState() {
  return {
    peer: null,
    conns: [],
    host: false,
    hostConn: null,
    auth: new Map(),
    authorityQueue: Promise.resolve(),
    lobbyActionResults: new Map(),
    gameActionResults: new Map(),
    transportController: null,
  };
}

export function registerConnection(runtime, connection) {
  if (!runtime || !connection) return false;
  if (!Array.isArray(runtime.conns)) runtime.conns = [];
  if (!runtime.conns.includes(connection)) runtime.conns.push(connection);
  return true;
}

export function hasConnection(runtime, connection) {
  return Array.isArray(runtime?.conns) && runtime.conns.includes(connection);
}

export function authenticateConnection(runtime, connection, playerId) {
  if (!runtime || !connection || typeof playerId !== "string") return false;
  if (!(runtime.auth instanceof Map)) runtime.auth = new Map();
  registerConnection(runtime, connection);
  runtime.auth.set(connection, playerId);
  return true;
}

export function authenticatedPlayerId(runtime, connection) {
  return runtime?.auth instanceof Map ? runtime.auth.get(connection) || null : null;
}

export function connectionsForPlayer(runtime, playerId) {
  if (!(runtime?.auth instanceof Map) || typeof playerId !== "string") return [];
  const matches = [];
  for (const [connection, authenticatedId] of runtime.auth.entries()) {
    if (authenticatedId === playerId) matches.push(connection);
  }
  return matches;
}

export function unregisterConnection(runtime, connection) {
  if (!runtime || !connection) return null;
  const playerId = authenticatedPlayerId(runtime, connection);
  runtime.auth?.delete?.(connection);
  if (Array.isArray(runtime.conns)) {
    runtime.conns = runtime.conns.filter((candidate) => candidate !== connection);
  }
  if (runtime.hostConn === connection) runtime.hostConn = null;
  return playerId;
}

export function replaceAuthenticatedConnection(runtime, playerId, nextConnection) {
  if (!runtime || typeof playerId !== "string" || !nextConnection) return [];
  const replaced = connectionsForPlayer(runtime, playerId).filter((connection) => connection !== nextConnection);
  for (const connection of replaced) unregisterConnection(runtime, connection);
  authenticateConnection(runtime, nextConnection, playerId);
  return replaced;
}

export function enqueueAuthorityTask(runtime, task) {
  if (!runtime || typeof task !== "function") return Promise.reject(new TypeError("Tarefa de autoridade inválida."));
  const previous = runtime.authorityQueue || Promise.resolve();
  const next = previous.then(task);
  runtime.authorityQueue = next.catch(() => undefined);
  return next;
}

export function forEachConnection(runtime, callback) {
  if (!Array.isArray(runtime?.conns) || typeof callback !== "function") return;
  for (const connection of [...runtime.conns]) callback(connection);
}

export function destroyMultiplayerRuntime(runtime, { closeConnections = true } = {}) {
  if (!runtime) return createMultiplayerRuntimeState();
  try { runtime.transportController?.destroy?.({ closeConnections: false, closeConnection: false, destroyPeer: false }); } catch {}
  if (closeConnections) {
    forEachConnection(runtime, (connection) => {
      try { connection.close?.(); } catch {}
    });
  }
  try { runtime.hostConn?.close?.(); } catch {}
  try { runtime.peer?.destroy?.(); } catch {}

  runtime.peer = null;
  runtime.conns = [];
  runtime.host = false;
  runtime.hostConn = null;
  runtime.auth = new Map();
  runtime.authorityQueue = Promise.resolve();
  runtime.lobbyActionResults = new Map();
  runtime.gameActionResults = new Map();
  runtime.transportController = null;
  return runtime;
}
