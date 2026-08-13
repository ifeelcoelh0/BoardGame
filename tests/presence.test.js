import test from "node:test";
import assert from "node:assert/strict";
import {
  GAME_BOT_TAKEOVER_GRACE_MS,
  PLAYER_CONTROL_STATUS,
  activateBotController,
  beginGameTurnReconnectWindow,
  gameAfkGraceMs,
  gameTurnReconnectSeconds,
  isGameTurnReconnectExpired,
  isLobbyReservationExpired,
  lobbyReconnectSeconds,
  markPlayerConnected,
  markPlayerDisconnected,
  restoreHumanController,
} from "../src/game/playerPresence.js";

test("lobby disconnect clears ready and reserves the seat for 30 seconds", () => {
  const player = { connected: true, ready: true };
  markPlayerDisconnected(player, { now: 1000, phase: "lobby", graceMs: 30_000 });
  assert.equal(player.connected, false);
  assert.equal(player.ready, false);
  assert.equal(player.reconnectDeadline, 31_000);
  assert.equal(lobbyReconnectSeconds(player, 16_000), 15);
  assert.equal(isLobbyReservationExpired(player, 30_999), false);
  assert.equal(isLobbyReservationExpired(player, 31_000), true);
});

test("game disconnect keeps the human seat and waits until an action is required", () => {
  const player = { connected: true, ready: true };
  markPlayerDisconnected(player, { now: 1000, phase: "play" });
  assert.equal(player.connected, false);
  assert.equal(player.reconnectDeadline, null);
  assert.equal(player.turnReconnectDeadline, null);
  assert.equal(player.controlStatus, PLAYER_CONTROL_STATUS.DISCONNECTED);
});

test("a required disconnected human gets a 90 second bot-takeover window", () => {
  const player = { connected: false, afkSkipCount: 3 };
  assert.equal(gameAfkGraceMs(player), GAME_BOT_TAKEOVER_GRACE_MS);
  beginGameTurnReconnectWindow(player, { now: 1000 });
  assert.equal(player.turnReconnectDeadline, 91_000);
  assert.equal(gameTurnReconnectSeconds(player, 61_000), 30);
  assert.equal(isGameTurnReconnectExpired(player, 91_000), true);
});

test("reconnection restores normal presence before bot takeover", () => {
  const player = {
    connected: false,
    afkSkipCount: 3,
    lastAfkSkipAt: 100,
    turnReconnectDeadline: 1000,
  };
  markPlayerConnected(player);
  assert.equal(player.connected, true);
  assert.equal(player.afkSkipCount, 0);
  assert.equal(player.lastAfkSkipAt, null);
  assert.equal(player.turnReconnectDeadline, null);
  assert.equal(player.controlStatus, PLAYER_CONTROL_STATUS.ACTIVE);
});

test("a reclaimed bot seat returns cleanly to human control", () => {
  const player = { connected: false, ready: true };
  activateBotController(player, { now: 100 });
  assert.equal(player.controller, "bot");
  assert.equal(player.botActivatedAt, 100);
  restoreHumanController(player);
  markPlayerConnected(player);
  assert.equal(player.controller, "human");
  assert.equal(player.botActivatedAt, null);
  assert.equal(player.connected, true);
});

test("bots stay connected when presence code receives a disconnect signal", () => {
  const player = { connected: true, ready: true };
  activateBotController(player, { now: 100 });
  markPlayerDisconnected(player, { now: 1000, phase: "lobby", graceMs: 30_000 });
  assert.equal(player.controller, "bot");
  assert.equal(player.connected, true);
  assert.equal(player.ready, true);
  assert.equal(player.reconnectDeadline, null);
});
