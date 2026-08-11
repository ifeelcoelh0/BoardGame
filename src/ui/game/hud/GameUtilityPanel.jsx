import GameButton from "../../system/GameButton.jsx";
import GameSurface from "../../system/GameSurface.jsx";
import GameSettingsControls from "../../settings/GameSettingsControls.jsx";

export function GameUtilityPanelShell({ title, eyebrow, onClose, children }) {
  return (
    <div className="rd-hud-panel-overlay" role="dialog" aria-modal="true" aria-label={title} onClick={onClose}>
      <GameSurface material="parchment-raised" className="rd-hud-panel" onClick={(event) => event.stopPropagation()}>
        <header className="rd-hud-panel__header">
          <div>
            <small>{eyebrow}</small>
            <h3>{title}</h3>
          </div>
          <button type="button" className="rd-hud-panel__close" onClick={onClose} aria-label={`Fechar ${title}`}>×</button>
        </header>
        {children}
      </GameSurface>
    </div>
  );
}


export function OptionsUtilityPanel({ settings, setSetting, fullscreen, onToggleFullscreen, onExit, onClose }) {
  return (
    <GameUtilityPanelShell eyebrow="Preferências deste dispositivo" title="Opções" onClose={onClose}>
      <GameSettingsControls
        settings={settings}
        setSetting={setSetting}
        fullscreen={fullscreen}
        onToggleFullscreen={onToggleFullscreen}
      />
      <div className="rd-hud-options__divider" />
      <div className="rd-hud-options__row rd-hud-options__row--exit">
        <div><small>SESSÃO</small><strong>Abandonar a partida</strong><p>O reino permanece guardado para poderes retomá-lo.</p></div>
        <GameButton variant="danger" size="sm" onClick={onExit}>Sair</GameButton>
      </div>
    </GameUtilityPanelShell>
  );
}
