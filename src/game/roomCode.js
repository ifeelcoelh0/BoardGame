export const ROOM_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ";
export const ROOM_CODE_LENGTH = 6;
export const LEGACY_ROOM_CODE_LENGTH = 4;

export function normalizeRoomCode(value) {
  return String(value || "").trim().toUpperCase();
}

function hasValidAlphabet(code) {
  return [...code].every((character) => ROOM_CODE_ALPHABET.includes(character));
}

/*
 * Quatro letras é aceite apenas como formato de compatibilidade para reinos
 * criados antes da migração. Novos reinos são sempre gerados com seis letras.
 */
export function isValidRoomCode(value, { allowLegacy = true } = {}) {
  const code = normalizeRoomCode(value);
  const validLength = code.length === ROOM_CODE_LENGTH
    || (allowLegacy && code.length === LEGACY_ROOM_CODE_LENGTH);
  return validLength && hasValidAlphabet(code);
}

export function isCurrentRoomCode(value) {
  return isValidRoomCode(value, { allowLegacy: false });
}

function secureRandomAlphabetIndex(cryptoApi = globalThis.crypto) {
  if (!cryptoApi?.getRandomValues) {
    throw new Error("Web Crypto é necessário para gerar códigos de reino seguros.");
  }

  const range = ROOM_CODE_ALPHABET.length;
  const uint32Range = 0x100000000;
  const unbiasedLimit = Math.floor(uint32Range / range) * range;
  const values = new Uint32Array(1);
  do {
    cryptoApi.getRandomValues(values);
  } while (values[0] >= unbiasedLimit);
  return values[0] % range;
}

export function generateRoomCode({ rng } = {}) {
  if (rng != null && typeof rng !== "function") throw new TypeError("rng tem de ser uma função.");
  return Array.from({ length: ROOM_CODE_LENGTH }, () => {
    if (!rng) return ROOM_CODE_ALPHABET[secureRandomAlphabetIndex()];
    const sample = rng();
    if (!Number.isFinite(sample) || sample < 0 || sample >= 1) {
      throw new RangeError("rng tem de devolver valores entre 0 (inclusive) e 1 (exclusive).");
    }
    return ROOM_CODE_ALPHABET[Math.floor(sample * ROOM_CODE_ALPHABET.length)];
  }).join("");
}
