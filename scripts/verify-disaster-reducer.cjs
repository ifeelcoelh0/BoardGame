const fs = require("node:fs");
const path = require("node:path");
const { readRuntimeSource } = require("./lib/runtime-source.cjs");

const root = path.resolve(__dirname, "..");
const legacy = readRuntimeSource(root);
const gameScreen = fs.readFileSync(path.join(root, "src/ui/game/GameScreen.jsx"), "utf8");
const reducer = fs.readFileSync(path.join(root, "src/game/disasterReducer.js"), "utf8");
const actionReducer = fs.readFileSync(path.join(root, "src/game/gameActionReducer.js"), "utf8");
const mandatory = fs.readFileSync(path.join(root, "src/game/mandatoryDecisionReducer.js"), "utf8");
const tests = fs.readFileSync(path.join(root, "tests/disaster-reducer.test.js"), "utf8");
const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));

const failures = [];
if (!gameScreen.includes('DISASTER_DEFINITIONS as DISASTERS')) failures.push("A apresentação dos desastres deixou de usar as definições canónicas.");
for (const fragment of ['from "./disasterReducer.js"', "reduceDisaster"]) {
  if (!actionReducer.includes(fragment)) failures.push(`Integração dos desastres ausente no reducer central: ${fragment}`);
}
if (legacy.includes("function doDisaster(")) failures.push("O wrapper legacy de desastres ainda existe.");
for (const fragment of ["reduceTsunamiPortChoice", "reduceTributeResourceChoice"]) {
  if (!mandatory.includes(fragment)) failures.push(`Integração das decisões de desastre ausente: ${fragment}`);
}

const runtimeUi = `${legacy}\n${gameScreen}`;
for (const forbidden of [
  "function doDisaster(",
  "lootBag",
  ".sick = 2",
  'g.queue.push({ t: "tsunami"',
  'g.queue.push({ t: "tributo"',
  "const type = pick(Object.keys(DISASTERS))",
]) {
  if (runtimeUi.includes(forbidden)) failures.push(`Regra antiga de desastre ainda existe na camada React: ${forbidden}`);
}

if (/const\s+DISASTERS\s*=/.test(runtimeUi)) {
  failures.push("As definições de desastres continuam duplicadas no JSX.");
}

for (const exportName of [
  "protectedPlayerIndexes",
  "reduceDisaster",
  "reduceTsunamiPortChoice",
  "reduceTributeResourceChoice",
]) {
  if (!reducer.includes(`export function ${exportName}`)) failures.push(`Export ausente: ${exportName}`);
  if (!tests.includes(`${exportName}(`)) failures.push(`Sem teste direto para ${exportName}`);
}

for (const type of ["ganancia", "peste", "tsunami", "tributo"]) {
  if (!reducer.includes(`${type}: Object.freeze`)) failures.push(`Definição de desastre ausente: ${type}`);
}

for (const scenario of [
  "formerly unreachable royal tribute",
  "greed removes random resources",
  "plague quarantines",
  "tsunami queues a choice",
  "immune players are not affected",
]) {
  if (!tests.includes(scenario)) failures.push(`Cenário de desastre ausente nos testes: ${scenario}`);
}

if (!packageJson.scripts.test.includes("tests/disaster-reducer.test.js")) {
  failures.push("A suite principal não executa tests/disaster-reducer.test.js.");
}
if (!packageJson.scripts["verify:static"].includes("verify-disaster-reducer.cjs")) {
  failures.push("A verificação estática não executa verify-disaster-reducer.cjs.");
}

if (failures.length) {
  console.error("Falhas na extração dos desastres:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log("Ganância, Peste, Tsunami e Tributo extraídos para reducer puro e cobertos por testes.");
