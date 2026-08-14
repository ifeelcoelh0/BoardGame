import test from "node:test";
import assert from "node:assert/strict";

import { createInitialGame, createPlayer } from "../src/game/gameFactory.js";
import { activateBotController } from "../src/game/playerPresence.js";
import { nextBotActorIndex, scheduleHostBotAction } from "../src/multiplayer/hostBotController.js";
import { IDS, TOKEN_HASHES } from "./fixtures.js";

function fixedId(prefix) { return `${prefix}_${"c".repeat(24)}`; }

function makeGame() {
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
  game.stats = {};
  return game;
}

test("host bot controller identifies bot turns and remote trade replies", () => {
  const game = makeGame();
  assert.equal(nextBotActorIndex(game), 1);
  game.order = [0, 1];
  game.turn.pos = 0;
  game.trade = { id: "trade_test", from: 0, to: 1, give: { madeira: 1 }, get: { ouro: 1 }, declined: [] };
  assert.equal(nextBotActorIndex(game), 1);
});

test("host bot controller commits one authoritative bot action", async () => {
  let game = makeGame();
  let commits = 0;
  const done = new Promise((resolve, reject) => {
    const cancel = scheduleHostBotAction({
      game,
      getGame: () => game,
      delayMs: 0,
      rng: () => 0.1,
      now: () => 5_000,
      createId: (prefix) => `${prefix}_${"d".repeat(24)}`,
      enqueueAuthorityTask: async (task) => task(),
      commit: async (next) => {
        game = next;
        commits += 1;
        resolve();
        return next;
      },
      onError: reject,
    });
    setTimeout(() => { cancel(); reject(new Error("bot action timeout")); }, 1000);
  });
  await done;
  assert.equal(commits, 1);
  assert.equal(game.turn.rolled, true);
  assert.equal(game.actionJournal.entries.length, 1);
  assert.equal(game.actionJournal.entries[0].source, "bot");
  assert.equal(game.actionJournal.entries[0].actionType, "ROLL_DICE");
  assert.match(game.actionJournal.entries[0].actionId, /^game_[a-f0-9]{24}$/);
});
