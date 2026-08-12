import test from "node:test";
import assert from "node:assert/strict";
import { APP_STAGE, appFlowReducer, createInitialAppFlow, navigateTo } from "../src/ui/appFlow.js";
import { BOOK_SECTION, bookSectionsForScope, firstBookPageForSection } from "../src/ui/lobby/bookPages.js";
import {
  BOOK_PAGE,
  BOOK_SCOPE,
  bookReducer,
  bookScopeForStage,
  closeBook,
  createInitialBookState,
  getBookNavigation,
  goToBookPage,
  nextBookPage,
  openBook,
  resetBook,
  setBookScope,
} from "../src/ui/lobby/bookState.js";

/*
   Fluxo de entrada, percorrido pelos reducers reais.

   O que se pretende garantir é o fluxo pedido: entrar no salão, escolher entre
   fundar e entrar com código, ambos os caminhos passam pela parede das casas, e
   depois volta-se à câmara por defeito. E, sobretudo, que nenhuma combinação de
   stage e página do livro representável por estes reducers é indesenhável.

   Os verificadores textuais garantem que o código está ligado; isto garante que
   as transições se comportam. Um simulador minúsculo faz o papel do componente:
   sempre que o stage muda, o âmbito do livro é sincronizado, que é o único ponto
   onde o invariante é imposto na aplicação.
*/

function createApp() {
  let flow = createInitialAppFlow();
  let book = createInitialBookState();
  const syncScope = () => {
    book = bookReducer(book, setBookScope(bookScopeForStage(flow.stage)));
  };
  return {
    get stage() { return flow.stage; },
    get page() { return book.page; },
    get scope() { return book.scope; },
    get open() { return book.open; },
    go(stage) {
      flow = appFlowReducer(flow, navigateTo(stage));
      syncScope();
      return this;
    },
    book(event) {
      book = bookReducer(book, event);
      return this;
    },
  };
}

test("o salão começa visível com o códice fechado", () => {
  const app = createApp();
  assert.equal(app.stage, APP_STAGE.TITLE);
  assert.equal(app.page, BOOK_PAGE.HOME);
  assert.equal(app.scope, BOOK_SCOPE.FOYER);
  assert.equal(app.open, false);
});

test("fundar um reino leva à parede das casas e volta ao livro do reino", () => {
  const app = createApp();
  // O jogador folheia até aos modos e escolhe um.
  app.book(goToBookPage(BOOK_PAGE.MODE));
  assert.equal(app.page, BOOK_PAGE.MODE);

  // O reino local é instalado e o livro fecha-se; a página é decidida pelo clamp.
  app.book(closeBook()).go(APP_STAGE.CHARACTER_SELECTION);
  assert.equal(app.scope, BOOK_SCOPE.REALM);
  assert.equal(app.page, BOOK_PAGE.REALM);
  assert.equal(app.open, false);

  // Confirmada a casa, volta-se ao lobby: o livro continua fechado, portanto a
  // câmara regressa à posição por defeito.
  app.go(APP_STAGE.LOBBY);
  assert.equal(app.open, false);
  assert.equal(app.page, BOOK_PAGE.REALM);
});

test("entrar com código segue o mesmo caminho", () => {
  const app = createApp();
  app.book(goToBookPage(BOOK_PAGE.JOIN));
  app.go(APP_STAGE.JOINING_ROOM);
  // Enquanto liga, o livro não folheia: o âmbito é nulo e a página fica onde
  // estava, porque o que se desenha é um painel de estado.
  assert.equal(bookScopeForStage(APP_STAGE.JOINING_ROOM), null);
  assert.equal(app.page, BOOK_PAGE.JOIN);

  app.book(closeBook()).go(APP_STAGE.CHARACTER_SELECTION);
  assert.equal(app.page, BOOK_PAGE.REALM);
  app.go(APP_STAGE.LOBBY);
  assert.equal(app.page, BOOK_PAGE.REALM);
});

test("sair da parede das casas sem confirmar volta ao livro do reino", () => {
  // Era a ratoeira: o anfitrião que acabava de fundar um reino não tinha saída.
  const app = createApp().go(APP_STAGE.CHARACTER_SELECTION);
  app.go(APP_STAGE.LOBBY).book(openBook());
  assert.equal(app.stage, APP_STAGE.LOBBY);
  assert.equal(app.page, BOOK_PAGE.REALM);
  assert.equal(app.open, true);
});

test("trocar de casa volta à parede sem perder a página do livro", () => {
  const app = createApp().go(APP_STAGE.LOBBY);
  app.book(goToBookPage(BOOK_PAGE.SETTINGS));
  app.book(closeBook()).go(APP_STAGE.CHARACTER_SELECTION);
  // O âmbito não mudou, portanto a página de âmbito partilhado sobrevive.
  assert.equal(app.page, BOOK_PAGE.SETTINGS);
});

test("nenhum stage produz uma página que não pertença ao seu âmbito", () => {
  const stages = Object.values(APP_STAGE);
  for (const from of stages) {
    for (const to of stages) {
      const app = createApp().go(from).go(to);
      const scope = bookScopeForStage(app.stage);
      if (scope === null) continue;
      assert.notEqual(
        getBookNavigation(app.page, scope).index,
        -1,
        `${from} -> ${to} deixou a página ${app.page} fora do âmbito ${scope}`,
      );
    }
  }
});

test("folhear até ao fim do livro do reino chega ao diagnóstico", () => {
  const app = createApp().go(APP_STAGE.LOBBY);
  const visited = [app.page];
  for (let i = 0; i < 10; i += 1) {
    const before = app.page;
    app.book(nextBookPage());
    if (app.page === before) break;
    visited.push(app.page);
  }
  assert.deepEqual(visited, [
    BOOK_PAGE.REALM,
    BOOK_PAGE.PLAYERS,
    BOOK_PAGE.SETTINGS,
    BOOK_PAGE.RULES,
    BOOK_PAGE.DIAGNOSTICS,
  ]);
});

test("folhear até ao fim do foyer passa pelas sete páginas", () => {
  const app = createApp();
  const visited = [app.page];
  for (let i = 0; i < 12; i += 1) {
    const before = app.page;
    app.book(nextBookPage());
    if (app.page === before) break;
    visited.push(app.page);
  }
  assert.equal(visited.length, 7);
  assert.equal(visited.at(-1), BOOK_PAGE.DIAGNOSTICS);
});

test("voltar ao título restaura o livro do foyer", () => {
  const app = createApp().go(APP_STAGE.LOBBY);
  app.book(goToBookPage(BOOK_PAGE.PLAYERS));
  app.book(resetBook(BOOK_PAGE.HOME, true, BOOK_SCOPE.FOYER)).go(APP_STAGE.TITLE);
  assert.equal(app.scope, BOOK_SCOPE.FOYER);
  assert.equal(app.page, BOOK_PAGE.HOME);
  assert.equal(app.open, true);
});


test("o foyer apresenta quatro secções semânticas", () => {
  assert.deepEqual(bookSectionsForScope(BOOK_SCOPE.FOYER), [
    BOOK_SECTION.START,
    BOOK_SECTION.PLAY,
    BOOK_SECTION.SAVES,
    BOOK_SECTION.MORE,
  ]);
  assert.equal(firstBookPageForSection(BOOK_SECTION.START, BOOK_SCOPE.FOYER), BOOK_PAGE.HOME);
  assert.equal(firstBookPageForSection(BOOK_SECTION.PLAY, BOOK_SCOPE.FOYER), BOOK_PAGE.MODE);
  assert.equal(firstBookPageForSection(BOOK_SECTION.SAVES, BOOK_SCOPE.FOYER), BOOK_PAGE.SAVED_REALMS);
  assert.equal(firstBookPageForSection(BOOK_SECTION.MORE, BOOK_SCOPE.FOYER), BOOK_PAGE.SETTINGS);
});

test("o livro do reino mantém partida, jogadores e mais como áreas próprias", () => {
  assert.deepEqual(bookSectionsForScope(BOOK_SCOPE.REALM), [
    BOOK_SECTION.REALM,
    BOOK_SECTION.PLAYERS,
    BOOK_SECTION.MORE,
  ]);
});
