import { isGameMode } from "./gameModes.js";
import { isSessionTokenHash } from "./playerIdentity.js";
import { GAME_LOG_LIMIT, GAME_PRESENTATION_VERSION } from "./presentationState.js";
import { assertActionJournal } from "./actionJournal.js";
import { MANDATORY_DECISION } from "./mandatoryDecisionReducer.js";

const RESOURCE_KEYS = ["madeira", "tijolo", "cavalos", "ouro", "obsidiana"];

function isPlayerPermutation(value, playerCount) {
  if (!Array.isArray(value) || value.length !== playerCount) return false;
  const seen = new Set(value);
  return seen.size === playerCount
    && value.every((index) => Number.isSafeInteger(index) && index >= 0 && index < playerCount);
}

function assertQueueInvariants(game) {
  const validTypes = new Set(Object.values(MANDATORY_DECISION));
  game.queue.forEach((entry, index) => {
    requireCondition(entry && typeof entry === "object" && !Array.isArray(entry), "INVALID_QUEUE_ENTRY", `A decisão pendente ${index + 1} é inválida.`);
    requireCondition(validTypes.has(entry.t), "INVALID_QUEUE_TYPE", `A decisão pendente ${index + 1} tem um tipo desconhecido.`, entry.t);
    requireCondition(Number.isSafeInteger(entry.p) && entry.p >= 0 && entry.p < game.players.length, "INVALID_QUEUE_PLAYER", `A decisão pendente ${index + 1} aponta para um jogador inexistente.`, entry.p);
    if (entry.t === MANDATORY_DECISION.DISCARD)
      requireCondition(Number.isSafeInteger(entry.need) && entry.need >= 0, "INVALID_QUEUE_AMOUNT", "O descarte pendente tem uma quantidade inválida.", entry.need);
    if ([MANDATORY_DECISION.TRIBUTE, MANDATORY_DECISION.BLESSING].includes(entry.t))
      requireCondition(Number.isSafeInteger(entry.left) && entry.left > 0, "INVALID_QUEUE_AMOUNT", "A decisão de recursos pendente tem uma quantidade inválida.", entry.left);
  });
}

function assertTradeInvariants(game) {
  if (game.trade == null) return;
  const trade = game.trade;
  requireCondition(trade && typeof trade === "object" && !Array.isArray(trade), "INVALID_TRADE", "A troca pendente é inválida.");
  requireCondition(Number.isSafeInteger(trade.from) && trade.from >= 0 && trade.from < game.players.length, "INVALID_TRADE_PLAYER", "O proponente da troca não existe.", trade.from);
  const validTarget = trade.to === "all" || (Number.isSafeInteger(trade.to) && trade.to >= 0 && trade.to < game.players.length && trade.to !== trade.from);
  requireCondition(validTarget, "INVALID_TRADE_PLAYER", "O destinatário da troca não existe.", trade.to);
  requireCondition(trade.declined == null || Array.isArray(trade.declined), "INVALID_TRADE_DECLINED", "A lista de recusas da troca é inválida.");
  const declined = new Set();
  for (const playerIndex of trade.declined || []) {
    requireCondition(Number.isSafeInteger(playerIndex) && playerIndex >= 0 && playerIndex < game.players.length && playerIndex !== trade.from, "INVALID_TRADE_DECLINED", "A troca contém uma recusa de jogador inválida.", playerIndex);
    requireCondition(!declined.has(playerIndex), "INVALID_TRADE_DECLINED", "A troca contém recusas duplicadas.", playerIndex);
    declined.add(playerIndex);
  }
  let bundleTotal = 0;
  for (const bundle of [trade.give, trade.get]) {
    requireCondition(bundle && typeof bundle === "object" && !Array.isArray(bundle), "INVALID_TRADE_BUNDLE", "A troca contém recursos inválidos.");
    for (const [resource, amount] of Object.entries(bundle)) {
      requireCondition(RESOURCE_KEYS.includes(resource), "INVALID_TRADE_RESOURCE", "A troca contém um recurso desconhecido.", resource);
      requireCondition(Number.isSafeInteger(amount) && amount >= 0, "INVALID_TRADE_AMOUNT", "A troca contém uma quantidade inválida.", amount);
      bundleTotal += amount;
    }
  }
  requireCondition(bundleTotal > 0, "INVALID_TRADE_BUNDLE", "A troca pendente não contém recursos.");
}

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
  if (game.phase !== "lobby") {
    requireCondition(isPlayerPermutation(game.order, game.players.length), "INVALID_TURN_ORDER", "A ordem de turnos guardada é inválida.", game.order);
  }
  if (game.phase === "setup") {
    requireCondition(game.setup && typeof game.setup === "object" && !Array.isArray(game.setup), "INVALID_SETUP", "O setup guardado é inválido.");
    requireCondition(Array.isArray(game.setup.seq) && game.setup.seq.length === game.players.length * 2, "INVALID_SETUP_SEQUENCE", "A sequência do setup é inválida.", game.setup?.seq);
    requireCondition(game.setup.seq.every((playerIndex) => Number.isSafeInteger(playerIndex) && playerIndex >= 0 && playerIndex < game.players.length), "INVALID_SETUP_SEQUENCE", "A sequência do setup aponta para jogadores inexistentes.");
    requireCondition(Number.isSafeInteger(game.setup.i) && game.setup.i >= 0 && game.setup.i < game.setup.seq.length, "INVALID_SETUP_INDEX", "O passo atual do setup é inválido.", game.setup.i);
    requireCondition(typeof game.setup.needRoad === "boolean", "INVALID_SETUP_STEP", "O estado de estrada do setup é inválido.");
    requireCondition(!game.setup.needRoad || typeof game.setup.lastV === "string", "INVALID_SETUP_STEP", "O setup espera uma estrada sem ter uma aldeia de origem válida.", game.setup.lastV);
  }
  requireCondition(Array.isArray(game.queue), "INVALID_QUEUE", "A fila de decisões é inválida.");
  assertQueueInvariants(game);
  assertTradeInvariants(game);

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
  requireCondition(game.phase === "ended" ? game.winner != null : game.winner == null, "INVALID_WINNER_PHASE", "O vencedor guardado não corresponde à fase da partida.", { phase: game.phase, winner: game.winner });
  try {
    assertActionJournal(game.actionJournal);
  } catch (error) {
    requireCondition(false, "INVALID_ACTION_JOURNAL", "O registo técnico de ações é inválido.", error?.message || null);
  }
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
