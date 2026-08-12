export const GAME_PRESENTATION_VERSION = 1;
export const GAME_LOG_LIMIT = 70;
export const GAME_LOG_KINDS = Object.freeze(["realm", "event", "war", "trade", "exploration"]);
export const GAME_LOG_EMPHASIS = Object.freeze(["ambient", "important", "ceremonial"]);

function normalizeLogKind(value) {
  return GAME_LOG_KINDS.includes(value) ? value : "realm";
}

function normalizeLogEmphasis(value) {
  return GAME_LOG_EMPHASIS.includes(value) ? value : "ambient";
}

function normalizeLogResources(value) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return [];
    const resource = typeof entry.resource === "string" ? entry.resource : "";
    const amount = Number.isSafeInteger(entry.amount) ? entry.amount : 0;
    if (!resource || amount === 0) return [];
    return [{ resource, amount }];
  });
}

function normalizeLogEntry(entry) {
  const source = entry && typeof entry === "object" && !Array.isArray(entry) ? entry : {};
  const resources = normalizeLogResources(source.resources);
  return {
    id: source.id ?? createPresentationEventId(),
    msg: String(source.msg ?? ""),
    pi: Number.isSafeInteger(source.pi) ? source.pi : null,
    kind: normalizeLogKind(source.kind),
    emphasis: normalizeLogEmphasis(source.emphasis),
    ...(typeof source.icon === "string" && source.icon ? { icon: source.icon } : {}),
    ...(resources.length ? { resources } : {}),
    ...(source.audio && typeof source.audio === "object" && !Array.isArray(source.audio) ? { audio: clone(source.audio) } : {}),
  };
}

function clone(value) {
  if (value == null) return value;
  if (typeof structuredClone === "function") return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

export function createInitialGamePresentationState() {
  return {
    version: GAME_PRESENTATION_VERSION,
    log: [],
    story: null,
    cardReveal: null,
    award: null,
    disaster: null,
  };
}

export function normalizeGamePresentationState(value = null, legacy = null) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const legacySource = legacy && typeof legacy === "object" && !Array.isArray(legacy) ? legacy : {};
  return {
    version: GAME_PRESENTATION_VERSION,
    log: Array.isArray(source.log)
      ? source.log.map(normalizeLogEntry).slice(0, GAME_LOG_LIMIT)
      : Array.isArray(legacySource.log)
        ? legacySource.log.map(normalizeLogEntry).slice(0, GAME_LOG_LIMIT)
        : [],
    story: clone(source.story ?? legacySource.ev ?? null),
    cardReveal: clone(source.cardReveal ?? legacySource.cardEv ?? null),
    award: clone(source.award ?? legacySource.awardEv ?? null),
    disaster: clone(source.disaster ?? legacySource.disaster ?? null),
  };
}

export function migrateLegacyGamePresentation(game) {
  if (!game || typeof game !== "object" || Array.isArray(game)) return game;
  game.presentation = normalizeGamePresentationState(game.presentation, game);
  delete game.log;
  delete game.ev;
  delete game.cardEv;
  delete game.awardEv;
  delete game.disaster;
  return game;
}

export function gamePresentation(game) {
  if (!game || typeof game !== "object" || Array.isArray(game)) {
    throw new TypeError("Estado de jogo inválido para apresentação.");
  }
  if (!game.presentation || game.presentation.version !== GAME_PRESENTATION_VERSION) {
    migrateLegacyGamePresentation(game);
  }
  return game.presentation;
}

export function createPresentationEventId({ now = Date.now, random = Math.random } = {}) {
  return Number(now()) + Number(random());
}

export function appendGameLog(game, message, playerIndex = null, options = {}) {
  const presentation = gamePresentation(game);
  const resources = normalizeLogResources(options.resources);
  const entry = {
    id: options.id ?? createPresentationEventId(options),
    msg: String(message ?? ""),
    pi: Number.isSafeInteger(playerIndex) ? playerIndex : null,
    kind: normalizeLogKind(options.kind),
    emphasis: normalizeLogEmphasis(options.emphasis),
    ...(typeof options.icon === "string" && options.icon ? { icon: options.icon } : {}),
    ...(resources.length ? { resources } : {}),
    ...(options.audio && typeof options.audio === "object" && !Array.isArray(options.audio) ? { audio: clone(options.audio) } : {}),
  };
  presentation.log.unshift(entry);
  if (presentation.log.length > GAME_LOG_LIMIT) presentation.log.length = GAME_LOG_LIMIT;
  return entry;
}

export function setGameStory(game, story, options = {}) {
  const presentation = gamePresentation(game);
  if (story == null) {
    presentation.story = null;
    return null;
  }
  const next = clone(story);
  next.id = next.id ?? options.id ?? createPresentationEventId(options);
  presentation.story = next;
  return presentation.story;
}

export function setGameCardReveal(game, cardReveal, options = {}) {
  const presentation = gamePresentation(game);
  if (cardReveal == null) {
    presentation.cardReveal = null;
    return null;
  }
  const next = clone(cardReveal);
  next.id = next.id ?? options.id ?? createPresentationEventId(options);
  presentation.cardReveal = next;
  return presentation.cardReveal;
}

export function setGameAward(game, award, options = {}) {
  const presentation = gamePresentation(game);
  if (award == null) {
    presentation.award = null;
    return null;
  }
  const next = clone(award);
  next.id = next.id ?? options.id ?? createPresentationEventId(options);
  presentation.award = next;
  return presentation.award;
}

export function setGameDisaster(game, disaster, options = {}) {
  const presentation = gamePresentation(game);
  if (disaster == null) {
    presentation.disaster = null;
    return null;
  }
  const next = clone(disaster);
  next.id = next.id ?? options.id ?? createPresentationEventId(options);
  presentation.disaster = next;
  return presentation.disaster;
}
