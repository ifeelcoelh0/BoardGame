import { useEffect, useMemo, useRef, useState } from "react";
import { LOBBY_START_INTRO_MS } from "../game/lobbyRules.js";

export const GAME_ENTRY_TRANSITION = Object.freeze({
  IDLE: "idle",
  COVERING: "covering",
  REVEALING: "revealing",
});

export const GAME_ENTRY_REVEAL_MS = 1050;

function startDuration(game) {
  const starting = game?.phase === "lobby" ? game.lobbyStarting : null;
  const duration = Number(starting?.introEndsAt) - Number(starting?.startedAt);
  return Number.isFinite(duration) && duration > 0 ? duration : LOBBY_START_INTRO_MS;
}

export default function useGameEntryTransition(game) {
  const [phase, setPhase] = useState(GAME_ENTRY_TRANSITION.IDLE);
  const [coverDurationMs, setCoverDurationMs] = useState(LOBBY_START_INTRO_MS);
  const startSeenRef = useRef(false);
  const startingActionId = game?.phase === "lobby" ? game?.lobbyStarting?.actionId : null;

  useEffect(() => {
    if (startingActionId) {
      startSeenRef.current = true;
      setCoverDurationMs(startDuration(game));
      setPhase(GAME_ENTRY_TRANSITION.COVERING);
      return undefined;
    }
    if (!startSeenRef.current) {
      setPhase(GAME_ENTRY_TRANSITION.IDLE);
      return undefined;
    }

    /* Tanto uma entrada bem sucedida como um início cancelado são revelados
       através da mesma cobertura. Assim nunca há um corte seco para o tabuleiro
       nem um flash de volta ao salão se alguém perder a ligação no último instante. */
    setPhase(GAME_ENTRY_TRANSITION.REVEALING);
    const timer = window.setTimeout(() => {
      startSeenRef.current = false;
      setPhase(GAME_ENTRY_TRANSITION.IDLE);
    }, GAME_ENTRY_REVEAL_MS + 80);
    return () => window.clearTimeout(timer);
  }, [game?.phase, startingActionId]);

  /* Ao trocar a árvore Lobby → Game, o overlay React é montado novamente. Esta
     derivação síncrona garante que o primeiro frame do GameScreen já nasce
     coberto, antes de o efeito acima ter oportunidade de correr. */
  const renderedPhase = game?.phase !== "lobby" && startSeenRef.current && phase === GAME_ENTRY_TRANSITION.COVERING
    ? GAME_ENTRY_TRANSITION.REVEALING
    : phase;
  return useMemo(() => ({ phase: renderedPhase, coverDurationMs }), [renderedPhase, coverDurationMs]);
}
