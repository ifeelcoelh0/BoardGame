const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { readRuntimeSource, runtimeSourcePaths } = require("./lib/runtime-source.cjs");

const root = path.resolve(__dirname, "..");
const protocolPath = path.join(root, "src/game/lobbyProtocol.js");
const runtimeSource = readRuntimeSource(root);
const messages = fs.readFileSync(path.join(root, "src/multiplayer/protocolMessages.js"), "utf8");
const runtime = fs.readFileSync(path.join(root, "src/multiplayer/runtimeState.js"), "utf8");
const hostActions = fs.readFileSync(path.join(root, "src/multiplayer/hostActionController.js"), "utf8");
const clientActions = fs.readFileSync(path.join(root, "src/multiplayer/clientActionController.js"), "utf8");
const actionLayer = `${runtimeSource}\n${hostActions}\n${clientActions}`;
const errors = [];

const requireText = (text, label, source = actionLayer) => {
  if (!source.includes(text)) errors.push(`Falta: ${label}`);
};
const rejectText = (text, label) => {
  if (runtimeSource.includes(text)) errors.push(`Ainda existe: ${label}`);
};

if (!fs.existsSync(protocolPath)) errors.push("Falta src/game/lobbyProtocol.js");
requireText('t: "lobby-action"', "mensagem de intenção do lobby", messages);
requireText("expectedRevision", "revisão esperada na ação", messages);
requireText("validateLobbyActionEnvelope(message)", "validação do envelope da ação", hostActions);
requireText("applyLobby(current, actorId", "aplicação autoritativa pelo host", hostActions);
requireText('reason: "STALE_STATE"', "rejeição explícita de ações desatualizadas");
requireText("lobbyActionResults", "deduplicação de actionId", hostActions);
requireText("authorityQueue", "fila sequencial comum de ações autoritativas", runtime);
requireText("onLegacyState", "rejeição de snapshots convidados no lobby e na partida", hostActions);
requireText('LOBBY_ACTION.SELECT_CHARACTER', "seleção de personagem por intenção");
requireText('LOBBY_ACTION.SET_READY', "estado pronto por intenção");
requireText('LOBBY_ACTION.SET_PERKS', "poderes por intenção");
requireText('LOBBY_ACTION.BEGIN_START', "início por intenção");
requireText('LOBBY_ACTION.KICK_PLAYER', "kick autoritativo pelo host");
requireText("introEndsAt", "transição de início persistida no estado");
requireText("finalizeLobbyStart", "finalização autoritativa do início");
rejectText("await new Promise((resolve) => setTimeout(resolve, 1850))", "temporizador visual dentro de hStart");
rejectText("g.players[seat].ready = g.players[seat].ready !== true", "mutação local de pronto no lobby");
rejectText("g.players[seat].ch = chId", "mutação local de personagem no lobby");

(async () => {
  if (!errors.length) {
    const protocol = await import(pathToFileURL(protocolPath).href + `?v=${Date.now()}`);
    const players = [
      { playerId: "player_aaaaaaaaaaaaaaaaaaaaaaaa", ch: "vlad", characterConfirmed: true, ready: true, connected: true },
      { playerId: "player_bbbbbbbbbbbbbbbbbbbbbbbb", ch: "maria", characterConfirmed: false, ready: false, connected: true },
      { playerId: "player_cccccccccccccccccccccccc", ch: "romeo", characterConfirmed: true, ready: true, connected: true },
      { playerId: "player_dddddddddddddddddddddddd", ch: "alina", characterConfirmed: true, ready: true, connected: true },
    ];
    const base = { v: 7, phase: "lobby", mode: "dragao", perksOn: true, players };
    const ids = new Set(["vlad", "maria", "romeo", "alina", "protheus"]);

    const envelope = protocol.validateLobbyActionEnvelope({
      t: "lobby-action",
      lobbyProtocolVersion: protocol.LOBBY_PROTOCOL_VERSION,
      actionId: "action_111111111111111111111111",
      expectedRevision: 7,
      action: { type: protocol.LOBBY_ACTION.SELECT_CHARACTER, characterId: "protheus" },
    });
    if (!envelope.ok) errors.push("Envelope válido foi rejeitado.");

    const selected = protocol.applyLobbyAction(base, players[1].playerId, {
      type: protocol.LOBBY_ACTION.SELECT_CHARACTER,
      characterId: "protheus",
    }, { validCharacterIds: ids });
    if (!selected.ok || selected.game.players[1].ch !== "protheus" || !selected.game.players[1].characterConfirmed)
      errors.push("Seleção autoritativa de personagem falhou.");
    if (base.players[1].ch !== "maria") errors.push("applyLobbyAction alterou o estado original.");

    const occupied = protocol.applyLobbyAction(base, players[1].playerId, {
      type: protocol.LOBBY_ACTION.SELECT_CHARACTER,
      characterId: "vlad",
    }, { validCharacterIds: ids });
    if (occupied.ok || occupied.reason !== "CHARACTER_UNAVAILABLE")
      errors.push("Personagem ocupada devia ser rejeitada.");

    const earlyReady = protocol.applyLobbyAction(base, players[1].playerId, {
      type: protocol.LOBBY_ACTION.SET_READY,
      ready: true,
    });
    if (earlyReady.ok || earlyReady.reason !== "CHARACTER_NOT_CONFIRMED")
      errors.push("Jogador sem personagem confirmada não devia ficar pronto.");

    const guestPerks = protocol.applyLobbyAction(base, players[1].playerId, {
      type: protocol.LOBBY_ACTION.SET_PERKS,
      enabled: false,
    });
    if (guestPerks.ok || guestPerks.reason !== "NOT_HOST")
      errors.push("Convidado conseguiu alterar poderes de casa.");

    const readyBase = structuredClone(base);
    readyBase.players[1].characterConfirmed = true;
    readyBase.players[1].ready = true;
    const started = protocol.applyLobbyAction(readyBase, players[0].playerId, {
      type: protocol.LOBBY_ACTION.BEGIN_START,
    }, { actionId: "action_222222222222222222222222", now: 1000, introDurationMs: 1850 });
    if (!started.ok || started.game.lobbyStarting?.introEndsAt !== 2850)
      errors.push("Início autoritativo não persistiu a janela visual.");

    const disconnectedBase = structuredClone(readyBase);
    disconnectedBase.players[2].connected = false;
    const disconnectedStart = protocol.applyLobbyAction(disconnectedBase, players[0].playerId, {
      type: protocol.LOBBY_ACTION.BEGIN_START,
    });
    if (disconnectedStart.ok || disconnectedStart.reason !== "PLAYERS_DISCONNECTED")
      errors.push("Lobby com jogador desligado conseguiu começar.");


    const guestKick = protocol.applyLobbyAction(readyBase, players[1].playerId, {
      type: protocol.LOBBY_ACTION.KICK_PLAYER,
      targetPlayerId: players[2].playerId,
    });
    if (guestKick.ok || guestKick.reason !== "NOT_HOST")
      errors.push("Convidado conseguiu expulsar outro jogador.");

    const hostKick = protocol.applyLobbyAction(readyBase, players[0].playerId, {
      type: protocol.LOBBY_ACTION.KICK_PLAYER,
      targetPlayerId: players[2].playerId,
    });
    if (!hostKick.ok || hostKick.game.players.some((player) => player.playerId === players[2].playerId))
      errors.push("Kick autoritativo do host falhou.");

    const guestStart = protocol.applyLobbyAction(readyBase, players[1].playerId, {
      type: protocol.LOBBY_ACTION.BEGIN_START,
    });
    if (guestStart.ok || guestStart.reason !== "NOT_HOST")
      errors.push("Convidado conseguiu iniciar a partida.");
  }

  if (errors.length) {
    console.error("Falhas no lobby autoritativo:");
    errors.forEach((error) => console.error(`- ${error}`));
    process.exit(1);
  }
  console.log("Lobby autoritativo verificado: intenções, revisão, deduplicação e início controlado pelo host.");
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
