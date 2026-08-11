export const DEFAULT_ACTION_TIMEOUT_MS = 4_000;
export const DEFAULT_ACTION_ATTEMPTS = 2;

export class PendingActionStore extends Map {
  constructor({
    timeoutMs = DEFAULT_ACTION_TIMEOUT_MS,
    maxAttempts = DEFAULT_ACTION_ATTEMPTS,
    setTimer = setTimeout,
    clearTimer = clearTimeout,
  } = {}) {
    super();
    this.timeoutMs = Math.max(1, Number(timeoutMs) || DEFAULT_ACTION_TIMEOUT_MS);
    this.maxAttempts = Math.max(1, Number(maxAttempts) || DEFAULT_ACTION_ATTEMPTS);
    this.setTimer = setTimer;
    this.clearTimerFn = clearTimer;
  }

  findByType(type) {
    for (const pending of this.values()) {
      if (pending?.type === type) return pending;
    }
    return null;
  }

  clearPendingTimer(pending) {
    if (pending?.timeoutId != null) this.clearTimerFn(pending.timeoutId);
    if (pending) pending.timeoutId = null;
  }

  take(actionId) {
    const pending = this.get(actionId);
    if (!pending) return null;
    this.delete(actionId);
    this.clearPendingTimer(pending);
    return pending;
  }

  registerRemote(actionId, record = {}) {
    let resolvePending;
    const promise = new Promise((resolve) => { resolvePending = resolve; });
    this.set(actionId, {
      ...record,
      promise,
      resolve: resolvePending,
      attempts: 0,
      timeoutId: null,
    });
    return promise;
  }

  fail(actionId, reason = "ACTION_TIMEOUT", onFailure = null) {
    const pending = this.take(actionId);
    if (!pending) return false;
    onFailure?.(reason, pending);
    pending.resolve?.(false);
    return true;
  }

  send(actionId, {
    getConnection,
    onFailure,
    unavailableReason = "UNAUTHENTICATED",
    timeoutReason = "ACTION_TIMEOUT",
  } = {}) {
    const pending = this.get(actionId);
    const connection = getConnection?.();
    if (!pending || !connection?.open) {
      this.fail(actionId, unavailableReason, onFailure);
      return false;
    }
    try {
      pending.attempts = (pending.attempts || 0) + 1;
      connection.send(pending.message);
      this.clearPendingTimer(pending);
      pending.timeoutId = this.setTimer(() => {
        const active = this.get(actionId);
        if (!active) return;
        if ((active.attempts || 0) < this.maxAttempts && getConnection?.()?.open) {
          this.send(actionId, { getConnection, onFailure, unavailableReason, timeoutReason });
          return;
        }
        this.fail(actionId, timeoutReason, onFailure);
      }, this.timeoutMs);
      return true;
    } catch {
      this.fail(actionId, unavailableReason, onFailure);
      return false;
    }
  }

  clearAll(value = false) {
    for (const pending of this.values()) {
      this.clearPendingTimer(pending);
      pending.resolve?.(value);
    }
    super.clear();
  }
}

export function createPendingActionStore(options) {
  return new PendingActionStore(options);
}
