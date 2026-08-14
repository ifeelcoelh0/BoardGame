import test from "node:test";
import assert from "node:assert/strict";

import { chooseBotAction } from "../src/game/botPolicy.js";
import { rankBotActions, scoreBotAction } from "../src/game/botStrategy.js";
import { makeBoardGraph } from "../src/game/boardGeometry.js";
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


test("bot strategy uses only information present in the redacted state view", () => {
  const first = botGame();
  first.turn.rolled = true;
  first.players[1].res = { madeira: 1, tijolo: 1, cavalos: 1, ouro: 1, obsidiana: 1 };
  first.players[0].res = { madeira: 4, tijolo: 0, cavalos: 0, ouro: 0, obsidiana: 0 };
  first.deck = [{ id: "secret_a", kind: "vp" }, { id: "secret_b", kind: "monopolio" }];

  const second = structuredClone(first);
  second.players[0].res = { madeira: 0, tijolo: 4, cavalos: 0, ouro: 0, obsidiana: 0 };
  second.deck.reverse();

  const firstView = createGameStateView(first, IDS.guest1);
  const secondView = createGameStateView(second, IDS.guest1);
  assert.deepEqual(firstView, secondView);
  assert.deepEqual(
    chooseBotAction(firstView, 1, { rng: () => 0 }),
    chooseBotAction(secondView, 1, { rng: () => 0 }),
  );
});

test("bot steals from the opponent with the largest public hand", () => {
  const game = botGame();
  game.players[0].resourceCount = 7;
  game.players.push({ ...structuredClone(game.players[0]), playerId: "player_cccccccccccccccccccccccc", resourceCount: 2 });
  const ranked = rankBotActions(game, 1, [
    { type: GAME_ACTION.STEAL_RESOURCE, victimIndex: 0 },
    { type: GAME_ACTION.STEAL_RESOURCE, victimIndex: 2 },
  ]);
  assert.equal(ranked[0].action.victimIndex, 0);
});

test("bot dragon placement prefers blocking a rival over blocking itself", () => {
  const game = botGame();
  const graph = makeBoardGraph([
    { k: "0,0", terr: "floresta", num: 6, hid: false },
    { k: "1,0", terr: "montanha", num: 8, hid: false },
  ]);
  game.board = { ...game.board, hexes: Object.values(graph.hexMap).map(({ center, corners, ...hex }) => hex) };
  const rebuilt = makeBoardGraph(game.board.hexes);
  const ownVertex = rebuilt.hexMap["0,0"].corners[0];
  const rivalVertex = rebuilt.hexMap["1,0"].corners[2];
  game.builds = {
    [ownVertex]: { p: 1, t: 1 },
    [rivalVertex]: { p: 0, t: 2 },
  };
  const ranked = rankBotActions(game, 1, [
    { type: GAME_ACTION.PLACE_DRAGON, hex: "0,0" },
    { type: GAME_ACTION.PLACE_DRAGON, hex: "1,0" },
  ]);
  assert.equal(ranked[0].action.hex, "1,0");
});

test("war bot values recruiting troops above an ordinary road", () => {
  const game = botGame();
  game.mode = "guerra";
  game.gelo = { awake: true, active: true };
  game.players[1].res = { madeira: 4, tijolo: 4, cavalos: 4, ouro: 4, obsidiana: 4 };
  const troopScore = scoreBotAction(game, 1, { type: GAME_ACTION.RECRUIT_TROOP, subtype: "arqueiro" });
  const roadScore = scoreBotAction(game, 1, { type: GAME_ACTION.BUILD_ROAD, edge: "missing|edge" });
  assert.ok(troopScore > roadScore);
});

test("exploration bot prefers revealing fog over wandering across known terrain", () => {
  const game = botGame();
  game.mode = "exploracao";
  game.players[1].res = { madeira: 0, tijolo: 0, cavalos: 0, ouro: 0, obsidiana: 0 };
  game.board = {
    ...game.board,
    hexes: [
      { k: "0,0", terr: "floresta", num: 6, hid: false },
      { k: "1,0", terr: "oculto", num: null, hid: true },
      { k: "0,1", terr: "campo", num: 8, hid: false },
    ],
  };
  game.wagons = { w1: { p: 1, at: "0,0", cargo: 0, mv: 2 } };
  game.wbuilt = { 1: 1 };
  const hidden = scoreBotAction(game, 1, { type: GAME_ACTION.MOVE_WAGON, wagonId: "w1", hex: "1,0" });
  const visible = scoreBotAction(game, 1, { type: GAME_ACTION.MOVE_WAGON, wagonId: "w1", hex: "0,1" });
  assert.ok(hidden > visible);
  assert.ok(hidden > scoreBotAction(game, 1, { type: GAME_ACTION.END_TURN }));
});

test("bot profiles create materially different strategic priorities", () => {
  const game = botGame();
  game.turn.rolled = true;
  const buyCard = { type: GAME_ACTION.BUY_DEV_CARD };
  const village = { type: GAME_ACTION.BUILD_VILLAGE, vertex: "missing_vertex" };

  assert.ok(
    scoreBotAction(game, 1, buyCard, { profileId: "developer" })
      > scoreBotAction(game, 1, village, { profileId: "developer" }),
  );
  assert.ok(
    scoreBotAction(game, 1, village, { profileId: "expander" })
      > scoreBotAction(game, 1, buyCard, { profileId: "expander" }),
  );
});

test("bot trade memory prevents repeating proposals forever in the same turn", async () => {
  const { createBotDecisionMemory } = await import("../src/game/botPolicy.js");
  const game = botGame();
  game.turn.rolled = true;
  game.players[1].res = { madeira: 3, tijolo: 0, cavalos: 0, ouro: 0, obsidiana: 0 };
  const memory = createBotDecisionMemory();
  const view = createGameStateView(game, IDS.guest1);

  const first = chooseBotAction(view, 1, { rng: () => 0, profileId: "economist", memory });
  assert.equal(first.type, GAME_ACTION.PROPOSE_TRADE);
  assert.equal(memory.tradeAttempts, 1);

  const second = chooseBotAction(view, 1, { rng: () => 0, profileId: "economist", memory });
  assert.notEqual(second.type, GAME_ACTION.PROPOSE_TRADE);
});
