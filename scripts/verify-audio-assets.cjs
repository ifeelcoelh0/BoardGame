/* Verifica o contrato entre o catálogo de áudio e os ficheiros publicados. */
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const root = path.resolve(__dirname, "..");
const audioDir = path.join(root, "public", "assets", "audio");
const problems = [];

function walk(directory, relative = "") {
  const found = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const rel = relative ? `${relative}/${entry.name}` : entry.name;
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) found.push(...walk(full, rel));
    else if (entry.name !== "manifest.json") found.push(rel);
  }
  return found;
}

async function main() {
  const manifestModule = await import(pathToFileURL(path.join(root, "src", "audio", "audioManifest.js")).href);
  const manifest = manifestModule.createAudioManifest("/");
  const referenced = new Set();

  for (const urls of Object.values(manifest)) {
    for (const url of urls) {
      const prefix = "/assets/audio/";
      if (!url.startsWith(prefix)) problems.push(`URL fora da raiz de áudio: ${url}`);
      else referenced.add(url.slice(prefix.length));
    }
  }

  const onDisk = new Set(walk(audioDir));
  for (const reference of [...referenced].sort()) {
    if (!onDisk.has(reference)) problems.push(`Referenciado mas ausente do disco: ${reference}`);
  }
  for (const file of [...onDisk].sort()) {
    if (!referenced.has(file)) problems.push(`No disco mas nunca referenciado: ${file}`);
  }

  for (const file of [...onDisk].filter((name) => /\.(ogg|opus|wav|mp3)$/i.test(name))) {
    problems.push(`Formato fora da política AAC/.m4a: ${file}`);
  }

  for (const key of manifestModule.AUDIO_STREAMED_SOUND_KEYS) {
    if (!manifestModule.isStreamedSoundKey(key)) {
      problems.push(`Faixa longa deixou de estar classificada como streaming: ${key}.`);
    }
    if (manifestModule.shouldPrimeSoundKey(key)) {
      problems.push(`Faixa longa voltou a entrar no prewarm de AudioBuffer: ${key}.`);
    }
  }
  if (manifestModule.AUDIO_STREAMED_SOUND_KEYS.length < 5) {
    problems.push("O catálogo de soundtrack não contém lobby, shuffle e finale como streaming.");
  }

  if (problems.length) {
    console.error("Verificação de áudio falhou:");
    for (const problem of problems) console.error(`  - ${problem}`);
    process.exit(1);
  }

  const totalBytes = [...onDisk].reduce((sum, file) => sum + fs.statSync(path.join(audioDir, file)).size, 0);
  console.log(
    `Áudio verificado: ${onDisk.size} ficheiros, ${(totalBytes / 1048576).toFixed(2)} MB, ` +
      `${referenced.size} referências resolvidas, ${manifestModule.AUDIO_STREAMED_SOUND_KEYS.length} faixas longas em streaming.`,
  );
}

main().catch((error) => {
  console.error("Verificação de áudio falhou:", error.message);
  process.exit(1);
});
