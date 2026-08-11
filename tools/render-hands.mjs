import fs from "node:fs";
import { renderTile, sceneFor, writePNG, V } from "./render-core.mjs";
const OUT = process.argv[2] ?? "/home/claude/hands";
fs.mkdirSync(OUT, { recursive: true });
const cw = 380, ch = 300, cols = 4, rows = 2;
const ids = ["vlad","maria","protheus","romeo","makuru","artheria","muriel","bones"];
const buf = Buffer.alloc(cw*cols*ch*rows*3, 8);
ids.forEach((id,i)=>{
  const tris = sceneFor(id, { withChair: false });
  const px = renderTile({ tris, camPos: V(-0.62, 1.62, -1.05), target: V(0.16, 1.2, -0.42), fov: 30, width: cw, height: ch, groundY: null });
  const cx=(i%cols)*cw, cy=Math.floor(i/cols)*ch;
  for(let y=0;y<ch;y++) px.copy(buf, ((cy+y)*cw*cols+cx)*3, y*cw*3, (y+1)*cw*3);
});
writePNG(`${OUT}/maos.png`, cw*cols, ch*rows, buf);
console.log("ok");
