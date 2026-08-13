import { useEffect, useMemo, useState } from "react";
import { gameTurnReconnectSeconds } from "../../game/playerPresence.js";
import { makeBoardGraph } from "../../game/boardGeometry.js";
import { stableBoardGeometryKey } from "../board/boardUpdateSignature.js";

import { currentGameActorIndex } from "./gameScreenRuntimeModel.js";

export default function useGameScreenRuntime(game, seat) {
  const boardGeometryKey = stableBoardGeometryKey(game.board);
  const graph = useMemo(() => makeBoardGraph(game.board.hexes), [boardGeometryKey]);
  const currentActor = currentGameActorIndex(game);
  const localPlayer = game.players[seat];
  const queueItem = game.queue[0] || null;
  const requiredActor = Number.isSafeInteger(queueItem?.p) ? queueItem.p : currentActor;
  const requiredPlayer = game.players[requiredActor] || null;
  const canHumanAct = localPlayer?.connected !== false;
  const myTurn = currentActor === seat && canHumanAct;

  const [presenceNow, setPresenceNow] = useState(() => Date.now());
  const presenceSignature = game.players.map((player) => [
    player.playerId,
    player.connected,
    player.turnReconnectDeadline,
    player.afkSkipCount,
  ].join(":")).join("|");
  useEffect(() => {
    const hasCountdown = game.players.some((player) => player.connected === false && Number.isFinite(player.turnReconnectDeadline));
    if (!hasCountdown) return undefined;
    setPresenceNow(Date.now());
    const timer = window.setInterval(() => setPresenceNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [presenceSignature]);

  const reconnectSecondsByPlayer = game.players.map((player) => gameTurnReconnectSeconds(player, presenceNow));

  return {
    graph,
    currentActor,
    localPlayer,
    queueItem,
    requiredActor,
    requiredPlayer,
    canHumanAct,
    myTurn,
    requiredReconnectSeconds: requiredPlayer ? reconnectSecondsByPlayer[requiredActor] : null,
    reconnectSecondsByPlayer,
  };
}
