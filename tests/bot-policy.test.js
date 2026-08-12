import test from "node:test";
import assert from "node:assert/strict";

import { chooseBotAction } from "../src/game/botPolicy.js";
import { GAME_ACTION } from "../src/game/gameProtocol.js";
import { createInitialGame, createPlayer } from "../src/game/gameFactory.js";
import { createGameStateView } from "../src/game/gameStateView.js";
import { activateBotController } from "../src/game/playerPresence.js";
import { IDS, TOKEN_HASHES } from "./fixtures.js";

function fixedId(prefix) { return `${prefix}_${"d".repeat(24)}`; }

function botGame() {
  const game = createInitialGame({
    code: "ABCD",
    hostCharacterId: "vlad",
    mode: "classico",
    rng: () => 0.2,
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
  });
  activateBotController(bot);
  game.players.push(bot);
  game.phase = "play";
  game.order = [1, 0];
  game.setup = null;
  game.turn = { pos: 0, rolled: false, dice: null, devPlayed: false, mustDragon: false, steal: null, milN: 0, acted: {}, deploy: null, troopPlayed: false, bribed: false, bonus: null };
  return game;
}

test("bot policy resolves forced actions before strategic choices", () => {
  const game = botGame();
  const view = createGameStateView(game, IDS.guest1);
  assert.equal(chooseBotAction(view, 1, { rng: () => 0 }).type, GAME_ACTION.ROLL_DICE);

  game.turn.rolled = true;
  game.queue = [{ t: "bencao", p: 1, left: 1 }];
  const queued = chooseBotAction(createGameStateView(game, IDS.guest1), 1, { rng: () => 0 });
  assert.equal(queued.type, GAME_ACTION.RESOLVE_QUEUE_RESOURCE);
});

test("bot policy keeps end turn as a fallback", () => {
  const game = botGame();
  game.turn.rolled = true;
  game.players[1].res = { madeira: 0, tijolo: 0, cavalos: 0, ouro: 0, obsidiana: 0 };
  game.players[1].devOld = [];
  game.players[1].devNew = [];
  const action = chooseBotAction(createGameStateView(game, IDS.guest1), 1, { rng: () => 0 });
  assert.equal(action.type, GAME_ACTION.END_TURN);
});
