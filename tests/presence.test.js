import test from "node:test";
import assert from "node:assert/strict";
import {
  GAME_FIRST_AFK_GRACE_MS,
  GAME_REPEAT_AFK_GRACE_MS,
  PLAYER_CONTROL_STATUS,
  beginGameTurnReconnectWindow,
  gameAfkGraceMs,
  gameTurnReconnectSeconds,
  isGameTurnReconnectExpired,
  isLobbyReservationExpired,
  lobbyReconnectSeconds,
  markAfkActionSkipped,
  markPlayerConnected,
  markPlayerDisconnected,
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

test("game disconnect keeps the player and waits until an action is required", () => {
  const player = { connected: true, ready: true };
  markPlayerDisconnected(player, { now: 1000, phase: "play" });
  assert.equal(player.connected, false);
  assert.equal(player.reconnectDeadline, null);
  assert.equal(player.turnReconnectDeadline, null);
  assert.equal(player.controlStatus, PLAYER_CONTROL_STATUS.DISCONNECTED);
});

test("first AFK block waits 90 seconds and later blocks wait 30 seconds", () => {
  const player = { connected: false, afkSkipCount: 0 };
  assert.equal(gameAfkGraceMs(player), GAME_FIRST_AFK_GRACE_MS);
  beginGameTurnReconnectWindow(player, { now: 1000 });
  assert.equal(player.turnReconnectDeadline, 91_000);
  assert.equal(gameTurnReconnectSeconds(player, 61_000), 30);
  assert.equal(isGameTurnReconnectExpired(player, 91_000), true);

  markAfkActionSkipped(player, { now: 91_000 });
  assert.equal(player.afkSkipCount, 1);
  assert.equal(gameAfkGraceMs(player), GAME_REPEAT_AFK_GRACE_MS);
  beginGameTurnReconnectWindow(player, { now: 100_000 });
  assert.equal(player.turnReconnectDeadline, 130_000);
});

test("reconnection resets the AFK escalation", () => {
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
