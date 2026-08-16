import { useMemo, useState } from "react";
import CharacterSprite from "../../assets/CharacterSprite.jsx";
import GameButton from "../../system/GameButton.jsx";
import EndStats from "../EndStats.jsx";
import EndgameChat from "./EndgameChat.jsx";
import { buildEndgameModel } from "./gameEndgameModel.js";
import { t } from "../../../locales/i18n.js";
import "../../../styles/game-endgame.css";

export default function EndgameExperience({ game, graph, seat, onExit, onRematch, chat = [], sendChat, model: providedModel = null, embedded = false }) {
  const [minimized, setMinimized] = useState(false);
  const model = useMemo(() => providedModel || buildEndgameModel(game, graph, seat), [providedModel, game, graph, seat]);
  if (!model) return null;
  if (minimized && !embedded) {
    return <button type="button" className="rd-endgame-peek" onClick={() => setMinimized(false)}><strong>{t("end.finalResults")}</strong></button>;
  }
  return (
    <div className={`rd-endgame-overlay${embedded ? " rd-endgame-overlay--embedded" : ""}`} role={embedded ? undefined : "dialog"} aria-modal={embedded ? undefined : "true"} aria-labelledby="rd-endgame-title">
      <section className="rd-endgame">
        <header className="rd-endgame__winner">
          <div className="rd-endgame__portrait"><CharacterSprite character={model.winner.characterId} size={118} /></div>
          <div className="rd-endgame__winner-copy"><small>{t("end.realmWinner")}</small><h2 id="rd-endgame-title">{t("end.reigns", { name: model.winner.name })}</h2><span>{model.winner.title}</span><strong>{t("end.victoryPoints", { count: model.winner.victoryPoints })}</strong></div>
          <div className="rd-endgame__signature" aria-label={t("end.signature", { name: model.winner.name })}>{model.winner.shortName}</div>
        </header>
        {model.winner.quote && <blockquote>“{model.winner.quote}”</blockquote>}
        <div className="rd-endgame__body">
          <EndStats model={model} />
          {!embedded && <EndgameChat game={game} chat={chat} sendChat={sendChat} />}
        </div>
        <footer className="rd-endgame__actions">
          <GameButton variant="secondary" onClick={() => { if (!embedded) setMinimized(true); }}>{t("end.viewMap")}</GameButton>
          {!embedded && onRematch && (
            <GameButton variant="primary" disabled={game.players?.[seat]?.ready === true} onClick={() => onRematch?.()}>
              {game.players?.[seat]?.ready === true ? t("end.waitOthers") : t("end.playAgain")}
            </GameButton>
          )}
          <GameButton variant={onRematch && !embedded ? "secondary" : "primary"} onClick={() => onExit?.()}>{t("end.mainMenu")}</GameButton>
        </footer>
        {!embedded && onRematch && <p className="rd-endgame__rematch-status">{t("end.rematchStatus", { ready: game.players?.filter((player) => player.connected !== false && player.ready === true).length || 0, connected: game.players?.filter((player) => player.connected !== false).length || 0 })}</p>}
      </section>
    </div>
  );
}
