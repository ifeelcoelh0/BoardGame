import test from "node:test";
import assert from "node:assert/strict";
import {
  DEVELOPMENT_TROOP_TYPES,
  VICTORY_POINT_ATTRIBUTES,
  createInitialGame,
  createPlayer,
  generateBoard,
  generateDevelopmentDeck,
} from "../src/game/gameFactory.js";
import { makeBoardGraph, ringCoords } from "../src/game/boardGeometry.js";
import { GAME_MODE_CONFIG, gameModeConfig, normalizeGameMode } from "../src/game/gameModes.js";
import { reduceLobbyToSetup } from "../src/game/gameSetupReducer.js";
import { GAME_PROTOCOL_VERSION } from "../src/game/gameProtocol.js";
import { LOBBY_PROTOCOL_VERSION } from "../src/game/lobbyProtocol.js";
import { IDENTITY_PROTOCOL_VERSION } from "../src/game/playerIdentity.js";
import { TOKEN_HASHES } from "./fixtures.js";

function seededRng(seed = 1) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function axialDistance(key) {
  const [q, r] = key.split(",").map(Number);
  return (Math.abs(q) + Math.abs(r) + Math.abs(q + r)) / 2;
}

function terrainCounts(board) {
  return board.hexes.reduce((counts, hex) => {
    counts[hex.terr] = (counts[hex.terr] || 0) + 1;
    return counts;
  }, {});
}

function idFactory(prefix) {
  return `${prefix}_${prefix === "player" ? "1" : "2"}`;
}


test("players can occupy a lobby seat before choosing a character", () => {
  const player = createPlayer(null, { playerId: "pending-player", seatId: "pending-seat" }, { idFactory });
  assert.equal(player.ch, null);
  assert.equal(player.characterConfirmed, false);
  assert.equal(player.ready, false);
  assert.throws(() => createPlayer(null, { characterConfirmed: true }, { idFactory }), /confirmada/);

  const game = createInitialGame({ code: "P001", hostCharacterId: null, mode: "dragao", rng: seededRng(44), idFactory });
  assert.equal(game.players[0].ch, null);
  assert.equal(game.players[0].characterConfirmed, false);
});
test("mode configuration is the single source of lobby capacity", () => {
  assert.deepEqual(Object.keys(GAME_MODE_CONFIG), ["dragao", "classico", "rapido", "guerra", "exploracao"]);
  Object.values(GAME_MODE_CONFIG).forEach((config) => {
    assert.equal(config.minPlayers, 3);
    assert.equal(config.maxPlayers, 4);
  });
  assert.equal(normalizeGameMode("unknown"), "dragao");
  assert.equal(gameModeConfig("exploracao").classicRules, true);
  assert.equal(gameModeConfig("guerra").war, true);
});

test("hex rings have six times the radius unique coordinates", () => {
  for (let radius = 1; radius <= 4; radius += 1) {
    const coordinates = ringCoords(radius);
    assert.equal(coordinates.length, radius * 6);
    assert.equal(new Set(coordinates.map(([q, r]) => `${q},${r}`)).size, radius * 6);
  }
  assert.deepEqual(ringCoords(0), [[0, 0]]);
});

test("board graph shares the common edge of adjacent hexes", () => {
  const graph = makeBoardGraph([
    { k: "0,0", terr: "floresta", num: 8 },
    { k: "1,0", terr: "argila", num: 5 },
  ]);
  assert.equal(Object.keys(graph.hexMap).length, 2);
  assert.equal(Object.keys(graph.verts).length, 10);
  assert.equal(Object.keys(graph.edges).length, 11);
  assert.equal(Object.values(graph.edges).filter((edge) => edge.hexes.length === 2).length, 1);
});

test("standard board preserves the original terrain and port composition", () => {
  const board = generateBoard("dragao", 4, { rng: seededRng(10) });
  assert.equal(board.hexes.length, 19);
  assert.deepEqual(terrainCounts(board), {
    floresta: 4,
    prados: 4,
    grutas: 4,
    montanhas: 3,
    argila: 3,
    deserto: 1,
  });
  assert.equal(board.hexes.find((hex) => hex.k === board.dragon)?.terr, "deserto");
  assert.equal(board.ports.length, 9);
  assert.equal(board.ports.filter((port) => port.type === "any").length, 4);
  assert.equal(board.ports.every((port) => port.hid === false), true);
  assert.equal(board.prov, null);
});

test("board generation is deterministic with an injected RNG", () => {
  const first = generateBoard("dragao", 4, { rng: seededRng(123) });
  const second = generateBoard("dragao", 4, { rng: seededRng(123) });
  const third = generateBoard("dragao", 4, { rng: seededRng(124) });
  assert.deepEqual(first, second);
  assert.notDeepEqual(first, third);
});

test("exploration board contains a waste belt and a hidden outer ring", () => {
  const board = generateBoard("exploracao", 4, { rng: seededRng(20) });
  const ringThree = board.hexes.filter((hex) => axialDistance(hex.k) === 3);
  const ringFour = board.hexes.filter((hex) => axialDistance(hex.k) === 4);
  assert.equal(board.hexes.length, 61);
  assert.equal(ringThree.length, 18);
  assert.equal(ringThree.every((hex) => hex.terr === "deserto" && hex.hid !== true), true);
  assert.equal(ringFour.length, 24);
  assert.equal(ringFour.every((hex) => hex.hid === true), true);
  assert.equal(board.ports.length, 9);
  assert.equal(board.ports.every((port) => port.hid === true), true);
});

test("war board creates one balanced province and port per active player", () => {
  const board = generateBoard("guerra", 4, { rng: seededRng(30) });
  assert.equal(board.hexes.length, 37);
  assert.equal(Object.keys(board.prov).length, 12);
  assert.deepEqual([...new Set(Object.values(board.prov))], [0, 1, 2, 3]);
  assert.equal(board.ports.length, 4);
  assert.equal(board.ports.every((port) => port.type === "any" && port.hid === false), true);
  assert.equal(board.hexes.filter((hex) => hex.terr === "gelo").length, 1);
  assert.equal(board.hexes.find((hex) => hex.k === board.dragon)?.terr, "deserto");
  assert.ok([6, 8].includes(board.hexes.find((hex) => hex.k === "0,0")?.num));
});

test("war board retains support for three-player province generation", () => {
  const board = generateBoard("guerra", 3, { rng: seededRng(31) });
  assert.equal(Object.keys(board.prov).length, 9);
  assert.deepEqual([...new Set(Object.values(board.prov))], [0, 1, 2]);
  assert.equal(board.ports.length, 3);
});

test("classic deck contains 25 cards and only cavalry troops", () => {
  const deck = generateDevelopmentDeck("classico", { rng: seededRng(40) });
  assert.equal(deck.length, 25);
  assert.deepEqual(deck.map((card) => card.id), Array.from({ length: 25 }, (_, index) => index));
  assert.equal(deck.filter((card) => card.kind === "tropa").length, 14);
  assert.equal(deck.filter((card) => card.kind === "tropa").every((card) => card.sub === "cavaleiro"), true);
  assert.equal(deck.filter((card) => card.kind === "vp").length, 5);
  assert.deepEqual(new Set(deck.filter((card) => card.kind === "vp").map((card) => card.sub)), new Set(VICTORY_POINT_ATTRIBUTES));
});

test("dragon deck uses only canonical troop subtypes", () => {
  const deck = generateDevelopmentDeck("dragao", { rng: seededRng(41) });
  const troops = deck.filter((card) => card.kind === "tropa");
  assert.equal(troops.length, 14);
  assert.equal(troops.every((card) => DEVELOPMENT_TROOP_TYPES.includes(card.sub)), true);
});

test("war deck retains its compact twelve-card composition", () => {
  const deck = generateDevelopmentDeck("guerra", { rng: seededRng(42) });
  assert.equal(deck.length, 12);
  assert.equal(deck.filter((card) => card.kind === "marcha").length, 3);
  assert.equal(deck.filter((card) => card.kind === "espiao").length, 3);
  assert.equal(deck.filter((card) => card.kind === "monopolio").length, 2);
  assert.equal(deck.filter((card) => card.kind === "descoberta").length, 2);
  assert.equal(deck.filter((card) => card.kind === "estradas").length, 2);
});

test("player factory creates stable identity fields without storing the secret token", () => {
  const player = createPlayer("vlad", {
    sessionToken: "secret-never-stored",
    sessionTokenHash: TOKEN_HASHES.host,
    connected: false,
  }, { idFactory });
  assert.equal(player.playerId, "player_1");
  assert.equal(player.seatId, "seat_2");
  assert.equal(player.sessionTokenHash, TOKEN_HASHES.host);
  assert.equal(Object.prototype.hasOwnProperty.call(player, "sessionToken"), false);
  assert.equal(player.connected, false);
  assert.deepEqual(player.res, { madeira: 0, tijolo: 0, cavalos: 0, ouro: 0, obsidiana: 0 });
  assert.deepEqual(player.troops, { cavaleiro: 0, catapulta: 0, arqueiro: 0 });
});

test("initial game factory owns protocol versions and complete lobby state", () => {
  const game = createInitialGame({
    code: "abcd",
    hostCharacterId: "vlad",
    mode: "dragao",
    hostIdentity: { sessionTokenHash: TOKEN_HASHES.host },
    rng: seededRng(50),
    idFactory,
  });
  assert.equal(game.code, "ABCD");
  assert.equal(game.phase, "lobby");
  assert.equal(game.identityVersion, IDENTITY_PROTOCOL_VERSION);
  assert.equal(game.lobbyProtocolVersion, LOBBY_PROTOCOL_VERSION);
  assert.equal(game.gameProtocolVersion, GAME_PROTOCOL_VERSION);
  assert.equal(game.players.length, 1);
  assert.equal(game.board.hexes.length, 19);
  assert.equal(game.deck.length, 25);
  assert.deepEqual(game.turn, {
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
  });
});

test("initial war game creates war-only state without sharing mutable structures", () => {
  const first = createInitialGame({ code: "W001", hostCharacterId: "vlad", mode: "guerra", rng: seededRng(51), idFactory });
  const second = createInitialGame({ code: "W002", hostCharacterId: "maria", mode: "guerra", rng: seededRng(51), idFactory });
  assert.deepEqual(first.board, second.board);
  assert.notEqual(first.board, second.board);
  assert.deepEqual(first.gelo, { awake: false, active: false });
  assert.equal(first.troll.awake, false);
  first.players[0].res.ouro = 5;
  assert.equal(second.players[0].res.ouro, 0);
});

test("lobby-to-setup reducer creates a deterministic mirrored setup sequence", () => {
  const original = createInitialGame({ code: "S001", hostCharacterId: "vlad", rng: seededRng(60), idFactory });
  original.players.push(createPlayer("maria", { playerId: "p2", seatId: "s2" }, { idFactory }));
  original.players.push(createPlayer("romeo", { playerId: "p3", seatId: "s3" }, { idFactory }));
  original.lobbyStarting = { actionId: "start", startedAt: 1, introEndsAt: 2 };
  const result = reduceLobbyToSetup(original, { rng: seededRng(61) });
  assert.equal(result.game.phase, "setup");
  assert.equal(Object.prototype.hasOwnProperty.call(result.game, "lobbyStarting"), false);
  assert.equal(result.game.order.length, 3);
  assert.deepEqual(result.game.setup.seq, [...result.game.order, ...[...result.game.order].reverse()]);
  assert.equal(result.event.type, "GAME_SETUP_STARTED");
  assert.equal(original.phase, "lobby");
  assert.ok(original.lobbyStarting);
});

test("war setup regenerates the board for the actual player count and marks the troll lair", () => {
  const original = createInitialGame({ code: "S002", hostCharacterId: "vlad", mode: "guerra", rng: seededRng(70), idFactory });
  original.players.push(createPlayer("maria", { playerId: "p2", seatId: "s2" }, { idFactory }));
  original.players.push(createPlayer("romeo", { playerId: "p3", seatId: "s3" }, { idFactory }));
  const result = reduceLobbyToSetup(original, { rng: seededRng(71) });
  assert.equal(result.event.boardRegenerated, true);
  assert.equal(Object.keys(result.game.board.prov).length, 9);
  assert.equal(result.game.board.ports.length, 3);
  assert.ok(result.game.troll.lair);
  assert.equal(result.game.board.hexes.find((hex) => hex.k === result.game.troll.lair)?.lair, 1);
  assert.equal(original.troll.lair, null);
});

test("lobby-to-setup reducer rejects games outside the lobby", () => {
  assert.throws(() => reduceLobbyToSetup({ phase: "play", players: [{}] }), /lobby/);
});
