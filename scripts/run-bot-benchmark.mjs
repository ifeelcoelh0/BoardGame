import { availableParallelism } from "node:os";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { isMainThread, parentPort, workerData, Worker } from "node:worker_threads";
import {
  DEFAULT_BENCHMARK_SEED,
  DEFAULT_MAX_STEPS,
  runBenchmarkBatch,
  summarizeBenchmark,
} from "./bot-benchmark-core.mjs";

const CORE_MODES = Object.freeze(["classico", "rapido", "dragao"]);

async function writeJsonReport(filePath, payload) {
  const directory = dirname(filePath);
  if (directory && directory !== ".") await mkdir(directory, { recursive: true });
  await writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

function parseInteger(value, name, { min = 1, max = Number.MAX_SAFE_INTEGER } = {}) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isSafeInteger(parsed) || parsed < min || parsed > max) {
    throw new RangeError(`${name} deve ser um inteiro entre ${min} e ${max}.`);
  }
  return parsed;
}

function parseArgs(argv) {
  const options = {
    mode: "dragao",
    games: 1000,
    playerCount: 4,
    baseSeed: DEFAULT_BENCHMARK_SEED,
    maxSteps: DEFAULT_MAX_STEPS,
    startIndex: 0,
    workers: Math.max(1, Math.min(4, availableParallelism?.() || 1)),
    out: null,
    strategySet: "balanced",
    quiet: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = () => argv[++index];
    if (arg === "--mode") options.mode = String(next() || "").trim().toLowerCase();
    else if (arg === "--games") options.games = parseInteger(next(), "--games", { min: 1, max: 100000 });
    else if (arg === "--players") options.playerCount = parseInteger(next(), "--players", { min: 2, max: 4 });
    else if (arg === "--seed") options.baseSeed = parseInteger(next(), "--seed", { min: 0, max: 0xffffffff });
    else if (arg === "--max-steps") options.maxSteps = parseInteger(next(), "--max-steps", { min: 100, max: 100000 });
    else if (arg === "--start-index") options.startIndex = parseInteger(next(), "--start-index", { min: 0, max: 100000000 });
    else if (arg === "--workers") options.workers = parseInteger(next(), "--workers", { min: 1, max: 32 });
    else if (arg === "--out") options.out = String(next() || "").trim() || null;
    else if (arg === "--strategies") options.strategySet = String(next() || "").trim().toLowerCase() || "balanced";
    else if (arg === "--quiet") options.quiet = true;
    else if (arg === "--help" || arg === "-h") options.help = true;
    else throw new Error(`Argumento desconhecido: ${arg}`);
  }
  return options;
}

function pct(value) {
  return value == null ? "—" : `${value.toFixed(2).replace(".", ",")}%`;
}

function pp(value) {
  if (value == null) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2).replace(".", ",")} p.p.`;
}

function number(value, digits = 2) {
  if (value == null) return "—";
  return Number(value).toFixed(digits).replace(".", ",");
}

function comparisonLine(label, comparison) {
  return `${label.padEnd(18)} com: ${pct(comparison.with.winRate).padStart(8)} (${comparison.with.n} obs.)  | sem: ${pct(comparison.without.winRate).padStart(8)} (${comparison.without.n} obs.)  | Δ ${pp(comparison.deltaPercentagePoints)}`;
}

function printReport(summary) {
  const { meta, sampling, duration, victory, dice, rareNumberPresence: rare, trinity } = summary;
  console.log("\nREINOS DO DRAGÃO — BALANCE LAB");
  console.log("=".repeat(86));
  console.log(`Modo: ${meta.mode} | ${meta.playerCount} bots | jogos pedidos: ${meta.requestedGames} | seed base: ${meta.baseSeed} | índice inicial: ${meta.startIndex}`);
  console.log(`App ${meta.appVersion} | Bot policy v${meta.botPolicyVersion} | estratégia v${meta.botStrategyVersion} | perfis v${meta.botProfileVersion} | RNG lab v${meta.benchmarkRngVersion}`);
  console.log(`Perfis de bot: ${meta.strategySet}`);
  console.log(`Concluídos: ${meta.completedGames}/${meta.requestedGames} (${pct(meta.completionRatePct)}) | falhas: ${meta.failedGames} | observações: ${meta.playerObservations}`);
  console.log(`Duração — ações: média ${number(duration.averageActions)} · mediana ${number(duration.medianActions)} · p95 ${number(duration.p95Actions)} | rondas: média ${number(duration.averageRounds)} · mediana ${number(duration.medianRounds)} · p95 ${number(duration.p95Rounds)}`);

  console.log("\nSAMPLING");
  console.log(`Combinações: ${sampling.combinationCount} | rotações/mesa: ${sampling.rotationsPerCombination} | ciclo equilibrado: ${sampling.cycleGames} jogos`);
  console.log(`Ciclos completos: ${sampling.fullCycles} | resto: ${sampling.partialCycleGames} | equilíbrio exato nesta execução: ${sampling.exactlyBalanced ? "SIM" : "NÃO"}`);
  if (!sampling.exactlyBalanced) {
    console.log(`Sugestão: usa múltiplos de ${sampling.cycleGames} jogos (ex.: ${sampling.suggestedGameMultiples.join(", ")}) para igualdade exata de personagens/seats.`);
  }

  console.log("\nVITÓRIA, PLAYER SLOT E ORDEM DE TURNO");
  console.log(`Motivos: ${Object.entries(victory.endReasons).map(([reason, count]) => `${reason}=${count}`).join(" · ") || "—"}`);
  console.log(`Score médio do vencedor: ${number(victory.averageWinnerScore)} | margem média: ${number(victory.averageScoreMargin)}`);
  console.log("Slot   apar.    win%      Δ esperado   score    setup pips   prod.");
  for (const row of summary.seats) {
    console.log(`${String(Number(row.id) + 1).padStart(4)}  ${String(row.appearances).padStart(5)}  ${pct(row.winRatePct).padStart(8)}  ${pp(row.winRateDeltaPp).padStart(12)}  ${number(row.averageScore).padStart(7)}  ${number(row.averageSetupPips).padStart(10)}  ${number(row.averageProduction).padStart(6)}`);
  }
  console.log("Ordem  apar.    win%      Δ esperado   score    setup pips   perda setup");
  for (const row of summary.turnOrderPositions || []) {
    console.log(`${String(Number(row.id) + 1).padStart(5)}  ${String(row.appearances).padStart(5)}  ${pct(row.winRatePct).padStart(8)}  ${pp(row.winRateDeltaPp).padStart(12)}  ${number(row.averageScore).padStart(7)}  ${number(row.averageSetupPips).padStart(10)}  ${number(row.averageSetupOpportunityLossScore).padStart(11)}`);
  }
  if (summary.setup?.placementDiagnostics?.length) {
    console.log("Setup por colocação — escolha / melhor disponível / rank / candidatos / perda de score");
    for (const row of summary.setup.placementDiagnostics) {
      console.log(`  #${row.placementNumber}: pips ${number(row.averagePips)} / ${number(row.averageBestAvailablePips)} · rank ${number(row.averageChosenRank)} · candidatos ${number(row.averageCandidateCount)} · perda ${number(row.averageOpportunityLossScore)}`);
    }
  }

  console.log("\nPOR PERSONAGEM");
  console.log("Personagem             apar.    win%      Δ esperado   score   prod.   aldeias palácios estradas cartas");
  for (const row of summary.characters) {
    console.log(`${row.characterName.slice(0, 21).padEnd(21)} ${String(row.appearances).padStart(5)}  ${pct(row.winRatePct).padStart(8)}  ${pp(row.winRateDeltaPp).padStart(12)}  ${number(row.averageScore).padStart(6)}  ${number(row.averageProduction).padStart(6)}  ${number(row.averageVillages).padStart(7)} ${number(row.averagePalaces).padStart(8)} ${number(row.averageRoads).padStart(8)} ${number(row.averageCardsBought).padStart(6)}`);
  }

  if (summary.strategies?.length) {
    console.log("\nPOR PERFIL DE BOT");
    console.log("Perfil                 apar.    win%      Δ esperado   score   prod.   propostas  P2P");
    for (const row of summary.strategies) {
      console.log(`${row.profileName.slice(0, 21).padEnd(21)} ${String(row.appearances).padStart(5)}  ${pct(row.winRatePct).padStart(8)}  ${pp(row.winRateDeltaPp).padStart(12)}  ${number(row.averageScore).padStart(6)}  ${number(row.averageProduction).padStart(6)}  ${number(row.averageTradeProposals).padStart(9)}  ${number(row.averageP2pTrades).padStart(5)}`);
    }
    if (summary.strategySampling?.strategySet === "diverse") {
      console.log(`Perfis × personagem exatamente equilibrados: ${summary.strategySampling.characterProfileExactlyBalanced ? "SIM" : "NÃO"} | spread máximo: ${summary.strategySampling.maximumCharacterProfileSpread}`);
    }
  }

  console.log("\nAÇÕES MAIS FREQUENTES");
  for (const row of summary.actions.slice(0, 12)) {
    console.log(`${row.type.padEnd(28)} ${String(row.count).padStart(8)}  ${pct(row.sharePct).padStart(8)}`);
  }

  console.log("\nNÚMEROS 2 / 12");
  for (const [label, stats] of [["2", dice.two], ["12", dice.twelve]]) {
    console.log(`${label.padEnd(2)}  ${String(stats.rolls).padStart(6)} lançamentos | ${pct(stats.shareOfRollsPct)} | teoria ${pct(stats.theoreticalSharePct)} | desvio ${pp(stats.deviationFromTheoryPp)}`);
    console.log(`    saiu em ${pct(stats.gamesWithAtLeastOnePct)} dos jogos | produção em ${pct(stats.productiveRollsPct)} das saídas | ${number(stats.resourcesPerRareRoll)} recursos/saída`);
    if (meta.modeFeatures.disasters) {
      const types = stats.disasterTypes.map((entry) => `${entry.type} ${pct(entry.pct)}`).join(" · ") || "sem desastres aplicados";
      console.log(`    desastre aplicado em ${pct(stats.disasterAppliedPct)} das saídas | sem protegido ${pct(stats.disasterNoProtectedPct)} | ${types}`);
    }
  }
  console.log(`Presença final — 2: ${pct(rare.built2Pct)} | 12: ${pct(rare.built12Pct)} | 2 ou 12: ${pct(rare.builtEitherPct)} | ambos: ${pct(rare.builtBothPct)}`);
  console.log(comparisonLine("Win rate — 2", rare.comparisons.on2));
  console.log(comparisonLine("Win rate — 12", rare.comparisons.on12));

  if (!meta.modeFeatures.classicRules) {
    console.log("\nTRINDADE DAS ARMAS");
    console.log(`Jogadores que completaram: ${pct(trinity.completedByPlayersPct)} | jogos com ≥1 Trindade: ${pct(trinity.gamesWithCompletionPct)}`);
    console.log(`Vencedores que completaram: ${pct(trinity.winnerCompletedPct)} | ronda média: ${number(trinity.averageCompletionRound)}`);
    console.log(comparisonLine("Win rate — Trind.", trinity.comparison));
    const value = trinity.measuredImmunityValue;
    if (value) {
      console.log(`Valor medido da imunidade — desastres evitados: ${value.totalDisastersAvoided} (média ${number(value.averageDisastersAvoided)}) · roubos do Dragão evitados: ${value.totalDragonStealsAvoided} (média ${number(value.averageDragonStealsAvoided)}) · produção salva do Dragão: ${number(value.totalDragonProductionSaved, 0)} (média ${number(value.averageDragonProductionSaved)})`);
      console.log(`Jogadores com Trindade que obtiveram ≥1 benefício medido: ${pct(value.playersWithAnyMeasuredBenefitPct)}`);
    }
  }

  if (summary.replayCases.length) {
    console.log("\nCASOS PARA REPRODUÇÃO");
    for (const item of summary.replayCases.slice(0, 10)) {
      console.log(`${item.reason.padEnd(20)} jogo ${item.gameIndex} | seed ${item.seed} | ${item.steps} ações / ${item.rounds} rondas | roster ${(item.roster || []).join(",")}`);
    }
    const first = summary.replayCases[0];
    console.log(`Reproduzir primeiro caso: npm run benchmark:bots -- --mode ${first.replay.mode} --players ${first.replay.players} --games 1 --seed ${first.replay.baseSeed} --start-index ${first.replay.startIndex} --workers 1 --strategies ${first.replay.strategies || "balanced"}`);
  }

  console.log("\nNota: win rates medem o desempenho da estratégia de bot atual. Não provam equilíbrio humano nem causalidade.\n");
}

function printCoreComparison(results) {
  console.log("\nCORE MODES — COMPARAÇÃO");
  console.log("=".repeat(86));
  console.log("Modo        jogos   rondas   ações    score vencedor  margem   falhas");
  for (const { summary } of results) {
    console.log(`${summary.meta.mode.padEnd(10)} ${String(summary.meta.completedGames).padStart(5)}  ${number(summary.duration.averageRounds).padStart(7)}  ${number(summary.duration.averageActions).padStart(7)}  ${number(summary.victory.averageWinnerScore).padStart(15)}  ${number(summary.victory.averageScoreMargin).padStart(7)}  ${String(summary.meta.failedGames).padStart(6)}`);
  }

  const byMode = Object.fromEntries(results.map(({ summary }) => [summary.meta.mode, summary]));
  const characterIds = [...new Set(results.flatMap(({ summary }) => summary.characters.map((row) => row.characterId)))];
  console.log("\nPersonagem             Clássico   Relâmpago   Dragão");
  for (const characterId of characterIds) {
    const rows = CORE_MODES.map((mode) => byMode[mode]?.characters.find((row) => row.characterId === characterId));
    const name = rows.find(Boolean)?.characterName || characterId;
    console.log(`${name.slice(0, 21).padEnd(21)} ${pct(rows[0]?.winRatePct).padStart(9)}  ${pct(rows[1]?.winRatePct).padStart(10)}  ${pct(rows[2]?.winRatePct).padStart(8)}`);
  }
  if (results.some(({ summary }) => (summary.strategies || []).length > 1)) {
    const profileIds = [...new Set(results.flatMap(({ summary }) => (summary.strategies || []).map((row) => row.profileId)))];
    console.log("\nPerfil                 Clássico   Relâmpago   Dragão");
    for (const profileId of profileIds) {
      const rows = CORE_MODES.map((mode) => byMode[mode]?.strategies?.find((row) => row.profileId === profileId));
      const name = rows.find(Boolean)?.profileName || profileId;
      console.log(`${name.slice(0, 21).padEnd(21)} ${pct(rows[0]?.winRatePct).padStart(9)}  ${pct(rows[1]?.winRatePct).padStart(10)}  ${pct(rows[2]?.winRatePct).padStart(8)}`);
    }
  }

  console.log("\nUsa ciclos completos de sampling antes de interpretar diferenças pequenas entre personagens/perfis.\n");
}

async function runParallel(options) {
  const workerCount = Math.min(options.workers, options.games);
  if (workerCount <= 1) {
    return runBenchmarkBatch({
      mode: options.mode,
      playerCount: options.playerCount,
      games: options.games,
      baseSeed: options.baseSeed,
      maxSteps: options.maxSteps,
      startIndex: options.startIndex,
      strategySet: options.strategySet,
      onProgress: options.quiet ? undefined : (done, total) => {
        if (done === total || done % Math.max(1, Math.floor(total / 10)) === 0) {
          process.stderr.write(`\rBenchmark: ${done}/${total}`);
        }
      },
    });
  }

  const chunks = [];
  let cursor = options.startIndex;
  for (let workerIndex = 0; workerIndex < workerCount; workerIndex += 1) {
    const count = Math.floor(options.games / workerCount) + (workerIndex < options.games % workerCount ? 1 : 0);
    chunks.push({ startIndex: cursor, games: count });
    cursor += count;
  }

  let finished = 0;
  const promises = chunks.map((chunk) => new Promise((resolve, reject) => {
    const worker = new Worker(new URL(import.meta.url), {
      workerData: {
        benchmarkWorker: true,
        options: {
          mode: options.mode,
          playerCount: options.playerCount,
          baseSeed: options.baseSeed,
          maxSteps: options.maxSteps,
          strategySet: options.strategySet,
          ...chunk,
        },
      },
    });
    worker.once("message", (message) => {
      if (message?.error) reject(new Error(message.error));
      else {
        finished += chunk.games;
        if (!options.quiet) process.stderr.write(`\rBenchmark: ${finished}/${options.games}`);
        resolve(message.records || []);
      }
    });
    worker.once("error", reject);
    worker.once("exit", (code) => {
      if (code !== 0) reject(new Error(`Worker terminou com código ${code}.`));
    });
  }));

  const batches = await Promise.all(promises);
  return batches.flat().sort((a, b) => a.gameIndex - b.gameIndex);
}

function help() {
  console.log(`Uso:\n  npm run benchmark:bots -- --mode dragao --players 4 --games 2800 --out balance-dragao.json\n\nOpções:\n  --mode <modo>         core | classico | dragao | rapido | guerra | exploracao\n  --players <2-4>       número de bots (predefinição: 4)\n  --games <n>           número de jogos (predefinição: 1000)\n  --seed <n>            seed base reproduzível\n  --start-index <n>     índice global inicial; permite reproduzir um jogo isolado\n  --workers <n>         workers paralelos (predefinição: até 4)\n  --max-steps <n>       limite de ações por jogo\n  --out <ficheiro.json> guarda summary + registo de cada jogo (recomendado: balance-reports/...)\n  --quiet                esconde o progresso\n\nEm --mode core, --games é o número de jogos POR MODO. Com 8 personagens e 4 jogadores, usa múltiplos de 280 jogos para sampling exatamente equilibrado.\n`);
}

if (!isMainThread && workerData?.benchmarkWorker) {
  try {
    const records = runBenchmarkBatch(workerData.options);
    parentPort.postMessage({ records });
  } catch (error) {
    parentPort.postMessage({ error: error?.stack || String(error) });
  }
} else if (isMainThread) {
  try {
    const options = parseArgs(process.argv.slice(2));
    if (options.help) {
      help();
      process.exit(0);
    }
    const allowedModes = new Set(["core", "classico", "dragao", "rapido", "guerra", "exploracao"]);
    if (!allowedModes.has(options.mode)) throw new Error(`Modo inválido: ${options.mode}`);
    const allowedStrategySets = new Set(["balanced", "expander", "developer", "economist", "diverse"]);
    if (!allowedStrategySets.has(options.strategySet)) throw new Error(`Conjunto de estratégias inválido: ${options.strategySet}`);

    const runMode = async (mode) => {
      const startedAt = Date.now();
      const records = await runParallel({ ...options, mode });
      if (!options.quiet) process.stderr.write("\n");
      const summary = summarizeBenchmark(records, {
        requestedGames: options.games,
        mode,
        playerCount: options.playerCount,
        baseSeed: options.baseSeed,
        startIndex: options.startIndex,
        strategySet: options.strategySet,
      });
      summary.meta.elapsedSeconds = Math.round((Date.now() - startedAt) / 10) / 100;
      printReport(summary);
      return { mode, summary, games: records };
    };

    if (options.mode === "core") {
      const results = [];
      for (const mode of CORE_MODES) results.push(await runMode(mode));
      printCoreComparison(results);
      if (options.out) {
        const payload = {
          suite: {
            id: "core",
            modes: CORE_MODES,
            gamesPerMode: options.games,
            baseSeed: options.baseSeed,
            startIndex: options.startIndex,
            strategySet: options.strategySet,
          },
          modes: Object.fromEntries(results.map(({ mode, summary, games }) => [mode, { summary, games }])),
        };
        await writeJsonReport(options.out, payload);
        console.log(`Relatório JSON dos modos core guardado em: ${options.out}`);
      }
      if (results.some(({ summary }) => summary.meta.failedGames)) process.exitCode = 2;
    } else {
      const result = await runMode(options.mode);
      if (options.out) {
        await writeJsonReport(options.out, { summary: result.summary, games: result.games });
        console.log(`Relatório JSON guardado em: ${options.out}`);
      }
      if (result.summary.meta.failedGames) process.exitCode = 2;
    }
  } catch (error) {
    console.error(`Benchmark falhou: ${error?.message || error}`);
    process.exitCode = 1;
  }
}
