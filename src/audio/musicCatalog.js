import { AUDIO_SOUNDS } from "./audioManifest.js";

export const MUSIC_SCENE = Object.freeze({
  LOBBY: "lobby",
  GAME: "game",
  FINALE: "finale",
});

export const MUSIC_TRACK = Object.freeze({
  MAIN_THEME: "main-theme",
  BLEEDING_IRON_VELVET: "bleeding-iron-and-velvet",
  DUST_LUTE: "dust-and-lute",
  VELVET_LUTE_FUZZ: "velvet-lute-and-fuzz",
  ENDGAME: "endgame",
  // Compatibility alias; the trigger is no longer tied to 9 VP.
  FINALE_9VP: "endgame",
});

/* O tema original está a ~-13,6 LUFS. As novas faixas são entregues já
   normalizadas a -16 LUFS. Este multiplicador evita voltar a transcodificar o
   tema antigo (e perder qualidade) só para igualar loudness. */
const MAIN_THEME_LEVEL = 10 ** (-2.4 / 20);

export function createMusicCatalog(sounds = AUDIO_SOUNDS) {
  return Object.freeze({
    [MUSIC_TRACK.MAIN_THEME]: Object.freeze({
      id: MUSIC_TRACK.MAIN_THEME,
      uri: sounds.music?.[0] || null,
      level: MAIN_THEME_LEVEL,
    }),
    [MUSIC_TRACK.BLEEDING_IRON_VELVET]: Object.freeze({
      id: MUSIC_TRACK.BLEEDING_IRON_VELVET,
      uri: sounds.musicBleedingIronVelvet?.[0] || null,
      level: 1,
    }),
    [MUSIC_TRACK.DUST_LUTE]: Object.freeze({
      id: MUSIC_TRACK.DUST_LUTE,
      uri: sounds.musicDustLute?.[0] || null,
      level: 1,
    }),
    [MUSIC_TRACK.VELVET_LUTE_FUZZ]: Object.freeze({
      id: MUSIC_TRACK.VELVET_LUTE_FUZZ,
      uri: sounds.musicVelvetLuteFuzz?.[0] || null,
      level: 1,
    }),
    [MUSIC_TRACK.ENDGAME]: Object.freeze({
      id: MUSIC_TRACK.ENDGAME,
      uri: sounds.musicFinale9vp?.[0] || null,
      level: 1,
    }),
  });
}

export const GAME_MUSIC_TRACKS = Object.freeze([
  MUSIC_TRACK.MAIN_THEME,
  MUSIC_TRACK.BLEEDING_IRON_VELVET,
  MUSIC_TRACK.DUST_LUTE,
  MUSIC_TRACK.VELVET_LUTE_FUZZ,
]);

export function chooseNextGameTrack(previousTrackId, random = Math.random) {
  const candidates = GAME_MUSIC_TRACKS.filter((trackId) => trackId !== previousTrackId);
  if (!candidates.length) return GAME_MUSIC_TRACKS[0] || null;
  const sample = Number(random());
  const normalized = Number.isFinite(sample) ? Math.max(0, Math.min(0.999999, sample)) : 0;
  return candidates[Math.floor(normalized * candidates.length)];
}
