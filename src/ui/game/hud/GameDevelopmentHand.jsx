import DevelopmentCard from "../DevelopmentCard.jsx";
import GameIcon from "../../assets/GameIcon.jsx";
import { GAME_UTILITY_ICONS } from "../../../assets/gameUiIcons.js";
import { t } from "../../../locales/i18n.js";
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
    <section className={`rd-dev-hand${embedded ? " rd-dev-hand--embedded" : ""}`} aria-label={t("hud.developmentCards")}>
      <button type="button" className="rd-dev-hand__label" onClick={onOpenList} title={t("cards.openAll")}>
        <GameIcon name={GAME_UTILITY_ICONS.cards} size={24} alt="" />
        <span>{t("hud.cards")}</span>
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
            title={entry.isNew ? t("cards.newNextTurn") : t("cards.view")}
          >
            <DevelopmentCard card={entry.card} characterId={characterId} mini />
            {entry.isNew && <i>{t("cards.new")}</i>}
          </button>
        ))}
      </div>
    </section>
  );
}
