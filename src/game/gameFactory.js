import { LOBBY_PROTOCOL_VERSION } from "./lobbyProtocol.js";
import { GAME_PROTOCOL_VERSION } from "./gameProtocol.js";
import {
  IDENTITY_PROTOCOL_VERSION,
  createStableId,
  isSessionTokenHash,
} from "./playerIdentity.js";
import { createEmptyResources } from "./resources.js";
import {
  DEFAULT_GAME_MODE,
  isClassicMode,
  isExplorationMode,
  isWarMode,
  normalizeGameMode,
} from "./gameModes.js";
import { makeBoardGraph, ringCoords } from "./boardGeometry.js";
import { pickRandom, shuffleWithRng } from "./random.js";
import { APP_VERSION, SAVE_SCHEMA_VERSION } from "./saveSchema.js";
import { createInitialGamePresentationState } from "./presentationState.js";

export const VICTORY_POINT_ATTRIBUTES = Object.freeze([
  "🧠 Inteligência",
  "📜 Conhecimento",
  "✝️ Fé",
  "🍀 Sorte",
  "🦊 Astúcia",
]);

export const DEVELOPMENT_TROOP_TYPES = Object.freeze([
  "cavaleiro",
  "catapulta",
  "arqueiro",
]);

const STANDARD_TERRAIN_POOL = Object.freeze([
  "floresta", "floresta", "floresta", "floresta",
  "prados", "prados", "prados", "prados",
  "grutas", "grutas", "grutas", "grutas",
  "montanhas", "montanhas", "montanhas",
  "argila", "argila", "argila",
  "deserto",
]);

const STANDARD_NUMBER_TOKENS = Object.freeze([
  5, 2, 6, 3, 8, 10, 9, 12, 11, 4, 8, 10, 9, 4, 5, 6, 3, 11,
]);

const EXPLORATION_TERRAIN_POOL = Object.freeze([
  "floresta", "floresta", "floresta", "floresta",
  "prados", "prados", "prados", "prados",
  "grutas", "grutas", "grutas", "grutas",
  "montanhas", "montanhas", "montanhas", "montanhas",
  "argila", "argila", "argila", "argila", "argila",
  "deserto", "deserto", "deserto",
]);

const EXPLORATION_NUMBER_TOKENS = Object.freeze([
  2, 3, 3, 4, 4, 4, 5, 5, 5, 6, 6, 8, 8, 9, 9, 9, 10, 10, 11, 11, 12,
]);

const PORT_TYPES = Object.freeze([
  "any", "any", "any", "any", "madeira", "tijolo", "cavalos", "ouro", "obsidiana",
]);

function axialDistance(first, second) {
  const [q1, r1] = first.split(",").map(Number);
  const [q2, r2] = second.split(",").map(Number);
  const dq = q1 - q2;
  const dr = r1 - r2;
  return (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2;
}

function createStandardHexes(rng) {
  const spiral = [...ringCoords(2), ...ringCoords(1), [0, 0]];
  const pool = shuffleWithRng(STANDARD_TERRAIN_POOL, rng);
  let tokenIndex = 0;
  let dragon = null;
  const hexes = spiral.map(([q, r], index) => {
    const terr = pool[index];
    const k = `${q},${r}`;
    if (terr === "deserto") {
      dragon = k;
      return { k, terr, num: null };
    }
    return { k, terr, num: STANDARD_NUMBER_TOKENS[tokenIndex++] };
  });
  return { hexes, dragon, prov: null };
}

function createWarHexes(playerCount, rng) {
  const count = Math.max(2, Math.min(4, Number.isSafeInteger(playerCount) ? playerCount : 4));
  const rotate = ([q, r]) => [-r, q + r];
  let base = [[2, 0], [3, 0], [3, -1]];
  const wedges = [];
  for (let index = 0; index < 6; index += 1) {
    wedges.push(base);
    base = base.map(rotate);
  }
  const activeIndices = { 2: [0, 3], 3: [0, 2, 4], 4: [0, 1, 3, 4] }[count];
  const provinceHexes = activeIndices.map((wedgeIndex) => (
    wedges[wedgeIndex].map(([q, r]) => `${q},${r}`)
  ));
  const prov = {};
  provinceHexes.forEach((hexList, provinceIndex) => {
    hexList.forEach((key) => { prov[key] = provinceIndex; });
  });

  const flower = ["0,0", ...ringCoords(1).map(([q, r]) => `${q},${r}`)];
  const numberByHex = { "0,0": pickRandom([6, 8], rng) };
  const petals = shuffleWithRng([4, 10, 4, 10, 4, 10], rng);
  ringCoords(1).forEach(([q, r], index) => {
    numberByHex[`${q},${r}`] = petals[index];
  });
  provinceHexes.forEach((hexList) => {
    const basket = shuffleWithRng([
      pickRandom([5, 9], rng),
      pickRandom([4, 10], rng),
      pickRandom([3, 11], rng),
    ], rng);
    hexList.forEach((key, index) => { numberByHex[key] = basket[index]; });
  });

  const fertile = new Set([...flower, ...provinceHexes.flat()]);
  const terrainBase = shuffleWithRng(["floresta", "prados", "grutas", "montanhas", "argila"], rng);
  const terrainPool = [];
  while (terrainPool.length < fertile.size) {
    terrainPool.push(terrainBase[terrainPool.length % terrainBase.length]);
  }
  const shuffledTerrain = shuffleWithRng(terrainPool, rng);
  let terrainIndex = 0;
  const coordinates = [[0, 0], ...ringCoords(1), ...ringCoords(2), ...ringCoords(3)];
  const hexes = coordinates.map(([q, r]) => {
    const k = `${q},${r}`;
    if (fertile.has(k)) {
      return { k, terr: shuffledTerrain[terrainIndex++], num: numberByHex[k] };
    }
    return { k, terr: "deserto", num: null };
  });

  const rim = ringCoords(3)
    .map(([q, r]) => `${q},${r}`)
    .filter((key) => !fertile.has(key));
  const dragon = pickRandom(rim, rng);
  let iceKey = null;
  let greatestDistance = -1;
  rim.filter((key) => key !== dragon).forEach((key) => {
    const distance = axialDistance(key, dragon);
    if (distance > greatestDistance) {
      greatestDistance = distance;
      iceKey = key;
    }
  });
  const iceHex = hexes.find((hex) => hex.k === iceKey);
  if (iceHex) iceHex.terr = "gelo";

  return { hexes, dragon, prov };
}

function appendExplorationRing(base, rng) {
  const hexes = base.hexes.map((hex) => ({ ...hex }));
  ringCoords(3).forEach(([q, r]) => {
    hexes.push({ k: `${q},${r}`, terr: "deserto", num: null });
  });
  const terrainPool = shuffleWithRng(EXPLORATION_TERRAIN_POOL, rng);
  const tokens = shuffleWithRng(EXPLORATION_NUMBER_TOKENS, rng);
  let tokenIndex = 0;
  ringCoords(4).forEach(([q, r], index) => {
    const terr = terrainPool[index];
    hexes.push({
      k: `${q},${r}`,
      terr,
      num: terr === "deserto" ? null : tokens[tokenIndex++],
      hid: true,
    });
  });
  return { ...base, hexes };
}

function boundaryEdges(graph) {
  return Object.entries(graph.edges)
    .filter(([, edge]) => edge.hexes.length === 1)
    .map(([key, edge]) => {
      const first = graph.verts[edge.a];
      const second = graph.verts[edge.b];
      return {
        key,
        angle: Math.atan2((first.y + second.y) / 2, (first.x + second.x) / 2),
      };
    })
    .sort((first, second) => first.angle - second.angle);
}

function createPorts(mode, board, rng) {
  const graph = makeBoardGraph(board.hexes);
  if (isWarMode(mode)) {
    const provinceEdges = {};
    Object.entries(graph.edges).forEach(([key, edge]) => {
      const province = edge.hexes.length === 1 ? board.prov?.[edge.hexes[0]] : null;
      if (province == null) return;
      (provinceEdges[province] ||= []).push(key);
    });
    return Object.keys(provinceEdges).sort().map((province) => {
      const edges = provinceEdges[province];
      return { e: edges[Math.floor(edges.length / 2)], type: "any", hid: false };
    });
  }

  const boundary = boundaryEdges(graph);
  const types = shuffleWithRng(PORT_TYPES, rng);
  return types.map((type, index) => ({
    e: boundary[Math.floor(index * boundary.length / PORT_TYPES.length)].key,
    type,
    hid: isExplorationMode(mode),
  }));
}

export function generateBoard(mode = DEFAULT_GAME_MODE, playerCount = 4, { rng = Math.random } = {}) {
  const normalizedMode = normalizeGameMode(mode);
  let board = isWarMode(normalizedMode)
    ? createWarHexes(playerCount, rng)
    : createStandardHexes(rng);
  if (isExplorationMode(normalizedMode)) board = appendExplorationRing(board, rng);
  return {
    hexes: board.hexes,
    dragon: board.dragon,
    ports: createPorts(normalizedMode, board, rng),
    prov: board.prov || null,
  };
}

export function generateDevelopmentDeck(mode = DEFAULT_GAME_MODE, { rng = Math.random } = {}) {
  const normalizedMode = normalizeGameMode(mode);
  const deck = [];
  if (isWarMode(normalizedMode)) {
    for (let index = 0; index < 3; index += 1) deck.push({ kind: "marcha" });
    for (let index = 0; index < 3; index += 1) deck.push({ kind: "espiao" });
    deck.push({ kind: "monopolio" }, { kind: "monopolio" });
    deck.push({ kind: "descoberta" }, { kind: "descoberta" });
    deck.push({ kind: "estradas" }, { kind: "estradas" });
  } else {
    const attributes = shuffleWithRng(VICTORY_POINT_ATTRIBUTES, rng);
    for (let index = 0; index < 14; index += 1) {
      deck.push({
        kind: "tropa",
        sub: isClassicMode(normalizedMode)
          ? "cavaleiro"
          : pickRandom(DEVELOPMENT_TROOP_TYPES, rng),
      });
    }
    for (let index = 0; index < 5; index += 1) deck.push({ kind: "vp", sub: attributes[index] });
    deck.push({ kind: "monopolio" }, { kind: "monopolio" });
    deck.push({ kind: "descoberta" }, { kind: "descoberta" });
    deck.push({ kind: "estradas" }, { kind: "estradas" });
  }
  return shuffleWithRng(deck, rng).map((card, index) => ({ ...card, id: index }));
}

export function createInitialTurnState() {
  return {
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
  };
}

export function createPlayer(characterId = null, identity = {}, { idFactory = createStableId } = {}) {
  if (characterId != null && (typeof characterId !== "string" || !characterId)) throw new TypeError("A personagem do jogador é inválida.");
  if (identity.characterConfirmed === true && !characterId) throw new TypeError("Uma personagem confirmada é obrigatória.");
  if (typeof idFactory !== "function") throw new TypeError("O gerador de identificadores é inválido.");
  return {
    playerId: identity.playerId || idFactory("player"),
    seatId: identity.seatId || idFactory("seat"),
    sessionTokenHash: isSessionTokenHash(identity.sessionTokenHash) ? identity.sessionTokenHash : null,
    characterConfirmed: identity.characterConfirmed === true,
    connected: identity.connected !== false,
    disconnectedAt: null,
    reconnectDeadline: null,
    turnReconnectDeadline: null,
    controller: "human",
    controlStatus: "active",
    afkSkipCount: 0,
    lastAfkSkipAt: null,
    botActivatedAt: null,
    humanReconnectPending: false,
    botActionInProgress: false,
    capV: null,
    ch: characterId ?? null,
    res: createEmptyResources(),
    devNew: [],
    devOld: [],
    troops: { cavaleiro: 0, catapulta: 0, arqueiro: 0 },
    sick: 0,
    portOff: [],
    immune: false,
    freeRoads: 0,
    ready: false,
  };
}

export function createInitialGame({
  code,
  hostCharacterId,
  mode = DEFAULT_GAME_MODE,
  hostIdentity = {},
  rng = Math.random,
  idFactory = createStableId,
} = {}) {
  if (typeof code !== "string" || !code.trim()) throw new TypeError("O código do reino é obrigatório.");
  const normalizedMode = normalizeGameMode(mode);
  return {
    v: 1,
    saveSchemaVersion: SAVE_SCHEMA_VERSION,
    appVersion: APP_VERSION,
    identityVersion: IDENTITY_PROTOCOL_VERSION,
    lobbyProtocolVersion: LOBBY_PROTOCOL_VERSION,
    gameProtocolVersion: GAME_PROTOCOL_VERSION,
    code: code.trim().toUpperCase(),
    phase: "lobby",
    mode: normalizedMode,
    board: generateBoard(normalizedMode, 4, { rng }),
    deck: generateDevelopmentDeck(normalizedMode, { rng }),
    players: [createPlayer(hostCharacterId, hostIdentity, { idFactory })],
    builds: {},
    roads: {},
    units: {},
    occ: {},
    wagons: {},
    wseq: 0,
    wbuilt: {},
    order: [],
    setup: null,
    turn: createInitialTurnState(),
    queue: [],
    trade: null,
    presentation: createInitialGamePresentationState(),
    lr: null,
    la: null,
    round: 1,
    gelo: isWarMode(normalizedMode) ? { awake: false, active: false } : null,
    troll: isWarMode(normalizedMode)
      ? { awake: false, turns: 0, rush: 0, lair: null, giant: null, dmg: {}, defeated: false, warned: false }
      : null,
    glory: {},
    perksOn: true,
    winner: null,
  };
}
