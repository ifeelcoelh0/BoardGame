import test from "node:test";
import assert from "node:assert/strict";
import {
  boardInteractionBlockReason,
  developmentCardPlayReason,
  isSeatCurrentPlayer,
  playTurnBlockReason,
} from "../src/ui/game/gameInteractionGuards.js";

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
    winner: null,
    order: [0, 1],
    turn: { pos: 0, rolled: true, mustDragon: false, steal: null, deploy: null, devPlayed: false, troopPlayed: false, milN: 0, acted: {} },
    queue: [],
    trade: null,
    board: { hexes: [], dragon: null },
    units: {},
    players: [
      { connected: true, sick: 0, devOld: [{ id: 7, kind: "monopolio" }], res: {} },
      { connected: true, sick: 0, devOld: [], res: {} },
    ],
    ...overrides,
  };
}

test("current-player guard derives the active seat without React state", () => {
  const g = game();
  assert.equal(isSeatCurrentPlayer(g, 0), true);
  assert.equal(isSeatCurrentPlayer(g, 1), false);
});

test("play guard blocks trade, pending decisions and dragon placement consistently", () => {
  assert.match(playTurnBlockReason(game({ trade: { id: "t" } }), 0), /troca/i);
  assert.match(playTurnBlockReason(game({ queue: [{ t: "descarte", p: 0 }] }), 0), /decisão/i);
  assert.match(playTurnBlockReason(game({ turn: { pos: 0, rolled: true, mustDragon: true, steal: null, deploy: null } }), 0), /Dragão/i);
});

test("board interactions are suppressed while a trade or steal decision is active", () => {
  assert.match(boardInteractionBlockReason(game({ trade: { id: "t" } }), 0), /troca/i);
  assert.match(boardInteractionBlockReason(game({ turn: { pos: 0, rolled: true, mustDragon: false, steal: { victims: [1] }, deploy: null } }), 0), /decisão/i);
});

test("development cards use the same turn blockers as the action system", () => {
  const card = { id: 7, kind: "monopolio" };
  assert.equal(developmentCardPlayReason(game(), graph(), 0, card), null);
  assert.match(developmentCardPlayReason(game({ trade: { id: "t" } }), graph(), 0, card), /troca/i);
  assert.match(developmentCardPlayReason(game({ turn: { pos: 0, rolled: true, mustDragon: false, steal: null, deploy: "cavaleiro" } }), graph(), 0, card), /tropa/i);
});

test("stale, new and victory-point cards are never presented as playable", () => {
  assert.match(developmentCardPlayReason(game(), graph(), 0, { id: 99, kind: "monopolio" }), /disponível/i);
  assert.match(developmentCardPlayReason(game(), graph(), 0, { id: 7, kind: "monopolio" }, { isNew: true }), /próximo turno/i);
  const vpGame = game();
  vpGame.players[0].devOld = [{ id: 9, kind: "vp", sub: "Sorte" }];
  assert.match(developmentCardPlayReason(vpGame, graph(), 0, vpGame.players[0].devOld[0]), /Vitória/i);
});
