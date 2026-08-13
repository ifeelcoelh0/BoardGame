import { useEffect, useRef, useState } from "react";
import {
  CHARACTER_VOICE_PLAY_EVENT,
  emoteVoiceEvent,
  voiceTranscript,
} from "../../audio/characterAudio.js";
import { t } from "../../locales/i18n.js";

const SUBTITLE_LIFETIME_MS = 3600;

function voiceSubtitle(event) {
  return event ? t(`voice.${event}`) : "";
}

export function deriveCharacterSubtitleEvents(game, emotes = {}) {
  const events = [];
  const top = game?.presentation?.log?.[0];
  const voice = top?.audio?.voice;
  if (voice?.character && voice?.event) {
    const playerIndex = (game?.players || []).findIndex((player) => player?.ch === voice.character);
    if (playerIndex >= 0) {
      events.push({
        playerIndex,
        id: `voice:${top.id}:${voice.character}:${voice.event}`,
        text: voiceSubtitle(voice.event),
      });
    }
  }
  for (const [rawIndex, emote] of Object.entries(emotes || {})) {
    const playerIndex = Number(rawIndex);
    if (!Number.isSafeInteger(playerIndex) || !emote?.id || !emote?.k) continue;
    const event = emoteVoiceEvent(emote.k);
    events.push({
      playerIndex,
      id: `emote:${emote.id}`,
      text: event ? voiceSubtitle(event) : t(`emote.${emote.k}`),
    });
  }
  return events;
}

export default function useCharacterSubtitles({ game, emotes = {}, lifetimeMs = SUBTITLE_LIFETIME_MS } = {}) {
  const [active, setActive] = useState({});
  const playersRef = useRef(game?.players || []);
  const timersRef = useRef(new Map());
  const sequenceRef = useRef(0);

  useEffect(() => {
    playersRef.current = game?.players || [];
  }, [game?.players]);

  useEffect(() => {
    const handleVoicePlayback = (browserEvent) => {
      const detail = browserEvent?.detail || {};
      const { character, event, variant } = detail;
      const text = voiceTranscript(character, event, variant);
      if (!text) return;

      const playerIndex = playersRef.current.findIndex((player) => player?.ch === character);
      if (playerIndex < 0) return;

      sequenceRef.current += 1;
      const subtitle = {
        playerIndex,
        id: `playback:${sequenceRef.current}:${character}:${event}:${variant}`,
        text,
      };

      setActive((current) => ({ ...current, [playerIndex]: subtitle }));
      const previous = timersRef.current.get(playerIndex);
      if (previous != null) window.clearTimeout(previous);
      const timer = window.setTimeout(() => {
        timersRef.current.delete(playerIndex);
        setActive((current) => {
          if (current[playerIndex]?.id !== subtitle.id) return current;
          const copy = { ...current };
          delete copy[playerIndex];
          return copy;
        });
      }, lifetimeMs);
      timersRef.current.set(playerIndex, timer);
    };

    window.addEventListener(CHARACTER_VOICE_PLAY_EVENT, handleVoicePlayback);
    return () => window.removeEventListener(CHARACTER_VOICE_PLAY_EVENT, handleVoicePlayback);
  }, [lifetimeMs]);

  useEffect(() => () => {
    for (const timer of timersRef.current.values()) window.clearTimeout(timer);
    timersRef.current.clear();
  }, []);

  return active;
}
