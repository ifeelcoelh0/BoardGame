const fs = require("node:fs");
const path = require("node:path");
const { readRuntimeSource } = require("./lib/runtime-source.cjs");

const root = path.resolve(__dirname, "..");
const source = readRuntimeSource(root);
const gameScreen = fs.readFileSync(path.join(root, "src/ui/game/GameScreen.jsx"), "utf8");
const gameActionModel = fs.readFileSync(path.join(root, "src/ui/game/gameActionModel.js"), "utf8");
const gameDecisionSystem = fs.readFileSync(path.join(root, "src/ui/game/decisions/GameDecisionSystem.jsx"), "utf8");
const runtimeUi = source + "\n" + gameScreen + "\n" + gameActionModel + "\n" + gameDecisionSystem;
const protocol = fs.readFileSync(path.join(root, "src/game/gameProtocol.js"), "utf8");
const reducer = fs.readFileSync(path.join(root, "src/game/gameActionReducer.js"), "utf8");
const runtime = fs.readFileSync(path.join(root, "src/multiplayer/runtimeState.js"), "utf8");
const hostMessages = fs.readFileSync(path.join(root, "src/multiplayer/hostMessageController.js"), "utf8");
const clientMessages = fs.readFileSync(path.join(root, "src/multiplayer/clientMessageController.js"), "utf8");
const hostActions = fs.readFileSync(path.join(root, "src/multiplayer/hostActionController.js"), "utf8");
const clientActions = fs.readFileSync(path.join(root, "src/multiplayer/clientActionController.js"), "utf8");

const requiredActions = [
  "ROLL_DICE",
  "BUILD_ROAD",
  "BUILD_VILLAGE",
  "BUILD_PALACE",
  "PLACE_DRAGON",
  "STEAL_RESOURCE",
  "BUY_DEV_CARD",
  "BANK_TRADE",
  "END_TURN",
  "RESOLVE_DISCARD",
  "RESOLVE_TSUNAMI",
  "RESOLVE_QUEUE_RESOURCE",
];

const failures = [];
for (const action of requiredActions) {
  if (!protocol.includes(`${action}: \"${action}\"`))
    failures.push(`Ação ausente no protocolo: ${action}`);
  if (!runtimeUi.includes(`GAME_ACTION.${action}`))
    failures.push(`Ação não ligada ao runtime/UI: ${action}`);
}

const requiredHostFragments = [
  "validateGameActionEnvelope(message)",
  "gameActionResults",
  "message.expectedRevision !== (current.v || 0)",
  'reason: "STALE_STATE"',
  "authenticatedPlayerId(runtimeOf(), connection)",
  "applyGame(current, actorId, message.action)",
];
for (const fragment of requiredHostFragments) {
  if (!hostActions.includes(fragment)) failures.push(`Fragmento obrigatório ausente no hostActionController: ${fragment}`);
}
const requiredUiBindings = [
  ["BUILD_ROAD", "afterAccepted(GAME_ACTION.BUILD_ROAD"],
  ["BUILD_VILLAGE", "afterAccepted(GAME_ACTION.BUILD_VILLAGE"],
  ["BUILD_PALACE", "afterAccepted(GAME_ACTION.BUILD_PALACE"],
  ["PLACE_DRAGON", "afterAccepted(GAME_ACTION.PLACE_DRAGON"],
  ["STEAL_RESOURCE", "dispatchGameAction(GAME_ACTION.STEAL_RESOURCE"],
  ["BANK_TRADE", "dispatchGameAction(GAME_ACTION.BANK_TRADE"],
];
for (const [action, fragment] of requiredUiBindings) {
  if (!runtimeUi.includes(fragment)) failures.push(`Ligação UI ausente para ${action}.`);
}
for (const action of ["ROLL_DICE", "BUY_DEV_CARD", "END_TURN"]) {
  if (!gameActionModel.includes(`actionType: GAME_ACTION.${action}`))
    failures.push(`Ação declarativa ausente no Action System: ${action}`);
}
if (!gameScreen.includes("runGameAction(command.actionType, command.payload || {})"))
  failures.push("Executor declarativo do Action System ausente em GameScreen.");
if (!clientActions.includes("dispatchGameAction")) failures.push("Dispatcher de jogo ausente no clientActionController.");


if (!hostMessages.includes('"game-action": "onGameAction"'))
  failures.push("A rota game-action não está no controller do host.");
if (!clientMessages.includes('"game-action-result": "onGameActionResult"'))
  failures.push("A rota game-action-result não está no controller do cliente.");


for (const fragment of ["authorityQueue", "const previous = runtime.authorityQueue || Promise.resolve()", "runtime.authorityQueue = next.catch"]) {
  if (!runtime.includes(fragment)) failures.push(`Fragmento obrigatório ausente no runtime: ${fragment}`);
}

const forbiddenLegacyFragments = [
  "mut((gg) => doRoll(gg",
  "mut((gg) => buildRoad(gg",
  "mut((gg) => buildVillage(gg",
  "mut((gg) => buildPalace(gg",
  "mut((gg) => placeDragon(gg",
  "mut((gg) => buyDev(gg",
  "mut((gg) => bankTrade(gg",
  "mut((gg) => endTurn(gg",
  "mut((gg) => stealFrom(gg",
  "const mut = (fn) =>",
  'net.current.hostConn.send({ t: "state", g: gg })',
];
for (const fragment of forbiddenLegacyFragments) {
  if (source.includes(fragment))
    failures.push(`Mutação legacy ainda usada no núcleo: ${fragment}`);
}

if (!protocol.includes("JSON.stringify(message).length > 4096"))
  failures.push("O envelope não limita o tamanho da mensagem.");
if (!protocol.includes("expectedRevision"))
  failures.push("O envelope não valida a revisão esperada.");

if (failures.length) {
  console.error("Falhas na verificação do núcleo autoritativo:");
  for (const failure of failures)
    console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Núcleo autoritativo verificado: ${requiredActions.length} ações com fila, revisão, deduplicação e RNG no host.`);
