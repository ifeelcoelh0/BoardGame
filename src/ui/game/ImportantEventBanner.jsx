import { gameEventArtUrl } from "../../assets/gameEventArt.js";
import { cleanGameUiText } from "./gameTextPresentation.js";
import GameRichText from "./GameRichText.jsx";
import "../../styles/important-event-banner.css";

export default function ImportantEventBanner({ model, onDismiss, renderPlayerPortrait = null, embedded = false }) {
  if (!model) return null;
  const artUrl = gameEventArtUrl(model.artKey);
  const hasPlayer = Number.isSafeInteger(model.playerIndex) && typeof renderPlayerPortrait === "function";
  const hasPrevious = Number.isSafeInteger(model.previousPlayerIndex) && typeof renderPlayerPortrait === "function";

  const banner = (
    <article className={`rd-event-banner rd-event-banner--${model.tone}${embedded ? " rd-event-banner--embedded" : ""}`} onClick={(event) => event.stopPropagation()}>
      <div className="rd-event-banner__grain" aria-hidden="true" />
      <div className="rd-event-banner__art-wrap">
        {artUrl && <img className="rd-event-banner__art" src={artUrl} alt="" draggable="false" />}
      </div>
      <div className="rd-event-banner__copy">
        <div className="rd-event-banner__eyebrow">{cleanGameUiText(model.eyebrow)}</div>
        <h2>{cleanGameUiText(model.title)}</h2>
        <p className="rd-event-banner__text"><GameRichText iconSize={18}>{model.text}</GameRichText></p>
        {model.metric && <div className="rd-event-banner__metric">{cleanGameUiText(model.metric)}</div>}
        {model.details?.length > 0 && (
          <div className="rd-event-banner__details">
            {model.details.map((detail, index) => <p key={`${index}-${detail}`}><GameRichText>{detail}</GameRichText></p>)}
          </div>
        )}
        {hasPlayer && (
          <div className="rd-event-banner__holders" aria-label="Titular do acontecimento">
            {hasPrevious && (
              <>
                <div className="rd-event-banner__holder rd-event-banner__holder--previous">
                  <span className="rd-event-banner__portrait">{renderPlayerPortrait(model.previousPlayerIndex)}</span>
                  <span>{model.previousPlayerName}</span>
                </div>
                <span className="rd-event-banner__transfer" aria-hidden="true">→</span>
              </>
            )}
            <div className="rd-event-banner__holder rd-event-banner__holder--current">
              <span className="rd-event-banner__portrait">{renderPlayerPortrait(model.playerIndex)}</span>
              <span>{model.playerName}</span>
            </div>
          </div>
        )}
        {model.signature && <div className="rd-event-banner__signature" aria-label={`Assinatura de ${model.signature}`}>{model.signature}</div>}
      </div>
      {!embedded && <button className="rd-event-banner__continue" type="button" onClick={onDismiss}>Toca para continuar</button>}
    </article>
  );

  if (embedded) return <div className="rd-event-preview">{banner}</div>;

  return (
    <div className="rd-event-overlay" role="dialog" aria-modal="true" aria-label={model.title} onClick={onDismiss}>
      {banner}
    </div>
  );
}
