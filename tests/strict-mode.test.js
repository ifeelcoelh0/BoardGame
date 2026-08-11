import test from 'node:test';
import assert from 'node:assert/strict';
import { createMultiplayerRuntimeState, destroyMultiplayerRuntime } from '../src/multiplayer/runtimeState.js';
import { createPendingActionStore } from '../src/multiplayer/pendingActionStore.js';

test('destroyMultiplayerRuntime pode ser chamado duas vezes', () => {
  let closes = 0;
  let destroys = 0;
  const runtime = createMultiplayerRuntimeState();
  runtime.conns.push({ close() { closes += 1; } });
  runtime.peer = { destroy() { destroys += 1; } };
  destroyMultiplayerRuntime(runtime);
  destroyMultiplayerRuntime(runtime);
  assert.equal(closes, 1);
  assert.equal(destroys, 1);
  assert.equal(runtime.conns.length, 0);
  assert.equal(runtime.peer, null);
});

test('pendingActionStore aceita cleanup repetido', () => {
  const store = createPendingActionStore({ setTimer: () => 1, clearTimer: () => {} });
  store.clearAll(false);
  store.clearAll(false);
  assert.equal(store.size, 0);
});
