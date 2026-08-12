const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { readRuntimeSource, runtimeSourcePaths } = require("./lib/runtime-source.cjs");

const root = path.resolve(__dirname, "..");
const identityPath = path.join(root, "src/game/playerIdentity.js");
const sessionStorePath = path.join(root, "src/multiplayer/sessionStore.js");
const runtimeSource = readRuntimeSource(root);
const factoryPath = path.join(root, "src/game/gameFactory.js");
const factory = fs.readFileSync(factoryPath, "utf8");
const hostRuntime = fs.readFileSync(path.join(root, "src/multiplayer/hostRuntime.js"), "utf8");
const clientRuntime = fs.readFileSync(path.join(root, "src/multiplayer/clientRuntime.js"), "utf8");
const hostSessionController = fs.readFileSync(path.join(root, "src/multiplayer/hostSessionPresenceController.js"), "utf8");
const socialController = fs.readFileSync(path.join(root, "src/multiplayer/socialEventController.js"), "utf8");

const errors = [];
const normalizeEol = (value) => String(value ?? "").replace(/\r\n?/g, "\n");
const requireText = (text, label, source = runtimeSource) => {
    if (!normalizeEol(source).includes(normalizeEol(text)))
        errors.push(`Falta: ${label}`);
};
const requirePattern = (pattern, label, source = runtimeSource) => {
    if (!pattern.test(normalizeEol(source)))
        errors.push(`Falta: ${label}`);
};
const rejectText = (text, label) => {
    if (runtimeSource.includes(text))
        errors.push(`Ainda existe: ${label}`);
};

if (!fs.existsSync(identityPath))
    errors.push("Falta src/game/playerIdentity.js");

requireText("playerId: identity.playerId", "playerId persistente em createPlayer", factory);
requireText("seatId: identity.seatId", "seatId persistente em createPlayer", factory);
requireText("sessionTokenHash:", "hash do token no jogador", factory);
requireText('t: "claim-seat"', "pedido autoritativo para ocupar lugar");
requireText('t: "session-auth"', "autenticação de reconexão");
requireText('t: "leave-seat"', "saída autoritativa do lobby");
requireText("findPlayerIndexById(nextGame, myPlayerId.current)", "resolução do índice por playerId");
requirePattern(/if\s*\(sourceConn\)\s*return\s+false\s*;/, "snapshots de convidados rejeitados pelo host");
requireText("g2.players[i].sessionTokenHash = cur.players[i].sessionTokenHash", "proteção dos hashes no estado recebido");
requireText("identityVersion: IDENTITY_PROTOCOL_VERSION", "versão de identidade no estado novo", factory);
requireText("playerId: auth.player.playerId", "atribuição estável de autoria no chat", socialController);
requireText("runtime.peer === peer", "cancelamento de callbacks antigos do host", hostRuntime);
requireText("runtime.peer === peer", "cancelamento de callbacks antigos do cliente", clientRuntime);
requireText('t: "session-replaced"', "substituição segura da ligação anterior numa reentrada", hostSessionController);
rejectText("myCh.current", "identidade baseada em personagem");
rejectText("const hReclaim", "retoma manual insegura");
rejectText("Quem és tu?", "seletor manual de identidade");

const playerStart = factory.indexOf("export function createPlayer(");
const playerEnd = factory.indexOf("export function createInitialGame", playerStart);
if (playerStart >= 0 && playerEnd > playerStart) {
    const playerBlock = factory.slice(playerStart, playerEnd);
    if (/sessionToken\s*:/.test(playerBlock))
        errors.push("createPlayer não pode guardar o token de sessão em claro");
}

(async () => {
    if (!errors.length) {
        const identity = await import(pathToFileURL(identityPath).href + `?v=${Date.now()}`);
        const sessionStore = await import(pathToFileURL(sessionStorePath).href + `?v=${Date.now()}`);
        const token = identity.createSessionToken();
        const hash = await identity.hashSessionToken(token);
        const game = { players: [{ ch: "vlad" }, { ch: "maria" }] };
        identity.ensureGamePlayerIdentities(game);
        if (!/^[a-f0-9]{64}$/.test(token))
            errors.push("createSessionToken não produziu 256 bits em hexadecimal");
        if (!identity.isSessionTokenHash(hash))
            errors.push("hashSessionToken não produziu SHA-256 hexadecimal");
        if (game.players.some((p) => !p.playerId || !p.seatId))
            errors.push("ensureGamePlayerIdentities não criou IDs");
        if (new Set(game.players.map((p) => p.playerId)).size !== game.players.length)
            errors.push("playerId duplicado");
        if (new Set(game.players.map((p) => p.seatId)).size !== game.players.length)
            errors.push("seatId duplicado");
        if (game.identityVersion !== identity.IDENTITY_PROTOCOL_VERSION)
            errors.push("identityVersion não foi aplicada ao estado");

        const storage = new Map();
        global.sessionStorage = {
            getItem: (key) => storage.has(key) ? storage.get(key) : null,
            setItem: (key, value) => storage.set(key, String(value))
        };
        const storedSession = {
            playerId: game.players[0].playerId,
            seatId: game.players[0].seatId,
            sessionToken: token
        };
        sessionStore.savePlayerSession("abcd", storedSession);
        const loadedSession = sessionStore.loadPlayerSession("ABCD");
        if (!loadedSession || loadedSession.sessionToken !== token)
            errors.push("sessão por separador não foi guardada/carregada corretamente");
        sessionStore.forgetPlayerSession("ABCD");
        if (sessionStore.loadPlayerSession("ABCD"))
            errors.push("forgetPlayerSession não removeu a sessão");
    }

    if (errors.length) {
        console.error("Falhas na identidade de jogador:");
        errors.forEach((error) => console.error(`- ${error}`));
        process.exit(1);
    }

    console.log("Identidade verificada: playerId/seatId estáveis, sessão por tab, token SHA-256 e retoma manual removida.");
})().catch((error) => {
    console.error(error);
    process.exit(1);
});
