export const IDS = Object.freeze({
  host: "player_111111111111111111111111",
  guest1: "player_222222222222222222222222",
  guest2: "player_333333333333333333333333",
  guest3: "player_444444444444444444444444",
  seatHost: "seat_111111111111111111111111",
  seat1: "seat_222222222222222222222222",
  seat2: "seat_333333333333333333333333",
  seat3: "seat_444444444444444444444444",
});

export const TOKEN_HASHES = Object.freeze({
  host: "a".repeat(64),
  guest1: "b".repeat(64),
  guest2: "c".repeat(64),
  guest3: "d".repeat(64),
});

export function makePlayer({
  playerId = IDS.host,
  seatId = IDS.seatHost,
  ch = "vlad",
  ready = true,
  connected = true,
  characterConfirmed = true,
  sessionTokenHash = TOKEN_HASHES.host,
  res = { madeira: 1, tijolo: 2, cavalos: 3, ouro: 4, obsidiana: 5 },
  devNew = [{ id: "new-1", kind: "monopolio" }],
  devOld = [{ id: "old-1", kind: "espiao" }],
} = {}) {
  return {
    playerId,
    seatId,
    ch,
    ready,
    connected,
    characterConfirmed,
    sessionTokenHash,
    res: structuredClone(res),
    devNew: structuredClone(devNew),
    devOld: structuredClone(devOld),
  };
}

export function makeLobby(overrides = {}) {
  const players = overrides.players || [
    makePlayer(),
    makePlayer({ playerId: IDS.guest1, seatId: IDS.seat1, ch: "rhaegal", sessionTokenHash: TOKEN_HASHES.guest1 }),
    makePlayer({ playerId: IDS.guest2, seatId: IDS.seat2, ch: "smaug", sessionTokenHash: TOKEN_HASHES.guest2 }),
    makePlayer({ playerId: IDS.guest3, seatId: IDS.seat3, ch: "drogon", sessionTokenHash: TOKEN_HASHES.guest3 }),
  ];
  return {
    code: "ABCD",
    phase: "lobby",
    mode: "dragao",
    v: 7,
    perksOn: true,
    players,
    ...structuredClone(overrides),
    players: structuredClone(players),
  };
}

export function makeGame(overrides = {}) {
  const players = overrides.players || [
    makePlayer(),
    makePlayer({ playerId: IDS.guest1, seatId: IDS.seat1, ch: "rhaegal", sessionTokenHash: TOKEN_HASHES.guest1 }),
  ];
  return {
    code: "ABCD",
    phase: "play",
    v: 12,
    players,
    deck: [
      { id: "deck-1", kind: "monopolio" },
      { id: "deck-2", kind: "espiao" },
    ],
    board: {
      hexes: [
        { k: "0,0", terr: "floresta", num: 8, hid: false },
        { k: "1,0", terr: "montanha", num: 6, hid: true },
      ],
      ports: [
        { e: "a|b", type: "madeira", hid: false },
        { e: "b|c", type: "ouro", hid: true },
      ],
    },
    troll: { lair: "1,0" },
    ...structuredClone(overrides),
    players: structuredClone(players),
  };
}

export class MemorySessionStorage {
  #values = new Map();
  getItem(key) { return this.#values.has(key) ? this.#values.get(key) : null; }
  setItem(key, value) { this.#values.set(String(key), String(value)); }
  removeItem(key) { this.#values.delete(String(key)); }
  clear() { this.#values.clear(); }
}
