const fs = require("node:fs");
const path = require("node:path");
const { readRuntimeSource } = require("./lib/runtime-source.cjs");

const root = path.resolve(__dirname, "..");
const legacy = readRuntimeSource(root);
const reducer = fs.readFileSync(path.join(root, "src/game/diceReducer.js"), "utf8");
const actionReducer = fs.readFileSync(path.join(root, "src/game/gameActionReducer.js"), "utf8");
const tests = fs.readFileSync(path.join(root, "tests/dice-reducer.test.js"), "utf8");
const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));

const failures = [];
for (const fragment of ['from "./diceReducer.js"', "reduceDiceRoll", "rollDicePair"]) {
  if (!actionReducer.includes(fragment)) failures.push(`Integração dos dados ausente no reducer central: ${fragment}`);
}
if (legacy.includes("function doRoll(")) failures.push("O wrapper legacy do lançamento ainda existe.");

for (const fragment of [
  "const d1 = 1 + rnd(6)",
  "_s.rolls[n] = (_s.rolls[n] || 0) + 1",
  "g.turn.rolled = true;",
  "g.turn.dice = [d1, d2];",
]) {
  const doRollStart = legacy.indexOf("function doRoll(g, gr)");
  const doRollEnd = legacy.indexOf("\nfunction validDragonHexes", doRollStart);
  const doRoll = legacy.slice(doRollStart, doRollEnd);
  if (doRoll.includes(fragment)) failures.push(`Mutação antiga ainda existe em doRoll: ${fragment}`);
}

for (const exportName of ["rollDie", "rollDicePair", "recordDiceStats", "reduceDiceRoll"]) {
  if (!reducer.includes(`export function ${exportName}`)) failures.push(`Export do reducer de dados ausente: ${exportName}`);
  if (!tests.includes(`${exportName}(`)) failures.push(`Sem teste direto para ${exportName}`);
}

for (const scenario of [
  "classic seven",
  "war seven",
  "Bones unit",
  "extreme rolls",
  "input untouched",
]) {
  if (!tests.includes(scenario)) failures.push(`Cenário de dados não documentado nos testes: ${scenario}`);
}

if (!packageJson.scripts.test.includes("tests/dice-reducer.test.js")) {
  failures.push("A suite principal não executa tests/dice-reducer.test.js.");
}
if (!packageJson.scripts["verify:static"].includes("verify-dice-reducer.cjs")) {
  failures.push("A verificação estática não executa verify-dice-reducer.cjs.");
}

if (failures.length) {
  console.error("Falhas na extração do lançamento/resolução dos dados:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log("Lançamento, estatísticas e resolução do 7 extraídos para reducer puro e cobertos por testes.");
