export const LOBBY_STARTUP = Object.freeze({
  pixelRatioCap: 1,
  fps: 20,
  delayMs: 650,
  idleTimeoutMs: 1400,
});

export function lobbyStartupPixelRatio(devicePixelRatio, fullCap) {
  const dpr = Number.isFinite(Number(devicePixelRatio)) ? Math.max(0.5, Number(devicePixelRatio)) : 1;
  const cap = Number.isFinite(Number(fullCap)) ? Math.max(0.5, Number(fullCap)) : 1;
  return Math.min(dpr, cap, LOBBY_STARTUP.pixelRatioCap);
}

export function lobbyTargetFps({ startupComplete, codexActive, cameraMoving, scrollAnimating, graphics }) {
  if (!startupComplete) return Math.min(LOBBY_STARTUP.fps, graphics?.lobby?.idleFps || LOBBY_STARTUP.fps);
  if (codexActive) return graphics.lobby.codexFps;
  if (cameraMoving || scrollAnimating) return graphics.lobby.activeFps;
  return graphics.lobby.idleFps;
}

export function scheduleLobbyStartupUpgrade(callback, host = globalThis) {
  if (typeof callback !== "function") throw new TypeError("callback must be a function");
  let cancelled = false;
  let timerId = null;
  let idleId = null;
  const run = () => {
    if (cancelled) return;
    if (typeof host.requestIdleCallback === "function") {
      idleId = host.requestIdleCallback(() => !cancelled && callback(), { timeout: LOBBY_STARTUP.idleTimeoutMs });
    } else {
      callback();
    }
  };
  timerId = host.setTimeout(run, LOBBY_STARTUP.delayMs);
  return () => {
    cancelled = true;
    if (timerId != null) host.clearTimeout?.(timerId);
    if (idleId != null && typeof host.cancelIdleCallback === "function") host.cancelIdleCallback(idleId);
  };
}

