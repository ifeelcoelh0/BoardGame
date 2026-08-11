const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { readRuntimeSource, runtimeSourcePaths } = require("./lib/runtime-source.cjs");

const root = path.resolve(__dirname, "..");
const presencePath = path.join(root, "src/game/playerPresence.js");
const bannerPath = path.join(root, "src/ui/game/PlayerBanner.jsx");
const mandatoryPath = path.join(root, "src/game/mandatoryDecisionReducer.js");
const source = readRuntimeSource(root);
const mandatory = fs.readFileSync(mandatoryPath, "utf8");
const banner = fs.readFileSync(bannerPath, "utf8");
const hostSession = fs.readFileSync(path.join(root, "src/multiplayer/hostSessionPresenceController.js"), "utf8");
const failures = [];
const requireText = (haystack, text, label) => {
  if (!haystack.includes(text)) failures.push(`Falta: ${label}`);
};
const rejectText = (haystack, text, label) => {
  if (haystack.includes(text)) failures.push(`Ainda existe: ${label}`);
};

requireText(source, "requiredGameActorIndex", "resolução do jogador que tem realmente de agir");
requireText(mandatory, "state.queue?.[0]?.p", "prioridade das decisões obrigatórias sobre o turno");
requireText(source, "skipAfkRequiredAction", "skip autoritativo da decisão bloqueada");
requireText(source, "skipAfkAfterReconnectTimeout", "execução do skip após o prazo");
requireText(source, "markAfkActionSkipped", "registo de ausências sucessivas");
requireText(source, "gameAfkGraceMs(player)", "escolha dinâmica entre 90 e 30 segundos");
requireText(source, "syncGamePresenceTimers", "sincronização do cronómetro do jogador ativo");
requireText(hostSession, "clearGamePresenceTimer(reconnectingPlayer.playerId)", "cancelamento do prazo numa reconexão");
requireText(banner, "reconnectSeconds", "contagem de reconexão visível no tabuleiro");
rejectText(source, "activateBotAfterReconnectTimeout", "takeover por bot");
rejectText(source, 'reason: "BOT_CONTROLLED"', "bloqueio por bot");
rejectText(banner, "CONTROLO BOT", "estado de bot no tabuleiro");

(async () => {
  const presence = await import(pathToFileURL(presencePath).href + `?v=${Date.now()}`);
  const player = { ready: true, connected: true, controller: "human" };
  presence.ensurePlayerPresence(player);

  presence.markPlayerDisconnected(player, { now: 1_000, phase: "play" });
  if (player.connected !== false || player.turnReconnectDeadline !== null)
    failures.push("Uma desconexão fora da decisão ativa não deve iniciar logo o cronómetro.");

  if (presence.gameAfkGraceMs(player) !== 90_000)
    failures.push("A primeira ausência devia usar 90 segundos.");
  presence.beginGameTurnReconnectWindow(player, { now: 2_000 });
  if (player.turnReconnectDeadline !== 92_000 || player.controlStatus !== "waiting-reconnect")
    failures.push("A primeira janela de 90 segundos não foi iniciada corretamente.");
  if (!presence.isGameTurnReconnectExpired(player, 92_000))
    failures.push("O primeiro prazo não expirou no momento correto.");

  presence.markAfkActionSkipped(player, { now: 92_000 });
  if (player.afkSkipCount !== 1 || player.turnReconnectDeadline !== null)
    failures.push("O primeiro skip AFK não foi registado corretamente.");
  if (presence.gameAfkGraceMs(player) !== 30_000)
    failures.push("Ausências seguintes deviam usar 30 segundos.");

  presence.beginGameTurnReconnectWindow(player, { now: 100_000 });
  if (player.turnReconnectDeadline !== 130_000)
    failures.push("A janela repetida de 30 segundos não foi iniciada corretamente.");

  presence.markPlayerConnected(player);
  if (!player.connected || player.afkSkipCount !== 0 || player.controlStatus !== "active")
    failures.push("A reconexão devia restaurar o jogador e reiniciar o ciclo AFK.");

  if (failures.length) {
    console.error("Falhas na presença durante a partida:");
    failures.forEach((failure) => console.error(`- ${failure}`));
    process.exit(1);
  }
  console.log("Presença em jogo verificada: 90s na primeira ausência, 30s nas seguintes e skip sem bot.");
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
