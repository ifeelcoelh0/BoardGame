import { GAME_UI_COLORS, GAME_UI_FONTS } from "../theme/gameVisualLanguage.js";

/* ============================================================================
   TINTA E PENA

   Motor de lettering partilhado pelos cartazes da parede e pelo pergaminho.

   O problema que resolve: `ctx.fillText` desenha tipografia perfeita — espaço
   entre letras constante, linha de base exata, densidade de tinta idêntica em
   todos os glifos. É exatamente isso que faz um pergaminho parecer uma página
   web com textura de papel por cima. Uma pena de ganso não faz nada disso:
   oscila na linha de base, roda cada letra alguns graus, descarrega muita tinta
   depois de cada mergulho no tinteiro e vai secando até ao mergulho seguinte.

   Por isso o texto é desenhado letra a letra, com jitter, rotação e alfa
   variáveis vindos de um gerador pseudo-aleatório com semente. A semente vem do
   próprio texto, o que significa que o mesmo nome escreve-se sempre da mesma
   maneira: o cartaz do Vlad não muda de aspeto entre sessões, mas é diferente
   do da Maria.

   Este módulo não toca em `document` nem em THREE de propósito — recebe um
   contexto 2D e pinta. Assim pode ser renderizado fora do browser para
   inspeção visual.
   ========================================================================== */

export const INK_FONTS = {
  /* Estes papéis tipográficos são partilhados com a UI React. */
  black: GAME_UI_FONTS.blackletter,
  hand: GAME_UI_FONTS.hand,
  print: GAME_UI_FONTS.display,
  sign: GAME_UI_FONTS.signature,
};

export const INK = {
  /* Cores físicas partilhadas com o sistema visual. */
  iron: GAME_UI_COLORS.ink,
  ironSoft: GAME_UI_COLORS.inkSoft,
  rubric: GAME_UI_COLORS.rubric,
  rubricSoft: GAME_UI_COLORS.rubricSoft,
  press: "#3a2a1e",
  faded: "#6b533a",
};

/* Mistura duas cores hex. Usado para trazer a cor da casa para a gama da tinta:
   um acento saturado pintado a cheio no pergaminho lê-se como cor de ecrã, e
   não como pigmento diluído em água. */
export function mixHex(a, b, amount = 0.5) {
  const parse = (hex) => {
    const clean = String(hex).replace("#", "");
    const full = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean;
    return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) || 0);
  };
  const [ar, ag, ab] = parse(a);
  const [br, bg, bb] = parse(b);
  const blend = (x, y) => Math.round(x + (y - x) * amount);
  return `rgb(${blend(ar, br)},${blend(ag, bg)},${blend(ab, bb)})`;
}

export function makeRand(seed = 1) {
  let s = (seed | 0) || 1;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

export function hashSeed(value) {
  const text = String(value ?? "");
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = (hash * 16777619) >>> 0;
  }
  return hash % 2147483647 || 7;
}

function fontString(size, family, weight) {
  return `${weight ? `${weight} ` : ""}${size}px ${family}`;
}

/* ----------------------------------------------------------------------------
   TEXTO MANUSCRITO

   `flow` simula o ciclo do tinteiro: a tinta vai descendo letra a letra e, ao
   chegar ao fim, a pena volta ao tinteiro e a letra seguinte sai carregada.
   O traço carregado é desenhado duas vezes com um deslocamento sub-pixel, que
   é a forma mais barata de engrossar um glifo num canvas sem ter um segundo
   peso da fonte.
   -------------------------------------------------------------------------- */
export function handText(ctx, text, x, y, opts = {}) {
  const {
    size = 24,
    family = INK_FONTS.hand,
    weight = "",
    color = INK.iron,
    align = "left",
    jitter = 0.9,
    tilt = 0.016,
    spacing = 0,
    slope = 0,
    alpha = 1,
    flow = true,
    bleed = true,
    maxWidth = null,
    seed = null,
    sizeVary = 0.035,
  } = opts;

  const label = String(text ?? "");
  if (!label) return 0;

  ctx.save();
  ctx.font = fontString(size, family, weight);
  ctx.textBaseline = "alphabetic";

  const chars = [...label];
  const widths = chars.map((ch) => ctx.measureText(ch).width + (ch === " " ? 0 : spacing));
  const natural = widths.reduce((sum, w) => sum + w, 0);
  const squeeze = maxWidth && natural > maxWidth ? maxWidth / natural : 1;
  const total = natural * squeeze;

  let cursor = align === "center" ? x - total / 2 : align === "right" ? x - total : x;
  const rand = makeRand(seed ?? hashSeed(label));
  let ink = 0.6 + rand() * 0.35;

  chars.forEach((ch, index) => {
    const advance = widths[index] * squeeze;
    if (ch !== " ") {
      if (flow) {
        ink -= 0.018 + rand() * 0.055;
        if (ink < 0.16) ink = 0.92 + rand() * 0.08;
      }
      const t = total ? (cursor - (align === "center" ? x - total / 2 : align === "right" ? x - total : x)) / total : 0;
      const drift = (rand() - 0.5) * jitter * 2 + slope * t;
      const spin = (rand() - 0.5) * tilt;

      ctx.save();
      ctx.translate(cursor + advance / 2, y + drift);
      ctx.rotate(spin);
      if (squeeze !== 1) ctx.scale(squeeze, 1);
      /* Corpo desigual: numa mão corrente as letras não têm todas a mesma
         altura, e é sobretudo isto que distingue escrita de tipografia. */
      if (sizeVary) {
        const grow = 1 + (rand() - 0.5) * sizeVary * 2;
        ctx.scale(grow, grow * (1 + (rand() - 0.5) * sizeVary));
      }
      ctx.textAlign = "center";
      ctx.fillStyle = color;
      if (bleed) {
        /* Sangramento nas fibras do papel: a tinta molhada espalha-se um
           pouco além do contorno do glifo. */
        ctx.shadowColor = color;
        ctx.shadowBlur = Math.max(0.6, size * 0.045);
      }
      ctx.globalAlpha = alpha * (0.66 + 0.34 * ink);
      ctx.fillText(ch, 0, 0);
      if (ink > 0.74) {
        ctx.shadowBlur = 0;
        ctx.globalAlpha = alpha * 0.42;
        ctx.fillText(ch, 0.55, 0.35);
      }
      ctx.restore();
    }
    cursor += advance;
  });

  ctx.restore();
  return total;
}

/* Tipo móvel: alinhamento regular (é uma máquina), mas a inking do bloco é
   irregular — algumas letras saem lavadas, outras esborratadas. */
export function printText(ctx, text, x, y, opts = {}) {
  const {
    size = 26,
    family = INK_FONTS.print,
    weight = "",
    color = INK.press,
    align = "center",
    tracking = 0,
    alpha = 1,
    maxWidth = null,
    seed = null,
    wear = 0.3,
  } = opts;

  const label = String(text ?? "");
  if (!label) return 0;

  ctx.save();
  ctx.font = fontString(size, family, weight);
  ctx.textBaseline = "alphabetic";

  const chars = [...label];
  const widths = chars.map((ch) => ctx.measureText(ch).width + tracking);
  const natural = widths.reduce((sum, w) => sum + w, 0);
  const squeeze = maxWidth && natural > maxWidth ? maxWidth / natural : 1;
  const total = natural * squeeze;
  let cursor = align === "center" ? x - total / 2 : align === "right" ? x - total : x;
  const rand = makeRand(seed ?? hashSeed(label));

  chars.forEach((ch, index) => {
    const advance = widths[index] * squeeze;
    if (ch !== " ") {
      const patchy = 1 - wear * rand();
      ctx.save();
      ctx.translate(cursor + advance / 2, y + (rand() - 0.5) * 0.5);
      if (squeeze !== 1) ctx.scale(squeeze, 1);
      ctx.textAlign = "center";
      ctx.fillStyle = color;
      ctx.globalAlpha = alpha * patchy;
      ctx.fillText(ch, 0, 0);
      /* Fantasma do segundo contacto do bloco com o papel. */
      if (rand() > 0.72) {
        ctx.globalAlpha = alpha * 0.18;
        ctx.fillText(ch, 0.8, -0.4);
      }
      ctx.restore();
    }
    cursor += advance;
  });

  ctx.restore();
  return total;
}

export function measureHand(ctx, text, opts = {}) {
  const { size = 24, family = INK_FONTS.hand, weight = "", spacing = 0 } = opts;
  ctx.save();
  ctx.font = fontString(size, family, weight);
  const width = [...String(text ?? "")].reduce(
    (sum, ch) => sum + ctx.measureText(ch).width + (ch === " " ? 0 : spacing),
    0,
  );
  ctx.restore();
  return width;
}

/* ----------------------------------------------------------------------------
   PARÁGRAFOS

   Margem direita irregular de propósito: um escrivão não justifica, e cada
   linha acaba onde a palavra seguinte já não cabe à vista. `raggedness` encurta
   aleatoriamente a largura útil de cada linha para o bordo direito nunca formar
   uma coluna reta.
   -------------------------------------------------------------------------- */
export function handParagraph(ctx, text, x, y, opts = {}) {
  const {
    width = 320,
    size = 24,
    family = INK_FONTS.hand,
    color = INK.iron,
    lineHeight = size * 1.22,
    raggedness = 0.12,
    indents = [],
    seed = null,
    slope = 0.8,
    jitter = 0.85,
    maxLines = 40,
    alpha = 1,
  } = opts;

  const rand = makeRand(seed ?? hashSeed(text));
  ctx.save();
  ctx.font = fontString(size, family, "");
  const words = String(text ?? "").split(/\s+/).filter(Boolean);

  const lines = [];
  let line = "";
  let lineIndex = 0;
  const limitFor = (index) => (width - (indents[index] ?? 0)) * (1 - rand() * raggedness);
  let limit = limitFor(0);
  words.forEach((word) => {
    const candidate = line ? `${line} ${word}` : word;
    if (ctx.measureText(candidate).width > limit && line) {
      lines.push(line);
      lineIndex += 1;
      limit = limitFor(lineIndex);
      line = word;
    } else {
      line = candidate;
    }
  });
  if (line) lines.push(line);
  ctx.restore();

  let cursorY = y;
  lines.slice(0, maxLines).forEach((lineText, index) => {
    handText(ctx, lineText, x + (indents[index] ?? 0), cursorY + (rand() - 0.5) * 1.1, {
      size,
      family,
      color,
      alpha,
      jitter,
      slope: (rand() - 0.45) * slope,
      seed: hashSeed(`${lineText}${index}`),
    });
    cursorY += lineHeight;
  });

  return { endY: cursorY, lineCount: Math.min(lines.length, maxLines) };
}

/* Inicial rubricada. Devolve a largura para o parágrafo se indentar. */
export function dropCap(ctx, letter, x, baseline, opts = {}) {
  const { size = 68, color = INK.rubric, family = INK_FONTS.black, seed = null } = opts;
  /* A inicial ocupa duas linhas e assenta na linha de base da segunda; é o que
     a faz ler como inicial em vez de letra maiúscula gigante fora de sítio. */
  const width = handText(ctx, letter, x, baseline, {
    size,
    family,
    color,
    jitter: 0.5,
    tilt: 0.01,
    seed: seed ?? hashSeed(`cap${letter}`),
  });
  return width;
}

/* ----------------------------------------------------------------------------
   TRAÇOS

   Uma régua feita com pena tem espessura variável (pressão) e não é reta.
   Desenhada como polígono preenchido porque `lineWidth` é constante ao longo
   de um `stroke`.
   -------------------------------------------------------------------------- */
export function quillRule(ctx, x1, x2, y, opts = {}) {
  const { color = INK.iron, weight = 2.2, wobble = 1.1, alpha = 0.72, seed = null, taper = true } = opts;
  const rand = makeRand(seed ?? hashSeed(`${x1}${x2}${y}`));
  const steps = 26;
  const top = [];
  const bottom = [];
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    const px = x1 + (x2 - x1) * t;
    const py = y + Math.sin(t * Math.PI * 1.8 + rand() * 0.2) * wobble;
    const pressure = taper ? Math.sin(Math.PI * Math.min(1, Math.max(0, t))) ** 0.5 : 1;
    const half = (weight * (0.45 + 0.55 * pressure)) / 2;
    top.push([px, py - half]);
    bottom.push([px, py + half]);
  }
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.beginPath();
  top.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
  [...bottom].reverse().forEach(([px, py]) => ctx.lineTo(px, py));
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/* Divisória com losango central, o remate habitual destes documentos. */
export function ruleWithLozenge(ctx, x1, x2, y, opts = {}) {
  const { color = INK.iron, alpha = 0.6, weight = 2 } = opts;
  const mid = (x1 + x2) / 2;
  quillRule(ctx, x1, mid - 14, y, { color, alpha, weight });
  quillRule(ctx, mid + 14, x2, y, { color, alpha, weight });
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(mid, y - 6);
  ctx.lineTo(mid + 6.5, y);
  ctx.lineTo(mid, y + 6);
  ctx.lineTo(mid - 6.5, y);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/* Moldura traçada à mão: quatro lados com oscilação, cantos que se cruzam. */
export function roughFrame(ctx, x, y, w, h, opts = {}) {
  const { color = INK.ironSoft, weight = 3, wobble = 2.2, alpha = 0.7, overshoot = 5, seed = null } = opts;
  const rand = makeRand(seed ?? hashSeed(`frame${x}${y}${w}${h}`));
  const over = () => overshoot * (0.4 + rand() * 0.9);
  quillRule(ctx, x - over(), x + w + over(), y, { color, weight, wobble, alpha, taper: false, seed: seed ?? 11 });
  quillRule(ctx, x - over(), x + w + over(), y + h, { color, weight, wobble, alpha, taper: false, seed: seed ?? 22 });
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(Math.PI / 2);
  quillRule(ctx, -over(), h + over(), 0, { color, weight, wobble, alpha, taper: false, seed: seed ?? 33 });
  ctx.restore();
  ctx.save();
  ctx.translate(x + w, y);
  ctx.rotate(Math.PI / 2);
  quillRule(ctx, -over(), h + over(), 0, { color, weight, wobble, alpha, taper: false, seed: seed ?? 44 });
  ctx.restore();
}

/* ----------------------------------------------------------------------------
   ACIDENTES DE TINTA
   -------------------------------------------------------------------------- */
export function inkBlot(ctx, x, y, radius, opts = {}) {
  const { color = INK.iron, alpha = 0.5, seed = null, satellites = 5 } = opts;
  const rand = makeRand(seed ?? hashSeed(`blot${x}${y}`));
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.beginPath();
  const steps = 18;
  for (let i = 0; i <= steps; i += 1) {
    const angle = (i / steps) * Math.PI * 2;
    const r = radius * (0.62 + rand() * 0.55);
    const px = x + Math.cos(angle) * r;
    const py = y + Math.sin(angle) * r * 0.86;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
  for (let i = 0; i < satellites; i += 1) {
    const angle = rand() * Math.PI * 2;
    const dist = radius * (1.3 + rand() * 2.4);
    ctx.globalAlpha = alpha * (0.25 + rand() * 0.5);
    ctx.beginPath();
    ctx.arc(x + Math.cos(angle) * dist, y + Math.sin(angle) * dist * 0.8, radius * (0.08 + rand() * 0.24), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/* Floreado de remate: usado no fim de títulos e a seguir a assinaturas. */
export function flourish(ctx, x, y, scale = 1, opts = {}) {
  const { color = INK.iron, alpha = 0.62, seed = null, weight = 1.6 } = opts;
  const rand = makeRand(seed ?? hashSeed(`flourish${x}${y}`));
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color;
  ctx.lineCap = "round";
  ctx.lineWidth = weight * scale;
  ctx.beginPath();
  ctx.moveTo(x - 34 * scale, y);
  ctx.bezierCurveTo(x - 14 * scale, y - (9 + rand() * 4) * scale, x + 12 * scale, y + 8 * scale, x + 34 * scale, y - 2 * scale);
  ctx.stroke();
  ctx.lineWidth = weight * 0.7 * scale;
  ctx.beginPath();
  ctx.moveTo(x - 20 * scale, y + 5 * scale);
  ctx.bezierCurveTo(x - 6 * scale, y + 11 * scale, x + 8 * scale, y - 2 * scale, x + 22 * scale, y + 6 * scale);
  ctx.stroke();
  ctx.restore();
}

/* Mancha de humidade / dedada gordurosa. Serve para o papel não ter zonas
   perfeitamente limpas. */
export function foxing(ctx, x, y, radius, opts = {}) {
  const { color = "150,104,52", alpha = 0.16, seed = null } = opts;
  const rand = makeRand(seed ?? hashSeed(`fox${x}${y}`));
  ctx.save();
  for (let i = 0; i < 7; i += 1) {
    const px = x + (rand() - 0.5) * radius * 1.6;
    const py = y + (rand() - 0.5) * radius * 1.6;
    const r = radius * (0.3 + rand() * 0.7);
    const grad = ctx.createRadialGradient(px, py, 0, px, py, r);
    grad.addColorStop(0, `rgba(${color},${alpha * (0.5 + rand() * 0.6)})`);
    grad.addColorStop(1, `rgba(${color},0)`);
    ctx.fillStyle = grad;
    ctx.fillRect(px - r, py - r, r * 2, r * 2);
  }
  ctx.restore();
}

/* Vinco de papel dobrado: uma linha escura com um realce imediatamente acima,
   que é o que o olho lê como relevo. */
export function crease(ctx, x1, y1, x2, y2, opts = {}) {
  const { alpha = 0.2, seed = null } = opts;
  const rand = makeRand(seed ?? hashSeed(`crease${x1}${y1}`));
  const nx = -(y2 - y1);
  const ny = x2 - x1;
  const len = Math.hypot(nx, ny) || 1;
  const ox = (nx / len) * 2.2;
  const oy = (ny / len) * 2.2;
  ctx.save();
  ctx.lineWidth = 2.4;
  ctx.strokeStyle = `rgba(255,247,224,${alpha * 0.8})`;
  ctx.beginPath();
  ctx.moveTo(x1 - ox, y1 - oy);
  ctx.bezierCurveTo(
    x1 + (x2 - x1) * 0.35 - ox,
    y1 + (y2 - y1) * 0.35 - oy + (rand() - 0.5) * 6,
    x1 + (x2 - x1) * 0.7 - ox,
    y1 + (y2 - y1) * 0.7 - oy + (rand() - 0.5) * 6,
    x2 - ox,
    y2 - oy,
  );
  ctx.stroke();
  ctx.lineWidth = 2.8;
  ctx.strokeStyle = `rgba(92,58,26,${alpha})`;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.bezierCurveTo(
    x1 + (x2 - x1) * 0.35,
    y1 + (y2 - y1) * 0.35 + (rand() - 0.5) * 6,
    x1 + (x2 - x1) * 0.7,
    y1 + (y2 - y1) * 0.7 + (rand() - 0.5) * 6,
    x2,
    y2,
  );
  ctx.stroke();
  ctx.restore();
}

/* Linhas de pauta marcadas a seco antes de escrever: quase invisíveis, mas é
   o que impede o texto de flutuar. */
export function drypointGuides(ctx, x, y, width, lineHeight, count, opts = {}) {
  const { alpha = 0.09, seed = null } = opts;
  const rand = makeRand(seed ?? hashSeed(`guide${x}${y}`));
  ctx.save();
  ctx.strokeStyle = `rgba(118,84,44,${alpha})`;
  ctx.lineWidth = 1;
  for (let i = 0; i < count; i += 1) {
    const ly = y + i * lineHeight;
    ctx.beginPath();
    ctx.moveTo(x, ly + (rand() - 0.5) * 0.8);
    ctx.lineTo(x + width, ly + (rand() - 0.5) * 1.2);
    ctx.stroke();
  }
  ctx.restore();
}
