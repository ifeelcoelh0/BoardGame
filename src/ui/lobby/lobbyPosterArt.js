import {
  INK,
  INK_FONTS,
  crease,
  flourish,
  foxing,
  handText,
  hashSeed,
  inkBlot,
  makeRand,
  printText,
  quillRule,
  roughFrame,
  ruleWithLozenge,
} from "./lobbyQuillInk.js";

/* ============================================================================
   CARTAZ DE CAPTURA

   A ideia que faz isto ler como objeto real: o cartaz é *impresso* mas está
   *preenchido à mão*. O bloco de madeira imprime o que é igual em todos os
   cartazes — WANTED, DEAD OR ALIVE, a moldura, o rodapé — e deixa espaços em
   branco com pautas. O escrivão da guarda escreve depois o nome, o epíteto e a
   recompensa com pena, torto, com tinta mais escura, a transbordar ligeiramente
   da pauta.

   Sem esse contraste entre os dois registos o cartaz parece um cartão
   desenhado de uma vez, que é o que acontecia antes.

   Coordenadas em pixéis de canvas 768x1024. A janela do retrato é ocupada por
   um plano 3D separado, por isso é deixada livre e só recebe moldura.
   ========================================================================== */

export const POSTER_CANVAS = Object.freeze({ width: 768, height: 1024 });

/* Três lotes de papel diferentes: a guarda não imprimiu tudo no mesmo dia.
   Agrupados por afinidade de personagem para a parede ter blocos de tom em vez
   de oito folhas iguais. */
const FAMILY_BY_ID = {
  vlad: "gothic",
  muriel: "gothic",
  bones: "gothic",
  maria: "royal",
  protheus: "royal",
  romeo: "rustic",
  makuru: "rustic",
  artheria: "rustic",
};

export const POSTER_FAMILIES = {
  royal: {
    paperTop: "#f1ddb3",
    paperMid: "#e7cb97",
    paperBottom: "#d2ae79",
    ink: "#4e2610",
    line: "#87592e",
    portraitLine: "#7b4f24",
    shadow: 0x4c2b18,
  },
  gothic: {
    paperTop: "#ead5aa",
    paperMid: "#dbc093",
    paperBottom: "#c59d70",
    ink: "#3c1d1c",
    line: "#71503e",
    portraitLine: "#654839",
    shadow: 0x291918,
  },
  rustic: {
    paperTop: "#efd9af",
    paperMid: "#e0c291",
    paperBottom: "#ca9f69",
    ink: "#553015",
    line: "#866035",
    portraitLine: "#74572d",
    shadow: 0x3d2518,
  },
};

export function posterFamilyFor(id) {
  return POSTER_FAMILIES[FAMILY_BY_ID[id] ?? "rustic"];
}

/* Janela do retrato em fração do plano do cartaz (1.1 x 1.52 unidades). */
export const POSTER_WINDOW = Object.freeze({
  planeWidth: 0.6,
  planeHeight: 0.64,
  planeY: 0.143,
});

/* Orçamento vertical do cartaz, em pixéis de canvas. Fixo e explícito porque a
   janela do retrato é um plano 3D separado: se estes números derivassem uns dos
   outros, mexer no retrato empurrava o rodapé para fora do papel. */
const LAYOUT = Object.freeze({
  wanted: 152,
  order: 182,
  windowTop: 200,
  deadOrAlive: 678,
  nameLine: 736,
  title: 782,
  rewardLabel: 824,
  rewardValue: 866,
  rule: 896,
  realm: 930,
});

const WINDOW_PX = (() => {
  const perX = POSTER_CANVAS.width / 1.1;
  const perY = POSTER_CANVAS.height / 1.52;
  const w = POSTER_WINDOW.planeWidth * perX;
  const h = POSTER_WINDOW.planeHeight * perY;
  const cy = POSTER_CANVAS.height / 2 - POSTER_WINDOW.planeY * perY;
  return { x: POSTER_CANVAS.width / 2 - w / 2, y: cy - h / 2, w, h };
})();

/* Pregos: posição no plano e o buraco correspondente no papel. */
export const POSTER_NAILS = Object.freeze([
  { planeX: -0.3, planeY: 0.665 },
  { planeX: 0.3, planeY: 0.665 },
]);

function nailPx(nail) {
  return {
    x: POSTER_CANVAS.width / 2 + nail.planeX * (POSTER_CANVAS.width / 1.1),
    y: POSTER_CANVAS.height / 2 - nail.planeY * (POSTER_CANVAS.height / 1.52),
  };
}

/* Bordo irregular: papel cortado à mão, não guilhotinado. */
function raggedPath(ctx, width, height, inset, rand) {
  /* Papel cortado à faca: bordo quase reto com mordidas ocasionais. A versão
     anterior ondulava tanto que lia como nuvem em vez de folha. */
  const nick = () => (rand() > 0.86 ? 3 + rand() * 5 : 0);
  const points = [];
  for (let x = inset; x <= width - inset; x += 22) {
    points.push([x, inset + Math.sin(x * 0.021) * 1.6 + nick()]);
  }
  for (let y = inset; y <= height - inset; y += 22) {
    points.push([width - inset - Math.cos(y * 0.024) * 1.8 - nick(), y]);
  }
  for (let x = width - inset; x >= inset; x -= 22) {
    points.push([x, height - inset - Math.sin(x * 0.019) * 1.8 - nick()]);
  }
  for (let y = height - inset; y >= inset; y -= 22) {
    points.push([inset + Math.cos(y * 0.026) * 1.6 + nick(), y]);
  }
  ctx.beginPath();
  points.forEach(([x, y], index) => (index ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
}

function paintPaper(ctx, width, height, family, rand) {
  const base = ctx.createLinearGradient(0, 0, 0, height);
  base.addColorStop(0, family.paperTop);
  base.addColorStop(0.52, family.paperMid);
  base.addColorStop(1, family.paperBottom);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, width, height);

  const bloom = ctx.createRadialGradient(width * 0.48, height * 0.36, 20, width * 0.5, height * 0.46, width * 0.64);
  bloom.addColorStop(0, "rgba(255,248,230,0.4)");
  bloom.addColorStop(0.65, "rgba(255,236,199,0.11)");
  bloom.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = bloom;
  ctx.fillRect(0, 0, width, height);

  const sideShade = ctx.createLinearGradient(0, 0, width, 0);
  sideShade.addColorStop(0, "rgba(97,63,30,0.16)");
  sideShade.addColorStop(0.14, "rgba(97,63,30,0.02)");
  sideShade.addColorStop(0.86, "rgba(97,63,30,0.02)");
  sideShade.addColorStop(1, "rgba(97,63,30,0.14)");
  ctx.fillStyle = sideShade;
  ctx.fillRect(0, 0, width, height);

  /* Fibras: papel de trapo tem fio visível. */
  for (let i = 0; i < 1800; i += 1) {
    const x = (i * 79 + 17) % width;
    const y = (i * 53 + 29) % height;
    const len = 2 + (i % 5);
    const alpha = 0.02 + (i % 4) * 0.006;
    ctx.strokeStyle = i % 6 ? `rgba(121,86,44,${alpha})` : `rgba(255,248,233,${alpha * 0.85})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(i * 0.37) * len, y + Math.sin(i * 0.19) * len);
    ctx.stroke();
  }

  /* Manchas de humidade em três zonas escolhidas pela semente do cartaz. */
  for (let i = 0; i < 3; i += 1) {
    foxing(ctx, rand() * width, rand() * height, 60 + rand() * 70, {
      alpha: 0.13 + rand() * 0.1,
      seed: hashSeed(`fox${i}${width}`),
    });
  }

  /* Sujidade acumulada no bordo de baixo, que é o que toca nas mãos e na
     parede. */
  const grime = ctx.createLinearGradient(0, height, 0, height - 150);
  grime.addColorStop(0, "rgba(84,52,22,0.3)");
  grime.addColorStop(1, "rgba(84,52,22,0)");
  ctx.fillStyle = grime;
  ctx.fillRect(0, height - 150, width, 150);

  const vignette = ctx.createRadialGradient(width * 0.5, height * 0.5, width * 0.16, width * 0.5, height * 0.5, width * 0.72);
  vignette.addColorStop(0, "rgba(0,0,0,0)");
  vignette.addColorStop(1, "rgba(96,63,33,0.24)");
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, width, height);
}

/* Cerco impresso: linha grossa por fora, fina por dentro, com quebras onde o
   bloco não pegou. */
function paintPrintedBorder(ctx, width, height, family, rand) {
  const outer = { x: 66, y: 72, w: width - 132, h: height - 148 };
  ctx.save();
  ctx.globalAlpha = 0.82;
  ctx.strokeStyle = family.line;
  ctx.lineWidth = 8;
  ctx.strokeRect(outer.x, outer.y, outer.w, outer.h);
  ctx.lineWidth = 2;
  ctx.globalAlpha = 0.5;
  ctx.strokeStyle = family.ink;
  ctx.strokeRect(outer.x + 11, outer.y + 11, outer.w - 22, outer.h - 22);
  ctx.restore();

  /* Falhas de impressão: pequenos rasgos claros sobre o cerco. */
  ctx.save();
  ctx.strokeStyle = "rgba(255,248,228,0.22)";
  ctx.lineWidth = 5;
  for (let i = 0; i < 4; i += 1) {
    const side = Math.floor(rand() * 4);
    const t = 0.12 + rand() * 0.76;
    const len = 8 + rand() * 26;
    ctx.beginPath();
    if (side === 0) {
      ctx.moveTo(outer.x + outer.w * t, outer.y);
      ctx.lineTo(outer.x + outer.w * t + len, outer.y);
    } else if (side === 1) {
      ctx.moveTo(outer.x + outer.w, outer.y + outer.h * t);
      ctx.lineTo(outer.x + outer.w, outer.y + outer.h * t + len);
    } else if (side === 2) {
      ctx.moveTo(outer.x + outer.w * t, outer.y + outer.h);
      ctx.lineTo(outer.x + outer.w * t + len, outer.y + outer.h);
    } else {
      ctx.moveTo(outer.x, outer.y + outer.h * t);
      ctx.lineTo(outer.x, outer.y + outer.h * t + len);
    }
    ctx.stroke();
  }
  ctx.restore();

  /* Losangos nos cantos, o ornamento tipográfico mais comum destas folhas. */
  [
    [outer.x, outer.y],
    [outer.x + outer.w, outer.y],
    [outer.x, outer.y + outer.h],
    [outer.x + outer.w, outer.y + outer.h],
  ].forEach(([x, y]) => {
    ctx.save();
    ctx.globalAlpha = 0.6;
    ctx.fillStyle = family.ink;
    ctx.beginPath();
    ctx.moveTo(x, y - 7);
    ctx.lineTo(x + 7, y);
    ctx.lineTo(x, y + 7);
    ctx.lineTo(x - 7, y);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  });
}

function paintWindowFrame(ctx, family) {
  const pad = 16;
  const box = { x: WINDOW_PX.x - pad, y: WINDOW_PX.y - pad, w: WINDOW_PX.w + pad * 2, h: WINDOW_PX.h + pad * 2 };
  /* Chapa ligeiramente mais escura por baixo do retrato, para o plano 3D não
     acabar num bordo abrupto. */
  ctx.save();
  ctx.fillStyle = "rgba(84,54,26,0.09)";
  ctx.fillRect(box.x, box.y, box.w, box.h);
  ctx.globalAlpha = 0.8;
  ctx.strokeStyle = family.portraitLine;
  ctx.lineWidth = 4;
  ctx.strokeRect(box.x, box.y, box.w, box.h);
  ctx.lineWidth = 1.4;
  ctx.globalAlpha = 0.45;
  ctx.strokeRect(box.x + 6, box.y + 6, box.w - 12, box.h - 12);
  ctx.restore();
}

function paintNailHole(ctx, x, y, rand) {
  ctx.save();
  /* Rasgo em L: o papel cede pelo lado onde o peso puxa. */
  ctx.globalCompositeOperation = "destination-out";
  ctx.lineWidth = 2.4;
  ctx.strokeStyle = "rgba(0,0,0,1)";
  ctx.beginPath();
  ctx.moveTo(x - 1, y - 5);
  ctx.lineTo(x + 1 + (rand() - 0.5) * 3, y + 9 + rand() * 7);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x, y, 3.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = 0.32;
  ctx.strokeStyle = "rgba(74,46,20,1)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y, 6.5, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function tearCorner(ctx, width, height, corner, rand) {
  if (corner === "none") return;
  const size = 62 + rand() * 54;
  ctx.save();
  ctx.globalCompositeOperation = "destination-out";
  ctx.beginPath();
  if (corner === "bottom-right") {
    ctx.moveTo(width, height - size);
    ctx.lineTo(width - size * (0.5 + rand() * 0.4), height);
    ctx.lineTo(width, height);
  } else {
    ctx.moveTo(0, height - size);
    ctx.lineTo(size * (0.5 + rand() * 0.4), height);
    ctx.lineTo(0, height);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function rewardFor(seed) {
  const rand = makeRand(seed);
  /* As primeiras saídas de um gerador linear ainda estão correlacionadas com a
     semente, e por isso oito cartazes diferentes acabavam quase todos com a
     mesma recompensa. Descartar algumas descorrelaciona. */
  for (let i = 0; i < 4; i += 1) rand();
  const steps = [150, 200, 300, 400, 500, 600, 800, 1000];
  return steps[Math.floor(rand() * steps.length)];
}

/* ----------------------------------------------------------------------------
   PINTURA PRINCIPAL
   -------------------------------------------------------------------------- */
export function paintWantedPoster(ctx, options = {}) {
  const {
    name = "Unknown",
    title = "Wanderer",
    family,
    id = "unknown",
    index = 0,
  } = options;
  const { width, height } = POSTER_CANVAS;
  const seed = hashSeed(`${id}poster`);
  const rand = makeRand(seed);

  ctx.clearRect(0, 0, width, height);
  ctx.save();
  raggedPath(ctx, width, height, 30, makeRand(seed + 5));
  ctx.clip();

  paintPaper(ctx, width, height, family, rand);
  paintPrintedBorder(ctx, width, height, family, makeRand(seed + 9));

  /* --- Cabeça impressa ---------------------------------------------------- */
  let wantedSize = 108;
  ctx.font = `400 ${wantedSize}px ${INK_FONTS.black}`;
  while (ctx.measureText("Wanted").width > width - 200 && wantedSize > 62) {
    wantedSize -= 2;
    ctx.font = `400 ${wantedSize}px ${INK_FONTS.black}`;
  }
  /* Duas passagens: o bloco de madeira imprime com pressão desigual e o
     resultado é mais escuro e mais gordo que uma passagem única de fillText. */
  printText(ctx, "Wanted", width / 2, LAYOUT.wanted, {
    size: wantedSize,
    family: INK_FONTS.black,
    color: family.ink,
    tracking: 2,
    wear: 0.22,
    seed: seed + 1,
  });
  printText(ctx, "Wanted", width / 2 + 0.9, LAYOUT.wanted + 0.6, {
    size: wantedSize,
    family: INK_FONTS.black,
    color: family.ink,
    tracking: 2,
    wear: 0.5,
    alpha: 0.55,
    seed: seed + 11,
  });
  printText(ctx, "by order of the crown", width / 2, LAYOUT.order, {
    size: 22,
    color: family.ink,
    alpha: 0.78,
    tracking: 3.4,
    wear: 0.34,
    seed: seed + 2,
  });

  paintWindowFrame(ctx, family);

  /* --- Rodapé impresso --------------------------------------------------- */
  printText(ctx, "dead or alive", width / 2, LAYOUT.deadOrAlive, {
    size: 32,
    color: family.ink,
    tracking: 6,
    wear: 0.22,
    seed: seed + 3,
  });

  /* Pauta em branco onde o escrivão escreve o nome. */
  ctx.save();
  ctx.globalAlpha = 0.42;
  ctx.strokeStyle = family.line;
  ctx.lineWidth = 1.8;
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(120, LAYOUT.nameLine);
  ctx.lineTo(width - 120, LAYOUT.nameLine);
  ctx.stroke();
  ctx.restore();

  /* --- Preenchimento manuscrito ------------------------------------------ */
  ctx.save();
  /* O escrivão escreve ligeiramente inclinado sobre a pauta e transborda-a. */
  ctx.translate(width / 2, LAYOUT.nameLine);
  ctx.rotate(-0.013 + (rand() - 0.5) * 0.016);
  handText(ctx, name, 0, -7, {
    size: 56,
    family: INK_FONTS.hand,
    color: INK.iron,
    align: "center",
    jitter: 2.1,
    tilt: 0.038,
    sizeVary: 0.055,
    maxWidth: width - 180,
    seed: hashSeed(`${id}name`),
  });
  ctx.restore();

  handText(ctx, title, width / 2, LAYOUT.title, {
    size: 33,
    family: INK_FONTS.hand,
    color: INK.ironSoft,
    align: "center",
    jitter: 1.3,
    tilt: 0.03,
    sizeVary: 0.045,
    maxWidth: width - 200,
    seed: hashSeed(`${id}title`),
  });

  /* --- Recompensa -------------------------------------------------------- */
  printText(ctx, "reward", width / 2, LAYOUT.rewardLabel, {
    size: 23,
    color: family.ink,
    alpha: 0.8,
    tracking: 5,
    wear: 0.3,
    seed: seed + 4,
  });
  handText(ctx, `${rewardFor(seed)} crowns`, width / 2, LAYOUT.rewardValue, {
    size: 42,
    family: INK_FONTS.hand,
    color: INK.iron,
    align: "center",
    jitter: 1.7,
    tilt: 0.034,
    sizeVary: 0.05,
    seed: hashSeed(`${id}reward`),
  });

  ruleWithLozenge(ctx, 176, width - 176, LAYOUT.rule, { color: family.line, alpha: 0.55, weight: 2.4 });
  printText(ctx, "known throughout the realm", width / 2, LAYOUT.realm, {
    size: 23,
    color: family.ink,
    alpha: 0.7,
    tracking: 2.6,
    wear: 0.34,
    seed: seed + 6,
  });

  /* --- Acidentes e desgaste --------------------------------------------- */
  const creaseX = 250 + rand() * 260;
  crease(ctx, creaseX, 30, creaseX + (rand() - 0.5) * 40, height - 30, { alpha: 0.13, seed: seed + 7 });
  const creaseY = 300 + rand() * 320;
  crease(ctx, 30, creaseY, width - 30, creaseY + (rand() - 0.5) * 26, { alpha: 0.1, seed: seed + 8 });

  /* Marca de copo: um anel, não uma mancha cheia. */
  const ringX = 110 + rand() * (width - 220);
  const ringY = 690 + rand() * 230;
  ctx.save();
  ctx.strokeStyle = "rgba(126,84,38,0.15)";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(ringX, ringY, 32 + rand() * 22, 0.4, Math.PI * 1.85);
  ctx.stroke();
  ctx.restore();

  if (rand() > 0.4) {
    inkBlot(ctx, 96 + rand() * 90, LAYOUT.realm + 20 + rand() * 30, 4 + rand() * 5, {
      alpha: 0.4,
      seed: seed + 10,
    });
  }

  POSTER_NAILS.forEach((nail, nailIndex) => {
    const px = nailPx(nail);
    paintNailHole(ctx, px.x, px.y, makeRand(seed + 20 + nailIndex));
  });

  tearCorner(ctx, width, height, ["none", "bottom-right", "bottom-left", "none"][index % 4], makeRand(seed + 30));

  ctx.restore();
}

/* ----------------------------------------------------------------------------
   SELO DE "TOMADO"

   Substitui o pano com a caveira que tapava o cartaz. Um cartaz cujo alvo já
   foi reclamado é riscado e estampado, não coberto: continua legível, e o
   jogador percebe *quem* está tomado sem ter de adivinhar por baixo do tecido.
   -------------------------------------------------------------------------- */
export function paintClaimedStamp(ctx, options = {}) {
  const { width = 768, height = 1024, label = "claimed", seed = 4242 } = options;
  const rand = makeRand(seed);
  ctx.clearRect(0, 0, width, height);

  ctx.save();
  ctx.translate(width / 2, height * 0.6);
  ctx.rotate(-0.21);

  /* Cerco do carimbo, com o traço a falhar como tinta seca. */
  ctx.strokeStyle = "rgba(150,32,22,0.82)";
  ctx.lineWidth = 9;
  ctx.beginPath();
  ctx.rect(-286, -86, 572, 172);
  ctx.stroke();
  ctx.strokeStyle = "rgba(150,32,22,0.5)";
  ctx.lineWidth = 3;
  ctx.strokeRect(-270, -70, 540, 140);

  printText(ctx, label, 0, 28, {
    size: 106,
    family: INK_FONTS.black,
    color: "rgba(150,32,22,0.88)",
    tracking: 6,
    wear: 0.5,
    maxWidth: 510,
    seed: seed + 1,
  });
  ctx.restore();

  ctx.save();
  /* Riscado por cima do nome escrito à mão, não por cima do papel em geral. */
  quillRule(ctx, 118, width - 118, LAYOUT.nameLine - 4, {
    color: "rgba(150,32,22,0.7)",
    weight: 6,
    wobble: 3,
    alpha: 0.7,
    seed: seed + 2,
  });
  ctx.restore();

  /* Tinta em falta: rasga o carimbo para não parecer um decalque digital. */
  ctx.save();
  ctx.globalCompositeOperation = "destination-out";
  for (let i = 0; i < 220; i += 1) {
    const x = rand() * width;
    const y = height * 0.3 + rand() * height * 0.55;
    const r = 2 + rand() * 9;
    ctx.globalAlpha = 0.25 + rand() * 0.6;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  flourish(ctx, width / 2, height * 0.86, 1.4, { color: "rgba(150,32,22,0.45)", seed: seed + 3 });
}
