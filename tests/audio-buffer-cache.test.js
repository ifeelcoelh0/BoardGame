import test from "node:test";
import assert from "node:assert/strict";
import { AudioBufferCache, estimateAudioBufferBytes } from "../src/audio/audioBufferCache.js";

function buffer(bytes) {
  return { numberOfChannels: 1, length: bytes / 4, sampleRate: 48000, duration: bytes / 4 / 48000 };
}

test("audio buffer byte estimation follows decoded Float32 channel storage", () => {
  assert.equal(estimateAudioBufferBytes({ numberOfChannels: 2, length: 48000 }), 384000);
});

test("audio cache evicts the least recently used decoded buffer", () => {
  const cache = new AudioBufferCache({ maxBytes: 160 });
  const a = buffer(80);
  const b = buffer(80);
  const c = buffer(80);
  cache.set("a", a);
  cache.set("b", b);
  assert.equal(cache.get("a"), a); // a passa a ser o mais recente
  cache.set("c", c);
  assert.equal(cache.has("a"), true);
  assert.equal(cache.has("b"), false);
  assert.equal(cache.has("c"), true);
  assert.equal(cache.snapshot().totalBytes, 160);
});

test("audio cache deduplicates concurrent fetch/decode work by URI", async () => {
  const cache = new AudioBufferCache({ maxBytes: 1024 });
  let loads = 0;
  let resolveLoad;
  const gate = new Promise((resolve) => { resolveLoad = resolve; });
  const loader = async () => {
    loads += 1;
    await gate;
    return buffer(80);
  };

  const first = cache.getOrLoad("/same.m4a", loader);
  const second = cache.getOrLoad("/same.m4a", loader);
  assert.equal(cache.pending, 1);
  assert.equal(loads, 0); // loader arranca no próximo microtask
  await Promise.resolve();
  assert.equal(loads, 1);
  resolveLoad();
  assert.equal(await first, await second);
  assert.equal(loads, 1);
  assert.equal(cache.pending, 0);
});

test("oversized decoded audio can play without occupying the cache", async () => {
  const cache = new AudioBufferCache({ maxBytes: 64 });
  const large = buffer(128);
  assert.equal(await cache.getOrLoad("/large.m4a", async () => large), large);
  assert.equal(cache.has("/large.m4a"), false);
  assert.equal(cache.snapshot().totalBytes, 0);
});

test("failed in-flight loads are released and can be retried", async () => {
  const cache = new AudioBufferCache({ maxBytes: 1024 });
  await assert.rejects(cache.getOrLoad("/retry.m4a", async () => { throw new Error("decode"); }), /decode/);
  assert.equal(cache.pending, 0);
  const recovered = buffer(80);
  assert.equal(await cache.getOrLoad("/retry.m4a", async () => recovered), recovered);
});


test("clearing the audio cache invalidates pending loads from the previous lifecycle", async () => {
  const cache = new AudioBufferCache({ maxBytes: 1024 });
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  const decoded = buffer(80);
  const pending = cache.getOrLoad("/late.m4a", async () => {
    await gate;
    return decoded;
  });

  await Promise.resolve();
  assert.equal(cache.pending, 1);
  cache.clear();
  assert.equal(cache.pending, 0);
  release();

  assert.equal(await pending, decoded);
  assert.equal(cache.has("/late.m4a"), false);
  assert.equal(cache.snapshot().totalBytes, 0);
});
