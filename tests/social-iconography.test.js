import test from "node:test";
import assert from "node:assert/strict";
import { CUSTOM_GAME_ICONS } from "../src/assets/customGameIcons.js";
import { EMOTES } from "../src/presentation/emoteCatalog.js";

test("social reactions use the canonical mask icon family instead of emoji glyphs", () => {
  assert.equal(EMOTES.length, 8);
  for (const emote of EMOTES) {
    assert.match(emote.icon, /^RDD_Emote/);
    assert.ok(CUSTOM_GAME_ICONS[emote.icon], emote.k);
    assert.equal("e" in emote, false, emote.k);
  }
  assert.ok(CUSTOM_GAME_ICONS.RDD_ChatTankard);
});
