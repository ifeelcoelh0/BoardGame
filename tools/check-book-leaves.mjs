import { installNodeCanvas } from "./node-canvas2d.mjs";
installNodeCanvas();
import * as THREE from "three";
const B = await import("../src/ui/lobby/lobbySceneBook.js");

/* As folhas de baixo e a folha impressa saem do mesmo plano subdividido 18x14,
   portanto o vértice i corresponde ao mesmo ponto paramétrico em todas. Basta
   comparar o z de cada índice para saber se alguma folha de baixo rompe à frente
   da impressa, que é o que produz as manchas. */
const scene = new THREE.Group();
B.createGameBook(scene);
scene.updateMatrixWorld(true);

// O `createGameBook` mete tudo num root, e as metades são grupos dentro dele.
const root = scene.children[0];
const halves = root.children.filter((c) => c.type === "Group" && c.children.some((m) => m.name === "book-page"));
let worst = Infinity;
let worstWhere = "";
halves.forEach((half, h) => {
  const page = half.children.find((c) => c.name === "book-page");
  if (!page) return;
  const pp = page.geometry.attributes.position;
  half.children.filter((c) => c.name?.startsWith("book-leaf-")).forEach((leaf) => {
    const lp = leaf.geometry.attributes.position;
    let minSep = Infinity;
    for (let i = 0; i < pp.count; i += 1) {
      const pz = pp.getZ(i) + page.position.z;
      const lz = lp.getZ(i) + leaf.position.z;
      const sep = pz - lz; // positivo = folha de baixo atrás da impressa
      if (sep < minSep) minSep = sep;
    }
    const tag = `metade ${h} / ${leaf.name}`;
    console.log(`${tag.padEnd(30)} separação mínima ${(minSep * 1000).toFixed(1)} mm ${minSep <= 0 ? "<= ROMPE À FRENTE" : ""}`);
    if (minSep < worst) { worst = minSep; worstWhere = tag; }
  });
});
/* Não basta cada folha estar atrás da impressa: a pilha tem de ser monótona, ou
   duas folhas de baixo cruzam-se e volta a haver manchas, agora entre elas. */
let worstPair = Infinity;
let worstPairWhere = "";
halves.forEach((half, h) => {
  const leaves = half.children
    .filter((c) => c.name?.startsWith("book-leaf-"))
    .sort((a, b) => a.name.localeCompare(b.name));
  for (let k = 0; k < leaves.length - 1; k += 1) {
    const deep = leaves[k];
    const shallow = leaves[k + 1];
    const dp = deep.geometry.attributes.position;
    const sp = shallow.geometry.attributes.position;
    let minSep = Infinity;
    for (let i = 0; i < dp.count; i += 1) {
      const sep = (sp.getZ(i) + shallow.position.z) - (dp.getZ(i) + deep.position.z);
      if (sep < minSep) minSep = sep;
    }
    const tag = `metade ${h} / ${deep.name} sob ${shallow.name}`;
    console.log(`${tag.padEnd(44)} ${(minSep * 1000).toFixed(1)} mm ${minSep <= 0 ? "<= CRUZAM" : ""}`);
    if (minSep < worstPair) { worstPair = minSep; worstPairWhere = tag; }
  }
});

console.log(`\nfolha impressa, pior caso: ${(worst * 1000).toFixed(1)} mm em ${worstWhere}`);
console.log(`entre folhas, pior caso:   ${(worstPair * 1000).toFixed(1)} mm em ${worstPairWhere}`);
process.exit(worst <= 0.001 || worstPair <= 0.001 ? 1 : 0);
