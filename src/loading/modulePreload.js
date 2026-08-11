const DEFAULT_DELAY_MS = 350;

export function scheduleModulePreload(loader, options = {}) {
  if (typeof loader !== "function") {
    throw new TypeError("O preload requer uma função loader.");
  }

  const delay = Number.isFinite(options.delay) ? Math.max(0, options.delay) : DEFAULT_DELAY_MS;
  let cancelled = false;
  let timerId = null;
  let idleId = null;

  const run = () => {
    if (cancelled) return;
    Promise.resolve()
      .then(loader)
      .catch(() => {
        // O lazy import normal volta a tentar quando o módulo for realmente necessário.
      });
  };

  if (typeof globalThis.requestIdleCallback === "function") {
    idleId = globalThis.requestIdleCallback(run, { timeout: delay + 1200 });
  } else {
    timerId = globalThis.setTimeout(run, delay);
  }

  return () => {
    cancelled = true;
    if (idleId !== null && typeof globalThis.cancelIdleCallback === "function") {
      globalThis.cancelIdleCallback(idleId);
    }
    if (timerId !== null) globalThis.clearTimeout(timerId);
  };
}

export function preloadBoardModule() {
  return import("../ui/board/Board3D.jsx");
}
