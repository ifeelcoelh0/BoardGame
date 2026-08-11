/**
 * Canonical 3D quality knobs shared by lobby and board.
 *
 * These are deliberately renderer/scene concerns, not UI settings.  The next
 * settings pass can persist one id and feed it into the existing controllers
 * without teaching either scene about localStorage or menus.
 */
export const GRAPHICS_QUALITY = Object.freeze({
  LOW: "low",
  MEDIUM: "medium",
  HIGH: "high",
});

export const DEFAULT_GRAPHICS_QUALITY = GRAPHICS_QUALITY.HIGH;

const PROFILES = Object.freeze({
  [GRAPHICS_QUALITY.LOW]: Object.freeze({
    id: GRAPHICS_QUALITY.LOW,
    renderer: Object.freeze({ antialias: false, lobbyPixelRatioCap: 1.1, boardPixelRatioCap: 1.15 }),
    lobby: Object.freeze({ activeFps: 45, idleFps: 20, codexFps: 8, shadowHz: 5, keyShadowMap: 512, fireShadowMap: 256 }),
    board: Object.freeze({ fps: 30, waterNormalEvery: 10, ambientDetail: 0.5 }),
  }),
  [GRAPHICS_QUALITY.MEDIUM]: Object.freeze({
    id: GRAPHICS_QUALITY.MEDIUM,
    renderer: Object.freeze({ antialias: true, lobbyPixelRatioCap: 1.35, boardPixelRatioCap: 1.5 }),
    lobby: Object.freeze({ activeFps: 60, idleFps: 24, codexFps: 10, shadowHz: 8, keyShadowMap: 768, fireShadowMap: 384 }),
    board: Object.freeze({ fps: 45, waterNormalEvery: 6, ambientDetail: 0.75 }),
  }),
  [GRAPHICS_QUALITY.HIGH]: Object.freeze({
    id: GRAPHICS_QUALITY.HIGH,
    renderer: Object.freeze({ antialias: true, lobbyPixelRatioCap: 1.65, boardPixelRatioCap: 2 }),
    lobby: Object.freeze({ activeFps: 60, idleFps: 30, codexFps: 12, shadowHz: 12, keyShadowMap: 1024, fireShadowMap: 512 }),
    board: Object.freeze({ fps: 60, waterNormalEvery: 4, ambientDetail: 1 }),
  }),
});

export function normalizeGraphicsQuality(value) {
  const key = String(value ?? "").trim().toLowerCase();
  return Object.hasOwn(PROFILES, key) ? key : DEFAULT_GRAPHICS_QUALITY;
}

export function getGraphicsQualityProfile(value) {
  return PROFILES[normalizeGraphicsQuality(value)];
}

/**
 * Development override only. `?gfx=low|medium|high` lets us measure the knobs
 * before exposing them in Settings. An explicit value always wins.
 */
export function resolveGraphicsQualityProfile(explicitValue, search) {
  if (explicitValue != null && explicitValue !== "") return getGraphicsQualityProfile(explicitValue);
  const rawSearch = search ?? (typeof window !== "undefined" ? window.location?.search : "");
  try {
    const query = new URLSearchParams(rawSearch || "");
    return getGraphicsQualityProfile(query.get("gfx"));
  } catch {
    return getGraphicsQualityProfile(DEFAULT_GRAPHICS_QUALITY);
  }
}

export function scaledAmbientCount(base, profile, minimum = 1) {
  const density = Number(profile?.board?.ambientDetail ?? 1);
  return Math.max(minimum, Math.round(base * Math.max(0, Math.min(1, density))));
}
