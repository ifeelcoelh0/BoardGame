import { isWarMode } from "../../game/gameModes.js";
import { militaryActionsLeft, validDeployHexes } from "../../game/warReducer.js";
import { t } from "../../locales/i18n.js";

export function isSeatCurrentPlayer(game, seat) {
  if (!game || !Number.isSafeInteger(seat)) return false;
  if (game.phase === "setup") return game.setup?.seq?.[game.setup?.i] === seat;
  if (game.phase !== "play") return false;
  return game.order?.[game.turn?.pos] === seat;
}

export function playTurnBlockReason(game, seat, {
  myTurn = null,
  requireRolled = true,
  allowDragon = false,
  allowDeploy = false,
  allowTrade = false,
  allowDecision = false,
} = {}) {
  if (game?.phase !== "play") return t("guard.notPlay");
  const current = myTurn == null
    ? isSeatCurrentPlayer(game, seat) && game.players?.[seat]?.connected !== false
    : !!myTurn;
  if (!current) return t("guard.waitTurn");
  if (game?.winner != null) return t("guard.ended");
  if (!allowDecision && (game?.queue?.[0] || game?.turn?.steal)) return t("guard.resolveDecision");
  if (!allowDeploy && game?.turn?.deploy) return t("guard.deployFirst");
  if (!allowTrade && game?.trade) return t("guard.finishTrade");
  if (requireRolled && !game?.turn?.rolled) return t("guard.rollFirst");
  if (!allowDragon && game?.turn?.mustDragon) return t("guard.moveDragonFirst");
  return null;
}

export function rollTurnBlockReason(game, seat, { myTurn = null } = {}) {
  if (game?.phase !== "play") return t("guard.notPlay");
  const current = myTurn == null
    ? isSeatCurrentPlayer(game, seat) && game.players?.[seat]?.connected !== false
    : !!myTurn;
  if (!current) return t("guard.waitTurn");
  if (game?.winner != null) return t("guard.ended");
  if (game?.turn?.rolled) return t("guard.alreadyRolled");
  if (game?.queue?.[0] || game?.turn?.steal || game?.turn?.deploy) return t("guard.resolveDecision");
  if (game?.trade) return t("guard.finishTrade");
  return null;
}

export function developmentCardPlayReason(game, graph, seat, card, {
  isNew = false,
  isLibrary = false,
  myTurn = null,
} = {}) {
  if (!card || typeof card !== "object") return t("guard.invalidCard");
  if (isLibrary) return t("guard.libraryOnly");
  if (isNew) return t("guard.newCard");
  if (card.kind === "vp") return t("guard.secretVp");

  const common = playTurnBlockReason(game, seat, { myTurn });
  if (common) return common;

  const player = game.players?.[seat];
  if (!player?.devOld?.some((candidate) => candidate?.id === card.id && candidate?.kind === card.kind)) {
    return t("guard.cardGone");
  }
  if (card.kind === "tropa" && (player.sick || 0) > 0) {
    return t("guard.plague", { turns: player.sick });
  }

  if (!isWarMode(game.mode)) {
    if (game.turn?.devPlayed) return t("guard.devPlayed");
    return null;
  }

  if (card.kind === "tropa") {
    if (game.turn?.troopPlayed) return t("guard.troopPlayed");
    if (militaryActionsLeft(game) <= 0) return t("action.militarySpent");
    if (!validDeployHexes(game, graph, seat, card.sub).length) return t("guard.noDeploySpace");
  }
  return null;
}

export function boardInteractionBlockReason(game, seat, { myTurn = null } = {}) {
  if (game?.phase === "setup") {
    const current = myTurn == null ? isSeatCurrentPlayer(game, seat) : !!myTurn;
    return current ? null : t("guard.waitFounding");
  }
  if (game?.phase !== "play") return t("guard.boardPhase");
  const current = myTurn == null
    ? isSeatCurrentPlayer(game, seat) && game.players?.[seat]?.connected !== false
    : !!myTurn;
  if (!current) return t("guard.waitTurn");
  if (game?.winner != null) return t("guard.ended");
  if (game?.queue?.[0] || game?.turn?.steal) return t("guard.resolveDecision");
  if (game?.trade) return t("guard.finishTrade");
  if (!game?.turn?.rolled) return t("guard.rollFirst");
  return null;
}
