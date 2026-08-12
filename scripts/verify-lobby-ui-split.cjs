const fs = require("node:fs");
const assert = require("node:assert/strict");

const read = (path) => fs.readFileSync(path, "utf8");
const ui = read("src/ui/lobby/DragonLobby.jsx");
const experience = read("src/ui/lobby/LobbyExperience.jsx");
const scene = read("src/ui/lobby/LobbyScene.jsx");
const controller = read("src/ui/lobby/lobbySceneController.js");
const textures = read("src/ui/lobby/lobbySceneTextures.js");
const decorations = read("src/ui/lobby/lobbySceneDecorations.js");
const actors = read("src/ui/lobby/lobbySceneActors.js");
const gallery = read("src/ui/lobby/lobbySceneGallery.js");
const book = read("src/ui/lobby/lobbySceneBook.js");
const panels = read("src/ui/lobby/LobbyPanels.jsx");
const codex = read("src/ui/lobby/LobbyCodex.jsx");
const foyerPages = read("src/ui/lobby/pages/FoyerPages.jsx");
const foyerPageSources = [
  "HomePage.jsx",
  "ModePage.jsx",
  "JoinPage.jsx",
  "SavedRealmsPage.jsx",
].map((file) => read(`src/ui/lobby/pages/foyer/${file}`));
const realmPages = read("src/ui/lobby/pages/RealmPages.jsx");

assert.ok(ui.length < 20000, "DragonLobby.jsx voltou a crescer para além da camada de UI");
assert.ok(scene.length < 12000, "LobbyScene.jsx voltou a absorver o controller Three.js");
assert.ok(controller.length < 32000, "lobbySceneController.js voltou a crescer para além da orquestração");
assert.match(experience, /from "\.\/LobbyScene\.jsx"/);
assert.match(experience, /from "\.\/LobbyCodex\.jsx"/);
assert.doesNotMatch(ui, /from "\.\/LobbyScene\.jsx"/);
assert.doesNotMatch(ui, /LobbyCodex|LobbyBook/, "DragonLobby não deve desenhar o códice");
assert.match(ui, /from "\.\/LobbyPanels\.jsx"/);
assert.match(codex, /from "\.\/pages\/FoyerPages\.jsx"/);
assert.match(codex, /from "\.\/pages\/RealmPages\.jsx"/);
assert.ok(foyerPages.length < 3000, "FoyerPages.jsx deve permanecer uma fachada pequena");
for (const source of foyerPageSources) assert.ok(source.length < 7000, "uma página do foyer voltou a crescer para além da sua responsabilidade");
assert.ok(realmPages.length < 20000, "RealmPages.jsx cresceu para além das páginas do reino");
assert.doesNotMatch(ui, /new THREE\.|WebGLRenderer|createLobbyScene/);
assert.match(scene, /export default function LobbyScene/);
assert.match(scene, /from "\.\/lobbySceneController\.js"/);
assert.doesNotMatch(scene, /WebGLRenderer|new THREE\./);
assert.match(controller, /WebGLRenderer/);
assert.match(controller, /disposeObjectTree\(scene\)/);
assert.match(textures, /createWoodTexture/);
assert.match(decorations, /addFireplace/);
assert.match(actors, /createSeatActor/);
assert.match(gallery, /addCharacterSelectionWall/);
assert.match(actors, /addSeatIndicators/);
assert.match(book, /createGameBook/);
assert.match(book, /setRitualState/);
assert.doesNotMatch(book, /turningLeaf/, "o livro 3D final não deve reintroduzir a folha suspensa");
assert.match(textures, /Brasão dracónico/);
assert.match(textures, /Mapa esquemático/);
assert.match(book, /createRoomCodeTexture/);
assert.match(textures, /export function createRoomCodeTexture/);
assert.match(read("src/ui/lobby/lobbySceneScroll.js"), /createCharacterScroll/);
assert.match(panels, /export function LobbyChat/);
assert.match(codex, /export default function LobbyCodex/);
assert.ok(!fs.existsSync("src/ui/lobby/bookViewport.js"));
assert.match(experience, /clearTimeout\(copyResetTimerRef\.current\)/);

console.log("Lobby UI dividido: ritual 3D, códice 2D, galeria, painéis e controller separados.");
