import { t } from "../../locales/i18n.js";
import { localizeLegacyGameText } from "../../locales/legacyGameText.js";
const RESOURCE_GLYPHS = Object.freeze([
  ["🪵", "madeira"],
  ["🧱", "tijolo"],
  ["🐎", "cavalos"],
  ["🪙", "ouro"],
  ["⚫", "obsidiana"],
]);

/**
 * Transitional boundary for legacy prose that still contains pictographs.
 * Product UI renders canonical icons separately; text remains semantic and
 * readable instead of leaking platform-dependent emoji glyphs.
 */
export function cleanGameUiText(value) {
  let text = String(value ?? "");
  for (const [glyph, resource] of RESOURCE_GLYPHS) text = text.split(glyph).join(` ${t(`resources.${resource}`)}`);
  text = text
    .replace(/\p{Extended_Pictographic}(?:\uFE0F|\u200D\p{Extended_Pictographic})*/gu, "")
    .replace(/[⚜⚖✋]/gu, "")
    .replace(/\s+([,.;:!?])/g, "$1")
    .replace(/\s{2,}/g, " ")
    .trim();
  return localizeLegacyGameText(text);
}
