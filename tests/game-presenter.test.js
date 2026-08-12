import test from "node:test";
import assert from "node:assert/strict";
import { createInitialGame, createPlayer } from "../src/game/gameFactory.js";
import { createGamePresenter } from "../src/presentation/gamePresenter.js";
import { GAME_ACTION } from "../src/game/gameProtocol.js";

function ids(prefix) {
  let index = 0;
  return () => `${prefix}_${String(index++).padStart(24, "0")}`;
}

function twoPlayerGame() {
  const idFactory = ids("presenter");
  const game = createInitialGame({
    code: "ABCDEF",
    hostCharacterId: "vlad",
    idFactory,
    rng: () => 0.2,
  });
  game.players.push(createPlayer("maria", { playerId: "player_maria", seatId: "seat_maria" }, { idFactory }));
  return game;
}

function presenterHarness() {
  let randomIndex = 0;
  const randomValues = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6];
  return {
    presenter: createGamePresenter({
      now: () => 1000,
      random: () => randomValues[randomIndex++ % randomValues.length],
    }),
  };
}

test("trade presentation writes only through the synchronized presentation slice", () => {
  const game = twoPlayerGame();
  const { presenter } = presenterHarness();

  presenter.presentTradeEvent(game, {
    type: "PLAYER_TRADE_ACCEPTED",
    actorIndex: 1,
    proposerIndex: 0,
  });

  assert.equal(game.presentation.log.length, 1);
  assert.match(game.presentation.log[0].msg, /Princesa Maria.*Vlad Drácula/);
  assert.equal(game.presentation.log[0].kind, "trade");
  assert.equal("log" in game, false);
  assert.equal("ev" in game, false);
});


test("bank trade chronicle keeps explicit resource outflow and inflow", () => {
  const game = twoPlayerGame();
  const { presenter } = presenterHarness();

  presenter.presentTradeEvent(game, {
    type: "BANK_TRADE_COMPLETED",
    actorIndex: 0,
    give: "cavalos",
    get: "tijolo",
    ratio: 4,
  });

  assert.deepEqual(game.presentation.log[0].resources, [
    { resource: "cavalos", amount: -4 },
    { resource: "tijolo", amount: 1 },
  ]);
});

test("scoring presentation synchronizes awards with a semantic voice cue", () => {
  const game = twoPlayerGame();
  const { presenter } = presenterHarness();

  presenter.presentScoringEvents(game, [{
    type: "LONGEST_ROAD_CHANGED",
    playerIndex: 0,
    previousPlayerIndex: 1,
    length: 6,
  }]);

  assert.equal(game.presentation.award.kind, "road");
  assert.equal(game.presentation.award.pi, 0);
  assert.equal(game.presentation.award.prev, 1);
  assert.equal(game.presentation.award.value, 6);
  assert.equal(game.presentation.log[0].kind, "event");
  assert.equal(game.presentation.log[0].emphasis, "important");
  assert.equal(game.presentation.log[0].audio, undefined);
});

test("dice presentation keeps harvest animation metadata inside the story event", () => {
  const game = twoPlayerGame();
  const { presenter } = presenterHarness();

  presenter.presentAppliedGameAction(game, {
    actionType: GAME_ACTION.ROLL_DICE,
    actorIndex: 0,
    events: [{
      type: "DICE_ROLLED",
      actorIndex: 0,
      dice: [3, 5],
      total: 8,
      seven: null,
      production: { gains: [{ madeira: 1 }, {}] },
    }],
  });

  assert.equal(game.presentation.story.kind, "dados");
  assert.equal(game.presentation.story.n, 8);
  assert.match(game.presentation.log.at(-1).msg, /lançou 8/);
  const harvest = game.presentation.log.find((entry) => entry.msg.includes("colheu"));
  assert.ok(harvest);
  assert.deepEqual(harvest.resources, [{ resource: "madeira", amount: 1 }]);
});

test("palace presentation combines synchronized story state with a semantic audio cue", () => {
  const game = twoPlayerGame();
  const { presenter } = presenterHarness();

  presenter.presentAppliedGameAction(game, {
    actionType: GAME_ACTION.BUILD_PALACE,
    actorIndex: 0,
    events: [],
  });

  assert.equal(game.presentation.story.kind, "char");
  assert.equal(game.presentation.story.pi, 0);
  assert.match(game.presentation.story.title, /palácio/i);
  assert.deepEqual(game.presentation.log[0].audio, { sfx: "build", voice: { character: "vlad", event: "found_palace" } });
});


test("trade proposals and disasters carry the new semantic sound cues", () => {
  const game = twoPlayerGame();
  const { presenter } = presenterHarness();

  presenter.presentTradeEvent(game, {
    type: "PLAYER_TRADE_PROPOSED",
    actorIndex: 0,
    targetIndex: 1,
  });
  assert.deepEqual(game.presentation.log[0].audio, { sfx: "tradeOffer" });

  const expected = {
    ganancia: "disasterGreed",
    peste: "disasterPlague",
    tributo: "disasterTribute",
    tsunami: "tsunami",
  };
  for (const [type, sfx] of Object.entries(expected)) {
    game.presentation.log = [];
    presenter.presentAppliedGameAction(game, {
      actionType: GAME_ACTION.ROLL_DICE,
      actorIndex: 0,
      events: [{
        type: "DISASTER_RESOLVED",
        outcome: "APPLIED",
        disasterType: type,
        sacredNumber: 2,
        disasterId: `d-${type}`,
        effects: [],
      }],
    });
    assert.deepEqual(game.presentation.log[0].audio, { sfx }, type);
  }
});
