import { GAME_ACTION } from "../../game/gameProtocol.js";
import {
  BUILD_COSTS,
  PIECE_LIMITS,
  RESOURCE_DEFINITIONS,
  RESOURCE_KEYS,
  canPay,
} from "../../game/resources.js";
import {
  pieceCount,
  validPalaces,
  validRoads,
  validVillages,
} from "../../game/buildingRules.js";
import {
  bribeTargets,
  hasWarPerk,
  militaryActionsLeft,
  troopCost,
  validDeployHexes,
} from "../../game/warReducer.js";
import {
  MAX_WAGONS_PER_GAME,
  WAGON_COST,
  homeHexes,
  playerWagons,
  remoteVillageSpots,
  validWagonBuildHexes,
  wagonBuildCount,
  wagonMoves,
} from "../../game/explorationReducer.js";
import { isExplorationMode, isWarMode } from "../../game/gameModes.js";
import { GAME_ACTION_ICONS } from "../../assets/gameUiIcons.js";
import { playTurnBlockReason, rollTurnBlockReason } from "./gameInteractionGuards.js";

export const GAME_ACTION_COMMAND = Object.freeze({
  DISPATCH: "dispatch",
  TOGGLE_MODE: "toggle-mode",
  OPEN_BANK: "open-bank",
  OPEN_TRADE: "open-trade",
  SELECT_WAGON: "select-wagon",
  TOGGLE_FOUND: "toggle-found",
});

export const GAME_ACTION_GROUP = Object.freeze({
  CONSTRUCTION: "construction",
  REALM: "realm",
  WAR: "war",
  EXPLORATION: "exploration",
});

const GROUP_LABELS = Object.freeze({
  [GAME_ACTION_GROUP.CONSTRUCTION]: "Construir",
  [GAME_ACTION_GROUP.REALM]: "Reino",
  [GAME_ACTION_GROUP.WAR]: "Forças",
  [GAME_ACTION_GROUP.EXPLORATION]: "Expedição",
});

function freezeAction(action) {
  return Object.freeze({
    active: false,
    enabled: true,
    reason: null,
    cost: null,
    badge: null,
    meta: null,
    tone: "standard",
    ...action,
    command: action.command ? Object.freeze({ ...action.command }) : null,
  });
}

function group(id, actions) {
  return Object.freeze({
    id,
    label: GROUP_LABELS[id],
    actions: Object.freeze(actions.filter(Boolean)),
  });
}

function missingResources(player, cost) {
  return RESOURCE_KEYS
    .map((resource) => ({
      resource,
      missing: Math.max(0, (cost?.[resource] || 0) - (player?.res?.[resource] || 0)),
    }))
    .filter((entry) => entry.missing > 0);
}

export function affordabilityReason(player, cost) {
  const missing = missingResources(player, cost);
  if (!missing.length) return null;
  return `Falta ${missing
    .map(({ resource, missing: amount }) => `${amount} ${RESOURCE_DEFINITIONS[resource]?.n || resource}`)
    .join(", ")}.`;
}

function constructionAction({
  id,
  label,
  icon,
  cost,
  free = false,
  pieceLimit,
  pieceType,
  validCount,
  player,
  commonReason,
  game,
  seat,
  mode,
  activeMode,
}) {
  const reason = commonReason
    || (!free && !canPay(player, cost) ? affordabilityReason(player, cost) : null)
    || (pieceCount(game, seat, pieceType) >= pieceLimit
      ? `Atingiste o limite de ${pieceLimit} ${label.toLowerCase()}.`
      : null)
    || (validCount <= 0 ? `Não existe nenhuma posição válida para ${label.toLowerCase()}.` : null);
  return freezeAction({
    id,
    label,
    icon,
    enabled: !reason,
    reason,
    cost,
    free,
    active: activeMode === mode,
    badge: free ? "GRÁTIS" : null,
    meta: free && player.freeRoads > 0 ? `${player.freeRoads} restante${player.freeRoads === 1 ? "" : "s"}` : null,
    command: { type: GAME_ACTION_COMMAND.TOGGLE_MODE, mode },
  });
}

export function buildConstructionActionModel(game, graph, seat, { myTurn, interactionMode = null } = {}) {
  const player = game?.players?.[seat];
  if (!player) throw new RangeError("Jogador inválido para o modelo de construção.");
  const commonReason = playTurnBlockReason(game, seat, { myTurn: !!myTurn });
  const freeRoad = (player.freeRoads || 0) > 0;
  return Object.freeze({
    road: constructionAction({
      id: "road",
      label: "Estrada",
      icon: GAME_ACTION_ICONS.road,
      cost: freeRoad ? Object.freeze({}) : BUILD_COSTS.estrada,
      free: freeRoad,
      pieceLimit: PIECE_LIMITS.estrada,
      pieceType: "estrada",
      validCount: validRoads(game, graph, seat).length,
      player,
      commonReason,
      game,
      seat,
      mode: "estrada",
      activeMode: interactionMode,
    }),
    village: constructionAction({
      id: "village",
      label: "Aldeia",
      icon: GAME_ACTION_ICONS.village,
      cost: BUILD_COSTS.aldeia,
      pieceLimit: PIECE_LIMITS.aldeia,
      pieceType: "aldeia",
      validCount: validVillages(game, graph, seat, false).length,
      player,
      commonReason,
      game,
      seat,
      mode: "aldeia",
      activeMode: interactionMode,
    }),
    palace: constructionAction({
      id: "palace",
      label: "Palácio",
      icon: GAME_ACTION_ICONS.palace,
      cost: BUILD_COSTS.palacio,
      pieceLimit: PIECE_LIMITS.palacio,
      pieceType: "palacio",
      validCount: validPalaces(game, seat).length,
      player,
      commonReason,
      game,
      seat,
      mode: "palacio",
      activeMode: interactionMode,
    }),
  });
}

function buildRealmActions(game, seat, player, commonReason) {
  const cardReason = commonReason
    || (!game.deck?.length ? "O baralho de desenvolvimento está vazio." : null)
    || (!canPay(player, BUILD_COSTS.carta) ? affordabilityReason(player, BUILD_COSTS.carta) : null);

  const connectedOpponent = (game.players || []).some((candidate, index) => index !== seat && candidate?.connected !== false);
  const tradeReason = commonReason || (!connectedOpponent ? "Não há outro jogador ligado para negociar." : null);

  return [
    freezeAction({
      id: "development-card",
      label: "Carta",
      icon: GAME_ACTION_ICONS.card,
      enabled: !cardReason,
      reason: cardReason,
      cost: BUILD_COSTS.carta,
      meta: game.deck?.length != null ? `${game.deck.length} no baralho` : null,
      command: { type: GAME_ACTION_COMMAND.DISPATCH, actionType: GAME_ACTION.BUY_DEV_CARD },
    }),
    freezeAction({
      id: "bank",
      label: "Banco",
      icon: GAME_ACTION_ICONS.bank,
      enabled: !commonReason,
      reason: commonReason,
      meta: "Troca com o reino",
      command: { type: GAME_ACTION_COMMAND.OPEN_BANK },
    }),
    freezeAction({
      id: "trade",
      label: "Trocar",
      icon: GAME_ACTION_ICONS.trade,
      enabled: !tradeReason,
      reason: tradeReason,
      meta: "Negociar com jogadores",
      command: { type: GAME_ACTION_COMMAND.OPEN_TRADE },
    }),
  ];
}

function buildWarActions(game, graph, seat, player, commonReason, interactionMode) {
  if (!isWarMode(game.mode)) return [];
  const actions = ["cavaleiro", "catapulta", "arqueiro"].map((subtype) => {
    const cost = troopCost(game, seat, subtype);
    const reason = commonReason
      || (militaryActionsLeft(game) <= 0 ? "Já gastaste as ações militares deste turno." : null)
      || (!canPay(player, cost) ? affordabilityReason(player, cost) : null)
      || (!validDeployHexes(game, graph, seat, subtype).length ? "Não há espaço livre junto ao teu Bastião." : null);
    return freezeAction({
      id: `recruit-${subtype}`,
      label: subtype === "cavaleiro" ? "Cavaleiro" : subtype === "catapulta" ? "Catapulta" : "Arqueiro",
      icon: GAME_ACTION_ICONS[subtype],
      enabled: !reason,
      reason,
      cost,
      meta: `${militaryActionsLeft(game)}/2 ações`,
      command: {
        type: GAME_ACTION_COMMAND.DISPATCH,
        actionType: GAME_ACTION.RECRUIT_TROOP,
        payload: { subtype },
      },
    });
  });

  if (hasWarPerk(game, seat, "romeo")) {
    const bribeCost = Object.freeze({ ouro: 2 });
    const reason = commonReason
      || (game.turn?.bribed ? "Já usaste Suborno neste turno." : null)
      || ((player.res?.ouro || 0) < 2 ? affordabilityReason(player, bribeCost) : null)
      || (!bribeTargets(game, seat).size ? "Não existe nenhuma tropa inimiga que possas subornar." : null);
    actions.push(freezeAction({
      id: "bribe",
      label: "Suborno",
      icon: GAME_ACTION_ICONS.bribe,
      enabled: !reason,
      reason,
      cost: bribeCost,
      active: interactionMode === "suborno",
      command: { type: GAME_ACTION_COMMAND.TOGGLE_MODE, mode: "suborno" },
    }));
  }

  return actions;
}

function wagonBuildReason(game, graph, seat, player, commonReason) {
  if (commonReason) return commonReason;
  if (playerWagons(game, seat).length >= 1) return "Já tens uma carruagem ativa.";
  if (wagonBuildCount(game, seat) >= MAX_WAGONS_PER_GAME) return `Já construíste as ${MAX_WAGONS_PER_GAME} carruagens disponíveis nesta partida.`;
  if (!canPay(player, WAGON_COST)) return affordabilityReason(player, WAGON_COST);
  if (!validWagonBuildHexes(game, graph, seat).length) return "Não há um hexágono válido junto às tuas construções.";
  return null;
}

function buildExplorationActions(game, graph, seat, player, commonReason, interactionMode, selectedWagon) {
  if (!isExplorationMode(game.mode)) return [];
  const actions = [];
  const buildReason = wagonBuildReason(game, graph, seat, player, commonReason);
  actions.push(freezeAction({
    id: "build-wagon",
    label: "Carruagem",
    icon: GAME_ACTION_ICONS.wagon,
    enabled: !buildReason,
    reason: buildReason,
    cost: WAGON_COST,
    active: interactionMode === "carruagem",
    badge: `${Math.max(0, MAX_WAGONS_PER_GAME - wagonBuildCount(game, seat))}/${MAX_WAGONS_PER_GAME}`,
    command: { type: GAME_ACTION_COMMAND.TOGGLE_MODE, mode: "carruagem", clearWagon: true },
  }));

  for (const [wagonId, wagon] of playerWagons(game, seat)) {
    const reason = commonReason;
    actions.push(freezeAction({
      id: `wagon-${wagonId}`,
      label: wagon.cargo ? "Colonos" : "Carruagem",
      icon: wagon.cargo ? GAME_ACTION_ICONS.colonists : GAME_ACTION_ICONS.wagon,
      enabled: !reason,
      reason,
      active: selectedWagon === wagonId,
      badge: `${wagon.mv}/${wagonMoves(wagon)}`,
      meta: wagon.cargo ? "Com colonos" : "Selecionar para mover",
      command: { type: GAME_ACTION_COMMAND.SELECT_WAGON, wagonId },
    }));
  }

  const wagon = selectedWagon ? game.wagons?.[selectedWagon] : null;
  if (wagon && wagon.p === seat && !wagon.cargo) {
    const colonistReason = commonReason
      || (!homeHexes(game, graph, seat).has(wagon.at) ? "A carruagem tem de estar junto a uma construção tua." : null)
      || (pieceCount(game, seat, "aldeia") >= PIECE_LIMITS.aldeia ? `Atingiste o limite de ${PIECE_LIMITS.aldeia} aldeias.` : null)
      || (!canPay(player, BUILD_COSTS.aldeia) ? affordabilityReason(player, BUILD_COSTS.aldeia) : null);
    actions.push(freezeAction({
      id: "load-colonists",
      label: "Carregar colonos",
      icon: GAME_ACTION_ICONS.colonists,
      enabled: !colonistReason,
      reason: colonistReason,
      cost: BUILD_COSTS.aldeia,
      command: {
        type: GAME_ACTION_COMMAND.DISPATCH,
        actionType: GAME_ACTION.LOAD_COLONISTS,
        payload: { wagonId: selectedWagon },
      },
    }));
  }

  if (wagon && wagon.p === seat && wagon.cargo) {
    const foundReason = commonReason
      || (!remoteVillageSpots(game, graph, selectedWagon).length ? "Não existe um local válido para fundar uma aldeia aqui." : null);
    actions.push(freezeAction({
      id: "found-village",
      label: "Fundar aldeia",
      icon: GAME_ACTION_ICONS.village,
      enabled: !foundReason,
      reason: foundReason,
      active: interactionMode === "fundar",
      meta: "Consome a carruagem",
      command: { type: GAME_ACTION_COMMAND.TOGGLE_FOUND, wagonId: selectedWagon },
    }));
  }

  return actions;
}

/**
 * Modelo declarativo de todas as ações normais do turno.
 *
 * Não contém handlers React. O componente recebe apenas dados e comandos
 * serializáveis; GameScreen executa os comandos sem voltar a decidir regras.
 */
export function buildGameActionModel(game, graph, seat, {
  myTurn = false,
  interactionMode = null,
  selectedWagon = null,
} = {}) {
  const player = game?.players?.[seat];
  if (!player) throw new RangeError("Jogador inválido para o modelo de ações.");

  const rollReason = rollTurnBlockReason(game, seat, { myTurn: !!myTurn });
  const roll = freezeAction({
    id: "roll-dice",
    label: "Lançar os Dados",
    icon: GAME_ACTION_ICONS.rollDice,
    tone: "primary",
    enabled: !rollReason,
    reason: rollReason,
    command: { type: GAME_ACTION_COMMAND.DISPATCH, actionType: GAME_ACTION.ROLL_DICE },
  });

  const commonReason = playTurnBlockReason(game, seat, { myTurn: !!myTurn });
  const construction = buildConstructionActionModel(game, graph, seat, {
    myTurn,
    interactionMode,
  });
  const realmActions = buildRealmActions(game, seat, player, commonReason);
  const warActions = buildWarActions(game, graph, seat, player, commonReason, interactionMode);
  const explorationActions = buildExplorationActions(
    game,
    graph,
    seat,
    player,
    commonReason,
    interactionMode,
    selectedWagon,
  );

  const endTurn = freezeAction({
    id: "end-turn",
    label: "Terminar Turno",
    icon: GAME_ACTION_ICONS.endTurn,
    tone: "danger",
    enabled: !commonReason,
    reason: commonReason,
    command: { type: GAME_ACTION_COMMAND.DISPATCH, actionType: GAME_ACTION.END_TURN },
  });

  return Object.freeze({
    phase: game?.turn?.rolled ? "actions" : "roll",
    roll,
    groups: Object.freeze([
      group(GAME_ACTION_GROUP.CONSTRUCTION, [construction.road, construction.village, construction.palace]),
      group(GAME_ACTION_GROUP.REALM, realmActions),
      ...(warActions.length ? [group(GAME_ACTION_GROUP.WAR, warActions)] : []),
      ...(explorationActions.length ? [group(GAME_ACTION_GROUP.EXPLORATION, explorationActions)] : []),
    ]),
    endTurn,
  });
}
