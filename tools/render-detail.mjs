import fs from "node:fs";
import { renderTile, sceneFor, writePNG, V } from "./render-core.mjs";
const OUT=process.argv[2]; fs.mkdirSync(OUT,{recursive:true});
const cw=440,ch=440;
const jobs=[["vlad",V(-0.35,1.5,-0.85),V(0,1.3,0)],["maria",V(-0.3,1.62,-0.8),V(0,1.42,0)],["protheus",V(-0.35,1.5,-0.9),V(0,1.3,0)],["bones",V(-0.3,1.45,-0.8),V(0,1.28,0)]];
const buf=Buffer.alloc(cw*4*ch*3,8);
jobs.forEach(([id,c,t],i)=>{const px=renderTile({tris:sceneFor(id,{withChair:false}),camPos:c,target:t,fov:26,width:cw,height:ch,groundY:null});
for(let y=0;y<ch;y++) px.copy(buf,(y*cw*4+i*cw)*3,y*cw*3,(y+1)*cw*3);});
writePNG(`${OUT}/detalhe.png`,cw*4,ch,buf); console.log("ok");
