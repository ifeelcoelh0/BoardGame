import { applyGameAction } from "../src/game/gameActionReducer.js";
import { chooseBotAction, createBotDecisionMemory } from "../src/game/botPolicy.js";
import { listLegalActions } from "../src/game/legalActions.js";
import { createInitialGame, createPlayer } from "../src/game/gameFactory.js";
import { reduceLobbyToSetup } from "../src/game/gameSetupReducer.js";
import { createGameStateView } from "../src/game/gameStateView.js";
import { activateBotController } from "../src/game/playerPresence.js";
import { makeBoardGraph } from "../src/game/boardGeometry.js";
import { vertexProductionProfile } from "../src/game/productionPotential.js";
import { CHARACTERS, characterName } from "../src/game/characterCatalog.js";
import { TERRAIN_RESOURCE_BY_TYPE } from "../src/game/constructionReducer.js";
import { GAME_ACTION } from "../src/game/gameProtocol.js";
import { botProfile, botProfilesForGame } from "../src/game/botProfiles.js";
import { isRapidMode } from "../src/game/gameModes.js";
import { handSize } from "../src/game/resources.js";
import { nextBotActorIndex } from "../src/multiplayer/hostBotController.js";
import {
  balancedRosterForGame,
  createBalancePlayerRecord,
  finalizeBalanceRecord,
  recordAcceptedAction,
  recordBalanceEvents,
  summarizeBalanceLab,
} from "./balance-lab-metrics.mjs";

export const DEFAULT_BENCHMARK_SEED = 0x5eed1234;
export const DEFAULT_MAX_STEPS = 8000;
export const BENCHMARK_RNG_VERSION = 2;

export function seededRandom(initialSeed = DEFAULT_BENCHMARK_SEED) {
  let seed = initialSeed >>> 0;
  return () => {
    seed = (1664525 * seed + 1013904223) >>> 0;
    return seed / 2 ** 32;
  };
}

export function idFactory() {
  let sequence = 1;
  return (prefix) => `${prefix}_${(sequence++).toString(16).padStart(24, "0")}`;
}

function gameSeed(baseSeed, gameIndex) {
  // Knuth multiplicative step: deterministic, cheap, and independent per game.
  return (Number(baseSeed) + Math.imul(gameIndex + 1, 0x9e3779b1)) >>> 0;
}

export function rosterForGame(gameIndex, playerCount, characterIds = CHARACTERS.map(({ id }) => id)) {
  if (!Number.isSafeInteger(playerCount) || playerCount < 2 || playerCount > 4) {
    throw new RangeError("O benchmark suporta entre 2 e 4 bots.");
  }
  if (!Array.isArray(characterIds) || characterIds.length < playerCount) {
    throw new RangeError("Não existem personagens suficientes para formar a mesa.");
  }
  return balancedRosterForGame(gameIndex, playerCount, characterIds);
}

export function createBotTable({ mode = "dragao", seed = DEFAULT_BENCHMARK_SEED, playerCount = 4, roster } = {}) {
  const rng = seededRandom(seed);
  const botRngs = Array.from({ length: playerCount }, (_, playerIndex) => (
    seededRandom((seed ^ Math.imul(playerIndex + 1, 0x85ebca6b) ^ 0xc2b2ae35) >>> 0)
  ));
  const makeId = idFactory();
  const characterIds = roster || rosterForGame(0, playerCount);
  const game = createInitialGame({
    code: "BENCH",
    hostCharacterId: characterIds[0],
    mode,
    rng,
    idFactory: makeId,
    hostIdentity: { characterConfirmed: true, connected: true },
  });
  activateBotController(game.players[0]);
  game.players[0].ready = true;

  for (const characterId of characterIds.slice(1)) {
    const player = createPlayer(characterId, { characterConfirmed: true, connected: true }, { idFactory: makeId });
    activateBotController(player);
    player.ready = true;
    game.players.push(player);
  }

  return {
    game: reduceLobbyToSetup(game, { rng }).game,
    rng,
    botRngs,
    makeId,
    roster: characterIds.slice(),
  };
}

function rareNumberVertices(game, number, graph = makeBoardGraph(game.board.hexes)) {
  const vertices = new Set();
  for (const hex of game.board.hexes || []) {
    if (hex?.num !== number) continue;
    for (const vertex of graph.hexMap?.[hex.k]?.corners || []) vertices.add(vertex);
  }
  return vertices;
}

function playerHasBuildingOn(game, playerIndex, vertices) {
  for (const vertex of vertices) {
    if (game.builds?.[vertex]?.p === playerIndex) return true;
  }
  return false;
}

function sumProduction(gains) {
  if (!Array.isArray(gains)) return 0;
  return gains.reduce((total, resources) => total + Object.values(resources || {})
    .reduce((sum, amount) => sum + (Number(amount) || 0), 0), 0);
}

function averageFinite(values) {
  const finite = values.filter(Number.isFinite);
  return finite.length ? finite.reduce((sum, value) => sum + value, 0) / finite.length : null;
}

function setupPlacementSnapshot(game, actorIndex, action) {
  if (game.phase !== "setup" || game.setup?.needRoad || action?.type !== GAME_ACTION.BUILD_VILLAGE) return null;
  const graph = makeBoardGraph(game.board?.hexes || []);
  const candidates = listLegalActions(game, actorIndex)
    .filter((candidate) => candidate.type === GAME_ACTION.BUILD_VILLAGE)
    .map((candidate) => vertexProductionProfile(game, graph, candidate.vertex));
  const chosen = candidates.find((candidate) => candidate.vertex === action.vertex)
    || vertexProductionProfile(game, graph, action.vertex);
  const best = candidates.slice().sort((a, b) => b.score - a.score || b.pips - a.pips)[0] || chosen;
  const chosenRank = 1 + candidates.filter((candidate) => candidate.score > chosen.score).length;
  const multiplier = isRapidMode(game.mode) ? 2 : 1;
  const resources = [...new Set(chosen.terrains
    .map((terrain) => TERRAIN_RESOURCE_BY_TYPE[terrain])
    .filter(Boolean))].sort();

  return {
    placementNumber: game.setup.i < game.players.length ? 1 : 2,
    setupSequenceIndex: game.setup.i,
    turnOrderPosition: game.order?.indexOf(actorIndex) ?? -1,
    vertex: action.vertex,
    pips: chosen.pips,
    weightedPips: chosen.pips * multiplier,
    expectedProductionPerRoll: (chosen.pips * multiplier) / 36,
    productiveHexes: chosen.productiveHexes,
    resourceDiversity: resources.length,
    resources,
    numbers: chosen.numbers,
    candidateCount: candidates.length,
    chosenScore: chosen.score,
    chosenRank,
    bestAvailableScore: best.score,
    bestAvailablePips: best.pips,
    opportunityLossScore: Math.max(0, best.score - chosen.score),
    initialResourceGains: {},
    initialResourceTotal: 0,
  };
}

function recordSetupPlacement(record, actorIndex, snapshot, event) {
  if (!snapshot) return;
  const player = record.players[actorIndex];
  if (!player) return;
  const gains = event?.type === "SETUP_SETTLEMENT_BUILT" ? (event.resourceGains || {}) : {};
  snapshot.initialResourceGains = { ...gains };
  snapshot.initialResourceTotal = Object.values(gains).reduce((sum, amount) => sum + (Number(amount) || 0), 0);
  player.setupPlacements.push(snapshot);
  player.setupPips = player.setupPlacements.reduce((sum, placement) => sum + placement.pips, 0);
  player.setupWeightedPips = player.setupPlacements.reduce((sum, placement) => sum + placement.weightedPips, 0);
  player.setupInitialResources = player.setupPlacements.reduce((sum, placement) => sum + placement.initialResourceTotal, 0);
  player.setupResourceDiversity = new Set(player.setupPlacements.flatMap((placement) => placement.resources)).size;
  player.setupNumberDiversity = new Set(player.setupPlacements.flatMap((placement) => placement.numbers)).size;
  player.setupAverageChosenRank = averageFinite(player.setupPlacements.map((placement) => placement.chosenRank));
  player.setupAverageOpportunityLossScore = averageFinite(player.setupPlacements.map((placement) => placement.opportunityLossScore));
}

function recordImmunityValue(gameBefore, event, record, graph) {
  if (event?.type === "DRAGON_PLACED") {
    for (const excluded of event.excluded || []) {
      if (excluded?.reason !== "IMMUNE" || !Number.isSafeInteger(excluded.playerIndex)) continue;
      if (handSize(gameBefore.players?.[excluded.playerIndex]) <= 0) continue;
      const player = record.players[excluded.playerIndex];
      if (player) player.dragonStealsAvoidedByImmunity += 1;
    }
    return;
  }

  if (event?.type !== "DICE_ROLLED" || !event.production || !gameBefore.board?.dragon) return;
  if (!gameBefore.players?.some((player) => player?.immune)) return;
  const dragonHex = graph?.hexMap?.[gameBefore.board.dragon];
  if (!dragonHex || dragonHex.num !== event.total) return;
  for (const vertex of dragonHex.corners || []) {
    const building = gameBefore.builds?.[vertex];
    if (!building || !gameBefore.players?.[building.p]?.immune) continue;
    const player = record.players[building.p];
    if (player) player.dragonProductionSavedByImmunity += Number(building.t) || 0;
  }
}

function recordRarePresence(game, players, vertices2, vertices12) {
  for (let playerIndex = 0; playerIndex < players.length; playerIndex += 1) {
    const record = players[playerIndex];
    if (!record.built2 && playerHasBuildingOn(game, playerIndex, vertices2)) {
      record.built2 = true;
      record.built2Round = game.round || 1;
    }
    if (!record.built12 && playerHasBuildingOn(game, playerIndex, vertices12)) {
      record.built12 = true;
      record.built12Round = game.round || 1;
    }
  }
}

function recordAppliedEvents(applied, gameBefore, gameAfter, record, graph) {
  recordBalanceEvents(record, applied.events || []);
  for (const event of applied.events || []) {
    recordImmunityValue(gameBefore, event, record, graph);
    if (event?.type === "DICE_ROLLED") {
      record.rolls += 1;
      if (event.total === 2 || event.total === 12) {
        const key = event.total === 2 ? "two" : "twelve";
        record[key].rolls += 1;
        const produced = sumProduction(event.production?.gains);
        record[key].resourcesProduced += produced;
        if (produced > 0) record[key].productiveRolls += 1;
        for (let playerIndex = 0; playerIndex < record.players.length; playerIndex += 1) {
          const amount = Object.values(event.production?.gains?.[playerIndex] || {})
            .reduce((sum, value) => sum + (Number(value) || 0), 0);
          if (amount > 0) {
            record.players[playerIndex][key === "two" ? "resourcesFrom2" : "resourcesFrom12"] += amount;
          }
        }
      }
    }

    if (event?.type === "DISASTER_RESOLVED" && (event.sacredNumber === 2 || event.sacredNumber === 12)) {
      const key = event.sacredNumber === 2 ? "two" : "twelve";
      const disaster = record[key].disasters;
      if (event.outcome === "APPLIED") disaster.applied += 1;
      else if (event.outcome === "NO_PROTECTED") disaster.noProtected += 1;
      else if (event.outcome === "NO_TARGETS") disaster.noTargets += 1;
      if (event.disasterType) disaster.byType[event.disasterType] = (disaster.byType[event.disasterType] || 0) + 1;
    }

    if (event?.type === "DEVELOPMENT_CARD_PLAYED" && event.card?.kind === "tropa") {
      const player = record.players[event.actorIndex];
      if (!player) continue;
      const troopType = event.card.sub;
      if (troopType && !player.firstTroopOrder.includes(troopType)) player.firstTroopOrder.push(troopType);
      if (event.details?.trinityCompleted && !player.trinity) {
        player.trinity = true;
        player.trinityRound = gameAfter.round || 1;
        player.trinityOrder = player.firstTroopOrder.slice(0, 3);
      }
    }
  }
}

export function simulateBotGame({
  mode = "dragao",
  playerCount = 4,
  baseSeed = DEFAULT_BENCHMARK_SEED,
  gameIndex = 0,
  maxSteps = DEFAULT_MAX_STEPS,
  characterIds,
  strategySet = "balanced",
} = {}) {
  const roster = rosterForGame(gameIndex, playerCount, characterIds);
  const seed = gameSeed(baseSeed, gameIndex);
  const table = createBotTable({ mode, seed, playerCount, roster });
  const botProfiles = botProfilesForGame(gameIndex, playerCount, strategySet);
  const botMemories = Array.from({ length: playerCount }, () => createBotDecisionMemory());
  let game = table.game;
  let steps = 0;

  const record = {
    gameIndex,
    seed,
    mode,
    playerCount,
    roster: table.roster.slice(),
    strategySet,
    botProfiles: botProfiles.slice(),
    completed: false,
    steps: 0,
    rounds: 0,
    winnerIndex: null,
    winnerCharacter: null,
    actionsByType: {},
    rolls: 0,
    two: { rolls: 0, productiveRolls: 0, resourcesProduced: 0, disasters: { applied: 0, noProtected: 0, noTargets: 0, byType: {} } },
    twelve: { rolls: 0, productiveRolls: 0, resourcesProduced: 0, disasters: { applied: 0, noProtected: 0, noTargets: 0, byType: {} } },
    players: game.players.map((player, playerIndex) => ({
      ...createBalancePlayerRecord(player, playerIndex),
      botProfileId: botProfiles[playerIndex] || "balanced",
      botProfileName: botProfile(botProfiles[playerIndex]).label,
      built2: false,
      built12: false,
      built2Round: null,
      built12Round: null,
      resourcesFrom2: 0,
      resourcesFrom12: 0,
      trinity: false,
      trinityRound: null,
      trinityOrder: [],
      firstTroopOrder: [],
      finalBuildingCount: 0,
    })),
  };

  for (let playerIndex = 0; playerIndex < record.players.length; playerIndex += 1) {
    record.players[playerIndex].turnOrderPosition = game.order?.indexOf(playerIndex) ?? null;
  }

  const graph = makeBoardGraph(game.board?.hexes || []);
  const vertices2 = rareNumberVertices(game, 2, graph);
  const vertices12 = rareNumberVertices(game, 12, graph);
  recordRarePresence(game, record.players, vertices2, vertices12);

  while (game.phase !== "ended" && steps < maxSteps) {
    const actorIndex = nextBotActorIndex(game);
    if (actorIndex < 0) {
      record.failure = { step: steps, reason: "BOT_ACTOR_MISSING" };
      break;
    }
    const player = game.players[actorIndex];
    const view = createGameStateView(game, player.playerId);
    const action = chooseBotAction(view, actorIndex, {
      rng: table.botRngs[actorIndex],
      profileId: botProfiles[actorIndex],
      memory: botMemories[actorIndex],
    });
    if (!action) {
      record.failure = { step: steps, actorIndex, reason: "LEGAL_BOT_ACTION_MISSING" };
      break;
    }
    const gameBefore = game;
    const setupSnapshot = setupPlacementSnapshot(gameBefore, actorIndex, action);
    const applied = applyGameAction(gameBefore, player.playerId, action, {
      rng: table.rng,
      now: () => steps * 1000,
      createId: table.makeId,
    });
    if (!applied.ok) {
      record.failure = { step: steps, actorIndex, reason: applied.reason, action };
      break;
    }
    game = applied.game;
    recordAcceptedAction(record, actorIndex, action);
    recordAppliedEvents(applied, gameBefore, game, record, graph);
    const setupEvent = (applied.events || []).find((event) => event?.type === "SETUP_SETTLEMENT_BUILT");
    recordSetupPlacement(record, actorIndex, setupSnapshot, setupEvent);
    recordRarePresence(game, record.players, vertices2, vertices12);
    steps += 1;
  }

  record.steps = steps;
  record.rounds = game.round || 0;
  record.completed = game.phase === "ended" && Number.isSafeInteger(game.winner);
  if (record.completed) {
    record.winnerIndex = game.winner;
    record.winnerCharacter = game.players[game.winner]?.ch || null;
    if (record.players[game.winner]) record.players[game.winner].winner = true;
  } else if (!record.failure) {
    record.failure = { step: steps, reason: "MAX_STEPS_REACHED" };
  }

  finalizeBalanceRecord(record, game);

  // Internal working state is not part of exported benchmark data.
  for (const player of record.players) delete player.firstTroopOrder;
  return record;
}

export function runBenchmarkBatch({
  mode = "dragao",
  playerCount = 4,
  games = 1000,
  startIndex = 0,
  baseSeed = DEFAULT_BENCHMARK_SEED,
  maxSteps = DEFAULT_MAX_STEPS,
  characterIds,
  strategySet = "balanced",
  onProgress,
} = {}) {
  const records = [];
  for (let offset = 0; offset < games; offset += 1) {
    const gameIndex = startIndex + offset;
    records.push(simulateBotGame({ mode, playerCount, baseSeed, gameIndex, maxSteps, characterIds, strategySet }));
    onProgress?.(offset + 1, games, gameIndex);
  }
  return records;
}

export function percentage(numerator, denominator) {
  return denominator > 0 ? (100 * numerator) / denominator : null;
}

function round2(value) {
  return value == null ? null : Math.round(value * 100) / 100;
}

function rate(players, predicate) {
  const cohort = players.filter(predicate);
  const wins = cohort.filter((player) => player.winner).length;
  return {
    n: cohort.length,
    wins,
    winRate: round2(percentage(wins, cohort.length)),
  };
}

function comparison(players, predicate) {
  const withCohort = rate(players, predicate);
  const withoutCohort = rate(players, (player) => !predicate(player));
  return {
    with: withCohort,
    without: withoutCohort,
    deltaPercentagePoints: withCohort.winRate == null || withoutCohort.winRate == null
      ? null
      : round2(withCohort.winRate - withoutCohort.winRate),
  };
}

function rarePresenceCategory(player) {
  if (player.built2 && player.built12) return "both";
  if (player.built2) return "only2";
  if (player.built12) return "only12";
  return "none";
}

function standardizedComparisonByBuildings(players, predicate) {
  const strata = [...new Set(players.map((player) => player.finalBuildingCount).filter(Number.isFinite))].sort((a, b) => a - b);
  const eligible = [];
  for (const buildingCount of strata) {
    const stratum = players.filter((player) => player.finalBuildingCount === buildingCount);
    const withPlayers = stratum.filter(predicate);
    const withoutPlayers = stratum.filter((player) => !predicate(player));
    if (!withPlayers.length || !withoutPlayers.length) continue;
    eligible.push({
      buildingCount,
      n: stratum.length,
      withWinRate: percentage(withPlayers.filter((player) => player.winner).length, withPlayers.length),
      withoutWinRate: percentage(withoutPlayers.filter((player) => player.winner).length, withoutPlayers.length),
    });
  }
  const totalWeight = eligible.reduce((sum, stratum) => sum + stratum.n, 0);
  if (!totalWeight) {
    return { withWinRate: null, withoutWinRate: null, deltaPercentagePoints: null, coveredObservations: 0, strata: [] };
  }
  const withWinRate = eligible.reduce((sum, stratum) => sum + stratum.withWinRate * stratum.n, 0) / totalWeight;
  const withoutWinRate = eligible.reduce((sum, stratum) => sum + stratum.withoutWinRate * stratum.n, 0) / totalWeight;
  return {
    withWinRate: round2(withWinRate),
    withoutWinRate: round2(withoutWinRate),
    deltaPercentagePoints: round2(withWinRate - withoutWinRate),
    coveredObservations: totalWeight,
    strata: eligible.map((stratum) => ({
      ...stratum,
      withWinRate: round2(stratum.withWinRate),
      withoutWinRate: round2(stratum.withoutWinRate),
    })),
  };
}

function rareCategorySummary(players) {
  const categories = [
    ["none", "Nenhum"],
    ["only2", "Só 2"],
    ["only12", "Só 12"],
    ["both", "2 e 12"],
  ];
  return categories.map(([id, label]) => {
    const cohort = players.filter((player) => rarePresenceCategory(player) === id);
    const wins = cohort.filter((player) => player.winner).length;
    return { id, label, n: cohort.length, sharePct: round2(percentage(cohort.length, players.length)), wins, winRatePct: round2(percentage(wins, cohort.length)) };
  });
}

function rareCategoriesByBuildingCount(players) {
  const counts = [...new Set(players.map((player) => player.finalBuildingCount).filter(Number.isFinite))].sort((a, b) => a - b);
  return counts.map((buildingCount) => {
    const stratum = players.filter((player) => player.finalBuildingCount === buildingCount);
    const categories = Object.fromEntries(["none", "only2", "only12", "both"].map((id) => {
      const cohort = stratum.filter((player) => rarePresenceCategory(player) === id);
      return [id, { n: cohort.length, winRatePct: round2(percentage(cohort.filter((player) => player.winner).length, cohort.length)) }];
    }));
    return { buildingCount, n: stratum.length, overallWinRatePct: round2(percentage(stratum.filter((player) => player.winner).length, stratum.length)), categories };
  });
}

function average(values) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

function aggregateRareNumber(records, key, totalRolls) {
  const rolls = records.reduce((sum, record) => sum + record[key].rolls, 0);
  const productiveRolls = records.reduce((sum, record) => sum + record[key].productiveRolls, 0);
  const resourcesProduced = records.reduce((sum, record) => sum + record[key].resourcesProduced, 0);
  const gamesWith = records.filter((record) => record[key].rolls > 0).length;
  const applied = records.reduce((sum, record) => sum + record[key].disasters.applied, 0);
  const noProtected = records.reduce((sum, record) => sum + record[key].disasters.noProtected, 0);
  const noTargets = records.reduce((sum, record) => sum + record[key].disasters.noTargets, 0);
  const byType = {};
  for (const record of records) {
    for (const [type, count] of Object.entries(record[key].disasters.byType || {})) byType[type] = (byType[type] || 0) + count;
  }
  const actualShare = percentage(rolls, totalRolls);
  return {
    rolls,
    shareOfRollsPct: round2(actualShare),
    theoreticalSharePct: round2(100 / 36),
    deviationFromTheoryPp: actualShare == null ? null : round2(actualShare - (100 / 36)),
    gamesWithAtLeastOnePct: round2(percentage(gamesWith, records.length)),
    productiveRollsPct: round2(percentage(productiveRolls, rolls)),
    resourcesProduced,
    resourcesPerRareRoll: round2(rolls ? resourcesProduced / rolls : 0),
    disasterAppliedPct: round2(percentage(applied, rolls)),
    disasterNoProtectedPct: round2(percentage(noProtected, rolls)),
    disasterNoTargetsPct: round2(percentage(noTargets, rolls)),
    disasterTypes: Object.entries(byType).map(([type, count]) => ({ type, count, pct: round2(percentage(count, applied)) })).sort((a, b) => b.count - a.count),
  };
}

function aggregateCharacter(players, characterId) {
  const entries = players.filter((player) => player.characterId === characterId);
  const wins = entries.filter((player) => player.winner).length;
  const built2 = entries.filter((player) => player.built2).length;
  const built12 = entries.filter((player) => player.built12).length;
  const trinity = entries.filter((player) => player.trinity).length;
  return {
    characterId,
    characterName: entries[0]?.characterName || characterName(characterId),
    appearances: entries.length,
    winRatePct: round2(percentage(wins, entries.length)),
    built2Pct: round2(percentage(built2, entries.length)),
    winRateWith2Pct: rate(entries, (player) => player.built2).winRate,
    built12Pct: round2(percentage(built12, entries.length)),
    winRateWith12Pct: rate(entries, (player) => player.built12).winRate,
    trinityPct: round2(percentage(trinity, entries.length)),
    winRateWithTrinityPct: rate(entries, (player) => player.trinity).winRate,
  };
}

export function summarizeBenchmark(allRecords, { requestedGames, mode, playerCount, baseSeed, startIndex = 0, characterIds = CHARACTERS.map(({ id }) => id), strategySet = allRecords[0]?.strategySet || "balanced" } = {}) {
  const records = allRecords.filter((record) => record.completed);
  const failures = allRecords.filter((record) => !record.completed);
  const players = records.flatMap((record) => record.players);
  const totalRolls = records.reduce((sum, record) => sum + record.rolls, 0);
  const winnerPlayers = players.filter((player) => player.winner);

  const presence = {
    on2: comparison(players, (player) => player.built2),
    on12: comparison(players, (player) => player.built12),
    onEither: comparison(players, (player) => player.built2 || player.built12),
    onBoth: comparison(players, (player) => player.built2 && player.built12),
  };
  const adjustedPresence = {
    on2: standardizedComparisonByBuildings(players, (player) => player.built2),
    on12: standardizedComparisonByBuildings(players, (player) => player.built12),
    onEither: standardizedComparisonByBuildings(players, (player) => player.built2 || player.built12),
    onBoth: standardizedComparisonByBuildings(players, (player) => player.built2 && player.built12),
  };

  const trinityComparison = comparison(players, (player) => player.trinity);
  const trinityPlayers = players.filter((player) => player.trinity);
  const trinityGames = records.filter((record) => record.players.some((player) => player.trinity)).length;
  const orderCounts = new Map();
  for (const player of trinityPlayers) {
    const key = player.trinityOrder.join(" > ") || "desconhecida";
    orderCounts.set(key, (orderCounts.get(key) || 0) + 1);
  }

  const observedCharacterIds = [...new Set(players.map((player) => player.characterId))];
  const balance = summarizeBalanceLab(allRecords, {
    requestedGames: requestedGames ?? allRecords.length,
    mode: mode || records[0]?.mode || null,
    playerCount: playerCount || records[0]?.playerCount || null,
    baseSeed: baseSeed ?? null,
    startIndex,
    characterIds,
    strategySet,
  });
  const legacyCharacterMetrics = new Map(observedCharacterIds
    .map((characterId) => [characterId, aggregateCharacter(players, characterId)]));

  return {
    meta: { ...balance.meta, benchmarkRngVersion: BENCHMARK_RNG_VERSION },
    sampling: balance.sampling,
    strategySampling: balance.strategySampling,
    duration: balance.duration,
    victory: balance.victory,
    seats: balance.seats,
    turnOrderPositions: balance.turnOrderPositions,
    setup: balance.setup,
    actions: balance.actions,
    dice: {
      totalRolls,
      two: aggregateRareNumber(records, "two", totalRolls),
      twelve: aggregateRareNumber(records, "twelve", totalRolls),
    },
    rareNumberPresence: {
      built2Pct: round2(percentage(players.filter((player) => player.built2).length, players.length)),
      built12Pct: round2(percentage(players.filter((player) => player.built12).length, players.length)),
      builtEitherPct: round2(percentage(players.filter((player) => player.built2 || player.built12).length, players.length)),
      builtBothPct: round2(percentage(players.filter((player) => player.built2 && player.built12).length, players.length)),
      winnerHad2Pct: round2(percentage(winnerPlayers.filter((player) => player.built2).length, winnerPlayers.length)),
      winnerHad12Pct: round2(percentage(winnerPlayers.filter((player) => player.built12).length, winnerPlayers.length)),
      winnerHadEitherPct: round2(percentage(winnerPlayers.filter((player) => player.built2 || player.built12).length, winnerPlayers.length)),
      winnerHadBothPct: round2(percentage(winnerPlayers.filter((player) => player.built2 && player.built12).length, winnerPlayers.length)),
      comparisons: presence,
      categories: rareCategorySummary(players),
      byFinalBuildingCount: rareCategoriesByBuildingCount(players),
      adjustedByFinalBuildingCount: adjustedPresence,
    },
    trinity: {
      completedByPlayersPct: round2(percentage(trinityPlayers.length, players.length)),
      gamesWithCompletionPct: round2(percentage(trinityGames, records.length)),
      winnerCompletedPct: round2(percentage(winnerPlayers.filter((player) => player.trinity).length, winnerPlayers.length)),
      averageCompletionRound: round2(average(trinityPlayers.map((player) => player.trinityRound).filter(Number.isFinite))),
      comparison: trinityComparison,
      measuredImmunityValue: {
        totalDisastersAvoided: trinityPlayers.reduce((sum, player) => sum + (player.disastersImmune || 0), 0),
        averageDisastersAvoided: round2(average(trinityPlayers.map((player) => player.disastersImmune || 0))),
        totalDragonStealsAvoided: trinityPlayers.reduce((sum, player) => sum + (player.dragonStealsAvoidedByImmunity || 0), 0),
        averageDragonStealsAvoided: round2(average(trinityPlayers.map((player) => player.dragonStealsAvoidedByImmunity || 0))),
        totalDragonProductionSaved: trinityPlayers.reduce((sum, player) => sum + (player.dragonProductionSavedByImmunity || 0), 0),
        averageDragonProductionSaved: round2(average(trinityPlayers.map((player) => player.dragonProductionSavedByImmunity || 0))),
        playersWithAnyMeasuredBenefitPct: round2(percentage(trinityPlayers.filter((player) => (
          (player.disastersImmune || 0) > 0
          || (player.dragonStealsAvoidedByImmunity || 0) > 0
          || (player.dragonProductionSavedByImmunity || 0) > 0
        )).length, trinityPlayers.length)),
      },
      completionOrders: [...orderCounts.entries()]
        .map(([order, count]) => ({ order, count, pct: round2(percentage(count, trinityPlayers.length)) }))
        .sort((a, b) => b.count - a.count),
    },
    strategies: balance.strategies,
    characters: balance.characters.map((entry) => ({
      ...entry,
      ...(legacyCharacterMetrics.get(entry.id) || {}),
    })),
    failures: failures.map((record) => ({ gameIndex: record.gameIndex, seed: record.seed, failure: record.failure })),
    replayCases: balance.replayCases,
  };
}
