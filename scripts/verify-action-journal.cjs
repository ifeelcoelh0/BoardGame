const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const journalPath = path.join(root, "src", "game", "actionJournal.js");
const hostPath = path.join(root, "src", "multiplayer", "hostActionController.js");
const botPath = path.join(root, "src", "multiplayer", "hostBotController.js");
const viewPath = path.join(root, "src", "game", "gameStateView.js");
const replayPath = path.join(root, "src", "game", "replayVerifier.js");
const testPath = path.join(root, "tests", "action-journal.test.js");
const replayTestPath = path.join(root, "tests", "replay-verifier.test.js");

for (const file of [journalPath, hostPath, botPath, viewPath, replayPath, testPath, replayTestPath]) {
  if (!fs.existsSync(file)) throw new Error(`Ficheiro em falta: ${file}`);
}

const journal = fs.readFileSync(journalPath, "utf8");
const host = fs.readFileSync(hostPath, "utf8");
const bot = fs.readFileSync(botPath, "utf8");
const view = fs.readFileSync(viewPath, "utf8");
const replay = fs.readFileSync(replayPath, "utf8");

for (const symbol of [
  "ACTION_JOURNAL_VERSION",
  "appendAcceptedGameAction",
  "createActionExecutionTrace",
  "hashReplayState",
  "stateHashBefore",
  "stateHashAfter",
  "randomValues",
  "generatedIds",
]) {
  if (!journal.includes(symbol)) throw new Error(`Action journal incompleto: ${symbol}`);
}
if (!host.includes("appendAcceptedGameAction") || !host.includes("createActionExecutionTrace")) {
  throw new Error("Ações humanas não passam pelo action journal autoritativo.");
}
if (!bot.includes("appendAcceptedGameAction") || !bot.includes("ACTION_SOURCE.BOT")) {
  throw new Error("Ações dos bots não passam pelo action journal autoritativo.");
}
if (!view.includes('key !== "actionJournal"')) {
  throw new Error("O action journal privado pode escapar pelas vistas multiplayer.");
}
for (const symbol of [
  "ACTION_REPLAY_FORMAT",
  "ACTION_REPLAY_VISIBILITY",
  "createActionReplayPackage",
  "parseActionReplayPackage",
  "verifyActionReplay",
  "RNG_TRACE_EXHAUSTED",
  "STATE_AFTER_MISMATCH",
  "checkpointState",
]) {
  if (!replay.includes(symbol)) throw new Error(`Replay verifier incompleto: ${symbol}`);
}
if (!journal.includes("checkpointState")) {
  throw new Error("O action journal não preserva checkpoints para mutações autoritativas entre ações.");
}
console.log("Action journal/replay verificado: ações humanas/bots, RNG/IDs, fingerprints, checkpoints, replay determinístico e redacção host-private.");
