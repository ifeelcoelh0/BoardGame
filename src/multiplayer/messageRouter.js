export const MESSAGE_ROUTER_VERSION = 1;

export function isMessageEnvelope(message) {
  return Boolean(
    message
    && typeof message === "object"
    && !Array.isArray(message)
    && typeof message.t === "string"
    && message.t.length > 0
  );
}

export function createTypedMessageRouter(routeTable, handlers = {}, {
  onInvalidMessage,
  onUnknownMessage,
  onHandlerError,
} = {}) {
  if (!routeTable || typeof routeTable !== "object") {
    throw new TypeError("Tabela de rotas multiplayer inválida.");
  }

  const routes = new Map(Object.entries(routeTable));

  return async function routeMessage(context = {}) {
    const message = context.message;
    if (!isMessageEnvelope(message)) {
      await onInvalidMessage?.(context);
      return { handled: false, reason: "INVALID_MESSAGE" };
    }

    const handlerName = routes.get(message.t);
    const handler = handlerName ? handlers[handlerName] : null;
    if (typeof handler !== "function") {
      await onUnknownMessage?.(context);
      return { handled: false, reason: "UNKNOWN_MESSAGE", type: message.t };
    }

    try {
      const value = await handler(context);
      return { handled: true, type: message.t, value };
    } catch (error) {
      if (typeof onHandlerError === "function") {
        await onHandlerError(error, context);
        return { handled: true, type: message.t, error };
      }
      throw error;
    }
  };
}
