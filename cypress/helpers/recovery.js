import { ACTION_SOURCE, appendAcceptedGameAction, createActionExecutionTrace } from "../../src/game/actionJournal.js";
import { makeBoardGraph } from "../../src/game/boardGeometry.js";
import { applyGameAction } from "../../src/game/gameActionReducer.js";
import { createInitialGame, createPlayer } from "../../src/game/gameFactory.js";
import { GAME_ACTION } from "../../src/game/gameProtocol.js";
import { reduceLobbyToSetup } from "../../src/game/gameSetupReducer.js";
import { activateBotController } from "../../src/game/playerPresence.js";
import { serializeGameSave } from "../../src/game/saveStore.js";
import {
  SAVE_INDEX_STORAGE_KEY,
  SAVE_STORAGE_KEY,
  saveStorageKeyForCode,
} from "../../src/game/saveSchema.js";
import { appUrl, seedCypressRuntimeSettings } from "./lobby.js";

const UPDATED_AT = "2026-08-14T00:00:00.000Z";

function fixedIds(hex) {
  return (kind = "id") => `${kind}_${hex.repeat(24).slice(0, 24)}`;
}

function identity(hex) {
  return {
    playerId: `player_${hex.repeat(24).slice(0, 24)}`,
    seatId: `seat_${hex.repeat(24).slice(0, 24)}`,
    sessionTokenHash: hex.repeat(64).slice(0, 64),
    characterConfirmed: true,
  };
}

function deterministicRng() {
  const values = [0.11, 0.73, 0.29, 0.61, 0.43, 0.87, 0.19, 0.53];
  let index = 0;
  return () => values[index++ % values.length];
}

export function createRecoveryGame({ phase = "play", mode = "classico", bots = [] } = {}) {
  const rng = deterministicRng();
  const current = createInitialGame({
    code: "RCVRYA",
    hostCharacterId: "vlad",
    hostIdentity: identity("a"),
    mode,
    rng,
    idFactory: fixedIds("a"),
  });
  current.players.push(
    createPlayer("maria", identity("b"), { idFactory: fixedIds("b") }),
    createPlayer("bones", identity("c"), { idFactory: fixedIds("c") }),
  );
  current.players.forEach((player) => { player.ready = true; });
  bots.forEach((index) => activateBotController(current.players[index], { now: 500 + index }));

  const started = reduceLobbyToSetup(current, { rng }).game;
  started.order = [0, 1, 2];
  started.setup.seq = [0, 1, 2, 2, 1, 0];
  started.turn.pos = 0;

  if (phase === "setup") return started;

  started.phase = phase;
  started.setup = null;
  started.turn = {
    ...started.turn,
    pos: 0,
    rolled: false,
    dice: null,
    mustDragon: false,
    steal: null,
  };
  if (phase === "ended") started.winner = 0;
  return started;
}

export function createMidSetupRecoveryGame() {
  const game = createRecoveryGame({ phase: "setup", bots: [2] });
  const graph = makeBoardGraph(game.board.hexes);
  const lastV = Object.keys(graph.verts)[0];
  game.setup.i = 0;
  game.setup.needRoad = true;
  game.setup.lastV = lastV;
  game.builds[lastV] = { p: 0, t: 1 };
  return game;
}

export function createMandatoryDecisionRecoveryGame() {
  const game = createRecoveryGame({ phase: "play", bots: [2] });
  game.players[1].res.madeira = 2;
  game.queue = [{ t: "descarte", p: 1, need: 2 }];
  game.turn.rolled = true;
  game.turn.dice = 7;
  game.turn.mustDragon = true;
  game.turn.steal = { hex: game.board.hexes[0].k, victims: [2], at: 4_000 };
  game.turn.devPlayed = true;
  return game;
}

export function createTradeRecoveryGame() {
  const game = createRecoveryGame({ phase: "play", bots: [2] });
  game.trade = {
    id: `trade_${"1".repeat(24)}`,
    from: 0,
    fromPlayerId: game.players[0].playerId,
    to: 1,
    toPlayerId: game.players[1].playerId,
    give: { madeira: 1 },
    get: { tijolo: 1 },
    declined: [],
  };
  return game;
}

export function createEndedRecoveryGame() {
  const game = createRecoveryGame({ phase: "ended", bots: [2] });
  game.players.forEach((player) => { player.ready = true; });
  game.endReason = "VICTORY_POINTS";
  return game;
}

export function createJournalRecoveryGame() {
  let game = createRecoveryGame({ phase: "play" });
  game.v = 20;
  const trace = createActionExecutionTrace({ rng: (() => {
    const values = [0.1, 0.2];
    let index = 0;
    return () => values[index++];
  })() });
  const rolled = applyGameAction(game, game.players[0].playerId, { type: GAME_ACTION.ROLL_DICE }, {
    rng: trace.rng,
    now: () => 1_000,
  });
  if (!rolled.ok) throw new Error(`Could not build journal recovery fixture: ${rolled.reason}`);
  game = appendAcceptedGameAction(game, rolled.game, {
    actionId: `game_${"4".repeat(24)}`,
    source: ACTION_SOURCE.LOCAL_HUMAN,
    playerId: game.players[0].playerId,
    actorIndex: rolled.actorIndex,
    action: { type: GAME_ACTION.ROLL_DICE },
    revisionBefore: 20,
    revisionAfter: 21,
    occurredAt: 1_000,
    trace: trace.snapshot(),
    events: rolled.events,
    privateResult: rolled.privateResult,
  }).game;
  game.v = 21;
  return game;
}

export function createModeRecoveryGame(mode) {
  const game = createRecoveryGame({ phase: "play", mode, bots: [2] });
  if (mode === "guerra") {
    game.units = { "0,0": { p: 0, t: "cavaleiro", mv: 1 } };
    game.occ = { "1,1": 1 };
    game.glory = { 0: 2, 1: 1 };
    game.troll.awake = true;
    game.troll.turns = 12;
    game.gelo = { awake: true, active: true };
  }
  if (mode === "exploracao") {
    game.wagons = { wagon_recovery: { p: 0, at: "0,0", cargo: 1, mv: 1 } };
    game.wbuilt = { 0: 1 };
    game.wseq = 1;
  }
  return game;
}

export function seedSavedRealm(win, game) {
  const serialized = serializeGameSave(game);
  const saveKey = saveStorageKeyForCode(game.code);
  win.localStorage.clear();
  seedCypressRuntimeSettings(win);
  win.localStorage.setItem(saveKey, serialized);
  win.localStorage.setItem(SAVE_STORAGE_KEY, serialized);
  win.localStorage.setItem(SAVE_INDEX_STORAGE_KEY, JSON.stringify({
    version: 1,
    entries: [{
      code: game.code,
      saveKey,
      role: "host",
      phase: game.phase,
      updatedAt: UPDATED_AT,
      appVersion: game.appVersion,
    }],
  }));
}

export function visitWithSavedRealm(game) {
  cy.visit(appUrl, {
    onBeforeLoad(win) {
      seedSavedRealm(win, game);
    },
  });
  cy.get('[data-testid="lobby-experience"]').should("be.visible");
}

export function resumeLatestRealm() {
  cy.contains("button", "Open codex").should("be.visible").click();
  cy.get('[data-testid="resume-last-realm"]').should("be.enabled").click();
  cy.get('[data-testid="game-screen"]', { timeout: 20_000 }).should("be.visible");
}

export function readPersistedRealm(code = "RCVRYA") {
  return cy.window().then((win) => {
    const raw = win.localStorage.getItem(saveStorageKeyForCode(code));
    expect(raw, `persisted realm ${code}`).to.be.a("string");
    return JSON.parse(raw);
  });
}
