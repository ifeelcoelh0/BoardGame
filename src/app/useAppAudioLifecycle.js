import { useEffect, useRef } from "react";
import { AudioSys } from "../audio/audioSystem.js";
import { freshLogEntries, latestCurrentAudioCue } from "../audio/audioPlaybackPolicy.js";
import { MUSIC_SCENE } from "../audio/musicCatalog.js";
import { shouldEnterFinaleMusic } from "../audio/gameMusicState.js";

export default function useAppAudioLifecycle({ game, emotes = {}, chat = [], seat = null, audioSystem = AudioSys } = {}) {
  const seenLogRef = useRef(null);
  const startActionRef = useRef(null);
  const finaleLatchedRef = useRef(false);
  const emoteIdsRef = useRef(new Map());
  const chatIdRef = useRef(null);

  useEffect(() => {
    const startAudio = () => audioSystem.start?.();
    const playUiClick = (event) => {
      const control = event.target?.closest?.("button,[role=button]");
      if (!control || control.matches?.(":disabled,[aria-disabled=true]") || control.dataset?.audioClick === "off") return;
      audioSystem.play?.("uiClick");
    };
    document.addEventListener("pointerdown", startAudio);
    document.addEventListener("click", playUiClick, true);
    return () => {
      document.removeEventListener("pointerdown", startAudio);
      document.removeEventListener("click", playUiClick, true);
    };
  }, [audioSystem]);

  useEffect(() => {
    const gameLog = game?.presentation?.log || [];
    if (!gameLog.length) {
      seenLogRef.current = null;
      return;
    }
    const top = gameLog[0];
    if (seenLogRef.current !== null && seenLogRef.current !== top.id) {
      const fresh = freshLogEntries(gameLog, seenLogRef.current);
      const cue = latestCurrentAudioCue(fresh);
      if (cue) audioSystem.playCue?.(cue);
    }
    seenLogRef.current = top.id;
  }, [audioSystem, game?.presentation?.log?.[0]?.id]);

  const emoteSignature = Object.entries(emotes)
    .map(([playerIndex, emote]) => `${playerIndex}:${emote?.id || ""}`)
    .sort()
    .join("|");
  useEffect(() => {
    for (const [playerIndex, emote] of Object.entries(emotes)) {
      if (!emote?.id || emoteIdsRef.current.get(playerIndex) === emote.id) continue;
      emoteIdsRef.current.set(playerIndex, emote.id);
      const characterId = game?.players?.[Number(playerIndex)]?.ch || null;
      audioSystem.play?.(characterId ? `emv:${characterId}:${emote.k}` : "card");
    }
  }, [audioSystem, emoteSignature, game?.v]);

  const latestChat = chat.length ? chat[chat.length - 1] : null;
  useEffect(() => {
    if (!latestChat?.id || chatIdRef.current === latestChat.id) return;
    chatIdRef.current = latestChat.id;
    if (latestChat.i !== seat) audioSystem.play?.("chatpop");
  }, [audioSystem, latestChat?.id, latestChat?.i, seat]);

  const startingActionId = game?.phase === "lobby" ? game?.lobbyStarting?.actionId : null;
  useEffect(() => {
    if (startingActionId && startActionRef.current !== startingActionId) {
      startActionRef.current = startingActionId;
      audioSystem.play?.("lobbyStart");
      audioSystem.beginGameEntryMusic?.();
      return;
    }
    if (game?.phase === "lobby" && !startingActionId && startActionRef.current) {
      startActionRef.current = null;
      audioSystem.cancelGameEntryMusic?.();
    }
  }, [audioSystem, game?.phase, startingActionId]);

  useEffect(() => {
    if (!game || game.phase === "lobby") {
      finaleLatchedRef.current = false;
      audioSystem.setMusicScene?.(MUSIC_SCENE.LOBBY);
      return;
    }
    if (!finaleLatchedRef.current && shouldEnterFinaleMusic(game)) finaleLatchedRef.current = true;
    audioSystem.setMusicScene?.(finaleLatchedRef.current ? MUSIC_SCENE.FINALE : MUSIC_SCENE.GAME);
  }, [audioSystem, game?.phase, game?.v, game?.winner]);
}
