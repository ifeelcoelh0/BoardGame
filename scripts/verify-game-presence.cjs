const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { readRuntimeSource } = require("./lib/runtime-source.cjs");

const root = path.resolve(__dirname, "..");
const presencePath = path.join(root, "src/game/playerPresence.js");
const bannerPath = path.join(root, "src/ui/game/PlayerBanner.jsx");
const mandatoryPath = path.join(root, "src/game/mandatoryDecisionReducer.js");
const takeoverPath = path.join(root, "src/multiplayer/hostGamePresenceController.js");
const source = readRuntimeSource(root);
const mandatory = fs.readFileSync(mandatoryPath, "utf8");
const banner = fs.readFileSync(bannerPath, "utf8");
const hostSession = fs.readFileSync(path.join(root, "src/multiplayer/hostSessionPresenceController.js"), "utf8");
const takeover = fs.readFileSync(takeoverPath, "utf8");
const failures = [];
const requireText = (haystack, text, label) => {
  if (!haystack.includes(text)) failures.push(`Falta: ${label}`);
};
const rejectText = (haystack, text, label) => {
  if (haystack.includes(text)) failures.push(`Ainda existe: ${label}`);
};

requireText(source, "requiredGameActorIndex", "resolução do jogador que tem realmente de agir");
requireText(mandatory, "state.queue?.[0]?.p", "prioridade das decisões obrigatórias sobre o turno");
requireText(source, 'from "../multiplayer/hostGamePresenceController.js"', "controller dedicado de presença em jogo");
requireText(takeover, "activateBotAfterReconnectTimeout", "takeover autoritativo após o prazo");
requireText(takeover, "activateBotController", "transferência para o controller normal dos bots");
requireText(takeover, "requiredGameActorIndex", "takeover apenas quando o lugar precisa de agir");
requireText(hostSession, "restoreHumanController", "reentrada humana após takeover");
requireText(hostSession, "clearGamePresenceTimer(reconnectingPlayer.playerId)", "cancelamento do prazo numa reconexão");
requireText(banner, "reconnectSeconds", "contagem de reconexão visível no tabuleiro");
requireText(banner, 't("hud.botIn"', "destino do prazo de reconexão comunicado no tabuleiro");
rejectText(source, "skipAfkRequiredAction", "skip de turno no session hook");
rejectText(source, "skipAfkAfterReconnectTimeout", "skip após prazo no session hook");

(async () => {
  const presence = await import(pathToFileURL(presencePath).href + `?v=${Date.now()}`);
  const player = { ready: true, connected: true, controller: "human" };
  presence.ensurePlayerPresence(player);

  presence.markPlayerDisconnected(player, { now: 1_000, phase: "play" });
  if (player.connected !== false || player.turnReconnectDeadline !== null)
    failures.push("Uma desconexão fora da decisão ativa não deve iniciar logo o cronómetro.");

  if (presence.gameAfkGraceMs(player) !== 90_000)
    failures.push("A janela antes do takeover devia usar 90 segundos.");
  presence.beginGameTurnReconnectWindow(player, { now: 2_000 });
  if (player.turnReconnectDeadline !== 92_000 || player.controlStatus !== "waiting-reconnect")
    failures.push("A janela de 90 segundos não foi iniciada corretamente.");
  if (!presence.isGameTurnReconnectExpired(player, 92_000))
    failures.push("O prazo não expirou no momento correto.");

  presence.activateBotController(player, { now: 92_000 });
  if (player.controller !== "bot" || player.connected !== true || player.turnReconnectDeadline !== null)
    failures.push("O takeover devia deixar o lugar ativo sob o controller bot.");

  presence.restoreHumanController(player);
  presence.markPlayerConnected(player);
  if (!player.connected || player.controller !== "human" || player.botActivatedAt !== null)
    failures.push("A reconexão devia devolver o lugar ao humano.");

  if (failures.length) {
    console.error("Falhas na presença durante a partida:");
    failures.forEach((failure) => console.error(`- ${failure}`));
    process.exit(1);
  }
  console.log("Presença em jogo verificada: 90s de reconexão, takeover por bot e devolução ao humano.");
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
