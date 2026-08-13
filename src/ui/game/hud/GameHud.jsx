import GameSurface from "../../system/GameSurface.jsx";
import GameIcon from "../../assets/GameIcon.jsx";
import { t } from "../../../locales/i18n.js";
import "../../../styles/game-hud.css";

function Dice({ values, animationKey }) {
  if (!values?.length) return null;
  return (
    <div className="rd-game-hud__dice" key={animationKey} aria-label={t("hud.diceValues", { values: values.join(" and ") })}>
      {values.map((value, index) => <span key={`${index}-${value}`}>{value}</span>)}
    </div>
  );
}

export default function GameHud({
  code, round, dice, diceAnimationKey, status, fullscreen = false, onToggleFullscreen, embedded = false,
}) {
  return (
    <div className={`rd-game-hud${embedded ? " rd-game-hud--embedded" : ""}`} aria-label={t("hud.gameHud")}>
      {embedded && (
        <div className="rd-game-hud__topline">
          <GameSurface material="oak" className="rd-game-hud__realm">
            <small>{t("hud.realm")}</small><strong>{code}</strong><i aria-hidden="true" /><span>{t("hud.round", { round })}</span>
          </GameSurface>
          <Dice values={dice} animationKey={diceAnimationKey} />
        </div>
      )}
      {!embedded && onToggleFullscreen && (
        <button
          type="button"
          className={`rd-game-hud__fullscreen${fullscreen ? " is-active" : ""}`}
          onClick={onToggleFullscreen}
          aria-label={fullscreen ? t("settings.exitFullscreen") : t("settings.enterFullscreen")}
          title={fullscreen ? t("settings.exitFullscreen") : t("settings.enterFullscreen")}
        >
          <GameIcon name="RDD_Fullscreen" size={36} alt="" />
        </button>
      )}
      {status && <div className="rd-game-hud__status" role="status"><span>{status}</span></div>}
    </div>
  );
}
