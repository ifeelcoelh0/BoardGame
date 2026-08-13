import CharacterSprite from "../assets/CharacterSprite.jsx";
import DevelopmentCard from "./DevelopmentCard.jsx";
import { developmentCardPresentation } from "../../presentation/developmentCardCatalog.js";
import "../../styles/development-card-reveal.css";
import { t } from "../../locales/i18n.js";

export default function DevelopmentCardReveal({ event, game, playerName, onDismiss }) {
  if (!event) return null;
  const characterId = game?.players?.[event.pi]?.ch;
  const cardTitle = developmentCardPresentation(event.card).title;
  return (
    <div className="rd-dev-reveal" role="dialog" aria-modal="true" onClick={onDismiss}>
      <div className="rd-dev-reveal__scene" onClick={(e) => e.stopPropagation()}>
        <div className="rd-dev-reveal__card"><DevelopmentCard card={event.card} characterId={characterId} /></div>
        <aside className="rd-dev-reveal__who">
          <CharacterSprite character={characterId} size={92} />
          <div><small>{t("cardReveal.development")}</small><strong>{playerName}</strong><span>{t("cardReveal.played", { card: cardTitle || t("cardReveal.aCard") })}</span></div>
        </aside>
        <button type="button" onClick={onDismiss}>{t("common.continue")}</button>
      </div>
    </div>
  );
}
