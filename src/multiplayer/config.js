export const PEER_PREFIX = "reinos-dragao-v1-";

const DEFAULT_ICE_SERVERS = Object.freeze([
  Object.freeze({ urls: "stun:stun.l.google.com:19302" }),
  Object.freeze({ urls: "stun:stun1.l.google.com:19302" }),
]);

const DEFAULT_TURN_FETCH_TIMEOUT_MS = 3_000;
const DEFAULT_TURN_FETCH_RETRIES = 1;
const DEFAULT_TURN_RETRY_DELAY_MS = 250;
const TURN_CACHE_KEY = "rd:turn-credentials:v1";
const TURN_CACHE_SAFETY_MS = 60_000;

let lastResolvedPeerConfig = null;

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

function hasTurnIceServers(iceServers) {
  return Array.isArray(iceServers) && iceServers.some((server) => {
    const urls = Array.isArray(server?.urls) ? server.urls : [server?.urls];
    return urls.some((url) => /^turns?:/i.test(String(url || "")));
  });
}

function defaultTurnStorage() {
  try {
    return globalThis.sessionStorage || null;
  } catch {
    return null;
  }
}

function readTurnCache(storage, endpoint, now = Date.now) {
  if (!storage || !endpoint) return null;
  try {
    const cached = JSON.parse(storage.getItem(TURN_CACHE_KEY) || "null");
    if (!cached || cached.endpoint !== endpoint) return null;
    if (!Number.isFinite(cached.expiresAt) || cached.expiresAt <= Number(now()) + TURN_CACHE_SAFETY_MS) return null;
    if (!Array.isArray(cached.iceServers) || !hasTurnIceServers(cached.iceServers)) return null;
    return cached.iceServers.map(normalizeIceServer);
  } catch {
    return null;
  }
}

function writeTurnCache(storage, endpoint, iceServers, expiresIn, now = Date.now) {
  if (!storage || !endpoint || !hasTurnIceServers(iceServers)) return false;
  const ttlSeconds = Number(expiresIn);
  if (!Number.isFinite(ttlSeconds) || ttlSeconds <= 60) return false;
  try {
    storage.setItem(TURN_CACHE_KEY, JSON.stringify({
      endpoint,
      iceServers,
      expiresAt: Number(now()) + ttlSeconds * 1000,
    }));
    return true;
  } catch {
    return false;
  }
}

function wait(ms, setTimeoutFn = setTimeout) {
  return new Promise((resolve) => setTimeoutFn(resolve, ms));
}

function retryableTurnEndpointError(error) {
  if (!error) return true;
  if (error.code === "TURN_NOT_CONFIGURED") return false;
  if (Number(error.status) === 429) return true;
  if (Number(error.status) >= 500) return true;
  return error.name === "AbortError" || error.name === "TypeError" || !Number.isFinite(Number(error.status));
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

export async function fetchTurnIceConfig(endpoint, {
  fetchFn = globalThis.fetch,
  timeoutMs = DEFAULT_TURN_FETCH_TIMEOUT_MS,
  retries = DEFAULT_TURN_FETCH_RETRIES,
  retryDelayMs = DEFAULT_TURN_RETRY_DELAY_MS,
  setTimeoutFn = setTimeout,
} = {}) {
  if (typeof endpoint !== "string" || !endpoint.trim()) {
    throw new Error("Endpoint de credenciais TURN em falta.");
  }
  if (typeof fetchFn !== "function") {
    throw new Error("Fetch indisponível para obter credenciais TURN.");
  }

  const attempts = Math.max(1, Math.min(3, Number(retries) + 1 || 1));
  let lastError = null;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const controller = typeof AbortController === "function" ? new AbortController() : null;
    const timer = controller && Number.isFinite(timeoutMs) && timeoutMs > 0
      ? setTimeoutFn(() => controller.abort(), timeoutMs)
      : null;
    try {
      const response = await fetchFn(endpoint, {
        method: "GET",
        headers: { Accept: "application/json" },
        cache: "no-store",
        ...(controller ? { signal: controller.signal } : {}),
      });
      let payload = null;
      try { payload = await response.json(); } catch { /* diagnostics below retain HTTP status */ }
      if (!response?.ok) {
        const providerCode = typeof payload?.error === "string" ? payload.error : null;
        const error = new Error(`Endpoint TURN respondeu com HTTP ${response?.status ?? "desconhecido"}${providerCode ? ` (${providerCode})` : ""}.`);
        error.status = Number(response?.status);
        error.code = providerCode;
        throw error;
      }
      const servers = Array.isArray(payload) ? payload : payload?.iceServers;
      if (!Array.isArray(servers) || servers.length === 0) {
        throw new Error("Endpoint TURN não devolveu uma lista ICE válida.");
      }
      const normalized = servers.map(normalizeIceServer);
      if (!hasTurnIceServers(normalized)) {
        throw new Error("Endpoint TURN não devolveu nenhum relay TURN utilizável.");
      }
      return {
        iceServers: normalized,
        expiresIn: Number.isFinite(Number(payload?.expiresIn)) ? Number(payload.expiresIn) : null,
      };
    } catch (error) {
      lastError = error;
      if (attempt >= attempts - 1 || !retryableTurnEndpointError(error)) throw error;
      await wait(Math.max(0, Number(retryDelayMs) || 0) * (attempt + 1), setTimeoutFn);
    } finally {
      if (timer != null) clearTimeout(timer);
    }
  }
  throw lastError || new Error("Não foi possível obter credenciais TURN.");
}

export async function fetchTurnIceServers(endpoint, options = {}) {
  const result = await fetchTurnIceConfig(endpoint, options);
  return result.iceServers;
}

export async function resolvePeerConfig(env = viteEnv, options = {}) {
  const config = buildPeerConfig(env);
  const requireTurn = asBoolean(env.VITE_REQUIRE_TURN, false);
  const endpoint = String(options.endpoint ?? env.VITE_TURN_CREDENTIALS_ENDPOINT ?? "").trim();
  const storage = options.storage === undefined ? defaultTurnStorage() : options.storage;
  const now = typeof options.now === "function" ? options.now : Date.now;

  if (endpoint) {
    const cached = readTurnCache(storage, endpoint, now);
    if (cached) config.config.iceServers = cached;
    try {
      if (!cached) {
        const temporary = await fetchTurnIceConfig(endpoint, options);
        config.config.iceServers = temporary.iceServers;
        writeTurnCache(storage, endpoint, temporary.iceServers, temporary.expiresIn, now);
      }
    } catch (error) {
      if (requireTurn) {
        throw new Error("Não foi possível obter credenciais TURN temporárias.", { cause: error });
      }
    }
  }

  if (requireTurn && !hasTurnServer(config)) {
    throw new Error("VITE_REQUIRE_TURN está ativo mas não foi possível obter um servidor TURN.");
  }

  lastResolvedPeerConfig = config;
  return config;
}

const viteEnv = typeof import.meta !== "undefined" && import.meta.env ? import.meta.env : {};

// Configuração síncrona/base, útil para testes e diagnósticos. O runtime de browser
// usa resolvePeerConfig() para poder acrescentar credenciais TURN temporárias.
export const PEER_CONFIG = buildPeerConfig(viteEnv);

export function getNetworkConfigSummary(config = lastResolvedPeerConfig || PEER_CONFIG) {
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
