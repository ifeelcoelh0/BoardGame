import { ensurePlayerPresence } from "./playerPresence.js";

export const IDENTITY_PROTOCOL_VERSION = 11;

const HEX = "0123456789abcdef";

function randomBytes(length) {
    const bytes = new Uint8Array(length);
    const cryptoApi = globalThis.crypto;
    if (cryptoApi && typeof cryptoApi.getRandomValues === "function") {
        cryptoApi.getRandomValues(bytes);
        return bytes;
    }
    // Fallback apenas para ambientes antigos sem Web Crypto. A aplicação moderna
    // usa crypto.getRandomValues; este ramo mantém o jogo executável em dev/testes.
    for (let i = 0; i < bytes.length; i++)
        bytes[i] = Math.floor(Math.random() * 256);
    return bytes;
}

function bytesToHex(bytes) {
    let out = "";
    for (const byte of bytes)
        out += HEX[byte >> 4] + HEX[byte & 15];
    return out;
}

export function createStableId(prefix) {
    return `${prefix}_${bytesToHex(randomBytes(12))}`;
}

export function createSessionToken() {
    return bytesToHex(randomBytes(32));
}

export async function hashSessionToken(token) {
    if (typeof token !== "string" || token.length < 32)
        throw new Error("Token de sessão inválido.");
    const cryptoApi = globalThis.crypto;
    if (!cryptoApi?.subtle)
        throw new Error("Web Crypto não está disponível neste navegador.");
    const digest = await cryptoApi.subtle.digest("SHA-256", new TextEncoder().encode(token));
    return bytesToHex(new Uint8Array(digest));
}

export function isSessionTokenHash(value) {
    return typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
}

export function ensurePlayerIdentity(player) {
    if (!player || typeof player !== "object")
        return player;
    if (typeof player.playerId !== "string" || !/^player_[a-f0-9]{24}$/.test(player.playerId))
        player.playerId = createStableId("player");
    if (typeof player.seatId !== "string" || !/^seat_[a-f0-9]{24}$/.test(player.seatId))
        player.seatId = createStableId("seat");
    if (!isSessionTokenHash(player.sessionTokenHash))
        player.sessionTokenHash = null;
    if (typeof player.characterConfirmed !== "boolean")
        player.characterConfirmed = true;
    ensurePlayerPresence(player);
    return player;
}

export function ensureGamePlayerIdentities(game) {
    if (!game || !Array.isArray(game.players))
        return game;
    game.identityVersion = IDENTITY_PROTOCOL_VERSION;
    const playerIds = new Set();
    const seatIds = new Set();
    for (const player of game.players) {
        ensurePlayerIdentity(player);
        while (playerIds.has(player.playerId))
            player.playerId = createStableId("player");
        while (seatIds.has(player.seatId))
            player.seatId = createStableId("seat");
        playerIds.add(player.playerId);
        seatIds.add(player.seatId);
    }
    return game;
}

export function findPlayerIndexById(game, playerId) {
    if (!game || !Array.isArray(game.players) || typeof playerId !== "string")
        return -1;
    return game.players.findIndex((player) => player.playerId === playerId);
}

