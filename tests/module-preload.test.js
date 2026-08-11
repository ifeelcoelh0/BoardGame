import assert from "node:assert/strict";
import test from "node:test";
import { scheduleModulePreload } from "../src/loading/modulePreload.js";

test("agenda o preload sem bloquear a execução atual", async () => {
  let calls = 0;
  const cancel = scheduleModulePreload(() => { calls += 1; }, { delay: 1 });
  assert.equal(calls, 0);
  await new Promise((resolve) => setTimeout(resolve, 12));
  assert.equal(calls, 1);
  cancel();
});

test("cancelar impede um preload ainda pendente", async () => {
  let calls = 0;
  const cancel = scheduleModulePreload(() => { calls += 1; }, { delay: 20 });
  cancel();
  await new Promise((resolve) => setTimeout(resolve, 35));
  assert.equal(calls, 0);
});

test("falhas de preload não criam rejeições não tratadas", async () => {
  scheduleModulePreload(() => Promise.reject(new Error("falha simulada")), { delay: 1 });
  await new Promise((resolve) => setTimeout(resolve, 12));
  assert.ok(true);
});
