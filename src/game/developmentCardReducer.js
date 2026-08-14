import {
  BUILD_COSTS,
  RESOURCE_KEYS,
  canPay,
  isResourceKey,
} from "./resources.js";
import { reduceScoringAwards } from "./scoringReducer.js";
import { isClassicMode, isWarMode } from "./gameModes.js";

export const DEVELOPMENT_CARD_KINDS = Object.freeze({
  TROOP: "tropa",
  VICTORY_POINT: "vp",
  MONOPOLY: "monopolio",
  DISCOVERY: "descoberta",
  ROADS: "estradas",
  FORCED_MARCH: "marcha",
  SPY: "espiao",
});

const TROOP_TYPES = new Set(["cavaleiro", "catapulta", "arqueiro"]);

function cloneResources(resources) {
  return Object.fromEntries(RESOURCE_KEYS.map((resource) => [resource, resources?.[resource] || 0]));
}

function clonePlayer(player) {
  return {
    ...player,
    res: cloneResources(player?.res),
    devNew: Array.isArray(player?.devNew) ? player.devNew.slice() : [],
    devOld: Array.isArray(player?.devOld) ? player.devOld.slice() : [],
    troops: {
      cavaleiro: player?.troops?.cavaleiro || 0,
      catapulta: player?.troops?.catapulta || 0,
      arqueiro: player?.troops?.arqueiro || 0,
    },
  };
}

function clonePlayers(players) {
  return (players || []).map(clonePlayer);
}

function cloneTurn(turn) {
  return {
    ...(turn || {}),
    acted: { ...(turn?.acted || {}) },
  };
}

function ensureActor(game, actorIndex) {
  if (!Number.isSafeInteger(actorIndex) || actorIndex < 0 || actorIndex >= (game.players?.length || 0)) {
    throw new RangeError("Jogador inválido para a ação de carta de desenvolvimento.");
  }
}

function removePlayableCard(player, cardId) {
  if (!Number.isSafeInteger(cardId)) throw new TypeError("Identificador de carta inválido.");
  const cardIndex = player.devOld.findIndex((card) => card?.id === cardId);
  if (cardIndex < 0) throw new Error("A carta não está disponível para jogar.");
  const [card] = player.devOld.splice(cardIndex, 1);
  if (!card || card.kind === DEVELOPMENT_CARD_KINDS.VICTORY_POINT) {
    throw new Error("Esta carta não pode ser jogada.");
  }
  return card;
}

function cloneStatsWithPurchase(stats, playerCount, actorIndex) {
  const current = stats || {};
  const devBought = Array.isArray(current.devBought) ? current.devBought.slice() : [];
  while (devBought.length < playerCount) devBought.push(0);
  devBought[actorIndex] = (devBought[actorIndex] || 0) + 1;
  return { ...current, devBought };
}

function subtractCardCost(resources) {
  const next = cloneResources(resources);
  for (const [resource, amount] of Object.entries(BUILD_COSTS.carta)) {
    next[resource] -= amount;
  }
  return next;
}

function assertResource(resource) {
  if (!isResourceKey(resource)) throw new TypeError(`Recurso inválido: ${String(resource)}`);
}

function trinityState(game, actorIndex) {
  const player = game.players[actorIndex];
  const complete = !isClassicMode(game.mode)
    && (player.troops?.cavaleiro || 0) >= 1
    && (player.troops?.catapulta || 0) >= 1
    && (player.troops?.arqueiro || 0) >= 1;
  const immunityGranted = complete && !isWarMode(game.mode) && !player.immune;
  if (immunityGranted) player.immune = true;
  return { complete, immunityGranted };
}

export function reduceDevelopmentCardPurchase(game, actorIndex) {
  ensureActor(game, actorIndex);
  if (!Array.isArray(game.deck) || !game.deck.length) {
    throw new Error("O baralho de desenvolvimento está vazio.");
  }

  if (!canPay(game.players[actorIndex], BUILD_COSTS.carta)) {
    throw new Error("O jogador não consegue pagar a carta de desenvolvimento.");
  }

  const players = clonePlayers(game.players);
  const player = players[actorIndex];
  player.res = subtractCardCost(player.res);
  const deck = game.deck.slice();
  const card = deck.pop();
  player.devNew.push(card);

  return {
    game: {
      ...game,
      players,
      deck,
      stats: cloneStatsWithPurchase(game.stats, players.length, actorIndex),
    },
    event: {
      type: "DEVELOPMENT_CARD_BOUGHT",
      actorIndex,
      card: { ...card },
    },
  };
}

export function promoteNewDevelopmentCards(game, actorIndex) {
  ensureActor(game, actorIndex);
  const players = clonePlayers(game.players);
  const player = players[actorIndex];
  const promoted = player.devNew.map((card) => ({ ...card }));
  player.devOld.push(...player.devNew);
  player.devNew = [];
  return {
    game: { ...game, players },
    event: {
      type: "DEVELOPMENT_CARDS_MATURED",
      actorIndex,
      promoted,
    },
  };
}

export function reduceDevelopmentCardPlay(game, actorIndex, cardId, choices = {}) {
  ensureActor(game, actorIndex);
  const players = clonePlayers(game.players);
  const turn = cloneTurn(game.turn);
  const player = players[actorIndex];
  const card = removePlayableCard(player, cardId);
  let privateResult = null;
  let details = {};

  if (card.kind === DEVELOPMENT_CARD_KINDS.TROOP) {
    if (!TROOP_TYPES.has(card.sub)) throw new TypeError("Tipo de tropa inválido na carta.");
    const trinityWasComplete = !isClassicMode(game.mode)
      && (player.troops?.cavaleiro || 0) >= 1
      && (player.troops?.catapulta || 0) >= 1
      && (player.troops?.arqueiro || 0) >= 1;
    player.troops[card.sub] = (player.troops[card.sub] || 0) + 1;
    turn.devPlayed = true;
    if (isWarMode(game.mode)) {
      turn.troopPlayed = true;
      turn.deploy = card.sub;
    } else {
      turn.mustDragon = true;
    }
    const partial = { ...game, players, turn };
    const trinity = trinityState(partial, actorIndex);
    const scored = reduceScoringAwards(partial, { largestArmy: true });
    details = {
      troopType: card.sub,
      trinityCompleted: trinity.complete && !trinityWasComplete,
      trinityImmunityGranted: trinity.immunityGranted,
      largestArmy: scored.game.la,
      previousLargestArmy: game.la?.p ?? null,
      scoringEvents: scored.event.events,
    };
  } else if (card.kind === DEVELOPMENT_CARD_KINDS.ROADS) {
    turn.devPlayed = true;
    player.freeRoads = 2;
    details = { freeRoads: 2 };
  } else if (card.kind === DEVELOPMENT_CARD_KINDS.FORCED_MARCH) {
    turn.devPlayed = true;
    turn.milN = (turn.milN || 0) - 1;
    details = { militaryActionsGranted: 1 };
  } else if (card.kind === DEVELOPMENT_CARD_KINDS.SPY) {
    const targetIndex = choices.targetIndex;
    if (!Number.isSafeInteger(targetIndex) || targetIndex < 0 || targetIndex >= players.length || targetIndex === actorIndex) {
      throw new RangeError("Alvo inválido para o Espião.");
    }
    privateResult = {
      type: "SPY_REPORT",
      targetPlayerId: players[targetIndex].playerId,
      resources: cloneResources(players[targetIndex].res),
    };
    details = { targetIndex };
  } else if (card.kind === DEVELOPMENT_CARD_KINDS.MONOPOLY) {
    assertResource(choices.resource);
    turn.devPlayed = true;
    let total = 0;
    players.forEach((other, playerIndex) => {
      if (playerIndex === actorIndex) return;
      const amount = other.res[choices.resource] || 0;
      total += amount;
      player.res[choices.resource] += amount;
      other.res[choices.resource] = 0;
    });
    details = { resource: choices.resource, total };
  } else if (card.kind === DEVELOPMENT_CARD_KINDS.DISCOVERY) {
    assertResource(choices.firstResource);
    assertResource(choices.secondResource);
    turn.devPlayed = true;
    player.res[choices.firstResource] += 1;
    player.res[choices.secondResource] += 1;
    details = {
      firstResource: choices.firstResource,
      secondResource: choices.secondResource,
    };
  } else {
    throw new TypeError(`Tipo de carta não suportado: ${String(card.kind)}`);
  }

  const next = {
    ...game,
    players,
    turn,
  };
  if (details.largestArmy !== undefined) next.la = details.largestArmy;

  return {
    game: next,
    event: {
      type: "DEVELOPMENT_CARD_PLAYED",
      actorIndex,
      card: { ...card },
      details,
    },
    privateResult,
  };
}
