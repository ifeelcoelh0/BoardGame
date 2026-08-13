import { availableParallelism } from "node:os";
import { writeFile } from "node:fs/promises";
import { isMainThread, parentPort, workerData, Worker } from "node:worker_threads";
import {
  DEFAULT_BENCHMARK_SEED,
  DEFAULT_MAX_STEPS,
  runBenchmarkBatch,
  summarizeBenchmark,
} from "./bot-benchmark-core.mjs";

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
    workers: Math.max(1, Math.min(4, availableParallelism?.() || 1)),
    out: null,
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
    else if (arg === "--workers") options.workers = parseInteger(next(), "--workers", { min: 1, max: 32 });
    else if (arg === "--out") options.out = String(next() || "").trim() || null;
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
  const { meta, duration, dice, rareNumberPresence: rare, trinity } = summary;
  console.log("\nREINOS DO DRAGÃO — BOT BENCHMARK");
  console.log("=".repeat(74));
  console.log(`Modo: ${meta.mode} | ${meta.playerCount} bots | jogos pedidos: ${meta.requestedGames} | seed: ${meta.baseSeed}`);
  console.log(`Concluídos: ${meta.completedGames}/${meta.requestedGames} | falhas: ${meta.failedGames} | observações de jogador: ${meta.playerObservations}`);
  console.log(`Ações médias: ${number(duration.averageActions)} | rondas médias: ${number(duration.averageRounds)}`);

  console.log("\nDADOS RAROS");
  for (const [label, stats] of [["2", dice.two], ["12", dice.twelve]]) {
    console.log(`${label.padEnd(2)}  ${String(stats.rolls).padStart(6)} lançamentos | ${pct(stats.shareOfRollsPct)} dos lançamentos | teoria ${pct(stats.theoreticalSharePct)} | desvio ${pp(stats.deviationFromTheoryPp)}`);
    console.log(`    saiu em ${pct(stats.gamesWithAtLeastOnePct)} dos jogos | produziu recursos em ${pct(stats.productiveRollsPct)} dessas saídas | ${number(stats.resourcesPerRareRoll)} recursos/saída`);
    if (meta.mode === "dragao") {
      const types = stats.disasterTypes.map((entry) => `${entry.type} ${pct(entry.pct)}`).join(" · ") || "sem desastres aplicados";
      console.log(`    desastre aplicado em ${pct(stats.disasterAppliedPct)} das saídas | sem protegido ${pct(stats.disasterNoProtectedPct)} | ${types}`);
    }
  }

  console.log("\nPRESENÇA EM 2 / 12 E VITÓRIA");
  console.log(`Jogadores que construíram no 2:      ${pct(rare.built2Pct)} | vencedores com 2: ${pct(rare.winnerHad2Pct)}`);
  console.log(`Jogadores que construíram no 12:     ${pct(rare.built12Pct)} | vencedores com 12: ${pct(rare.winnerHad12Pct)}`);
  console.log(`Jogadores com 2 OU 12:               ${pct(rare.builtEitherPct)} | vencedores: ${pct(rare.winnerHadEitherPct)}`);
  console.log(`Jogadores com 2 E 12:                ${pct(rare.builtBothPct)} | vencedores: ${pct(rare.winnerHadBothPct)}`);
  console.log(comparisonLine("Win rate — 2", rare.comparisons.on2));
  console.log(comparisonLine("Win rate — 12", rare.comparisons.on12));
  console.log(comparisonLine("Win rate — 2/12", rare.comparisons.onEither));
  console.log(comparisonLine("Win rate — ambos", rare.comparisons.onBoth));

  console.log("\nCOORTES DE PRESENÇA RARA");
  console.log("Coorte              obs.    peso%    win%");
  for (const row of rare.categories) {
    console.log(`${row.label.padEnd(18)} ${String(row.n).padStart(5)}  ${pct(row.sharePct).padStart(8)}  ${pct(row.winRatePct).padStart(7)}`);
  }

  console.log("\nCONTROLO SIMPLES PELO N.º FINAL DE EDIFÍCIOS");
  console.log("Edif.   obs.   nenhum     só 2     só 12     ambos");
  for (const row of rare.byFinalBuildingCount) {
    const cell = (entry) => entry.n ? `${pct(entry.winRatePct)}(${entry.n})` : "—";
    console.log(`${String(row.buildingCount).padStart(4)}  ${String(row.n).padStart(5)}  ${cell(row.categories.none).padStart(10)}  ${cell(row.categories.only2).padStart(8)}  ${cell(row.categories.only12).padStart(9)}  ${cell(row.categories.both).padStart(9)}`);
  }
  const adjusted = rare.adjustedByFinalBuildingCount;
  console.log(`Ajustado — 2      com ${pct(adjusted.on2.withWinRate)} | sem ${pct(adjusted.on2.withoutWinRate)} | Δ ${pp(adjusted.on2.deltaPercentagePoints)} | cobertura ${adjusted.on2.coveredObservations}`);
  console.log(`Ajustado — 12     com ${pct(adjusted.on12.withWinRate)} | sem ${pct(adjusted.on12.withoutWinRate)} | Δ ${pp(adjusted.on12.deltaPercentagePoints)} | cobertura ${adjusted.on12.coveredObservations}`);
  console.log(`Ajustado — 2/12   com ${pct(adjusted.onEither.withWinRate)} | sem ${pct(adjusted.onEither.withoutWinRate)} | Δ ${pp(adjusted.onEither.deltaPercentagePoints)} | cobertura ${adjusted.onEither.coveredObservations}`);
  console.log(`Ajustado — ambos  com ${pct(adjusted.onBoth.withWinRate)} | sem ${pct(adjusted.onBoth.withoutWinRate)} | Δ ${pp(adjusted.onBoth.deltaPercentagePoints)} | cobertura ${adjusted.onBoth.coveredObservations}`);

  console.log("\nTRINDADE DAS ARMAS");
  console.log(`Jogadores que completaram: ${pct(trinity.completedByPlayersPct)} | jogos com ≥1 Trindade: ${pct(trinity.gamesWithCompletionPct)}`);
  console.log(`Vencedores que completaram: ${pct(trinity.winnerCompletedPct)} | ronda média: ${number(trinity.averageCompletionRound)}`);
  console.log(comparisonLine("Win rate — Trind.", trinity.comparison));
  if (trinity.completionOrders.length) {
    console.log("Ordens de conclusão mais frequentes:");
    for (const entry of trinity.completionOrders.slice(0, 5)) {
      console.log(`  ${entry.order.padEnd(36)} ${pct(entry.pct)} (${entry.count})`);
    }
  }

  console.log("\nPOR PERSONAGEM");
  console.log("Personagem             apar.   win%     no 2%   win|2    no 12%  win|12   trind.%  win|trind.");
  for (const row of summary.characters) {
    console.log(
      `${row.characterName.slice(0, 21).padEnd(21)} ${String(row.appearances).padStart(5)}  ${pct(row.winRatePct).padStart(7)}  ${pct(row.built2Pct).padStart(7)}  ${pct(row.winRateWith2Pct).padStart(7)}  ${pct(row.built12Pct).padStart(7)}  ${pct(row.winRateWith12Pct).padStart(7)}  ${pct(row.trinityPct).padStart(8)}  ${pct(row.winRateWithTrinityPct).padStart(10)}`,
    );
  }

  if (meta.failedGames) {
    console.log("\nATENÇÃO: existem simulações incompletas. O JSON contém seeds e motivos para reprodução.");
  }
  console.log("\nNota: diferenças de win rate mostram associação, não provam causalidade. O ajuste por edifícios é descritivo e usa o total final de edifícios como estrato.\n");
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
      onProgress: options.quiet ? undefined : (done, total) => {
        if (done === total || done % Math.max(1, Math.floor(total / 10)) === 0) {
          process.stderr.write(`\rBenchmark: ${done}/${total}`);
        }
      },
    });
  }

  const chunks = [];
  let cursor = 0;
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
  console.log(`Uso:\n  npm run benchmark:bots -- --mode dragao --players 4 --games 1000\n\nOpções:\n  --mode <modo>         classico | dragao | rapido | guerra | exploracao\n  --players <2-4>       número de bots (predefinição: 4)\n  --games <n>           número de jogos (predefinição: 1000)\n  --seed <n>            seed base reproduzível\n  --workers <n>         workers paralelos (predefinição: até 4)\n  --max-steps <n>       limite de ações por jogo\n  --out <ficheiro.json> guarda o relatório completo em JSON\n  --quiet                esconde o progresso\n`);
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
    const allowedModes = new Set(["classico", "dragao", "rapido", "guerra", "exploracao"]);
    if (!allowedModes.has(options.mode)) throw new Error(`Modo inválido: ${options.mode}`);

    const startedAt = Date.now();
    const records = await runParallel(options);
    if (!options.quiet) process.stderr.write("\n");
    const summary = summarizeBenchmark(records, {
      requestedGames: options.games,
      mode: options.mode,
      playerCount: options.playerCount,
      baseSeed: options.baseSeed,
    });
    summary.meta.elapsedSeconds = Math.round((Date.now() - startedAt) / 10) / 100;
    printReport(summary);

    if (options.out) {
      await writeFile(options.out, `${JSON.stringify({ summary, games: records }, null, 2)}\n`, "utf8");
      console.log(`Relatório JSON guardado em: ${options.out}`);
    }
    if (summary.meta.failedGames) process.exitCode = 2;
  } catch (error) {
    console.error(`Benchmark falhou: ${error?.message || error}`);
    process.exitCode = 1;
  }
}
