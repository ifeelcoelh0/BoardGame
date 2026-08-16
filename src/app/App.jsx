import { Suspense, lazy, useEffect, useMemo, useReducer, useRef, useState } from "react";
import GameScreen from "../ui/game/GameScreen.jsx";
import AppShell, { SceneLoading } from "../ui/app/AppShell.jsx";
import ConnectionLostOverlay from "../ui/app/ConnectionLostOverlay.jsx";
import { CHARACTER_PERKS as PERKS } from "../presentation/perkCatalog.js";
import { buildDiagnosticReport, createDiagnosticReport } from "../diagnostics/diagnostics.js";
import { APP_STAGE, appFlowReducer, createInitialAppFlow, hasAuthenticatedGameSeat, navigateTo, shouldRenderAuthenticatedGame } from "../ui/appFlow.js";
import {
  BOOK_PAGE,
  bookReducer,
  bookScopeForStage,
  closeBook,
  createInitialBookState,
  goToBookPage,
  openBook,
  resetBook,
  setBookScope,
} from "../ui/lobby/bookState.js";
import { preloadBoardModule, scheduleModulePreload } from "../loading/modulePreload.js";
import { AudioSys } from "../audio/audioSystem.js";
import useAppAudioLifecycle from "./useAppAudioLifecycle.js";
import useGameEntryTransition from "./useGameEntryTransition.js";
import GameEntryTransition from "../ui/app/GameEntryTransition.jsx";
import useGameSettings from "../settings/useGameSettings.js";
import { CHARACTERS as CHARS } from "../game/characterCatalog.js";
import useRealmSession from "./useRealmSession.js";
import { classifyCharacterSelectionEntry, shouldAutoExitCharacterSelection } from "../ui/lobby/characterSelectionJourney.js";
import { t } from "../locales/i18n.js";

const LobbyExperience = lazy(() => import("../ui/lobby/LobbyExperience.jsx"));

export default function App() {
  const [appFlow, dispatchAppFlow] = useReducer(appFlowReducer, undefined, createInitialAppFlow);
  const stage = appFlow.stage;
  const navigate = (nextStage) => dispatchAppFlow(navigateTo(nextStage));

  const [bookState, dispatchBook] = useReducer(bookReducer, undefined, createInitialBookState);
  const gameSettings = useGameSettings();
  const { settings, setSetting, fullscreen, toggleFullscreen } = gameSettings;
  const [reportCopied, setReportCopied] = useState(false);
  const dismissed = useRef(new Set());
  const characterSelectionEntryRef = useRef(null);
  const previousStageRef = useRef(stage);

  const setBookPage = (page) => dispatchBook(goToBookPage(page));
  const setBookOpen = (open) => dispatchBook(open ? openBook() : closeBook());
  const book = useMemo(() => ({
    resetHome: () => dispatchBook(resetBook(BOOK_PAGE.HOME, false)),
    close: () => dispatchBook(closeBook()),
    showRealm: () => dispatchBook(goToBookPage(BOOK_PAGE.REALM, { open: false })),
    showJoin: () => dispatchBook(goToBookPage(BOOK_PAGE.JOIN)),
  }), []);

  useEffect(() => {
    dispatchBook(setBookScope(bookScopeForStage(stage)));
  }, [stage]);

  useEffect(() => {
    if (stage !== APP_STAGE.CHARACTER_SELECTION && stage !== APP_STAGE.LOBBY) return undefined;
    return scheduleModulePreload(preloadBoardModule);
  }, [stage]);

  const session = useRealmSession({ stage, navigate, book });
  const {
    game, seat, code, codeIn, setCodeIn, err, setErr, toast, connSt,
    emotes, chat, sendEmote, sendChat, testSel, setTestSel, savedRealms,
  } = session;

  useAppAudioLifecycle({ game, emotes, chat, seat, audioSystem: AudioSys });
  const gameEntryTransition = useGameEntryTransition(game);

  const diagnosticsPageOpen = bookState.open && bookState.page === BOOK_PAGE.DIAGNOSTICS;
  const diagnosticReport = useMemo(
    () => (diagnosticsPageOpen ? createDiagnosticReport() : null),
    [diagnosticsPageOpen],
  );

  const hasActiveLocalSeat = hasAuthenticatedGameSeat(game, seat);
  const renderAuthenticatedGame = shouldRenderAuthenticatedGame(game, seat);

  const localLobbyPlayer = hasActiveLocalSeat ? game.players[seat] : null;
  useEffect(() => {
    const enteredSelection = stage === APP_STAGE.CHARACTER_SELECTION && previousStageRef.current !== APP_STAGE.CHARACTER_SELECTION;
    if (enteredSelection) characterSelectionEntryRef.current = classifyCharacterSelectionEntry(localLobbyPlayer);
    if (stage !== APP_STAGE.CHARACTER_SELECTION) characterSelectionEntryRef.current = null;
    previousStageRef.current = stage;
  }, [stage, localLobbyPlayer?.playerId]);

  useEffect(() => {
    if (stage !== APP_STAGE.CHARACTER_SELECTION || !localLobbyPlayer) return;
    if (characterSelectionEntryRef.current == null) {
      characterSelectionEntryRef.current = classifyCharacterSelectionEntry(localLobbyPlayer);
      return;
    }
    if (!shouldAutoExitCharacterSelection({
      stage,
      entry: characterSelectionEntryRef.current,
      player: localLobbyPlayer,
    })) return;
    characterSelectionEntryRef.current = null;
    book.showRealm();
    navigate(APP_STAGE.LOBBY);
  }, [stage, localLobbyPlayer?.characterConfirmed, localLobbyPlayer?.playerId]);

  const foyer = {
    codeIn,
    setCodeIn,
    err,
    setErr,
    connSt,
    testSel,
    setTestSel,
    savedRealms,
    onCreate: (selectedMode) => void session.createRealm(selectedMode),
    onJoin: () => session.joinRealm(codeIn),
    onResume: (savedCode) => void session.resumeRealm(savedCode),
    onRefreshSaved: session.refreshSavedRealms,
    onDeleteSave: (savedCode) => {
      if (!window.confirm(t("app.deleteRealmConfirm", { code: savedCode }))) return;
      session.deleteSavedRealm(savedCode);
    },
  };

  const diagnostics = {
    report: diagnosticReport,
    connectionLabel: connSt === "on" ? t("app.connected") : connSt === "wait" ? t("app.connecting") : connSt === "err" ? t("app.connectionError") : t("app.disconnected"),
    reportCopied,
    onCopyReport: () => {
      void (async () => {
        try {
          await navigator.clipboard.writeText(buildDiagnosticReport());
          setReportCopied(true);
          window.setTimeout(() => setReportCopied(false), 1500);
        } catch {
          setReportCopied(false);
        }
      })();
    },
  };

  let bookStatus = null;
  if (!hasActiveLocalSeat) {
    if (stage === APP_STAGE.JOINING_ROOM || stage === APP_STAGE.RECONNECTING) {
      bookStatus = {
        chapter: t("app.onTheWay"),
        title: stage === APP_STAGE.RECONNECTING ? t("app.recoverSeat") : t("app.enterRealm"),
        message: stage === APP_STAGE.RECONNECTING ? t("app.restoreSession") : t("app.prepareSession"),
        error: err || null,
        actions: [
          ...(connSt === "on" && game?.phase === "lobby"
            ? [{ label: t("app.tryAgain"), primary: true, onSelect: () => void session.takeSeat() }]
            : []),
          { label: t("app.cancel"), onSelect: session.exitToTitle },
        ],
      };
    } else if (stage === APP_STAGE.SESSION_REQUIRED) {
      bookStatus = {
        chapter: t("app.session"),
        title: game?.phase === "lobby" ? t("app.couldNotEnter") : t("app.sessionRequired"),
        message: game?.phase === "lobby"
          ? t("app.lobbySeatFailed", { code })
          : t("app.sessionCannotResume", { code: code || codeIn }),
        error: err || null,
        actions: [{ label: t("app.back"), onSelect: session.exitToTitle }],
      };
    }
  }

  if (!renderAuthenticatedGame) {
    const leaveCurrentLobby = () => {
      if (!game || !hasActiveLocalSeat) return session.exitToTitle();
      const message = seat === 0 ? t("app.dissolveConfirm") : t("app.leaveConfirm");
      if (!window.confirm(message)) return;
      if (seat === 0) session.exitToTitle();
      else session.leaveLobby();
    };

    return (
      <AppShell>
        <Suspense fallback={<SceneLoading label={t("app.preparingHall")} />}>
          <LobbyExperience
            stage={stage}
            bookPage={bookState.page}
            bookOpen={bookState.open}
            onBookOpenChange={setBookOpen}
            onBookPageChange={setBookPage}
            game={hasActiveLocalSeat ? game : null}
            seat={hasActiveLocalSeat ? seat : null}
            characters={CHARS}
            perks={PERKS}
            bookScope={bookState.scope}
            bookStatus={bookStatus}
            foyer={foyer}
            audio={{
              muted: settings.muted,
              onToggleMuted: () => setSetting("muted", !settings.muted),
              settings,
              setSetting,
              fullscreen,
              onToggleFullscreen: toggleFullscreen,
            }}
            diagnostics={diagnostics}
            roomCode={codeIn || code}
            toast={toast}
            chat={chat}
            sendChat={sendChat}
            onToggleReady={session.toggleReady}
            onStart={session.startGame}
            onSwapCharacter={() => { setBookOpen(false); navigate(APP_STAGE.CHARACTER_SELECTION); }}
            onTogglePerks={session.togglePerks}
            onLeave={leaveCurrentLobby}
            onAddBot={session.addLobbyBot}
            onKickPlayer={session.kickLobbyPlayer}
            onCharacterSelect={(characterId) => {
              void (async () => {
                const accepted = await session.swapCharacter(characterId);
                if (!accepted) return;
                book.showRealm();
                navigate(APP_STAGE.LOBBY);
              })();
            }}
            onCharacterSelectionExit={() => navigate(APP_STAGE.LOBBY)}
            isSelectingCharacter={stage === APP_STAGE.CHARACTER_SELECTION}
            audioSystem={AudioSys}
            graphicsQuality={settings.graphicsQuality}
            reducedMotion={settings.reducedMotion}
          />
        </Suspense>
        <GameEntryTransition transition={gameEntryTransition} />
      </AppShell>
    );
  }

  return (
    <>
      <GameScreen
        game={game}
        seat={seat}
        dispatchGameAction={session.dispatchGameAction}
        toast={toast}
        dismissed={dismissed}
        emotes={emotes}
        sendEmote={sendEmote}
        chat={chat}
        sendChat={sendChat}
        onExit={session.exitToTitle}
        graphicsQuality={settings.graphicsQuality}
        settings={settings}
        setSetting={setSetting}
        fullscreen={fullscreen}
        onToggleFullscreen={toggleFullscreen}
        onRematch={session.requestRematch}
      />
      {connSt === "err" && <ConnectionLostOverlay isHost={session.isHost} onReconnect={session.reconnect} />}
      <GameEntryTransition transition={gameEntryTransition} />
    </>
  );
}
