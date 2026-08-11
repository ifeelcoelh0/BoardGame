import { LOBBY_ACTION } from "../game/lobbyProtocol.js";
import { GAME_ACTION } from "../game/gameProtocol.js";
import { createStableId } from "../game/playerIdentity.js";
import {
  createGameActionMessage,
  createLobbyActionMessage,
  isGameActionResult,
  isLobbyActionResult,
} from "./protocolMessages.js";
import { requestAuthoritativeState as requestRuntimeAuthoritativeState } from "./stateTransport.js";

export const CLIENT_ACTION_CONTROLLER_VERSION = 1;

const RETRYABLE_LOBBY_ACTIONS = new Set([
  LOBBY_ACTION.SELECT_CHARACTER,
  LOBBY_ACTION.SET_READY,
  LOBBY_ACTION.SET_PERKS,
]);

export const LOBBY_ACTION_ERRORS = Object.freeze({
  ACTION_TIMEOUT: "O anfitrião não respondeu. O pedido foi reenviado uma vez e cancelado em segurança.",
  ALREADY_STARTING: "O reino já está a iniciar.",
  CHARACTER_NOT_CONFIRMED: "Escolhe e confirma primeiro a tua casa.",
  CHARACTER_UNAVAILABLE: "Essa casa acabou de ser escolhida por outro jogador.",
  CHARACTERS_NOT_CONFIRMED: "Ainda há jogadores sem personagem confirmada.",
  INVALID_ACTION: "A ação de lobby é inválida.",
  INVALID_ACTION_ID: "O identificador da ação de lobby é inválido.",
  INVALID_CHARACTER: "Essa personagem não existe.",
  INVALID_PERKS_VALUE: "A opção de poderes é inválida.",
  INVALID_PLAYER: "Esse jogador já não está no lobby.",
  CANNOT_KICK_HOST: "O anfitrião não pode ser expulso do próprio reino.",
  PLAYER_DISCONNECTED: "Um jogador desligado não pode marcar-se como pronto.",
  PLAYERS_DISCONNECTED: "Ainda existem jogadores desligados no lobby.",
  INVALID_READY_VALUE: "O estado de preparação é inválido.",
  INVALID_REQUEST: "O pedido de lobby é inválido.",
  INVALID_REVISION: "A revisão do lobby é inválida.",
  LOBBY_STARTING: "O reino já está a iniciar.",
  NOT_ENOUGH_PLAYERS: "Ainda não existem jogadores suficientes.",
  NOT_HOST: "Apenas o anfitrião pode fazer isso.",
  NOT_IN_LOBBY: "O reino já não está no lobby.",
  PLAYERS_NOT_READY: "Ainda há jogadores que não estão prontos.",
  PROTOCOL_MISMATCH: "A versão do lobby não é compatível.",
  REQUEST_TOO_LARGE: "O pedido de lobby excede o tamanho permitido.",
  STALE_STATE: "O lobby mudou entretanto. Confirma o estado atual e tenta novamente.",
  UNAUTHENTICATED: "A tua sessão ainda não está autenticada.",
  UNKNOWN_ACTION: "A ação de lobby não é reconhecida.",
});

export const GAME_ACTION_ERRORS = Object.freeze({
  ACTION_IN_PROGRESS: "Já existe uma ação igual a ser processada.",
  ACTION_TIMEOUT: "O anfitrião não respondeu. A ação foi reenviada uma vez sem a duplicar e acabou cancelada.",
  ALREADY_ACTED: "Essa unidade já agiu neste turno.",
  BLOCKED_BY_DECISION: "Existe uma decisão obrigatória por resolver.",
  BLOCKED_BY_TRADE: "Conclui ou cancela primeiro a troca em curso.",
  CANNOT_AFFORD: "Não tens recursos suficientes.",
  DECK_EMPTY: "O baralho de desenvolvimento está vazio.",
  INVALID_ACTION: "A ação de jogo é inválida.",
  INVALID_ACTION_ID: "O identificador da ação de jogo é inválido.",
  INVALID_CARD: "Essa carta não pode ser jogada agora.",
  INVALID_EDGE: "Essa ligação não é válida.",
  INVALID_HEX: "Esse território não é válido.",
  INVALID_PLAYER: "Esse jogador não é uma escolha válida.",
  INVALID_REQUEST: "O pedido de jogo é inválido.",
  INVALID_RESOURCE: "O recurso escolhido é inválido.",
  INVALID_TRADE: "A proposta de troca é inválida.",
  INVALID_UNIT: "Essa unidade ou movimento não é válido.",
  INVALID_WAGON: "Essa carruagem ou movimento não é válido.",
  INVALID_REVISION: "A revisão da partida é inválida.",
  INVALID_VERTEX: "Esse ponto de construção não é válido.",
  MUST_PLACE_DRAGON: "Tens de guiar primeiro o Dragão.",
  MUST_ROLL_FIRST: "Lança primeiro os dados.",
  NOT_CURRENT_PLAYER: "Não é a tua vez.",
  PLAYER_DISCONNECTED: "Este jogador está marcado como desligado.",
  NOT_IN_GAME: "A partida ainda não começou ou já terminou.",
  NOT_RECIPIENT: "Esta troca não foi dirigida a ti.",
  NOT_PENDING_DECISION: "Essa decisão já não está pendente.",
  NO_DEPLOY_SPACE: "Não existe um território válido para destacar essa tropa.",
  PIECE_LIMIT: "Já atingiste o limite dessa peça.",
  PROTOCOL_MISMATCH: "A versão do protocolo de jogo não é compatível.",
  REQUEST_TOO_LARGE: "O pedido de jogo excede o tamanho permitido.",
  STALE_STATE: "A partida mudou entretanto. Confirma o estado atual e tenta novamente.",
  TRADE_CHANGED: "A proposta de troca já mudou ou terminou.",
  UNAUTHENTICATED: "A tua sessão ainda não está autenticada.",
  UNKNOWN_ACTION: "A ação de jogo não é reconhecida.",
  WRONG_MODE: "Essa ação não está disponível neste modo.",
  WRONG_PHASE: "Essa ação não é permitida nesta fase.",
});

export function lobbyActionErrorText(reason) {
  return LOBBY_ACTION_ERRORS[reason] || "Não foi possível aplicar essa alteração no lobby.";
}

export function gameActionErrorText(reason) {
  return GAME_ACTION_ERRORS[reason] || "Não foi possível aplicar essa ação.";
}

export function createClientActionController(options = {}) {
  const {
    runtime,
    getRuntime,
    getGame,
    getPlayerId,
    pendingLobbyActions,
    pendingGameActions,
    processLocalLobbyAction,
    processLocalGameAction,
    requestAuthoritativeState,
    emit = () => {},
    createId = createStableId,
    setTimeoutFn = setTimeout,
  } = options;

  const runtimeOf = typeof getRuntime === "function" ? getRuntime : () => runtime;
  if (
    typeof getGame !== "function"
    || typeof getPlayerId !== "function"
    || !pendingLobbyActions
    || !pendingGameActions
  ) throw new TypeError("Client action controller requires game/player access and pending stores.");

  const requestState = typeof requestAuthoritativeState === "function"
    ? requestAuthoritativeState
    : () => requestRuntimeAuthoritativeState(runtimeOf());

  const reportRejection = (scope, reason, extra = {}) => {
    const userMessage = scope === "lobby"
      ? lobbyActionErrorText(reason)
      : gameActionErrorText(reason);
    emit({
      type: scope === "lobby" ? "LOBBY_ACTION_REJECTED" : "GAME_ACTION_REJECTED",
      scope,
      reason,
      userMessage,
      ...extra,
    });
  };

  const failLobbyAction = (actionId, reason = "ACTION_TIMEOUT") =>
    pendingLobbyActions.fail(actionId, reason, (failureReason, pending) => {
      reportRejection("lobby", failureReason, { actionType: pending?.type || null });
    });

  const failGameAction = (actionId, reason = "ACTION_TIMEOUT") =>
    pendingGameActions.fail(actionId, reason, (failureReason, pending) => {
      reportRejection("game", failureReason, { actionType: pending?.type || null });
    });

  const sendPendingLobbyAction = (actionId) => pendingLobbyActions.send(actionId, {
    getConnection: () => runtimeOf()?.hostConn,
    onFailure: (reason, pending) => reportRejection("lobby", reason, { actionType: pending?.type || null }),
  });

  const sendPendingGameAction = (actionId) => pendingGameActions.send(actionId, {
    getConnection: () => runtimeOf()?.hostConn,
    onFailure: (reason, pending) => reportRejection("game", reason, { actionType: pending?.type || null }),
  });

  let dispatchLobbyAction;

  const handleLobbyActionResult = (message) => {
    if (!isLobbyActionResult(message)) return false;
    const pending = pendingLobbyActions.take(message.actionId);
    if (!pending) return false;

    if (!message.ok) {
      if (message.syncRequired) {
        requestState();
        emit({ type: "STATE_SYNC_REQUESTED", scope: "lobby", revision: message.revision });
      }
      if (
        message.reason === "STALE_STATE"
        && RETRYABLE_LOBBY_ACTIONS.has(pending.type)
        && (pending.retryCount || 0) < 1
      ) {
        setTimeoutFn(() => {
          void dispatchLobbyAction(pending.type, pending.payload, {
            retryCount: (pending.retryCount || 0) + 1,
            expectedRevision: message.revision,
          }).then((ok) => pending.resolve?.(ok));
        }, 0);
        return true;
      }
      reportRejection("lobby", message.reason, {
        actionType: pending.type,
        revision: message.revision,
      });
      pending.resolve?.(false);
      return true;
    }

    emit({
      type: "LOBBY_ACTION_ACCEPTED",
      actionType: pending.type,
      revision: message.revision,
      result: message,
    });
    pending.resolve?.(true);
    return true;
  };

  const handleGameActionResult = (message) => {
    if (!isGameActionResult(message)) return false;
    const pending = pendingGameActions.take(message.actionId);
    if (!pending) return false;

    if (!message.ok) {
      if (message.syncRequired) {
        requestState();
        emit({ type: "STATE_SYNC_REQUESTED", scope: "game", revision: message.revision });
      }
      reportRejection("game", message.reason, {
        actionType: pending.type,
        revision: message.revision,
      });
      pending.resolve?.(false);
      return true;
    }

    emit({
      type: "GAME_ACTION_ACCEPTED",
      actionType: pending.type,
      revision: message.revision,
      result: message,
    });
    pending.resolve?.(message);
    return true;
  };

  dispatchLobbyAction = async (type, payload = {}, dispatchOptions = {}) => {
    const current = getGame();
    if (!current || current.phase !== "lobby" || !getPlayerId()) return false;

    const duplicate = pendingLobbyActions.findByType(type);
    if (duplicate) {
      emit({ type: "DUPLICATE_ACTION_PENDING", scope: "lobby", actionType: type });
      return duplicate.promise || false;
    }

    const actionId = createId("action");
    const message = createLobbyActionMessage({
      actionId,
      expectedRevision: dispatchOptions.expectedRevision ?? current.v ?? 0,
      type,
      payload,
    });
    const promise = pendingLobbyActions.registerRemote(actionId, {
      type,
      payload,
      message,
      retryCount: dispatchOptions.retryCount || 0,
    });

    if (runtimeOf()?.host) {
      try {
        const result = await processLocalLobbyAction(message);
        handleLobbyActionResult(result);
      } catch {
        failLobbyAction(actionId);
      }
    } else sendPendingLobbyAction(actionId);
    return await promise;
  };

  const dispatchGameAction = async (type, payload = {}) => {
    const current = getGame();
    const rematchAction = type === GAME_ACTION.REMATCH_READY;
    if (!current || current.phase === "lobby" || (current.phase === "ended" && !rematchAction) || !getPlayerId()) return false;
    if (rematchAction && current.phase !== "ended") return false;

    const duplicate = pendingGameActions.findByType(type);
    if (duplicate) {
      emit({ type: "DUPLICATE_ACTION_PENDING", scope: "game", actionType: type });
      return duplicate.promise || false;
    }

    const actionId = createId("game");
    const message = createGameActionMessage({
      actionId,
      expectedRevision: current.v || 0,
      type,
      payload,
    });
    const promise = pendingGameActions.registerRemote(actionId, { type, payload, message });

    if (runtimeOf()?.host) {
      try {
        const result = await processLocalGameAction(message);
        handleGameActionResult(result);
      } catch {
        failGameAction(actionId);
      }
    } else sendPendingGameAction(actionId);
    return await promise;
  };

  return Object.freeze({
    dispatchLobbyAction,
    dispatchGameAction,
    handleLobbyActionResult,
    handleGameActionResult,
    onLobbyActionResult: ({ message }) => handleLobbyActionResult(message),
    onGameActionResult: ({ message }) => handleGameActionResult(message),
    failLobbyAction,
    failGameAction,
    clearPendingActions(value = false) {
      pendingLobbyActions.clearAll(value);
      pendingGameActions.clearAll(value);
    },
  });
}
