const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const dryRun = process.argv.includes("--dry-run");

// Historical delivery/release artefacts belong in GitHub Releases or an external archive,
// not in the application source tree. Keep these rules root-scoped and deliberately narrow.
const legacyArtifactPatterns = [
  /^APPLY-v.+\.txt$/,
  /^README-v.+\.txt$/,
  /^v.+-README\.txt$/,
  /^boardgame-v.+-base\.zip$/,
  /^reinos-do-dragao-v.+\.patch$/,
  /^subtitle-current-files\.zip$/,
];

function isLegacyArtifact(filename) {
  return legacyArtifactPatterns.some((pattern) => pattern.test(filename));
}

const matches = fs
  .readdirSync(root, { withFileTypes: true })
  .filter((entry) => entry.isFile() && isLegacyArtifact(entry.name))
  .map((entry) => entry.name)
  .sort();

if (!matches.length) {
  console.log("Nenhum artefacto histórico de release encontrado na raiz do projeto.");
  process.exit(0);
}

let reclaimedBytes = 0;
for (const filename of matches) {
  const fullPath = path.join(root, filename);
  reclaimedBytes += fs.statSync(fullPath).size;
  if (!dryRun) fs.rmSync(fullPath);
  console.log(`${dryRun ? "[dry-run] removeria" : "removido"}: ${filename}`);
}

const reclaimedMb = reclaimedBytes / 1024 / 1024;
console.log(
  `${dryRun ? "Total identificado" : "Espaço removido"}: ${reclaimedMb.toFixed(2)} MB (${matches.length} ficheiros).`,
);
