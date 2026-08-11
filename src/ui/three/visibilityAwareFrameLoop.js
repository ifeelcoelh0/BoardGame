/**
 * RAF scheduler shared by the 3D experiences.
 *
 * It deliberately separates "browser cadence" (requestAnimationFrame) from
 * "scene cadence" (targetFps). A scene can therefore stay fluid during camera
 * motion while avoiding a full GPU render on every display refresh when only
 * ambient animation is changing.
 */
export function createVisibilityAwareFrameLoop({
  onFrame,
  getTargetFps = () => 60,
  visibilityTarget = typeof document !== "undefined" ? document : null,
  requestFrame = typeof requestAnimationFrame === "function" ? requestAnimationFrame : null,
  cancelFrame = typeof cancelAnimationFrame === "function" ? cancelAnimationFrame : null,
} = {}) {
  if (typeof onFrame !== "function") throw new TypeError("onFrame must be a function");
  if (typeof requestFrame !== "function" || typeof cancelFrame !== "function") {
    throw new TypeError("requestAnimationFrame/cancelAnimationFrame are required");
  }

  let disposed = false;
  let raf = 0;
  let lastRenderedAt = null;
  let lastTickAt = null;
  let nextRenderAt = null;
  let previousTargetFps = null;
  let elapsed = 0;
  let visibleElapsed = 0;
  let renderedFrames = 0;
  let skippedFrames = 0;
  let pauseCount = 0;

  const isHidden = () => visibilityTarget?.hidden === true;

  const schedule = () => {
    if (disposed || raf || isHidden()) return;
    raf = requestFrame(tick);
  };

  function tick(now) {
    raf = 0;
    if (disposed || isHidden()) return;

    if (lastTickAt !== null) visibleElapsed += Math.max(0, now - lastTickAt) / 1000;
    lastTickAt = now;

    const requestedFps = Number(getTargetFps());
    const targetFps = Number.isFinite(requestedFps) ? Math.max(1, requestedFps) : 60;
    const minInterval = 1000 / targetFps;

    // When cadence changes (idle ↔ camera/scroll animation), start the new
    // cadence immediately. Otherwise keep a stable deadline instead of moving
    // the deadline to `now` every render; this avoids dropping to ~48 fps on a
    // 144 Hz display while targeting 60 fps.
    if (previousTargetFps !== targetFps || nextRenderAt === null) {
      previousTargetFps = targetFps;
      nextRenderAt = now;
    }

    const due = now >= nextRenderAt - 0.75;
    if (due) {
      const delta = lastRenderedAt === null ? 0 : Math.min(0.05, Math.max(0, now - lastRenderedAt) / 1000);
      lastRenderedAt = now;
      elapsed += delta;
      renderedFrames += 1;
      onFrame({ now, delta, elapsed, targetFps });

      do {
        nextRenderAt += minInterval;
      } while (nextRenderAt <= now);
    } else {
      skippedFrames += 1;
    }

    schedule();
  }

  const handleVisibilityChange = () => {
    if (isHidden()) {
      if (raf) cancelFrame(raf);
      raf = 0;
      lastRenderedAt = null;
      lastTickAt = null;
      nextRenderAt = null;
      previousTargetFps = null;
      pauseCount += 1;
      return;
    }
    // A resumed scene starts with delta=0, so hidden time never advances a
    // signature, scroll animation or physics-like visual effect in one jump.
    lastRenderedAt = null;
    lastTickAt = null;
    nextRenderAt = null;
    previousTargetFps = null;
    schedule();
  };

  visibilityTarget?.addEventListener?.("visibilitychange", handleVisibilityChange);
  schedule();

  return {
    dispose() {
      if (disposed) return;
      disposed = true;
      if (raf) cancelFrame(raf);
      raf = 0;
      visibilityTarget?.removeEventListener?.("visibilitychange", handleVisibilityChange);
    },
    getStats() {
      return {
        renderedFrames,
        skippedFrames,
        pauseCount,
        elapsed,
        visibleElapsed,
        averageRenderedFps: visibleElapsed > 0 ? renderedFrames / visibleElapsed : 0,
      };
    },
  };
}
