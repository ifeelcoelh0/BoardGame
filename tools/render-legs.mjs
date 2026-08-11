import fs from "node:fs";
import { renderTile, sceneFor, writePNG, V } from "./render-core.mjs";
const OUT = process.argv[2] ?? "/home/claude/legs";
fs.mkdirSync(OUT, { recursive: true });
const cw = 420, ch = 380, cols = 3, rows = 2;
const jobs = [
  ["vazia", null, V(-1.5, 0.95, -1.9), V(0, 0.5, -0.1)],
  ["vlad", "vlad", V(-1.5, 0.95, -1.9), V(0, 0.5, -0.1)],
  ["maria", "maria", V(-1.5, 0.95, -1.9), V(0, 0.5, -0.1)],
  ["romeo", "romeo", V(-1.5, 0.95, -1.9), V(0, 0.5, -0.1)],
  ["bones-frente", "bones", V(0, 0.8, -2.1), V(0, 0.5, 0)],
  ["protheus-lado", "protheus", V(-2.2, 0.8, 0.1), V(0, 0.5, 0.0)],
];
const buf = Buffer.alloc(cw*cols*ch*rows*3, 8);
jobs.forEach(([name,id,cam,tgt],i)=>{
  const tris = sceneFor(id);
  const px = renderTile({ tris, camPos: cam, target: tgt, fov: 34, width: cw, height: ch, groundY: 0 });
  const cx=(i%cols)*cw, cy=Math.floor(i/cols)*ch;
  for(let y=0;y<ch;y++) px.copy(buf, ((cy+y)*cw*cols+cx)*3, y*cw*3, (y+1)*cw*3);
});
writePNG(`${OUT}/pernas.png`, cw*cols, ch*rows, buf);
console.log("ok");
