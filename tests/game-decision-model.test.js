import test from "node:test";
import assert from "node:assert/strict";
import { buildGameDecisionModel, GAME_DECISION_TYPE } from "../src/ui/game/gameDecisionModel.js";

function graph() {
  return {
    verts: {},
    edges: {},
    hexMap: {},
  };
}

function game(overrides = {}) {
  return {
    phase: "play",
    mode: "classico",
    queue: [],
    trade: null,
    order: [0, 1],
    turn: { pos: 0, steal: null, rolled: true, mustDragon: false, deploy: null },
    board: { ports: [], hexes: [], dragon: null },
    players: [
      {
        ch: "maria",
        playerId: "player_a",
        connected: true,
        res: { madeira: 4, tijolo: 4, cavalos: 4, ouro: 4, obsidiana: 4 },
        portOff: [],
        devOld: [
          { id: 3, kind: "monopolio" },
          { id: 4, kind: "descoberta" },
          { id: 8, kind: "espiao" },
        ],
      },
      {
        ch: "vlad",
        playerId: "player_b",
        connected: true,
        res: { madeira: 1, tijolo: 2, cavalos: 3, ouro: 4, obsidiana: 5 },
        portOff: [],
      },
    ],
    ...overrides,
  };
}

test("mandatory discard has priority over a local utility decision", () => {
  const g = game({ queue: [{ t: "descarte", p: 0, need: 3 }] });
  const model = buildGameDecisionModel(g, graph(), 0, { decision: { type: "bank" } });
  assert.equal(model.type, GAME_DECISION_TYPE.DISCARD);
  assert.equal(model.need, 3);
  assert.equal(model.dismissible, false);
});

test("incoming trade becomes one canonical response decision", () => {
  const g = game({
    trade: { id: "t1", from: 1, to: 0, give: { madeira: 1 }, get: { ouro: 2 }, declined: [] },
  });
  const model = buildGameDecisionModel(g, graph(), 0);
  assert.equal(model.type, GAME_DECISION_TYPE.TRADE_RESPONSE);
  assert.equal(model.proposer.name, "Vlad Drácula");
  assert.equal(model.canAccept, true);
});

test("trade response reports affordability without changing the proposal", () => {
  const g = game({
    trade: { id: "t1", from: 1, to: 0, give: { madeira: 1 }, get: { ouro: 9 }, declined: [] },
  });
  const model = buildGameDecisionModel(g, graph(), 0);
  assert.equal(model.canAccept, false);
  assert.deepEqual(model.get, { ouro: 9 });
});

test("spy target model excludes the local player and keeps stable player ids", () => {
  const model = buildGameDecisionModel(game(), graph(), 0, { decision: { type: "spy", cardId: 8 } });
  assert.equal(model.type, GAME_DECISION_TYPE.SPY_TARGET);
  assert.equal(model.cardId, 8);
  assert.deepEqual(model.players.map((player) => player.playerId), ["player_b"]);
});

test("discovery retains the first resource as decision progress", () => {
  const model = buildGameDecisionModel(game(), graph(), 0, { decision: { type: "descoberta", cardId: 4, first: "ouro" } });
  assert.equal(model.type, GAME_DECISION_TYPE.DISCOVERY);
  assert.equal(model.first, "ouro");
  assert.match(model.description, /second/i);
});

test("bank model exposes every exchange ratio and whether the player can pay it", () => {
  const g = game();
  g.players[0].res = { madeira: 3, tijolo: 4, cavalos: 0, ouro: 0, obsidiana: 0 };
  const model = buildGameDecisionModel(g, graph(), 0, { decision: { type: "bank" } });
  assert.equal(model.type, GAME_DECISION_TYPE.BANK);
  const wood = model.exchanges.find((exchange) => exchange.give === "madeira");
  const brick = model.exchanges.find((exchange) => exchange.give === "tijolo");
  assert.equal(wood.ratio, 4);
  assert.equal(wood.affordable, false);
  assert.equal(brick.affordable, true);
});

test("steal decision outranks a local card decision", () => {
  const g = game({ turn: { pos: 0, steal: { victims: [1], at: 100 } } });
  const model = buildGameDecisionModel(g, graph(), 0, { decision: { type: "monopolio", cardId: 3 } });
  assert.equal(model.type, GAME_DECISION_TYPE.STEAL);
  assert.equal(model.players[0].name, "Vlad Drácula");
  assert.equal(model.dismissible, false);
});


test("stale local decisions disappear when the turn context no longer permits them", () => {
  const offTurn = game({ turn: { pos: 1, steal: null, rolled: true, mustDragon: false, deploy: null } });
  assert.equal(buildGameDecisionModel(offTurn, graph(), 0, { decision: { type: "bank" } }), null);

  const trading = game({ trade: { id: "t2", from: 0, to: 1, give: { madeira: 1 }, get: { ouro: 1 }, declined: [] } });
  assert.equal(buildGameDecisionModel(trading, graph(), 0, { decision: { type: "monopolio", cardId: 3 } }), null);
});

test("card decisions are tied to the actual playable card instead of only a remembered id", () => {
  const g = game();
  assert.equal(buildGameDecisionModel(g, graph(), 0, { decision: { type: "monopolio", cardId: 999 } }), null);
  assert.equal(buildGameDecisionModel(g, graph(), 0, { decision: { type: "spy", cardId: 3 } }), null);
});
