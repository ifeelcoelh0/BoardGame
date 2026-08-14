import { APP_VERSION } from "../src/appVersion.js";
import { BOT_POLICY_VERSION } from "../src/game/botPolicy.js";
import { BOT_STRATEGY_VERSION } from "../src/game/botStrategy.js";
import { BOT_PROFILE_VERSION, botProfile } from "../src/game/botProfiles.js";
import { characterName } from "../src/game/characterCatalog.js";
import { gameModeConfig } from "../src/game/gameModes.js";
import { RESOURCE_KEYS } from "../src/game/resources.js";
import {
  longestRoadLength,
  scoreBreakdown,
  troopTotal,
} from "../src/game/scoringReducer.js";

function round2(value) {
  return value == null ? null : Math.round(value * 100) / 100;
}

export function percentage(numerator, denominator) {
  return denominator > 0 ? (100 * numerator) / denominator : null;
}

function average(values) {
  const finite = values.filter(Number.isFinite);
  return finite.length ? finite.reduce((sum, value) => sum + value, 0) / finite.length : null;
}

function percentile(values, quantile) {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const index = (sorted.length - 1) * quantile;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower];
  const weight = index - lower;
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

function resourceMap(source = {}) {
  return Object.fromEntries(RESOURCE_KEYS.map((resource) => [resource, Number(source?.[resource]) || 0]));
}

function addResources(target, source = {}) {
  for (const resource of RESOURCE_KEYS) target[resource] += Number(source?.[resource]) || 0;
}

function sumResources(resources = {}) {
  return RESOURCE_KEYS.reduce((sum, resource) => sum + (Number(resources?.[resource]) || 0), 0);
}

function increment(map, key, amount = 1) {
  if (!key) return;
  map[key] = (map[key] || 0) + amount;
}

export function characterCombinations(characterIds, playerCount) {
  if (!Array.isArray(characterIds) || !characterIds.length) throw new TypeError("É necessária uma lista de personagens.");
  if (!Number.isSafeInteger(playerCount) || playerCount < 2 || playerCount > 4 || playerCount > characterIds.length) {
    throw new RangeError("O número de jogadores é inválido para o roster disponível.");
  }
  if (new Set(characterIds).size !== characterIds.length) throw new TypeError("O roster contém personagens duplicadas.");

  const combinations = [];
  const current = [];
  const visit = (start) => {
    if (current.length === playerCount) {
      combinations.push(current.slice());
      return;
    }
    for (let index = start; index <= characterIds.length - (playerCount - current.length); index += 1) {
      current.push(characterIds[index]);
      visit(index + 1);
      current.pop();
    }
  };
  visit(0);
  return combinations;
}

export function rosterSamplingPlan(characterIds, playerCount) {
  const combinations = characterCombinations(characterIds, playerCount);
  return Object.freeze({
    characterCount: characterIds.length,
    playerCount,
    combinationCount: combinations.length,
    rotationsPerCombination: playerCount,
    cycleGames: combinations.length * playerCount,
  });
}

export function balancedRosterForGame(gameIndex, playerCount, characterIds) {
  if (!Number.isSafeInteger(gameIndex) || gameIndex < 0) throw new RangeError("O índice do jogo tem de ser um inteiro não negativo.");
  const combinations = characterCombinations(characterIds, playerCount);
  const combinationIndex = Math.floor(gameIndex / playerCount) % combinations.length;
  const rotation = gameIndex % playerCount;
  const combination = combinations[combinationIndex];
  return combination.map((_, seatIndex) => combination[(seatIndex + rotation) % playerCount]);
}

export function createBalancePlayerRecord(player, playerIndex) {
  return {
    playerIndex,
    seatIndex: playerIndex,
    turnOrderPosition: null,
    characterId: player.ch,
    characterName: characterName(player.ch),
    winner: false,
    actions: 0,
    actionsByType: {},
    production: resourceMap(),
    productionTotal: 0,
    cardsBought: 0,
    cardsPlayed: {},
    bankTrades: 0,
    p2pTrades: 0,
    dragonMoves: 0,
    steals: 0,
    robbed: 0,
    disastersProtected: 0,
    disastersExposed: 0,
    disastersAppliedToPlayer: 0,
    disastersImmune: 0,
    disasterHarmEvents: 0,
    dragonStealsAvoidedByImmunity: 0,
    dragonProductionSavedByImmunity: 0,
    setupPlacements: [],
    setupPips: 0,
    setupWeightedPips: 0,
    setupResourceDiversity: 0,
    setupNumberDiversity: 0,
    setupInitialResources: 0,
    setupAverageChosenRank: null,
    setupAverageOpportunityLossScore: null,
  };
}

export function recordAcceptedAction(record, actorIndex, action) {
  const player = record.players?.[actorIndex];
  if (!player) return;
  player.actions += 1;
  increment(player.actionsByType, action?.type);
  increment(record.actionsByType, action?.type);
}

export function recordBalanceEvents(record, events = []) {
  for (const event of events) {
    if (event?.type === "DICE_ROLLED" && Array.isArray(event.production?.gains)) {
      for (let playerIndex = 0; playerIndex < record.players.length; playerIndex += 1) {
        const player = record.players[playerIndex];
        const gain = event.production.gains[playerIndex] || {};
        addResources(player.production, gain);
        player.productionTotal += sumResources(gain);
      }
    } else if (event?.type === "DEVELOPMENT_CARD_BOUGHT") {
      const player = record.players[event.actorIndex];
      if (player) player.cardsBought += 1;
    } else if (event?.type === "DEVELOPMENT_CARD_PLAYED") {
      const player = record.players[event.actorIndex];
      if (player) increment(player.cardsPlayed, event.card?.kind || "unknown");
    } else if (event?.type === "BANK_TRADE_COMPLETED") {
      const player = record.players[event.actorIndex];
      if (player) player.bankTrades += 1;
    } else if (event?.type === "PLAYER_TRADE_ACCEPTED") {
      const recipient = record.players[event.actorIndex];
      const proposer = record.players[event.proposerIndex];
      if (recipient) recipient.p2pTrades += 1;
      if (proposer) proposer.p2pTrades += 1;
    } else if (event?.type === "DRAGON_PLACED") {
      const player = record.players[event.actorIndex];
      if (player) player.dragonMoves += 1;
    } else if (event?.type === "RESOURCE_STOLEN") {
      const thief = record.players[event.actorIndex];
      const victim = record.players[event.victimIndex];
      if (thief) thief.steals += 1;
      if (victim) victim.robbed += 1;
    } else if (event?.type === "DISASTER_RESOLVED") {
      for (const playerIndex of event.protectedPlayers || []) {
        if (record.players[playerIndex]) record.players[playerIndex].disastersProtected += 1;
      }
      for (const playerIndex of event.affectedPlayers || []) {
        const player = record.players[playerIndex];
        if (!player) continue;
        player.disastersExposed += 1;
        if (event.outcome === "APPLIED") player.disastersAppliedToPlayer += 1;
      }
      for (const playerIndex of event.immunePlayers || []) {
        if (record.players[playerIndex]) record.players[playerIndex].disastersImmune += 1;
      }
      if (event.outcome === "APPLIED") {
        const harmfulEffects = new Set(["RESOURCE_LOST", "QUARANTINED", "PORT_DISABLED", "PORT_CHOICE_REQUIRED"]);
        const affected = new Set(event.affectedPlayers || []);
        for (const effect of event.effects || []) {
          if (!harmfulEffects.has(effect?.type) || !affected.has(effect?.playerIndex)) continue;
          if (record.players[effect.playerIndex]) record.players[effect.playerIndex].disasterHarmEvents += 1;
        }
      }
    }
  }
}

export function finalizeBalanceRecord(record, game) {
  record.endReason = game.endReason || null;
  record.finalPhase = game.phase || null;
  record.finalRound = game.round || 0;

  const scores = [];
  for (let playerIndex = 0; playerIndex < record.players.length; playerIndex += 1) {
    const playerRecord = record.players[playerIndex];
    const player = game.players[playerIndex];
    const score = scoreBreakdown(game, playerIndex, { includeSecret: true });
    const buildings = { village: 0, palace: 0, total: 0 };
    for (const building of Object.values(game.builds || {})) {
      if (building?.p !== playerIndex) continue;
      buildings.total += 1;
      if (building.t === 1) buildings.village += 1;
      else if (building.t === 2) buildings.palace += 1;
    }
    const finalResources = resourceMap(player?.res);
    const cardsInHand = [...(player?.devNew || []), ...(player?.devOld || [])];
    const cardsByKind = {};
    for (const card of cardsInHand) increment(cardsByKind, card?.kind || "unknown");

    playerRecord.finalScore = score.total;
    playerRecord.score = score;
    playerRecord.finalResources = finalResources;
    playerRecord.finalResourceTotal = sumResources(finalResources);
    playerRecord.finalBuildings = buildings;
    playerRecord.finalBuildingCount = buildings.total;
    playerRecord.finalRoads = Object.values(game.roads || {}).filter((owner) => owner === playerIndex).length;
    playerRecord.roadLength = longestRoadLength(game, playerIndex);
    playerRecord.armySize = troopTotal(player);
    playerRecord.longestRoadAward = game.lr?.p === playerIndex;
    playerRecord.largestArmyAward = game.la?.p === playerIndex;
    playerRecord.finalDevelopmentCards = cardsByKind;
    playerRecord.finalDevelopmentCardCount = cardsInHand.length;
    scores.push(score.total);
  }

  const sortedScores = scores.slice().sort((a, b) => b - a);
  record.winnerScore = Number.isSafeInteger(record.winnerIndex) ? scores[record.winnerIndex] : null;
  record.scoreMargin = sortedScores.length > 1 ? sortedScores[0] - sortedScores[1] : null;
  return record;
}

function aggregatePlayerCohort(entries, { id, label, playerCount }) {
  const wins = entries.filter((entry) => entry.winner).length;
  const expectedWinRate = 100 / playerCount;
  const productionByResource = resourceMap();
  const finalResourcesByResource = resourceMap();
  const cardsPlayed = {};
  for (const entry of entries) {
    addResources(productionByResource, entry.production);
    addResources(finalResourcesByResource, entry.finalResources);
    for (const [kind, count] of Object.entries(entry.cardsPlayed || {})) increment(cardsPlayed, kind, count);
  }
  const divisor = entries.length || 1;
  for (const resource of RESOURCE_KEYS) {
    productionByResource[resource] = round2(productionByResource[resource] / divisor);
    finalResourcesByResource[resource] = round2(finalResourcesByResource[resource] / divisor);
  }

  const winRatePct = round2(percentage(wins, entries.length));
  return {
    id,
    label,
    appearances: entries.length,
    wins,
    winRatePct,
    expectedWinRatePct: round2(expectedWinRate),
    winRateDeltaPp: winRatePct == null ? null : round2(winRatePct - expectedWinRate),
    averageScore: round2(average(entries.map((entry) => entry.finalScore))),
    averageProduction: round2(average(entries.map((entry) => entry.productionTotal))),
    productionByResource,
    averageFinalResources: round2(average(entries.map((entry) => entry.finalResourceTotal))),
    finalResourcesByResource,
    averageActions: round2(average(entries.map((entry) => entry.actions))),
    averageVillages: round2(average(entries.map((entry) => entry.finalBuildings?.village))),
    averagePalaces: round2(average(entries.map((entry) => entry.finalBuildings?.palace))),
    averageRoads: round2(average(entries.map((entry) => entry.finalRoads))),
    averageRoadLength: round2(average(entries.map((entry) => entry.roadLength))),
    longestRoadPct: round2(percentage(entries.filter((entry) => entry.longestRoadAward).length, entries.length)),
    largestArmyPct: round2(percentage(entries.filter((entry) => entry.largestArmyAward).length, entries.length)),
    averageCardsBought: round2(average(entries.map((entry) => entry.cardsBought))),
    cardsPlayed,
    averageBankTrades: round2(average(entries.map((entry) => entry.bankTrades))),
    averageP2pTrades: round2(average(entries.map((entry) => entry.p2pTrades))),
    averageTradeProposals: round2(average(entries.map((entry) => Number(entry.actionsByType?.PROPOSE_TRADE) || 0))),
    averageTradeAcceptances: round2(average(entries.map((entry) => Number(entry.actionsByType?.ACCEPT_TRADE) || 0))),
    averageTradeDeclines: round2(average(entries.map((entry) => Number(entry.actionsByType?.DECLINE_TRADE) || 0))),
    averageDragonMoves: round2(average(entries.map((entry) => entry.dragonMoves))),
    averageSteals: round2(average(entries.map((entry) => entry.steals))),
    averageRobbed: round2(average(entries.map((entry) => entry.robbed))),
    averageDisastersProtected: round2(average(entries.map((entry) => entry.disastersProtected))),
    averageDisastersExposed: round2(average(entries.map((entry) => entry.disastersExposed))),
    averageDisastersAppliedToPlayer: round2(average(entries.map((entry) => entry.disastersAppliedToPlayer))),
    averageDisastersAvoidedByImmunity: round2(average(entries.map((entry) => entry.disastersImmune))),
    averageDisasterHarmEvents: round2(average(entries.map((entry) => entry.disasterHarmEvents))),
    averageDragonStealsAvoidedByImmunity: round2(average(entries.map((entry) => entry.dragonStealsAvoidedByImmunity))),
    averageDragonProductionSavedByImmunity: round2(average(entries.map((entry) => entry.dragonProductionSavedByImmunity))),
    averageSetupPips: round2(average(entries.map((entry) => entry.setupPips))),
    averageSetupWeightedPips: round2(average(entries.map((entry) => entry.setupWeightedPips))),
    averageSetupResourceDiversity: round2(average(entries.map((entry) => entry.setupResourceDiversity))),
    averageSetupNumberDiversity: round2(average(entries.map((entry) => entry.setupNumberDiversity))),
    averageSetupInitialResources: round2(average(entries.map((entry) => entry.setupInitialResources))),
    averageSetupChosenRank: round2(average(entries.map((entry) => entry.setupAverageChosenRank))),
    averageSetupOpportunityLossScore: round2(average(entries.map((entry) => entry.setupAverageOpportunityLossScore))),
  };
}

function samplingSummary({ requestedGames, startIndex, playerCount, characterIds }) {
  const plan = rosterSamplingPlan(characterIds, playerCount);
  const games = requestedGames || 0;
  const fullCycles = Math.floor(games / plan.cycleGames);
  const partialCycleGames = games % plan.cycleGames;
  return {
    method: "all-character-combinations-with-seat-rotation",
    ...plan,
    startIndex: startIndex || 0,
    fullCycles,
    partialCycleGames,
    exactlyBalanced: games > 0 && partialCycleGames === 0,
    suggestedGameMultiples: [1, 5, 10].map((multiplier) => plan.cycleGames * multiplier),
  };
}

function replayCase(record, reason, baseSeed) {
  return {
    reason,
    gameIndex: record.gameIndex,
    seed: record.seed,
    roster: record.roster,
    strategySet: record.strategySet || "balanced",
    botProfiles: record.botProfiles || [],
    steps: record.steps,
    rounds: record.rounds,
    winnerCharacter: record.winnerCharacter,
    replay: {
      mode: record.mode,
      players: record.playerCount,
      games: 1,
      baseSeed,
      startIndex: record.gameIndex,
      workers: 1,
      strategies: record.strategySet || "balanced",
    },
  };
}

export function summarizeBalanceLab(records, {
  requestedGames = records.length,
  mode = records[0]?.mode || null,
  playerCount = records[0]?.playerCount || null,
  baseSeed = null,
  startIndex = 0,
  characterIds = [],
  strategySet = records[0]?.strategySet || "balanced",
} = {}) {
  const completed = records.filter((record) => record.completed);
  const failures = records.filter((record) => !record.completed);
  const players = completed.flatMap((record) => record.players);
  const modeConfig = gameModeConfig(mode);
  const durations = completed.map((record) => record.steps);
  const roundCounts = completed.map((record) => record.rounds);
  const endReasons = {};
  for (const record of completed) increment(endReasons, record.endReason || "UNKNOWN");

  const characters = [...new Set(characterIds.length ? characterIds : players.map((entry) => entry.characterId))]
    .map((characterId) => ({
      ...aggregatePlayerCohort(
        players.filter((entry) => entry.characterId === characterId),
        { id: characterId, label: characterName(characterId), playerCount },
      ),
      characterId,
      characterName: characterName(characterId),
    }))
    .sort((a, b) => (b.winRatePct ?? -Infinity) - (a.winRatePct ?? -Infinity));

  const profileIds = [...new Set(players.map((entry) => entry.botProfileId || "balanced"))];
  const strategies = profileIds
    .map((profileId) => ({
      ...aggregatePlayerCohort(
        players.filter((entry) => (entry.botProfileId || "balanced") === profileId),
        { id: profileId, label: botProfile(profileId).label, playerCount },
      ),
      profileId,
      profileName: botProfile(profileId).label,
    }))
    .sort((a, b) => (b.winRatePct ?? -Infinity) - (a.winRatePct ?? -Infinity));

  const strategyCharacterCounts = Object.fromEntries(characterIds.map((characterId) => [
    characterId,
    Object.fromEntries(profileIds.map((profileId) => [
      profileId,
      players.filter((entry) => entry.characterId === characterId && (entry.botProfileId || "balanced") === profileId).length,
    ])),
  ]));
  const strategySeatCounts = Object.fromEntries(Array.from({ length: playerCount || 0 }, (_, seatIndex) => [
    seatIndex,
    Object.fromEntries(profileIds.map((profileId) => [
      profileId,
      players.filter((entry) => entry.seatIndex === seatIndex && (entry.botProfileId || "balanced") === profileId).length,
    ])),
  ]));
  const characterProfileSpreads = Object.values(strategyCharacterCounts).map((counts) => {
    const values = Object.values(counts);
    return values.length ? Math.max(...values) - Math.min(...values) : 0;
  });

  const seats = Array.from({ length: playerCount || 0 }, (_, seatIndex) => aggregatePlayerCohort(
    players.filter((entry) => entry.seatIndex === seatIndex),
    { id: seatIndex, label: `Seat ${seatIndex + 1}`, playerCount },
  ));

  const turnOrderPositions = Array.from({ length: playerCount || 0 }, (_, position) => aggregatePlayerCohort(
    players.filter((entry) => entry.turnOrderPosition === position),
    { id: position, label: `Ordem ${position + 1}`, playerCount },
  ));

  const placementDiagnostics = [1, 2].map((placementNumber) => {
    const placements = players.flatMap((entry) => (entry.setupPlacements || [])
      .filter((placement) => placement.placementNumber === placementNumber));
    return {
      placementNumber,
      observations: placements.length,
      averagePips: round2(average(placements.map((placement) => placement.pips))),
      averageWeightedPips: round2(average(placements.map((placement) => placement.weightedPips))),
      averageCandidateCount: round2(average(placements.map((placement) => placement.candidateCount))),
      averageChosenRank: round2(average(placements.map((placement) => placement.chosenRank))),
      averageBestAvailablePips: round2(average(placements.map((placement) => placement.bestAvailablePips))),
      averageOpportunityLossScore: round2(average(placements.map((placement) => placement.opportunityLossScore))),
    };
  });

  const actionCounts = {};
  for (const record of completed) {
    for (const [type, count] of Object.entries(record.actionsByType || {})) increment(actionCounts, type, count);
  }
  const totalActions = Object.values(actionCounts).reduce((sum, count) => sum + count, 0);
  const actions = Object.entries(actionCounts)
    .map(([type, count]) => ({ type, count, sharePct: round2(percentage(count, totalActions)) }))
    .sort((a, b) => b.count - a.count);

  const longThreshold = percentile(durations, 0.95);
  const longGames = completed
    .filter((record) => longThreshold != null && record.steps >= longThreshold)
    .sort((a, b) => b.steps - a.steps || a.gameIndex - b.gameIndex)
    .slice(0, 10)
    .map((record) => replayCase(record, "LONG_DURATION_P95", baseSeed));
  const replayCases = [
    ...failures.map((record) => ({ ...replayCase(record, record.failure?.reason || "FAILED", baseSeed), failure: record.failure })),
    ...longGames,
  ];

  return {
    meta: {
      appVersion: APP_VERSION,
      botPolicyVersion: BOT_POLICY_VERSION,
      botStrategyVersion: BOT_STRATEGY_VERSION,
      botProfileVersion: BOT_PROFILE_VERSION,
      strategySet,
      mode,
      modeFeatures: {
        classicRules: modeConfig.classicRules,
        rapidSetup: modeConfig.rapidSetup,
        disasters: modeConfig.disasters,
      },
      playerCount,
      requestedGames,
      completedGames: completed.length,
      failedGames: failures.length,
      completionRatePct: round2(percentage(completed.length, requestedGames)),
      baseSeed,
      startIndex,
      playerObservations: players.length,
    },
    sampling: samplingSummary({ requestedGames, startIndex, playerCount, characterIds }),
    strategySampling: {
      strategySet,
      profileIds,
      characterProfileExactlyBalanced: characterProfileSpreads.every((spread) => spread === 0),
      maximumCharacterProfileSpread: characterProfileSpreads.length ? Math.max(...characterProfileSpreads) : 0,
      byCharacter: strategyCharacterCounts,
      bySeat: strategySeatCounts,
    },
    duration: {
      averageActions: round2(average(durations)),
      medianActions: round2(percentile(durations, 0.5)),
      p95Actions: round2(longThreshold),
      averageRounds: round2(average(roundCounts)),
      medianRounds: round2(percentile(roundCounts, 0.5)),
      p95Rounds: round2(percentile(roundCounts, 0.95)),
    },
    victory: {
      endReasons,
      averageWinnerScore: round2(average(completed.map((record) => record.winnerScore))),
      averageScoreMargin: round2(average(completed.map((record) => record.scoreMargin))),
    },
    seats,
    turnOrderPositions,
    setup: {
      placementDiagnostics,
    },
    characters,
    strategies,
    actions,
    replayCases,
  };
}
