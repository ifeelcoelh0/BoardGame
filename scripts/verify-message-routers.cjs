const fs = require("node:fs");
const path = require("node:path");
const { readRuntimeSource } = require("./lib/runtime-source.cjs");

const root = path.resolve(__dirname, "..");
const legacy = readRuntimeSource(root);
const router = fs.readFileSync(path.join(root, "src/multiplayer/messageRouter.js"), "utf8");
const host = fs.readFileSync(path.join(root, "src/multiplayer/hostMessageController.js"), "utf8");
const client = fs.readFileSync(path.join(root, "src/multiplayer/clientMessageController.js"), "utf8");
const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));

const failures = [];
const requireText = (source, text, label) => { if (!source.includes(text)) failures.push(`Falta: ${label}`); };
const forbidText = (source, text, label) => { if (source.includes(text)) failures.push(`Ainda existe: ${label}`); };

for (const file of ["messageRouter.js", "hostMessageController.js", "clientMessageController.js"]) {
  if (!fs.existsSync(path.join(root, "src/multiplayer", file))) failures.push(`Falta src/multiplayer/${file}`);
}

requireText(router, "createTypedMessageRouter", "router tipado comum");
requireText(router, "isMessageEnvelope", "validação comum do envelope");
requireText(router, "UNKNOWN_MESSAGE", "isolamento de mensagens desconhecidas");
requireText(host, "HOST_MESSAGE_ROUTES", "tabela explícita das mensagens do host");
requireText(host, '"session-auth": "onSessionAuth"', "rota de autenticação");
requireText(host, '"game-action": "onGameAction"', "rota de ações da partida");
requireText(host, 'chat: "onChat"', "rota segura de chat");
requireText(client, "CLIENT_MESSAGE_ROUTES", "tabela explícita das mensagens do cliente");
requireText(client, '"identity-welcome": "onIdentityWelcome"', "rota de boas-vindas");
requireText(client, '"game-action-result": "onGameActionResult"', "rota de resultados da partida");
requireText(client, '"kicked-from-lobby": "onKickedFromLobby"', "rota de kick");

requireText(legacy, 'from "../multiplayer/hostMessageController.js"', "integração do controller do host");
requireText(legacy, 'from "../multiplayer/clientMessageController.js"', "integração do controller do cliente");
requireText(legacy, "createHostMessageController({", "router do host ativo");
requireText(legacy, "createClientMessageController({", "router do cliente ativo");
requireText(legacy, "onMessage: handleClientMessage", "runtime cliente ligado ao router");

forbidText(legacy, "if (m.t ===", "cadeia de interpretação de mensagens no JSX");
forbidText(legacy, "else if (m.t ===", "cadeia alternativa de mensagens no JSX");
forbidText(router, 'from "react"', "React no router comum");
forbidText(host, 'from "react"', "React no controller do host");
forbidText(client, 'from "react"', "React no controller do cliente");
forbidText(router, 'from "peerjs"', "PeerJS no router comum");
forbidText(host, 'from "peerjs"', "PeerJS no controller do host");
forbidText(client, 'from "peerjs"', "PeerJS no controller do cliente");

if (!packageJson.scripts.test.includes("tests/message-router.test.js"))
  failures.push("A suite message-router.test.js não está no npm test.");

if (failures.length) {
  console.error("Falhas na extração dos routers multiplayer:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log("Routers multiplayer verificados: sessão, lobby, jogo, estado, chat e emotes fora das cadeias do JSX.");
