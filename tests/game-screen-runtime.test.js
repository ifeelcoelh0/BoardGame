import test from "node:test";
import assert from "node:assert/strict";
import { currentGameActorIndex, formatReconnectClock } from "../src/ui/game/gameScreenRuntimeModel.js";
import { deriveGameOverlayVisibility } from "../src/ui/game/gameOverlayVisibility.js";

test("current actor is derived consistently in setup and normal play", () => {
  assert.equal(currentGameActorIndex({ phase: "setup", setup: { seq: [2, 1, 0], i: 1 } }), 1);
  assert.equal(currentGameActorIndex({ phase: "play", order: [2, 0, 1], turn: { pos: 2 } }), 1);
});

test("reconnect clock formatting is presentation-only and bounded at zero", () => {
  assert.equal(formatReconnectClock(90), "1:30");
  assert.equal(formatReconnectClock(-4), "0:00");
  assert.equal(formatReconnectClock(null), null);
});

test("overlay priority keeps card, disaster, award and story mutually exclusive", () => {
  const now = 20_000;
  const presentation = {
    cardReveal: { id: 1, pi: 1 },
    disaster: { id: 2 },
    award: { id: 3 },
    story: { id: now - 2_000, kind: "dados" },
  };
  assert.deepEqual(
    deriveGameOverlayVisibility(presentation, 0, new Set(), now),
    {
      cardEvent: presentation.cardReveal,
      disasterEvent: presentation.disaster,
      awardEvent: presentation.award,
      storyEvent: presentation.story,
      cardVisible: true,
      disasterVisible: false,
      awardVisible: false,
      dragonStoryVisible: false,
      storyVisible: false,
    },
  );
});
