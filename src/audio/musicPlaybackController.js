import { normalizeDiagnosticError, recordDiagnostic } from "../diagnostics/diagnostics.js";
import {
  GAME_MUSIC_TRACKS,
  MUSIC_SCENE,
  MUSIC_TRACK,
  chooseNextGameTrack,
  createMusicCatalog,
} from "./musicCatalog.js";

const BASE_MUSIC_GAIN = 0.38;
const DEFAULT_CROSSFADE_MS = 2200;
const SHUFFLE_CROSSFADE_MS = 4200;
const SHUFFLE_LEAD_SECONDS = 4.6;

function clamp01(value, fallback = 1) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.min(1, number)) : fallback;
}

function safePlay(element) {
  const result = element?.play?.();
  if (result?.catch) {
    result.catch((error) => recordDiagnostic("music-autoplay-blocked", normalizeDiagnosticError(error)));
  }
}

export class MusicPlaybackController {
  constructor({ audioContext, destination, catalog = createMusicCatalog(), random = Math.random } = {}) {
    if (!audioContext || !destination) throw new TypeError("Music playback requires an AudioContext and destination.");
    this.context = audioContext;
    this.catalog = catalog;
    this.random = random;
    this.master = audioContext.createGain();
    this.master.connect(destination);
    this.volume = 1;
    this.duck = 1;
    this.muted = false;
    this.started = false;
    this.scene = MUSIC_SCENE.LOBBY;
    this.active = -1;
    this.crossfadeToken = 0;
    this.decks = [this.#createDeck(), this.#createDeck()];
    this.#applyMaster(true);
  }

  #createDeck() {
    const element = new Audio();
    element.preload = "metadata";
    element.crossOrigin = "anonymous";
    const source = this.context.createMediaElementSource(element);
    const gain = this.context.createGain();
    gain.gain.value = 0;
    source.connect(gain);
    gain.connect(this.master);
    const deck = { element, source, gain, trackId: null, trackLevel: 1, transitionPending: false };
    element.addEventListener("timeupdate", () => this.#onTimeUpdate(deck));
    element.addEventListener("ended", () => this.#onEnded(deck));
    return deck;
  }

  #targetMasterGain() {
    return this.muted ? 0 : BASE_MUSIC_GAIN * this.volume * this.duck;
  }

  #applyMaster(immediate = false, durationMs = 240) {
    const now = this.context.currentTime;
    const target = this.#targetMasterGain();
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.setValueAtTime(this.master.gain.value, now);
    if (immediate || durationMs <= 0) this.master.gain.setValueAtTime(target, now);
    else this.master.gain.linearRampToValueAtTime(target, now + durationMs / 1000);
  }

  #track(trackId) {
    const track = this.catalog[trackId];
    return track?.uri ? track : null;
  }

  #prepareDeck(index, trackId, loop) {
    const deck = this.decks[index];
    const track = this.#track(trackId);
    if (!track) return null;
    if (deck.trackId !== trackId) {
      deck.element.pause();
      deck.element.src = track.uri;
      deck.element.currentTime = 0;
      deck.trackId = trackId;
    }
    deck.trackLevel = Number.isFinite(track.level) ? track.level : 1;
    deck.transitionPending = false;
    deck.element.loop = loop === true;
    return deck;
  }

  #rampDeck(deck, target, durationMs) {
    const now = this.context.currentTime;
    const gain = deck.gain.gain;
    gain.cancelScheduledValues(now);
    gain.setValueAtTime(gain.value, now);
    if (durationMs <= 0) gain.setValueAtTime(target, now);
    else gain.linearRampToValueAtTime(target, now + durationMs / 1000);
  }

  #stopDeckLater(deck, token, durationMs) {
    globalThis.setTimeout(() => {
      if (token !== this.crossfadeToken) return;
      deck.element.pause();
      deck.gain.gain.value = 0;
      deck.transitionPending = false;
    }, Math.max(0, durationMs) + 80);
  }

  #switchTo(trackId, { loop = false, durationMs = DEFAULT_CROSSFADE_MS, restart = true } = {}) {
    if (!this.started) return false;
    const track = this.#track(trackId);
    if (!track) return false;
    const current = this.active >= 0 ? this.decks[this.active] : null;
    if (current?.trackId === trackId && !restart) {
      current.element.loop = loop;
      current.transitionPending = false;
      if (!this.muted) safePlay(current.element);
      return true;
    }

    const nextIndex = this.active === 0 ? 1 : 0;
    const next = this.#prepareDeck(nextIndex, trackId, loop);
    if (!next) return false;
    this.crossfadeToken += 1;
    const token = this.crossfadeToken;
    next.gain.gain.value = 0;
    if (!this.muted) safePlay(next.element);
    this.#rampDeck(next, next.trackLevel, durationMs);
    if (current) {
      current.transitionPending = true;
      this.#rampDeck(current, 0, durationMs);
      this.#stopDeckLater(current, token, durationMs);
    }
    this.active = nextIndex;
    return true;
  }

  #nextGameTrack() {
    const previous = this.active >= 0 ? this.decks[this.active].trackId : null;
    return chooseNextGameTrack(previous, this.random);
  }

  #onTimeUpdate(deck) {
    if (!this.started || this.scene !== MUSIC_SCENE.GAME || deck !== this.decks[this.active]) return;
    if (deck.element.loop || deck.transitionPending || !Number.isFinite(deck.element.duration)) return;
    const remaining = deck.element.duration - deck.element.currentTime;
    if (remaining > SHUFFLE_LEAD_SECONDS || remaining < 0) return;
    deck.transitionPending = true;
    const next = this.#nextGameTrack();
    if (!next || !this.#switchTo(next, { loop: false, durationMs: SHUFFLE_CROSSFADE_MS })) deck.transitionPending = false;
  }

  #onEnded(deck) {
    if (!this.started || this.scene !== MUSIC_SCENE.GAME || deck !== this.decks[this.active]) return;
    const next = this.#nextGameTrack();
    if (next) this.#switchTo(next, { loop: false, durationMs: 500 });
  }

  start() {
    if (this.started) return;
    this.started = true;
    this.setScene(this.scene, { immediate: true });
  }

  setScene(scene, { immediate = false } = {}) {
    if (!Object.values(MUSIC_SCENE).includes(scene)) return false;
    const previousScene = this.scene;
    this.scene = scene;
    if (!this.started) return true;
    const durationMs = immediate ? 0 : DEFAULT_CROSSFADE_MS;

    if (scene === MUSIC_SCENE.LOBBY) {
      this.duck = 1;
      this.#applyMaster(immediate, immediate ? 0 : 900);
      return this.#switchTo(MUSIC_TRACK.MAIN_THEME, { loop: true, durationMs, restart: false });
    }
    if (scene === MUSIC_SCENE.FINALE) {
      this.duck = 1;
      this.#applyMaster(false, 900);
      return this.#switchTo(MUSIC_TRACK.FINALE_9VP, { loop: true, durationMs: immediate ? 0 : 2400 });
    }

    this.duck = 1;
    this.#applyMaster(false, 1100);
    if (previousScene === MUSIC_SCENE.GAME && this.active >= 0) return true;
    const next = this.#nextGameTrack();
    return next ? this.#switchTo(next, { loop: false, durationMs: immediate ? 0 : 1800 }) : false;
  }

  beginGameEntry() {
    this.duck = 0.16;
    this.#applyMaster(false, 1650);
  }

  cancelGameEntry() {
    this.duck = 1;
    this.#applyMaster(false, 700);
  }

  setVolume(value) {
    this.volume = clamp01(value, this.volume);
    this.#applyMaster(false, 100);
  }

  setMuted(value) {
    this.muted = value === true;
    this.#applyMaster(true);
    const active = this.active >= 0 ? this.decks[this.active] : null;
    if (this.muted) this.decks.forEach((deck) => deck.element.pause());
    else if (this.started && active) safePlay(active.element);
  }

  stop() {
    this.started = false;
    this.crossfadeToken += 1;
    for (const deck of this.decks) {
      deck.element.pause();
      deck.element.removeAttribute("src");
      deck.element.load();
      try { deck.source.disconnect(); } catch {}
      try { deck.gain.disconnect(); } catch {}
    }
    try { this.master.disconnect(); } catch {}
  }

  snapshot() {
    return {
      scene: this.scene,
      activeTrackId: this.active >= 0 ? this.decks[this.active].trackId : null,
      muted: this.muted,
      volume: this.volume,
      duck: this.duck,
      started: this.started,
      gameTracks: [...GAME_MUSIC_TRACKS],
    };
  }
}
