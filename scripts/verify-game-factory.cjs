const fs = require("node:fs");
const path = require("node:path");
const { readRuntimeSource } = require("./lib/runtime-source.cjs");

const root = path.resolve(__dirname, "..");
const legacy = readRuntimeSource(root);
const factory = fs.readFileSync(path.join(root, "src/game/gameFactory.js"), "utf8");
const geometry = fs.readFileSync(path.join(root, "src/game/boardGeometry.js"), "utf8");
const setup = fs.readFileSync(path.join(root, "src/game/gameSetupReducer.js"), "utf8");
const modes = fs.readFileSync(path.join(root, "src/game/gameModes.js"), "utf8");
const lobbyRules = fs.readFileSync(path.join(root, "src/game/lobbyRules.js"), "utf8");

const failures = [];
const requireText = (text, pattern, label) => {
  if (!text.includes(pattern)) failures.push(`Em falta: ${label}`);
};
const forbid = (text, pattern, label) => {
  if (pattern.test(text)) failures.push(`Ainda existe no legacy: ${label}`);
};

[
  "generateBoard",
  "generateDevelopmentDeck",
  "createPlayer",
  "createInitialGame",
  "createInitialTurnState",
].forEach((name) => requireText(factory, `export function ${name}`, name));

["ringCoords", "makeBoardGraph"].forEach((name) => requireText(geometry, `export function ${name}`, name));
requireText(setup, "export function reduceLobbyToSetup", "reducer lobby → setup");
requireText(modes, "export const GAME_MODE_CONFIG", "configuração central dos modos");
requireText(lobbyRules, 'from "./gameModes.js"', "capacidade do lobby derivada dos modos");
requireText(legacy, 'from "../game/gameFactory.js"', "import da fábrica inicial");
requireText(legacy, 'from "../game/gameSetupReducer.js"', "import do setup inicial");
requireText(legacy, 'from "../game/boardGeometry.js"', "import da geometria do tabuleiro");
requireText(legacy, "createInitialGame({", "criação inicial pelo módulo puro");
requireText(legacy, "reduceLobbyToSetup(current)", "transição inicial pelo reducer puro");

forbid(legacy, /function genBoard\s*\(/, "genBoard local");
forbid(legacy, /function genDeck\s*\(/, "genDeck local");
forbid(legacy, /function newGame\s*\(/, "newGame local");
forbid(legacy, /function mkPlayer\s*\(/, "mkPlayer local");
forbid(legacy, /function makeGraph\s*\(/, "makeGraph local");
forbid(legacy, /function ringCoords\s*\(/, "ringCoords local");

if (failures.length) {
  console.error("Falhou a verificação da criação inicial:\n- " + failures.join("\n- "));
  process.exit(1);
}
console.log("Criação inicial verificada: modos, mapas, baralhos, jogadores, geometria e lobby → setup.");
