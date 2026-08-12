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

const files = walk(root).sort();
const lines = files.map((rel) => {
  const digest = crypto
    .createHash("sha256")
    .update(fs.readFileSync(path.join(root, rel)))
    .digest("hex");
  return `${digest}  ${rel}`;
});

fs.writeFileSync(checksumPath, `${lines.join("\n")}\n`, "utf8");
console.log(`SHA256SUMS.txt atualizado: ${files.length} ficheiros.`);
