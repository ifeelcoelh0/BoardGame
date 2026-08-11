import test from "node:test";
import assert from "node:assert/strict";
import {
  DEVELOPMENT_CARD_KINDS,
  promoteNewDevelopmentCards,
  reduceDevelopmentCardPlay,
  reduceDevelopmentCardPurchase,
} from "../src/game/developmentCardReducer.js";
import { createEmptyResources } from "../src/game/resources.js";

function resources(values = {}) {
  return { ...createEmptyResources(), ...values };
}

function player(id, values = {}) {
  return {
    playerId: id,
    ch: "vlad",
    res: resources(),
    devNew: [],
    devOld: [],
    troops: { cavaleiro: 0, catapulta: 0, arqueiro: 0 },
    immune: false,
    freeRoads: 0,
    ...values,
  };
}

function game(values = {}) {
  return {
    mode: "classico",
    players: [player("p0"), player("p1"), player("p2")],
    deck: [],
    stats: { devBought: [0, 0, 0] },
    turn: {
      devPlayed: false,
      troopPlayed: false,
      mustDragon: false,
      deploy: null,
      milN: 0,
      acted: {},
    },
    la: null,
    ...values,
  };
}

function oldCard(kind, values = {}) {
  return { id: values.id ?? 10, kind, ...values };
}

test("buying a development card pays its cost and places the top card in devNew", () => {
  const original = game({
    players: [
      player("p0", { res: resources({ cavalos: 2, ouro: 2, obsidiana: 2 }) }),
      player("p1"),
      player("p2"),
    ],
    deck: [oldCard(DEVELOPMENT_CARD_KINDS.ROADS, { id: 1 }), oldCard(DEVELOPMENT_CARD_KINDS.MONOPOLY, { id: 2 })],
  });
  const result = reduceDevelopmentCardPurchase(original, 0);
  assert.deepEqual(result.game.players[0].res, resources({ cavalos: 1, ouro: 1, obsidiana: 1 }));
  assert.deepEqual(result.game.players[0].devNew, [{ id: 2, kind: "monopolio" }]);
  assert.deepEqual(result.game.deck, [{ id: 1, kind: "estradas" }]);
  assert.deepEqual(result.game.stats.devBought, [1, 0, 0]);
  assert.deepEqual(original.players[0].devNew, []);
  assert.equal(original.deck.length, 2);
});

test("new development cards mature into devOld only at the end of their owner's turn", () => {
  const original = game({
    players: [
      player("p0", {
        devNew: [oldCard(DEVELOPMENT_CARD_KINDS.DISCOVERY, { id: 3 })],
        devOld: [oldCard(DEVELOPMENT_CARD_KINDS.ROADS, { id: 4 })],
      }),
      player("p1"),
      player("p2"),
    ],
  });
  const result = promoteNewDevelopmentCards(original, 0);
  assert.deepEqual(result.game.players[0].devNew, []);
  assert.deepEqual(result.game.players[0].devOld.map((card) => card.id), [4, 3]);
  assert.deepEqual(original.players[0].devNew.map((card) => card.id), [3]);
});

test("a classic troop card is consumed, grows the army and requires placing the fire dragon", () => {
  const original = game({
    players: [
      player("p0", { devOld: [oldCard(DEVELOPMENT_CARD_KINDS.TROOP, { sub: "cavaleiro" })] }),
      player("p1"),
      player("p2"),
    ],
  });
  const result = reduceDevelopmentCardPlay(original, 0, 10);
  assert.equal(result.game.players[0].troops.cavaleiro, 1);
  assert.equal(result.game.turn.mustDragon, true);
  assert.equal(result.game.turn.devPlayed, true);
  assert.equal(result.game.players[0].devOld.length, 0);
  assert.equal(original.players[0].troops.cavaleiro, 0);
});

test("a non-war trinity grants permanent immunity when the third troop type is played", () => {
  const original = game({
    mode: "rapido",
    players: [
      player("p0", {
        troops: { cavaleiro: 1, catapulta: 1, arqueiro: 0 },
        devOld: [oldCard(DEVELOPMENT_CARD_KINDS.TROOP, { sub: "arqueiro" })],
      }),
      player("p1"),
      player("p2"),
    ],
  });
  const result = reduceDevelopmentCardPlay(original, 0, 10);
  assert.equal(result.game.players[0].immune, true);
  assert.equal(result.event.details.trinityCompleted, true);
  assert.equal(result.event.details.trinityImmunityGranted, true);
});

test("a war troop card prepares deployment and updates the largest army without granting trinity immunity", () => {
  const original = game({
    mode: "guerra",
    players: [
      player("p0", {
        troops: { cavaleiro: 2, catapulta: 0, arqueiro: 0 },
        devOld: [oldCard(DEVELOPMENT_CARD_KINDS.TROOP, { sub: "cavaleiro" })],
      }),
      player("p1"),
      player("p2"),
    ],
  });
  const result = reduceDevelopmentCardPlay(original, 0, 10);
  assert.equal(result.game.turn.troopPlayed, true);
  assert.equal(result.game.turn.deploy, "cavaleiro");
  assert.deepEqual(result.game.la, { p: 0, n: 3 });
  assert.equal(result.game.players[0].immune, false);
});

test("Road Building grants exactly two free roads and consumes the card", () => {
  const original = game({
    players: [player("p0", { devOld: [oldCard(DEVELOPMENT_CARD_KINDS.ROADS)] }), player("p1"), player("p2")],
  });
  const result = reduceDevelopmentCardPlay(original, 0, 10);
  assert.equal(result.game.players[0].freeRoads, 2);
  assert.equal(result.game.players[0].devOld.length, 0);
  assert.equal(result.game.turn.devPlayed, true);
});

test("Forced March grants one additional military action", () => {
  const original = game({
    mode: "guerra",
    players: [player("p0", { devOld: [oldCard(DEVELOPMENT_CARD_KINDS.FORCED_MARCH)] }), player("p1"), player("p2")],
    turn: { ...game().turn, milN: 1 },
  });
  const result = reduceDevelopmentCardPlay(original, 0, 10);
  assert.equal(result.game.turn.milN, 0);
  assert.equal(result.event.details.militaryActionsGranted, 1);
});

test("Monopoly transfers every rival card of the selected resource", () => {
  const original = game({
    players: [
      player("p0", { res: resources({ madeira: 1 }), devOld: [oldCard(DEVELOPMENT_CARD_KINDS.MONOPOLY)] }),
      player("p1", { res: resources({ madeira: 3 }) }),
      player("p2", { res: resources({ madeira: 2 }) }),
    ],
  });
  const result = reduceDevelopmentCardPlay(original, 0, 10, { resource: "madeira" });
  assert.equal(result.game.players[0].res.madeira, 6);
  assert.equal(result.game.players[1].res.madeira, 0);
  assert.equal(result.game.players[2].res.madeira, 0);
  assert.equal(result.event.details.total, 5);
  assert.equal(original.players[1].res.madeira, 3);
});

test("Workers can grant the same resource twice", () => {
  const original = game({
    players: [player("p0", { devOld: [oldCard(DEVELOPMENT_CARD_KINDS.DISCOVERY)] }), player("p1"), player("p2")],
  });
  const result = reduceDevelopmentCardPlay(original, 0, 10, {
    firstResource: "ouro",
    secondResource: "ouro",
  });
  assert.equal(result.game.players[0].res.ouro, 2);
});

test("Spy returns a private copy of the target hand and does not expose it in shared event details", () => {
  const original = game({
    mode: "guerra",
    players: [
      player("p0", { devOld: [oldCard(DEVELOPMENT_CARD_KINDS.SPY)] }),
      player("p1", { res: resources({ ouro: 2, obsidiana: 1 }) }),
      player("p2"),
    ],
  });
  const result = reduceDevelopmentCardPlay(original, 0, 10, { targetIndex: 1 });
  assert.deepEqual(result.privateResult, {
    type: "SPY_REPORT",
    targetPlayerId: "p1",
    resources: resources({ ouro: 2, obsidiana: 1 }),
  });
  assert.deepEqual(result.event.details, { targetIndex: 1 });
  result.privateResult.resources.ouro = 99;
  assert.equal(result.game.players[1].res.ouro, 2);
});

test("victory point cards cannot be actively played", () => {
  const original = game({
    players: [player("p0", { devOld: [oldCard(DEVELOPMENT_CARD_KINDS.VICTORY_POINT)] }), player("p1"), player("p2")],
  });
  assert.throws(() => reduceDevelopmentCardPlay(original, 0, 10), /não pode ser jogada/);
  assert.equal(original.players[0].devOld.length, 1);
});

test("a newly purchased card cannot be played before maturing", () => {
  const original = game({
    players: [player("p0", { devNew: [oldCard(DEVELOPMENT_CARD_KINDS.ROADS)] }), player("p1"), player("p2")],
  });
  assert.throws(() => reduceDevelopmentCardPlay(original, 0, 10), /não está disponível/);
});

test("development card choices reject invalid resources and spy targets", () => {
  const monopoly = game({
    players: [player("p0", { devOld: [oldCard(DEVELOPMENT_CARD_KINDS.MONOPOLY)] }), player("p1"), player("p2")],
  });
  assert.throws(() => reduceDevelopmentCardPlay(monopoly, 0, 10, { resource: "dragões" }), /Recurso inválido/);

  const spy = game({
    mode: "guerra",
    players: [player("p0", { devOld: [oldCard(DEVELOPMENT_CARD_KINDS.SPY)] }), player("p1"), player("p2")],
  });
  assert.throws(() => reduceDevelopmentCardPlay(spy, 0, 10, { targetIndex: 0 }), /Alvo inválido/);
});
