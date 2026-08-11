import { readdir, stat } from "node:fs/promises";
import { join, relative } from "node:path";
import { gzipSync } from "node:zlib";
import { readFile } from "node:fs/promises";

const root = new URL("../dist/", import.meta.url);
const rows = [];

async function walk(dir) {
  for (const name of await readdir(dir)) {
    const path = join(dir, name);
    const info = await stat(path);
    if (info.isDirectory()) await walk(path);
    else if (/\.(js|css)$/.test(name)) {
      const data = await readFile(path);
      rows.push({ file: relative(root.pathname, path), bytes: info.size, gzip: gzipSync(data).length });
    }
  }
}

await walk(root.pathname);
rows.sort((a, b) => b.gzip - a.gzip);
const kb = (value) => `${(value / 1024).toFixed(1)} kB`;
console.table(rows.map((row) => ({ file: row.file, raw: kb(row.bytes), gzip: kb(row.gzip) })));
console.log(`Total JS/CSS: ${kb(rows.reduce((sum, row) => sum + row.bytes, 0))} raw / ${kb(rows.reduce((sum, row) => sum + row.gzip, 0))} gzip`);
