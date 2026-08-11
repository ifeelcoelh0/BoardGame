const fs = require("node:fs");
const assert = require("node:assert/strict");
const { readRuntimeSource } = require("./lib/runtime-source.cjs");

const appFlow = fs.readFileSync("src/ui/appFlow.js", "utf8");
const runtimeSource = readRuntimeSource();
const lobbyScene = fs.readFileSync("src/ui/lobby/LobbyScene.jsx", "utf8");

assert.match(appFlow, /CHARACTER_SELECTION:\s*"character-selection"/);
assert.match(appFlow, /LOBBY:\s*"lobby"/);
assert.match(appFlow, /stageForAuthenticatedGame/);
assert.match(appFlow, /characterConfirmed === true/);
assert.match(runtimeSource, /APP_STAGE\.CHARACTER_SELECTION/);
assert.match(runtimeSource, /stageForAuthenticatedGame/);
assert.match(runtimeSource, /navigate\(APP_STAGE\.LOBBY\)/);
assert.match(runtimeSource, /onSwapCharacter=\{\(\) => \{[^}]*navigate\(APP_STAGE\.CHARACTER_SELECTION\)/);
assert.match(lobbyScene, /focusSelection/);
assert.match(lobbyScene, /resetCamera/);

console.log("Fluxo de personagem verificado: seleção autoritativa, foco na parede e regresso ao lobby.");
