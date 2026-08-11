import * as THREE from "three";
import { characterDetailTextures, TEXTURE_BASE_GAIN } from "./lobbyCharacterTextures.js";

/* ============================================================================
   PERSONAGENS DO LOBBY — low poly facetado, sentados à mesa.

   Espaço do personagem:
     - origem no chão, por baixo da cadeira
     - +Y para cima
     - -Z é a direcção para onde o personagem olha (para o centro da mesa)

   Toda a geometria é construída a partir de "lofts" (anéis empilhados), que é
   o que dá o aspecto talhado/facetado das referências low poly, em vez de
   esferas e cilindros lisos colados uns aos outros.
   ========================================================================== */

export const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const UP = V(0, 1, 0);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

/* --------------------------------------------------------------------------
   Materiais
   -------------------------------------------------------------------------- */

function mat(color, opts = {}) {
  const {
    roughness = 0.84,
    metalness = 0,
    flat = true,
    side = THREE.FrontSide,
    emissive = null,
    emissiveIntensity = 1,
    detail = null,
    bumpScale = 0.006,
  } = opts;
  const m = new THREE.MeshStandardMaterial({
    color,
    roughness,
    metalness,
    flatShading: flat,
    side,
  });
  if (emissive !== null) {
    m.emissive = new THREE.Color(emissive);
    m.emissiveIntensity = emissiveIntensity;
  }

  /* Mapa de detalhe.
     O three multiplica `map` pela `color`, e as texturas são pintadas em volta
     de um cinza claro em vez de branco, portanto sem compensação toda a paleta
     escurecia. O `TEXTURE_BASE_GAIN` devolve a cor média ao valor original: com
     mapa, a cor final média é a mesma que sem mapa, e o que a textura acrescenta
     é só a variação em volta dela. */
  const family = detail ? characterDetailTextures()?.[detail] : null;
  if (family) {
    m.map = family.map;
    m.bumpMap = family.bumpMap;
    m.bumpScale = bumpScale;
    /* O ganho é limitado para nenhum canal passar de 1: acima disso o realce
       corta e a textura deixa de se ver no lado claro. */
    const peak = Math.max(m.color.r, m.color.g, m.color.b);
    m.color.multiplyScalar(Math.min(TEXTURE_BASE_GAIN, peak > 0 ? 1 / peak : 1));
  }
  return m;
}

export function meshOf(geometry, material, cast = true, receive = true) {
  const m = new THREE.Mesh(geometry, material);
  m.castShadow = cast;
  m.receiveShadow = receive;
  return m;
}

/* --------------------------------------------------------------------------
   Loft — constrói uma superfície a partir de anéis de pontos
   -------------------------------------------------------------------------- */

export function centroid(points) {
  const c = V();
  points.forEach((p) => c.add(p));
  return c.multiplyScalar(1 / points.length);
}

function flipWinding(positions) {
  for (let i = 0; i < positions.length; i += 9) {
    for (let k = 0; k < 3; k += 1) {
      const a = positions[i + 3 + k];
      positions[i + 3 + k] = positions[i + 6 + k];
      positions[i + 6 + k] = a;
    }
  }
}

/**
 * @param {THREE.Vector3[][]} rings anéis com o mesmo número de pontos, de baixo para cima
 */
/** Normal de um polígono pelo método de Newell, robusta a anéis não planares. */
function polygonNormal(points) {
  const n = V();
  for (let i = 0; i < points.length; i += 1) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    n.x += (a.y - b.y) * (a.z + b.z);
    n.y += (a.z - b.z) * (a.x + b.x);
    n.z += (a.x - b.x) * (a.y + b.y);
  }
  return n.normalize();
}

/**
 * Hash determinístico. Precisa de ser estável entre reconstruções, senão a
 * figura muda de forma a cada vez que é criada.
 */
function hash01(a, b, c) {
  const x = Math.sin(a * 127.1 + b * 311.7 + c * 74.7) * 43758.5453;
  return x - Math.floor(x);
}

export function loft(rings, opts = {}) {
  const { closed = true, capStart = false, capEnd = false, jitter = 0, seed = 0, weave = false, jitterMask = null } = opts;
  const n = rings[0].length;
  const segments = closed ? n : n - 1;
  const positions = [];
  const push = (v) => positions.push(v.x, v.y, v.z);

  /* Triangulação irregular.
     Duas coisas separam uma superfície talhada de um prisma extrudido. A
     primeira é o desvio dos vértices: com anéis perfeitamente regulares todas as
     facetas de uma volta têm a mesma progressão de normal, e o olho lê extrusão.
     A segunda, e a mais barata das duas, é a diagonal de cada quad: se todos os
     quads forem partidos no mesmo sentido fica um padrão de espinha visível, e
     alternar o sentido por hash dá o entrançado irregular que faz a superfície
     ler como pedra lapidada. */
  const work = jitter > 0
    ? rings.map((r, ri) => {
      const c = centroid(r);
      return r.map((p, i) => {
        const q = p.clone();
        const local = jitterMask ? jitterMask(p) : 1;
        const radial = 1 + (hash01(i, ri + seed, 1) - 0.5) * jitter * local * 2;
        q.x = c.x + (q.x - c.x) * radial;
        q.z = c.z + (q.z - c.z) * radial;
        // O primeiro e o último anel não mexem em y: são pontos de contacto
        // (assento, junta com outra peça) e mexê-los abre fendas.
        if (ri > 0 && ri < rings.length - 1) {
          const span = Math.abs(rings[Math.min(ri + 1, rings.length - 1)][i].y - rings[Math.max(ri - 1, 0)][i].y);
          q.y += (hash01(i, ri + seed, 2) - 0.5) * span * jitter * local * 1.1;
        }
        return q;
      });
    })
    : rings;

  for (let r = 0; r < work.length - 1; r += 1) {
    const a = work[r];
    const b = work[r + 1];
    for (let i = 0; i < segments; i += 1) {
      const j = (i + 1) % n;
      const flipDiagonal = (weave || jitter > 0) && hash01(i, r + seed, 3) > 0.5;
      if (flipDiagonal) {
        push(a[i]); push(b[i]); push(a[j]);
        push(b[i]); push(b[j]); push(a[j]);
      } else {
        push(a[i]); push(b[i]); push(b[j]);
        push(a[i]); push(b[j]); push(a[j]);
      }
    }
  }

  /* Garante normais viradas para fora nas paredes, seja qual for o sentido dos
     anéis. Isto tem de acontecer ANTES das tampas: o flipWinding actua sobre
     todo o buffer, e quando as tampas já lá estavam ficavam com metade dos
     triângulos ao contrário. Era isso que abria buracos escuros no meio da
     almofada da cadeira e no topo de várias peças do corpo. */
  const axis = centroid(work.flat());
  const a0 = V(positions[0], positions[1], positions[2]);
  const b0 = V(positions[3], positions[4], positions[5]);
  const c0 = V(positions[6], positions[7], positions[8]);
  const wallNormal = b0.clone().sub(a0).cross(c0.clone().sub(a0));
  const outward = a0.clone().add(b0).add(c0).multiplyScalar(1 / 3).sub(axis);
  if (wallNormal.dot(outward) < 0) flipWinding(positions);

  /* As tampas são orientadas cada uma por si: a normal do polígono do anel
     comparada com a direcção que aponta para fora do sólido. */
  const addCap = (ringPoints, awayFrom) => {
    const c = centroid(ringPoints);
    const facing = c.clone().sub(awayFrom);
    const flip = polygonNormal(ringPoints).dot(facing) < 0;
    for (let i = 0; i < segments; i += 1) {
      const j = (i + 1) % n;
      push(c);
      if (flip) { push(ringPoints[j]); push(ringPoints[i]); } else { push(ringPoints[i]); push(ringPoints[j]); }
    }
  };
  if (capStart) addCap(work[0], centroid(work[Math.min(1, work.length - 1)]));
  if (capEnd) addCap(work[work.length - 1], centroid(work[Math.max(0, work.length - 2)]));

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));

  /* UVs em escala do mundo.
     Os lofts não geravam coordenadas de textura nenhumas, portanto qualquer
     `map` era ignorado e as peças ficavam obrigatoriamente em cor sólida, que é
     o que dá o ar de plástico. Aqui `u` corre ao longo do anel e `v` ao longo da
     altura do loft, ambos medidos em unidades do mundo e divididos por
     UV_WORLD_SCALE. Medir em unidades do mundo em vez de 0 a 1 é o que faz o
     tecido ter a mesma densidade de trama num braço fino e num manto largo, em
     vez de esticar. */
  const uvs = [];
  const ringU = work.map((r) => {
    const acc = [0];
    for (let i = 1; i <= r.length; i += 1) {
      acc.push(acc[i - 1] + r[i % r.length].distanceTo(r[i - 1]));
    }
    return acc;
  });
  const ringV = [0];
  for (let r = 1; r < work.length; r += 1) {
    ringV.push(ringV[r - 1] + centroid(work[r]).distanceTo(centroid(work[r - 1])));
  }
  const pushUV = (r, i) => {
    uvs.push(ringU[r][i] / UV_WORLD_SCALE, ringV[r] / UV_WORLD_SCALE);
  };
  for (let r = 0; r < work.length - 1; r += 1) {
    for (let i = 0; i < segments; i += 1) {
      const j = i + 1;
      const flipDiagonal = (weave || jitter > 0) && hash01(i, r + seed, 3) > 0.5;
      if (flipDiagonal) {
        pushUV(r, i); pushUV(r + 1, i); pushUV(r, j);
        pushUV(r + 1, i); pushUV(r + 1, j); pushUV(r, j);
      } else {
        pushUV(r, i); pushUV(r + 1, i); pushUV(r + 1, j);
        pushUV(r, i); pushUV(r + 1, j); pushUV(r, j);
      }
    }
  }
  /* As tampas recebem UVs planas, medidas a partir do centro do próprio anel.
     Usar a posição absoluta punha as tampas num sítio completamente diferente da
     textura em relação às paredes, porque as paredes medem distância acumulada a
     partir de zero e a posição absoluta de uma peça pode andar longe da origem.
     Relativo ao centro mantém as duas na mesma vizinhança e limita o span ao
     tamanho da peça. */
  const capUV = (ringPoints) => {
    const c = centroid(ringPoints);
    for (let i = 0; i < segments; i += 1) {
      const j = (i + 1) % ringPoints.length;
      uvs.push(0, 0);
      uvs.push((ringPoints[i].x - c.x) / UV_WORLD_SCALE, (ringPoints[i].z - c.z) / UV_WORLD_SCALE);
      uvs.push((ringPoints[j].x - c.x) / UV_WORLD_SCALE, (ringPoints[j].z - c.z) / UV_WORLD_SCALE);
    }
  };
  if (capStart) capUV(work[0]);
  if (capEnd) capUV(work[work.length - 1]);

  if (uvs.length * 3 === positions.length * 2) {
    geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  }
  geometry.computeVertexNormals();
  return geometry;
}

/** Anel elíptico horizontal. Ângulo 0 = atrás (+Z), Pi = à frente (-Z). */
export function ring(center, rx, rz, n, opts = {}) {
  const { arc = Math.PI * 2, start = 0, flatFront = 1, squareness = 0 } = opts;
  const points = [];
  const count = n;
  for (let i = 0; i < count; i += 1) {
    const t = arc >= Math.PI * 2 - 1e-6 ? i / count : i / (count - 1);
    const angle = start + arc * t;
    let sx = Math.sin(angle);
    let sz = Math.cos(angle);
    if (squareness > 0) {
      // aproxima um super-elipse: torna a secção mais "talhada"
      sx = Math.sign(sx) * Math.pow(Math.abs(sx), 1 - squareness * 0.45);
      sz = Math.sign(sz) * Math.pow(Math.abs(sz), 1 - squareness * 0.45);
    }
    const z = sz < 0 ? sz * rz * flatFront : sz * rz;
    points.push(V(center.x + sx * rx, center.y, center.z + z));
  }
  return points;
}

/* --------------------------------------------------------------------------
   Peças primitivas
   -------------------------------------------------------------------------- */

function orient(object, from, to) {
  object.position.copy(from).add(to).multiplyScalar(0.5);
  const dir = to.clone().sub(from);
  const len = dir.length();
  if (len > 1e-6) {
    object.quaternion.setFromUnitVectors(UP, dir.divideScalar(len));
  }
  return object;
}

/** Membro cónico entre dois pontos. */
export function limb(from, to, rFrom, rTo, material, sides = 6) {
  const len = from.distanceTo(to);
  const geometry = new THREE.CylinderGeometry(rTo, rFrom, Math.max(len, 0.001), sides, 1);
  return orient(meshOf(geometry, material), from, to);
}

/** Bloco talhado (prisma de 4 faces com topo e base independentes). */
export function block(from, to, wFrom, dFrom, wTo, dTo, material, twist = 0) {
  const len = Math.max(from.distanceTo(to), 0.001);
  const geometry = loft(
    [
      ring(V(0, -len / 2, 0), wFrom / 2, dFrom / 2, 4, { start: Math.PI / 4 }),
      ring(V(0, len / 2, 0), wTo / 2, dTo / 2, 4, { start: Math.PI / 4 }),
    ],
    { capStart: true, capEnd: true },
  );
  const m = orient(meshOf(geometry, material), from, to);
  m.rotateY(twist);
  return m;
}

/**
 * Bloco talhado com orientação totalmente controlada.
 *
 * O `block` normal usa `orient`, que faz `setFromUnitVectors(UP, dir)`: alinha o
 * eixo mas deixa o roll ao critério do quaternião. Para um osso cónico é
 * indiferente, para uma mão não é: sem controlo do roll não se sabe qual das
 * faces é a palma. Aqui os anéis são construídos em coordenadas do mundo a
 * partir de uma base explícita, em que `d` corre ao longo de `up` e `w` ao longo
 * da perpendicular.
 */
export function orientedBlock(from, to, up, wFrom, dFrom, wTo, dTo, material, opts = {}) {
  const dir = to.clone().sub(from);
  const len = dir.length();
  if (len < 1e-6) return meshOf(new THREE.BufferGeometry(), material);
  dir.divideScalar(len);

  let side = new THREE.Vector3().crossVectors(up, dir);
  if (side.lengthSq() < 1e-8) side = new THREE.Vector3().crossVectors(V(0, 0, 1), dir);
  side.normalize();
  const realUp = new THREE.Vector3().crossVectors(dir, side).normalize();

  const corners = (centre, w, d) => [
    centre.clone().addScaledVector(side, w / 2).addScaledVector(realUp, d / 2),
    centre.clone().addScaledVector(side, -w / 2).addScaledVector(realUp, d / 2),
    centre.clone().addScaledVector(side, -w / 2).addScaledVector(realUp, -d / 2),
    centre.clone().addScaledVector(side, w / 2).addScaledVector(realUp, -d / 2),
  ];

  const endOffset = opts.endOffset ?? V();
  return meshOf(
    loft([corners(from, wFrom, dFrom), corners(to.clone().add(endOffset), wTo, dTo)], {
      capStart: true,
      capEnd: true,
    }),
    material,
  );
}

/** Base para orientar uma mão: devolve um `up` estável e perpendicular a `dir`. */
function handUpVector(dir) {
  let candidate = V(0, 1, 0);
  if (Math.abs(dir.dot(candidate)) > 0.85) candidate = V(0, 0, -1);
  return candidate.addScaledVector(dir, -dir.dot(candidate)).normalize();
}

/**
 * Mão com palma, dois blocos de dedos e polegar.
 *
 * Antes era uma única caixa cónica do punho à ponta: uma prancha. A separação
 * dos dedos em dois blocos com folga entre eles é o que dá a linha escura que
 * faz a mão ler como mão a esta escala, e o polegar é o que lhe dá lado.
 */
function addHand(group, wrist, tip, r, side, material) {
  const dir = tip.clone().sub(wrist);
  const len = dir.length();
  if (len < 1e-5) return;
  dir.divideScalar(len);
  const up = handUpVector(dir);
  const lateral = new THREE.Vector3().crossVectors(up, dir).normalize();

  // palma
  const knuckle = wrist.clone().addScaledVector(dir, len * 0.56);
  group.add(orientedBlock(wrist, knuckle, up, r * 1.42, r * 0.86, r * 1.62, r * 0.8, material));

  // dedos, em dois blocos com folga, e com uma ligeira curvatura para a palma
  const curl = up.clone().multiplyScalar(-r * 0.22);
  [-1, 1].forEach((k) => {
    const offset = lateral.clone().multiplyScalar(k * r * 0.34);
    const from = knuckle.clone().add(offset);
    const to = tip.clone().add(offset).add(curl);
    group.add(orientedBlock(from, to, up, r * 0.8, r * 0.74, r * 0.6, r * 0.52, material));
  });

  // polegar, virado para o lado interior
  const thumbBase = wrist
    .clone()
    .addScaledVector(dir, len * 0.16)
    .addScaledVector(lateral, side * r * 0.62);
  const thumbDir = dir
    .clone()
    .multiplyScalar(0.62)
    .addScaledVector(lateral, side * 0.78)
    .addScaledVector(up, -0.12)
    .normalize();
  const thumbTip = thumbBase.clone().addScaledVector(thumbDir, len * 0.46);
  group.add(orientedBlock(thumbBase, thumbTip, up, r * 0.52, r * 0.6, r * 0.4, r * 0.44, material));
}

/* --------------------------------------------------------------------------
   Rig — pontos base do corpo sentado
   -------------------------------------------------------------------------- */

export const CHAIR = {
  // Topo da estrutura de madeira do assento. A almofada assenta por cima e o
  // seu topo fica em `cushionY`, que é o plano de contacto do corpo.
  seatY: 0.885,
  cushionY: 0.925,
  // 0.96 de largura era um trono. Uma cadeira de taberna com braços fica-se
  // pelos 0.80, e assim o encosto deixa de engolir a figura.
  seatWidth: 0.8,
  // 0.7 de profundidade deixava meio metro de tábua vazia atrás de quem se
  // senta, porque as poses estão todas a inclinar para a mesa.
  seatDepth: 0.58,
  // A barra dos pés passa para debaixo do calcanhar, não para junto das patas.
  footrestY: 0.4,
  footrestZ: -0.24,
  backZ: 0.26,
  // 1.76 ficava acima da cabeça de todos. 1.58 deixa o crânio a sobressair.
  backTopY: 1.58,
  armY: 1.1,
  armX: 0.4,
  frontLegZ: -0.24,
  backLegZ: 0.21,
};

/**
 * Distância do centro da cadeira ao centro da mesa.
 *
 * 3.72 punha o bordo do tampo (raio 3.08) a 64 cm do peito, longe demais para
 * qualquer braço humano chegar lá com o cotovelo dobrado: a IK saturava e os
 * antebraços saíam esticados na horizontal. A 3.50 o bordo fica a 42 cm, que é
 * uma distância de mesa a sério, e as patas da frente continuam a passar ao
 * lado do pé da mesa.
 */
export const SEAT_RADIUS = 3.5;

/**
 * Rotação do anel de lugares.
 *
 * Com fase 0 os quatro lugares caem sobre os eixos cardinais, e isso cria dois
 * problemas: um lugar fica exatamente sobre o eixo -X (a linha de visão da
 * câmara de seleção, pelo que as costas da cadeira tapavam a fila de baixo da
 * galeria) e outro fica sobre +Z, entre a câmara por defeito e o centro da
 * mesa. A -45° nenhum lugar fica sobre um eixo e a simetria mantém-se.
 */
export const SEAT_PHASE = -Math.PI / 4;

const BASE_RIG = {
  // A anca desceu de 0.99 para 0.962. O antigo valor deixava a base do tronco
  // em 0.97, seis centímetros acima do topo da almofada: as figuras pairavam.
  hip: V(0, 0.962, 0.055),
  hipHalf: 0.098,
  // O joelho tem de passar o bordo do assento (z = -0.29) sem entrar na saia da
  // mesa, que agora começa em y = 1.03.
  knee: V(0.118, 0.925, -0.43),
  /* Tornozelo e pé centrados na barra dos pés (topo em y = 0.442, z entre
     -0.207 e -0.273). Com o tornozelo em -0.235 e a ponta em -0.40 o pé só
     tocava a barra pelo calcanhar e os outros 13 cm ficavam no ar à frente
     dela: à distância parecia que a barra e as patas estavam partidas. O centro
     do pé fica agora exactamente sobre a barra, com a canela recuada, que é a
     postura natural de quem se senta num banco alto. */
  ankle: V(0.118, 0.545, -0.16),
  toe: V(0.118, 0.497, -0.32),
  waist: V(0, 1.166, 0.04),
  chest: V(0, 1.362, 0.012),
  neck: V(0, 1.502, -0.002),
  head: V(0, 1.709, -0.042),
  shoulder: V(0.198, 1.44, -0.017),
  upperArm: 0.325,
  foreArm: 0.288,
  handLength: 0.2,
  headHeight: 0.255,
  headWidth: 0.176,
  headDepth: 0.22,
};

/**
 * Multiplicador global de escala das figuras.
 *
 * A 1.0 as figuras ficavam pequenas dentro da cadeira e pouco presentes acima
 * do tampo. Os alvos de mão da mesa e do braço da cadeira são fixos no mundo,
 * portanto as figuras maiores continuam a assentar a mão no mesmo sítio.
 */
export const CHARACTER_SCALE = 1.12;

/*
   Afinação de proporções, aplicada a todas as figuras de uma vez.

   As figuras estavam nas 7 cabeças, que é a proporção humana real, e é por isso
   que leem como bonecos genéricos em vez de personagens de jogo estilizadas. O
   estilo de referência anda nas 5.5: cabeça maior, ombros mais largos, cintura
   mais estreita, mãos e botas francamente grandes. Estes são os números para
   mexer, não os perfis individuais.
*/
export const PROPORTIONS = {
  head: 1.17,
  shoulder: 1.13,
  chest: 1.07,
  waist: 0.86,
  hand: 1.28,
  boot: 1.22,
};

/**
 * Amplitude do desvio de vértices nas peças talhadas.
 *
 * A 0 volta-se ao aspecto de prisma extrudido, porque com anéis regulares todas
 * as facetas de uma volta têm a mesma progressão de normal. Acima de 0.1 começa
 * a ler como malha estragada.
 */
export const FACET_JITTER = 0.055;

/**
 * Unidades do mundo por repetição de textura.
 *
 * 0.34 significa que a trama do tecido se repete a cada 34 cm de superfície, o
 * que a esta escala dá um grão visível de perto e que se dissolve em variação
 * de valor à distância da câmara por defeito.
 */
export const UV_WORLD_SCALE = 0.34;

function buildRig(profile) {
  const s = (profile.build.scale ?? 1) * CHARACTER_SCALE;
  // Personagens mais pequenos sentam-se mais à frente na cadeira, senão os
  // joelhos não passavam do bordo do assento e as canelas atravessavam-no.
  const hip = BASE_RIG.hip.clone();
  // Só as figuras menores do que a base se aproximam da mesa.
  hip.z -= Math.max(0, 1 - s) * 0.28;
  const scaleAboutHip = (p) => hip.clone().add(p.clone().sub(hip).multiplyScalar(s));

  const rig = {
    hip,
    hipHalf: BASE_RIG.hipHalf * s,
    knee: scaleAboutHip(BASE_RIG.knee),
    ankle: scaleAboutHip(BASE_RIG.ankle),
    toe: scaleAboutHip(BASE_RIG.toe),
    waist: scaleAboutHip(BASE_RIG.waist),
    chest: scaleAboutHip(BASE_RIG.chest),
    neck: scaleAboutHip(BASE_RIG.neck),
    head: scaleAboutHip(BASE_RIG.head),
    shoulder: scaleAboutHip(BASE_RIG.shoulder),
    upperArm: BASE_RIG.upperArm * s,
    foreArm: BASE_RIG.foreArm * s,
    handLength: BASE_RIG.handLength * s,
  };

  const hs = s * (profile.build.headScale ?? 1) * PROPORTIONS.head;
  rig.headHeight = BASE_RIG.headHeight * hs;
  rig.headWidth = BASE_RIG.headWidth * hs * (profile.build.headWidth ?? 1);
  rig.headDepth = BASE_RIG.headDepth * hs;
  rig.shoulder.x = (profile.build.shoulder ?? 0.19) * s * PROPORTIONS.shoulder;
  rig.head.y += (rig.headHeight - BASE_RIG.headHeight) * 0.45;
  return rig;
}

/* --------------------------------------------------------------------------
   Cinemática inversa de 2 ossos para os braços
   -------------------------------------------------------------------------- */

function solveArm(shoulder, target, l1, l2, pole) {
  const toWrist = target.clone().sub(shoulder);
  let d = toWrist.length();
  const maxD = (l1 + l2) * 0.985;
  const minD = Math.abs(l1 - l2) + 0.02;
  if (d > maxD) { toWrist.setLength(maxD); d = maxD; }
  if (d < minD) { toWrist.setLength(minD); d = minD; }
  const dir = toWrist.clone().normalize();

  const cosA = clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1);
  const angle = Math.acos(cosA);

  let perp = pole.clone().sub(dir.clone().multiplyScalar(pole.dot(dir)));
  if (perp.lengthSq() < 1e-6) perp = V(0, 1, 0).sub(dir.clone().multiplyScalar(dir.y));
  perp.normalize();

  const upperDir = dir
    .clone()
    .multiplyScalar(Math.cos(angle))
    .add(perp.multiplyScalar(Math.sin(angle)))
    .normalize();

  return {
    elbow: shoulder.clone().add(upperDir.multiplyScalar(l1)),
    wrist: shoulder.clone().add(toWrist),
  };
}

/* --------------------------------------------------------------------------
   Cabeça
   -------------------------------------------------------------------------- */

const HEAD_PROFILE = {
  human: [
    // [y, largura, profundidade, deslocamento z]
    [-0.50, 0.30, 0.34, -0.055],
    [-0.35, 0.48, 0.54, -0.035],
    [-0.18, 0.63, 0.68, -0.012],
    [0.00, 0.73, 0.76, 0.0],
    [0.17, 0.75, 0.80, 0.012],
    [0.35, 0.71, 0.77, 0.022],
    [0.52, 0.58, 0.65, 0.026],
    [0.66, 0.33, 0.38, 0.026],
  ],
  child: [
    [-0.50, 0.40, 0.44, -0.035],
    [-0.36, 0.60, 0.64, -0.02],
    [-0.20, 0.74, 0.78, -0.008],
    [0.00, 0.82, 0.85, 0.0],
    [0.17, 0.83, 0.88, 0.01],
    [0.35, 0.80, 0.86, 0.018],
    [0.52, 0.68, 0.74, 0.022],
    [0.66, 0.38, 0.44, 0.022],
  ],
  goblin: [
    [-0.50, 0.24, 0.30, -0.09],
    [-0.36, 0.42, 0.52, -0.07],
    [-0.20, 0.60, 0.70, -0.03],
    [0.00, 0.74, 0.80, 0.0],
    [0.18, 0.72, 0.80, 0.03],
    [0.36, 0.62, 0.70, 0.05],
    [0.52, 0.46, 0.54, 0.06],
    [0.66, 0.24, 0.30, 0.06],
  ],
  skull: [
    [-0.50, 0.26, 0.30, -0.05],
    [-0.36, 0.42, 0.46, -0.05],
    [-0.20, 0.54, 0.60, -0.03],
    [-0.02, 0.68, 0.74, 0.0],
    [0.17, 0.78, 0.82, 0.01],
    [0.36, 0.74, 0.80, 0.02],
    [0.52, 0.58, 0.66, 0.02],
    [0.66, 0.32, 0.38, 0.02],
  ],
};

/**
 * Anéis da cabeça. Os perfis estão escritos em unidades arbitrárias; aqui são
 * normalizados para que a cabeça fique exactamente com
 * headWidth x headHeight x headDepth. `minT` corta o perfil por baixo (0 = queixo,
 * 1 = topo do crânio), o que permite reaproveitar a mesma forma para a touca do
 * cabelo — que assim acompanha o crânio em vez de mergulhar dentro dele.
 */
function headProfileRings(rig, shape, { minT = 0, grow = 0 } = {}) {
  const profile = HEAD_PROFILE[shape] ?? HEAD_PROFILE.human;
  const hw = rig.headWidth / 2;
  const hdepth = rig.headDepth / 2;
  const hh = rig.headHeight / 2;
  const ys = profile.map((r) => r[0]);
  const yLo = Math.min(...ys);
  const yHi = Math.max(...ys);
  const wMax = Math.max(...profile.map((r) => r[1]));
  const dMax = Math.max(...profile.map((r) => r[2]));

  const rings = [];
  profile.forEach(([y, w, d, dz]) => {
    const t = (y - yLo) / (yHi - yLo);
    if (t < minT) return;
    rings.push(
      ring(V(0, (t * 2 - 1) * hh, dz * rig.headDepth), (w / wMax) * hw + grow, (d / dMax) * hdepth + grow, 8, {
        flatFront: 0.9,
        squareness: 0.35,
      }),
    );
  });
  return rings;
}

function createHeadShell(rig, shape, material) {
  /* O jitter na cabeça tem de poupar a zona da cara.
     As features (olho, nariz, boca) são colocadas contra `faceSurfaceZ`, que lê
     o perfil sem desvio. Se a casca se mexer e elas não, voltam a flutuar: com
     o jitter uniforme a órbita passava a sobressair e lia como óculos. A máscara
     anula o desvio à frente (z negativo) e mantém-no atrás e nos lados, que é
     onde a facetagem se vê no contorno. */
  const dz = rig.headDepth / 2;
  const mask = (p) => {
    const front = Math.max(0, -p.z / (dz || 1));
    return Math.max(0.08, 1 - front * 1.35);
  };
  return meshOf(
    loft(headProfileRings(rig, shape), {
      capStart: true,
      capEnd: true,
      jitter: FACET_JITTER * 0.75,
      jitterMask: mask,
      seed: 5,
    }),
    material,
  );
}

/**
 * Z da superfície frontal do crânio a uma dada altura.
 *
 * Esta função é a correcção central da cara. Antes todas as features (olho,
 * sobrancelha, nariz, boca) eram colocadas a um `eyeZ` constante de -dz * 0.9,
 * mas o loft do crânio recua conforme sobe e desce. Medido no perfil `human`: a
 * sobrancelha ficava 1.9 cm à frente da testa, a íris 1.1 cm à frente da pele e
 * a boca 1.3 cm à frente do queixo, numa cabeça de 25 cm. Eram três peças a
 * flutuar. As maçãs do rosto, pelo contrário, estavam 2 cm dentro do crânio e
 * não se viam.
 */
function faceSurfaceZ(rig, shape, y) {
  const profile = HEAD_PROFILE[shape] ?? HEAD_PROFILE.human;
  const hh = rig.headHeight / 2;
  const dz = rig.headDepth / 2;
  const ys = profile.map((r) => r[0]);
  const yLo = Math.min(...ys);
  const yHi = Math.max(...ys);
  const dMax = Math.max(...profile.map((r) => r[2]));

  const samples = profile.map(([py, , d, offset]) => {
    const t = (py - yLo) / (yHi - yLo);
    return { y: (t * 2 - 1) * hh, z: offset * rig.headDepth - (d / dMax) * dz * 0.9 };
  });

  if (y <= samples[0].y) return samples[0].z;
  const last = samples[samples.length - 1];
  if (y >= last.y) return last.z;
  for (let i = 0; i < samples.length - 1; i += 1) {
    const a = samples[i];
    const b = samples[i + 1];
    if (y >= a.y && y <= b.y) {
      const k = (y - a.y) / (b.y - a.y || 1);
      return a.z + (b.z - a.z) * k;
    }
  }
  return last.z;
}

const hd = (rig) => rig.headDepth / 2;

function addEars(group, rig, kind, skin) {
  const hw = rig.headWidth / 2;
  const hh = rig.headHeight / 2;
  if (kind === "none") return;

  [-1, 1].forEach((side) => {
    if (kind === "long" || kind === "goblin") {
      const base = V(side * hw * 0.92, hh * 0.02, hd(rig) * 0.05);
      const tip =
        kind === "long"
          ? V(side * hw * 2.35, hh * 0.95, hd(rig) * 0.95)
          : V(side * hw * 2.5, hh * 0.55, hd(rig) * 1.25);
      const ear = block(
        base,
        tip,
        rig.headWidth * 0.2,
        rig.headDepth * 0.34,
        rig.headWidth * 0.045,
        rig.headWidth * 0.05,
        skin,
      );
      group.add(ear);
    } else {
      const ear = block(
        V(side * hw * 0.88, hh * 0.08, hd(rig) * 0.2),
        V(side * hw * 1.12, hh * -0.16, hd(rig) * 0.14),
        rig.headWidth * 0.07,
        rig.headDepth * 0.28,
        rig.headWidth * 0.05,
        rig.headDepth * 0.18,
        skin,
      );
      group.add(ear);
    }
  });
}

function addFace(group, rig, profile, palette) {
  const hw = rig.headWidth / 2;
  const hh = rig.headHeight / 2;
  const dz = rig.headDepth / 2;
  const face = profile.face ?? {};
  const isSkull = face.shape === "skull";

  // Estes três só servem o ramo da caveira, que é geometria própria.
  const skullEyeY = hh * 0.16;
  const skullEyeX = hw * 0.42;
  const skullEyeZ = -dz * 0.9;

  if (isSkull) {
    // órbitas fundas
    [-1, 1].forEach((side) => {
      const socket = meshOf(
        new THREE.BoxGeometry(rig.headWidth * 0.3, rig.headHeight * 0.19, rig.headDepth * 0.2),
        palette.socket,
        false,
        false,
      );
      socket.position.set(side * skullEyeX, skullEyeY, skullEyeZ + dz * 0.12);
      socket.rotation.z = side * 0.1;
      group.add(socket);

      const glow = meshOf(
        new THREE.BoxGeometry(rig.headWidth * 0.13, rig.headHeight * 0.06, rig.headDepth * 0.05),
        palette.eyeGlow,
        false,
        false,
      );
      glow.position.set(side * skullEyeX, skullEyeY - hh * 0.01, skullEyeZ + dz * 0.06);
      group.add(glow);
    });

    // cavidade nasal
    const nasal = meshOf(
      new THREE.ConeGeometry(rig.headWidth * 0.09, rig.headHeight * 0.13, 3),
      palette.socket,
      false,
      false,
    );
    nasal.position.set(0, -hh * 0.06, skullEyeZ + dz * 0.1);
    nasal.rotation.x = Math.PI;
    group.add(nasal);

    // dentes
    const teeth = new THREE.Group();
    for (let i = -3; i <= 3; i += 1) {
      const tooth = meshOf(
        new THREE.BoxGeometry(rig.headWidth * 0.085, rig.headHeight * 0.075, rig.headDepth * 0.06),
        palette.skin,
        false,
        false,
      );
      tooth.position.set(i * rig.headWidth * 0.1, -hh * 0.33, skullEyeZ + dz * 0.24);
      teeth.add(tooth);
    }
    group.add(teeth);
    return;
  }

  const eyeScale = face.eye ?? 1;
  const shape = face.shape ?? "human";
  // Superfície real da cara a cada altura, em vez de um plano fixo.
  const surf = (y) => faceSurfaceZ(rig, shape, y);
  /* Centro em z de uma peça de espessura `depth` cuja FACE FRONTAL fica a `out`
     da pele. A face frontal de uma caixa centrada em c é c - depth/2 (o eixo -Z
     é a frente), logo o centro tem de ser surf + depth/2. Com o sinal ao
     contrário cada peça protraía a sua espessura inteira. */
  const onFace = (y, depth, out = 0) => surf(y) + depth / 2 - out;

  const eyeY = hh * 0.13;
  const eyeX = hw * 0.44;
  const eyeH = rig.headHeight * 0.085 * eyeScale;
  const eyeW = rig.headWidth * 0.26 * eyeScale;

  /* ---- olho ----
     A versão anterior tinha órbita escura, esclera clara grande, íris e pupila.
     A esclera dominava e o conjunto lia como óculos, sobretudo nas personagens
     com `eye` acima de 1. No estilo de referência o olho é uma forma escura com
     um brilho pequeno, e é isso que funciona a 26 pixels: primeiro a mancha
     escura, depois a cor, depois o brilho.

     Ordem em profundidade, de dentro para fora: mancha, íris, brilho. Todas
     assentam na superfície via `onFace`, portanto nenhuma flutua. */
  [-1, 1].forEach((side) => {
    const socket = meshOf(
      new THREE.BoxGeometry(eyeW * 1.04, eyeH * 1.15, rig.headDepth * 0.045),
      palette.eyeDark,
      false,
      false,
    );
    socket.position.set(side * eyeX, eyeY, onFace(eyeY, rig.headDepth * 0.045, -rig.headDepth * 0.016));
    socket.rotation.y = side * 0.16;
    group.add(socket);

    const iris = meshOf(
      new THREE.BoxGeometry(eyeW * 0.44, eyeH * 0.66, rig.headDepth * 0.03),
      palette.iris,
      false,
      false,
    );
    iris.position.set(side * eyeX, eyeY - eyeH * 0.04, onFace(eyeY, rig.headDepth * 0.03, -rig.headDepth * 0.006));
    iris.rotation.y = side * 0.16;
    group.add(iris);

    // brilho, deslocado para cima e para o lado de fora
    const glint = meshOf(
      new THREE.BoxGeometry(eyeW * 0.2, eyeH * 0.26, rig.headDepth * 0.02),
      palette.glint,
      false,
      false,
    );
    glint.position.set(side * (eyeX + eyeW * 0.26), eyeY + eyeH * 0.22, onFace(eyeY, rig.headDepth * 0.02, 0));
    glint.rotation.y = side * 0.16;
    group.add(glint);

    // pálpebra superior em tom de pele, a cortar o topo da mancha
    const lidY = eyeY + eyeH * 0.6;
    const lid = block(
      V(side * eyeX - eyeW * 0.6, lidY, onFace(lidY, rig.headDepth * 0.06, -rig.headDepth * 0.004)),
      V(side * eyeX + eyeW * 0.6, lidY - eyeH * 0.1, onFace(lidY, rig.headDepth * 0.06, -rig.headDepth * 0.004)),
      eyeH * 0.32,
      rig.headDepth * 0.07,
      eyeH * 0.26,
      rig.headDepth * 0.06,
      palette.skin,
    );
    group.add(lid);
  });

  /* ---- arco superciliar ----
     Uma cunha assente na testa em vez de uma caixa a 2 cm dela. */
  const browY = eyeY + hh * 0.26;
  const browHeavy = face.brow === "heavy";
  [-1, 1].forEach((side) => {
    const inner = V(side * hw * 0.12, browY - (face.brow === "angry" ? hh * 0.06 : 0), onFace(browY, rig.headDepth * 0.1, rig.headDepth * 0.012));
    const outer = V(side * hw * 0.82, browY + (face.brow === "angry" ? hh * 0.05 : hh * 0.02), onFace(browY, rig.headDepth * 0.1, -rig.headDepth * 0.01));
    const brow = block(
      inner,
      outer,
      rig.headHeight * (browHeavy ? 0.062 : 0.045),
      rig.headDepth * 0.1,
      rig.headHeight * (browHeavy ? 0.04 : 0.03),
      rig.headDepth * 0.07,
      palette.brow,
    );
    group.add(brow);
  });

  /* ---- nariz ----
     A raiz nasce entre as sobrancelhas, encostada à testa, e a ponta projecta
     para fora da superfície do lábio, que é o que lhe dá volume. */
  const noseKind = face.nose ?? "straight";
  if (noseKind !== "none") {
    const project = { small: 0.055, straight: 0.075, large: 0.1, hooked: 0.115 }[noseKind] ?? 0.075;
    const rootY = eyeY + hh * 0.16;
    const tipY = -hh * 0.12;
    const root = V(0, rootY, onFace(rootY, rig.headDepth * 0.16, 0));
    const tipZ = onFace(tipY, rig.headDepth * 0.16, rig.headDepth * project * (noseKind === "hooked" ? 1.25 : 1));
    const tip = V(0, tipY, tipZ);
    group.add(
      block(root, tip, rig.headWidth * 0.13, rig.headDepth * 0.13, rig.headWidth * 0.2, rig.headDepth * 0.2, palette.skin),
    );
    // asas do nariz
    const wingY = tipY - hh * 0.02;
    group.add(
      block(
        V(-rig.headWidth * 0.11, wingY, tipZ + rig.headDepth * 0.03),
        V(rig.headWidth * 0.11, wingY, tipZ + rig.headDepth * 0.03),
        rig.headHeight * 0.05,
        rig.headDepth * 0.12,
        rig.headHeight * 0.05,
        rig.headDepth * 0.12,
        palette.skin,
      ),
    );
    if (noseKind === "hooked" || noseKind === "large") {
      const below = tipY - hh * 0.11;
      group.add(
        block(
          tip,
          V(0, below, onFace(below, rig.headDepth * 0.1, rig.headDepth * project * 0.35)),
          rig.headWidth * 0.19,
          rig.headDepth * 0.18,
          rig.headWidth * 0.1,
          rig.headDepth * 0.1,
          palette.skin,
        ),
      );
    }
  }

  /* ---- boca ----
     Lábio inferior em tom de pele por baixo da linha da boca, para a boca
     deixar de ser uma barra solta a flutuar à frente do queixo. */
  const mouthY = -hh * 0.34;
  const mouth = meshOf(
    new THREE.BoxGeometry(rig.headWidth * 0.3, rig.headHeight * 0.028, rig.headDepth * 0.05),
    palette.mouth,
    false,
    false,
  );
  mouth.position.set(0, mouthY, onFace(mouthY, rig.headDepth * 0.05, -rig.headDepth * 0.006));
  group.add(mouth);

  const lipY = mouthY - hh * 0.075;
  const lip = block(
    V(-rig.headWidth * 0.13, lipY, onFace(lipY, rig.headDepth * 0.085, rig.headDepth * 0.001)),
    V(rig.headWidth * 0.13, lipY, onFace(lipY, rig.headDepth * 0.085, rig.headDepth * 0.001)),
    rig.headHeight * 0.042,
    rig.headDepth * 0.085,
    rig.headHeight * 0.042,
    rig.headDepth * 0.085,
    palette.lip,
  );
  group.add(lip);

  /* ---- maçãs do rosto ----
     Estavam 2 cm dentro do crânio, portanto invisíveis. Passam para a
     superfície lateral, onde de facto se vê osso. */
  const cheekY = -hh * 0.06;
  [-1, 1].forEach((side) => {
    const cheek = block(
      V(side * hw * 0.46, cheekY + hh * 0.16, onFace(cheekY, rig.headDepth * 0.11, -rig.headDepth * 0.005)),
      V(side * hw * 0.86, cheekY + hh * 0.04, onFace(cheekY, rig.headDepth * 0.11, -rig.headDepth * 0.07)),
      rig.headHeight * 0.06,
      rig.headDepth * 0.11,
      rig.headHeight * 0.045,
      rig.headDepth * 0.085,
      palette.skin,
    );
    group.add(cheek);
  });
}

function addHair(group, rig, profile, palette) {
  const style = profile.hair?.style ?? "short";
  if (style === "none") return;
  const hw = rig.headWidth / 2;
  const hh = rig.headHeight / 2;
  const dz = rig.headDepth / 2;
  const hairMat = palette.hair;

  // Touca base: usa o próprio perfil do crânio, ligeiramente maior, para o
  // cabelo assentar mesmo em cima da cabeça.
  if (style !== "bald") {
    const shape = profile.face?.shape ?? "human";
    /* O `grow` é a espessura da massa de cabelo, e o `minT` é até onde ela
       desce. O estilo `volume` precisa dos dois maiores: é um penteado alto e
       cheio, não uma touca fina colada ao crânio. */
    const bulky = style === "volume";
    const capRings = headProfileRings(rig, shape, {
      minT: bulky ? 0.5 : 0.58,
      grow: rig.headWidth * (bulky ? 0.15 : 0.04),
    });
    // Linha do cabelo: levanta a frente do anel mais baixo.
    const first = capRings[0];
    const maxDepth = Math.max(...first.map((q) => Math.abs(q.z)));
    first.forEach((q) => {
      const front = Math.max(0, -q.z / (maxDepth || 1));
      // A franja tem de parar acima do olho. Com o valor antigo (0.1 no mop) o
      // cabelo do Romeo descia abaixo da linha dos olhos e tapava-lhe a cara.
      q.y += front * hh * (style === "mane" ? 0.5 : bulky ? 0.42 : 0.46);
    });
    if (bulky) {
      /* Volume por cima do crânio.
         Dois anéis extra acima do topo da touca dão altura ao penteado, que é o
         que o distingue de cabelo curto. Deslocados para trás em z, para o
         penteado ler como puxado para cima e para trás em vez de crescido a
         prumo. */
      const top = capRings[capRings.length - 1];
      const topC = centroid(top);
      const lift = (scaleXZ, dy, pushZ) => top.map((q) => {
        const p = q.clone();
        p.x = topC.x + (p.x - topC.x) * scaleXZ;
        p.z = topC.z + (p.z - topC.z) * scaleXZ + pushZ;
        p.y += dy;
        return p;
      });
      /* Antes: 1.08 / 0.96 / 0.54 de escala com +0.26, +0.52 e +0.70 hh de
         altura. Setenta por cento de meia-cabeça de altura extra num raio a
         encolher para metade é um cone, e lia como um galo. O volume tem de
         crescer em largura tanto quanto em altura, e a cúpula tem de fechar
         suave: menos altura, mais largura, e o último anel só ligeiramente
         menor. */
      capRings.push(lift(1.12, hh * 0.14, dz * 0.02));
      capRings.push(lift(1.1, hh * 0.28, dz * 0.06));
      capRings.push(lift(0.94, hh * 0.38, dz * 0.1));
    }
    group.add(meshOf(loft(capRings, { capEnd: true, jitter: FACET_JITTER * 0.7, seed: 17 }), hairMat));
  }

  if (style === "sleek") {
    // cabelo puxado para trás, em bico
    const tail = block(
      V(0, hh * 0.34, dz * 0.95),
      V(0, hh * -0.1, dz * 1.7),
      rig.headWidth * 0.72,
      rig.headDepth * 0.3,
      rig.headWidth * 0.26,
      rig.headDepth * 0.14,
      hairMat,
    );
    group.add(tail);
    // pico de viúva
    // O cone apontado para baixo lia como uma sobrancelha única em V. Passa a
    // ser um bico largo e curto, colado à linha do cabelo.
    const peak = meshOf(new THREE.ConeGeometry(hw * 0.34, hh * 0.16, 4), hairMat, false, false);
    peak.position.set(0, hh * 0.46, -dz * 0.74);
    peak.rotation.x = Math.PI;
    group.add(peak);
  }

  if (style === "long" || style === "braids") {
    [-1, 1].forEach((side) => {
      const fall = block(
        V(side * hw * 0.94, hh * 0.3, dz * 0.2),
        V(side * hw * 0.9, -hh * 1.9, dz * 0.6),
        rig.headWidth * 0.26,
        rig.headDepth * 0.5,
        rig.headWidth * 0.2,
        rig.headDepth * 0.24,
        hairMat,
      );
      group.add(fall);
      if (style === "braids") {
        const braid = block(
          V(side * hw * 0.92, -hh * 1.9, dz * 0.6),
          V(side * hw * 0.86, -hh * 3.3, dz * 0.5),
          rig.headWidth * 0.19,
          rig.headWidth * 0.19,
          rig.headWidth * 0.08,
          rig.headWidth * 0.08,
          hairMat,
        );
        group.add(braid);
        const tie = meshOf(
          new THREE.BoxGeometry(rig.headWidth * 0.16, rig.headHeight * 0.05, rig.headWidth * 0.16),
          palette.metal,
          false,
          false,
        );
        tie.position.set(side * hw * 0.87, -hh * 3.16, dz * 0.5);
        group.add(tie);
      }
    });
    const back = block(
      V(0, hh * 0.4, dz * 0.9),
      V(0, -hh * 1.7, dz * 0.95),
      rig.headWidth * 0.92,
      rig.headDepth * 0.34,
      rig.headWidth * 0.6,
      rig.headDepth * 0.2,
      hairMat,
    );
    group.add(back);
  }

  if (style === "volume") {
    /* Penteado grande mas curto.
       A crina anterior descia até ao ombro e lia como cabelo de rapariga. Isto
       é o meio termo: massa e altura, mas termina na nuca. */

    // franja varrida para um lado, sem tapar a sobrancelha (que está em hh*0.39)
    [[-0.78, 0.42, 0.32], [-0.32, 0.36, 0.36], [0.16, 0.44, 0.34], [0.6, 0.52, 0.26]].forEach(([x, bottom, w]) => {
      group.add(
        block(
          V(x * hw * 0.55 - hw * 0.12, hh * 1.02, -dz * 0.14),
          V(x * hw * 1.05 + hw * 0.2, hh * bottom, -dz * 0.82),
          rig.headWidth * w,
          rig.headDepth * 0.4,
          rig.headWidth * w * 0.5,
          rig.headDepth * 0.18,
          hairMat,
        ),
      );
    });

    // massas laterais, a cobrir meia orelha e a parar ao nível do maxilar
    [-1, 1].forEach((side) => {
      group.add(
        block(
          V(side * hw * 1.06, hh * 0.6, dz * 0.16),
          V(side * hw * 1.14, -hh * 0.5, dz * 0.4),
          rig.headWidth * 0.3,
          rig.headDepth * 0.72,
          rig.headWidth * 0.2,
          rig.headDepth * 0.42,
          hairMat,
        ),
      );
    });

    // pontas curtas na nuca, viradas para fora
    [[-0.5, -0.85], [0.0, -1.0], [0.52, -0.8]].forEach(([x, bottom]) => {
      group.add(
        block(
          V(x * hw * 0.8, -hh * 0.2, dz * 0.86),
          V(x * hw * 0.9, hh * bottom, dz * 1.06),
          rig.headWidth * 0.24,
          rig.headDepth * 0.26,
          rig.headWidth * 0.12,
          rig.headDepth * 0.13,
          hairMat,
        ),
      );
    });

    // uma mecha rebelde no alto, para o contorno não fechar num arco limpo
    // Mecha rebelde de lado, não no alto: em cima somava-se ao volume e
    // reforçava o bico.
    const tuft = meshOf(new THREE.ConeGeometry(hw * 0.15, hh * 0.36, 4), hairMat, true, false);
    tuft.position.set(-hw * 0.78, hh * 0.98, dz * 0.42);
    tuft.rotation.set(0.35, 0, 1.05);
    group.add(tuft);
    return;
  }

  if (style === "mane") {
    /* Crina.
       A primeira versão lia como um penteado feminino: franja comprida por cima
       da testa e duas cortinas a enquadrar a cara. Uma crina de rapaz que nunca
       cortou o cabelo é o contrário disso. A massa está atrás e para fora, a
       cara fica descoberta, e o contorno é irregular por comprimentos
       diferentes, não por simetria. */

    // massa atrás da cabeça, larga e a descair pelas costas
    group.add(
      meshOf(
        loft(
          [
            ring(V(0, hh * 0.78, dz * 0.42), hw * 0.9, dz * 0.66, 9, { squareness: 0.3 }),
            ring(V(0, hh * 0.28, dz * 0.92), hw * 1.14, dz * 0.96, 9, { squareness: 0.3 }),
            ring(V(0, -hh * 0.45, dz * 1.04), hw * 1.2, dz * 0.9, 9, { squareness: 0.3 }),
            ring(V(0, -hh * 1.05, dz * 0.96), hw * 1.12, dz * 0.74, 9, { squareness: 0.3 }),
            ring(V(0, -hh * 1.62, dz * 0.86), hw * 0.88, dz * 0.54, 9, { squareness: 0.3 }),
          ],
          { capStart: true, jitter: FACET_JITTER * 0.8, seed: 31 },
        ),
        hairMat,
      ),
    );

    /* Mechas. Todas nascem atrás da linha da orelha (z positivo) e caem para
       fora do ombro, nunca à frente da cara. A meia-largura do peito do Romeo
       (0.148) é maior do que a meia-largura da cabeça dele, portanto sem
       espalhamento as mechas ficam dentro da malha do tronco. */
    /* Comprimentos curtos e desiguais. A primeira versão descia até -3.0 hh e
       as mechas caíam simétricas a enquadrar a cara: lia como penteado
       feminino. Uma crina de rapaz para no ombro e o contorno é irregular. */
    const locks = [
      [-1.02, -1.5, 0.55, 0.3, 1.5],
      [-0.86, -1.05, 0.95, 0.24, 1.3],
      [1.04, -1.35, 0.5, 0.28, 1.46],
      [0.88, -1.72, 0.9, 0.22, 1.56],
      [0.7, -0.9, 0.25, 0.2, 1.26],
    ];
    locks.forEach(([x, bottom, z, w, spread]) => {
      group.add(
        block(
          V(x * hw * 0.9, hh * 0.34, dz * (z * 0.55)),
          V(x * hw * spread, hh * bottom, dz * (z + 0.5)),
          rig.headWidth * w,
          rig.headDepth * 0.4,
          rig.headWidth * w * 0.55,
          rig.headDepth * 0.2,
          hairMat,
        ),
      );
    });

    /* Franja curta e desalinhada, bem acima da sobrancelha (que está em
       eyeY + hh * 0.26, ou seja hh * 0.39). Cinco mechas de comprimentos
       diferentes em vez de duas cortinas simétricas. */
    [[-0.66, 0.66, 0.22], [-0.3, 0.58, 0.3], [0.08, 0.7, 0.26], [0.44, 0.6, 0.28], [0.74, 0.68, 0.2]].forEach(([x, bottom, w]) => {
      group.add(
        block(
          V(x * hw * 0.62, hh * 0.92, -dz * 0.26),
          V(x * hw * 1.0, hh * bottom, -dz * 0.66),
          rig.headWidth * w,
          rig.headDepth * 0.32,
          rig.headWidth * w * 0.42,
          rig.headDepth * 0.14,
          hairMat,
        ),
      );
    });

    // duas mechas rebeldes no alto, para o contorno não fechar num arco limpo
    [[-0.46, 0.3, 0.9], [0.3, 0.62, 0.7]].forEach(([x, z, len]) => {
      const tuft = meshOf(new THREE.ConeGeometry(hw * 0.14, hh * 0.4 * len, 4), hairMat, true, false);
      tuft.position.set(x * hw, hh * 1.0, z * dz);
      tuft.rotation.set(z * 0.8, 0, -x * 1.2);
      group.add(tuft);
    });
    return;
  }

  if (style === "wild") {
    const spikes = [
      [-0.55, 0.62, -0.35, 0.55],
      [0.0, 0.78, -0.15, 0.7],
      [0.5, 0.66, 0.15, 0.5],
      [-0.2, 0.6, 0.6, 0.45],
      [0.62, 0.5, 0.6, 0.4],
    ];
    spikes.forEach(([x, y, z, h]) => {
      const spike = meshOf(
        new THREE.ConeGeometry(hw * 0.26, hh * h, 4),
        hairMat,
        false,
        false,
      );
      spike.position.set(x * hw, y * hh, z * dz);
      spike.rotation.set(z * 0.5, 0, -x * 0.5);
      group.add(spike);
    });
  }

  if (style === "bob") {
    [-1, 1].forEach((side) => {
      const fall = block(
        V(side * hw * 0.96, hh * 0.32, dz * 0.16),
        V(side * hw * 0.94, -hh * 0.85, dz * 0.34),
        rig.headWidth * 0.3,
        rig.headDepth * 0.62,
        rig.headWidth * 0.24,
        rig.headDepth * 0.4,
        hairMat,
      );
      group.add(fall);
    });
    const back = block(
      V(0, hh * 0.4, dz * 0.86),
      V(0, -hh * 0.75, dz * 0.9),
      rig.headWidth * 0.94,
      rig.headDepth * 0.4,
      rig.headWidth * 0.8,
      rig.headDepth * 0.26,
      hairMat,
    );
    group.add(back);
  }

  // barba
  const beard = profile.hair?.beard;
  if (beard) {
    const length = beard === "full" ? 1.2 : beard === "goatee" ? 0.75 : 0.38;
    const width = beard === "full" ? 1.0 : 0.42;
    const rings = [
      ring(V(0, -hh * 0.24, -dz * 0.05), hw * 0.76 * width + hw * 0.12, dz * 0.84, 8, { flatFront: 0.95 }),
      ring(V(0, -hh * 0.55, -dz * 0.02), hw * 0.72 * width + hw * 0.08, dz * 0.72, 8, { flatFront: 0.95 }),
      ring(V(0, -hh * (0.24 + length * 0.55), dz * 0.04), hw * 0.52 * width + hw * 0.05, dz * 0.46, 8, { flatFront: 0.95 }),
      ring(V(0, -hh * (0.24 + length), dz * 0.08), hw * 0.2 * width + hw * 0.03, dz * 0.18, 8),
    ];
    group.add(meshOf(loft(rings, { capEnd: true }), hairMat));
    const moustache = meshOf(
      new THREE.BoxGeometry(rig.headWidth * 0.44, rig.headHeight * 0.07, rig.headDepth * 0.1),
      hairMat,
      false,
      false,
    );
    moustache.position.set(0, -hh * 0.27, faceSurfaceZ(rig, profile.face?.shape ?? "human", -hh * 0.27) + rig.headDepth * 0.03);
    group.add(moustache);
  }
}

function addHeadwear(group, rig, profile, palette) {
  const crown = profile.wear?.crown;
  if (!crown) return;
  const hw = rig.headWidth / 2;
  const hh = rig.headHeight / 2;
  const dz = rig.headDepth / 2;
  /* A coroa da Maria era dourada sobre cabelo louro sobre vestido amarelo: os
     três tons confundiam-se e a coroa deixava de se ler, o que estraga
     precisamente o acessório que a identifica. O rei não tem esse problema por
     ter cabelo branco. Um `crownMetal` no perfil permite quebrar isso sem mexer
     no resto da paleta. */
  const metal = crown === "circlet" ? palette.trim : (palette.crownMetal ?? palette.metal);

  if (crown === "circlet") {
    const band = meshOf(
      new THREE.TorusGeometry(hw * 1.14, hw * 0.072, 4, 16),
      metal,
      false,
      false,
    );
    band.position.set(0, hh * 0.46, dz * 0.06);
    band.rotation.x = Math.PI / 2;
    group.add(band);
    const gem = meshOf(new THREE.OctahedronGeometry(hw * 0.155, 0), (palette.crownGem ?? palette.gem), true, false);
    gem.position.set(0, hh * 0.5, -dz * 1.0);
    gem.scale.set(1, 1.24, 0.66);
    group.add(gem);
    [-1, 1].forEach((side) => {
      const stud = meshOf(new THREE.OctahedronGeometry(hw * 0.09, 0), palette.trim, false, false);
      stud.position.set(side * hw * 0.62, hh * 0.47, -dz * 0.92);
      stud.scale.set(1, 1.2, 0.6);
      group.add(stud);
    });
    return;
  }

  /* Coroa.
     Era uma banda de 0.22 de altura com espigões de 0.42 hh: a esta escala
     desaparecia contra o cabelo. Um acessório destes é o que identifica a
     personagem de relance, portanto tem de ganhar altura, ir mais para fora da
     cabeça e apanhar luz. */
  // A coroa do rei é mais alta e mais maciça; a da princesa é mais delicada mas
  // carregada de pedras.
  /* A coroa é dimensionada em fracções da cabeça, portanto cresceu junto com o
     PROPORTIONS.head e passou a ler como elmo. Este factor devolve-lhe a
     proporção relativa original. */
  const cs = 1 / PROPORTIONS.head;
  const kingly = crown === "iron" || crown === "kingly";
  const bandLo = hh * 0.34;
  const bandHi = hh * (kingly ? 0.98 : 0.86);
  const band = new THREE.Mesh(
    loft(
      [
        ring(V(0, bandLo, dz * 0.05), hw * 1.16 * cs, dz * 1.14, 10, { squareness: 0.2 }),
        ring(V(0, bandLo + (bandHi - bandLo) * 0.55, dz * 0.05), hw * 1.2 * cs, dz * 1.18 * cs, 10, { squareness: 0.2 }),
        ring(V(0, bandHi, dz * 0.05), hw * 1.18 * cs, dz * 1.16 * cs, 10, { squareness: 0.2 }),
      ],
      {},
    ),
    metal,
  );
  band.castShadow = true;
  group.add(band);

  // aro inferior, para a coroa assentar em vez de flutuar sobre o cabelo
  const rim = meshOf(
    loft(
      [
        ring(V(0, bandLo - 0.006, dz * 0.05), hw * 1.22 * cs, dz * 1.2 * cs, 10, { squareness: 0.2 }),
        ring(V(0, bandLo + 0.022, dz * 0.05), hw * 1.24 * cs, dz * 1.22 * cs, 10, { squareness: 0.2 }),
      ],
      {},
    ),
    palette.trim,
  );
  group.add(rim);

  const points = kingly ? 5 : 8;
  for (let i = 0; i < points; i += 1) {
    const angle = (i / points) * Math.PI * 2;
    const tall = i % 2 === 0;
    const height = hh * cs * (kingly ? (tall ? 0.9 : 0.56) : (tall ? 0.72 : 0.44));
    const spike = meshOf(
      new THREE.ConeGeometry(hw * 0.19 * cs, height, 4),
      metal,
      true,
      false,
    );
    spike.position.set(
      Math.sin(angle) * hw * 1.16 * cs,
      bandHi + height * 0.45,
      Math.cos(angle) * dz * 1.14 * cs + dz * 0.05,
    );
    group.add(spike);

    // pérola na ponta de cada espigão
    const pearl = meshOf(new THREE.OctahedronGeometry(hw * (tall ? 0.085 : 0.07), 0), palette.trim, false, false);
    pearl.position.set(
      Math.sin(angle) * hw * 1.16 * cs,
      bandHi + height * 0.95,
      Math.cos(angle) * dz * 1.14 * cs + dz * 0.05,
    );
    group.add(pearl);
  }

  if (crown === "gold") {
    /* Coroa da princesa.
       A pedra central estava em `hw * 0.27` com escala vertical 1.25, e ficou
       fora do factor `cs` que compensa o aumento global da cabeça, portanto era
       ainda 17 por cento maior do que aquilo que eu pensava ter escrito. Somado
       ao emissive da gema, lia como uma lanterna presa à testa. Agora tem pouco
       mais de metade do tamanho, respeita o `cs`, e o brilho está baixo: quem
       destaca a coroa é a fiada de pedras e as pérolas dos espigões, não uma
       pedra gigante. */
    const jewelY = bandLo + (bandHi - bandLo) * 0.58;
    const crownGem = palette.crownGem ?? palette.gem;

    const mount = meshOf(
      new THREE.CylinderGeometry(hw * 0.2 * cs, hw * 0.23 * cs, hh * 0.24 * cs, 8),
      palette.trim,
      true,
      false,
    );
    mount.position.set(0, jewelY, -dz * 1.06 * cs);
    mount.rotation.x = Math.PI / 2;
    group.add(mount);

    const centre = meshOf(new THREE.OctahedronGeometry(hw * 0.155 * cs, 0), crownGem, true, false);
    centre.position.set(0, jewelY, -dz * 1.18 * cs);
    centre.scale.set(1, 1.18, 0.62);
    group.add(centre);

    // gota suspensa sob a pedra central
    const drop = meshOf(new THREE.ConeGeometry(hw * 0.07 * cs, hh * 0.17 * cs, 5), crownGem, false, false);
    drop.position.set(0, bandLo - hh * 0.09, -dz * 1.1 * cs);
    drop.rotation.x = Math.PI;
    group.add(drop);

    // fiada de pedras alternadas em volta da banda
    const beadCount = 12;
    for (let i = 0; i < beadCount; i += 1) {
      const angle = (i / beadCount) * Math.PI * 2 + Math.PI / beadCount;
      const big = i % 3 === 0;
      const bead = meshOf(
        new THREE.OctahedronGeometry(hw * (big ? 0.1 : 0.068) * cs, 0),
        big ? crownGem : palette.trim,
        false,
        false,
      );
      bead.position.set(
        Math.sin(angle) * hw * 1.2 * cs,
        bandLo + (bandHi - bandLo) * (big ? 0.62 : 0.34),
        Math.cos(angle) * dz * 1.18 * cs + dz * 0.05,
      );
      bead.scale.set(1, 1.1, 0.62);
      group.add(bead);
    }
  }

  if (kingly) {
    // Coroa do rei: pedra central escura, mais sóbria, mas igualmente visível.
    const centre = meshOf(new THREE.OctahedronGeometry(hw * 0.165 * cs, 0), (palette.crownGem ?? palette.gem), true, false);
    centre.position.set(0, bandLo + (bandHi - bandLo) * 0.55, -dz * 1.14 * cs);
    centre.scale.set(1, 1.18, 0.64);
    group.add(centre);
    [-1, 1].forEach((side) => {
      const stud = meshOf(new THREE.OctahedronGeometry(hw * 0.085 * cs, 0), palette.trim, false, false);
      stud.position.set(side * hw * 0.72 * cs, bandLo + (bandHi - bandLo) * 0.5, -dz * 0.9 * cs);
      stud.scale.set(1, 1.15, 0.6);
      group.add(stud);
    });
  }
}

function addHood(group, rig, profile, palette) {
  if (!profile.wear?.hood) return;
  const hw = rig.headWidth / 2;
  const hh = rig.headHeight / 2;
  const dz = rig.headDepth / 2;
  const cloth = palette.hoodCloth;

  const rings = [
    ring(V(0, -hh * 1.65, dz * 0.22), hw * 1.62, dz * 1.5, 9, { squareness: 0.25 }),
    ring(V(0, -hh * 0.95, dz * 0.26), hw * 1.5, dz * 1.46, 9, { squareness: 0.25 }),
    ring(V(0, -hh * 0.3, dz * 0.28), hw * 1.42, dz * 1.46, 9, { squareness: 0.25 }),
    ring(V(0, hh * 0.35, dz * 0.3), hw * 1.3, dz * 1.36, 9, { squareness: 0.25 }),
    ring(V(0, hh * 0.85, dz * 0.42), hw * 0.88, dz * 1.0, 9, { squareness: 0.25 }),
    ring(V(0, hh * 1.15, dz * 0.9), hw * 0.4, dz * 0.5, 9, { squareness: 0.25 }),
  ];
  const shell = meshOf(loft(rings, { capEnd: true }), cloth);
  group.add(shell);

  // abertura do capuz: aro inclinado à frente
  const rim = meshOf(
    new THREE.TorusGeometry(hw * 1.24, hw * 0.12, 4, 10, Math.PI * 1.25),
    palette.hoodTrim,
    true,
    false,
  );
  rim.position.set(0, hh * 0.05, -dz * 0.62);
  rim.rotation.set(Math.PI * 0.5 - 0.42, 0, Math.PI * 0.375);
  group.add(rim);

  // bico do capuz
  const peak = block(
    V(0, hh * 1.1, dz * 0.85),
    V(0, hh * 0.55, dz * 2.15),
    rig.headWidth * 0.5,
    rig.headDepth * 0.5,
    rig.headWidth * 0.06,
    rig.headDepth * 0.06,
    cloth,
  );
  group.add(peak);
}

/* --------------------------------------------------------------------------
   Caveira (Bones) — construída à parte, porque um crânio não é uma cabeça
   humana com buracos: tem calote alta, órbitas fundas salientes, arcada
   zigomática e maxilar separado.
   -------------------------------------------------------------------------- */

function createSkullHead(rig, palette) {
  const g = new THREE.Group();
  const hw = rig.headWidth / 2;
  const hh = rig.headHeight / 2;
  const dz = rig.headDepth / 2;

  // calote
  const cranium = loft(
    [
      ring(V(0, -0.14 * hh, 0.02 * dz), hw * 0.74, dz * 0.86, 8, { flatFront: 0.9, squareness: 0.4 }),
      ring(V(0, 0.08 * hh, 0.02 * dz), hw * 0.94, dz * 0.96, 8, { flatFront: 0.9, squareness: 0.4 }),
      ring(V(0, 0.34 * hh, 0.05 * dz), hw * 1.0, dz * 1.0, 8, { flatFront: 0.88, squareness: 0.4 }),
      ring(V(0, 0.64 * hh, 0.1 * dz), hw * 0.94, dz * 0.96, 8, { squareness: 0.4 }),
      ring(V(0, 0.88 * hh, 0.13 * dz), hw * 0.64, dz * 0.68, 8, { squareness: 0.4 }),
      ring(V(0, 1.0 * hh, 0.13 * dz), hw * 0.3, dz * 0.32, 8, { squareness: 0.4 }),
    ],
    { capStart: true, capEnd: true },
  );
  g.add(meshOf(cranium, palette.skin));

  // sutura da testa
  const suture = meshOf(
    new THREE.BoxGeometry(hw * 0.09, hh * 0.5, dz * 0.06),
    palette.socket,
    false,
    false,
  );
  suture.position.set(0, hh * 0.62, -dz * 0.78);
  g.add(suture);

  // órbitas fundas
  [-1, 1].forEach((side) => {
    const socket = meshOf(
      loft(
        [
          ring(V(0, 0, 0), hw * 0.36, dz * 0.2, 6, { squareness: 0.5 }),
          ring(V(0, hh * 0.3, -dz * 0.16), hw * 0.3, dz * 0.16, 6, { squareness: 0.5 }),
        ],
        { capStart: true, capEnd: true },
      ),
      palette.socket,
    );
    socket.position.set(side * hw * 0.46, hh * 0.18, -dz * 0.88);
    socket.rotation.z = side * 0.12;
    g.add(socket);

    const glow = meshOf(
      new THREE.OctahedronGeometry(hw * 0.15, 0),
      palette.eyeGlow,
      false,
      false,
    );
    glow.position.set(side * hw * 0.46, hh * 0.26, -dz * 1.14);
    glow.scale.set(1, 0.8, 0.5);
    g.add(glow);

    // arco zigomático
    const arch = block(
      V(side * hw * 0.72, hh * 0.02, -dz * 0.78),
      V(side * hw * 0.98, -hh * 0.12, dz * 0.3),
      hw * 0.16,
      hh * 0.2,
      hw * 0.12,
      hh * 0.16,
      palette.skin,
    );
    g.add(arch);
  });

  // cavidade nasal
  const nasal = meshOf(new THREE.ConeGeometry(hw * 0.19, hh * 0.34, 3), palette.socket, false, false);
  nasal.position.set(0, -hh * 0.06, -dz * 0.94);
  nasal.rotation.set(Math.PI, Math.PI, 0);
  g.add(nasal);

  // maxilar superior + dentes
  const maxilla = meshOf(
    loft(
      [
        ring(V(0, -hh * 0.34, 0.0), hw * 0.6, dz * 0.72, 7, { flatFront: 0.94 }),
        ring(V(0, -hh * 0.12, 0.0), hw * 0.76, dz * 0.86, 7, { flatFront: 0.94 }),
      ],
      { capStart: true },
    ),
    palette.skin,
  );
  g.add(maxilla);

  const toothRow = (y, mat2) => {
    for (let i = -3; i <= 3; i += 1) {
      const tooth = meshOf(
        new THREE.BoxGeometry(hw * 0.11, hh * 0.14, dz * 0.12),
        mat2,
        false,
        false,
      );
      tooth.position.set(i * hw * 0.14, y, -dz * 0.76);
      g.add(tooth);
    }
  };
  toothRow(-hh * 0.34, palette.skin);

  // linha da boca
  const gap = meshOf(new THREE.BoxGeometry(hw * 1.0, hh * 0.06, dz * 0.14), palette.socket, false, false);
  gap.position.set(0, -hh * 0.45, -dz * 0.76);
  g.add(gap);

  // mandíbula
  const jaw = meshOf(
    loft(
      [
        ring(V(0, -hh * 0.86, dz * 0.16), hw * 0.5, dz * 0.5, 7, { flatFront: 0.96 }),
        ring(V(0, -hh * 0.52, dz * 0.06), hw * 0.72, dz * 0.72, 7, { flatFront: 0.96 }),
        ring(V(0, -hh * 0.4, 0.0), hw * 0.8, dz * 0.84, 7, { flatFront: 0.96 }),
      ],
      { capStart: true, capEnd: true },
    ),
    palette.skin,
  );
  g.add(jaw);
  toothRow(-hh * 0.56, palette.skin);

  return g;
}

/* --------------------------------------------------------------------------
   Chapéu de bico (Muriel)
   -------------------------------------------------------------------------- */

function addPointedHat(group, rig, profile, palette) {
  if (profile.wear?.hat !== "pointed") return;
  const hw = rig.headWidth / 2;
  const hh = rig.headHeight / 2;
  const dz = rig.headDepth / 2;
  const cloth = palette.hatCloth;

  // aba
  const brim = meshOf(
    loft(
      [
        ring(V(0, hh * 0.48, dz * 0.08), hw * 2.05, dz * 2.0, 10, { squareness: 0.15 }),
        ring(V(0, hh * 0.58, dz * 0.08), hw * 1.9, dz * 1.86, 10, { squareness: 0.15 }),
        ring(V(0, hh * 0.64, dz * 0.08), hw * 1.12, dz * 1.14, 10, { squareness: 0.15 }),
      ],
      { capStart: true, capEnd: true },
    ),
    cloth,
  );
  group.add(brim);

  // cone que tomba para trás
  const cone = meshOf(
    loft(
      [
        ring(V(0, hh * 0.6, dz * 0.08), hw * 1.1, dz * 1.12, 8, { squareness: 0.2 }),
        ring(V(0, hh * 1.3, dz * 0.2), hw * 0.86, dz * 0.9, 8, { squareness: 0.2 }),
        ring(V(hw * 0.05, hh * 2.05, dz * 0.5), hw * 0.56, dz * 0.6, 8, { squareness: 0.2 }),
        ring(V(hw * 0.18, hh * 2.7, dz * 0.95), hw * 0.3, dz * 0.32, 8, { squareness: 0.2 }),
        ring(V(hw * 0.34, hh * 3.1, dz * 1.45), hw * 0.07, dz * 0.08, 8, { squareness: 0.2 }),
      ],
      { capEnd: true },
    ),
    cloth,
  );
  group.add(cone);

  // fita
  const band = meshOf(
    loft(
      [
        ring(V(0, hh * 0.66, dz * 0.09), hw * 1.14, dz * 1.16, 8, { squareness: 0.2 }),
        ring(V(0, hh * 0.86, dz * 0.12), hw * 1.08, dz * 1.1, 8, { squareness: 0.2 }),
      ],
      {},
    ),
    palette.hatBand,
  );
  group.add(band);

  const star = meshOf(new THREE.OctahedronGeometry(hw * 0.24, 0), palette.gem, true, false);
  star.position.set(0, hh * 0.78, -dz * 1.14);
  star.scale.set(1, 1, 0.45);
  group.add(star);
}

/* --------------------------------------------------------------------------
   Tronco, pernas e roupa
   -------------------------------------------------------------------------- */

function buildTorso(rig, profile, palette) {
  const b = profile.build;
  const shoulderW = rig.shoulder.x * 2.05;
  const belly = b.belly ?? 0;

  // O tronco tem de fechar no assento, não no ar. Os dois primeiros anéis são a
  // massa do traseiro: descem até um pouco abaixo do topo da almofada (para
  // ler como compressão) e recuam em z, porque quem se senta apoia-se atrás da
  // articulação da anca, não em cima dela.
  const seatContactY = CHAIR.cushionY - 0.012;
  const glutePush = (b.hipD ?? 0.135) * 0.42;

  const rings = [
    ring(V(0, seatContactY, rig.hip.z + glutePush * 0.55), (b.hipW ?? 0.185) * 0.9, (b.hipD ?? 0.135) * 0.86, 9, { squareness: 0.42 }),
    ring(V(0, (seatContactY + rig.hip.y) * 0.5, rig.hip.z + glutePush), (b.hipW ?? 0.185) * 1.06, (b.hipD ?? 0.135) * 1.12, 9, { squareness: 0.34 }),
    ring(V(0, rig.hip.y - 0.02, rig.hip.z), (b.hipW ?? 0.185) * 1.0, (b.hipD ?? 0.135), 9, { squareness: 0.3 }),
    ring(V(0, rig.waist.y, rig.waist.z - belly * 0.85), (b.waistW ?? 0.165) * PROPORTIONS.waist + belly * 0.5, (b.waistD ?? 0.12) * PROPORTIONS.waist + belly, 9, { squareness: 0.3 }),
    ring(V(0, rig.chest.y, rig.chest.z - belly * 0.3), (b.chestW ?? 0.195) * PROPORTIONS.chest, (b.chestD ?? 0.14) * PROPORTIONS.chest + belly * 0.25, 9, { squareness: 0.28 }),
    ring(V(0, rig.shoulder.y + 0.02, rig.chest.z * 0.9), shoulderW * 0.5, (b.chestD ?? 0.14) * 0.94, 9, { squareness: 0.34 }),
    ring(V(0, rig.neck.y, rig.neck.z), shoulderW * 0.24, (b.chestD ?? 0.14) * 0.52, 9, { squareness: 0.3 }),
  ];
  return meshOf(loft(rings, { capStart: true, capEnd: true, jitter: FACET_JITTER, seed: 11 }), palette.cloth);
}

function addLegs(group, rig, profile, palette) {
  const legwear = profile.wear?.legwear ?? "trousers";
  const legMat = legwear === "bare" ? palette.skin : palette.legCloth;

  [-1, 1].forEach((side) => {
    const hip = V(side * rig.hipHalf, rig.hip.y - 0.03, rig.hip.z);
    const knee = V(side * rig.knee.x, rig.knee.y, rig.knee.z);
    const ankle = V(side * rig.ankle.x, rig.ankle.y, rig.ankle.z);
    const toe = V(side * rig.toe.x, rig.toe.y, rig.toe.z);

    const thighR = (profile.build.limb ?? 1) * (legwear === "bare" ? 0.052 : legwear === "robe" ? 0.088 : 0.075);
    const calfR = (profile.build.limb ?? 1) * (legwear === "bare" ? 0.04 : 0.058);

    group.add(limb(hip, knee, thighR * 1.24, thighR, legMat, 6));
    group.add(limb(knee, ankle, calfR * 1.06, calfR * 0.82, legMat, 6));

    // joelho talhado
    const kneePad = meshOf(
      new THREE.OctahedronGeometry(thighR * 1.02, 0),
      legwear === "bare" ? palette.skin : palette.leather,
      true,
      false,
    );
    kneePad.position.copy(knee).add(V(0, 0.01, -0.01));
    kneePad.scale.set(1, 0.85, 1.1);
    group.add(kneePad);

    // bota
    const bootTop = V(side * rig.ankle.x, rig.ankle.y + 0.09, rig.ankle.z + 0.01);
    group.add(
      block(
        bootTop,
        ankle,
        calfR * 2.4 * PROPORTIONS.boot,
        calfR * 2.5 * PROPORTIONS.boot,
        calfR * 2.1 * PROPORTIONS.boot,
        calfR * 2.3 * PROPORTIONS.boot,
        palette.leather,
      ),
    );
    const foot = block(
      ankle.clone().add(V(0, -0.02, 0.03)),
      toe,
      calfR * 2.1 * PROPORTIONS.boot,
      calfR * 2.0 * PROPORTIONS.boot,
      calfR * 1.7 * PROPORTIONS.boot,
      calfR * 1.6,
      palette.leather,
    );
    group.add(foot);
    const cuff = meshOf(
      new THREE.BoxGeometry(calfR * 2.7, 0.035, calfR * 2.8),
      palette.trimSolid,
      true,
      false,
    );
    cuff.position.copy(bootTop);
    group.add(cuff);
  });
}

/**
 * Saia do robe sobre o colo.
 *
 * Antes eram duas peças separadas: uma tábua horizontal sobre as coxas e um
 * avental estreito a cair até ao chão. Lia exactamente como isso, uma tábua e
 * um avental. Agora é um único loft contínuo que arranca na anca, passa por
 * cima das duas coxas, dobra no joelho e cai até um pouco acima da bota, com a
 * bainha recortada. É o mesmo número de anéis e uma peça a menos.
 */
function addLapRobe(group, rig, profile, palette) {
  if ((profile.wear?.legwear ?? "trousers") !== "robe") return;

  const halfW = (profile.build.hipW ?? 0.185) * 1.16;
  const kneeZ = rig.knee.z;
  /* A bainha parava em ankle.y + 0.015, mas caía na vertical a partir do joelho
     (z = -0.43), portanto passava 19 cm à frente das patas da frente (-0.24) e
     cruzava-as em qualquer ângulo que não fosse frontal. Agora acompanha a
     canela para trás e para acima da barra dos pés. */
  const hemY = Math.max(rig.ankle.y + 0.075, CHAIR.footrestY + 0.16);
  const shinZ = (rig.knee.z + rig.ankle.z) * 0.5;
  const n = 10;
  const sq = 0.36;

  const rings = [
    // anca, encostada ao tronco
    ring(V(0, rig.hip.y - 0.005, rig.hip.z + 0.01), halfW * 0.98, 0.115, n, { squareness: sq }),
    // meio da coxa, o pano assenta e alarga
    ring(V(0, (rig.hip.y + rig.knee.y) * 0.5 + 0.012, (rig.hip.z + kneeZ) * 0.5), halfW * 1.04, 0.105, n, { squareness: sq }),
    // rótula, ponto alto da dobra
    ring(V(0, rig.knee.y + 0.03, kneeZ + 0.015), halfW * 1.0, 0.095, n, { squareness: sq }),
    // já a cair, encolhe em largura, engrossa em profundidade e recua para a canela
    ring(V(0, rig.knee.y - 0.06, kneeZ * 0.82 + shinZ * 0.18), halfW * 0.78, 0.1, n, { squareness: sq }),
    ring(V(0, (rig.knee.y + hemY) * 0.5 - 0.03, kneeZ * 0.45 + shinZ * 0.55), halfW * 0.72, 0.11, n, { squareness: sq }),
    ring(V(0, hemY, shinZ), halfW * 0.78, 0.125, n, { squareness: sq }),
  ];

  // bainha recortada, para o bordo não ser um corte a régua
  rings[rings.length - 1].forEach((p, i) => {
    p.y += i % 2 === 0 ? 0.042 : -0.018;
  });

  group.add(meshOf(loft(rings, {}), palette.cloakSolid));

  // orla mais clara a marcar a bainha
  const hem = rings[rings.length - 1].map((p) => p.clone().setY(p.y + 0.035));
  group.add(meshOf(loft([rings[rings.length - 1], hem], {}), palette.trimSolid));
}

function addCloak(group, rig, profile, palette) {
  const kind = profile.wear?.cloak;
  if (!kind || kind === "none") return;

  const shoulderW = rig.shoulder.x * 2.05;
  const long = kind === "long";
  // O manto tem de passar entre as costas e o encosto da cadeira (z ~ 0.33),
  // por isso a profundidade máxima é limitada.
  const hemY = long ? rig.hip.y - 0.05 : rig.waist.y - 0.06;
  /* O arco era 1.3π, o que levava as duas pontas soltas até à frente do peito:
     de lado viam-se duas folhas planas a sair dos ombros, o efeito de bandeira.
     A 1.02π as pontas ficam nos flancos, atrás dos braços. */
  const arc = Math.PI * 1.02;
  const start = -arc / 2;
  const n = 13;

  /* Pregas.
     Um manto de pano nunca é uma superfície lisa, e num modelo facetado é a
     alternância do raio que o faz ler como tecido em vez de chapa. A amplitude
     cresce de cima para baixo, porque é isso que acontece a um pano suspenso. */
  const fold = (points, centre, amplitude) => {
    points.forEach((q, i) => {
      const k = 1 + (i % 2 === 0 ? amplitude : -amplitude * 0.7);
      q.x = centre.x + (q.x - centre.x) * k;
      q.z = centre.z + (q.z - centre.z) * k;
    });
    // pontas afiladas para o bordo não ler como corte de tesoura
    [0, points.length - 1].forEach((i) => {
      points[i].x = centre.x + (points[i].x - centre.x) * 0.9;
      points[i].z = centre.z + (points[i].z - centre.z) * 0.9;
    });
    return points;
  };

  const spec = [
    [rig.neck.y - 0.01, rig.neck.z + 0.02, 0.32, 0.14, 0.0],
    [rig.shoulder.y + 0.015, rig.chest.z + 0.035, 0.54, 0.2, 0.02],
    [rig.chest.y - 0.04, rig.chest.z + 0.045, 0.58, 0.215, 0.04],
    [rig.waist.y - 0.02, rig.waist.z + 0.02, 0.6, 0.225, 0.06],
    [(rig.waist.y + hemY) * 0.5, rig.hip.z + 0.005, 0.62, 0.235, 0.075],
    [hemY, rig.hip.z - 0.015, 0.64, 0.245, 0.09],
  ];

  const rings = spec.map(([y, z, w, d, amp]) => {
    const centre = V(0, y, z);
    return fold(ring(centre, shoulderW * w, d, n, { arc, start }), centre, amp);
  });
  rings[rings.length - 1].forEach((q, i) => {
    q.y += i % 2 === 0 ? 0.04 : -0.022;
  });
  const cloak = meshOf(loft(rings, { closed: false }), palette.cloak);
  group.add(cloak);

  // gola alta atrás da nuca
  if (profile.wear?.collar === "high") {
    const collarArc = Math.PI * 1.15;
    const collarStart = -collarArc / 2;
    const collarRings = [
      ring(V(0, rig.neck.y - 0.03, rig.neck.z + 0.01), shoulderW * 0.34, 0.115, 9, { arc: collarArc, start: collarStart }),
      ring(V(0, rig.neck.y + 0.13, rig.neck.z + 0.04), shoulderW * 0.46, 0.14, 9, { arc: collarArc, start: collarStart }),
      ring(V(0, rig.head.y + rig.headHeight * 0.24, rig.neck.z + 0.06), shoulderW * 0.56, 0.155, 9, { arc: collarArc, start: collarStart }),
    ];
    group.add(meshOf(loft(collarRings, { closed: false }), palette.collar));
  }

  // painéis frontais sobre o peito
  const chestFront = rig.chest.z - (profile.build.chestD ?? 0.14) * 1.05;
  [-1, 1].forEach((side) => {
    // Eram duas tábuas de 6 cm à frente do peito. Agora são duas lapelas
    // estreitas, inclinadas para fora, que acompanham a caixa torácica.
    const panel = block(
      V(side * shoulderW * 0.34, rig.shoulder.y + 0.02, chestFront + 0.02),
      V(side * shoulderW * 0.46, rig.hip.y + 0.06, chestFront + 0.01),
      shoulderW * 0.2,
      0.05,
      shoulderW * 0.16,
      0.045,
      palette.cloakSolid,
    );
    group.add(panel);
  });
}

function addUpperWear(group, rig, profile, palette) {
  const shoulderW = rig.shoulder.x * 2.05;
  const wear = profile.wear ?? {};

  /* ---- gola clara e cinto escuro ----
     As paletas eram quase monocromáticas: a Maria era amarela do cabelo às
     botas, a Muriel púrpura em tudo, e o `cloth` e o `clothDark` diferem só em
     valor dentro do mesmo tom. O que separa os personagens da referência é o
     corte em blocos de valores diferentes: camisa clara contra casaco escuro,
     cinto escuro a cortar a cintura. Estas duas peças fazem isso em todos, e
     usam tons que cada perfil já tem (`trim` claro, `leather` escuro), portanto
     não obrigam a mexer nas paletas. */
  if (wear.collar !== "high" && !wear.ribcage) {
    const yokeTop = rig.neck.y - 0.012;
    const yokeBottom = rig.chest.y + (rig.shoulder.y - rig.chest.y) * 0.22;
    const chestFront = rig.chest.z - (profile.build.chestD ?? 0.14) * PROPORTIONS.chest;
    const yoke = meshOf(
      loft(
        [
          ring(V(0, yokeBottom, rig.chest.z - 0.005), shoulderW * 0.2, (profile.build.chestD ?? 0.14) * 0.6, 8, { squareness: 0.3 }),
          ring(V(0, (yokeBottom + yokeTop) * 0.5, rig.chest.z - 0.004), shoulderW * 0.27, (profile.build.chestD ?? 0.14) * 0.64, 8, { squareness: 0.3 }),
          ring(V(0, yokeTop, rig.neck.z - 0.002), shoulderW * 0.29, (profile.build.chestD ?? 0.14) * 0.62, 8, { squareness: 0.3 }),
        ],
        { capEnd: true, jitter: FACET_JITTER * 0.6, seed: 23 },
      ),
      palette.linen,
    );
    group.add(yoke);

    // decote em V, a apontar para baixo, que é o que dá direcção ao peito
    const vee = block(
      V(0, yokeTop - 0.005, chestFront + 0.012),
      V(0, yokeBottom - 0.03, chestFront + 0.016),
      shoulderW * 0.22,
      0.028,
      shoulderW * 0.06,
      0.024,
      palette.linen,
    );
    group.add(vee);
  }

  if (wear.pauldrons) {
    [-1, 1].forEach((side) => {
      const sharp = wear.pauldrons === "sharp";
      const p = new THREE.Group();
      const shell = meshOf(
        loft(
          [
            ring(V(0, 0, 0), shoulderW * 0.22, 0.1, 6, { squareness: 0.4 }),
            ring(V(0, 0.055, 0), shoulderW * 0.25, 0.115, 6, { squareness: 0.4 }),
            ring(V(0, 0.095, 0), shoulderW * 0.16, 0.075, 6, { squareness: 0.4 }),
          ],
          { capStart: true, capEnd: true },
        ),
        palette.armour,
      );
      p.add(shell);
      if (sharp) {
        const spike = meshOf(new THREE.ConeGeometry(0.035, 0.17, 4), palette.armour, true, false);
        spike.position.set(side * shoulderW * 0.16, 0.09, 0.02);
        spike.rotation.z = side * -0.55;
        p.add(spike);
      }
      p.position.set(side * rig.shoulder.x * 0.98, rig.shoulder.y + 0.03, rig.shoulder.z);
      p.rotation.z = side * 0.2;
      group.add(p);
    });
  }

  if (wear.chestPiece === "plastron") {
    const plate = block(
      V(0, rig.shoulder.y - 0.02, rig.chest.z - (profile.build.chestD ?? 0.14) * 0.92),
      V(0, rig.waist.y + 0.03, rig.waist.z - (profile.build.waistD ?? 0.12) * 0.95),
      shoulderW * 0.62,
      0.05,
      shoulderW * 0.42,
      0.05,
      palette.armour,
    );
    group.add(plate);
  }

  if (wear.sash) {
    const sash = block(
      V(-shoulderW * 0.34, rig.shoulder.y + 0.02, rig.chest.z - (profile.build.chestD ?? 0.14) * 0.85),
      V(shoulderW * 0.3, rig.waist.y - 0.01, rig.waist.z - (profile.build.waistD ?? 0.12) * 0.9),
      0.09,
      0.045,
      0.09,
      0.045,
      palette.trimSolid,
    );
    group.add(sash);
  }

  if (wear.belt !== false) {
    // O cinto tem de seguir a cintura já estreitada, senão fica a flutuar, e
    // tem de ser mais largo para ler como bloco escuro e não como um fio.
    const bellyB = profile.build.belly ?? 0;
    const beltW = (profile.build.waistW ?? 0.165) * PROPORTIONS.waist * 1.1 + bellyB * 0.4;
    const beltD = ((profile.build.waistD ?? 0.12) * PROPORTIONS.waist + bellyB * 0.9) * 1.1;
    const beltZ = rig.waist.z - bellyB * 0.85;
    const belt = meshOf(
      loft(
        [
          ring(V(0, rig.waist.y - 0.115, beltZ), beltW * 0.98, beltD * 0.98, 9, { squareness: 0.3 }),
          ring(V(0, rig.waist.y - 0.085, beltZ), beltW, beltD, 9, { squareness: 0.3 }),
          ring(V(0, rig.waist.y - 0.015, beltZ), beltW, beltD, 9, { squareness: 0.3 }),
          ring(V(0, rig.waist.y + 0.012, beltZ), beltW * 0.98, beltD * 0.98, 9, { squareness: 0.3 }),
        ],
        {},
      ),
      palette.leather,
    );
    group.add(belt);
    const buckle = meshOf(
      new THREE.BoxGeometry(0.095, 0.085, 0.032),
      palette.metal,
      true,
      false,
    );
    buckle.position.set(0, rig.waist.y - 0.05, beltZ - beltD * 1.04);
    group.add(buckle);
  }

  if (wear.ribcage) {
    for (let i = 0; i < 4; i += 1) {
      const t = i / 3;
      const y = THREE.MathUtils.lerp(rig.chest.y + 0.05, rig.waist.y - 0.02, t);
      const rib = meshOf(
        new THREE.TorusGeometry(
          THREE.MathUtils.lerp(0.178, 0.138, t),
          0.017,
          3,
          10,
          Math.PI * 1.5,
        ),
        palette.skin,
        true,
        false,
      );
      rib.position.set(0, y, rig.chest.z);
      rib.rotation.set(Math.PI / 2, 0, Math.PI * 0.25);
      rib.scale.set(1, 0.78, 1);
      group.add(rib);
    }
    const spine = limb(
      V(0, rig.waist.y - 0.05, rig.waist.z + 0.05),
      V(0, rig.neck.y, rig.neck.z + 0.04),
      0.03,
      0.026,
      palette.skin,
      5,
    );
    group.add(spine);
  }
}

/* --------------------------------------------------------------------------
   Braços
   -------------------------------------------------------------------------- */

/*
   `world: true`  -> alvo fixo no mundo (tampo da mesa, braço da cadeira);
                     não encolhe com personagens mais pequenos, que ficam
                     antes a esticar-se para lá chegar.
   `world: false` -> alvo relativo ao corpo (colo, anca, queixo, ...).
*/
/*
   Cada alvo traz agora também um `elbow`. Não é uma posição imposta, é a
   direcção do pólo da IK: sem ele o solver usava um pólo fixo para todas as
   poses e, com os alvos longe, saturava em `maxD` e travava o cotovelo. Era
   isso que dava os antebraços esticados na horizontal em todas as figuras.

   `world: true`  -> alvo fixo no mundo (tampo da mesa, braço da cadeira);
                     não encolhe com personagens mais pequenos, que ficam
                     antes a esticar-se para lá chegar.
   `world: false` -> alvo relativo ao corpo (colo, anca, queixo, ...).
*/
const HAND_TARGETS = {
  // Mão sobre o tampo (y = 1.19). O punho fica a 1.222 para a palma assentar na
  // mesa em vez de a atravessar: antes a face inferior da mão ficava 6 mm
  // dentro da madeira.
  table: {
    world: true,
    at: (side) => ({
      wrist: V(side * 0.21, 1.222, -0.44),
      tip: V(side * 0.19, 1.216, -0.58),
      elbow: V(side * 0.36, 1.1, -0.16),
    }),
  },
  tableWide: {
    world: true,
    at: (side) => ({
      wrist: V(side * 0.32, 1.222, -0.4),
      tip: V(side * 0.3, 1.216, -0.54),
      elbow: V(side * 0.46, 1.1, -0.14),
    }),
  },
  armrest: {
    world: true,
    at: (side) => ({
      wrist: V(side * 0.4, 1.19, -0.14),
      tip: V(side * 0.4, 1.183, -0.29),
      elbow: V(side * 0.46, 1.19, 0.08),
    }),
  },
  lap: {
    world: false,
    at: (side) => ({
      wrist: V(side * 0.16, 1.075, -0.2),
      tip: V(side * 0.13, 1.06, -0.34),
      elbow: V(side * 0.32, 1.12, -0.02),
    }),
  },
  steeple: {
    world: false,
    at: (side) => ({
      wrist: V(side * 0.085, 1.235, -0.28),
      tip: V(side * 0.014, 1.375, -0.315),
      elbow: V(side * 0.31, 1.1, -0.16),
    }),
  },
  chin: {
    world: false,
    at: (side) => ({
      wrist: V(side * 0.1, 1.345, -0.2),
      tip: V(side * 0.06, 1.475, -0.18),
      elbow: V(side * 0.26, 1.11, -0.2),
    }),
  },
  goblet: {
    world: false,
    at: (side) => ({
      wrist: V(side * 0.26, 1.285, -0.26),
      tip: V(side * 0.24, 1.335, -0.36),
      elbow: V(side * 0.36, 1.11, -0.14),
    }),
  },
  raised: {
    world: false,
    at: (side) => ({
      wrist: V(side * 0.4, 1.53, -0.22),
      tip: V(side * 0.44, 1.64, -0.26),
      elbow: V(side * 0.46, 1.22, -0.12),
    }),
  },
  hip: {
    world: false,
    at: (side) => ({
      wrist: V(side * 0.24, 1.09, 0.0),
      tip: V(side * 0.22, 1.05, -0.13),
      elbow: V(side * 0.32, 1.15, 0.08),
    }),
  },
};

function addArm(group, rig, profile, palette, side, targetKey) {
  const s = profile.build.scale ?? 1;
  const spec = HAND_TARGETS[targetKey] ?? HAND_TARGETS.table;
  const raw = spec.at(side);
  const shrink = (p) => rig.hip.clone().add(p.clone().sub(rig.hip).multiplyScalar(s));
  const target = spec.world ? raw.wrist.clone() : shrink(raw.wrist);
  const handDir = raw.tip.clone().sub(raw.wrist).normalize();

  const shoulder = V(side * rig.shoulder.x, rig.shoulder.y, rig.shoulder.z);

  // O pólo aponta do meio da corda ombro-punho para onde queremos o cotovelo.
  // Assim o cotovelo cai no sítio certo sem quebrar o comprimento dos ossos.
  let pole = V(side * 0.48, -0.78, 0.4).normalize();
  if (raw.elbow) {
    const hint = spec.world ? raw.elbow.clone() : shrink(raw.elbow);
    const chordMid = shoulder.clone().add(target).multiplyScalar(0.5);
    const away = hint.sub(chordMid);
    if (away.lengthSq() > 1e-6) pole = away.normalize();
  }

  const solved = solveArm(shoulder, target, rig.upperArm, rig.foreArm, pole);
  const elbow = solved.elbow;
  const wrist = solved.wrist;
  const r = (profile.build.limb ?? 1) * 0.062 * s;
  /* `handLength` era 0.2 fixo para todos, independentemente da espessura do
     membro. No Bones (limb 0.62, r = 0.038) dava uma mão 5.2 vezes mais comprida
     do que larga, que é a prancha que se via. Uma mão real anda nos 2.2. */
  const handLen = Math.min(rig.handLength, r * 3.0) * PROPORTIONS.hand;
  const tip = wrist.clone().add(handDir.multiplyScalar(handLen));
  const sleeve = profile.wear?.sleeve ?? "fitted";

  /* ---- deltoide ----
     O braço arrancava directamente do ponto do ombro, sem massa nenhuma: de
     frente parecia nascer a meio do pescoço, e como os braços vivem no `root` e
     o tronco respira num grupo à parte, a junta abria e fechava cerca de 1 cm
     por ciclo. Esta cúpula cobre a articulação e resolve as duas coisas. */
  const armDir = elbow.clone().sub(shoulder).normalize();
  const deltoid = meshOf(
    loft(
      [
        ring(V(0, -r * 0.55, 0), r * 1.08, r * 1.08, 7, { squareness: 0.3 }),
        ring(V(0, r * 0.1, 0), r * 1.62, r * 1.52, 7, { squareness: 0.3 }),
        ring(V(0, r * 0.85, 0), r * 1.5, r * 1.4, 7, { squareness: 0.3 }),
        ring(V(0, r * 1.5, 0), r * 1.22, r * 1.14, 7, { squareness: 0.3 }),
      ],
      { capStart: true, capEnd: true },
    ),
    sleeve === "bare" ? palette.skin : palette.cloth,
  );
  deltoid.position.copy(shoulder).addScaledVector(armDir, -r * 0.25);
  deltoid.quaternion.setFromUnitVectors(UP, armDir);
  group.add(deltoid);

  if (sleeve === "wide") {
    // manga larga de túnica/robe
    const dir = elbow.clone().sub(shoulder).normalize();
    const rings = [
      ring(V(0, 0, 0), r * 1.5, r * 1.5, 7, { squareness: 0.3 }),
      ring(V(0, shoulder.distanceTo(elbow) * 0.6, 0), r * 1.7, r * 1.7, 7, { squareness: 0.3 }),
      ring(V(0, shoulder.distanceTo(elbow) * 1.02, 0), r * 1.8, r * 1.8, 7, { squareness: 0.3 }),
    ];
    const sleeveMesh = meshOf(loft(rings, { capStart: true }), palette.cloth);
    sleeveMesh.position.copy(shoulder);
    sleeveMesh.quaternion.setFromUnitVectors(UP, dir);
    group.add(sleeveMesh);
    group.add(limb(elbow, wrist, r * 0.95, r * 0.8, palette.skin, 6));
  } else {
    group.add(limb(shoulder, elbow, r * 1.3, r * 0.98, palette.cloth, 6));
    group.add(limb(elbow, wrist, r * 0.98, r * 0.78, sleeve === "bare" ? palette.skin : palette.cloth, 6));
    // punho / bracelete
    const cuff = meshOf(
      loft(
        [
          ring(V(0, -0.022, 0), r * 1.12, r * 1.12, 6, { squareness: 0.35 }),
          ring(V(0, 0.022, 0), r * 1.05, r * 1.05, 6, { squareness: 0.35 }),
        ],
        {},
      ),
      palette.leather,
    );
    orient(cuff, wrist.clone().lerp(elbow, 0.22), wrist.clone().lerp(elbow, 0.06));
    group.add(cuff);
  }

  // cotovelo
  const elbowPad = meshOf(new THREE.OctahedronGeometry(r * 1.02, 1), palette.cloth, true, false);
  elbowPad.position.copy(elbow);
  elbowPad.scale.set(1, 0.8, 0.9);
  group.add(elbowPad);

  // mão
  const handGroup = new THREE.Group();
  addHand(handGroup, wrist, tip, r * PROPORTIONS.hand, side, palette.skin);
  group.add(handGroup);

  handGroup.name = `hand-${side < 0 ? "L" : "R"}`;
  handGroup.userData.wrist = wrist.clone();
  handGroup.userData.tip = tip.clone();
  return { shoulder, elbow, wrist, tip };
}

/* --------------------------------------------------------------------------
   Adereços
   -------------------------------------------------------------------------- */

function addProp(group, rig, profile, palette, arms) {
  const prop = profile.prop;
  if (!prop) return;

  if (prop === "goblet") {
    const anchor = arms.right.tip.clone().add(V(0, 0.02, -0.02));
    const cupMat = palette.metal;
    const stem = limb(anchor.clone().add(V(0, -0.05, 0)), anchor.clone().add(V(0, 0.05, 0)), 0.014, 0.02, cupMat, 6);
    group.add(stem);
    const cup = meshOf(
      loft(
        [
          ring(V(0, 0, 0), 0.028, 0.028, 7),
          ring(V(0, 0.085, 0), 0.058, 0.058, 7),
        ],
        { capStart: true },
      ),
      cupMat,
    );
    cup.position.copy(anchor).add(V(0, 0.05, 0));
    group.add(cup);
    const wine = meshOf(new THREE.CircleGeometry(0.05, 8), palette.gem, false, false);
    wine.rotation.x = -Math.PI / 2;
    wine.position.copy(anchor).add(V(0, 0.122, 0));
    group.add(wine);
    const foot = meshOf(new THREE.CylinderGeometry(0.04, 0.045, 0.016, 8), cupMat, true, false);
    foot.position.copy(anchor).add(V(0, -0.06, 0));
    group.add(foot);
    return;
  }

  if (prop === "staff") {
    // passa pela mão levantada e assenta no chão ao lado da cadeira
    const grip = arms.right.wrist.clone();
    const bottom = V(grip.x + 0.06, 0.02, grip.z - 0.07);
    const top = bottom.clone().lerp(grip, 1.25).setY(1.98);
    group.add(limb(bottom, top, 0.024, 0.019, palette.leather, 6));
    const claw = meshOf(new THREE.ConeGeometry(0.052, 0.13, 4), palette.metal, true, false);
    claw.position.copy(top).add(V(0, -0.03, 0));
    group.add(claw);
    const orb = meshOf(new THREE.IcosahedronGeometry(0.062, 0), palette.gem, true, false);
    orb.position.copy(top).add(V(0, 0.07, 0));
    group.add(orb);
    return;
  }

  if (prop === "bow") {
    const bow = new THREE.Group();
    const arc = meshOf(
      new THREE.TorusGeometry(0.4, 0.018, 4, 14, Math.PI * 1.05),
      palette.leather,
      true,
      false,
    );
    arc.rotation.z = Math.PI * 0.45;
    bow.add(arc);
    const stringMesh = limb(V(-0.36, -0.18, 0), V(-0.36, 0.4, 0), 0.005, 0.005, palette.trimSolid, 4);
    bow.add(stringMesh);
    bow.position.set(0.68, 0.45, 0.36);
    bow.rotation.set(0, 0.35, 0.14);
    group.add(bow);
    return;
  }

  if (prop === "dagger") {
    const anchor = arms.right.tip.clone().add(V(0.02, 0.0, -0.04));
    const blade = block(
      anchor,
      anchor.clone().add(V(0.02, 0.01, -0.2)),
      0.03,
      0.012,
      0.008,
      0.006,
      palette.metal,
    );
    group.add(blade);
    const guard = meshOf(new THREE.BoxGeometry(0.075, 0.016, 0.016), palette.leather, true, false);
    guard.position.copy(anchor).add(V(0, 0, 0.012));
    group.add(guard);
    return;
  }

  if (prop === "book") {
    /* Era uma placa de capa com as folhas por cima: lia como uma laje, porque a
       superfície visível de topo era o bloco claro das folhas e não havia lombo
       nem espessura. Um livro fechado tem capa em baixo E em cima, com as folhas
       encaixadas entre as duas e recuadas, para a capa fazer rebordo. Assenta
       agora no tampo (y = 1.19) em vez de flutuar 2 cm acima dele. */
    const tableY = 1.19;
    const yaw = 0.22;
    const w = 0.2;
    const d = 0.155;
    const coverT = 0.016;
    const pagesT = 0.042;

    const put = (mesh, y) => {
      mesh.position.set(0, y, -0.52);
      mesh.rotation.y = yaw;
      group.add(mesh);
    };

    put(meshOf(new THREE.BoxGeometry(w, coverT, d), palette.cloakSolid, true, false), tableY + coverT / 2);
    // folhas recuadas, para a capa fazer rebordo em volta
    put(
      meshOf(new THREE.BoxGeometry(w * 0.94, pagesT, d * 0.92), palette.trimSolid, true, false),
      tableY + coverT + pagesT / 2,
    );
    put(
      meshOf(new THREE.BoxGeometry(w, coverT, d), palette.cloakSolid, true, false),
      tableY + coverT * 1.5 + pagesT,
    );

    // lombo arredondado num dos lados
    const spine = meshOf(
      new THREE.CylinderGeometry(coverT + pagesT / 2, coverT + pagesT / 2, d, 6, 1, false, 0, Math.PI),
      palette.cloakSolid,
      true,
      false,
    );
    spine.rotation.set(Math.PI / 2, 0, 0);
    spine.position.set(0, tableY + coverT + pagesT / 2, -0.52);
    spine.rotation.y = yaw;
    const spineOffset = new THREE.Vector3(-w / 2, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
    spine.position.add(spineOffset);
    group.add(spine);

    // fecho metálico do lado oposto ao lombo
    const clasp = meshOf(
      new THREE.BoxGeometry(0.022, coverT * 2 + pagesT, 0.05),
      palette.metal,
      true,
      false,
    );
    clasp.position.set(0, tableY + coverT + pagesT / 2, -0.52);
    clasp.rotation.y = yaw;
    clasp.position.add(new THREE.Vector3(w / 2, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw));
    group.add(clasp);
  }

}

/* --------------------------------------------------------------------------
   Perfis dos 8 personagens
   -------------------------------------------------------------------------- */

const PROFILES = {
  vlad: {
    build: { scale: 1.02, shoulder: 0.2, chestW: 0.2, chestD: 0.14, waistW: 0.16, waistD: 0.115, hipW: 0.18, hipD: 0.135, limb: 0.98, headScale: 0.98 },
    colors: {
      skin: 0xd8cec6, hair: 0x101018, cloth: 0x262c4a, clothDark: 0x141830,
      leather: 0x241d2c, metal: 0xc6cadd, trim: 0xb9b9d4, accent: 0x8e2430,
      gem: 0x9c2530, iris: 0xc22a33, eyeGlow: 0xff4a4a,
    },
    face: { nose: "straight", brow: "heavy" },
    hair: { style: "sleek", beard: null },
    wear: { cloak: "long", cloakLining: 0x7d1f27, collar: "high", pauldrons: "sharp", chestPiece: "plastron", legwear: "robe", sleeve: "fitted", crown: null },
    pose: { lean: 0.12, left: "steeple", right: "steeple" },
    prop: null,
  },
  maria: {
    build: { scale: 0.96, shoulder: 0.168, chestW: 0.165, chestD: 0.125, waistW: 0.132, waistD: 0.1, hipW: 0.175, hipD: 0.13, limb: 0.88, headScale: 1.0 },
    colors: {
      skin: 0xe7bd97, hair: 0xc79a3f, cloth: 0xd8a828, clothDark: 0x8a6410,
      leather: 0x6d4a1c, metal: 0xf0cf6a, trim: 0xfff0c0, accent: 0xffd60a,
      // Coroa em ouro rosa e gema rosa a condizer, para destacar do louro.
      crownMetal: 0xe8899b, crownGem: 0xffd2e4,
      gem: 0x7fd8ff, iris: 0x35608f, eyeGlow: 0xffe08a,
    },
    face: { nose: "small", brow: "soft" },
    hair: { style: "long", beard: null },
    wear: { cloak: "short", cloakLining: 0xfff0c0, collar: "none", crown: "gold", legwear: "robe", sleeve: "wide", sash: true },
    pose: { lean: 0.22, left: "table", right: "tableWide" },
    prop: null,
  },
  protheus: {
    build: { scale: 1.04, shoulder: 0.215, chestW: 0.215, chestD: 0.165, waistW: 0.2, waistD: 0.155, hipW: 0.205, hipD: 0.16, belly: 0.075, limb: 1.12, headScale: 1.04 },
    colors: {
      skin: 0xd8a184, hair: 0xd6cfc4, cloth: 0x9d2a2f, clothDark: 0x5f1518,
      leather: 0x5a3a1d, metal: 0xd8b25a, trim: 0xf0c9c9, accent: 0xff3b30,
      gem: 0x6d1220, iris: 0x4a3a26, eyeGlow: 0xffd28a,
    },
    face: { nose: "large", brow: "heavy" },
    hair: { style: "long", beard: "full" },
    wear: { cloak: "long", cloakLining: 0xd8b25a, collar: "none", crown: "kingly", pauldrons: "round", legwear: "robe", sleeve: "wide" },
    pose: { lean: 0.05, left: "armrest", right: "goblet" },
    prop: "goblet",
  },
  romeo: {
    build: { scale: 0.82, shoulder: 0.152, chestW: 0.148, chestD: 0.115, waistW: 0.138, waistD: 0.105, hipW: 0.152, hipD: 0.118, limb: 0.86, headScale: 1.2, headWidth: 0.98 },
    colors: {
      skin: 0xe3ae86, hair: 0x33200f, cloth: 0x9a6b34, clothDark: 0x4a2f14,
      leather: 0x4d3117, metal: 0xa08a63, trim: 0xd8c49a, accent: 0xff8a00,
      gem: 0x3f8b3a, iris: 0x3c6b33, eyeGlow: 0xffd28a,
    },
    face: { shape: "child", nose: "small", brow: "soft", eye: 1.15 },
    hair: { style: "volume", beard: null },
    wear: { cloak: "none", collar: "none", crown: null, legwear: "trousers", sleeve: "fitted" },
    pose: { lean: 0.3, left: "table", right: "table" },
    prop: null,
  },
  makuru: {
    build: { scale: 0.86, shoulder: 0.168, chestW: 0.175, chestD: 0.14, waistW: 0.16, waistD: 0.125, hipW: 0.17, hipD: 0.13, belly: 0.025, limb: 0.95, headScale: 1.16, headWidth: 1.06 },
    colors: {
      skin: 0x6e9c3f, hair: 0x2c3a18, cloth: 0x4a4230, clothDark: 0x2c2718,
      leather: 0x5a3f22, metal: 0x8f8a72, trim: 0x9aa860, accent: 0x7cff2b,
      gem: 0x9fd63a, iris: 0xd8d02a, eyeGlow: 0xc8ff5a,
    },
    face: { nose: "hooked", brow: "angry", ears: "goblin" },
    hair: { style: "bald", beard: null },
    wear: { cloak: "none", collar: "none", crown: null, legwear: "trousers", sleeve: "bare", sash: true },
    pose: { lean: 0.3, left: "table", right: "hip" },
    prop: "dagger",
  },
  artheria: {
    build: { scale: 0.99, shoulder: 0.172, chestW: 0.168, chestD: 0.125, waistW: 0.134, waistD: 0.1, hipW: 0.172, hipD: 0.128, limb: 0.88, headScale: 0.97 },
    colors: {
      skin: 0xe4c5a6, hair: 0xe6e2d4, cloth: 0x2f6b4c, clothDark: 0x1b3f2c,
      leather: 0x4c3a22, metal: 0xcfd6c2, trim: 0xe8d98a, accent: 0x00e5a0,
      gem: 0x37e0a8, iris: 0x2f8f7a, eyeGlow: 0x8ff0cf,
    },
    face: { nose: "small", brow: "soft", ears: "long" },
    hair: { style: "braids", beard: null },
    wear: { cloak: "long", cloakLining: 0x1b3f2c, collar: "none", crown: "circlet", pauldrons: "sharp", legwear: "robe", sleeve: "fitted" },
    pose: { lean: 0.18, left: "lap", right: "table" },
    prop: "bow",
  },
  muriel: {
    build: { scale: 0.97, shoulder: 0.172, chestW: 0.168, chestD: 0.128, waistW: 0.14, waistD: 0.105, hipW: 0.178, hipD: 0.132, limb: 0.9, headScale: 0.99 },
    colors: {
      skin: 0xdcb69a, hair: 0x2a1830, cloth: 0x6a34ab, clothDark: 0x3c1a68,
      leather: 0x3a2450, metal: 0xffd76b, trim: 0xffd76b, accent: 0xe63dff,
      gem: 0xd06bff, iris: 0x8a3fd0, eyeGlow: 0xe89bff,
    },
    face: { nose: "straight", brow: "soft" },
    hair: { style: "long", beard: null },
    wear: { cloak: "long", cloakLining: 0x2a1240, hat: "pointed", collar: "none", crown: null, legwear: "robe", sleeve: "wide" },
    pose: { lean: 0.16, left: "table", right: "raised" },
    prop: "staff",
  },
  bones: {
    build: { scale: 0.99, shoulder: 0.18, chestW: 0.155, chestD: 0.115, waistW: 0.12, waistD: 0.095, hipW: 0.155, hipD: 0.12, limb: 0.62, headScale: 1.0 },
    colors: {
      skin: 0xdfe3ea, hair: 0x2a3040, cloth: 0x2b3242, clothDark: 0x171d29,
      leather: 0x2a2f3b, metal: 0xa8b4c6, trim: 0x8fa3bd, accent: 0xe8f4ff,
      gem: 0x7fe8ff, iris: 0x7fe8ff, eyeGlow: 0x8ff2ff,
    },
    face: { shape: "skull", nose: "none", ears: "none" },
    hair: { style: "none", beard: null },
    wear: { cloak: "long", cloakLining: 0x171d29, collar: "high", crown: null, legwear: "bare", sleeve: "bare", ribcage: true, belt: true },
    pose: { lean: 0.2, left: "table", right: "table" },
    prop: "book",
  },
};

export const LOBBY_CHARACTER_IDS = Object.keys(PROFILES);

function buildPalette(profile) {
  const c = profile.colors;
  const lining = profile.wear?.cloakLining ?? c.clothDark;
  return {
    // O Bones leva grão de osso em vez de pele: salpicos e fissuras finas.
    skin: mat(c.skin, {
      roughness: 0.86,
      detail: profile.face?.shape === "skull" ? "bone" : "skin",
      bumpScale: profile.face?.shape === "skull" ? 0.006 : 0.003,
    }),
    brow: mat(c.hair, { roughness: 0.95, detail: "hair" }),
    hair: mat(c.hair, { roughness: 0.96, detail: "hair", bumpScale: 0.008 }),
    cloth: mat(c.cloth, { roughness: 0.9, detail: "cloth" }),
    clothDark: mat(c.clothDark, { roughness: 0.92, detail: "cloth" }),
    clothDarkDouble: mat(c.clothDark, { roughness: 0.92, side: THREE.DoubleSide, detail: "cloth" }),
    legCloth: mat(c.clothDark, { roughness: 0.92, detail: "cloth" }),
    leather: mat(c.leather, { roughness: 0.88, detail: "leather", bumpScale: 0.005 }),
    metal: mat(c.metal, { roughness: 0.36, metalness: 0.62, detail: "metal", bumpScale: 0.002 }),
    // Metal e gema próprios da coroa, quando o perfil os define.
    crownMetal: c.crownMetal ? mat(c.crownMetal, { roughness: 0.34, metalness: 0.58, detail: "metal", bumpScale: 0.002 }) : null,
    armour: mat(c.metal, { roughness: 0.42, metalness: 0.55, detail: "metal", bumpScale: 0.003 }),
    trim: mat(c.trim, { roughness: 0.45, metalness: 0.4, detail: "metal", bumpScale: 0.002 }),
    trimSolid: mat(c.trim, { roughness: 0.7, metalness: 0.15, detail: "cloth" }),
    cloak: mat(c.cloth, { roughness: 0.94, side: THREE.DoubleSide, detail: "cloth" }),
    cloakSolid: mat(lining, { roughness: 0.92, detail: "cloth" }),
    collar: new THREE.MeshStandardMaterial({
      color: lining,
      roughness: 0.9,
      flatShading: true,
      side: THREE.DoubleSide,
    }),
    hoodCloth: new THREE.MeshStandardMaterial({
      color: c.cloth,
      roughness: 0.94,
      flatShading: true,
      side: THREE.DoubleSide,
    }),
    hoodTrim: mat(c.trim, { roughness: 0.7, metalness: 0.2 }),
    hatCloth: new THREE.MeshStandardMaterial({
      color: c.clothDark,
      roughness: 0.95,
      flatShading: true,
      side: THREE.DoubleSide,
    }),
    hatBand: mat(c.trim, { roughness: 0.6, metalness: 0.25 }),
    sclera: mat(0xe9e2d4, { roughness: 0.6 }),
    iris: mat(c.iris, { roughness: 0.35, emissive: c.eyeGlow, emissiveIntensity: 0.35 }),
    eyeGlow: mat(c.eyeGlow, { roughness: 0.3, emissive: c.eyeGlow, emissiveIntensity: 1.6 }),
    socket: mat(0x05060a, { roughness: 1 }),
    // Sombra suave da órbita: escurece a pele sem ser um buraco preto.
    socketSoft: mat(new THREE.Color(c.skin).multiplyScalar(0.82).getHex(), { roughness: 0.95 }),
    pupil: mat(0x120f14, { roughness: 0.5 }),
    // Mancha escura do olho e brilho. A mancha é escura mas não preta, para não
    // abrir um buraco na cara sob luz baixa.
    eyeDark: mat(0x1b1720, { roughness: 0.55 }),
    glint: mat(0xf2f6ff, { roughness: 0.35 }),
    mouth: mat(0x5d3630, { roughness: 0.9 }),
    // O lábio inferior em tom de pele puro lia como dentes. Escurecido, lê como lábio.
    lip: mat(new THREE.Color(c.skin).multiplyScalar(0.88).getHex(), { roughness: 0.9 }),
    /* Linho: o tom claro da camisa. Puxa o `trim` de cada perfil para perto do
       branco e dessatura, para ser um valor claro neutro em vez de mais uma
       variação do tom dominante. */
    linen: mat(
      new THREE.Color(c.trim).lerp(new THREE.Color(0xf4efe4), 0.55).getHex(),
      { roughness: 0.92 },
    ),
    gem: mat(c.gem, { roughness: 0.25, metalness: 0.2, emissive: c.gem, emissiveIntensity: 0.35 }),
    crownGem: c.crownGem
      // Emissive baixo: a 0.3 a pedra da coroa lia como uma luz acesa.
      ? mat(c.crownGem, { roughness: 0.22, metalness: 0.2, emissive: c.crownGem, emissiveIntensity: 0.1 })
      : null,
  };
}

/* --------------------------------------------------------------------------
   Montagem final
   -------------------------------------------------------------------------- */

export function createSeatedCharacter(characterId) {
  const profile = PROFILES[characterId] ?? PROFILES.vlad;
  const rig = buildRig(profile);
  const palette = buildPalette(profile);

  const root = new THREE.Group();

  // ---- pernas (fixas, não acompanham a respiração) ----
  addLegs(root, rig, profile, palette);
  addLapRobe(root, rig, profile, palette);

  // ---- tronco (grupo que roda em torno da anca) ----
  const torso = new THREE.Group();
  torso.position.copy(rig.hip);
  const local = (object) => {
    object.position.sub(rig.hip);
    return object;
  };
  const addToTorso = (object) => {
    torso.add(local(object));
  };

  const torsoGroup = new THREE.Group();
  torsoGroup.add(buildTorso(rig, profile, palette));
  addUpperWear(torsoGroup, rig, profile, palette);
  addCloak(torsoGroup, rig, profile, palette);
  torsoGroup.position.sub(rig.hip);
  torso.add(torsoGroup);

  // pescoço
  const neckMesh = limb(
    V(0, rig.chest.y, rig.chest.z * 0.9),
    V(0, rig.head.y - rig.headHeight * 0.42, rig.head.z),
    0.062 * (profile.build.scale ?? 1),
    0.05 * (profile.build.scale ?? 1),
    palette.skin,
    6,
  );
  addToTorso(neckMesh);

  // ---- cabeça ----
  const headPivot = new THREE.Group();
  headPivot.position.copy(rig.head).sub(rig.hip);
  const head = new THREE.Group();
  if (profile.face?.shape === "skull") {
    head.add(createSkullHead(rig, palette));
  } else {
    head.add(createHeadShell(rig, profile.face?.shape ?? "human", palette.skin));
    addFace(head, rig, profile, palette);
    addEars(head, rig, profile.face?.ears ?? "human", palette.skin);
    addHair(head, rig, profile, palette);
  }
  addHeadwear(head, rig, profile, palette);
  addHood(head, rig, profile, palette);
  addPointedHat(head, rig, profile, palette);
  headPivot.add(head);
  torso.add(headPivot);

  // inclinação do tronco
  const lean = profile.pose?.lean ?? 0.1;
  torso.rotation.x = -lean;
  root.add(torso);

  // ---- braços (colocados já com a inclinação aplicada) ----
  const leanQ = new THREE.Quaternion().setFromAxisAngle(V(1, 0, 0), -lean);
  const applyLean = (p) => p.clone().sub(rig.hip).applyQuaternion(leanQ).add(rig.hip);
  const leanedRig = { ...rig, shoulder: applyLean(rig.shoulder) };
  leanedRig.shoulder.x = rig.shoulder.x;

  const arms = {
    left: addArm(root, leanedRig, profile, palette, -1, profile.pose?.left ?? "table"),
    right: addArm(root, leanedRig, profile, palette, 1, profile.pose?.right ?? "table"),
  };

  addProp(root, rig, profile, palette, arms);

  root.userData.animation = {
    torso,
    headPivot,
    baseTorsoRotX: torso.rotation.x,
    phase: Math.random() * Math.PI * 2,
    breath: 0.012 + Math.random() * 0.006,
    sway: 0.03 + Math.random() * 0.02,
    turn: 0.07 + Math.random() * 0.05,
  };
  root.userData.characterId = characterId;
  return root;
}

export function updateCharacter(object, t) {
  const a = object?.userData?.animation;
  if (!a) return;
  const breath = Math.sin(t * 1.15 + a.phase);
  a.torso.rotation.x = a.baseTorsoRotX + breath * a.breath;
  a.torso.rotation.z = Math.sin(t * 0.31 + a.phase * 1.7) * a.sway * 0.35;
  a.headPivot.rotation.y = Math.sin(t * 0.23 + a.phase) * a.turn;
  a.headPivot.rotation.z = Math.sin(t * 0.37 + a.phase * 0.6) * a.sway * 0.4;
  a.headPivot.rotation.x = Math.sin(t * 0.19 + a.phase * 2.1) * a.turn * 0.35;
}

/* --------------------------------------------------------------------------
   Cadeira
   -------------------------------------------------------------------------- */

const EMPTY_CUSHION = 0x6b4a2e;
const EMPTY_CUSHION_TRIM = 0x8e6b3f;

/**
 * A cadeira é independente do personagem: existe sempre no lobby, vazia
 * enquanto ninguém se sentar.
 */
export function createLobbyChair() {
  const wood = mat(0x33200f, { roughness: 0.93 });
  const woodLight = mat(0x4a2f18, { roughness: 0.9 });
  const woodWorn = mat(0x6b4826, { roughness: 0.72 });
  const trim = mat(0x8a6231, { roughness: 0.5, metalness: 0.35 });
  const cushion = mat(EMPTY_CUSHION, { roughness: 0.95 });
  const cushionTrim = mat(EMPTY_CUSHION_TRIM, { roughness: 0.65, metalness: 0.2 });

  const group = new THREE.Group();
  const halfW = CHAIR.seatWidth / 2;
  const halfD = CHAIR.seatDepth / 2;
  const frontZ = -halfD;
  const backRestZ = CHAIR.backZ;

  /* ---- estrutura do assento ----
     Antes era um loft com squareness 0.75 que criava um lábio biselado em bico
     à frente: lia como um barco. Agora é uma tábua com espessura constante e
     uma travessa por baixo, que é como uma cadeira se constrói. */
  const seatTopY = CHAIR.seatY;
  const seatSlab = meshOf(
    loft(
      [
        ring(V(0, seatTopY - 0.075, 0), halfW * 0.97, halfD * 0.97, 8, { squareness: 0.9 }),
        ring(V(0, seatTopY - 0.055, 0), halfW, halfD, 8, { squareness: 0.9 }),
        ring(V(0, seatTopY, 0), halfW, halfD, 8, { squareness: 0.9 }),
      ],
      { capStart: true, capEnd: true },
    ),
    wood,
  );
  group.add(seatSlab);

  // Aros laterais por baixo do assento, a ligar as patas entre si.
  [-1, 1].forEach((sx) => {
    group.add(
      block(
        V(sx * halfW * 0.93, seatTopY - 0.115, CHAIR.frontLegZ),
        V(sx * halfW * 0.93, seatTopY - 0.115, CHAIR.backLegZ),
        0.05,
        0.075,
        0.05,
        0.075,
        woodLight,
      ),
    );
  });
  group.add(
    block(
      V(-halfW * 0.9, seatTopY - 0.115, frontZ + 0.05),
      V(halfW * 0.9, seatTopY - 0.115, frontZ + 0.05),
      0.05,
      0.075,
      0.05,
      0.075,
      woodLight,
    ),
  );

  /* ---- almofada ----
     Volume próprio, com bordo a sair para fora da estrutura e dois botões
     afundados, em vez da lasca invisível de 4 cm que existia antes. */
  const pad = meshOf(
    loft(
      [
        ring(V(0, seatTopY - 0.055, 0.005), halfW * 1.0, halfD * 1.0, 10, { squareness: 0.6 }),
        ring(V(0, seatTopY + 0.005, 0.005), halfW * 1.04, halfD * 1.04, 10, { squareness: 0.52 }),
        ring(V(0, CHAIR.cushionY, 0.012), halfW * 0.9, halfD * 0.9, 10, { squareness: 0.46 }),
      ],
      { capEnd: true },
    ),
    cushion,
  );
  group.add(pad);

  // cordão a contornar o bordo da almofada
  const piping = meshOf(
    loft(
      [
        ring(V(0, seatTopY - 0.004, 0.005), halfW * 1.045, halfD * 1.045, 10, { squareness: 0.52 }),
        ring(V(0, seatTopY + 0.014, 0.006), halfW * 1.05, halfD * 1.05, 10, { squareness: 0.5 }),
        ring(V(0, seatTopY + 0.03, 0.008), halfW * 1.015, halfD * 1.015, 10, { squareness: 0.5 }),
      ],
      {},
    ),
    cushionTrim,
  );
  group.add(piping);

  [[-0.4, -0.34], [0.4, -0.34], [-0.4, 0.32], [0.4, 0.32]].forEach(([bx, bz]) => {
    const button = meshOf(new THREE.OctahedronGeometry(0.026, 0), cushionTrim, false, false);
    button.position.set(bx * halfW, CHAIR.cushionY - 0.016, bz * halfD);
    button.scale.set(1, 0.42, 1);
    group.add(button);
  });

  /* ---- patas ----
     Ligeiramente abertas para fora, mais grossas no topo, com a ponta gasta. */
  [[-1, CHAIR.frontLegZ], [1, CHAIR.frontLegZ], [-1, CHAIR.backLegZ], [1, CHAIR.backLegZ]].forEach(([sx, lz]) => {
    const isFront = lz < 0;
    const topY = seatTopY - 0.05;
    const leg = block(
      V(sx * halfW * 0.99, 0.02, lz * 1.14),
      V(sx * halfW * 0.9, topY, lz),
      0.072,
      0.072,
      0.098,
      0.098,
      isFront ? wood : woodLight,
    );
    group.add(leg);
    const foot = block(
      V(sx * halfW * 0.99, 0.0, lz * 1.14),
      V(sx * halfW * 0.985, 0.05, lz * 1.13),
      0.088,
      0.088,
      0.078,
      0.078,
      woodWorn,
    );
    group.add(foot);
  });

  /* ---- barra dos pés ----
     Uma travessa entre as patas da frente, à altura do calcanhar, mais duas
     travessas laterais a ligar frente e trás. Antes a barra passava ao lado das
     patas em vez de entrar nelas. */
  const restY = CHAIR.footrestY;
  group.add(
    block(
      V(-halfW * 0.97, restY, CHAIR.footrestZ),
      V(halfW * 0.97, restY, CHAIR.footrestZ),
      0.066,
      0.084,
      0.066,
      0.084,
      woodWorn,
    ),
  );
  [-1, 1].forEach((sx) => {
    group.add(
      block(
        V(sx * halfW * 0.95, restY - 0.055, CHAIR.frontLegZ),
        V(sx * halfW * 0.95, restY - 0.055, CHAIR.backLegZ),
        0.048,
        0.056,
        0.048,
        0.056,
        woodLight,
      ),
    );
  });
  group.add(
    block(
      V(-halfW * 0.93, restY - 0.115, CHAIR.backLegZ),
      V(halfW * 0.93, restY - 0.115, CHAIR.backLegZ),
      0.05,
      0.06,
      0.05,
      0.06,
      woodLight,
    ),
  );

  /* ---- costas ----
     Dois prumos com ligeira inclinação para trás, duas travessas, painel
     estofado em baixo e dois fusos abertos em cima. O painel maciço anterior
     ocupava o vão todo e lia como uma porta. */
  const backTop = CHAIR.backTopY;
  const rake = 0.07;
  const postX = halfW * 0.93;
  [-1, 1].forEach((sx) => {
    const post = block(
      V(sx * postX, seatTopY - 0.09, backRestZ),
      V(sx * postX * 0.97, backTop, backRestZ + rake),
      0.088,
      0.096,
      0.072,
      0.082,
      wood,
    );
    group.add(post);
    const finial = meshOf(new THREE.ConeGeometry(0.042, 0.085, 6), trim, true, false);
    finial.position.set(sx * postX * 0.97, backTop + 0.045, backRestZ + rake);
    group.add(finial);
  });

  const railZ = (y) => backRestZ + rake * ((y - (seatTopY - 0.09)) / (backTop - (seatTopY - 0.09)));
  const lowerRailY = 0.99;
  const upperRailY = 1.31;
  [lowerRailY, upperRailY].forEach((y) => {
    group.add(
      block(
        V(-postX, y, railZ(y)),
        V(postX, y, railZ(y)),
        0.062,
        0.078,
        0.062,
        0.078,
        woodLight,
      ),
    );
  });

  // painel estofado entre as duas travessas
  const padZ = railZ((lowerRailY + upperRailY) / 2) - 0.028;
  const backPad = meshOf(
    loft(
      [
        ring(V(0, lowerRailY + 0.03, padZ + 0.012), postX * 0.9, 0.03, 8, { squareness: 0.6 }),
        ring(V(0, (lowerRailY + upperRailY) / 2, padZ), postX * 0.94, 0.042, 8, { squareness: 0.55 }),
        ring(V(0, upperRailY - 0.03, padZ + 0.012), postX * 0.9, 0.03, 8, { squareness: 0.6 }),
      ],
      { capStart: true, capEnd: true },
    ),
    cushion,
  );
  group.add(backPad);

  // fusos verticais na zona aberta, acima da travessa alta
  [-0.46, 0, 0.46].forEach((f) => {
    const x = f * postX * 1.36;
    const spindle = meshOf(
      loft(
        [
          ring(V(0, upperRailY, railZ(upperRailY)), 0.024, 0.024, 6, { squareness: 0.3 }),
          ring(V(0, upperRailY + 0.07, railZ(upperRailY + 0.07)), 0.038, 0.038, 6, { squareness: 0.3 }),
          ring(V(0, upperRailY + 0.13, railZ(upperRailY + 0.13)), 0.022, 0.022, 6, { squareness: 0.3 }),
          ring(V(0, backTop - 0.11, railZ(backTop - 0.11)), 0.02, 0.02, 6, { squareness: 0.3 }),
          ring(V(0, backTop - 0.05, railZ(backTop - 0.05)), 0.032, 0.032, 6, { squareness: 0.3 }),
        ],
        { capStart: true, capEnd: true },
      ),
      woodLight,
    );
    spindle.position.x = x;
    group.add(spindle);
  });

  // crista superior, com o brasão embutido de frente e não meio enterrado
  const crestY = backTop - 0.025;
  group.add(
    block(
      V(-postX, crestY, railZ(crestY)),
      V(postX, crestY, railZ(crestY)),
      0.105,
      0.082,
      0.105,
      0.082,
      wood,
    ),
  );
  const emblem = meshOf(new THREE.OctahedronGeometry(0.062, 0), cushionTrim, true, false);
  emblem.position.set(0, crestY, railZ(crestY) - 0.055);
  emblem.scale.set(1, 1.35, 0.45);
  group.add(emblem);

  /* ---- apoios de braço ----
     O suporte da frente desce agora até ao próprio assento e alinha em z com o
     braço. Antes o braço arrancava em backZ e o suporte estava 30 cm à frente,
     o que deixava um vão visível entre os dois. */
  [-1, 1].forEach((sx) => {
    const armFrontZ = frontZ + 0.04;
    const arm = block(
      V(sx * CHAIR.armX, CHAIR.armY - 0.015, backRestZ - 0.01),
      V(sx * CHAIR.armX, CHAIR.armY, armFrontZ),
      0.072,
      0.095,
      0.078,
      0.11,
      woodLight,
    );
    group.add(arm);

    // volta da frente, virada para baixo
    const scroll = block(
      V(sx * CHAIR.armX, CHAIR.armY - 0.005, armFrontZ),
      V(sx * CHAIR.armX, CHAIR.armY - 0.06, armFrontZ - 0.055),
      0.078,
      0.11,
      0.06,
      0.08,
      woodWorn,
    );
    group.add(scroll);

    // prumo da frente: do assento ao braço, no mesmo x e z
    const support = block(
      V(sx * CHAIR.armX, seatTopY - 0.02, armFrontZ + 0.005),
      V(sx * CHAIR.armX, CHAIR.armY - 0.035, armFrontZ + 0.002),
      0.062,
      0.07,
      0.058,
      0.066,
      wood,
    );
    group.add(support);
  });

  group.userData.cushion = cushion;
  group.userData.cushionTrim = cushionTrim;
  return group;
}

/** Pinta a almofada e o brasão da cadeira com as cores de quem a ocupa. */
export function tintChair(chair, characterId) {
  const profile = characterId ? PROFILES[characterId] : null;
  chair.userData.cushion?.color.set(profile ? profile.colors.cloth : EMPTY_CUSHION);
  chair.userData.cushionTrim?.color.set(profile ? profile.colors.trim : EMPTY_CUSHION_TRIM);
}

/* --------------------------------------------------------------------------
   Limpeza
   -------------------------------------------------------------------------- */

export function disposeObject(object) {
  object.traverse((child) => {
    if (child.geometry) child.geometry.dispose();
    if (child.material) {
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      materials.forEach((m) => m.dispose());
    }
  });
  if (object.parent) object.parent.remove(object);
}
