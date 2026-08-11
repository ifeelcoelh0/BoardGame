const fs = require("node:fs");
const path = require("node:path");
const { readRuntimeSource } = require("./lib/runtime-source.cjs");

const root = path.resolve(__dirname, "..");
const legacy = readRuntimeSource(root);
const runtime = fs.readFileSync(path.join(root, "src/multiplayer/runtimeState.js"), "utf8");
const pending = fs.readFileSync(path.join(root, "src/multiplayer/pendingActionStore.js"), "utf8");
const sessions = fs.readFileSync(path.join(root, "src/multiplayer/sessionStore.js"), "utf8");
const messages = fs.readFileSync(path.join(root, "src/multiplayer/protocolMessages.js"), "utf8");
const transport = fs.readFileSync(path.join(root, "src/multiplayer/stateTransport.js"), "utf8");
const hostRuntime = fs.readFileSync(path.join(root, "src/multiplayer/hostRuntime.js"), "utf8");
const clientRuntime = fs.readFileSync(path.join(root, "src/multiplayer/clientRuntime.js"), "utf8");
const browserRuntime = fs.readFileSync(path.join(root, "src/multiplayer/browserPeerRuntime.js"), "utf8");
const clientActions = fs.readFileSync(path.join(root, "src/multiplayer/clientActionController.js"), "utf8");
const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));

const failures = [];
const requireText = (source, text, label) => { if (!source.includes(text)) failures.push(`Falta: ${label}`); };
const forbidText = (source, text, label) => { if (source.includes(text)) failures.push(`Ainda existe: ${label}`); };

for (const file of [
  "runtimeState.js",
  "pendingActionStore.js",
  "sessionStore.js",
  "protocolMessages.js",
  "stateTransport.js",
  "actionResultCache.js",
  "hostRuntime.js",
  "clientRuntime.js",
  "browserPeerRuntime.js",
]) {
  if (!fs.existsSync(path.join(root, "src/multiplayer", file))) failures.push(`Falta src/multiplayer/${file}`);
}

requireText(runtime, "createMultiplayerRuntimeState", "estado central do runtime");
requireText(runtime, "authenticateConnection", "autenticação central de ligações");
requireText(runtime, "replaceAuthenticatedConnection", "substituição segura de ligação");
requireText(runtime, "enqueueAuthorityTask", "fila autoritativa fora do React");
requireText(runtime, "destroyMultiplayerRuntime", "cleanup central do runtime");
requireText(pending, "class PendingActionStore extends Map", "store comum de ações pendentes");
requireText(pending, "connection.send(pending.message)", "retry com o mesmo envelope");
requireText(pending, "this.maxAttempts", "limite de tentativas configurável");
requireText(sessions, "sessionStorage", "sessão por separador");
requireText(messages, "createLobbyActionMessage", "construtor de intenção do lobby");
requireText(messages, "createGameActionMessage", "construtor de intenção da partida");
requireText(messages, "createStateRequestMessage", "pedido explícito de sincronização");
requireText(transport, "createGameStateView", "vista privada por ligação");
requireText(transport, "broadcastGameState", "broadcast filtrado");
requireText(hostRuntime, "createHostPeerRuntime", "runtime PeerJS do anfitrião");
requireText(hostRuntime, "peer.on(\"connection\"", "ligações PeerJS fora do JSX");
requireText(hostRuntime, "connection.on(\"data\"", "mensagens do anfitrião fora do JSX");
requireText(clientRuntime, "createClientPeerRuntime", "runtime PeerJS do convidado");
requireText(clientRuntime, "peer.connect(hostPeerId", "ligação ao anfitrião fora do JSX");
requireText(clientRuntime, "connection.on(\"close\"", "fecho do convidado fora do JSX");
requireText(browserRuntime, "from \"peerjs\"", "adaptador browser PeerJS");

requireText(legacy, 'from "../multiplayer/runtimeState.js"', "integração do runtime no componente");
requireText(legacy, 'from "../multiplayer/pendingActionStore.js"', "integração do store pendente");
requireText(legacy, 'from "../multiplayer/sessionStore.js"', "sessões fora do domínio");
requireText(clientActions, "createLobbyActionMessage", "envelopes de lobby fora do JSX");
requireText(clientActions, "createGameActionMessage", "envelopes de jogo fora do JSX");
requireText(legacy, "broadcastGameState(net.current, g)", "transporte de estado fora do JSX");
requireText(clientActions, "pendingLobbyActions.findByType", "deduplicação comum do lobby");
requireText(clientActions, "pendingGameActions.findByType", "deduplicação comum da partida");
requireText(legacy, "createBrowserHostPeerRuntime", "integração do hostRuntime");
requireText(legacy, "createBrowserClientPeerRuntime", "integração do clientRuntime");

forbidText(legacy, "net.current = { peer:", "recriação manual do runtime");
forbidText(legacy, "net.current.conns.push(conn)", "registo manual de ligação");
forbidText(legacy, "net.current.auth.set(conn", "autenticação manual de ligação");
forbidText(legacy, "conn.send(pending.message)", "retry duplicado dentro do componente");
forbidText(legacy, "active.attempts || 0) < 2", "limite de retry duplicado no componente");
forbidText(legacy, "new Peer(", "construção PeerJS dentro do componente");
forbidText(legacy, "peer.on(\"", "handlers do peer dentro do componente");
forbidText(legacy, "conn.on(\"", "handlers da ligação dentro do componente");
forbidText(runtime, "from \"react\"", "React dentro do runtime");
forbidText(runtime, "from \"peerjs\"", "PeerJS acoplado ao registo puro");
forbidText(pending, "from \"react\"", "React dentro do store pendente");
forbidText(hostRuntime, "from \"react\"", "React dentro do hostRuntime");
forbidText(clientRuntime, "from \"react\"", "React dentro do clientRuntime");
forbidText(hostRuntime, "from \"peerjs\"", "PeerJS acoplado ao hostRuntime testável");
forbidText(clientRuntime, "from \"peerjs\"", "PeerJS acoplado ao clientRuntime testável");

if (!packageJson.scripts.test.includes("tests/multiplayer-runtime.test.js"))
  failures.push("A suite multiplayer-runtime.test.js não está no npm test.");

if (failures.length) {
  console.error("Falhas na extração do runtime multiplayer:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log("Runtime multiplayer verificado: sessões, fila, ACK/retry, vistas e handlers PeerJS fora do componente.");
