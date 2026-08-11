const fs = require("node:fs");
const path = require("node:path");
const { readRuntimeSource } = require("./lib/runtime-source.cjs");

const root = path.resolve(__dirname, "..");
const source = readRuntimeSource(root);
const protocol = fs.readFileSync(path.join(root, "src/game/gameProtocol.js"), "utf8");
const reducer = fs.readFileSync(path.join(root, "src/game/gameActionReducer.js"), "utf8");
const hostActions = fs.readFileSync(path.join(root, "src/multiplayer/hostActionController.js"), "utf8");
const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));

const actions = [...protocol.matchAll(/^\s{2}([A-Z0-9_]+):\s*"\1",?$/gm)].map((match) => match[1]);
const failures = [];
if (!actions.length) failures.push("Não foi possível ler as ações do protocolo.");
for (const action of actions) {
  const handledInSwitch = reducer.includes(`case GAME_ACTION.${action}`);
  const handledBeforeSwitch = ["RESOLVE_DISCARD", "RESOLVE_TSUNAMI", "RESOLVE_QUEUE_RESOURCE", "ACCEPT_TRADE", "DECLINE_TRADE", "REMATCH_READY"].includes(action)
    && reducer.includes(`GAME_ACTION.${action}`);
  if (!handledInSwitch && !handledBeforeSwitch) failures.push(`Ação ausente no applyGameAction: ${action}`);
}

const requiredReducer = [
  "export const GAME_ACTION_REDUCER_VERSION = 1;",
  "export function applyGameAction(current, actorId, action, options = {})",
  "findPlayerIndexById(current, actorId)",
  "makeBoardGraph(next.board.hexes)",
  "reduceDiceRoll",
  "reduceTurnAdvance",
  "reduceScoringAfterAction",
  "events",
];
for (const fragment of requiredReducer) {
  if (!reducer.includes(fragment)) failures.push(`Fragmento ausente no reducer central: ${fragment}`);
}

const forbiddenReducer = ["from \"react\"", "from \"peerjs\"", "from \"three\"", "addLog(", "speak(", "fireEv(", "setState("];
for (const fragment of forbiddenReducer) {
  if (reducer.toLowerCase().includes(fragment.toLowerCase())) failures.push(`Dependência de apresentação/rede no reducer: ${fragment}`);
}

const requiredHostIntegration = [
  'import { applyGameAction } from "../game/gameActionReducer.js";',
  "applyGame(current, actorId, message.action)",
];
for (const fragment of requiredHostIntegration) {
  if (!hostActions.includes(fragment)) failures.push(`Integração ausente no hostActionController: ${fragment}`);
}
if (!source.includes("onGameApplied: (next, applied) => presentAppliedGameAction(next, applied)"))
  failures.push("Apresentação dos eventos não está ligada ao controlador de ações.");

if (source.includes("applyAuthoritativeGameAction")) failures.push("O dispatcher antigo continua no componente.");
if (source.includes("case GAME_ACTION.")) failures.push("O componente ainda contém casos do dispatcher de ações.");
if (!packageJson.scripts.test.includes("tests/game-action-reducer.test.js")) failures.push("A suite do reducer central não está no npm test.");

if (failures.length) {
  console.error("Falhas na verificação do applyAction central:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Reducer central verificado: ${actions.length} ações fora do React, com eventos semânticos e dependências injetáveis.`);
