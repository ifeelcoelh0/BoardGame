const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const failures = [];

function requireText(source, text, label) {
  if (!source.includes(text)) failures.push(`Falta ${label}: ${text}`);
}

const recovery = read("src/game/gameRecovery.js");
const session = read("src/app/useRealmSession.js");
const tests = read("tests/game-recovery.test.js");
const browserRecovery = read("cypress/e2e/recovery.cy.js");

requireText(recovery, "export function recoverSavedGameForHost", "ponto canónico de recuperação");
requireText(recovery, "export function normalizeGameTurnPresence", "normalização central da presença por turno");
requireText(recovery, "reduceTradeForDisconnectedPlayer", "limpeza de trocas durante recovery");
requireText(recovery, "report.rematchReadyCleared", "limpeza de readiness efémero do rematch");
requireText(recovery, "report.requiredActorIndex = normalizeGameTurnPresence", "reconstrução da janela do ator obrigatório");
requireText(session, 'from "../game/gameRecovery.js"', "integração do recovery na sessão");
requireText(session, "recoverSavedGameForHost(sourceGame", "uso do recovery antes de arrancar o host");
requireText(tests, "mandatory decisions survive reload", "teste de decisões obrigatórias");
requireText(tests, "bot takeover survives host recovery", "teste de takeover por bot");
requireText(tests, "action journal untouched", "teste de preservação do journal");
requireText(browserRecovery, "reloads a real autosave during setup", "recovery real por reload no Cypress");
requireText(browserRecovery, "mandatory decisions intact", "recovery browser de decisões obrigatórias");
requireText(browserRecovery, "recovery checkpoint", "continuação do Action Journal após resume no browser");
requireText(browserRecovery, '["guerra", "exploracao"]', "recovery browser dos modos Guerra e Exploração");

if (session.includes("const normalizeGameTurnPresence =")) {
  failures.push("useRealmSession voltou a definir a normalização de recovery localmente.");
}

if (failures.length) {
  console.error("Falhas na verificação do recovery central:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Recovery central verificado: setup/turno, decisões, trocas, bots, rematch, Action Journal e matriz Cypress de resume.");
