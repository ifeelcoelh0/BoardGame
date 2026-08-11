import fs from "node:fs";
import { installNodeCanvas } from "./node-canvas2d.mjs";
installNodeCanvas();
import * as THREE from "three";
import { renderTile, writePNG, V, collectFrom } from "./render-core.mjs";
const OUT = process.argv[2];
fs.mkdirSync(OUT, { recursive: true });
const D = await import("../src/ui/lobby/lobbySceneDecorations.js");

function sceneOf(fn) {
  const s = new THREE.Group();
  fn(s);
  return collectFrom(s);
}

const cw = 460, ch = 420;
const jobs = [
  ["veado", sceneOf((s) => D.addWallTrophy(s, 0, 0, 0, "deer")), V(0.1, 0.42, 2.0), V(0, 0.05, 0.3)],
  ["veado 3/4", sceneOf((s) => D.addWallTrophy(s, 0, 0, 0, "deer")), V(-1.4, 0.5, 1.5), V(0, 0.05, 0.3)],
  ["javali", sceneOf((s) => D.addWallTrophy(s, 0, 0, 0, "boar")), V(0.1, 0.36, 2.0), V(0, 0.02, 0.3)],
  ["javali 3/4", sceneOf((s) => D.addWallTrophy(s, 0, 0, 0, "boar")), V(-1.4, 0.44, 1.5), V(0, 0.02, 0.3)],
];
const buf = Buffer.alloc(cw * 4 * ch * 3, 8);
jobs.forEach(([, tris, cam, tgt], i) => {
  const px = renderTile({ tris, camPos: cam, target: tgt, fov: 34, width: cw, height: ch, groundY: null });
  for (let y = 0; y < ch; y++) px.copy(buf, (y * cw * 4 + i * cw) * 3, y * cw * 3, (y + 1) * cw * 3);
});
writePNG(`${OUT}/trofeus.png`, cw * 4, ch, buf);

const wtris = sceneOf((s) => D.addBackWallWeaponDisplay(s));
const wbuf = Buffer.alloc(cw * 3 * ch * 3, 8);
[[V(0, 3.78, -1.9), V(0, 3.78, -5.31)], [V(-1.7, 4.1, -2.6), V(0, 3.75, -5.31)], [V(0, 4.6, -3.2), V(0, 3.8, -5.31)]]
  .forEach(([c, t], i) => {
    const px = renderTile({ tris: wtris, camPos: c, target: t, fov: 44, width: cw, height: ch, groundY: null });
    for (let y = 0; y < ch; y++) px.copy(wbuf, (y * cw * 3 + i * cw) * 3, y * cw * 3, (y + 1) * cw * 3);
  });
writePNG(`${OUT}/armas.png`, cw * 3, ch, wbuf);
console.log("ok");
