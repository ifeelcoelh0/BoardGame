import GameButton from "../system/GameButton.jsx";
import { GRAPHICS_QUALITY } from "../three/graphicsQualityProfiles.js";
import "../../styles/game-settings.css";

function PercentSlider({ label, description, value, onChange }) {
  const percent = Math.round(value * 100);
  return (
    <label className="rd-settings__row rd-settings__row--slider">
      <span><strong>{label}</strong><small>{description}</small></span>
      <div className="rd-settings__slider-wrap">
        <input type="range" min="0" max="100" step="5" value={percent} onChange={(event) => onChange(Number(event.target.value) / 100)} />
        <b>{percent}%</b>
      </div>
    </label>
  );
}

function ToggleRow({ label, description, checked, onChange }) {
  return (
    <label className="rd-settings__row rd-settings__row--toggle">
      <span><strong>{label}</strong><small>{description}</small></span>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
    </label>
  );
}

export default function GameSettingsControls({ settings, setSetting, fullscreen = false, onToggleFullscreen = null, compact = false }) {
  if (!settings || typeof setSetting !== "function") return null;
  return (
    <div className={`rd-settings${compact ? " is-compact" : ""}`}>
      <section>
        <header><small>ÁUDIO</small><strong>Mistura</strong></header>
        <ToggleRow label="Som do reino" description="Silencia tudo sem alterar os volumes guardados." checked={!settings.muted} onChange={(value) => setSetting("muted", !value)} />
        <PercentSlider label="Música" description="Tema e futura banda sonora." value={settings.musicVolume} onChange={(value) => setSetting("musicVolume", value)} />
        <PercentSlider label="Efeitos" description="UI, dados, construção, eventos e ambiente." value={settings.effectsVolume} onChange={(value) => setSetting("effectsVolume", value)} />
        <PercentSlider label="Vozes" description="Falas e reações das personagens." value={settings.voicesVolume} onChange={(value) => setSetting("voicesVolume", value)} />
      </section>
      <section>
        <header><small>GRÁFICOS</small><strong>Qualidade</strong></header>
        <div className="rd-settings__quality" role="group" aria-label="Qualidade gráfica">
          {[GRAPHICS_QUALITY.LOW, GRAPHICS_QUALITY.MEDIUM, GRAPHICS_QUALITY.HIGH].map((quality) => (
            <button key={quality} type="button" className={settings.graphicsQuality === quality ? "is-active" : ""} onClick={() => setSetting("graphicsQuality", quality)}>
              {quality === "low" ? "Baixa" : quality === "medium" ? "Média" : "Alta"}
            </button>
          ))}
        </div>
        <label className="rd-settings__row rd-settings__row--select">
          <span><strong>Escala da interface</strong><small>Aumenta texto e controlos sem mudar o tabuleiro.</small></span>
          <select value={String(settings.uiScale)} onChange={(event) => setSetting("uiScale", Number(event.target.value))}>
            <option value="0.85">85%</option><option value="0.9">90%</option><option value="0.95">95%</option><option value="1">100%</option><option value="1.05">105%</option><option value="1.1">110%</option><option value="1.15">115%</option><option value="1.2">120%</option>
          </select>
        </label>
      </section>
      <section>
        <header><small>CONFORTO</small><strong>Experiência</strong></header>
        <ToggleRow label="Movimento reduzido" description="Encurta ou remove animações não essenciais." checked={settings.reducedMotion} onChange={(value) => setSetting("reducedMotion", value)} />
        <ToggleRow label="Ecrã inteiro ao jogar" description="É pedido num clique teu antes de a partida começar." checked={settings.fullscreenOnPlay} onChange={(value) => setSetting("fullscreenOnPlay", value)} />
        {onToggleFullscreen && <GameButton variant="secondary" size="sm" onClick={onToggleFullscreen}>{fullscreen ? "Sair do ecrã inteiro" : "Entrar em ecrã inteiro"}</GameButton>}
      </section>
    </div>
  );
}
