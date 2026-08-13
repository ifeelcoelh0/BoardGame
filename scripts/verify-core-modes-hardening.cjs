const fs = require("fs");

function need(file, text) {
  const value = fs.readFileSync(file, "utf8");
  if (!value.includes(text)) throw new Error(`${file}: falta ${text}`);
}

need("tests/core-modes-hardening.test.js", 'const CORE_MODES = ["classico", "rapido", "dragao"]');
need("tests/core-modes-hardening.test.js", "3, 4");
need("tests/core-modes-hardening.test.js", "serializeGameSave");
need("tests/core-modes-hardening.test.js", "createGameStateView");
need("cypress/e2e/core-modes.cy.js", '["classico", "Classic Mode"]');
need("cypress/e2e/core-modes.cy.js", '["rapido", "Lightning Siege"]');
need("cypress/e2e/core-modes.cy.js", '["dragao", "Dragon Mode"]');
need("cypress/e2e/core-modes.cy.js", "startRealmWithBots");
need("cypress/helpers/lobby.js", "$button[0].focus()");
need("src/ui/game/GameScreen.jsx", 'data-testid="game-screen"');
need("src/ui/game/GameScreen.jsx", "data-game-mode={g.mode}");
need("src/ui/game/GameScreen.jsx", "data-game-phase={g.phase}");
need("docs/CORE_MODES_HARDENING.md", "Matriz manual antes do merge");
console.log("Hardening dos modos-base verificado.");
