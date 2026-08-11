import { activePorts, bankRatio } from "../../game/buildingRules.js";
import { RESOURCE_KEYS, handSize } from "../../game/resources.js";
import { characterById } from "../../game/characterCatalog.js";
import { developmentCardPlayReason, playTurnBlockReason } from "./gameInteractionGuards.js";

export const GAME_DECISION_TYPE = Object.freeze({
  DISCARD: "discard",
  TSUNAMI: "tsunami",
  QUEUE_RESOURCE: "queue-resource",
  STEAL: "steal",
  SPY_TARGET: "spy-target",
  SPY_REPORT: "spy-report",
  MONOPOLY: "monopoly",
  DISCOVERY: "discovery",
  BANK: "bank",
  TRADE_PROPOSAL: "trade-proposal",
  TRADE_RESPONSE: "trade-response",
});

function freezeList(items) {
  return Object.freeze(items.map((item) => Object.freeze({ ...item })));
}

function playerSummary(game, index) {
  const player = game.players?.[index];
  if (!player) return null;
  const character = characterById(player.ch);
  return Object.freeze({
    index,
    playerId: player.playerId,
    characterId: player.ch,
    name: character?.n || String(player.ch || "Jogador"),
    handSize: handSize(player),
    connected: player.connected !== false,
  });
}

function inventory(player) {
  return Object.freeze(Object.fromEntries(RESOURCE_KEYS.map((resource) => [resource, player?.res?.[resource] || 0])));
}

function mandatoryDecision(game, graph, seat) {
  const pending = game?.queue?.[0];
  if (!pending || pending.p !== seat) return null;
  const player = game.players?.[seat];
  if (!player) return null;

  if (pending.t === "descarte") {
    return Object.freeze({
      type: GAME_DECISION_TYPE.DISCARD,
      source: "mandatory",
      tone: "danger",
      eyebrow: "Decisão obrigatória",
      title: "O Dragão exige sacrifício",
      description: `Tens demasiados recursos. Sacrifica exatamente ${pending.need}.`,
      need: pending.need,
      inventory: inventory(player),
      dismissible: false,
    });
  }

  if (pending.t === "tsunami") {
    const ports = activePorts(game, graph, seat).map((port) => ({ edge: port.e, portType: port.type }));
    return Object.freeze({
      type: GAME_DECISION_TYPE.TSUNAMI,
      source: "mandatory",
      tone: "storm",
      eyebrow: "Desastre",
      title: "Tsunami",
      description: "Escolhe o porto a sacrificar. Ficará inutilizado durante 3 turnos.",
      ports: freezeList(ports),
      dismissible: false,
    });
  }

  if (pending.t === "tributo" || pending.t === "bencao") {
    const blessing = pending.t === "bencao";
    const guard = blessing && pending.guard === true;
    return Object.freeze({
      type: GAME_DECISION_TYPE.QUEUE_RESOURCE,
      source: "mandatory",
      tone: pending.t === "tributo" ? "royal" : "dragon",
      eyebrow: pending.t === "tributo" ? "Tributo Real" : guard ? "Guarda do Coração" : "Bênção do Dragão",
      title: pending.t === "tributo" ? "Reclama o tributo" : guard ? "O Coração recompensa a tua guarda" : "O Dragão abre o tesouro",
      description: `Escolhe ${pending.left} recurso${pending.left === 1 ? "" : "s"}.`,
      remaining: pending.left,
      guard,
      inventory: inventory(player),
      dismissible: false,
    });
  }

  return null;
}

function incomingTradeDecision(game, seat) {
  const trade = game?.trade;
  if (!trade || trade.from === seat) return null;
  const addressed = trade.to === seat || trade.to === "all";
  if (!addressed || (trade.declined || []).includes(seat)) return null;
  const proposer = playerSummary(game, trade.from);
  return Object.freeze({
    type: GAME_DECISION_TYPE.TRADE_RESPONSE,
    source: "network",
    tone: "trade",
    eyebrow: "Proposta recebida",
    title: `${proposer?.name || "Outro reino"} propõe uma troca`,
    description: "Confirma os termos antes de aceitar.",
    tradeId: trade.id,
    proposer,
    give: Object.freeze({ ...(trade.give || {}) }),
    get: Object.freeze({ ...(trade.get || {}) }),
    inventory: inventory(game.players?.[seat]),
    canAccept: Object.entries(trade.get || {}).every(([resource, amount]) => (game.players?.[seat]?.res?.[resource] || 0) >= amount),
    dismissible: false,
  });
}

function stealDecision(game, seat) {
  const pending = game?.turn?.steal;
  if (!pending?.victims?.length) return null;
  const current = game.phase === "play" ? game.order?.[game.turn?.pos] : null;
  if (current !== seat) return null;
  return Object.freeze({
    type: GAME_DECISION_TYPE.STEAL,
    source: "turn",
    tone: "danger",
    eyebrow: "Dragão",
    title: "Escolhe a tua vítima",
    description: "Roubarás um recurso aleatório da mão escolhida.",
    openedAt: pending.at || 0,
    players: freezeList(pending.victims.map((index) => playerSummary(game, index)).filter(Boolean)),
    dismissible: false,
  });
}

function localPlayableCard(game, graph, seat, local, expectedKind) {
  const card = game.players?.[seat]?.devOld?.find((candidate) => candidate?.id === local?.cardId);
  if (!card || card.kind !== expectedKind) return null;
  return developmentCardPlayReason(game, graph, seat, card) ? null : card;
}

function localDecision(game, graph, seat, local) {
  if (!local?.type) return null;
  const player = game.players?.[seat];
  if (!player) return null;

  if (local.type === "spy") {
    if (!localPlayableCard(game, graph, seat, local, "espiao")) return null;
    return Object.freeze({
      type: GAME_DECISION_TYPE.SPY_TARGET,
      source: "card",
      tone: "shadow",
      eyebrow: "Carta de Desenvolvimento",
      title: "Espião",
      description: "Escolhe a corte que queres infiltrar.",
      cardId: local.cardId,
      players: freezeList((game.players || []).map((_, index) => index === seat ? null : playerSummary(game, index)).filter(Boolean)),
      dismissible: true,
    });
  }

  if (local.type === "spy-report") {
    const targetIndex = (game.players || []).findIndex((candidate) => candidate.playerId === local.targetPlayerId);
    return Object.freeze({
      type: GAME_DECISION_TYPE.SPY_REPORT,
      source: "card",
      tone: "shadow",
      eyebrow: "Relatório privado",
      title: "Relatório do Espião",
      description: `A mão de ${playerSummary(game, targetIndex)?.name || "o reino infiltrado"}.`,
      resources: Object.freeze({ ...(local.resources || {}) }),
      dismissible: true,
    });
  }

  if (local.type === "monopolio") {
    if (!localPlayableCard(game, graph, seat, local, "monopolio")) return null;
    return Object.freeze({
      type: GAME_DECISION_TYPE.MONOPOLY,
      source: "card",
      tone: "royal",
      eyebrow: "Carta de Desenvolvimento",
      title: "Monopólio",
      description: "Escolhe o recurso que será confiscado dos outros reinos.",
      cardId: local.cardId,
      dismissible: true,
    });
  }

  if (local.type === "descoberta") {
    if (!localPlayableCard(game, graph, seat, local, "descoberta")) return null;
    return Object.freeze({
      type: GAME_DECISION_TYPE.DISCOVERY,
      source: "card",
      tone: "craft",
      eyebrow: "Carta de Desenvolvimento",
      title: "Trabalhadores",
      description: local.first ? "Escolhe agora o segundo recurso." : "Escolhe o primeiro de dois recursos.",
      cardId: local.cardId,
      first: local.first || null,
      dismissible: true,
    });
  }

  if (local.type === "bank") {
    if (playTurnBlockReason(game, seat)) return null;
    const exchanges = [];
    for (const give of RESOURCE_KEYS) {
      const ratio = bankRatio(game, graph, seat, give);
      exchanges.push({
        give,
        ratio,
        affordable: (player.res?.[give] || 0) >= ratio,
        receives: Object.freeze(RESOURCE_KEYS.filter((resource) => resource !== give)),
      });
    }
    return Object.freeze({
      type: GAME_DECISION_TYPE.BANK,
      source: "utility",
      tone: "trade",
      eyebrow: "Mercado do Reino",
      title: "Trocar com o Banco",
      description: "Portos melhoram a taxa normal de 4:1 para 3:1 ou 2:1.",
      inventory: inventory(player),
      exchanges: freezeList(exchanges),
      hasAffordableExchange: exchanges.some((entry) => entry.affordable),
      dismissible: true,
    });
  }

  if (local.type === "trade-proposal") {
    if (playTurnBlockReason(game, seat)) return null;
    const targets = (game.players || [])
      .map((_, index) => index === seat ? null : playerSummary(game, index))
      .filter(Boolean);
    return Object.freeze({
      type: GAME_DECISION_TYPE.TRADE_PROPOSAL,
      source: "utility",
      tone: "trade",
      eyebrow: "Diplomacia",
      title: "Propor troca",
      description: "Define o que ofereces, o que procuras e a quem envias a proposta.",
      inventory: inventory(player),
      players: freezeList(targets),
      dismissible: true,
    });
  }

  return null;
}

export function buildGameDecisionModel(game, graph, seat, ui = {}) {
  if (!game || !Array.isArray(game.players) || !game.players[seat]) return null;
  return mandatoryDecision(game, graph, seat)
    || stealDecision(game, seat)
    || incomingTradeDecision(game, seat)
    || localDecision(game, graph, seat, ui.decision)
    || null;
}
