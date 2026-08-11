const fs = require("fs");
function need(file, text) {
  const value = fs.readFileSync(file, "utf8");
  if (!value.includes(text)) throw new Error(`${file}: falta ${text}`);
}
need("playwright.config.js", "tests/e2e");
need("tests/e2e/lobby-flow.spec.js", "abre diretamente no salão");
need("tests/e2e/lobby-flow.spec.js", "quatro páginas reservam lugares");
need("tests/e2e/lobby-flow.spec.js", "refresh recupera lugar, casa e etapa correta");
need("tests/e2e/lobby-flow.spec.js", "anfitrião inicia");
need("tests/e2e/lobby-flow.spec.js", "expulsão confirmada");
need("tests/e2e/lobby-flow.spec.js", "Galeria das casas");
need("tests/e2e/lobby-flow.spec.js", "ready-toggle");
need("src/multiplayer/browserPeerRuntime.js", "transport");
need("src/multiplayer/mockPeer.js", "BroadcastChannel");
need(".github/workflows/e2e.yml", "npm ci");
need(".github/workflows/e2e.yml", "playwright install");
need(".github/workflows/e2e.yml", "test-results/");
console.log("Testes browser verificados.");
