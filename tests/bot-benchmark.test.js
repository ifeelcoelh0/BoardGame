import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";

import {
  rosterForGame,
  simulateBotGame,
  summarizeBenchmark,
} from "../scripts/bot-benchmark-core.mjs";

const IDS = ["vlad", "maria", "protheus", "romeo", "makuru", "artheria", "muriel", "bones"];

test("benchmark samples every four-player combination and rotates every character through every seat", () => {
  const counts = Object.fromEntries(IDS.map((id) => [id, 0]));
  const seats = Object.fromEntries(IDS.map((id) => [id, [0, 0, 0, 0]]));
  const combinations = new Map();
  const cycleGames = 70 * 4;

  for (let gameIndex = 0; gameIndex < cycleGames; gameIndex += 1) {
    const roster = rosterForGame(gameIndex, 4, IDS);
    const combination = roster.slice().sort().join("|");
    combinations.set(combination, (combinations.get(combination) || 0) + 1);
    roster.forEach((id, seatIndex) => {
      counts[id] += 1;
      seats[id][seatIndex] += 1;
    });
  }

  assert.equal(combinations.size, 70);
  assert.ok([...combinations.values()].every((count) => count === 4));
  assert.deepEqual(Object.values(counts), Array(8).fill(140));
  for (const id of IDS) assert.deepEqual(seats[id], [35, 35, 35, 35]);
});

test("benchmark keeps each combination together while rotating seat order", () => {
  const first = rosterForGame(0, 4, IDS);
  const firstSet = first.slice().sort();
  for (let gameIndex = 1; gameIndex < 4; gameIndex += 1) {
    assert.deepEqual(rosterForGame(gameIndex, 4, IDS).slice().sort(), firstSet);
  }
  assert.notDeepEqual(rosterForGame(4, 4, IDS).slice().sort(), firstSet);
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
  assert.equal(record.roster.length, 3);
  assert.ok(record.players.every((entry) => Number.isFinite(entry.finalScore)));
  assert.ok(record.players.every((entry) => Number.isFinite(entry.productionTotal)));
  assert.ok(Object.keys(record.actionsByType).length > 0);
});

test("benchmark replay inputs reproduce the same deterministic game record", () => {
  const options = { mode: "classico", playerCount: 4, baseSeed: 98765, gameIndex: 17 };
  assert.deepEqual(simulateBotGame(options), simulateBotGame(options));
});

test("benchmark CLI can run the three core modes as one comparison suite", () => {
  const output = execFileSync(process.execPath, [
    "scripts/run-bot-benchmark.mjs",
    "--mode", "core",
    "--players", "4",
    "--games", "1",
    "--workers", "1",
    "--quiet",
  ], { cwd: process.cwd(), encoding: "utf8" });
  assert.match(output, /CORE MODES — COMPARAÇÃO/);
  assert.equal((output.match(/Concluídos: 1\/1/g) || []).length, 3);
});
