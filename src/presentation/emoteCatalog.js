import { t } from "../locales/i18n.js";

const EMOTE_DATA = Object.freeze([
  Object.freeze({ k: "feliz", icon: "RDD_EmoteHappy" }),
  Object.freeze({ k: "rir", icon: "RDD_EmoteLaugh" }),
  Object.freeze({ k: "gozar", icon: "RDD_EmoteTease" }),
  Object.freeze({ k: "zangado", icon: "RDD_EmoteAngry" }),
  Object.freeze({ k: "chocado", icon: "RDD_EmoteShocked" }),
  Object.freeze({ k: "chorar", icon: "RDD_EmoteCry" }),
  Object.freeze({ k: "suplica", icon: "RDD_EmotePlead" }),
  Object.freeze({ k: "provocar", icon: "RDD_EmoteChallenge" }),
]);

export const EMOTES = Object.freeze(EMOTE_DATA.map((emote) => Object.freeze({
  ...emote,
  get n() { return t(`emote.${emote.k}`); },
})));

export function emoteById(id) {
  return EMOTES.find((emote) => emote.k === id) || null;
}
