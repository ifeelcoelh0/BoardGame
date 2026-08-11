const fs = require("node:fs");
const path = require("node:path");
const { readRuntimeSource } = require("./lib/runtime-source.cjs");

const root = path.resolve(__dirname, "..");
const legacy = readRuntimeSource(root);
const scoring = fs.readFileSync(path.join(root, "src/game/scoringReducer.js"), "utf8");
const development = fs.readFileSync(path.join(root, "src/game/developmentCardReducer.js"), "utf8");
const warAutomation = fs.readFileSync(path.join(root, "src/game/warAutomationReducer.js"), "utf8");
const actionReducer = fs.readFileSync(path.join(root, "src/game/gameActionReducer.js"), "utf8");

const failures = [];
const requireText = (text, pattern, label) => {
  if (!text.includes(pattern)) failures.push(`Em falta: ${label}`);
};
const forbid = (text, pattern, label) => {
  if (pattern.test(text)) failures.push(`Ainda existe no legacy: ${label}`);
};

[
  "scoreBreakdown",
  "calculateVictoryPoints",
  "longestRoadLength",
  "determineLongestRoadAward",
  "determineLargestArmyAward",
  "reduceScoringAwards",
  "reduceStandardVictory",
  "reduceRoundLimitVictory",
  "reduceScoringAfterAction",
  "rankPlayers",
].forEach((name) => requireText(scoring, `export function ${name}`, name));

requireText(legacy, 'from "../game/scoringReducer.js"', "import do reducer de pontuação");
requireText(actionReducer, "reduceScoringAfterAction", "pontuação depois das ações no reducer central");
requireText(actionReducer, "reduceRoundLimitVictory", "fim autoritativo por rondas no reducer central");
requireText(development, 'from "./scoringReducer.js"', "Maior Exército partilhado pelas cartas");
requireText(warAutomation, 'from "./scoringReducer.js"', "pontuação pública partilhada pela horda");

forbid(legacy, /function calcVP\s*\(/, "calcVP local");
forbid(legacy, /function longestRoadLen\s*\(/, "longestRoadLen local");
forbid(legacy, /function updLR\s*\(/, "updLR local");
forbid(legacy, /function updLA\s*\(/, "updLA local");
forbid(legacy, /function maybeWin\s*\(/, "maybeWin local");
forbid(legacy, /function endByRounds\s*\(/, "endByRounds local");
forbid(development, /function computeLargestArmy\s*\(/, "computeLargestArmy duplicado");
forbid(warAutomation, /function buildingScore\s*\(/, "buildingScore duplicado");

if (failures.length) {
  console.error("Falhou a verificação da pontuação:\n- " + failures.join("\n- "));
  process.exit(1);
}
console.log("Pontuação verificada: prémios, pontos secretos, vitória, rondas e desempate estável.");
