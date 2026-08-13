const fs = require("node:fs");
const path = require("node:path");
const { readRuntimeSource } = require("./lib/runtime-source.cjs");

const root = path.resolve(__dirname, "..");
const legacy = readRuntimeSource(root);
const construction = fs.readFileSync(path.join(root, "src/game/constructionReducer.js"), "utf8");
const production = fs.readFileSync(path.join(root, "src/game/productionReducer.js"), "utf8");
const dice = fs.readFileSync(path.join(root, "src/game/diceReducer.js"), "utf8");
const actionReducer = fs.readFileSync(path.join(root, "src/game/gameActionReducer.js"), "utf8");
const tests = fs.readFileSync(path.join(root, "tests/construction-production-reducers.test.js"), "utf8");
const boardVisuals = fs.readFileSync(path.join(root, "src/ui/board/boardVisualConfig.js"), "utf8");

const failures = [];
for (const fragment of ["reduceRoadConstruction", "reduceVillageConstruction", "reducePalaceConstruction"]) {
  if (!actionReducer.includes(fragment)) failures.push(`Integração ausente no reducer central: ${fragment}`);
}


if (!dice.includes('from "./productionReducer.js"') || !dice.includes("reduceProduction")) {
  failures.push("O reducer de dados não reutiliza productionReducer.js.");
}
if (!actionReducer.includes('from "./diceReducer.js"') || !actionReducer.includes("reduceDiceRoll")) {
  failures.push("O reducer central não chega à produção através do reducer de dados.");
}

for (const fragment of [
  "function produce(",
  "function buildRoad(",
  "function buildVillage(",
  "function buildPalace(",
  "function advanceSetup(",
]) {
  if (legacy.includes(fragment)) failures.push(`Mutador duplicado ainda existe no legacy: ${fragment}`);
}

for (const exportName of [
  "advanceSetupState",
  "reduceRoadConstruction",
  "reduceVillageConstruction",
  "reducePalaceConstruction",
  "terrainResource",
]) {
  if (!construction.includes(`export function ${exportName}`)) failures.push(`Export de construção ausente: ${exportName}`);
  if (!tests.includes(`${exportName}(`)) failures.push(`Sem teste direto para ${exportName}`);
}

for (const exportName of ["calculateProduction", "reduceProduction"]) {
  if (!production.includes(`export function ${exportName}`)) failures.push(`Export de produção ausente: ${exportName}`);
  if (!tests.includes(`${exportName}(`)) failures.push(`Sem teste direto para ${exportName}`);
}

if (!boardVisuals.includes("res: TERRAIN_RESOURCE_BY_TYPE.floresta")) {
  failures.push("O catálogo visual de terrenos não deriva do mapa canónico de recursos.");
}
if (!tests.includes("does not mutate") && !tests.includes("immutably")) {
  failures.push("A suite não documenta imutabilidade dos reducers.");
}

if (failures.length) {
  console.error("Falhas na extração dos reducers de construção/produção:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log("Reducers puros de construção e produção extraídos, integrados e cobertos por testes.");
