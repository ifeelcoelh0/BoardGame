import test from "node:test";
import assert from "node:assert/strict";
import {
  LEGACY_ROOM_CODE_LENGTH,
  ROOM_CODE_ALPHABET,
  ROOM_CODE_LENGTH,
  generateRoomCode,
  isCurrentRoomCode,
  isValidRoomCode,
  normalizeRoomCode,
} from "../src/game/roomCode.js";

test("new room codes use six characters from the unambiguous alphabet", () => {
  assert.equal(ROOM_CODE_LENGTH, 6);
  assert.equal(ROOM_CODE_ALPHABET.length, 23);
  assert.equal(generateRoomCode({ rng: () => 0 }), "AAAAAA");
  assert.equal(generateRoomCode({ rng: () => 0.999999 }), "ZZZZZZ");
  assert.equal(isCurrentRoomCode("ABCDEF"), true);
});


test("default room-code generation uses the current six-letter contract", () => {
  const code = generateRoomCode();
  assert.equal(code.length, ROOM_CODE_LENGTH);
  assert.equal(isCurrentRoomCode(code), true);
});

test("four-character legacy realms remain valid during the migration", () => {
  assert.equal(LEGACY_ROOM_CODE_LENGTH, 4);
  assert.equal(isValidRoomCode("ABCD"), true);
  assert.equal(isCurrentRoomCode("ABCD"), false);
});

test("room codes are normalized and reject ambiguous or malformed characters", () => {
  assert.equal(normalizeRoomCode("  abcdef  "), "ABCDEF");
  assert.equal(isValidRoomCode("ABC OEF"), false);
  assert.equal(isValidRoomCode("ABCDEO"), false);
  assert.equal(isValidRoomCode("ABCDE"), false);
  assert.equal(isValidRoomCode("ABCDEFG"), false);
});

test("room code generation rejects invalid RNG samples", () => {
  assert.throws(() => generateRoomCode({ rng: () => 1 }), /entre 0/);
  assert.throws(() => generateRoomCode({ rng: () => -0.1 }), /entre 0/);
});
