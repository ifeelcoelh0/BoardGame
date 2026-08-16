import { useCallback, useEffect, useState } from "react";
import { AudioSys } from "../audio/audioSystem.js";
import { loadGameSettings, saveGameSettings, updateGameSetting } from "./gameSettings.js";

export async function requestGameFullscreen() {
  if (typeof document === "undefined") return false;
  if (document.fullscreenElement) return true;
  const target = document.documentElement;
  if (typeof target?.requestFullscreen !== "function") return false;
  try {
    await target.requestFullscreen({ navigationUI: "hide" });
    return true;
  } catch {
    return false;
  }
}

export async function exitGameFullscreen() {
  if (typeof document === "undefined" || !document.fullscreenElement || typeof document.exitFullscreen !== "function") return false;
  try {
    await document.exitFullscreen();
    return true;
  } catch {
    return false;
  }
}

export default function useGameSettings() {
  const [settings, setSettings] = useState(() => loadGameSettings());
  const [fullscreen, setFullscreen] = useState(() => typeof document !== "undefined" && !!document.fullscreenElement);

  useEffect(() => {
    saveGameSettings(settings);
    AudioSys.setMuted?.(settings.muted);
    AudioSys.configure?.({
      musicVolume: settings.musicVolume,
      effectsVolume: settings.effectsVolume,
      voicesVolume: settings.voicesVolume,
    });
    if (typeof document !== "undefined") {
      document.documentElement.style.setProperty("--rd-ui-scale", String(settings.uiScale));
      document.documentElement.dataset.reducedMotion = settings.reducedMotion ? "true" : "false";
      document.documentElement.dataset.graphicsQuality = settings.graphicsQuality;
    }
  }, [settings]);

  useEffect(() => {
    if (typeof document === "undefined") return undefined;
    const onFullscreen = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFullscreen);
    return () => document.removeEventListener("fullscreenchange", onFullscreen);
  }, []);

  const setSetting = useCallback((key, value) => {
    setSettings((current) => updateGameSetting(current, key, value));
  }, []);

  const toggleFullscreen = useCallback(() => {
    void (fullscreen ? exitGameFullscreen() : requestGameFullscreen());
  }, [fullscreen]);

  return {
    settings,
    setSetting,
    fullscreen,
    toggleFullscreen,
  };
}
