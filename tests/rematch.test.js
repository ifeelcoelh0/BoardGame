import test from "node:test";
import assert from "node:assert/strict";
import { GAME_ACTION } from "../src/game/gameProtocol.js";
import { applyGameAction } from "../src/game/gameActionReducer.js";
import { createInitialGame, createPlayer } from "../src/game/gameFactory.js";
import { finalizeRematchIfReady, rematchStatus } from "../src/game/rematch.js";

const IDS = {
  p0: "player_000000000000000000000001",
  p1: "player_000000000000000000000002",
  s0: "seat_000000000000000000000001",
  s1: "seat_000000000000000000000002",
};

function endedGame() {
  const game = createInitialGame({ code: "ABCDEF", hostCharacterId: "vlad", hostIdentity: { playerId: IDS.p0, seatId: IDS.s0, characterConfirmed: true } });
  game.players.push(createPlayer("artheria", { playerId: IDS.p1, seatId: IDS.s1, characterConfirmed: true }));
  game.phase = "ended";
  game.winner = 0;
  game.players.forEach((player) => { player.ready = false; });
  game.v = 44;
  return game;
}

test("rematch opt-in is authoritative and immutable", () => {
  const game = endedGame();
  const result = applyGameAction(game, IDS.p0, { type: GAME_ACTION.REMATCH_READY });
  assert.equal(result.ok, true);
  assert.equal(result.game.players[0].ready, true);
  assert.equal(game.players[0].ready, false);
  assert.equal(rematchStatus(result.game).canReopen, false);
});

test("rematch lobby reopens only after every connected player opted in", () => {
  let game = endedGame();
  game = applyGameAction(game, IDS.p0, { type: GAME_ACTION.REMATCH_READY }).game;
  assert.equal(finalizeRematchIfReady(game).phase, "ended");
  game = applyGameAction(game, IDS.p1, { type: GAME_ACTION.REMATCH_READY }).game;
  const lobby = finalizeRematchIfReady(game, { rng: () => 0.2 });
  assert.equal(lobby.phase, "lobby");
  assert.equal(lobby.code, "ABCDEF");
  assert.equal(lobby.players.length, 2);
  assert.deepEqual(lobby.players.map((player) => player.playerId), [IDS.p0, IDS.p1]);
  assert.ok(lobby.players.every((player) => player.ready === false));
  assert.equal(lobby.v, 44);
});

test("disconnected players do not block a rematch", () => {
  let game = endedGame();
  game.players[1].connected = false;
  game = applyGameAction(game, IDS.p0, { type: GAME_ACTION.REMATCH_READY }).game;
  const lobby = finalizeRematchIfReady(game, { rng: () => 0.4 });
  assert.equal(lobby.phase, "lobby");
  assert.equal(lobby.players.length, 1);
  assert.equal(lobby.players[0].playerId, IDS.p0);
});

test("rematch preserves bot controllers and keeps them ready in the reopened lobby", () => {
  const game = endedGame();
  game.players[1].controller = "bot";
  game.players[0].ready = true;
  game.players[1].ready = true;
  const next = finalizeRematchIfReady(game, { rng: () => 0.25 });
  assert.equal(next.phase, "lobby");
  assert.equal(next.players[1].controller, "bot");
  assert.equal(next.players[1].connected, true);
  assert.equal(next.players[1].ready, true);
  assert.equal(next.players[0].ready, false);
});
