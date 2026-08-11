import CharacterSprite from "../assets/CharacterSprite.jsx";
import DevelopmentCard from "./DevelopmentCard.jsx";
import "../../styles/development-card-reveal.css";

export default function DevelopmentCardReveal({ event, game, playerName, onDismiss }) {
  if (!event) return null;
  const characterId = game?.players?.[event.pi]?.ch;
  return (
    <div className="rd-dev-reveal" role="dialog" aria-modal="true" onClick={onDismiss}>
      <div className="rd-dev-reveal__scene" onClick={(e) => e.stopPropagation()}>
        <div className="rd-dev-reveal__card"><DevelopmentCard card={event.card} characterId={characterId} /></div>
        <aside className="rd-dev-reveal__who">
          <CharacterSprite character={characterId} size={92} />
          <div><small>Carta de Desenvolvimento</small><strong>{playerName}</strong><span>jogou {event.card?.sub || event.card?.kind || "uma carta"}</span></div>
        </aside>
        <button type="button" onClick={onDismiss}>Continuar</button>
      </div>
    </div>
  );
}
