const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { readRuntimeSource } = require("./lib/runtime-source.cjs");
function read(pathname) { return fs.readFileSync(pathname, "utf8"); }
function requireText(source, text, label) {
  if (!source.includes(text)) throw new Error(`Falta ${label}: ${text}`);
}

async function main() {
  const runtimeSource = readRuntimeSource();
  const appFlow = read("src/ui/appFlow.js");
  const client = read("src/multiplayer/clientSessionPresenceController.js");
  const host = read("src/multiplayer/hostSessionPresenceController.js");
  const build = await import(pathToFileURL(path.resolve("src/appBuild.js")).href);

  if (typeof build.APP_BUILD_VERSION !== "string" || !build.APP_BUILD_VERSION) {
    throw new Error("Falta versão de build exportada.");
  }
  if (!Number.isInteger(build.APP_BUILD_COMPATIBILITY_VERSION)) {
    throw new Error("Falta versão de compatibilidade exportada.");
  }

  requireText(appFlow, 'RECONNECTING: "reconnecting"', "estado explícito de reconexão");
  requireText(runtimeSource, "A tentar recuperar o teu lugar", "mensagem de recuperação");
  requireText(runtimeSource, "if (loadPlayerSession(c)) joinRealm(c)", "tentativa automática de recuperação");
  requireText(runtimeSource, "buildCompatibilityVersion: APP_BUILD_COMPATIBILITY_VERSION", "handshake da build");
  requireText(client, 'reason: "BUILD_MISMATCH"', "rejeição no cliente");
  requireText(host, 'reason: "BUILD_MISMATCH"', "rejeição no anfitrião");
  console.log("Session recovery verification passed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
