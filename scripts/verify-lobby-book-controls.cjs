const fs = require("node:fs");
const assert = require("node:assert/strict");

/* The 3D book is ritual only. All functional room controls live in LobbyCodex. */
const experience = fs.readFileSync("src/ui/lobby/LobbyExperience.jsx", "utf8");
const dragon = fs.readFileSync("src/ui/lobby/DragonLobby.jsx", "utf8");
const codex = fs.readFileSync("src/ui/lobby/LobbyCodex.jsx", "utf8");
const realmPages = fs.readFileSync("src/ui/lobby/pages/RealmPages.jsx", "utf8");
const css = fs.readFileSync("src/styles/lobby-codex.css", "utf8");

assert.ok(!fs.existsSync("src/ui/lobby/LobbyBook.jsx"), "a UI ancorada ao livro 3D deve ter sido removida");
assert.ok(!fs.existsSync("src/ui/lobby/bookViewport.js"), "a projecção HTML→folha 3D deve ter sido removida");
assert.match(experience, /<LobbyCodex/);
assert.doesNotMatch(dragon, /<LobbyCodex|<LobbyBook/, "o códice é desenhado uma só vez pelo LobbyExperience");
assert.match(codex, /rd-lobby-codex/);
assert.match(realmPages, /data-testid="room-code"/);
assert.match(realmPages, /data-testid="ready-toggle"/);
assert.match(realmPages, /data-testid="start-game"/);
assert.match(realmPages, /Confirmar expulsão/);
assert.match(realmPages, /onTogglePerks/);
assert.match(realmPages, /title=\{localPlayer\?\.character\?\.n \?\? "Casa por escolher"\}[\s\S]*onSwapCharacter/, "Trocar/Escolher casa deve estar na primeira página do reino");
assert.match(realmPages, /onLeave/);
assert.match(css, /\.rd-lobby-codex/);
assert.match(css, /\.rd-entry-book-access/);

console.log("Códice único verificado: controlos do reino em 2D, livro 3D sem UI duplicada.");
