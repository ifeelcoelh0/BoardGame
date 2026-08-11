import test from "node:test";
import assert from "node:assert/strict";
import { createEmptyResources } from "../src/game/resources.js";
import {
  bribeTargets,
  militaryActionsLeft,
  reduceTroopRecruitment,
  reduceUnitAction,
  reduceUnitBribe,
  reduceUnitDeployment,
  troopCost,
  unitTargets,
  validDeployHexes,
} from "../src/game/warReducer.js";

const HEXES = [
  { k: "0,0", terr: "floresta", hid: false },
  { k: "1,0", terr: "floresta", hid: false },
  { k: "1,-1", terr: "montanhas", hid: false },
  { k: "0,-1", terr: "deserto", hid: false },
  { k: "-1,0", terr: "argila", hid: false },
  { k: "-1,1", terr: "prados", hid: false },
  { k: "0,1", terr: "grutas", hid: false },
  { k: "2,-1", terr: "argila", hid: false },
  { k: "2,0", terr: "grutas", hid: false },
];

function resources(overrides = {}) {
  return { ...createEmptyResources(), ...overrides };
}

function player(ch, overrides = {}) {
  return {
    playerId: `player-${ch}`,
    ch,
    capV: `CAP-${ch}`,
    res: resources(),
    troops: { cavaleiro: 0, catapulta: 0, arqueiro: 0 },
    ...overrides,
    res: resources(overrides.res),
    troops: { cavaleiro: 0, catapulta: 0, arqueiro: 0, ...(overrides.troops || {}) },
  };
}

function game(overrides = {}) {
  const players = overrides.players || [player("vlad"), player("makuru")];
  return {
    mode: "guerra",
    perksOn: true,
    gelo: { active: true },
    players,
    board: { hexes: structuredClone(HEXES), dragon: "-1,1" },
    builds: {},
    units: {},
    occ: {},
    queue: [],
    glory: {},
    troll: { awake: false, defeated: false, giant: null, dmg: {} },
    turn: { rolled: true, milN: 0, acted: {}, deploy: null, bonus: null, bribed: false },
    ...structuredClone(overrides),
    players: structuredClone(players),
  };
}

function graph() {
  return {
    verts: {
      "CAP-vlad": { hexes: ["0,0", "1,0", "1,-1"] },
      "CAP-makuru": { hexes: ["-1,0", "-1,1", "0,-1"] },
      "CAP-bones": { hexes: ["0,0", "1,0", "1,-1"] },
      A: { hexes: ["0,0", "1,0", "1,-1"] },
    },
    hexMap: Object.fromEntries(HEXES.map((hex) => [hex.k, { ...hex, corners: ["A"] }])),
  };
}

test("troop costs apply Vlad and Bones perks without mutating the base table", () => {
  const base = game({ players: [player("romeo"), player("makuru")] });
  assert.deepEqual(troopCost(base, 0, "cavaleiro"), { cavalos: 2, ouro: 1 });
  const vlad = game({ players: [player("vlad"), player("makuru")] });
  assert.deepEqual(troopCost(vlad, 0, "cavaleiro"), { cavalos: 1, ouro: 1 });
  const bones = game({ players: [player("bones"), player("makuru")] });
  assert.deepEqual(troopCost(bones, 0, "arqueiro"), { madeira: 1, cavalos: 1, ouro: 1, obsidiana: 1 });
  assert.deepEqual(troopCost(base, 0, "cavaleiro"), { cavalos: 2, ouro: 1 });
});

test("recruitment is immutable, pays the cost and creates a pending deployment", () => {
  const original = game({ players: [player("vlad", { res: { cavalos: 1, ouro: 1 } }), player("makuru")] });
  const result = reduceTroopRecruitment(original, 0, "cavaleiro");
  assert.equal(result.game.players[0].res.cavalos, 0);
  assert.equal(result.game.players[0].res.ouro, 0);
  assert.equal(result.game.players[0].troops.cavaleiro, 1);
  assert.equal(result.game.turn.deploy, "cavaleiro");
  assert.equal(original.players[0].troops.cavaleiro, 0);
  assert.equal(original.turn.deploy, null);
});

test("deployment spaces exclude the dragon, fog, occupied hexes and the giant", () => {
  const original = game({
    board: { hexes: structuredClone(HEXES).map((hex) => hex.k === "1,-1" ? { ...hex, hid: true } : hex), dragon: "1,0" },
    units: { "0,0": { p: 1, t: "arqueiro" } },
    troll: { awake: true, defeated: false, giant: { at: "1,-1", hp: 5, maxHp: 5 }, dmg: {} },
  });
  assert.deepEqual(validDeployHexes(original, graph(), 0, "cavaleiro"), []);
});

test("a fresh raider blocking the capital prevents every deployment", () => {
  const original = game({ units: { "0,0": { p: -9, t: "saqueador", blk: "CAP-vlad", fresh: 1 } } });
  assert.deepEqual(validDeployHexes(original, graph(), 0, "cavaleiro"), []);
});

test("deployment consumes one military action and Bones units receive their first-life marker", () => {
  const original = game({
    players: [player("bones"), player("makuru")],
    turn: { rolled: true, milN: 0, acted: {}, deploy: "catapulta", bonus: "old" },
  });
  const result = reduceUnitDeployment(original, graph(), 0, "0,0");
  assert.deepEqual(result.game.units["0,0"], { p: 0, t: "catapulta", sk: 1 });
  assert.equal(result.game.turn.deploy, null);
  assert.equal(result.game.turn.milN, 1);
  assert.equal(result.game.turn.acted["0,0"], true);
  assert.equal(result.game.turn.bonus, null);
  assert.equal(original.units["0,0"], undefined);
});

test("deploying over a raider removes it and grants a blessing", () => {
  const original = game({
    units: { "0,0": { p: -9, t: "saqueador" } },
    turn: { rolled: true, milN: 0, acted: {}, deploy: "arqueiro" },
  });
  const result = reduceUnitDeployment(original, graph(), 0, "0,0");
  assert.deepEqual(result.game.units["0,0"], { p: 0, t: "arqueiro" });
  assert.deepEqual(result.game.queue, [{ t: "bencao", p: 0, left: 1 }]);
  assert.equal(result.event.defeatedRaider, true);
});

test("unit targets expose free neighboring hexes and only beatable enemies", () => {
  const original = game({
    units: {
      "0,0": { p: 0, t: "cavaleiro" },
      "1,0": { p: 1, t: "catapulta" },
      "1,-1": { p: 1, t: "arqueiro" },
    },
  });
  const targets = unitTargets(original, graph(), "0,0", 0);
  assert.equal(targets.has("1,0"), true);
  assert.equal(targets.has("1,-1"), false);
  assert.equal(targets.has("0,-1"), true);
});

test("Makuru moves for free between equal fertile terrains", () => {
  const original = game({
    players: [player("makuru"), player("vlad")],
    units: { "0,0": { p: 0, t: "cavaleiro" } },
  });
  const result = reduceUnitAction(original, graph(), 0, "0,0", "1,0");
  assert.equal(result.event.freeMove, true);
  assert.equal(result.game.turn.milN, 0);
  assert.deepEqual(result.game.units["1,0"], { p: 0, t: "cavaleiro" });
  assert.equal(result.game.turn.acted["1,0"], undefined);
});

test("Protheus gains exactly one bonus move after entering burned terrain", () => {
  const original = game({
    players: [player("protheus"), player("vlad")],
    units: { "0,0": { p: 0, t: "cavaleiro" } },
  });
  const result = reduceUnitAction(original, graph(), 0, "0,0", "0,-1");
  assert.equal(result.event.bonusGranted, true);
  assert.equal(result.game.turn.milN, 1);
  assert.equal(result.game.turn.bonus, "0,-1");
  assert.equal(result.game.turn.acted["0,-1"], undefined);
});

test("archers kill a vulnerable unit without leaving their hex", () => {
  const original = game({ units: { "0,0": { p: 0, t: "arqueiro" }, "1,0": { p: 1, t: "cavaleiro" } } });
  const result = reduceUnitAction(original, graph(), 0, "0,0", "1,0");
  assert.equal(result.event.resolution, "ARCHER_KILL");
  assert.deepEqual(result.game.units["0,0"], { p: 0, t: "arqueiro" });
  assert.equal(result.game.units["1,0"], undefined);
  assert.equal(result.game.turn.acted["0,0"], true);
});

test("equal troops destroy each other, while a Bones unit can rise at its capital", () => {
  const original = game({
    players: [player("vlad"), player("bones")],
    units: { "0,0": { p: 0, t: "cavaleiro" }, "1,0": { p: 1, t: "cavaleiro", sk: 1 } },
  });
  const result = reduceUnitAction(original, graph(), 0, "0,0", "1,0");
  assert.equal(result.event.resolution, "MUTUAL_DESTRUCTION");
  assert.equal(result.game.units["0,0"], undefined);
  const risen = Object.entries(result.game.units).find(([, unit]) => unit.p === 1);
  assert.ok(risen);
  assert.equal(risen[1].bone, 1);
  assert.equal(risen[1].sk, undefined);
  assert.equal(result.event.resurrections[0].resurrected, true);
});

test("Makuru wins an equal-type defense in forest or mountain", () => {
  const original = game({
    players: [player("vlad"), player("makuru")],
    units: { "1,-1": { p: 0, t: "cavaleiro" }, "0,0": { p: 1, t: "cavaleiro" } },
  });
  const result = reduceUnitAction(original, graph(), 0, "1,-1", "0,0");
  assert.equal(result.event.resolution, "MAKURU_DEFENSE");
  assert.equal(result.game.units["1,-1"], undefined);
  assert.deepEqual(result.game.units["0,0"], { p: 1, t: "cavaleiro" });
});

test("attacking the giant records damage, consumes an action and distributes defeat rewards", () => {
  const original = game({
    units: { "0,0": { p: 0, t: "catapulta" } },
    troll: { awake: true, defeated: false, giant: { at: "1,0", hp: 2, maxHp: 9 }, dmg: {} },
  });
  const result = reduceUnitAction(original, graph(), 0, "0,0", "1,0");
  assert.equal(result.event.type, "TROLL_GIANT_ATTACKED");
  assert.equal(result.event.defeated, true);
  assert.equal(result.game.troll.defeated, true);
  assert.equal(result.game.troll.giant, null);
  assert.equal(result.game.glory[0], 1);
  assert.deepEqual(result.game.queue, [{ t: "bencao", p: 0, left: 1 }]);
  assert.equal(result.game.turn.milN, 1);
});

test("defeating a raider moves melee units, leaves archers in place and grants a blessing", () => {
  const melee = game({
    units: { "0,0": { p: 0, t: "cavaleiro" }, "1,0": { p: -9, t: "saqueador" } },
    troll: { awake: true, defeated: false, giant: null, dmg: {} },
  });
  const moved = reduceUnitAction(melee, graph(), 0, "0,0", "1,0");
  assert.deepEqual(moved.game.units["1,0"], { p: 0, t: "cavaleiro" });
  assert.equal(moved.game.units["0,0"], undefined);
  assert.deepEqual(moved.game.queue, [{ t: "bencao", p: 0, left: 1 }]);

  const ranged = game({
    units: { "0,0": { p: 0, t: "arqueiro" }, "1,0": { p: -9, t: "saqueador" } },
    troll: { awake: true, defeated: false, giant: null, dmg: {} },
  });
  const stayed = reduceUnitAction(ranged, graph(), 0, "0,0", "1,0");
  assert.deepEqual(stayed.game.units["0,0"], { p: 0, t: "arqueiro" });
  assert.equal(stayed.game.units["1,0"], undefined);
});

test("moving the last siege catapult releases an occupied building", () => {
  const original = game({
    builds: { A: { p: 1, t: 1 } },
    occ: { A: 0 },
    units: { "0,0": { p: 0, t: "catapulta" } },
  });
  const result = reduceUnitAction(original, graph(), 0, "0,0", "-1,0");
  assert.equal(result.game.occ.A, undefined);
  assert.deepEqual(result.event.occupationReleases, [{ vertex: "A", ownerIndex: 1, formerOccupierIndex: 0, buildingType: 1 }]);
});

test("Romeo can bribe an adjacent enemy into the next free hex without spending a military action", () => {
  const original = game({
    players: [player("romeo", { res: { ouro: 2 } }), player("vlad")],
    units: { "0,0": { p: 0, t: "cavaleiro" }, "1,0": { p: 1, t: "arqueiro" } },
  });
  assert.equal(bribeTargets(original, 0).has("1,0"), true);
  const result = reduceUnitBribe(original, graph(), 0, "1,0");
  assert.equal(result.game.players[0].res.ouro, 0);
  assert.equal(result.game.units["1,0"], undefined);
  assert.deepEqual(result.game.units["2,0"], { p: 1, t: "arqueiro" });
  assert.equal(result.game.turn.bribed, true);
  assert.equal(militaryActionsLeft(result.game), 2);
  assert.equal(original.players[0].res.ouro, 2);
});
