import { handSize } from "../../../game/resources.js";
import { longestRoadLength, scoreBreakdown, troopTotal } from "../../../game/scoringReducer.js";
import { isWarMode } from "../../../game/gameModes.js";
import { characterById } from "../../../game/characterCatalog.js";
import { t } from "../../../locales/i18n.js";

function statArray(stats, key) {
  return Array.isArray(stats?.[key]) ? stats[key] : [];
}

function playerName(game, index) {
  return characterById(game.players[index].ch)?.n || t("end.player", { number: index + 1 });
}

export function buildEndgameModel(game, graph, seat) {
  if (!game || game.phase !== "ended" || !Number.isSafeInteger(game.winner) || !game.players?.[game.winner]) return null;
  const stats = game.stats || {};
  const warMode = isWarMode(game.mode);
  const roadLengths = game.players.map((_, index) => longestRoadLength(game, graph, index));
  const standings = game.players.map((player, index) => {
    let villages = 0;
    let palaces = 0;
    Object.values(game.builds || {}).forEach((building) => {
      if (building.p !== index) return;
      if (building.t === 2) palaces += 1;
      else villages += 1;
    });
    const roads = Object.values(game.roads || {}).filter((owner) => owner === index).length;
    const victoryCards = [...(player.devNew || []), ...(player.devOld || [])].filter((card) => card.kind === "vp").length;
    const score = scoreBreakdown(game, index, { includeSecret: true });
    return {
      playerIndex: index,
      characterId: player.ch,
      name: playerName(game, index),
      shortName: playerName(game, index).split(" ").pop(),
      isLocal: index === seat,
      villages,
      palaces,
      roads,
      longestRoadLength: roadLengths[index],
      hasLongestRoad: game.lr?.p === index,
      troops: troopTotal(player),
      hasLargestArmy: game.la?.p === index,
      victoryCards,
      scoreSources: Object.freeze({
        villages,
        palaces: palaces * 2,
        longestRoad: score.longestRoad,
        largestArmy: score.largestArmy,
        occupations: score.occupations,
        glory: score.glory,
        secretVictoryPoints: score.secretVictoryPoints,
      }),
      hand: handSize(player),
      immune: !!player.immune,
      victoryPoints: score.total,
    };
  }).sort((a, b) => b.victoryPoints - a.victoryPoints || a.playerIndex - b.playerIndex);

  const winnerCharacter = characterById(game.players[game.winner].ch);
  const quotes = winnerCharacter?.q || [];
  const quote = quotes.length ? quotes[Math.abs(game.round || 0) % quotes.length] : "";

  return {
    round: game.round,
    warMode,
    winner: {
      playerIndex: game.winner,
      characterId: game.players[game.winner].ch,
      name: playerName(game, game.winner),
      shortName: playerName(game, game.winner).split(" ").pop(),
      title: winnerCharacter?.t || t("end.realmSovereign"),
      quote,
      victoryPoints: standings.find((entry) => entry.playerIndex === game.winner)?.victoryPoints || 0,
    },
    standings,
    dice: {
      total: stats.totalRolls || 0,
      sevens: stats.sevens || 0,
      disasters: stats.disasters || 0,
      rolls: Object.fromEntries(Array.from({ length: 11 }, (_, offset) => {
        const number = offset + 2;
        return [number, stats.rolls?.[number] || 0];
      })),
    },
    metrics: {
      produced: statArray(stats, "produced"),
      dragonBlocked: statArray(stats, "dragonBlocked"),
      robbedFrom: statArray(stats, "robbedFrom"),
      dragonMoves: statArray(stats, "dragonMoves"),
      robbedBy: statArray(stats, "robbedBy"),
      blessings: statArray(stats, "blessings"),
      portTrades: statArray(stats, "portTrades"),
      p2pTrades: statArray(stats, "p2pTrades"),
      devBought: statArray(stats, "devBought"),
    },
  };
}

export function rankMetric(model, values) {
  return model.standings
    .map((entry) => ({ ...entry, value: values?.[entry.playerIndex] || 0 }))
    .sort((a, b) => b.value - a.value || a.playerIndex - b.playerIndex);
}
