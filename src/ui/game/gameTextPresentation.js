const RESOURCE_GLYPHS = Object.freeze([
  ["🪵", " Madeira"],
  ["🧱", " Tijolo"],
  ["🐎", " Cavalos"],
  ["🪙", " Ouro"],
  ["⚫", " Obsidiana"],
]);

/**
 * Transitional boundary for legacy prose that still contains pictographs.
 * Product UI renders canonical icons separately; text remains semantic and
 * readable instead of leaking platform-dependent emoji glyphs.
 */
export function cleanGameUiText(value) {
  let text = String(value ?? "");
  for (const [glyph, label] of RESOURCE_GLYPHS) text = text.split(glyph).join(label);
  return text
    .replace(/\p{Extended_Pictographic}(?:\uFE0F|\u200D\p{Extended_Pictographic})*/gu, "")
    .replace(/[⚜⚖✋]/gu, "")
    .replace(/\s+([,.;:!?])/g, "$1")
    .replace(/\s{2,}/g, " ")
    .trim();
}
