import { useEffect, useRef, useState } from "react";
import GameIcon from "../assets/GameIcon.jsx";
import { GAME_ACTION_ICONS } from "../../assets/gameUiIcons.js";
import { diceRollPresentationKey } from "./diceRollPresentation.js";
import { t } from "../../locales/i18n.js";
import "../../styles/dice-roll-overlay.css";

const DISPLAY_MS = 1150;

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
    // Safety net in addition to animationend: the throw must never remain on screen.
    const timer = window.setTimeout(() => {
      setRoll((current) => current?.key === rollKey ? null : current);
    }, reducedMotion ? 650 : DISPLAY_MS);
    return () => window.clearTimeout(timer);
  }, [rollKey, reducedMotion]);

  const finishThrow = () => {
    setRoll((current) => current?.key === roll?.key ? null : current);
  };

  if (!roll) return null;
  return (
    <div className={`rd-dice-roll${reducedMotion ? " is-reduced-motion" : ""}`} aria-live="polite" aria-label={t("hud.diceValues", { values: roll.values.join(" and ") })}>
      <div className="rd-dice-roll__throw" aria-hidden="true" onAnimationEnd={finishThrow}>
        <GameIcon name={GAME_ACTION_ICONS.rollDice} size={108} alt="" />
      </div>
    </div>
  );
}
