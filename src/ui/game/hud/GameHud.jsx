import GameSurface from "../../system/GameSurface.jsx";
import GameIcon from "../../assets/GameIcon.jsx";
import "../../../styles/game-hud.css";

function Dice({ values, animationKey }) {
  if (!values?.length) return null;
  return (
    <div className="rd-game-hud__dice" key={animationKey} aria-label={`Dados: ${values.join(" e ")}`}>
      {values.map((value, index) => <span key={`${index}-${value}`}>{value}</span>)}
    </div>
  );
}

export default function GameHud({
  code, round, dice, diceAnimationKey, status, fullscreen = false, onToggleFullscreen, embedded = false,
}) {
  return (
    <div className={`rd-game-hud${embedded ? " rd-game-hud--embedded" : ""}`} aria-label="HUD da partida">
      {embedded && (
        <div className="rd-game-hud__topline">
          <GameSurface material="oak" className="rd-game-hud__realm">
            <small>REINO</small><strong>{code}</strong><i aria-hidden="true" /><span>RONDA {round}</span>
          </GameSurface>
          <Dice values={dice} animationKey={diceAnimationKey} />
        </div>
      )}
      {!embedded && onToggleFullscreen && (
        <button
          type="button"
          className={`rd-game-hud__fullscreen${fullscreen ? " is-active" : ""}`}
          onClick={onToggleFullscreen}
          aria-label={fullscreen ? "Sair do ecrã inteiro" : "Entrar em ecrã inteiro"}
          title={fullscreen ? "Sair do ecrã inteiro" : "Ecrã inteiro"}
        >
          <GameIcon name="RDD_Fullscreen" size={36} alt="" />
        </button>
      )}
      {status && <div className="rd-game-hud__status" role="status"><span>{status}</span></div>}
    </div>
  );
}
