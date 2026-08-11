import fs from "node:fs";
import { renderTile, sceneFor, writePNG, V } from "./render-core.mjs";
const OUT = process.argv[2];
fs.mkdirSync(OUT, { recursive: true });
const cw=380, ch=460;
const tris = sceneFor("romeo");
const views=[
 [V(0,1.6,-1.6), V(0,1.35,0)],
 [V(-1.2,1.62,-1.2), V(0,1.35,0)],
 [V(-1.7,1.6,0.1), V(0,1.35,0.05)],
 [V(0.3,1.7,1.6), V(0,1.35,0.05)],
];
const buf=Buffer.alloc(cw*4*ch*3,8);
views.forEach(([c,t],i)=>{
  const px=renderTile({tris,camPos:c,target:t,fov:32,width:cw,height:ch,groundY:null});
  for(let y=0;y<ch;y++) px.copy(buf,(y*cw*4+i*cw)*3,y*cw*3,(y+1)*cw*3);
});
writePNG(`${OUT}/romeo.png`, cw*4, ch, buf);
console.log("ok");
