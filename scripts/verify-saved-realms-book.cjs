const fs = require("node:fs");
function need(file, text) {
  const source = fs.readFileSync(file, "utf8");
  if (!source.includes(text)) throw new Error(`${file} não contém ${text}`);
}
// A página deixou de ser um componente à parte (SavedRealmsBook) e passou a ser
// uma das nove páginas do livro, na mesma folha dupla das outras.
need("src/ui/lobby/bookPages.js", 'SAVED_REALMS: "saved-realms"');
need("src/game/saveStore.js", "export function inspectGameSaves");
need("src/ui/lobby/pages/FoyerPages.jsx", "SavedRealmsPage");
need("src/ui/lobby/pages/FoyerPages.jsx", "disabled={!status.recoverable}");
need("src/ui/lobby/LobbyCodex.jsx", "SavedRealmsPage");
need("src/app/useRealmSession.js", "clearGameSave(globalThis.localStorage");
console.log("✓ livro de reinos guardados verificado");
