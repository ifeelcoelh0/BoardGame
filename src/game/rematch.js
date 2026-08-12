import { createInitialGame, createPlayer } from "./gameFactory.js";
import { findPlayerIndexById } from "./playerIdentity.js";
import { activateBotController, PLAYER_CONTROLLER } from "./playerPresence.js";

export function markRematchReady(game, actorId) {
  if (!game || game.phase !== "ended" || !Array.isArray(game.players)) return { ok: false, reason: "NOT_ENDED" };
  const actorIndex = findPlayerIndexById(game, actorId);
  if (actorIndex < 0) return { ok: false, reason: "UNAUTHENTICATED" };
  const player = game.players[actorIndex];
  if (!player || player.connected === false) return { ok: false, reason: "PLAYER_DISCONNECTED" };
  if (player.ready === true) return { ok: true, game, actorIndex, noChange: true };
  const next = structuredClone(game);
  next.players[actorIndex].ready = true;
  return { ok: true, game: next, actorIndex, event: { type: "REMATCH_READY", actorIndex } };
}

export function rematchStatus(game) {
  if (!game || game.phase !== "ended" || !Array.isArray(game.players)) return { connected: [], ready: [], canReopen: false };
  const connected = game.players.map((player, index) => ({ player, index })).filter(({ player }) => player?.connected !== false);
  const ready = connected.filter(({ player }) => player.ready === true);
  return { connected, ready, canReopen: connected.length > 0 && connected.length === ready.length };
}

export function finalizeRematchIfReady(game, { rng = Math.random } = {}) {
  const status = rematchStatus(game);
  if (!status.canReopen) return game;
  const participants = status.ready.map(({ player }) => player);
  if (!participants.length) return game;
  const host = participants[0];
  const fresh = createInitialGame({
    code: game.code,
    hostCharacterId: host.ch,
    mode: game.mode,
    hostIdentity: {
      playerId: host.playerId,
      seatId: host.seatId,
      sessionTokenHash: host.sessionTokenHash,
      characterConfirmed: host.characterConfirmed === true,
      connected: true,
    },
    rng,
  });
  fresh.players = participants.map((player) => {
    const nextPlayer = createPlayer(player.ch, {
      playerId: player.playerId,
      seatId: player.seatId,
      sessionTokenHash: player.sessionTokenHash,
      characterConfirmed: player.characterConfirmed === true,
      connected: true,
    });
    if (player.controller === PLAYER_CONTROLLER.BOT) activateBotController(nextPlayer);
    nextPlayer.ready = nextPlayer.controller === PLAYER_CONTROLLER.BOT;
    return nextPlayer;
  });
  fresh.perksOn = game.perksOn !== false;
  if (game.test === true) fresh.test = true;
  fresh.v = game.v || 0;
  return fresh;
}
