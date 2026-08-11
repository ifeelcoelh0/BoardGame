const fs = require("node:fs");
const assert = require("node:assert/strict");
const { readRuntimeSource } = require("./lib/runtime-source.cjs");

/*
   Paginação funcional do livro. Antes este verificador procurava as páginas do
   reino em renderizadores separados e as sequências escritas à mão no `bookState`.
   Ambos deixaram de existir: a ordem é única e as páginas vêm do registo.
*/

const pages = fs.readFileSync("src/ui/lobby/bookPages.js", "utf8");
const state = fs.readFileSync("src/ui/lobby/bookState.js", "utf8");
const codex = fs.readFileSync("src/ui/lobby/LobbyCodex.jsx", "utf8");
const pager = fs.readFileSync("src/ui/lobby/BookPager.jsx", "utf8");
const experience = fs.readFileSync("src/ui/lobby/LobbyExperience.jsx", "utf8");
const runtimeSource = readRuntimeSource();

for (const token of ["BOOK_PAGE_ORDER", "bookPagesForScope", "firstBookPageForScope"]) {
  assert.ok(pages.includes(token), `bookPages must export ${token}`);
}
for (const token of ["bookReducer", "getBookNavigation", "bookScopeForStage"]) {
  assert.ok(state.includes(token), `bookState must include ${token}`);
}
assert.match(codex, /<BookPager/);
assert.match(codex, /data-book-page=/);
assert.match(codex, /data-book-scope=/);
assert.match(pager, /is-previous/);
assert.match(pager, /is-next/);
assert.match(experience, /bookScope/);
assert.match(runtimeSource, /useReducer\(bookReducer/);
assert.match(runtimeSource, /bookOpen=\{bookState\.open\}/);
assert.match(runtimeSource, /onBookOpenChange=\{setBookOpen\}/);
assert.doesNotMatch(experience, /const \[bookOpen, setBookOpen\]/);

console.log("Paginação funcional verificada: uma ordem, âmbito derivado do stage, um renderizador.");
