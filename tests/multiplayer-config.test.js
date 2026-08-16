import test from "node:test";
import assert from "node:assert/strict";
import { createPeerConfig, getNetworkConfigSummary, parseIceServers, resolvePeerConfig } from "../src/multiplayer/config.js";

function memoryStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
  };
}

test("uses safe STUN-only defaults", () => {
  const config = createPeerConfig({});
  assert.equal(config.host, undefined);
  assert.equal(config.config.iceServers.length, 2);
  assert.equal(getNetworkConfigSummary(config).turnEnabled, false);
});

test("builds custom PeerJS and TURN configuration from environment", () => {
  const config = createPeerConfig({
    VITE_PEER_HOST: "peer.example.com",
    VITE_PEER_PORT: "443",
    VITE_PEER_PATH: "reinos",
    VITE_PEER_SECURE: "true",
    VITE_ICE_SERVERS_JSON: JSON.stringify([
      { urls: "stun:stun.example.com:3478" },
      { urls: "turns:turn.example.com:5349", username: "temporary", credential: "secret" },
    ]),
  });

  assert.equal(config.host, "peer.example.com");
  assert.equal(config.port, 443);
  assert.equal(config.path, "/reinos");
  assert.equal(config.secure, true);
  assert.equal(getNetworkConfigSummary(config).turnEnabled, true);
});

test("rejects malformed environment configuration", () => {
  assert.throws(() => parseIceServers("not-json"), /JSON inválido/);
  assert.throws(() => createPeerConfig({ VITE_PEER_PORT: "70000" }), /porta/);
  assert.throws(() => parseIceServers("[]"), /lista não vazia/);
});


test("TURN can be made a deployment requirement without hard-coding a provider", () => {
  assert.throws(() => createPeerConfig({ VITE_REQUIRE_TURN: "true" }), /não existe nenhum servidor TURN/);
  assert.doesNotThrow(() => createPeerConfig({
    VITE_REQUIRE_TURN: "true",
    VITE_ICE_SERVERS_JSON: JSON.stringify([
      { urls: "stun:stun.example.com:3478" },
      { urls: "turns:turn.example.com:5349", username: "temporary", credential: "temporary" },
    ]),
  }));
});


test("resolves short-lived TURN credentials from a same-origin endpoint", async () => {
  const config = await resolvePeerConfig({
    VITE_TURN_CREDENTIALS_ENDPOINT: "/api/turn-credentials",
    VITE_REQUIRE_TURN: "true",
  }, {
    fetchFn: async (url) => {
      assert.equal(url, "/api/turn-credentials");
      return new Response(JSON.stringify({
        iceServers: [
          { urls: "stun:stun.cloudflare.com:3478" },
          { urls: "turns:turn.cloudflare.com:443?transport=tcp", username: "temp", credential: "temp-secret" },
        ],
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    },
    timeoutMs: 1000,
  });

  assert.equal(getNetworkConfigSummary(config).turnEnabled, true);
});

test("required TURN fails closed when temporary credentials cannot be fetched", async () => {
  await assert.rejects(() => resolvePeerConfig({
    VITE_TURN_CREDENTIALS_ENDPOINT: "/api/turn-credentials",
    VITE_REQUIRE_TURN: "true",
  }, {
    fetchFn: async () => new Response("unavailable", { status: 503 }),
    timeoutMs: 1000,
  }), /credenciais TURN temporárias/);
});

test("temporary TURN fetch retries transient endpoint failures", async () => {
  let attempts = 0;
  const config = await resolvePeerConfig({
    VITE_TURN_CREDENTIALS_ENDPOINT: "/api/turn-credentials",
    VITE_REQUIRE_TURN: "true",
  }, {
    storage: null,
    retries: 1,
    retryDelayMs: 0,
    timeoutMs: 0,
    fetchFn: async () => {
      attempts += 1;
      if (attempts === 1) {
        return new Response(JSON.stringify({ error: "TURN_PROVIDER_UNAVAILABLE" }), {
          status: 502,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({
        expiresIn: 3600,
        iceServers: [
          { urls: "stun:stun.cloudflare.com:3478" },
          { urls: "turns:turn.cloudflare.com:443?transport=tcp", username: "temp", credential: "temp-secret" },
        ],
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    },
  });
  assert.equal(attempts, 2);
  assert.equal(getNetworkConfigSummary(config).turnEnabled, true);
});

test("valid TURN credentials are cached for the browser session and survive refresh-style re-resolution", async () => {
  const storage = memoryStorage();
  let fetches = 0;
  const env = {
    VITE_TURN_CREDENTIALS_ENDPOINT: "/api/turn-credentials",
    VITE_REQUIRE_TURN: "true",
  };
  const first = await resolvePeerConfig(env, {
    storage,
    now: () => 1_000_000,
    timeoutMs: 0,
    fetchFn: async () => {
      fetches += 1;
      return new Response(JSON.stringify({
        expiresIn: 3600,
        iceServers: [
          { urls: "stun:stun.cloudflare.com:3478" },
          { urls: "turn:turn.cloudflare.com:3478?transport=udp", username: "temp", credential: "secret" },
        ],
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    },
  });
  assert.equal(getNetworkConfigSummary(first).turnEnabled, true);
  const second = await resolvePeerConfig(env, {
    storage,
    now: () => 1_010_000,
    fetchFn: async () => {
      fetches += 1;
      throw new Error("endpoint should not be called while cache is valid");
    },
  });
  assert.equal(fetches, 1);
  assert.equal(getNetworkConfigSummary(second).turnEnabled, true);
});


test("can force relay-only transport for TURN verification", () => {
  const config = createPeerConfig({
    VITE_FORCE_TURN_RELAY: "true",
    VITE_ICE_SERVERS_JSON: JSON.stringify([
      { urls: "turns:turn.example.com:443", username: "temporary", credential: "temporary" },
    ]),
  });
  assert.equal(config.config.iceTransportPolicy, "relay");
  assert.equal(getNetworkConfigSummary(config).relayOnly, true);
});
