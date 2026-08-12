import DevelopmentCard from "../DevelopmentCard.jsx";
import GameIcon from "../../assets/GameIcon.jsx";
import { GAME_UTILITY_ICONS } from "../../../assets/gameUiIcons.js";
import "../../../styles/game-development-hand.css";

function cardStep(count) {
  if (count <= 5) return 37;
  if (count <= 8) return 31;
  if (count <= 11) return 26;
  return 19;
}

export default function GameDevelopmentHand({
  cards = [],
  characterId = null,
  onOpenCard,
  onOpenList,
  embedded = false,
}) {
  if (cards.length === 0) return null;

  const step = cardStep(cards.length);
  const width = 72 + step * Math.max(0, cards.length - 1);

  return (
    <section className={`rd-dev-hand${embedded ? " rd-dev-hand--embedded" : ""}`} aria-label="Cartas de desenvolvimento">
      <button type="button" className="rd-dev-hand__label" onClick={onOpenList} title="Abrir todas as cartas">
        <GameIcon name={GAME_UTILITY_ICONS.cards} size={24} alt="" />
        <span>Cartas</span>
        <b>{cards.length}</b>
      </button>
      <div className="rd-dev-hand__cards" style={{ "--rd-dev-hand-width": `${width}px` }}>
        {cards.map((entry, index) => (
          <button
            key={entry.card.id}
            type="button"
            className={`rd-dev-hand__card${entry.isNew ? " is-new" : ""}`}
            style={{ left: `${index * step}px`, zIndex: index + 1 }}
            onClick={() => onOpenCard?.(entry)}
            title={entry.isNew ? "Carta nova — jogável no próximo turno" : "Ver carta"}
          >
            <DevelopmentCard card={entry.card} characterId={characterId} mini />
            {entry.isNew && <i>NOVA</i>}
          </button>
        ))}
      </div>
    </section>
  );
}
