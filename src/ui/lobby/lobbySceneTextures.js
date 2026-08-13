import { t } from "../../locales/i18n.js";
import * as THREE from "three";
import { SCROLL_CANVAS, paintWritOfSelection } from "./lobbyScrollArt.js";
import { CHARACTERS } from "../../assets/characterManifest.js";
import { assetUrl } from "../../assets/assetUrl.js";

const CHARACTER_ASSET_BY_ID = new Map(CHARACTERS.map((entry) => [entry.id, entry]));
const SPRITE_TEXTURE_LOADER = new THREE.TextureLoader();

export function canvasTexture(width, height, painter) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  painter(ctx, width, height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.encoding = THREE.sRGBEncoding;
  return texture;
}

export function createWoodTexture() {
  const size = 1024;
  const colorCanvas = document.createElement("canvas");
  const bumpCanvas = document.createElement("canvas");
  const roughCanvas = document.createElement("canvas");
  colorCanvas.width = colorCanvas.height = size;
  bumpCanvas.width = bumpCanvas.height = size;
  roughCanvas.width = roughCanvas.height = size;
  const ctx = colorCanvas.getContext("2d");
  const bump = bumpCanvas.getContext("2d");
  const rough = roughCanvas.getContext("2d");

  ctx.fillStyle = "#321b12";
  ctx.fillRect(0, 0, size, size);
  bump.fillStyle = "#8d8d8d";
  bump.fillRect(0, 0, size, size);

  // Veios longos, com pequenas variações que evitam uma superfície demasiado uniforme.
  for (let i = 0; i < 190; i += 1) {
    const y = (i / 190) * size;
    const waveA = Math.sin(i * 0.42) * 5;
    const waveB = Math.sin(i * 0.68) * 9;
    ctx.strokeStyle = `rgba(15,7,4,${0.11 + (i % 5) * 0.022})`;
    ctx.lineWidth = 1.3 + (i % 4) * 0.55;
    ctx.beginPath();
    ctx.moveTo(0, y + waveA);
    ctx.bezierCurveTo(size * 0.2, y + waveB, size * 0.68, y - Math.cos(i * 0.47) * 9, size, y + Math.sin(i * 0.2) * 6);
    ctx.stroke();

    bump.strokeStyle = `rgba(108,108,108,${0.22 + (i % 3) * 0.05})`;
    bump.lineWidth = 1 + (i % 3) * 0.45;
    bump.beginPath();
    bump.moveTo(0, y + waveA);
    bump.bezierCurveTo(size * 0.2, y + waveB, size * 0.68, y - Math.cos(i * 0.47) * 9, size, y + Math.sin(i * 0.2) * 6);
    bump.stroke();
  }

  // Rachaduras principais: poucas, profundas e ramificadas.
  const cracks = [
    [70, 150, 260, 206, 420, 178],
    [610, 92, 760, 142, 935, 112],
    [190, 430, 360, 388, 505, 426],
    [690, 520, 835, 465, 1000, 494],
    [38, 746, 205, 706, 350, 735],
    [470, 865, 650, 814, 834, 850],
    [760, 690, 885, 650, 1018, 678],
    [300, 610, 420, 574, 555, 600],
  ];

  cracks.forEach(([x0, y0, x1, y1, x2, y2], index) => {
    const midX = (x0 + x2) / 2 + (index % 2 ? 18 : -22);
    const midY = (y0 + y2) / 2 + (index % 3 - 1) * 16;

    ctx.strokeStyle = "rgba(7,3,2,0.72)";
    ctx.lineWidth = 3.1 + (index % 3) * 0.65;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.quadraticCurveTo(x1, y1, midX, midY);
    ctx.quadraticCurveTo(x1 + 42, y1 - 18, x2, y2);
    ctx.stroke();

    ctx.strokeStyle = "rgba(113,65,35,0.32)";
    ctx.lineWidth = 1.15;
    ctx.beginPath();
    ctx.moveTo(x0 + 2, y0 - 2);
    ctx.quadraticCurveTo(x1, y1 - 3, midX, midY - 2);
    ctx.quadraticCurveTo(x1 + 42, y1 - 20, x2, y2 - 2);
    ctx.stroke();

    bump.strokeStyle = "rgba(18,18,18,0.94)";
    bump.lineWidth = 5.2 + (index % 2);
    bump.lineCap = "round";
    bump.beginPath();
    bump.moveTo(x0, y0);
    bump.quadraticCurveTo(x1, y1, midX, midY);
    bump.quadraticCurveTo(x1 + 42, y1 - 18, x2, y2);
    bump.stroke();

    // Duas ramificações curtas por fissura.
    [[0.38, -1], [0.68, 1]].forEach(([t, direction], branchIndex) => {
      const bx = x0 + (x2 - x0) * t;
      const by = y0 + (y2 - y0) * t;
      const length = 32 + ((index + branchIndex) % 3) * 12;
      ctx.strokeStyle = "rgba(8,4,2,0.55)";
      ctx.lineWidth = 1.7;
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.quadraticCurveTo(bx + length * 0.45, by + direction * 9, bx + length, by + direction * 20);
      ctx.stroke();
      bump.strokeStyle = "rgba(30,30,30,0.78)";
      bump.lineWidth = 2.8;
      bump.beginPath();
      bump.moveTo(bx, by);
      bump.quadraticCurveTo(bx + length * 0.45, by + direction * 9, bx + length, by + direction * 20);
      bump.stroke();
    });
  });

  // Pequenos riscos e marcas de utilização junto ao tampo.
  for (let i = 0; i < 34; i += 1) {
    const x = (i * 83 + 47) % size;
    const y = (i * 137 + 91) % size;
    const length = 18 + (i % 5) * 9;
    ctx.strokeStyle = `rgba(9,4,2,${0.22 + (i % 3) * 0.06})`;
    ctx.lineWidth = 0.9 + (i % 2) * 0.5;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + length, y + Math.sin(i) * 5);
    ctx.stroke();
  }

  const map = new THREE.CanvasTexture(colorCanvas);
  const bumpMap = new THREE.CanvasTexture(bumpCanvas);
  const roughnessMap = new THREE.CanvasTexture(roughCanvas);
  [map, bumpMap, roughnessMap].forEach((texture) => {
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(1.55, 1.55);
  });
  map.encoding = THREE.sRGBEncoding;
  return { map, bumpMap, roughnessMap };
}


export function createChairWoodTextures() {
  const size = 512;
  const colorCanvas = document.createElement("canvas");
  const bumpCanvas = document.createElement("canvas");
  const roughCanvas = document.createElement("canvas");
  colorCanvas.width = colorCanvas.height = size;
  bumpCanvas.width = bumpCanvas.height = size;
  roughCanvas.width = roughCanvas.height = size;
  const ctx = colorCanvas.getContext("2d");
  const bump = bumpCanvas.getContext("2d");
  const rough = roughCanvas.getContext("2d");

  const grad = ctx.createLinearGradient(0, 0, size, size);
  grad.addColorStop(0, "#2b170f");
  grad.addColorStop(0.52, "#4a2918");
  grad.addColorStop(1, "#30180f");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  bump.fillStyle = "#858585";
  bump.fillRect(0, 0, size, size);
  rough.fillStyle = "#d0d0d0";
  rough.fillRect(0, 0, size, size);

  for (let i = 0; i < 105; i += 1) {
    const y = (i / 105) * size;
    const sway = Math.sin(i * 0.53) * 5 + Math.sin(i * 0.17) * 7;
    ctx.strokeStyle = `rgba(16,7,3,${0.12 + (i % 4) * 0.035})`;
    ctx.lineWidth = 1 + (i % 3) * 0.6;
    ctx.beginPath();
    ctx.moveTo(-12, y);
    ctx.bezierCurveTo(size * 0.26, y + sway, size * 0.72, y - sway * 0.7, size + 12, y + sway * 0.3);
    ctx.stroke();
    bump.strokeStyle = `rgba(70,70,70,${0.18 + (i % 3) * 0.05})`;
    bump.lineWidth = 1 + (i % 2);
    bump.beginPath();
    bump.moveTo(-12, y);
    bump.bezierCurveTo(size * 0.26, y + sway, size * 0.72, y - sway * 0.7, size + 12, y + sway * 0.3);
    bump.stroke();
  }

  for (let i = 0; i < 22; i += 1) {
    const x = (i * 91 + 31) % size;
    const y = (i * 57 + 43) % size;
    ctx.strokeStyle = "rgba(220,160,92,0.12)";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 18 + (i % 4) * 8, y + Math.sin(i) * 4);
    ctx.stroke();
  }

  const map = new THREE.CanvasTexture(colorCanvas);
  const bumpMap = new THREE.CanvasTexture(bumpCanvas);
  const roughnessMap = new THREE.CanvasTexture(roughCanvas);
  [map, bumpMap, roughnessMap].forEach((texture) => {
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(1.35, 1.35);
  });
  map.encoding = THREE.sRGBEncoding;
  return { map, bumpMap, roughnessMap };
}

export function createStoneTextures(kind = "wall") {
  const size = 1024;
  const colorCanvas = document.createElement("canvas");
  const bumpCanvas = document.createElement("canvas");
  const roughCanvas = document.createElement("canvas");
  colorCanvas.width = colorCanvas.height = size;
  bumpCanvas.width = bumpCanvas.height = size;
  roughCanvas.width = roughCanvas.height = size;
  const ctx = colorCanvas.getContext("2d");
  const bump = bumpCanvas.getContext("2d");
  const rough = roughCanvas.getContext("2d");

  const base = kind === "wall" ? "#625b54" : "#595149";
  const shade = kind === "wall" ? "#4a433d" : "#463f38";
  const mortar = kind === "wall" ? "#2f2b28" : "#2a2522";
  const highlight = kind === "wall" ? "rgba(186,174,162,0.22)" : "rgba(174,164,152,0.18)";

  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);
  bump.fillStyle = "#838383";
  bump.fillRect(0, 0, size, size);
  rough.fillStyle = kind === "wall" ? "#e8e8e8" : "#ededed";
  rough.fillRect(0, 0, size, size);

  for (let i = 0; i < 1600; i += 1) {
    const x = (i * 61) % size;
    const y = (i * 43) % size;
    const radius = 6 + (i % 5) * 7;
    ctx.fillStyle = `rgba(${90 + (i % 4) * 10},${84 + (i % 5) * 8},${80 + (i % 6) * 7},${0.028 + (i % 3) * 0.012})`;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  if (kind === "wall") {
    const rowHeights = [112, 118, 106, 122, 110];
    let y = 0;
    let row = 0;
    while (y < size) {
      const h = rowHeights[row % rowHeights.length];
      const offset = row % 2 ? 72 : 0;
      let x = -offset;
      while (x < size + 120) {
        const w = 180 + ((row + Math.floor(x / 120)) % 3) * 46;
        ctx.fillStyle = row % 2 ? "rgba(255,255,255,0.018)" : "rgba(0,0,0,0.018)";
        ctx.fillRect(x + 4, y + 4, w - 8, h - 8);
        ctx.strokeStyle = mortar;
        ctx.lineWidth = 10;
        ctx.strokeRect(x, y, w, h);
        ctx.strokeStyle = highlight;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(x + 12, y + 10);
        ctx.lineTo(x + w - 18, y + 10);
        ctx.moveTo(x + 10, y + 12);
        ctx.lineTo(x + 10, y + h - 16);
        ctx.stroke();
        bump.strokeStyle = "rgba(42,42,42,0.92)";
        bump.lineWidth = 13;
        bump.strokeRect(x, y, w, h);
        bump.fillStyle = "rgba(142,142,142,0.12)";
        bump.fillRect(x + 8, y + 8, w - 16, h - 16);
        x += w;
      }
      y += h;
      row += 1;
    }
  } else {
    const rows = [162, 180, 174, 190, 168, 184];
    let y = 0;
    let row = 0;
    while (y < size) {
      const h = rows[row % rows.length];
      const offset = row % 2 ? 84 : 0;
      let x = -offset;
      while (x < size + 180) {
        const w = 210 + ((row + Math.floor(x / 140)) % 4) * 34;
        ctx.fillStyle = row % 2 ? "rgba(255,248,238,0.016)" : "rgba(0,0,0,0.024)";
        ctx.fillRect(x + 6, y + 6, w - 12, h - 12);
        ctx.strokeStyle = mortar;
        ctx.lineWidth = 11;
        ctx.strokeRect(x, y, w, h);
        ctx.strokeStyle = highlight;
        ctx.lineWidth = 2.6;
        ctx.beginPath();
        ctx.moveTo(x + 16, y + 14);
        ctx.lineTo(x + w - 24, y + 14);
        ctx.stroke();
        bump.strokeStyle = "rgba(34,34,34,0.94)";
        bump.lineWidth = 12;
        bump.strokeRect(x, y, w, h);
        x += w;
      }
      y += h;
      row += 1;
    }
  }

  for (let i = 0; i < 240; i += 1) {
    const x = (i * 97 + 37) % size;
    const y = (i * 131 + 53) % size;
    const len = 12 + (i % 4) * 9;
    ctx.strokeStyle = i % 3 ? "rgba(34,29,25,0.16)" : shade;
    ctx.lineWidth = 1 + (i % 2) * 0.7;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + len, y + Math.sin(i * 0.8) * 6);
    ctx.stroke();
    bump.strokeStyle = "rgba(116,116,116,0.22)";
    bump.lineWidth = 1.4;
    bump.beginPath();
    bump.moveTo(x, y);
    bump.lineTo(x + len, y + Math.sin(i * 0.8) * 6);
    bump.stroke();
  }

  // Pátina, desgaste e pequenas manchas dão idade à pedra sem roubar protagonismo.
  const grime = ctx.createLinearGradient(0, 0, 0, size);
  grime.addColorStop(0, "rgba(22,18,15,0.02)");
  grime.addColorStop(0.72, "rgba(27,22,18,0.045)");
  grime.addColorStop(1, kind === "wall" ? "rgba(20,16,13,0.16)" : "rgba(18,14,12,0.08)");
  ctx.fillStyle = grime;
  ctx.fillRect(0, 0, size, size);

  for (let i = 0; i < (kind === "wall" ? 44 : 66); i += 1) {
    const x = (i * 173 + 91) % size;
    const y = (i * 239 + 47) % size;
    const rx = 18 + (i % 6) * 13;
    const ry = 8 + (i % 5) * 9;
    const stain = ctx.createRadialGradient(x, y, 1, x, y, rx);
    stain.addColorStop(0, i % 4 === 0 ? "rgba(44,34,26,0.11)" : "rgba(25,23,20,0.075)");
    stain.addColorStop(1, "rgba(0,0,0,0)");
    ctx.save();
    ctx.scale(1, ry / rx);
    ctx.fillStyle = stain;
    ctx.beginPath();
    ctx.arc(x, y * rx / ry, rx, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    rough.fillStyle = i % 3 === 0 ? "rgba(112,112,112,0.18)" : "rgba(245,245,245,0.1)";
    rough.beginPath();
    rough.ellipse(x, y, rx, ry, (i % 7) * 0.17, 0, Math.PI * 2);
    rough.fill();
  }

  if (kind === "floor") {
    for (let i = 0; i < 24; i += 1) {
      const x = (i * 211 + 120) % size;
      const y = (i * 149 + 80) % size;
      rough.fillStyle = "rgba(92,92,92,0.18)";
      rough.beginPath();
      rough.ellipse(x, y, 42 + (i % 4) * 12, 18 + (i % 3) * 7, 0.25, 0, Math.PI * 2);
      rough.fill();
    }
  }

  const map = new THREE.CanvasTexture(colorCanvas);
  const bumpMap = new THREE.CanvasTexture(bumpCanvas);
  const roughnessMap = new THREE.CanvasTexture(roughCanvas);
  [map, bumpMap, roughnessMap].forEach((texture) => {
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(kind === "wall" ? 1.9 : 2.2, kind === "wall" ? 1.25 : 2.2);
  });
  map.encoding = THREE.sRGBEncoding;
  return { map, bumpMap, roughnessMap };
}

export function createRugTexture() {
  const size = 1024;
  const colorCanvas = document.createElement("canvas");
  const bumpCanvas = document.createElement("canvas");
  const roughCanvas = document.createElement("canvas");
  colorCanvas.width = colorCanvas.height = size;
  bumpCanvas.width = bumpCanvas.height = size;
  roughCanvas.width = roughCanvas.height = size;
  const ctx = colorCanvas.getContext("2d");
  const bump = bumpCanvas.getContext("2d");
  const rough = roughCanvas.getContext("2d");

  const cx = size / 2;
  const cy = size / 2;

  const redGrad = ctx.createRadialGradient(cx, cy, size * 0.12, cx, cy, size * 0.54);
  redGrad.addColorStop(0, "#7d1717");
  redGrad.addColorStop(0.48, "#681013");
  redGrad.addColorStop(1, "#4e0d10");
  ctx.fillStyle = redGrad;
  ctx.fillRect(0, 0, size, size);

  bump.fillStyle = "#858585";
  bump.fillRect(0, 0, size, size);
  rough.fillStyle = "#ededed";
  rough.fillRect(0, 0, size, size);

  // fibra base do tapete, muito subtil e contínua
  for (let y = 0; y < size; y += 3) {
    const alpha = 0.012 + ((y / 3) % 5) * 0.003;
    ctx.strokeStyle = `rgba(255,235,220,${alpha})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, y + Math.sin(y * 0.018) * 0.4);
    ctx.lineTo(size, y + Math.sin(y * 0.018) * 0.4);
    ctx.stroke();
    bump.strokeStyle = `rgba(${(y / 3) % 2 ? 132 : 112},${(y / 3) % 2 ? 132 : 112},${(y / 3) % 2 ? 132 : 112},0.1)`;
    bump.lineWidth = 1;
    bump.beginPath();
    bump.moveTo(0, y);
    bump.lineTo(size, y);
    bump.stroke();
  }

  for (let x = 0; x < size; x += 5) {
    ctx.strokeStyle = "rgba(55,14,14,0.024)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(x * 0.017) * 0.2, 0);
    ctx.lineTo(x + Math.cos(x * 0.017) * 0.2, size);
    ctx.stroke();
  }

  // anéis simples e mais discretos
  const bands = [
    [size * 0.468, 26, "#c8a150"],
    [size * 0.426, 11, "#781f1a"],
    [size * 0.394, 14, "#d5b56b"],
    [size * 0.352, 8, "#7d1f19"],
  ];
  bands.forEach(([radius, width, color], idx) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.stroke();
    bump.strokeStyle = idx % 2 ? "rgba(108,108,108,0.22)" : "rgba(152,152,152,0.28)";
    bump.lineWidth = width * 0.6;
    bump.beginPath();
    bump.arc(cx, cy, radius, 0, Math.PI * 2);
    bump.stroke();
  });

  // detalhes ornamentais leves na borda exterior
  ctx.save();
  ctx.translate(cx, cy);
  for (let i = 0; i < 16; i += 1) {
    ctx.rotate((Math.PI * 2) / 16);
    ctx.fillStyle = i % 2 ? "rgba(208,174,93,0.92)" : "rgba(146,87,34,0.65)";
    ctx.beginPath();
    ctx.moveTo(0, -420);
    ctx.quadraticCurveTo(22, -443, 0, -464);
    ctx.quadraticCurveTo(-22, -443, 0, -420);
    ctx.fill();
    bump.fillStyle = "rgba(146,146,146,0.16)";
    bump.beginPath();
    bump.moveTo(cx, cy - 420);
    bump.closePath();
  }
  ctx.restore();

  // medalhão central muito simples
  ctx.save();
  ctx.translate(cx, cy);
  ctx.fillStyle = "rgba(182,131,49,0.96)";
  ctx.beginPath();
  ctx.ellipse(0, 0, 124, 84, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#efcf8a";
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.ellipse(0, 0, 124, 84, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = "rgba(108,34,23,0.85)";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(-54, 0);
  ctx.lineTo(54, 0);
  ctx.moveTo(0, -28);
  ctx.lineTo(0, 28);
  ctx.stroke();
  bump.strokeStyle = "rgba(150,150,150,0.22)";
  bump.lineWidth = 6;
  bump.beginPath();
  bump.ellipse(cx, cy, 124, 84, 0, 0, Math.PI * 2);
  bump.stroke();
  ctx.restore();

  // aparência de pelo / felpo: pequenos traços curtos, especialmente visíveis nas zonas douradas
  const bandRadii = [size * 0.468, size * 0.394];
  bandRadii.forEach((radius, idx) => {
    for (let i = 0; i < 420; i += 1) {
      const a = (i / 420) * Math.PI * 2 + idx * 0.07;
      const r = radius + ((i % 9) - 4) * 1.4;
      const x = cx + Math.cos(a) * r;
      const y = cy + Math.sin(a) * r;
      const len = 5 + (i % 4) * 1.5;
      const dx = Math.cos(a) * len;
      const dy = Math.sin(a) * len;
      ctx.strokeStyle = i % 2 ? "rgba(247,228,178,0.24)" : "rgba(150,104,37,0.18)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + dx, y + dy);
      ctx.stroke();
      bump.strokeStyle = "rgba(158,158,158,0.18)";
      bump.lineWidth = 1;
      bump.beginPath();
      bump.moveTo(x, y);
      bump.lineTo(x + dx * 0.9, y + dy * 0.9);
      bump.stroke();
    }
  });

  // felpo geral no campo vermelho
  for (let i = 0; i < 2600; i += 1) {
    const x = (i * 71 + 23) % size;
    const y = (i * 97 + 41) % size;
    const angle = ((i % 7) - 3) * 0.12;
    const len = 2 + (i % 3);
    ctx.strokeStyle = i % 5 ? "rgba(255,224,208,0.03)" : "rgba(72,16,16,0.045)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(angle) * len, y + Math.sin(angle) * len);
    ctx.stroke();
    bump.strokeStyle = i % 4 ? "rgba(124,124,124,0.06)" : "rgba(144,144,144,0.08)";
    bump.lineWidth = 1;
    bump.beginPath();
    bump.moveTo(x, y);
    bump.lineTo(x + Math.cos(angle) * len, y + Math.sin(angle) * len);
    bump.stroke();
  }

  // desgaste de passagem junto às cadeiras: menos saturação e pelo mais comprimido.
  for (let i = 0; i < 10; i += 1) {
    const angle = (i / 10) * Math.PI * 2 + 0.14;
    const px = cx + Math.cos(angle) * size * 0.31;
    const py = cy + Math.sin(angle) * size * 0.31;
    const wear = ctx.createRadialGradient(px, py, 3, px, py, 58 + (i % 3) * 10);
    wear.addColorStop(0, "rgba(80,44,35,0.12)");
    wear.addColorStop(1, "rgba(80,44,35,0)");
    ctx.fillStyle = wear;
    ctx.fillRect(px - 80, py - 80, 160, 160);
    rough.fillStyle = "rgba(105,105,105,0.16)";
    rough.beginPath();
    rough.ellipse(px, py, 52, 28, angle, 0, Math.PI * 2);
    rough.fill();
  }

  // vinheta muito discreta para assentar o conjunto
  const vignette = ctx.createRadialGradient(cx, cy, size * 0.33, cx, cy, size * 0.56);
  vignette.addColorStop(0, "rgba(0,0,0,0)");
  vignette.addColorStop(1, "rgba(24,8,8,0.15)");
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, size, size);

  const map = new THREE.CanvasTexture(colorCanvas);
  const bumpMap = new THREE.CanvasTexture(bumpCanvas);
  const roughnessMap = new THREE.CanvasTexture(roughCanvas);
  [map, bumpMap, roughnessMap].forEach((texture) => {
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
  });
  map.encoding = THREE.sRGBEncoding;
  return { map, bumpMap, roughnessMap };
}


export function createCardTexture() {
  const texture = canvasTexture(256, 384, (ctx, width, height) => {
    ctx.fillStyle = "#e6d8b4";
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = "#8c5c2a";
    ctx.lineWidth = 12;
    ctx.strokeRect(10, 10, width - 20, height - 20);
    ctx.fillStyle = "rgba(90,50,24,0.18)";
    for (let i = 0; i < 5; i += 1) {
      ctx.fillRect(34, 46 + i * 46, width - 68, 8);
    }
    ctx.strokeStyle = "#b88a31";
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(width * 0.28, height * 0.77);
    ctx.quadraticCurveTo(width * 0.5, height * 0.55, width * 0.72, height * 0.77);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(width * 0.5, height * 0.24, 26, 0, Math.PI * 2);
    ctx.stroke();
  });
  return texture;
}

export function createGameBoxTextures() {
  const size = 512;
  const color = document.createElement("canvas");
  const bumpCanvas = document.createElement("canvas");
  color.width = color.height = size;
  bumpCanvas.width = bumpCanvas.height = size;
  const ctx = color.getContext("2d");
  const bump = bumpCanvas.getContext("2d");
  ctx.fillStyle = "#4b2917";
  ctx.fillRect(0, 0, size, size);
  bump.fillStyle = "#888";
  bump.fillRect(0, 0, size, size);
  for (let i = 0; i < 92; i += 1) {
    const y = (i / 92) * size;
    const wave = Math.sin(i * 0.61) * 7;
    ctx.strokeStyle = `rgba(24,10,5,${0.12 + (i % 4) * 0.025})`;
    ctx.lineWidth = 1.2 + (i % 3) * 0.55;
    ctx.beginPath();
    ctx.moveTo(0, y + wave);
    ctx.bezierCurveTo(150, y - wave, 360, y + wave * 0.6, size, y - wave * 0.35);
    ctx.stroke();
    bump.strokeStyle = "rgba(105,105,105,0.34)";
    bump.lineWidth = 1.1;
    bump.beginPath();
    bump.moveTo(0, y + wave);
    bump.bezierCurveTo(150, y - wave, 360, y + wave * 0.6, size, y - wave * 0.35);
    bump.stroke();
  }
  for (let i = 0; i < 26; i += 1) {
    const x = (i * 83 + 27) % size;
    const y = (i * 137 + 61) % size;
    ctx.fillStyle = "rgba(234,183,111,0.055)";
    ctx.fillRect(x, y, 18 + (i % 4) * 9, 2);
  }
  const map = new THREE.CanvasTexture(color);
  const bumpMap = new THREE.CanvasTexture(bumpCanvas);
  [map, bumpMap].forEach((t) => { t.wrapS = THREE.RepeatWrapping; t.wrapT = THREE.RepeatWrapping; t.repeat.set(1.25, 1.25); });
  map.encoding = THREE.sRGBEncoding;
  return { map, bumpMap };
}

export function createLinerTexture() {
  return canvasTexture(384, 384, (ctx, w, h) => {
    ctx.fillStyle = "#48130f"; ctx.fillRect(0, 0, w, h);
    for (let i = -h; i < w + h; i += 9) {
      ctx.strokeStyle = i % 18 ? "rgba(228,115,92,0.075)" : "rgba(20,4,3,0.15)";
      ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i - h, h); ctx.stroke();
    }
    for (let y = 4; y < h; y += 8) {
      ctx.strokeStyle = "rgba(255,190,160,0.035)"; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }
  });
}

export function createBannerTextures(baseHex, accentHex) {
  const width = 512;
  const height = 1024;
  const colorCanvas = document.createElement("canvas");
  const bumpCanvas = document.createElement("canvas");
  colorCanvas.width = bumpCanvas.width = width;
  colorCanvas.height = bumpCanvas.height = height;
  const ctx = colorCanvas.getContext("2d");
  const bump = bumpCanvas.getContext("2d");

  const base = new THREE.Color(baseHex);
  const accent = new THREE.Color(accentHex);
  const rgb = (color, factor = 1) => {
    const c = color.clone().multiplyScalar(factor);
    return `${Math.round(THREE.MathUtils.clamp(c.r, 0, 1) * 255)},${Math.round(THREE.MathUtils.clamp(c.g, 0, 1) * 255)},${Math.round(THREE.MathUtils.clamp(c.b, 0, 1) * 255)}`;
  };

  // Base com luz ligeiramente desigual para o tecido não parecer uma placa lisa.
  const vertical = ctx.createLinearGradient(0, 0, 0, height);
  vertical.addColorStop(0, `rgb(${rgb(base, 1.12)})`);
  vertical.addColorStop(0.48, `rgb(${rgb(base, 0.94)})`);
  vertical.addColorStop(1, `rgb(${rgb(base, 0.7)})`);
  ctx.fillStyle = vertical;
  ctx.fillRect(0, 0, width, height);

  // Pregas verticais suaves, com alternância entre áreas iluminadas e sombreadas.
  for (let x = 0; x < width; x += 5) {
    const fold = Math.sin((x / width) * Math.PI * 7.2) * 0.5 + Math.sin((x / width) * Math.PI * 15.5) * 0.18;
    const alpha = 0.045 + Math.abs(fold) * 0.075;
    ctx.fillStyle = fold > 0 ? `rgba(255,236,202,${alpha})` : `rgba(15,7,5,${alpha * 1.28})`;
    ctx.fillRect(x, 0, 5, height);

    const bumpValue = Math.round(128 + fold * 42);
    bump.fillStyle = `rgb(${bumpValue},${bumpValue},${bumpValue})`;
    bump.fillRect(x, 0, 5, height);
  }

  // Trama cruzada fina: visível de perto, discreta na composição geral.
  for (let y = 0; y < height; y += 4) {
    ctx.strokeStyle = y % 8 === 0 ? "rgba(255,245,220,0.028)" : "rgba(0,0,0,0.035)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, y + 0.5);
    ctx.lineTo(width, y + 0.5);
    ctx.stroke();
  }
  for (let x = 0; x < width; x += 4) {
    ctx.strokeStyle = x % 8 === 0 ? "rgba(255,245,220,0.022)" : "rgba(0,0,0,0.028)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x + 0.5, 0);
    ctx.lineTo(x + 0.5, height);
    ctx.stroke();
  }

  // Símbolo heráldico tonal, propositadamente subtil.
  ctx.save();
  ctx.translate(width / 2, height * 0.54);
  ctx.globalAlpha = 0.13;
  ctx.strokeStyle = `rgb(${rgb(accent, 1.08)})`;
  ctx.fillStyle = `rgb(${rgb(accent, 0.72)})`;
  ctx.lineWidth = 16;
  ctx.beginPath();
  ctx.moveTo(0, -142);
  ctx.lineTo(92, -44);
  ctx.lineTo(58, 105);
  ctx.lineTo(0, 154);
  ctx.lineTo(-58, 105);
  ctx.lineTo(-92, -44);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, -8, 48, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  // Desgaste leve nas laterais, como fibras gastas e pequenas falhas de tinta.
  for (let i = 0; i < 90; i += 1) {
    const edge = i % 2 === 0 ? 0 : width;
    const x = edge + (edge === 0 ? 1 : -1) * (2 + (i % 7));
    const y = (i * 83) % height;
    ctx.fillStyle = `rgba(20,10,7,${0.035 + (i % 4) * 0.018})`;
    ctx.fillRect(x, y, 1 + (i % 3), 4 + (i % 9));
  }

  const map = new THREE.CanvasTexture(colorCanvas);
  const bumpMap = new THREE.CanvasTexture(bumpCanvas);
  [map, bumpMap].forEach((texture) => {
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
  });
  map.encoding = THREE.sRGBEncoding;
  return { map, bumpMap };
}

/**
 * Recorta o busto de um sprite: mede a caixa opaca e devolve a fatia superior,
 * que é onde estão cabeça e tronco. Sem isto o personagem aparecia como uma
 * figura pequena no meio da moldura em vez de um retrato.
 */
function bustCrop(image, topFraction = 0.58) {
  const scratch = document.createElement("canvas");
  scratch.width = image.width;
  scratch.height = image.height;
  const scratchCtx = scratch.getContext("2d");
  scratchCtx.drawImage(image, 0, 0);

  let minX = image.width;
  let minY = image.height;
  let maxX = -1;
  let maxY = -1;
  const { data } = scratchCtx.getImageData(0, 0, image.width, image.height);
  for (let y = 0; y < image.height; y += 1) {
    for (let x = 0; x < image.width; x += 1) {
      if (data[(y * image.width + x) * 4 + 3] < 12) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX < 0) return null;
  return {
    x: minX,
    y: minY,
    width: maxX - minX + 1,
    height: Math.max(1, Math.round((maxY - minY + 1) * topFraction)),
  };
}

function paintPortraitBackdrop(ctx, width, height, character) {
  const accent = character?.pc ?? "#d6ac55";
  const bg = character?.c ?? "#3a2a22";
  const fg = character?.ac ?? "#f2ddad";

  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, "#1d120d");
  gradient.addColorStop(0.42, bg);
  gradient.addColorStop(1, "#241611");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  const innerGlow = ctx.createRadialGradient(width * 0.5, height * 0.38, 20, width * 0.5, height * 0.38, 260);
  innerGlow.addColorStop(0, `${accent}4c`);
  innerGlow.addColorStop(0.7, `${fg}12`);
  innerGlow.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = innerGlow;
  ctx.fillRect(0, 0, width, height);

  // Pinceladas largas na diagonal: leem-se como tela pintada e não como
  // gradiente liso, que era o que fazia o fundo parecer um placeholder.
  ctx.save();
  ctx.globalAlpha = 0.07;
  ctx.strokeStyle = fg;
  ctx.lineWidth = 26;
  for (let i = -3; i < 12; i += 1) {
    ctx.beginPath();
    ctx.moveTo(i * 58 - 60, 0);
    ctx.lineTo(i * 58 + 150, height);
    ctx.stroke();
  }
  ctx.restore();
}

function paintPortraitVarnish(ctx, width, height) {
  // Vinheta e canto escuro por cima do busto, para o sprite assentar na tela.
  const vignette = ctx.createRadialGradient(width * 0.5, height * 0.42, height * 0.22, width * 0.5, height * 0.5, height * 0.78);
  vignette.addColorStop(0, "rgba(0,0,0,0)");
  vignette.addColorStop(1, "rgba(12,7,5,0.72)");
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = "rgba(24,14,10,0.9)";
  ctx.lineWidth = 10;
  ctx.strokeRect(5, 5, width - 10, height - 10);
}

export function createPortraitTexture(character, index = 0) {
  const texture = canvasTexture(512, 640, (ctx, width, height) => {
    paintPortraitBackdrop(ctx, width, height, character);
    paintPortraitVarnish(ctx, width, height);
  });

  const entry = CHARACTER_ASSET_BY_ID.get(character?.id);
  if (!entry) return texture;

  // O busto entra por cima do fundo quando o PNG chegar; a textura é apenas
  // marcada como suja, sem reconstruir nada.
  const image = new Image();
  image.onload = () => {
    const canvas = texture.image;
    const crop = bustCrop(image);
    if (!canvas || !crop) return;
    const ctx = canvas.getContext("2d");
    const { width, height } = canvas;

    paintPortraitBackdrop(ctx, width, height, character);

    const maxWidth = width * 0.9;
    const maxHeight = height * 0.74;
    const scale = Math.min(maxWidth / crop.width, maxHeight / crop.height);
    const drawWidth = crop.width * scale;
    const drawHeight = crop.height * scale;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(
      image,
      crop.x,
      crop.y,
      crop.width,
      crop.height,
      (width - drawWidth) / 2,
      height * 0.9 - drawHeight,
      drawWidth,
      drawHeight,
    );
    ctx.imageSmoothingEnabled = true;

    paintPortraitVarnish(ctx, width, height);
    texture.needsUpdate = true;
  };
  image.src = assetUrl(`${entry.basePath}/${entry.defaultDirection}.png`);
  return texture;
}

export function createNameplateTexture(character) {
  const accent = character?.pc ?? "#d6ac55";
  const name = (character?.n ?? "Casa Desconhecida").toUpperCase();
  return canvasTexture(640, 160, (ctx, width, height) => {
    const gradient = ctx.createLinearGradient(0, 0, width, 0);
    gradient.addColorStop(0, "#3a2417");
    gradient.addColorStop(0.5, "#6b4527");
    gradient.addColorStop(1, "#3a2417");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = "rgba(235,208,150,0.8)";
    ctx.lineWidth = 7;
    ctx.strokeRect(10, 10, width - 20, height - 20);
    ctx.fillStyle = accent;
    ctx.fillRect(30, height - 22, width - 60, 4);

    // O nome é a única coisa na placa e ocupa-a toda: o slogan saiu porque
    // repetia o que o pergaminho já diz e roubava altura ao nome.
    ctx.fillStyle = "#fbeecb";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    let size = 84;
    do {
      ctx.font = `bold ${size}px serif`;
      size -= 2;
    } while (ctx.measureText(name).width > width - 76 && size > 30);
    ctx.fillText(name, width / 2, height / 2 - 4);
    ctx.textBaseline = "alphabetic";
  });
}

/**
 * Madeira das molduras. A textura da mesa é escura por design (#321b12 de base)
 * e nas molduras lia-se como preto: multiplicar por uma cor mais clara não
 * ajuda, porque o mapa já parte de quase zero. Esta parte de um nogueira
 * dourado e escurece só nos veios.
 */
export function createFrameWoodTexture() {
  const size = 512;
  const colorCanvas = document.createElement("canvas");
  const bumpCanvas = document.createElement("canvas");
  colorCanvas.width = colorCanvas.height = size;
  bumpCanvas.width = bumpCanvas.height = size;
  const ctx = colorCanvas.getContext("2d");
  const bump = bumpCanvas.getContext("2d");

  ctx.fillStyle = "#9a6634";
  ctx.fillRect(0, 0, size, size);
  bump.fillStyle = "#8a8a8a";
  bump.fillRect(0, 0, size, size);

  for (let i = 0; i < 120; i += 1) {
    const y = (i / 120) * size;
    const wave = Math.sin(i * 0.5) * 6;
    ctx.strokeStyle = `rgba(84,48,20,${0.12 + (i % 4) * 0.035})`;
    ctx.lineWidth = 1.6 + (i % 3) * 0.7;
    ctx.beginPath();
    ctx.moveTo(0, y + wave);
    ctx.bezierCurveTo(size * 0.3, y + wave * 1.6, size * 0.7, y - wave, size, y + wave * 0.5);
    ctx.stroke();

    bump.strokeStyle = `rgba(120,120,120,${0.3 + (i % 3) * 0.06})`;
    bump.lineWidth = 1.4;
    bump.beginPath();
    bump.moveTo(0, y + wave);
    bump.bezierCurveTo(size * 0.3, y + wave * 1.6, size * 0.7, y - wave, size, y + wave * 0.5);
    bump.stroke();
  }

  // Brilho de verniz: faixas claras muito diluídas na diagonal.
  ctx.globalAlpha = 0.14;
  ctx.strokeStyle = "#e0b478";
  ctx.lineWidth = 22;
  for (let i = -2; i < 10; i += 1) {
    ctx.beginPath();
    ctx.moveTo(i * 64, 0);
    ctx.lineTo(i * 64 + 160, size);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  const map = new THREE.CanvasTexture(colorCanvas);
  const bumpMap = new THREE.CanvasTexture(bumpCanvas);
  [map, bumpMap].forEach((texture) => {
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(1.1, 1.1);
  });
  map.encoding = THREE.sRGBEncoding;
  return { map, bumpMap };
}

export function createSpriteTexture(characterId) {
  const entry = CHARACTER_ASSET_BY_ID.get(characterId);
  if (!entry) return null;
  const texture = SPRITE_TEXTURE_LOADER.load(assetUrl(`${entry.basePath}/${entry.defaultDirection}.png`));
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.encoding = THREE.sRGBEncoding;
  return texture;
}

export function wrapCenteredText(ctx, text, x, y, maxWidth, lineHeight, maxLines = 3) {
  const words = String(text).split(/\s+/);
  const lines = [];
  let line = "";
  words.forEach((word) => {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  });
  if (line) lines.push(line);
  lines.slice(0, maxLines).forEach((entry, index) => ctx.fillText(entry, x, y + index * lineHeight));
}

export function createSelectionPlaqueTexture(title, body) {
  return canvasTexture(768, 220, (ctx, width, height) => {
    const gradient = ctx.createLinearGradient(0, 0, width, 0);
    gradient.addColorStop(0, "#3d2417");
    gradient.addColorStop(0.5, "#5b3923");
    gradient.addColorStop(1, "#2a1812");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = "rgba(245,216,167,0.75)";
    ctx.lineWidth = 10;
    ctx.strokeRect(18, 18, width - 36, height - 36);
    ctx.strokeStyle = "rgba(68,34,19,0.9)";
    ctx.lineWidth = 4;
    ctx.strokeRect(34, 34, width - 68, height - 68);
    ctx.fillStyle = "#f0dcba";
    ctx.textAlign = "center";
    ctx.font = "bold 40px serif";
    ctx.fillText(title, width * 0.5, 92);
    ctx.font = "22px serif";
    ctx.fillStyle = "#dbc6a5";
    ctx.fillText(body, width * 0.5, 145);
  });
}



/* ============================================================================
   PERGAMINHO DE CONFIRMAÇÃO

   Textura de 768x1024 com o dossiê da casa: título, nome, corpo inteiro do
   personagem, citação, poder e rodapé com o lugar do selo. O sprite entra
   assíncrono, como no retrato, e só marca a textura como suja.
   ========================================================================== */

const CHARACTER_SCROLL_COPY = {
  vlad: {
    name: "Vlad Dracula",
    title: "Lord of the Night",
    quote: "The night bends to my will.",
    story: [
      "Vlad rose from a cursed bloodline and forged a kingdom out of fear, silence and moonlit promises.",
      "He expands with patience, strikes without warning, and believes every realm eventually belongs to the dark.",
    ],
  },
  maria: {
    name: "Princess Maria",
    title: "Light of the Realm",
    quote: "A crown shines brightest in the storm.",
    story: [
      "Maria was raised inside courtly ritual, yet learned early that mercy without resolve leaves a kingdom exposed.",
      "She rallies allies through hope, honour and radiant leadership, turning prosperity into strength.",
    ],
  },
  protheus: {
    name: "King Protheus",
    title: "The Old Glutton",
    quote: "A heavy crown suits a heavy appetite.",
    story: [
      "Protheus has outlived rivals, famines and rebellions by trusting indulgence as much as instinct.",
      "Beneath the laughter and excess lives a ruler who understands power, comfort and the art of lasting one more season.",
    ],
  },
  romeo: {
    name: "Young Romeo",
    title: "The Prodigy",
    quote: "One day they will all see it was obvious.",
    story: [
      "Romeo is mocked for his age only once; after that, his plans usually speak louder than his years.",
      "Quick-minded and fearless, he favours clever openings, daring gambits and victories that embarrass his elders.",
    ],
  },
  makuru: {
    name: "Goblin Makuru",
    title: "The Cunning",
    quote: "Fair trades are for slower hands.",
    story: [
      "Makuru learned survival in crowded warrens where every scrap had an owner only until he could steal it.",
      "He thrives on chaos, bargaining, misdirection and the tiny advantage nobody notices until it is too late.",
    ],
  },
  artheria: {
    name: "Elf Artheria",
    title: "Warden of the Woods",
    quote: "The forest remembers every promise.",
    story: [
      "Artheria walks with the memory of ancient groves and listens more closely to roots and wind than to kings.",
      "Measured and watchful, she bends the pace of battle in her favour and punishes impatience with elegant precision.",
    ],
  },
  muriel: {
    name: "Sorceress Muriel",
    title: "Voice of the Arcane",
    quote: "Magic is study wrapped in wonder.",
    story: [
      "Muriel devoted her life to forbidden charts, sleepless divination and the language hidden beneath chance.",
      "She approaches the table like a ritual, reading patterns before others even realise a pattern exists.",
    ],
  },
  bones: {
    name: "Skeleton Bones",
    title: "The Returned",
    quote: "I have already lost my life. What else is there to fear?",
    story: [
      "Bones remembers enough of his first death to make every second chance feel strangely practical.",
      "He is calm, stubborn and impossible to rush, turning patience into a weapon sharper than steel.",
    ],
  },
};

export function scrollCopyFor(character) {
  return CHARACTER_SCROLL_COPY[character?.id] ?? {
    name: character?.n ?? "Unknown",
    title: character?.t ?? "Wanderer",
    quote: character?.q?.[0] ?? "Every path hides a destiny.",
    story: ["No chronicle was recorded for this traveller yet."],
  };
}

export function createCharacterScrollTexture(character, perk) {
  const copy = scrollCopyFor(character);
  const paint = (ctx, sprite) => paintWritOfSelection(ctx, {
    copy,
    perk,
    accent: character?.pc ?? "#8b5a2b",
    id: character?.id ?? "unknown",
    sprite,
  });

  const texture = canvasTexture(SCROLL_CANVAS.width, SCROLL_CANVAS.height, (ctx) => paint(ctx, null));
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.anisotropy = 4;

  const canvas = texture.image;
  const ctx = canvas?.getContext?.("2d");
  let sprite = null;
  const redraw = () => {
    if (!ctx) return;
    paint(ctx, sprite);
    texture.needsUpdate = true;
  };

  /* Duas repinturas assíncronas: uma quando as fontes chegam (senão a folha sai
     em Georgia, e todo o efeito de pena se perde), outra quando o sprite
     carrega. */
  if (document.fonts?.ready) {
    document.fonts.ready.then(redraw).catch(() => {});
  }

  const entry = CHARACTER_ASSET_BY_ID.get(character?.id);
  if (!entry) return texture;

  const image = new Image();
  image.onload = () => {
    const crop = bustCrop(image, 1);
    sprite = crop
      ? { image, sx: crop.x, sy: crop.y, sw: crop.width, sh: crop.height }
      : { image, sx: 0, sy: 0, sw: image.width, sh: image.height };
    redraw();
  };
  image.src = assetUrl(`${entry.basePath}/${entry.defaultDirection}.png`);
  return texture;
}

/* ============================================================================
   LIVRO 3D DO SALÃO

   O livro físico é cenografia e ritual de entrada. O conteúdo funcional vive
   exclusivamente no LobbyCodex 2D; por isso estas folhas contêm apenas papel e
   gravuras decorativas, nunca texto/botões da interface.
   ========================================================================== */

const BOOK_SHEET_SIZE = Object.freeze({ width: 768, height: 1024 });

export const BOOK_PARCHMENT = "#e8d6b0";

/** Folha 3D em branco. O conteúdo legível pertence ao React. */
export function createBookSheetTexture(side = 1) {
  const { width, height } = BOOK_SHEET_SIZE;
  return canvasTexture(width, height, (ctx) => {
    ctx.fillStyle = BOOK_PARCHMENT;
    ctx.fillRect(0, 0, width, height);

    let seed = side < 0 ? 7717 : 24019;
    const rand = () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };
    for (let i = 0; i < 150; i += 1) {
      const x = rand() * width;
      const y = rand() * height;
      const r = 14 + rand() * 54;
      const blot = ctx.createRadialGradient(x, y, 0, x, y, r);
      blot.addColorStop(0, `rgba(158,122,68,${0.02 + rand() * 0.035})`);
      blot.addColorStop(1, "rgba(158,122,68,0)");
      ctx.fillStyle = blot;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }

    // Sem sombreado pintado: a página aberta deve manter a gravura legível.
    // O volume do livro vem da geometria/capa, não de uma mancha sobre o papel.

    // As folhas 3D são cenografia, não UI. Recebem apenas uma gravura muito
    // subtil para o livro parecer usado quando repousa aberto no salão.
    ctx.save();
    ctx.strokeStyle = "rgba(105,68,33,0.26)";
    ctx.fillStyle = "rgba(105,68,33,0.11)";
    ctx.lineWidth = 4;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    if (side < 0) {
      // Brasão dracónico: um medalhão de manuscrito, sem texto legível.
      const cx = width * 0.48;
      const cy = height * 0.43;
      const r = Math.min(width, height) * 0.245;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.82, 0, Math.PI * 2);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(cx - r * 0.44, cy + r * 0.22);
      ctx.bezierCurveTo(cx - r * 0.18, cy - r * 0.45, cx + r * 0.22, cy - r * 0.42, cx + r * 0.31, cy - r * 0.14);
      ctx.bezierCurveTo(cx + r * 0.05, cy - r * 0.02, cx + r * 0.34, cy + r * 0.08, cx + r * 0.4, cy + r * 0.34);
      ctx.bezierCurveTo(cx + r * 0.08, cy + r * 0.23, cx - r * 0.12, cy + r * 0.58, cx - r * 0.44, cy + r * 0.22);
      ctx.stroke();
      // Asa e chifres.
      ctx.beginPath();
      ctx.moveTo(cx - r * 0.04, cy - r * 0.1);
      ctx.lineTo(cx - r * 0.47, cy - r * 0.48);
      ctx.lineTo(cx - r * 0.3, cy + r * 0.02);
      ctx.moveTo(cx + r * 0.19, cy - r * 0.28);
      ctx.lineTo(cx + r * 0.36, cy - r * 0.57);
      ctx.moveTo(cx + r * 0.1, cy - r * 0.34);
      ctx.lineTo(cx + r * 0.18, cy - r * 0.62);
      ctx.stroke();

      // Filetes e pequenas marcas de códice.
      for (let y = height * 0.74; y < height * 0.88; y += 24) {
        ctx.beginPath();
        ctx.moveTo(width * 0.24, y);
        ctx.lineTo(width * (0.7 + ((y / 24) % 2) * 0.05), y);
        ctx.stroke();
      }
    } else {
      // Mapa esquemático: costa, rotas e quatro reinos marcados por círculos.
      ctx.beginPath();
      ctx.moveTo(width * 0.2, height * 0.24);
      ctx.bezierCurveTo(width * 0.4, height * 0.16, width * 0.45, height * 0.34, width * 0.68, height * 0.3);
      ctx.bezierCurveTo(width * 0.82, height * 0.37, width * 0.68, height * 0.54, width * 0.79, height * 0.65);
      ctx.bezierCurveTo(width * 0.62, height * 0.78, width * 0.43, height * 0.69, width * 0.3, height * 0.8);
      ctx.bezierCurveTo(width * 0.23, height * 0.62, width * 0.34, height * 0.48, width * 0.2, height * 0.24);
      ctx.stroke();

      const marks = [
        [0.34, 0.36], [0.61, 0.4], [0.44, 0.61], [0.67, 0.67],
      ];
      marks.forEach(([mx, my], index) => {
        const x = width * mx;
        const y = height * my;
        ctx.beginPath();
        ctx.arc(x, y, 17, 0, Math.PI * 2);
        ctx.stroke();
        if (index < marks.length - 1) {
          const [nx, ny] = marks[index + 1];
          ctx.setLineDash([8, 11]);
          ctx.beginPath();
          ctx.moveTo(x + 18, y);
          ctx.lineTo(width * nx - 18, height * ny);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      });

      // Rosa-dos-ventos.
      const rx = width * 0.74;
      const ry = height * 0.2;
      ctx.beginPath();
      ctx.arc(rx, ry, 34, 0, Math.PI * 2);
      ctx.moveTo(rx, ry - 49);
      ctx.lineTo(rx, ry + 49);
      ctx.moveTo(rx - 49, ry);
      ctx.lineTo(rx + 49, ry);
      ctx.stroke();
    }
    ctx.restore();
  });
}

/** Placa flutuante com o código da sala, ao lado do livro. */
export function createRoomCodeTexture(code = "----", copied = false) {
  return canvasTexture(512, 320, (ctx, width, height) => {
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, "#3a2417");
    gradient.addColorStop(0.5, "#5e3d22");
    gradient.addColorStop(1, "#2a180f");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = copied ? "rgba(140,214,132,0.95)" : "rgba(235,208,150,0.85)";
    ctx.lineWidth = 9;
    ctx.strokeRect(14, 14, width - 28, height - 28);

    ctx.textAlign = "center";
    ctx.fillStyle = copied ? "#8cd684" : "#c79a4e";
    ctx.font = "600 30px serif";
    ctx.fillText(copied ? t("lobby.copiedTexture") : t("lobby.realmCodeTexture"), width / 2, 84);

    ctx.fillStyle = "#fbeecb";
    ctx.font = "bold 128px serif";
    ctx.fillText((code ?? "").toUpperCase(), width / 2, 208);

    ctx.fillStyle = "#a8865a";
    ctx.font = "italic 24px serif";
    ctx.fillText("clica para copiar", width / 2, 264);
  });
}

