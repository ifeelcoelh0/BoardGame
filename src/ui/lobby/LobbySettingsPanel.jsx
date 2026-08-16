import { GameUtilityPanelShell } from "../game/hud/GameUtilityPanel.jsx";
import GameSettingsControls from "../settings/GameSettingsControls.jsx";
import { t } from "../../locales/i18n.js";
import "../../styles/game-hud.css";

/**
 * Device preferences opened directly from the hall. This intentionally shares
 * the same controls/state as the in-match options panel without navigating the
 * Codex, so the gear behaves like a conventional settings shortcut.
 */
export default function LobbySettingsPanel({ settings, setSetting, fullscreen, onToggleFullscreen, onClose }) {
  return (
    <GameUtilityPanelShell eyebrow={t("utility.preferencesDevice")} title={t("utility.options")} onClose={onClose}>
      <GameSettingsControls
        settings={settings}
        setSetting={setSetting}
        fullscreen={fullscreen}
        onToggleFullscreen={onToggleFullscreen}
      />
    </GameUtilityPanelShell>
  );
}
