const fs = require("node:fs");
const path = require("node:path");
const { readRuntimeSource } = require("./lib/runtime-source.cjs");

const root = path.resolve(__dirname, "..");
const legacy = readRuntimeSource(root);
const host = fs.readFileSync(path.join(root, "src/multiplayer/hostSessionPresenceController.js"), "utf8");
const client = fs.readFileSync(path.join(root, "src/multiplayer/clientSessionPresenceController.js"), "utf8");
const gamePresence = fs.readFileSync(path.join(root, "src/multiplayer/hostGamePresenceController.js"), "utf8");
const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const failures = [];
const requireText = (source, text, label) => { if (!source.includes(text)) failures.push(`Falta: ${label}`); };
const forbidText = (source, text, label) => { if (source.includes(text)) failures.push(`Ainda existe: ${label}`); };

for (const file of ["hostSessionPresenceController.js", "clientSessionPresenceController.js", "hostGamePresenceController.js"]) {
  if (!fs.existsSync(path.join(root, "src/multiplayer", file))) failures.push(`Falta src/multiplayer/${file}`);
}

requireText(host, "createHostSessionPresenceController", "controller de sessão/presença do host");
requireText(host, "onSessionAuth", "autenticação do host extraída");
requireText(host, "onClaimSeat", "reserva de lugar extraída");
requireText(host, "onLeaveSeat", "saída voluntária extraída");
requireText(host, "onConnectionClosed", "desconexão extraída");
requireText(host, "applyKickSideEffect", "efeito de kick extraído");
requireText(client, "createClientSessionPresenceController", "controller de sessão do cliente");
requireText(gamePresence, "createHostGamePresenceController", "controller de takeover/reconexão durante a partida");
requireText(gamePresence, "activateBotAfterReconnectTimeout", "takeover por bot após a janela de reconexão");
requireText(client, 'type: "SESSION_ACCEPTED"', "evento de sessão aceite");
requireText(client, 'type: "CLAIM_REQUIRED"', "evento de reserva necessária");
requireText(client, 'type: "KICKED_FROM_LOBBY"', "evento de kick");
requireText(legacy, 'from "../multiplayer/hostSessionPresenceController.js"', "integração do controller do host");
requireText(legacy, 'from "../multiplayer/clientSessionPresenceController.js"', "integração do controller do cliente");
requireText(legacy, 'from "../multiplayer/hostGamePresenceController.js"', "integração do controller de presença em jogo");
requireText(legacy, "hostSessionPresence.onSessionAuth", "router ligado ao controller do host");
requireText(legacy, "clientSessionPresence.onIdentityWelcome", "router ligado ao controller do cliente");

forbidText(legacy, "const handleHostSessionAuth = async", "handler de autenticação no JSX");
forbidText(legacy, "const handleHostClaimSeat = async", "handler de reserva no JSX");
forbidText(legacy, "const handleHostLeaveSeat = async", "handler de saída no JSX");
forbidText(legacy, "const handleClientSessionResult =", "handler de sessão do cliente no JSX");
forbidText(legacy, "const handleClientClaimResult =", "handler de reserva do cliente no JSX");
forbidText(host, 'from "react"', "React no controller do host");
forbidText(client, 'from "react"', "React no controller do cliente");
forbidText(host, 'from "peerjs"', "PeerJS no controller do host");
forbidText(client, 'from "peerjs"', "PeerJS no controller do cliente");
forbidText(gamePresence, 'from "react"', "React no controller de presença em jogo");

if (!packageJson.scripts.test.includes("tests/session-presence-controller.test.js")) {
  failures.push("A suite session-presence-controller.test.js não está no npm test.");
}
if (!packageJson.scripts.test.includes("tests/host-game-presence-controller.test.js")) {
  failures.push("A suite host-game-presence-controller.test.js não está no npm test.");
}

if (failures.length) {
  console.error("Falhas na extração de sessão e presença multiplayer:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}
console.log("Sessão e presença verificadas: reconexão, takeover por bot e devolução ao humano fora do JSX.");
