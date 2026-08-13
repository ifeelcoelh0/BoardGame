import GameIcon from "../assets/GameIcon.jsx";
import ResourceCost from "./hud/ResourceCost.jsx";
import { ACTION_PRESENTATION } from "./gameUiComposition.js";
import { t } from "../../locales/i18n.js";
import "../../styles/game-actions.css";

function ActionIcon({ action, size = 28 }) {
  if (action.icon) return <GameIcon name={action.icon} size={size} />;
  return <span className="rd-action-button__glyph">{action.glyph || "•"}</span>;
}

export function GameActionButton({ action, onAction, compact = false, square = false, className = "" }) {
  const reasonId = `${action.id}-reason`;
  return (
    <button
      type="button"
      className={`rd-action-button rd-action-button--${action.tone || "standard"}${action.active ? " is-active" : ""}${compact ? " rd-action-button--compact" : ""}${square ? " rd-action-button--square" : ""}${className ? ` ${className}` : ""}`}
      disabled={!action.enabled}
      aria-pressed={action.active || undefined}
      aria-describedby={!action.enabled && action.reason ? reasonId : undefined}
      title={action.reason || action.meta || action.label}
      onClick={() => action.enabled && onAction?.(action)}
    >
      <span className="rd-action-button__icon" aria-hidden="true"><ActionIcon action={action} size={square ? 42 : compact ? 24 : 36} /></span>
      <span className="rd-action-button__main">
        <strong>{action.label}</strong>
        {action.meta && <small>{action.meta}</small>}
      </span>
      {action.badge != null && <b className="rd-action-button__badge">{action.badge}</b>}
      {action.cost && Object.keys(action.cost).length > 0 && (
        <span className="rd-action-button__cost"><ResourceCost cost={action.cost} /></span>
      )}
      {!action.enabled && action.reason && !compact && !square && (
        <span className="rd-action-button__reason" id={reasonId}>{action.reason}</span>
      )}
    </button>
  );
}

function ActionGroup({ group, onAction }) {
  if (!group.actions.length) return null;
  return (
    <section className={`rd-action-group rd-action-group--${group.id}`} aria-label={group.label}>
      <div className="rd-action-group__heading"><span>{group.label}</span><i aria-hidden="true" /></div>
      <div className="rd-action-group__grid">
        {group.actions.map((action) => <GameActionButton key={action.id} action={action} onAction={onAction} />)}
      </div>
    </section>
  );
}

export default function GameActionPanel({
  model,
  presentation,
  onAction,
  onMinimize,
  onRestore,
  onCancelPlacement,
  embedded = false,
}) {
  if (!model || !presentation || presentation.mode === ACTION_PRESENTATION.HIDDEN) return null;

  if (presentation.mode === ACTION_PRESENTATION.ROLL) {
    return (
      <div className={`rd-action-roll${embedded ? " rd-action-roll--embedded" : ""}`} aria-label={t("hud.rollDice")}>
        <GameActionButton action={model.roll} onAction={onAction} square />
      </div>
    );
  }

  if (presentation.mode === ACTION_PRESENTATION.PLACEMENT) {
    return (
      <div className="rd-action-placement" role="status">
        <div><strong>{presentation.label}</strong><span>{presentation.hint}</span></div>
        <button type="button" onClick={onCancelPlacement}>{t("common.cancel")}</button>
      </div>
    );
  }

  if (presentation.mode === ACTION_PRESENTATION.MINIMIZED) {
    return (
      <div className="rd-action-minimized" aria-label={t("hud.actionsCollapsed")}>
        <button type="button" onClick={onRestore}>{t("hud.openActions")}</button>
        <GameActionButton action={model.endTurn} onAction={onAction} compact />
      </div>
    );
  }

  return (
    <div className={`rd-action-panel${embedded ? " rd-action-panel--embedded" : ""}`} aria-label={t("hud.actions")}>
      <header className="rd-action-panel__toolbar">
        <span>{t("hud.actions")}</span>
        <GameActionButton action={{ ...model.endTurn, tone: "danger" }} onAction={onAction} compact className="rd-action-panel__end-turn" />
        <button type="button" className="rd-action-panel__close" onClick={onMinimize} aria-label={t("hud.closeActions")}>×</button>
      </header>
      <div className="rd-action-panel__groups">
        {model.groups.map((group) => <ActionGroup key={group.id} group={group} onAction={onAction} />)}
      </div>
    </div>
  );
}
