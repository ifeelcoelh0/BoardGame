import test from "node:test";
import assert from "node:assert/strict";
import {
  reduceDiscardDecision,
  reduceDragonPlacement,
  reduceMandatoryQueueSkip,
  reduceQueueResourceDecision,
  reduceResourceSteal,
  reduceTsunamiDecision,
  requiredGameActorIndex,
  validDragonHexes,
} from "../src/game/mandatoryDecisionReducer.js";
import { createGameStateView } from "../src/game/gameStateView.js";
import { createEmptyResources } from "../src/game/resources.js";

function resources(values = {}) {
  return { ...createEmptyResources(), ...values };
}

function player(values = {}) {
  return {
    playerId: values.playerId || "player_" + Math.random().toString(16).slice(2).padEnd(24, "0").slice(0, 24),
    ch: "vlad",
    res: resources(),
    devNew: [],
    devOld: [],
    portOff: [],
    immune: false,
    ...values,
  };
}

function graph() {
  return {
    hexMap: {
      h0: { k: "h0", terr: "floresta", corners: ["A", "B"] },
      h1: { k: "h1", terr: "montanha", corners: ["B", "C"] },
      h2: { k: "h2", terr: "argila", corners: ["D", "E"] },
    },
    verts: {
      A: { edges: ["e1"], hexes: ["h0"] },
      B: { edges: ["e1"], hexes: ["h0", "h1"] },
      C: { edges: ["e2"], hexes: ["h1"] },
      D: { edges: ["e3"], hexes: ["h2"] },
      E: { edges: ["e3"], hexes: ["h2"] },
    },
    edges: {
      e1: { a: "A", b: "B", hexes: ["h0"] },
      e2: { a: "B", b: "C", hexes: ["h1"] },
      e3: { a: "D", b: "E", hexes: ["h2"] },
    },
  };
}

function game(overrides = {}) {
  const players = overrides.players || [
    player({ playerId: "player_111111111111111111111111" }),
    player({ playerId: "player_222222222222222222222222", ch: "maria" }),
    player({ playerId: "player_333333333333333333333333", ch: "bones" }),
  ];
  return {
    phase: "play",
    players,
    order: [0, 1, 2],
    turn: { pos: 0, rolled: true, mustDragon: true, steal: null },
    queue: [],
    builds: { A: { p: 1, t: 1 }, B: { p: 2, t: 1 } },
    board: {
      dragon: "h2",
      hexes: [
        { k: "h0", terr: "floresta", hid: false },
        { k: "h1", terr: "montanha", hid: true },
        { k: "h2", terr: "argila", hid: false },
      ],
      ports: [],
    },
    stats: {},
    ...structuredClone(overrides),
    players: structuredClone(players),
  };
}

test("requiredGameActorIndex gives mandatory queues priority over setup and turn", () => {
  assert.equal(requiredGameActorIndex(game({ queue: [{ t: "descarte", p: 2, need: 1 }] })), 2);
  assert.equal(requiredGameActorIndex(game({ phase: "setup", setup: { seq: [1, 0], i: 0 } })), 1);
  assert.equal(requiredGameActorIndex(game({ turn: { pos: 1 } })), 1);
  assert.equal(requiredGameActorIndex({ phase: "lobby", players: [] }), -1);
});

test("validDragonHexes excludes the current dragon and fog without confusing redacted terrain", () => {
  const canonical = game();
  const view = createGameStateView(canonical, canonical.players[0].playerId);
  assert.deepEqual(validDragonHexes(canonical), ["h0"]);
  assert.deepEqual(validDragonHexes(view), validDragonHexes(canonical));
});

test("placing the dragon creates only eligible victims and leaves the source immutable", () => {
  const original = game({
    players: [
      player({ res: resources({ madeira: 1 }) }),
      player({ res: resources({ ouro: 2 }) }),
      player({ immune: true, res: resources({ tijolo: 2 }) }),
    ],
  });
  const result = reduceDragonPlacement(original, graph(), 0, "h0", { now: () => 123 });
  assert.equal(result.game.board.dragon, "h0");
  assert.equal(result.game.turn.mustDragon, false);
  assert.deepEqual(result.game.turn.steal, { hex: "h0", victims: [1], at: 123 });
  assert.equal(result.game.stats.dragonMoves[0], 1);
  assert.deepEqual(result.event.excluded, [{ playerIndex: 2, reason: "IMMUNE" }]);
  assert.equal(original.board.dragon, "h2");
  assert.equal(original.turn.mustDragon, true);
});

test("placing the dragon clears the steal decision when adjacent hands are empty", () => {
  const original = game({ players: [player(), player(), player()] });
  const result = reduceDragonPlacement(original, graph(), 0, "h0", { now: () => 5 });
  assert.equal(result.game.turn.steal, null);
  assert.deepEqual(result.event.victims, []);
});

test("resource stealing uses deterministic RNG, updates statistics and keeps the resource private", () => {
  const original = game({
    players: [player(), player({ res: resources({ madeira: 1, ouro: 1 }) }), player()],
    turn: { pos: 0, rolled: true, mustDragon: false, steal: { hex: "h0", victims: [1], at: 1 } },
  });
  const result = reduceResourceSteal(original, 0, 1, { rng: () => 0.99 });
  assert.equal(result.game.players[0].res.ouro, 1);
  assert.equal(result.game.players[1].res.ouro, 0);
  assert.equal(result.game.stats.robbedBy[0], 1);
  assert.equal(result.game.stats.robbedFrom[1], 1);
  assert.equal(result.game.turn.steal, null);
  assert.deepEqual(result.event, { type: "RESOURCE_STOLEN", actorIndex: 0, victimIndex: 1 });
  assert.equal(result.privateResult.resource, "ouro");
  assert.equal(original.players[1].res.ouro, 1);
});

test("resource stealing rejects invalid victims and invalid RNG samples", () => {
  const original = game({
    players: [player(), player({ res: resources({ madeira: 1 }) }), player()],
    turn: { pos: 0, steal: { victims: [1] } },
  });
  assert.throws(() => reduceResourceSteal(original, 0, 2), /roubo pendente/i);
  assert.throws(() => reduceResourceSteal(original, 0, 1, { rng: () => Number.NaN }), /RNG/i);
});

test("discard resolution consumes exactly the required resources immutably", () => {
  const original = game({
    players: [player({ res: resources({ madeira: 3, ouro: 2 }) }), player(), player()],
    queue: [{ t: "descarte", p: 0, need: 2 }, { t: "bencao", p: 1, left: 1 }],
  });
  const result = reduceDiscardDecision(original, 0, { madeira: 1, ouro: 1 });
  assert.equal(result.game.players[0].res.madeira, 2);
  assert.equal(result.game.players[0].res.ouro, 1);
  assert.deepEqual(result.game.queue, [{ t: "bencao", p: 1, left: 1 }]);
  assert.equal(original.players[0].res.madeira, 3);
});

test("discard resolution rejects incorrect totals and unavailable resources", () => {
  const original = game({
    players: [player({ res: resources({ madeira: 1 }) }), player(), player()],
    queue: [{ t: "descarte", p: 0, need: 1 }],
  });
  assert.throws(() => reduceDiscardDecision(original, 0, {}), /quantidade descartada/i);
  assert.throws(() => reduceDiscardDecision(original, 0, { ouro: 1 }), /quantidade inválida/i);
});

test("blessings grant one resource at a time and count each received resource", () => {
  const original = game({ queue: [{ t: "bencao", p: 0, left: 2 }] });
  const first = reduceQueueResourceDecision(original, 0, "madeira");
  assert.equal(first.game.players[0].res.madeira, 1);
  assert.equal(first.game.stats.blessings[0], 1);
  assert.equal(first.event.completed, false);
  const second = reduceQueueResourceDecision(first.game, 0, "ouro");
  assert.equal(second.game.players[0].res.ouro, 1);
  assert.equal(second.game.stats.blessings[0], 2);
  assert.deepEqual(second.game.queue, []);
  assert.equal(second.event.completed, true);
});

test("guard blessings preserve their origin in the semantic event", () => {
  const result = reduceQueueResourceDecision(game({ queue: [{ t: "bencao", p: 0, left: 1, guard: true }] }), 0, "tijolo");
  assert.equal(result.event.guard, true);
});

test("tribute choices are resolved through the unified resource decision reducer", () => {
  const result = reduceQueueResourceDecision(game({ queue: [{ t: "tributo", p: 0, left: 1 }] }), 0, "obsidiana");
  assert.equal(result.game.players[0].res.obsidiana, 1);
  assert.deepEqual(result.game.queue, []);
  assert.equal(result.event.decisionType, "tributo");
  assert.equal(result.event.completed, true);
});

test("tsunami decisions disable only an active selected port", () => {
  const currentGraph = graph();
  const original = game({
    builds: { D: { p: 0, t: 1 }, E: { p: 0, t: 1 } },
    board: { ...game().board, ports: [{ e: "e3", type: "any", hid: false }] },
    queue: [{ t: "tsunami", p: 0 }],
  });
  const result = reduceTsunamiDecision(original, currentGraph, 0, "e3");
  assert.deepEqual(result.game.players[0].portOff, [{ e: "e3", left: 3 }]);
  assert.deepEqual(result.game.queue, []);
});

test("mandatory queue skip removes only the current actor decision and reports its label", () => {
  const original = game({ queue: [{ t: "tsunami", p: 1 }, { t: "bencao", p: 0, left: 1 }] });
  assert.equal(reduceMandatoryQueueSkip(original, 0).handled, false);
  const result = reduceMandatoryQueueSkip(original, 1);
  assert.equal(result.handled, true);
  assert.equal(result.event.label, "escolha de porto");
  assert.deepEqual(result.game.queue, [{ t: "bencao", p: 0, left: 1 }]);
  assert.equal(original.queue.length, 2);
});
