export function remapPixelPalette(palette, replacements) {
  if (!palette || typeof palette !== "object" || Array.isArray(palette)) {
    throw new TypeError("A paleta pixel tem de ser um objeto.");
  }
  if (!replacements || typeof replacements !== "object" || Array.isArray(replacements)) {
    throw new TypeError("O mapa de substituição da paleta tem de ser um objeto.");
  }
  return Object.freeze(Object.fromEntries(
    Object.entries(palette).map(([token, color]) => [token, replacements[color] ?? color]),
  ));
}
