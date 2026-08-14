import { markRematchReady } from "./rematch.js";
import { GAME_ACTION } from "./gameProtocol.js";
import { createStableId, findPlayerIndexById } from "./playerIdentity.js";
import {
  BUILD_COSTS,
  PIECE_LIMITS,
  RESOURCE_KEYS,
  canPay,
} from "./resources.js";
import {
  bankRatio,
  pieceCount,
  validPalaces,
  validRoads,
  validVillages,
} from "./buildingRules.js";
import {
  reducePalaceConstruction,
  reduceRoadConstruction,
  reduceVillageConstruction,
} from "./constructionReducer.js";
import { reduceDiceRoll, rollDicePair } from "./diceReducer.js";
import { reduceDisaster } from "./disasterReducer.js";
import {
  reduceDevelopmentCardPlay,
  reduceDevelopmentCardPurchase,
} from "./developmentCardReducer.js";
import {
  normalizeResourceBundle,
  reduceBankTrade,
  reduceTradeAcceptance,
  reduceTradeCancellation,
  reduceTradeDecline,
  reduceTradeProposal,
} from "./tradeReducer.js";
import {
  WAR_UNIT_TYPES,
  bribeTargets,
  hasWarPerk,
  militaryActionsLeft,
  reduceTroopRecruitment,
  reduceUnitAction,
  reduceUnitBribe,
  reduceUnitDeployment,
  troopCost,
  unitTargets,
  validDeployHexes,
} from "./warReducer.js";
import { reduceTrollOmen } from "./warAutomationReducer.js";
import { reduceTurnAdvance } from "./turnCycleReducer.js";
import {
  reduceDiscardDecision,
  reduceDragonPlacement,
  reduceQueueResourceDecision,
  reduceResourceSteal,
  reduceTsunamiDecision,
  validDragonHexes,
} from "./mandatoryDecisionReducer.js";
import {
  reduceRoundLimitVictory,
  reduceScoringAfterAction,
} from "./scoringReducer.js";
import {
  homeHexes,
  reduceColonistLoading,
  reduceRemoteVillageFoundation,
  reduceWagonConstruction,
  reduceWagonMove,
  remoteVillageSpots,
  validWagonBuildHexes,
  validWagonMoves,
} from "./explorationReducer.js";
import { makeBoardGraph } from "./boardGeometry.js";
import {
  isExplorationMode,
  isRapidMode,
  isWarMode,
} from "./gameModes.js";

export const GAME_ACTION_REDUCER_VERSION = 1;

function cloneGame(game) {
  // The host-private action journal is intentionally outside reducer state.
  // Copying an ever-growing replay log on every game action would turn action
  // reduction into O(history) work. The authority layer reattaches/appends the
  // journal after the reducer accepts an action.
  const source = game?.actionJournal
    ? Object.fromEntries(Object.entries(game).filter(([key]) => key !== "actionJournal"))
    : game;
  if (typeof structuredClone === "function") return structuredClone(source);
  return JSON.parse(JSON.stringify(source));
}

export function currentGameActorIndex(game) {
  if (game?.phase === "setup") return game.setup?.seq?.[game.setup?.i];
  return game?.order?.[game?.turn?.pos];
}

function validResource(resource) {
  return typeof resource === "string" && RESOURCE_KEYS.includes(resource);
}

function validKey(value, max = 120) {
  return typeof value === "string" && value.length > 0 && value.length <= max;
}

function accepted(game, actorIndex, actionType, events = [], privateResult = null) {
  return {
    ok: true,
    game,
    actorIndex,
    actionType,
    events,
    ...(privateResult ? { privateResult } : {}),
  };
}

function rejected(reason) {
  return { ok: false, reason };
}

function appendScoring(game, actorIndex, events, options = {}) {
  const scored = reduceScoringAfterAction(game, actorIndex, options);
  events.push(...(scored.event?.events || []));
  return scored.game;
}

function resolveDiceAction(game, graph, actorIndex, { rng, now, dice }) {
  const events = [];
  const rolled = reduceDiceRoll(game, graph, actorIndex, dice || rollDicePair(rng));
  let next = rolled.game;
  events.push(rolled.event);

  if (rolled.event.triggerTrollOmen) {
    const omen = reduceTrollOmen(next, graph, actorIndex, { rng });
    next = omen.game;
    events.push(...(omen.event?.events || []));
  }

  if (rolled.event.triggerDisaster) {
    const disaster = reduceDisaster(next, graph, rolled.event.total, { rng, now });
    next = disaster.game;
    events.push(disaster.event);
  }

  return { game: next, events };
}

/**
 * Central authoritative game-action reducer.
 *
 * It contains game validation and state transitions only. React, PeerJS,
 * logging, audio and animation are deliberately kept outside this module.
 */
export function applyGameAction(current, actorId, action, options = {}) {
  if (!action || typeof action !== "object" || typeof action.type !== "string") {
    return rejected("INVALID_ACTION");
  }
  if (current?.phase === "ended" && action.type === GAME_ACTION.REMATCH_READY) {
    const rematch = markRematchReady(current, actorId);
    if (!rematch.ok) return rejected(rematch.reason);
    if (rematch.noChange) return accepted(current, rematch.actorIndex, action.type, []);
    return accepted(rematch.game, rematch.actorIndex, action.type, [rematch.event]);
  }
  if (!current || !Array.isArray(current.players) || current.phase === "lobby" || current.phase === "ended") {
    return rejected("NOT_IN_GAME");
  }
  if (!action || typeof action !== "object" || typeof action.type !== "string") {
    return rejected("INVALID_ACTION");
  }

  const actorIndex = findPlayerIndexById(current, actorId);
  if (actorIndex < 0) return rejected("UNAUTHENTICATED");
  if (current.players[actorIndex]?.connected === false) return rejected("PLAYER_DISCONNECTED");

  const rng = typeof options.rng === "function" ? options.rng : Math.random;
  const now = typeof options.now === "function" ? options.now : Date.now;
  const createId = typeof options.createId === "function" ? options.createId : createStableId;
  let next = cloneGame(current);
  const graph = makeBoardGraph(next.board.hexes);
  const activeIndex = currentGameActorIndex(next);
  const isCurrentPlayer = actorIndex === activeIndex;
  const queueItem = next.queue?.[0] || null;
  const actionType = action.type;
  if (actionType === GAME_ACTION.REMATCH_READY) return rejected("WRONG_PHASE");

  const requireCurrentPlayer = () => (isCurrentPlayer ? null : rejected("NOT_CURRENT_PLAYER"));
  const requirePlayTurn = ({ rolled = true, allowDragon = false } = {}) => {
    if (next.phase !== "play") return rejected("WRONG_PHASE");
    if (!isCurrentPlayer) return rejected("NOT_CURRENT_PLAYER");
    if (next.winner != null) return rejected("NOT_IN_GAME");
    if (queueItem || next.turn?.steal || next.turn?.deploy) return rejected("BLOCKED_BY_DECISION");
    if (next.trade) return rejected("BLOCKED_BY_TRADE");
    if (rolled && !next.turn?.rolled) return rejected("MUST_ROLL_FIRST");
    if (!allowDragon && next.turn?.mustDragon) return rejected("MUST_PLACE_DRAGON");
    return null;
  };

  if (actionType === GAME_ACTION.RESOLVE_DISCARD) {
    try {
      const reduced = reduceDiscardDecision(next, actorIndex, action.resources);
      return accepted(reduced.game, actorIndex, actionType, [reduced.event]);
    } catch (error) {
      return rejected(error instanceof TypeError || error instanceof RangeError
        ? "INVALID_RESOURCE"
        : "NOT_PENDING_DECISION");
    }
  }

  if (actionType === GAME_ACTION.RESOLVE_TSUNAMI) {
    if (!validKey(action.edge)) return rejected("INVALID_EDGE");
    try {
      const reduced = reduceTsunamiDecision(next, graph, actorIndex, action.edge);
      return accepted(reduced.game, actorIndex, actionType, [reduced.event]);
    } catch {
      return rejected(queueItem?.t === "tsunami" ? "INVALID_EDGE" : "NOT_PENDING_DECISION");
    }
  }

  if (actionType === GAME_ACTION.RESOLVE_QUEUE_RESOURCE) {
    if (!validResource(action.resource)) return rejected("INVALID_RESOURCE");
    try {
      const reduced = reduceQueueResourceDecision(next, actorIndex, action.resource);
      return accepted(reduced.game, actorIndex, actionType, [reduced.event]);
    } catch (error) {
      return rejected(error instanceof TypeError ? "INVALID_RESOURCE" : "NOT_PENDING_DECISION");
    }
  }

  if ([GAME_ACTION.ACCEPT_TRADE, GAME_ACTION.DECLINE_TRADE].includes(actionType)) {
    const trade = next.trade;
    if (!trade || typeof action.tradeId !== "string" || action.tradeId !== trade.id) {
      return rejected("TRADE_CHANGED");
    }
    const addressed = trade.to === actorIndex || trade.to === "all";
    if (!addressed || trade.from === actorIndex || (trade.declined || []).includes(actorIndex)) {
      return rejected("NOT_RECIPIENT");
    }
    if (actionType === GAME_ACTION.ACCEPT_TRADE) {
      const proposer = next.players[trade.from];
      const recipient = next.players[actorIndex];
      if (!proposer || !recipient) return rejected("INVALID_TRADE");
      const affordable = Object.entries(trade.give).every(([resource, amount]) => proposer.res[resource] >= amount)
        && Object.entries(trade.get).every(([resource, amount]) => recipient.res[resource] >= amount);
      if (!affordable) return rejected("CANNOT_AFFORD");
      const reduced = reduceTradeAcceptance(next, actorIndex, action.tradeId);
      return accepted(reduced.game, actorIndex, actionType, [reduced.event]);
    }
    const reduced = reduceTradeDecline(next, actorIndex, action.tradeId);
    return accepted(reduced.game, actorIndex, actionType, [reduced.event]);
  }

  const turnError = requireCurrentPlayer();
  if (turnError) return turnError;

  switch (actionType) {
    case GAME_ACTION.ROLL_DICE: {
      if (next.phase !== "play") return rejected("WRONG_PHASE");
      if (next.turn.rolled) return rejected("INVALID_ACTION");
      if (queueItem || next.turn.steal) return rejected("BLOCKED_BY_DECISION");
      if (next.trade) return rejected("BLOCKED_BY_TRADE");
      const reduced = resolveDiceAction(next, graph, actorIndex, {
        rng,
        now,
        dice: options.dice,
      });
      return accepted(reduced.game, actorIndex, actionType, reduced.events);
    }

    case GAME_ACTION.BUILD_VILLAGE: {
      if (!validKey(action.vertex)) return rejected("INVALID_VERTEX");
      if (next.phase === "setup") {
        if (next.setup.needRoad || !validVillages(next, graph, actorIndex, true).includes(action.vertex)) {
          return rejected("INVALID_VERTEX");
        }
        const setupPiece = isRapidMode(next.mode) ? "palacio" : "aldeia";
        if (pieceCount(next, actorIndex, setupPiece) >= PIECE_LIMITS[setupPiece]) return rejected("PIECE_LIMIT");
      } else {
        const blocked = requirePlayTurn();
        if (blocked) return blocked;
        if (!validVillages(next, graph, actorIndex, false).includes(action.vertex)) return rejected("INVALID_VERTEX");
        if (pieceCount(next, actorIndex, "aldeia") >= PIECE_LIMITS.aldeia) return rejected("PIECE_LIMIT");
        if (!canPay(next.players[actorIndex], BUILD_COSTS.aldeia)) return rejected("CANNOT_AFFORD");
      }
      const reduced = reduceVillageConstruction(next, graph, actorIndex, action.vertex);
      next = reduced.game;
      const events = [reduced.event];
      if (reduced.event.type === "VILLAGE_BUILT") {
        next = appendScoring(next, actorIndex, events, { longestRoad: true });
      }
      return accepted(next, actorIndex, actionType, events);
    }

    case GAME_ACTION.BUILD_ROAD: {
      if (!validKey(action.edge)) return rejected("INVALID_EDGE");
      if (next.phase === "setup") {
        if (!next.setup.needRoad || !validRoads(next, graph, actorIndex, next.setup.lastV).includes(action.edge)) {
          return rejected("INVALID_EDGE");
        }
        if (pieceCount(next, actorIndex, "estrada") >= PIECE_LIMITS.estrada) return rejected("PIECE_LIMIT");
      } else {
        const blocked = requirePlayTurn();
        if (blocked) return blocked;
        if (!validRoads(next, graph, actorIndex).includes(action.edge)) return rejected("INVALID_EDGE");
        if (pieceCount(next, actorIndex, "estrada") >= PIECE_LIMITS.estrada) return rejected("PIECE_LIMIT");
        if (next.players[actorIndex].freeRoads <= 0 && !canPay(next.players[actorIndex], BUILD_COSTS.estrada)) {
          return rejected("CANNOT_AFFORD");
        }
      }
      const reduced = reduceRoadConstruction(next, actorIndex, action.edge);
      next = reduced.game;
      const events = [reduced.event];
      if (reduced.event.type === "ROAD_BUILT") {
        next = appendScoring(next, actorIndex, events, { longestRoad: true });
      }
      return accepted(next, actorIndex, actionType, events);
    }

    case GAME_ACTION.BUILD_PALACE: {
      const blocked = requirePlayTurn();
      if (blocked) return blocked;
      if (!validKey(action.vertex) || !validPalaces(next, actorIndex).includes(action.vertex)) return rejected("INVALID_VERTEX");
      if (pieceCount(next, actorIndex, "palacio") >= PIECE_LIMITS.palacio) return rejected("PIECE_LIMIT");
      if (!canPay(next.players[actorIndex], BUILD_COSTS.palacio)) return rejected("CANNOT_AFFORD");
      const reduced = reducePalaceConstruction(next, actorIndex, action.vertex);
      const events = [reduced.event];
      next = appendScoring(reduced.game, actorIndex, events);
      return accepted(next, actorIndex, actionType, events);
    }

    case GAME_ACTION.PLACE_DRAGON: {
      if (!isCurrentPlayer) return rejected("NOT_CURRENT_PLAYER");
      if (next.phase !== "play" || !next.turn.rolled || !next.turn.mustDragon) return rejected("WRONG_PHASE");
      if (queueItem) return rejected("BLOCKED_BY_DECISION");
      if (!validKey(action.hex) || !validDragonHexes(next).includes(action.hex)) return rejected("INVALID_HEX");
      try {
        const reduced = reduceDragonPlacement(next, graph, actorIndex, action.hex);
        return accepted(reduced.game, actorIndex, actionType, [reduced.event]);
      } catch {
        return rejected("INVALID_HEX");
      }
    }

    case GAME_ACTION.STEAL_RESOURCE: {
      if (!isCurrentPlayer) return rejected("NOT_CURRENT_PLAYER");
      if (next.phase !== "play" || !next.turn.steal) return rejected("NOT_PENDING_DECISION");
      if (!Number.isSafeInteger(action.victimIndex)) return rejected("INVALID_PLAYER");
      try {
        const reduced = reduceResourceSteal(next, actorIndex, action.victimIndex, { rng });
        return accepted(reduced.game, actorIndex, actionType, [reduced.event], reduced.privateResult);
      } catch {
        return rejected("INVALID_PLAYER");
      }
    }

    case GAME_ACTION.BUY_DEV_CARD: {
      const blocked = requirePlayTurn();
      if (blocked) return blocked;
      if (!next.deck.length) return rejected("DECK_EMPTY");
      if (!canPay(next.players[actorIndex], BUILD_COSTS.carta)) return rejected("CANNOT_AFFORD");
      const reduced = reduceDevelopmentCardPurchase(next, actorIndex);
      const events = [reduced.event];
      next = appendScoring(reduced.game, actorIndex, events);
      return accepted(next, actorIndex, actionType, events);
    }

    case GAME_ACTION.BANK_TRADE: {
      const blocked = requirePlayTurn();
      if (blocked) return blocked;
      if (!validResource(action.give) || !validResource(action.get) || action.give === action.get) {
        return rejected("INVALID_RESOURCE");
      }
      const ratio = bankRatio(next, graph, actorIndex, action.give);
      if (next.players[actorIndex].res[action.give] < ratio) return rejected("CANNOT_AFFORD");
      const reduced = reduceBankTrade(next, graph, actorIndex, action.give, action.get);
      return accepted(reduced.game, actorIndex, actionType, [reduced.event]);
    }

    case GAME_ACTION.RECRUIT_TROOP: {
      const blocked = requirePlayTurn();
      if (blocked) return blocked;
      if (!isWarMode(next.mode)) return rejected("WRONG_MODE");
      if (!WAR_UNIT_TYPES.includes(action.subtype)) return rejected("INVALID_UNIT");
      if (militaryActionsLeft(next) <= 0) return rejected("ALREADY_ACTED");
      if (!canPay(next.players[actorIndex], troopCost(next, actorIndex, action.subtype))) return rejected("CANNOT_AFFORD");
      if (!validDeployHexes(next, graph, actorIndex, action.subtype).length) return rejected("NO_DEPLOY_SPACE");
      const reduced = reduceTroopRecruitment(next, actorIndex, action.subtype);
      const events = [reduced.event];
      next = appendScoring(reduced.game, actorIndex, events, { largestArmy: true });
      return accepted(next, actorIndex, actionType, events);
    }

    case GAME_ACTION.DEPLOY_UNIT: {
      if (next.phase !== "play" || !next.turn?.rolled || !isCurrentPlayer) {
        return rejected(next.phase !== "play" || !next.turn?.rolled ? "WRONG_PHASE" : "NOT_CURRENT_PLAYER");
      }
      if (!isWarMode(next.mode)) return rejected("WRONG_MODE");
      if (queueItem || next.turn?.steal || next.trade || next.turn?.mustDragon) {
        return rejected(queueItem || next.turn?.steal
          ? "BLOCKED_BY_DECISION"
          : next.trade
            ? "BLOCKED_BY_TRADE"
            : "MUST_PLACE_DRAGON");
      }
      if (!next.turn?.deploy || !validKey(action.hex)
        || !validDeployHexes(next, graph, actorIndex, next.turn.deploy).includes(action.hex)) {
        return rejected("INVALID_HEX");
      }
      const reduced = reduceUnitDeployment(next, graph, actorIndex, action.hex);
      return accepted(reduced.game, actorIndex, actionType, [reduced.event]);
    }

    case GAME_ACTION.UNIT_ACTION: {
      const blocked = requirePlayTurn();
      if (blocked) return blocked;
      if (!isWarMode(next.mode)) return rejected("WRONG_MODE");
      if (!validKey(action.fromHex) || !validKey(action.toHex)) return rejected("INVALID_UNIT");
      const unit = next.units[action.fromHex];
      if (!unit || unit.p !== actorIndex) return rejected("INVALID_UNIT");
      if ((next.turn.acted || {})[action.fromHex]) return rejected("ALREADY_ACTED");
      if (militaryActionsLeft(next) <= 0 && next.turn.bonus !== action.fromHex) return rejected("ALREADY_ACTED");
      if (!unitTargets(next, graph, action.fromHex, actorIndex).has(action.toHex)) return rejected("INVALID_UNIT");
      const reduced = reduceUnitAction(next, graph, actorIndex, action.fromHex, action.toHex);
      return accepted(reduced.game, actorIndex, actionType, [reduced.event]);
    }

    case GAME_ACTION.BRIBE_UNIT: {
      const blocked = requirePlayTurn();
      if (blocked) return blocked;
      if (!isWarMode(next.mode) || !hasWarPerk(next, actorIndex, "romeo")) return rejected("WRONG_MODE");
      if (!validKey(action.hex) || !bribeTargets(next, actorIndex).has(action.hex)) return rejected("INVALID_UNIT");
      if (next.turn.bribed) return rejected("ALREADY_ACTED");
      if ((next.players[actorIndex].res.ouro || 0) < 2) return rejected("CANNOT_AFFORD");
      const reduced = reduceUnitBribe(next, graph, actorIndex, action.hex);
      return accepted(reduced.game, actorIndex, actionType, [reduced.event]);
    }

    case GAME_ACTION.BUILD_WAGON: {
      const blocked = requirePlayTurn();
      if (blocked) return blocked;
      if (!isExplorationMode(next.mode)) return rejected("WRONG_MODE");
      if (!validKey(action.hex) || !validWagonBuildHexes(next, graph, actorIndex).includes(action.hex)) return rejected("INVALID_HEX");
      const reduced = reduceWagonConstruction(next, graph, actorIndex, action.hex);
      return accepted(reduced.game, actorIndex, actionType, [reduced.event]);
    }

    case GAME_ACTION.MOVE_WAGON: {
      const blocked = requirePlayTurn();
      if (blocked) return blocked;
      if (!isExplorationMode(next.mode)) return rejected("WRONG_MODE");
      if (!validKey(action.wagonId, 80) || !validKey(action.hex)
        || !validWagonMoves(next, action.wagonId, actorIndex).includes(action.hex)) {
        return rejected("INVALID_WAGON");
      }
      const reduced = reduceWagonMove(next, graph, actorIndex, action.wagonId, action.hex);
      return accepted(reduced.game, actorIndex, actionType, [reduced.event]);
    }

    case GAME_ACTION.LOAD_COLONISTS: {
      const blocked = requirePlayTurn();
      if (blocked) return blocked;
      if (!isExplorationMode(next.mode)) return rejected("WRONG_MODE");
      if (!validKey(action.wagonId, 80)) return rejected("INVALID_WAGON");
      const wagon = next.wagons?.[action.wagonId];
      if (!wagon || wagon.p !== actorIndex || wagon.cargo || !homeHexes(next, graph, actorIndex).has(wagon.at)) {
        return rejected("INVALID_WAGON");
      }
      if (pieceCount(next, actorIndex, "aldeia") >= PIECE_LIMITS.aldeia) return rejected("PIECE_LIMIT");
      if (!canPay(next.players[actorIndex], BUILD_COSTS.aldeia)) return rejected("CANNOT_AFFORD");
      const reduced = reduceColonistLoading(next, graph, actorIndex, action.wagonId);
      return accepted(reduced.game, actorIndex, actionType, [reduced.event]);
    }

    case GAME_ACTION.FOUND_REMOTE_VILLAGE: {
      const blocked = requirePlayTurn();
      if (blocked) return blocked;
      if (!isExplorationMode(next.mode)) return rejected("WRONG_MODE");
      if (!validKey(action.wagonId, 80) || !validKey(action.vertex)) return rejected("INVALID_WAGON");
      const wagon = next.wagons?.[action.wagonId];
      if (!wagon || wagon.p !== actorIndex || !wagon.cargo
        || !remoteVillageSpots(next, graph, action.wagonId).includes(action.vertex)) {
        return rejected("INVALID_VERTEX");
      }
      const reduced = reduceRemoteVillageFoundation(next, graph, actorIndex, action.wagonId, action.vertex);
      const events = [reduced.event];
      next = appendScoring(reduced.game, actorIndex, events, { longestRoad: true });
      return accepted(next, actorIndex, actionType, events);
    }

    case GAME_ACTION.PLAY_DEV_CARD: {
      const blocked = requirePlayTurn();
      if (blocked) return blocked;
      if (!Number.isSafeInteger(action.cardId)) return rejected("INVALID_CARD");
      const player = next.players[actorIndex];
      const card = player.devOld.find((candidate) => candidate.id === action.cardId);
      if (!card || card.kind === "vp") return rejected("INVALID_CARD");
      if (card.kind === "tropa" && player.sick > 0) return rejected("INVALID_CARD");
      if (!isWarMode(next.mode) && next.turn.devPlayed) return rejected("ALREADY_ACTED");
      if (isWarMode(next.mode) && card.kind === "tropa") {
        if (next.turn.troopPlayed || militaryActionsLeft(next) <= 0) return rejected("ALREADY_ACTED");
        if (!validDeployHexes(next, graph, actorIndex, card.sub).length) return rejected("NO_DEPLOY_SPACE");
      }
      let targetIndex = null;
      if (card.kind === "espiao") {
        targetIndex = findPlayerIndexById(next, action.targetPlayerId);
        if (targetIndex < 0 || targetIndex === actorIndex) return rejected("INVALID_PLAYER");
      }
      if (card.kind === "monopolio" && !validResource(action.resource)) return rejected("INVALID_RESOURCE");
      if (card.kind === "descoberta"
        && (!validResource(action.firstResource) || !validResource(action.secondResource))) {
        return rejected("INVALID_RESOURCE");
      }
      const reduced = reduceDevelopmentCardPlay(next, actorIndex, action.cardId, {
        targetIndex,
        resource: action.resource,
        firstResource: action.firstResource,
        secondResource: action.secondResource,
      });
      const events = [reduced.event];
      next = appendScoring(reduced.game, actorIndex, events);
      return accepted(next, actorIndex, actionType, events, reduced.privateResult);
    }

    case GAME_ACTION.PROPOSE_TRADE: {
      const blocked = requirePlayTurn();
      if (blocked) return blocked;
      const give = normalizeResourceBundle(action.give);
      const get = normalizeResourceBundle(action.get);
      if (!give || !get || Object.keys(give).length + Object.keys(get).length === 0) return rejected("INVALID_TRADE");
      if (!Object.entries(give).every(([resource, amount]) => next.players[actorIndex].res[resource] >= amount)) {
        return rejected("CANNOT_AFFORD");
      }
      if (action.toPlayerId !== "all") {
        const target = findPlayerIndexById(next, action.toPlayerId);
        if (target < 0 || target === actorIndex) return rejected("INVALID_PLAYER");
        if (next.players[target]?.connected === false) return rejected("PLAYER_DISCONNECTED");
      } else if (next.players.every((player, index) => index === actorIndex || player?.connected === false)) {
        return rejected("PLAYER_DISCONNECTED");
      }
      const reduced = reduceTradeProposal(next, actorIndex, {
        tradeId: createId("trade"),
        toPlayerId: action.toPlayerId,
        give,
        get,
      });
      return accepted(reduced.game, actorIndex, actionType, [reduced.event]);
    }

    case GAME_ACTION.CANCEL_TRADE: {
      if (!next.trade || typeof action.tradeId !== "string" || action.tradeId !== next.trade.id) {
        return rejected("TRADE_CHANGED");
      }
      if (next.trade.from !== actorIndex) return rejected("NOT_RECIPIENT");
      const reduced = reduceTradeCancellation(next, actorIndex, action.tradeId);
      return accepted(reduced.game, actorIndex, actionType, [reduced.event]);
    }

    case GAME_ACTION.END_TURN: {
      const blocked = requirePlayTurn();
      if (blocked) return blocked;
      if (next.turn.deploy) return rejected("BLOCKED_BY_DECISION");
      const reduced = reduceTurnAdvance(next, graph, actorIndex, { rng });
      next = reduced.game;
      const events = [reduced.event];
      if (reduced.event.roundLimitReached) {
        const victory = reduceRoundLimitVictory(next);
        next = victory.game;
        events.push(victory.event);
      }
      return accepted(next, actorIndex, actionType, events);
    }

    default:
      return rejected("UNKNOWN_ACTION");
  }
}
