const fs = require("node:fs");
const path = require("node:path");
const { readRuntimeSource } = require("./lib/runtime-source.cjs");

const root = path.resolve(__dirname, "..");
const runtimeSource = readRuntimeSource(root);
const gameScreen = fs.readFileSync(path.join(root, "src/ui/game/GameScreen.jsx"), "utf8");
const actionModel = fs.readFileSync(path.join(root, "src/ui/game/gameActionModel.js"), "utf8");
const interactionGuards = fs.readFileSync(path.join(root, "src/ui/game/gameInteractionGuards.js"), "utf8");
const warUi = `${gameScreen}\n${actionModel}\n${interactionGuards}`;
const presenter = fs.readFileSync(path.join(root, "src/presentation/gamePresenter.js"), "utf8");
const reducer = fs.readFileSync(path.join(root, "src/game/warReducer.js"), "utf8");
const actionReducer = fs.readFileSync(path.join(root, "src/game/gameActionReducer.js"), "utf8");
const tests = fs.readFileSync(path.join(root, "tests/war-reducer.test.js"), "utf8");
const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));

const failures = [];

if (!warUi.includes('from "../../game/warReducer.js"')) failures.push("A UI do modo Guerra não está ligada aos helpers do reducer.");
if (!presenter.includes("function presentWarActionEvent")) failures.push("A apresentação do modo Guerra não está no presenter dedicado.");
for (const fragment of ["reduceTroopRecruitment", "reduceUnitDeployment", "reduceUnitAction", "reduceUnitBribe"]) {
  if (!actionReducer.includes(fragment)) failures.push(`Integração do modo Guerra ausente no reducer central: ${fragment}`);
}

for (const legacyFragment of [
  "function troopCost(",
  "function validDeployHexes(",
  "function unitTargets(",
  "function deployUnit(",
  "function dieOrRise(",
  "function unitAction(",
  "function buyTroop(",
  "function pushDest(",
  "function bribeTargets(",
  "function bribe(",
  "function trollAttack(",
  "function defeatGiant(",
  "const TCOSTS =",
  "const UBEATS =",
]) {
  if (runtimeSource.includes(legacyFragment) || gameScreen.includes(legacyFragment) || actionModel.includes(legacyFragment)) {
    failures.push(`Regra militar antiga ainda existe fora do reducer: ${legacyFragment}`);
  }
}

for (const exportName of [
  "troopCost",
  "validDeployHexes",
  "unitTargets",
  "bribeTargets",
  "reduceTroopRecruitment",
  "reduceUnitDeployment",
  "reduceUnitAction",
  "reduceUnitBribe",
]) {
  if (!reducer.includes(`export function ${exportName}`)) failures.push(`Export militar ausente: ${exportName}`);
  if (!tests.includes(`${exportName}(`)) failures.push(`Sem teste direto para ${exportName}`);
}

for (const eventType of [
  "TROOP_RECRUITED",
  "UNIT_DEPLOYED",
  "UNIT_MOVED",
  "UNIT_COMBAT_RESOLVED",
  "TROLL_GIANT_ATTACKED",
  "TROLL_RAIDER_DEFEATED",
  "UNIT_BRIBED",
]) {
  if (!reducer.includes(`"${eventType}"`)) failures.push(`Evento militar ausente: ${eventType}`);
}

for (const scenario of [
  "troop costs apply Vlad and Bones perks",
  "deployment consumes one military action",
  "Makuru moves for free",
  "Protheus gains exactly one bonus move",
  "archers kill a vulnerable unit",
  "equal troops destroy each other",
  "attacking the giant records damage",
  "defeating a raider moves melee units",
  "moving the last siege catapult releases",
  "Romeo can bribe",
]) {
  if (!tests.includes(scenario)) failures.push(`Cenário militar ausente nos testes: ${scenario}`);
}

if (!reducer.includes("export function releaseInvalidOccupations")) {
  failures.push("A libertação de ocupações inválidas não está exportada para os automatismos de Guerra.");
}
if (!packageJson.scripts.test.includes("tests/war-reducer.test.js")) {
  failures.push("A suite principal não executa tests/war-reducer.test.js.");
}
if (!packageJson.scripts["verify:static"].includes("verify-war-reducer.cjs")) {
  failures.push("A verificação estática não executa verify-war-reducer.cjs.");
}

if (failures.length) {
  console.error("Falhas na extração do modo Guerra:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log("Modo Guerra: recrutamento, destaque, movimento, combate, Troll e Suborno extraídos.");
