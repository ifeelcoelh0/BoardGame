const fs = require("node:fs");
const path = require("node:path");
const { readRuntimeSource } = require("./lib/runtime-source.cjs");

const root = path.resolve(__dirname, "..");
const legacy = readRuntimeSource(root);
const gameScreen = fs.readFileSync(path.join(root, "src/ui/game/GameScreen.jsx"), "utf8");
const decisionModel = fs.readFileSync(path.join(root, "src/ui/game/gameDecisionModel.js"), "utf8");
const runtimeUi = `${legacy}\n${gameScreen}\n${decisionModel}`;
const resources = fs.readFileSync(path.join(root, "src/game/resources.js"), "utf8");
const buildings = fs.readFileSync(path.join(root, "src/game/buildingRules.js"), "utf8");
const tests = fs.readFileSync(path.join(root, "tests/resources-building.test.js"), "utf8");

const failures = [];
const requiredGameScreenImports = [
  'from "../../game/resources.js"',
  'from "../../game/buildingRules.js"',
  "BUILD_COSTS as COSTS",
  "RESOURCE_DEFINITIONS as RES",
  "validRoads",
  "validVillages",
];
for (const fragment of requiredGameScreenImports) {
  if (!gameScreen.includes(fragment)) failures.push(`Importação ausente no GameScreen: ${fragment}`);
}
if (!decisionModel.includes('from "../../game/buildingRules.js"') || !decisionModel.includes("bankRatio")) {
  failures.push("Decision System deixou de consumir bankRatio canónico.");
}

const forbiddenLegacyDeclarations = [
  "const RES = {",
  "const COSTS = {",
  "const LIMITS = {",
  "const handSize =",
  "const canPay =",
  "const payCost =",
  "function validRoads(",
  "function validVillages(",
  "function validPalaces(",
  "function pieceCount(",
  "function activePorts(",
  "function bankRatio(",
];
for (const fragment of forbiddenLegacyDeclarations) {
  if (runtimeUi.includes(fragment)) failures.push(`Regra de domínio duplicada ainda existe na camada React: ${fragment}`);
}

for (const exportName of [
  "RESOURCE_DEFINITIONS",
  "RESOURCE_KEYS",
  "BUILD_COSTS",
  "PIECE_LIMITS",
  "handSize",
  "canPay",
  "payCost",
]) {
  if (!resources.includes(`export const ${exportName}`) && !resources.includes(`export function ${exportName}`)) {
    failures.push(`Export de recursos ausente: ${exportName}`);
  }
}

for (const exportName of [
  "validRoads",
  "validVillages",
  "validPalaces",
  "pieceCount",
  "activePorts",
  "bankRatio",
]) {
  if (!buildings.includes(`export function ${exportName}`)) failures.push(`Export de construção ausente: ${exportName}`);
  if (!tests.includes(`${exportName}(`) && !tests.includes(`${exportName},`)) failures.push(`Sem teste direto: ${exportName}`);
}

if (failures.length) {
  console.error("Falhas na extração das regras de recursos/construção:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log("Recursos e regras de construção extraídos do legacy e cobertos por testes puros.");
