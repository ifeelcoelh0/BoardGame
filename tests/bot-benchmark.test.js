import test from "node:test";
import assert from "node:assert/strict";

import {
  rosterForGame,
  simulateBotGame,
  summarizeBenchmark,
} from "../scripts/bot-benchmark-core.mjs";

const IDS = ["vlad", "maria", "protheus", "romeo", "makuru", "artheria", "muriel", "bones"];

test("benchmark roster rotation balances all eight characters over a full cycle", () => {
  const counts = Object.fromEntries(IDS.map((id) => [id, 0]));
  for (let gameIndex = 0; gameIndex < 8; gameIndex += 1) {
    for (const id of rosterForGame(gameIndex, 4, IDS)) counts[id] += 1;
  }
  assert.deepEqual(Object.values(counts), Array(8).fill(4));
});

test("benchmark summary reports normalized win-rate deltas", () => {
  const game = (index, players) => ({
    gameIndex: index,
    mode: "dragao",
    playerCount: 2,
    completed: true,
    steps: 100,
    rounds: 10,
    rolls: 20,
    two: { rolls: 1, productiveRolls: 1, resourcesProduced: 1, disasters: { applied: 1, noProtected: 0, noTargets: 0, byType: { peste: 1 } } },
    twelve: { rolls: 1, productiveRolls: 0, resourcesProduced: 0, disasters: { applied: 0, noProtected: 1, noTargets: 0, byType: {} } },
    players,
  });
  const player = (characterId, winner, built2, built12, trinity = false) => ({
    characterId,
    characterName: characterId,
    winner,
    built2,
    built12,
    trinity,
    trinityRound: trinity ? 8 : null,
    trinityOrder: trinity ? ["arqueiro", "cavaleiro", "catapulta"] : [],
    finalBuildingCount: built2 && built12 ? 4 : built2 || built12 ? 3 : 3,
  });
  const summary = summarizeBenchmark([
    game(0, [player("vlad", true, true, false, true), player("maria", false, false, false)]),
    game(1, [player("vlad", false, true, false), player("maria", true, false, true)]),
  ], { requestedGames: 2, mode: "dragao", playerCount: 2, baseSeed: 1 });

  assert.equal(summary.dice.two.shareOfRollsPct, 5);
  assert.equal(summary.dice.two.disasterAppliedPct, 100);
  assert.equal(summary.rareNumberPresence.comparisons.on2.with.winRate, 50);
  assert.equal(summary.rareNumberPresence.comparisons.on2.without.winRate, 50);
  assert.equal(summary.trinity.completedByPlayersPct, 25);
  assert.equal(summary.rareNumberPresence.categories.find((row) => row.id === "only2").n, 2);
  assert.equal(summary.rareNumberPresence.categories.find((row) => row.id === "only12").n, 1);
  assert.ok(Array.isArray(summary.rareNumberPresence.byFinalBuildingCount));
  assert.equal(summary.rareNumberPresence.adjustedByFinalBuildingCount.on2.coveredObservations, 4);
});

test("one real Dragão benchmark game completes through censored bot views and authoritative actions", () => {
  const record = simulateBotGame({ mode: "dragao", playerCount: 3, baseSeed: 12345, gameIndex: 0 });
  assert.equal(record.completed, true);
  assert.ok(record.rolls > 0);
  assert.ok(record.players.every((entry) => typeof entry.characterId === "string"));
});
