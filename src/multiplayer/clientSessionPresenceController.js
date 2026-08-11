import { findPlayerIndexById } from "../game/playerIdentity.js";

export const CLIENT_SESSION_PRESENCE_CONTROLLER_VERSION = 1;

const PLAYER_ID_RE = /^player_[a-f0-9]{24}$/;
const SEAT_ID_RE = /^seat_[a-f0-9]{24}$/;

const CLAIM_ERROR_MESSAGES = Object.freeze({
  LOBBY_FULL: "O reino já está cheio.",
  CHARACTER_UNAVAILABLE: "Essa casa acabou de ser escolhida por outro jogador.",
  GAME_ALREADY_STARTED: "A partida já começou.",
  LOBBY_STARTING: "O reino já está a iniciar.",
  PROTOCOL_MISMATCH: "A versão do anfitrião é incompatível.",
});

function validIdentityResult(message, state) {
  if (!PLAYER_ID_RE.test(message?.playerId || "") || !SEAT_ID_RE.test(message?.seatId || "")) return false;
  const index = findPlayerIndexById(state, message.playerId);
  return index >= 0 && state.players[index]?.seatId === message.seatId;
}

export function createClientSessionPresenceController(options = {}) {
  const {
    roomCode,
    savedSession = null,
    identityProtocolVersion,
    stateViewVersion,
    buildCompatibilityVersion = null,
    normalizeGame = (game) => game,
    getGame = () => null,
    getPendingIdentity = () => null,
    emit = () => {},
  } = options;

  let welcomed = false;
  let authenticated = false;
  let authResolved = false;

  const publish = (event) => {
    emit(Object.freeze({ roomCode, ...event }));
    return event;
  };

  const onIdentityWelcome = ({ message }) => {
    if (buildCompatibilityVersion != null && message.buildCompatibilityVersion !== buildCompatibilityVersion) {
      return publish({
        type: "CONNECTION_REJECTED",
        reason: "BUILD_MISMATCH",
        userMessage: "Esta sala foi criada numa versão diferente do jogo. Atualiza a página para continuar.",
      });
    }
    if (message.protocolVersion !== identityProtocolVersion) {
      return publish({
        type: "CONNECTION_REJECTED",
        reason: "PROTOCOL_MISMATCH",
        userMessage: "Esta versão do jogo não é compatível com a versão do anfitrião.",
      });
    }
    if (
      message.stateViewVersion !== stateViewVersion
      || !message.g
      || message.g.stateViewVersion !== stateViewVersion
      || !Array.isArray(message.g.players)
    ) {
      return publish({
        type: "CONNECTION_REJECTED",
        reason: "STATE_VIEW_MISMATCH",
        userMessage: "O anfitrião enviou uma vista de jogo incompatível.",
      });
    }

    welcomed = true;
    const game = normalizeGame(message.g);
    if (authenticated) return publish({ type: "WELCOME_AUTHENTICATED", game });
    if (savedSession && !authResolved) return publish({ type: "SESSION_AUTH_REQUIRED", game });
    if (game.phase === "lobby") return publish({ type: "CLAIM_REQUIRED", game });
    return publish({
      type: "SESSION_REQUIRED",
      game,
      userMessage: "A partida já começou e este navegador não possui uma sessão válida para este reino.",
    });
  };

  const onSessionResult = ({ message }) => {
    welcomed = true;
    authResolved = true;
    const resultState = message.g || getGame();
    if (message.ok && savedSession && validIdentityResult(message, resultState)) {
      authenticated = true;
      return publish({
        type: "SESSION_ACCEPTED",
        identity: {
          playerId: message.playerId,
          seatId: message.seatId,
          sessionToken: savedSession.sessionToken,
        },
        game: message.g || null,
      });
    }

    return publish({
      type: "SESSION_REJECTED",
      reason: message.reason || "INVALID_SESSION",
      game: message.g || null,
      userMessage: message.reason === "SESSION_EXPIRED"
        ? "O tempo de reconexão terminou e o lugar foi libertado. Podes entrar novamente como um jogador novo."
        : resultState?.phase === "lobby"
          ? "A sessão guardada já não é válida. O lugar pode ter sido libertado ou removido pelo anfitrião."
          : "Não existe uma sessão válida neste navegador para retomar um lugar nesta partida.",
    });
  };

  const onClaimResult = ({ message }) => {
    welcomed = true;
    const pending = getPendingIdentity();
    if (!pending || pending.requestId !== message.requestId) {
      return publish({ type: "IGNORED_RESULT", resultType: "claim", requestId: message.requestId || null });
    }
    if (!message.ok) {
      return publish({
        type: "CLAIM_REJECTED",
        reason: message.reason || "INVALID_REQUEST",
        userMessage: CLAIM_ERROR_MESSAGES[message.reason] || "Não foi possível reservar esse lugar.",
      });
    }

    const resultState = message.g || getGame();
    if (!validIdentityResult(message, resultState)) {
      return publish({
        type: "CLAIM_REJECTED",
        reason: "INVALID_IDENTITY_RESULT",
        userMessage: "O anfitrião devolveu uma identidade inválida.",
      });
    }

    authenticated = true;
    return publish({
      type: "CLAIM_ACCEPTED",
      identity: {
        playerId: message.playerId,
        seatId: message.seatId,
        sessionToken: pending.sessionToken,
      },
      game: message.g || null,
    });
  };

  const onLeaveResult = ({ message }) => {
    const pending = getPendingIdentity();
    if (!pending || pending.type !== "leave-seat" || pending.requestId !== message.requestId) {
      return publish({ type: "IGNORED_RESULT", resultType: "leave", requestId: message.requestId || null });
    }
    return message.ok
      ? publish({ type: "LEAVE_ACCEPTED" })
      : publish({ type: "LEAVE_REJECTED", reason: message.reason || "INVALID_REQUEST" });
  };

  const onSessionReplaced = () => publish({
    type: "SESSION_REPLACED",
    userMessage: "Esta sessão foi retomada por outra ligação. Se acabaste de atualizar a página, podes fechar este separador antigo.",
  });

  const onKickedFromLobby = () => publish({
    type: "KICKED_FROM_LOBBY",
    userMessage: "O anfitrião removeu-te do lobby. Podes voltar a entrar normalmente se ainda existir um lugar livre.",
  });

  const onState = ({ message }) => {
    if (!welcomed) {
      return publish({
        type: "LEGACY_HOST_STATE",
        userMessage: "O anfitrião está a usar uma versão antiga sem identidade segura.",
      });
    }
    return publish({ type: "STATE_RECEIVED", game: message.g });
  };

  return Object.freeze({
    onIdentityWelcome,
    onSessionResult,
    onClaimResult,
    onLeaveResult,
    onSessionReplaced,
    onKickedFromLobby,
    onState,
    hasWelcome: () => welcomed,
    isAuthenticated: () => authenticated,
    isAuthResolved: () => authResolved,
  });
}
