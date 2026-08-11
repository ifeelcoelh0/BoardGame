const fs = require('node:fs');
const assert = require('node:assert/strict');
const { readRuntimeSource } = require("./lib/runtime-source.cjs");
const runtimeSource = readRuntimeSource();
const flow = fs.readFileSync('src/ui/appFlow.js', 'utf8');
const experience = fs.readFileSync('src/ui/lobby/LobbyExperience.jsx', 'utf8');
const dragon = fs.readFileSync('src/ui/lobby/DragonLobby.jsx', 'utf8');
const book = fs.readFileSync('src/ui/lobby/bookState.js', 'utf8');
const lobbyFiles = fs.readdirSync('src/ui/lobby').filter((name) => name.endsWith('.jsx'));
const sceneMounts = lobbyFiles.reduce((count, name) => {
  const source = fs.readFileSync(`src/ui/lobby/${name}`, 'utf8');
  return count + (source.match(/<LobbyScene\b/g) || []).length;
}, 0);
assert.equal(sceneMounts, 1, 'deve existir exatamente uma montagem React de LobbyScene');
assert.match(experience, /<LobbyScene/);
assert.match(experience, /<DragonLobby/);
assert.doesNotMatch(dragon, /<LobbyScene/);
// As páginas passaram a viver no registo; o bookState reexporta-as.
const pages = fs.readFileSync('src/ui/lobby/bookPages.js', 'utf8');
assert.match(pages, /MODE: "mode"/);
assert.match(pages, /JOIN: "join"/);
assert.match(pages, /SAVED_REALMS: "saved-realms"/);
assert.match(book, /export \{ BOOK_PAGE, BOOK_SCOPE \} from "\.\/bookPages\.js"/);
assert.doesNotMatch(flow, /MODE_SELECTION|SAVED_REALMS|JOIN_ROOM/);
assert.doesNotMatch(runtimeSource, /swapUi|showEntryFlow|LobbyEntryShell/);
assert.match(runtimeSource, /const startHostTransport =/);
assert.match(runtimeSource, /const installHostGame =/);
assert.doesNotMatch(runtimeSource, /g = currentLocal|installPreparedHostGame/);
/* A selecção deixou de ter estado próprio: o stage é a única fonte de verdade,
   o que também remove a ratoeira de não haver saída antes de confirmar. */
assert.match(runtimeSource, /isSelectingCharacter=\{stage === APP_STAGE\.CHARACTER_SELECTION\}/);
assert.doesNotMatch(runtimeSource, /setCharacterSelectionIntent/);
console.log('LobbyExperience consolidado: uma cena, páginas separadas, seleção explícita e transporte desacoplado.');
