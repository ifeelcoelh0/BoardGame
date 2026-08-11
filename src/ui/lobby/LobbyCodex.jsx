import { useCallback, useEffect, useRef, useState } from "react";
import { BOOK_PAGE, BOOK_PAGE_ORDER, bookPageMeta } from "./bookPages.js";
import { getBookNavigation } from "./bookState.js";
import { CODEX_KEY_ACTION, codexKeyboardAction } from "./lobbyCodexFlow.js";
import BookPager from "./BookPager.jsx";
import { HomePage, ModePage, JoinPage, SavedRealmsPage } from "./pages/FoyerPages.jsx";
import { RealmPage, PlayersPage, SettingsPage, RulesPage, DiagnosticsPage } from "./pages/RealmPages.jsx";

/*
   Códice do salão.

   O livro 3D é agora ritual/cenografia; esta interface é deliberadamente 2D e
   fixa ao viewport. As páginas continuam a ser as mesmas componentes puras, mas
   deixaram de depender da projecção da geometria Three.js. Isto separa a ilusão
   do salão da legibilidade e responsividade da interface.
*/

const PAGE_COMPONENTS = Object.freeze({
  [BOOK_PAGE.HOME]: HomePage,
  [BOOK_PAGE.MODE]: ModePage,
  [BOOK_PAGE.JOIN]: JoinPage,
  [BOOK_PAGE.SAVED_REALMS]: SavedRealmsPage,
  [BOOK_PAGE.REALM]: RealmPage,
  [BOOK_PAGE.PLAYERS]: PlayersPage,
  [BOOK_PAGE.SETTINGS]: SettingsPage,
  [BOOK_PAGE.RULES]: RulesPage,
  [BOOK_PAGE.DIAGNOSTICS]: DiagnosticsPage,
});

const TURN_MS = 460;

function CodexStatus({ status }) {
  return (
    <div className="rd-lobby-book-ui__spread is-status">
      <article className="rd-lobby-book-ui__page is-left">
        <header className="rd-leaf__head"><small>{status.chapter}</small><h2>{status.title}</h2></header>
        <div className="rd-leaf__body">
          <p className="rd-lobby-book-ui__folio-copy">{status.message}</p>
          {status.error && <p className="rd-lobby-book-ui__error">{status.error}</p>}
        </div>
      </article>
      <article className="rd-lobby-book-ui__page is-right">
        <header className="rd-leaf__head"><small>AÇÕES</small><h2>O que podes fazer</h2></header>
        <div className="rd-leaf__body">
          <div className="rd-lobby-book-ui__actions is-single-column">
            {status.actions?.map((action) => (
              <button
                key={action.label}
                type="button"
                className={action.primary ? "is-primary" : ""}
                onClick={action.onSelect}
              >
                {action.label}
              </button>
            ))}
          </div>
        </div>
      </article>
    </div>
  );
}

function useTurn(page) {
  const previous = useRef(page);
  const [turn, setTurn] = useState(null);

  useEffect(() => {
    if (previous.current === page) return undefined;
    const from = BOOK_PAGE_ORDER.indexOf(previous.current);
    const to = BOOK_PAGE_ORDER.indexOf(page);
    previous.current = page;
    setTurn({ key: `${from}-${to}-${Date.now()}`, forward: to >= from });
    const timer = window.setTimeout(() => setTurn(null), TURN_MS);
    return () => window.clearTimeout(timer);
  }, [page]);

  return turn;
}

export default function LobbyCodex({
  visible,
  leaving = false,
  page,
  scope,
  status = null,
  onPageChange,
  onClose,
  foyer = null,
  realm = null,
  audio = null,
  diagnostics = null,
}) {
  const turn = useTurn(page);
  const [navigationLocked, setNavigationLocked] = useState(false);
  const navigationTimerRef = useRef(null);

  const requestPage = useCallback((nextPage) => {
    if (!nextPage || leaving || navigationLocked || nextPage === page) return;
    setNavigationLocked(true);
    onPageChange?.(nextPage);
    if (navigationTimerRef.current !== null) window.clearTimeout(navigationTimerRef.current);
    navigationTimerRef.current = window.setTimeout(() => {
      navigationTimerRef.current = null;
      setNavigationLocked(false);
    }, TURN_MS);
  }, [leaving, navigationLocked, onPageChange, page]);

  useEffect(() => () => {
    if (navigationTimerRef.current !== null) window.clearTimeout(navigationTimerRef.current);
  }, []);

  useEffect(() => {
    if (!visible) return undefined;
    const onKeyDown = (event) => {
      const target = event.target;
      const editing = Boolean(target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable));
      const action = codexKeyboardAction(event.key, { editing, leaving });
      if (action === CODEX_KEY_ACTION.CLOSE && onClose) {
        event.preventDefault();
        onClose();
        return;
      }
      if (!action || navigationLocked) return;
      const navigation = getBookNavigation(page, scope);
      const nextPage = action === CODEX_KEY_ACTION.PREVIOUS ? navigation.previous : navigation.next;
      if (!nextPage) return;
      event.preventDefault();
      requestPage(nextPage);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [visible, page, scope, leaving, navigationLocked, onClose, requestPage]);

  if (!visible) return null;

  const meta = bookPageMeta(page);
  const PageComponent = meta ? PAGE_COMPONENTS[meta.id] : null;
  const showStatus = Boolean(status) || !scope || !PageComponent;

  return (
    <div className={`rd-lobby-codex-layer${leaving ? " is-leaving" : ""}`} data-testid="lobby-codex-layer">
      <section
        className="rd-lobby-codex"
        role="dialog"
        aria-modal="true"
        aria-label={scope === "realm" ? "Códice do reino" : "Códice dos reinos"}
        data-book-page={showStatus ? "status" : meta.id}
        data-book-scope={scope ?? "status"}
        data-testid="lobby-codex"
        aria-busy={navigationLocked || leaving}
      >
        <span className="rd-lobby-codex__binding" aria-hidden="true" />

        {showStatus ? (
          <CodexStatus status={status ?? { chapter: "O SALÃO", title: "Um momento", message: "A preparar o salão…", actions: [] }} />
        ) : (
          <div className="rd-lobby-book-ui__spread">
            <PageComponent
              foyer={foyer}
              realm={realm}
              scope={scope}
              audio={audio}
              diagnostics={diagnostics}
              goTo={requestPage}
            />

            {turn && (
              <span
                key={turn.key}
                className={`rd-lobby-book-ui__turn${turn.forward ? " is-forward" : " is-back"}`}
                aria-hidden="true"
              />
            )}

            <footer className="rd-lobby-book-ui__foot">
              <BookPager page={meta.id} scope={scope} onPageChange={requestPage} compact disabled={navigationLocked || leaving} />
            </footer>
          </div>
        )}

        {onClose && (
          <button className="rd-lobby-book-ui__close" type="button" onClick={onClose} disabled={leaving} aria-label="Fechar o códice">
            <span aria-hidden="true">×</span> Fechar
          </button>
        )}
      </section>
    </div>
  );
}
