import test from "node:test";
import assert from "node:assert/strict";
import {
  VOICE_CHARACTERS,
  createCharacterVoiceSoundMap,
  createTroopCardSoundMap,
  emoteVoiceEvent,
  pickVoiceVariant,
  voiceSoundKey,
  voiceTranscript,
  voiceVariantCount,
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


test("every recorded character voice variant has an exact English transcript", () => {
  let total = 0;
  for (const character of VOICE_CHARACTERS) {
    for (const event of [
      "found_village",
      "found_palace",
      "longest_road",
      "largest_army",
      "victory",
      "robbed",
      "trade_done",
      "emote_happy",
      "emote_laugh",
      "emote_smug",
      "emote_angry",
      "emote_shocked",
      "emote_cry",
      "emote_plead",
      "emote_taunt",
    ]) {
      const count = voiceVariantCount(event);
      assert.ok(count > 0, `${event} should expose at least one variant`);
      for (let variant = 1; variant <= count; variant += 1) {
        assert.ok(
          voiceTranscript(character, event, variant).trim().length > 0,
          `${character}/${event}/${variant} should have a transcript`,
        );
        total += 1;
      }
    }
  }
  assert.equal(total, 176);
});

test("Muriel trade, robbery and provisional victory transcripts match the current recordings map", () => {
  assert.equal(voiceTranscript("muriel", "victory", 1), "The spell held. Mostly.");
  assert.equal(voiceTranscript("muriel", "victory", 2), "The cards said so. I merely read them.");
  assert.equal(voiceTranscript("muriel", "robbed", 1), "You've cursed yourself now.");
  assert.equal(voiceTranscript("muriel", "robbed", 2), "I'll take that back. Later.");
  assert.equal(voiceTranscript("muriel", "trade_done", 1), "The stars approve this exchange.");
  assert.equal(voiceTranscript("muriel", "trade_done", 2), "A fine trade. For one of us.");

  const murielLines = [
    "found_village",
    "found_palace",
    "longest_road",
    "largest_army",
    "victory",
    "robbed",
    "trade_done",
    "emote_happy",
    "emote_laugh",
    "emote_smug",
    "emote_angry",
    "emote_shocked",
    "emote_cry",
    "emote_plead",
    "emote_taunt",
  ].flatMap((event) => Array.from(
    { length: voiceVariantCount(event) },
    (_, index) => voiceTranscript("muriel", event, index + 1),
  ));
  assert.equal(murielLines.includes("This was never chance."), false);
});

test("voice variant selection stays inside the recorded variant range", () => {
  assert.equal(pickVoiceVariant("found_village", () => 0), 1);
  assert.equal(pickVoiceVariant("found_village", () => 0.999999), 2);
  assert.equal(pickVoiceVariant("emote_happy", () => 0.999999), 1);
  assert.equal(pickVoiceVariant("unknown", () => 0.5), null);
});
