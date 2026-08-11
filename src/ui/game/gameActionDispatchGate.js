/**
 * Serializa ações de jogo iniciadas pela UI.
 *
 * O protocolo já rejeita revisões stale, mas permitir duas mutações distintas
 * em voo ao mesmo tempo cria rejeições evitáveis e pode limpar estado local no
 * momento errado. Este gate mantém no máximo uma ação autoritativa pendente.
 */
export function createGameActionDispatchGate(dispatchGameAction) {
  if (typeof dispatchGameAction !== "function") throw new TypeError("Dispatcher de jogo inválido.");
  let inFlight = null;

  const dispatch = async (type, payload = {}) => {
    if (inFlight) return false;
    const work = Promise.resolve().then(() => dispatchGameAction(type, payload));
    inFlight = work;
    try {
      return await work;
    } finally {
      if (inFlight === work) inFlight = null;
    }
  };

  return Object.freeze({
    dispatch,
    isPending: () => inFlight != null,
  });
}
