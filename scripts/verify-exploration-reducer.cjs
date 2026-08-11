const fs = require("node:fs");
const path = require("node:path");
const { readRuntimeSource } = require("./lib/runtime-source.cjs");

const root = path.resolve(__dirname, "..");
const legacy = readRuntimeSource(root);
const gameScreen = fs.readFileSync(path.join(root, "src/ui/game/GameScreen.jsx"), "utf8");
const runtimeUi = `${legacy}\n${gameScreen}`;
const presenter = fs.readFileSync(path.join(root, "src/presentation/gamePresenter.js"), "utf8");
const reducer = fs.readFileSync(path.join(root, "src/game/explorationReducer.js"), "utf8");
const actionReducer = fs.readFileSync(path.join(root, "src/game/gameActionReducer.js"), "utf8");
const tests = fs.readFileSync(path.join(root, "tests/exploration-reducer.test.js"), "utf8");
const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const turnReducer = fs.readFileSync(path.join(root, "src/game/turnCycleReducer.js"), "utf8");
const failures = [];

if (!gameScreen.includes('from "../../game/explorationReducer.js"')) failures.push("A UI da exploração não está ligada aos helpers do reducer.");
if (!presenter.includes("function presentExplorationEvent")) failures.push("A apresentação da exploração não está no presenter dedicado.");
for (const fragment of ["reduceWagonConstruction", "reduceWagonMove", "reduceColonistLoading", "reduceRemoteVillageFoundation"]) {
  if (!actionReducer.includes(fragment)) failures.push(`Integração da exploração ausente no reducer central: ${fragment}`);
}

if (!turnReducer.includes("reduceWagonTurnReset")) failures.push("A reposição das carruagens não está integrada no ciclo de turnos.");

for (const legacyFragment of [
  "function revealHex(",
  "function buildWagon(",
  "function moveWagon(",
  "function resetWagons(",
  "function loadColonos(",
  "function foundFar(",
  "const WCOST =",
  "const WMV_VAZIA =",
]) {
  if (runtimeUi.includes(legacyFragment)) failures.push(`Regra antiga de exploração ainda existe na camada React: ${legacyFragment}`);
}

for (const exportName of [
  "homeHexes",
  "validWagonBuildHexes",
  "validWagonMoves",
  "remoteVillageSpots",
  "reduceWagonConstruction",
  "reduceWagonMove",
  "reduceColonistLoading",
  "reduceRemoteVillageFoundation",
]) {
  if (!reducer.includes(`export function ${exportName}`)) failures.push(`Export de exploração ausente: ${exportName}`);
  if (!tests.includes(`${exportName}(`)) failures.push(`Sem teste direto para ${exportName}`);
}

for (const eventType of [
  "WAGON_BUILT",
  "WAGON_MOVED",
  "COLONISTS_LOADED",
  "REMOTE_VILLAGE_FOUNDED",
  "WAGONS_RESET",
]) {
  if (!reducer.includes(`\"${eventType}\"`)) failures.push(`Evento de exploração ausente: ${eventType}`);
}

for (const scenario of [
  "canonical and redacted views expose the same wagon moves into fog",
  "moving into fog reveals terrain and port",
  "loading colonists pays the village cost",
  "remote village spots respect occupied",
  "founding a remote village consumes the wagon",
  "turn reset gives movement only",
]) {
  if (!tests.includes(scenario)) failures.push(`Cenário de exploração ausente: ${scenario}`);
}

if (!packageJson.scripts.test.includes("tests/exploration-reducer.test.js")) {
  failures.push("A suite principal não executa tests/exploration-reducer.test.js.");
}
if (!packageJson.scripts["verify:static"].includes("verify-exploration-reducer.cjs")) {
  failures.push("A verificação estática não executa verify-exploration-reducer.cjs.");
}

if (failures.length) {
  console.error("Falhas na extração da exploração:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log("Exploração: carruagens, nevoeiro, portos, colonos e aldeias remotas extraídos.");
