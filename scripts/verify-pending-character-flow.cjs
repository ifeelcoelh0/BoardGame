const fs = require("node:fs");
const path = require("node:path");
const { readRuntimeSource } = require("./lib/runtime-source.cjs");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const factory = read("src/game/gameFactory.js");
const hostSession = read("src/multiplayer/hostSessionPresenceController.js");
const runtimeSource = readRuntimeSource(root);
const invariants = read("src/game/gameInvariants.js");
const lobby = read("src/ui/lobby/lobbyViewModel.js");
const bookControls = read("src/ui/lobby/pages/RealmPages.jsx");
const failures = [];

const requireText = (source, text, label) => {
  if (!source.includes(text)) failures.push(`Falta: ${label}`);
};
const rejectText = (source, text, label) => {
  if (source.includes(text)) failures.push(`Ainda existe: ${label}`);
};

requireText(factory, "createPlayer(characterId = null", "fábrica permite lugar pendente");
requireText(factory, "ch: characterId ?? null", "personagem pendente representada por null");
requireText(hostSession, "createPlayer(null, identity)", "convidado entra sem personagem provisória");
requireText(runtimeSource, "hostCharacterId: null", "anfitrião cria a sala sem personagem provisória");
rejectText(runtimeSource, "temporaryCharacter", "personagem temporária do anfitrião");
requireText(invariants, "pendingLobbyChoice", "invariantes aceitam null apenas no lobby pendente");
requireText(lobby, "Casa por escolher", "estado visual de casa pendente");
requireText(bookControls, "!hasConfirmedCharacter", "controlos bloqueados antes da confirmação");

if (failures.length) {
  console.error("Falhas no fluxo de personagem pendente:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}
console.log("Personagem pendente verificada: lugares sem casa provisória, invariantes seguras e controlos bloqueados.");
