/*
   Registo único das páginas do livro.

   Antes as páginas estavam definidas em quatro sítios que tinham de concordar à
   mão: as constantes de página, as sequências escritas à mão, o mapa de rótulos
   no folheador, e a cadeia de `if` do renderizador (duplicada, porque as páginas
   do foyer viviam como JSX inline no monólito e as do reino num componente).
   Acrescentar uma página exigia editar os quatro. Agora é uma entrada aqui.

   O livro é folheado de uma ponta à outra por `BOOK_PAGE_ORDER`. O que muda com
   o estado da aplicação não é a ordem, é quais das páginas estão disponíveis:
   uma página de reino não existe antes de haver reino, e as páginas do foyer
   deixam de fazer sentido depois de o haver. Cada entrada declara isso em
   `scope`, e a sequência efectiva é derivada, nunca escrita.
*/

export const BOOK_PAGE = Object.freeze({
  HOME: "home",
  MODE: "mode",
  JOIN: "join",
  SAVED_REALMS: "saved-realms",
  REALM: "realm",
  PLAYERS: "players",
  SETTINGS: "settings",
  RULES: "rules",
  DIAGNOSTICS: "diagnostics",
});

/**
 * Âmbito de uma página.
 *
 * `FOYER` só antes de haver reino, `REALM` só depois, `ANY` sempre. Opções,
 * regras e diagnóstico são `ANY` porque não dependem de haver partida, e é
 * precisamente por isso que faz sentido poderem ser consultadas nos dois lados.
 */
export const BOOK_SCOPE = Object.freeze({
  FOYER: "foyer",
  REALM: "realm",
  ANY: "any",
});

/** A ordem pela qual o livro é folheado. É a única lista escrita à mão. */
export const BOOK_PAGE_ORDER = Object.freeze([
  BOOK_PAGE.HOME,
  BOOK_PAGE.MODE,
  BOOK_PAGE.JOIN,
  BOOK_PAGE.SAVED_REALMS,
  BOOK_PAGE.REALM,
  BOOK_PAGE.PLAYERS,
  BOOK_PAGE.SETTINGS,
  BOOK_PAGE.RULES,
  BOOK_PAGE.DIAGNOSTICS,
]);

/*
   O `icon` é o ícone do conjunto RPG que identifica a página, e vive aqui pela
   mesma razão que o rótulo: era a última coisa que ainda ia ficar espalhada por
   componentes. `folio` é derivado da ordem, portanto a numeração do livro nunca
   pode divergir da paginação.
*/
export const BOOK_PAGES = Object.freeze({
  [BOOK_PAGE.HOME]: Object.freeze({
    id: BOOK_PAGE.HOME,
    icon: "I_Book",
    label: "Início",
    chapter: "O SALÃO",
    scope: BOOK_SCOPE.FOYER,
  }),
  [BOOK_PAGE.MODE]: Object.freeze({
    id: BOOK_PAGE.MODE,
    icon: "I_Map",
    label: "Modos",
    chapter: "FUNDAR REINO",
    scope: BOOK_SCOPE.FOYER,
  }),
  [BOOK_PAGE.JOIN]: Object.freeze({
    id: BOOK_PAGE.JOIN,
    icon: "I_Key01",
    label: "Código",
    chapter: "ENTRAR NUM REINO",
    scope: BOOK_SCOPE.FOYER,
  }),
  [BOOK_PAGE.SAVED_REALMS]: Object.freeze({
    id: BOOK_PAGE.SAVED_REALMS,
    icon: "I_Chest01",
    label: "Arquivos",
    chapter: "REINOS GUARDADOS",
    scope: BOOK_SCOPE.FOYER,
  }),
  [BOOK_PAGE.REALM]: Object.freeze({
    id: BOOK_PAGE.REALM,
    icon: "C_Elm04",
    label: "Partida",
    chapter: "A PARTIDA",
    scope: BOOK_SCOPE.REALM,
  }),
  [BOOK_PAGE.PLAYERS]: Object.freeze({
    id: BOOK_PAGE.PLAYERS,
    icon: "Ac_Medal01",
    label: "Jogadores",
    chapter: "A MESA",
    scope: BOOK_SCOPE.REALM,
  }),
  [BOOK_PAGE.SETTINGS]: Object.freeze({
    id: BOOK_PAGE.SETTINGS,
    icon: "RDD_Options",
    label: "Opções",
    chapter: "CONFIGURAÇÃO",
    scope: BOOK_SCOPE.ANY,
  }),
  [BOOK_PAGE.RULES]: Object.freeze({
    id: BOOK_PAGE.RULES,
    icon: "I_Scroll02",
    label: "Regras",
    chapter: "REGRAS DA MESA",
    scope: BOOK_SCOPE.ANY,
  }),
  [BOOK_PAGE.DIAGNOSTICS]: Object.freeze({
    id: BOOK_PAGE.DIAGNOSTICS,
    icon: "I_Telescope",
    label: "Diagnóstico",
    chapter: "ESTADO DO SISTEMA",
    scope: BOOK_SCOPE.ANY,
  }),
});

export function isBookPage(page) {
  return typeof page === "string" && Object.hasOwn(BOOK_PAGES, page);
}

export function bookPageMeta(page) {
  return isBookPage(page) ? BOOK_PAGES[page] : null;
}

export function isPageInScope(page, scope) {
  const meta = bookPageMeta(page);
  if (!meta) return false;
  if (meta.scope === BOOK_SCOPE.ANY) return true;
  return meta.scope === scope;
}

/** Sequência efectiva para um âmbito, derivada da ordem única. */
export function bookPagesForScope(scope) {
  return BOOK_PAGE_ORDER.filter((page) => isPageInScope(page, scope));
}

/** Primeira página de um âmbito, usada quando a página actual deixa de existir. */
export function firstBookPageForScope(scope) {
  return bookPagesForScope(scope)[0] ?? BOOK_PAGE.HOME;
}

const ROMAN = ["i", "ii", "iii", "iv", "v", "vi", "vii", "viii", "ix", "x"];

/** Número de fólio de uma página, em romanos, derivado da ordem do livro. */
export function bookFolio(page) {
  const index = BOOK_PAGE_ORDER.indexOf(page);
  if (index < 0) return "";
  return ROMAN[index] ?? String(index + 1);
}
