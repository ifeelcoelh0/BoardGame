import test from "node:test";
import assert from "node:assert/strict";

import { GAME_ACTION } from "../src/game/gameProtocol.js";
import { createInitialGame, createPlayer } from "../src/game/gameFactory.js";
import { createGameStateView } from "../src/game/gameStateView.js";
import { listLegalActions } from "../src/game/legalActions.js";
import { activateBotController } from "../src/game/playerPresence.js";
import { IDS, TOKEN_HASHES } from "./fixtures.js";

function fixedId(prefix) {
  return `${prefix}_${"e".repeat(24)}`;
}

function gameWithBot() {
  const game = createInitialGame({
    code: "ABCD",
    hostCharacterId: "vlad",
    mode: "classico",
    rng: () => 0.25,
    idFactory: fixedId,
    hostIdentity: {
      playerId: IDS.host,
      seatId: IDS.seatHost,
      sessionTokenHash: TOKEN_HASHES.host,
      characterConfirmed: true,
      connected: true,
    },
  });
  const bot = createPlayer("maria", {
    playerId: IDS.guest1,
    seatId: IDS.seat1,
    characterConfirmed: true,
    connected: true,
  }, { idFactory: fixedId });
  activateBotController(bot, { now: 100 });
  game.players.push(bot);
  game.phase = "play";
  game.order = [1, 0];
  game.setup = null;
  game.turn = {
    pos: 0,
    rolled: false,
    dice: null,
    devPlayed: false,
    mustDragon: false,
    steal: null,
    milN: 0,
    acted: {},
    deploy: null,
    troopPlayed: false,
    bribed: false,
    bonus: null,
  };
  return game;
}

test("legal actions lead an active bot through the mandatory turn gates", () => {
  const game = gameWithBot();
  let actions = listLegalActions(createGameStateView(game, IDS.guest1), 1);
  assert.deepEqual(actions, [{ type: GAME_ACTION.ROLL_DICE }]);

  game.turn.rolled = true;
  game.turn.mustDragon = true;
  actions = listLegalActions(createGameStateView(game, IDS.guest1), 1);
  assert.ok(actions.length > 0);
  assert.ok(actions.every((action) => action.type === GAME_ACTION.PLACE_DRAGON));

  game.turn.mustDragon = false;
  game.turn.steal = { victims: [0] };
  actions = listLegalActions(createGameStateView(game, IDS.guest1), 1);
  assert.deepEqual(actions, [{ type: GAME_ACTION.STEAL_RESOURCE, victimIndex: 0 }]);
});

test("bot decisions can be generated from a private state view without opponent hands", () => {
  const game = gameWithBot();
  game.turn.rolled = true;
  game.players[0].res = { madeira: 9, tijolo: 8, cavalos: 7, ouro: 6, obsidiana: 5 };
  game.players[1].res = { madeira: 4, tijolo: 4, cavalos: 4, ouro: 4, obsidiana: 4 };
  const view = createGameStateView(game, IDS.guest1);
  assert.equal(Object.values(view.players[0].res).reduce((sum, amount) => sum + amount, 0), 0);
  assert.equal(view.players[0].resourceCount, 35);
  const actions = listLegalActions(view, 1);
  assert.ok(actions.some((action) => action.type === GAME_ACTION.END_TURN));
});

test("a bot can answer a trade even outside its own turn", () => {
  const game = gameWithBot();
  game.order = [0, 1];
  game.turn.pos = 0;
  game.turn.rolled = true;
  game.trade = {
    id: "trade_test",
    from: 0,
    fromPlayerId: IDS.host,
    to: 1,
    toPlayerId: IDS.guest1,
    give: { madeira: 1 },
    get: { ouro: 1 },
    declined: [],
  };
  game.players[1].res.ouro = 2;
  const actions = listLegalActions(createGameStateView(game, IDS.guest1), 1);
  assert.ok(actions.some((action) => action.type === GAME_ACTION.ACCEPT_TRADE));
  assert.ok(actions.some((action) => action.type === GAME_ACTION.DECLINE_TRADE));
});
