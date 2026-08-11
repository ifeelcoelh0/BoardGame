import test from "node:test";
import assert from "node:assert/strict";

import { GAME_ACTION } from "../src/game/gameProtocol.js";
import {
  GAME_ACTION_REDUCER_VERSION,
  applyGameAction,
  currentGameActorIndex,
} from "../src/game/gameActionReducer.js";
import { createInitialGame, createPlayer } from "../src/game/gameFactory.js";
import { makeBoardGraph } from "../src/game/boardGeometry.js";
import { validRoads, validVillages } from "../src/game/buildingRules.js";
import { IDS, TOKEN_HASHES } from "./fixtures.js";

function fixedId(prefix) {
  return `${prefix}_${"f".repeat(24)}`;
}

function richResources() {
  return { madeira: 12, tijolo: 12, cavalos: 12, ouro: 12, obsidiana: 12 };
}

function playableGame(mode = "classico") {
  const game = createInitialGame({
    code: "ABCD",
    hostCharacterId: "vlad",
    mode,
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
  const guest = createPlayer("maria", {
    playerId: IDS.guest1,
    seatId: IDS.seat1,
    sessionTokenHash: TOKEN_HASHES.guest1,
    characterConfirmed: true,
    connected: true,
  }, { idFactory: fixedId });
  game.players.push(guest);
  game.players.forEach((player) => {
    player.res = richResources();
    player.ready = true;
  });
  game.phase = "play";
  game.order = [0, 1];
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
  game.stats = {};
  return game;
}

function setupGame() {
  const game = playableGame("classico");
  game.phase = "setup";
  game.order = [0, 1];
  game.setup = { seq: [0, 1, 1, 0], i: 0, needRoad: false, lastV: null };
  game.turn = { ...game.turn, pos: 0 };
  return game;
}

test("the central reducer exposes an explicit version and active actor helper", () => {
  assert.equal(GAME_ACTION_REDUCER_VERSION, 1);
  const play = playableGame();
  assert.equal(currentGameActorIndex(play), 0);
  const setup = setupGame();
  setup.setup.i = 1;
  assert.equal(currentGameActorIndex(setup), 1);
});

test("every protocol action is handled by the central reducer", () => {
  for (const type of Object.values(GAME_ACTION)) {
    const game = playableGame();
    const result = applyGameAction(game, IDS.host, { type }, {
      rng: () => 0.1,
      dice: [1, 2],
      createId: fixedId,
      now: () => 123,
    });
    assert.notEqual(result.reason, "UNKNOWN_ACTION", type);
  }
});

test("unknown, unauthenticated and disconnected actors are rejected centrally", () => {
  const game = playableGame();
  assert.deepEqual(applyGameAction(game, IDS.host, { type: "NOPE" }), { ok: false, reason: "UNKNOWN_ACTION" });
  assert.deepEqual(applyGameAction(game, "player_missing", { type: GAME_ACTION.ROLL_DICE }), { ok: false, reason: "UNAUTHENTICATED" });
  game.players[0].connected = false;
  assert.deepEqual(applyGameAction(game, IDS.host, { type: GAME_ACTION.ROLL_DICE }), { ok: false, reason: "PLAYER_DISCONNECTED" });
});

test("dice are authoritative, deterministic and leave the source state untouched", () => {
  const game = playableGame();
  const before = structuredClone(game);
  const result = applyGameAction(game, IDS.host, { type: GAME_ACTION.ROLL_DICE }, {
    dice: [3, 4],
    rng: () => 0,
    now: () => 500,
  });
  assert.equal(result.ok, true);
  assert.deepEqual(result.game.turn.dice, [3, 4]);
  assert.equal(result.game.turn.rolled, true);
  assert.equal(result.events[0].type, "DICE_ROLLED");
  assert.deepEqual(game, before);
});

test("setup settlement and road flow through the same central action entrypoint", () => {
  const game = setupGame();
  const graph = makeBoardGraph(game.board.hexes);
  const vertex = validVillages(game, graph, 0, true)[0];
  assert.ok(vertex);
  const village = applyGameAction(game, IDS.host, {
    type: GAME_ACTION.BUILD_VILLAGE,
    vertex,
  });
  assert.equal(village.ok, true);
  assert.equal(village.events[0].type, "SETUP_SETTLEMENT_BUILT");

  const graphAfterVillage = makeBoardGraph(village.game.board.hexes);
  const edge = validRoads(village.game, graphAfterVillage, 0, vertex)[0];
  assert.ok(edge);
  const road = applyGameAction(village.game, IDS.host, {
    type: GAME_ACTION.BUILD_ROAD,
    edge,
  });
  assert.equal(road.ok, true);
  assert.equal(road.events[0].type, "SETUP_ROAD_BUILT");
  assert.equal(road.game.setup.i, 1);
});

test("non-current trade recipients can accept through the central reducer", () => {
  const game = playableGame();
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
  const result = applyGameAction(game, IDS.guest1, {
    type: GAME_ACTION.ACCEPT_TRADE,
    tradeId: "trade_test",
  });
  assert.equal(result.ok, true);
  assert.equal(result.events[0].type, "PLAYER_TRADE_ACCEPTED");
  assert.equal(result.game.trade, null);
});

test("trade IDs and end-turn events are supplied by injected authoritative dependencies", () => {
  const game = playableGame();
  game.turn.rolled = true;
  const proposal = applyGameAction(game, IDS.host, {
    type: GAME_ACTION.PROPOSE_TRADE,
    toPlayerId: IDS.guest1,
    give: { madeira: 1 },
    get: { ouro: 1 },
  }, { createId: () => "trade_deterministic" });
  assert.equal(proposal.ok, true);
  assert.equal(proposal.game.trade.id, "trade_deterministic");

  const clean = playableGame();
  clean.turn.rolled = true;
  const ended = applyGameAction(clean, IDS.host, { type: GAME_ACTION.END_TURN }, { rng: () => 0 });
  assert.equal(ended.ok, true);
  assert.equal(ended.events[0].type, "TURN_ADVANCED");
  assert.equal(ended.game.turn.pos, 1);
});
