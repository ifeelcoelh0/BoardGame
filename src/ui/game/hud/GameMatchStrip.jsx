import { t } from "../../../locales/i18n.js";
import DiceFaces from "./DiceFaces.jsx";
import "../../../styles/game-match-strip.css";

export default function GameMatchStrip({ code, round, dice, diceAnimationKey }) {
  return (
    <section className="rd-match-strip" aria-label={t("hud.gameAndDice")}>
      <div className="rd-match-strip__realm">
        <small>{t("hud.realm")}</small>
        <strong>{code}</strong>
        <span>R{round}</span>
      </div>
      <DiceFaces values={dice} animationKey={diceAnimationKey} variant="compact" />
    </section>
  );
}
