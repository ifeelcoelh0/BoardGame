import GameButton from "../system/GameButton.jsx";
import { GRAPHICS_QUALITY } from "../three/graphicsQualityProfiles.js";
import { t } from "../../locales/i18n.js";
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
        <header><small>{t("settings.audio")}</small><strong>{t("settings.mix")}</strong></header>
        <ToggleRow label={t("settings.realmSound")} description={t("settings.realmSoundDesc")} checked={!settings.muted} onChange={(value) => setSetting("muted", !value)} />
        <PercentSlider label={t("settings.music")} description={t("settings.musicDesc")} value={settings.musicVolume} onChange={(value) => setSetting("musicVolume", value)} />
        <PercentSlider label={t("settings.effects")} description={t("settings.effectsDesc")} value={settings.effectsVolume} onChange={(value) => setSetting("effectsVolume", value)} />
        <PercentSlider label={t("settings.voices")} description={t("settings.voicesDesc")} value={settings.voicesVolume} onChange={(value) => setSetting("voicesVolume", value)} />
      </section>
      <section>
        <header><small>{t("settings.graphics")}</small><strong>{t("settings.quality")}</strong></header>
        <div className="rd-settings__quality" role="group" aria-label={t("settings.graphicsQuality")}>
          {[GRAPHICS_QUALITY.LOW, GRAPHICS_QUALITY.MEDIUM, GRAPHICS_QUALITY.HIGH].map((quality) => (
            <button key={quality} type="button" className={settings.graphicsQuality === quality ? "is-active" : ""} onClick={() => setSetting("graphicsQuality", quality)}>
              {quality === "low" ? t("settings.low") : quality === "medium" ? t("settings.medium") : t("settings.high")}
            </button>
          ))}
        </div>
        <label className="rd-settings__row rd-settings__row--select">
          <span><strong>{t("settings.uiScale")}</strong><small>{t("settings.uiScaleDesc")}</small></span>
          <select value={String(settings.uiScale)} onChange={(event) => setSetting("uiScale", Number(event.target.value))}>
            <option value="0.85">85%</option><option value="0.9">90%</option><option value="0.95">95%</option><option value="1">100%</option><option value="1.05">105%</option><option value="1.1">110%</option><option value="1.15">115%</option><option value="1.2">120%</option>
          </select>
        </label>
      </section>
      <section>
        <header><small>{t("settings.comfort")}</small><strong>{t("settings.experience")}</strong></header>
        <ToggleRow label={t("settings.reducedMotion")} description={t("settings.reducedMotionDesc")} checked={settings.reducedMotion} onChange={(value) => setSetting("reducedMotion", value)} />
        {onToggleFullscreen && <GameButton variant="secondary" size="sm" onClick={onToggleFullscreen}>{fullscreen ? t("settings.exitFullscreen") : t("settings.enterFullscreen")}</GameButton>}
      </section>
    </div>
  );
}
