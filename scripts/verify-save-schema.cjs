const fs = require("fs");
const { readRuntimeSource } = require("./lib/runtime-source.cjs");
function must(path, pattern, message) {
  const text = fs.readFileSync(path, "utf8");
  if (!pattern.test(text)) throw new Error(message);
}
must("src/game/saveSchema.js", /SAVE_SCHEMA_VERSION\s*=\s*2/, "Falta versão formal do schema de saves.");
must("src/game/saveStore.js", /assertGameInvariants/, "O armazenamento deixou de validar invariantes.");
must("src/game/migrations/migrateSave.js", /migrateUnversionedToV1/, "Falta migração explícita dos saves sem schema.");
must("src/game/migrations/migrateSave.js", /migrateV1ToV2/, "Falta migração do schema 1 para o estado de apresentação.");
must("src/app/useRealmSession.js", /loadGameFromStorage/, "A sessão deixou de usar o save store canónico.");
must("src/app/useRealmSession.js", /saveGameToStorage/, "A sessão deixou de usar o save store canónico.");
const runtimeSource = readRuntimeSource();
if (/localStorage\.setItem\(SAVE_KEY/.test(runtimeSource) || /JSON\.parse\(localStorage\.getItem/.test(runtimeSource)) throw new Error("Persistência crua reintroduzida no JSX.");
must("src/game/gameFactory.js", /presentation:\s*createInitialGamePresentationState\(\)/, "A fábrica não inicializa a slice de apresentação.");
must("src/game/gameInvariants.js", /INVALID_PRESENTATION_VERSION/, "Os invariantes não protegem a slice de apresentação.");
if (/\bg\.(?:log|ev|cardEv|awardEv|disaster)\b/.test(runtimeSource)) throw new Error("Campos runtimeSource de apresentação foram reintroduzidos no JSX.");
console.log("Schema, migrações e invariantes de save verificados.");
