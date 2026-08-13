import GameButton from "../../system/GameButton.jsx";
import GameSurface from "../../system/GameSurface.jsx";
import GameSettingsControls from "../../settings/GameSettingsControls.jsx";
import { t } from "../../../locales/i18n.js";

export function GameUtilityPanelShell({ title, eyebrow, onClose, children }) {
  return (
    <div className="rd-hud-panel-overlay" role="dialog" aria-modal="true" aria-label={title} onClick={onClose}>
      <GameSurface material="parchment-raised" className="rd-hud-panel" onClick={(event) => event.stopPropagation()}>
        <header className="rd-hud-panel__header">
          <div>
            <small>{eyebrow}</small>
            <h3>{title}</h3>
          </div>
          <button type="button" className="rd-hud-panel__close" onClick={onClose} aria-label={`${t("common.close")} ${title}`}>×</button>
        </header>
        {children}
      </GameSurface>
    </div>
  );
}


export function OptionsUtilityPanel({ settings, setSetting, fullscreen, onToggleFullscreen, onExit, onClose }) {
  return (
    <GameUtilityPanelShell eyebrow={t("utility.preferencesDevice")} title={t("utility.options")} onClose={onClose}>
      <GameSettingsControls
        settings={settings}
        setSetting={setSetting}
        fullscreen={fullscreen}
        onToggleFullscreen={onToggleFullscreen}
      />
      <div className="rd-hud-options__divider" />
      <div className="rd-hud-options__row rd-hud-options__row--exit">
        <div><small>{t("utility.session")}</small><strong>{t("utility.leaveMatch")}</strong><p>{t("utility.leaveMatchDesc")}</p></div>
        <GameButton variant="danger" size="sm" onClick={onExit}>{t("utility.exit")}</GameButton>
      </div>
    </GameUtilityPanelShell>
  );
}
