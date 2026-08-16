const DEFAULT_TTL_SECONDS = 86_400;
const MIN_TTL_SECONDS = 600;
const MAX_TTL_SECONDS = 86_400;
const PROVIDER_ATTEMPTS = 2;
const PROVIDER_RETRY_DELAY_MS = 180;

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store, max-age=0",
      ...extraHeaders,
    },
  });
}

function credentialTtlSeconds(rawValue) {
  const value = Number(rawValue ?? DEFAULT_TTL_SECONDS);
  if (!Number.isFinite(value)) return DEFAULT_TTL_SECONDS;
  return Math.min(MAX_TTL_SECONDS, Math.max(MIN_TTL_SECONDS, Math.floor(value)));
}

function withoutBrowserBlockedPort53(iceServers) {
  return (Array.isArray(iceServers) ? iceServers : [])
    .map((server) => {
      if (!server || typeof server !== "object") return null;
      const urls = Array.isArray(server.urls) ? server.urls : [server.urls];
      const filtered = urls.filter((url) => typeof url === "string" && !/:53(?:\?|$)/i.test(url));
      if (!filtered.length) return null;
      return {
        urls: filtered.length === 1 ? filtered[0] : filtered,
        ...(server.username != null ? { username: String(server.username) } : {}),
        ...(server.credential != null ? { credential: String(server.credential) } : {}),
      };
    })
    .filter(Boolean);
}

function containsTurn(iceServers) {
  return iceServers.some((server) => {
    const urls = Array.isArray(server.urls) ? server.urls : [server.urls];
    return urls.some((url) => /^turns?:/i.test(url));
  });
}

function retryableProviderStatus(status) {
  return status === 429 || status >= 500;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function generateProviderCredentials(endpoint, apiToken, ttl, fetchFn = fetch) {
  let lastError = null;
  for (let attempt = 0; attempt < PROVIDER_ATTEMPTS; attempt += 1) {
    try {
      const upstream = await fetchFn(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiToken}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ ttl }),
      });

      if (!upstream.ok) {
        const error = new Error(`TURN provider HTTP ${upstream.status}`);
        error.status = upstream.status;
        lastError = error;
        if (attempt + 1 < PROVIDER_ATTEMPTS && retryableProviderStatus(upstream.status)) {
          await sleep(PROVIDER_RETRY_DELAY_MS * (attempt + 1));
          continue;
        }
        throw error;
      }

      return await upstream.json();
    } catch (error) {
      lastError = error;
      const status = Number(error?.status);
      const retryable = !Number.isFinite(status) || retryableProviderStatus(status);
      if (attempt + 1 < PROVIDER_ATTEMPTS && retryable) {
        await sleep(PROVIDER_RETRY_DELAY_MS * (attempt + 1));
        continue;
      }
      throw error;
    }
  }
  throw lastError || new Error("TURN provider unavailable");
}

export default {
  async fetch(request) {
    if (request.method !== "GET") {
      return json(
        { error: "METHOD_NOT_ALLOWED" },
        405,
        { Allow: "GET" },
      );
    }

    const keyId = process.env.CLOUDFLARE_TURN_KEY_ID?.trim();
    const apiToken = process.env.CLOUDFLARE_TURN_API_TOKEN?.trim();
    if (!keyId || !apiToken) {
      return json({ error: "TURN_NOT_CONFIGURED" }, 503);
    }

    const ttl = credentialTtlSeconds(process.env.TURN_CREDENTIAL_TTL_SECONDS);
    const endpoint = `https://rtc.live.cloudflare.com/v1/turn/keys/${encodeURIComponent(keyId)}/credentials/generate-ice-servers`;

    try {
      const payload = await generateProviderCredentials(endpoint, apiToken, ttl);
      const iceServers = withoutBrowserBlockedPort53(payload?.iceServers);
      if (!iceServers.length || !containsTurn(iceServers)) {
        console.error("TURN credential provider returned no usable TURN server");
        return json({ error: "TURN_PROVIDER_INVALID_RESPONSE" }, 502);
      }

      return json({
        iceServers,
        expiresIn: ttl,
        expiresAt: new Date(Date.now() + ttl * 1000).toISOString(),
        provider: "cloudflare",
      });
    } catch (error) {
      console.error("TURN credential provider request failed", {
        name: error?.name || "Error",
        message: error?.message || String(error),
        status: Number.isFinite(Number(error?.status)) ? Number(error.status) : undefined,
      });
      return json(
        { error: "TURN_PROVIDER_UNAVAILABLE" },
        502,
        { "Retry-After": "2" },
      );
    }
  },
};

export {
  credentialTtlSeconds,
  generateProviderCredentials,
  withoutBrowserBlockedPort53,
};
