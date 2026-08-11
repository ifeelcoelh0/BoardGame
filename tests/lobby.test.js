import test from "node:test";
import assert from "node:assert/strict";
import { applyLobbyAction, LOBBY_ACTION } from "../src/game/lobbyProtocol.js";
import { getLobbyRequiredPlayers, getLobbyStartStatus } from "../src/game/lobbyRules.js";
import { IDS, makeLobby } from "./fixtures.js";

const characterIds = new Set(["vlad", "rhaegal", "smaug", "drogon", "viseryon"]);

test("only a complete, connected and ready lobby can start", () => {
  const game = makeLobby();
  assert.deepEqual(getLobbyStartStatus(game, 0), { allowed: true, reason: null });
  assert.equal(getLobbyStartStatus(game, 1).reason, "NOT_HOST");
  game.players[1].connected = false;
  assert.equal(getLobbyStartStatus(game, 0).reason, "PLAYERS_DISCONNECTED");
  game.players[1].connected = true;
  game.players[2].ready = false;
  assert.equal(getLobbyStartStatus(game, 0).reason, "PLAYERS_NOT_READY");
  game.players[2].ready = true;
  game.players.pop();
  assert.deepEqual(getLobbyStartStatus(game, 0), { allowed: true, reason: null });
  game.players.pop();
  assert.equal(getLobbyStartStatus(game, 0).reason, "NOT_ENOUGH_PLAYERS");
});


test("normal realms can start with three players and test realms with two", () => {
  const normal = makeLobby();
  normal.players = normal.players.slice(0, 3);
  assert.equal(getLobbyRequiredPlayers(normal), 3);
  assert.deepEqual(getLobbyStartStatus(normal, 0), { allowed: true, reason: null });

  normal.players = normal.players.slice(0, 2);
  assert.equal(getLobbyStartStatus(normal, 0).reason, "NOT_ENOUGH_PLAYERS");

  const testRealm = makeLobby();
  testRealm.test = true;
  testRealm.players = testRealm.players.slice(0, 2);
  assert.equal(getLobbyRequiredPlayers(testRealm), 2);
  assert.deepEqual(getLobbyStartStatus(testRealm, 0), { allowed: true, reason: null });

  testRealm.players = testRealm.players.slice(0, 1);
  const tooSmall = getLobbyStartStatus(testRealm, 0);
  assert.equal(tooSmall.reason, "NOT_ENOUGH_PLAYERS");
  assert.equal(tooSmall.requiredPlayers, 2);
});


test("a pending player can confirm their first character without a provisional house", () => {
  const game = makeLobby();
  game.players[1].ch = null;
  game.players[1].characterConfirmed = false;
  game.players[1].ready = false;
  const result = applyLobbyAction(game, IDS.guest1, {
    type: LOBBY_ACTION.SELECT_CHARACTER,
    characterId: "viseryon",
  }, { validCharacterIds: characterIds });
  assert.equal(result.ok, true);
  assert.equal(result.game.players[1].ch, "viseryon");
  assert.equal(result.game.players[1].characterConfirmed, true);
  assert.equal(result.event.oldCharacterId, null);
});
test("selecting a character is unique and clears ready", () => {
  const game = makeLobby();
  const result = applyLobbyAction(game, IDS.guest1, {
    type: LOBBY_ACTION.SELECT_CHARACTER,
    characterId: "viseryon",
  }, { validCharacterIds: characterIds });
  assert.equal(result.ok, true);
  assert.equal(result.game.players[1].ch, "viseryon");
  assert.equal(result.game.players[1].characterConfirmed, true);
  assert.equal(result.game.players[1].ready, false);
  assert.equal(game.players[1].ch, "rhaegal", "a regra não deve mutar o estado original");

  const unavailable = applyLobbyAction(game, IDS.guest1, {
    type: LOBBY_ACTION.SELECT_CHARACTER,
    characterId: "smaug",
  }, { validCharacterIds: characterIds });
  assert.equal(unavailable.reason, "CHARACTER_UNAVAILABLE");
});

test("ready requires connection and a confirmed character", () => {
  const game = makeLobby();
  game.players[1].ready = false;
  game.players[1].characterConfirmed = false;
  assert.equal(applyLobbyAction(game, IDS.guest1, { type: LOBBY_ACTION.SET_READY, ready: true }).reason, "CHARACTER_NOT_CONFIRMED");
  game.players[1].characterConfirmed = true;
  game.players[1].connected = false;
  assert.equal(applyLobbyAction(game, IDS.guest1, { type: LOBBY_ACTION.SET_READY, ready: true }).reason, "PLAYER_DISCONNECTED");
});

test("only the host can change perks and doing so clears all ready flags", () => {
  const game = makeLobby();
  assert.equal(applyLobbyAction(game, IDS.guest1, { type: LOBBY_ACTION.SET_PERKS, enabled: false }).reason, "NOT_HOST");
  const result = applyLobbyAction(game, IDS.host, { type: LOBBY_ACTION.SET_PERKS, enabled: false });
  assert.equal(result.ok, true);
  assert.equal(result.game.perksOn, false);
  assert.equal(result.game.players.every((player) => player.ready === false), true);
});

test("kick removes a guest, resets readiness and cannot remove the host", () => {
  const game = makeLobby();
  const kicked = applyLobbyAction(game, IDS.host, {
    type: LOBBY_ACTION.KICK_PLAYER,
    targetPlayerId: IDS.guest2,
  });
  assert.equal(kicked.ok, true);
  assert.equal(kicked.game.players.some((player) => player.playerId === IDS.guest2), false);
  assert.equal(kicked.game.players.every((player) => player.ready === false), true);
  assert.equal(kicked.event.type, "PLAYER_KICKED");

  const hostKick = applyLobbyAction(game, IDS.host, {
    type: LOBBY_ACTION.KICK_PLAYER,
    targetPlayerId: IDS.host,
  });
  assert.equal(hostKick.reason, "CANNOT_KICK_HOST");
});

test("begin start records an authoritative time window", () => {
  const game = makeLobby();
  const result = applyLobbyAction(game, IDS.host, { type: LOBBY_ACTION.BEGIN_START }, {
    now: 1000,
    introDurationMs: 1850,
    actionId: "action-test",
  });
  assert.equal(result.ok, true);
  assert.deepEqual(result.game.lobbyStarting, {
    actionId: "action-test",
    startedAt: 1000,
    introEndsAt: 2850,
  });
});
