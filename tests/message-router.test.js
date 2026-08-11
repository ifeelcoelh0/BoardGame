import test from "node:test";
import assert from "node:assert/strict";
import {
  createTypedMessageRouter,
  isMessageEnvelope,
} from "../src/multiplayer/messageRouter.js";
import {
  HOST_MESSAGE_ROUTES,
  HOST_MESSAGE_TYPES,
  createHostMessageController,
} from "../src/multiplayer/hostMessageController.js";
import {
  CLIENT_MESSAGE_ROUTES,
  CLIENT_MESSAGE_TYPES,
  createClientMessageController,
} from "../src/multiplayer/clientMessageController.js";

test("message envelope accepts only object messages with a non-empty type", () => {
  assert.equal(isMessageEnvelope({ t: "state" }), true);
  assert.equal(isMessageEnvelope({ t: "" }), false);
  assert.equal(isMessageEnvelope([]), false);
  assert.equal(isMessageEnvelope(null), false);
});

test("typed router reports invalid and unknown messages without invoking handlers", async () => {
  const invalid = [];
  const unknown = [];
  const router = createTypedMessageRouter({ state: "onState" }, {
    onState() { throw new Error("should not run"); },
  }, {
    onInvalidMessage(context) { invalid.push(context.message); },
    onUnknownMessage(context) { unknown.push(context.message.t); },
  });

  assert.deepEqual(await router({ message: null }), { handled: false, reason: "INVALID_MESSAGE" });
  assert.deepEqual(await router({ message: { t: "chat" } }), { handled: false, reason: "UNKNOWN_MESSAGE", type: "chat" });
  assert.deepEqual(invalid, [null]);
  assert.deepEqual(unknown, ["chat"]);
});

test("host controller routes every published host message type exactly once", async () => {
  const calls = [];
  const handlers = Object.fromEntries(
    Object.values(HOST_MESSAGE_ROUTES).map((handlerName) => [handlerName, ({ message }) => calls.push(message.t)])
  );
  const controller = createHostMessageController(handlers);

  for (const type of HOST_MESSAGE_TYPES) {
    const result = await controller({ message: { t: type }, connection: { id: type } });
    assert.equal(result.handled, true);
    assert.equal(result.type, type);
  }
  assert.deepEqual(calls, HOST_MESSAGE_TYPES);
});

test("client controller routes every published client message type exactly once", async () => {
  const calls = [];
  const handlers = Object.fromEntries(
    Object.values(CLIENT_MESSAGE_ROUTES).map((handlerName) => [handlerName, ({ message }) => calls.push(message.t)])
  );
  const controller = createClientMessageController(handlers);

  for (const type of CLIENT_MESSAGE_TYPES) {
    const result = await controller({ message: { t: type } });
    assert.equal(result.handled, true);
    assert.equal(result.type, type);
  }
  assert.deepEqual(calls, CLIENT_MESSAGE_TYPES);
});

test("handler errors are isolated by the controller error callback", async () => {
  const errors = [];
  const controller = createClientMessageController({
    onState() { throw new Error("broken state"); },
  }, {
    onHandlerError(error, context) { errors.push([error.message, context.message.t]); },
  });
  const result = await controller({ message: { t: "state" } });
  assert.equal(result.handled, true);
  assert.equal(result.error.message, "broken state");
  assert.deepEqual(errors, [["broken state", "state"]]);
});
