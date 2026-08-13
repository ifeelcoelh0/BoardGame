import { t } from "../../locales/i18n.js";
/*
   Registo único das páginas do livro.

   O Book v2 mantém uma ordem física para a animação das folhas, mas deixa de
   apresentar essa ordem como a arquitetura principal. A navegação visível é
   organizada por secções semânticas: começar, jogar, arquivos e mais. No reino,
   as secções mudam para partida, jogadores e mais.
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

export const BOOK_SCOPE = Object.freeze({
  FOYER: "foyer",
  REALM: "realm",
  ANY: "any",
});

export const BOOK_SECTION = Object.freeze({
  START: "start",
  PLAY: "play",
  SAVES: "saves",
  REALM: "realm",
  PLAYERS: "players",
  MORE: "more",
});

export const BOOK_SECTIONS = Object.freeze({
  [BOOK_SECTION.START]: Object.freeze({ id: BOOK_SECTION.START, get label() { return t("book.start"); } }),
  [BOOK_SECTION.PLAY]: Object.freeze({ id: BOOK_SECTION.PLAY, get label() { return t("book.play"); } }),
  [BOOK_SECTION.SAVES]: Object.freeze({ id: BOOK_SECTION.SAVES, get label() { return t("book.archives"); } }),
  [BOOK_SECTION.REALM]: Object.freeze({ id: BOOK_SECTION.REALM, get label() { return t("book.match"); } }),
  [BOOK_SECTION.PLAYERS]: Object.freeze({ id: BOOK_SECTION.PLAYERS, get label() { return t("book.players"); } }),
  [BOOK_SECTION.MORE]: Object.freeze({ id: BOOK_SECTION.MORE, get label() { return t("book.more"); } }),
});

/** Ordem física das folhas. Continua a ser a única lista de páginas escrita à mão. */
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

export const BOOK_PAGES = Object.freeze({
  [BOOK_PAGE.HOME]: Object.freeze({
    id: BOOK_PAGE.HOME,
    icon: "I_Book",
    get label() { return t("book.home"); },
    get chapter() { return t("book.hall"); },
    scope: BOOK_SCOPE.FOYER,
    section: BOOK_SECTION.START,
  }),
  [BOOK_PAGE.MODE]: Object.freeze({
    id: BOOK_PAGE.MODE,
    icon: "I_Map",
    get label() { return t("book.found"); },
    get chapter() { return t("book.foundRealm"); },
    scope: BOOK_SCOPE.FOYER,
    section: BOOK_SECTION.PLAY,
  }),
  [BOOK_PAGE.JOIN]: Object.freeze({
    id: BOOK_PAGE.JOIN,
    icon: "I_Key01",
    get label() { return t("book.join"); },
    get chapter() { return t("book.joinRealm"); },
    scope: BOOK_SCOPE.FOYER,
    section: BOOK_SECTION.PLAY,
  }),
  [BOOK_PAGE.SAVED_REALMS]: Object.freeze({
    id: BOOK_PAGE.SAVED_REALMS,
    icon: "I_Chest01",
    get label() { return t("book.archives"); },
    get chapter() { return t("book.savedRealms"); },
    scope: BOOK_SCOPE.FOYER,
    section: BOOK_SECTION.SAVES,
  }),
  [BOOK_PAGE.REALM]: Object.freeze({
    id: BOOK_PAGE.REALM,
    icon: "C_Elm04",
    get label() { return t("book.match"); },
    get chapter() { return t("book.theMatch"); },
    scope: BOOK_SCOPE.REALM,
    section: BOOK_SECTION.REALM,
  }),
  [BOOK_PAGE.PLAYERS]: Object.freeze({
    id: BOOK_PAGE.PLAYERS,
    icon: "Ac_Medal01",
    get label() { return t("book.players"); },
    get chapter() { return t("book.theTable"); },
    scope: BOOK_SCOPE.REALM,
    section: BOOK_SECTION.PLAYERS,
  }),
  [BOOK_PAGE.SETTINGS]: Object.freeze({
    id: BOOK_PAGE.SETTINGS,
    icon: "RDD_Options",
    get label() { return t("book.options"); },
    get chapter() { return t("book.configuration"); },
    scope: BOOK_SCOPE.ANY,
    section: BOOK_SECTION.MORE,
  }),
  [BOOK_PAGE.RULES]: Object.freeze({
    id: BOOK_PAGE.RULES,
    icon: "I_Scroll02",
    get label() { return t("book.rules"); },
    get chapter() { return t("book.tableRules"); },
    scope: BOOK_SCOPE.ANY,
    section: BOOK_SECTION.MORE,
  }),
  [BOOK_PAGE.DIAGNOSTICS]: Object.freeze({
    id: BOOK_PAGE.DIAGNOSTICS,
    icon: "I_Telescope",
    get label() { return t("book.support"); },
    get chapter() { return t("book.systemState"); },
    scope: BOOK_SCOPE.ANY,
    section: BOOK_SECTION.MORE,
  }),
});

export function isBookPage(page) {
  return typeof page === "string" && Object.hasOwn(BOOK_PAGES, page);
}

export function bookPageMeta(page) {
  return isBookPage(page) ? BOOK_PAGES[page] : null;
}

export function bookSectionMeta(section) {
  return BOOK_SECTIONS[section] ?? null;
}

export function isPageInScope(page, scope) {
  const meta = bookPageMeta(page);
  if (!meta) return false;
  if (meta.scope === BOOK_SCOPE.ANY) return true;
  return meta.scope === scope;
}

export function bookPagesForScope(scope) {
  return BOOK_PAGE_ORDER.filter((page) => isPageInScope(page, scope));
}

export function firstBookPageForScope(scope) {
  return bookPagesForScope(scope)[0] ?? BOOK_PAGE.HOME;
}

export function firstBookPageForSection(section, scope) {
  return bookPagesForScope(scope).find((page) => bookPageMeta(page)?.section === section) ?? null;
}

export function bookSectionsForScope(scope) {
  const seen = new Set();
  const sections = [];
  for (const page of bookPagesForScope(scope)) {
    const section = bookPageMeta(page)?.section;
    if (!section || seen.has(section)) continue;
    seen.add(section);
    sections.push(section);
  }
  return sections;
}

const ROMAN = ["i", "ii", "iii", "iv", "v", "vi", "vii", "viii", "ix", "x"];

export function bookFolio(page) {
  const index = BOOK_PAGE_ORDER.indexOf(page);
  if (index < 0) return "";
  return ROMAN[index] ?? String(index + 1);
}
