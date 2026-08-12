export const PEER_PREFIX = "reinos-dragao-v1-";

const DEFAULT_ICE_SERVERS = Object.freeze([
  Object.freeze({ urls: "stun:stun.l.google.com:19302" }),
  Object.freeze({ urls: "stun:stun1.l.google.com:19302" }),
]);

const DEFAULT_TURN_FETCH_TIMEOUT_MS = 6_000;

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

function hasTurnServer(config) {
  return Boolean(config?.config?.iceServers?.some((server) => {
    const urls = Array.isArray(server.urls) ? server.urls : [server.urls];
    return urls.some((url) => /^turns?:/i.test(url));
  }));
}

function buildPeerConfig(env = {}) {
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

  // Apenas para testes de conectividade: força todo o tráfego WebRTC a passar
  // pelo relay TURN. Em produção normal deve ficar desligado para preferir P2P.
  if (asBoolean(env.VITE_FORCE_TURN_RELAY, false)) {
    config.config.iceTransportPolicy = "relay";
  }

  return config;
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
  const config = buildPeerConfig(env);
  if (asBoolean(env.VITE_REQUIRE_TURN, false) && !hasTurnServer(config)) {
    throw new Error("VITE_REQUIRE_TURN está ativo mas não existe nenhum servidor TURN na configuração ICE.");
  }
  return config;
}

export async function fetchTurnIceServers(endpoint, {
  fetchFn = globalThis.fetch,
  timeoutMs = DEFAULT_TURN_FETCH_TIMEOUT_MS,
} = {}) {
  if (typeof endpoint !== "string" || !endpoint.trim()) {
    throw new Error("Endpoint de credenciais TURN em falta.");
  }
  if (typeof fetchFn !== "function") {
    throw new Error("Fetch indisponível para obter credenciais TURN.");
  }

  const controller = typeof AbortController === "function" ? new AbortController() : null;
  const timer = controller && Number.isFinite(timeoutMs) && timeoutMs > 0
    ? setTimeout(() => controller.abort(), timeoutMs)
    : null;

  try {
    const response = await fetchFn(endpoint, {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store",
      ...(controller ? { signal: controller.signal } : {}),
    });
    if (!response?.ok) {
      throw new Error(`Endpoint TURN respondeu com HTTP ${response?.status ?? "desconhecido"}.`);
    }
    const payload = await response.json();
    const servers = Array.isArray(payload) ? payload : payload?.iceServers;
    if (!Array.isArray(servers) || servers.length === 0) {
      throw new Error("Endpoint TURN não devolveu uma lista ICE válida.");
    }
    return servers.map(normalizeIceServer);
  } finally {
    if (timer != null) clearTimeout(timer);
  }
}

export async function resolvePeerConfig(env = viteEnv, options = {}) {
  const config = buildPeerConfig(env);
  const requireTurn = asBoolean(env.VITE_REQUIRE_TURN, false);
  const endpoint = String(options.endpoint ?? env.VITE_TURN_CREDENTIALS_ENDPOINT ?? "").trim();

  if (endpoint) {
    try {
      config.config.iceServers = await fetchTurnIceServers(endpoint, options);
    } catch (error) {
      if (requireTurn) {
        throw new Error("Não foi possível obter credenciais TURN temporárias.", { cause: error });
      }
    }
  }

  if (requireTurn && !hasTurnServer(config)) {
    throw new Error("VITE_REQUIRE_TURN está ativo mas não foi possível obter um servidor TURN.");
  }

  return config;
}

const viteEnv = typeof import.meta !== "undefined" && import.meta.env ? import.meta.env : {};

// Configuração síncrona/base, útil para testes e diagnósticos. O runtime de browser
// usa resolvePeerConfig() para poder acrescentar credenciais TURN temporárias.
export const PEER_CONFIG = buildPeerConfig(viteEnv);

export function getNetworkConfigSummary(config = PEER_CONFIG) {
  return {
    signaling: config.host ? "custom" : "peerjs-cloud",
    host: config.host || null,
    port: config.port || null,
    path: config.path || null,
    secure: config.secure ?? null,
    iceServerCount: config.config?.iceServers?.length || 0,
    turnEnabled: hasTurnServer(config),
    relayOnly: config.config?.iceTransportPolicy === "relay",
  };
}
