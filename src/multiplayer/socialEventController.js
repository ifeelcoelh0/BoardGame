import { createStableId } from "../game/playerIdentity.js";

const MAX_CHAT_LENGTH = 200;
const MAX_NAME_LENGTH = 60;

function safeId(value) {
  return typeof value === "string" && value.length <= 120 ? value : null;
}

export function createHostSocialController({
  getGame,
  authenticatedIndexForConnection,
  characterName = () => null,
  relay = () => {},
  emit = () => {},
} = {}) {
  const authenticate = (connection) => {
    const index = authenticatedIndexForConnection(connection);
    const player = getGame()?.players?.[index];
    return index >= 0 && player ? { index, player } : null;
  };

  const onEmote = ({ connection, message }) => {
    const auth = authenticate(connection);
    if (!auth || typeof message?.k !== "string" || !safeId(message.id)) return false;
    const safeMessage = { t: "emote", i: auth.index, k: message.k, id: message.id };
    emit({ type: "EMOTE_RECEIVED", message: safeMessage });
    relay(safeMessage, connection);
    return true;
  };

  const onChat = ({ connection, message }) => {
    const auth = authenticate(connection);
    const text = typeof message?.tx === "string" ? message.tx.trim().slice(0, MAX_CHAT_LENGTH) : "";
    if (!auth || !text || !safeId(message.id)) return false;
    const name = characterName(auth.player.ch);
    const safeMessage = {
      t: "chat",
      playerId: auth.player.playerId,
      ch: auth.player.ch ?? null,
      name: typeof name === "string" ? name.slice(0, MAX_NAME_LENGTH) : null,
      i: auth.index,
      tx: text,
      id: message.id,
    };
    emit({ type: "CHAT_RECEIVED", message: safeMessage });
    relay(safeMessage, connection);
    return true;
  };

  return { onEmote, onChat };
}

export function createClientSocialController({
  getGame,
  getPlayerId = () => null,
  findPlayerIndex,
  now = () => Date.now(),
  createId = () => createStableId("social"),
  send = () => false,
  emit = () => {},
  chatCooldownMs = 800,
  emoteCooldownMs = 2000,
  maxSeen = 500,
} = {}) {
  const seen = new Map();
  let lastChatAt = 0;
  let lastEmoteAt = 0;

  const remember = (id) => {
    if (!safeId(id) || seen.has(id)) return false;
    seen.set(id, now());
    while (seen.size > maxSeen) seen.delete(seen.keys().next().value);
    return true;
  };

  const receiveChat = (message) => {
    if (!message || typeof message.tx !== "string" || !remember(message.id)) return false;
    const game = getGame();
    const index = message.playerId ? findPlayerIndex(game, message.playerId) : Number.isInteger(message.i) ? message.i : -1;
    emit({
      type: "CHAT_RECEIVED",
      message: {
        playerId: message.playerId || game?.players?.[index]?.playerId || null,
        ch: message.ch || game?.players?.[index]?.ch || null,
        name: typeof message.name === "string" ? message.name.slice(0, MAX_NAME_LENGTH) : null,
        i: index,
        tx: message.tx.slice(0, MAX_CHAT_LENGTH),
        id: message.id,
      },
      isOwn: Boolean(message.playerId && message.playerId === getPlayerId()),
    });
    return true;
  };

  const receiveEmote = (message) => {
    if (!message || typeof message.k !== "string" || !remember(message.id)) return false;
    emit({ type: "EMOTE_RECEIVED", message: { i: message.i, k: message.k, id: message.id } });
    return true;
  };

  const sendChat = (text, identity = {}) => {
    const tx = String(text || "").trim().slice(0, MAX_CHAT_LENGTH);
    const at = now();
    if (!tx) return { ok: false, reason: "EMPTY" };
    if (at - lastChatAt < chatCooldownMs) return { ok: false, reason: "RATE_LIMIT" };
    lastChatAt = at;
    const message = { t: "chat", tx, id: createId(), ...identity };
    receiveChat(message);
    send(message);
    return { ok: true, message };
  };

  const sendEmote = (key, identity = {}) => {
    const at = now();
    if (typeof key !== "string" || !key) return { ok: false, reason: "INVALID_EMOTE" };
    if (at - lastEmoteAt < emoteCooldownMs) return { ok: false, reason: "RATE_LIMIT" };
    lastEmoteAt = at;
    const message = { t: "emote", k: key, id: createId(), ...identity };
    receiveEmote(message);
    send(message);
    return { ok: true, message };
  };

  const clear = () => {
    seen.clear();
    lastChatAt = 0;
    lastEmoteAt = 0;
  };

  return { receiveChat, receiveEmote, sendChat, sendEmote, clear, seenCount: () => seen.size };
}
