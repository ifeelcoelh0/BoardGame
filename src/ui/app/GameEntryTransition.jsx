import { GAME_ENTRY_TRANSITION, GAME_ENTRY_REVEAL_MS } from "../../app/useGameEntryTransition.js";
import "../../styles/game-entry-transition.css";

export default function GameEntryTransition({ transition }) {
  const phase = transition?.phase || GAME_ENTRY_TRANSITION.IDLE;
  if (phase === GAME_ENTRY_TRANSITION.IDLE) return null;
  const style = {
    "--rd-game-entry-cover-ms": `${Math.max(0, Number(transition?.coverDurationMs) || 0)}ms`,
    "--rd-game-entry-reveal-ms": `${GAME_ENTRY_REVEAL_MS}ms`,
  };
  return (
    <div
      className={`rd-game-entry-transition is-${phase}`}
      style={style}
      aria-hidden="true"
      data-testid="game-entry-transition"
    >
      <span />
    </div>
  );
}
