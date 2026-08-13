import { useEffect, useMemo, useRef, useState } from "react";
import { emoteVoiceEvent } from "../../audio/characterAudio.js";
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
  const seenRef = useRef(new Set());
  const timersRef = useRef(new Map());
  const topLogId = game?.presentation?.log?.[0]?.id ?? null;
  const emoteSignature = useMemo(() => Object.entries(emotes || {})
    .map(([index, emote]) => `${index}:${emote?.id || ""}:${emote?.k || ""}`)
    .sort()
    .join("|"), [emotes]);

  useEffect(() => {
    const nextEvents = deriveCharacterSubtitleEvents(game, emotes);
    for (const event of nextEvents) {
      if (!event.text || seenRef.current.has(event.id)) continue;
      seenRef.current.add(event.id);
      setActive((current) => ({ ...current, [event.playerIndex]: event }));
      const previous = timersRef.current.get(event.playerIndex);
      if (previous != null) window.clearTimeout(previous);
      const timer = window.setTimeout(() => {
        timersRef.current.delete(event.playerIndex);
        setActive((current) => {
          if (current[event.playerIndex]?.id !== event.id) return current;
          const copy = { ...current };
          delete copy[event.playerIndex];
          return copy;
        });
      }, lifetimeMs);
      timersRef.current.set(event.playerIndex, timer);
    }
  }, [game, topLogId, emoteSignature, lifetimeMs]);

  useEffect(() => () => {
    for (const timer of timersRef.current.values()) window.clearTimeout(timer);
    timersRef.current.clear();
  }, []);

  return active;
}
