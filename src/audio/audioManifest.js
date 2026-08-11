import { createCharacterVoiceSoundMap, createTroopCardSoundMap } from "./characterAudio.js";

function normalizeBaseUrl(baseUrl) {
  const value = String(baseUrl || "/");
  return value.endsWith("/") ? value : `${value}/`;
}

function freezeSoundMap(sounds) {
  for (const urls of Object.values(sounds)) Object.freeze(urls);
  return Object.freeze(sounds);
}

export function createAudioManifest(baseUrl = import.meta.env?.BASE_URL || "/") {
    const AUDIO_ASSET_BASE = `${normalizeBaseUrl(baseUrl)}assets/audio/`;
    const VOICE_ASSET_BASE = `${AUDIO_ASSET_BASE}voices/`;
    const TROOP_AUDIO_ASSET_BASE = `${AUDIO_ASSET_BASE}troops/`;
    const sounds = {
        diceShake: [AUDIO_ASSET_BASE + "diceShake-1.m4a", AUDIO_ASSET_BASE + "diceShake-2.m4a", AUDIO_ASSET_BASE + "diceShake-3.m4a"],
        diceThrow: [AUDIO_ASSET_BASE + "diceThrow.m4a"],
        cardSlide: [AUDIO_ASSET_BASE + "cardSlide.m4a"],
        buildHit: [AUDIO_ASSET_BASE + "buildHit.m4a"],
        coinDrop: [AUDIO_ASSET_BASE + "coinDrop.m4a"],
        fanfareWin: [AUDIO_ASSET_BASE + "fanfareWin.m4a"],
        music: [AUDIO_ASSET_BASE + "main-theme.m4a"],
        lobbyFireplace: [AUDIO_ASSET_BASE + "lobby-fireplace.m4a"],
        tsunami: [AUDIO_ASSET_BASE + "disaster-tsunami.m4a"],
        lobbyStart: [AUDIO_ASSET_BASE + "lobby-start-medieval.m4a"],
        lobbySignature: [AUDIO_ASSET_BASE + "lobby-signature.m4a"],
        uiClick: [AUDIO_ASSET_BASE + "ui-click.m4a"],
        yourTurn: [AUDIO_ASSET_BASE + "turn-notification.m4a"],
        tradeOffer: [AUDIO_ASSET_BASE + "trade-offer.m4a"],
        disasterGreed: [AUDIO_ASSET_BASE + "disaster-greed.m4a"],
        disasterPlague: [AUDIO_ASSET_BASE + "disaster-plague.m4a"],
        disasterTribute: [AUDIO_ASSET_BASE + "disaster-tribute.m4a"],
        lobbyBook: [AUDIO_ASSET_BASE + "lobby-book-page.m4a"],
        swordHit: [AUDIO_ASSET_BASE + "swordHit.m4a"],
        catCreak: [AUDIO_ASSET_BASE + "catCreak.m4a"],
        arrowHit: [AUDIO_ASSET_BASE + "arrowHit.m4a"],
        voice_vlad: [AUDIO_ASSET_BASE + "voice_vlad-1.m4a", AUDIO_ASSET_BASE + "voice_vlad-2.m4a", AUDIO_ASSET_BASE + "voice_vlad-3.m4a"],
        voice_maria: [AUDIO_ASSET_BASE + "voice_maria.m4a"],
        voice_protheus: [AUDIO_ASSET_BASE + "voice_protheus.m4a"],
        voice_romeo: [AUDIO_ASSET_BASE + "voice_romeo.m4a"],
        voice_makuru: [AUDIO_ASSET_BASE + "voice_makuru.m4a"],
        voice_muriel: [AUDIO_ASSET_BASE + "voice_muriel-1.m4a", AUDIO_ASSET_BASE + "voice_muriel-2.m4a"],
        voice_bones: [AUDIO_ASSET_BASE + "voice_bones.m4a"],
        dragonFlap: [AUDIO_ASSET_BASE + "dragonFlap.m4a"],
        swoop: [AUDIO_ASSET_BASE + "swoop.m4a"],
        harp: [AUDIO_ASSET_BASE + "harp.m4a"],
        em_muriel_feliz: [AUDIO_ASSET_BASE + "em_muriel_feliz.m4a"],
        em_muriel_gozar: [AUDIO_ASSET_BASE + "em_muriel_gozar.m4a"],
        em_muriel_zangado: [AUDIO_ASSET_BASE + "em_muriel_zangado-1.m4a", AUDIO_ASSET_BASE + "em_muriel_zangado-2.m4a"],
        em_muriel_provocar: [AUDIO_ASSET_BASE + "em_muriel_provocar-1.m4a", AUDIO_ASSET_BASE + "em_muriel_provocar-2.m4a", AUDIO_ASSET_BASE + "em_muriel_provocar-3.m4a"],
        em_muriel_chorar: [AUDIO_ASSET_BASE + "em_muriel_chorar.m4a"],
        em_romeo_provocar: [AUDIO_ASSET_BASE + "em_romeo_provocar-1.m4a", AUDIO_ASSET_BASE + "em_romeo_provocar-2.m4a", AUDIO_ASSET_BASE + "em_romeo_provocar-3.m4a"],
        em_romeo_zangado: [AUDIO_ASSET_BASE + "em_romeo_zangado-1.m4a", AUDIO_ASSET_BASE + "em_romeo_zangado-2.m4a", AUDIO_ASSET_BASE + "em_romeo_zangado-3.m4a"],
        em_maria_chorar: [AUDIO_ASSET_BASE + "em_maria_chorar.m4a"],
        em_maria_suplica: [AUDIO_ASSET_BASE + "em_maria_suplica.m4a"],
        em_maria_zangado: [AUDIO_ASSET_BASE + "em_maria_zangado.m4a"],
        em_maria_chocado: [AUDIO_ASSET_BASE + "em_maria_chocado.m4a"],
        em_maria_provocar: [AUDIO_ASSET_BASE + "em_maria_provocar.m4a"],
        em_maria_gozar: [AUDIO_ASSET_BASE + "em_maria_gozar-1.m4a", AUDIO_ASSET_BASE + "em_maria_gozar-2.m4a", AUDIO_ASSET_BASE + "em_maria_gozar-3.m4a"],
        em_protheus_chocado: [AUDIO_ASSET_BASE + "em_protheus_chocado.m4a"],
        em_protheus_provocar: [AUDIO_ASSET_BASE + "em_protheus_provocar.m4a"],
        em_protheus_zangado: [AUDIO_ASSET_BASE + "em_protheus_zangado.m4a"],
        em_protheus_suplica: [AUDIO_ASSET_BASE + "em_protheus_suplica.m4a"],
        em_protheus_gozar: [AUDIO_ASSET_BASE + "em_protheus_gozar.m4a"],
        em_protheus_chorar: [AUDIO_ASSET_BASE + "em_protheus_chorar.m4a"],
        em_makuru_zangado: [AUDIO_ASSET_BASE + "em_makuru_zangado-1.m4a", AUDIO_ASSET_BASE + "em_makuru_zangado-2.m4a", AUDIO_ASSET_BASE + "em_makuru_zangado-3.m4a"],
        em_makuru_chocado: [AUDIO_ASSET_BASE + "em_makuru_chocado-1.m4a", AUDIO_ASSET_BASE + "em_makuru_chocado-2.m4a", AUDIO_ASSET_BASE + "em_makuru_chocado-3.m4a"],
        em_makuru_gozar: [AUDIO_ASSET_BASE + "em_makuru_gozar.m4a"],
        em_makuru_provocar: [AUDIO_ASSET_BASE + "em_makuru_provocar.m4a"],
        em_makuru_chorar: [AUDIO_ASSET_BASE + "em_makuru_chorar.m4a"],
        em_makuru_suplica: [AUDIO_ASSET_BASE + "em_makuru_suplica.m4a"],
        em_vlad_rir: [AUDIO_ASSET_BASE + "em_vlad_rir.m4a"],
        em_vlad_provocar: [AUDIO_ASSET_BASE + "em_vlad_provocar.m4a"],
        em_bones_rir: [AUDIO_ASSET_BASE + "em_bones_rir.m4a"],
        dragonRoar: [AUDIO_ASSET_BASE + "dragonRoar.m4a"]
    };
    Object.assign(sounds, createCharacterVoiceSoundMap(VOICE_ASSET_BASE), createTroopCardSoundMap(TROOP_AUDIO_ASSET_BASE));
        return freezeSoundMap(sounds);
}

export const AUDIO_SOUNDS = createAudioManifest();
export const AUDIO_SOUND_ALIASES = Object.freeze({ em_bones_feliz: "em_bones_rir", em_bones_gozar: "em_bones_rir" });

/* Public policy is exposed as immutable value lists, not mutable Set instances. */
export const AUDIO_STREAMED_SOUND_KEYS = Object.freeze(["music"]);

/* These sounds are loaded on demand. Long/looping assets should not compete with
   the lobby render during startup. */
export const AUDIO_PRIME_SKIP_SOUND_KEYS = Object.freeze([
  ...AUDIO_STREAMED_SOUND_KEYS,
  "lobbyFireplace",
  "tsunami",
  "lobbyStart",
]);

export function isStreamedSoundKey(name) {
  return AUDIO_STREAMED_SOUND_KEYS.includes(name);
}

export function shouldPrimeSoundKey(name) {
  return !AUDIO_PRIME_SKIP_SOUND_KEYS.includes(name);
}
