import {
  INK,
  INK_FONTS,
  dropCap,
  drypointGuides,
  flourish,
  foxing,
  handParagraph,
  handText,
  hashSeed,
  inkBlot,
  makeRand,
  measureHand,
  mixHex,
  printText,
  quillRule,
  roughFrame,
  ruleWithLozenge,
} from "./lobbyQuillInk.js";

/* ============================================================================
   CARTA DE SELEÇÃO

   Um documento escrito por um escrivão, não uma ficha de personagem.

   Três decisões carregam quase todo o efeito:

   1. Nada está centrado ao milímetro nem alinhado numa grelha. O bloco de texto
      inteiro está rodado uma fração de grau, porque quem escreve não alinha a
      folha com o tampo da mesa.
   2. A hierarquia é a de um manuscrito: rubrica vermelha para títulos e
      iniciais, tinta de galha para o corpo, e uma inicial grande a abrir a
      crónica.
   3. O rodapé não tem botões. Tem uma linha para assinar. Confirmar é assinar,
      e a assinatura escreve-se à frente do jogador antes de o selo cair.
   ========================================================================== */

export const SCROLL_CANVAS = Object.freeze({ width: 768, height: 1024 });

/* Plano do pergaminho em unidades de cena, para converter px <-> unidades. */
const PLANE_WIDTH = 1.9;
const PLANE_HEIGHT = 2.53;
const PX_PER_UNIT_X = SCROLL_CANVAS.width / PLANE_WIDTH;
const PX_PER_UNIT_Y = SCROLL_CANVAS.height / PLANE_HEIGHT;

const LAYOUT = Object.freeze({
  heading: 108,
  headingRule: 130,
  name: 194,
  title: 236,
  bodyTop: 288,
  columnX: 76,
  columnWidth: 396,
  portrait: { x: 496, y: 274, w: 204, h: 268 },
  giftRule: 596,
  giftHeading: 588,
  giftName: 642,
  giftBody: 684,
  motto: 776,
  footerRule: 830,
  returnLabel: 952,
});

/* Faixa da assinatura: um plano próprio, porque é a única zona do pergaminho
   que se redesenha durante a animação. Redesenhar os 768x1024 a cada frame para
   escrever um nome seria pagar a textura toda por 5% dela. */
export const SIGNATURE_STRIP = Object.freeze({
  canvasWidth: 760,
  canvasHeight: 280,
  pxBox: { x: 340, y: 856, w: 380, h: 140 },
  get planeWidth() {
    return this.pxBox.w / PX_PER_UNIT_X;
  },
  get planeHeight() {
    return this.pxBox.h / PX_PER_UNIT_Y;
  },
  /* Posição relativa à vara de baixo (origem do rodapé do pergaminho). */
  get footerX() {
    return (this.pxBox.x + this.pxBox.w / 2 - SCROLL_CANVAS.width / 2) / PX_PER_UNIT_X;
  },
  get footerY() {
    return (
      (SCROLL_CANVAS.height / 2 - (this.pxBox.y + this.pxBox.h / 2)) / PX_PER_UNIT_Y + PLANE_HEIGHT / 2
    );
  },
});

/* ----------------------------------------------------------------------------
   PAPEL
   -------------------------------------------------------------------------- */
export function paintScrollPaper(ctx, width, height) {
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#e7cfa0";
  ctx.fillRect(0, 0, width, height);

  const verticalWarm = ctx.createLinearGradient(0, 0, 0, height);
  verticalWarm.addColorStop(0, "rgba(255,247,221,0.4)");
  verticalWarm.addColorStop(0.42, "rgba(255,226,177,0.08)");
  verticalWarm.addColorStop(1, "rgba(140,86,37,0.16)");
  ctx.fillStyle = verticalWarm;
  ctx.fillRect(0, 0, width, height);

  /* Bordos enrolados: o pergaminho passou a vida em rolo e guarda a curva. */
  const rolledSides = ctx.createLinearGradient(0, 0, width, 0);
  rolledSides.addColorStop(0, "rgba(95,62,29,0.32)");
  rolledSides.addColorStop(0.08, "rgba(95,62,29,0.07)");
  rolledSides.addColorStop(0.2, "rgba(255,252,240,0.05)");
  rolledSides.addColorStop(0.8, "rgba(255,252,240,0.05)");
  rolledSides.addColorStop(0.92, "rgba(95,62,29,0.07)");
  rolledSides.addColorStop(1, "rgba(95,62,29,0.32)");
  ctx.fillStyle = rolledSides;
  ctx.fillRect(0, 0, width, height);

  const centerGlow = ctx.createRadialGradient(width * 0.5, height * 0.38, 30, width * 0.5, height * 0.46, width * 0.64);
  centerGlow.addColorStop(0, "rgba(255,249,234,0.36)");
  centerGlow.addColorStop(0.65, "rgba(255,238,205,0.1)");
  centerGlow.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = centerGlow;
  ctx.fillRect(0, 0, width, height);

  const rand = makeRand(1337);
  for (let i = 0; i < 300; i += 1) {
    const x = rand() * width;
    const y = rand() * height;
    const r = 10 + rand() * 60;
    const blot = ctx.createRadialGradient(x, y, 0, x, y, r);
    blot.addColorStop(0, `rgba(152,108,56,${0.02 + rand() * 0.05})`);
    blot.addColorStop(1, "rgba(152,108,56,0)");
    ctx.fillStyle = blot;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }

  /* Grão de pele: vitela raspada tem textura fina e direcional. */
  for (let i = 0; i < 1700; i += 1) {
    const x = (i * 73 + 11) % width;
    const y = (i * 61 + 37) % height;
    const len = 2 + (i % 4);
    ctx.strokeStyle = i % 5 ? "rgba(120,86,41,0.03)" : "rgba(255,248,228,0.022)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(i * 0.37) * len, y + Math.sin(i * 0.21) * len);
    ctx.stroke();
  }

  [
    [0, 0, width, height * 0.11, "rgba(88,54,22,0.36)"],
    [0, height * 0.95, width, height * 0.05, "rgba(88,54,22,0.28)"],
    [0, 0, width * 0.08, height, "rgba(88,54,22,0.28)"],
    [width * 0.92, 0, width * 0.08, height, "rgba(88,54,22,0.28)"],
  ].forEach(([x, y, w, h, color]) => {
    const g = x === 0 && w === width
      ? ctx.createLinearGradient(0, y, 0, y + h)
      : ctx.createLinearGradient(x, 0, x + w, 0);
    g.addColorStop(0, color);
    g.addColorStop(1, "rgba(88,54,22,0)");
    ctx.fillStyle = g;
    ctx.fillRect(x, y, w, h);
  });

  foxing(ctx, width * 0.16, height * 0.72, 90, { alpha: 0.14, seed: 91 });
  foxing(ctx, width * 0.82, height * 0.28, 76, { alpha: 0.12, seed: 92 });
}

/* Título de secção: versaletes impressos em rubrica. Blackletter a este corpo
   fecha demasiado e transforma "Chronicle" numa mancha. */
function sectionHeading(ctx, label, x, y, opts = {}) {
  const { align = "left", size = 26, seed = 1 } = opts;
  return printText(ctx, label, x, y, {
    size,
    family: INK_FONTS.print,
    color: INK.rubric,
    align,
    tracking: 2.2,
    wear: 0.22,
    alpha: 0.94,
    seed,
  });
}

/* ----------------------------------------------------------------------------
   RETRATO REGISTADO

   A moldura é traçada à mão e os cantos têm marcas de esquadro, como um
   registo oficial preenchido à pressa.
   -------------------------------------------------------------------------- */
function paintPortraitPlate(ctx, box, sprite, seed) {
  ctx.save();
  ctx.fillStyle = "rgba(81,48,25,0.06)";
  ctx.fillRect(box.x, box.y, box.w, box.h);
  ctx.restore();

  roughFrame(ctx, box.x, box.y, box.w, box.h, {
    color: INK.ironSoft,
    weight: 2.6,
    wobble: 1.6,
    alpha: 0.6,
    overshoot: 7,
    seed,
  });
  roughFrame(ctx, box.x + 9, box.y + 9, box.w - 18, box.h - 18, {
    color: INK.ironSoft,
    weight: 1.1,
    wobble: 1.2,
    alpha: 0.32,
    overshoot: 3,
    seed: seed + 3,
  });

  if (sprite?.image) {
    const inner = { x: box.x + 20, y: box.y + 18, w: box.w - 40, h: box.h - 48 };
    const scale = Math.min(inner.w / sprite.sw, inner.h / sprite.sh);
    const drawWidth = sprite.sw * scale;
    const drawHeight = sprite.sh * scale;
    const drawX = inner.x + (inner.w - drawWidth) / 2;
    const drawY = inner.y + inner.h - drawHeight;

    const shadow = ctx.createRadialGradient(
      inner.x + inner.w / 2,
      inner.y + inner.h - 4,
      3,
      inner.x + inner.w / 2,
      inner.y + inner.h - 4,
      drawWidth * 0.5,
    );
    shadow.addColorStop(0, "rgba(70,46,20,0.32)");
    shadow.addColorStop(1, "rgba(70,46,20,0)");
    ctx.fillStyle = shadow;
    ctx.fillRect(inner.x - 16, inner.y + inner.h - 22, inner.w + 32, 44);

    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(sprite.image, sprite.sx, sprite.sy, sprite.sw, sprite.sh, drawX, drawY, drawWidth, drawHeight);
    ctx.imageSmoothingEnabled = true;
  }

  /* Legenda escrita depois, mais pequena e mais torta que o resto. */
  ctx.save();
  ctx.translate(box.x + box.w / 2, box.y + box.h + 26);
  ctx.rotate(-0.022);
  handText(ctx, "registered likeness", 0, 0, {
    size: 20,
    color: INK.faded,
    align: "center",
    jitter: 1,
    tilt: 0.03,
    seed: seed + 7,
  });
  ctx.restore();
}

/* ----------------------------------------------------------------------------
   DOCUMENTO
   -------------------------------------------------------------------------- */
export function paintWritOfSelection(ctx, options = {}) {
  const {
    copy = { name: "Unknown", title: "Wanderer", quote: "", story: [] },
    perk = null,
    accent = "#8b5a2b",
    sprite = null,
    id = "unknown",
  } = options;
  const { width, height } = SCROLL_CANVAS;
  const seed = hashSeed(`${id}writ`);
  const rand = makeRand(seed);

  paintScrollPaper(ctx, width, height);

  ctx.save();
  /* A folha não está alinhada com a mesa. Meio grau é suficiente: mais que isso
     lê-se como erro, menos que isso não se lê. */
  ctx.translate(width / 2, height / 2);
  ctx.rotate(-0.0055);
  ctx.translate(-width / 2, -height / 2);

  /* --- Cabeçalho rubricado ------------------------------------------------ */
  handText(ctx, "Writ of Selection", width / 2, LAYOUT.heading, {
    size: 34,
    family: INK_FONTS.black,
    color: INK.rubric,
    align: "center",
    jitter: 0.7,
    tilt: 0.012,
    sizeVary: 0.03,
    seed: seed + 1,
  });
  ruleWithLozenge(ctx, 214, width - 214, LAYOUT.headingRule, { color: INK.rubricSoft, alpha: 0.55, weight: 2.2 });

  handText(ctx, copy.name, width / 2, LAYOUT.name, {
    size: 54,
    family: INK_FONTS.black,
    color: INK.iron,
    align: "center",
    jitter: 1.1,
    tilt: 0.014,
    sizeVary: 0.03,
    maxWidth: width - 170,
    seed: seed + 2,
  });
  handText(ctx, copy.title, width / 2, LAYOUT.title, {
    size: 31,
    color: mixHex(accent, "#31200f", 0.52),
    align: "center",
    jitter: 1.2,
    tilt: 0.028,
    sizeVary: 0.05,
    maxWidth: width - 220,
    seed: seed + 3,
  });

  /* --- Crónica ------------------------------------------------------------ */
  const col = { x: LAYOUT.columnX, w: LAYOUT.columnWidth };
  sectionHeading(ctx, "Chronicle", col.x, LAYOUT.bodyTop, { size: 27, seed: seed + 4 });
  quillRule(ctx, col.x, col.x + col.w, LAYOUT.bodyTop + 13, { color: INK.rubricSoft, alpha: 0.4, weight: 1.8 });

  const paragraphs = copy.story?.length ? copy.story : ["No chronicle was recorded for this traveller yet."];
  drypointGuides(ctx, col.x, LAYOUT.bodyTop + 52, col.w, 27, 9, { alpha: 0.065, seed: seed + 5 });

  let cursorY = LAYOUT.bodyTop + 56;
  paragraphs.forEach((paragraph, index) => {
    if (index === 0) {
      const initial = paragraph.trim().charAt(0) || "T";
      const capWidth = dropCap(ctx, initial, col.x + 2, cursorY + 27, { size: 58, seed: seed + 6 });
      const rest = paragraph.trim().slice(1);
      const result = handParagraph(ctx, rest, col.x, cursorY, {
        width: col.w,
        size: 22,
        lineHeight: 27,
        color: INK.iron,
        indents: [capWidth + 12, capWidth + 12],
        seed: seed + 7,
      });
      cursorY = result.endY + 12;
    } else {
      const result = handParagraph(ctx, paragraph, col.x, cursorY, {
        width: col.w,
        size: 22,
        lineHeight: 27,
        color: INK.iron,
        indents: [18],
        seed: seed + 8 + index,
      });
      cursorY = result.endY + 12;
    }
  });

  paintPortraitPlate(ctx, LAYOUT.portrait, sprite, seed + 20);

  /* --- Dádiva da casa ----------------------------------------------------- */
  quillRule(ctx, 78, width - 78, LAYOUT.giftRule, { color: INK.ironSoft, alpha: 0.38, weight: 2 });
  sectionHeading(ctx, "The House Gift", width / 2, LAYOUT.giftHeading, {
    align: "center",
    size: 26,
    seed: seed + 30,
  });
  handText(ctx, perk?.n ?? "sealed until the wager begins", width / 2, LAYOUT.giftName, {
    size: perk?.n ? 38 : 27,
    color: INK.iron,
    align: "center",
    jitter: 1.3,
    tilt: 0.024,
    sizeVary: 0.05,
    maxWidth: width - 200,
    seed: seed + 31,
  });
  if (perk?.d) {
    handParagraph(ctx, perk.d, width * 0.5 - 280, LAYOUT.giftBody, {
      width: 560,
      size: 21,
      lineHeight: 26,
      color: INK.ironSoft,
      maxLines: 3,
      raggedness: 0.06,
      seed: seed + 32,
    });
  }

  /* --- Divisa da casa ----------------------------------------------------- */
  const mottoText = copy.quote ? `“${copy.quote}”` : "";
  if (mottoText) {
    ctx.save();
    ctx.translate(width / 2, LAYOUT.motto);
    ctx.rotate(-0.008);
    handText(ctx, mottoText, 0, 0, {
      size: 30,
      family: INK_FONTS.hand,
      color: INK.rubricSoft,
      align: "center",
      jitter: 1.5,
      tilt: 0.03,
      sizeVary: 0.055,
      maxWidth: width - 150,
      seed: seed + 40,
    });
    ctx.restore();
    flourish(ctx, width / 2, LAYOUT.motto + 26, 1.1, { color: INK.rubricSoft, alpha: 0.45, seed: seed + 41 });
  }

  /* --- Rodapé ------------------------------------------------------------- */
  quillRule(ctx, 96, width - 96, LAYOUT.footerRule, { color: INK.ironSoft, alpha: 0.35, weight: 2.4 });

  /* "Voltar" é uma nota do próprio escrivão na margem, não um botão. */
  ctx.save();
  ctx.translate(LAYOUT.columnX - 8, LAYOUT.returnLabel);
  ctx.rotate(-0.016);
  handText(ctx, "return to the wall", 0, 0, {
    size: 25,
    color: INK.faded,
    jitter: 1.2,
    tilt: 0.03,
    seed: seed + 50,
  });
  ctx.restore();

  /* Datação, na mão do escrivão. Ocupa a faixa vazia acima da assinatura, que é
     onde um documento real põe o lugar e a data. */
  ctx.save();
  ctx.translate(LAYOUT.columnX - 4, LAYOUT.footerRule + 34);
  ctx.rotate(-0.01);
  handText(ctx, "Given at the Hall of Preparation,", 0, 0, {
    size: 20,
    color: INK.faded,
    jitter: 1,
    tilt: 0.026,
    seed: seed + 45,
  });
  handText(ctx, "on the eve of the wager.", 8, 26, {
    size: 20,
    color: INK.faded,
    jitter: 1,
    tilt: 0.026,
    seed: seed + 46,
  });
  ctx.restore();

  /* Pauta da assinatura, pintada na base para existir mesmo antes de a faixa
     animada aparecer. */
  const strip = SIGNATURE_STRIP.pxBox;
  quillRule(ctx, strip.x + 22, strip.x + strip.w - 90, strip.y + 96, {
    color: INK.ironSoft,
    alpha: 0.4,
    weight: 1.6,
    taper: false,
    seed: seed + 51,
  });

  /* Acidentes: um borrão perto do canto onde a pena descansa. */
  inkBlot(ctx, 122 + rand() * 40, LAYOUT.motto + 74, 5 + rand() * 4, { alpha: 0.34, seed: seed + 60 });
  if (rand() > 0.5) {
    inkBlot(ctx, width - 150 - rand() * 60, LAYOUT.bodyTop - 34, 3 + rand() * 3, { alpha: 0.28, seed: seed + 61 });
  }

  ctx.restore();
}

/* ----------------------------------------------------------------------------
   FAIXA DA ASSINATURA

   `progress` (0..1) escreve o nome da esquerda para a direita. `sealProgress`
   (0..1) faz cair a cera. A cera é pintada no mesmo canvas do texto de
   propósito: um objeto 3D por cima do papel foi o que fez o selo anterior
   parecer colado à frente do documento em vez de nele.
   -------------------------------------------------------------------------- */
export function paintSignatureStrip(ctx, options = {}) {
  const { name = "", progress = 0, sealProgress = 0, hover = 0, accent = "#8c1f18" } = options;
  const { canvasWidth: width, canvasHeight: height } = SIGNATURE_STRIP;
  const seed = hashSeed(`sign${name}`);
  ctx.clearRect(0, 0, width, height);

  const lineY = 196;
  const lineFrom = 44;
  const lineTo = 486;

  /* Convite, enquanto ninguém assinou. Some à medida que a pena escreve. */
  if (progress < 0.06) {
    ctx.save();
    ctx.globalAlpha = 0.5 + hover * 0.4;
    handText(ctx, "sign here to seal your choice", lineFrom + 6, lineY - 24, {
      size: 26,
      color: INK.faded,
      jitter: 1.1,
      tilt: 0.03,
      seed: seed + 1,
    });
    ctx.restore();
  }

  /* Legenda formal, sempre presente. */
  handText(ctx, "by my hand and seal", lineFrom + 6, lineY + 40, {
    size: 21,
    color: INK.faded,
    jitter: 0.9,
    tilt: 0.024,
    seed: seed + 2,
  });

  if (progress > 0) {
    const signature = name || "Anon";
    const opts = {
      size: 82,
      family: INK_FONTS.sign,
      color: INK.iron,
      jitter: 1.4,
      tilt: 0.02,
      sizeVary: 0.04,
      bleed: true,
      seed: seed + 3,
    };
    const total = Math.min(measureHand(ctx, signature, opts), lineTo - lineFrom - 20);
    const revealed = total * Math.min(1, progress / 0.82);

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, lineFrom + revealed + 2, height);
    ctx.clip();
    ctx.translate(lineFrom, lineY - 8);
    ctx.rotate(-0.03);
    /* Duas passagens desencontradas: a cursiva é de traço capilar e sozinha sai
       cinzenta em vez de tinta. */
    handText(ctx, signature, 0, 0, { ...opts, maxWidth: lineTo - lineFrom - 20 });
    handText(ctx, signature, 0.7, 0.5, {
      ...opts,
      alpha: 0.6,
      maxWidth: lineTo - lineFrom - 20,
      seed: (opts.seed ?? 1) + 9,
    });
    ctx.restore();

    /* Rabisco de remate, no fim da assinatura. */
    if (progress > 0.84) {
      const t = Math.min(1, (progress - 0.84) / 0.16);
      ctx.save();
      ctx.globalAlpha = t;
      flourish(ctx, lineFrom + total + 26, lineY - 4, 1.2, { color: INK.iron, alpha: 0.7, seed: seed + 4 });
      ctx.restore();
    }

    /* Poça de tinta na ponta da pena enquanto escreve. */
    if (progress < 0.82) {
      inkBlot(ctx, lineFrom + revealed, lineY + 2, 4.5, { alpha: 0.55, satellites: 2, seed: seed + 5 });
    }
  }

  if (sealProgress > 0) {
    paintWaxSeal(ctx, 612, lineY - 22, 66, sealProgress, accent, seed);
  }
}

/* Cera: pingo espalhado, bordo irregular, brilho baixo e uma marca de matriz
   por cima. Pintado sempre com a mesma semente para o selo do jogador ser
   reconhecível. */
function paintWaxSeal(ctx, x, y, radius, progress, accent, seed) {
  const rand = makeRand(seed + 77);
  /* Impacto: entra maior e assenta. */
  const punch = progress < 0.55 ? 1.18 - 0.18 * (progress / 0.55) : 1 + 0.02 * Math.sin((progress - 0.55) * 12);
  const scale = Math.min(1, progress * 2.2) * punch;
  if (scale <= 0.01) return;

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.globalAlpha = Math.min(1, progress * 3);

  /* Sombra de contacto, o que assenta a cera no papel. */
  const contact = ctx.createRadialGradient(0, radius * 0.2, radius * 0.4, 0, radius * 0.24, radius * 1.5);
  contact.addColorStop(0, "rgba(48,24,12,0.4)");
  contact.addColorStop(1, "rgba(48,24,12,0)");
  ctx.fillStyle = contact;
  ctx.beginPath();
  ctx.arc(0, radius * 0.2, radius * 1.5, 0, Math.PI * 2);
  ctx.fill();

  /* Corpo espalhado. */
  ctx.beginPath();
  const steps = 26;
  for (let i = 0; i <= steps; i += 1) {
    const angle = (i / steps) * Math.PI * 2;
    const r = radius * (0.86 + rand() * 0.26);
    const px = Math.cos(angle) * r;
    const py = Math.sin(angle) * r * 0.94;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  const wax = ctx.createRadialGradient(-radius * 0.3, -radius * 0.35, radius * 0.1, 0, 0, radius * 1.1);
  wax.addColorStop(0, "#b8352a");
  wax.addColorStop(0.55, "#8c1f18");
  wax.addColorStop(1, "#5c110d");
  ctx.fillStyle = wax;
  ctx.fill();

  /* Matriz: anel e coroa esquemática, impressos em relevo. */
  ctx.strokeStyle = "rgba(255,196,168,0.28)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(0, 0, radius * 0.66, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = "rgba(60,12,8,0.45)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, radius * 0.72, 0, Math.PI * 2);
  ctx.stroke();

  /* Coroa esquemática: aro, três pontas e as pérolas. Uma silhueta única saía
     como borrão ao tamanho a que o selo é visto. */
  ctx.fillStyle = "rgba(58,12,8,0.5)";
  ctx.beginPath();
  ctx.moveTo(-radius * 0.36, radius * 0.06);
  ctx.lineTo(-radius * 0.24, -radius * 0.26);
  ctx.lineTo(-radius * 0.12, -radius * 0.04);
  ctx.lineTo(0, -radius * 0.36);
  ctx.lineTo(radius * 0.12, -radius * 0.04);
  ctx.lineTo(radius * 0.24, -radius * 0.26);
  ctx.lineTo(radius * 0.36, radius * 0.06);
  ctx.closePath();
  ctx.fill();
  ctx.fillRect(-radius * 0.38, radius * 0.1, radius * 0.76, radius * 0.14);
  [[-0.24, -0.34], [0, -0.44], [0.24, -0.34]].forEach(([px, py]) => {
    ctx.beginPath();
    ctx.arc(radius * px, radius * py, radius * 0.055, 0, Math.PI * 2);
    ctx.fill();
  });

  /* Realce húmido, deslocado da fonte de luz da sala. */
  const gloss = ctx.createRadialGradient(-radius * 0.32, -radius * 0.4, 1, -radius * 0.32, -radius * 0.4, radius * 0.7);
  gloss.addColorStop(0, "rgba(255,224,206,0.24)");
  gloss.addColorStop(1, "rgba(255,224,206,0)");
  ctx.fillStyle = gloss;
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}
