const fs = require("node:fs");
const path = require("node:path");
const { readRuntimeSource } = require("./lib/runtime-source.cjs");
const root = path.resolve(__dirname, "..");
const legacy = readRuntimeSource(root);
const social = fs.readFileSync(path.join(root, "src/multiplayer/socialEventController.js"), "utf8");
const board3d = fs.readFileSync(path.join(root, "src/ui/board/Board3D.jsx"), "utf8");
const boardScene = fs.readFileSync(path.join(root, "src/ui/board/boardSceneController.js"), "utf8");
const failures = [];
if (/const PEERCFG\s*=/.test(legacy) || /const PREFIX\s*=\s*"reinos-dragao/.test(legacy)) failures.push("A configuração PeerJS voltou ao JSX.");
if (!board3d.includes("[g.v, vertexKey, edgeKey, hexKey]")) failures.push("Board3D não limita updates à revisão e aos alvos interativos.");
if (!boardScene.includes("disposeObjectTree(scene)")) failures.push("A cena do tabuleiro não usa disposal comum.");
if (!legacy.includes("Object.values(emoteTimers.current)")) failures.push("Timers de emotes não são limpos no unmount.");
if (/createId\s*=\s*\(\)\s*=>\s*Math\.random/.test(social)) failures.push("IDs sociais voltaram a usar Math.random diretamente.");
if (failures.length) {
  console.error("Falhas de saneamento lifecycle:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}
console.log("Saneamento verificado: Board3D, timers, disposal, PeerJS e IDs sociais.");
