import test from "node:test";
import assert from "node:assert/strict";
import {
  recordDiceStats,
  reduceDiceRoll,
  rollDicePair,
  rollDie,
} from "../src/game/diceReducer.js";
import { createEmptyResources } from "../src/game/resources.js";

function resources(values = {}) {
  return { ...createEmptyResources(), ...values };
}

function player(values = {}) {
  return {
    ch: "vlad",
    res: resources(),
    devNew: [],
    devOld: [],
    immune: false,
    ...values,
  };
}

function graph() {
  return {
    verts: {
      A: { edges: [], hexes: ["h1"] },
    },
    edges: {},
    hexMap: {
      h1: { k: "h1", terr: "floresta", corners: ["A"] },
    },
  };
}

function game(overrides = {}) {
  return {
    mode: "classico",
    phase: "play",
    players: [player(), player({ ch: "maria" })],
    builds: {},
    board: {
      dragon: "deserto",
      hexes: [{ k: "h1", terr: "floresta", num: 8, hid: false }],
    },
    turn: {
      pos: 0,
      rolled: false,
      dice: null,
      mustDragon: false,
    },
    queue: [],
    stats: {
      rolls: {},
      totalRolls: 0,
      sevens: 0,
      disasters: 0,
      produced: [0, 0],
      dragonBlocked: [0, 0],
    },
    units: {},
    perksOn: true,
    gelo: null,
    test: false,
    ...overrides,
  };
}

test("rollDie maps deterministic RNG samples to values from one to six", () => {
  assert.equal(rollDie(() => 0), 1);
  assert.equal(rollDie(() => 0.5), 4);
  assert.equal(rollDie(() => 0.999999), 6);
  assert.equal(rollDie(() => 1), 6);
});

test("rollDicePair consumes two RNG samples in order", () => {
  const values = [0, 0.999];
  assert.deepEqual(rollDicePair(() => values.shift()), [1, 6]);
});

test("the dice RNG rejects non-finite samples", () => {
  assert.throws(() => rollDie(() => Number.NaN), /RNG/);
});

test("recordDiceStats is immutable and counts totals and sevens", () => {
  const original = { rolls: { 8: 2 }, totalRolls: 2, sevens: 0, disasters: 4 };
  const next = recordDiceStats(original, 7);
  assert.deepEqual(next, { rolls: { 7: 1, 8: 2 }, totalRolls: 3, sevens: 1, disasters: 4 });
  assert.deepEqual(original, { rolls: { 8: 2 }, totalRolls: 2, sevens: 0, disasters: 4 });
});

test("a normal roll records the dice, produces resources and leaves the input untouched", () => {
  const original = game({ builds: { A: { p: 0, t: 1 } } });
  const result = reduceDiceRoll(original, graph(), 0, [4, 4]);
  assert.deepEqual(result.game.turn.dice, [4, 4]);
  assert.equal(result.game.turn.rolled, true);
  assert.equal(result.game.players[0].res.madeira, 1);
  assert.deepEqual(result.game.stats.rolls, { 8: 1 });
  assert.equal(result.game.stats.totalRolls, 1);
  assert.deepEqual(result.event.production.gains[0], resources({ madeira: 1 }));
  assert.equal(original.turn.rolled, false);
  assert.equal(original.players[0].res.madeira, 0);
});

test("a classic seven queues discards and requires moving the fire dragon", () => {
  const original = game({
    players: [
      player({ res: resources({ madeira: 8 }) }),
      player({ res: resources({ ouro: 7 }) }),
    ],
  });
  const result = reduceDiceRoll(original, graph(), 0, [3, 4]);
  assert.equal(result.game.turn.mustDragon, true);
  assert.deepEqual(result.game.queue, [{ t: "descarte", p: 0, need: 4 }]);
  assert.deepEqual(result.event.seven, {
    type: "FIRE_DRAGON",
    discards: [{ playerIndex: 0, need: 4 }],
  });
  assert.equal(result.game.stats.sevens, 1);
  assert.deepEqual(original.queue, []);
});

test("test games skip the mandatory discard but still require the dragon", () => {
  const result = reduceDiceRoll(game({
    test: true,
    players: [player({ res: resources({ madeira: 10 }) }), player()],
  }), graph(), 0, [1, 6]);
  assert.deepEqual(result.game.queue, []);
  assert.equal(result.game.turn.mustDragon, true);
});

test("a war seven awakens the ice dragon and queues blessings", () => {
  const original = game({
    mode: "guerra",
    players: [player({ ch: "vlad" }), player({ ch: "muriel" })],
    gelo: { awake: true, active: false },
  });
  const result = reduceDiceRoll(original, graph(), 0, [2, 5]);
  assert.equal(result.game.gelo.active, true);
  assert.deepEqual(result.game.queue, [
    { t: "bencao", p: 0, left: 2 },
    { t: "bencao", p: 1, left: 2 },
  ]);
  assert.equal(result.event.seven.awakened, true);
  assert.equal(result.event.seven.perksActivated, true);
});

test("Muriel receives the extra blessing when she rolled the seven", () => {
  const result = reduceDiceRoll(game({
    mode: "guerra",
    players: [player({ ch: "muriel" }), player({ ch: "vlad" })],
    gelo: { awake: true, active: true },
  }), graph(), 0, [6, 1]);
  assert.deepEqual(result.game.queue, [
    { t: "bencao", p: 0, left: 3 },
    { t: "bencao", p: 1, left: 1 },
  ]);
  assert.equal(result.event.seven.awakened, false);
});

test("awakening the house powers arms every Bones unit without mutating the original", () => {
  const original = game({
    mode: "guerra",
    players: [player({ ch: "bones" }), player()],
    gelo: { awake: true, active: false },
    units: {
      h1: { p: 0, t: "cavaleiro", sk: 0 },
      h2: { p: 1, t: "arqueiro", sk: 0 },
    },
  });
  const result = reduceDiceRoll(original, graph(), 1, [5, 2]);
  assert.equal(result.game.units.h1.sk, 1);
  assert.equal(result.game.units.h2.sk, 0);
  assert.equal(original.units.h1.sk, 0);
});

test("disabled house powers still activate the dragon but do not grant perks", () => {
  const result = reduceDiceRoll(game({
    mode: "guerra",
    perksOn: false,
    players: [player({ ch: "bones" }), player({ ch: "muriel" })],
    gelo: { awake: true, active: false },
    units: { h1: { p: 0, t: "cavaleiro", sk: 0 } },
  }), graph(), 0, [3, 4]);
  assert.equal(result.game.gelo.active, true);
  assert.equal(result.game.units.h1.sk, 0);
  assert.deepEqual(result.game.queue, [
    { t: "bencao", p: 0, left: 2 },
    { t: "bencao", p: 1, left: 1 },
  ]);
  assert.equal(result.event.seven.perksActivated, false);
});

test("extreme rolls request the correct follow-up for each mode", () => {
  const war = reduceDiceRoll(game({ mode: "guerra", gelo: { awake: false, active: false } }), graph(), 0, [1, 1]);
  assert.equal(war.event.triggerTrollOmen, true);
  assert.equal(war.event.triggerDisaster, false);

  const dragon = reduceDiceRoll(game({ mode: "dragao" }), graph(), 0, [6, 6]);
  assert.equal(dragon.event.triggerTrollOmen, false);
  assert.equal(dragon.event.triggerDisaster, true);

  const classic = reduceDiceRoll(game({ mode: "classico" }), graph(), 0, [1, 1]);
  const exploration = reduceDiceRoll(game({ mode: "exploracao" }), graph(), 0, [6, 6]);
  assert.equal(classic.event.triggerDisaster, false);
  assert.equal(exploration.event.triggerDisaster, false);
});

test("reduceDiceRoll rejects malformed dice", () => {
  assert.throws(() => reduceDiceRoll(game(), graph(), 0, [0, 7]), /dois dados/);
  assert.throws(() => reduceDiceRoll(game(), graph(), 0, [3]), /dois dados/);
});

test("2 and 12 trigger disasters only in modes whose canonical config enables them", () => {
  for (const [mode, expected] of Object.entries({
    dragao: true,
    rapido: true,
    classico: false,
    exploracao: false,
    guerra: false,
  })) {
    const original = game({ mode });
    const result = reduceDiceRoll(original, graph(), 0, [1, 1]);
    assert.equal(result.event.triggerDisaster, expected, mode);
  }
});
