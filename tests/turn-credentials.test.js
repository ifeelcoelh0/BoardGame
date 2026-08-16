import test from "node:test";
import assert from "node:assert/strict";
import turnCredentialsHandler, {
  credentialTtlSeconds,
  generateProviderCredentials,
  withoutBrowserBlockedPort53,
} from "../api/turn-credentials.js";

test("TURN TTL is clamped to a safe window", () => {
  assert.equal(credentialTtlSeconds(undefined), 86_400);
  assert.equal(credentialTtlSeconds("30"), 600);
  assert.equal(credentialTtlSeconds("999999"), 86_400);
});

test("browser-blocked alternate port 53 is removed", () => {
  const result = withoutBrowserBlockedPort53([
    { urls: ["stun:stun.cloudflare.com:3478", "stun:stun.cloudflare.com:53"] },
    {
      urls: [
        "turn:turn.cloudflare.com:3478?transport=udp",
        "turn:turn.cloudflare.com:53?transport=udp",
        "turns:turn.cloudflare.com:443?transport=tcp",
      ],
      username: "u",
      credential: "c",
    },
  ]);
  assert.deepEqual(result[0].urls, "stun:stun.cloudflare.com:3478");
  assert.deepEqual(result[1].urls, [
    "turn:turn.cloudflare.com:3478?transport=udp",
    "turns:turn.cloudflare.com:443?transport=tcp",
  ]);
});

test("TURN function keeps provider secrets server-side and returns temporary ICE config", async () => {
  const previousKey = process.env.CLOUDFLARE_TURN_KEY_ID;
  const previousToken = process.env.CLOUDFLARE_TURN_API_TOKEN;
  const previousFetch = globalThis.fetch;
  process.env.CLOUDFLARE_TURN_KEY_ID = "turn-key";
  process.env.CLOUDFLARE_TURN_API_TOKEN = "server-secret";

  let seenAuthorization = null;
  globalThis.fetch = async (_url, options) => {
    seenAuthorization = options.headers.Authorization;
    return new Response(JSON.stringify({
      iceServers: [
        { urls: ["stun:stun.cloudflare.com:3478", "stun:stun.cloudflare.com:53"] },
        {
          urls: ["turn:turn.cloudflare.com:3478?transport=udp", "turns:turn.cloudflare.com:443?transport=tcp"],
          username: "temporary-user",
          credential: "temporary-password",
        },
      ],
    }), { status: 201, headers: { "Content-Type": "application/json" } });
  };

  try {
    const response = await turnCredentialsHandler.fetch(new Request("https://game.example/api/turn-credentials"));
    const payload = await response.json();
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "no-store, max-age=0");
    assert.equal(seenAuthorization, "Bearer server-secret");
    assert.equal(payload.provider, "cloudflare");
    assert.equal(typeof payload.expiresAt, "string");
    assert.equal(payload.iceServers.some((server) => JSON.stringify(server.urls).includes("turn:")), true);
    assert.equal(JSON.stringify(payload).includes("server-secret"), false);
  } finally {
    globalThis.fetch = previousFetch;
    if (previousKey == null) delete process.env.CLOUDFLARE_TURN_KEY_ID;
    else process.env.CLOUDFLARE_TURN_KEY_ID = previousKey;
    if (previousToken == null) delete process.env.CLOUDFLARE_TURN_API_TOKEN;
    else process.env.CLOUDFLARE_TURN_API_TOKEN = previousToken;
  }
});

test("TURN provider generation retries a transient upstream failure once", async () => {
  let attempts = 0;
  const payload = await generateProviderCredentials("https://rtc.example/turn", "secret", 3600, async () => {
    attempts += 1;
    if (attempts === 1) return new Response("unavailable", { status: 503 });
    return new Response(JSON.stringify({ iceServers: [{ urls: "turn:turn.example:3478", username: "u", credential: "c" }] }), {
      status: 201,
      headers: { "Content-Type": "application/json" },
    });
  });
  assert.equal(attempts, 2);
  assert.equal(payload.iceServers.length, 1);
});
