import { useEffect, useRef, useState } from "react";
import { AudioSys } from "../audio/audioSystem.js";
import { freshLogEntries, latestCurrentAudioCue } from "../audio/audioPlaybackPolicy.js";
import { APP_BUILD_VERSION, APP_BUILD_COMPATIBILITY_VERSION } from "../appBuild.js";
import { normalizeDiagnosticError, recordDiagnostic } from "../diagnostics/diagnostics.js";
import { APP_STAGE, stageForAuthenticatedGame } from "../ui/appFlow.js";
import { GAME_ACTION, GAME_PROTOCOL_VERSION } from "../game/gameProtocol.js";
import { finalizeRematchIfReady } from "../game/rematch.js";
import { STATE_VIEW_VERSION } from "../game/gameStateView.js";
import { RESOURCE_KEYS as RKEYS } from "../game/resources.js";
import { advanceSetupState } from "../game/constructionReducer.js";
import { reduceTurnAdvance } from "../game/turnCycleReducer.js";
import { reduceMandatoryQueueSkip, requiredGameActorIndex } from "../game/mandatoryDecisionReducer.js";
import { reduceRoundLimitVictory } from "../game/scoringReducer.js";
import { makeBoardGraph as makeGraph } from "../game/boardGeometry.js";
import { createInitialGame, createPlayer } from "../game/gameFactory.js";
import { gameModeConfig } from "../game/gameModes.js";
import { createGamePresenter } from "../presentation/gamePresenter.js";
import { ROOM_CODE_LENGTH, generateRoomCode, isValidRoomCode, normalizeRoomCode } from "../game/roomCode.js";
import { clearGameSave, inspectGameSaves, loadGameFromStorage, saveGameToStorage } from "../game/saveStore.js";
import { LOBBY_ACTION, LOBBY_PROTOCOL_VERSION } from "../game/lobbyProtocol.js";
import {
  IDENTITY_PROTOCOL_VERSION, createSessionToken, createStableId, ensureGamePlayerIdentities,
  findPlayerIndexById, hashSessionToken, isSessionTokenHash
} from "../game/playerIdentity.js";
import {
  LOBBY_RECONNECT_GRACE_MS, beginGameTurnReconnectWindow, clearGameTurnReconnectWindow,
  ensurePlayerPresence, gameAfkGraceMs, isGameTurnReconnectExpired, isLobbyReservationExpired,
  markAfkActionSkipped, markPlayerConnected, markPlayerDisconnected
} from "../game/playerPresence.js";
import { forgetPlayerSession, loadPlayerSession, savePlayerSession } from "../multiplayer/sessionStore.js";
import { createMultiplayerRuntimeState, destroyMultiplayerRuntime, enqueueAuthorityTask as enqueueRuntimeAuthorityTask } from "../multiplayer/runtimeState.js";
import { createPendingActionStore } from "../multiplayer/pendingActionStore.js";
import { broadcastGameState } from "../multiplayer/stateTransport.js";
import { createBrowserClientPeerRuntime, createBrowserHostPeerRuntime } from "../multiplayer/browserPeerRuntime.js";
import { createHostMessageController } from "../multiplayer/hostMessageController.js";
import { createClientMessageController } from "../multiplayer/clientMessageController.js";
import { createHostSessionPresenceController } from "../multiplayer/hostSessionPresenceController.js";
import { createClientSessionPresenceController } from "../multiplayer/clientSessionPresenceController.js";
import { createHostActionController } from "../multiplayer/hostActionController.js";
import { scheduleHostBotAction } from "../multiplayer/hostBotController.js";
import { createClientActionController, lobbyActionErrorText } from "../multiplayer/clientActionController.js";
import { createStateSyncController } from "../multiplayer/stateSyncController.js";
import { createHostSocialController, createClientSocialController } from "../multiplayer/socialEventController.js";
import { reduceLobbyToSetup } from "../game/gameSetupReducer.js";
import { CHARACTERS as CHARS, characterById as charOf } from "../game/characterCatalog.js";
import { emoteById as emoteOf } from "../presentation/emoteCatalog.js";
import { PEER_PREFIX as PREFIX, resolvePeerConfig } from "../multiplayer/config.js";

const clone = (value) => JSON.parse(JSON.stringify(value));

const gamePresenter = createGamePresenter();
const { addLog, presentAppliedGameAction, presentScoringEvents, presentTradeEvent, presentTurnAdvance } = gamePresenter;

function saveLocal(game) { return saveGameToStorage(game).ok; }
const playerName = (game, index) => charOf(game.players[index].ch).n;
const currentActorIndex = (game) => game.phase === "setup" ? game.setup.seq[game.setup.i] : game.order[game.turn.pos];
function finishWarByRounds(game) {
    const resolved = reduceRoundLimitVictory(game);
    presentScoringEvents(resolved.game, [resolved.event]);
    return resolved.game;
}
function advanceTurn(game) {
    const reduced = reduceTurnAdvance(game, makeGraph(game.board.hexes), currentActorIndex(game));
    const next = reduced.game;
    presentTurnAdvance(next, reduced.event);
    if (reduced.event.roundLimitReached) return finishWarByRounds(next);
    addLog(next, "⏳ É a vez de " + playerName(next, reduced.event.playerIndex) + ".", reduced.event.playerIndex);
    return next;
}

export default function useRealmSession({ stage, navigate, book }) {
    const [code, setCode] = useState("");
    const [codeIn, setCodeIn] = useState("");
    const [seat, setSeat] = useState(null);
    const [game, setGame] = useState(null);
    const [err, setErr] = useState("");
    const [toast, setToast] = useState(null);
    const [connSt, setConnSt] = useState("off");
    const [emotes, setEmotes] = useState({});
    const [chat, setChat] = useState([]);
    const [testSel, setTestSel] = useState(false);
    const [savedRealms, setSavedRealms] = useState(() => inspectGameSaves());
    const gref = useRef(null);
    const myPlayerId = useRef(null);
    const mySeatId = useRef(null);
    const pendingIdentity = useRef(null);
    const pendingLobbyActions = useRef(createPendingActionStore());
    const pendingGameActions = useRef(createPendingActionStore());
    const lobbyPresenceTimers = useRef(new Map());
    const gamePresenceTimers = useRef(new Map());
    gref.current = game;
    const setLocalIdentity = (identity) => {
        myPlayerId.current = identity?.playerId || null;
        mySeatId.current = identity?.seatId || null;
    };
    const clearLocalIdentity = () => setLocalIdentity(null);
    const syncSeatFromGame = (nextGame) => {
        const idx = findPlayerIndexById(nextGame, myPlayerId.current);
        const identityMatches = idx >= 0 && (!mySeatId.current || nextGame.players[idx]?.seatId === mySeatId.current);
        const safeIndex = identityMatches ? idx : -1;
        setSeat(safeIndex >= 0 ? safeIndex : null);
        return safeIndex;
    };
    const stateSync = createStateSyncController({
        normalizeGame: (incoming) => ensureGamePlayerIdentities(clone(incoming)),
        getPlayerId: () => myPlayerId.current,
        getSeatId: () => mySeatId.current,
        findPlayerIndex: findPlayerIndexById,
        emit: (event) => {
            if (event.type !== "STATE_ADOPTED")
                return;
            setGame(event.game);
            gref.current = event.game;
            setSeat(event.seat);
        }
    });
    const seenLog = useRef(null);
    const dismissed = useRef( new Set());
    const net = useRef(createMultiplayerRuntimeState());
    const emoteTimers = useRef({});
    const showEmote = (i, k, id) => {
        if (i == null || !emoteOf(k))
            return;
        setEmotes((old) => ({ ...old, [i]: { k, id } }));
        const ech = gref.current && gref.current.players[i] ? gref.current.players[i].ch : null;
        AudioSys.play(ech ? "emv:" + ech + ":" + k : "card");
        if (emoteTimers.current[i])
            clearTimeout(emoteTimers.current[i]);
        emoteTimers.current[i] = setTimeout(() => {
            setEmotes((old) => {
                if (old[i] && old[i].id === id) {
                    const n = { ...old };
                    delete n[i];
                    return n;
                }
                return old;
            });
        }, 3500);
    };
    useEffect(() => () => {
        Object.values(emoteTimers.current).forEach((timer) => clearTimeout(timer));
        emoteTimers.current = {};
    }, []);
    useEffect(() => () => {
        destroyMultiplayerRuntime(net.current);
        pendingLobbyActions.current.clearAll(false);
        pendingGameActions.current.clearAll(false);
        for (const timer of lobbyPresenceTimers.current.values()) clearTimeout(timer);
        lobbyPresenceTimers.current.clear();
        for (const timer of gamePresenceTimers.current.values()) clearTimeout(timer);
        gamePresenceTimers.current.clear();
        socialController.current?.clear();
    }, []);
    const relayEmote = (m, from) => {
        net.current.conns.forEach((c) => {
            if (c !== from) {
                try {
                    c.send(m);
                }
                catch (e) {
                }
            }
        });
    };
    const socialController = useRef(null);
    if (!socialController.current) {
        socialController.current = createClientSocialController({
            getGame: () => gref.current,
            getPlayerId: () => myPlayerId.current,
            findPlayerIndex: findPlayerIndexById,
            send: (message) => {
                if (net.current.host)
                    relayEmote(message, null);
                else if (net.current.hostConn) {
                    try {
                        net.current.hostConn.send(message);
                    }
                    catch (e) {
                        return false;
                    }
                }
                return true;
            },
            emit: (event) => {
                if (event.type === "EMOTE_RECEIVED") {
                    const m = event.message;
                    showEmote(m.i, m.k, m.id);
                    return;
                }
                if (event.type === "CHAT_RECEIVED") {
                    const m = event.message;
                    if (!event.isOwn)
                        AudioSys.play("chatpop");
                    setChat((old) => [...old.slice(-49), m]);
                }
            }
        });
    }
    const sendChat = (tx) => {
        const localPlayer = gref.current?.players[seat];
        return socialController.current.sendChat(tx, {
            playerId: myPlayerId.current,
            ch: localPlayer?.ch || null,
            name: localPlayer ? charOf(localPlayer.ch).n : null,
            i: seat
        }).ok;
    };
    const sendEmote = (k) => socialController.current.sendEmote(k, { i: seat }).ok;
    const exitToTitle = () => {
        destroyMultiplayerRuntime(net.current);
        net.current = createMultiplayerRuntimeState();
        setConnSt("off");
        setGame(null);
        gref.current = null;
        setSeat(null);
        setErr("");
        setEmotes({});
        setChat([]);
        socialController.current?.clear();
        setCode("");
        setCodeIn("");
        pendingIdentity.current = null;
        pendingLobbyActions.current.clearAll(false);
        for (const timer of lobbyPresenceTimers.current.values())
            clearTimeout(timer);
        lobbyPresenceTimers.current.clear();
        for (const timer of gamePresenceTimers.current.values())
            clearTimeout(timer);
        gamePresenceTimers.current.clear();
        pendingGameActions.current.clearAll(false);
        clearLocalIdentity();
        book.resetHome();
        navigate(APP_STAGE.TITLE);
    };
    const leaveLobby = () => {
        const g = gref.current;
        if (g && g.phase === "lobby" && seat != null && seat > 0 && g.players[seat] && net.current.hostConn) {
            const requestId = createStableId("leave");
            pendingIdentity.current = { type: "leave-seat", requestId };
            setConnSt("leave");
            try {
                net.current.hostConn.send({
                    t: "leave-seat",
                    protocolVersion: IDENTITY_PROTOCOL_VERSION,
                    requestId
                });
            }
            catch (e) {
            }
            setTimeout(() => {
                if (pendingIdentity.current?.requestId === requestId)
                    exitToTitle();
            }, 2e3);
        }
        else
            exitToTitle();
    };
    const swapCharacter = async (chId) => {
        return await dispatchLobbyAction(LOBBY_ACTION.SELECT_CHARACTER, { characterId: chId });
    };
    const hostBroadcast = (g) => broadcastGameState(net.current, g);
    const adopt = (g2, sourceConn = null) => {
        if (!g2 || !Array.isArray(g2.players))
            return false;
        const cur = gref.current;
        if (net.current.host) {
            // Desde o protocolo de jogo v2, convidados nunca podem instalar snapshots.
            // Apenas ações autenticadas passam pela fila autoritativa do host.
            if (sourceConn)
                return false;
            const actorId = myPlayerId.current;
            if (!actorId || !cur || findPlayerIndexById(cur, actorId) < 0)
                return false;
            if (g2.players.length !== cur.players.length)
                return false;
            for (let i = 0; i < cur.players.length; i++) {
                if (g2.players[i]?.playerId !== cur.players[i]?.playerId)
                    return false;
                g2.players[i].playerId = cur.players[i].playerId;
                g2.players[i].seatId = cur.players[i].seatId;
                g2.players[i].sessionTokenHash = cur.players[i].sessionTokenHash;
            }
            g2.v = (cur.v || 0) + 1;
            const safe = ensureGamePlayerIdentities(clone(g2));
            setGame(safe);
            gref.current = safe;
            hostBroadcast(safe);
            saveLocal(safe);
            syncSeatFromGame(safe);
            return true;
        }
        if (g2.stateViewVersion !== STATE_VIEW_VERSION)
            return false;
        if (!cur || (g2.v || 0) >= (cur.v || 0)) {
            const safe = ensureGamePlayerIdentities(clone(g2));
            setGame(safe);
            gref.current = safe;
            syncSeatFromGame(safe);
            return true;
        }
        return false;
    };
    useEffect(() => {
        const gameLog = game?.presentation?.log || [];
        if (!gameLog.length) return;
        const top = gameLog[0];
        if (seenLog.current !== null && seenLog.current !== top.id) {
            setToast(top);
            const fresh = freshLogEntries(gameLog, seenLog.current);
            const cue = latestCurrentAudioCue(fresh);
            if (cue) AudioSys.playCue(cue);
            const timer = setTimeout(() => setToast(null), 3200);
            seenLog.current = top.id;
            return () => clearTimeout(timer);
        }
        seenLog.current = top.id;
    }, [game]);
    useEffect(() => {
        const startAudio = () => AudioSys.start();
        const playUiClick = (event) => {
            const control = event.target?.closest?.("button,[role=button]");
            if (!control || control.matches?.(":disabled,[aria-disabled=true]") || control.dataset?.audioClick === "off") return;
            AudioSys.play("uiClick");
        };
        document.addEventListener("pointerdown", startAudio);
        document.addEventListener("click", playUiClick, true);
        return () => {
            document.removeEventListener("pointerdown", startAudio);
            document.removeEventListener("click", playUiClick, true);
        };
    }, []);
    const normalizeGameTurnPresence = (state, now = Date.now()) => {
        if (!state || !Array.isArray(state.players))
            return -1;
        const requiredIndex = requiredGameActorIndex(state);
        state.players.forEach((player, index) => {
            ensurePlayerPresence(player);
            const requiredNow = index === requiredIndex;
            if (requiredNow && player.connected === false)
                beginGameTurnReconnectWindow(player, { now, graceMs: gameAfkGraceMs(player) });
            else
                clearGameTurnReconnectWindow(player);
        });
        return requiredIndex;
    };
    const commit = async (g) => {
        // Apenas o host pode produzir o estado oficial. Convidados enviam intenções
        // através dos protocolos de lobby/jogo e nunca publicam snapshots.
        if (!net.current.host)
            return gref.current;
        const rematchResolved = finalizeRematchIfReady(g);
        const gg = ensureGamePlayerIdentities(clone(rematchResolved));
        normalizeGameTurnPresence(gg, Date.now());
        gg.identityVersion = IDENTITY_PROTOCOL_VERSION;
        gg.lobbyProtocolVersion = LOBBY_PROTOCOL_VERSION;
        gg.gameProtocolVersion = GAME_PROTOCOL_VERSION;
        gg.v = (gg.v || 0) + 1;
        setGame(gg);
        gref.current = gg;
        syncSeatFromGame(gg);
        hostBroadcast(gg);
        saveLocal(gg);
        syncLobbyPresenceTimers(gg);
        syncGamePresenceTimers(gg);
        return gg;
    };
    const enqueueAuthorityTask = (task) => enqueueRuntimeAuthorityTask(net.current, task);
    const clearLobbyPresenceTimer = (playerId) => {
        const timer = lobbyPresenceTimers.current.get(playerId);
        if (timer)
            clearTimeout(timer);
        lobbyPresenceTimers.current.delete(playerId);
    };
    const removeExpiredLobbyPlayer = async (playerId, expectedDeadline = null) => {
        const current = gref.current;
        if (!net.current.host || !current || current.phase !== "lobby")
            return false;
        const idx = findPlayerIndexById(current, playerId);
        if (idx <= 0)
            return false;
        const player = current.players[idx];
        if (expectedDeadline != null && player.reconnectDeadline !== expectedDeadline)
            return false;
        if (!isLobbyReservationExpired(player, Date.now()))
            return false;
        const next = clone(current);
        const [removed] = next.players.splice(idx, 1);
        if (next.lobbyStarting)
            delete next.lobbyStarting;
        next.players.forEach((candidate) => { candidate.ready = candidate.controller === "bot"; });
        addLog(next, "⌛ O lugar de " + charOf(removed.ch).n + " foi libertado após terminar o tempo de reconexão.");
        clearLobbyPresenceTimer(playerId);
        await commit(next);
        return true;
    };
    const scheduleLobbyPresenceTimer = (playerId, deadline) => {
        clearLobbyPresenceTimer(playerId);
        if (!Number.isFinite(deadline))
            return;
        const delay = Math.max(0, deadline - Date.now()) + 25;
        const timer = setTimeout(() => {
            lobbyPresenceTimers.current.delete(playerId);
            void enqueueAuthorityTask(() => removeExpiredLobbyPlayer(playerId, deadline));
        }, delay);
        lobbyPresenceTimers.current.set(playerId, timer);
    };
    const syncLobbyPresenceTimers = (state) => {
        if (!net.current.host || !state || state.phase !== "lobby") {
            for (const playerId of [...lobbyPresenceTimers.current.keys()])
                clearLobbyPresenceTimer(playerId);
            return;
        }
        const activeReservations = new Set();
        state.players.slice(1).forEach((player) => {
            if (player.connected === false && Number.isFinite(player.reconnectDeadline)) {
                activeReservations.add(player.playerId);
                scheduleLobbyPresenceTimer(player.playerId, player.reconnectDeadline);
            }
        });
        for (const playerId of [...lobbyPresenceTimers.current.keys()]) {
            if (!activeReservations.has(playerId))
                clearLobbyPresenceTimer(playerId);
        }
    };
    const clearGamePresenceTimer = (playerId) => {
        const timer = gamePresenceTimers.current.get(playerId);
        if (timer)
            clearTimeout(timer);
        gamePresenceTimers.current.delete(playerId);
    };
    const skipAfkRequiredAction = (state, actorIndex) => {
        let next = clone(state);
        const player = next.players?.[actorIndex];
        if (!player)
            return { ok: false, game: state, label: "ação" };
        let label = "ação";
        const mandatorySkip = reduceMandatoryQueueSkip(next, actorIndex);
        if (mandatorySkip.handled) {
            next = mandatorySkip.game;
            label = mandatorySkip.event.label;
        }
        else if (next.phase === "setup") {
            label = next.setup?.needRoad ? "estrada da fundação" : "fundação inicial";
            next = advanceSetupState(next).game;
        }
        else if (next.phase === "play") {
            label = "turno";
            next.trade = null;
            if (next.turn) {
                next.turn.mustDragon = false;
                next.turn.steal = null;
                next.turn.deploy = null;
            }
            next = advanceTurn(next);
        }
        else {
            return { ok: false, game: state, label };
        }
        const skippedPlayer = next.players?.[actorIndex];
        if (skippedPlayer)
            markAfkActionSkipped(skippedPlayer, { now: Date.now() });
        return { ok: true, game: next, label };
    };
    const skipAfkAfterReconnectTimeout = async (playerId, expectedDeadline = null) => {
        const current = gref.current;
        if (!net.current.host || !current || !["setup", "play"].includes(current.phase) || current.winner != null)
            return false;
        const requiredIndex = requiredGameActorIndex(current);
        const idx = findPlayerIndexById(current, playerId);
        if (idx < 0 || idx !== requiredIndex)
            return false;
        const player = current.players[idx];
        if (expectedDeadline != null && player.turnReconnectDeadline !== expectedDeadline)
            return false;
        if (!isGameTurnReconnectExpired(player, Date.now()))
            return false;
        const skipped = skipAfkRequiredAction(current, idx);
        if (!skipped.ok)
            return false;
        const skippedPlayer = skipped.game.players[idx];
        addLog(skipped.game, "⏭ " + charOf(skippedPlayer.ch).n + " não regressou a tempo. A sua " + skipped.label + " foi saltada; a próxima espera será de 30 segundos.", idx);
        clearGamePresenceTimer(playerId);
        await commit(skipped.game);
        return true;
    };
    const scheduleGamePresenceTimer = (playerId, deadline) => {
        clearGamePresenceTimer(playerId);
        if (!Number.isFinite(deadline))
            return;
        const delay = Math.max(0, deadline - Date.now()) + 25;
        const timer = setTimeout(() => {
            gamePresenceTimers.current.delete(playerId);
            void enqueueAuthorityTask(() => skipAfkAfterReconnectTimeout(playerId, deadline));
        }, delay);
        gamePresenceTimers.current.set(playerId, timer);
    };
    const syncGamePresenceTimers = (state) => {
        if (!net.current.host || !state || !["setup", "play"].includes(state.phase) || state.winner != null) {
            for (const playerId of [...gamePresenceTimers.current.keys()])
                clearGamePresenceTimer(playerId);
            return;
        }
        const requiredIndex = requiredGameActorIndex(state);
        const requiredPlayer = requiredIndex >= 0 ? state.players[requiredIndex] : null;
        const activeTimerPlayerIds = new Set();
        if (requiredPlayer?.connected === false
            && Number.isFinite(requiredPlayer.turnReconnectDeadline)) {
            activeTimerPlayerIds.add(requiredPlayer.playerId);
            scheduleGamePresenceTimer(requiredPlayer.playerId, requiredPlayer.turnReconnectDeadline);
        }
        for (const playerId of [...gamePresenceTimers.current.keys()]) {
            if (!activeTimerPlayerIds.has(playerId))
                clearGamePresenceTimer(playerId);
        }
    };
    const hostSessionPresence = createHostSessionPresenceController({
        getRuntime: () => net.current,
        identityProtocolVersion: IDENTITY_PROTOCOL_VERSION,
        getGame: () => gref.current,
        commit,
        enqueueAuthorityTask,
        clone,
        hashSessionToken,
        characters: CHARS,
        createPlayer,
        addLog,
        characterName: (characterId) => charOf(characterId)?.n || characterId,
        clearLobbyPresenceTimer,
        clearGamePresenceTimer,
        scheduleLobbyPresenceTimer,
        presentTradeEvent,
        giveTestResources: (player) => RKEYS.forEach((resource) => { player.res[resource] = 99; })
    });
    const markAuthenticatedPlayerDisconnected = hostSessionPresence.onConnectionClosed;
    const handleLobbyKickSideEffect = hostSessionPresence.applyKickSideEffect;
    const authenticatedIndexForConnection = hostSessionPresence.authenticatedIndexForConnection;
    const addLobbyActionLog = (next, applied) => {
        const event = applied.event;
        if (!event)
            return;
        const actorIndex = applied.actorIndex;
        if (event.type === "CHARACTER_SELECTED") {
            if (event.oldCharacterId && event.oldCharacterId !== event.characterId)
                addLog(next, "🎭 " + charOf(event.oldCharacterId).n + " revelou-se: afinal era " + charOf(event.characterId).n + "!", actorIndex);
            else
                addLog(next, "🎭 " + charOf(event.characterId).n + " confirmou a sua casa.", actorIndex);
        }
        else if (event.type === "READY_CHANGED")
            addLog(next, (event.ready ? "✅ " : "↩ ") + playerName(next, actorIndex) + (event.ready ? " está pronto para a batalha." : " voltou a preparar-se."), actorIndex);
        else if (event.type === "PERKS_CHANGED")
            addLog(next, "✨ " + playerName(next, actorIndex) + (event.enabled ? " ativou" : " desativou") + " os poderes de casa.", actorIndex);
        else if (event.type === "LOBBY_STARTING")
            addLog(next, "🐉 O anfitrião abriu os portões do reino. A partida vai começar!", actorIndex);
        else if (event.type === "PLAYER_KICKED")
            addLog(next, "🚪 " + charOf(event.targetCharacterId).n + " foi removido do lobby pelo anfitrião.", actorIndex);
        else if (event.type === "BOT_ADDED")
            addLog(next, "🤖 " + charOf(event.characterId).n + " juntou-se à mesa como bot.", actorIndex);
    };
    const applyClientActionEvent = (event) => {
        if (event.type === "DUPLICATE_ACTION_PENDING") {
            const target = event.scope === "lobby" ? "alteração" : "ação";
            setToast({ id: Date.now() + Math.random(), msg: "⏳ Essa " + target + " já foi enviada. A aguardar resposta do anfitrião.", pi: null });
            return;
        }
        if (event.type === "LOBBY_ACTION_REJECTED" || event.type === "GAME_ACTION_REJECTED") {
            setErr(event.userMessage);
            setToast({ id: Date.now() + Math.random(), msg: "⚠️ " + event.userMessage, pi: null });
            return;
        }
        if (event.type === "LOBBY_ACTION_ACCEPTED") {
            setErr("");
            if (event.actionType === LOBBY_ACTION.SELECT_CHARACTER)
            return;
        }
        if (event.type === "GAME_ACTION_ACCEPTED")
            setErr("");
    };
    const hostActions = createHostActionController({
        getRuntime: () => net.current,
        getGame: () => gref.current,
        getLocalPlayerId: () => myPlayerId.current,
        commit,
        enqueueAuthorityTask,
        identityProtocolVersion: IDENTITY_PROTOCOL_VERSION,
        stateViewVersion: STATE_VIEW_VERSION,
        validCharacterIds: new Set(CHARS.map((character) => character.id)),
        createPlayer,
        onLobbyApplied: (next, applied) => {
            addLobbyActionLog(next, applied);
            handleLobbyKickSideEffect(applied.event);
        },
        onGameApplied: (next, applied) => presentAppliedGameAction(next, applied)
    });
    useEffect(() => {
        if (!net.current.host || !game) return undefined;
        return scheduleHostBotAction({
            game,
            getGame: () => gref.current,
            enqueueAuthorityTask,
            commit,
            onGameApplied: (next, applied) => presentAppliedGameAction(next, applied),
            onError: ({ reason }) => console.warn("Bot action rejected:", reason),
        });
    }, [game?.v, game?.phase, game?.winner]);

    const actionApplication = createClientActionController({
        getRuntime: () => net.current,
        getGame: () => gref.current,
        getPlayerId: () => myPlayerId.current,
        pendingLobbyActions: pendingLobbyActions.current,
        pendingGameActions: pendingGameActions.current,
        processLocalLobbyAction: (message) => hostActions.enqueueLobbyAction(message, null),
        processLocalGameAction: (message) => hostActions.enqueueGameAction(message, null),
        emit: applyClientActionEvent
    });
    const dispatchLobbyAction = actionApplication.dispatchLobbyAction;
    const dispatchGameAction = actionApplication.dispatchGameAction;
    const finalizeLobbyStart = async (actionId) => {
        const current = gref.current;
        if (!net.current.host || !current || current.phase !== "lobby")
            return false;
        const starting = current.lobbyStarting;
        if (!starting || starting.actionId !== actionId)
            return false;
        if (Date.now() < Number(starting.introEndsAt || 0))
            return false;
        if (current.players.some((player) => player.connected === false || player.ready !== true || player.characterConfirmed !== true)) {
            const cancelled = clone(current);
            delete cancelled.lobbyStarting;
            cancelled.players.forEach((player) => { player.ready = player.controller === "bot"; });
            addLog(cancelled, "↩ O início da partida foi cancelado porque a mesa deixou de estar pronta.");
            await commit(cancelled);
            return false;
        }
        // A ordem e qualquer geração dependente de RNG são decididas apenas pelo host.
        const reduced = reduceLobbyToSetup(current);
        const g = reduced.game;
        addLog(g, "🗺️ Os destinos foram lançados: " + reduced.event.order.map((i) => playerName(g, i)).join(" → ") + ". Fundem os vossos reinos!");
        await commit(g);
        return true;
    };
    useEffect(() => {
        const starting = game?.phase === "lobby" ? game.lobbyStarting : null;
        if (!net.current.host || !starting?.actionId)
            return;
        const delay = Math.max(0, Number(starting.introEndsAt || 0) - Date.now());
        const timer = setTimeout(() => {
            void enqueueAuthorityTask(() => finalizeLobbyStart(starting.actionId));
        }, delay);
        return () => clearTimeout(timer);
    }, [game?.phase, game?.lobbyStarting?.actionId, game?.lobbyStarting?.introEndsAt]);
    const prepareHostIdentity = async (sourceGame) => {
        const prepared = ensureGamePlayerIdentities(clone(sourceGame));
        prepared.lobbyProtocolVersion = LOBBY_PROTOCOL_VERSION;
        prepared.gameProtocolVersion = GAME_PROTOCOL_VERSION;
        if (prepared.trade) {
            if (!/^trade_[a-f0-9]{24}$/.test(prepared.trade.id || ""))
                prepared.trade.id = createStableId("trade");
            if (Number.isSafeInteger(prepared.trade.from) && prepared.players[prepared.trade.from])
                prepared.trade.fromPlayerId = prepared.players[prepared.trade.from].playerId;
            if (prepared.trade.to === "all")
                prepared.trade.toPlayerId = "all";
            else if (Number.isSafeInteger(prepared.trade.to) && prepared.players[prepared.trade.to])
                prepared.trade.toPlayerId = prepared.players[prepared.trade.to].playerId;
        }
        if (!prepared.players.length)
            throw new Error("O reino não tem anfitrião.");
        const presenceNow = Date.now();
        prepared.players.forEach((player) => ensurePlayerPresence(player));
        markPlayerConnected(prepared.players[0]);
        prepared.players.slice(1).forEach((player) => {
            if (player.controller === "bot") {
                markPlayerConnected(player);
                if (prepared.phase === "lobby") player.ready = true;
                return;
            }
            markPlayerDisconnected(player, {
                now: presenceNow,
                phase: prepared.phase,
                graceMs: LOBBY_RECONNECT_GRACE_MS
            });
        });
        if (prepared.phase === "lobby") {
            if (prepared.lobbyStarting)
                delete prepared.lobbyStarting;
            const legacyGuests = prepared.players.slice(1).filter((player) => player.controller !== "bot" && !isSessionTokenHash(player.sessionTokenHash));
            if (legacyGuests.length) {
                prepared.players = [prepared.players[0], ...prepared.players.slice(1).filter((player) => player.controller === "bot" || isSessionTokenHash(player.sessionTokenHash))];
                addLog(prepared, `🔐 ${legacyGuests.length} lugar${legacyGuests.length > 1 ? "es antigos foram libertados" : " antigo foi libertado"}; esses jogadores ainda não tinham token de sessão.`);
            }
        }
        let session = loadPlayerSession(prepared.code);
        const hostIndex = 0;
        const hostPlayer = prepared.players[hostIndex];
        let validStoredSession = false;
        if (session && hostPlayer.playerId === session.playerId) {
            try {
                const storedHash = await hashSessionToken(session.sessionToken);
                validStoredSession = !hostPlayer.sessionTokenHash || hostPlayer.sessionTokenHash === storedHash;
                if (validStoredSession)
                    hostPlayer.sessionTokenHash = storedHash;
            }
            catch (e) {
            }
        }
        if (!validStoredSession) {
            session = {
                playerId: hostPlayer.playerId,
                seatId: hostPlayer.seatId,
                sessionToken: createSessionToken()
            };
            hostPlayer.sessionTokenHash = await hashSessionToken(session.sessionToken);
            savePlayerSession(prepared.code, session);
        }
        normalizeGameTurnPresence(prepared, presenceNow);
        return { game: prepared, session, hostIndex };
    };
    const handleHostSessionAuth = hostSessionPresence.onSessionAuth;
    const handleHostClaimSeat = hostSessionPresence.onClaimSeat;
    const handleHostLeaveSeat = hostSessionPresence.onLeaveSeat;
    const handleHostLobbyAction = hostActions.onLobbyAction;
    const handleHostGameAction = hostActions.onGameAction;
    const handleHostStateRequest = hostActions.onStateRequest;
    const handleHostLegacyState = hostActions.onLegacyState;
    const hostSocial = createHostSocialController({
        getGame: () => gref.current,
        authenticatedIndexForConnection,
        characterName: (characterId) => charOf(characterId).n,
        relay: relayEmote,
        emit: (event) => {
            if (event.type === "EMOTE_RECEIVED")
                socialController.current.receiveEmote(event.message);
            else if (event.type === "CHAT_RECEIVED")
                socialController.current.receiveChat(event.message);
        }
    });
    const handleHostEmote = hostSocial.onEmote;
    const handleHostChat = hostSocial.onChat;
    const handleHostConnectionMessage = createHostMessageController({
        onSessionAuth: handleHostSessionAuth,
        onClaimSeat: handleHostClaimSeat,
        onLeaveSeat: handleHostLeaveSeat,
        onLobbyAction: handleHostLobbyAction,
        onGameAction: handleHostGameAction,
        onStateRequest: handleHostStateRequest,
        onLegacyState: handleHostLegacyState,
        onEmote: handleHostEmote,
        onChat: handleHostChat
    });
    const startHostTransport = async (hostGame, attemptId) => {
        destroyMultiplayerRuntime(net.current);
        net.current = createMultiplayerRuntimeState();
        net.current.host = true;
        setConnSt("wait");
        let opened = false;
        try {
            const runtime = net.current;
            const peerConfig = await resolvePeerConfig();
            if (net.current !== runtime || pendingIdentity.current?.requestId !== attemptId) return;
            createBrowserHostPeerRuntime({
            runtime,
            peerId: PREFIX + hostGame.code,
            peerConfig,
            openTimeoutMs: 9e3,
            onOpen: ({ controller }) => {
                if (pendingIdentity.current?.requestId !== attemptId) {
                    controller.destroy({ closeConnections: true, destroyPeer: true });
                    return;
                }
                opened = true;
                pendingIdentity.current = null;
                setConnSt("on");
                setErr("");
            },
            onOpenTimeout: ({ controller }) => {
                recordDiagnostic("host-open-timeout", { roomCode: hostGame?.code || "pending" });
                if (pendingIdentity.current?.requestId !== attemptId && !opened) return;
                pendingIdentity.current = null;
                setConnSt("off");
                setErr("O reino foi criado localmente, mas ainda não está acessível a outros jogadores. Verifica a ligação ao serviço de jogo e tenta novamente.");
                controller.destroy({ closeConnections: true, destroyPeer: true });
            },
            onConnectionOpen: ({ send }) => {
                send({
                    t: "identity-welcome",
                    protocolVersion: IDENTITY_PROTOCOL_VERSION,
                    buildVersion: APP_BUILD_VERSION,
                    buildCompatibilityVersion: APP_BUILD_COMPATIBILITY_VERSION,
                    stateViewVersion: STATE_VIEW_VERSION,
                    g: gref.current
                });
            },
            onConnectionMessage: handleHostConnectionMessage,
            onConnectionClose: ({ playerId }) => {
                if (playerId) void enqueueAuthorityTask(() => markAuthenticatedPlayerDisconnected(playerId));
            },
            onPeerError: ({ error, opened: peerOpened }) => {
                recordDiagnostic("host-peer-error", { opened: peerOpened, ...normalizeDiagnosticError(error) });
                if (pendingIdentity.current?.requestId !== attemptId && !peerOpened) return;
                pendingIdentity.current = null;
                if (error && error.type === "unavailable-id") {
                    setConnSt("off");
                    setErr("O código gerado ainda está registado no serviço. O reino continua aberto localmente; volta a tentar a ligação ou cria outro reino.");
                }
                else setConnSt("err");
            },
            onUnhandledError: (error) => { recordDiagnostic("host-runtime-error", normalizeDiagnosticError(error)); setConnSt("err"); }
            });
        }
        catch (error) {
            pendingIdentity.current = null;
            setConnSt("off");
            setErr("O reino foi criado localmente, mas a ligação multiplayer não arrancou. O serviço TURN/sinalização pode estar indisponível; tenta novamente dentro de alguns segundos.");
            recordDiagnostic("host-transport-start-error", normalizeDiagnosticError(error));
        }
    };

    const installHostGame = (nextGame, hostIndex) => {
        setCode(nextGame.code);
        setGame(nextGame);
        gref.current = nextGame;
        syncSeatFromGame(nextGame);
        saveLocal(nextGame);
        syncLobbyPresenceTimers(nextGame);
        syncGamePresenceTimers(nextGame);
        const nextStage = stageForAuthenticatedGame(nextGame, hostIndex);
        /* A página do livro é decidida pelo clamp de âmbito quando o stage muda,
           portanto aqui basta fechá-lo. Um `goToBookPage(REALM)` neste ponto
           seria rejeitado, porque o âmbito ainda é o do foyer. */
        book.close();
        navigate(nextStage);
    };

    const startHost = async (sourceGame, pendingRequestId = null) => {
        const attemptId = pendingRequestId || createStableId("host");
        if (!pendingRequestId) {
            if (pendingIdentity.current) return;
            pendingIdentity.current = { type: "host-start", requestId: attemptId };
        }
        try {
            const prepared = await prepareHostIdentity(sourceGame);
            if (pendingIdentity.current?.requestId !== attemptId) return;
            setLocalIdentity(prepared.session);
            setSeat(prepared.hostIndex);
            installHostGame(prepared.game, prepared.hostIndex);
            void startHostTransport(prepared.game, attemptId);
        }
        catch (e) {
            if (pendingIdentity.current?.requestId !== attemptId) return;
            pendingIdentity.current = null;
            setConnSt("off");
            setErr(e?.message || "Não foi possível preparar a identidade do anfitrião.");
        }
    };
    const give99 = (pl) => RKEYS.forEach((r) => pl.res[r] = 99);
    const createRealm = async (selectedMode) => {
        if (pendingIdentity.current)
            return;
        const requestId = createStableId("create");
        pendingIdentity.current = { type: "host-create", requestId };
        setErr("");
        try {
            const roomCode = generateRoomCode();
            const sessionToken = createSessionToken();
            const sessionTokenHash = await hashSessionToken(sessionToken);
            if (pendingIdentity.current?.requestId !== requestId)
                return;
            const identity = {
                playerId: createStableId("player"),
                seatId: createStableId("seat"),
                sessionToken,
                sessionTokenHash
            };
            setLocalIdentity(identity);
            savePlayerSession(roomCode, identity);
            const g = createInitialGame({ code: roomCode, hostCharacterId: null, mode: selectedMode, hostIdentity: identity });
            if (testSel) {
                g.test = true;
                give99(g.players[0]);
            }
            addLog(g, "🏰 O reino " + g.code + " foi fundado.");

            // O reino local é instalado primeiro. O transporte é iniciado depois
            // e nunca volta a substituir este estado canónico.
            setCode(g.code);
            setSeat(0);
            setGame(g);
            gref.current = g;
            syncSeatFromGame(g);
            saveLocal(g);
            book.showRealm();
            navigate(APP_STAGE.CHARACTER_SELECTION);

            void startHostTransport(g, requestId);
        }
        catch (e) {
            if (pendingIdentity.current?.requestId === requestId)
                pendingIdentity.current = null;
            clearLocalIdentity();
            setConnSt("off");
            setErr(e?.message || "Não foi possível criar uma sessão segura.");
        }
    };
    const refreshSavedRealms = () => setSavedRealms(inspectGameSaves());
    const resumeRealm = async (savedCode = null) => {
        if (pendingIdentity.current)
            return;
        const result = loadGameFromStorage(globalThis.localStorage, savedCode ? { code: savedCode } : {});
        const g = result.ok ? result.game : null;
        if (!g) {
            refreshSavedRealms();
            setErr("Não foi possível recuperar esse reino.");
            return;
        }
        const requestId = createStableId("resume");
        pendingIdentity.current = { type: "host-resume", requestId };
        await startHost(g, requestId);
    };
    const joinRealm = async (roomCodeInput = codeIn) => {
        setErr("");
        clearLocalIdentity();
        setSeat(null);
        const c = normalizeRoomCode(roomCodeInput);
        if (!isValidRoomCode(c)) {
            setErr(`O código tem ${ROOM_CODE_LENGTH} letras (ou 4 num reino antigo).`);
            return;
        }
        destroyMultiplayerRuntime(net.current);
        setConnSt("wait");
        const savedSession = loadPlayerSession(c);
        const applyClientSessionEvent = (event) => {
            const installWelcomeGame = (incoming) => {
                setCode(c);
                setGame(incoming);
                gref.current = incoming;
            };
            if (event.type === "CONNECTION_REJECTED") {
                setConnSt("off");
                setErr(event.userMessage);
                return;
            }
            if (["WELCOME_AUTHENTICATED", "SESSION_AUTH_REQUIRED", "CLAIM_REQUIRED", "SESSION_REQUIRED"].includes(event.type)) {
                installWelcomeGame(event.game);
            }
            if (event.type === "WELCOME_AUTHENTICATED") {
                setConnSt("on");
                setErr("");
                const playerIndex = syncSeatFromGame(event.game);
                navigate(stageForAuthenticatedGame(event.game, playerIndex));
                return;
            }
            if (event.type === "SESSION_AUTH_REQUIRED") {
                navigate(APP_STAGE.JOINING_ROOM);
                setConnSt("auth");
                setErr("A validar a tua sessão guardada…");
                return;
            }
            if (event.type === "CLAIM_REQUIRED") {
                navigate(APP_STAGE.JOINING_ROOM);
                setConnSt("claim");
                setErr("A reservar um lugar no reino…");
                void takeSeat();
                return;
            }
            if (event.type === "SESSION_REQUIRED") {
                navigate(APP_STAGE.SESSION_REQUIRED);
                setConnSt("on");
                setErr(event.userMessage);
                return;
            }
            if (event.type === "SESSION_ACCEPTED" || event.type === "CLAIM_ACCEPTED") {
                pendingIdentity.current = null;
                setCode(c);
                setLocalIdentity(event.identity);
                savePlayerSession(c, event.identity);
                if (event.game)
                    adopt(event.game);
                else
                    syncSeatFromGame(gref.current);
                setErr("");
                setConnSt("on");
                const currentGame = event.game || gref.current;
                const currentSeat = findPlayerIndexById(currentGame, event.identity?.playerId);
                const nextStage = stageForAuthenticatedGame(currentGame, currentSeat);
                book.showRealm();
                navigate(nextStage);
                return;
            }
            if (event.type === "SESSION_REJECTED") {
                setCode(c);
                forgetPlayerSession(c);
                clearLocalIdentity();
                setSeat(null);
                if (event.game)
                    adopt(event.game);
                setConnSt("on");
                navigate(APP_STAGE.SESSION_REQUIRED);
                setErr(event.userMessage);
                return;
            }
            if (event.type === "CLAIM_REJECTED") {
                pendingIdentity.current = null;
                setConnSt("on");
                setErr(event.userMessage);
                navigate(APP_STAGE.SESSION_REQUIRED);
                return;
            }
            if (event.type === "LEAVE_ACCEPTED") {
                pendingIdentity.current = null;
                forgetPlayerSession(c);
                exitToTitle();
                return;
            }
            if (event.type === "LEAVE_REJECTED") {
                pendingIdentity.current = null;
                setConnSt("on");
                const message = lobbyActionErrorText(event.reason);
                setErr(message);
                setToast({ id: Date.now() + Math.random(), msg: "⚠️ " + message, pi: null });
                return;
            }
            if (event.type === "SESSION_REPLACED") {
                setConnSt("off");
                setErr(event.userMessage);
                navigate(APP_STAGE.SESSION_REQUIRED);
                return;
            }
            if (event.type === "KICKED_FROM_LOBBY") {
                forgetPlayerSession(c);
                exitToTitle();
                setCodeIn(c);
                navigate(APP_STAGE.TITLE);
                book.showJoin();
                setErr(event.userMessage);
                return;
            }
            if (event.type === "LEGACY_HOST_STATE") {
                setConnSt("off");
                setErr(event.userMessage);
                return;
            }
            if (event.type === "STATE_RECEIVED")
                stateSync.adopt(event.game, { source: "network" });
        };
        const clientSessionPresence = createClientSessionPresenceController({
            roomCode: c,
            savedSession,
            identityProtocolVersion: IDENTITY_PROTOCOL_VERSION,
            stateViewVersion: STATE_VIEW_VERSION,
            buildCompatibilityVersion: APP_BUILD_COMPATIBILITY_VERSION,
            normalizeGame: (incoming) => ensureGamePlayerIdentities(clone(incoming)),
            getGame: () => gref.current,
            getPendingIdentity: () => pendingIdentity.current,
            emit: applyClientSessionEvent
        });
        const handleClientMessage = createClientMessageController({
            onIdentityWelcome: clientSessionPresence.onIdentityWelcome,
            onSessionResult: clientSessionPresence.onSessionResult,
            onClaimResult: clientSessionPresence.onClaimResult,
            onLobbyActionResult: actionApplication.onLobbyActionResult,
            onGameActionResult: actionApplication.onGameActionResult,
            onLeaveResult: clientSessionPresence.onLeaveResult,
            onSessionReplaced: clientSessionPresence.onSessionReplaced,
            onKickedFromLobby: clientSessionPresence.onKickedFromLobby,
            onState: clientSessionPresence.onState,
            onEmote: ({ message }) => socialController.current.receiveEmote(message),
            onChat: ({ message }) => socialController.current.receiveChat(message)
        });
        net.current = createMultiplayerRuntimeState();
        const runtime = net.current;
        let peerConfig;
        try {
            peerConfig = await resolvePeerConfig();
        }
        catch (error) {
            if (net.current !== runtime) return;
            recordDiagnostic("client-network-config-error", { roomCode: c, ...normalizeDiagnosticError(error) });
            setConnSt("off");
            setErr("Não foi possível preparar a ligação segura ao reino. O serviço TURN pode estar indisponível; tenta novamente dentro de alguns segundos.");
            return;
        }
        if (net.current !== runtime) return;
        createBrowserClientPeerRuntime({
            runtime,
            hostPeerId: PREFIX + c,
            peerConfig,
            connectionOptions: { reliable: true },
            peerOpenTimeoutMs: 9e3,
            welcomeTimeoutMs: 1e4,
            isReady: () => clientSessionPresence.hasWelcome(),
            onPeerOpen: () => {},
            onPeerOpenTimeout: ({ controller }) => {
                recordDiagnostic("client-open-timeout", { roomCode: c });
                if (clientSessionPresence.hasWelcome())
                    return;
                setConnSt("off");
                setErr("Sem ligação ao serviço de jogo. A tua rede/navegador pode estar a bloquear — tenta outro navegador (Chrome), desliga VPN/anti-vírus, ou usa os dados móveis.");
                controller.destroy({ closeConnection: true, destroyPeer: true });
            },
            onConnectionOpen: ({ send, controller }) => {
                if (savedSession) {
                    send({
                        t: "session-auth",
                        protocolVersion: IDENTITY_PROTOCOL_VERSION,
                        buildVersion: APP_BUILD_VERSION,
                        buildCompatibilityVersion: APP_BUILD_COMPATIBILITY_VERSION,
                        playerId: savedSession.playerId,
                        sessionToken: savedSession.sessionToken
                    });
                    setTimeout(() => {
                        if (controller.isCurrent() && !clientSessionPresence.isAuthResolved() && !clientSessionPresence.isAuthenticated()) {
                            setConnSt("auth");
                            setErr("O anfitrião ainda não confirmou a sessão. Volta atrás e tenta novamente se esta mensagem persistir.");
                        }
                    }, 8e3);
                }
            },
            onMessage: handleClientMessage,
            onConnectionClose: () => {
                recordDiagnostic("client-connection-close", { roomCode: c, hadWelcome: clientSessionPresence.hasWelcome() });
                if (clientSessionPresence.hasWelcome()) {
                    setConnSt("reconnecting");
                    navigate(APP_STAGE.RECONNECTING);
                    setErr("A ligação ao anfitrião foi interrompida. A tentar recuperar o teu lugar…");
                    setTimeout(() => {
                        if (loadPlayerSession(c)) joinRealm(c);
                    }, 1500);
                }
            },
            onWelcomeTimeout: () => {
                recordDiagnostic("client-welcome-timeout", { roomCode: c });
                if (!clientSessionPresence.hasWelcome()) {
                    setConnSt("off");
                    setErr("Reino não encontrado. Confirma o código e que o anfitrião tem o jogo aberto.");
                }
            },
            onPeerError: ({ error }) => {
                recordDiagnostic("client-peer-error", { roomCode: c, ...normalizeDiagnosticError(error) });
                setConnSt("off");
                if (error && error.type === "peer-unavailable")
                    setErr("Reino não encontrado. Confirma o código e que o anfitrião tem o jogo aberto.");
                else
                    setErr("Erro de ligação. Verifica a internet e tenta de novo.");
            },
            onUnhandledError: (error) => {
                recordDiagnostic("client-runtime-error", { roomCode: c, ...normalizeDiagnosticError(error) });
                setConnSt("off");
                setErr("Erro de ligação. Verifica a internet e tenta de novo.");
            }
        });
    };
    const takeSeat = async () => {
        const g = gref.current;
        if (!g || g.phase !== "lobby") {
            setErr("A partida já começou e não é possível entrar sem uma sessão original.");
            navigate(APP_STAGE.SESSION_REQUIRED);
            return;
        }
        if (pendingIdentity.current)
            return;
        if (g.players.length >= gameModeConfig(g.mode).maxPlayers) {
            setConnSt("on");
            setErr("O reino já está cheio.");
            navigate(APP_STAGE.SESSION_REQUIRED);
            return;
        }
        const conn = net.current.hostConn;
        if (!conn)
            return;
        const sessionToken = createSessionToken();
        const requestId = createStableId("claim");
        pendingIdentity.current = { type: "claim-seat", requestId, sessionToken };
        setConnSt("claim");
        try {
            const sessionTokenHash = await hashSessionToken(sessionToken);
            if (pendingIdentity.current?.requestId !== requestId || net.current.hostConn !== conn)
                return;
            conn.send({
                t: "claim-seat",
                protocolVersion: IDENTITY_PROTOCOL_VERSION,
                buildVersion: APP_BUILD_VERSION,
                buildCompatibilityVersion: APP_BUILD_COMPATIBILITY_VERSION,
                requestId,
                sessionTokenHash
            });
            setTimeout(() => {
                if (pendingIdentity.current?.requestId === requestId) {
                    pendingIdentity.current = null;
                    setConnSt("on");
                    setErr("O anfitrião não confirmou o lugar. Tenta novamente.");
                }
            }, 8e3);
        }
        catch (e) {
            if (pendingIdentity.current?.requestId !== requestId)
                return;
            pendingIdentity.current = null;
            setConnSt("on");
            setErr("Não foi possível criar uma sessão segura para este lugar.");
        }
    };
    const togglePerks = () => {
        const current = gref.current;
        if (!current)
            return;
        void dispatchLobbyAction(LOBBY_ACTION.SET_PERKS, { enabled: current.perksOn === false });
    };
    /* Entrada no reino.
   
       O `characterSelectionIntent` foi removido: era uma terceira fonte de
       verdade para "onde está o utilizador", ao lado do stage e do livro, e só
       servia para distinguir a primeira escolha de uma troca. Essa distinção
       deixa de ser precisa quando o empurrão automático para a parede das casas
       acontece apenas na ENTRADA no reino, e não continuamente. Depois disso o
       stage é autoritativo, e sair da selecção passa a ser sempre possível.
   
       Sem isto, um anfitrião que acabasse de fundar um reino ficava preso na
       parede das casas: o livro fechava-se sozinho e a saída estava desactivada
       enquanto a personagem não estivesse confirmada. */
    useEffect(() => {
        const localHostFlow = net.current.host === true;
        if (!game || !Number.isInteger(seat) || (connSt !== "on" && !localHostFlow))
            return;
        if (game.phase !== "lobby") {
            if (stage !== APP_STAGE.GAME)
                navigate(APP_STAGE.GAME);
            return;
        }
        const inRealmStage = stage === APP_STAGE.LOBBY || stage === APP_STAGE.CHARACTER_SELECTION;
        if (inRealmStage)
            return;
        const confirmed = game.players[seat]?.characterConfirmed === true;
        navigate(confirmed ? APP_STAGE.LOBBY : APP_STAGE.CHARACTER_SELECTION);
    }, [game?.phase, game?.revision, game?.players?.[seat]?.characterConfirmed, seat, connSt, stage]);

    const toggleReady = () => {
        const current = gref.current;
        const idx = findPlayerIndexById(current, myPlayerId.current);
        if (!current || current.phase !== "lobby" || idx < 0 || !current.players[idx])
            return;
        void dispatchLobbyAction(LOBBY_ACTION.SET_READY, { ready: current.players[idx].ready !== true });
    };
    const startGame = () => {
        AudioSys.play("lobbyStart");
        AudioSys.clearAmbient("lobbyFireplace");
        void dispatchLobbyAction(LOBBY_ACTION.BEGIN_START);
    };
    const requestRematch = () => dispatchGameAction(GAME_ACTION.REMATCH_READY, {});
    const addLobbyBot = () => {
        const current = gref.current;
        if (!current || current.phase !== "lobby" || seat !== 0) return false;
        const used = new Set(current.players.map((player) => player.ch).filter(Boolean));
        const character = CHARS.find((candidate) => !used.has(candidate.id));
        if (!character) {
            setErr("Não existem casas livres para outro bot.");
            return false;
        }
        void dispatchLobbyAction(LOBBY_ACTION.ADD_BOT, { characterId: character.id });
        return true;
    };
    const kickLobbyPlayer = (targetPlayerId) => {
        const current = gref.current;
        const targetIndex = findPlayerIndexById(current, targetPlayerId);
        if (!current || seat !== 0 || targetIndex <= 0)
            return;
        const targetName = charOf(current.players[targetIndex].ch).n;
        if (window.confirm(`Remover ${targetName} do lobby? A pessoa poderá voltar a entrar normalmente.`))
            void dispatchLobbyAction(LOBBY_ACTION.KICK_PLAYER, { targetPlayerId });
    };

    const deleteSavedRealm = (savedCode) => {
        clearGameSave(globalThis.localStorage, { code: savedCode });
        refreshSavedRealms();
    };
    const reconnect = () => {
        setConnSt("off");
        if (net.current.host && gref.current) {
            void startHost(gref.current);
            return;
        }
        setCodeIn(code);
        book.showJoin();
        navigate(APP_STAGE.TITLE);
    };
    return {
        code, codeIn, setCodeIn, seat, game, err, setErr, toast, connSt,
        emotes, chat, testSel, setTestSel, savedRealms, refreshSavedRealms, deleteSavedRealm,
        isHost: net.current.host === true,
        createRealm, resumeRealm, joinRealm, takeSeat, leaveLobby, exitToTitle, reconnect,
        swapCharacter, togglePerks, toggleReady, startGame, requestRematch, addLobbyBot, kickLobbyPlayer,
        dispatchLobbyAction, dispatchGameAction, sendChat, sendEmote,
    };
}
