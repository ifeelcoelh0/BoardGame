import test from "node:test";
import assert from "node:assert/strict";
import { GAME_ACTION, GAME_PROTOCOL_VERSION, validateGameActionEnvelope } from "../src/game/gameProtocol.js";
import { LOBBY_ACTION, LOBBY_PROTOCOL_VERSION, validateLobbyActionEnvelope } from "../src/game/lobbyProtocol.js";

const validGameEnvelope = () => ({
  t: "game-action",
  gameProtocolVersion: GAME_PROTOCOL_VERSION,
  actionId: `game_${"a".repeat(24)}`,
  expectedRevision: 3,
  action: { type: GAME_ACTION.ROLL_DICE },
});

const validLobbyEnvelope = () => ({
  t: "lobby-action",
  lobbyProtocolVersion: LOBBY_PROTOCOL_VERSION,
  actionId: `action_${"b".repeat(24)}`,
  expectedRevision: 3,
  action: { type: LOBBY_ACTION.SET_READY, ready: true },
});

test("game protocol accepts a valid action envelope", () => {
  assert.deepEqual(validateGameActionEnvelope(validGameEnvelope()), { ok: true, reason: null });
});

test("game protocol rejects old clients", () => {
  const message = validGameEnvelope();
  message.gameProtocolVersion -= 1;
  assert.equal(validateGameActionEnvelope(message).reason, "PROTOCOL_MISMATCH");
});

test("game protocol rejects malformed IDs, revisions and unknown actions", () => {
  const badId = validGameEnvelope(); badId.actionId = "game_short";
  assert.equal(validateGameActionEnvelope(badId).reason, "INVALID_ACTION_ID");
  const badRevision = validGameEnvelope(); badRevision.expectedRevision = -1;
  assert.equal(validateGameActionEnvelope(badRevision).reason, "INVALID_REVISION");
  const badAction = validGameEnvelope(); badAction.action.type = "REWRITE_EVERYTHING";
  assert.equal(validateGameActionEnvelope(badAction).reason, "UNKNOWN_ACTION");
});

test("game protocol rejects oversized requests", () => {
  const message = validGameEnvelope();
  message.action.payload = "x".repeat(5000);
  assert.equal(validateGameActionEnvelope(message).reason, "REQUEST_TOO_LARGE");
});

test("lobby protocol accepts a valid action envelope", () => {
  assert.deepEqual(validateLobbyActionEnvelope(validLobbyEnvelope()), { ok: true, reason: null });
});

test("lobby protocol rejects incorrect transport and protocol versions", () => {
  const badType = validLobbyEnvelope(); badType.t = "state";
  assert.equal(validateLobbyActionEnvelope(badType).reason, "INVALID_REQUEST");
  const badVersion = validLobbyEnvelope(); badVersion.lobbyProtocolVersion += 1;
  assert.equal(validateLobbyActionEnvelope(badVersion).reason, "PROTOCOL_MISMATCH");
});

test("lobby protocol rejects malformed actions and oversized requests", () => {
  const badAction = validLobbyEnvelope(); badAction.action.type = "DELETE_HOST";
  assert.equal(validateLobbyActionEnvelope(badAction).reason, "UNKNOWN_ACTION");
  const tooLarge = validLobbyEnvelope(); tooLarge.action.payload = "x".repeat(3000);
  assert.equal(validateLobbyActionEnvelope(tooLarge).reason, "REQUEST_TOO_LARGE");
});
