import * as THREE from "three";
import { material, mesh } from "./lobbyScenePrimitives.js";
import {
  canvasTexture,
  createCardTexture,
  createGameBoxTextures,
  createLinerTexture,
  createBannerTextures,
  createStoneTextures,
  createWoodTexture,
} from "./lobbySceneTextures.js";
import { SEAT_PHASE, V, ring, loft, limb, block, meshOf } from "./lobbyCharacters.js";
import { characterDetailTextures, TEXTURE_BASE_GAIN } from "./lobbyCharacterTextures.js";

export function addTableTopSeams(scene, radius, y, count, color) {
  for (let i = 0; i < count; i += 1) {
    const seam = mesh(new THREE.BoxGeometry(radius * 0.92, 0.012, 0.032), material(color, 1));
    seam.position.set(0, y, 0);
    seam.rotation.y = (Math.PI / count) * i;
    scene.add(seam);
  }
}

export function addCandle(scene, x, z, flames, options = {}) {
  const { tint = 0x8a6b43, height = 0.34, scale = 1 } = options;
  const group = new THREE.Group();
  group.position.set(x, 1.0, z);
  const metal = material(tint, 0.5, 0.38);

  const saucer = mesh(new THREE.CylinderGeometry(0.14 * scale, 0.17 * scale, 0.03 * scale, 12), metal);
  saucer.position.y = 0.016 * scale;
  group.add(saucer);
  const foot = mesh(new THREE.CylinderGeometry(0.07 * scale, 0.09 * scale, 0.05 * scale, 10), metal);
  foot.position.y = 0.05 * scale;
  group.add(foot);
  const stem = mesh(new THREE.CylinderGeometry(0.03 * scale, 0.05 * scale, 0.14 * scale, 8), metal);
  stem.position.y = 0.14 * scale;
  group.add(stem);
  const cup = mesh(new THREE.CylinderGeometry(0.06 * scale, 0.075 * scale, 0.05 * scale, 10), metal);
  cup.position.y = 0.225 * scale;
  group.add(cup);

  const wax = material(0xf0dcc0, 0.9);
  const candle = mesh(new THREE.CylinderGeometry(0.05 * scale, 0.06 * scale, height * scale, 10), wax);
  candle.position.y = (0.24 + height / 2) * scale;
  group.add(candle);
  const drip = mesh(new THREE.BoxGeometry(0.025 * scale, 0.08 * scale, 0.018 * scale), wax);
  drip.position.set(0.026 * scale, (0.21 + height * 0.45) * scale, 0);
  drip.rotation.z = -0.18;
  group.add(drip);

  const flameMat = new THREE.MeshBasicMaterial({ color: 0xffb04a, transparent: true, opacity: 0.96 });
  const flame = mesh(new THREE.ConeGeometry(0.045 * scale, 0.16 * scale, 7), flameMat, false, false);
  flame.position.y = (0.32 + height) * scale;
  group.add(flame);

  const light = new THREE.PointLight(0xff963d, 1.5, 3.2, 2);
  light.position.y = (0.35 + height) * scale;
  group.add(light);
  flames.push({ kind: "candle", flame, light, phase: Math.random() * Math.PI * 2 });
  scene.add(group);
}

export function addOpenGameBox(scene) {
  const g = new THREE.Group();
  // A norte da mesa, no vão entre os dois lugares de trás. Onde estava, ficava
  // à frente de um jogador e a colidir com a caneca dele.
  g.position.set(0, 1.202, -1.95);
  g.rotation.y = 0.06;
  const boxTextures = createGameBoxTextures();
  const linerTexture = createLinerTexture();
  const boxBase = new THREE.MeshStandardMaterial({ map: boxTextures.map, bumpMap: boxTextures.bumpMap, bumpScale: 0.045, color: 0xd1a37a, roughness: 0.82, metalness: 0 });
  const trim = material(0xb98a34, 0.34, 0.62);
  const darkTrim = material(0x3b3026, 0.42, 0.7);
  const liner = new THREE.MeshStandardMaterial({ map: linerTexture, color: 0xa55f58, roughness: 0.98, metalness: 0 });

  const base = mesh(new THREE.BoxGeometry(1.06, 0.09, 0.76), boxBase);
  g.add(base);
  [[0,0.145,-0.32,1.06,0.17,0.11],[0,0.145,0.32,1.06,0.17,0.11],[-0.475,0.145,0,0.11,0.17,0.54],[0.475,0.145,0,0.11,0.17,0.54]].forEach(([x,y,z,w,h,d])=>{
    const wall = mesh(new THREE.BoxGeometry(w,h,d), boxBase);
    wall.position.set(x,y,z);
    g.add(wall);
  });
  const inside = mesh(new THREE.BoxGeometry(0.84, 0.045, 0.52), liner);
  inside.position.set(0, 0.1, 0);
  g.add(inside);
  const lid = mesh(new THREE.BoxGeometry(1.02, 0.065, 0.74), boxBase);
  lid.position.set(-0.23, 0.27, -0.49);
  lid.rotation.x = -1.06;
  lid.rotation.z = 0.06;
  g.add(lid);
  const sigil = mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.012, 6), trim);
  sigil.rotation.x = Math.PI / 2;
  sigil.position.set(0.19, 0.035, 0.03);
  g.add(sigil);
  const latch = mesh(new THREE.BoxGeometry(0.08, 0.06, 0.02), trim);
  latch.position.set(0.52, 0.14, 0);
  g.add(latch);
  const storedOutlineA = mesh(new THREE.CylinderGeometry(0.182, 0.182, 0.018, 6), material(0x111111, 0.96));
  storedOutlineA.position.set(-0.2, 0.13, -0.08);
  storedOutlineA.rotation.y = 0.18;
  g.add(storedOutlineA);
  const storedTileA = mesh(new THREE.CylinderGeometry(0.164, 0.164, 0.032, 6), material(0x7a2cff, 0.74));
  storedTileA.position.set(-0.2, 0.155, -0.08);
  storedTileA.rotation.y = 0.18;
  g.add(storedTileA);
  const storedOutlineB = mesh(new THREE.CylinderGeometry(0.182, 0.182, 0.018, 6), material(0x111111, 0.96));
  storedOutlineB.position.set(0.18, 0.13, 0.12);
  storedOutlineB.rotation.y = -0.28;
  g.add(storedOutlineB);
  const storedTileB = mesh(new THREE.CylinderGeometry(0.164, 0.164, 0.032, 6), material(0x2f8d31, 0.74));
  storedTileB.position.set(0.18, 0.155, 0.12);
  storedTileB.rotation.y = -0.28;
  g.add(storedTileB);

  // Ferragens, dobradiças e rebites dão peso e construção à caixa.
  [[-0.49,-0.32],[0.49,-0.32],[-0.49,0.32],[0.49,0.32]].forEach(([x,z]) => {
    const corner = mesh(new THREE.BoxGeometry(0.085, 0.075, 0.085), darkTrim);
    corner.position.set(x, 0.075, z);
    g.add(corner);
    const rivet = mesh(new THREE.SphereGeometry(0.022, 7, 5), trim);
    rivet.position.set(x, 0.119, z);
    g.add(rivet);
  });
  [-0.28, 0.28].forEach((x) => {
    const hinge = mesh(new THREE.BoxGeometry(0.16, 0.045, 0.055), darkTrim);
    hinge.position.set(x, 0.205, -0.36);
    g.add(hinge);
  });
  const lidInset = mesh(new THREE.BoxGeometry(0.82, 0.018, 0.54), liner);
  lidInset.position.set(-0.23, 0.285, -0.47);
  lidInset.rotation.copy(lid.rotation);
  g.add(lidInset);
  scene.add(g);
}


export function addHexScatter(scene) {
  const topY = 1.192;
  const strongPurple = 0x7a2cff;
  const strongOrange = 0xe06c00;
  const strongYellow = 0xffdf1f;
  const darkGreen = 0x2f8d31;
  const aquaGreen = 0x33c889;
  const colors = [strongPurple, darkGreen, strongOrange, strongYellow, aquaGreen, strongPurple, strongOrange, darkGreen, strongYellow, aquaGreen];
  const stackStep = 0.052;
  const centralSpecs = [
    [-0.20, -0.05, 0.10, 0 * stackStep], [0.18, -0.01, -0.08, 0 * stackStep],
    [-0.02, -0.21, 0.24, 1 * stackStep], [-0.25, 0.12, 0.18, 1 * stackStep],
    [0.20, 0.16, -0.10, 1 * stackStep], [-0.14, 0.00, 0.02, 2 * stackStep],
    [0.23, 0.05, 0.36, 2 * stackStep], [0.00, 0.09, 0.18, 3 * stackStep],
    [0.11, -0.04, -0.18, 4 * stackStep], [0.03, 0.11, 0.12, 5 * stackStep],
  ];
  const looseSpecs = [
    [-0.52, -0.06, 0.16],
    [-0.42, -0.34, -0.12],
    [-0.34, 0.34, 0.08],
    [-0.08, -0.42, 0.24],
    [0.26, -0.36, -0.18],
    [0.46, -0.12, 0.1],
    [0.44, 0.24, -0.08],
    [0.18, 0.42, 0.28],
  ];
  const addHex = (x, z, rot, lift, color) => {
    const outline = mesh(new THREE.CylinderGeometry(0.182, 0.182, 0.018, 6), material(0x111111, 0.96));
    outline.position.set(x, topY + 0.009 + lift, z);
    outline.rotation.y = rot;
    scene.add(outline);
    const tile = mesh(new THREE.CylinderGeometry(0.164, 0.164, 0.032, 6), material(color, 0.74));
    tile.position.set(x, topY + 0.034 + lift, z);
    tile.rotation.y = rot;
    scene.add(tile);
  };
  centralSpecs.forEach(([x,z,rot,lift], i) => addHex(x, z, rot, lift, colors[i % colors.length]));
  looseSpecs.forEach(([x,z,rot], i) => addHex(x, z, rot, 0, colors[(i + 2) % colors.length]));
}


export function addDice(scene) {
  const dieMat = new THREE.MeshStandardMaterial({ color: 0xf5f2ea, roughness: 0.72, metalness: 0 });
  const pipMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9, metalness: 0 });

  const addDie = (x, y, z, rotation, visibleFaces) => {
    const group = new THREE.Group();
    group.position.set(x, y, z);
    group.rotation.set(rotation[0], rotation[1], rotation[2]);
    const cube = mesh(new THREE.BoxGeometry(0.11, 0.11, 0.11), dieMat);
    group.add(cube);

    const pipPatterns = {
      1: [[0, 0]],
      2: [[-0.02, -0.02], [0.02, 0.02]],
      3: [[-0.022, -0.022], [0, 0], [0.022, 0.022]],
      4: [[-0.022, -0.022], [0.022, -0.022], [-0.022, 0.022], [0.022, 0.022]],
      5: [[-0.022, -0.022], [0.022, -0.022], [0, 0], [-0.022, 0.022], [0.022, 0.022]],
      6: [[-0.022, -0.028], [0.022, -0.028], [-0.022, 0], [0.022, 0], [-0.022, 0.028], [0.022, 0.028]],
    };
    const addFace = (value, pos, rotAxis) => {
      pipPatterns[value].forEach(([a, b]) => {
        const pip = mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.006, 10), pipMat);
        pip.position.set(pos[0] + a, pos[1] + b, pos[2]);
        pip.rotation.set(rotAxis[0], rotAxis[1], rotAxis[2]);
        group.add(pip);
      });
    };
    addFace(visibleFaces.top, [0, 0, 0.056], [Math.PI / 2, 0, 0]);
    addFace(visibleFaces.front, [0, 0.056, 0], [0, 0, 0]);
    addFace(visibleFaces.right, [0.056, 0, 0], [0, Math.PI / 2, 0]);
    scene.add(group);
  };

  addDie(0.8, 1.24, -0.18, [0.2, 0.35, 0.1], { top: 4, front: 2, right: 5 });
  addDie(1.02, 1.24, 0.04, [0.16, -0.42, -0.08], { top: 3, front: 1, right: 6 });
}


export function addTankard(scene, x, z, options = {}) {
  const { liquid = 0x70421f, rotation = 0 } = options;
  const group = new THREE.Group();
  group.position.set(x, 1.19, z);
  group.rotation.y = rotation;

  const wood = material(0x5c3821, 0.82);
  const metal = material(0x78706a, 0.42, 0.42);
  const inner = material(0x2a140a, 0.92);
  const drink = new THREE.MeshStandardMaterial({
    color: liquid,
    roughness: 0.12,
    metalness: 0.05,
    transparent: true,
    opacity: 0.82,
  });

  const body = mesh(new THREE.CylinderGeometry(0.13, 0.145, 0.24, 10, 1, true), wood);
  body.position.y = 0.13;
  group.add(body);

  const cavityMaterial = inner.clone();
  cavityMaterial.side = THREE.DoubleSide;
  const cavity = mesh(new THREE.CylinderGeometry(0.104, 0.116, 0.205, 10, 1, true), cavityMaterial);
  cavity.position.y = 0.132;
  group.add(cavity);

  const bandTop = mesh(new THREE.TorusGeometry(0.132, 0.014, 6, 12), metal);
  bandTop.rotation.x = Math.PI / 2;
  bandTop.position.y = 0.225;
  group.add(bandTop);

  const bandMid = mesh(new THREE.TorusGeometry(0.138, 0.014, 6, 12), metal);
  bandMid.rotation.x = Math.PI / 2;
  bandMid.position.y = 0.11;
  group.add(bandMid);

  const base = mesh(new THREE.CylinderGeometry(0.112, 0.125, 0.03, 10), metal);
  base.position.y = 0.01;
  group.add(base);

  const handleOuter = mesh(new THREE.TorusGeometry(0.074, 0.016, 8, 18, Math.PI * 1.9), metal);
  handleOuter.position.set(0.15, 0.14, 0);
  handleOuter.rotation.z = Math.PI / 2;
  group.add(handleOuter);
  const handleBar = mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.13, 8), metal);
  handleBar.position.set(0.21, 0.14, 0);
  handleBar.rotation.z = Math.PI / 2;
  group.add(handleBar);
  const joinTop = mesh(new THREE.BoxGeometry(0.022, 0.028, 0.024), metal);
  joinTop.position.set(0.145, 0.205, 0);
  group.add(joinTop);
  const joinBottom = mesh(new THREE.BoxGeometry(0.022, 0.028, 0.024), metal);
  joinBottom.position.set(0.145, 0.075, 0);
  group.add(joinBottom);

  const liquidSurface = new THREE.Mesh(new THREE.CircleGeometry(0.091, 20), drink);
  liquidSurface.rotation.x = -Math.PI / 2;
  liquidSurface.position.y = 0.222;
  liquidSurface.receiveShadow = false;
  liquidSurface.castShadow = false;
  group.add(liquidSurface);

  // ripas, rebites e espuma ajudam a leitura do material à distância
  for (let i = 0; i < 8; i += 1) {
    const angle = (i / 8) * Math.PI * 2;
    const stave = mesh(new THREE.BoxGeometry(0.012, 0.205, 0.018), material(0x2d190f, 0.88));
    stave.position.set(Math.cos(angle) * 0.126, 0.13, Math.sin(angle) * 0.126);
    stave.rotation.y = -angle;
    group.add(stave);
  }
  [0.11, 0.225].forEach((y) => {
    for (let i = 0; i < 4; i += 1) {
      const angle = (i / 4) * Math.PI * 2;
      const rivet = mesh(new THREE.SphereGeometry(0.012, 7, 5), metal);
      rivet.position.set(Math.cos(angle) * 0.139, y, Math.sin(angle) * 0.139);
      group.add(rivet);
    }
  });
  const foam = new THREE.Mesh(new THREE.RingGeometry(0.067, 0.09, 18), material(0xd8c39a, 0.9));
  foam.rotation.x = -Math.PI / 2;
  foam.position.y = 0.224;
  group.add(foam);

  scene.add(group);
}

export function addCoinScatter(scene, centerX, centerZ, pattern = []) {
  const coinMat = material(0xc49335, 0.46, 0.34);
  pattern.forEach(([dx, dz, dy, rot]) => {
    const coin = mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.014, 14), coinMat);
    coin.position.set(centerX + dx, 1.197 + dy, centerZ + dz);
    coin.rotation.y = rot;
    scene.add(coin);
    const stamp = mesh(new THREE.TorusGeometry(0.031, 0.004, 5, 12), material(0xe0b65b, 0.38, 0.42));
    stamp.position.set(centerX + dx, 1.205 + dy, centerZ + dz);
    stamp.rotation.x = Math.PI / 2;
    stamp.rotation.z = rot;
    scene.add(stamp);
  });
}

export function addPlayerProps(scene) {
  const tableTop = 1.19;
  // Canecas, cartas e moedas pertencem aos lugares, por isso vivem num grupo
  // que roda com o anel de cadeiras em vez de estarem fixos aos eixos.
  const props = new THREE.Group();
  props.rotation.y = SEAT_PHASE;
  scene.add(props);
  const cardTex = createCardTexture();
  const cardMat = new THREE.MeshStandardMaterial({ map: cardTex, roughness: 0.92, metalness: 0 });

  const westCards = new THREE.Group();
  westCards.position.set(-2.1, tableTop, 1.18);
  westCards.rotation.y = 0.32;
  for (let i = 0; i < 2; i += 1) {
    const card = mesh(new THREE.BoxGeometry(0.34, 0.012, 0.5), cardMat);
    card.position.set(i * 0.045, 0.008 * i, -i * 0.03);
    card.rotation.y = -0.08 + i * 0.07;
    westCards.add(card);
  }
  props.add(westCards);

  const northNote = mesh(new THREE.BoxGeometry(0.34, 0.012, 0.42), cardMat);
  northNote.position.set(1.55, tableTop + 0.006, -0.5);
  northNote.rotation.y = -0.38;
  props.add(northNote);

  addTankard(props, 0.02, 1.78, { liquid: 0x5f8fbe, rotation: 1.18 });
  addTankard(props, -0.12, -1.62, { liquid: 0x6ea1d6, rotation: -1.08 });
  addTankard(props, -2.04, 0.42, { liquid: 0x5f8fbe, rotation: 0.98 });
  addTankard(props, 1.98, 0.16, { liquid: 0x6ea1d6, rotation: -0.92 });

  addCoinScatter(props, -1.48, 1.42, [
    [-0.1, 0.02, 0.0, 0.02], [0.0, -0.02, 0.002, 0.18], [0.12, 0.04, 0.004, -0.08], [0.22, 0.01, 0.001, 0.26]
  ]);
  addCoinScatter(props, -0.08, -1.34, [
    [-0.14, 0.02, 0.001, 0.16], [-0.02, -0.03, 0.003, -0.06], [0.1, 0.05, 0.0, 0.22], [0.2, -0.02, 0.002, -0.18]
  ]);
  addCoinScatter(props, -1.9, -0.22, [
    [-0.08, 0.08, 0.002, 0.12], [0.04, -0.02, 0.0, -0.16], [0.16, 0.04, 0.003, 0.08]
  ]);
  addCoinScatter(props, 1.58, 0.48, [
    [-0.12, 0.06, 0.001, 0.12], [0.0, 0.0, 0.002, -0.04], [0.12, -0.04, 0.0, 0.18]
  ]);
}


export function addPlayerZoneMarkers(scene) {}


/**
 * Beam ramificado, para hastes e presas.
 *
 * Um chifre de veado não é um cilindro a prumo: é uma haste que curva para fora
 * e para a frente, com pontas a sair dela em ângulos diferentes. A versão
 * anterior eram seis `CylinderGeometry` rectos apontados ao céu, e é por isso
 * que liam como um punhado de palitos. Aqui a haste é percorrida em segmentos,
 * com a direcção a rodar a cada passo, e as pontas nascem de pontos ao longo
 * dela.
 */
function growBeam(group, origin, dir, opts) {
  const {
    length,
    segments = 5,
    rFrom,
    rTo,
    curve = V(0, 0, 0),
    material: mat,
    tines = [],
  } = opts;

  const step = length / segments;
  let point = origin.clone();
  let heading = dir.clone().normalize();
  const spine = [point.clone()];

  for (let i = 0; i < segments; i += 1) {
    heading.add(curve.clone().multiplyScalar(1 / segments)).normalize();
    const next = point.clone().addScaledVector(heading, step);
    const t0 = i / segments;
    const t1 = (i + 1) / segments;
    group.add(
      limb(
        point,
        next,
        rFrom + (rTo - rFrom) * t0,
        rFrom + (rTo - rFrom) * t1,
        mat,
        5,
      ),
    );
    point = next;
    spine.push(point.clone());
  }

  // Ponta final afilada.
  group.add(
    meshOf(
      new THREE.ConeGeometry(rTo * 1.15, rTo * 4.2, 5),
      mat,
      true,
      false,
    ),
  );
  const tip = group.children[group.children.length - 1];
  tip.position.copy(point).addScaledVector(heading, rTo * 2.1);
  tip.quaternion.setFromUnitVectors(V(0, 1, 0), heading);

  // Pontas laterais, cada uma a nascer de uma fracção da haste.
  tines.forEach(({ at, dir: tineDir, length: tineLen, radius }) => {
    const idx = Math.min(spine.length - 1, Math.max(0, Math.round(at * segments)));
    const base = spine[idx];
    const d = tineDir.clone().normalize();
    const end = base.clone().addScaledVector(d, tineLen);
    group.add(limb(base, end, radius, radius * 0.45, mat, 5));
    const capGeom = new THREE.ConeGeometry(radius * 0.5, radius * 3, 5);
    const cap = meshOf(capGeom, mat, true, false);
    cap.position.copy(end).addScaledVector(d, radius * 1.4);
    cap.quaternion.setFromUnitVectors(V(0, 1, 0), d);
    group.add(cap);
  });
}

/**
 * Interpola o perfil de um crânio num ponto ao longo do eixo.
 *
 * Existe para os olhos não serem colocados a olho. Escrevi as duas cabeças com
 * os olhos em coordenadas fixas e no javali o bordo exterior do olho ficou 2.6 cm
 * DENTRO do crânio, portanto simplesmente não havia olhos; no veado ficou 3 mm
 * de fora e via-se um pontinho. Perguntar ao perfil qual é o raio naquele ponto
 * resolve os dois casos e não volta a partir quando as proporções mudarem.
 */
function profileAt(spec, t) {
  if (t <= spec[0][0]) return { rx: spec[0][1], ry: spec[0][2], drop: spec[0][3] ?? 0 };
  const last = spec[spec.length - 1];
  if (t >= last[0]) return { rx: last[1], ry: last[2], drop: last[3] ?? 0 };
  for (let i = 0; i < spec.length - 1; i += 1) {
    const a = spec[i];
    const b = spec[i + 1];
    if (t >= a[0] && t <= b[0]) {
      const k = (t - a[0]) / (b[0] - a[0] || 1);
      return {
        rx: a[1] + (b[1] - a[1]) * k,
        ry: a[2] + (b[2] - a[2]) * k,
        drop: (a[3] ?? 0) + ((b[3] ?? 0) - (a[3] ?? 0)) * k,
      };
    }
  }
  return { rx: last[1], ry: last[2], drop: last[3] ?? 0 };
}

/**
 * Par de olhos assente na superfície do crânio.
 *
 * `at` é a posição ao longo do eixo da cabeça, em coordenadas do perfil. O olho
 * é encostado ao raio local e empurrado para fora o suficiente para a esfera
 * sobressair, mais um brilho deslocado para cima e para fora.
 */
function addTrophyEyes(mount, spec, headOffset, at, size, materials) {
  const { rx, drop } = profileAt(spec, at);
  const z = headOffset.z + at;
  const y = headOffset.y - drop;
  [-1, 1].forEach((side) => {
    const eye = meshOf(new THREE.SphereGeometry(size, 7, 6), materials.dark, true, false);
    eye.scale.set(0.55, 1, 1.15);
    // 0.86 do raio: o centro fica dentro da carne e a esfera rompe a superfície,
    // que é o que dá a pálpebra sem ter de a modelar.
    eye.position.set(side * (rx * 0.86 + size * 0.5), y + size * 0.5, z);
    mount.add(eye);

    const glint = meshOf(new THREE.BoxGeometry(size * 0.34, size * 0.38, size * 0.24), materials.glint, false, false);
    glint.position.set(side * (rx * 0.86 + size * 0.95), y + size * 1.05, z + size * 0.5);
    mount.add(glint);
  });
}

/** Roda um mesh construído ao longo de +Y para ficar ao longo de +Z. */
function layDown(object) {
  object.rotation.x = Math.PI / 2;
  return object;
}

/**
 * Cabeça de troféu montada na parede.
 *
 * A versão anterior era feita de `SphereGeometry` com 10 por 10 segmentos e
 * shading suave, num cenário em que tudo o resto é facetado e flat shaded: as
 * cabeças liam como bolas de plasticina pregadas a uma tábua. Agora são lofts
 * com perfil próprio, flat shading, textura de pêlo e olhos com brilho.
 */
export function addWallTrophy(scene, x, y, z, type = "deer", options = {}) {
  const group = new THREE.Group();
  group.position.set(x, y, z);

  const detail = characterDetailTextures();
  const withDetail = (colour, roughness, metalness, family, bumpScale = 0.006) => {
    const m = material(colour, roughness, metalness);
    m.flatShading = true;
    const fam = family ? detail?.[family] : null;
    if (fam) {
      m.map = fam.map;
      m.bumpMap = fam.bumpMap;
      m.bumpScale = bumpScale;
      const peak = Math.max(m.color.r, m.color.g, m.color.b);
      m.color.multiplyScalar(Math.min(TEXTURE_BASE_GAIN, peak > 0 ? 1 / peak : 1));
    }
    return m;
  };

  /* A placa passa a usar a textura de madeira que já existe no projecto. Era o
     único móvel de parede em cor sólida, exactamente como as cadeiras estavam. */
  const woodTextures = options.woodTextures ?? createWoodTexture();
  const plaqueWood = material(0x8a6a4e, 0.86, 0.04);
  plaqueWood.flatShading = true;
  plaqueWood.map = woodTextures.map;
  plaqueWood.bumpMap = woodTextures.bumpMap;
  plaqueWood.roughnessMap = woodTextures.roughnessMap;
  plaqueWood.bumpScale = 0.004;
  const plaqueTrim = withDetail(0x2b160d, 0.9, 0.06, "leather", 0.004);
  const boneMat = withDetail(0xcbbb9e, 0.8, 0.02, "bone", 0.005);
  const eyeDark = material(0x14100f, 0.5, 0.1);
  const glintMat = material(0xf2f6ff, 0.3, 0.1);

  /* ---- placa em forma de escudo ----
     Era uma caixa de 0.78 por 0.94 com duas barras escuras coladas. Uma placa
     de troféu é um brasão: ombros largos em cima, ponta em baixo, e bisel a
     contornar. */
  const shieldRings = [
    [-0.52, 0.16, 0.055],
    [-0.4, 0.29, 0.06],
    [-0.22, 0.36, 0.065],
    [0.0, 0.395, 0.07],
    [0.24, 0.4, 0.07],
    [0.4, 0.37, 0.065],
    [0.49, 0.28, 0.055],
  ];
  const plaqueProfile = (depth, inset) => shieldRings.map(([py, px]) => {
    const half = px * inset;
    return ring(V(0, py, depth), half, 0.055, 8, { squareness: 0.55 });
  });
  const plaqueBody = meshOf(loft(plaqueProfile(0, 1), { capStart: true, capEnd: true, jitter: 0.02, seed: 7 }), plaqueWood);
  group.add(plaqueBody);
  const plaqueBevel = meshOf(loft(plaqueProfile(-0.028, 1.09), { capStart: true, capEnd: true }), plaqueTrim);
  group.add(plaqueBevel);

  // Chapa gravada em baixo, onde num troféu real vai a inscrição.
  const nameplate = meshOf(new THREE.BoxGeometry(0.3, 0.085, 0.03), withDetail(0x8b6a32, 0.5, 0.5, "metal", 0.002));
  nameplate.position.set(0, -0.36, 0.075);
  group.add(nameplate);

  const mount = new THREE.Group();
  group.add(mount);

  if (type === "deer") {
    const fur = withDetail(0x7a5232, 0.86, 0, "hair", 0.008);
    const furPale = withDetail(0xc5a781, 0.86, 0, "hair", 0.008);
    const antlerMat = boneMat;
    const noseMat = withDetail(0x211917, 0.72, 0, "leather", 0.005);

    /* Crânio: perfil próprio, de pescoço largo a focinho estreito, com a testa
       a subir e a cana do nariz a descer. Rings em XZ empilhados em Y e depois
       deitados, porque é assim que o `loft` trabalha. */
    const skullSpec = [
      [0.0, 0.2, 0.19, 0],
      [0.16, 0.185, 0.2, 0.01],
      [0.34, 0.155, 0.185, 0.0],
      [0.5, 0.115, 0.15, -0.015],
      [0.62, 0.082, 0.115, -0.035],
      [0.73, 0.068, 0.095, -0.048],
      [0.82, 0.062, 0.082, -0.054],
    ];
    const skull = skullSpec.map(([t, rx, ry, drop]) => ring(V(0, t, drop), rx, ry, 9, { squareness: 0.34 }));
    const headMesh = meshOf(loft(skull, { capStart: true, capEnd: true, jitter: 0.05, seed: 21 }), fur);
    layDown(headMesh);
    headMesh.position.set(0, 0.03, 0.08);
    mount.add(headMesh);

    // Pescoço a alargar para a placa, para a cabeça não nascer no ar.
    const neck = [
      [0.0, 0.245, 0.235],
      [0.1, 0.225, 0.215],
      [0.2, 0.205, 0.195],
    ].map(([t, rx, ry]) => ring(V(0, t, 0), rx, ry, 9, { squareness: 0.34 }));
    const neckMesh = meshOf(loft(neck, { capStart: true }), fur);
    layDown(neckMesh);
    neckMesh.position.set(0, 0.0, 0.02);
    mount.add(neckMesh);

    // Chanfro claro no nariz, que é o que dá leitura de veado à distância.
    const blaze = [
      [0.0, 0.06, 0.05],
      [0.1, 0.062, 0.052],
      [0.18, 0.058, 0.048],
    ].map(([t, rx, ry]) => ring(V(0, t, -0.052), rx, ry, 8, { squareness: 0.4 }));
    const blazeMesh = meshOf(loft(blaze, { capEnd: true }), furPale);
    layDown(blazeMesh);
    blazeMesh.position.set(0, 0.03, 0.78);
    mount.add(blazeMesh);

    const nose = meshOf(
      loft(
        [
          ring(V(0, 0, 0), 0.055, 0.042, 8, { squareness: 0.45 }),
          ring(V(0, 0.03, -0.006), 0.058, 0.045, 8, { squareness: 0.45 }),
          ring(V(0, 0.055, -0.012), 0.04, 0.032, 8, { squareness: 0.45 }),
        ],
        { capEnd: true },
      ),
      noseMat,
    );
    layDown(nose);
    nose.position.set(0, -0.026, 0.86);
    mount.add(nose);

    [-1, 1].forEach((side) => {
      /* Orelha em folha: larga, virada para fora e para trás. Era um cone de
         0.06 de raio, praticamente invisível. */
      const ear = meshOf(
        loft(
          [
            ring(V(0, 0, 0), 0.035, 0.03, 7, { squareness: 0.4 }),
            ring(V(0, 0.06, 0.01), 0.075, 0.045, 7, { squareness: 0.4 }),
            ring(V(0, 0.14, 0.015), 0.085, 0.05, 7, { squareness: 0.4 }),
            ring(V(0, 0.22, 0.01), 0.055, 0.035, 7, { squareness: 0.4 }),
            ring(V(0, 0.27, 0), 0.016, 0.014, 7, { squareness: 0.4 }),
          ],
          { capStart: true, capEnd: true },
        ),
        fur,
      );
      ear.position.set(side * 0.17, 0.09, 0.24);
      ear.rotation.z = side * -0.85;
      ear.rotation.x = -0.5;
      mount.add(ear);

      // Haste curva com três pontas, em vez de três cilindros a prumo.
      const antler = new THREE.Group();
      growBeam(antler, V(side * 0.11, 0.14, 0.2), V(side * 0.42, 0.88, 0.18), {
        length: 0.52,
        segments: 5,
        rFrom: 0.026,
        rTo: 0.011,
        curve: V(side * 0.5, -0.35, 0.55),
        material: antlerMat,
        /* Cinco pontas, todas viradas para cima e para a frente, com
           comprimentos desiguais. Com três pontas curtas a haste lia como corno
           de cabra; o que faz um chifre de veado é a quantidade de pontas a sair
           do mesmo lado da haste. */
        tines: [
          { at: 0.15, dir: V(side * 0.1, 0.5, 0.86), length: 0.15, radius: 0.017 },
          { at: 0.38, dir: V(side * 0.22, 0.78, 0.58), length: 0.21, radius: 0.016 },
          { at: 0.58, dir: V(side * 0.42, 0.82, 0.38), length: 0.24, radius: 0.014 },
          { at: 0.78, dir: V(side * 0.6, 0.76, 0.24), length: 0.19, radius: 0.012 },
          { at: 0.92, dir: V(side * 0.78, 0.6, 0.1), length: 0.13, radius: 0.01 },
        ],
      });
      mount.add(antler);
    });

    // Olhos nos lados do crânio, como num herbívoro.
    addTrophyEyes(mount, skullSpec, V(0, 0.03, 0.08), 0.27, 0.044, { dark: eyeDark, glint: glintMat });
  } else {
    const hide = withDetail(0x4b3729, 0.9, 0, "hair", 0.009);
    const snoutMat = withDetail(0x6f5744, 0.86, 0, "leather", 0.006);
    const noseMat = withDetail(0x2a1d18, 0.7, 0, "leather", 0.005);
    const bristleMat = withDetail(0x2e2119, 0.94, 0, "hair", 0.01);

    /* Crânio em cunha: testa alta e larga, a estreitar para o disco do nariz.
       É o oposto do veado e é o que separa as duas silhuetas de relance. */
    const skullSpec = [
      [0.0, 0.235, 0.215, 0],
      [0.14, 0.235, 0.225, 0.015],
      [0.3, 0.205, 0.205, 0.01],
      [0.46, 0.16, 0.16, -0.01],
      [0.62, 0.13, 0.125, -0.03],
      [0.78, 0.115, 0.105, -0.05],
      [0.88, 0.11, 0.1, -0.06],
    ];
    const skull = skullSpec.map(([t, rx, ry, drop]) => ring(V(0, t, drop), rx, ry, 9, { squareness: 0.45 }));
    const headMesh = meshOf(loft(skull, { capStart: true, capEnd: true, jitter: 0.055, seed: 33 }), hide);
    layDown(headMesh);
    headMesh.position.set(0, 0.02, 0.06);
    mount.add(headMesh);

    const snout = [
      [0.0, 0.108, 0.098],
      [0.08, 0.1, 0.09],
      [0.14, 0.105, 0.092],
    ].map(([t, rx, ry]) => ring(V(0, t, -0.02), rx, ry, 8, { squareness: 0.5 }));
    const snoutMesh = meshOf(loft(snout, { capStart: true }), snoutMat);
    layDown(snoutMesh);
    snoutMesh.position.set(0, -0.04, 0.82);
    mount.add(snoutMesh);

    // Disco do nariz, com duas narinas afundadas.
    const disc = meshOf(new THREE.CylinderGeometry(0.1, 0.095, 0.028, 8), noseMat);
    layDown(disc);
    disc.position.set(0, -0.058, 0.965);
    mount.add(disc);
    [-1, 1].forEach((side) => {
      const nostril = meshOf(new THREE.SphereGeometry(0.022, 6, 5), material(0x120c0a, 0.8, 0), false, false);
      nostril.scale.set(0.8, 1.1, 0.5);
      nostril.position.set(side * 0.042, -0.058, 0.978);
      mount.add(nostril);
    });

    [-1, 1].forEach((side) => {
      const ear = meshOf(
        loft(
          [
            ring(V(0, 0, 0), 0.032, 0.028, 6, { squareness: 0.45 }),
            ring(V(0, 0.05, 0.008), 0.058, 0.038, 6, { squareness: 0.45 }),
            ring(V(0, 0.11, 0.006), 0.042, 0.028, 6, { squareness: 0.45 }),
            ring(V(0, 0.15, 0), 0.014, 0.012, 6, { squareness: 0.45 }),
          ],
          { capStart: true, capEnd: true },
        ),
        hide,
      );
      ear.position.set(side * 0.185, 0.13, 0.2);
      ear.rotation.z = side * -0.5;
      ear.rotation.x = -0.75;
      mount.add(ear);

      /* Presa curva a subir da mandíbula. Eram dois cilindros rectos deitados
         de lado, que de frente leem como um bigode. */
      const tusk = new THREE.Group();
      growBeam(tusk, V(side * 0.085, -0.085, 0.78), V(side * 0.3, 0.5, 0.8), {
        length: 0.19,
        segments: 4,
        rFrom: 0.024,
        rTo: 0.008,
        curve: V(side * 0.9, 0.9, -1.5),
        material: boneMat,
      });
      mount.add(tusk);

      // Presa inferior menor, colada à mandíbula.
      const lower = new THREE.Group();
      growBeam(lower, V(side * 0.1, -0.105, 0.66), V(side * 0.25, 0.2, 0.94), {
        length: 0.1,
        segments: 3,
        rFrom: 0.017,
        rTo: 0.007,
        curve: V(side * 0.5, 1.1, -0.8),
        material: boneMat,
      });
      mount.add(lower);
    });

    // Crista de pêlo eriçado ao longo do topo do crânio.
    [0.0, 0.12, 0.25, 0.38].forEach((t, i) => {
      const bristle = meshOf(new THREE.ConeGeometry(0.034 - i * 0.004, 0.16 + (i % 2) * 0.06, 4), bristleMat, true, false);
      bristle.position.set((i % 2 === 0 ? 1 : -1) * 0.024, 0.24 - t * 0.12, 0.08 + t);
      bristle.rotation.x = -0.5 - t * 0.4;
      mount.add(bristle);
    });

    /* Olhos do javali: pequenos e recuados no crânio, que é como são. Antes
       estavam num x fixo de 0.165 quando o crânio nesse ponto tem 0.211 de raio,
       portanto ficavam completamente enterrados. */
    addTrophyEyes(mount, skullSpec, V(0, 0.02, 0.06), 0.3, 0.032, { dark: eyeDark, glint: glintMat });

    // Sobrancelha em relevo sobre cada olho, para o olho não ler como um buraco.
    [-1, 1].forEach((side) => {
      const brow = block(
        V(side * 0.13, 0.115, 0.28),
        V(side * 0.215, 0.085, 0.35),
        0.055,
        0.05,
        0.04,
        0.04,
        hide,
      );
      mount.add(brow);
    });
  }

  scene.add(group);
}


export function addWallTorch(scene, x, y, z, flames, options = {}) {
  const { rotationY = 0 } = options;
  const group = new THREE.Group();
  group.position.set(x, y, z);
  group.rotation.y = rotationY;

  const darkMetal = material(0x3d2b22, 0.56, 0.36);
  const warmMetal = material(0x8d6530, 0.42, 0.56);
  const wax = material(0xf1dfca, 0.92, 0);

  const backplate = mesh(new THREE.BoxGeometry(0.2, 0.62, 0.08), darkMetal);
  backplate.position.set(0, 0.0, -0.01);
  group.add(backplate);

  const topCap = mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.1, 6), warmMetal);
  topCap.position.set(0, 0.29, 0.0);
  group.add(topCap);

  const lowerFinial = mesh(new THREE.ConeGeometry(0.06, 0.14, 6), warmMetal);
  lowerFinial.position.set(0, -0.36, 0.0);
  group.add(lowerFinial);

  const arm = mesh(new THREE.CylinderGeometry(0.032, 0.038, 0.44, 8), darkMetal);
  arm.rotation.x = Math.PI / 2;
  arm.position.set(0, -0.02, 0.23);
  group.add(arm);

  const strut = mesh(new THREE.CylinderGeometry(0.022, 0.028, 0.34, 8), darkMetal);
  strut.position.set(0, -0.11, 0.14);
  strut.rotation.x = Math.PI / 2.55;
  group.add(strut);

  const holder = mesh(new THREE.CylinderGeometry(0.075, 0.06, 0.11, 8), warmMetal);
  holder.position.set(0, 0.03, 0.41);
  group.add(holder);

  const saucer = mesh(new THREE.CylinderGeometry(0.15, 0.18, 0.028, 10), warmMetal);
  saucer.position.set(0, -0.03, 0.42);
  group.add(saucer);

  const candle = mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.36, 10), wax);
  candle.position.set(0, 0.24, 0.42);
  group.add(candle);

  const dripA = mesh(new THREE.BoxGeometry(0.022, 0.08, 0.016), wax);
  dripA.position.set(0.025, 0.18, 0.445);
  dripA.rotation.z = -0.18;
  group.add(dripA);

  const dripB = mesh(new THREE.BoxGeometry(0.018, 0.055, 0.014), wax);
  dripB.position.set(-0.022, 0.12, 0.445);
  dripB.rotation.z = 0.12;
  group.add(dripB);

  const flame = mesh(
    new THREE.ConeGeometry(0.095, 0.33, 7),
    new THREE.MeshBasicMaterial({ color: 0xff8a2e, transparent: true, opacity: 0.96 }),
    false,
    false,
  );
  flame.position.set(0, 0.58, 0.42);
  group.add(flame);

  const ember = mesh(
    new THREE.ConeGeometry(0.05, 0.18, 6),
    new THREE.MeshBasicMaterial({ color: 0xffd16e, transparent: true, opacity: 0.82 }),
    false,
    false,
  );
  ember.position.set(0, 0.54, 0.425);
  group.add(ember);

  const light = new THREE.PointLight(0xff7c2f, 1.7, 5.3, 2);
  light.position.set(0, 0.48, 0.62);
  group.add(light);

  flames.push({ kind: "torch", flame, light, phase: Math.random() * Math.PI * 2 });
  scene.add(group);
}

export function addFireplace(scene, flames, options = {}) {
  // Lareira integrada na parede direita: pedra irregular, fuligem, grelha,
  // lenha carbonizada e um halo quente que assenta no chão e na parede.
  const fireplace = new THREE.Group();
  fireplace.position.set(6.72, 0, -1.35);
  fireplace.rotation.y = -Math.PI / 2;

  const stoneTex = createStoneTextures("wall");
  stoneTex.map.repeat.set(1.1, 0.9);
  stoneTex.bumpMap.repeat.set(1.1, 0.9);
  stoneTex.roughnessMap.repeat.set(1.1, 0.9);
  const stone = new THREE.MeshStandardMaterial({
    map: stoneTex.map,
    bumpMap: stoneTex.bumpMap,
    roughnessMap: stoneTex.roughnessMap,
    bumpScale: 0.085,
    color: 0x6b5b4d,
    roughness: 0.98,
    metalness: 0,
  });
  const darkStone = stone.clone();
  darkStone.color = new THREE.Color(0x3a302a);

  const body = mesh(new THREE.BoxGeometry(3.35, 2.75, 0.58), stone);
  body.position.set(0, 1.37, -0.02);
  fireplace.add(body);

  const opening = mesh(new THREE.BoxGeometry(1.86, 1.42, 0.22), material(0x070504, 1));
  opening.position.set(0, 0.92, 0.32);
  fireplace.add(opening);

  // Moldura em blocos salientes, para quebrar a caixa demasiado geométrica.
  const blockPositions = [
    [-1.12, 0.52, 0.38, 0.48, 0.58], [-1.12, 1.08, 0.38, 0.48, 0.58],
    [-1.12, 1.64, 0.38, 0.48, 0.58], [1.12, 0.52, 0.38, 0.48, 0.58],
    [1.12, 1.08, 0.38, 0.48, 0.58], [1.12, 1.64, 0.38, 0.48, 0.58],
    [-0.72, 1.98, 0.38, 0.62, 0.42], [0, 2.08, 0.38, 0.78, 0.42],
    [0.72, 1.98, 0.38, 0.62, 0.42],
  ];
  blockPositions.forEach(([x, y, z, w, h], i) => {
    const block = mesh(new THREE.BoxGeometry(w, h, 0.48), i % 3 === 0 ? darkStone : stone);
    block.position.set(x, y, z);
    block.rotation.z = ((i % 3) - 1) * 0.018;
    fireplace.add(block);
  });

  const hearth = mesh(new THREE.BoxGeometry(3.65, 0.18, 1.16), darkStone);
  hearth.position.set(0, 0.09, 0.38);
  fireplace.add(hearth);

  const mantelWood = options.woodTextures ?? createWoodTexture();
  const mantelMat = new THREE.MeshStandardMaterial({
    map: mantelWood.map,
    bumpMap: mantelWood.bumpMap,
    roughnessMap: mantelWood.roughnessMap,
    bumpScale: 0.055,
    color: 0x4b3224,
    roughness: 0.82,
  });
  const mantel = mesh(new THREE.BoxGeometry(3.75, 0.24, 0.82), mantelMat);
  mantel.position.set(0, 2.58, 0.19);
  fireplace.add(mantel);

  // Mancha de fuligem acima da abertura, subtil e translúcida.
  const sootTex = canvasTexture(256, 256, (ctx, w, h) => {
    const grad = ctx.createRadialGradient(w / 2, h * 0.85, 4, w / 2, h * 0.55, w * 0.48);
    grad.addColorStop(0, "rgba(20,14,11,0.58)");
    grad.addColorStop(0.5, "rgba(28,20,15,0.26)");
    grad.addColorStop(1, "rgba(20,14,11,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  });
  const soot = mesh(
    new THREE.PlaneGeometry(2.55, 1.62),
    new THREE.MeshBasicMaterial({ map: sootTex, transparent: true, depthWrite: false, opacity: 0.72 }),
    false,
    false,
  );
  soot.position.set(0, 1.75, 0.625);
  fireplace.add(soot);

  // Grelha em ferro escurecido.
  const iron = material(0x171515, 0.48, 0.62);
  [-0.62, 0, 0.62].forEach((x) => {
    const bar = mesh(new THREE.CylinderGeometry(0.035, 0.035, 1.26, 8), iron);
    bar.position.set(x, 0.75, 0.56);
    fireplace.add(bar);
  });
  [0.38, 0.78].forEach((y) => {
    const rail = mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.48, 8), iron);
    rail.position.set(0, y, 0.57);
    rail.rotation.z = Math.PI / 2;
    fireplace.add(rail);
  });

  const logMat = material(0x251009, 1);
  [-0.38, 0.38].forEach((x, i) => {
    const log = mesh(new THREE.CylinderGeometry(0.13, 0.16, 1.24, 9), logMat);
    log.position.set(x, 0.35, 0.63);
    log.rotation.z = Math.PI / 2 + (i ? -0.12 : 0.12);
    fireplace.add(log);
    const coal = mesh(new THREE.CylinderGeometry(0.105, 0.105, 0.012, 9), material(0x080504, 1));
    coal.position.set(x + (i ? 0.6 : -0.6), 0.35, 0.64);
    coal.rotation.z = Math.PI / 2;
    fireplace.add(coal);
  });

  for (let i = 0; i < 13; i += 1) {
    const ember = mesh(
      new THREE.SphereGeometry(0.045 + (i % 3) * 0.012, 7, 5),
      new THREE.MeshBasicMaterial({ color: i % 3 ? 0xff5b1c : 0xffb02f }),
      false,
      false,
    );
    ember.position.set(-0.72 + (i % 7) * 0.23, 0.23 + (i % 2) * 0.04, 0.68 + (i % 3) * 0.025);
    fireplace.add(ember);
  }

  const fireLight = new THREE.PointLight(0xff6725, 4.9, 11.5, 1.65);
  fireLight.position.set(0, 1.1, 1.05);
  fireLight.castShadow = true;
  const fireShadowMapSize = Math.max(128, Number(options.shadowMapSize) || 512);
  fireLight.shadow.mapSize.set(fireShadowMapSize, fireShadowMapSize);
  fireLight.shadow.bias = -0.0015;
  fireplace.add(fireLight);

  const fireBounce = new THREE.PointLight(0xffb06b, 1.2, 7.8, 2);
  fireBounce.position.set(0, 2.25, 1.55);
  fireplace.add(fireBounce);
  flames.push({ kind: "fireplace-light", light: fireLight, bounce: fireBounce, phase: Math.random() * Math.PI * 2 });

  for (let i = 0; i < 6; i += 1) {
    const flame = mesh(
      new THREE.ConeGeometry(0.16 + i * 0.022, 0.66 + (i % 2) * 0.3, 7),
      new THREE.MeshBasicMaterial({ color: i % 2 ? 0xffb22e : 0xff4f18, transparent: true, opacity: 0.9 }),
      false,
      false,
    );
    flame.position.set((i - 2.5) * 0.22, 0.64 + (i % 2) * 0.09, 0.7);
    flames.push({ kind: "fireplace-flame", flame, phase: Math.random() * Math.PI * 2 });
    fireplace.add(flame);
  }

  scene.add(fireplace);
}


const clamp01 = (value) => (value < 0 ? 0 : value > 1 ? 1 : value);

export function createBannerGeometry(width = 1.35, height = 2.45) {
  const segmentsX = 18;
  const segmentsY = 30;
  const geometry = new THREE.PlaneGeometry(width, height, segmentsX, segmentsY);
  const position = geometry.attributes.position;

  for (let i = 0; i < position.count; i += 1) {
    const x = position.getX(i);
    const y = position.getY(i);
    // PlaneGeometry guarda posições em Float32, por isso ler de volta o vértice
    // do topo devolve 1.225000023841858 em vez de 1.225 e v passa de 1 por uma
    // margem de 1e-8. Sem o clamp, Math.pow de um número negativo devolvia NaN
    // em toda a fila superior e a geometria ficava com bounding sphere NaN.
    const u = clamp01(x / width + 0.5);
    const v = clamp01(y / height + 0.5);

    // Volume real das pregas: muito subtil para conservar a silhueta original.
    const fold = Math.sin(u * Math.PI * 7.2) * 0.035 + Math.sin(u * Math.PI * 15.5) * 0.012;
    const hanging = Math.pow(1 - v, 1.25);
    position.setZ(i, fold * (0.42 + hanging * 0.9));

    // Bordo inferior assimétrico, com pequeno recorte central e pontas irregulares.
    if (v < 0.035) {
      const scallop = 0.055 + Math.abs(Math.sin(u * Math.PI * 3)) * 0.075;
      const centralNotch = Math.max(0, 1 - Math.abs(u - 0.5) / 0.17) * 0.12;
      const irregularity = Math.sin(u * 31) * 0.014;
      position.setY(i, -height / 2 + scallop + centralNotch + irregularity);
    }
  }

  geometry.computeVertexNormals();
  return geometry;
}

export function addBanner(scene, x, baseColor, accentColor, emblemMaterial) {
  const textures = createBannerTextures(baseColor, accentColor);
  const bannerMaterial = new THREE.MeshStandardMaterial({
    map: textures.map,
    bumpMap: textures.bumpMap,
    bumpScale: 0.045,
    color: 0xffffff,
    roughness: 0.96,
    metalness: 0,
    side: THREE.DoubleSide,
  });
  const banner = mesh(createBannerGeometry(), bannerMaterial, false, false);
  banner.position.set(x, 3.35, -5.46);
  scene.add(banner);

  // Vara e remates dão espessura ao conjunto sem o tornar ornamentado demais.
  const rodMaterial = material(0x50331b, 0.78, 0.08);
  const rod = mesh(new THREE.CylinderGeometry(0.045, 0.045, 1.62, 10), rodMaterial, false, false);
  rod.rotation.z = Math.PI / 2;
  rod.position.set(x, 4.61, -5.43);
  scene.add(rod);
  [-0.86, 0.86].forEach((offset) => {
    const finial = mesh(new THREE.SphereGeometry(0.075, 9, 7), emblemMaterial, false, false);
    finial.position.set(x + offset, 4.61, -5.43);
    scene.add(finial);
  });

  const sigil = mesh(new THREE.TorusGeometry(0.34, 0.065, 6, 10), emblemMaterial, false, false);
  sigil.position.set(x, 3.48, -5.39);
  scene.add(sigil);
}


export function addBackWallWeaponDisplay(scene) {
  /* Conjunto decorativo da parede de trás: escudo com duas espadas cruzadas
     atrás dele.

     A versão anterior tinha um problema de leitura: o que fazia de escudo era um
     `CylinderGeometry` de 8 lados com 0.12 de espessura, ou seja um octógono
     plano, e as lâminas eram `BoxGeometry` com uma tira escura pintada a fingir
     de canaleta. Nada tinha secção. Agora o escudo tem forma de escudo (largo em
     cima, ponta em baixo), com aro, umbo, campo e rebites, e as lâminas são
     lofts de secção em diamante que afilam até à ponta em vez de terminarem num
     cone separado. */
  const display = new THREE.Group();
  display.position.set(0, 3.78, -5.31);

  const detail = characterDetailTextures();
  const textured = (colour, roughness, metalness, family, bumpScale = 0.004) => {
    const m = material(colour, roughness, metalness);
    m.flatShading = true;
    const fam = family ? detail?.[family] : null;
    if (fam) {
      m.map = fam.map;
      m.bumpMap = fam.bumpMap;
      m.bumpScale = bumpScale;
      const peak = Math.max(m.color.r, m.color.g, m.color.b);
      m.color.multiplyScalar(Math.min(TEXTURE_BASE_GAIN, peak > 0 ? 1 / peak : 1));
    }
    return m;
  };

  const steel = textured(0x9a9284, 0.34, 0.72, "metal", 0.002);
  const darkSteel = textured(0x484036, 0.5, 0.62, "metal", 0.003);
  const leather = textured(0x4a2819, 0.88, 0.04, "leather", 0.005);
  const gold = textured(0x9c7530, 0.42, 0.6, "metal", 0.002);
  const shieldField = textured(0x6d2b2b, 0.82, 0.08, "cloth", 0.004);
  const shieldWood = textured(0x5a3a22, 0.88, 0.04, "leather", 0.005);

  /* ---- escudo ----
     Perfil de escudo em gota: bordo superior recto e largo, flancos a curvar
     para dentro, ponta em baixo. Definido por meias-larguras a cada altura. */
  const outline = [
    [0.62, 0.5],
    [0.4, 0.53],
    [0.14, 0.5],
    [-0.12, 0.42],
    [-0.36, 0.3],
    [-0.56, 0.16],
    [-0.7, 0.0],
  ];
  const shieldRings = (scale, z, thickness) => outline.map(([py, px]) =>
    ring(V(0, py, z), Math.max(0.012, px * scale), thickness, 9, { squareness: 0.62 }));

  // Prancha, ligeiramente abaulada por variação da espessura.
  const board = meshOf(
    loft(shieldRings(1, 0.06, 0.05), { capStart: true, capEnd: true, jitter: 0.02, seed: 3 }),
    shieldWood,
    false,
    false,
  );
  display.add(board);

  // Campo de cor, à frente da prancha e ligeiramente menor.
  const field = meshOf(
    loft(shieldRings(0.9, 0.115, 0.022), { capStart: true, capEnd: true }),
    shieldField,
    false,
    false,
  );
  display.add(field);

  // Aro metálico a contornar o bordo.
  const rimOuter = shieldRings(1.05, 0.07, 0.062);
  display.add(meshOf(loft(rimOuter, {}), darkSteel, false, false));

  // Barra a fechar o bordo de cima, que de outro modo ficava sem aro.
  display.add(
    block(
      V(-outline[0][1] * 1.05, outline[0][0], 0.07),
      V(outline[0][1] * 1.05, outline[0][0], 0.07),
      0.055,
      0.125,
      0.055,
      0.125,
      darkSteel,
    ),
  );

  // Rebites ao longo do aro.
  outline.forEach(([py, px], i) => {
    if (i === outline.length - 1) return;
    [-1, 1].forEach((side) => {
      const rivet = meshOf(new THREE.OctahedronGeometry(0.028, 0), gold, false, false);
      rivet.position.set(side * px * 0.99, py, 0.11);
      rivet.scale.set(1, 1, 0.5);
      display.add(rivet);
    });
  });

  /* Chevron do campo: duas barras a formar um V invertido. Um campo liso a esta
     distância lê como um prato. */
  [-1, 1].forEach((side) => {
    const bar = block(
      V(side * 0.02, 0.3, 0.135),
      V(side * 0.4, -0.16, 0.135),
      0.11,
      0.02,
      0.09,
      0.02,
      gold,
    );
    display.add(bar);
  });

  // Umbo central, que é o que dá relevo ao escudo.
  /* O `ring` gera sempre pontos num plano de y constante, portanto o umbo é
     construído ao longo de +Y e depois deitado para +Z. Na primeira tentativa
     tentei empilhar os anéis em z directamente e o loft saiu degenerado: o umbo
     não aparecia. */
  const boss = meshOf(
    loft(
      [
        ring(V(0, 0, 0), 0.16, 0.16, 10, { squareness: 0.15 }),
        ring(V(0, 0.05, 0), 0.14, 0.14, 10, { squareness: 0.15 }),
        ring(V(0, 0.095, 0), 0.088, 0.088, 10, { squareness: 0.15 }),
        ring(V(0, 0.125, 0), 0.03, 0.03, 10, { squareness: 0.15 }),
      ],
      { capStart: true, capEnd: true },
    ),
    steel,
    false,
    false,
  );
  /* +PI/2 e não -PI/2: a rodar -90 graus em X o +Y vai para -Z, ou seja o umbo
     apontava para dentro da parede e não se via. */
  boss.rotation.x = Math.PI / 2;
  boss.position.set(0, 0.16, 0.11);
  display.add(boss);

  /* ---- espadas ----
     Lâmina em secção de diamante: quatro pontos por anel, largo na horizontal e
     fino na vertical, a afilar até um último anel praticamente colapsado, que é
     a ponta. Assim a ponta faz parte da lâmina em vez de ser um cone encaixado. */
  const makeSword = (angle, zOffset) => {
    const sword = new THREE.Group();
    sword.rotation.z = angle;
    sword.position.z = zOffset;

    const bladeRings = [
      [-0.42, 0.062],
      [-0.1, 0.058],
      [0.32, 0.052],
      [0.72, 0.044],
      [0.98, 0.032],
      [1.12, 0.014],
      [1.2, 0.003],
    ].map(([py, half]) => ring(V(0, py, 0), half, half * 0.42, 4, { squareness: 0.1 }));
    sword.add(meshOf(loft(bladeRings, { capStart: true, capEnd: true }), steel, false, false));

    // Canaleta: um sulco escuro afundado, não uma tira colada.
    const fullerRings = [
      [-0.38, 0.016],
      [0.6, 0.013],
      [0.95, 0.008],
    ].map(([py, half]) => ring(V(0, py, 0), half, half * 0.5, 4, { squareness: 0.1 }));
    const fuller = meshOf(loft(fullerRings, {}), darkSteel, false, false);
    fuller.position.z = 0.004;
    sword.add(fuller);

    // Guarda com as pontas viradas para a lâmina.
    const guard = block(
      V(-0.3, -0.5, 0.01),
      V(0.3, -0.5, 0.01),
      0.075,
      0.085,
      0.075,
      0.085,
      gold,
    );
    sword.add(guard);
    [-1, 1].forEach((side) => {
      const quillon = block(
        V(side * 0.28, -0.5, 0.01),
        V(side * 0.37, -0.42, 0.01),
        0.07,
        0.08,
        0.045,
        0.05,
        gold,
      );
      sword.add(quillon);
    });

    // Punho com enrolamento: anéis alternados em vez de um cilindro liso.
    const gripRings = [];
    for (let i = 0; i <= 8; i += 1) {
      const t = i / 8;
      const r = 0.052 + (i % 2 === 0 ? 0.008 : 0);
      gripRings.push(ring(V(0, -0.56 - t * 0.42, 0), r, r, 7, { squareness: 0.2 }));
    }
    sword.add(meshOf(loft(gripRings, { capStart: true, capEnd: true }), leather, false, false));

    // Pomo em disco, achatado no eixo da lâmina.
    const pommel = meshOf(
      loft(
        [
          ring(V(0, -0.98, 0), 0.06, 0.05, 8, { squareness: 0.2 }),
          ring(V(0, -1.04, 0), 0.095, 0.062, 8, { squareness: 0.2 }),
          ring(V(0, -1.1, 0), 0.055, 0.045, 8, { squareness: 0.2 }),
        ],
        { capStart: true, capEnd: true },
      ),
      gold,
      false,
      false,
    );
    sword.add(pommel);

    return sword;
  };

  // As espadas ficam ATRÁS do escudo, para o escudo ser o centro do conjunto.
  display.add(makeSword(Math.PI * 0.28, -0.02));
  display.add(makeSword(-Math.PI * 0.28, -0.06));

  // Grampos a segurar as lâminas à parede, nas pontas que ficam à vista.
  [[-0.9, 0.66], [0.9, 0.66], [-0.78, -0.74], [0.78, -0.74]].forEach(([hx, hy]) => {
    const hook = meshOf(new THREE.BoxGeometry(0.07, 0.1, 0.07), darkSteel, false, false);
    hook.position.set(hx, hy, -0.055);
    hook.rotation.z = hx < 0 ? -0.3 : 0.3;
    display.add(hook);
  });

  scene.add(display);
}

