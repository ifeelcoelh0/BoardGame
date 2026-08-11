export function randomUnit(rng = Math.random) {
  if (typeof rng !== "function") throw new TypeError("O RNG tem de ser uma função.");
  const value = rng();
  if (!Number.isFinite(value) || value < 0 || value >= 1) {
    throw new RangeError("O RNG deve devolver um número entre 0 (inclusive) e 1 (exclusive).");
  }
  return value;
}

export function randomIndex(length, rng = Math.random) {
  if (!Number.isSafeInteger(length) || length <= 0) {
    throw new RangeError("Não existem opções aleatórias disponíveis.");
  }
  return Math.floor(randomUnit(rng) * length);
}

export function pickRandom(values, rng = Math.random) {
  if (!Array.isArray(values) || values.length === 0) {
    throw new RangeError("Não existem opções aleatórias disponíveis.");
  }
  return values[randomIndex(values.length, rng)];
}

export function shuffleWithRng(values, rng = Math.random) {
  if (!Array.isArray(values)) throw new TypeError("Só é possível baralhar arrays.");
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const other = randomIndex(index + 1, rng);
    [result[index], result[other]] = [result[other], result[index]];
  }
  return result;
}
