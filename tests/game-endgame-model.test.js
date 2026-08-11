import test from "node:test";
import assert from "node:assert/strict";
import { createInitialGame, createPlayer } from "../src/game/gameFactory.js";
import { makeBoardGraph } from "../src/game/boardGeometry.js";
import { buildEndgameModel, rankMetric } from "../src/ui/game/endgame/gameEndgameModel.js";

function endedGame() {
  const game = createInitialGame({ code: "ABCDEF", hostCharacterId: "maria", hostIdentity: { characterConfirmed: true }, rng: () => 0.25, idFactory: (prefix) => `${prefix}_aaaaaaaaaaaaaaaaaaaaaaaa` });
  game.players.push(createPlayer("vlad", { characterConfirmed: true }, { idFactory: (prefix) => `${prefix}_bbbbbbbbbbbbbbbbbbbbbbbb` }));
  game.phase = "ended"; game.winner = 0; game.round = 8;
  game.builds = { v1: { p: 0, t: 1 }, v2: { p: 0, t: 2 }, v3: { p: 1, t: 1 } };
  game.roads = { e1: 0, e2: 0, e3: 1 };
  game.players[0].devOld = [{ id: 1, kind: "vp", sub: "🍀 Sorte" }];
  game.players[1].res.madeira = 2;
  game.stats = { totalRolls: 4, sevens: 1, disasters: 1, rolls: { 6: 2, 7: 1, 8: 1 }, produced: [8, 3], portTrades: [1, 4], p2pTrades: [3, 1] };
  return game;
}

test("endgame model derives one stable ceremonial view from final game state", () => {
  const game = endedGame(); const model = buildEndgameModel(game, makeBoardGraph(game.board.hexes), 0);
  assert.equal(model.winner.playerIndex, 0); assert.equal(model.winner.characterId, "maria"); assert.equal(model.round, 8);
  assert.equal(model.standings.length, 2); assert.equal(model.standings[0].playerIndex, 0); assert.equal(model.standings[0].villages, 1); assert.equal(model.standings[0].palaces, 1); assert.equal(model.standings[0].victoryCards, 1); assert.equal(model.dice.rolls[6], 2); assert.equal(model.metrics.portTrades[1], 4);
});

test("metric ranking is derived from the same standings instead of rebuilding player identity", () => {
  const game = endedGame(); const model = buildEndgameModel(game, makeBoardGraph(game.board.hexes), 0); const ranked = rankMetric(model, model.metrics.portTrades);
  assert.deepEqual(ranked.map((entry) => [entry.playerIndex, entry.value]), [[1, 4], [0, 1]]);
});

test("endgame model is absent before a valid winner exists", () => {
  const game = endedGame(); const graph = makeBoardGraph(game.board.hexes); game.phase = "play"; assert.equal(buildEndgameModel(game, graph, 0), null); game.phase = "ended"; game.winner = null; assert.equal(buildEndgameModel(game, graph, 0), null);
});
