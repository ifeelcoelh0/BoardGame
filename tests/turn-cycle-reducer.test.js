import test from "node:test";
import assert from "node:assert/strict";
import { createPlayTurnState } from "../src/game/turnState.js";
import {
  ICE_DRAGON_WAKE_TURNS,
  createFreshTurn,
  currentTurnPlayerIndex,
  reduceIncomingPlayerEffects,
  reduceTurnAdvance,
  roundsForTurns,
  warRoundLimit,
} from "../src/game/turnCycleReducer.js";
import { createEmptyResources } from "../src/game/resources.js";

function player(overrides = {}) {
  return {
    playerId: overrides.playerId || `player_${Math.random().toString(16).slice(2).padEnd(24, "0").slice(0, 24)}`,
    ch: "vlad",
    res: createEmptyResources(),
    devNew: [],
    devOld: [],
    troops: { cavaleiro: 0, catapulta: 0, arqueiro: 0 },
    sick: 0,
    portOff: [],
    freeRoads: 0,
    ...overrides,
  };
}

function graph() {
  return {
    hexMap: {
      "0,0": { k: "0,0", corners: ["A"] },
      "1,0": { k: "1,0", corners: ["B"] },
    },
    verts: {
      A: { edges: [], hexes: ["0,0"] },
      B: { edges: [], hexes: ["1,0"] },
    },
    edges: {},
  };
}

function game(overrides = {}) {
  const players = overrides.players || [player(), player({ ch: "maria" }), player({ ch: "bones" })];
  const base = {
    phase: "play",
    mode: "classico",
    players,
    order: players.map((_, index) => index),
    turn: {
      pos: 0,
      rolled: true,
      dice: [4, 3],
      devPlayed: true,
      mustDragon: false,
      steal: null,
      milN: 1,
      acted: { "0,0": true },
      deploy: null,
      troopPlayed: true,
      bribed: true,
      bonus: "0,0",
    },
    round: 1,
    queue: [],
    trade: null,
    board: {
      dragon: "1,0",
      hexes: [
        { k: "0,0", terr: "floresta", hid: false },
        { k: "1,0", terr: "montanha", hid: false },
      ],
      ports: [],
    },
    builds: {},
    roads: {},
    units: {},
    occ: {},
    wagons: {},
    gelo: null,
    troll: null,
    glory: {},
    gloried: {},
    lr: null,
    la: null,
    ...structuredClone(overrides),
    players: structuredClone(players),
  };
  return base;
}

function warGame(overrides = {}) {
  return game({
    mode: "guerra",
    gelo: { awake: false, active: false },
    troll: { awake: false, defeated: true, turns: 0, rush: 0, lair: null, giant: null },
    ...overrides,
  });
}

test("turn helpers derive the active player and scaling rounds", () => {
  const current = game({ turn: { pos: 1 } });
  assert.equal(currentTurnPlayerIndex(current), 1);
  assert.equal(roundsForTurns(current, ICE_DRAGON_WAKE_TURNS), 4);
  assert.equal(warRoundLimit(current), 13);
});

test("createFreshTurn preserves only the previous dice and clears temporary actions", () => {
  assert.deepEqual(createFreshTurn({ dice: [6, 2], bribed: true, bonus: "x" }, 2), {
    pos: 2,
    rolled: false,
    dice: [6, 2],
    devPlayed: false,
    mustDragon: false,
    steal: null,
    milN: 0,
    acted: {},
    deploy: null,
    troopPlayed: false,
  });
});

test("incoming effects decrement sickness and expire disabled ports immutably", () => {
  const original = game({
    players: [player(), player({ sick: 2, portOff: [{ e: "e1", left: 1 }, { e: "e2", left: 3 }] }), player()],
  });
  const result = reduceIncomingPlayerEffects(original, 1);
  assert.equal(result.game.players[1].sick, 1);
  assert.deepEqual(result.game.players[1].portOff, [{ e: "e2", left: 2 }]);
  assert.deepEqual(result.event.expiredPorts, ["e1"]);
  assert.equal(original.players[1].sick, 2);
  assert.equal(original.players[1].portOff[0].left, 1);
});

test("classic turn advance matures cards, clears free roads and resets the next player", () => {
  const original = game({
    players: [
      player({ devNew: [{ id: "new", kind: "vp" }], freeRoads: 2 }),
      player({ sick: 1, portOff: [{ e: "e1", left: 2 }] }),
      player(),
    ],
    wagons: {
      w1: { p: 0, at: "0,0", cargo: 0, mv: 2 },
      w2: { p: 1, at: "1,0", cargo: 1, mv: 0 },
    },
  });
  const result = reduceTurnAdvance(original, graph(), 0);
  assert.deepEqual(result.game.players[0].devNew, []);
  assert.equal(result.game.players[0].devOld[0].id, "new");
  assert.equal(result.game.players[0].freeRoads, 0);
  assert.equal(result.game.players[1].sick, 0);
  assert.deepEqual(result.game.players[1].portOff, [{ e: "e1", left: 1 }]);
  assert.equal(result.game.wagons.w1.mv, 0);
  assert.equal(result.game.wagons.w2.mv, 1);
  assert.equal(result.game.turn.pos, 1);
  assert.equal(result.game.turn.rolled, false);
  assert.equal("bribed" in result.game.turn, false);
  assert.equal("bonus" in result.game.turn, false);
  assert.equal(original.players[0].devNew.length, 1);
  assert.equal(original.wagons.w1.mv, 2);
});

test("round advances only when the order wraps", () => {
  const mid = reduceTurnAdvance(game({ round: 4, turn: { pos: 0, dice: [1, 1] } }), graph(), 0);
  assert.equal(mid.game.round, 4);
  assert.equal(mid.event.wrappedRound, false);

  const wrapped = reduceTurnAdvance(game({ round: 4, turn: { pos: 2, dice: [1, 1] } }), graph(), 2);
  assert.equal(wrapped.game.round, 5);
  assert.equal(wrapped.event.wrappedRound, true);
  assert.equal(wrapped.game.turn.pos, 0);
});

test("turn advance rejects wrong phases, actors and malformed orders", () => {
  assert.throws(() => reduceTurnAdvance(game({ phase: "setup" }), graph(), 0), /partida em jogo/i);
  assert.throws(() => reduceTurnAdvance(game(), graph(), 1), /jogador ativo/i);
  assert.throws(() => reduceTurnAdvance(game({ order: [0, 1] }), graph(), 0), /ordem de turnos/i);
});

test("ice dragon awakens at the configured round threshold", () => {
  const current = warGame({
    players: [player(), player(), player(), player()],
    order: [0, 1, 2, 3],
    round: 2,
    turn: { pos: 3, dice: [5, 4] },
  });
  const result = reduceTurnAdvance(current, graph(), 3, { rng: () => 0 });
  assert.equal(result.game.round, 3);
  assert.equal(result.game.gelo.awake, true);
  assert.equal(result.event.iceDragonAwakened, true);
  assert.ok(result.event.events.some((event) => event.type === "ICE_DRAGON_AWAKENED"));
});

test("ice dragon awakening is emitted only once", () => {
  const current = warGame({ gelo: { awake: true, active: false }, round: 10 });
  const result = reduceTurnAdvance(current, graph(), 0, { rng: () => 0 });
  assert.equal(result.event.iceDragonAwakened, false);
  assert.equal(result.event.events.some((event) => event.type === "ICE_DRAGON_AWAKENED"), false);
});

test("heart guard queues a blessing for the incoming controller", () => {
  const current = warGame({ units: { "0,0": { p: 1, t: "cavaleiro" } } });
  const result = reduceTurnAdvance(current, graph(), 0, { rng: () => 0 });
  assert.equal(result.event.guardBlessingQueued, true);
  assert.deepEqual(result.game.queue, [{ t: "bencao", p: 1, left: 1, guard: true }]);
});

test("heart guard is suppressed while the giant occupies the centre", () => {
  const current = warGame({
    units: { "0,0": { p: 1, t: "cavaleiro" } },
    troll: { awake: true, defeated: false, turns: 0, rush: 0, lair: "0,0", giant: { at: "0,0", hp: 10, maxHp: 10, pause: 1 } },
  });
  const result = reduceTurnAdvance(current, graph(), 0, { rng: () => 0 });
  assert.equal(result.event.guardBlessingQueued, false);
  assert.deepEqual(result.game.queue, []);
});

test("war round limit is signaled on a wrapped round without queuing guard rewards", () => {
  const current = warGame({
    players: [player(), player()],
    order: [0, 1],
    round: 20,
    turn: { pos: 1, dice: [3, 3] },
    units: { "0,0": { p: 0, t: "cavaleiro" } },
  });
  const result = reduceTurnAdvance(current, graph(), 1, { rng: () => 0 });
  assert.equal(result.game.round, 21);
  assert.equal(result.event.roundLimitReached, true);
  assert.equal(result.event.guardBlessingQueued, false);
  assert.deepEqual(result.game.queue, []);
});

test("war end-turn sweep is part of the unified turn transition", () => {
  const current = warGame({
    troll: { awake: true, defeated: false, turns: 0, rush: 0, lair: "0,0", giant: { at: "0,0", hp: 10, maxHp: 10, pause: 1 } },
    units: { "1,0": { p: 0, t: "cavaleiro" } },
  });
  const result = reduceTurnAdvance(current, graph(), 0, { rng: () => 0 });
  assert.equal(result.game.units["1,0"], undefined);
  assert.ok(result.event.events.some((event) => event.type === "GIANT_CAMPER_CRUSHED"));
});

test("a unit marked as having attacked the giant survives one sweep and loses the marker", () => {
  const current = warGame({
    troll: { awake: true, defeated: false, turns: 0, rush: 0, lair: "0,0", giant: { at: "0,0", hp: 10, maxHp: 10, pause: 1 } },
    units: { "1,0": { p: 0, t: "cavaleiro", atk: 1 } },
  });
  const result = reduceTurnAdvance(current, graph(), 0, { rng: () => 0 });
  assert.equal(result.game.units["1,0"].t, "cavaleiro");
  assert.equal("atk" in result.game.units["1,0"], false);
  assert.ok(result.event.events.some((event) => event.type === "GIANT_CAMPER_SPARED"));
});

test("semantic event describes the complete transition in deterministic order", () => {
  const result = reduceTurnAdvance(game(), graph(), 0);
  assert.equal(result.event.type, "TURN_ADVANCED");
  assert.equal(result.event.previousPlayerIndex, 0);
  assert.equal(result.event.playerIndex, 1);
  assert.equal(result.event.events.at(-1).type, "TURN_STARTED");
});

test("turn reducers share the canonical turn-state factory", () => {
  const previous = { dice: [5, 3], bonus: "legacy-only", bribed: true };
  assert.deepEqual(
    createFreshTurn(previous, 2),
    createPlayTurnState({ position: 2, previousDice: [5, 3] }),
  );
});
