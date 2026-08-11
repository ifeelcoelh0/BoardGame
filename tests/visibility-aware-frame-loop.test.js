import test from "node:test";
import assert from "node:assert/strict";
import { createVisibilityAwareFrameLoop } from "../src/ui/three/visibilityAwareFrameLoop.js";

function harness({ fps = 30 } = {}) {
  let nextId = 1;
  const pending = new Map();
  const listeners = new Map();
  const visibilityTarget = {
    hidden: false,
    addEventListener(type, fn) { listeners.set(type, fn); },
    removeEventListener(type, fn) { if (listeners.get(type) === fn) listeners.delete(type); },
  };
  const requestFrame = (fn) => {
    const id = nextId++;
    pending.set(id, fn);
    return id;
  };
  const cancelFrame = (id) => pending.delete(id);
  const frames = [];
  const loop = createVisibilityAwareFrameLoop({
    onFrame: (frame) => frames.push(frame),
    getTargetFps: () => fps,
    visibilityTarget,
    requestFrame,
    cancelFrame,
  });
  const step = (now) => {
    const [id, fn] = pending.entries().next().value ?? [];
    assert.ok(fn, "expected a scheduled frame");
    pending.delete(id);
    fn(now);
  };
  const setHidden = (hidden) => {
    visibilityTarget.hidden = hidden;
    listeners.get("visibilitychange")?.();
  };
  return { loop, frames, pending, step, setHidden };
}

test("renders at scene cadence instead of every RAF callback", () => {
  const h = harness({ fps: 30 });
  h.step(0);
  h.step(16);
  h.step(34);
  h.step(50);
  h.step(68);
  assert.equal(h.frames.length, 3);
  assert.equal(h.loop.getStats().skippedFrames, 2);
  h.loop.dispose();
});

test("hidden scenes cancel RAF completely and resume without a giant delta", () => {
  const h = harness({ fps: 60 });
  h.step(0);
  h.step(17);
  h.setHidden(true);
  assert.equal(h.pending.size, 0);
  h.setHidden(false);
  assert.equal(h.pending.size, 1);
  h.step(5000);
  assert.equal(h.frames.at(-1).delta, 0);
  assert.equal(h.loop.getStats().pauseCount, 1);
  h.loop.dispose();
});

test("60 fps target stays near 60 on a 144 Hz RAF cadence", () => {
  const h = harness({ fps: 60 });
  for (let i = 0; i <= 144; i += 1) h.step((1000 / 144) * i);
  assert.ok(h.frames.length >= 59 && h.frames.length <= 62, `rendered ${h.frames.length} frames`);
  h.loop.dispose();
});
