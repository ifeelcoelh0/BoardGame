const fs = require("node:fs");
const assert = require("node:assert/strict");
const { readRuntimeSource } = require("./lib/runtime-source.cjs");

/*
   O registo de páginas é a única fonte de verdade do livro. Este verificador
   garante que ninguém volta a criar as fontes paralelas que existiam antes:
   sequências escritas à mão, um mapa de rótulos próprio no folheador, e duas
   cadeias de renderização (uma no monólito para o foyer, outra num componente
   para o reino).
*/

const registry = fs.readFileSync("src/ui/lobby/bookPages.js", "utf8");
const state = fs.readFileSync("src/ui/lobby/bookState.js", "utf8");
const codex = fs.readFileSync("src/ui/lobby/LobbyCodex.jsx", "utf8");
const pager = fs.readFileSync("src/ui/lobby/BookPager.jsx", "utf8");
const experience = fs.readFileSync("src/ui/lobby/LobbyExperience.jsx", "utf8");
const dragonLobby = fs.readFileSync("src/ui/lobby/DragonLobby.jsx", "utf8");
const runtimeSource = readRuntimeSource();

// As sete páginas pedidas mais as duas de entrada existem no registo.
// Só o bloco BOOK_PAGE, senão o BOOK_SCOPE entra na contagem.
const pageBlock = registry.slice(registry.indexOf("BOOK_PAGE = Object.freeze"), registry.indexOf("BOOK_SCOPE = Object.freeze"));
const entries = [...pageBlock.matchAll(/^\s{2}([A-Z_]+): "([a-z-]+)",$/gm)].map((match) => ({ constant: match[1], id: match[2] }));
const ids = entries.map((entry) => entry.id);
for (const page of ["home", "mode", "join", "saved-realms", "realm", "players", "settings", "rules", "diagnostics"]) {
  assert.ok(ids.includes(page), `bookPages must declare the ${page} page`);
}

// Cada página do registo tem um componente. Sem isto, acrescentar uma entrada e
// esquecer o componente dava uma folha em branco em produção.
const order = registry.slice(registry.indexOf("BOOK_PAGE_ORDER"), registry.indexOf("BOOK_PAGES ="));
for (const { constant, id } of entries) {
  assert.ok(order.includes(`BOOK_PAGE.${constant}`), `${id} must appear in BOOK_PAGE_ORDER`);
  assert.ok(codex.includes(`[BOOK_PAGE.${constant}]`), `LobbyCodex must map a component for ${id}`);
}

/* Moldura das páginas: uma só. Cada página tem ícone no registo e usa a folha
   partilhada, senão as decisões tipográficas voltam a ficar espalhadas por
   dezoito cabeçalhos escritos à mão. */
const leaf = fs.readFileSync("src/ui/lobby/pages/Leaf.jsx", "utf8");
const foyerPages = [
  "src/ui/lobby/pages/foyer/HomePage.jsx",
  "src/ui/lobby/pages/foyer/ModePage.jsx",
  "src/ui/lobby/pages/foyer/JoinPage.jsx",
  "src/ui/lobby/pages/foyer/SavedRealmsPage.jsx",
].map((file) => fs.readFileSync(file, "utf8")).join("\n");
const realmPages = fs.readFileSync("src/ui/lobby/pages/RealmPages.jsx", "utf8");
assert.match(registry, /export function bookFolio/, "a numeração do livro tem de derivar da ordem");
for (const { id } of entries) {
  const meta = registry.slice(registry.indexOf(`id: BOOK_PAGE.`), registry.length);
  void meta;
  void id;
}
assert.equal((registry.match(/^\s{4}icon: "/gm) || []).length, entries.length, "cada página tem de declarar um ícone");
assert.match(leaf, /GameIcon/, "a folha usa os ícones do projecto");
assert.match(leaf, /rd-leaf__folio/);
for (const source of [foyerPages, realmPages]) {
  assert.doesNotMatch(source, /<article className="rd-lobby-book-ui__page/, "os cabeçalhos das páginas passam pela folha partilhada");
  assert.match(source, /<Leaf /);
}

// Estados transitórios pertencem ao stage, não ao livro.
assert.doesNotMatch(registry, /CONNECTING|SESSION_REQUIRED/, "transient stages must not be book pages");
assert.match(state, /bookScopeForStage/, "the stage must decide which pages exist");
assert.match(runtimeSource, /dispatchBook\(setBookScope\(bookScopeForStage\(stage\)\)\)/, "the scope invariant must be enforced in one place");

// Sem sequências nem rótulos duplicados.
assert.doesNotMatch(state, /BOOK_SEQUENCES/, "sequences must be derived from the registry");
assert.doesNotMatch(pager, /PAGE_LABELS/, "labels must come from the registry");
assert.match(pager, /bookPageMeta/);

// Um só renderizador de livro.
assert.match(experience, /<LobbyCodex/);
// Asserções sobre uso, não sobre a palavra: os comentários explicam o que foi
// removido e não devem fazer o verificador falhar.
assert.doesNotMatch(experience, /\{entryContent\}/, "the foyer pages must be components, not inline JSX");
assert.doesNotMatch(runtimeSource, /entryContent =/, "the runtime root must not build book markup");
assert.doesNotMatch(runtimeSource, /entryContent=\{/);
assert.doesNotMatch(dragonLobby, /LobbyBookControls|<LobbyBook|<LobbyCodex/, "DragonLobby must not render the codex");

// O contador morto foi removido.
assert.doesNotMatch(state, /revision:|current\.revision/, "bookState must not carry an unread revision counter");

// A selecção de personagem tem saída e uma só fonte de verdade.
assert.doesNotMatch(runtimeSource, /setCharacterSelectionIntent/, "stage must be the single source of truth for selection");
assert.match(runtimeSource, /onCharacterSelectionExit=\{\(\) => navigate\(APP_STAGE\.LOBBY\)\}/);

// O fluxo é coberto por um teste a correr sobre os reducers reais, não só por
// asserções textuais neste ficheiro.
const flowTest = "tests/book-entry-flow.test.js";
assert.ok(fs.existsSync(flowTest), `falta ${flowTest}`);
const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
assert.ok(pkg.scripts.test.includes(flowTest), `${flowTest} tem de correr em npm test`);

console.log(`Registo do livro verificado: ${ids.length} páginas, uma ordem, um renderizador.`);
