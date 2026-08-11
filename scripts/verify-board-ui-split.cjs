const fs = require("node:fs");
const path = require("node:path");
const { readRuntimeSource } = require("./lib/runtime-source.cjs");
const root = path.resolve(__dirname, "..");
const legacy = readRuntimeSource(root);
const board = fs.readFileSync(path.join(root, "src/ui/board/Board3D.jsx"), "utf8");
const controller = fs.readFileSync(path.join(root, "src/ui/board/boardSceneController.js"), "utf8");
const visuals = fs.readFileSync(path.join(root, "src/ui/board/boardVisualConfig.js"), "utf8");
const signatures = fs.readFileSync(path.join(root, "src/ui/board/boardUpdateSignature.js"), "utf8");
const failures = [];
if (legacy.includes("function Board3D(")) failures.push("Board3D voltou ao ficheiro legacy.");
if (legacy.includes("function createScene(")) failures.push("O controller Three.js voltou ao ficheiro legacy.");
if (/from\s+["']three["']/.test(legacy)) failures.push("Three.js voltou a ser importado pelo legacy.");
if (!board.includes('from "./boardSceneController.js"')) failures.push("Board3D não usa o controller modular.");
if (!board.includes("stableSpotKey") || !signatures.includes("export function stableSpotKey")) failures.push("Board3D não estabiliza os conjuntos interativos.");
if (!board.includes("stableBoardGeometryKey") || !signatures.includes("export function stableBoardGeometryKey")) failures.push("Board3D não separa geometria estável de revisões normais do jogo.");
if (!board.includes("cameraStateRef") || !board.includes("controller.getCameraState()") || !controller.includes("initialCameraState") || !controller.includes("getCameraState()")) failures.push("Board3D perdeu a persistência local da câmara entre atualizações/recriações da cena.");
if (!board.includes("[g.v, vertexKey, edgeKey, hexKey]")) failures.push("Board3D não limita updates à revisão e assinaturas interativas.");
if (!controller.includes('from "three"')) failures.push("O renderer não está isolado no controller.");
if (!controller.includes("disposeObjectTree(scene)")) failures.push("O controller não usa disposal comum.");
if (!visuals.includes("HIDDEN_TERRAIN_TYPE")) failures.push("A vista oculta não deriva do sentinela canónico.");
if (controller.split(/\r?\n/).length > 2200) failures.push("O controller do tabuleiro voltou a crescer acima da fronteira desta fase.");
if (failures.length) {
  console.error("Falhas na modularização do Board3D:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}
console.log("Board3D dividido: React, controller e configuração visual separados, com updates estáveis.");
