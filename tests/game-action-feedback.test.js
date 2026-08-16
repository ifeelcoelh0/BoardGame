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


test("transient trade feedback prefers presentation-specific English copy", () => {
  const entry = {
    id: 4,
    kind: "trade",
    msg: "Vlad trocou recursos no banco.",
    feedbackText: "Vlad traded 4 Wood for 1 Obsidian at the bank.",
    resources: [{ resource: "madeira", amount: -4 }, { resource: "obsidiana", amount: 1 }],
  };
  const feedback = transientActionFeedbackEntry(entry);
  assert.equal(feedback.feedbackText, "Vlad traded 4 Wood for 1 Obsidian at the bank.");
});
