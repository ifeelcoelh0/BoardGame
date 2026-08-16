import { reduceProduction } from "./productionReducer.js";
import { handSize } from "./resources.js";
import { isWarMode, usesDisasters } from "./gameModes.js";

const DICE_SIDES = 6;
const DISASTER_ROLLS = new Set([2, 12]);

function activeHousePerk(game, playerIndex, characterId) {
  return isWarMode(game.mode)
    && game.perksOn !== false
    && game.gelo?.active
    && game.players[playerIndex]?.ch === characterId;
}

function cloneDiceStats(stats) {
  const source = stats || {};
  return {
    ...source,
    rolls: { ...(source.rolls || {}) },
    totalRolls: source.totalRolls || 0,
    sevens: source.sevens || 0,
    disasters: source.disasters || 0,
  };
}

function validateDie(value) {
  return Number.isInteger(value) && value >= 1 && value <= DICE_SIDES;
}

export function rollDie(random = Math.random) {
  const sample = Number(random());
  if (!Number.isFinite(sample)) throw new TypeError("O RNG dos dados devolveu um valor inválido.");
  const normalized = Math.max(0, Math.min(0.9999999999999999, sample));
  return 1 + Math.floor(normalized * DICE_SIDES);
}

export function rollDicePair(random = Math.random) {
  return [rollDie(random), rollDie(random)];
}

export function recordDiceStats(stats, total) {
  const next = cloneDiceStats(stats);
  next.rolls[total] = (next.rolls[total] || 0) + 1;
  next.totalRolls += 1;
  if (total === 7) next.sevens += 1;
  return next;
}

function resolveClassicSeven(game) {
  const queue = [...(game.queue || [])];
  const discards = [];
  game.players.forEach((player, playerIndex) => {
    const totalCards = handSize(player);
    if (totalCards > 7 && !game.test) {
      const need = Math.floor(totalCards / 2);
      queue.push({ t: "descarte", p: playerIndex, need });
      discards.push({ playerIndex, need });
    }
  });

  return {
    game: {
      ...game,
      queue,
      turn: { ...game.turn, mustDragon: true },
    },
    resolution: {
      type: "FIRE_DRAGON",
      discards,
    },
  };
}

function resolveWarSeven(game, actorIndex) {
  const awakened = !!(game.gelo?.awake && !game.gelo?.active);
  const perksActivated = awakened && game.perksOn !== false;
  const gelo = game.gelo ? { ...game.gelo, active: awakened ? true : game.gelo.active } : game.gelo;
  let units = game.units;

  if (perksActivated) {
    units = Object.fromEntries(Object.entries(game.units || {}).map(([key, unit]) => {
      if (game.players[unit.p]?.ch !== "bones") return [key, unit];
      return [key, { ...unit, sk: 1 }];
    }));
  }

  const withAwakening = { ...game, gelo, units };
  const blessings = withAwakening.players.map((_, playerIndex) => {
    const left = (playerIndex === actorIndex ? 2 : 1)
      + (activeHousePerk(withAwakening, playerIndex, "muriel") ? 1 : 0);
    return { t: "bencao", p: playerIndex, left };
  });

  return {
    game: {
      ...withAwakening,
      queue: [...(game.queue || []), ...blessings],
    },
    resolution: {
      type: "ICE_DRAGON_BLESSING",
      awakened,
      perksActivated,
      blessings: blessings.map(({ p: playerIndex, left }) => ({ playerIndex, left })),
    },
  };
}

export function reduceDiceRoll(game, graph, actorIndex, dice) {
  if (!Array.isArray(dice) || dice.length !== 2 || !dice.every(validateDie)) {
    throw new TypeError("O lançamento deve conter exatamente dois dados entre 1 e 6.");
  }

  const [first, second] = dice;
  const total = first + second;
  const base = {
    ...game,
    turn: {
      ...game.turn,
      dice: [first, second],
      rolled: true,
    },
    stats: recordDiceStats(game.stats, total),
  };

  const triggerTrollOmen = isWarMode(base.mode) && DISASTER_ROLLS.has(total);
  if (total === 7) {
    const seven = isWarMode(base.mode)
      ? resolveWarSeven(base, actorIndex)
      : resolveClassicSeven(base);
    return {
      game: seven.game,
      event: {
        type: "DICE_ROLLED",
        actorIndex,
        dice: [first, second],
        total,
        triggerTrollOmen,
        triggerDisaster: false,
        production: null,
        seven: seven.resolution,
      },
    };
  }

  const production = reduceProduction(base, graph, total);
  return {
    game: production.game,
    event: {
      type: "DICE_ROLLED",
      actorIndex,
      dice: [first, second],
      total,
      triggerTrollOmen,
      triggerDisaster: DISASTER_ROLLS.has(total) && usesDisasters(base.mode),
      production: {
        gains: production.gains,
        dragonBlocked: production.dragonBlocked,
        sources: production.sources,
      },
      seven: null,
    },
  };
}
