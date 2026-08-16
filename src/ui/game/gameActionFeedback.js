/**
 * Only surface actions that are otherwise visually silent. Chronicle entries
 * remain the durable history; this selector decides which new entries deserve
 * a short on-board acknowledgement.
 */
export function transientActionFeedbackEntry(entry) {
  if (!entry || entry.kind !== "trade") return null;
  if (!Array.isArray(entry.resources) || entry.resources.length === 0) return null;
  return entry;
}
