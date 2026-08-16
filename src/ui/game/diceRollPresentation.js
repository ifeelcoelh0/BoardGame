const DIE_GLYPHS = Object.freeze(["", "⚀", "⚁", "⚂", "⚃", "⚄", "⚅"]);

export function diceRollPresentationKey(game) {
  const dice = game?.turn?.dice;
  if (game?.phase !== "play" || game?.turn?.rolled !== true) return null;
  if (!Array.isArray(dice) || dice.length !== 2) return null;
  if (!dice.every((value) => Number.isInteger(value) && value >= 1 && value <= 6)) return null;
  const round = Number.isSafeInteger(game?.round) ? game.round : 0;
  const position = Number.isSafeInteger(game?.turn?.pos) ? game.turn.pos : 0;
  return `${round}:${position}:${dice[0]}-${dice[1]}`;
}

export function diceGlyph(value) {
  return DIE_GLYPHS[value] || "?";
}
