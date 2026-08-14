import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";

import {
  rosterForGame,
  simulateBotGame,
  summarizeBenchmark,
} from "../scripts/bot-benchmark-core.mjs";
import {
  createBalancePlayerRecord,
  recordBalanceEvents,
} from "../scripts/balance-lab-metrics.mjs";

import { DIVERSE_BOT_PROFILES, botProfilesForGame } from "../src/game/botProfiles.js";

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


test("benchmark records setup quality and randomized turn-order position separately from player slot", () => {
  const record = simulateBotGame({ mode: "classico", playerCount: 4, baseSeed: 24680, gameIndex: 7 });
  assert.equal(record.completed, true);
  assert.deepEqual(record.players.map((player) => player.turnOrderPosition).slice().sort((a, b) => a - b), [0, 1, 2, 3]);
  for (const player of record.players) {
    assert.equal(player.setupPlacements.length, 2);
    assert.ok(player.setupPips > 0);
    assert.ok(player.setupWeightedPips > 0);
    assert.ok(player.setupResourceDiversity >= 1);
    assert.ok(player.setupNumberDiversity >= 1);
    assert.ok(player.setupPlacements.every((placement) => placement.candidateCount > 0));
    assert.ok(player.setupPlacements.every((placement) => placement.chosenRank === 1));
    assert.ok(player.setupPlacements.every((placement) => placement.opportunityLossScore === 0));
  }
});

test("disaster diagnostics distinguish exposure from an actually applied disaster", () => {
  const record = {
    players: [
      createBalancePlayerRecord({ ch: "vlad" }, 0),
      createBalancePlayerRecord({ ch: "maria" }, 1),
    ],
  };
  recordBalanceEvents(record, [{
    type: "DISASTER_RESOLVED",
    outcome: "NO_PROTECTED",
    protectedPlayers: [],
    affectedPlayers: [0, 1],
    immunePlayers: [],
    effects: [],
  }]);
  assert.equal(record.players[0].disastersExposed, 1);
  assert.equal(record.players[0].disastersAppliedToPlayer, 0);

  recordBalanceEvents(record, [{
    type: "DISASTER_RESOLVED",
    outcome: "APPLIED",
    protectedPlayers: [1],
    affectedPlayers: [0],
    immunePlayers: [],
    effects: [{ type: "RESOURCE_LOST", playerIndex: 0, resource: "ouro" }],
  }]);
  assert.equal(record.players[0].disastersExposed, 2);
  assert.equal(record.players[0].disastersAppliedToPlayer, 1);
  assert.equal(record.players[0].disasterHarmEvents, 1);
  assert.equal(record.players[1].disastersProtected, 1);
});

test("benchmark summary exposes turn-order and measured Trinity immunity diagnostics", () => {
  const records = Array.from({ length: 8 }, (_, gameIndex) => simulateBotGame({
    mode: "dragao",
    playerCount: 4,
    baseSeed: 13579,
    gameIndex,
  }));
  const summary = summarizeBenchmark(records, {
    requestedGames: records.length,
    mode: "dragao",
    playerCount: 4,
    baseSeed: 13579,
  });
  assert.equal(summary.turnOrderPositions.length, 4);
  assert.equal(summary.setup.placementDiagnostics.length, 2);
  assert.ok(summary.setup.placementDiagnostics.every((row) => row.observations === records.length * 4));
  assert.ok(summary.trinity.measuredImmunityValue);
  assert.ok(Number.isFinite(summary.trinity.measuredImmunityValue.totalDisastersAvoided));
  assert.ok(Number.isFinite(summary.trinity.measuredImmunityValue.totalDragonStealsAvoided));
  assert.ok(Number.isFinite(summary.trinity.measuredImmunityValue.totalDragonProductionSaved));
});


test("diverse strategy schedule balances every character across all bot profiles in one 280-game roster cycle", () => {
  const counts = new Map();
  for (let gameIndex = 0; gameIndex < 280; gameIndex += 1) {
    const roster = rosterForGame(gameIndex, 4);
    const profiles = botProfilesForGame(gameIndex, 4, "diverse");
    for (let seat = 0; seat < 4; seat += 1) {
      const key = `${roster[seat]}:${profiles[seat]}`;
      counts.set(key, (counts.get(key) || 0) + 1);
    }
  }
  for (const characterId of IDS) {
    const values = DIVERSE_BOT_PROFILES.map((profileId) => counts.get(`${characterId}:${profileId}`) || 0);
    assert.deepEqual(values, [35, 35, 35, 35]);
  }
});

test("diverse benchmark produces executable player-to-player trades without simulation loops", () => {
  const record = simulateBotGame({
    mode: "classico",
    playerCount: 4,
    baseSeed: 24681357,
    gameIndex: 0,
    strategySet: "diverse",
  });
  assert.equal(record.completed, true);
  assert.ok(record.players.some((player) => (player.actionsByType.PROPOSE_TRADE || 0) > 0));
  assert.ok(record.players.reduce((sum, player) => sum + player.p2pTrades, 0) >= 2);
  assert.deepEqual(record.botProfiles, ["balanced", "expander", "developer", "economist"]);
});
