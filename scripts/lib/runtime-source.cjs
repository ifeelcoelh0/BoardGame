const fs = require("node:fs");
const path = require("node:path");

const RUNTIME_SOURCE_FILES = Object.freeze([
  "src/app/App.jsx",
  "src/app/useRealmSession.js",
]);

function runtimeSourcePaths(root = process.cwd()) {
  return RUNTIME_SOURCE_FILES.map((file) => path.join(root, file));
}

function readRuntimeSource(root = process.cwd()) {
  return runtimeSourcePaths(root)
    .map((file) => fs.readFileSync(file, "utf8"))
    .join("\n");
}

module.exports = { RUNTIME_SOURCE_FILES, runtimeSourcePaths, readRuntimeSource };
