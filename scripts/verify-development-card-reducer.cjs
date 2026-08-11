const fs = require("node:fs");
const path = require("node:path");
const { readRuntimeSource } = require("./lib/runtime-source.cjs");

const root = path.resolve(__dirname, "..");
const legacy = readRuntimeSource(root);
const presenter = fs.readFileSync(path.join(root, "src/presentation/gamePresenter.js"), "utf8");
const reducer = fs.readFileSync(path.join(root, "src/game/developmentCardReducer.js"), "utf8");
const actionReducer = fs.readFileSync(path.join(root, "src/game/gameActionReducer.js"), "utf8");
const tests = fs.readFileSync(path.join(root, "tests/development-card-reducer.test.js"), "utf8");
const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));

const turnReducer = fs.readFileSync(path.join(root, "src/game/turnCycleReducer.js"), "utf8");

const failures = [];

for (const fragment of ['from "./developmentCardReducer.js"', "reduceDevelopmentCardPurchase", "reduceDevelopmentCardPlay"]) {
  if (!actionReducer.includes(fragment)) failures.push(`Integração de cartas ausente no reducer central: ${fragment}`);
}
if (!presenter.includes("function presentDevelopmentCardPlay")) failures.push("A apresentação das cartas não está no presenter dedicado.");
if (!legacy.includes("createGamePresenter") || !legacy.includes("presentAppliedGameAction")) failures.push("O presenter dedicado não está ligado ao runtime React.");

for (const legacyFunction of [
  "function buyDev(",
  "function playTroop(",
  "function playSimpleDev(",
  "function playEspiao(",
  "function playMonopoly(",
  "function playDiscover(",
]) {
  if (legacy.includes(legacyFunction)) failures.push(`Mutador antigo de cartas ainda existe: ${legacyFunction}`);
}


if (!turnReducer.includes("promoteNewDevelopmentCards")) failures.push("A maturação de cartas não está integrada no ciclo de turnos.");

for (const exportName of [
  "reduceDevelopmentCardPurchase",
  "reduceDevelopmentCardPlay",
]) {
  if (!reducer.includes(`export function ${exportName}`)) failures.push(`Export ausente: ${exportName}`);
  if (!tests.includes(`${exportName}(`)) failures.push(`Sem teste direto para ${exportName}`);
}

for (const kind of ["tropa", "vp", "monopolio", "descoberta", "estradas", "marcha", "espiao"]) {
  if (!reducer.includes(`\"${kind}\"`)) failures.push(`Tipo de carta ausente do reducer: ${kind}`);
}

for (const scenario of [
  "buying a development card pays its cost",
  "new development cards mature into devOld",
  "a classic troop card is consumed",
  "Monopoly transfers every rival card",
  "Workers can grant the same resource twice",
  "Spy returns a private copy",
]) {
  if (!tests.includes(scenario)) failures.push(`Cenário de carta ausente nos testes: ${scenario}`);
}

if (!packageJson.scripts.test.includes("tests/development-card-reducer.test.js")) {
  failures.push("A suite principal não executa tests/development-card-reducer.test.js.");
}
if (!packageJson.scripts["verify:static"].includes("verify-development-card-reducer.cjs")) {
  failures.push("A verificação estática não executa verify-development-card-reducer.cjs.");
}

if (failures.length) {
  console.error("Falhas na extração das cartas de desenvolvimento:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log("Compra, maturação e utilização das cartas de desenvolvimento extraídas para reducer puro.");
