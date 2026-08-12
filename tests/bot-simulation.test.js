import test from "node:test";
import assert from "node:assert/strict";

import { applyGameAction } from "../src/game/gameActionReducer.js";
import { chooseBotAction } from "../src/game/botPolicy.js";
import { createInitialGame, createPlayer } from "../src/game/gameFactory.js";
import { reduceLobbyToSetup } from "../src/game/gameSetupReducer.js";
import { createGameStateView } from "../src/game/gameStateView.js";
import { activateBotController } from "../src/game/playerPresence.js";
import { nextBotActorIndex } from "../src/multiplayer/hostBotController.js";

function seededRandom(initialSeed = 123456789) {
  let seed = initialSeed >>> 0;
  return () => {
    seed = (1664525 * seed + 1013904223) >>> 0;
    return seed / 2 ** 32;
  };
}

function idFactory() {
  let sequence = 1;
  return (prefix) => `${prefix}_${(sequence++).toString(16).padStart(24, "0")}`;
}

function botTable(mode, seed = 123456789) {
  const rng = seededRandom(seed);
  const makeId = idFactory();
  const game = createInitialGame({
    code: "ABCD",
    hostCharacterId: "vlad",
    mode,
    rng,
    idFactory: makeId,
    hostIdentity: { characterConfirmed: true, connected: true },
  });
  activateBotController(game.players[0]);
  game.players[0].ready = true;
  for (const characterId of ["maria", "romeo"]) {
    const player = createPlayer(characterId, { characterConfirmed: true, connected: true }, { idFactory: makeId });
    activateBotController(player);
    player.ready = true;
    game.players.push(player);
  }
  return { game: reduceLobbyToSetup(game, { rng }).game, rng, makeId };
}

for (const mode of ["classico", "dragao", "rapido", "guerra", "exploracao"]) {
  test(`three non-cheating bots can complete a ${mode} game`, () => {
    const { rng, makeId, ...table } = botTable(mode);
    let game = table.game;
    let steps = 0;
    while (game.phase !== "ended" && steps < 5000) {
      const actorIndex = nextBotActorIndex(game);
      assert.ok(actorIndex >= 0, `bot actor missing at step ${steps}`);
      const player = game.players[actorIndex];
      const view = createGameStateView(game, player.playerId);
      const action = chooseBotAction(view, actorIndex, { rng });
      assert.ok(action, `legal bot action missing at step ${steps}`);
      const applied = applyGameAction(game, player.playerId, action, {
        rng,
        now: () => steps * 1000,
        createId: makeId,
      });
      assert.equal(applied.ok, true, `${applied.reason || "rejected"}: ${JSON.stringify(action)}`);
      game = applied.game;
      steps += 1;
    }
    assert.equal(game.phase, "ended", `simulation did not finish after ${steps} actions`);
    assert.ok(Number.isSafeInteger(game.winner));
  });
}


test("exploration bot avoids setup positions that cannot place the mandatory road", () => {
  const { rng, makeId, ...table } = botTable("exploracao", 399964);
  let game = table.game;
  let steps = 0;
  while (game.phase === "setup" && steps < 30) {
    const actorIndex = nextBotActorIndex(game);
    assert.ok(actorIndex >= 0, `bot actor missing at setup step ${steps}`);
    const player = game.players[actorIndex];
    const view = createGameStateView(game, player.playerId);
    const action = chooseBotAction(view, actorIndex, { rng });
    assert.ok(action, `legal bot action missing at setup step ${steps}`);
    const applied = applyGameAction(game, player.playerId, action, {
      rng,
      now: () => steps * 1000,
      createId: makeId,
    });
    assert.equal(applied.ok, true, `${applied.reason || "rejected"}: ${JSON.stringify(action)}`);
    game = applied.game;
    steps += 1;
  }
  assert.equal(game.phase, "play");
});
