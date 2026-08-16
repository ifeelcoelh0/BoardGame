import { t } from "../../../locales/i18n.js";
import "../../../styles/dice-faces.css";

export default function DiceFaces({ values, animationKey, variant = "compact", empty = true, className = "" }) {
  const normalized = Array.isArray(values) ? values.slice(0, 2) : [];
  if (!normalized.length && !empty) return null;
  const shown = normalized.length ? normalized : [null, null];
  const classes = ["rd-dice-faces", `rd-dice-faces--${variant}`, !normalized.length ? "is-empty" : "", className]
    .filter(Boolean)
    .join(" ");
  return (
    <div
      className={classes}
      key={animationKey}
      aria-label={normalized.length ? t("hud.diceValues", { values: normalized.join(" and ") }) : t("hud.dicePending")}
    >
      {shown.map((value, index) => <span key={`${index}-${value ?? "empty"}`}>{value ?? "–"}</span>)}
    </div>
  );
}
