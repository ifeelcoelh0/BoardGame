import test from "node:test";
import assert from "node:assert/strict";
import { transientActionFeedbackEntry } from "../src/ui/game/gameActionFeedback.js";

test("bank-style trade entries with resource movement receive transient feedback", () => {
  const entry = { id: 1, kind: "trade", resources: [{ resource: "madeira", amount: -4 }, { resource: "ouro", amount: 1 }] };
  assert.equal(transientActionFeedbackEntry(entry), entry);
});

test("ordinary chronicle entries do not become transient action feedback", () => {
  assert.equal(transientActionFeedbackEntry({ id: 2, kind: "realm" }), null);
  assert.equal(transientActionFeedbackEntry({ id: 3, kind: "trade" }), null);
});
