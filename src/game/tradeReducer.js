import { bankRatio } from "./buildingRules.js";
import { RESOURCE_KEYS, isResourceKey } from "./resources.js";

function cloneResources(resources) {
  return Object.fromEntries(RESOURCE_KEYS.map((resource) => [resource, resources?.[resource] || 0]));
}

function clonePlayer(player) {
  return { ...player, res: cloneResources(player?.res) };
}

function clonePlayers(players) {
  return (players || []).map(clonePlayer);
}

function ensureActor(game, actorIndex) {
  if (!Number.isSafeInteger(actorIndex) || actorIndex < 0 || actorIndex >= (game.players?.length || 0)) {
    throw new RangeError("Jogador inválido para a troca.");
  }
}

function ensureTradeId(tradeId) {
  if (typeof tradeId !== "string" || !tradeId.length || tradeId.length > 80) {
    throw new TypeError("Identificador de troca inválido.");
  }
}

function cloneStatsWithIncrements(stats, playerCount, key, playerIndexes) {
  const next = { ...(stats || {}) };
  const values = Array.isArray(next[key]) ? next[key].slice() : [];
  while (values.length < playerCount) values.push(0);
  for (const playerIndex of playerIndexes) {
    values[playerIndex] = (values[playerIndex] || 0) + 1;
  }
  next[key] = values;
  return next;
}

function canAffordBundle(player, bundle) {
  return Object.entries(bundle).every(([resource, amount]) => (player?.res?.[resource] || 0) >= amount);
}

function findPlayerIndexById(game, playerId) {
  return (game.players || []).findIndex((player) => player?.playerId === playerId);
}

function currentTrade(game, tradeId) {
  ensureTradeId(tradeId);
  if (!game.trade || game.trade.id !== tradeId) throw new Error("A proposta de troca já mudou ou terminou.");
  return game.trade;
}

function ensureRecipient(trade, actorIndex) {
  const addressed = trade.to === actorIndex || trade.to === "all";
  if (!addressed || trade.from === actorIndex || (trade.declined || []).includes(actorIndex)) {
    throw new Error("O jogador não é destinatário desta troca.");
  }
}

export function normalizeResourceBundle(bundle, { maxAmount = 99 } = {}) {
  if (!bundle || typeof bundle !== "object" || Array.isArray(bundle)) return null;
  if (Object.keys(bundle).some((resource) => !isResourceKey(resource))) return null;
  const safe = {};
  for (const resource of RESOURCE_KEYS) {
    const amount = bundle[resource] || 0;
    if (!Number.isSafeInteger(amount) || amount < 0 || amount > maxAmount) return null;
    if (amount > 0) safe[resource] = amount;
  }
  return safe;
}

export function reduceBankTrade(game, graph, actorIndex, give, get) {
  ensureActor(game, actorIndex);
  if (!isResourceKey(give) || !isResourceKey(get) || give === get) {
    throw new TypeError("Recursos inválidos para a troca com o banco.");
  }
  const ratio = bankRatio(game, graph, actorIndex, give);
  const players = clonePlayers(game.players);
  const player = players[actorIndex];
  if ((player.res[give] || 0) < ratio) throw new Error("O jogador não consegue pagar a troca bancária.");
  player.res[give] -= ratio;
  player.res[get] += 1;
  return {
    game: {
      ...game,
      players,
      stats: cloneStatsWithIncrements(game.stats, players.length, "portTrades", [actorIndex]),
    },
    event: {
      type: "BANK_TRADE_COMPLETED",
      actorIndex,
      give,
      get,
      ratio,
    },
  };
}

export function reduceTradeProposal(game, actorIndex, {
  tradeId,
  toPlayerId = "all",
  give,
  get,
} = {}) {
  ensureActor(game, actorIndex);
  ensureTradeId(tradeId);
  if (game.trade) throw new Error("Já existe uma proposta de troca em curso.");
  const safeGive = normalizeResourceBundle(give);
  const safeGet = normalizeResourceBundle(get);
  if (!safeGive || !safeGet || Object.keys(safeGive).length + Object.keys(safeGet).length === 0) {
    throw new TypeError("Proposta de troca inválida.");
  }
  if (!canAffordBundle(game.players[actorIndex], safeGive)) {
    throw new Error("O proponente não consegue pagar a oferta.");
  }

  let target = "all";
  let stableTargetId = "all";
  let declined = [];
  if (toPlayerId !== "all") {
    target = findPlayerIndexById(game, toPlayerId);
    if (target < 0 || target === actorIndex) throw new RangeError("Destinatário inválido para a troca.");
    if (game.players[target]?.connected === false) throw new Error("O destinatário está desligado.");
    stableTargetId = game.players[target].playerId;
  } else {
    declined = (game.players || [])
      .map((player, index) => ({ player, index }))
      .filter(({ player, index }) => index !== actorIndex && player?.connected === false)
      .map(({ index }) => index);
    if (declined.length >= (game.players?.length || 0) - 1) {
      throw new Error("Não existem destinatários ligados para esta troca.");
    }
  }

  const trade = {
    id: tradeId,
    from: actorIndex,
    fromPlayerId: game.players[actorIndex].playerId,
    to: target,
    toPlayerId: stableTargetId,
    give: safeGive,
    get: safeGet,
    declined,
  };
  return {
    game: { ...game, trade },
    event: {
      type: "PLAYER_TRADE_PROPOSED",
      actorIndex,
      targetIndex: target,
      trade: { ...trade, give: { ...safeGive }, get: { ...safeGet }, declined: declined.slice() },
    },
  };
}

export function reduceTradeAcceptance(game, actorIndex, tradeId) {
  ensureActor(game, actorIndex);
  const trade = currentTrade(game, tradeId);
  ensureRecipient(trade, actorIndex);
  const players = clonePlayers(game.players);
  const proposer = players[trade.from];
  const recipient = players[actorIndex];
  if (!proposer || !recipient) throw new Error("A proposta referencia um jogador inexistente.");
  if (!canAffordBundle(proposer, trade.give) || !canAffordBundle(recipient, trade.get)) {
    throw new Error("Recursos insuficientes para concluir a troca.");
  }

  for (const [resource, amount] of Object.entries(trade.give)) {
    proposer.res[resource] -= amount;
    recipient.res[resource] += amount;
  }
  for (const [resource, amount] of Object.entries(trade.get)) {
    recipient.res[resource] -= amount;
    proposer.res[resource] += amount;
  }

  return {
    game: {
      ...game,
      players,
      trade: null,
      stats: cloneStatsWithIncrements(game.stats, players.length, "p2pTrades", [actorIndex, trade.from]),
    },
    event: {
      type: "PLAYER_TRADE_ACCEPTED",
      actorIndex,
      proposerIndex: trade.from,
      tradeId,
    },
  };
}

export function reduceTradeDecline(game, actorIndex, tradeId) {
  ensureActor(game, actorIndex);
  const trade = currentTrade(game, tradeId);
  ensureRecipient(trade, actorIndex);
  const declined = Array.isArray(trade.declined) ? trade.declined.slice() : [];
  if (!declined.includes(actorIndex)) declined.push(actorIndex);
  const closed = trade.to !== "all" || declined.length >= (game.players?.length || 0) - 1;
  const nextTrade = closed ? null : { ...trade, declined };
  return {
    game: { ...game, trade: nextTrade },
    event: {
      type: "PLAYER_TRADE_DECLINED",
      actorIndex,
      proposerIndex: trade.from,
      tradeId,
      closed,
      broadcast: trade.to === "all",
    },
  };
}

export function reduceTradeCancellation(game, actorIndex, tradeId) {
  ensureActor(game, actorIndex);
  const trade = currentTrade(game, tradeId);
  if (trade.from !== actorIndex) throw new Error("Apenas o proponente pode cancelar a troca.");
  return {
    game: { ...game, trade: null },
    event: {
      type: "PLAYER_TRADE_CANCELLED",
      actorIndex,
      tradeId,
    },
  };
}


export function reduceTradeForDisconnectedPlayer(game, playerIndex) {
  ensureActor(game, playerIndex);
  const trade = game.trade;
  if (!trade) return { game, event: null };

  if (trade.from === playerIndex) {
    return {
      game: { ...game, trade: null },
      event: {
        type: "PLAYER_TRADE_CANCELLED_DISCONNECT",
        actorIndex: playerIndex,
        tradeId: trade.id,
      },
    };
  }

  const addressed = trade.to === playerIndex || trade.to === "all";
  if (!addressed || (trade.declined || []).includes(playerIndex)) return { game, event: null };

  if (trade.to !== "all") {
    return {
      game: { ...game, trade: null },
      event: {
        type: "PLAYER_TRADE_DECLINED_DISCONNECT",
        actorIndex: playerIndex,
        proposerIndex: trade.from,
        tradeId: trade.id,
        closed: true,
        broadcast: false,
      },
    };
  }

  const declined = Array.isArray(trade.declined) ? trade.declined.slice() : [];
  declined.push(playerIndex);
  const closed = declined.length >= (game.players?.length || 0) - 1;
  return {
    game: { ...game, trade: closed ? null : { ...trade, declined } },
    event: {
      type: "PLAYER_TRADE_DECLINED_DISCONNECT",
      actorIndex: playerIndex,
      proposerIndex: trade.from,
      tradeId: trade.id,
      closed,
      broadcast: true,
    },
  };
}
