export const STATE_VIEW_VERSION = 3;
export const HIDDEN_TERRAIN_TYPE = "oculto";

const RESOURCE_KEYS = ["madeira", "tijolo", "cavalos", "ouro", "obsidiana"];

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function resourceCount(player) {
  return RESOURCE_KEYS.reduce((total, resource) => total + Math.max(0, Number(player?.res?.[resource]) || 0), 0);
}

function hiddenCards(count) {
  return Array.from({ length: Math.max(0, count) }, (_, index) => ({
    id: `hidden_${index}`,
    kind: "hidden",
  }));
}

function redactPlayer(player, isViewer, revealAll) {
  const next = clone(player) || {};
  const devNew = Array.isArray(player?.devNew) ? player.devNew : [];
  const devOld = Array.isArray(player?.devOld) ? player.devOld : [];
  const developmentCardCount = devNew.length + devOld.length;

  // O hash autentica a ligação no host. Nunca é necessário no cliente.
  delete next.sessionTokenHash;
  next.resourceCount = resourceCount(player);
  next.developmentCardCount = developmentCardCount;

  if (!isViewer && !revealAll) {
    next.res = Object.fromEntries(RESOURCE_KEYS.map((resource) => [resource, 0]));
    next.devNew = [];
    next.devOld = hiddenCards(developmentCardCount);
  }

  return next;
}

function redactBoard(board, revealAll) {
  const next = clone(board) || {};
  if (revealAll)
    return next;

  if (Array.isArray(next.hexes)) {
    next.hexes = next.hexes.map((hex) => {
      if (!hex?.hid)
        return hex;
      // Mantém a topologia e o nevoeiro, mas não envia terreno nem número reais.
      return {
        k: hex.k,
        terr: HIDDEN_TERRAIN_TYPE,
        num: null,
        hid: true,
      };
    });
  }

  if (Array.isArray(next.ports)) {
    next.ports = next.ports.map((port) => port?.hid
      ? { ...port, type: "any" }
      : port);
  }

  return next;
}

export function createGameStateView(game, viewerPlayerId = null) {
  if (!game || typeof game !== "object")
    return game;

  // The authoritative action journal can contain full private payloads, RNG
  // traces and the initial unredacted state. It is host-only, even after the
  // match ends; do not even clone it while producing client/bot views.
  const source = game.actionJournal
    ? Object.fromEntries(Object.entries(game).filter(([key]) => key !== "actionJournal"))
    : game;
  const view = clone(source);
  const revealAll = view.phase === "ended";
  view.stateViewVersion = STATE_VIEW_VERSION;
  view.viewerPlayerId = typeof viewerPlayerId === "string" ? viewerPlayerId : null;
  view.deckCount = Array.isArray(game.deck) ? game.deck.length : 0;
  view.deck = revealAll ? clone(game.deck || []) : hiddenCards(view.deckCount);
  view.players = (game.players || []).map((player) => redactPlayer(
    player,
    player?.playerId === viewerPlayerId,
    revealAll,
  ));
  view.board = redactBoard(game.board, revealAll);

  if (!revealAll && view.troll?.lair) {
    const lairHex = game.board?.hexes?.find((hex) => hex.k === view.troll.lair);
    if (lairHex?.hid)
      view.troll.lair = null;
  }

  return view;
}

export function createPublicGameStateView(game) {
  return createGameStateView(game, null);
}
