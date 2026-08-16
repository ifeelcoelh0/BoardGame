import assert from "node:assert/strict";
import test from "node:test";
import { APP_BUILD_VERSION } from "../src/appBuild.js";
import { buildDiagnosticReport, createDiagnosticEvent, createDiagnosticReport, normalizeDiagnosticError, readDiagnosticEvents, recordDiagnostic } from "../src/diagnostics/diagnostics.js";

function memoryStorage() { const values = new Map(); return { getItem: k => values.get(k) ?? null, setItem: (k,v) => values.set(k,v) }; }

test("normaliza erros sem expor tokens longos", () => {
  const value = normalizeDiagnosticError(new Error("token abcdefghijklmnopqrstuvwxyz123456"));
  assert.match(value.message, /\[redacted\]/);
});

test("diagnostics preserve the immediate TURN/network cause without exposing secrets", () => {
  const cause = new Error("Endpoint TURN respondeu com HTTP 503 (TURN_NOT_CONFIGURED).");
  const value = normalizeDiagnosticError(new Error("Não foi possível obter credenciais TURN temporárias.", { cause }));
  assert.equal(value.cause.name, "Error");
  assert.match(value.cause.message, /TURN_NOT_CONFIGURED/);
});

test("evento inclui build e timestamp", () => {
  const event = createDiagnosticEvent("test", { phase: "lobby" }, () => new Date("2026-08-06T18:00:00Z"));
  assert.equal(event.buildVersion, APP_BUILD_VERSION);
  assert.equal(event.at, "2026-08-06T18:00:00.000Z");
});

test("mantém apenas os 50 eventos mais recentes", () => {
  const storage = memoryStorage();
  for (let index = 0; index < 55; index += 1) recordDiagnostic("tick", { index }, { storage });
  assert.equal(readDiagnosticEvents(storage).length, 50);
  assert.match(buildDiagnosticReport(storage), new RegExp(APP_BUILD_VERSION.replaceAll(".", "\\.")));
});


test("diagnostic report has a structured UI model and a serialized clipboard form", () => {
  const storage = memoryStorage();
  recordDiagnostic("network-test", {}, { storage });
  const report = createDiagnosticReport(storage);
  assert.equal(report.buildVersion, APP_BUILD_VERSION);
  assert.equal(report.events.length, 1);
  assert.equal(typeof report.network.turnEnabled, "boolean");
  const serialized = JSON.parse(buildDiagnosticReport(storage));
  assert.equal(serialized.buildVersion, report.buildVersion);
  assert.equal(serialized.events.length, report.events.length);
  assert.deepEqual(serialized.network, report.network);
});
