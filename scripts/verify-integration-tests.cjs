const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const file = path.join(root, "tests", "integration-flow.test.js");
if (!fs.existsSync(file)) throw new Error("Falta tests/integration-flow.test.js");
const source = fs.readFileSync(file, "utf8");
for (const marker of [
  "complete setup, take a turn, save and resume",
  "client → host → reducer → ACK",
  "duplicate delivery is idempotent",
  "serializeGameSave",
  "createHostActionController",
  "createClientActionController",
]) {
  if (!source.includes(marker)) throw new Error(`Teste de integração incompleto: ${marker}`);
}
const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
if (!packageJson.scripts?.test?.includes("tests/integration-flow.test.js"))
  throw new Error("A suite de integração não está incluída em npm test.");
console.log("Testes de integração 14A verificados.");
