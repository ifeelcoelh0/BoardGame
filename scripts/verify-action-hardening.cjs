const fs = require("node:fs");
const path = require("node:path");
const { readRuntimeSource } = require("./lib/runtime-source.cjs");

const root = path.resolve(__dirname, "..");
const legacy = readRuntimeSource(root);
const view = fs.readFileSync(path.join(root, "src/game/gameStateView.js"), "utf8");
const building = fs.readFileSync(path.join(root, "src/game/buildingRules.js"), "utf8");
const cache = fs.readFileSync(path.join(root, "src/multiplayer/actionResultCache.js"), "utf8");
const messages = fs.readFileSync(path.join(root, "src/multiplayer/protocolMessages.js"), "utf8");
const pending = fs.readFileSync(path.join(root, "src/multiplayer/pendingActionStore.js"), "utf8");
const clientActions = fs.readFileSync(path.join(root, "src/multiplayer/clientActionController.js"), "utf8");
const trade = fs.readFileSync(path.join(root, "src/game/tradeReducer.js"), "utf8");
const failures = [];
const requireText = (source, text, label) => { if (!source.includes(text)) failures.push(`Falta: ${label}`); };
const forbidText = (source, text, label) => { if (source.includes(text)) failures.push(`Ainda existe: ${label}`); };

requireText(view, 'HIDDEN_TERRAIN_TYPE = "oculto"', "sentinela de terreno oculto");
requireText(building, "hex.hid !== true", "névoa não tratada como terreno baldio");
requireText(messages, 't: "state-request"', "pedido explícito do estado autoritativo");
requireText(clientActions, "requestState()", "sincronização após STALE_STATE");
requireText(cache, "result?.ok !== true", "cache apenas de confirmações aceites");
requireText(cache, "expiresAt", "expiração temporal do cache");
requireText(trade, "reduceTradeForDisconnectedPlayer", "resolução de trocas ao desligar");
requireText(clientActions, "duplicate.promise || false", "feedback e reutilização da ação pendente");
requireText(pending, "findByType", "deduplicação comum por tipo de ação");
forbidText(legacy, "cache.size > 300", "limite FIFO vulnerável do cache de jogo");
forbidText(legacy, "cache.size > 200", "limite FIFO vulnerável do cache de lobby");
forbidText(legacy, 'reason: "STALE_STATE", revision: current.v || 0, g: current', "snapshot completo em rejeição stale");

if (failures.length) {
  console.error("Falhas no endurecimento de ações e vistas:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}
console.log("Ações endurecidas: névoa sem colisão, cache compacto, sync explícito, trocas offline e feedback pendente.");
