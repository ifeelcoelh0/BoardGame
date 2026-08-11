import * as THREE from "three";
import zlib from "node:zlib";
import fs from "node:fs";
import {
  createSeatedCharacter,
  createLobbyChair,
  tintChair,
  LOBBY_CHARACTER_IDS,
} from "../src/ui/lobby/lobbyCharacters.js";

/* ---------------- PNG ---------------- */
function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = c ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const t = Buffer.from(type, "ascii");
  const body = Buffer.concat([t, data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
function writePNG(path, w, h, rgb) {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 3 + 1)] = 0;
    rgb.copy(raw, y * (w * 3 + 1) + 1, y * w * 3, (y + 1) * w * 3);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  fs.writeFileSync(path, Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]));
}

/* ---------------- triangle collection ---------------- */
function collect(root) {
  const tris = [];
  root.updateMatrixWorld(true);
  root.traverse((o) => {
    if (!o.isMesh || !o.geometry) return;
    const g = o.geometry;
    const pos = g.attributes.position;
    if (!pos) return;
    const idx = g.index;
    const count = idx ? idx.count : pos.count;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    const m = mats[0];
    const col = m.color ? m.color.clone() : new THREE.Color(0xff00ff);
    const emissive = m.emissive ? m.emissive.clone() : new THREE.Color(0, 0, 0);
    const ei = m.emissiveIntensity ?? 0;
    const doubleSide = m.side === THREE.DoubleSide;
    const rough = m.roughness ?? 0.9;
    const metal = m.metalness ?? 0;
    const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
    for (let i = 0; i < count; i += 3) {
      const i0 = idx ? idx.getX(i) : i;
      const i1 = idx ? idx.getX(i + 1) : i + 1;
      const i2 = idx ? idx.getX(i + 2) : i + 2;
      a.fromBufferAttribute(pos, i0).applyMatrix4(o.matrixWorld);
      b.fromBufferAttribute(pos, i1).applyMatrix4(o.matrixWorld);
      c.fromBufferAttribute(pos, i2).applyMatrix4(o.matrixWorld);
      tris.push({
        a: a.clone(), b: b.clone(), c: c.clone(),
        col, emissive, ei, doubleSide, rough, metal,
      });
    }
  });
  return tris;
}

/* ---------------- renderer ---------------- */
const LIGHTS = [
  // key: warm, from above front (the table spot)
  { dir: new THREE.Vector3(0.15, 1.0, 0.55).normalize(), color: new THREE.Color(1.0, 0.79, 0.51), intensity: 1.15 },
  // fill: cool from the side
  { dir: new THREE.Vector3(-0.85, 0.28, 0.3).normalize(), color: new THREE.Color(0.5, 0.62, 0.85), intensity: 0.38 },
  // rim from behind
  { dir: new THREE.Vector3(0.2, 0.25, -0.95).normalize(), color: new THREE.Color(0.62, 0.72, 0.95), intensity: 0.42 },
];
const AMBIENT = new THREE.Color(0.115, 0.13, 0.16);

function render({ tris, camPos, target, fov = 32, width, height, bg = [14, 12, 14], ss = 3, groundY = null }) {
  const W = width * ss, H = height * ss;
  const buf = Buffer.alloc(W * H * 3);
  for (let i = 0; i < W * H; i++) {
    // subtle vertical gradient backdrop
    const y = Math.floor(i / W) / H;
    buf[i * 3] = Math.round(bg[0] * (1.35 - y * 0.6));
    buf[i * 3 + 1] = Math.round(bg[1] * (1.35 - y * 0.6));
    buf[i * 3 + 2] = Math.round(bg[2] * (1.35 - y * 0.6));
  }
  const zbuf = new Float64Array(W * H).fill(Infinity);

  const camera = new THREE.PerspectiveCamera(fov, W / H, 0.05, 100);
  camera.position.copy(camPos);
  camera.lookAt(target);
  camera.updateMatrixWorld(true);
  const viewMatrix = camera.matrixWorldInverse.clone();
  camera.updateProjectionMatrix();
  const proj = camera.projectionMatrix;

  const all = groundY === null ? tris : tris.concat(groundQuad(groundY));

  const v4 = [new THREE.Vector4(), new THREE.Vector4(), new THREE.Vector4()];
  const wp = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];

  for (const t of all) {
    wp[0].copy(t.a); wp[1].copy(t.b); wp[2].copy(t.c);
    const n = wp[1].clone().sub(wp[0]).cross(wp[2].clone().sub(wp[0]));
    if (n.lengthSq() < 1e-14) continue;
    n.normalize();
    const centre = wp[0].clone().add(wp[1]).add(wp[2]).multiplyScalar(1 / 3);
    const toEye = camPos.clone().sub(centre).normalize();
    let facing = n.dot(toEye);
    if (facing < 0) {
      if (!t.doubleSide) continue;
      n.negate(); facing = -facing;
    }

    // shading
    let r = AMBIENT.r, g = AMBIENT.g, b = AMBIENT.b;
    for (const L of LIGHTS) {
      const d = Math.max(0, n.dot(L.dir)) * L.intensity;
      r += L.color.r * d; g += L.color.g * d; b += L.color.b * d;
    }
    // cheap specular for metals
    if (t.metal > 0.1) {
      const h = LIGHTS[0].dir.clone().add(toEye).normalize();
      const s = Math.pow(Math.max(0, n.dot(h)), 8 + (1 - t.rough) * 60) * t.metal * 1.5;
      r += s; g += s * 0.95; b += s * 0.85;
    }
    // fresnel-ish edge lift so silhouettes read
    const edge = Math.pow(1 - Math.min(1, facing), 3) * 0.16;
    r += edge; g += edge * 1.05; b += edge * 1.2;

    let cr = t.col.r * r + t.emissive.r * t.ei;
    let cg = t.col.g * g + t.emissive.g * t.ei;
    let cb = t.col.b * b + t.emissive.b * t.ei;
    // reinhard-ish tonemap + gamma
    const tm = (x) => Math.pow(Math.min(1, x / (1 + x) * 1.55), 1 / 2.2) * 255;
    const R = tm(cr), G = tm(cg), B = tm(cb);

    // project
    let clipped = false;
    for (let i = 0; i < 3; i++) {
      v4[i].set(wp[i].x, wp[i].y, wp[i].z, 1).applyMatrix4(viewMatrix).applyMatrix4(proj);
      if (v4[i].w <= 0.001) clipped = true;
    }
    if (clipped) continue;
    const sx = [], sy = [], sz = [];
    for (let i = 0; i < 3; i++) {
      sx.push((v4[i].x / v4[i].w * 0.5 + 0.5) * W);
      sy.push((1 - (v4[i].y / v4[i].w * 0.5 + 0.5)) * H);
      sz.push(v4[i].w);
    }
    const minX = Math.max(0, Math.floor(Math.min(...sx)));
    const maxX = Math.min(W - 1, Math.ceil(Math.max(...sx)));
    const minY = Math.max(0, Math.floor(Math.min(...sy)));
    const maxY = Math.min(H - 1, Math.ceil(Math.max(...sy)));
    if (minX > maxX || minY > maxY) continue;
    const area = (sx[1] - sx[0]) * (sy[2] - sy[0]) - (sx[2] - sx[0]) * (sy[1] - sy[0]);
    if (Math.abs(area) < 1e-9) continue;

    for (let py = minY; py <= maxY; py++) {
      for (let px = minX; px <= maxX; px++) {
        const X = px + 0.5, Y = py + 0.5;
        let w0 = ((sx[1] - X) * (sy[2] - Y) - (sx[2] - X) * (sy[1] - Y)) / area;
        let w1 = ((sx[2] - X) * (sy[0] - Y) - (sx[0] - X) * (sy[2] - Y)) / area;
        let w2 = 1 - w0 - w1;
        if (w0 < 0 || w1 < 0 || w2 < 0) continue;
        const z = 1 / (w0 / sz[0] + w1 / sz[1] + w2 / sz[2]);
        const o = py * W + px;
        if (z >= zbuf[o]) continue;
        zbuf[o] = z;
        buf[o * 3] = R; buf[o * 3 + 1] = G; buf[o * 3 + 2] = B;
      }
    }
  }

  // downsample
  const out = Buffer.alloc(width * height * 3);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let r = 0, g = 0, b = 0;
      for (let j = 0; j < ss; j++) for (let i = 0; i < ss; i++) {
        const o = ((y * ss + j) * W + (x * ss + i)) * 3;
        r += buf[o]; g += buf[o + 1]; b += buf[o + 2];
      }
      const n = ss * ss, o = (y * width + x) * 3;
      out[o] = r / n; out[o + 1] = g / n; out[o + 2] = b / n;
    }
  }
  return out;
}

function groundQuad(y) {
  const s = 6;
  const col = new THREE.Color(0x2a2320);
  const mk = (a, b, c) => ({
    a, b, c, col, emissive: new THREE.Color(0, 0, 0), ei: 0,
    doubleSide: true, rough: 1, metal: 0,
  });
  const p = (x, z) => new THREE.Vector3(x, y, z);
  return [
    mk(p(-s, -s), p(s, -s), p(s, s)),
    mk(p(-s, -s), p(s, s), p(-s, s)),
  ];
}

/* ---------------- scenes ---------------- */
const OUT = process.argv[2] ?? "/mnt/user-data/outputs";
fs.mkdirSync(OUT, { recursive: true });

function sceneFor(id, { withChair = true } = {}) {
  const root = new THREE.Group();
  if (withChair) {
    const chair = createLobbyChair();
    tintChair(chair, id);
    root.add(chair);
  }
  if (id) root.add(createSeatedCharacter(id));
  return collect(root);
}

const V = (x, y, z) => new THREE.Vector3(x, y, z);

function views(dist = 3.5, h = 1.35) {
  return {
    front: { camPos: V(0, h + 0.12, -dist), target: V(0, 1.18, 0) },
    three: { camPos: V(-dist * 0.62, h + 0.34, -dist * 0.78), target: V(0, 1.16, 0) },
    side: { camPos: V(-dist, h + 0.1, 0.15), target: V(0, 1.16, 0.05) },
    back: { camPos: V(0.2, h + 0.45, dist), target: V(0, 1.2, 0.1) },
  };
}

const W = 560, Hh = 700;

// 1. each character, 3/4 view, seated
for (const id of LOBBY_CHARACTER_IDS) {
  const tris = sceneFor(id);
  const v = views(3.3, 1.4).three;
  const px = render({ tris, ...v, fov: 30, width: W, height: Hh, groundY: 0 });
  writePNG(`${OUT}/char-${id}-34.png`, W, Hh, px);
  process.stdout.write(`${id} `);
}
console.log("");

// 2. head close-ups, front + side, to expose the floating features
for (const id of LOBBY_CHARACTER_IDS) {
  const tris = sceneFor(id, { withChair: false });
  const pxF = render({ tris, camPos: V(0, 1.76, -1.15), target: V(0, 1.73, 0), fov: 26, width: 460, height: 460, groundY: null });
  writePNG(`${OUT}/head-${id}-front.png`, 460, 460, pxF);
  const pxS = render({ tris, camPos: V(-1.1, 1.78, -0.34), target: V(0, 1.73, 0), fov: 26, width: 460, height: 460, groundY: null });
  writePNG(`${OUT}/head-${id}-side.png`, 460, 460, pxS);
}

// 3. the chair, empty, four angles
const chairTris = sceneFor(null);
const cv = views(3.0, 1.3);
for (const [name, v] of Object.entries(cv)) {
  const px = render({ tris: chairTris, ...v, fov: 30, width: 560, height: 640, groundY: 0 });
  writePNG(`${OUT}/chair-${name}.png`, 560, 640, px);
}

console.log("done");
