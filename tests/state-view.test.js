import test from "node:test";
import assert from "node:assert/strict";
import { HIDDEN_TERRAIN_TYPE, createGameStateView, createPublicGameStateView, STATE_VIEW_VERSION } from "../src/game/gameStateView.js";
import { IDS, makeGame } from "./fixtures.js";

test("a player sees their own hand but only counts for opponents", () => {
  const game = makeGame();
  const view = createGameStateView(game, IDS.host);
  assert.equal(view.stateViewVersion, STATE_VIEW_VERSION);
  assert.equal(view.viewerPlayerId, IDS.host);
  assert.deepEqual(view.players[0].res, game.players[0].res);
  assert.deepEqual(view.players[0].devNew, game.players[0].devNew);
  assert.equal(view.players[1].resourceCount, 15);
  assert.deepEqual(view.players[1].res, { madeira: 0, tijolo: 0, cavalos: 0, ouro: 0, obsidiana: 0 });
  assert.equal(view.players[1].devNew.length, 0);
  assert.equal(view.players[1].devOld.length, 2);
  assert.equal(view.players[1].devOld.every((card) => card.kind === "hidden"), true);
});

test("session hashes never leave the host", () => {
  const game = makeGame();
  for (const view of [createGameStateView(game, IDS.host), createPublicGameStateView(game)]) {
    assert.equal(view.players.every((player) => !("sessionTokenHash" in player)), true);
  }
});

test("the deck and fogged map are redacted without changing topology", () => {
  const game = makeGame();
  const view = createPublicGameStateView(game);
  assert.equal(view.deckCount, 2);
  assert.equal(view.deck.every((card) => card.kind === "hidden"), true);
  assert.deepEqual(view.board.hexes[0], game.board.hexes[0]);
  assert.deepEqual(view.board.hexes[1], { k: "1,0", terr: HIDDEN_TERRAIN_TYPE, num: null, hid: true });
  assert.equal(view.board.ports[1].type, "any");
  assert.equal(view.troll.lair, null);
});

test("ended games reveal cards and the map, but still remove session hashes", () => {
  const game = makeGame({ phase: "ended" });
  const view = createPublicGameStateView(game);
  assert.deepEqual(view.deck, game.deck);
  assert.deepEqual(view.players[1].res, game.players[1].res);
  assert.deepEqual(view.board, game.board);
  assert.equal(view.players.every((player) => !("sessionTokenHash" in player)), true);
});

test("creating a view never mutates canonical state", () => {
  const game = makeGame();
  const before = structuredClone(game);
  createGameStateView(game, IDS.guest1);
  assert.deepEqual(game, before);
});


test("presentation state crosses multiplayer views as one synchronized slice", () => {
  const presentation = {
    version: 1,
    log: [{ id: 10, msg: "Aconteceu algo", pi: 0 }],
    story: { id: 11, kind: "dados", n: 8, pi: 0 },
    cardReveal: { id: 12, pi: 0, card: { id: "dev-1", kind: "marcha" } },
    award: { id: 13, kind: "road", pi: 0, prev: null, value: 5 },
    disaster: { id: 14, type: "peste" },
  };
  const game = makeGame({ presentation });
  const view = createGameStateView(game, IDS.host);

  assert.equal(STATE_VIEW_VERSION, 3);
  assert.deepEqual(view.presentation, presentation);
  for (const legacyField of ["log", "ev", "cardEv", "awardEv", "disaster"]) {
    assert.equal(legacyField in view, false);
  }
});

test("the authoritative action journal never leaves the host, including after the match", () => {
  for (const phase of ["play", "ended"]) {
    const game = makeGame({
      phase,
      actionJournal: {
        version: 1,
        startedAt: 1,
        initialRevision: 12,
        initialState: { privateDeck: ["secret"] },
        entries: [{ privateResult: { resource: "ouro" } }],
      },
    });
    const view = createGameStateView(game, IDS.host);
    const publicView = createPublicGameStateView(game);
    assert.equal("actionJournal" in view, false);
    assert.equal("actionJournal" in publicView, false);
    assert.equal("actionJournal" in game, true);
  }
});
