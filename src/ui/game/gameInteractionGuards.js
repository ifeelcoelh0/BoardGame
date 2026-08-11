import { isWarMode } from "../../game/gameModes.js";
import { militaryActionsLeft, validDeployHexes } from "../../game/warReducer.js";

export function isSeatCurrentPlayer(game, seat) {
  if (!game || !Number.isSafeInteger(seat)) return false;
  if (game.phase === "setup") return game.setup?.seq?.[game.setup?.i] === seat;
  if (game.phase !== "play") return false;
  return game.order?.[game.turn?.pos] === seat;
}

export function playTurnBlockReason(game, seat, {
  myTurn = null,
  requireRolled = true,
  allowDragon = false,
  allowDeploy = false,
  allowTrade = false,
  allowDecision = false,
} = {}) {
  if (game?.phase !== "play") return "A partida ainda não está na fase de jogo.";
  const current = myTurn == null
    ? isSeatCurrentPlayer(game, seat) && game.players?.[seat]?.connected !== false
    : !!myTurn;
  if (!current) return "Aguarda pelo teu turno.";
  if (game?.winner != null) return "A partida já terminou.";
  if (!allowDecision && (game?.queue?.[0] || game?.turn?.steal)) return "Resolve primeiro a decisão pendente.";
  if (!allowDeploy && game?.turn?.deploy) return "Destaca primeiro a tropa recrutada.";
  if (!allowTrade && game?.trade) return "Conclui ou cancela primeiro a troca em curso.";
  if (requireRolled && !game?.turn?.rolled) return "Lança os dados primeiro.";
  if (!allowDragon && game?.turn?.mustDragon) return "Move primeiro o Dragão.";
  return null;
}

export function rollTurnBlockReason(game, seat, { myTurn = null } = {}) {
  if (game?.phase !== "play") return "A partida ainda não está na fase de jogo.";
  const current = myTurn == null
    ? isSeatCurrentPlayer(game, seat) && game.players?.[seat]?.connected !== false
    : !!myTurn;
  if (!current) return "Aguarda pelo teu turno.";
  if (game?.winner != null) return "A partida já terminou.";
  if (game?.turn?.rolled) return "Os dados já foram lançados neste turno.";
  if (game?.queue?.[0] || game?.turn?.steal || game?.turn?.deploy) return "Resolve primeiro a decisão pendente.";
  if (game?.trade) return "Conclui ou cancela primeiro a troca em curso.";
  return null;
}

export function developmentCardPlayReason(game, graph, seat, card, {
  isNew = false,
  isLibrary = false,
  myTurn = null,
} = {}) {
  if (!card || typeof card !== "object") return "Carta inválida.";
  if (isLibrary) return "Esta é apenas uma página do Grimório.";
  if (isNew) return "Carta nova — jogável a partir do próximo turno.";
  if (card.kind === "vp") return "Esta carta vale um Ponto de Vitória e permanece secreta.";

  const common = playTurnBlockReason(game, seat, { myTurn });
  if (common) return common;

  const player = game.players?.[seat];
  if (!player?.devOld?.some((candidate) => candidate?.id === card.id && candidate?.kind === card.kind)) {
    return "Esta carta já não está disponível para jogar.";
  }
  if (card.kind === "tropa" && (player.sick || 0) > 0) {
    return `Doente pela Peste (${player.sick} turno${player.sick === 1 ? "" : "s"}).`;
  }

  if (!isWarMode(game.mode)) {
    if (game.turn?.devPlayed) return "Já jogaste uma Carta de Desenvolvimento neste turno.";
    return null;
  }

  if (card.kind === "tropa") {
    if (game.turn?.troopPlayed) return "Já jogaste uma carta de tropa neste turno.";
    if (militaryActionsLeft(game) <= 0) return "Já gastaste as ações militares deste turno.";
    if (!validDeployHexes(game, graph, seat, card.sub).length) return "Não há espaço livre junto ao teu Bastião para destacar esta tropa.";
  }
  return null;
}

export function boardInteractionBlockReason(game, seat, { myTurn = null } = {}) {
  if (game?.phase === "setup") {
    const current = myTurn == null ? isSeatCurrentPlayer(game, seat) : !!myTurn;
    return current ? null : "Aguarda pela tua vez de fundar o reino.";
  }
  if (game?.phase !== "play") return "O tabuleiro não aceita ações nesta fase.";
  const current = myTurn == null
    ? isSeatCurrentPlayer(game, seat) && game.players?.[seat]?.connected !== false
    : !!myTurn;
  if (!current) return "Aguarda pelo teu turno.";
  if (game?.winner != null) return "A partida já terminou.";
  if (game?.queue?.[0] || game?.turn?.steal) return "Resolve primeiro a decisão pendente.";
  if (game?.trade) return "Conclui ou cancela primeiro a troca em curso.";
  if (!game?.turn?.rolled) return "Lança os dados primeiro.";
  return null;
}
