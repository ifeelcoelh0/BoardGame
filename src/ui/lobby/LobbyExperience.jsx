import { useEffect, useMemo, useRef, useState } from "react";
import LobbyScene from "./LobbyScene.jsx";
import DragonLobby from "./DragonLobby.jsx";
import LobbyCodex from "./LobbyCodex.jsx";
import { createEmptyLobbyViewModel, createLobbyViewModel } from "./lobbyViewModel.js";
import { canStartLobby, LOBBY_START_INTRO_MS } from "../../game/lobbyRules.js";
import { BOOK_SCOPE } from "./bookPages.js";
import { CODEX_PHASE, codexLeaving, codexVisible, completeCodexRitual, initialCodexPhase, syncCodexPhase } from "./lobbyCodexFlow.js";
import "../../styles/dragon-lobby.css";
import { t } from "../../locales/i18n.js";
import "../../styles/lobby-codex.css";

/**
 * Experiência única do salão, do foyer até ao lobby autenticado.
 *
 * O livro 3D pertence exclusivamente à cena e funciona como ritual de entrada.
 * A interface legível vive no `LobbyCodex`, deliberadamente 2D e independente
 * da geometria Three.js. Este componente orquestra a passagem entre salão,
 * ritual, códice e seleção de personagem sem duplicar controlos no `DragonLobby`.
 */
export default function LobbyExperience({
  stage,
  bookPage = "home",
  bookOpen = false,
  bookScope = BOOK_SCOPE.FOYER,
  bookStatus = null,
  onBookOpenChange,
  onBookPageChange,
  game = null,
  seat = null,
  characters,
  perks = {},
  foyer = null,
  audio = null,
  diagnostics = null,
  roomCode = "",
  isSelectingCharacter = false,
  toast,
  chat = [],
  sendChat,
  onToggleReady,
  onStart,
  onSwapCharacter,
  onTogglePerks,
  onLeave,
  onAddBot,
  onKickPlayer,
  onCharacterSelect,
  onCharacterSelectionExit,
  audioSystem = null,
  graphicsQuality,
  reducedMotion = false,
}) {
  const [previewCharacterId, setPreviewCharacterId] = useState(null);
  const [codeCopied, setCodeCopied] = useState(false);
  const [codexPhase, setCodexPhase] = useState(() => initialCodexPhase({ bookOpen, selectingCharacter: isSelectingCharacter }));
  const copyResetTimerRef = useRef(null);

  const viewModel = useMemo(() => (
    game
      ? createLobbyViewModel({ game, seat, characters, perks })
      : createEmptyLobbyViewModel(characters)
  ), [game, seat, characters, perks]);

  /* O relógio de presença vive aqui porque tanto o livro como o espelho
     acessível do DragonLobby precisam do mesmo valor. Estava só no DragonLobby,
     que era o único a desenhar a lista de jogadores. */
  const [presenceNow, setPresenceNow] = useState(() => Date.now());
  const presenceKey = viewModel.players
    .map((player) => `${player.playerId}:${player.connected}:${player.reconnectDeadline ?? ""}`)
    .join("|");
  useEffect(() => {
    if (!viewModel.players.some((player) => player.connected === false)) return undefined;
    setPresenceNow(Date.now());
    const timer = window.setInterval(() => setPresenceNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [presenceKey]);

  useEffect(() => {
    audioSystem?.setAmbient?.("lobbyFireplace");
    return () => audioSystem?.clearAmbient?.("lobbyFireplace");
  }, [audioSystem]);

  useEffect(() => () => {
    if (copyResetTimerRef.current !== null) window.clearTimeout(copyResetTimerRef.current);
  }, []);

  useEffect(() => {
    if (isSelectingCharacter) {
      if (bookOpen) onBookOpenChange?.(false);
      setCodexPhase((phase) => syncCodexPhase(phase, { bookOpen: false, selectingCharacter: true }));
      return;
    }

    setCodexPhase((phase) => syncCodexPhase(phase, { bookOpen, selectingCharacter: false }));
  }, [isSelectingCharacter, bookOpen, onBookOpenChange]);

  useEffect(() => {
    if (!isSelectingCharacter) setPreviewCharacterId(null);
  }, [isSelectingCharacter]);

  const previewCharacter = isSelectingCharacter && previewCharacterId
    ? characters.find((character) => character.id === previewCharacterId) ?? null
    : null;
  const previewPerk = previewCharacter && game?.mode === "guerra"
    ? perks[previewCharacter.id] ?? null
    : null;
  const isStarting = Boolean(game?.lobbyStarting);
  const startDurationMs = isStarting
    ? Math.max(0, Number(game.lobbyStarting.introEndsAt) - Number(game.lobbyStarting.startedAt)) || LOBBY_START_INTRO_MS
    : LOBBY_START_INTRO_MS;
  useEffect(() => {
    if (!isStarting || !bookOpen) return;
    setCodexPhase(CODEX_PHASE.LEAVING);
    onBookOpenChange?.(false);
  }, [isStarting, bookOpen, onBookOpenChange]);

  const copyRoomCode = async () => {
    const value = game?.code || roomCode;
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCodeCopied(true);
      if (copyResetTimerRef.current !== null) window.clearTimeout(copyResetTimerRef.current);
      copyResetTimerRef.current = window.setTimeout(() => {
        copyResetTimerRef.current = null;
        setCodeCopied(false);
      }, 1400);
    } catch {
      setCodeCopied(false);
    }
  };

  const confirmCharacter = (characterId) => {
    setPreviewCharacterId(null);
    onCharacterSelect?.(characterId);
  };

  const openBook = (open) => {
    if (open && isSelectingCharacter) return;
    if (open) {
      setCodexPhase(CODEX_PHASE.ENTERING);
      onBookOpenChange?.(true);
      audioSystem?.play?.("lobbyBook");
      return;
    }
    setCodexPhase(CODEX_PHASE.LEAVING);
    onBookOpenChange?.(false);
  };

  const completeRitual = (event) => {
    setCodexPhase((phase) => completeCodexRitual(phase, event, { bookOpen }));
  };

  const changePage = (page) => {
    audioSystem?.play?.("lobbyBook");
    onBookPageChange?.(page);
  };

  /* Pacote de dados do reino. É construído aqui e não nas páginas para que as
     páginas continuem a não conhecer o modelo de jogo nem a rede. */
  const realm = game && viewModel.localPlayer
    ? {
      game,
      seat,
      mode: viewModel.mode,
      players: viewModel.players,
      slots: viewModel.slots,
      localPlayer: viewModel.localPlayer,
      perk: viewModel.perk,
      isHost: viewModel.isHost,
      hasConfirmedCharacter: viewModel.hasConfirmedCharacter,
      isStarting,
      allReady: canStartLobby(game, 0),
      codeCopied,
      presenceNow,
      onCopyCode: copyRoomCode,
      onTogglePerks,
      onAddBot,
      onKickPlayer,
      onToggleReady,
      onStart,
      onSwapCharacter,
      onLeave,
    }
    : null;

  return (
    <main className="rd-entry" data-stage={stage} data-testid="lobby-experience">
      <LobbyScene
        seatCharacters={viewModel.seatCharacters}
        isStarting={isStarting}
        startDurationMs={startDurationMs}
        isSelectingCharacter={isSelectingCharacter}
        characters={characters}
        onCharacterSelect={confirmCharacter}
        onCharacterSelectionExit={onCharacterSelectionExit}
        availableCharacterIds={viewModel.availableCharacterIds}
        onCharacterPreview={setPreviewCharacterId}
        previewCharacter={previewCharacter}
        previewPerk={previewPerk}
        characterStates={viewModel.characterStates}
        seatStates={viewModel.seatStates}
        codexPhase={codexPhase}
        onBookOpen={openBook}
        onRitualComplete={completeRitual}
        roomCode={game?.code || roomCode}
        roomCodeCopied={codeCopied}
        onCopyCode={copyRoomCode}
        onSignature={() => audioSystem?.play?.("lobbySignature")}
        graphicsQuality={graphicsQuality}
        reducedMotion={reducedMotion}
      />

      <div className="rd-lobby-vignette" aria-hidden="true" />

      <LobbyCodex
        visible={codexVisible(codexPhase)}
        leaving={codexLeaving(codexPhase)}
        page={bookPage}
        scope={bookScope}
        status={bookStatus}
        onPageChange={changePage}
        onClose={() => openBook(false)}
        foyer={foyer}
        realm={realm}
        audio={audio}
        diagnostics={diagnostics}
      />

      {codexPhase === CODEX_PHASE.SALON && !isSelectingCharacter && !isStarting && (
        <div className="rd-entry-book-access" aria-label={t("lobby.quickActions")}>
          <div className="rd-entry-book-access__actions">
            <button type="button" className="is-codex" onClick={() => openBook(true)}>{t("lobby.openCodex")}</button>
            {realm && (
              <button
                type="button"
                className={`is-ready${realm.localPlayer?.ready ? " is-on" : ""}`}
                onClick={realm.onToggleReady}
                disabled={!realm.hasConfirmedCharacter}
              >
                {realm.localPlayer?.ready ? t("lobby.readyCheck") : t("lobby.iAmReady")}
              </button>
            )}
            {realm?.isHost && (
              <button
                type="button"
                className="is-start"
                onClick={realm.onStart}
                disabled={!realm.allReady}
              >
                {t("lobby.startGame")}
              </button>
            )}
          </div>
          <small>{realm?.localPlayer?.ready ? t("lobby.houseReady") : t("lobby.codexPaths")}</small>
        </div>
      )}

      {game && (
        <DragonLobby
          game={game}
          seat={seat}
          characters={characters}
          perks={perks}
          toast={toast}
          chat={chat}
          sendChat={sendChat}
          onToggleReady={onToggleReady}
          onStart={onStart}
          onSwapCharacter={onSwapCharacter}
          onTogglePerks={onTogglePerks}
          onLeave={onLeave}
          onAddBot={onAddBot}
          onKickPlayer={onKickPlayer}
          onCharacterSelect={confirmCharacter}
          isSelectingCharacter={isSelectingCharacter}
          startDurationMs={startDurationMs}
          audioSystem={audioSystem}
          viewModel={viewModel}
          presenceNow={presenceNow}
          previewCharacterId={previewCharacterId}
          onPreviewCharacterChange={setPreviewCharacterId}
          codeCopied={codeCopied}
          onCopyCode={copyRoomCode}
        />
      )}
    </main>
  );
}
