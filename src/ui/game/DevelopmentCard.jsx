import { developmentCardArt, DEVELOPMENT_CARD_ART_STATUS } from "../../assets/developmentCardArt.js";
import { developmentCardPresentation } from "../../presentation/developmentCardCatalog.js";
import { t } from "../../locales/i18n.js";
import "../../styles/development-card.css";

const FAMILY_MARKS = Object.freeze({
  troop: "✣",
  victory: "✦",
  rare: "◆",
  utility: "※",
  war: "✧",
  unknown: "?",
});

export default function DevelopmentCard({ card, characterId = null, mini = false, className = "" }) {
  const meta = developmentCardPresentation(card);
  const art = developmentCardArt(card, characterId);
  const classes = [
    "rd-dev-card",
    `rd-dev-card--${meta.family}`,
    mini ? "rd-dev-card--mini" : "",
    art.status === DEVELOPMENT_CARD_ART_STATUS.MISSING ? "is-art-missing" : "",
    className,
  ].filter(Boolean).join(" ");

  return (
    <article className={classes} aria-label={meta.title}>
      <div className="rd-dev-card__edge" aria-hidden="true" />
      <header className="rd-dev-card__header">
        <span className="rd-dev-card__sigil" aria-hidden="true">{FAMILY_MARKS[meta.family] || FAMILY_MARKS.unknown}</span>
        <h3>{meta.title}</h3>
        <span className="rd-dev-card__sigil" aria-hidden="true">{FAMILY_MARKS[meta.family] || FAMILY_MARKS.unknown}</span>
      </header>
      <div className="rd-dev-card__art-frame">
        {art.url ? (
          <img className="rd-dev-card__art" src={art.url} alt="" draggable="false" />
        ) : (
          <div className="rd-dev-card__missing-art" aria-label={t("cards.missingArt")}>
            <span aria-hidden="true">{FAMILY_MARKS[meta.family] || FAMILY_MARKS.unknown}</span>
            {!mini && <small>{t("cards.missingArtShort")}</small>}
          </div>
        )}
      </div>
      {!mini && (
        <div className="rd-dev-card__copy">
          <p>{meta.description}</p>
        </div>
      )}
      <footer className="rd-dev-card__footer" aria-hidden="true"><span>{t("cards.brand")}</span></footer>
    </article>
  );
}
