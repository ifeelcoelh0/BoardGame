export const GAME_PROTOCOL_VERSION = 7;

export const GAME_ACTION = Object.freeze({
  ROLL_DICE: "ROLL_DICE",
  BUILD_ROAD: "BUILD_ROAD",
  BUILD_VILLAGE: "BUILD_VILLAGE",
  BUILD_PALACE: "BUILD_PALACE",
  PLACE_DRAGON: "PLACE_DRAGON",
  STEAL_RESOURCE: "STEAL_RESOURCE",
  BUY_DEV_CARD: "BUY_DEV_CARD",
  BANK_TRADE: "BANK_TRADE",
  END_TURN: "END_TURN",
  RESOLVE_DISCARD: "RESOLVE_DISCARD",
  RESOLVE_TSUNAMI: "RESOLVE_TSUNAMI",
  RESOLVE_QUEUE_RESOURCE: "RESOLVE_QUEUE_RESOURCE",
  RECRUIT_TROOP: "RECRUIT_TROOP",
  DEPLOY_UNIT: "DEPLOY_UNIT",
  UNIT_ACTION: "UNIT_ACTION",
  BRIBE_UNIT: "BRIBE_UNIT",
  BUILD_WAGON: "BUILD_WAGON",
  MOVE_WAGON: "MOVE_WAGON",
  LOAD_COLONISTS: "LOAD_COLONISTS",
  FOUND_REMOTE_VILLAGE: "FOUND_REMOTE_VILLAGE",
  PLAY_DEV_CARD: "PLAY_DEV_CARD",
  PROPOSE_TRADE: "PROPOSE_TRADE",
  ACCEPT_TRADE: "ACCEPT_TRADE",
  DECLINE_TRADE: "DECLINE_TRADE",
  CANCEL_TRADE: "CANCEL_TRADE",
  REMATCH_READY: "REMATCH_READY",
});

const ACTION_ID_PATTERN = /^game_[a-f0-9]{24}$/;

export function validateGameActionEnvelope(message) {
  if (!message || typeof message !== "object" || message.t !== "game-action")
    return { ok: false, reason: "INVALID_REQUEST" };
  try {
    if (JSON.stringify(message).length > 4096)
      return { ok: false, reason: "REQUEST_TOO_LARGE" };
  } catch {
    return { ok: false, reason: "INVALID_REQUEST" };
  }
  if (message.gameProtocolVersion !== GAME_PROTOCOL_VERSION)
    return { ok: false, reason: "PROTOCOL_MISMATCH" };
  if (!ACTION_ID_PATTERN.test(message.actionId || ""))
    return { ok: false, reason: "INVALID_ACTION_ID" };
  if (!Number.isSafeInteger(message.expectedRevision) || message.expectedRevision < 0)
    return { ok: false, reason: "INVALID_REVISION" };
  if (!message.action || typeof message.action !== "object")
    return { ok: false, reason: "INVALID_ACTION" };
  if (!Object.values(GAME_ACTION).includes(message.action.type))
    return { ok: false, reason: "UNKNOWN_ACTION" };
  return { ok: true, reason: null };
}
