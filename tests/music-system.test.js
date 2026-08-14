import test from "node:test";
import assert from "node:assert/strict";
import { createMusicCatalog, GAME_MUSIC_TRACKS, MUSIC_TRACK, chooseNextGameTrack } from "../src/audio/musicCatalog.js";
import { highestPublicVictoryPoints, shouldEnterFinaleMusic } from "../src/audio/gameMusicState.js";

function scoringGame({ publicPoints = 0, secretPoints = 0, phase = "play" } = {}) {
  const builds = {};
  for (let index = 0; index < publicPoints; index += 1) builds[`v${index}`] = { p: 0, t: 1 };
  return {
    phase,
    mode: "dragao",
    players: [{ devNew: Array.from({ length: secretPoints }, (_, index) => ({ id: index, kind: "vp" })), devOld: [], troops: {} }],
    builds,
    roads: {},
    lr: null,
    la: null,
  };
}

test("soundtrack catalog keeps the lobby theme and four streamed game tracks explicit", () => {
  const catalog = createMusicCatalog({
    music: ["/main.m4a"],
    musicBleedingIronVelvet: ["/bleeding.m4a"],
    musicDustLute: ["/dust.m4a"],
    musicVelvetLuteFuzz: ["/velvet.m4a"],
    musicFinale9vp: ["/finale.m4a"],
  });
  assert.equal(catalog[MUSIC_TRACK.MAIN_THEME].uri, "/main.m4a");
  assert.equal(catalog[MUSIC_TRACK.ENDGAME].uri, "/finale.m4a");
  assert.equal(GAME_MUSIC_TRACKS.length, 4);
  assert.ok(GAME_MUSIC_TRACKS.includes(MUSIC_TRACK.MAIN_THEME));
});

test("game shuffle never repeats the track that just finished", () => {
  assert.notEqual(chooseNextGameTrack(MUSIC_TRACK.MAIN_THEME, () => 0), MUSIC_TRACK.MAIN_THEME);
  assert.notEqual(chooseNextGameTrack(MUSIC_TRACK.DUST_LUTE, () => 0.999), MUSIC_TRACK.DUST_LUTE);
});

test("endgame music is triggered by eight public points, never by secret VP cards", () => {
  assert.equal(highestPublicVictoryPoints(scoringGame({ publicPoints: 7, secretPoints: 5 })), 7);
  assert.equal(shouldEnterFinaleMusic(scoringGame({ publicPoints: 7, secretPoints: 5 })), false);
  assert.equal(shouldEnterFinaleMusic(scoringGame({ publicPoints: 8, secretPoints: 0 })), true);
  assert.equal(shouldEnterFinaleMusic(scoringGame({ publicPoints: 8, phase: "lobby" })), false);
});

test("music playback controller switches lobby → shuffle → endgame without decoding tracks", async () => {
  const originalAudio = globalThis.Audio;
  class FakeAudio {
    constructor() { this.listeners = {}; this.paused = true; this.src = ""; this.loop = false; this.currentTime = 0; this.duration = 120; }
    addEventListener(type, callback) { this.listeners[type] = callback; }
    play() { this.paused = false; return Promise.resolve(); }
    pause() { this.paused = true; }
    removeAttribute(name) { if (name === "src") this.src = ""; }
    load() {}
  }
  class FakeParam {
    constructor() { this.value = 1; }
    cancelScheduledValues() {}
    setValueAtTime(value) { this.value = value; }
    linearRampToValueAtTime(value) { this.value = value; }
  }
  const context = {
    currentTime: 0,
    createGain() { return { gain: new FakeParam(), connect() {}, disconnect() {} }; },
    createMediaElementSource() { return { connect() {}, disconnect() {} }; },
  };
  globalThis.Audio = FakeAudio;
  try {
    const { MusicPlaybackController } = await import("../src/audio/musicPlaybackController.js");
    const catalog = createMusicCatalog({
      music: ["/main.m4a"],
      musicBleedingIronVelvet: ["/bleeding.m4a"],
      musicDustLute: ["/dust.m4a"],
      musicVelvetLuteFuzz: ["/velvet.m4a"],
      musicFinale9vp: ["/finale.m4a"],
    });
    const player = new MusicPlaybackController({ audioContext: context, destination: {}, catalog, random: () => 0 });
    player.start();
    assert.equal(player.snapshot().activeTrackId, MUSIC_TRACK.MAIN_THEME);
    player.setScene("game");
    assert.equal(player.snapshot().activeTrackId, MUSIC_TRACK.BLEEDING_IRON_VELVET);
    player.setScene("finale");
    assert.equal(player.snapshot().activeTrackId, MUSIC_TRACK.ENDGAME);
    player.stop();
  } finally {
    globalThis.Audio = originalAudio;
  }
});
