export const EMOTES = Object.freeze([
  Object.freeze({ k: "feliz", icon: "RDD_EmoteHappy", n: "Feliz" }),
  Object.freeze({ k: "rir", icon: "RDD_EmoteLaugh", n: "Rir" }),
  Object.freeze({ k: "gozar", icon: "RDD_EmoteTease", n: "Gozar" }),
  Object.freeze({ k: "zangado", icon: "RDD_EmoteAngry", n: "Zangado" }),
  Object.freeze({ k: "chocado", icon: "RDD_EmoteShocked", n: "Chocado" }),
  Object.freeze({ k: "chorar", icon: "RDD_EmoteCry", n: "Chorar" }),
  Object.freeze({ k: "suplica", icon: "RDD_EmotePlead", n: "Súplica" }),
  Object.freeze({ k: "provocar", icon: "RDD_EmoteChallenge", n: "Provocar" }),
]);

export function emoteById(id) {
  return EMOTES.find((emote) => emote.k === id) || null;
}
