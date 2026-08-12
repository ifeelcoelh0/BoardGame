const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { readRuntimeSource, runtimeSourcePaths } = require("./lib/runtime-source.cjs");

const root = path.resolve(__dirname, "..");
const identityPath = path.join(root, "src/game/playerIdentity.js");
const lobbyRulesPath = path.join(root, "src/game/lobbyRules.js");
const factoryPath = path.join(root, "src/game/gameFactory.js");
const runtimeSource = readRuntimeSource(root);
const factorySource = fs.readFileSync(factoryPath, "utf8");
const identitySource = fs.readFileSync(identityPath, "utf8");
const hostSessionSource = fs.readFileSync(path.join(root, "src/multiplayer/hostSessionPresenceController.js"), "utf8");
const foyerPagesSource = fs.readFileSync(path.join(root, "src/ui/lobby/pages/foyer/ModePage.jsx"), "utf8");
const errors = [];

const requireText = (text, label, source = runtimeSource) => {
  if (!source.includes(text)) errors.push(`Falta: ${label}`);
};
const rejectText = (text, label) => {
  if (runtimeSource.includes(text)) errors.push(`Ainda existe: ${label}`);
};

requireText("const createRealm = async (selectedMode) =>", "criação direta a partir do modo");
/* A escolha do modo passou do JSX inline do monólito para a página de modos do
   livro, que chama o callback fornecido pelo monólito. */
requireText("foyer.onCreate(selectedMode.id)", "criação do reino após confirmar o modo", foyerPagesSource);
requireText('data-testid="create-realm-submit"', "confirmação explícita do modo", foyerPagesSource);
requireText("session.createRealm(selectedMode)", "App liga o callback à criação do reino");
requireText("const player = createPlayer(null, identity)", "lugar criado sem personagem provisória", hostSessionSource);
requireText("void takeSeat()", "reserva automática de lugar para novos convidados");
if (!factorySource.includes("characterConfirmed: identity.characterConfirmed === true")) errors.push("Falta: confirmação persistente da personagem");
requireText("LOBBY_ACTION.SELECT_CHARACTER", "confirmação autoritativa ao escolher na galeria");
/* A galeria já não depende de um estado de intenção próprio: abre porque o stage
   é CHARACTER_SELECTION, e este é definido a partir do `characterConfirmed`
   autoritativo do jogo. */
requireText("navigate(confirmed ? APP_STAGE.LOBBY : APP_STAGE.CHARACTER_SELECTION)", "galeria derivada da confirmação oficial");
requireText('stage === APP_STAGE.JOINING_ROOM', "ecrã transitório de entrada");
requireText('stage === APP_STAGE.SESSION_REQUIRED', "ecrã de sessão inválida");
rejectText('screen === "create"', "seletor de personagem antes de criar o lobby");
rejectText('setScreen("seats")', "seletor de lugar/personagem antes do lobby");
rejectText("hTakeSeat(ch.id)", "escolha de personagem no pedido de lugar");
rejectText("m.chId", "personagem escolhida pelo cliente no pedido de entrada");
rejectText("lobbyIntroCode", "ref lida durante o render para abrir a galeria");

if (!identitySource.includes("IDENTITY_PROTOCOL_VERSION = 11"))
  errors.push("O protocolo de identidade devia estar na versão 11.");
if (!identitySource.includes('player.characterConfirmed = true'))
  errors.push("Saves anteriores não são migrados para personagem confirmada.");

(async () => {
  const rules = await import(pathToFileURL(lobbyRulesPath).href + `?v=${Date.now()}`);
  const base = {
    phase: "lobby",
    mode: "dragao",
    players: Array.from({ length: 4 }, () => ({ ready: true, characterConfirmed: true })),
  };
  const allowed = rules.getLobbyStartStatus(base, 0);
  if (!allowed.allowed) errors.push("Lobby confirmado e pronto devia poder começar.");

  const pendingCharacter = structuredClone(base);
  pendingCharacter.players[2].characterConfirmed = false;
  const blocked = rules.getLobbyStartStatus(pendingCharacter, 0);
  if (blocked.allowed || blocked.reason !== "CHARACTERS_NOT_CONFIRMED")
    errors.push("Lobby devia bloquear início enquanto houver personagem por confirmar.");

  if (errors.length) {
    console.error("Falhas na entrada direta no lobby:");
    errors.forEach((error) => console.error(`- ${error}`));
    process.exit(1);
  }

  console.log("Entrada direta verificada: lugar automático sem personagem provisória e confirmação na galeria.");
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
