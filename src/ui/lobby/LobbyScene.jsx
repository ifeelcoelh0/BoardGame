import { useEffect, useRef } from "react";
import { createLobbyScene } from "./lobbySceneController.js";
import { registerPerformanceProbe } from "../three/performanceProbeRegistry.js";

export default function LobbyScene({
  seatCharacters,
  isStarting,
  isSelectingCharacter,
  characters,
  onCharacterSelect,
  onCharacterSelectionExit,
  availableCharacterIds,
  onCharacterPreview,
  previewCharacter,
  previewPerk,
  characterStates,
  seatStates,
  codexPhase = "salon",
  onBookOpen,
  onRitualComplete,
  roomCode,
  roomCodeCopied,
  onCopyCode,
  onSignature,
  graphicsQuality,
  reducedMotion = false,
}) {
  const mountRef = useRef(null);
  const controllerRef = useRef(null);
  const selectionRef = useRef(isSelectingCharacter);
  const previousSelectionRef = useRef(isSelectingCharacter);
  const selectRef = useRef(onCharacterSelect);
  const previewRef = useRef(onCharacterPreview);
  const availableRef = useRef(availableCharacterIds);
  const statesRef = useRef(characterStates);
  const ritualRef = useRef(onRitualComplete);
  const bookActionsRef = useRef({ onBookOpen, onCopyCode, onSignature, onCharacterSelectionExit });
  const seatStatesRef = useRef(seatStates);
  const seatKey = seatCharacters.map((id) => id ?? "-").join("|");

  selectionRef.current = isSelectingCharacter;
  selectRef.current = onCharacterSelect;
  previewRef.current = onCharacterPreview;
  availableRef.current = availableCharacterIds;
  statesRef.current = characterStates;
  ritualRef.current = onRitualComplete;
  bookActionsRef.current = { onBookOpen, onCopyCode, onSignature, onCharacterSelectionExit };
  seatStatesRef.current = seatStates;

  useEffect(() => {
    if (!mountRef.current) return undefined;
    const controller = createLobbyScene(mountRef.current, {
      characters,
      startAtSelection: selectionRef.current,
      get selectionEnabled() { return selectionRef.current; },
      onCharacterSelect: (id) => selectRef.current?.(id),
      onCharacterPreview: (id) => previewRef.current?.(id),
      onBookOpen: () => bookActionsRef.current.onBookOpen?.(true),
      onCopyCode: () => bookActionsRef.current.onCopyCode?.(),
      onSignature: () => bookActionsRef.current.onSignature?.(),
      onSelectionExit: () => bookActionsRef.current.onCharacterSelectionExit?.(),
      isCharacterAvailable: (id) => availableRef.current.includes(id),
      graphicsQuality,
    });
    controllerRef.current = controller;
    const unregisterPerformance = registerPerformanceProbe("lobby", () => controller.getPerformanceSnapshot());
    controller.setCharacterStates(statesRef.current ?? {});
    controller.setRoomCode(roomCode, roomCodeCopied);
    (seatStatesRef.current ?? []).forEach((state, index) => controller.setSeatState(index, state));
    return () => {
      unregisterPerformance();
      controller.dispose();
      controllerRef.current = null;
    };
  }, [characters, graphicsQuality]);

  useEffect(() => {
    for (let index = 0; index < 4; index += 1) {
      controllerRef.current?.setSeatCharacter(index, seatCharacters[index] ?? null);
    }
  }, [seatKey]);

  const stateKey = JSON.stringify(characterStates ?? {});
  useEffect(() => {
    controllerRef.current?.setCharacterStates(characterStates ?? {});
  }, [stateKey]);

  const seatStateKey = JSON.stringify(seatStates ?? []);
  useEffect(() => {
    (seatStates ?? []).forEach((state, index) => controllerRef.current?.setSeatState(index, state));
  }, [seatStateKey]);

  useEffect(() => {
    if (previewCharacter) controllerRef.current?.showCharacterPreview(previewCharacter, previewPerk ?? null);
    else controllerRef.current?.hideCharacterPreview();
  }, [previewCharacter?.id, previewPerk?.n]);

  useEffect(() => {
    controllerRef.current?.setRoomCode(roomCode, roomCodeCopied);
  }, [roomCode, roomCodeCopied]);

  useEffect(() => {
    const controller = controllerRef.current;
    if (!controller) return;
    const prefersReducedMotion = reducedMotion || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
    const enteringSelection = isSelectingCharacter && !previousSelectionRef.current;
    previousSelectionRef.current = isSelectingCharacter;

    if (isStarting) {
      controller.setCodexActive(false);
      controller.setBookRitual("idle");
      controller.focusTable({ reducedMotion: prefersReducedMotion, duration: 1850 });
      return;
    }

    if (isSelectingCharacter || codexPhase === "character-transition" || codexPhase === "character-selection") {
      controller.setCodexActive(false);
      controller.setBookRitual("leaving");
      if (enteringSelection || codexPhase === "character-transition") {
        controller.focusSelection({
          reducedMotion: prefersReducedMotion,
          duration: 1740,
          onComplete: () => ritualRef.current?.("selection"),
        });
      }
      return;
    }

    if (codexPhase === "book-entering") {
      controller.setCodexActive(false);
      controller.setBookRitual("entering");
      controller.focusBook({
        reducedMotion: prefersReducedMotion,
        duration: 880,
        onComplete: () => ritualRef.current?.("entered"),
      });
      return;
    }

    if (codexPhase === "codex") {
      controller.setCodexActive(true);
      controller.setBookRitual("codex");
      return;
    }

    if (codexPhase === "book-leaving") {
      controller.setCodexActive(false);
      controller.setBookRitual("leaving");
      controller.resetCamera({
        reducedMotion: prefersReducedMotion,
        duration: 820,
        onComplete: () => ritualRef.current?.("left"),
      });
      return;
    }

    controller.setCodexActive(false);
    controller.setBookRitual("idle");
    controller.resetCamera({ reducedMotion: prefersReducedMotion, duration: 760 });
  }, [isStarting, isSelectingCharacter, codexPhase, reducedMotion]);

  return <div className={`rd-lobby-scene${isStarting ? " is-starting" : ""}`} ref={mountRef} aria-hidden="true" />;
}
