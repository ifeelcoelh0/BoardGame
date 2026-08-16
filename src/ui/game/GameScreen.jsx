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
import { awardImportantEventModel, disasterImportantEventModel, storyImportantEventModel } from "../../presentation/gameEventCatalog.js";
import { CHARACTER_PERKS } from "../../presentation/perkCatalog.js";
import { CHARACTER_GLOW_COLORS as GLOW, shadeColor as shade } from "../board/boardVisualConfig.js";
import { GAME_ACTION } from "../../game/gameProtocol.js";
import { PIECE_LIMITS as LIMITS, RESOURCE_DEFINITIONS as RES, RESOURCE_KEYS as RKEYS, BUILD_COSTS as COSTS, canPay, handSize } from "../../game/resources.js";
import { validPalaces, validRoads, validVillages } from "../../game/buildingRules.js";
import { DISASTER_DEFINITIONS as DISASTERS } from "../../game/disasterReducer.js";
import { bribeTargets, militaryActionsLeft, neighboringHexes as hexNbrs, unitTargets, validDeployHexes } from "../../game/warReducer.js";
import { ICE_DRAGON_WAKE_TURNS as GELO_TURNS, roundsForTurns as roundAtTurns } from "../../game/turnCycleReducer.js";
import { validDragonHexes } from "../../game/mandatoryDecisionReducer.js";
import { calculateVictoryPoints as calcVP, longestRoadLength as longestRoadLen, rankPlayers, troopTotal } from "../../game/scoringReducer.js";
import { MAX_WAGONS_PER_GAME as WMAX, WAGON_COST as WCOST, homeHexes, remoteVillageSpots as farSpots } from "../../game/explorationReducer.js";
import { VICTORY_POINT_ATTRIBUTES as VPATTR } from "../../game/gameFactory.js";
import { isClassicMode as CLASSICO, isExplorationMode, isRapidMode, isWarMode as GUERRA } from "../../game/gameModes.js";
import { characterById as charOf } from "../../game/characterCatalog.js";
import { createInitialGameUiState, gameUiCloseDecision, gameUiOpenDecision, gameUiReducer, gameUiSet } from "./gameUiState.js";
import useGameScreenRuntime from "./useGameScreenRuntime.js";
import { formatReconnectClock } from "./gameScreenRuntimeModel.js";
import useGameScreenAudio from "./useGameScreenAudio.js";
import { deriveGameOverlayVisibility } from "./gameOverlayVisibility.js";
import { deriveActionPresentation } from "./gameUiComposition.js";
import { shouldContinueRoadPlacement } from "./constructionPlacementPolicy.js";
import { buildGameActionModel, GAME_ACTION_COMMAND } from "./gameActionModel.js";
import { boardInteractionBlockReason, developmentCardPlayReason } from "./gameInteractionGuards.js";
import { createGameActionDispatchGate } from "./gameActionDispatchGate.js";
import { GameDecisionSystem } from "./decisions/index.js";
import GameEmoteBubble from "./social/GameEmoteBubble.jsx";
import CharacterSubtitle from "./social/CharacterSubtitle.jsx";
import useCharacterSubtitles from "./useCharacterSubtitles.js";
import GameStoryToast from "./GameStoryToast.jsx";
import GameActionToast from "./GameActionToast.jsx";
import DevelopmentCardReveal from "./DevelopmentCardReveal.jsx";
import DiceRollOverlay from "./DiceRollOverlay.jsx";
import EndgameExperience from "./endgame/EndgameExperience.jsx";
import GameGrimoirePanel from "./hud/GameGrimoirePanel.jsx";
import { GAME_ACTION_ICONS } from "../../assets/gameUiIcons.js";
import { warUnitName } from "../../presentation/gameLabels.js";
import { t } from "../../locales/i18n.js";

const Board3D = lazy(preloadBoardModule);
const PERKS = CHARACTER_PERKS;
const EXPL = (game) => isExplorationMode(game?.mode);
const RAPIDO = (game) => isRapidMode(game?.mode);
const hexOf = (game, key) => game.board.hexes.find((hex) => hex.k === key);
const isHid = (game, key) => !!hexOf(game, key)?.hid;
const pname = (game, index) => charOf(game.players[index].ch).n;
const milLeft = militaryActionsLeft;
const hasPerk = (game, playerIndex, characterId) => GUERRA(game.mode) && game.perksOn !== false && game.gelo?.active && game.players?.[playerIndex]?.ch === characterId;
function Modal({ children, onClose, center }) {
  const dialogRef = useRef(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    const previous = document.activeElement;
    dialogRef.current?.focus();
    const onKeyDown = (event) => { if (event.key === "Escape") onCloseRef.current?.(); };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus();
    };
  }, []);
  return <div className={"modalbg" + (center ? " center" : "")} onClick={onClose}><div ref={dialogRef} className="modal" role="dialog" aria-modal="true" aria-label={t("a11y.dialog")} tabIndex={-1} onClick={(event) => event.stopPropagation()}>{children}</div></div>;
}



export default function GameScreen({ game, seat, dispatchGameAction, toast, dismissed, emotes, sendEmote, chat, sendChat, onExit, graphicsQuality, settings, setSetting, fullscreen, onToggleFullscreen, onRematch }) {
    const g = game;
    const presentation = g.presentation;
    const gameLog = presentation.log;
    const cardEvent = presentation.cardReveal;
    const awardEvent = presentation.award;
    const storyEvent = presentation.story;
    const disasterEvent = presentation.disaster;
    const characterSubtitles = useCharacterSubtitles({ game: g, emotes });
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
    const {
        graph: gr,
        currentActor: cur,
        localPlayer: me,
        queueItem: qItem,
        requiredActor,
        requiredPlayer,
        canHumanAct,
        myTurn,
        requiredReconnectSeconds,
        reconnectSecondsByPlayer,
    } = useGameScreenRuntime(g, seat);
    const [, force] = useState(0);
    const setupMode = g.phase === "setup";
    useEffect(() => {
        dispatchUi({ type: "reset-turn-interaction" });
    }, [cur, g.phase]);
    const hardInteractionBlock = !!qItem || !!g.turn.steal || !!g.trade || !!g.turn.mustDragon || !!g.turn.deploy;
    useEffect(() => {
        if (hardInteractionBlock) dispatchUi({ type: "reset-turn-interaction" });
    }, [hardInteractionBlock, qItem?.t, qItem?.p, g.trade?.id, g.turn.steal?.at, g.turn.deploy, g.turn.mustDragon]);
    const canContinueRoadPlacement = (me.freeRoads || 0) > 0 || canPay(me, COSTS.estrada);
    useEffect(() => {
        if (mode === "estrada" && g.phase === "play" && !canContinueRoadPlacement)
            setMode(null);
    }, [mode, g.phase, canContinueRoadPlacement]);
    const {
        cardVisible,
        disasterVisible,
        awardVisible,
        dragonStoryVisible,
        storyVisible,
    } = deriveGameOverlayVisibility(presentation, seat, dismissed.current, Date.now());
    useGameScreenAudio({ game: g, seat, awardEvent, awardVisible });
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
            else if (mode === "estrada" && canContinueRoadPlacement)
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
    const finishConstructionPlacement = () => {
        setMode(null);
        setActionPanelMinimized(false);
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
            afterAccepted(GAME_ACTION.BUILD_VILLAGE, { vertex: v }, finishConstructionPlacement);
            return;
        }
        if (mode === "palacio") {
            afterAccepted(GAME_ACTION.BUILD_PALACE, { vertex: v }, finishConstructionPlacement);
        }
    };
    const onEdge = (e) => {
        const freeRoadsBefore = me.freeRoads || 0;
        afterAccepted(GAME_ACTION.BUILD_ROAD, { edge: e }, () => {
            // Construção normal volta ao menu depois de uma peça. O Construtor
            // de Estradas é a exceção intencional: a primeira das duas estradas
            // grátis mantém a colocação ativa para a segunda; a segunda fecha.
            if (!shouldContinueRoadPlacement({ setupMode, freeRoadsBefore })) {
                finishConstructionPlacement();
            }
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
        if (onExit && window.confirm(seat === 0 ? t("game.leaveHost") : t("game.leaveGuest")))
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
            reconnectSeconds={reconnectSecondsByPlayer[i]}
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
        >
          {emotes && emotes[i] && <GameEmoteBubble key={"em" + emotes[i].id} emoteId={emotes[i].k}/>}
          <CharacterSubtitle characterName={ch.n} subtitle={characterSubtitles[i]} />
        </PlayerBanner>;
    })}</PlayerRail>;
    let status = null;
    if (g.phase === "ended")
        status = t("game.won", { name: pname(g, g.winner) });
    else if (requiredPlayer?.connected === false && requiredReconnectSeconds != null)
        status = t("game.waitingFor", { name: pname(g, requiredActor), time: formatReconnectClock(requiredReconnectSeconds) });
    else if (qItem)
        status = qItem.p === seat ? null : t("game.waitingDecision", { name: pname(g, qItem.p) });
    else if (g.turn.steal)
        status = myTurn ? null : t("game.chooseVictim", { name: pname(g, cur) });
    else if (setupMode)
        status = myTurn
            ? g.setup.needRoad
                ? t("game.placeRoad")
                : (RAPIDO(g) ? t("game.placePalace") : t("game.placeVillage")) + (g.setup.i >= g.players.length ? t("game.secondGivesResources") : "")
            : t("game.foundingRealm", { name: pname(g, cur) });
    else if (myTurn && g.turn.mustDragon)
        status = t("game.chooseDragonHex");
    else if (myTurn && GUERRA(g.mode) && g.turn.deploy)
        status = t("game.deployUnit", { unit: warUnitName(g.turn.deploy) });
    else if (myTurn && GUERRA(g.mode) && selU != null && g.units[selU])
        status = warUnitName(g.units[selU].t) + (g.units[selU].t === "arqueiro"
            ? t("game.archerCommand")
            : t("game.meleeCommand")) + t("game.militaryActions", { count: milLeft(g) });
    else if (myTurn && !g.turn.rolled)
        status = null;
    else if (!myTurn)
        status = t("game.turnOf", { name: pname(g, cur) }) + (g.turn.rolled ? "" : t("game.rollingDice")) + "…";
    else if (mode === "mover" && wsel)
        status = wsel.mv > 0
            ? t("game.movesLeft", { count: wsel.mv, cargo: wsel.cargo ? t("game.withColonistsSuffix") : "" })
            : t("game.wagonSpent");
    else if (mode)
        status = {
            estrada: t("game.tapGoldenEdge"),
            aldeia: t("game.tapGoldenPoint"),
            palacio: t("game.upgradeVillage"),
            carruagem: t("game.placeWagon"),
            fundar: t("game.foundRemote"),
            suborno: t("game.chooseBribe"),
        }[mode];
    return  <AppShell data-testid="game-screen" data-game-mode={g.mode} data-game-phase={g.phase}><div style={{ position: "fixed", inset: 0, zIndex: 0 }}><Suspense fallback={<SceneLoading label={t("game.preparingBoard")} />}><Board3D g={g} gr={gr} spotsV={spotsV} spotsE={spotsE} spotsH={spotsH} onVert={onVert} onEdge={onEdge} onHex={onHex} graphicsQuality={graphicsQuality} seat={seat} reducedMotion={settings?.reducedMotion === true}/></Suspense></div><DiceRollOverlay game={g} reducedMotion={settings?.reducedMotion === true} /><GameActionToast game={g} entries={gameLog} />{toast &&  <div className={"toast"}>{toast.msg}</div>}<GameHud
        code={g.code}
        round={g.round}
        dice={g.turn.dice}
        diceAnimationKey={gameLog.length && g.turn.dice ? g.turn.dice.join("") + g.round + g.turn.pos : "idle"}
        status={status}
        fullscreen={fullscreen}
        onToggleFullscreen={onToggleFullscreen}
    />{playersRow}{GUERRA(g.mode) && g.troll && g.troll.awake && !g.troll.defeated && g.troll.giant &&  <div className={"trollhud"}><div className={"th-top"}>{t("game.giantTroll")}<span className={"th-hp"}>{g.troll.giant.hp + "/" + g.troll.giant.maxHp}</span></div><div className={"th-bar"}><div className={"th-fill"} style={{ width: Math.max(0, 100 * g.troll.giant.hp / g.troll.giant.maxHp) + "%" }}/></div><div className={"th-dmg"}>{g.players.map((pp, i) =>  <span key={i} className={"th-c"} title={t("game.damage", { name: pname(g, i), count: g.troll.dmg[i] || 0 })}><i style={{ background: GLOW[pp.ch] }}/>{g.troll.dmg[i] || 0}</span>)}</div>{g.troll.giant.at === "0,0" &&  <div className={"th-warn"}>{t("game.giantHeart")}</div>}</div>}{GUERRA(g.mode) && g.troll && !g.troll.awake && g.troll.rush > 0 &&  <div className={"trollhud omen"}><div className={"th-top"}>{t("game.swampStirs")}<span className={"th-hp"}>{g.troll.rush + "/" + g.players.length}</span></div></div>}
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
        return  <Modal center={true} onClose={() => setZoomCard(null)}><div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}><div style={{ width: 235 }}><DevelopmentCard card={c} characterId={me.ch} /></div>{zoomCard.nov &&  <p className={"quote"}>{t("game.newCardNextTurn")}</p>}{c.kind === "vp" &&  <p className={"quote"}>{t("game.secretVpCard")}</p>}{zoomCard.lib &&  <p className={"quote"}>{t("game.grimoirePreview")}</p>}{c.kind !== "vp" && !zoomCard.nov && !zoomCard.lib && playReason &&  <p style={{ color: "#e08a8a", fontSize: 14, textAlign: "center" }}>{playReason}</p>}{c.kind !== "vp" && !zoomCard.nov && !zoomCard.lib &&  <button className={"btn gold rd-card-play-button"} style={{ width: "100%" }} disabled={!playable} onClick={playFromZoom}><GameIcon name={GAME_ACTION_ICONS.card} size={24} alt="" />{t("game.playCard")}</button>}</div></Modal>;
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
    />}{showCards &&  <Modal onClose={() => setShowCards(false)}><div style={{ display: "flex", alignItems: "center", marginBottom: 10, gap: 8 }}><h3 className={"f-t"} style={{ color: "#e0b23a", flex: 1 }}>{t("game.yourCards")}</h3><button className={"btn sm ghost"} onClick={() => setShowLib(true)}>{t("game.grimoire")}</button></div>{me.devOld.length + me.devNew.length === 0 &&  <p className={"quote"}>{t("game.noDevelopmentCards")}</p>}{me.devOld.map((c) => {
        const playReason = developmentCardPlayReason(g, gr, seat, c, { myTurn });
        return <DevelopmentCardListItem key={c.id} card={c} characterId={me.ch} status={playReason} disabled={playReason != null} onPlay={c.kind === "vp" ? null : () => beginDevCard(c)} />;
    })}{me.devNew.map((c) => <DevelopmentCardListItem key={c.id} card={c} characterId={me.ch} status={t("game.newCardNextTurn")} dim />)}<div className="rd-army-summary" style={{ marginTop: 10 }}><span><GameIcon name={GAME_ACTION_ICONS.cavaleiro} size={22} alt="" /><b>{me.troops.cavaleiro}</b></span><span><GameIcon name={GAME_ACTION_ICONS.catapulta} size={22} alt="" /><b>{me.troops.catapulta}</b></span><span><GameIcon name={GAME_ACTION_ICONS.arqueiro} size={22} alt="" /><b>{me.troops.arqueiro}</b></span>{me.immune && <strong>{t("hud.weaponTrinity")}</strong>}</div></Modal>}{g.trade && g.trade.from === seat &&  <div className={"toast"} style={{ top: 52 }}>{t("game.waitingTrade", { name: g.trade.to === "all" ? t("game.tradeEveryone") : pname(g, g.trade.to) })}{" "}<button className={"btn sm ghost"} onClick={() => void runGameAction(GAME_ACTION.CANCEL_TRADE, { tradeId: g.trade.id })}>{t("game.cancelTrade")}</button></div>}{cardVisible && <DevelopmentCardReveal
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
    }} />}{g.phase === "ended" && g.winner != null && <EndgameExperience game={g} graph={gr} seat={seat} chat={chat || []} sendChat={sendChat} onExit={onExit} onRematch={onRematch} />} {utilityPanel === HUD_UTILITY.OPTIONS &&  <OptionsUtilityPanel
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
    />}{showLib &&  <Modal onClose={() => setShowLib(false)}><h3 className={"f-t"} style={{ color: "#e0b23a", marginBottom: 4 }}>{t("game.cardGrimoire")}</h3><p style={{ fontSize: 13, color: "#a8905c", marginBottom: 10 }}>{t("game.deckRemainingShort", { count: g.deck.length })}</p>{CLASSICO(g.mode) &&  <p style={{ fontSize: 13, color: "#7db4d8", marginBottom: 10 }}>{t("game.classicRules")}</p>}{GUERRA(g.mode) && <p style={{ fontSize: 13, color: "#e08a8a", marginBottom: 10 }}>{t("game.warRules")}</p>}{EXPL(g) &&  <p style={{ fontSize: 13, color: "#e8a06b", marginBottom: 10 }}>{t("game.explorationGrimoireDetail")}</p>}<div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center" }}>{[
        { kind: "tropa", sub: "cavaleiro" },
        { kind: "tropa", sub: "catapulta" },
        { kind: "tropa", sub: "arqueiro" },
        ...VPATTR.map((a) => ({ kind: "vp", sub: a })),
        { kind: "monopolio" },
        { kind: "descoberta" },
        { kind: "estradas" }
    ].map((c, i) =>  <div key={i} style={{ width: "30%", minWidth: 94, cursor: "pointer" }} onClick={() => setZoomCard({ c: { ...c, id: "lib" + i }, nov: false, lib: true })}><DevelopmentCard card={c} characterId={me.ch} mini /></div>)}</div><p style={{ fontSize: 13, color: "#a8905c", marginTop: 10, textAlign: "center" }}>{t("game.deckComposition")}<br />{t("game.touchCard")}</p></Modal>}{utilityPanel === HUD_UTILITY.HISTORY &&  <ChronicleLog game={g} entries={gameLog} onClose={closeUtility}/>}</AppShell>;
}
