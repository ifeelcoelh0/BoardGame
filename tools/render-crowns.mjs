import fs from "node:fs";
import { renderTile, sceneFor, writePNG, V } from "./render-core.mjs";
const OUT=process.argv[2]; fs.mkdirSync(OUT,{recursive:true});
const cw=420,ch=380;
const jobs=[["maria",V(0,1.86,-0.85),V(0,1.8,0)],["maria",V(-0.75,1.88,-0.5),V(0,1.8,0)],["protheus",V(0,1.92,-0.9),V(0,1.86,0)],["artheria",V(0,1.9,-0.85),V(0,1.84,0)]];
const buf=Buffer.alloc(cw*4*ch*3,8);
jobs.forEach(([id,c,t],i)=>{const px=renderTile({tris:sceneFor(id,{withChair:false}),camPos:c,target:t,fov:26,width:cw,height:ch,groundY:null});
for(let y=0;y<ch;y++) px.copy(buf,(y*cw*4+i*cw)*3,y*cw*3,(y+1)*cw*3);});
writePNG(`${OUT}/coroas.png`,cw*4,ch,buf); console.log("ok");
