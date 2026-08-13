import DevelopmentCard from "./DevelopmentCard.jsx";
import { developmentCardPresentation } from "../../presentation/developmentCardCatalog.js";
import { t } from "../../locales/i18n.js";

export default function DevelopmentCardListItem({
  card,
  characterId,
  status = null,
  disabled = false,
  onPlay = null,
  dim = false,
}) {
  const meta = developmentCardPresentation(card);
  return (
    <article className={`rd-dev-card-row${dim ? " is-dim" : ""}`}>
      <div className="rd-dev-card-row__thumb" aria-hidden="true">
        <DevelopmentCard card={card} characterId={characterId} mini />
      </div>
      <div className="rd-dev-card-row__copy">
        <strong>{meta.title}</strong>
        <span>{status || meta.description}</span>
      </div>
      {onPlay && card?.kind !== "vp" ? (
        <button type="button" className="rd-dev-card-row__action" disabled={disabled} onClick={onPlay}>{t("common.play")}</button>
      ) : null}
    </article>
  );
}
