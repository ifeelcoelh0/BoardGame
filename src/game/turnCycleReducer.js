import { promoteNewDevelopmentCards } from "./developmentCardReducer.js";
import { reduceWagonTurnReset } from "./explorationReducer.js";
import {
  reduceWarEndTurnSweep,
  reduceWarStartTurnAutomation,
} from "./warAutomationReducer.js";
import { giantHex } from "./warReducer.js";
import { isWarMode } from "./gameModes.js";
import { createPlayTurnState } from "./turnState.js";

export const ICE_DRAGON_WAKE_TURNS = 12;
export const WAR_GAME_TURNS = 40;

function cloneGame(game) {
  if (typeof structuredClone === "function") return structuredClone(game);
  return JSON.parse(JSON.stringify(game));
}

function assertPlayState(game) {
  if (!game || game.phase !== "play") throw new Error("O avanço de turno exige uma partida em jogo.");
  if (!Array.isArray(game.players) || !game.players.length) throw new Error("A partida não tem jogadores.");
  if (!Array.isArray(game.order) || game.order.length !== game.players.length) {
    throw new Error("A ordem de turnos é inválida.");
  }
  if (!game.turn || !Number.isSafeInteger(game.turn.pos) || game.turn.pos < 0 || game.turn.pos >= game.order.length) {
    throw new Error("A posição de turno é inválida.");
  }
}

function assertActor(game, actorIndex) {
  if (!Number.isSafeInteger(actorIndex) || actorIndex < 0 || actorIndex >= game.players.length) {
    throw new RangeError("Jogador inválido para terminar o turno.");
  }
  if (game.order[game.turn.pos] !== actorIndex) {
    throw new Error("Apenas o jogador ativo pode terminar o turno.");
  }
}

function normalizePortEffects(portOff) {
  return (Array.isArray(portOff) ? portOff : [])
    .map((effect) => ({ ...effect, left: (Number(effect?.left) || 0) - 1 }))
    .filter((effect) => effect.left > 0);
}

export function roundsForTurns(game, turns) {
  const playerCount = Math.max(2, game?.players?.length || 0);
  return Math.max(2, Math.round(turns / playerCount));
}

export function warRoundLimit(game) {
  const playerCount = Math.max(2, game?.players?.length || 0);
  return Math.max(3, Math.round(WAR_GAME_TURNS / playerCount));
}

export function currentTurnPlayerIndex(game) {
  assertPlayState(game);
  return game.order[game.turn.pos];
}

export function createFreshTurn(previousTurn, position) {
  return createPlayTurnState({
    position,
    previousDice: previousTurn?.dice ?? null,
  });
}

export function reduceIncomingPlayerEffects(game, playerIndex) {
  if (!Number.isSafeInteger(playerIndex) || playerIndex < 0 || playerIndex >= (game.players?.length || 0)) {
    throw new RangeError("Jogador inválido para iniciar o turno.");
  }
  const next = cloneGame(game);
  const player = next.players[playerIndex];
  const previousSick = Math.max(0, Number(player.sick) || 0);
  const previousPorts = Array.isArray(player.portOff) ? player.portOff.map((effect) => ({ ...effect })) : [];
  player.sick = Math.max(0, previousSick - 1);
  player.portOff = normalizePortEffects(previousPorts);
  return {
    game: next,
    event: {
      type: "INCOMING_PLAYER_EFFECTS_TICKED",
      playerIndex,
      sickBefore: previousSick,
      sickAfter: player.sick,
      expiredPorts: previousPorts.filter((effect) => (Number(effect?.left) || 0) <= 1).map((effect) => effect.e),
      activePorts: player.portOff.map((effect) => ({ ...effect })),
    },
  };
}

export function reduceTurnAdvance(game, graph, actorIndex, { rng = Math.random } = {}) {
  assertPlayState(game);
  assertActor(game, actorIndex);

  let next = cloneGame(game);
  const events = [];
  const isWar = isWarMode(next.mode);

  if (isWar && next.troll?.awake) {
    const sweep = reduceWarEndTurnSweep(next, graph, actorIndex);
    next = sweep.game;
    events.push(...(sweep.event.events || []));
  }

  const matured = promoteNewDevelopmentCards(next, actorIndex);
  next = matured.game;
  events.push(matured.event);
  next.players[actorIndex].freeRoads = 0;

  const previousPosition = next.turn.pos;
  const position = (previousPosition + 1) % next.order.length;
  const wrappedRound = position === 0;
  const previousRound = Number.isSafeInteger(next.round) ? next.round : 1;
  if (wrappedRound) next.round = previousRound + 1;
  else next.round = previousRound;

  const playerIndex = next.order[position];
  const ticked = reduceIncomingPlayerEffects(next, playerIndex);
  next = ticked.game;
  events.push(ticked.event);

  next.turn = createFreshTurn(game.turn, position);
  const wagons = reduceWagonTurnReset(next, playerIndex);
  next = wagons.game;
  events.push(wagons.event);

  let iceDragonAwakened = false;
  let roundLimitReached = false;
  let guardBlessingQueued = false;

  if (isWar) {
    const wakesAtRound = roundsForTurns(next, ICE_DRAGON_WAKE_TURNS);
    if (next.gelo && !next.gelo.awake && next.round >= wakesAtRound) {
      next.gelo.awake = true;
      iceDragonAwakened = true;
      events.push({ type: "ICE_DRAGON_AWAKENED", playerIndex, round: next.round, wakesAtRound });
    }

    const automation = reduceWarStartTurnAutomation(next, graph, playerIndex, position, { rng });
    next = automation.game;
    events.push(...(automation.event.events || []));

    roundLimitReached = wrappedRound && next.round > warRoundLimit(next);
    if (roundLimitReached) {
      events.push({ type: "WAR_ROUND_LIMIT_REACHED", round: next.round, limit: warRoundLimit(next) });
    } else {
      const heart = next.units?.["0,0"];
      if (heart && heart.p === playerIndex && giantHex(next) !== "0,0") {
        next.queue ||= [];
        next.queue.push({ t: "bencao", p: playerIndex, left: 1, guard: true });
        guardBlessingQueued = true;
        events.push({ type: "HEART_GUARD_BLESSING_QUEUED", playerIndex });
      }
    }
  }

  events.push({
    type: "TURN_STARTED",
    playerIndex,
    position,
    previousPlayerIndex: actorIndex,
    round: next.round,
    wrappedRound,
  });

  return {
    game: next,
    event: {
      type: "TURN_ADVANCED",
      previousPlayerIndex: actorIndex,
      playerIndex,
      previousPosition,
      position,
      previousRound,
      round: next.round,
      wrappedRound,
      iceDragonAwakened,
      roundLimitReached,
      guardBlessingQueued,
      events,
    },
  };
}
