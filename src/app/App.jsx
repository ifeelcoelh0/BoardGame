import { Suspense, lazy, useEffect, useMemo, useReducer, useRef, useState } from "react";
import GameScreen from "../ui/game/GameScreen.jsx";
import AppShell, { SceneLoading } from "../ui/app/AppShell.jsx";
import ConnectionLostOverlay from "../ui/app/ConnectionLostOverlay.jsx";
import { CHARACTER_PERKS as PERKS } from "../presentation/perkCatalog.js";
import { buildDiagnosticReport, createDiagnosticReport } from "../diagnostics/diagnostics.js";
import { APP_STAGE, appFlowReducer, createInitialAppFlow, navigateTo } from "../ui/appFlow.js";
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
import useGameSettings from "../settings/useGameSettings.js";
import { CHARACTERS as CHARS } from "../game/characterCatalog.js";
import useRealmSession from "./useRealmSession.js";
import { classifyCharacterSelectionEntry, shouldAutoExitCharacterSelection } from "../ui/lobby/characterSelectionJourney.js";

const LobbyExperience = lazy(() => import("../ui/lobby/LobbyExperience.jsx"));

export default function App() {
  const [appFlow, dispatchAppFlow] = useReducer(appFlowReducer, undefined, createInitialAppFlow);
  const stage = appFlow.stage;
  const navigate = (nextStage) => dispatchAppFlow(navigateTo(nextStage));

  const [bookState, dispatchBook] = useReducer(bookReducer, undefined, createInitialBookState);
  const gameSettings = useGameSettings();
  const { settings, setSetting, fullscreen, toggleFullscreen, requestPlayFullscreen } = gameSettings;
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

  const diagnosticsPageOpen = bookState.open && bookState.page === BOOK_PAGE.DIAGNOSTICS;
  const diagnosticReport = useMemo(
    () => (diagnosticsPageOpen ? createDiagnosticReport() : null),
    [diagnosticsPageOpen],
  );

  const hasActiveLocalSeat = Boolean(
    game && Number.isInteger(seat) && Array.isArray(game.players) && game.players[seat],
  );

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
      if (!window.confirm(`Apagar o reino ${savedCode} deste navegador?`)) return;
      session.deleteSavedRealm(savedCode);
    },
  };

  const diagnostics = {
    report: diagnosticReport,
    connectionLabel: connSt === "on" ? "ligado" : connSt === "wait" ? "a ligar" : connSt === "err" ? "com erro" : "desligado",
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
        chapter: "A CAMINHO",
        title: stage === APP_STAGE.RECONNECTING ? "A recuperar o teu lugar" : "A entrar no reino",
        message: stage === APP_STAGE.RECONNECTING ? "A restabelecer a sessão…" : "A preparar a tua sessão…",
        error: err || null,
        actions: [
          ...(connSt === "on" && game?.phase === "lobby"
            ? [{ label: "Tentar novamente", primary: true, onSelect: () => void session.takeSeat() }]
            : []),
          { label: "Cancelar", onSelect: session.exitToTitle },
        ],
      };
    } else if (stage === APP_STAGE.SESSION_REQUIRED) {
      bookStatus = {
        chapter: "SESSÃO",
        title: game?.phase === "lobby" ? "Não foi possível entrar" : "Sessão necessária",
        message: game?.phase === "lobby"
          ? `O reino ${code} continua no lobby, mas não foi possível reservar ou recuperar um lugar.`
          : `A sessão do reino ${code || codeIn} não pode ser retomada neste navegador. A identidade de outro jogador nunca pode ser escolhida manualmente.`,
        error: err || null,
        actions: [{ label: "← Voltar", onSelect: session.exitToTitle }],
      };
    }
  }

  if (!game || game.phase === "lobby") {
    const leaveCurrentLobby = () => {
      if (!game) return session.exitToTitle();
      const message = seat === 0 ? "Desfazer o reino? Os convidados serão desligados." : "Sair deste reino?";
      if (!window.confirm(message)) return;
      if (seat === 0) session.exitToTitle();
      else session.leaveLobby();
    };

    return (
      <AppShell>
        <Suspense fallback={<SceneLoading label="A preparar o salão…" />}>
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
            onToggleReady={() => { requestPlayFullscreen(); session.toggleReady(); }}
            onStart={() => { requestPlayFullscreen(); session.startGame(); }}
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
    </>
  );
}
