import test from "node:test";
import assert from "node:assert/strict";
import {
  INITIAL_PLAY_TURN,
  advanceSetupState,
  reducePalaceConstruction,
  reduceRoadConstruction,
  reduceVillageConstruction,
  terrainResource,
} from "../src/game/constructionReducer.js";
import { calculateProduction, reduceProduction } from "../src/game/productionReducer.js";
import { createEmptyResources } from "../src/game/resources.js";

function resources(values = {}) {
  return { ...createEmptyResources(), ...values };
}

function player(values = {}) {
  return {
    res: resources(),
    freeRoads: 0,
    capV: null,
    immune: false,
    ...values,
  };
}

function graph() {
  return {
    verts: {
      A: { edges: ["AB"], hexes: ["h1", "h2"] },
      B: { edges: ["AB", "BC"], hexes: ["h1"] },
      C: { edges: ["BC"], hexes: ["h2"] },
    },
    edges: {
      AB: { a: "A", b: "B", hexes: ["h1"] },
      BC: { a: "B", b: "C", hexes: ["h2"] },
    },
    hexMap: {
      h1: { k: "h1", terr: "floresta", corners: ["A", "B"] },
      h2: { k: "h2", terr: "argila", corners: ["A", "C"] },
    },
  };
}

function game(overrides = {}) {
  return {
    mode: "classico",
    phase: "play",
    players: [player(), player()],
    roads: {},
    builds: {},
    board: {
      dragon: "deserto",
      hexes: [
        { k: "h1", terr: "floresta", num: 8, hid: false },
        { k: "h2", terr: "argila", num: 8, hid: false },
      ],
    },
    stats: {
      produced: [0, 0],
      dragonBlocked: [0, 0],
    },
    ...overrides,
  };
}

test("terrain resources have one canonical mapping", () => {
  assert.equal(terrainResource("floresta"), "madeira");
  assert.equal(terrainResource("montanhas"), "obsidiana");
  assert.equal(terrainResource("deserto"), null);
  assert.equal(terrainResource("unknown"), null);
});

test("a paid road returns a new state and deducts the canonical cost", () => {
  const original = game({
    players: [player({ res: resources({ madeira: 2, tijolo: 2 }) }), player()],
  });
  const result = reduceRoadConstruction(original, 0, "AB");
  assert.equal(result.game.roads.AB, 0);
  assert.deepEqual(result.game.players[0].res, resources({ madeira: 1, tijolo: 1 }));
  assert.deepEqual(original.players[0].res, resources({ madeira: 2, tijolo: 2 }));
  assert.equal(original.roads.AB, undefined);
  assert.equal(result.event.usedFreeRoad, false);
});

test("a free road consumes freeRoads without touching resources", () => {
  const original = game({
    players: [player({ freeRoads: 2, res: resources({ madeira: 3, tijolo: 3 }) }), player()],
  });
  const result = reduceRoadConstruction(original, 0, "AB");
  assert.equal(result.game.players[0].freeRoads, 1);
  assert.deepEqual(result.game.players[0].res, original.players[0].res);
  assert.equal(result.event.usedFreeRoad, true);
});

test("a village and palace apply costs without mutating the input", () => {
  const original = game({
    players: [player({ res: resources({ madeira: 1, tijolo: 1, cavalos: 1, ouro: 3, obsidiana: 3 }) }), player()],
    builds: { A: { p: 0, t: 1 } },
  });
  const village = reduceVillageConstruction(original, graph(), 0, "B");
  assert.deepEqual(village.game.builds.B, { p: 0, t: 1 });
  assert.deepEqual(village.game.players[0].res, resources({ ouro: 2, obsidiana: 3 }));
  assert.equal(original.builds.B, undefined);

  const palace = reducePalaceConstruction(original, 0, "A");
  assert.deepEqual(palace.game.builds.A, { p: 0, t: 2 });
  assert.deepEqual(palace.game.players[0].res, resources({ madeira: 1, tijolo: 1, cavalos: 1, ouro: 1 }));
  assert.deepEqual(original.builds.A, { p: 0, t: 1 });
});

test("setup settlement records the capital and only the second placement harvests", () => {
  const firstGame = game({
    phase: "setup",
    setup: { i: 0, seq: [0, 1, 1, 0], needRoad: false, lastV: null },
  });
  const first = reduceVillageConstruction(firstGame, graph(), 0, "A");
  assert.equal(first.game.players[0].capV, "A");
  assert.deepEqual(first.game.players[0].res, resources());
  assert.equal(first.game.setup.needRoad, true);
  assert.equal(first.event.secondPlacement, false);

  const secondGame = game({
    phase: "setup",
    setup: { i: 2, seq: [0, 1, 1, 0], needRoad: false, lastV: null },
  });
  const second = reduceVillageConstruction(secondGame, graph(), 1, "A");
  assert.deepEqual(second.game.players[1].res, resources({ madeira: 1, tijolo: 1 }));
  assert.deepEqual(second.event.resourceGains, resources({ madeira: 1, tijolo: 1 }));
  assert.equal(second.event.secondPlacement, true);
});

test("rapid setup places palaces instead of villages", () => {
  const original = game({
    mode: "rapido",
    phase: "setup",
    setup: { i: 0, seq: [0, 1, 1, 0], needRoad: false, lastV: null },
  });
  const result = reduceVillageConstruction(original, graph(), 0, "A");
  assert.deepEqual(result.game.builds.A, { p: 0, t: 2 });
  assert.equal(result.event.rapidMode, true);
});

test("the final setup road starts play with a clean turn", () => {
  const original = game({
    phase: "setup",
    setup: { i: 3, seq: [0, 1, 1, 0], needRoad: true, lastV: "A" },
    order: [1, 0],
  });
  const result = reduceRoadConstruction(original, 0, "AB");
  assert.equal(result.setupCompleted, true);
  assert.equal(result.game.phase, "play");
  assert.deepEqual(result.game.turn, { ...INITIAL_PLAY_TURN, acted: {} });
  assert.equal(original.phase, "setup");
});

test("advanceSetupState does not mutate setup state", () => {
  const original = game({
    phase: "setup",
    setup: { i: 0, seq: [0, 1], needRoad: true, lastV: "A" },
  });
  const result = advanceSetupState(original);
  assert.deepEqual(original.setup, { i: 0, seq: [0, 1], needRoad: true, lastV: "A" });
  assert.deepEqual(result.game.setup, { i: 1, seq: [0, 1], needRoad: false, lastV: null });
});

test("production pays villages and palaces and updates statistics immutably", () => {
  const original = game({ builds: { A: { p: 0, t: 1 }, B: { p: 1, t: 2 } } });
  const result = reduceProduction(original, graph(), 8);
  assert.deepEqual(result.game.players[0].res, resources({ madeira: 1, tijolo: 1 }));
  assert.deepEqual(result.game.players[1].res, resources({ madeira: 2 }));
  assert.deepEqual(result.game.stats.produced, [2, 2]);
  assert.deepEqual(result.sources[0], [
    { hex: "h1", vertex: "A", resource: "madeira", amount: 1 },
    { hex: "h2", vertex: "A", resource: "tijolo", amount: 1 },
  ]);
  assert.deepEqual(result.sources[1], [
    { hex: "h1", vertex: "B", resource: "madeira", amount: 2 },
  ]);
  assert.deepEqual(original.players[0].res, resources());
  assert.deepEqual(original.stats.produced, [0, 0]);
});

test("fogged hexes and non-matching rolls do not produce", () => {
  const hidden = game({
    builds: { A: { p: 0, t: 1 } },
    board: { dragon: "deserto", hexes: [{ k: "h1", terr: "floresta", num: 8, hid: true }] },
  });
  assert.deepEqual(calculateProduction(hidden, graph(), 8).gains[0], resources());
  assert.deepEqual(calculateProduction(hidden, graph(), 6).gains[0], resources());
});

test("the dragon blocks production and records the lost amount", () => {
  const original = game({
    builds: { B: { p: 1, t: 2 } },
    board: { dragon: "h1", hexes: [{ k: "h1", terr: "floresta", num: 8, hid: false }] },
  });
  const result = reduceProduction(original, graph(), 8);
  assert.deepEqual(result.game.players[1].res, resources());
  assert.deepEqual(result.game.stats.dragonBlocked, [0, 2]);
});

test("an immune player still produces under the dragon", () => {
  const original = game({
    players: [player(), player({ immune: true })],
    builds: { B: { p: 1, t: 2 } },
    board: { dragon: "h1", hexes: [{ k: "h1", terr: "floresta", num: 8, hid: false }] },
  });
  const result = reduceProduction(original, graph(), 8);
  assert.deepEqual(result.game.players[1].res, resources({ madeira: 2 }));
  assert.deepEqual(result.game.stats.dragonBlocked, [0, 0]);
});

test("war occupation redirects one resource to the occupying player", () => {
  const original = game({
    mode: "guerra",
    builds: { A: { p: 0, t: 2 } },
    occ: { A: 1 },
  });
  const result = reduceProduction(original, graph(), 8);
  assert.deepEqual(result.game.players[0].res, resources());
  assert.deepEqual(result.game.players[1].res, resources({ madeira: 1, tijolo: 1 }));
});

test("war raiders block a vertex before resources are assigned", () => {
  const original = game({
    mode: "guerra",
    builds: { A: { p: 0, t: 2 } },
    troll: { awake: true },
    units: { h3: { p: -9, blk: "A" } },
  });
  const result = reduceProduction(original, graph(), 8);
  assert.deepEqual(result.game.players[0].res, resources());
  assert.deepEqual(result.game.stats.produced, [0, 0]);
});
