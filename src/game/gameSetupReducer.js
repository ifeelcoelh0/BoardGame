import { generateBoard } from "./gameFactory.js";
import { isWarMode } from "./gameModes.js";
import { shuffleWithRng } from "./random.js";
import { pickTrollLair } from "./warAutomationReducer.js";

function cloneGame(game) {
  if (typeof structuredClone === "function") return structuredClone(game);
  return JSON.parse(JSON.stringify(game));
}

export function reduceLobbyToSetup(game, { rng = Math.random } = {}) {
  if (!game || game.phase !== "lobby") throw new Error("A partida tem de estar no lobby.");
  if (!Array.isArray(game.players) || game.players.length === 0) throw new Error("A partida precisa de jogadores.");

  const next = cloneGame(game);
  if (isWarMode(next.mode)) {
    next.board = generateBoard(next.mode, next.players.length, { rng });
    if (next.troll) {
      next.troll.lair = pickTrollLair(next);
      const lairHex = next.board.hexes.find((hex) => hex.k === next.troll.lair);
      if (lairHex) lairHex.lair = 1;
    }
  }

  next.order = shuffleWithRng(next.players.map((_, index) => index), rng);
  next.setup = {
    seq: [...next.order, ...[...next.order].reverse()],
    i: 0,
    needRoad: false,
    lastV: null,
  };
  delete next.lobbyStarting;
  next.phase = "setup";

  return {
    game: next,
    event: {
      type: "GAME_SETUP_STARTED",
      order: [...next.order],
      setupSequence: [...next.setup.seq],
      boardRegenerated: isWarMode(next.mode),
      trollLair: next.troll?.lair || null,
    },
  };
}
