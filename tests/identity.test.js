import test from "node:test";
import assert from "node:assert/strict";
import {
  IDENTITY_PROTOCOL_VERSION,
  createSessionToken,
  createStableId,
  ensureGamePlayerIdentities,
  findPlayerIndexById,
  hashSessionToken,
  isSessionTokenHash,
} from "../src/game/playerIdentity.js";
import { forgetPlayerSession, loadPlayerSession, savePlayerSession } from "../src/multiplayer/sessionStore.js";
import { IDS, MemorySessionStorage } from "./fixtures.js";

test("stable IDs and session tokens have the expected entropy-shaped format", () => {
  const playerId = createStableId("player");
  const seatId = createStableId("seat");
  const token = createSessionToken();
  assert.match(playerId, /^player_[a-f0-9]{24}$/);
  assert.match(seatId, /^seat_[a-f0-9]{24}$/);
  assert.match(token, /^[a-f0-9]{64}$/);
  assert.notEqual(createStableId("player"), playerId);
});

test("session tokens are hashed with SHA-256 and validated", async () => {
  const token = "ab".repeat(32);
  const hash = await hashSessionToken(token);
  assert.match(hash, /^[a-f0-9]{64}$/);
  assert.equal(isSessionTokenHash(hash), true);
  assert.equal(isSessionTokenHash(token), true); // formato idêntico; o segredo nunca deve ir no estado
  await assert.rejects(() => hashSessionToken("curto"), /inválido/i);
});

test("legacy and duplicate player identities are normalized", () => {
  const duplicatePlayer = IDS.host;
  const duplicateSeat = IDS.seatHost;
  const game = {
    players: [
      { playerId: duplicatePlayer, seatId: duplicateSeat },
      { playerId: duplicatePlayer, seatId: duplicateSeat },
      {},
    ],
  };
  ensureGamePlayerIdentities(game);
  assert.equal(game.identityVersion, IDENTITY_PROTOCOL_VERSION);
  assert.equal(new Set(game.players.map((player) => player.playerId)).size, 3);
  assert.equal(new Set(game.players.map((player) => player.seatId)).size, 3);
  assert.equal(findPlayerIndexById(game, game.players[1].playerId), 1);
});

test("sessions are isolated by room code inside the current tab", () => {
  const previous = globalThis.sessionStorage;
  globalThis.sessionStorage = new MemorySessionStorage();
  try {
    const session = {
      playerId: IDS.host,
      seatId: IDS.seatHost,
      sessionToken: "1".repeat(64),
    };
    savePlayerSession(" abcd ", session);
    assert.deepEqual(loadPlayerSession("ABCD"), session);
    assert.equal(loadPlayerSession("WXYZ"), null);
    forgetPlayerSession("abcd");
    assert.equal(loadPlayerSession("ABCD"), null);
  } finally {
    globalThis.sessionStorage = previous;
  }
});

test("invalid stored sessions are ignored", () => {
  const previous = globalThis.sessionStorage;
  const storage = new MemorySessionStorage();
  globalThis.sessionStorage = storage;
  try {
    storage.setItem("reinos_dragao_player_sessions_v1", JSON.stringify({
      ABCD: { playerId: "player_bad", seatId: IDS.seatHost, sessionToken: "2".repeat(64) },
    }));
    assert.equal(loadPlayerSession("ABCD"), null);
  } finally {
    globalThis.sessionStorage = previous;
  }
});
