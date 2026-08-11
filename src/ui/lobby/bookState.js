import { APP_STAGE } from "../appFlow.js";
import {
  BOOK_PAGE,
  BOOK_SCOPE,
  bookPagesForScope,
  firstBookPageForScope,
  isBookPage,
  isPageInScope,
} from "./bookPages.js";

export { BOOK_PAGE, BOOK_SCOPE } from "./bookPages.js";

/*
   Estado do livro.

   Regra que organiza este ficheiro: o `stage` diz o que a aplicação está a
   fazer, o livro diz que capítulo está aberto. Antes havia sobreposição, com
   `connecting` e `session-required` declarados como páginas quando já eram
   stages, e sem estarem em nenhuma sequência, portanto o folheador desaparecia
   silenciosamente nesses estados. Agora estados transitórios pertencem só ao
   `stage`, e o que o livro mostra nesses momentos é um painel de estado.

   O contador `revision` que existia aqui foi removido: era incrementado em cada
   transição e nenhum ficheiro o lia. Quando a animação de virar a página for
   feita, o controlador 3D recebe a página e deteta a mudança sozinho, como já
   faz com o estado aberto e fechado.
*/

export const BOOK_ACTION = Object.freeze({
  OPEN: "book/open",
  CLOSE: "book/close",
  GO: "book/go",
  NEXT: "book/next",
  PREVIOUS: "book/previous",
  SCOPE: "book/scope",
  RESET: "book/reset",
});

/** Âmbito do livro para um stage, ou `null` quando o livro mostra estado. */
export function bookScopeForStage(stage) {
  switch (stage) {
    case APP_STAGE.TITLE:
      return BOOK_SCOPE.FOYER;
    case APP_STAGE.CHARACTER_SELECTION:
    case APP_STAGE.LOBBY:
      return BOOK_SCOPE.REALM;
    default:
      // joining, reconnecting, session-required e game: o livro não folheia.
      return null;
  }
}

export function normalizeBookPage(page) {
  return isBookPage(page) ? page : BOOK_PAGE.HOME;
}

export function getBookSequence(scope) {
  return bookPagesForScope(scope ?? BOOK_SCOPE.FOYER);
}

/**
 * Posição e vizinhos da página actual dentro da sequência do âmbito.
 *
 * Nunca devolve `index: -1` para uma página válida do âmbito, que era o que
 * fazia o folheador desaparecer.
 */
export function getBookNavigation(page, scope = BOOK_SCOPE.FOYER) {
  const sequence = getBookSequence(scope);
  const normalized = normalizeBookPage(page);
  const index = sequence.indexOf(normalized);
  if (index < 0) return { index: -1, total: sequence.length, previous: null, next: null, sequence };
  return {
    index,
    total: sequence.length,
    previous: index > 0 ? sequence[index - 1] : null,
    next: index < sequence.length - 1 ? sequence[index + 1] : null,
    sequence,
  };
}

export function createInitialBookState({ page = BOOK_PAGE.HOME, open = false, scope = BOOK_SCOPE.FOYER } = {}) {
  const resolvedScope = scope ?? BOOK_SCOPE.FOYER;
  const requested = normalizeBookPage(page);
  return {
    open: open === true,
    scope: resolvedScope,
    page: isPageInScope(requested, resolvedScope) ? requested : firstBookPageForScope(resolvedScope),
  };
}

export function bookReducer(state, event) {
  const current = state || createInitialBookState();
  if (!event || typeof event !== "object") return current;

  if (event.type === BOOK_ACTION.RESET) {
    return createInitialBookState({ page: event.page, open: event.open !== false, scope: event.scope });
  }

  if (event.type === BOOK_ACTION.SCOPE) {
    /* Único ponto onde o invariante é imposto: quando o âmbito muda, uma página
       que já não pertence a ele é substituída pela primeira do novo âmbito. É
       isto que impede estados como "página de Jogadores sem reino", que o
       reducer antigo aceitava e a interface não sabia desenhar. */
    const scope = event.scope ?? null;
    if (scope === null || scope === current.scope) return current;
    const page = isPageInScope(current.page, scope) ? current.page : firstBookPageForScope(scope);
    return { ...current, scope, page };
  }

  if (event.type === BOOK_ACTION.OPEN) {
    return current.open ? current : { ...current, open: true };
  }

  if (event.type === BOOK_ACTION.CLOSE) {
    return current.open ? { ...current, open: false } : current;
  }

  if (event.type === BOOK_ACTION.GO) {
    const requested = normalizeBookPage(event.page);
    if (!isPageInScope(requested, current.scope)) return current;
    const open = event.open !== false;
    if (requested === current.page && open === current.open) return current;
    return { ...current, page: requested, open };
  }

  if (event.type === BOOK_ACTION.NEXT || event.type === BOOK_ACTION.PREVIOUS) {
    const navigation = getBookNavigation(current.page, current.scope);
    const page = event.type === BOOK_ACTION.NEXT ? navigation.next : navigation.previous;
    if (!page) return current;
    return { ...current, page, open: true };
  }

  return current;
}

export const openBook = () => ({ type: BOOK_ACTION.OPEN });
export const closeBook = () => ({ type: BOOK_ACTION.CLOSE });
export const goToBookPage = (page, { open = true } = {}) => ({ type: BOOK_ACTION.GO, page, open });
export const nextBookPage = () => ({ type: BOOK_ACTION.NEXT });
export const previousBookPage = () => ({ type: BOOK_ACTION.PREVIOUS });
export const setBookScope = (scope) => ({ type: BOOK_ACTION.SCOPE, scope });
export const resetBook = (page = BOOK_PAGE.HOME, open = true, scope = BOOK_SCOPE.FOYER) =>
  ({ type: BOOK_ACTION.RESET, page, open, scope });
