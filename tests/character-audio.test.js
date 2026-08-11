import test from "node:test";
import assert from "node:assert/strict";
import {
  VOICE_CHARACTERS,
  createCharacterVoiceSoundMap,
  createTroopCardSoundMap,
  emoteVoiceEvent,
  voiceSoundKey,
} from "../src/audio/characterAudio.js";

test("voice catalog exposes eight characters and all specific events", () => {
  assert.equal(VOICE_CHARACTERS.length, 8);
  const map = createCharacterVoiceSoundMap("/assets/audio/voices");
  for (const character of VOICE_CHARACTERS) {
    assert.equal(map[voiceSoundKey(character, "found_village")].length, 2);
    assert.equal(map[voiceSoundKey(character, "found_palace")].length, 2);
    assert.equal(map[voiceSoundKey(character, "longest_road")].length, 2);
    assert.equal(map[voiceSoundKey(character, "largest_army")].length, 2);
    assert.equal(map[voiceSoundKey(character, "victory")].length, 2);
    assert.equal(map[voiceSoundKey(character, "robbed")].length, 2);
    assert.equal(map[voiceSoundKey(character, "trade_done")].length, 2);
  }
});

test("Portuguese emote keys map to the new recorded events", () => {
  assert.equal(emoteVoiceEvent("feliz"), "emote_happy");
  assert.equal(emoteVoiceEvent("rir"), "emote_laugh");
  assert.equal(emoteVoiceEvent("gozar"), "emote_smug");
  assert.equal(emoteVoiceEvent("zangado"), "emote_angry");
  assert.equal(emoteVoiceEvent("chocado"), "emote_shocked");
  assert.equal(emoteVoiceEvent("chorar"), "emote_cry");
  assert.equal(emoteVoiceEvent("suplica"), "emote_plead");
  assert.equal(emoteVoiceEvent("provocar"), "emote_taunt");
  assert.equal(emoteVoiceEvent("desconhecido"), null);
});

test("troop card sound catalog contains horse, three ordered swords, archer and catapult", () => {
  const map = createTroopCardSoundMap("/assets/audio/troops");
  assert.deepEqual(Object.keys(map), [
    "troopCardKnightHorse",
    "troopCardKnightSword1",
    "troopCardKnightSword2",
    "troopCardKnightSword3",
    "troopCardArcher",
    "troopCardCatapult",
  ]);
  assert.match(map.troopCardKnightSword1[0], /knight-sword-1\.m4a$/);
  assert.match(map.troopCardKnightSword2[0], /knight-sword-2\.m4a$/);
  assert.match(map.troopCardKnightSword3[0], /knight-sword-3\.m4a$/);
});
