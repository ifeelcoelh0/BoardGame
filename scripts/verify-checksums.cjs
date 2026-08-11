const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const checksumPath = path.join(root, "SHA256SUMS.txt");
const ignoredRoots = new Set(["node_modules", "dist", ".git"]);
const ignoredFiles = new Set(["package-lock.json"]);

function walk(directory, relative = "") {
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (!relative && ignoredRoots.has(entry.name)) continue;
    const rel = relative ? `${relative}/${entry.name}` : entry.name;
    if (rel === "SHA256SUMS.txt" || (!relative && ignoredFiles.has(entry.name))) continue;
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...walk(full, rel));
    else if (entry.isFile()) files.push(rel.replaceAll("\\", "/"));
  }
  return files;
}

const listed = new Map();
for (const line of fs.readFileSync(checksumPath, "utf8").split(/\r?\n/)) {
  if (!line.trim()) continue;
  const match = line.match(/^([a-f0-9]{64})  (.+)$/);
  if (!match) {
    console.error(`Linha inválida em SHA256SUMS.txt: ${line}`);
    process.exit(1);
  }
  listed.set(match[2], match[1]);
}

const actualFiles = walk(root).sort();
const failures = [];
for (const rel of actualFiles) {
  const expected = listed.get(rel);
  if (!expected) {
    failures.push(`Ficheiro não listado: ${rel}`);
    continue;
  }
  const digest = crypto.createHash("sha256").update(fs.readFileSync(path.join(root, rel))).digest("hex");
  if (digest !== expected) failures.push(`Checksum incorreto: ${rel}`);
}
for (const rel of listed.keys()) {
  if (!actualFiles.includes(rel)) failures.push(`Entrada sem ficheiro: ${rel}`);
}
if (failures.length) {
  console.error("Falhas nos checksums:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}
console.log(`Checksums verificados: ${actualFiles.length} ficheiros.`);
