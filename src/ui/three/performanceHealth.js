function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function probeTargetFps(snapshot) {
  return finite(snapshot?.targetFps, finite(snapshot?.targetIdleFps, 0));
}

function probeActualFps(snapshot) {
  return finite(snapshot?.averageRenderedFps, 0);
}

function assessProbe(name, snapshot = {}) {
  const targetFps = probeTargetFps(snapshot);
  const actualFps = probeActualFps(snapshot);
  const fpsRatio = targetFps > 0 ? actualFps / targetFps : null;
  const issues = [];
  if (fpsRatio != null && snapshot.visibleElapsed >= 2 && fpsRatio < 0.8) issues.push("fps-below-target");
  if (finite(snapshot.drawCalls) > 250) issues.push("high-draw-calls");
  if (finite(snapshot.textures) > 160) issues.push("high-texture-count");
  if (finite(snapshot.triangles) > 750000) issues.push("high-triangle-count");
  const status = issues.includes("fps-below-target") ? "poor" : issues.length ? "warn" : "good";
  return Object.freeze({
    name,
    status,
    targetFps,
    actualFps,
    fpsRatio: fpsRatio == null ? null : Number(fpsRatio.toFixed(3)),
    drawCalls: finite(snapshot.drawCalls),
    triangles: finite(snapshot.triangles),
    textures: finite(snapshot.textures),
    geometries: finite(snapshot.geometries),
    pixelRatio: finite(snapshot.pixelRatio, 1),
    graphicsQuality: snapshot.graphicsQuality || null,
    issues: Object.freeze(issues),
  });
}

export function buildPerformanceReport(snapshots = {}, environment = {}) {
  const probes = Object.entries(snapshots || {}).map(([name, snapshot]) => assessProbe(name, snapshot));
  const status = probes.some((probe) => probe.status === "poor")
    ? "poor"
    : probes.some((probe) => probe.status === "warn") ? "warn" : "good";
  return Object.freeze({
    status,
    environment: Object.freeze({
      userAgent: environment?.userAgent || null,
      hardwareConcurrency: finite(environment?.hardwareConcurrency, 0) || null,
      deviceMemory: finite(environment?.deviceMemory, 0) || null,
      viewport: environment?.viewport || null,
    }),
    probes: Object.freeze(probes),
  });
}
