export const DEFAULT_AUDIO_BUFFER_CACHE_BYTES = 32 * 1024 * 1024;

export function estimateAudioBufferBytes(buffer) {
  if (!buffer) return 0;
  const channels = Number(buffer.numberOfChannels) || 0;
  const length = Number(buffer.length) || 0;
  if (channels > 0 && length > 0) return channels * length * Float32Array.BYTES_PER_ELEMENT;

  const duration = Number(buffer.duration) || 0;
  const sampleRate = Number(buffer.sampleRate) || 0;
  if (channels > 0 && duration > 0 && sampleRate > 0) {
    return Math.ceil(channels * duration * sampleRate * Float32Array.BYTES_PER_ELEMENT);
  }
  return 0;
}

/*
 * LRU de AudioBuffer com deduplicação de carregamentos em curso.
 *
 * A chave é o URI do asset, não o nome lógico do efeito. Assim dois aliases que
 * apontem para o mesmo ficheiro nunca o descarregam/descodificam duas vezes.
 * Remover um AudioBuffer da cache é seguro para fontes já em reprodução: cada
 * AudioBufferSourceNode mantém a sua própria referência ao buffer.
 */
export class AudioBufferCache {
  constructor({ maxBytes = DEFAULT_AUDIO_BUFFER_CACHE_BYTES, sizeOf = estimateAudioBufferBytes } = {}) {
    if (!Number.isFinite(maxBytes) || maxBytes <= 0) throw new TypeError("maxBytes tem de ser positivo.");
    if (typeof sizeOf !== "function") throw new TypeError("sizeOf tem de ser uma função.");
    this.maxBytes = Math.floor(maxBytes);
    this.sizeOf = sizeOf;
    this.entries = new Map();
    this.inFlight = new Map();
    this.totalBytes = 0;
    this.generation = 0;
  }

  get size() {
    return this.entries.size;
  }

  get pending() {
    return this.inFlight.size;
  }

  has(key) {
    return this.entries.has(key);
  }

  isLoading(key) {
    return this.inFlight.has(key);
  }

  get(key) {
    const entry = this.entries.get(key);
    if (!entry) return null;
    this.entries.delete(key);
    this.entries.set(key, entry);
    return entry.buffer;
  }

  set(key, buffer) {
    const bytes = Math.max(0, Math.floor(this.sizeOf(buffer) || 0));
    const previous = this.entries.get(key);
    if (previous) {
      this.totalBytes -= previous.bytes;
      this.entries.delete(key);
    }

    /* Um único buffer maior que o orçamento pode ser reproduzido, mas não deve
       expulsar a cache inteira para ficar retido. A música longa não chega aqui
       porque é sempre servida por streaming. */
    if (bytes > this.maxBytes) return buffer;

    this.entries.set(key, { buffer, bytes });
    this.totalBytes += bytes;
    this.evictToBudget();
    return buffer;
  }

  evictToBudget() {
    while (this.totalBytes > this.maxBytes && this.entries.size > 0) {
      const oldestKey = this.entries.keys().next().value;
      const oldest = this.entries.get(oldestKey);
      this.entries.delete(oldestKey);
      this.totalBytes -= oldest.bytes;
    }
  }

  async getOrLoad(key, loader) {
    const cached = this.get(key);
    if (cached) return cached;

    const pending = this.inFlight.get(key);
    if (pending) return pending;
    if (typeof loader !== "function") throw new TypeError("loader tem de ser uma função.");

    const generation = this.generation;
    const promise = Promise.resolve()
      .then(loader)
      .then((buffer) => (this.generation === generation ? this.set(key, buffer) : buffer))
      .finally(() => {
        if (this.inFlight.get(key) === promise) this.inFlight.delete(key);
      });

    this.inFlight.set(key, promise);
    return promise;
  }

  clear() {
    this.entries.clear();
    this.inFlight.clear();
    this.totalBytes = 0;
    this.generation += 1;
  }

  snapshot() {
    return Object.freeze({
      entries: this.entries.size,
      pending: this.inFlight.size,
      totalBytes: this.totalBytes,
      maxBytes: this.maxBytes,
    });
  }
}
