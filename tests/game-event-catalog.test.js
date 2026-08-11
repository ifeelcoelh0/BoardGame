import test from "node:test";
import assert from "node:assert/strict";
import {
  IMPORTANT_EVENT_KIND,
  awardImportantEventModel,
  disasterImportantEventModel,
  storyImportantEventModel,
} from "../src/presentation/gameEventCatalog.js";

const game = Object.freeze({
  players: Object.freeze([
    Object.freeze({ ch: "maria" }),
    Object.freeze({ ch: "vlad" }),
  ]),
});

test("dragon stories map to the dedicated large event art", () => {
  const model = storyImportantEventModel(game, {
    kind: "dragao",
    pi: 0,
    title: "O Dragão Desperta!",
    text: "Texto",
  });
  assert.equal(model.kind, IMPORTANT_EVENT_KIND.DRAGON);
  assert.equal(model.artKey, "dragonSeven");
  assert.equal(model.tone, "dragon");
  assert.equal(model.playerName, "Princesa Maria");
  assert.equal(storyImportantEventModel(game, { kind: "dados" }), null);
});

test("all four disasters map to their canonical event art", () => {
  const expected = {
    ganancia: "disasterGreed",
    peste: "disasterPlague",
    tsunami: "disasterTsunami",
    tributo: "disasterTribute",
  };
  for (const [type, artKey] of Object.entries(expected)) {
    const model = disasterImportantEventModel(game, { type, num: 12, det: ["efeito"] });
    assert.equal(model.kind, IMPORTANT_EVENT_KIND.DISASTER);
    assert.equal(model.artKey, artKey);
    assert.match(model.eyebrow, /12/);
    assert.deepEqual(model.details, ["efeito"]);
  }
});

test("award models preserve ownership transfer without duplicating game rules", () => {
  const road = awardImportantEventModel(game, { kind: "road", pi: 0, prev: 1, value: 7 });
  assert.equal(road.kind, IMPORTANT_EVENT_KIND.AWARD);
  assert.equal(road.artKey, "awardLongestRoad");
  assert.equal(road.playerName, "Princesa Maria");
  assert.equal(road.previousPlayerName, "Vlad Drácula");
  assert.equal(road.metric, "7 troços · +2 PV");
  assert.equal(road.signature, "Princesa Maria");

  const army = awardImportantEventModel(game, { kind: "army", pi: 1, prev: null, value: 4 });
  assert.equal(army.artKey, "awardLargestArmy");
  assert.equal(army.metric, "4 tropas · +2 PV");
  assert.equal(army.signature, "Vlad Drácula");
  assert.equal(awardImportantEventModel(game, { kind: "unknown", pi: 0 }), null);
});
