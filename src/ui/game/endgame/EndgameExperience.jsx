import { useMemo, useState } from "react";
import CharacterSprite from "../../assets/CharacterSprite.jsx";
import GameButton from "../../system/GameButton.jsx";
import EndStats from "../EndStats.jsx";
import { buildEndgameModel } from "./gameEndgameModel.js";
import "../../../styles/game-endgame.css";

export default function EndgameExperience({ game, graph, seat, onExit, onRematch, model: providedModel = null, embedded = false }) {
  const [minimized, setMinimized] = useState(false);
  const model = useMemo(() => providedModel || buildEndgameModel(game, graph, seat), [providedModel, game, graph, seat]);
  if (!model) return null;
  if (minimized && !embedded) {
    return <button type="button" className="rd-endgame-peek" onClick={() => setMinimized(false)}><strong>Resultados finais</strong></button>;
  }
  return (
    <div className={`rd-endgame-overlay${embedded ? " rd-endgame-overlay--embedded" : ""}`} role={embedded ? undefined : "dialog"} aria-modal={embedded ? undefined : "true"} aria-labelledby="rd-endgame-title">
      <section className="rd-endgame">
        <header className="rd-endgame__winner">
          <div className="rd-endgame__portrait"><CharacterSprite character={model.winner.characterId} size={118} /></div>
          <div className="rd-endgame__winner-copy"><small>O reino reconhece um vencedor</small><h2 id="rd-endgame-title">{model.winner.name} reina</h2><span>{model.winner.title}</span><strong>{model.winner.victoryPoints} pontos de vitória</strong></div>
          <div className="rd-endgame__signature" aria-label={`Assinatura de ${model.winner.name}`}>{model.winner.shortName}</div>
        </header>
        {model.winner.quote && <blockquote>“{model.winner.quote}”</blockquote>}
        <EndStats model={model} />
        <footer className="rd-endgame__actions">
          <GameButton variant="secondary" onClick={() => { if (!embedded) setMinimized(true); }}>Ver mapa final</GameButton>
          {!embedded && onRematch && (
            <GameButton variant="primary" disabled={game.players?.[seat]?.ready === true} onClick={() => onRematch?.()}>
              {game.players?.[seat]?.ready === true ? "À espera dos outros…" : "Jogar outra vez"}
            </GameButton>
          )}
          <GameButton variant={onRematch && !embedded ? "secondary" : "primary"} onClick={() => onExit?.()}>Menu Principal</GameButton>
        </footer>
        {!embedded && onRematch && <p className="rd-endgame__rematch-status">{game.players?.filter((player) => player.connected !== false && player.ready === true).length || 0}/{game.players?.filter((player) => player.connected !== false).length || 0} jogadores querem continuar. O lobby reabre quando todos os jogadores ainda ligados escolherem jogar novamente.</p>}
      </section>
    </div>
  );
}
