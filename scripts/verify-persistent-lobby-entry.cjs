const fs = require("node:fs");
const assert = require("node:assert/strict");
const { readRuntimeSource } = require("./lib/runtime-source.cjs");

const runtimeSource = readRuntimeSource();
const experience = fs.readFileSync("src/ui/lobby/LobbyExperience.jsx", "utf8");
const dragonLobby = fs.readFileSync("src/ui/lobby/DragonLobby.jsx", "utf8");
const scene = fs.readFileSync("src/ui/lobby/LobbyScene.jsx", "utf8");
const codex = fs.readFileSync("src/ui/lobby/LobbyCodex.jsx", "utf8");

assert.match(runtimeSource, /LobbyExperience/);
assert.doesNotMatch(runtimeSource, /LobbyEntryShell/);
assert.match(experience, /<LobbyScene/);
assert.match(experience, /<LobbyCodex/);
assert.match(experience, /createLobbyViewModel/);
assert.match(experience, /Abrir o códice/);
assert.match(experience, /CODEX_PHASE/);
assert.doesNotMatch(experience, /entryContent|bookContent|bookViewport/);
assert.doesNotMatch(dragonLobby, /<LobbyScene|<LobbyCodex/);
assert.match(scene, /focusBook/);
assert.match(scene, /setBookRitual/);
assert.match(codex, /role="dialog"/);
console.log("Lobby persistente verificado: uma LobbyScene mantém o salão e o LobbyCodex concentra a interface de navegação.");
