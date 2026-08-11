export function rendererPerformanceSnapshot(renderer, extra = {}) {
  const info = renderer?.info;
  return {
    drawCalls: info?.render?.calls ?? 0,
    triangles: info?.render?.triangles ?? 0,
    points: info?.render?.points ?? 0,
    lines: info?.render?.lines ?? 0,
    geometries: info?.memory?.geometries ?? 0,
    textures: info?.memory?.textures ?? 0,
    programs: Array.isArray(info?.programs) ? info.programs.length : 0,
    pixelRatio: renderer?.getPixelRatio?.() ?? 1,
    ...extra,
  };
}
