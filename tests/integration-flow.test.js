import test from "node:test";
import assert from "node:assert/strict";

import { createInitialGame, createPlayer } from "../src/game/gameFactory.js";
import { reduceLobbyToSetup } from "../src/game/gameSetupReducer.js";
import { applyGameAction } from "../src/game/gameActionReducer.js";
import { GAME_ACTION } from "../src/game/gameProtocol.js";
import { makeBoardGraph } from "../src/game/boardGeometry.js";
import { validRoads, validVillages } from "../src/game/buildingRules.js";
import { serializeGameSave, parseGameSave } from "../src/game/saveStore.js";
import { createHostActionController } from "../src/multiplayer/hostActionController.js";
import { createClientActionController } from "../src/multiplayer/clientActionController.js";
import { createMultiplayerRuntimeState } from "../src/multiplayer/runtimeState.js";
import { createPendingActionStore } from "../src/multiplayer/pendingActionStore.js";
import { IDS, TOKEN_HASHES } from "./fixtures.js";

const CHARACTERS = ["vlad", "maria", "rhaegal", "smaug"];
const PLAYER_IDS = [IDS.host, IDS.guest1, IDS.guest2, IDS.guest3];
const SEAT_IDS = [IDS.seatHost, IDS.seat1, IDS.seat2, IDS.seat3];
const TOKEN_IDS = [TOKEN_HASHES.host, TOKEN_HASHES.guest1, TOKEN_HASHES.guest2, TOKEN_HASHES.guest3];

function fixedId(prefix) {
  return `${prefix}_${"a".repeat(24)}`;
}

function createFourPlayerLobby() {
  const game = createInitialGame({
    code: "FLOW",
    mode: "classico",
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
  for (let index = 1; index < 4; index += 1) {
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

function completeSetup(source) {
  let game = reduceLobbyToSetup(source, { rng: () => 0.21 }).game;
  let guard = 0;
  while (game.phase === "setup") {
    assert.ok(guard++ < 20, "setup did not terminate");
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

test("integration: four players complete setup, take a turn, save and resume", () => {
  let game = completeSetup(createFourPlayerLobby());
  assert.equal(game.phase, "play");
  assert.equal(Object.keys(game.builds).length, 8);
  assert.equal(Object.keys(game.roads).length, 8);

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

  const parsed = parseGameSave(serializeGameSave(ended.game));
  assert.equal(parsed.ok, true, parsed.reason);
  assert.equal(parsed.game.v, ended.game.v);
  assert.equal(parsed.game.phase, "play");
  assert.deepEqual(parsed.game.order, ended.game.order);
  assert.equal(Object.keys(parsed.game.builds).length, 8);
});

function fakeConnection(onSend) {
  return {
    open: true,
    sent: [],
    send(payload) {
      this.sent.push(payload);
      onSend?.(payload);
    },
  };
}

test("integration: client → host → reducer → ACK resolves through the public controllers", async () => {
  let game = completeSetup(createFourPlayerLobby());
  game.v = 40;
  const hostRuntime = createMultiplayerRuntimeState();
  hostRuntime.host = true;
  let commits = 0;
  const hostController = createHostActionController({
    getRuntime: () => hostRuntime,
    getGame: () => game,
    getLocalPlayerId: () => PLAYER_IDS[game.order[game.turn.pos]],
    commit: async (next) => {
      commits += 1;
      game = structuredClone(next);
      game.v += 1;
      return game;
    },
    enqueueAuthorityTask: async (task) => task(),
  });

  const clientRuntime = createMultiplayerRuntimeState();
  const events = [];
  const clientController = createClientActionController({
    getRuntime: () => clientRuntime,
    getGame: () => game,
    getPlayerId: () => PLAYER_IDS[game.order[game.turn.pos]],
    pendingLobbyActions: createPendingActionStore({ timeoutMs: 100000 }),
    pendingGameActions: createPendingActionStore({ timeoutMs: 100000 }),
    createId: (prefix) => `${prefix}_${"b".repeat(24)}`,
    emit: (event) => events.push(event),
  });

  clientRuntime.hostConn = fakeConnection(async (message) => {
    if (message.t !== "game-action") return;
    const result = await hostController.processGameAction(message);
    clientController.handleGameActionResult(result);
  });

  const result = await clientController.dispatchGameAction(GAME_ACTION.ROLL_DICE);
  assert.equal(result.ok, true);
  assert.equal(commits, 1);
  assert.equal(game.turn.rolled, true);
  assert.equal(events.at(-1).type, "GAME_ACTION_ACCEPTED");
});

test("integration: duplicate delivery is idempotent and commits only once", async () => {
  let game = completeSetup(createFourPlayerLobby());
  game.v = 60;
  const runtime = createMultiplayerRuntimeState();
  runtime.host = true;
  let commits = 0;
  const controller = createHostActionController({
    getRuntime: () => runtime,
    getGame: () => game,
    getLocalPlayerId: () => PLAYER_IDS[game.order[game.turn.pos]],
    commit: async (next) => {
      commits += 1;
      game = structuredClone(next);
      game.v += 1;
      return game;
    },
    enqueueAuthorityTask: async (task) => task(),
  });
  const actorId = PLAYER_IDS[game.order[game.turn.pos]];
  const actionId = `game_${"c".repeat(24)}`;
  const message = {
    t: "game-action",
    protocolVersion: game.identityVersion,
    gameProtocolVersion: game.gameProtocolVersion,
    actionId,
    expectedRevision: game.v,
    action: { type: GAME_ACTION.ROLL_DICE },
  };
  const first = await controller.processGameAction(message);
  const second = await controller.processGameAction(message);
  assert.equal(first.ok, true);
  assert.deepEqual(second, first);
  assert.equal(commits, 1);
});
