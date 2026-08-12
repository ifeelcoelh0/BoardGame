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
// Hash text in a canonical LF form so SHA256SUMS.txt is portable across OSes.
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

const files = walk(root).sort();
const lines = files.map((rel) => `${digestFile(path.join(root, rel))}  ${rel}`);

fs.writeFileSync(checksumPath, `${lines.join("\n")}\n`, "utf8");
console.log(`SHA256SUMS.txt atualizado: ${files.length} ficheiros (texto normalizado para LF).`);
