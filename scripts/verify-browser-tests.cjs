const fs = require("fs");

function need(file, text) {
  const value = fs.readFileSync(file, "utf8");
  if (!value.includes(text)) throw new Error(`${file}: falta ${text}`);
}

function forbidPath(path) {
  if (fs.existsSync(path)) throw new Error(`${path}: artefacto Playwright antigo ainda presente`);
}

need("cypress.config.js", 'baseUrl: "http://127.0.0.1:4173"');
need("cypress/e2e/lobby.cy.js", "abre diretamente no salão");
need("cypress/e2e/lobby.cy.js", "cria uma sessão estável");
need("cypress/e2e/core-modes.cy.js", "classico");
need("cypress/e2e/core-modes.cy.js", "rapido");
need("cypress/e2e/core-modes.cy.js", "dragao");
need("cypress/e2e/core-modes.cy.js", "startRealmWithBots");
need("cypress/helpers/lobby.js", "Seal the pact with");
need("cypress/helpers/lobby.js", "startRealmWithBots");
need("src/ui/game/GameScreen.jsx", "game-screen");
need("src/multiplayer/browserPeerRuntime.js", "transport");
need("src/multiplayer/mockPeer.js", "BroadcastChannel");
need("package.json", '"cypress": "15.19.0"');
need("package.json", '"e2e:serve"');
need(".github/workflows/e2e.yml", "npm run e2e:serve");
need(".github/workflows/e2e.yml", "npm run test:e2e");
need(".github/workflows/e2e.yml", "cypress/screenshots/");

const packageJson = JSON.parse(fs.readFileSync("package.json", "utf8"));
if (packageJson.devDependencies?.["@playwright/test"]) {
  throw new Error("package.json: @playwright/test deve ser removido após a migração para Cypress");
}

const lock = JSON.parse(fs.readFileSync("package-lock.json", "utf8"));
if (lock.packages?.[""]?.devDependencies?.["@playwright/test"]) {
  throw new Error("package-lock.json: corre npm install para remover @playwright/test do lockfile");
}
if (lock.packages?.[""]?.devDependencies?.cypress !== "15.19.0" || !lock.packages?.["node_modules/cypress"]) {
  throw new Error("package-lock.json: corre npm install para instalar Cypress 15.19.0 e atualizar o lockfile");
}

forbidPath("playwright.config.js");
forbidPath("tests/e2e");
forbidPath("scripts/run-real-peerjs-e2e.mjs");
console.log("Testes browser Cypress verificados.");
