import { LOBBY_START_INTRO_MS } from "../game/lobbyRules.js";
import {
  LOBBY_PROTOCOL_VERSION,
  applyLobbyAction,
  validateLobbyActionEnvelope,
} from "../game/lobbyProtocol.js";
import {
  GAME_PROTOCOL_VERSION,
  validateGameActionEnvelope,
} from "../game/gameProtocol.js";
import { applyGameAction } from "../game/gameActionReducer.js";
import { STATE_VIEW_VERSION } from "../game/gameStateView.js";
import { IDENTITY_PROTOCOL_VERSION } from "../game/playerIdentity.js";
import {
  getAcceptedActionResult,
  rememberAcceptedActionResult,
} from "./actionResultCache.js";
import { authenticatedPlayerId } from "./runtimeState.js";

export const HOST_ACTION_CONTROLLER_VERSION = 1;

function actionResultBase(kind, message, revision) {
  const isLobby = kind === "lobby";
  return {
    t: isLobby ? "lobby-action-result" : "game-action-result",
    ...(isLobby
      ? { lobbyProtocolVersion: LOBBY_PROTOCOL_VERSION }
      : { gameProtocolVersion: GAME_PROTOCOL_VERSION }),
    actionId: typeof message?.actionId === "string" ? message.actionId : null,
    actionType: message?.action?.type || null,
    revision: Number.isSafeInteger(revision) ? revision : 0,
  };
}

export function createHostActionController(options = {}) {
  const {
    runtime,
    getRuntime,
    getGame,
    getLocalPlayerId = () => null,
    commit,
    enqueueAuthorityTask,
    identityProtocolVersion = IDENTITY_PROTOCOL_VERSION,
    stateViewVersion = STATE_VIEW_VERSION,
    validCharacterIds = new Set(),
    createPlayer = null,
    onLobbyApplied = () => {},
    onGameApplied = () => {},
    now = Date.now,
    introDurationMs = LOBBY_START_INTRO_MS,
    applyLobby = applyLobbyAction,
    applyGame = applyGameAction,
  } = options;

  const runtimeOf = typeof getRuntime === "function" ? getRuntime : () => runtime;
  if (typeof getGame !== "function" || typeof commit !== "function") {
    throw new TypeError("Host action controller requires getGame and commit.");
  }
  const queue = typeof enqueueAuthorityTask === "function"
    ? enqueueAuthorityTask
    : async (task) => task();
  const characterIds = validCharacterIds instanceof Set
    ? validCharacterIds
    : new Set(validCharacterIds || []);

  const actorIdFor = (connection) => connection
    ? authenticatedPlayerId(runtimeOf(), connection)
    : getLocalPlayerId();

  const processLobbyAction = async (message, sourceConnection = null) => {
    const current = getGame();
    const base = actionResultBase("lobby", message, current?.v || 0);
    const envelope = validateLobbyActionEnvelope(message);
    if (!envelope.ok) return { ...base, ok: false, reason: envelope.reason };

    const actorId = actorIdFor(sourceConnection);
    if (!current || !actorId) return { ...base, ok: false, reason: "UNAUTHENTICATED" };

    const cache = runtimeOf()?.lobbyActionResults;
    const cacheKey = `${actorId}:${message.actionId}`;
    const cached = getAcceptedActionResult(cache, cacheKey);
    if (cached) return cached;

    if (message.expectedRevision !== (current.v || 0)) {
      return {
        ...base,
        ok: false,
        reason: "STALE_STATE",
        revision: current.v || 0,
        syncRequired: true,
      };
    }

    const applied = applyLobby(current, actorId, message.action, {
      actionId: message.actionId,
      now: now(),
      introDurationMs,
      validCharacterIds: characterIds,
      createPlayer,
    });
    if (!applied.ok) {
      return {
        ...base,
        ok: false,
        reason: applied.reason,
        details: applied.details || null,
        revision: current.v || 0,
      };
    }

    let committed = current;
    if (!applied.noChange) {
      await onLobbyApplied(applied.game, applied);
      committed = await commit(applied.game);
    }
    const accepted = {
      ...base,
      ok: true,
      reason: null,
      revision: committed?.v || current.v || 0,
    };
    rememberAcceptedActionResult(cache, cacheKey, accepted);
    return accepted;
  };

  const processGameAction = async (message, sourceConnection = null) => {
    const current = getGame();
    const base = actionResultBase("game", message, current?.v || 0);
    const envelope = validateGameActionEnvelope(message);
    if (!envelope.ok) return { ...base, ok: false, reason: envelope.reason };

    const actorId = actorIdFor(sourceConnection);
    if (!current || !actorId) return { ...base, ok: false, reason: "UNAUTHENTICATED" };

    const cache = runtimeOf()?.gameActionResults;
    const cacheKey = `${actorId}:${message.actionId}`;
    const cached = getAcceptedActionResult(cache, cacheKey);
    if (cached) return cached;

    if (message.expectedRevision !== (current.v || 0)) {
      return {
        ...base,
        ok: false,
        reason: "STALE_STATE",
        revision: current.v || 0,
        syncRequired: true,
      };
    }

    const applied = applyGame(current, actorId, message.action);
    if (!applied.ok) {
      return {
        ...base,
        ok: false,
        reason: applied.reason,
        revision: current.v || 0,
      };
    }

    await onGameApplied(applied.game, applied);
    const committed = await commit(applied.game);
    const accepted = {
      ...base,
      ok: true,
      reason: null,
      revision: committed?.v || current.v || 0,
      ...(applied.privateResult ? { privateResult: applied.privateResult } : {}),
    };
    rememberAcceptedActionResult(cache, cacheKey, accepted);
    return accepted;
  };

  const enqueueLobbyAction = (message, sourceConnection = null) =>
    queue(() => processLobbyAction(message, sourceConnection));
  const enqueueGameAction = (message, sourceConnection = null) =>
    queue(() => processGameAction(message, sourceConnection));

  const onLobbyAction = async ({ connection, message, send }) => {
    if (message.protocolVersion !== identityProtocolVersion) {
      send({
        ...actionResultBase("lobby", message, getGame()?.v || 0),
        ok: false,
        reason: "PROTOCOL_MISMATCH",
      });
      return;
    }
    send(await enqueueLobbyAction(message, connection));
  };

  const onGameAction = async ({ connection, message, send }) => {
    if (message.protocolVersion !== identityProtocolVersion) {
      send({
        ...actionResultBase("game", message, getGame()?.v || 0),
        ok: false,
        reason: "PROTOCOL_MISMATCH",
      });
      return;
    }
    send(await enqueueGameAction(message, connection));
  };

  const onStateRequest = ({ connection, message, send }) => {
    if (
      message.protocolVersion !== identityProtocolVersion
      || message.stateViewVersion !== stateViewVersion
      || !authenticatedPlayerId(runtimeOf(), connection)
    ) return false;
    send({ t: "state", g: getGame() });
    return true;
  };

  const onLegacyState = ({ send }) => {
    send({ t: "state", g: getGame() });
    return true;
  };

  return Object.freeze({
    processLobbyAction,
    processGameAction,
    enqueueLobbyAction,
    enqueueGameAction,
    onLobbyAction,
    onGameAction,
    onStateRequest,
    onLegacyState,
  });
}
