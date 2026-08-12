import { lazy, Suspense, useEffect, useMemo, useReducer, useRef, useState } from "react";
import PlayerBanner from "./PlayerBanner.jsx";
import PlayerRail from "./PlayerRail.jsx";
import DevelopmentCard from "./DevelopmentCard.jsx";
import DevelopmentCardListItem from "./DevelopmentCardListItem.jsx";
import ImportantEventBanner from "./ImportantEventBanner.jsx";
import ChronicleLog from "./ChronicleLog.jsx";
import GameActionPanel from "./GameActionPanel.jsx";
import {
  GameHud,
  GameBottomDock,
  GameUtilityRail,
  OptionsUtilityPanel,
  HUD_UTILITY,
  toggleHudUtility,
} from "./hud/index.js";
import AppShell, { SceneLoading } from "../app/AppShell.jsx";
import CharacterSprite from "../assets/CharacterSprite.jsx";
import GameIcon from "../assets/GameIcon.jsx";
import { preloadBoardModule } from "../../loading/modulePreload.js";
import { AudioSys } from "../../audio/audioSystem.js";
import { localTurnNotificationKey } from "../../audio/gameAudioSelectors.js";
import { awardImportantEventModel, disasterImportantEventModel, storyImportantEventModel } from "../../presentation/gameEventCatalog.js";
import { CHARACTER_PERKS } from "../../presentation/perkCatalog.js";
import { CHARACTER_GLOW_COLORS as GLOW, shadeColor as shade } from "../board/boardVisualConfig.js";
import { stableBoardGeometryKey } from "../board/boardUpdateSignature.js";
import { GAME_ACTION } from "../../game/gameProtocol.js";
import { gameTurnReconnectSeconds } from "../../game/playerPresence.js";
import { PIECE_LIMITS as LIMITS, RESOURCE_DEFINITIONS as RES, RESOURCE_KEYS as RKEYS, BUILD_COSTS as COSTS, handSize } from "../../game/resources.js";
import { validPalaces, validRoads, validVillages } from "../../game/buildingRules.js";
import { DISASTER_DEFINITIONS as DISASTERS } from "../../game/disasterReducer.js";
import { bribeTargets, militaryActionsLeft, neighboringHexes as hexNbrs, unitTargets, validDeployHexes } from "../../game/warReducer.js";
import { ICE_DRAGON_WAKE_TURNS as GELO_TURNS, roundsForTurns as roundAtTurns } from "../../game/turnCycleReducer.js";
import { validDragonHexes } from "../../game/mandatoryDecisionReducer.js";
import { calculateVictoryPoints as calcVP, longestRoadLength as longestRoadLen, rankPlayers, troopTotal } from "../../game/scoringReducer.js";
import { MAX_WAGONS_PER_GAME as WMAX, WAGON_COST as WCOST, homeHexes, remoteVillageSpots as farSpots } from "../../game/explorationReducer.js";
import { makeBoardGraph as makeGraph } from "../../game/boardGeometry.js";
import { VICTORY_POINT_ATTRIBUTES as VPATTR } from "../../game/gameFactory.js";
import { isClassicMode as CLASSICO, isExplorationMode, isRapidMode, isWarMode as GUERRA } from "../../game/gameModes.js";
import { characterById as charOf } from "../../game/characterCatalog.js";
import { createInitialGameUiState, gameUiCloseDecision, gameUiOpenDecision, gameUiReducer, gameUiSet } from "./gameUiState.js";
import { deriveActionPresentation } from "./gameUiComposition.js";
import { buildGameActionModel, GAME_ACTION_COMMAND } from "./gameActionModel.js";
import { boardInteractionBlockReason, developmentCardPlayReason } from "./gameInteractionGuards.js";
import { createGameActionDispatchGate } from "./gameActionDispatchGate.js";
import { GameDecisionSystem } from "./decisions/index.js";
import GameEmoteBubble from "./social/GameEmoteBubble.jsx";
import GameStoryToast from "./GameStoryToast.jsx";
import DevelopmentCardReveal from "./DevelopmentCardReveal.jsx";
import EndgameExperience from "./endgame/EndgameExperience.jsx";
import GameGrimoirePanel from "./hud/GameGrimoirePanel.jsx";
import { GAME_ACTION_ICONS } from "../../assets/gameUiIcons.js";
import { warUnitName } from "../../presentation/gameLabels.js";

const Board3D = lazy(preloadBoardModule);
const PERKS = CHARACTER_PERKS;
const EXPL = (game) => isExplorationMode(game?.mode);
const RAPIDO = (game) => isRapidMode(game?.mode);
const hexOf = (game, key) => game.board.hexes.find((hex) => hex.k === key);
const isHid = (game, key) => !!hexOf(game, key)?.hid;
const pname = (game, index) => charOf(game.players[index].ch).n;
const curIdx = (game) => game.phase === "setup" ? game.setup.seq[game.setup.i] : game.order[game.turn.pos];
const milLeft = militaryActionsLeft;
const hasPerk = (game, playerIndex, characterId) => GUERRA(game.mode) && game.perksOn !== false && game.gelo?.active && game.players?.[playerIndex]?.ch === characterId;
function Modal({ children, onClose, center }) {
  return <div className={"modalbg" + (center ? " center" : "")} onClick={onClose}><div className="modal" onClick={(event) => event.stopPropagation()}>{children}</div></div>;
}



export default function GameScreen({ game, seat, dispatchGameAction, toast, dismissed, emotes, sendEmote, chat, sendChat, onExit, graphicsQuality, settings, setSetting, fullscreen, onToggleFullscreen, onRematch }) {
    const g = game;
    const presentation = g.presentation;
    const gameLog = presentation.log;
    const cardEvent = presentation.cardReveal;
    const awardEvent = presentation.award;
    const storyEvent = presentation.story;
    const disasterEvent = presentation.disaster;
    const [ui, dispatchUi] = useReducer(gameUiReducer, undefined, createInitialGameUiState);
    const dispatchGameActionRef = useRef(dispatchGameAction);
    dispatchGameActionRef.current = dispatchGameAction;
    const actionGateRef = useRef(null);
    if (!actionGateRef.current) {
        actionGateRef.current = createGameActionDispatchGate((type, payload) => dispatchGameActionRef.current(type, payload));
    }
    const runGameAction = actionGateRef.current.dispatch;
    const setUi = (field, value) => dispatchUi(gameUiSet(field, value));
    const {
        selectedUnit: selU, actionPanelMinimized, interactionMode: mode, showCards, decision,
        utilityPanel, showLibrary: showLib, selectedWagon: selW, zoomCard,
        perkView, selection: sel, tradeOffer: offer
    } = ui;
    const setSelU = (value) => setUi("selectedUnit", value);
    const setActionPanelMinimized = (value) => setUi("actionPanelMinimized", value);
    const setMode = (value) => setUi("interactionMode", value);
    const setShowCards = (value) => setUi("showCards", value);
    const openDecision = (value) => dispatchUi(gameUiOpenDecision(value));
    const closeDecision = () => dispatchUi(gameUiCloseDecision());
    const setUtilityPanel = (value) => setUi("utilityPanel", value);
    const setShowLib = (value) => setUi("showLibrary", value);
    const setSelW = (value) => setUi("selectedWagon", value);
    const setZoomCard = (value) => setUi("zoomCard", value);
    const setPerkView = (value) => setUi("perkView", value);
    const setSel = (value) => setUi("selection", value);
    const setOffer = (value) => setUi("tradeOffer", value);
    const boardGeometryKey = stableBoardGeometryKey(g.board);
    const gr = useMemo(() => makeGraph(g.board.hexes), [boardGeometryKey]);
    const [, force] = useState(0);
    const [presenceNow, setPresenceNow] = useState(() => Date.now());
    const cur = curIdx(g);
    const me = g.players[seat];
    const qItem = g.queue[0] || null;
    const requiredActor = Number.isSafeInteger(qItem?.p) ? qItem.p : cur;
    const requiredPlayer = g.players[requiredActor] || null;
    const canHumanAct = me?.connected !== false;
    const myTurn = cur === seat && canHumanAct;
    const turnAudioKeyRef = useRef(null);
    const turnAudioKey = localTurnNotificationKey(g, seat);
    useEffect(() => {
        if (!turnAudioKey) {
            turnAudioKeyRef.current = null;
            return;
        }
        if (turnAudioKeyRef.current === turnAudioKey) return;
        turnAudioKeyRef.current = turnAudioKey;
        AudioSys.play("yourTurn");
    }, [turnAudioKey]);
    const setupMode = g.phase === "setup";
    const presenceSignature = g.players.map((player) => [
        player.playerId,
        player.connected,
        player.turnReconnectDeadline,
        player.afkSkipCount
    ].join(":" )).join("|");
    useEffect(() => {
        const hasCountdown = g.players.some((player) => player.connected === false && Number.isFinite(player.turnReconnectDeadline));
        if (!hasCountdown)
            return undefined;
        setPresenceNow(Date.now());
        const timer = setInterval(() => setPresenceNow(Date.now()), 1000);
        return () => clearInterval(timer);
    }, [presenceSignature]);
    const requiredReconnectSeconds = requiredPlayer
        ? gameTurnReconnectSeconds(requiredPlayer, presenceNow)
        : null;
    const formatReconnectClock = (seconds) => {
        if (!Number.isFinite(seconds))
            return null;
        const safe = Math.max(0, seconds);
        return Math.floor(safe / 60) + ":" + String(safe % 60).padStart(2, "0");
    };
    useEffect(() => {
        dispatchUi({ type: "reset-turn-interaction" });
    }, [cur, g.phase]);
    const hardInteractionBlock = !!qItem || !!g.turn.steal || !!g.trade || !!g.turn.mustDragon || !!g.turn.deploy;
    useEffect(() => {
        if (hardInteractionBlock) dispatchUi({ type: "reset-turn-interaction" });
    }, [hardInteractionBlock, qItem?.t, qItem?.p, g.trade?.id, g.turn.steal?.at, g.turn.deploy, g.turn.mustDragon]);
    const nowEv = Date.now();
    const cardVisible = !!(cardEvent && cardEvent.pi !== seat && !dismissed.current.has(cardEvent.id));
    const disasterVisible = !!(disasterEvent && !cardVisible && !dismissed.current.has(disasterEvent.id));
    const awardVisible = !!(awardEvent && !cardVisible && !disasterVisible && !dismissed.current.has(awardEvent.id));
    const dragonStoryVisible = !!(storyEvent && storyEvent.kind === "dragao" && !cardVisible && !disasterVisible && !awardVisible && !dismissed.current.has(storyEvent.id) && nowEv - storyEvent.id < 3e4);
    const storyVisible = !!(storyEvent && storyEvent.kind !== "dragao" && !cardVisible && !disasterVisible && !awardVisible && !dismissed.current.has(storyEvent.id) && nowEv - storyEvent.id < 3e4 && (storyEvent.kind !== "gelo" || nowEv - storyEvent.id > 1450));
    const soundedAwards = useRef( new Set());
    useEffect(() => {
        if (!awardEvent || !awardVisible || soundedAwards.current.has(awardEvent.id))
            return;
        soundedAwards.current.add(awardEvent.id);
        AudioSys.play("award");
        const voiceEvent = awardEvent.kind === "road" ? "longest_road" : awardEvent.kind === "army" ? "largest_army" : null;
        const voiceTimer = voiceEvent && awardEvent.pi != null
            ? window.setTimeout(() => AudioSys.playVoice(g.players[awardEvent.pi]?.ch, voiceEvent), 320)
            : null;
        return () => { if (voiceTimer != null) window.clearTimeout(voiceTimer); };
    }, [awardEvent ? awardEvent.id : null, awardVisible]);
    useEffect(() => {
        if (storyEvent && (storyVisible || dragonStoryVisible)) {
            const dur = storyEvent.kind === "dados" ? 9500 + (storyEvent.lines ? storyEvent.lines.length * 1800 : 0) : storyEvent.kind === "dragao" || storyEvent.kind === "gelo" ? 7e3 : 5500;
            const t = setTimeout(() => {
                dismissed.current.add(storyEvent.id);
                force((x) => x + 1);
            }, dur);
            const t2 = storyEvent.kind === "dragao" || storyEvent.kind === "gelo" ? setTimeout(() => force((x) => x + 1), 1500) : null;
            return () => {
                clearTimeout(t);
                if (t2)
                    clearTimeout(t2);
            };
        }
    }, [storyEvent ? storyEvent.id : null, storyVisible, dragonStoryVisible]);
    let spotsV =  new Set(), spotsE =  new Set(), spotsH =  new Set();
    const boardBlocked = boardInteractionBlockReason(g, seat, { myTurn });
    if (myTurn && !boardBlocked) {
        if (setupMode) {
            if (!g.setup.needRoad)
                spotsV = new Set(validVillages(g, gr, seat, true));
            else
                spotsE = new Set(validRoads(g, gr, seat, g.setup.lastV));
        }
        else if (g.phase === "play" && g.turn.rolled && !g.winner) {
            if (g.turn.mustDragon)
                spotsH = new Set(validDragonHexes(g));
            else if (GUERRA(g.mode) && g.turn.deploy)
                spotsH = new Set(validDeployHexes(g, gr, seat, g.turn.deploy));
            else if (GUERRA(g.mode) && (milLeft(g) > 0 || g.turn.bonus === selU) && selU != null && g.units[selU] && g.units[selU].p === seat && !(g.turn.acted || {})[selU]) {
                spotsH = unitTargets(g, gr, selU, seat);
                spotsH.add(selU);
                Object.keys(g.units).forEach((k) => { if (g.units[k].p === seat && !(g.turn.acted || {})[k])
                    spotsH.add(k); });
            }
            else if (GUERRA(g.mode) && milLeft(g) > 0 && !mode) {
                spotsH = new Set(Object.keys(g.units).filter((k) => g.units[k].p === seat && !(g.turn.acted || {})[k]));
            }
            if (GUERRA(g.mode) && mode === "suborno")
                spotsH = bribeTargets(g, seat);
            if (GUERRA(g.mode) && g.turn.bonus && g.units[g.turn.bonus] && g.units[g.turn.bonus].p === seat) {
                if (selU === g.turn.bonus)
                    hexNbrs(g, g.turn.bonus).forEach((k) => { if (!g.units[k] && k !== g.board.dragon && !isHid(g, k))
                        spotsH.add(k); });
                else
                    spotsH.add(g.turn.bonus);
            }
            if (spotsH.size === 0 && mode === "carruagem")
                spotsH = new Set([...homeHexes(g, gr, seat)]);
            else if (mode === "mover" && selW && g.wagons[selW] && g.wagons[selW].mv > 0)
                spotsH = new Set(hexNbrs(g, g.wagons[selW].at));
            else if (mode === "fundar" && selW)
                spotsV = new Set(farSpots(g, gr, selW));
            else if (mode === "estrada")
                spotsE = new Set(validRoads(g, gr, seat));
            else if (mode === "aldeia")
                spotsV = new Set(validVillages(g, gr, seat, false));
            else if (mode === "palacio")
                spotsV = new Set(validPalaces(g, seat));
        }
    }
    const afterAccepted = (type, payload, onAccepted = null) => {
        void runGameAction(type, payload).then((result) => {
            if (result) onAccepted?.(result);
        });
    };
    const onVert = (v) => {
        if (mode === "fundar" && selW) {
            afterAccepted(GAME_ACTION.FOUND_REMOTE_VILLAGE, { wagonId: selW, vertex: v }, () => {
                setSelW(null);
                setMode(null);
            });
            return;
        }
        if (setupMode) {
            afterAccepted(GAME_ACTION.BUILD_VILLAGE, { vertex: v });
            return;
        }
        if (mode === "aldeia") {
            afterAccepted(GAME_ACTION.BUILD_VILLAGE, { vertex: v }, () => setMode(null));
            return;
        }
        if (mode === "palacio") {
            afterAccepted(GAME_ACTION.BUILD_PALACE, { vertex: v }, () => setMode(null));
        }
    };
    const onEdge = (e) => {
        afterAccepted(GAME_ACTION.BUILD_ROAD, { edge: e }, () => {
            if (!setupMode && me.freeRoads <= 1) setMode(null);
        });
    };
    const onHex = (k) => {
        if (GUERRA(g.mode) && !g.turn.mustDragon) {
            if (mode === "suborno" && myTurn) {
                afterAccepted(GAME_ACTION.BRIBE_UNIT, { hex: k }, () => setMode(null));
                return;
            }
            if (g.turn.deploy && myTurn) {
                afterAccepted(GAME_ACTION.DEPLOY_UNIT, { hex: k });
                return;
            }
            if (selU != null && (milLeft(g) > 0 || g.turn.bonus === selU)) {
                if (k === selU) return setSelU(null);
                if (unitTargets(g, gr, selU, seat).has(k)) {
                    afterAccepted(GAME_ACTION.UNIT_ACTION, { fromHex: selU, toHex: k }, () => setSelU(null));
                    return;
                }
                if (g.units[k] && g.units[k].p === seat) return setSelU(k);
                return;
            }
            if ((milLeft(g) > 0 || g.turn.bonus === k) && g.units[k] && g.units[k].p === seat && !(g.turn.acted || {})[k])
                return setSelU(k);
        }
        if (mode === "carruagem") {
            afterAccepted(GAME_ACTION.BUILD_WAGON, { hex: k }, () => setMode(null));
            return;
        }
        if (mode === "mover" && selW) {
            afterAccepted(GAME_ACTION.MOVE_WAGON, { wagonId: selW, hex: k });
            return;
        }
        if (g.turn.mustDragon) afterAccepted(GAME_ACTION.PLACE_DRAGON, { hex: k });
    };
    const wsel = selW && g.wagons ? g.wagons[selW] : null;
    const beginDevCard = (c) => {
        if (c.kind === "espiao") {
            setZoomCard(null);
            setShowCards(false);
            return openDecision({ type: "spy", cardId: c.id });
        }
        if (c.kind === "monopolio") {
            setZoomCard(null);
            setShowCards(false);
            return openDecision({ type: "monopolio", cardId: c.id });
        }
        if (c.kind === "descoberta") {
            setZoomCard(null);
            setShowCards(false);
            return openDecision({ type: "descoberta", cardId: c.id, first: null });
        }
        void runGameAction(GAME_ACTION.PLAY_DEV_CARD, { cardId: c.id }).then((result) => {
            if (!result) return;
            setZoomCard(null);
            setShowCards(false);
            if (c.kind === "estradas") setMode("estrada");
        });
    };
    const actionModel = useMemo(() => buildGameActionModel(g, gr, seat, {
        myTurn,
        interactionMode: mode,
        selectedWagon: selW,
    }), [g, gr, seat, myTurn, mode, selW]);
    const actionPresentation = deriveActionPresentation({
        myTurn,
        phase: g.phase,
        winner: g.winner,
        actionModel,
        interactionMode: mode,
        minimized: actionPanelMinimized,
        forcedBoardChoice: !!(g.turn.mustDragon || g.turn.deploy),
    });
    const executeAction = (action) => {
        const command = action?.command;
        if (!action?.enabled || !command)
            return;
        if (command.type === GAME_ACTION_COMMAND.DISPATCH) {
            void runGameAction(command.actionType, command.payload || {}).then((result) => {
                if (result && command.actionType === GAME_ACTION.END_TURN) setSelU(null);
            });
            return;
        }
        if (command.type === GAME_ACTION_COMMAND.TOGGLE_MODE) {
            if (command.clearWagon)
                setSelW(null);
            setMode(mode === command.mode ? null : command.mode);
            return;
        }
        if (command.type === GAME_ACTION_COMMAND.OPEN_BANK) {
            openDecision({ type: "bank" });
            return;
        }
        if (command.type === GAME_ACTION_COMMAND.OPEN_TRADE) {
            setOffer({ give: {}, get: {}, to: null });
            openDecision({ type: "trade-proposal" });
            return;
        }
        if (command.type === GAME_ACTION_COMMAND.SELECT_WAGON) {
            const nextWagon = selW === command.wagonId ? null : command.wagonId;
            setSelW(nextWagon);
            setMode(nextWagon ? "mover" : null);
            return;
        }
        if (command.type === GAME_ACTION_COMMAND.TOGGLE_FOUND)
            setMode(mode === "fundar" ? "mover" : "fundar");
    };
    const openUtility = (panel) => setUtilityPanel((current) => toggleHudUtility(current, panel));
    const closeUtility = () => setUtilityPanel(null);
    const leaveGame = () => {
        if (onExit && window.confirm(seat === 0 ? "Sair para o menu? O reino fica guardado — podes retomá-lo no ecrã inicial, mas os convidados perdem a ligação até voltares." : "Sair para o menu? Podes voltar a entrar com o código do reino."))
            onExit();
    };
    const lens = g.players.map((_, i) => longestRoadLen(g, gr, i));
    const roadsBuilt = g.players.map((_, i) => Object.values(g.roads || {}).filter((owner) => owner === i).length);
    const pubVPs = g.players.map((_, i) => calcVP(g, i, false));
    const mySecretVP = [...me.devNew, ...me.devOld].filter((c) => c.kind === "vp").length;
    const rankOrder = rankPlayers(g, { includeSecret: false }).map((entry) => entry.playerIndex);
    const perksLive = GUERRA(g.mode) && g.perksOn !== false && g.gelo && g.gelo.active;
    const playersRow =  <PlayerRail>{rankOrder.map((i, rank) => {
        const p = g.players[i];
        const ch = charOf(p.ch);
        const on = i === requiredActor && g.phase !== "ended";
        const hasLR = g.lr && g.lr.p === i, hasLA = g.la && g.la.p === i;
        return  <PlayerBanner
            key={i}
            player={p}
            character={ch}
            rank={rank}
            publicVictoryPoints={pubVPs[i]}
            secretVictoryPoints={i === seat ? mySecretVP : 0}
            resourceCount={handSize(p)}
            developmentCards={p.devNew.length + p.devOld.length}
            roadCount={roadsBuilt[i]}
            longestRoad={lens[i]}
            troopCount={troopTotal(p)}
            hasLongestRoad={hasLR}
            hasLargestArmy={hasLA}
            isLocal={i === seat}
            isActive={on}
            reconnectSeconds={gameTurnReconnectSeconds(p, presenceNow)}
            isExpanded={perkView === i}
            onToggle={() => setPerkView((open) => open === i ? null : i)}
            perk={PERKS[p.ch]}
            perkLive={perksLive}
            warMode={GUERRA(g.mode)}
            quote={ch.q[0]}
            style={{
                "--house": GLOW[ch.id],
                "--house-top": shade(ch.c, 34),
                "--house-mid": shade(ch.c, -6),
                "--house-bottom": shade(ch.c, -30),
                "--house-accent": ch.ac
            }}
        >{emotes && emotes[i] &&  <GameEmoteBubble key={"em" + emotes[i].id} emoteId={emotes[i].k}/>}</PlayerBanner>;
    })}</PlayerRail>;
    let status = null;
    if (g.phase === "ended")
        status = pname(g, g.winner) + " venceu!";
    else if (requiredPlayer?.connected === false && requiredReconnectSeconds != null)
        status = "A aguardar " + pname(g, requiredActor) + " — " + formatReconnectClock(requiredReconnectSeconds);
    else if (qItem)
        status = qItem.p === seat ? null : "À espera de " + pname(g, qItem.p) + "…";
    else if (g.turn.steal)
        status = myTurn ? null : pname(g, cur) + " escolhe quem saquear…";
    else if (setupMode)
        status = myTurn
            ? g.setup.needRoad
                ? "Coloca uma estrada junto à tua aldeia"
                : (RAPIDO(g) ? "Toca num ponto para erguer um palácio" : "Toca num ponto para fundar uma aldeia") + (g.setup.i >= g.players.length ? " (a 2.ª dá recursos!)" : "")
            : pname(g, cur) + " está a fundar o seu reino…";
    else if (myTurn && g.turn.mustDragon)
        status = "Escolhe o hexágono onde o Dragão vai pousar";
    else if (myTurn && GUERRA(g.mode) && g.turn.deploy)
        status = "Destaca " + warUnitName(g.turn.deploy) + ": toca num hexágono livre junto ao teu Bastião";
    else if (myTurn && GUERRA(g.mode) && selU != null && g.units[selU])
        status = warUnitName(g.units[selU].t) + (g.units[selU].t === "arqueiro"
            ? " — toca num hexágono livre para mover ou num inimigo adjacente para disparar"
            : " — toca num hexágono livre para mover ou num inimigo que venças para atacar") + " · " + milLeft(g) + "/2 ações";
    else if (myTurn && !g.turn.rolled)
        status = null;
    else if (!myTurn)
        status = "Vez de " + pname(g, cur) + (g.turn.rolled ? "" : " — a lançar os dados") + "…";
    else if (mode === "mover" && wsel)
        status = wsel.mv > 0
            ? wsel.mv + " movimento" + (wsel.mv > 1 ? "s" : "") + " — toca num hexágono vizinho" + (wsel.cargo ? " (com colonos)" : "")
            : "Esta carruagem já não anda mais este turno";
    else if (mode)
        status = {
            estrada: "Toca numa aresta dourada",
            aldeia: "Toca num ponto dourado",
            palacio: "Toca numa aldeia tua para a elevar",
            carruagem: "Toca num hexágono junto a uma construção tua",
            fundar: "Toca num canto do hexágono — a carruagem é desmantelada para erguer a aldeia",
            suborno: "Escolhe a unidade que queres subornar",
        }[mode];
    return  <AppShell><div style={{ position: "fixed", inset: 0, zIndex: 0 }}><Suspense fallback={<SceneLoading label="A preparar o tabuleiro…" />}><Board3D g={g} gr={gr} spotsV={spotsV} spotsE={spotsE} spotsH={spotsH} onVert={onVert} onEdge={onEdge} onHex={onHex} graphicsQuality={graphicsQuality}/></Suspense></div>{toast &&  <div className={"toast"}>{toast.msg}</div>}<GameHud
        code={g.code}
        round={g.round}
        dice={g.turn.dice}
        diceAnimationKey={gameLog.length && g.turn.dice ? g.turn.dice.join("") + g.round + g.turn.pos : "idle"}
        status={status}
        fullscreen={fullscreen}
        onToggleFullscreen={onToggleFullscreen}
    />{playersRow}{GUERRA(g.mode) && g.troll && g.troll.awake && !g.troll.defeated && g.troll.giant &&  <div className={"trollhud"}><div className={"th-top"}>{"Troll Gigante"}<span className={"th-hp"}>{g.troll.giant.hp + "/" + g.troll.giant.maxHp}</span></div><div className={"th-bar"}><div className={"th-fill"} style={{ width: Math.max(0, 100 * g.troll.giant.hp / g.troll.giant.maxHp) + "%" }}/></div><div className={"th-dmg"}>{g.players.map((pp, i) =>  <span key={i} className={"th-c"} title={pname(g, i) + ": " + (g.troll.dmg[i] || 0) + " dano"}><i style={{ background: GLOW[pp.ch] }}/>{g.troll.dmg[i] || 0}</span>)}</div>{g.troll.giant.at === "0,0" &&  <div className={"th-warn"}>{"Domina o Coração — a horda repõe-se"}</div>}</div>}{GUERRA(g.mode) && g.troll && !g.troll.awake && g.troll.rush > 0 &&  <div className={"trollhud omen"}><div className={"th-top"}>{"O pântano agita-se"}<span className={"th-hp"}>{g.troll.rush + "/" + g.players.length}</span></div></div>}
    <GameUtilityRail
        game={g}
        chat={chat || []}
        sendChat={sendChat}
        sendEmote={sendEmote}
        disabled={g.phase === "ended"}
        activeUtility={utilityPanel}
        onOpenUtility={openUtility}
        logCount={gameLog.length > 99 ? "99+" : gameLog.length}
    />
    {g.phase !== "ended" && <GameBottomDock
        code={g.code}
        round={g.round}
        dice={g.turn.dice}
        diceAnimationKey={gameLog.length && g.turn.dice ? g.turn.dice.join("") + g.round + g.turn.pos : "idle"}
        resources={me.res}
        resourceDefinitions={RES}
        resourceKeys={RKEYS}
        costs={COSTS}
        showCosts={!myTurn}
        cards={[...me.devOld.map((card) => ({ card, isNew: false })), ...me.devNew.map((card) => ({ card, isNew: true }))]}
        characterId={me.ch}
        onOpenCard={({ card, isNew }) => setZoomCard({ c: card, nov: isNew })}
        onOpenCards={() => setShowCards(true)}
    />}
    <GameActionPanel
        model={actionModel}
        presentation={actionPresentation}
        onAction={executeAction}
        onMinimize={() => setActionPanelMinimized(true)}
        onRestore={() => setActionPanelMinimized(false)}
        onCancelPlacement={() => { setMode(null); setSelW(null); setSelU(null); }}
    />
{zoomCard && (() => {
        const c = zoomCard.c;
        const playReason = developmentCardPlayReason(g, gr, seat, c, { isNew: !!zoomCard.nov, isLibrary: !!zoomCard.lib, myTurn });
        const playable = playReason == null;
        const playFromZoom = () => beginDevCard(c);
        return  <Modal center={true} onClose={() => setZoomCard(null)}><div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}><div style={{ width: 235 }}><DevelopmentCard card={c} characterId={me.ch} /></div>{zoomCard.nov &&  <p className={"quote"}>{"Nova \u2014 jog\xE1vel a partir do pr\xF3ximo turno."}</p>}{c.kind === "vp" &&  <p className={"quote"}>{"Guarda-a em segredo: vale 1 Ponto de Vit\xF3ria."}</p>}{zoomCard.lib &&  <p className={"quote"}>{"P\xE1gina do Grim\xF3rio \u2014 assim ser\xE1 quando a comprares."}</p>}{c.kind !== "vp" && !zoomCard.nov && !zoomCard.lib && playReason &&  <p style={{ color: "#e08a8a", fontSize: 14, textAlign: "center" }}>{playReason}</p>}{c.kind !== "vp" && !zoomCard.nov && !zoomCard.lib &&  <button className={"btn gold rd-card-play-button"} style={{ width: "100%" }} disabled={!playable} onClick={playFromZoom}><GameIcon name={GAME_ACTION_ICONS.card} size={24} alt="" />Jogar Carta</button>}</div></Modal>;
    })()}{<GameDecisionSystem
        game={g}
        graph={gr}
        seat={seat}
        localDecision={decision}
        selection={sel}
        tradeOffer={offer}
        dispatchGameAction={runGameAction}
        onChangeLocalDecision={openDecision}
        onCloseLocalDecision={closeDecision}
        onSelectionChange={setSel}
        onTradeOfferChange={setOffer}
    />}{showCards &&  <Modal onClose={() => setShowCards(false)}><div style={{ display: "flex", alignItems: "center", marginBottom: 10, gap: 8 }}><h3 className={"f-t"} style={{ color: "#e0b23a", flex: 1 }}>As tuas Cartas</h3><button className={"btn sm ghost"} onClick={() => setShowLib(true)}>Grimório</button></div>{me.devOld.length + me.devNew.length === 0 &&  <p className={"quote"}>{"Ainda n\xE3o tens cartas de desenvolvimento."}</p>}{me.devOld.map((c) => {
        const playReason = developmentCardPlayReason(g, gr, seat, c, { myTurn });
        return <DevelopmentCardListItem key={c.id} card={c} characterId={me.ch} status={playReason} disabled={playReason != null} onPlay={c.kind === "vp" ? null : () => beginDevCard(c)} />;
    })}{me.devNew.map((c) => <DevelopmentCardListItem key={c.id} card={c} characterId={me.ch} status="Nova — jogável no próximo turno" dim />)}<div className="rd-army-summary" style={{ marginTop: 10 }}><span><GameIcon name={GAME_ACTION_ICONS.cavaleiro} size={22} alt="" /><b>{me.troops.cavaleiro}</b></span><span><GameIcon name={GAME_ACTION_ICONS.catapulta} size={22} alt="" /><b>{me.troops.catapulta}</b></span><span><GameIcon name={GAME_ACTION_ICONS.arqueiro} size={22} alt="" /><b>{me.troops.arqueiro}</b></span>{me.immune && <strong>Trindade das Armas</strong>}</div></Modal>}{g.trade && g.trade.from === seat &&  <div className={"toast"} style={{ top: 52 }}>{"\xC0 espera de "}{g.trade.to === "all" ? "todos" : pname(g, g.trade.to)}{"\u2026 "}<button className={"btn sm ghost"} onClick={() => void runGameAction(GAME_ACTION.CANCEL_TRADE, { tradeId: g.trade.id })}>{"Cancelar"}</button></div>}{cardVisible && <DevelopmentCardReveal
        event={cardEvent}
        game={g}
        playerName={pname(g, cardEvent.pi)}
        onDismiss={() => { dismissed.current.add(cardEvent.id); force((x) => x + 1); }}
    />}{awardVisible &&  <ImportantEventBanner model={awardImportantEventModel(g, awardEvent)} onDismiss={() => {
        dismissed.current.add(awardEvent.id);
        force((x) => x + 1);
    }} renderPlayerPortrait={(playerIndex) => <CharacterSprite character={g.players[playerIndex].ch} size={92}/>} />}{dragonStoryVisible &&  <ImportantEventBanner model={storyImportantEventModel(g, storyEvent)} onDismiss={() => {
        dismissed.current.add(storyEvent.id);
        force((x) => x + 1);
    }} />}{storyVisible && <GameStoryToast
        event={storyEvent}
        game={g}
        onDismiss={() => { dismissed.current.add(storyEvent.id); force((x) => x + 1); }}
    />}{disasterVisible &&  <ImportantEventBanner model={disasterImportantEventModel(g, disasterEvent)} onDismiss={() => {
        dismissed.current.add(disasterEvent.id);
        force((x) => x + 1);
    }} />}{g.phase === "ended" && g.winner != null && <EndgameExperience game={g} graph={gr} seat={seat} onExit={onExit} onRematch={onRematch} />} {utilityPanel === HUD_UTILITY.OPTIONS &&  <OptionsUtilityPanel
        settings={settings}
        setSetting={setSetting}
        fullscreen={fullscreen}
        onToggleFullscreen={onToggleFullscreen}
        onExit={leaveGame}
        onClose={closeUtility}
    />}{utilityPanel === HUD_UTILITY.GRIMOIRE && <GameGrimoirePanel
        game={g}
        player={me}
        onClose={closeUtility}
        onOpenLibrary={() => { closeUtility(); setShowLib(true); }}
    />}{showLib &&  <Modal onClose={() => setShowLib(false)}><h3 className={"f-t"} style={{ color: "#e0b23a", marginBottom: 4 }}>Grimório das Cartas</h3><p style={{ fontSize: 13, color: "#a8905c", marginBottom: 10 }}>{"Baralho de 25 cartas \xB7 restam "}{g.deck.length}{" por comprar."}</p>{CLASSICO(g.mode) &&  <p style={{ fontSize: 13, color: "#7db4d8", marginBottom: 10 }}>{"Regras clássicas: todas as tropas s\xE3o Cavaleiros e n\xE3o h\xE1 desastres."}</p>}{GUERRA(g.mode) &&  <p style={{ fontSize: 13, color: "#e08a8a", marginBottom: 10 }}>{"Guerra dos Reinos: as cartas de tropa destacam unidades para o tabuleiro (1 a\xE7\xE3o militar por turno: destacar, mover 1 hex\xE1gono ou atacar). Cavaleiro vence Catapulta · Catapulta vence Arqueiro · Arqueiro vence Cavaleiro (\xE0 dist\xE2ncia). Uma Catapulta junto a uma aldeia rival (duas para pal\xE1cio) OCUPA-A no in\xEDcio do teu turno: a produ\xE7\xE3o passa a ser tua e vale +1 ponto. Matar a catapulta liberta o edif\xEDcio. A primeira ocupa\xE7\xE3o de cada edif\xEDcio rival vale +1 ponto PERMANENTE. As tropas novas chegam SEMPRE a hex\xE1gonos livres junto ao teu Basti\xE3o (a primeira aldeia) e s\xF3 agem no turno seguinte. O Cora\xE7\xE3o do Reino (hex\xE1gono central) tem o \xFAnico 6/8 do mapa e a flor \xE0 sua volta os n\xFAmeros m\xE9dios \u2014 as prov\xEDncias s\xE3o modestas e id\xEAnticas. Ter uma tropa no Cora\xE7\xE3o no in\xEDcio do teu turno rende 1 recurso \xE0 escolha. Podes jogar v\xE1rias cartas por turno, mas s\xF3 1 tropa. No 7, o Drag\xE3o aben\xE7oa: todos escolhem 1 recurso, quem rolou escolhe 2. Um porto 3:1 por prov\xEDncia. O jogo acaba por rondas: vence quem tiver mais pontos."}</p>}{EXPL(g) &&  <p style={{ fontSize: 13, color: "#e8a06b", marginBottom: 10 }}>{"Um cinturão de Terras Ardidas cerca a ilha por completo. Nenhuma estrada o atravessa. S\xF3 se sai daqui de carruagem \u2014 e s\xF3 a carruagem revela o que h\xE1 do outro lado."}</p>}<div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center" }}>{[
        { kind: "tropa", sub: "cavaleiro" },
        { kind: "tropa", sub: "catapulta" },
        { kind: "tropa", sub: "arqueiro" },
        ...VPATTR.map((a) => ({ kind: "vp", sub: a })),
        { kind: "monopolio" },
        { kind: "descoberta" },
        { kind: "estradas" }
    ].map((c, i) =>  <div key={i} style={{ width: "30%", minWidth: 94, cursor: "pointer" }} onClick={() => setZoomCard({ c: { ...c, id: "lib" + i }, nov: false, lib: true })}><DevelopmentCard card={c} characterId={me.ch} mini /></div>)}</div><p style={{ fontSize: 13, color: "#a8905c", marginTop: 10, textAlign: "center" }}>{"14 tropas (tipo sorteado) \xB7 5 atributos (1 PV cada) \xB7 2 Monop\xF3lio \xB7 2 Trabalhadores \xB7 2 Construtor de Estradas."}<br />{"Toca numa carta para a ver em grande. Junta 1 tropa de cada tipo e ganha a Trindade das Armas."}</p></Modal>}{utilityPanel === HUD_UTILITY.HISTORY &&  <ChronicleLog game={g} entries={gameLog} onClose={closeUtility}/>}</AppShell>;
}
