/*
   Canvas 2D mínimo mas com pixels a sério, para Node.

   Existe por uma razão específica: as texturas de detalhe dos personagens são
   pintadas com a API 2D do browser, e sem isto o rasterizador offline não as
   consegue gerar nem mostrar. Um stub que não escreve pixels serve para verificar
   que o código de pintura não estoura, mas não serve para ver o resultado, e ver
   o resultado é o ponto todo.

   Implementa apenas o que as texturas usam: fillRect, linhas (moveTo, lineTo,
   bezierCurveTo, quadraticCurveTo, stroke), círculos cheios (arc + fill),
   gradiente radial, e getImageData/putImageData. Não é conforme com a spec, é
   suficiente e previsível.
*/

function parseColour(str) {
  if (typeof str !== "string") return [0, 0, 0, 1];
  const rgba = str.match(/rgba?\(([^)]+)\)/i);
  if (rgba) {
    const parts = rgba[1].split(",").map((v) => parseFloat(v.trim()));
    return [parts[0] | 0, parts[1] | 0, parts[2] | 0, parts.length > 3 ? parts[3] : 1];
  }
  const hex = str.match(/^#([0-9a-f]{6})$/i);
  if (hex) {
    const n = parseInt(hex[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 1];
  }
  return [0, 0, 0, 1];
}

class RadialGradient {
  constructor(x0, y0, r0, x1, y1, r1) {
    Object.assign(this, { x0, y0, r0, x1, y1, r1 });
    this.stops = [];
  }
  addColorStop(offset, colour) {
    this.stops.push([offset, parseColour(colour)]);
    this.stops.sort((a, b) => a[0] - b[0]);
  }
  sample(t) {
    if (!this.stops.length) return [0, 0, 0, 0];
    if (t <= this.stops[0][0]) return this.stops[0][1];
    const last = this.stops[this.stops.length - 1];
    if (t >= last[0]) return last[1];
    for (let i = 0; i < this.stops.length - 1; i += 1) {
      const [oa, ca] = this.stops[i];
      const [ob, cb] = this.stops[i + 1];
      if (t >= oa && t <= ob) {
        const k = (t - oa) / (ob - oa || 1);
        return [
          ca[0] + (cb[0] - ca[0]) * k,
          ca[1] + (cb[1] - ca[1]) * k,
          ca[2] + (cb[2] - ca[2]) * k,
          ca[3] + (cb[3] - ca[3]) * k,
        ];
      }
    }
    return last[1];
  }
}

class Context2D {
  constructor(canvas) {
    this.canvas = canvas;
    this.w = canvas.width;
    this.h = canvas.height;
    this.data = new Uint8ClampedArray(this.w * this.h * 4).fill(0);
    for (let i = 3; i < this.data.length; i += 4) this.data[i] = 255;
    this.fillStyle = "#000000";
    this.strokeStyle = "#000000";
    this.lineWidth = 1;
    this._path = [];
    this._cursor = [0, 0];
  }

  blend(x, y, colour) {
    const px = Math.round(x);
    const py = Math.round(y);
    if (px < 0 || py < 0 || px >= this.w || py >= this.h) return;
    const a = colour[3];
    if (a <= 0) return;
    const i = (py * this.w + px) * 4;
    this.data[i] = this.data[i] * (1 - a) + colour[0] * a;
    this.data[i + 1] = this.data[i + 1] * (1 - a) + colour[1] * a;
    this.data[i + 2] = this.data[i + 2] * (1 - a) + colour[2] * a;
  }

  fillRect(x, y, w, h) {
    const c = parseColour(this.fillStyle);
    for (let py = Math.floor(y); py < Math.ceil(y + h); py += 1) {
      for (let px = Math.floor(x); px < Math.ceil(x + w); px += 1) this.blend(px, py, c);
    }
  }

  beginPath() { this._path = []; }
  moveTo(x, y) { this._cursor = [x, y]; this._path.push([x, y]); }
  lineTo(x, y) { this._cursor = [x, y]; this._path.push([x, y]); }

  quadraticCurveTo(cx, cy, x, y) {
    const [x0, y0] = this._cursor;
    for (let i = 1; i <= 12; i += 1) {
      const t = i / 12;
      const u = 1 - t;
      this._path.push([
        u * u * x0 + 2 * u * t * cx + t * t * x,
        u * u * y0 + 2 * u * t * cy + t * t * y,
      ]);
    }
    this._cursor = [x, y];
  }

  bezierCurveTo(c1x, c1y, c2x, c2y, x, y) {
    const [x0, y0] = this._cursor;
    for (let i = 1; i <= 18; i += 1) {
      const t = i / 18;
      const u = 1 - t;
      this._path.push([
        u * u * u * x0 + 3 * u * u * t * c1x + 3 * u * t * t * c2x + t * t * t * x,
        u * u * u * y0 + 3 * u * u * t * c1y + 3 * u * t * t * c2y + t * t * t * y,
      ]);
    }
    this._cursor = [x, y];
  }

  arc(cx, cy, r, from, to) {
    this._circle = [cx, cy, r];
    const span = to - from;
    const steps = Math.max(8, Math.ceil(Math.abs(span) * 8));
    for (let i = 0; i <= steps; i += 1) {
      const a = from + (span * i) / steps;
      this._path.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
    }
  }

  stroke() {
    const c = parseColour(this.strokeStyle);
    const half = Math.max(0.5, this.lineWidth / 2);
    for (let i = 0; i < this._path.length - 1; i += 1) {
      const [x0, y0] = this._path[i];
      const [x1, y1] = this._path[i + 1];
      const steps = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0)));
      for (let k = 0; k <= steps; k += 1) {
        const t = k / steps;
        const x = x0 + (x1 - x0) * t;
        const y = y0 + (y1 - y0) * t;
        for (let oy = -half; oy <= half; oy += 1) {
          for (let ox = -half; ox <= half; ox += 1) this.blend(x + ox, y + oy, c);
        }
      }
    }
  }

  fill() {
    // Só é usado para preencher círculos (arc) e gradientes radiais.
    if (this.fillStyle instanceof RadialGradient) {
      const g = this.fillStyle;
      const r = g.r1;
      for (let py = Math.floor(g.y1 - r); py <= Math.ceil(g.y1 + r); py += 1) {
        for (let px = Math.floor(g.x1 - r); px <= Math.ceil(g.x1 + r); px += 1) {
          const d = Math.hypot(px - g.x1, py - g.y1);
          if (d > r) continue;
          this.blend(px, py, g.sample(d / (r || 1)));
        }
      }
      return;
    }
    if (!this._circle) return;
    const [cx, cy, r] = this._circle;
    const c = parseColour(this.fillStyle);
    for (let py = Math.floor(cy - r); py <= Math.ceil(cy + r); py += 1) {
      for (let px = Math.floor(cx - r); px <= Math.ceil(cx + r); px += 1) {
        if (Math.hypot(px - cx, py - cy) > r) continue;
        this.blend(px, py, c);
      }
    }
    this._circle = null;
  }

  createRadialGradient(x0, y0, r0, x1, y1, r1) {
    return new RadialGradient(x0, y0, r0, x1, y1, r1);
  }

  getImageData(x, y, w, h) {
    const out = new Uint8ClampedArray(w * h * 4);
    for (let py = 0; py < h; py += 1) {
      for (let px = 0; px < w; px += 1) {
        const src = ((y + py) * this.w + (x + px)) * 4;
        const dst = (py * w + px) * 4;
        out[dst] = this.data[src];
        out[dst + 1] = this.data[src + 1];
        out[dst + 2] = this.data[src + 2];
        out[dst + 3] = this.data[src + 3];
      }
    }
    return { data: out, width: w, height: h };
  }

  putImageData(image, x, y) {
    for (let py = 0; py < image.height; py += 1) {
      for (let px = 0; px < image.width; px += 1) {
        const src = (py * image.width + px) * 4;
        const dst = ((y + py) * this.w + (x + px)) * 4;
        this.data[dst] = image.data[src];
        this.data[dst + 1] = image.data[src + 1];
        this.data[dst + 2] = image.data[src + 2];
        this.data[dst + 3] = image.data[src + 3];
      }
    }
  }
}

class Canvas {
  constructor() { this.width = 0; this.height = 0; this._ctx = null; }
  getContext() {
    if (!this._ctx) this._ctx = new Context2D(this);
    return this._ctx;
  }
}

/** Instala o `document.createElement("canvas")` mínimo no global. */
export function installNodeCanvas() {
  if (typeof globalThis.document !== "undefined") return;
  globalThis.document = {
    createElement(tag) {
      if (tag !== "canvas") throw new Error(`node-canvas2d só faz canvas, pediram ${tag}`);
      return new Canvas();
    },
  };
}

/** Lê os pixels de uma textura criada por este canvas. */
export function texturePixels(texture) {
  const canvas = texture?.image;
  if (!canvas?._ctx) return null;
  return { data: canvas._ctx.data, width: canvas.width, height: canvas.height };
}
