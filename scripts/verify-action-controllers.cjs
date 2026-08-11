const fs = require("fs");
const path = require("path");
const { readRuntimeSource, runtimeSourcePaths } = require("./lib/runtime-source.cjs");

const root = path.resolve(__dirname, "..");
const hostPath = path.join(root, "src", "multiplayer", "hostActionController.js");
const clientPath = path.join(root, "src", "multiplayer", "clientActionController.js");
const testPath = path.join(root, "tests", "action-controller.test.js");

for (const file of [...runtimeSourcePaths(root), hostPath, clientPath, testPath]) {
  if (!fs.existsSync(file)) throw new Error(`Ficheiro em falta: ${file}`);
}

const jsx = readRuntimeSource(root);
const host = fs.readFileSync(hostPath, "utf8");
const client = fs.readFileSync(clientPath, "utf8");

for (const symbol of [
  "createHostActionController",
  "processLobbyAction",
  "processGameAction",
  "enqueueLobbyAction",
  "enqueueGameAction",
  "onStateRequest",
]) {
  if (!host.includes(symbol)) throw new Error(`Host action controller incompleto: ${symbol}`);
}
for (const symbol of [
  "createClientActionController",
  "dispatchLobbyAction",
  "dispatchGameAction",
  "handleLobbyActionResult",
  "handleGameActionResult",
  "STATE_SYNC_REQUESTED",
  "DUPLICATE_ACTION_PENDING",
]) {
  if (!client.includes(symbol)) throw new Error(`Client action controller incompleto: ${symbol}`);
}
for (const importPath of [
  '../multiplayer/hostActionController.js',
  '../multiplayer/clientActionController.js',
]) {
  if (!jsx.includes(importPath)) throw new Error(`Integração em falta no JSX: ${importPath}`);
}
for (const legacySymbol of [
  "const processLobbyActionRequest =",
  "const processGameActionRequest =",
  "const handleLobbyActionResult =",
  "const handleGameActionResult =",
  "const lobbyActionErrorText =",
  "const gameActionErrorText =",
]) {
  if (jsx.includes(legacySymbol)) throw new Error(`Lógica de ações ainda duplicada no JSX: ${legacySymbol}`);
}
if (jsx.includes('validateLobbyActionEnvelope') || jsx.includes('validateGameActionEnvelope')) {
  throw new Error("A validação de envelopes ainda está no componente React.");
}
if (jsx.includes('rememberAcceptedActionResult') || jsx.includes('getAcceptedActionResult')) {
  throw new Error("O cache de ACKs ainda é manipulado diretamente pelo JSX.");
}
console.log("Controladores de ações verificados: lobby, jogo, ACKs, retries e sincronização fora do JSX.");
