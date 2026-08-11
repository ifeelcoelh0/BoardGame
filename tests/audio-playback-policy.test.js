import test from "node:test";
import assert from "node:assert/strict";
import {
  createAudioTriggerGate,
  freshLogEntries,
  latestCurrentAudioCue,
  normalizeAudioCue,
} from "../src/audio/audioPlaybackPolicy.js";

test("audio trigger gate suppresses repeated effects inside their cooldown", () => {
  let now = 1000;
  const gate = createAudioTriggerGate({ now: () => now });
  assert.equal(gate.allow("uiClick"), true);
  now += 20;
  assert.equal(gate.allow("uiClick"), false);
  now += 80;
  assert.equal(gate.allow("uiClick"), true);
});

test("fresh log selection never schedules a historical queue", () => {
  const log = [
    { id: 3000, audio: { sfx: "build" } },
    { id: 2000, audio: { sfx: "coin" } },
    { id: 1000, audio: { sfx: "dice" } },
  ];
  const fresh = freshLogEntries(log, 1000);
  assert.deepEqual(fresh.map((entry) => entry.id), [3000, 2000]);
  assert.deepEqual(latestCurrentAudioCue(fresh), { sfx: "build" });
});

test("stale timestamped cues are dropped after delayed state adoption", () => {
  const now = 1_700_000_010_000;
  const entries = [{ id: 1_700_000_000_000.4, audio: { sfx: "fanfare" } }];
  assert.equal(latestCurrentAudioCue(entries, { now, maxAgeMs: 3200 }), null);
});

test("audio cues accept one sfx, troop cue and one character voice", () => {
  assert.deepEqual(normalizeAudioCue({
    sfx: "build",
    troop: "arqueiro",
    voice: { character: "vlad", event: "found_village" },
    ignored: true,
  }), {
    sfx: "build",
    troop: "arqueiro",
    voice: { character: "vlad", event: "found_village" },
  });
});
