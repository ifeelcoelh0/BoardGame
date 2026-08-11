import test from "node:test";
import assert from "node:assert/strict";

import { disposeMaterial, disposeObjectTree } from "../src/ui/three/disposeThree.js";
import { PEER_CONFIG, PEER_PREFIX } from "../src/multiplayer/config.js";
import { createClientSocialController } from "../src/multiplayer/socialEventController.js";

test("Three disposal releases shared geometry, material and texture exactly once", () => {
  const calls = { geometry: 0, material: 0, texture: 0 };
  const texture = { isTexture: true, dispose: () => { calls.texture += 1; } };
  const material = { map: texture, normalMap: texture, dispose: () => { calls.material += 1; } };
  const geometry = { dispose: () => { calls.geometry += 1; } };
  const objects = [
    { geometry, material },
    { geometry, material: [material] },
  ];
  disposeObjectTree({ traverse: (visit) => objects.forEach(visit) });
  assert.deepEqual(calls, { geometry: 1, material: 1, texture: 1 });
});

test("material disposal tolerates missing maps and material", () => {
  assert.doesNotThrow(() => disposeMaterial(null));
  assert.doesNotThrow(() => disposeMaterial({ dispose() {} }));
});

test("peer configuration is centralized and social ids use stable application ids", () => {
  assert.equal(PEER_PREFIX, "reinos-dragao-v1-");
  assert.ok(PEER_CONFIG.config.iceServers.length >= 2);
  assert.ok(PEER_CONFIG.config.iceServers.every((server) => !String(server.urls).startsWith("turn:")));
  const emitted = [];
  const controller = createClientSocialController({
    getGame: () => ({ players: [] }),
    findPlayerIndex: () => -1,
    now: (() => { let value = 1000; return () => (value += 1000); })(),
    send: () => true,
    emit: (event) => emitted.push(event),
  });
  const sent = controller.sendChat("olá");
  assert.equal(sent.ok, true);
  assert.match(sent.message.id, /^social_/);
});
