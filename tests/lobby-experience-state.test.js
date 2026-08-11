import test from "node:test";
import assert from "node:assert/strict";
import { BOOK_PAGE, BOOK_SCOPE, bookReducer, bookScopeForStage, createInitialBookState, getBookNavigation, goToBookPage, nextBookPage, normalizeBookPage, previousBookPage, setBookScope } from "../src/ui/lobby/bookState.js";
import { BOOK_PAGE_ORDER, bookPagesForScope } from "../src/ui/lobby/bookPages.js";
import { APP_STAGE } from "../src/ui/appFlow.js";
import { createEmptyLobbyViewModel, createLobbyViewModel } from "../src/ui/lobby/lobbyViewModel.js";

test("book pages are independent from app stages", () => {
  assert.equal(normalizeBookPage(BOOK_PAGE.MODE), BOOK_PAGE.MODE);
  assert.equal(normalizeBookPage(BOOK_PAGE.SAVED_REALMS), BOOK_PAGE.SAVED_REALMS);
  assert.equal(normalizeBookPage("not-a-page"), BOOK_PAGE.HOME);
});

test("foyer view model has no fake room or character ownership", () => {
  const characters = [{ id: "a" }, { id: "b" }];
  const model = createEmptyLobbyViewModel(characters);
  assert.deepEqual(model.seatCharacters, [null, null, null, null]);
  assert.deepEqual(model.availableCharacterIds, ["a", "b"]);
  assert.equal(Object.hasOwn(model, "bookContent"), false);
});

test("authenticated lobby view model derives pending character state", () => {
  const characters = [{ id: "a", n: "A", pc: "#fff" }, { id: "b", n: "B", pc: "#000" }];
  const game = {
    mode: "dragao",
    test: false,
    perksOn: true,
    players: [
      { playerId: "p0", ch: null, characterConfirmed: false, ready: false, connected: true },
      { playerId: "p1", ch: "b", characterConfirmed: true, ready: false, connected: true },
    ],
  };
  const model = createLobbyViewModel({ game, seat: 0, characters, perks: {} });
  assert.equal(model.hasConfirmedCharacter, false);
  assert.equal(model.characterStates.a.status, "free");
  assert.equal(model.characterStates.b.status, "taken");
  assert.equal(Object.hasOwn(model, "bookContent"), false);
});


test("book reducer owns open state and page navigation", () => {
  let state = createInitialBookState();
  assert.equal(state.open, false);
  assert.equal(state.page, BOOK_PAGE.HOME);
  assert.equal(state.scope, BOOK_SCOPE.FOYER);

  state = bookReducer(state, goToBookPage(BOOK_PAGE.MODE));
  assert.equal(state.page, BOOK_PAGE.MODE);
  assert.equal(state.open, true);

  state = bookReducer(state, nextBookPage());
  assert.equal(state.page, BOOK_PAGE.JOIN);
  state = bookReducer(state, previousBookPage());
  assert.equal(state.page, BOOK_PAGE.MODE);
});

test("every page belongs to the single linear order", () => {
  // O livro folheia de uma ponta à outra; o que muda com o estado da aplicação
  // é quais das páginas existem, não a ordem.
  const foyer = bookPagesForScope(BOOK_SCOPE.FOYER);
  const realm = bookPagesForScope(BOOK_SCOPE.REALM);
  for (const sequence of [foyer, realm]) {
    const positions = sequence.map((page) => BOOK_PAGE_ORDER.indexOf(page));
    assert.deepEqual(positions, [...positions].sort((a, b) => a - b));
  }
  assert.deepEqual(foyer, [BOOK_PAGE.HOME, BOOK_PAGE.MODE, BOOK_PAGE.JOIN, BOOK_PAGE.SAVED_REALMS, BOOK_PAGE.SETTINGS, BOOK_PAGE.RULES, BOOK_PAGE.DIAGNOSTICS]);
  assert.deepEqual(realm, [BOOK_PAGE.REALM, BOOK_PAGE.PLAYERS, BOOK_PAGE.SETTINGS, BOOK_PAGE.RULES, BOOK_PAGE.DIAGNOSTICS]);
});

test("no page is ever outside its own sequence", () => {
  // Antes `connecting` e `session-required` eram páginas fora de qualquer
  // sequência, e o folheador desaparecia sem explicação nesses estados.
  for (const scope of [BOOK_SCOPE.FOYER, BOOK_SCOPE.REALM]) {
    for (const page of bookPagesForScope(scope)) {
      assert.notEqual(getBookNavigation(page, scope).index, -1);
    }
  }
});

test("the stage decides which pages exist", () => {
  assert.equal(bookScopeForStage(APP_STAGE.TITLE), BOOK_SCOPE.FOYER);
  assert.equal(bookScopeForStage(APP_STAGE.LOBBY), BOOK_SCOPE.REALM);
  assert.equal(bookScopeForStage(APP_STAGE.CHARACTER_SELECTION), BOOK_SCOPE.REALM);
  assert.equal(bookScopeForStage(APP_STAGE.JOINING_ROOM), null);
  assert.equal(bookScopeForStage(APP_STAGE.GAME), null);
});

test("changing scope replaces a page that no longer exists", () => {
  let state = bookReducer(createInitialBookState(), goToBookPage(BOOK_PAGE.MODE));
  state = bookReducer(state, setBookScope(BOOK_SCOPE.REALM));
  assert.equal(state.page, BOOK_PAGE.REALM);

  // Uma página de âmbito partilhado sobrevive à mudança.
  let shared = bookReducer(createInitialBookState(), goToBookPage(BOOK_PAGE.RULES));
  shared = bookReducer(shared, setBookScope(BOOK_SCOPE.REALM));
  assert.equal(shared.page, BOOK_PAGE.RULES);
});

test("a page outside the current scope cannot be opened", () => {
  const state = bookReducer(createInitialBookState(), goToBookPage(BOOK_PAGE.PLAYERS));
  assert.equal(state.page, BOOK_PAGE.HOME);
});

test("realm book keeps an ordered set of functional pages", () => {
  const navigation = getBookNavigation(BOOK_PAGE.PLAYERS, BOOK_SCOPE.REALM);
  assert.equal(navigation.previous, BOOK_PAGE.REALM);
  assert.equal(navigation.next, BOOK_PAGE.SETTINGS);
  assert.equal(navigation.total, 5);
});
