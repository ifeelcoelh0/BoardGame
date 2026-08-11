const fs = require("node:fs");
const path = require("node:path");
const { readRuntimeSource, runtimeSourcePaths } = require("./lib/runtime-source.cjs");

const root = path.resolve(__dirname, "..");
const reducerPath = path.join(root, "src/game/turnCycleReducer.js");
const testPath = path.join(root, "tests/turn-cycle-reducer.test.js");
const packagePath = path.join(root, "package.json");
const failures = [];

for (const file of [reducerPath, ...runtimeSourcePaths(root), testPath, packagePath]) {
  if (!fs.existsSync(file)) failures.push(`Ficheiro ausente: ${path.relative(root, file)}`);
}

if (!failures.length) {
  const reducer = fs.readFileSync(reducerPath, "utf8");
  const runtimeSource = readRuntimeSource(root);
  const tests = fs.readFileSync(testPath, "utf8");
  const packageJson = JSON.parse(fs.readFileSync(packagePath, "utf8"));

  for (const symbol of [
    "reduceTurnAdvance",
    "reduceIncomingPlayerEffects",
    "createFreshTurn",
    "roundsForTurns",
    "warRoundLimit",
    "ICE_DRAGON_WAKE_TURNS",
  ]) {
    if (!reducer.includes(`export function ${symbol}`) && !reducer.includes(`export const ${symbol}`)) {
      failures.push(`Export obrigatório ausente: ${symbol}`);
    }
  }

  for (const dependency of [
    "promoteNewDevelopmentCards",
    "reduceWagonTurnReset",
    "reduceWarEndTurnSweep",
    "reduceWarStartTurnAutomation",
  ]) {
    if (!reducer.includes(dependency)) failures.push(`O reducer não integra ${dependency}.`);
  }

  if (!runtimeSource.includes('from "../game/turnCycleReducer.js"')) failures.push("O runtime de aplicação não importa o reducer de turnos.");
  if (!runtimeSource.includes("reduceTurnAdvance(game, makeGraph(game.board.hexes), currentActorIndex(game))")) failures.push("O fim de turno não usa reduceTurnAdvance.");
  if (/function\s+endTurn\s*\(/.test(runtimeSource)) failures.push("A implementação duplicada de endTurn ainda existe.");
  for (const forbidden of [
    "activePlayer.freeRoads = 0",
    "np.sick = Math.max",
    "np.portOff = np.portOff.map",
    "g.turn = { pos, rolled: false",
  ]) {
    if (runtimeSource.includes(forbidden)) failures.push(`Mutação de turno ainda presente no JSX: ${forbidden}`);
  }

  for (const scenario of [
    "classic turn advance matures cards",
    "round advances only when the order wraps",
    "ice dragon awakens",
    "heart guard queues a blessing",
    "war round limit is signaled",
    "war end-turn sweep is part",
    "semantic event describes the complete transition",
  ]) {
    if (!tests.includes(scenario)) failures.push(`Cenário obrigatório ausente: ${scenario}`);
  }

  if (!packageJson.scripts.test.includes("tests/turn-cycle-reducer.test.js")) {
    failures.push("A suite principal não executa tests/turn-cycle-reducer.test.js.");
  }
  if (!packageJson.scripts["verify:static"].includes("verify-turn-cycle-reducer.cjs")) {
    failures.push("A verificação estática não executa verify-turn-cycle-reducer.cjs.");
  }
}

if (failures.length) {
  console.error("Falhas na extração do ciclo de turnos:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log("Ciclo de turnos, efeitos temporários, carruagens e automatismos de início/fim extraídos.");
