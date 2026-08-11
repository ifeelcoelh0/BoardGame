export const PEER_PREFIX = "reinos-dragao-v1-";

const DEFAULT_ICE_SERVERS = Object.freeze([
  Object.freeze({ urls: "stun:stun.l.google.com:19302" }),
  Object.freeze({ urls: "stun:stun1.l.google.com:19302" }),
]);

function asBoolean(value, fallback) {
  if (value == null || value === "") return fallback;
  return String(value).toLowerCase() === "true";
}

function asPort(value) {
  if (value == null || value === "") return undefined;
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("VITE_PEER_PORT tem de ser uma porta entre 1 e 65535.");
  }
  return port;
}

function normalizeIceServer(server, index) {
  if (!server || typeof server !== "object" || Array.isArray(server)) {
    throw new Error(`ICE server ${index + 1} inválido.`);
  }

  const urls = server.urls;
  const validUrls = typeof urls === "string"
    ? urls.length > 0
    : Array.isArray(urls) && urls.length > 0 && urls.every((url) => typeof url === "string" && url.length > 0);

  if (!validUrls) throw new Error(`ICE server ${index + 1} não contém urls válidos.`);

  const normalized = { urls };
  if (server.username != null) normalized.username = String(server.username);
  if (server.credential != null) normalized.credential = String(server.credential);
  return normalized;
}

export function parseIceServers(rawValue) {
  if (!rawValue) return DEFAULT_ICE_SERVERS.map((server) => ({ ...server }));

  let parsed;
  try {
    parsed = JSON.parse(rawValue);
  } catch {
    throw new Error("VITE_ICE_SERVERS_JSON contém JSON inválido.");
  }

  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error("VITE_ICE_SERVERS_JSON tem de ser uma lista não vazia.");
  }

  return parsed.map(normalizeIceServer);
}

export function createPeerConfig(env = {}) {
  const config = {
    config: {
      iceServers: parseIceServers(env.VITE_ICE_SERVERS_JSON),
      iceCandidatePoolSize: 4,
    },
  };

  const host = env.VITE_PEER_HOST?.trim();
  const path = env.VITE_PEER_PATH?.trim();
  const key = env.VITE_PEER_KEY?.trim();
  const port = asPort(env.VITE_PEER_PORT);

  if (host) config.host = host;
  if (port) config.port = port;
  if (path) config.path = path.startsWith("/") ? path : `/${path}`;
  if (key) config.key = key;
  if (host || port || path) config.secure = asBoolean(env.VITE_PEER_SECURE, true);

  const debug = Number(env.VITE_PEER_DEBUG ?? 0);
  if (Number.isInteger(debug) && debug >= 0 && debug <= 3) config.debug = debug;

  if (asBoolean(env.VITE_REQUIRE_TURN, false)) {
    const hasTurn = config.config.iceServers.some((server) => {
      const urls = Array.isArray(server.urls) ? server.urls : [server.urls];
      return urls.some((url) => /^turns?:/i.test(url));
    });
    if (!hasTurn) {
      throw new Error("VITE_REQUIRE_TURN está ativo mas não existe nenhum servidor TURN na configuração ICE.");
    }
  }

  return config;
}

const viteEnv = typeof import.meta !== "undefined" && import.meta.env ? import.meta.env : {};

export const PEER_CONFIG = createPeerConfig(viteEnv);

export function getNetworkConfigSummary(config = PEER_CONFIG) {
  return {
    signaling: config.host ? "custom" : "peerjs-cloud",
    host: config.host || null,
    port: config.port || null,
    path: config.path || null,
    secure: config.secure ?? null,
    iceServerCount: config.config?.iceServers?.length || 0,
    turnEnabled: Boolean(config.config?.iceServers?.some((server) => {
      const urls = Array.isArray(server.urls) ? server.urls : [server.urls];
      return urls.some((url) => /^turns?:/i.test(url));
    })),
  };
}
