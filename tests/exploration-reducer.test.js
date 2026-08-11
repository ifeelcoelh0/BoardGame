import test from "node:test";
import assert from "node:assert/strict";
import { createGameStateView } from "../src/game/gameStateView.js";
import { createEmptyResources } from "../src/game/resources.js";
import {
  EMPTY_WAGON_MOVES,
  LOADED_WAGON_MOVES,
  MAX_WAGONS_PER_GAME,
  WAGON_COST,
  homeHexes,
  playerWagons,
  reduceColonistLoading,
  reduceRemoteVillageFoundation,
  reduceWagonConstruction,
  reduceWagonMove,
  reduceWagonTurnReset,
  remoteVillageSpots,
  validWagonBuildHexes,
  validWagonMoves,
  wagonBuildCount,
  wagonMoves,
} from "../src/game/explorationReducer.js";

function player(id, res = {}) {
  return {
    playerId: id,
    seatId: `seat-${id}`,
    ch: id,
    sessionTokenHash: "a".repeat(64),
    res: { ...createEmptyResources(), ...res },
    devNew: [], devOld: [], portOff: [],
  };
}

function graph() {
  return {
    verts: {
      A: { hexes: ["0,0", "1,0"], edges: ["A|B", "A|C"] },
      B: { hexes: ["0,0"], edges: ["A|B"] },
      C: { hexes: ["1,0"], edges: ["A|C"] },
      D: { hexes: ["2,0"], edges: ["D|E", "D|F"] },
      E: { hexes: ["2,0"], edges: ["D|E"] },
      F: { hexes: ["2,0"], edges: ["D|F"] },
    },
    edges: {
      "A|B": { a: "A", b: "B", hexes: ["0,0"] },
      "A|C": { a: "A", b: "C", hexes: ["1,0"] },
      "D|E": { a: "D", b: "E", hexes: ["2,0"] },
      "D|F": { a: "D", b: "F", hexes: ["2,0"] },
      coast: { a: "E", b: "F", hexes: ["2,0"] },
    },
    hexMap: {
      "0,0": { corners: ["A", "B"] },
      "1,0": { corners: ["A", "C"] },
      "2,0": { corners: ["D", "E", "F"] },
    },
  };
}

function game(overrides = {}) {
  const players = overrides.players || [player("p0", { madeira: 5, cavalos: 5, tijolo: 5, ouro: 5 }), player("p1")];
  return {
    code: "ABCD", v: 1, phase: "play", mode: "exploracao",
    players, builds: { A: { p: 0, t: 1 } }, roads: {},
    wagons: {}, wseq: 0, wbuilt: {},
    board: {
      hexes: [
        { k: "0,0", terr: "deserto", num: null, hid: false },
        { k: "1,0", terr: "deserto", num: null, hid: false },
        { k: "2,0", terr: "floresta", num: 8, hid: true },
      ],
      ports: [{ e: "coast", type: "madeira", hid: true }],
      dragon: null,
    },
    deck: [], turn: { rolled: true }, queue: [],
    ...structuredClone(overrides), players: structuredClone(players),
  };
}

test("wagon constants and helpers describe empty and loaded wagons", () => {
  assert.deepEqual(WAGON_COST, { madeira: 1, cavalos: 2 });
  assert.equal(MAX_WAGONS_PER_GAME, 2);
  assert.equal(wagonMoves({ cargo: 0 }), EMPTY_WAGON_MOVES);
  assert.equal(wagonMoves({ cargo: 1 }), LOADED_WAGON_MOVES);
});

test("home hexes only include visible hexes adjacent to the player's buildings", () => {
  const original = game({ board: { hexes: [
    { k: "0,0", terr: "deserto", hid: false },
    { k: "1,0", terr: "floresta", hid: true },
    { k: "2,0", terr: "floresta", hid: true },
  ], ports: [] } });
  assert.deepEqual([...homeHexes(original, graph(), 0)], ["0,0"]);
});

test("wagon construction is immutable, pays its cost and enforces one active wagon", () => {
  const original = game();
  assert.deepEqual(validWagonBuildHexes(original, graph(), 0).sort(), ["0,0", "1,0"]);
  const result = reduceWagonConstruction(original, graph(), 0, "0,0");
  assert.equal(result.game.players[0].res.madeira, 4);
  assert.equal(result.game.players[0].res.cavalos, 3);
  assert.deepEqual(result.game.wagons.w1, { p: 0, at: "0,0", cargo: 0, mv: 2 });
  assert.equal(wagonBuildCount(result.game, 0), 1);
  assert.equal(playerWagons(result.game, 0).length, 1);
  assert.deepEqual(validWagonBuildHexes(result.game, graph(), 0), []);
  assert.deepEqual(original.wagons, {});
});

test("a lifetime maximum of two wagons is preserved after founding", () => {
  const original = game({ wbuilt: { 0: 2 } });
  assert.deepEqual(validWagonBuildHexes(original, graph(), 0), []);
});

test("canonical and redacted views expose the same wagon moves into fog", () => {
  const original = game({ wagons: { w1: { p: 0, at: "1,0", cargo: 0, mv: 2 } } });
  const view = createGameStateView(original, original.players[0].playerId);
  assert.deepEqual(validWagonMoves(original, "w1", 0).sort(), validWagonMoves(view, "w1", 0).sort());
  assert.equal(validWagonMoves(view, "w1", 0).includes("2,0"), true);
});

test("moving into fog reveals terrain and port, rewards its resource and ends movement", () => {
  const original = game({ wagons: { w1: { p: 0, at: "1,0", cargo: 0, mv: 2 } } });
  const result = reduceWagonMove(original, graph(), 0, "w1", "2,0");
  assert.equal(result.game.board.hexes.find((hex) => hex.k === "2,0").hid, false);
  assert.equal(result.game.board.ports[0].hid, false);
  assert.equal(result.game.players[0].res.madeira, 6);
  assert.equal(result.game.wagons.w1.mv, 0);
  assert.equal(result.event.reveal.terrain, "floresta");
  assert.equal(result.event.reveal.ports.length, 1);
  assert.equal(original.board.hexes.find((hex) => hex.k === "2,0").hid, true);
});

test("moving through visible terrain spends one movement point", () => {
  const original = game({ wagons: { w1: { p: 0, at: "0,0", cargo: 0, mv: 2 } } });
  const result = reduceWagonMove(original, graph(), 0, "w1", "1,0");
  assert.equal(result.game.wagons.w1.mv, 1);
  assert.equal(result.event.reveal, null);
});

test("loading colonists pays the village cost and limits movement", () => {
  const original = game({ wagons: { w1: { p: 0, at: "0,0", cargo: 0, mv: 2 } } });
  const result = reduceColonistLoading(original, graph(), 0, "w1");
  assert.equal(result.game.players[0].res.madeira, 4);
  assert.equal(result.game.players[0].res.tijolo, 4);
  assert.equal(result.game.players[0].res.cavalos, 4);
  assert.equal(result.game.players[0].res.ouro, 4);
  assert.equal(result.game.wagons.w1.cargo, 1);
  assert.equal(result.game.wagons.w1.mv, 1);
});

test("remote village spots respect occupied and adjacent vertices", () => {
  const original = game({
    builds: { A: { p: 0, t: 1 }, E: { p: 1, t: 1 } },
    wagons: { w1: { p: 0, at: "2,0", cargo: 1, mv: 0 } },
    board: { hexes: [
      { k: "0,0", terr: "deserto", hid: false },
      { k: "1,0", terr: "deserto", hid: false },
      { k: "2,0", terr: "floresta", hid: false },
    ], ports: [] },
  });
  assert.deepEqual(remoteVillageSpots(original, graph(), "w1"), ["F"]);
});

test("founding a remote village consumes the wagon but preserves lifetime build count", () => {
  const original = game({
    wbuilt: { 0: 1 },
    wagons: { w1: { p: 0, at: "2,0", cargo: 1, mv: 0 } },
    board: { hexes: [
      { k: "0,0", terr: "deserto", hid: false },
      { k: "1,0", terr: "deserto", hid: false },
      { k: "2,0", terr: "floresta", hid: false },
    ], ports: [] },
  });
  const result = reduceRemoteVillageFoundation(original, graph(), 0, "w1", "D");
  assert.equal(result.game.wagons.w1, undefined);
  assert.deepEqual(result.game.builds.D, { p: 0, t: 1 });
  assert.equal(result.game.wbuilt[0], 1);
});

test("turn reset gives movement only to the active player's wagons", () => {
  const original = game({ wagons: {
    w1: { p: 0, at: "0,0", cargo: 0, mv: 0 },
    w2: { p: 1, at: "1,0", cargo: 1, mv: 0 },
  } });
  const result = reduceWagonTurnReset(original, 1);
  assert.equal(result.game.wagons.w1.mv, 0);
  assert.equal(result.game.wagons.w2.mv, 1);
});
