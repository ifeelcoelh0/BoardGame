import test from "node:test";
import assert from "node:assert/strict";

import { createInitialGame, createPlayer } from "../src/game/gameFactory.js";
import { reduceLobbyToSetup } from "../src/game/gameSetupReducer.js";
import { applyGameAction } from "../src/game/gameActionReducer.js";
import { GAME_ACTION } from "../src/game/gameProtocol.js";
import { makeBoardGraph } from "../src/game/boardGeometry.js";
import { validRoads, validVillages } from "../src/game/buildingRules.js";
import { parseGameSave, serializeGameSave } from "../src/game/saveStore.js";
import { createGameStateView } from "../src/game/gameStateView.js";
import { IDS, TOKEN_HASHES } from "./fixtures.js";

const CORE_MODES = ["classico", "rapido", "dragao"];
const CHARACTERS = ["vlad", "maria", "artheria", "bones"];
const PLAYER_IDS = [IDS.host, IDS.guest1, IDS.guest2, IDS.guest3];
const SEAT_IDS = [IDS.seatHost, IDS.seat1, IDS.seat2, IDS.seat3];
const TOKEN_IDS = [TOKEN_HASHES.host, TOKEN_HASHES.guest1, TOKEN_HASHES.guest2, TOKEN_HASHES.guest3];

function fixedId(prefix) {
  return `${prefix}_${"h".repeat(24)}`;
}

function createReadyLobby(mode, playerCount) {
  const game = createInitialGame({
    code: "HARDEN",
    mode,
    hostCharacterId: CHARACTERS[0],
    rng: () => 0.31,
    idFactory: fixedId,
    hostIdentity: {
      playerId: PLAYER_IDS[0],
      seatId: SEAT_IDS[0],
      sessionTokenHash: TOKEN_IDS[0],
      characterConfirmed: true,
      connected: true,
    },
  });

  for (let index = 1; index < playerCount; index += 1) {
    game.players.push(createPlayer(CHARACTERS[index], {
      playerId: PLAYER_IDS[index],
      seatId: SEAT_IDS[index],
      sessionTokenHash: TOKEN_IDS[index],
      characterConfirmed: true,
      connected: true,
    }, { idFactory: fixedId }));
  }
  game.players.forEach((player) => { player.ready = true; });
  return game;
}

function roundTrip(game) {
  const parsed = parseGameSave(serializeGameSave(game));
  assert.equal(parsed.ok, true, parsed.reason);
  return parsed.game;
}

function completeSetup(source) {
  let game = reduceLobbyToSetup(source, { rng: () => 0.21 }).game;
  let guard = 0;
  while (game.phase === "setup") {
    assert.ok(guard++ < 24, "setup did not terminate");
    const actorIndex = game.setup.seq[game.setup.i];
    const graph = makeBoardGraph(game.board.hexes);
    if (!game.setup.needRoad) {
      const vertex = validVillages(game, graph, actorIndex, true)[0];
      assert.ok(vertex, `missing setup vertex for ${actorIndex}`);
      const result = applyGameAction(game, PLAYER_IDS[actorIndex], {
        type: GAME_ACTION.BUILD_VILLAGE,
        vertex,
      }, { rng: () => 0.2 });
      assert.equal(result.ok, true, result.reason);
      game = result.game;
    } else {
      const edge = validRoads(game, graph, actorIndex, game.setup.lastV)[0];
      assert.ok(edge, `missing setup road for ${actorIndex}`);
      const result = applyGameAction(game, PLAYER_IDS[actorIndex], {
        type: GAME_ACTION.BUILD_ROAD,
        edge,
      }, { rng: () => 0.2 });
      assert.equal(result.ok, true, result.reason);
      game = result.game;
    }
  }
  return game;
}

for (const mode of CORE_MODES) {
  for (const playerCount of [3, 4]) {
    test(`${mode}: ${playerCount} jogadores preservam lobby → setup → turno → save/resume`, () => {
      let game = createReadyLobby(mode, playerCount);

      const lobbySave = roundTrip(game);
      assert.equal(lobbySave.mode, mode);
      assert.equal(lobbySave.phase, "lobby");
      assert.equal(lobbySave.players.length, playerCount);

      game = completeSetup(lobbySave);
      assert.equal(game.phase, "play");
      assert.equal(Object.keys(game.builds).length, playerCount * 2);
      assert.equal(Object.keys(game.roads).length, playerCount * 2);

      const expectedBuildingType = mode === "rapido" ? 2 : 1;
      assert.ok(Object.values(game.builds).every((building) => building.t === expectedBuildingType));

      const actorIndex = game.order[game.turn.pos];
      const rolled = applyGameAction(game, PLAYER_IDS[actorIndex], {
        type: GAME_ACTION.ROLL_DICE,
      }, { dice: [3, 5], rng: () => 0.2, now: () => 1000 });
      assert.equal(rolled.ok, true, rolled.reason);
      assert.deepEqual(rolled.game.turn.dice, [3, 5]);

      const ended = applyGameAction(rolled.game, PLAYER_IDS[actorIndex], {
        type: GAME_ACTION.END_TURN,
      }, { rng: () => 0.2, now: () => 1100 });
      assert.equal(ended.ok, true, ended.reason);
      assert.notEqual(ended.game.turn.pos, game.turn.pos);

      const resumed = roundTrip(ended.game);
      assert.equal(resumed.mode, mode);
      assert.equal(resumed.phase, "play");
      assert.deepEqual(resumed.order, ended.game.order);
      assert.deepEqual(resumed.turn, ended.game.turn);
      assert.equal(Object.keys(resumed.builds).length, playerCount * 2);
      assert.equal(Object.keys(resumed.roads).length, playerCount * 2);

      /* O save é do anfitrião e contém o estado canónico. Depois do resume cada
         lugar continua a receber apenas a sua vista censurada. */
      resumed.players.forEach((player, playerIndex) => {
        const view = createGameStateView(resumed, player.playerId);
        assert.equal(view.players.length, playerCount);
        assert.equal(view.players[playerIndex].playerId, player.playerId);
        view.players.forEach((visiblePlayer, index) => {
          if (index === playerIndex) return;
          assert.equal(visiblePlayer.devNew.every((card) => card.kind === "hidden"), true);
          assert.equal(visiblePlayer.devOld.every((card) => card.kind === "hidden"), true);
          assert.ok(Number.isSafeInteger(visiblePlayer.resourceCount));
        });
      });
    });
  }
}
