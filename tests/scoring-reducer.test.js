import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateVictoryPoints,
  determineLargestArmyAward,
  determineLongestRoadAward,
  longestRoadLength,
  rankPlayers,
  reduceRoundLimitVictory,
  reduceScoringAfterAction,
  reduceScoringAwards,
  reduceStandardVictory,
  scoreBreakdown,
  troopTotal,
} from "../src/game/scoringReducer.js";

function player(overrides = {}) {
  return {
    res: { madeira: 0, tijolo: 0, cavalos: 0, ouro: 0, obsidiana: 0 },
    devNew: [],
    devOld: [],
    troops: { cavaleiro: 0, catapulta: 0, arqueiro: 0 },
    ...structuredClone(overrides),
  };
}

function game(overrides = {}) {
  const players = overrides.players || [player(), player()];
  return {
    phase: "play",
    mode: "dragao",
    players: structuredClone(players),
    builds: {},
    roads: {},
    occ: {},
    glory: {},
    lr: null,
    la: null,
    winner: null,
    ...structuredClone(overrides),
    players: structuredClone(players),
  };
}

function roadChain(length, owner = 0, prefix = "v") {
  return Object.fromEntries(Array.from({ length }, (_, index) => [`${prefix}${index}|${prefix}${index + 1}`, owner]));
}

test("score breakdown separates public and secret victory points", () => {
  const original = game({
    players: [player({ devNew: [{ kind: "vp" }], devOld: [{ kind: "vp" }] }), player()],
    builds: { A: { p: 0, t: 1 }, B: { p: 0, t: 2 }, C: { p: 1, t: 1 } },
    lr: { p: 0, len: 5 },
    la: { p: 1, n: 3 },
  });
  assert.deepEqual(scoreBreakdown(original, 0), {
    playerIndex: 0,
    buildings: 3,
    longestRoad: 2,
    largestArmy: 0,
    occupations: 0,
    glory: 0,
    secretVictoryPoints: 0,
    publicTotal: 5,
    total: 5,
  });
  assert.equal(calculateVictoryPoints(original, 0, true), 7);
  assert.equal(calculateVictoryPoints(original, 1, false), 3);
});

test("war score includes live occupations and permanent glory", () => {
  const original = game({
    mode: "guerra",
    builds: { A: { p: 0, t: 2 }, B: { p: 1, t: 1 } },
    occ: { B: 0, MISSING: 0 },
    glory: { 0: 2 },
  });
  const score = scoreBreakdown(original, 0);
  assert.equal(score.buildings, 2);
  assert.equal(score.occupations, 1);
  assert.equal(score.glory, 2);
  assert.equal(score.total, 5);
});

test("longest road counts a continuous chain without changing the game", () => {
  const original = game({ roads: roadChain(6) });
  assert.equal(longestRoadLength(original, 0), 6);
  assert.deepEqual(original.roads, roadChain(6));
});

test("an opposing building interrupts a road at its vertex", () => {
  const original = game({
    roads: { "A|B": 0, "B|C": 0 },
    builds: { B: { p: 1, t: 1 } },
  });
  assert.equal(longestRoadLength(original, 0), 1);
});

test("longest road never reuses the same edge in a branch or loop", () => {
  const original = game({
    roads: { "A|B": 0, "B|C": 0, "C|A": 0, "B|D": 0 },
  });
  assert.equal(longestRoadLength(original, 0), 4);
});

test("the longest road requires five edges", () => {
  const original = game({ roads: { ...roadChain(4, 0, "a"), ...roadChain(5, 1, "b") } });
  const { holder, lengths } = determineLongestRoadAward(original);
  assert.deepEqual(lengths, [4, 5]);
  assert.deepEqual(holder, { p: 1, len: 5 });
});

test("the incumbent keeps the longest road when another player only ties", () => {
  const original = game({
    roads: { ...roadChain(5, 0, "a"), ...roadChain(5, 1, "b") },
    lr: { p: 1, len: 5 },
  });
  assert.deepEqual(determineLongestRoadAward(original).holder, { p: 1, len: 5 });
});

test("a broken incumbent road transfers the award to the next valid player", () => {
  const original = game({
    roads: { ...roadChain(4, 0, "a"), ...roadChain(6, 1, "b") },
    lr: { p: 0, len: 7 },
  });
  assert.deepEqual(determineLongestRoadAward(original).holder, { p: 1, len: 6 });
});

test("largest army requires three troops and preserves the incumbent on a tie", () => {
  const original = game({
    players: [
      player({ troops: { cavaleiro: 3, catapulta: 0, arqueiro: 0 } }),
      player({ troops: { cavaleiro: 1, catapulta: 1, arqueiro: 1 } }),
    ],
    la: { p: 1, n: 3 },
  });
  assert.equal(troopTotal(original.players[1]), 3);
  assert.deepEqual(determineLargestArmyAward(original).holder, { p: 1, n: 3 });
});

test("award reduction is immutable and reports both transfers", () => {
  const original = game({
    players: [
      player({ troops: { cavaleiro: 4, catapulta: 0, arqueiro: 0 } }),
      player(),
    ],
    roads: roadChain(5),
  });
  const result = reduceScoringAwards(original, { longestRoad: true, largestArmy: true });
  assert.deepEqual(result.game.lr, { p: 0, len: 5 });
  assert.deepEqual(result.game.la, { p: 0, n: 4 });
  assert.deepEqual(result.event.events.map((event) => event.type), ["LONGEST_ROAD_CHANGED", "LARGEST_ARMY_CHANGED"]);
  assert.equal(original.lr, null);
  assert.equal(original.la, null);
});

test("standard victory includes hidden victory-point cards", () => {
  const original = game({
    players: [player({ devOld: [{ kind: "vp" }], ready: true }), player({ ready: true })],
    builds: { A: { p: 0, t: 2 }, B: { p: 0, t: 2 }, C: { p: 0, t: 2 }, D: { p: 0, t: 1 } },
    lr: { p: 0, len: 5 },
  });
  assert.equal(calculateVictoryPoints(original, 0, false), 9);
  const result = reduceStandardVictory(original, 0);
  assert.equal(result.game.phase, "ended");
  assert.equal(result.game.winner, 0);
  assert.equal(result.event.score, 10);
  assert.ok(result.game.players.every((entry) => entry.ready === false));
  assert.equal(original.players[0].ready, true);
  assert.equal(original.phase, "play");
});

test("war mode never ends immediately at ten points", () => {
  const original = game({
    mode: "guerra",
    builds: Object.fromEntries(Array.from({ length: 6 }, (_, index) => [`B${index}`, { p: 0, t: 2 }])),
  });
  const result = reduceStandardVictory(original, 0);
  assert.equal(result.game.phase, "play");
  assert.equal(result.event.type, "VICTORY_NOT_REACHED");
});

test("round-limit victory ranks all secret and public points", () => {
  const original = game({
    mode: "guerra",
    players: [player({ ready: true }), player({ devOld: [{ kind: "vp" }, { kind: "vp" }], ready: true })],
    builds: { A: { p: 0, t: 2 }, B: { p: 1, t: 1 } },
  });
  const result = reduceRoundLimitVictory(original);
  assert.equal(result.game.phase, "ended");
  assert.equal(result.game.winner, 1);
  assert.equal(result.event.score, 3);
  assert.ok(result.game.players.every((entry) => entry.ready === false));
  assert.ok(original.players.every((entry) => entry.ready === true));
  assert.deepEqual(result.event.ranking.map((entry) => entry.playerIndex), [1, 0]);
});

test("round-limit ties preserve the existing stable player-index rule", () => {
  const original = game({
    mode: "guerra",
    builds: { A: { p: 0, t: 1 }, B: { p: 1, t: 1 } },
  });
  const result = reduceRoundLimitVictory(original);
  assert.equal(result.game.winner, 0);
  assert.deepEqual(result.event.tiedPlayerIndices, [0, 1]);
  assert.equal(result.event.tieBreak, "PLAYER_INDEX");
});

test("public and final rankings differ only when secret points matter", () => {
  const original = game({
    players: [player(), player({ devOld: [{ kind: "vp" }] })],
    builds: { A: { p: 0, t: 1 }, B: { p: 1, t: 1 } },
  });
  assert.deepEqual(rankPlayers(original, { includeSecret: false }).map((entry) => entry.playerIndex), [0, 1]);
  assert.deepEqual(rankPlayers(original, { includeSecret: true }).map((entry) => entry.playerIndex), [1, 0]);
});

test("scoring after an action updates awards before checking victory", () => {
  const original = game({
    roads: roadChain(5),
    builds: Object.fromEntries(Array.from({ length: 8 }, (_, index) => [`B${index}`, { p: 0, t: 1 }])),
  });
  const result = reduceScoringAfterAction(original, 0, { longestRoad: true });
  assert.deepEqual(result.game.lr, { p: 0, len: 5 });
  assert.equal(result.game.winner, 0);
  assert.deepEqual(result.event.events.map((event) => event.type), ["LONGEST_ROAD_CHANGED", "GAME_WON"]);
});
