import {
  authenticateConnection,
  authenticatedPlayerId,
  connectionsForPlayer,
  hasConnection,
  replaceAuthenticatedConnection,
  unregisterConnection,
} from "./runtimeState.js";
import {
  createStableId,
  findPlayerIndexById,
  isSessionTokenHash,
} from "../game/playerIdentity.js";
import {
  LOBBY_RECONNECT_GRACE_MS,
  gameAfkGraceMs,
  isLobbyReservationExpired,
  markPlayerConnected,
  markPlayerDisconnected,
} from "../game/playerPresence.js";
import { gameModeConfig } from "../game/gameModes.js";
import { reduceTradeForDisconnectedPlayer } from "../game/tradeReducer.js";
import { requiredGameActorIndex } from "../game/mandatoryDecisionReducer.js";

export const HOST_SESSION_PRESENCE_CONTROLLER_VERSION = 1;

const PLAYER_ID_RE = /^player_[a-f0-9]{24}$/;
const SESSION_TOKEN_RE = /^[a-f0-9]{64}$/;
const CLAIM_ID_RE = /^claim_[a-f0-9]{24}$/;
const LEAVE_ID_RE = /^leave_[a-f0-9]{24}$/;

function safeClose(connection) {
  try {
    connection.close();
  } catch {
    // The transport may already be closed.
  }
}

function safeSend(connection, payload) {
  try {
    connection.send(payload);
  } catch {
    // A stale connection must not break authority processing.
  }
}

export function createHostSessionPresenceController(options = {}) {
  const {
    runtime,
    getRuntime,
    identityProtocolVersion,
    buildCompatibilityVersion = null,
    getGame,
    commit,
    enqueueAuthorityTask,
    clone,
    hashSessionToken,
    characters,
    createPlayer,
    addLog,
    characterName,
    clearLobbyPresenceTimer = () => {},
    clearGamePresenceTimer = () => {},
    scheduleLobbyPresenceTimer = () => {},
    presentTradeEvent = () => {},
    giveTestResources = () => {},
    now = Date.now,
    setTimeoutFn = setTimeout,
    createId = createStableId,
  } = options;

  const runtimeOf = typeof getRuntime === "function" ? getRuntime : () => runtime;
  if (!runtimeOf() || typeof getGame !== "function" || typeof commit !== "function") {
    throw new TypeError("Host session controller requires runtime, getGame and commit.");
  }

  const queue = typeof enqueueAuthorityTask === "function"
    ? enqueueAuthorityTask
    : async (task) => task();
  const copy = typeof clone === "function"
    ? clone
    : (value) => JSON.parse(JSON.stringify(value));
  const nameOf = typeof characterName === "function"
    ? characterName
    : (characterId) => String(characterId || "jogador");
  const log = typeof addLog === "function" ? addLog : () => {};

  const authenticatedIndexForConnection = (connection) =>
    findPlayerIndexById(getGame(), authenticatedPlayerId(runtimeOf(), connection));

  const onSessionAuth = async ({ connection, message, send }) => {
    if (buildCompatibilityVersion != null && message.buildCompatibilityVersion !== buildCompatibilityVersion) {
      send({ t: "session-result", ok: false, reason: "BUILD_MISMATCH", buildCompatibilityVersion });
      return;
    }
    if (message.protocolVersion !== identityProtocolVersion) {
      send({
        t: "session-result",
        ok: false,
        reason: "PROTOCOL_MISMATCH",
        protocolVersion: identityProtocolVersion,
      });
      return;
    }

    const validPlayerId = PLAYER_ID_RE.test(message.playerId || "");
    const validToken = SESSION_TOKEN_RE.test(message.sessionToken || "");
    if (!validPlayerId || !validToken) {
      send({ t: "session-result", ok: false, reason: "INVALID_SESSION", g: getGame() });
      return;
    }

    let tokenHash = null;
    try {
      tokenHash = await hashSessionToken(message.sessionToken);
    } catch {
      // Invalid crypto environments are treated as invalid sessions.
    }
    if (!connection.open || !hasConnection(runtimeOf(), connection)) return;

    const result = await queue(async () => {
      const current = getGame();
      if (!connection.open || !hasConnection(runtimeOf(), connection)) {
        return { t: "session-result", ok: false, reason: "CONNECTION_CLOSED", g: current };
      }

      const playerIndex = findPlayerIndexById(current, message.playerId);
      const player = playerIndex >= 0 ? current.players[playerIndex] : null;
      if (playerIndex === 0) {
        return { t: "session-result", ok: false, reason: "SESSION_IN_USE", g: current };
      }
      if (!player || !tokenHash || tokenHash !== player.sessionTokenHash) {
        return { t: "session-result", ok: false, reason: "INVALID_SESSION", g: current };
      }

      if (current.phase === "lobby" && isLobbyReservationExpired(player, now())) {
        const next = copy(current);
        const [expired] = next.players.splice(playerIndex, 1);
        delete next.lobbyStarting;
        next.players.forEach((candidate) => { candidate.ready = false; });
        log(next, `⌛ O lugar de ${nameOf(expired.ch)} expirou antes da reconexão.`);
        clearLobbyPresenceTimer(player.playerId);
        const committed = await commit(next);
        return { t: "session-result", ok: false, reason: "SESSION_EXPIRED", g: committed };
      }

      const previousConnections = connectionsForPlayer(runtimeOf(), player.playerId)
        .filter((candidate) => candidate !== connection);
      previousConnections.forEach((candidate) => safeSend(candidate, {
        t: "session-replaced",
        playerId: player.playerId,
      }));
      replaceAuthenticatedConnection(runtimeOf(), player.playerId, connection);
      previousConnections.forEach(safeClose);

      let committed = current;
      if (
        player.connected === false
        || player.disconnectedAt != null
        || player.reconnectDeadline != null
        || player.turnReconnectDeadline != null
        || (player.afkSkipCount || 0) > 0
      ) {
        const next = copy(current);
        const reconnectingIndex = findPlayerIndexById(next, player.playerId);
        const reconnectingPlayer = next.players[reconnectingIndex];
        markPlayerConnected(reconnectingPlayer);
        log(next, `🔗 ${nameOf(reconnectingPlayer.ch)} regressou ao reino.`, reconnectingIndex);
        clearLobbyPresenceTimer(reconnectingPlayer.playerId);
        clearGamePresenceTimer(reconnectingPlayer.playerId);
        committed = await commit(next);
      }

      return {
        t: "session-result",
        ok: true,
        playerId: player.playerId,
        seatId: player.seatId,
        g: committed,
      };
    });

    send(result);
  };

  const onClaimSeat = async ({ connection, message, send }) => {
    const result = await queue(async () => {
      const current = getGame();
      if (!connection.open || !hasConnection(runtimeOf(), connection)) {
        return { t: "claim-result", ok: false, requestId: message.requestId || null, reason: "CONNECTION_CLOSED" };
      }
      if (message.protocolVersion !== identityProtocolVersion) {
        return { t: "claim-result", ok: false, requestId: message.requestId, reason: "PROTOCOL_MISMATCH" };
      }
      if (buildCompatibilityVersion != null && message.buildCompatibilityVersion !== buildCompatibilityVersion) {
        return { t: "claim-result", ok: false, requestId: message.requestId, reason: "BUILD_MISMATCH", buildCompatibilityVersion };
      }
      if (typeof message.requestId !== "string" || !CLAIM_ID_RE.test(message.requestId)) {
        return { t: "claim-result", ok: false, requestId: null, reason: "INVALID_REQUEST" };
      }
      if (authenticatedPlayerId(runtimeOf(), connection) != null) {
        return { t: "claim-result", ok: false, requestId: message.requestId, reason: "ALREADY_AUTHENTICATED" };
      }
      if (!current || current.phase !== "lobby") {
        return { t: "claim-result", ok: false, requestId: message.requestId, reason: "GAME_ALREADY_STARTED" };
      }
      if (current.lobbyStarting) {
        return { t: "claim-result", ok: false, requestId: message.requestId, reason: "LOBBY_STARTING", g: current };
      }
      if (current.players.length >= gameModeConfig(current.mode).maxPlayers) {
        return { t: "claim-result", ok: false, requestId: message.requestId, reason: "LOBBY_FULL", g: current };
      }

      if (!isSessionTokenHash(message.sessionTokenHash)) {
        return { t: "claim-result", ok: false, requestId: message.requestId, reason: "INVALID_TOKEN" };
      }

      const identity = {
        playerId: createId("player"),
        seatId: createId("seat"),
        sessionTokenHash: message.sessionTokenHash,
        connected: true,
        controller: "human",
      };
      const next = copy(current);
      const player = createPlayer(null, identity);
      markPlayerConnected(player);
      next.players.push(player);
      if (next.test) giveTestResources(player);
      log(next, "🚪 Um novo jogador entrou no reino e está a escolher a sua casa.");
      authenticateConnection(runtimeOf(), connection, player.playerId);
      const committed = await commit(next);
      return {
        t: "claim-result",
        ok: true,
        requestId: message.requestId,
        playerId: player.playerId,
        seatId: player.seatId,
        g: committed,
      };
    });

    send(result);
  };

  const onLeaveSeat = async ({ connection, message, send }) => {
    const result = await queue(async () => {
      if (message.protocolVersion !== identityProtocolVersion || !LEAVE_ID_RE.test(message.requestId || "")) {
        return { t: "leave-result", ok: false, requestId: message.requestId || null, reason: "INVALID_REQUEST" };
      }
      const current = getGame();
      const playerIndex = authenticatedIndexForConnection(connection);
      if (!current || current.phase !== "lobby" || current.lobbyStarting || playerIndex <= 0 || !current.players[playerIndex]) {
        return {
          t: "leave-result",
          ok: false,
          requestId: message.requestId,
          reason: current?.lobbyStarting ? "LOBBY_STARTING" : "INVALID_REQUEST",
        };
      }

      const next = copy(current);
      const leaving = next.players[playerIndex];
      log(next, `🚪 ${nameOf(leaving.ch)} abandonou o reino.`);
      next.players.splice(playerIndex, 1);
      clearLobbyPresenceTimer(leaving.playerId);
      unregisterConnection(runtimeOf(), connection);
      await commit(next);
      return { t: "leave-result", ok: true, requestId: message.requestId };
    });

    send(result);
  };

  const onConnectionClosed = async (playerId) => {
    if (!playerId || connectionsForPlayer(runtimeOf(), playerId).some((connection) => connection.open)) return false;
    const current = getGame();
    const playerIndex = findPlayerIndexById(current, playerId);
    if (!current || playerIndex <= 0 || !current.players[playerIndex] || current.players[playerIndex].connected === false) {
      return false;
    }

    let next = copy(current);
    const player = next.players[playerIndex];
    markPlayerDisconnected(player, {
      now: now(),
      phase: next.phase,
      graceMs: LOBBY_RECONNECT_GRACE_MS,
    });

    const tradePresence = reduceTradeForDisconnectedPlayer(next, playerIndex);
    if (tradePresence.event) {
      next = tradePresence.game;
      presentTradeEvent(next, tradePresence.event);
    }

    if (next.phase === "lobby") {
      if (next.lobbyStarting) {
        delete next.lobbyStarting;
        log(next, `↩ O início da partida foi cancelado porque ${nameOf(player.ch)} perdeu a ligação.`);
      }
      log(next, `🔌 ${nameOf(player.ch)} perdeu a ligação. O lugar fica reservado por 30 segundos.`);
    } else {
      const requiredIndex = requiredGameActorIndex(next);
      if (requiredIndex === playerIndex) {
        const graceSeconds = Math.round(gameAfkGraceMs(player) / 1000);
        log(next, `🔌 ${nameOf(player.ch)} perdeu a ligação durante a sua decisão. Tem ${graceSeconds} segundos para regressar.`, playerIndex);
      } else {
        log(next, `🔌 ${nameOf(player.ch)} perdeu a ligação. O lugar permanece reservado; o tempo de espera começa quando tiver de agir.`, playerIndex);
      }
    }

    const committed = await commit(next);
    if (committed.phase === "lobby") {
      const committedIndex = findPlayerIndexById(committed, playerId);
      scheduleLobbyPresenceTimer(playerId, committed.players[committedIndex]?.reconnectDeadline);
    }
    return true;
  };

  const applyKickSideEffect = (event) => {
    if (event?.type !== "PLAYER_KICKED") return false;
    clearLobbyPresenceTimer(event.targetPlayerId);
    for (const connection of connectionsForPlayer(runtimeOf(), event.targetPlayerId)) {
      safeSend(connection, { t: "kicked-from-lobby", reason: "REMOVED_BY_HOST" });
      unregisterConnection(runtimeOf(), connection);
      setTimeoutFn(() => safeClose(connection), 80);
    }
    return true;
  };

  return Object.freeze({
    onSessionAuth,
    onClaimSeat,
    onLeaveSeat,
    onConnectionClosed,
    applyKickSideEffect,
    authenticatedIndexForConnection,
  });
}
