import test from "node:test";
import assert from "node:assert/strict";
import { playerBannerScore } from "../src/ui/game/playerBannerScoreModel.js";

test("local banner exposes public score plus the owner's private total", () => {
  assert.deepEqual(playerBannerScore({ publicVictoryPoints: 8, secretVictoryPoints: 1, isLocal: true }), {
    publicScore: 8,
    secretScore: 1,
    total: 9,
    hasPrivateTotal: true,
  });
});

test("rival banners never expose secret victory points", () => {
  assert.deepEqual(playerBannerScore({ publicVictoryPoints: 8, secretVictoryPoints: 4, isLocal: false }), {
    publicScore: 8,
    secretScore: 0,
    total: 8,
    hasPrivateTotal: false,
  });
});
