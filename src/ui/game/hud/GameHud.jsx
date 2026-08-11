import GameSurface from "../../system/GameSurface.jsx";
import "../../../styles/game-hud.css";

function Dice({ values, animationKey }) {
  if (!values?.length) return null;
  return (
    <div className="rd-game-hud__dice" key={animationKey} aria-label={`Dados: ${values.join(" e ")}`}>
      {values.map((value, index) => <span key={`${index}-${value}`}>{value}</span>)}
    </div>
  );
}

export default function GameHud({ code, round, dice, diceAnimationKey, status, embedded = false }) {
  return (
    <div className={`rd-game-hud${embedded ? " rd-game-hud--embedded" : ""}`} aria-label="HUD da partida">
      <div className="rd-game-hud__topline">
        <GameSurface material="oak" className="rd-game-hud__realm">
          <small>REINO</small>
          <strong>{code}</strong>
          <i aria-hidden="true" />
          <span>RONDA {round}</span>
        </GameSurface>
        <Dice values={dice} animationKey={diceAnimationKey} />
      </div>
      {status && <div className="rd-game-hud__status" role="status"><span>{status}</span></div>}
    </div>
  );
}
