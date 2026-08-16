import { useEffect, useRef, useState } from "react";
import { diceGlyph, diceRollPresentationKey } from "./diceRollPresentation.js";
import { t } from "../../locales/i18n.js";
import "../../styles/dice-roll-overlay.css";

const DISPLAY_MS = 1350;

export default function DiceRollOverlay({ game, reducedMotion = false }) {
  const rollKey = diceRollPresentationKey(game);
  const seenKey = useRef(rollKey);
  const [roll, setRoll] = useState(null);

  useEffect(() => {
    if (!rollKey) {
      // A new turn deliberately keeps the previous result in `turn.dice`.
      // `rolled=false` is the real boundary that arms the next visual throw.
      seenKey.current = null;
      return undefined;
    }
    if (seenKey.current === rollKey) return undefined;
    seenKey.current = rollKey;
    const values = game.turn.dice.slice();
    setRoll({ key: rollKey, values });
    const timer = window.setTimeout(() => {
      setRoll((current) => current?.key === rollKey ? null : current);
    }, reducedMotion ? 800 : DISPLAY_MS);
    return () => window.clearTimeout(timer);
  }, [rollKey, reducedMotion]);

  if (!roll) return null;
  return (
    <div className={`rd-dice-roll${reducedMotion ? " is-reduced-motion" : ""}`} aria-live="polite" aria-label={t("hud.diceValues", { values: roll.values.join(" and ") })}>
      <div className="rd-dice-roll__tray" aria-hidden="true">
        {roll.values.map((value, index) => (
          <span className={`rd-dice-roll__die rd-dice-roll__die--${index + 1}`} key={`${roll.key}-${index}`}>
            {diceGlyph(value)}
          </span>
        ))}
      </div>
    </div>
  );
}
