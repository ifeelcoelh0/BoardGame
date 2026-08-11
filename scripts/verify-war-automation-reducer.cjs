const fs = require("node:fs");
const path = require("node:path");
const { readRuntimeSource } = require("./lib/runtime-source.cjs");

const root = path.resolve(__dirname, "..");
const legacy = readRuntimeSource(root);
const presenter = fs.readFileSync(path.join(root, "src/presentation/gamePresenter.js"), "utf8");
const reducer = fs.readFileSync(path.join(root, "src/game/warAutomationReducer.js"), "utf8");
const actionReducer = fs.readFileSync(path.join(root, "src/game/gameActionReducer.js"), "utf8");
const tests = fs.readFileSync(path.join(root, "tests/war-automation-reducer.test.js"), "utf8");
const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const turnReducer = fs.readFileSync(path.join(root, "src/game/turnCycleReducer.js"), "utf8");
const failures = [];

if (!presenter.includes("function presentWarAutomationEvents")) failures.push("A apresentação dos automatismos de Guerra não está no presenter dedicado.");
for (const fragment of ['from "./warAutomationReducer.js"', "reduceTrollOmen"]) {
  if (!actionReducer.includes(fragment)) failures.push(`Integração do presságio ausente no reducer central: ${fragment}`);
}

for (const fragment of ["reduceWarEndTurnSweep", "reduceWarStartTurnAutomation"]) {
  if (!turnReducer.includes(fragment)) failures.push(`Integração dos automatismos de Guerra ausente no ciclo de turnos: ${fragment}`);
}

for (const legacyFragment of [
  "function processSieges(",
  "function siegeCount(",
  "function pickLair(",
  "function spawnRaider(",
  "function spawnWave(",
  "function refillHorde(",
  "function arriveRaider(",
  "function moveRaiders(",
  "function wakeTroll(",
  "function trollCamperSweep(",
  "function trollTick(",
  "function trollOmen(",
  "const TROLL_TURNS =",
  "const raiderCap =",
]) {
  if (legacy.includes(legacyFragment)) failures.push(`Automatismo militar antigo ainda existe no JSX: ${legacyFragment}`);
}

for (const exportName of [
  "pickTrollLair",
  "warPublicScore",
  "reduceTrollOmen",
  "reduceWarEndTurnSweep",
  "reduceWarSieges",
  "reduceTrollTurn",
  "reduceWarStartTurnAutomation",
]) {
  if (!reducer.includes(`export function ${exportName}`)) failures.push(`Export de automatismo ausente: ${exportName}`);
  if (!tests.includes(`${exportName}(`)) failures.push(`Sem teste direto para ${exportName}`);
}

for (const eventType of [
  "BUILDING_OCCUPIED",
  "OCCUPATION_CONTRABAND",
  "OCCUPATION_RELEASED",
  "TROLL_OMEN_RUSH",
  "TROLL_AWAKENED",
  "RAIDER_ARRIVED",
  "GIANT_STOMPED_UNIT",
  "GIANT_ROUND_SWEEP",
  "HORDE_REFILLED",
]) {
  if (!reducer.includes(`"${eventType}"`)) failures.push(`Evento de automatismo ausente: ${eventType}`);
}

for (const scenario of [
  "valid siege occupies",
  "Maria walls increase",
  "invalid occupations are released",
  "omen accelerates a sleeping horde",
  "horde warns before waking",
  "raiders move toward their target",
  "giant moves toward the heart",
  "end-turn giant sweep",
  "combined start-turn automation",
]) {
  if (!tests.includes(scenario)) failures.push(`Cenário de automatismo ausente: ${scenario}`);
}

if (!packageJson.scripts.test.includes("tests/war-automation-reducer.test.js")) {
  failures.push("A suite principal não executa tests/war-automation-reducer.test.js.");
}
if (!packageJson.scripts["verify:static"].includes("verify-war-automation-reducer.cjs")) {
  failures.push("A verificação estática não executa verify-war-automation-reducer.cjs.");
}

if (failures.length) {
  console.error("Falhas na extração dos automatismos do modo Guerra:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log("Modo Guerra automático: cercos, horda, Gigante, saqueadores e libertações extraídos.");
