const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { readRuntimeSource, runtimeSourcePaths } = require("./lib/runtime-source.cjs");

const root = path.resolve(__dirname, "..");
const presencePath = path.join(root, "src/game/playerPresence.js");
const identityPath = path.join(root, "src/game/playerIdentity.js");
const sessionPath = path.join(root, "src/multiplayer/sessionStore.js");
const lobbyPath = path.join(root, "src/ui/lobby/DragonLobby.jsx");
const source = readRuntimeSource(root);
const identitySource = fs.readFileSync(identityPath, "utf8");
const sessionSource = fs.readFileSync(sessionPath, "utf8");
const lobbySource = fs.readFileSync(lobbyPath, "utf8");
const hostSessionSource = fs.readFileSync(path.join(root, "src/multiplayer/hostSessionPresenceController.js"), "utf8");
const failures = [];
const requireText = (haystack, text, label) => { if (!haystack.includes(text)) failures.push(`Falta: ${label}`); };

requireText(sessionSource, "sessionStorage", "sessões isoladas por separador");
requireText(sessionSource, "setItem", "persistência da sessão por separador");
requireText(source, "markAuthenticatedPlayerDisconnected", "tratamento de perda de ligação");
requireText(hostSessionSource, "LOBBY_RECONNECT_GRACE_MS", "janela de reconexão do lobby");
requireText(source, "removeExpiredLobbyPlayer", "libertação automática do lugar expirado");
requireText(hostSessionSource, 't: "kicked-from-lobby"', "notificação privada de kick");
requireText(source, "LOBBY_ACTION.KICK_PLAYER", "ação autoritativa de kick");
requireText(source, "delete cancelled.lobbyStarting", "cancelamento do início quando a mesa deixa de estar pronta");
requireText(lobbySource, "lobbyReconnectSeconds", "contagem decrescente visível");
requireText(lobbySource, "onKickPlayer", "controlo de kick no lobby");

(async () => {
  const presence = await import(pathToFileURL(presencePath).href + `?v=${Date.now()}`);
  const player = { ready: true };
  presence.ensurePlayerPresence(player);
  if (player.connected !== true || player.controller !== "human")
    failures.push("Defaults de presença inválidos.");

  presence.markPlayerDisconnected(player, { now: 1000, phase: "lobby", graceMs: 30000 });
  if (player.connected !== false || player.ready !== false || player.reconnectDeadline !== 31000)
    failures.push("Desconexão no lobby não reservou o lugar corretamente.");
  if (presence.isLobbyReservationExpired(player, 30999))
    failures.push("Reserva expirou antes do prazo.");
  if (!presence.isLobbyReservationExpired(player, 31000))
    failures.push("Reserva não expirou no prazo.");
  if (presence.lobbyReconnectSeconds(player, 1150) !== 30)
    failures.push("Contagem de reconexão incorreta.");

  presence.markPlayerConnected(player);
  if (!player.connected || player.disconnectedAt !== null || player.reconnectDeadline !== null)
    failures.push("Reconexão não limpou o estado de presença.");

  presence.markPlayerDisconnected(player, { now: 5000, phase: "play" });
  if (player.reconnectDeadline !== null || player.controller !== "human")
    failures.push("Desconexão durante a partida não preservou o lugar humano.");

  if (failures.length) {
    console.error("Falhas na presença do lobby:");
    failures.forEach((failure) => console.error(`- ${failure}`));
    process.exit(1);
  }
  console.log("Presença verificada: sessão por tab, reserva de 30s, reconexão e kick do host.");
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
