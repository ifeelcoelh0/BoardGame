import test from "node:test";
import assert from "node:assert/strict";
import {
  BUILD_COSTS,
  PIECE_LIMITS,
  RESOURCE_KEYS,
  canPay,
  createEmptyResources,
  handSize,
  payCost,
} from "../src/game/resources.js";
import {
  activePorts,
  bankRatio,
  pieceCount,
  validPalaces,
  validRoads,
  validVillages,
} from "../src/game/buildingRules.js";
import { createPublicGameStateView } from "../src/game/gameStateView.js";

function makeGraph() {
  return {
    verts: {
      A: { edges: ["AB", "AC"], hexes: ["h1"] },
      B: { edges: ["AB", "BD"], hexes: ["h1"] },
      C: { edges: ["AC", "CD"], hexes: ["h2"] },
      D: { edges: ["BD", "CD"], hexes: ["h2"] },
    },
    edges: {
      AB: { a: "A", b: "B", hexes: ["h1"] },
      AC: { a: "A", b: "C", hexes: ["h1", "h2"] },
      BD: { a: "B", b: "D", hexes: ["h1", "h2"] },
      CD: { a: "C", b: "D", hexes: ["h2"] },
    },
  };
}

function makeGame(mode = "classico") {
  return {
    mode,
    roads: {},
    builds: {},
    players: [
      { res: createEmptyResources(), portOff: [] },
      { res: createEmptyResources(), portOff: [] },
    ],
    board: {
      hexes: [
        { k: "h1", terr: "floresta", hid: false },
        { k: "h2", terr: "argila", hid: false },
      ],
      ports: [],
      prov: null,
    },
  };
}

test("resource definitions expose the five canonical resources", () => {
  assert.deepEqual(RESOURCE_KEYS, ["madeira", "tijolo", "cavalos", "ouro", "obsidiana"]);
  assert.deepEqual(createEmptyResources(), {
    madeira: 0,
    tijolo: 0,
    cavalos: 0,
    ouro: 0,
    obsidiana: 0,
  });
});

test("handSize supports canonical and filtered player views", () => {
  assert.equal(handSize({ res: { madeira: 2, tijolo: 1, cavalos: 0, ouro: 3, obsidiana: 1 } }), 7);
  assert.equal(handSize({ resourceCount: 11, res: createEmptyResources() }), 11);
});

test("canPay and payCost share the canonical build costs", () => {
  const player = { res: { madeira: 2, tijolo: 1, cavalos: 1, ouro: 1, obsidiana: 0 } };
  assert.equal(canPay(player, BUILD_COSTS.estrada), true);
  assert.equal(canPay(player, BUILD_COSTS.aldeia), true);
  assert.equal(canPay(player, BUILD_COSTS.palacio), false);
  payCost(player, BUILD_COSTS.estrada);
  assert.deepEqual(player.res, { madeira: 1, tijolo: 0, cavalos: 1, ouro: 1, obsidiana: 0 });
});

test("canPay rejects malformed or unknown costs", () => {
  const player = { res: createEmptyResources() };
  assert.equal(canPay(player, null), false);
  assert.equal(canPay(player, { rubis: 0 }), false);
  assert.equal(canPay(player, { madeira: -1 }), false);
  assert.equal(canPay(player, { madeira: 0.5 }), false);
});

test("piece limits remain stable outside the legacy component", () => {
  assert.deepEqual(PIECE_LIMITS, { estrada: 15, aldeia: 5, palacio: 4 });
});

test("roads connect to an owned building or an existing road", () => {
  const graph = makeGraph();
  const game = makeGame();
  game.builds.A = { p: 0, t: 1 };
  assert.deepEqual(validRoads(game, graph, 0).sort(), ["AB", "AC"]);

  game.roads.AB = 0;
  delete game.builds.A;
  assert.deepEqual(validRoads(game, graph, 0).sort(), ["AC", "BD"]);
});

test("an enemy building blocks a road continuation", () => {
  const graph = makeGraph();
  const game = makeGame();
  game.roads.AB = 0;
  game.builds.B = { p: 1, t: 1 };
  assert.equal(validRoads(game, graph, 0).includes("BD"), false);
});

test("setup roads are constrained to the selected vertex", () => {
  const graph = makeGraph();
  const game = makeGame();
  assert.deepEqual(validRoads(game, graph, 0, "A").sort(), ["AB", "AC"]);
});

test("exploration hides unopened edges and vertices", () => {
  const graph = makeGraph();
  const game = makeGame("exploracao");
  game.board.hexes[0].hid = true;
  game.builds.A = { p: 0, t: 1 };
  assert.equal(validRoads(game, graph, 0).includes("AB"), false);
  assert.equal(validVillages(game, graph, 0, true).includes("B"), false);
});

test("waste-to-waste edges are blocked in exploration and war", () => {
  const graph = makeGraph();
  for (const mode of ["exploracao", "guerra"]) {
    const game = makeGame(mode);
    game.board.hexes.forEach((hex) => { hex.terr = "deserto"; });
    game.builds.A = { p: 0, t: 1 };
    assert.equal(validRoads(game, graph, 0).includes("AC"), false);
  }
});

test("villages obey distance and road connectivity rules", () => {
  const graph = makeGraph();
  const game = makeGame();
  game.builds.A = { p: 1, t: 1 };
  game.roads.CD = 0;
  const valid = validVillages(game, graph, 0, false);
  assert.equal(valid.includes("B"), false, "B is adjacent to the existing building");
  assert.equal(valid.includes("D"), true, "D is connected to the player's road");
});

test("war setup keeps a player inside the province already claimed", () => {
  const graph = makeGraph();
  const game = makeGame("guerra");
  game.board.prov = { h1: 1, h2: 2 };
  game.builds.A = { p: 0, t: 1 };
  const valid = validVillages(game, graph, 0, true);
  assert.equal(valid.includes("B"), false, "B is too close to A");
  assert.equal(valid.includes("C"), false, "C touches another province");
});

test("palace targets and piece counts are derived from canonical structures", () => {
  const game = makeGame();
  game.roads = { AB: 0, AC: 0, BD: 1 };
  game.builds = {
    A: { p: 0, t: 1 },
    B: { p: 0, t: 2 },
    C: { p: 1, t: 1 },
  };
  assert.deepEqual(validPalaces(game, 0), ["A"]);
  assert.equal(pieceCount(game, 0, "estrada"), 2);
  assert.equal(pieceCount(game, 0, "aldeia"), 1);
  assert.equal(pieceCount(game, 0, "palacio"), 1);
});

test("ports expose 2:1, 3:1 and 4:1 ratios without hidden or disabled ports", () => {
  const graph = makeGraph();
  const game = makeGame();
  game.builds.A = { p: 0, t: 1 };
  game.board.ports = [
    { e: "AB", type: "madeira", hid: false },
    { e: "AC", type: "any", hid: false },
    { e: "BD", type: "ouro", hid: true },
  ];
  assert.equal(activePorts(game, graph, 0).length, 2);
  assert.equal(bankRatio(game, graph, 0, "madeira"), 2);
  assert.equal(bankRatio(game, graph, 0, "ouro"), 3);

  game.players[0].portOff = [{ e: "AB", left: 3 }, { e: "AC", left: 3 }];
  assert.equal(activePorts(game, graph, 0).length, 0);
  assert.equal(bankRatio(game, graph, 0, "madeira"), 4);
});


test("fog redaction preserves legal exploration roads at the waste boundary", () => {
  const graph = makeGraph();
  const canonical = makeGame("exploracao");
  canonical.phase = "play";
  canonical.deck = [];
  canonical.board.hexes[0] = { k: "h1", terr: "deserto", hid: false };
  canonical.board.hexes[1] = { k: "h2", terr: "floresta", num: 8, hid: true };
  canonical.builds.A = { p: 0, t: 1 };

  const view = createPublicGameStateView(canonical);
  assert.deepEqual(validRoads(canonical, graph, 0).sort(), ["AB", "AC"]);
  assert.deepEqual(validRoads(view, graph, 0).sort(), validRoads(canonical, graph, 0).sort());
  assert.equal(view.board.hexes[1].hid, true);
  assert.notEqual(view.board.hexes[1].terr, "deserto");
});
