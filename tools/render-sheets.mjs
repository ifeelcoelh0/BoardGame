import * as THREE from "three";
import fs from "node:fs";
import { LOBBY_CHARACTER_IDS } from "../src/ui/lobby/lobbyCharacters.js";
import { renderTile, sceneFor, writePNG, V } from "./render-core.mjs";

const OUT = process.argv[2] ?? "/home/claude/out";
fs.mkdirSync(OUT, { recursive: true });

function tile(sheetW, sheetH, cols, rows, cellW, cellH, jobs) {
  const buf = Buffer.alloc(sheetW * sheetH * 3, 8);
  jobs.forEach((job, i) => {
    const cx = (i % cols) * cellW;
    const cy = Math.floor(i / cols) * cellH;
    const px = renderTile({ ...job, width: cellW, height: cellH });
    for (let y = 0; y < cellH; y++) {
      px.copy(buf, ((cy + y) * sheetW + cx) * 3, y * cellW * 3, (y + 1) * cellW * 3);
    }
  });
  return buf;
}

/* --- sheet 1: 8 personagens sentados, 3/4 --- */
{
  const cw = 300, ch = 400, cols = 4, rows = 2;
  const jobs = LOBBY_CHARACTER_IDS.map((id) => ({
    tris: sceneFor(id),
    camPos: V(-2.1, 1.86, -2.6), target: V(0, 1.12, 0), fov: 32, groundY: 0,
  }));
  writePNG(`${OUT}/sheet-1-personagens-34.png`, cw * cols, ch * rows, tile(cw * cols, ch * rows, cols, rows, cw, ch, jobs));
}

/* --- sheet 2: cabecas, frente e perfil --- */
{
  const cw = 250, ch = 250, cols = 4, rows = 4;
  const jobs = [];
  LOBBY_CHARACTER_IDS.forEach((id) => {
    const tris = sceneFor(id, { withChair: false });
    // Enquadramento por personagem: as cabeças estão a alturas diferentes
    // porque a escala do corpo varia entre 0.79 e 1.04.
    let top = -Infinity;
    tris.forEach((t) => { top = Math.max(top, t.a.y, t.b.y, t.c.y); });
    const y = top - 0.15;
    jobs.push({ tris, camPos: V(0, y + 0.03, -0.98), target: V(0, y, 0), fov: 24, groundY: null });
    jobs.push({ tris, camPos: V(-0.94, y + 0.05, -0.3), target: V(0, y, 0), fov: 24, groundY: null });
  });
  writePNG(`${OUT}/sheet-2-cabecas.png`, cw * cols, ch * rows, tile(cw * cols, ch * rows, cols, rows, cw, ch, jobs));
}

/* --- sheet 3: cadeira vazia, 4 angulos --- */
{
  const cw = 330, ch = 430;
  const tris = sceneFor(null);
  const jobs = [
    { tris, camPos: V(0, 1.42, -2.9), target: V(0, 1.05, 0), fov: 32, groundY: 0 },
    { tris, camPos: V(-1.95, 1.72, -2.35), target: V(0, 1.05, 0), fov: 32, groundY: 0 },
    { tris, camPos: V(-2.9, 1.4, 0.2), target: V(0, 1.05, 0.05), fov: 32, groundY: 0 },
    { tris, camPos: V(0.3, 1.75, 2.85), target: V(0, 1.1, 0.1), fov: 32, groundY: 0 },
  ];
  writePNG(`${OUT}/sheet-3-cadeira.png`, cw * 4, ch, tile(cw * 4, ch, 4, 1, cw, ch, jobs));
}

/* --- sheet 4: perfil lateral de 4, para ver a pose sentada --- */
{
  const cw = 340, ch = 430;
  const jobs = ["vlad", "maria", "romeo", "protheus"].map((id) => ({
    tris: sceneFor(id),
    camPos: V(-2.95, 1.5, 0.1), target: V(0, 1.08, 0.05), fov: 33, groundY: 0,
  }));
  writePNG(`${OUT}/sheet-4-perfil.png`, cw * 4, ch, tile(cw * 4, ch, 4, 1, cw, ch, jobs));
}

console.log("sheets done");
