const fs = require("node:fs");
const path = require("node:path");
const { readRuntimeSource } = require("./lib/runtime-source.cjs");

const root = path.resolve(__dirname, "..");
const legacy = readRuntimeSource(root);
const presenter = fs.readFileSync(path.join(root, "src/presentation/gamePresenter.js"), "utf8");
const reducer = fs.readFileSync(path.join(root, "src/game/tradeReducer.js"), "utf8");
const actionReducer = fs.readFileSync(path.join(root, "src/game/gameActionReducer.js"), "utf8");
const hostSession = fs.readFileSync(path.join(root, "src/multiplayer/hostSessionPresenceController.js"), "utf8");
const tests = fs.readFileSync(path.join(root, "tests/trade-reducer.test.js"), "utf8");
const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));

const failures = [];

if (!hostSession.includes('from "../game/tradeReducer.js"')) failures.push("A presença de sessão não está ligada ao reducer de trocas.");
if (!presenter.includes("function presentTradeEvent") || !legacy.includes("presentTradeEvent,")) failures.push("A apresentação das trocas não está ligada ao presenter dedicado/runtime.");
for (const fragment of ["normalizeResourceBundle", "reduceBankTrade", "reduceTradeProposal", "reduceTradeAcceptance", "reduceTradeDecline", "reduceTradeCancellation"]) {
  if (!actionReducer.includes(fragment)) failures.push(`Integração de trocas ausente no reducer central: ${fragment}`);
}

for (const legacyFunction of [
  "function bankTrade(",
  "function acceptTrade(",
  "const validResourceBundle =",
  "const tradeMatches =",
]) {
  if (legacy.includes(legacyFunction)) failures.push(`Mutador/helper antigo de trocas ainda existe: ${legacyFunction}`);
}

for (const exportName of [
  "normalizeResourceBundle",
  "reduceBankTrade",
  "reduceTradeProposal",
  "reduceTradeAcceptance",
  "reduceTradeDecline",
  "reduceTradeCancellation",
]) {
  if (!reducer.includes(`export function ${exportName}`)) failures.push(`Export ausente: ${exportName}`);
  if (!tests.includes(`${exportName}(`)) failures.push(`Sem teste direto para ${exportName}`);
}

for (const eventType of [
  "BANK_TRADE_COMPLETED",
  "PLAYER_TRADE_PROPOSED",
  "PLAYER_TRADE_ACCEPTED",
  "PLAYER_TRADE_DECLINED",
  "PLAYER_TRADE_CANCELLED",
]) {
  if (!reducer.includes(`\"${eventType}\"`)) failures.push(`Evento de troca ausente: ${eventType}`);
}

for (const scenario of [
  "a 4:1 bank trade is immutable",
  "bank trades honor specific 2:1 and generic 3:1 ports",
  "a targeted proposal stores stable player identities",
  "accepting a trade transfers both bundles",
  "acceptance revalidates resources",
  "a broadcast proposal remains open",
  "only the proposer can cancel",
]) {
  if (!tests.includes(scenario)) failures.push(`Cenário de troca ausente nos testes: ${scenario}`);
}

if (!packageJson.scripts.test.includes("tests/trade-reducer.test.js")) {
  failures.push("A suite principal não executa tests/trade-reducer.test.js.");
}
if (!packageJson.scripts["verify:static"].includes("verify-trade-reducer.cjs")) {
  failures.push("A verificação estática não executa verify-trade-reducer.cjs.");
}

if (failures.length) {
  console.error("Falhas na extração das trocas:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log("Trocas bancárias e entre jogadores extraídas para reducer puro.");
