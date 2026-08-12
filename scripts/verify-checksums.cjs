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

// Git may expose the same text file as CRLF on Windows and LF on Linux.
// Hash text in a canonical LF form so verification is identical on every OS.
// Binary files are kept byte-for-byte unchanged.
function bytesForChecksum(fullPath) {
  const bytes = fs.readFileSync(fullPath);
  if (bytes.includes(0)) return bytes;

  const text = bytes.toString("utf8");
  if (text.includes("\uFFFD")) return bytes;

  return Buffer.from(text.replace(/\r\n/g, "\n"), "utf8");
}

function digestFile(fullPath) {
  return crypto.createHash("sha256").update(bytesForChecksum(fullPath)).digest("hex");
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
const actualSet = new Set(actualFiles);
const failures = [];
for (const rel of actualFiles) {
  const expected = listed.get(rel);
  if (!expected) {
    failures.push(`Ficheiro não listado: ${rel}`);
    continue;
  }
  const digest = digestFile(path.join(root, rel));
  if (digest !== expected) failures.push(`Checksum incorreto: ${rel}`);
}
for (const rel of listed.keys()) {
  if (!actualSet.has(rel)) failures.push(`Entrada sem ficheiro: ${rel}`);
}

if (failures.length) {
  console.error("Falhas nos checksums:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  console.error("\nSe estas alterações são intencionais, executa: npm run checksums:update");
  process.exit(1);
}

console.log(`Checksums verificados: ${actualFiles.length} ficheiros (texto normalizado para LF).`);
