const fs = require("node:fs");
const path = require("node:path");
const { readRuntimeSource } = require("./lib/runtime-source.cjs");

const root = path.resolve(__dirname, "..");
const legacy = readRuntimeSource(root);
const reducer = fs.readFileSync(path.join(root, "src/game/mandatoryDecisionReducer.js"), "utf8");
const actionReducer = fs.readFileSync(path.join(root, "src/game/gameActionReducer.js"), "utf8");
const tests = fs.readFileSync(path.join(root, "tests/mandatory-decision-reducer.test.js"), "utf8");
const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const failures = [];

for (const fragment of ['from "../game/mandatoryDecisionReducer.js"', "requiredGameActorIndex"]) {
  if (!legacy.includes(fragment)) failures.push(`Integração de presença/UI obrigatória ausente: ${fragment}`);
}
for (const fragment of ["reduceDiscardDecision", "reduceDragonPlacement", "reduceResourceSteal", "reduceTsunamiDecision", "reduceQueueResourceDecision"]) {
  if (!actionReducer.includes(fragment)) failures.push(`Integração de decisões obrigatórias ausente no reducer central: ${fragment}`);
}
const dragonActionStart = actionReducer.indexOf("case GAME_ACTION.PLACE_DRAGON");
const dragonActionEnd = actionReducer.indexOf("case GAME_ACTION.BUY_DEV_CARD", dragonActionStart);
const dragonActions = actionReducer.slice(dragonActionStart, dragonActionEnd);
if ((dragonActions.match(/NOT_CURRENT_PLAYER/g) || []).length < 2) failures.push("Colocação do Dragão e roubo não exigem explicitamente o jogador do turno.");

for (const legacyFragment of [
  "function validDragonHexes(",
  "function placeDragon(",
  "function stealFrom(",
  "const requiredGameActorIndex =",
  "stt(next).blessings[actorIndex]++",
]) {
  if (legacy.includes(legacyFragment)) failures.push(`Mutador antigo ainda existe no JSX: ${legacyFragment}`);
}

for (const exportName of [
  "requiredGameActorIndex",
  "validDragonHexes",
  "reduceDiscardDecision",
  "reduceDragonPlacement",
  "reduceResourceSteal",
  "reduceTsunamiDecision",
  "reduceQueueResourceDecision",
  "reduceMandatoryQueueSkip",
]) {
  if (!reducer.includes(`export function ${exportName}`)) failures.push(`Export ausente: ${exportName}`);
  if (!tests.includes(`${exportName}(`)) failures.push(`Sem teste direto para ${exportName}`);
}

for (const eventType of [
  "DISCARD_RESOLVED",
  "DRAGON_PLACED",
  "RESOURCE_STOLEN",
  "QUEUE_RESOURCE_RESOLVED",
  "MANDATORY_DECISION_SKIPPED",
]) {
  if (!reducer.includes(`\"${eventType}\"`)) failures.push(`Evento semântico ausente: ${eventType}`);
}

for (const scenario of [
  "validDragonHexes excludes the current dragon and fog",
  "placing the dragon creates only eligible victims",
  "resource stealing uses deterministic RNG",
  "discard resolution consumes exactly",
  "blessings grant one resource at a time",
  "tribute choices are resolved through the unified",
  "tsunami decisions disable only an active selected port",
  "mandatory queue skip removes only",
]) {
  if (!tests.includes(scenario)) failures.push(`Cenário obrigatório ausente: ${scenario}`);
}

if (!packageJson.scripts.test.includes("tests/mandatory-decision-reducer.test.js")) {
  failures.push("A suite principal não executa tests/mandatory-decision-reducer.test.js.");
}
if (!packageJson.scripts["verify:static"].includes("verify-mandatory-decision-reducer.cjs")) {
  failures.push("A verificação estática não executa verify-mandatory-decision-reducer.cjs.");
}

if (failures.length) {
  console.error("Falhas na extração de Dragão e decisões obrigatórias:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log("Dragão, roubo, descarte, Tsunami, Tributo e bênçãos extraídos; o skip legado permanece testado mas deixou de integrar a presença runtime.");
