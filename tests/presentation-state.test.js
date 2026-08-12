import test from "node:test";
import assert from "node:assert/strict";
import {
  GAME_LOG_LIMIT,
  appendGameLog,
  createInitialGamePresentationState,
  gamePresentation,
  migrateLegacyGamePresentation,
  setGameAward,
  setGameCardReveal,
  setGameDisaster,
  setGameStory,
} from "../src/game/presentationState.js";

test("presentation state has one explicit synchronized shape", () => {
  assert.deepEqual(createInitialGamePresentationState(), {
    version: 1,
    log: [],
    story: null,
    cardReveal: null,
    award: null,
    disaster: null,
  });
});

test("legacy presentation fields migrate into the presentation slice", () => {
  const game = {
    log: [{ id: 1, msg: "antigo", pi: null }],
    ev: { id: 2, kind: "dados" },
    cardEv: { id: 3, pi: 1, card: { id: "c1" } },
    awardEv: { id: 4, kind: "road" },
    disaster: { id: 5, type: "peste" },
  };

  migrateLegacyGamePresentation(game);

  assert.equal("log" in game, false);
  assert.equal("ev" in game, false);
  assert.equal("cardEv" in game, false);
  assert.equal("awardEv" in game, false);
  assert.equal("disaster" in game, false);
  assert.equal(game.presentation.log[0].msg, "antigo");
  assert.equal(game.presentation.story.kind, "dados");
  assert.equal(game.presentation.cardReveal.card.id, "c1");
  assert.equal(game.presentation.award.kind, "road");
  assert.equal(game.presentation.disaster.type, "peste");
});

test("presentation writers keep the log bounded and clone payloads", () => {
  const game = { presentation: createInitialGamePresentationState() };
  for (let index = 0; index < GAME_LOG_LIMIT + 5; index += 1) {
    appendGameLog(game, `linha ${index}`, null, { id: index });
  }
  assert.equal(game.presentation.log.length, GAME_LOG_LIMIT);
  assert.equal(game.presentation.log[0].msg, `linha ${GAME_LOG_LIMIT + 4}`);

  const card = { id: "c1", nested: { value: 1 } };
  setGameCardReveal(game, { pi: 0, card }, { id: 101 });
  card.nested.value = 9;
  assert.equal(game.presentation.cardReveal.card.nested.value, 1);

  setGameStory(game, { kind: "char", pi: 0, title: "Título", text: "Texto" }, { id: 102 });
  setGameAward(game, { kind: "army", pi: 0, prev: null, value: 3 }, { id: 103 });
  const semanticLog = appendGameLog(game, "🛤️ Título mudou", 0, { id: 105, kind: "event", emphasis: "ceremonial", resources: [{ resource: "madeira", amount: 2 }, { resource: "tijolo", amount: -1 }], audio: { sfx: "award" } });
  assert.equal(semanticLog.kind, "event");
  assert.equal(semanticLog.emphasis, "ceremonial");
  assert.deepEqual(semanticLog.audio, { sfx: "award" });
  assert.deepEqual(semanticLog.resources, [{ resource: "madeira", amount: 2 }, { resource: "tijolo", amount: -1 }]);
  const safeLog = appendGameLog(game, "entrada antiga", 0, { id: 106, kind: "desconhecido", emphasis: "ruidoso" });
  assert.equal(safeLog.kind, "realm");
  assert.equal(safeLog.emphasis, "ambient");

  setGameDisaster(game, { type: "tsunami", num: 12 }, { id: 104 });
  assert.equal(game.presentation.story.id, 102);
  assert.equal(game.presentation.award.id, 103);
  assert.equal(game.presentation.disaster.id, 104);
  assert.equal(gamePresentation(game), game.presentation);
});
