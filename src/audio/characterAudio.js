const EMOTE_EVENT = Object.freeze({
  feliz: "emote_happy",
  rir: "emote_laugh",
  gozar: "emote_smug",
  zangado: "emote_angry",
  chocado: "emote_shocked",
  chorar: "emote_cry",
  suplica: "emote_plead",
  provocar: "emote_taunt",
});

const VOICE_VARIANTS = Object.freeze({
  found_village: 2,
  found_palace: 2,
  longest_road: 2,
  largest_army: 2,
  victory: 2,
  robbed: 2,
  trade_done: 2,
  emote_happy: 1,
  emote_laugh: 1,
  emote_smug: 1,
  emote_angry: 1,
  emote_shocked: 1,
  emote_cry: 1,
  emote_plead: 1,
  emote_taunt: 1,
});

export const VOICE_EVENTS = Object.freeze(Object.keys(VOICE_VARIANTS));

export const VOICE_CHARACTERS = Object.freeze([
  "maria", "vlad", "romeo", "protheus", "makuru", "artheria", "muriel", "bones",
]);

export function emoteVoiceEvent(emoteKey) {
  return EMOTE_EVENT[emoteKey] || null;
}

export function voiceSoundKey(character, event) {
  if (!VOICE_CHARACTERS.includes(character) || !VOICE_VARIANTS[event]) return null;
  return `voice_event_${character}_${event}`;
}

export function createCharacterVoiceSoundMap(baseUrl) {
  const root = String(baseUrl || "").replace(/\/?$/, "/");
  const result = {};
  for (const character of VOICE_CHARACTERS) {
    for (const [event, count] of Object.entries(VOICE_VARIANTS)) {
      const key = voiceSoundKey(character, event);
      result[key] = Array.from({ length: count }, (_, index) => {
        const suffix = event.startsWith("emote_") ? "" : `_${String(index + 1).padStart(2, "0")}`;
        return `${root}${character}/${character}_${event}${suffix}.m4a`;
      });
    }
  }
  return result;
}

export const TROOP_CARD_SOUND_KEYS = Object.freeze({
  cavaleiro: "troopCardKnight",
  arqueiro: "troopCardArcher",
  catapulta: "troopCardCatapult",
});

export function createTroopCardSoundMap(baseUrl) {
  const root = String(baseUrl || "").replace(/\/?$/, "/");
  return {
    troopCardKnightHorse: [`${root}knight-horse.m4a`],
    troopCardKnightSword1: [`${root}knight-sword-1.m4a`],
    troopCardKnightSword2: [`${root}knight-sword-2.m4a`],
    troopCardKnightSword3: [`${root}knight-sword-3.m4a`],
    troopCardArcher: [`${root}archer-card.m4a`],
    troopCardCatapult: [`${root}catapult-card.m4a`],
  };
}
