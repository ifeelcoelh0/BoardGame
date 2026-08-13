import { buildPerformanceReport } from "./performanceHealth.js";
const probes = new Map();

function isEnabled() {
  if (typeof window === "undefined") return false;
  try {
    return new URLSearchParams(window.location.search).get("perf") === "1";
  } catch {
    return false;
  }
}

function publish() {
  if (typeof window === "undefined") return;
  if (!probes.size) {
    try { delete window.__RDD_PERF__; } catch { window.__RDD_PERF__ = undefined; }
    return;
  }
  const snapshot = () => Object.fromEntries(
    [...probes.entries()].map(([name, getSnapshot]) => [name, getSnapshot()]),
  );
  window.__RDD_PERF__ = Object.freeze({
    snapshot,
    report() {
      const viewport = typeof window !== "undefined" ? { width: window.innerWidth, height: window.innerHeight, devicePixelRatio: window.devicePixelRatio || 1 } : null;
      return buildPerformanceReport(snapshot(), {
        userAgent: globalThis.navigator?.userAgent,
        hardwareConcurrency: globalThis.navigator?.hardwareConcurrency,
        deviceMemory: globalThis.navigator?.deviceMemory,
        viewport,
      });
    },
  });
}

/**
 * Opt-in diagnostics for real hardware. Add `?perf=1` to the game URL, then
 * call `__RDD_PERF__.snapshot()` for raw counters or `__RDD_PERF__.report()` for a health summary in DevTools. Nothing is exposed otherwise.
 */
export function registerPerformanceProbe(name, getSnapshot) {
  if (!isEnabled() || typeof getSnapshot !== "function") return () => {};
  probes.set(name, getSnapshot);
  publish();
  return () => {
    if (probes.get(name) === getSnapshot) probes.delete(name);
    publish();
  };
}
