import test from "node:test";
import assert from "node:assert/strict";
import {
  GAME_ACTION_COMMAND,
  buildConstructionActionModel,
  buildGameActionModel,
} from "../src/ui/game/gameActionModel.js";

function graph() {
  return {
    verts: {
      A: { edges: ["AB", "AC"], hexes: ["h1"] },
      B: { edges: ["AB"], hexes: ["h1"] },
      C: { edges: ["AC"], hexes: ["h1"] },
    },
    edges: {
      AB: { a: "A", b: "B", hexes: ["h1"] },
      AC: { a: "A", b: "C", hexes: ["h1"] },
    },
    hexMap: { h1: { corners: ["A", "B", "C"] } },
  };
}

function game(overrides = {}) {
  return {
    phase: "play",
    winner: null,
    mode: "classico",
    turn: { rolled: true, mustDragon: false, steal: null, deploy: null, acted: {} },
    queue: [],
    trade: null,
    roads: {},
    builds: { A: { p: 0, t: 1 } },
    players: [{
      ch: "maria",
      connected: true,
      res: { madeira: 4, tijolo: 4, cavalos: 4, ouro: 4, obsidiana: 4 },
      freeRoads: 0,
      portOff: [],
      troops: { cavaleiro: 0, catapulta: 0, arqueiro: 0 },
    }, {
      ch: "vlad",
      connected: true,
      res: { madeira: 2, tijolo: 2, cavalos: 2, ouro: 2, obsidiana: 2 },
      freeRoads: 0,
      portOff: [],
      troops: { cavaleiro: 0, catapulta: 0, arqueiro: 0 },
    }],
    board: { hexes: [{ k: "h1", terr: "floresta", hid: false }], ports: [], dragon: null },
    deck: [{ id: 1, kind: "monopolio" }],
    units: {},
    wagons: {},
    wbuilt: {},
    ...overrides,
  };
}

function actionById(model, id) {
  for (const group of model.groups) {
    const action = group.actions.find((candidate) => candidate.id === id);
    if (action) return action;
  }
  return id === "end-turn" ? model.endTurn : id === "roll-dice" ? model.roll : null;
}

test("construction action model exposes enabled state and canonical costs", () => {
  const model = buildConstructionActionModel(game(), graph(), 0, { myTurn: true });
  assert.equal(model.road.enabled, true);
  assert.equal(model.road.reason, null);
  assert.deepEqual(model.road.cost, { madeira: 1, tijolo: 1 });
  assert.equal(model.palace.enabled, true);
});

test("construction action model explains affordability instead of returning only false", () => {
  const g = game();
  g.players[0].res = { madeira: 0, tijolo: 0, cavalos: 0, ouro: 0, obsidiana: 0 };
  const model = buildConstructionActionModel(g, graph(), 0, { myTurn: true });
  assert.equal(model.road.enabled, false);
  assert.match(model.road.reason, /Falta/i);
  assert.match(model.road.reason, /Madeira|madeira/i);
});

test("free roads remain actionable without resource payment", () => {
  const g = game();
  g.players[0].freeRoads = 2;
  g.players[0].res = { madeira: 0, tijolo: 0, cavalos: 0, ouro: 0, obsidiana: 0 };
  const model = buildConstructionActionModel(g, graph(), 0, { myTurn: true });
  assert.equal(model.road.enabled, true);
  assert.equal(model.road.free, true);
  assert.deepEqual(model.road.cost, {});
  assert.equal(model.road.badge, "GRÁTIS");
});

test("common turn blockers have explicit reasons", () => {
  const model = buildConstructionActionModel(game(), graph(), 0, { myTurn: false });
  assert.equal(model.road.enabled, false);
  assert.match(model.road.reason, /turno/i);
});

test("full action model presents dice as the only primary phase before rolling", () => {
  const g = game({ turn: { rolled: false, mustDragon: false, steal: null, deploy: null, acted: {} } });
  const model = buildGameActionModel(g, graph(), 0, { myTurn: true });
  assert.equal(model.phase, "roll");
  assert.equal(model.roll.enabled, true);
  assert.equal(model.roll.command.type, GAME_ACTION_COMMAND.DISPATCH);
  assert.equal(model.roll.command.actionType, "ROLL_DICE");
});

test("a trade in progress blocks normal actions with the same visible reason", () => {
  const g = game({ trade: { id: "trade-1", from: 0, to: 1, give: {}, get: {}, declined: [] } });
  const model = buildGameActionModel(g, graph(), 0, { myTurn: true });
  for (const id of ["road", "development-card", "bank", "end-turn"]) {
    const action = actionById(model, id);
    assert.equal(action.enabled, false, id);
    assert.match(action.reason, /troca/i, id);
  }
});

test("dragon placement blocks the action panel instead of exposing reducer-rejected actions", () => {
  const g = game({ turn: { rolled: true, mustDragon: true, steal: null, deploy: null, acted: {} } });
  const model = buildGameActionModel(g, graph(), 0, { myTurn: true });
  assert.equal(actionById(model, "road").enabled, false);
  assert.match(actionById(model, "road").reason, /Dragão/i);
  assert.equal(actionById(model, "end-turn").enabled, false);
});

test("development-card action reports an empty deck distinctly", () => {
  const model = buildGameActionModel(game({ deck: [] }), graph(), 0, { myTurn: true });
  const card = actionById(model, "development-card");
  assert.equal(card.enabled, false);
  assert.match(card.reason, /baralho/i);
});

test("trade action explains when no other human is connected", () => {
  const g = game();
  g.players[1].connected = false;
  const model = buildGameActionModel(g, graph(), 0, { myTurn: true });
  const trade = actionById(model, "trade");
  assert.equal(trade.enabled, false);
  assert.match(trade.reason, /jogador ligado/i);
});

test("interaction modes are represented declaratively as active actions", () => {
  const model = buildGameActionModel(game(), graph(), 0, { myTurn: true, interactionMode: "aldeia" });
  const village = actionById(model, "village");
  assert.equal(village.active, true);
  assert.deepEqual(village.command, { type: GAME_ACTION_COMMAND.TOGGLE_MODE, mode: "aldeia" });
});

test("war actions belong to their own group and inherit common blockers", () => {
  const g = game({
    mode: "guerra",
    trade: { id: "t", from: 0, to: 1, give: {}, get: {}, declined: [] },
    gelo: { active: false },
  });
  const model = buildGameActionModel(g, graph(), 0, { myTurn: true });
  const war = model.groups.find((candidate) => candidate.id === "war");
  assert.ok(war);
  assert.deepEqual(war.actions.slice(0, 3).map((action) => action.id), ["recruit-cavaleiro", "recruit-catapulta", "recruit-arqueiro"]);
  assert.ok(war.actions.every((action) => !action.enabled));
});

test("exploration exposes wagon construction through the same command contract", () => {
  const g = game({ mode: "exploracao" });
  const model = buildGameActionModel(g, graph(), 0, { myTurn: true });
  const wagon = actionById(model, "build-wagon");
  assert.ok(wagon);
  assert.equal(wagon.command.type, GAME_ACTION_COMMAND.TOGGLE_MODE);
  assert.equal(wagon.command.mode, "carruagem");
  assert.deepEqual(wagon.cost, { madeira: 1, cavalos: 2 });
});
