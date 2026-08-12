import { GAME_ACTION } from "./gameProtocol.js";
import { makeBoardGraph } from "./boardGeometry.js";
import {
  BUILD_COSTS,
  PIECE_LIMITS,
  RESOURCE_KEYS,
  canPay,
} from "./resources.js";
import {
  activePorts,
  bankRatio,
  pieceCount,
  validPalaces,
  validRoads,
  validVillages,
} from "./buildingRules.js";
import {
  WAR_UNIT_TYPES,
  bribeTargets,
  hasWarPerk,
  militaryActionsLeft,
  troopCost,
  unitTargets,
  validDeployHexes,
} from "./warReducer.js";
import {
  MAX_WAGONS_PER_GAME,
  WAGON_COST,
  homeHexes,
  playerWagons,
  remoteVillageSpots,
  validWagonBuildHexes,
  validWagonMoves,
  wagonBuildCount,
} from "./explorationReducer.js";
import { isExplorationMode, isRapidMode, isWarMode } from "./gameModes.js";
import {
  MANDATORY_DECISION,
  requiredGameActorIndex,
  validDragonHexes,
} from "./mandatoryDecisionReducer.js";

export const LEGAL_ACTIONS_VERSION = 1;

function validActor(game, actorIndex) {
  return Number.isSafeInteger(actorIndex)
    && actorIndex >= 0
    && actorIndex < (game?.players?.length || 0);
}

function resourceBundleTotal(bundle) {
  return RESOURCE_KEYS.reduce((sum, resource) => sum + (bundle?.[resource] || 0), 0);
}

function canAffordBundle(player, bundle) {
  return Object.entries(bundle || {}).every(([resource, amount]) => (
    Number.isSafeInteger(amount)
    && amount >= 0
    && (player?.res?.[resource] || 0) >= amount
  ));
}

function makeDiscardBundle(player, need) {
  let remaining = Math.max(0, Number(need) || 0);
  const resources = Object.fromEntries(RESOURCE_KEYS.map((resource) => [resource, 0]));
  const richestFirst = RESOURCE_KEYS
    .map((resource) => ({ resource, amount: player?.res?.[resource] || 0 }))
    .sort((a, b) => b.amount - a.amount || RESOURCE_KEYS.indexOf(a.resource) - RESOURCE_KEYS.indexOf(b.resource));
  for (const { resource, amount } of richestFirst) {
    if (remaining <= 0) break;
    const take = Math.min(amount, remaining);
    resources[resource] = take;
    remaining -= take;
  }
  return remaining === 0 ? resources : null;
}

function incomingTradeActions(game, actorIndex) {
  const trade = game?.trade;
  if (!trade || trade.from === actorIndex) return [];
  const addressed = trade.to === actorIndex || trade.to === "all";
  if (!addressed || (trade.declined || []).includes(actorIndex)) return [];
  const actions = [];
  if (canAffordBundle(game.players?.[actorIndex], trade.get)) {
    actions.push({ type: GAME_ACTION.ACCEPT_TRADE, tradeId: trade.id });
  }
  actions.push({ type: GAME_ACTION.DECLINE_TRADE, tradeId: trade.id });
  return actions;
}

function mandatoryActions(game, graph, actorIndex) {
  const pending = game?.queue?.[0];
  if (!pending || pending.p !== actorIndex) return [];
  if (pending.t === MANDATORY_DECISION.DISCARD) {
    const resources = makeDiscardBundle(game.players[actorIndex], pending.need);
    return resources ? [{ type: GAME_ACTION.RESOLVE_DISCARD, resources }] : [];
  }
  if (pending.t === MANDATORY_DECISION.TSUNAMI) {
    return activePorts(game, graph, actorIndex).map((port) => ({
      type: GAME_ACTION.RESOLVE_TSUNAMI,
      edge: port.e,
    }));
  }
  if ([MANDATORY_DECISION.TRIBUTE, MANDATORY_DECISION.BLESSING].includes(pending.t)) {
    return RESOURCE_KEYS.map((resource) => ({
      type: GAME_ACTION.RESOLVE_QUEUE_RESOURCE,
      resource,
    }));
  }
  return [];
}

function setupActions(game, graph, actorIndex) {
  if (game?.phase !== "setup" || requiredGameActorIndex(game) !== actorIndex) return [];
  if (game.setup?.needRoad) {
    if (pieceCount(game, actorIndex, "estrada") >= PIECE_LIMITS.estrada) return [];
    return validRoads(game, graph, actorIndex, game.setup?.lastV).map((edge) => ({
      type: GAME_ACTION.BUILD_ROAD,
      edge,
    }));
  }
  const setupPiece = isRapidMode(game.mode) ? "palacio" : "aldeia";
  if (pieceCount(game, actorIndex, setupPiece) >= PIECE_LIMITS[setupPiece]) return [];
  return validVillages(game, graph, actorIndex, true)
    // A setup settlement must leave at least one legal adjacent road. In the
    // larger Exploration board some edge vertices are valid settlements but
    // all adjacent edges are waste/fog boundaries; choosing one would strand
    // any player (human or bot) on the mandatory road step.
    .filter((vertex) => validRoads(game, graph, actorIndex, vertex).length > 0)
    .map((vertex) => ({
      type: GAME_ACTION.BUILD_VILLAGE,
      vertex,
    }));
}

function developmentCardActions(game, graph, actorIndex) {
  const player = game.players[actorIndex];
  const actions = [];
  for (const card of player?.devOld || []) {
    if (!card || card.kind === "vp") continue;
    if (card.kind === "tropa" && player.sick > 0) continue;
    if (!isWarMode(game.mode) && game.turn?.devPlayed) continue;
    if (isWarMode(game.mode) && card.kind === "tropa") {
      if (game.turn?.troopPlayed || militaryActionsLeft(game) <= 0) continue;
      if (!validDeployHexes(game, graph, actorIndex, card.sub).length) continue;
    }
    if (card.kind === "espiao") {
      game.players.forEach((candidate, targetIndex) => {
        if (targetIndex !== actorIndex && candidate) {
          actions.push({
            type: GAME_ACTION.PLAY_DEV_CARD,
            cardId: card.id,
            targetPlayerId: candidate.playerId,
          });
        }
      });
      continue;
    }
    if (card.kind === "monopolio") {
      RESOURCE_KEYS.forEach((resource) => actions.push({
        type: GAME_ACTION.PLAY_DEV_CARD,
        cardId: card.id,
        resource,
      }));
      continue;
    }
    if (card.kind === "descoberta") {
      RESOURCE_KEYS.forEach((firstResource) => RESOURCE_KEYS.forEach((secondResource) => actions.push({
        type: GAME_ACTION.PLAY_DEV_CARD,
        cardId: card.id,
        firstResource,
        secondResource,
      })));
      continue;
    }
    actions.push({ type: GAME_ACTION.PLAY_DEV_CARD, cardId: card.id });
  }
  return actions;
}

function constructionActions(game, graph, actorIndex) {
  const player = game.players[actorIndex];
  const actions = [];
  if (pieceCount(game, actorIndex, "estrada") < PIECE_LIMITS.estrada
      && ((player.freeRoads || 0) > 0 || canPay(player, BUILD_COSTS.estrada))) {
    validRoads(game, graph, actorIndex).forEach((edge) => actions.push({
      type: GAME_ACTION.BUILD_ROAD,
      edge,
    }));
  }
  if (pieceCount(game, actorIndex, "aldeia") < PIECE_LIMITS.aldeia
      && canPay(player, BUILD_COSTS.aldeia)) {
    validVillages(game, graph, actorIndex, false).forEach((vertex) => actions.push({
      type: GAME_ACTION.BUILD_VILLAGE,
      vertex,
    }));
  }
  if (pieceCount(game, actorIndex, "palacio") < PIECE_LIMITS.palacio
      && canPay(player, BUILD_COSTS.palacio)) {
    validPalaces(game, actorIndex).forEach((vertex) => actions.push({
      type: GAME_ACTION.BUILD_PALACE,
      vertex,
    }));
  }
  return actions;
}

function bankTradeActions(game, graph, actorIndex) {
  const player = game.players[actorIndex];
  const actions = [];
  RESOURCE_KEYS.forEach((give) => {
    const ratio = bankRatio(game, graph, actorIndex, give);
    if ((player?.res?.[give] || 0) < ratio) return;
    RESOURCE_KEYS.forEach((get) => {
      if (get !== give) actions.push({ type: GAME_ACTION.BANK_TRADE, give, get });
    });
  });
  return actions;
}

function warActions(game, graph, actorIndex) {
  if (!isWarMode(game.mode)) return [];
  const player = game.players[actorIndex];
  const actions = [];
  if (militaryActionsLeft(game) > 0) {
    WAR_UNIT_TYPES.forEach((subtype) => {
      if (canPay(player, troopCost(game, actorIndex, subtype))
          && validDeployHexes(game, graph, actorIndex, subtype).length) {
        actions.push({ type: GAME_ACTION.RECRUIT_TROOP, subtype });
      }
    });
  }
  Object.entries(game.units || {}).forEach(([fromHex, unit]) => {
    if (!unit || unit.p !== actorIndex || (game.turn?.acted || {})[fromHex]) return;
    if (militaryActionsLeft(game) <= 0 && game.turn?.bonus !== fromHex) return;
    unitTargets(game, graph, fromHex, actorIndex).forEach((toHex) => actions.push({
      type: GAME_ACTION.UNIT_ACTION,
      fromHex,
      toHex,
    }));
  });
  if (hasWarPerk(game, actorIndex, "romeo")
      && !game.turn?.bribed
      && (player?.res?.ouro || 0) >= 2) {
    bribeTargets(game, actorIndex).forEach((hex) => actions.push({
      type: GAME_ACTION.BRIBE_UNIT,
      hex,
    }));
  }
  return actions;
}

function explorationActions(game, graph, actorIndex) {
  if (!isExplorationMode(game.mode)) return [];
  const player = game.players[actorIndex];
  const actions = [];
  if (playerWagons(game, actorIndex).length < 1
      && wagonBuildCount(game, actorIndex) < MAX_WAGONS_PER_GAME
      && canPay(player, WAGON_COST)) {
    validWagonBuildHexes(game, graph, actorIndex).forEach((hex) => actions.push({
      type: GAME_ACTION.BUILD_WAGON,
      hex,
    }));
  }
  for (const [wagonId, wagon] of playerWagons(game, actorIndex)) {
    validWagonMoves(game, wagonId, actorIndex).forEach((hex) => actions.push({
      type: GAME_ACTION.MOVE_WAGON,
      wagonId,
      hex,
    }));
    if (!wagon.cargo
        && homeHexes(game, graph, actorIndex).has(wagon.at)
        && pieceCount(game, actorIndex, "aldeia") < PIECE_LIMITS.aldeia
        && canPay(player, BUILD_COSTS.aldeia)) {
      actions.push({ type: GAME_ACTION.LOAD_COLONISTS, wagonId });
    }
    if (wagon.cargo) {
      remoteVillageSpots(game, graph, wagonId).forEach((vertex) => actions.push({
        type: GAME_ACTION.FOUND_REMOTE_VILLAGE,
        wagonId,
        vertex,
      }));
    }
  }
  return actions;
}

/**
 * Returns concrete, executable actions that are legal for the supplied actor.
 *
 * The function is pure and intentionally depends only on the state visible to
 * the caller. Bots therefore call it with createGameStateView(...), so hidden
 * hands, hidden terrain and deck order cannot influence their decisions.
 *
 * High-cardinality decisions such as discarding return one deterministic legal
 * payload instead of every mathematical combination. All positional/resource
 * choices relevant to normal play are enumerated.
 */
export function listLegalActions(game, actorIndex) {
  if (!validActor(game, actorIndex)) return [];
  const player = game.players[actorIndex];
  if (!player || player.connected === false) return [];

  if (game.phase === "ended") {
    return player.ready === true ? [] : [{ type: GAME_ACTION.REMATCH_READY }];
  }
  if (!["setup", "play"].includes(game.phase)) return [];

  const tradeResponses = incomingTradeActions(game, actorIndex);
  if (tradeResponses.length) return tradeResponses;

  if (requiredGameActorIndex(game) !== actorIndex) return [];
  const graph = makeBoardGraph(game.board?.hexes || []);
  const mandatory = mandatoryActions(game, graph, actorIndex);
  if (mandatory.length || game.queue?.[0]) return mandatory;

  if (game.phase === "setup") return setupActions(game, graph, actorIndex);

  if (game.turn?.steal) {
    return (game.turn.steal.victims || []).map((victimIndex) => ({
      type: GAME_ACTION.STEAL_RESOURCE,
      victimIndex,
    }));
  }

  if (game.trade) {
    if (game.trade.from === actorIndex) {
      return [{ type: GAME_ACTION.CANCEL_TRADE, tradeId: game.trade.id }];
    }
    return [];
  }

  if (!game.turn?.rolled) return [{ type: GAME_ACTION.ROLL_DICE }];

  if (game.turn?.mustDragon) {
    return validDragonHexes(game).map((hex) => ({ type: GAME_ACTION.PLACE_DRAGON, hex }));
  }

  if (game.turn?.deploy) {
    return validDeployHexes(game, graph, actorIndex, game.turn.deploy).map((hex) => ({
      type: GAME_ACTION.DEPLOY_UNIT,
      hex,
    }));
  }

  const actions = [
    ...developmentCardActions(game, graph, actorIndex),
    ...constructionActions(game, graph, actorIndex),
  ];

  if (game.deck?.length && canPay(player, BUILD_COSTS.carta)) {
    actions.push({ type: GAME_ACTION.BUY_DEV_CARD });
  }

  actions.push(
    ...warActions(game, graph, actorIndex),
    ...explorationActions(game, graph, actorIndex),
    ...bankTradeActions(game, graph, actorIndex),
    { type: GAME_ACTION.END_TURN },
  );
  return actions;
}

export function actionResourceDelta(action) {
  if (!action || typeof action !== "object") return 0;
  if (action.type === GAME_ACTION.ACCEPT_TRADE) return 0;
  if (action.type !== GAME_ACTION.PROPOSE_TRADE) return 0;
  return resourceBundleTotal(action.give) - resourceBundleTotal(action.get);
}
