const fs = require("node:fs");
const path = require("node:path");
const { readRuntimeSource } = require("./lib/runtime-source.cjs");

const root = path.resolve(__dirname, "..");
const source = readRuntimeSource(root);
const gameScreen = fs.readFileSync(path.join(root, "src/ui/game/GameScreen.jsx"), "utf8");
const actionModel = fs.readFileSync(path.join(root, "src/ui/game/gameActionModel.js"), "utf8");
const gameDecisionSystem = fs.readFileSync(path.join(root, "src/ui/game/decisions/GameDecisionSystem.jsx"), "utf8");
const runtimeUi = `${source}\n${gameScreen}\n${gameDecisionSystem}`;
const protocol = fs.readFileSync(path.join(root, "src/game/gameProtocol.js"), "utf8");
const identity = fs.readFileSync(path.join(root, "src/game/playerIdentity.js"), "utf8");
const reducer = fs.readFileSync(path.join(root, "src/game/gameActionReducer.js"), "utf8");
const hostActions = fs.readFileSync(path.join(root, "src/multiplayer/hostActionController.js"), "utf8");

const requiredActions = [
  "RECRUIT_TROOP",
  "DEPLOY_UNIT",
  "UNIT_ACTION",
  "BRIBE_UNIT",
  "BUILD_WAGON",
  "MOVE_WAGON",
  "LOAD_COLONISTS",
  "FOUND_REMOTE_VILLAGE",
  "PLAY_DEV_CARD",
  "PROPOSE_TRADE",
  "ACCEPT_TRADE",
  "DECLINE_TRADE",
  "CANCEL_TRADE",
  "REMATCH_READY",
];

const failures = [];
for (const action of requiredActions) {
  if (!protocol.includes(`${action}: "${action}"`))
    failures.push(`Ação ausente no protocolo: ${action}`);
  const handledInSwitch = reducer.includes(`case GAME_ACTION.${action}`);
  const handledAsTradeResponse = ["ACCEPT_TRADE", "DECLINE_TRADE"].includes(action)
    && reducer.includes(`[GAME_ACTION.ACCEPT_TRADE, GAME_ACTION.DECLINE_TRADE].includes(actionType)`);
  const handledAsRematch = action === "REMATCH_READY" && reducer.includes("action.type === GAME_ACTION.REMATCH_READY");
  if (!handledInSwitch && !handledAsTradeResponse && !handledAsRematch)
    failures.push(`Ação sem validação no reducer central: ${action}`);
  const directUiDispatch = runtimeUi.includes(`dispatchGameAction(GAME_ACTION.${action}`)
    || gameScreen.includes(`runGameAction(GAME_ACTION.${action}`)
    || gameScreen.includes(`afterAccepted(GAME_ACTION.${action}`);
  const declarativeUiCommand = actionModel.includes(`actionType: GAME_ACTION.${action}`)
    && gameScreen.includes("runGameAction(command.actionType, command.payload || {})");
  const rematchUi = action === "REMATCH_READY" && source.includes("requestRematch") && gameScreen.includes("onRematch");
  if (!directUiDispatch && !declarativeUiCommand && !rematchUi)
    failures.push(`Ação não ligada à interface: ${action}`);
}

const requiredFragments = [
  "export const GAME_PROTOCOL_VERSION = 7;",
  "export const IDENTITY_PROTOCOL_VERSION = 11;",
  "normalizeResourceBundle",
  "reduceTradeProposal",
  'tradeId: createId("trade")',
  "action.targetPlayerId",
  "validDeployHexes(next, graph, actorIndex",
  "unitTargets(next, graph, action.fromHex, actorIndex)",
  "bribeTargets(next, actorIndex).has(action.hex)",
  "remoteVillageSpots(next, graph, action.wagonId).includes(action.vertex)",
  "onLegacyState",
  "if (!net.current.host)\n            return gref.current;",
];
for (const fragment of requiredFragments) {
  const reducerFragment = ["normalizeResourceBundle", "reduceTradeProposal", "tradeId: createId", "action.targetPlayerId", "validDeployHexes", "unitTargets", "bribeTargets", "remoteVillageSpots"].some((token) => fragment.includes(token));
  const haystack = fragment.includes("IDENTITY_PROTOCOL") ? identity : fragment.includes("GAME_PROTOCOL_VERSION = 7") ? protocol : reducerFragment ? reducer : fragment === "onLegacyState" ? hostActions : source;
  if (!haystack.includes(fragment))
    failures.push(`Fragmento obrigatório ausente: ${fragment}`);
}

const forbidden = [
  "const mut = (fn) =>",
  "mut((gg)",
  'net.current.hostConn.send({ t: "state", g: gg })',
  "adopt(m.g, conn)",
];
for (const fragment of forbidden) {
  if (source.includes(fragment))
    failures.push(`Canal legacy ainda ativo: ${fragment}`);
}

if (failures.length) {
  console.error("Falhas na verificação da Parte 4B:");
  for (const failure of failures)
    console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Parte 4B verificada: ${requiredActions.length} ações restantes autoritativas e snapshots de convidados desativados.`);
