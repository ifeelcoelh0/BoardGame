import fs from "node:fs";
import { installNodeCanvas } from "./node-canvas2d.mjs";
installNodeCanvas();
import * as THREE from "three";
import { renderTile, writePNG, V, collectFrom } from "./render-core.mjs";
const OUT = process.argv[2];
fs.mkdirSync(OUT, { recursive: true });
const B = await import("../src/ui/lobby/lobbySceneBook.js");

const scene = new THREE.Group();
B.createGameBook(scene);
// Duas linhas: com a folha impressa e sem ela, porque de frente a folha cobre
// toda a estrutura e é a estrutura que estou a avaliar.
/* A folha impressa é branca no material e recebe a cor da textura do livro, que
   este rasterizador não amostra. Sem tingir, a folha aparece branca e eu avaliava
   uma relação de valores que não existe. #e8d6b0 é o pergaminho que a textura
   pinta. */
scene.traverse((o) => {
  if (o.name === "book-page") o.material.color.set(0xe8d6b0);
});
const tris = collectFrom(scene);
const bare = new THREE.Group();
B.createGameBook(bare);
bare.traverse((o) => { if (o.name === "book-page") o.visible = false; });
bare.updateMatrixWorld(true);
const trisBare = collectFrom(bare).filter(() => true);
const A = B.BOOK_ANCHOR;
const cw = 480, ch = 470;
const views = [
  [V(A.x, A.y + 0.1, A.z + 3.4), V(A.x, A.y, A.z)],
  [V(A.x - 2.3, A.y + 0.8, A.z + 2.6), V(A.x, A.y, A.z)],
  [V(A.x - 3.2, A.y + 0.2, A.z + 0.7), V(A.x, A.y, A.z)],
  [V(A.x + 0.3, A.y + 2.4, A.z + 1.9), V(A.x, A.y, A.z)],
];
const buf = Buffer.alloc(cw * views.length * ch * 2 * 3, 8);
const W = cw * views.length;
[tris, trisBare].forEach((set, row) => {
  views.forEach(([c, t], i) => {
    const px = renderTile({ tris: set, camPos: c, target: t, fov: 40, width: cw, height: ch, groundY: null });
    for (let y = 0; y < ch; y++) px.copy(buf, ((row * ch + y) * W + i * cw) * 3, y * cw * 3, (y + 1) * cw * 3);
  });
});
writePNG(`${OUT}/livro3d.png`, W, ch * 2, buf);
console.log("ok");
