export const AUDIO_GROUP = Object.freeze({
  UI: "ui",
  SOCIAL: "social",
  GAME: "game",
  COMBAT: "combat",
  CEREMONIAL: "ceremonial",
  VOICE: "voice",
});

const DEFAULT_POLICY = Object.freeze({ group: AUDIO_GROUP.GAME, cooldownMs: 80, ttlMs: 1400 });

export const AUDIO_EFFECT_POLICIES = Object.freeze({
  tap: Object.freeze({ group: AUDIO_GROUP.UI, cooldownMs: 55, ttlMs: 500 }),
  uiClick: Object.freeze({ group: AUDIO_GROUP.UI, cooldownMs: 65, ttlMs: 550 }),
  lobbyBook: Object.freeze({ group: AUDIO_GROUP.UI, cooldownMs: 180, ttlMs: 900 }),
  lobbySignature: Object.freeze({ group: AUDIO_GROUP.UI, cooldownMs: 500, ttlMs: 1400 }),
  lobbyStart: Object.freeze({ group: AUDIO_GROUP.CEREMONIAL, cooldownMs: 2500, ttlMs: 2600 }),
  yourTurn: Object.freeze({ group: AUDIO_GROUP.CEREMONIAL, cooldownMs: 1400, ttlMs: 1700 }),
  tradeOffer: Object.freeze({ group: AUDIO_GROUP.GAME, cooldownMs: 700, ttlMs: 1300 }),
  disasterGreed: Object.freeze({ group: AUDIO_GROUP.CEREMONIAL, cooldownMs: 3000, ttlMs: 3400 }),
  disasterPlague: Object.freeze({ group: AUDIO_GROUP.CEREMONIAL, cooldownMs: 3000, ttlMs: 2400 }),
  disasterTribute: Object.freeze({ group: AUDIO_GROUP.CEREMONIAL, cooldownMs: 3000, ttlMs: 2600 }),
  chatpop: Object.freeze({ group: AUDIO_GROUP.SOCIAL, cooldownMs: 260, ttlMs: 800 }),
  voice: Object.freeze({ group: AUDIO_GROUP.VOICE, cooldownMs: 520, ttlMs: 2200 }),
  dice: Object.freeze({ group: AUDIO_GROUP.GAME, cooldownMs: 900, ttlMs: 1800 }),
  coin: Object.freeze({ group: AUDIO_GROUP.GAME, cooldownMs: 220, ttlMs: 900 }),
  build: Object.freeze({ group: AUDIO_GROUP.GAME, cooldownMs: 180, ttlMs: 1100 }),
  card: Object.freeze({ group: AUDIO_GROUP.GAME, cooldownMs: 180, ttlMs: 900 }),
  bad: Object.freeze({ group: AUDIO_GROUP.GAME, cooldownMs: 260, ttlMs: 900 }),
  dragon: Object.freeze({ group: AUDIO_GROUP.CEREMONIAL, cooldownMs: 1700, ttlMs: 2200 }),
  disaster: Object.freeze({ group: AUDIO_GROUP.CEREMONIAL, cooldownMs: 2200, ttlMs: 2300 }),
  tsunami: Object.freeze({ group: AUDIO_GROUP.CEREMONIAL, cooldownMs: 4200, ttlMs: 2600 }),
  award: Object.freeze({ group: AUDIO_GROUP.CEREMONIAL, cooldownMs: 1800, ttlMs: 2200 }),
  fanfare: Object.freeze({ group: AUDIO_GROUP.CEREMONIAL, cooldownMs: 4200, ttlMs: 2800 }),
  flap: Object.freeze({ group: AUDIO_GROUP.GAME, cooldownMs: 650, ttlMs: 1300 }),
  swoop: Object.freeze({ group: AUDIO_GROUP.GAME, cooldownMs: 320, ttlMs: 900 }),
  deal: Object.freeze({ group: AUDIO_GROUP.GAME, cooldownMs: 300, ttlMs: 1100 }),
  swordP: Object.freeze({ group: AUDIO_GROUP.COMBAT, cooldownMs: 140, ttlMs: 1000 }),
  bowP: Object.freeze({ group: AUDIO_GROUP.COMBAT, cooldownMs: 140, ttlMs: 1000 }),
  catP: Object.freeze({ group: AUDIO_GROUP.COMBAT, cooldownMs: 180, ttlMs: 1200 }),
  clash: Object.freeze({ group: AUDIO_GROUP.COMBAT, cooldownMs: 220, ttlMs: 900 }),
  arrow: Object.freeze({ group: AUDIO_GROUP.COMBAT, cooldownMs: 160, ttlMs: 900 }),
  catapult: Object.freeze({ group: AUDIO_GROUP.COMBAT, cooldownMs: 260, ttlMs: 1200 }),
  horn: Object.freeze({ group: AUDIO_GROUP.CEREMONIAL, cooldownMs: 1400, ttlMs: 1800 }),
  bell: Object.freeze({ group: AUDIO_GROUP.CEREMONIAL, cooldownMs: 1100, ttlMs: 1700 }),
  march: Object.freeze({ group: AUDIO_GROUP.CEREMONIAL, cooldownMs: 900, ttlMs: 1300 }),
});

export function audioPolicyForEffect(name) {
  return AUDIO_EFFECT_POLICIES[name] || DEFAULT_POLICY;
}

export function createAudioTriggerGate({ now = () => performance.now() } = {}) {
  const lastPlayedAt = new Map();
  return Object.freeze({
    allow(name) {
      const policy = audioPolicyForEffect(name);
      const current = Number(now());
      const previous = lastPlayedAt.get(name);
      if (Number.isFinite(previous) && current - previous < policy.cooldownMs) return false;
      lastPlayedAt.set(name, current);
      return true;
    },
    reset() { lastPlayedAt.clear(); },
  });
}

export function normalizeAudioCue(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const cue = {};
  if (typeof value.sfx === "string" && value.sfx) cue.sfx = value.sfx;
  if (value.voice && typeof value.voice === "object" && !Array.isArray(value.voice)) {
    const character = typeof value.voice.character === "string" ? value.voice.character : "";
    const event = typeof value.voice.event === "string" ? value.voice.event : "";
    if (character && event) cue.voice = { character, event };
  }
  if (typeof value.troop === "string" && value.troop) cue.troop = value.troop;
  return Object.keys(cue).length ? cue : null;
}

export function freshLogEntries(log, seenId) {
  if (!Array.isArray(log) || !log.length) return [];
  if (seenId == null) return [];
  const fresh = [];
  for (const entry of log) {
    if (entry?.id === seenId) break;
    fresh.push(entry);
  }
  return fresh;
}

export function latestCurrentAudioCue(entries, { now = Date.now(), maxAgeMs = 3200 } = {}) {
  for (const entry of entries || []) {
    const cue = normalizeAudioCue(entry?.audio);
    if (!cue) continue;
    const id = Number(entry?.id);
    if (Number.isFinite(id) && id > 100_000_000_000 && Number(now) - Math.floor(id) > maxAgeMs) return null;
    return cue;
  }
  return null;
}
