import test from "node:test";
import assert from "node:assert/strict";
import {
  DISASTER_TYPES,
  protectedPlayerIndexes,
  reduceDisaster,
  reduceTributeResourceChoice,
  reduceTsunamiPortChoice,
} from "../src/game/disasterReducer.js";
import { createEmptyResources } from "../src/game/resources.js";

function resources(values = {}) {
  return { ...createEmptyResources(), ...values };
}

function player(values = {}) {
  return {
    ch: "vlad",
    res: resources(),
    portOff: [],
    immune: false,
    sick: 0,
    ...values,
  };
}

function graph() {
  return {
    verts: {
      A: { edges: [], hexes: ["sacred"] },
      B: { edges: [], hexes: ["sacred"] },
      C: { edges: ["e1"], hexes: ["coast"] },
      D: { edges: ["e1"], hexes: ["coast"] },
      E: { edges: ["e2"], hexes: ["coast"] },
      F: { edges: ["e2"], hexes: ["coast"] },
    },
    edges: {
      e1: { a: "C", b: "D", hexes: ["coast"] },
      e2: { a: "E", b: "F", hexes: ["coast"] },
    },
    hexMap: {
      sacred: { k: "sacred", corners: ["A", "B"] },
      coast: { k: "coast", corners: ["C", "D", "E", "F"] },
    },
  };
}

function game(overrides = {}) {
  return {
    mode: "dragao",
    players: [player(), player({ ch: "maria" }), player({ ch: "romeo" })],
    builds: { A: { p: 0, t: 1 } },
    board: {
      hexes: [
        { k: "sacred", num: 12, terr: "floresta", hid: false },
        { k: "coast", num: 5, terr: "argila", hid: false },
      ],
      ports: [],
    },
    queue: [],
    stats: { disasters: 0 },
    ...overrides,
  };
}

function sequence(values) {
  let index = 0;
  return () => values[Math.min(index++, values.length - 1)] ?? 0;
}

test("protectedPlayerIndexes finds every owner touching the sacred number once", () => {
  const current = game({ builds: { A: { p: 0, t: 1 }, B: { p: 1, t: 2 } } });
  assert.deepEqual(protectedPlayerIndexes(current, graph(), 12), [0, 1]);
});

test("a portent with no protected player records the attempt but applies no disaster", () => {
  const original = game({ builds: {} });
  const result = reduceDisaster(original, graph(), 12, { type: "peste", now: () => 10 });
  assert.equal(result.event.outcome, "NO_PROTECTED");
  assert.equal(result.event.disasterType, null);
  assert.equal(result.game.stats.disasters, 1);
  assert.equal(original.stats.disasters, 0);
});

test("immune players are not affected and do not become sacred-number beneficiaries", () => {
  const original = game({
    players: [player(), player({ immune: true }), player({ immune: true })],
  });
  const result = reduceDisaster(original, graph(), 12, { type: "peste", now: () => 11 });
  assert.equal(result.event.outcome, "NO_TARGETS");
  assert.deepEqual(result.event.protectedPlayers, [0]);
  assert.deepEqual(result.event.immunePlayers, [1, 2]);
  assert.equal(result.game.players[1].sick, 0);
});

test("the disaster selector includes the formerly unreachable royal tribute", () => {
  assert.deepEqual(DISASTER_TYPES, ["ganancia", "peste", "tsunami", "tributo"]);
  const result = reduceDisaster(game(), graph(), 12, {
    rng: () => 0.999999,
    now: () => 12,
  });
  assert.equal(result.event.disasterType, "tributo");
});

test("unknown forced disaster types are rejected", () => {
  assert.throws(() => reduceDisaster(game(), graph(), 12, { type: "meteoro" }), /desconhecido/i);
});

test("greed removes random resources, distributes the loot and compensates empty-handed protectors", () => {
  const original = game({
    players: [
      player(),
      player({ ch: "maria" }),
      player({ ch: "romeo", res: resources({ madeira: 1 }) }),
    ],
    builds: { A: { p: 0, t: 1 }, B: { p: 1, t: 1 } },
  });
  const result = reduceDisaster(original, graph(), 12, {
    type: "ganancia",
    rng: sequence([0, 0, 0.65]),
    now: () => 13,
  });
  assert.equal(result.game.players[2].res.madeira, 0);
  assert.equal(result.game.players[0].res.madeira, 1);
  assert.equal(result.game.players[1].res.ouro, 1);
  assert.equal(original.players[2].res.madeira, 1);
  assert.equal(original.players[0].res.madeira, 0);
  assert.ok(result.event.effects.some((effect) => effect.source === "BANK_COMPENSATION"));
});

test("plague quarantines every affected player for two turns", () => {
  const result = reduceDisaster(game(), graph(), 12, { type: "peste", now: () => 14 });
  assert.equal(result.game.players[0].sick, 0);
  assert.equal(result.game.players[1].sick, 2);
  assert.equal(result.game.players[2].sick, 2);
  assert.equal(result.event.effects.filter((effect) => effect.type === "QUARANTINED").length, 2);
});

test("a tsunami disables the only active port immediately", () => {
  const original = game({
    builds: { A: { p: 0, t: 1 }, C: { p: 1, t: 1 } },
    board: { ...game().board, ports: [{ e: "e1", type: "any", hid: false }] },
  });
  const result = reduceDisaster(original, graph(), 12, { type: "tsunami", now: () => 15 });
  assert.deepEqual(result.game.players[1].portOff, [{ e: "e1", left: 3 }]);
  assert.deepEqual(original.players[1].portOff, []);
});

test("a tsunami queues a choice when a player owns several active ports", () => {
  const original = game({
    builds: { A: { p: 0, t: 1 }, C: { p: 1, t: 1 }, E: { p: 1, t: 1 } },
    board: {
      ...game().board,
      ports: [
        { e: "e1", type: "any", hid: false },
        { e: "e2", type: "madeira", hid: false },
      ],
    },
  });
  const result = reduceDisaster(original, graph(), 12, { type: "tsunami", now: () => 16 });
  assert.deepEqual(result.game.queue, [{ t: "tsunami", p: 1 }]);
  assert.deepEqual(result.game.players[1].portOff, []);
});

test("a tsunami takes a random coastal resource from players without ports", () => {
  const original = game({
    players: [player(), player({ res: resources({ obsidiana: 1 }) }), player()],
  });
  const result = reduceDisaster(original, graph(), 12, {
    type: "tsunami",
    rng: () => 0,
    now: () => 17,
  });
  assert.equal(result.game.players[1].res.obsidiana, 0);
  assert.ok(result.event.effects.some((effect) => (
    effect.type === "RESOURCE_LOST" && effect.reason === "TSUNAMI"
  )));
});

test("royal tribute charges affected players and queues two choices for each protected player", () => {
  const original = game({
    players: [
      player(),
      player({ res: resources({ ouro: 1 }) }),
      player({ res: resources({ tijolo: 1 }) }),
    ],
  });
  const result = reduceDisaster(original, graph(), 12, {
    type: "tributo",
    rng: () => 0,
    now: () => 18,
  });
  assert.equal(result.game.players[1].res.ouro, 0);
  assert.equal(result.game.players[2].res.tijolo, 0);
  assert.deepEqual(result.game.queue, [{ t: "tributo", p: 0, left: 2 }]);
});

test("resolving a tsunami port choice disables the selected port and advances the queue immutably", () => {
  const original = game({
    players: [player(), player()],
    builds: { A: { p: 0, t: 1 }, C: { p: 1, t: 1 }, E: { p: 1, t: 1 } },
    board: {
      ...game().board,
      ports: [
        { e: "e1", type: "any", hid: false },
        { e: "e2", type: "madeira", hid: false },
      ],
    },
    queue: [{ t: "tsunami", p: 1 }, { t: "tributo", p: 0, left: 2 }],
  });
  const result = reduceTsunamiPortChoice(original, graph(), 1, "e2");
  assert.deepEqual(result.game.players[1].portOff, [{ e: "e2", left: 3 }]);
  assert.deepEqual(result.game.queue, [{ t: "tributo", p: 0, left: 2 }]);
  assert.deepEqual(original.players[1].portOff, []);
});

test("tribute choices grant one resource at a time and remove the decision after the second", () => {
  const original = game({ queue: [{ t: "tributo", p: 0, left: 2 }] });
  const first = reduceTributeResourceChoice(original, 0, "madeira");
  assert.equal(first.game.players[0].res.madeira, 1);
  assert.deepEqual(first.game.queue, [{ t: "tributo", p: 0, left: 1 }]);
  assert.equal(first.event.completed, false);

  const second = reduceTributeResourceChoice(first.game, 0, "ouro");
  assert.equal(second.game.players[0].res.ouro, 1);
  assert.deepEqual(second.game.queue, []);
  assert.equal(second.event.completed, true);
  assert.equal(original.players[0].res.madeira, 0);
});

test("disaster RNG rejects non-finite samples", () => {
  assert.throws(() => reduceDisaster(game(), graph(), 12, { rng: () => Number.NaN }), /RNG/);
});
