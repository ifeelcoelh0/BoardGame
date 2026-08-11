const fs = require("node:fs");
const path = require("node:path");
const { readRuntimeSource } = require("./lib/runtime-source.cjs");

const root = path.resolve(__dirname, "..");
const source = readRuntimeSource(root);
const pendingStore = fs.readFileSync(path.join(root, "src/multiplayer/pendingActionStore.js"), "utf8");
const clientActions = fs.readFileSync(path.join(root, "src/multiplayer/clientActionController.js"), "utf8");
const failures = [];
const requireText = (text, label, haystack = source) => {
  if (!haystack.includes(text)) failures.push(`Falta: ${label}`);
};

requireText("sendPendingGameAction", "reenvio controlado das ações de jogo", clientActions);
requireText("sendPendingLobbyAction", "reenvio controlado das ações de lobby", clientActions);
requireText("active.attempts || 0) < this.maxAttempts", "limite de repetição configurável", pendingStore);
requireText("connection.send(pending.message)", "reutilização do mesmo envelope/actionId", pendingStore);
requireText("RETRYABLE_LOBBY_ACTIONS", "lista explícita de intenções idempotentes do lobby", clientActions);
requireText('message.reason === "STALE_STATE"', "recuperação de revisão antiga no lobby", clientActions);
requireText("clearPendingTimer", "limpeza comum de timeouts", pendingStore);
requireText("clearAll", "cancelamento conjunto de pedidos pendentes", pendingStore);
requireText("ACTION_TIMEOUT", "erro específico após duas tentativas", clientActions);

if (failures.length) {
  console.error("Falhas na recuperação de ações:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}
console.log("Recuperação de ações verificada: reenvio deduplicado e retry seguro de lobby após STALE_STATE.");
