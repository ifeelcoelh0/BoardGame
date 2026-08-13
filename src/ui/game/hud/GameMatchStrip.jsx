import { t } from "../../../locales/i18n.js";
import "../../../styles/game-match-strip.css";

function Dice({ values, animationKey }) {
  if (!values?.length) return <div className="rd-match-strip__dice is-empty" aria-label={t("hud.dicePending")}><span>–</span><span>–</span></div>;
  return (
    <div className="rd-match-strip__dice" key={animationKey} aria-label={t("hud.diceValues", { values: values.join(" and ") })}>
      {values.map((value, index) => <span key={`${index}-${value}`}>{value}</span>)}
    </div>
  );
}

export default function GameMatchStrip({ code, round, dice, diceAnimationKey }) {
  return (
    <section className="rd-match-strip" aria-label={t("hud.gameAndDice")}>
      <div className="rd-match-strip__realm">
        <small>{t("hud.realm")}</small>
        <strong>{code}</strong>
        <span>R{round}</span>
      </div>
      <Dice values={dice} animationKey={diceAnimationKey} />
    </section>
  );
}
