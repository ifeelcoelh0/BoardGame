import { useEffect, useRef, useState } from "react";
import DiceFaces from "./hud/DiceFaces.jsx";
import { diceRollPresentationKey } from "./diceRollPresentation.js";
import { t } from "../../locales/i18n.js";
import "../../styles/dice-roll-overlay.css";

const DISPLAY_MS = 1050;

export default function DiceRollOverlay({ game, reducedMotion = false }) {
  const rollKey = diceRollPresentationKey(game);
  const seenKey = useRef(rollKey);
  const [roll, setRoll] = useState(null);

  useEffect(() => {
    if (!rollKey) {
      seenKey.current = null;
      return undefined;
    }
    if (seenKey.current === rollKey) return undefined;
    seenKey.current = rollKey;
    const values = game.turn.dice.slice();
    setRoll({ key: rollKey, values });
    const timer = window.setTimeout(() => {
      setRoll((current) => current?.key === rollKey ? null : current);
    }, reducedMotion ? 560 : DISPLAY_MS);
    return () => window.clearTimeout(timer);
  }, [rollKey, reducedMotion]);

  const finishThrow = () => {
    setRoll((current) => current?.key === roll?.key ? null : current);
  };

  if (!roll) return null;
  return (
    <div className={`rd-dice-roll${reducedMotion ? " is-reduced-motion" : ""}`} aria-live="polite" aria-label={t("hud.diceValues", { values: roll.values.join(" and ") })}>
      <div className="rd-dice-roll__throw" aria-hidden="true" onAnimationEnd={finishThrow}>
        <DiceFaces values={roll.values} animationKey={roll.key} variant="overlay" empty={false} />
      </div>
    </div>
  );
}
