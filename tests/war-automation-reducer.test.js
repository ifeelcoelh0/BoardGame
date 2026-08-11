import test from "node:test";
import assert from "node:assert/strict";
import {
  TROLL_WAKE_TURNS,
  pickTrollLair,
  raiderHexes,
  raiderLimit,
  reduceTrollOmen,
  reduceTrollTurn,
  reduceWarEndTurnSweep,
  reduceWarSieges,
  reduceWarStartTurnAutomation,
  trollHealthForPlayers,
  warPublicScore,
} from "../src/game/warAutomationReducer.js";

const HEX_KEYS = [
  "0,0", "1,0", "2,0", "3,0", "1,-1", "2,-1", "3,-1",
  "0,-1", "0,-2", "0,-3", "-1,0", "-2,0", "-3,0",
  "-1,1", "-2,2", "-3,3", "0,1", "0,2", "0,3",
];

function player(character, capV, overrides = {}) {
  return {
    ch: character,
    capV,
    res: { madeira: 0, tijolo: 0, cavalos: 0, ouro: 0, obsidiana: 0 },
    devNew: [],
    devOld: [],
    ...structuredClone(overrides),
  };
}

function game(overrides = {}) {
  const players = overrides.players || [player("vlad", "A"), player("makuru", "B")];
  return {
    mode: "guerra",
    perksOn: true,
    gelo: { active: true },
    players: structuredClone(players),
    board: {
      dragon: "0,3",
      hexes: HEX_KEYS.map((k) => ({ k, terr: k === "3,0" ? "deserto" : "floresta", num: k === "3,0" ? null : 5 })),
    },
    builds: { A: { p: 0, t: 1 }, B: { p: 1, t: 1 } },
    units: {},
    occ: {},
    glory: {},
    gloried: {},
    lr: null,
    la: null,
    queue: [],
    order: players.map((_, index) => index),
    troll: { awake: false, turns: 0, rush: 0, lair: null, giant: null, dmg: {}, defeated: false, warned: false },
    ...structuredClone(overrides),
    players: structuredClone(players),
  };
}

function graph(overrides = {}) {
  return {
    verts: {
      A: { hexes: ["0,0", "1,0", "1,-1"] },
      B: { hexes: ["0,0", "-1,0", "-1,1"] },
      C: { hexes: ["0,0", "0,1", "-1,1"] },
      ...overrides.verts,
    },
    ...overrides,
  };
}

const first = () => 0;
const last = () => 0.999999;

function eventOf(result, type) {
  return result.event.events.find((event) => event.type === type);
}

test("Troll health and raider capacity scale with the player count", () => {
  assert.equal(trollHealthForPlayers(2), 13);
  assert.equal(trollHealthForPlayers(3), 17);
  assert.equal(trollHealthForPlayers(4), 19);
  assert.equal(raiderLimit(game()), 3);
  assert.equal(raiderLimit(game({ players: [player("vlad", "A"), player("maria", "B"), player("bones", "C")] })), 4);
});

test("the troll lair prefers a distant burned hex that is not the dragon or the heart", () => {
  const original = game();
  assert.equal(pickTrollLair(original), "3,0");
  assert.equal(original.board.hexes.find((hex) => hex.k === "3,0").lair, undefined);
});

test("public war score includes buildings, awards, occupations and permanent glory", () => {
  const original = game({
    builds: { A: { p: 0, t: 2 }, B: { p: 1, t: 1 }, C: { p: 0, t: 1 } },
    lr: { p: 0, len: 6 },
    la: { p: 0, n: 4 },
    occ: { B: 0 },
    glory: { 0: 2 },
  });
  assert.equal(warPublicScore(original, 0), 10);
});

test("a valid siege occupies the building and grants permanent glory only once", () => {
  const original = game({ units: { "-1,0": { p: 0, t: "catapulta" } } });
  const firstResult = reduceWarSieges(original, graph(), 0, { rng: first });
  assert.equal(firstResult.game.occ.B, 0);
  assert.equal(firstResult.game.glory[0], 1);
  assert.equal(eventOf(firstResult, "BUILDING_OCCUPIED").gloryAwarded, true);
  assert.equal(original.occ.B, undefined);

  const reopened = structuredClone(firstResult.game);
  delete reopened.occ.B;
  const secondResult = reduceWarSieges(reopened, graph(), 0, { rng: first });
  assert.equal(secondResult.game.glory[0], 1);
  assert.equal(eventOf(secondResult, "BUILDING_OCCUPIED").gloryAwarded, false);
});

test("Maria walls increase the number of catapults required for a siege", () => {
  const one = game({ players: [player("vlad", "A"), player("maria", "B")], units: { "-1,0": { p: 0, t: "catapulta" } } });
  assert.equal(reduceWarSieges(one, graph(), 0, { rng: first }).game.occ.B, undefined);
  const two = game({ players: [player("vlad", "A"), player("maria", "B")], units: { "-1,0": { p: 0, t: "catapulta" }, "-1,1": { p: 0, t: "catapulta" } } });
  assert.equal(reduceWarSieges(two, graph(), 0, { rng: first }).game.occ.B, 0);
});

test("occupied citizens smuggle one deterministic resource per compromised building", () => {
  const original = game({ occ: { A: 1 }, units: { "0,0": { p: 1, t: "catapulta" } } });
  const result = reduceWarSieges(original, graph(), 0, { rng: first });
  assert.equal(result.game.players[0].res.madeira, 1);
  assert.deepEqual(eventOf(result, "OCCUPATION_CONTRABAND").resources, ["madeira"]);
  assert.equal(original.players[0].res.madeira, 0);
});

test("invalid occupations are released before start-turn siege processing", () => {
  const original = game({ occ: { A: 1 } });
  const result = reduceWarSieges(original, graph(), 0, { rng: first });
  assert.equal(result.game.occ.A, undefined);
  assert.equal(eventOf(result, "OCCUPATION_RELEASED").reason, "START_TURN_RECHECK");
});

test("an omen accelerates a sleeping horde and is immutable", () => {
  const original = game();
  const result = reduceTrollOmen(original, graph(), 0, { rng: first });
  assert.equal(result.game.troll.rush, 1);
  assert.equal(eventOf(result, "TROLL_OMEN_RUSH").cap, 2);
  assert.equal(original.troll.rush, 0);
});

test("an omen after awakening spawns a raider aimed at a live capital", () => {
  const original = game({ troll: { awake: true, turns: 20, rush: 2, lair: "3,0", giant: null, dmg: {}, defeated: false, warned: true } });
  const result = reduceTrollOmen(original, graph(), 0, { rng: first });
  assert.equal(raiderHexes(result.game).length, 1);
  const raider = result.game.units[raiderHexes(result.game)[0]];
  assert.equal(["A", "B"].includes(raider.tv), true);
  assert.ok(eventOf(result, "TROLL_OMEN_RAIDER"));
});

test("the horde warns before waking and awakens exactly at the accelerated threshold", () => {
  const warningGame = game({ troll: { awake: false, turns: TROLL_WAKE_TURNS - 3, rush: 0, lair: null, giant: null, dmg: {}, defeated: false, warned: false } });
  const warned = reduceTrollTurn(warningGame, graph(), 0, { rng: first });
  assert.ok(eventOf(warned, "TROLL_WARNING"));
  assert.equal(warned.game.troll.awake, false);

  const wakingGame = game({ troll: { awake: false, turns: TROLL_WAKE_TURNS - 1, rush: 0, lair: null, giant: null, dmg: {}, defeated: false, warned: true } });
  const awake = reduceTrollTurn(wakingGame, graph(), 0, { rng: first });
  assert.equal(awake.game.troll.awake, true);
  assert.equal(awake.game.troll.giant.at, "3,0");
  assert.equal(awake.game.troll.giant.hp, 13);
  assert.ok(eventOf(awake, "TROLL_AWAKENED"));
  assert.equal(raiderHexes(awake.game).length, raiderLimit(awake.game));
});

test("raiders move toward their target, steal a deterministic resource and block the building", () => {
  const original = game({
    players: [player("vlad", "A", { res: { madeira: 1, tijolo: 0, cavalos: 0, ouro: 0, obsidiana: 0 } }), player("maria", "B")],
    units: { "2,0": { p: -9, t: "saqueador", tv: "A", pause: 0 } },
    troll: { awake: true, turns: 20, rush: 0, lair: "3,0", giant: null, dmg: {}, defeated: true, warned: true },
  });
  const result = reduceTrollTurn(original, graph(), 1, { rng: first });
  assert.equal(result.game.units["2,0"], undefined);
  assert.equal(result.game.units["1,0"].blk, "A");
  assert.equal(result.game.players[0].res.madeira, 0);
  const arrival = eventOf(result, "RAIDER_ARRIVED");
  assert.equal(arrival.resource, "madeira");
  assert.equal(arrival.ownerIndex, 0);
});

test("the giant moves toward the heart, stomps a catapult and releases its occupation", () => {
  const original = game({
    units: { "1,0": { p: 0, t: "catapulta" } },
    occ: { B: 0 },
    troll: { awake: true, turns: 20, rush: 0, lair: "3,0", giant: { at: "2,0", hp: 13, maxHp: 13, pause: 0 }, dmg: {}, defeated: false, warned: true },
  });
  const result = reduceTrollTurn(original, graph(), 1, { rng: first });
  assert.equal(result.game.troll.giant.at, "1,0");
  assert.equal(result.game.units["1,0"], undefined);
  assert.equal(result.game.occ.B, undefined);
  assert.equal(eventOf(result, "GIANT_STOMPED_UNIT").playerIndex, 0);
  assert.equal(eventOf(result, "OCCUPATION_RELEASED").reason, "TROLL_AUTOMATION");
});

test("at the start of a round the giant crushes one deterministic adjacent melee unit", () => {
  const original = game({
    units: { "1,0": { p: 0, t: "cavaleiro" }, "1,-1": { p: 1, t: "arqueiro" } },
    troll: { awake: true, turns: 20, rush: 0, lair: "3,0", giant: { at: "0,0", hp: 13, maxHp: 13, pause: 0 }, dmg: {}, defeated: false, warned: true },
  });
  const result = reduceTrollTurn(original, graph(), 0, { rng: first });
  assert.equal(result.game.units["1,0"], undefined);
  assert.ok(result.game.units["1,-1"]);
  assert.equal(eventOf(result, "GIANT_ROUND_SWEEP").playerIndex, 0);
  assert.ok(eventOf(result, "HORDE_REFILLED"));
});

test("end-turn giant sweep spares attackers once, crushes campers and releases sieges", () => {
  const original = game({
    units: {
      "1,0": { p: 0, t: "catapulta", atk: 1 },
      "1,-1": { p: 0, t: "catapulta" },
    },
    occ: { B: 0 },
    troll: { awake: true, turns: 20, rush: 0, lair: "3,0", giant: { at: "0,0", hp: 13, maxHp: 13, pause: 0 }, dmg: {}, defeated: false, warned: true },
  });
  const result = reduceWarEndTurnSweep(original, graph(), 0);
  assert.deepEqual(result.game.units["1,0"], { p: 0, t: "catapulta" });
  assert.equal(result.game.units["1,-1"], undefined);
  assert.equal(result.game.occ.B, undefined);
  assert.ok(eventOf(result, "GIANT_CAMPER_SPARED"));
  assert.ok(eventOf(result, "GIANT_CAMPER_CRUSHED"));
  assert.ok(eventOf(result, "OCCUPATION_RELEASED"));
});

test("combined start-turn automation resolves sieges before advancing the horde", () => {
  const original = game({
    units: { "-1,0": { p: 0, t: "catapulta" } },
    troll: { awake: false, turns: 0, rush: 0, lair: null, giant: null, dmg: {}, defeated: false, warned: false },
  });
  const result = reduceWarStartTurnAutomation(original, graph(), 0, 0, { rng: last });
  assert.equal(result.game.occ.B, 0);
  assert.equal(result.game.troll.turns, 1);
  assert.equal(result.event.events[0].type, "BUILDING_OCCUPIED");
});

test("combined automation rejects a player that does not match the active turn position", () => {
  assert.throws(
    () => reduceWarStartTurnAutomation(game(), graph(), 1, 0, { rng: first }),
    /posição de turno/i,
  );
});
