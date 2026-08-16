import { useEffect, useRef, useState } from "react";
import DiceFaces from "./hud/DiceFaces.jsx";
import { diceRollPresentationKey } from "./diceRollPresentation.js";
import { t } from "../../locales/i18n.js";
import "../../styles/dice-roll-overlay.css";

const DISPLAY_MS = 1480;
const SETTLE_MS = 760;
const FACE_FRAME_MS = 92;

function rollingFace(finalValue, dieIndex, frame) {
  // Deterministic visual-only cycling: never consumes gameplay RNG.
  return ((Number(finalValue || 1) + dieIndex * 2 + frame * 3 - 1) % 6) + 1;
}

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
    const finalValues = game.turn.dice.slice(0, 2);
    const timers = [];

    if (reducedMotion) {
      setRoll({ key: rollKey, values: finalValues, settled: true });
    } else {
      setRoll({ key: rollKey, values: finalValues.map((value, index) => rollingFace(value, index, 0)), settled: false });
      const frameCount = Math.floor(SETTLE_MS / FACE_FRAME_MS);
      for (let frame = 1; frame < frameCount; frame += 1) {
        timers.push(window.setTimeout(() => {
          setRoll((current) => current?.key === rollKey
            ? { ...current, values: finalValues.map((value, index) => rollingFace(value, index, frame)) }
            : current);
        }, frame * FACE_FRAME_MS));
      }
      timers.push(window.setTimeout(() => {
        setRoll((current) => current?.key === rollKey ? { key: rollKey, values: finalValues, settled: true } : current);
      }, SETTLE_MS));
    }

    timers.push(window.setTimeout(() => {
      setRoll((current) => current?.key === rollKey ? null : current);
    }, reducedMotion ? 650 : DISPLAY_MS));

    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [rollKey, reducedMotion]);

  const finishThrow = () => {
    setRoll((current) => current?.key === roll?.key ? null : current);
  };

  if (!roll) return null;
  return (
    <div className={`rd-dice-roll${reducedMotion ? " is-reduced-motion" : ""}`} aria-live="polite" aria-label={t("hud.diceValues", { values: game.turn.dice.slice(0, 2).join(" and ") })}>
      <div className="rd-dice-roll__throw" aria-hidden="true" onAnimationEnd={finishThrow}>
        <DiceFaces
          values={roll.values}
          animationKey={roll.key}
          variant="overlay"
          empty={false}
          className={roll.settled ? "is-settled" : "is-rolling"}
        />
      </div>
    </div>
  );
}
