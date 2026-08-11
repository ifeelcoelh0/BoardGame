import * as THREE from "three";

/*
   Texturas de detalhe dos personagens.

   Todas em tons de cinza em volta de 0.5, aplicadas como `map` sobre a cor do
   material. O three multiplica `map` pela `color`, portanto uma única textura de
   tecido serve os oito personagens e cada um continua a usar a sua paleta: o
   grão vem da textura, o tom vem do perfil. É a forma mais barata de sair da cor
   sólida sem duplicar assets por personagem.

   O valor médio é mantido perto de 0.5 e multiplicado por 2 no material via
   `color`, de modo a que a cor final média seja igual à cor original. Na
   prática isso faz-se pintando em volta de #808080 e deixando o material com a
   cor tal como estava, porque o multiplicador do three usa a textura já em
   sRGB: um cinza a 50 por cento escurece a cor. Para evitar isso, as texturas
   são pintadas em volta de um cinza claro (#d0d0d0) e as cores dos perfis são
   compensadas em `mat()`.
*/

/*
   Cinza neutro das texturas, sobre 255.

   Estava em 208, o que obriga a um ganho de 1.226 na cor do material para a cor
   média não escurecer. Em tons já claros (o `trim` da Maria é 0xfff0c0) esse
   ganho empurra canais acima de 1 e o realce corta, perdendo-se a variação para
   o lado claro. A 240 o ganho é 1.06 e não há corte praticamente em lado nenhum,
   que é a razão pela qual mapas de detalhe se pintam perto do branco.
*/
const BASE = 240;
export const TEXTURE_BASE_GAIN = 255 / BASE;

let cache = null;

/** Verdadeiro quando há DOM. O rasterizador offline de `tools/` corre em Node. */
function canPaint() {
  return typeof document !== "undefined" && typeof document.createElement === "function";
}

function makeCanvas(size) {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  return canvas;
}

function finish(canvas, { repeat = 1, bump = false } = {}) {
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeat, repeat);
  texture.anisotropy = 4;
  if (!bump) texture.encoding = THREE.sRGBEncoding;
  return texture;
}

/** Ruído determinístico, para a textura ser igual em todas as sessões. */
function noise(x, y, seed) {
  const v = Math.sin(x * 12.9898 + y * 78.233 + seed * 37.719) * 43758.5453;
  return v - Math.floor(v);
}

function paintGrain(ctx, size, seed, amount) {
  const image = ctx.getImageData(0, 0, size, size);
  const data = image.data;
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const i = (y * size + x) * 4;
      const n = (noise(x, y, seed) - 0.5) * amount;
      data[i] = Math.max(0, Math.min(255, data[i] + n));
      data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + n));
      data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + n));
    }
  }
  ctx.putImageData(image, 0, 0);
}

/* ---------------- tecido ---------------- */
function paintCloth(ctx, size) {
  ctx.fillStyle = `rgb(${BASE},${BASE},${BASE})`;
  ctx.fillRect(0, 0, size, size);

  // Trama: dois conjuntos de fios cruzados. Passos ímpares para não alinharem.
  const step = 5;
  ctx.lineWidth = 1;
  for (let x = 0; x < size; x += step) {
    const a = 0.05 + (x % (step * 3) === 0 ? 0.05 : 0);
    ctx.strokeStyle = `rgba(74,68,58,${a * 2.1})`;
    ctx.beginPath();
    ctx.moveTo(x + 0.5, 0);
    ctx.lineTo(x + 0.5, size);
    ctx.stroke();
  }
  for (let y = 0; y < size; y += step + 2) {
    const a = 0.05 + (y % (step * 4) === 0 ? 0.06 : 0);
    ctx.strokeStyle = `rgba(255,252,244,${a + 0.05})`;
    ctx.beginPath();
    ctx.moveTo(0, y + 0.5);
    ctx.lineTo(size, y + 0.5);
    ctx.stroke();
  }

  // Manchas largas de uso: é o que impede a superfície de ler como papel de
  // parede quando a peça é grande, como um manto.
  for (let i = 0; i < 26; i += 1) {
    const x = noise(i, 1, 3) * size;
    const y = noise(i, 2, 4) * size;
    const r = 22 + noise(i, 3, 5) * 70;
    const dark = noise(i, 4, 6) > 0.5;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, dark ? "rgba(58,52,44,0.16)" : "rgba(255,252,246,0.1)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  paintGrain(ctx, size, 11, 20);
}

/* ---------------- couro ---------------- */
function paintLeather(ctx, size) {
  ctx.fillStyle = `rgb(${BASE},${BASE},${BASE})`;
  ctx.fillRect(0, 0, size, size);

  // Poros irregulares.
  for (let i = 0; i < 2600; i += 1) {
    const x = noise(i, 7, 1) * size;
    const y = noise(i, 8, 2) * size;
    const r = 0.8 + noise(i, 9, 3) * 2.6;
    ctx.fillStyle = noise(i, 10, 4) > 0.45 ? "rgba(62,50,40,0.24)" : "rgba(255,248,236,0.12)";
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Vincos: poucos, longos e ramificados.
  for (let i = 0; i < 22; i += 1) {
    const y = noise(i, 11, 5) * size;
    ctx.strokeStyle = "rgba(50,42,34,0.3)";
    ctx.lineWidth = 1 + noise(i, 12, 6) * 1.6;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.bezierCurveTo(
      size * 0.3, y + (noise(i, 13, 7) - 0.5) * 60,
      size * 0.7, y + (noise(i, 14, 8) - 0.5) * 60,
      size, y + (noise(i, 15, 9) - 0.5) * 30,
    );
    ctx.stroke();
  }

  paintGrain(ctx, size, 23, 24);
}

/* ---------------- metal ---------------- */
function paintMetal(ctx, size) {
  ctx.fillStyle = `rgb(${BASE},${BASE},${BASE})`;
  ctx.fillRect(0, 0, size, size);

  // Escovado direccional.
  for (let i = 0; i < 900; i += 1) {
    const y = noise(i, 3, 11) * size;
    const x = noise(i, 4, 12) * size;
    const len = 12 + noise(i, 5, 13) * 90;
    ctx.strokeStyle = noise(i, 6, 14) > 0.5 ? "rgba(255,255,255,0.07)" : "rgba(48,52,62,0.13)";
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + len, y + (noise(i, 7, 15) - 0.5) * 3);
    ctx.stroke();
  }

  // Riscos fundos, poucos.
  for (let i = 0; i < 14; i += 1) {
    ctx.strokeStyle = "rgba(36,40,50,0.3)";
    ctx.lineWidth = 1.2;
    const x = noise(i, 8, 16) * size;
    const y = noise(i, 9, 17) * size;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + (noise(i, 10, 18) - 0.5) * 200, y + (noise(i, 11, 19) - 0.5) * 40);
    ctx.stroke();
  }

  paintGrain(ctx, size, 31, 9);
}

/* ---------------- pele ---------------- */
function paintSkin(ctx, size) {
  ctx.fillStyle = `rgb(${BASE},${BASE},${BASE})`;
  ctx.fillRect(0, 0, size, size);

  // Mancha muito suave. Pele com grão forte lê como pedra.
  for (let i = 0; i < 40; i += 1) {
    const x = noise(i, 21, 1) * size;
    const y = noise(i, 22, 2) * size;
    const r = 30 + noise(i, 23, 3) * 90;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, noise(i, 24, 4) > 0.5 ? "rgba(182,132,112,0.1)" : "rgba(255,246,238,0.055)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  paintGrain(ctx, size, 41, 7);
}

/* ---------------- cabelo ---------------- */
function paintHair(ctx, size) {
  ctx.fillStyle = `rgb(${BASE},${BASE},${BASE})`;
  ctx.fillRect(0, 0, size, size);

  // Fios direccionais, que é o que separa cabelo de tecido a esta escala.
  for (let i = 0; i < 1400; i += 1) {
    const x = noise(i, 51, 1) * size;
    const y = noise(i, 52, 2) * size;
    const len = 20 + noise(i, 53, 3) * 120;
    const light = noise(i, 54, 4) > 0.52;
    ctx.strokeStyle = light ? "rgba(255,248,232,0.1)" : "rgba(38,28,20,0.2)";
    ctx.lineWidth = 0.9 + noise(i, 55, 5) * 1.5;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + len * 0.5, y + (noise(i, 56, 6) - 0.5) * 10, x + len, y + (noise(i, 57, 7) - 0.5) * 6);
    ctx.stroke();
  }

  paintGrain(ctx, size, 61, 18);
}

/* ---------------- osso ---------------- */
function paintBone(ctx, size) {
  ctx.fillStyle = `rgb(${BASE},${BASE},${BASE})`;
  ctx.fillRect(0, 0, size, size);

  // Salpicos e fissuras finas.
  for (let i = 0; i < 1500; i += 1) {
    const x = noise(i, 71, 1) * size;
    const y = noise(i, 72, 2) * size;
    ctx.fillStyle = noise(i, 73, 3) > 0.6 ? "rgba(84,80,74,0.22)" : "rgba(255,255,250,0.1)";
    ctx.beginPath();
    ctx.arc(x, y, 0.7 + noise(i, 74, 4) * 1.8, 0, Math.PI * 2);
    ctx.fill();
  }
  for (let i = 0; i < 30; i += 1) {
    ctx.strokeStyle = "rgba(76,72,66,0.26)";
    ctx.lineWidth = 0.9;
    const x = noise(i, 75, 5) * size;
    const y = noise(i, 76, 6) * size;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + (noise(i, 77, 7) - 0.5) * 90, y + (noise(i, 78, 8) - 0.5) * 90);
    ctx.stroke();
  }

  paintGrain(ctx, size, 81, 16);
}

/**
 * Constrói (e guarda em cache) o conjunto de texturas de detalhe.
 *
 * Devolve `null` quando não há DOM, para o módulo poder ser importado em Node
 * pelas ferramentas de render offline sem estourar. Os materiais tratam o `null`
 * como "sem mapa" e ficam em cor sólida, que é exactamente o comportamento
 * anterior.
 */
export function characterDetailTextures() {
  if (cache !== undefined && cache !== null) return cache;
  if (!canPaint()) return null;

  const size = 512;
  const build = (painter, opts) => {
    const canvas = makeCanvas(size);
    painter(canvas.getContext("2d"), size);
    return { map: finish(canvas, opts), bumpMap: finish(canvas, { ...opts, bump: true }) };
  };

  cache = {
    cloth: build(paintCloth, { repeat: 1 }),
    leather: build(paintLeather, { repeat: 1 }),
    metal: build(paintMetal, { repeat: 1 }),
    skin: build(paintSkin, { repeat: 1 }),
    hair: build(paintHair, { repeat: 1 }),
    bone: build(paintBone, { repeat: 1 }),
  };
  return cache;
}

export function clearCharacterDetailTextureCache() {
  cache = null;
}

export function disposeCharacterDetailTextures() {
  if (!cache) return;
  Object.values(cache).forEach((entry) => {
    entry.map?.dispose();
    entry.bumpMap?.dispose();
  });
  clearCharacterDetailTextureCache();
}
