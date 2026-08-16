import { useEffect, useRef, useState } from "react";
import CharacterSprite from "../assets/CharacterSprite.jsx";
import GameIcon from "../assets/GameIcon.jsx";
import ResourceIcon from "./hud/ResourceIcon.jsx";
import { GAME_ACTION_ICONS } from "../../assets/gameUiIcons.js";
import { characterById } from "../../game/characterCatalog.js";
import { cleanGameUiText } from "./gameTextPresentation.js";
import { transientActionFeedbackEntry } from "./gameActionFeedback.js";
import { t } from "../../locales/i18n.js";
import "../../styles/game-action-toast.css";

export default function GameActionToast({ game, entries = [], duration = 4200 }) {
  const newest = entries[0] || null;
  const seenRef = useRef(newest?.id ?? null);
  const [entry, setEntry] = useState(null);
  const timerRef = useRef(null);

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  useEffect(() => {
    if (!newest || newest.id === seenRef.current) return;
    seenRef.current = newest.id;
    const feedback = transientActionFeedbackEntry(newest);
    if (!feedback) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    setEntry(feedback);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      setEntry((current) => current?.id === feedback.id ? null : current);
    }, duration);
  }, [newest?.id, duration]);

  if (!entry) return null;
  const player = Number.isSafeInteger(entry.pi) ? game?.players?.[entry.pi] : null;
  const character = player?.ch ? characterById(player.ch) : null;

  return (
    <aside className="rd-action-toast" role="status" aria-live="polite" onClick={() => setEntry(null)}>
      <div className="rd-action-toast__identity" aria-hidden="true">
        {character ? <CharacterSprite character={character.id} size={52} /> : <GameIcon name={GAME_ACTION_ICONS.trade} size={34} alt="" />}
      </div>
      <div className="rd-action-toast__copy">
        <small>{t("actionFeedback.trade")}</small>
        <strong>{cleanGameUiText(entry.feedbackText || entry.msg)}</strong>
        <div className="rd-action-toast__resources" aria-label={t("chronicle.resourceMovement")}>
          {entry.resources.map((item, index) => (
            <span key={`${item.resource}-${index}`} className={item.amount > 0 ? "is-gain" : "is-loss"}>
              <b>{item.amount > 0 ? "+" : "−"}{Math.abs(item.amount)}</b>
              <ResourceIcon resource={item.resource} size={24} />
            </span>
          ))}
        </div>
      </div>
    </aside>
  );
}
