import { useEffect, useRef } from "react";
import { AudioSys } from "../../audio/audioSystem.js";
import { localTurnNotificationKey } from "../../audio/gameAudioSelectors.js";

export default function useGameScreenAudio({ game, seat, awardEvent, awardVisible, audioSystem = AudioSys }) {
  const turnAudioKeyRef = useRef(null);
  const turnAudioKey = localTurnNotificationKey(game, seat);
  useEffect(() => {
    if (!turnAudioKey) {
      turnAudioKeyRef.current = null;
      return;
    }
    if (turnAudioKeyRef.current === turnAudioKey) return;
    turnAudioKeyRef.current = turnAudioKey;
    audioSystem.play?.("yourTurn");
  }, [audioSystem, turnAudioKey]);

  const soundedAwards = useRef(new Set());
  useEffect(() => {
    if (!awardEvent || !awardVisible || soundedAwards.current.has(awardEvent.id)) return undefined;
    soundedAwards.current.add(awardEvent.id);
    audioSystem.play?.("award");
    const voiceEvent = awardEvent.kind === "road" ? "longest_road" : awardEvent.kind === "army" ? "largest_army" : null;
    const voiceTimer = voiceEvent && awardEvent.pi != null
      ? window.setTimeout(() => audioSystem.playVoice?.(game.players[awardEvent.pi]?.ch, voiceEvent), 320)
      : null;
    return () => { if (voiceTimer != null) window.clearTimeout(voiceTimer); };
  }, [audioSystem, awardEvent?.id, awardVisible, game]);
}
