import { isGameMode } from "./gameModes.js";
import { isSessionTokenHash } from "./playerIdentity.js";
import { GAME_LOG_LIMIT, GAME_PRESENTATION_VERSION } from "./presentationState.js";

const RESOURCE_KEYS = ["madeira", "tijolo", "cavalos", "ouro", "obsidiana"];

function requireCondition(condition, code, message, details = null) {
  if (!condition) {
    const error = new Error(message);
    error.code = code;
    error.details = details;
    throw error;
  }
}

export function assertGameInvariants(game) {
  requireCondition(game && typeof game === "object" && !Array.isArray(game), "INVALID_GAME", "O save não contém um jogo válido.");
  requireCondition(typeof game.code === "string" && game.code.length >= 1, "INVALID_CODE", "O código do reino é inválido.");
  requireCondition(isGameMode(game.mode), "INVALID_MODE", "O modo guardado não é reconhecido.", game.mode);
  requireCondition(["lobby", "setup", "play", "ended"].includes(game.phase), "INVALID_PHASE", "A fase guardada é inválida.", game.phase);
  requireCondition(Array.isArray(game.players) && game.players.length >= 1 && game.players.length <= 8, "INVALID_PLAYERS", "A lista de jogadores é inválida.");

  const playerIds = new Set();
  const seatIds = new Set();
  game.players.forEach((player, index) => {
    requireCondition(player && typeof player === "object", "INVALID_PLAYER", `O jogador ${index + 1} é inválido.`);
    requireCondition(typeof player.playerId === "string" && player.playerId.length > 0, "INVALID_PLAYER_ID", `O jogador ${index + 1} não tem identidade.`);
    requireCondition(typeof player.seatId === "string" && player.seatId.length > 0, "INVALID_SEAT_ID", `O jogador ${index + 1} não tem lugar válido.`);
    requireCondition(!playerIds.has(player.playerId), "DUPLICATE_PLAYER_ID", "Existem jogadores com a mesma identidade.", player.playerId);
    requireCondition(!seatIds.has(player.seatId), "DUPLICATE_SEAT_ID", "Existem jogadores no mesmo lugar.", player.seatId);
    playerIds.add(player.playerId);
    seatIds.add(player.seatId);
    const hasCharacter = typeof player.ch === "string" && player.ch.length > 0;
    const pendingLobbyChoice = game.phase === "lobby" && player.characterConfirmed !== true && player.ch == null;
    requireCondition(hasCharacter || pendingLobbyChoice, "INVALID_CHARACTER", `O jogador ${index + 1} não tem personagem válida.`);
    requireCondition(player.characterConfirmed !== true || hasCharacter, "INVALID_CHARACTER_CONFIRMATION", `O jogador ${index + 1} confirmou uma personagem inexistente.`);
    requireCondition(player.sessionTokenHash == null || isSessionTokenHash(player.sessionTokenHash), "INVALID_SESSION_HASH", `A sessão do jogador ${index + 1} é inválida.`);
    requireCondition(player.res && typeof player.res === "object", "INVALID_RESOURCES", `Os recursos do jogador ${index + 1} são inválidos.`);
    RESOURCE_KEYS.forEach((key) => {
      const value = player.res[key];
      requireCondition(Number.isSafeInteger(value) && value >= 0, "INVALID_RESOURCE_COUNT", `O recurso ${key} do jogador ${index + 1} é inválido.`, value);
    });
    requireCondition(Array.isArray(player.devNew) && Array.isArray(player.devOld), "INVALID_DEVELOPMENT_CARDS", `As cartas do jogador ${index + 1} são inválidas.`);
  });

  requireCondition(game.board && Array.isArray(game.board.hexes) && game.board.hexes.length > 0, "INVALID_BOARD", "O tabuleiro guardado é inválido.");
  const hexKeys = new Set();
  for (const hex of game.board.hexes) {
    requireCondition(hex && typeof hex.k === "string" && !hexKeys.has(hex.k), "INVALID_HEX", "O tabuleiro contém hexágonos inválidos ou repetidos.", hex?.k);
    hexKeys.add(hex.k);
  }
  requireCondition(game.turn && typeof game.turn === "object", "INVALID_TURN", "O turno guardado é inválido.");
  requireCondition(Number.isSafeInteger(game.turn.pos) && game.turn.pos >= 0 && game.turn.pos < game.players.length, "INVALID_TURN_PLAYER", "O jogador do turno não existe.", game.turn.pos);
  requireCondition(Array.isArray(game.queue), "INVALID_QUEUE", "A fila de decisões é inválida.");

  requireCondition(game.presentation && typeof game.presentation === "object" && !Array.isArray(game.presentation), "INVALID_PRESENTATION", "O estado de apresentação do reino é inválido.");
  requireCondition(game.presentation.version === GAME_PRESENTATION_VERSION, "INVALID_PRESENTATION_VERSION", "A versão do estado de apresentação não é suportada.", game.presentation.version);
  requireCondition(Array.isArray(game.presentation.log) && game.presentation.log.length <= GAME_LOG_LIMIT, "INVALID_PRESENTATION_LOG", "As crónicas guardadas são inválidas.");
  game.presentation.log.forEach((entry, index) => {
    requireCondition(entry && typeof entry === "object", "INVALID_PRESENTATION_LOG_ENTRY", `A entrada ${index + 1} das crónicas é inválida.`);
    requireCondition(Number.isFinite(entry.id), "INVALID_PRESENTATION_EVENT_ID", `A entrada ${index + 1} das crónicas não tem identificador válido.`);
    requireCondition(typeof entry.msg === "string", "INVALID_PRESENTATION_LOG_MESSAGE", `A entrada ${index + 1} das crónicas não tem texto válido.`);
    requireCondition(entry.pi == null || (Number.isSafeInteger(entry.pi) && entry.pi >= 0 && entry.pi < game.players.length), "INVALID_PRESENTATION_PLAYER", `A entrada ${index + 1} das crónicas aponta para um jogador inexistente.`);
  });
  for (const [field, value] of [["story", game.presentation.story], ["cardReveal", game.presentation.cardReveal], ["award", game.presentation.award], ["disaster", game.presentation.disaster]]) {
    requireCondition(value == null || (typeof value === "object" && !Array.isArray(value)), "INVALID_PRESENTATION_EVENT", `O evento de apresentação ${field} é inválido.`);
    if (value != null)
      requireCondition(Number.isFinite(value.id), "INVALID_PRESENTATION_EVENT_ID", `O evento de apresentação ${field} não tem identificador válido.`);
  }

  requireCondition(game.winner == null || (Number.isSafeInteger(game.winner) && game.winner >= 0 && game.winner < game.players.length), "INVALID_WINNER", "O vencedor guardado não existe.");
  return game;
}

export function validateGameInvariants(game) {
  try {
    assertGameInvariants(game);
    return { ok: true, game };
  } catch (error) {
    return { ok: false, error };
  }
}
