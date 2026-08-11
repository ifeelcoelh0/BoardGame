#!/usr/bin/env node
/*
   Conversão de todos os assets de áudio para AAC em contentor .m4a.

   Porque AAC e não Opus: o Opus comprime 3% melhor nestes bitrates, mas o
   `decodeAudioData` do Safari só o aceita em contentor CAF (desde 2017) ou Ogg
   (só desde Safari 18.4, primavera de 2025). O AAC funciona em todos os
   browsers desde 2016. Num projeto de uma pessoa, um formato universal vale
   mais do que 3% de tamanho e duas vias de fallback.

   Porque isto também é uma correção de bug: os 67 ficheiros .ogg do projeto são
   Vorbis, que o Safari não descodifica em Web Audio de forma alguma. Como o
   `playSample` faz `.catch(() => {})`, o jogo está silencioso em iOS sem dar
   erro. A conversão resolve os dois problemas de uma vez.

   Perfis de bitrate:
     voz      48k mono    fala, o Opus/AAC são transparentes a este ritmo
     sfx      64k mono    curtos, com transientes (impactos, dados, moedas)
     ambiente 80k stereo  loops longos, precisam de imagem estéreo
     musica   96k stereo  tema principal, servido em streaming

   Uso:
     node tools/convert-audio.mjs --dry-run    lista o que faria
     node tools/convert-audio.mjs              converte e apaga os originais
     node tools/convert-audio.mjs --keep       converte e mantém os originais
*/

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const AUDIO = path.join(ROOT, "public/assets/audio");
const SOURCE_EXTENSIONS = new Set([".wav", ".ogg", ".opus", ".mp3"]);

const dryRun = process.argv.includes("--dry-run");
const keepOriginals = process.argv.includes("--keep");

const PROFILES = {
  voz: { bitrate: "48k", channels: 1 },
  sfx: { bitrate: "64k", channels: 1 },
  ambiente: { bitrate: "80k", channels: 2 },
  musica: { bitrate: "96k", channels: 2 },
};

/* Loops de ambiente e o tema principal são identificados por nome porque o
   perfil depende do papel no jogo, não das propriedades do ficheiro. */
const AMBIENT_NAMES = new Set([
  "lobby-fireplace",
  "lobby-start-medieval",
  "disaster-tsunami",
]);
const MUSIC_NAMES = new Set(["main-theme", "music"]);

function profileFor(relativePath) {
  const stem = path.basename(relativePath, path.extname(relativePath));
  if (MUSIC_NAMES.has(stem)) return "musica";
  if (AMBIENT_NAMES.has(stem)) return "ambiente";
  if (relativePath.startsWith("voices/")) return "voz";
  return "sfx";
}

function walk(directory, relative = "") {
  const found = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const rel = relative ? `${relative}/${entry.name}` : entry.name;
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) found.push(...walk(full, rel));
    else if (SOURCE_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) found.push(rel);
  }
  return found;
}

function requireFfmpeg() {
  try {
    execFileSync("ffmpeg", ["-version"], { stdio: "ignore" });
  } catch {
    console.error("ffmpeg não encontrado. Instalar com: brew install ffmpeg | apt install ffmpeg");
    process.exit(1);
  }
}

function convert(relativePath, profileName) {
  const { bitrate, channels } = PROFILES[profileName];
  const source = path.join(AUDIO, relativePath);
  const target = path.join(AUDIO, `${relativePath.slice(0, -path.extname(relativePath).length)}.m4a`);

  /* -vn descarta capas embutidas: o main-theme.mp3 traz uma imagem H.264 que
     o contentor .m4a rejeita e faz falhar a conversão inteira. */
  execFileSync("ffmpeg", [
    "-v", "error", "-y",
    "-vn",
    "-i", source,
    "-c:a", "aac",
    "-b:a", bitrate,
    "-ar", "48000",
    "-ac", String(channels),
    "-movflags", "+faststart",
    target,
  ]);

  if (!keepOriginals) fs.unlinkSync(source);
  return { source, target };
}

requireFfmpeg();

if (!fs.existsSync(AUDIO)) {
  console.error(`Pasta de áudio não encontrada: ${AUDIO}`);
  process.exit(1);
}

const files = walk(AUDIO).sort();
if (files.length === 0) {
  console.log("Nada a converter. Já foi corrido?");
  process.exit(0);
}

const totals = { before: 0, after: 0, byProfile: {} };

for (const relativePath of files) {
  const profileName = profileFor(relativePath);
  const before = fs.statSync(path.join(AUDIO, relativePath)).size;
  totals.before += before;
  totals.byProfile[profileName] ??= { count: 0, before: 0, after: 0 };
  totals.byProfile[profileName].count += 1;
  totals.byProfile[profileName].before += before;

  if (dryRun) {
    console.log(`[${profileName}] ${relativePath}`);
    continue;
  }

  const { target } = convert(relativePath, profileName);
  const after = fs.statSync(target).size;
  totals.after += after;
  totals.byProfile[profileName].after += after;
}

const mb = (bytes) => (bytes / 1048576).toFixed(2);

console.log("");
for (const [name, stats] of Object.entries(totals.byProfile)) {
  const suffix = dryRun ? "" : ` -> ${mb(stats.after)} MB`;
  console.log(`${name.padEnd(9)} ${String(stats.count).padStart(3)} ficheiros  ${mb(stats.before)} MB${suffix}`);
}

if (dryRun) {
  console.log(`\nSimulação: ${files.length} ficheiros, ${mb(totals.before)} MB. Correr sem --dry-run para converter.`);
} else {
  const saved = totals.before - totals.after;
  console.log(`\nTotal ${mb(totals.before)} MB -> ${mb(totals.after)} MB (menos ${mb(saved)} MB, ${(totals.before / totals.after).toFixed(1)}x)`);
  console.log("Próximo passo: node tools/check-audio-references.mjs");
}
