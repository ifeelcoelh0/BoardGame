import * as THREE from "three";
import { material, mesh } from "./lobbyScenePrimitives.js";
import { V, ring, loft, block, meshOf } from "./lobbyCharacters.js";
import { characterDetailTextures, TEXTURE_BASE_GAIN } from "./lobbyCharacterTextures.js";
import {
  createBookSheetTexture,
  createRoomCodeTexture,
} from "./lobbySceneTextures.js";

/* ============================================================================
   LIVRO DA PARTIDA

   Volume antigo a flutuar a sul da mesa, aberto e visível como objeto do salão.
   Já não é uma superfície de UI: serve apenas de portal/ritual para o códice 2D.

   O livro permanece aberto, pequeno e suspenso sobre a mesa. O conteúdo do
   códice não depende desta geometria, por isso as folhas podem ser puramente
   decorativas e o ritual limita-se à aproximação, luz e movimento do volume.
   ========================================================================== */

export const BOOK_ANCHOR = new THREE.Vector3(0, 1.82, 4.22);
const BOOK_TILT = -0.36;
export const BOOK_READ_NORMAL = new THREE.Vector3(0, Math.sin(-BOOK_TILT), Math.cos(BOOK_TILT));
export const BOOK_VIEW_DISTANCE = 2.68;
const PAGE_WIDTH = 0.78;
const PAGE_HEIGHT = 1.04;
/* 0.13 mantinha as duas metades quase coplanares e o corte das folhas ficava
   invisível de frente. A 0.22 o livro abre o suficiente para se ver a espessura
   de cada metade sem deixar de ser legível. */
const PAGE_SPLAY = 0.16;
const FLOAT_AMPLITUDE = 0.035;

/* Espessura do bloco de folhas de cada metade.

   Andei nos dois extremos. Primeiro 0.34, que é 65 por cento da altura da página
   e não é livro nenhum. Depois 0.09, corrigindo demasiado: o pedido é um volume
   denso e antigo, e 17 por cento não o entrega. Medido nas referências, um tomo
   grosso mostra uma lombada na ordem dos 30 por cento da altura da página, e
   0.16 por metade dá 0.32, ou seja 31 por cento.

   O problema nunca foi a espessura em si, foi as margens do bloco e da capa
   estarem escritas em unidades planas: com a câmara do livro demasiado próxima,
   40 cm de profundidade inflavam a folha impressa ao ponto de ela aparecer maior
   do que a capa. As folgas passam a ser DERIVADAS da espessura e da distância
   nominal, por isso a espessura pode mudar livremente sem voltar a esse erro. */
const BLOCK_DEPTH = 0.16;
const COVER_DEPTH = 0.055;

/* Distância nominal de leitura. É a mesma usada pelo controlador para colocar a
   câmara sobre a normal da folha. */
const NOMINAL_VIEW_DISTANCE = BOOK_VIEW_DISTANCE;

/**
 * Extensão que uma peça a `depth` de profundidade precisa de ter, medida do EIXO
 * DO LIVRO, para aparecer `margin` maior do que a folha impressa.
 *
 * O tamanho aparente é `x * D / (D - z)`. Na primeira versão apliquei a correcção
 * só à meia-largura da folha e esqueci que cada metade está deslocada
 * lateralmente do eixo: esse deslocamento também está em profundidade e também
 * infla. O resultado eram 1.6 por cento de margem onde eu tinha pedido 7. Tem de
 * se corrigir a extensão total a partir do eixo, não só a meia-largura.
 */
function outerExtentFor(sheetOuter, depth, margin) {
  const D = NOMINAL_VIEW_DISTANCE;
  return sheetOuter * (1 + margin) * ((D + depth) / D);
}

/**
 * Folha curva de livro aberto.
 *
 * A folha era um `PlaneGeometry`, um retângulo perfeito, e isso está errado numa
 * folha de livro aberto: ela mergulha na goteira, ergue e alarga em direcção ao
 * corte, e o bordo exterior ondula sobre as folhas de baixo. Parte-se de um
 * plano subdividido e deslocam-se os vértices, o que preserva as UVs e portanto
 * o mapeamento da textura da página.
 */
function curvedLeafGeometry(width, height, side, opts = {}) {
  const {
    dip = 0.075,
    lift = 0.03,
    flare = 0.055,
    ripple = 0.012,
    bulge = 0.02,
    phase = 0,
  } = opts;

  const geometry = new THREE.PlaneGeometry(width, height, 18, 14);
  const position = geometry.attributes.position;

  for (let i = 0; i < position.count; i += 1) {
    const x = position.getX(i);
    const y = position.getY(i);
    const nx = x / width + 0.5;
    const ny = y / height + 0.5;
    // g: 0 na goteira, 1 no corte. A goteira da metade esquerda está do lado +x.
    const g = side < 0 ? 1 - nx : nx;
    const across = Math.sin(ny * Math.PI);

    const z =
      -dip * Math.pow(1 - g, 2.4)
      + lift * Math.pow(g, 2.2)
      + ripple * Math.sin(ny * Math.PI * 2.3 + phase) * Math.pow(g, 3);

    position.setY(i, y * (1 + flare * Math.pow(g, 1.5)));
    position.setX(i, x + side * bulge * across * Math.pow(g, 2));
    position.setZ(i, z);
  }

  geometry.computeVertexNormals();
  return geometry;
}

/** Material com grão, a partir das texturas de detalhe dos personagens. */
function grained(colour, roughness, metalness, family, bumpScale = 0.005) {
  const m = material(colour, roughness, metalness);
  m.flatShading = true;
  const fam = family ? characterDetailTextures()?.[family] : null;
  if (fam) {
    m.map = fam.map;
    m.bumpMap = fam.bumpMap;
    m.bumpScale = bumpScale;
    const peak = Math.max(m.color.r, m.color.g, m.color.b);
    m.color.multiplyScalar(Math.min(TEXTURE_BASE_GAIN, peak > 0 ? 1 / peak : 1));
  }
  return m;
}

export function createGameBook(scene) {
  const root = new THREE.Group();
  root.position.copy(BOOK_ANCHOR);
  root.rotation.x = BOOK_TILT;
  // O volume é um foco ritual no salão, não a própria interface: mais pequeno
  // deixa respirar a mesa e torna a aproximação de câmara uma intenção clara.
  root.scale.setScalar(0.64);
  scene.add(root);

  /* Couro escurecido e gasto em vez do vermelho limpo anterior, com grão. É a
     diferença entre um livro novo e um livro que já passou por várias mãos. */
  const leather = grained(0x3a1a12, 0.86, 0.04, "leather", 0.008);
  const leatherWorn = grained(0x60392a, 0.72, 0.06, "leather", 0.006);
  const gilt = grained(0xb08a42, 0.32, 0.68, "metal", 0.002);
  const brass = grained(0x8c6a34, 0.42, 0.6, "metal", 0.003);
  /* A folha impressa é pintada em #e8d6b0 pela textura do livro. O bloco tinha
     0xcfbb92 e 0xa89572, bem mais frios e mais escuros, e o resultado é a folha
     aberta a parecer de outro material. Estes dois tons são o mesmo pergaminho,
     um degrau abaixo em valor, que é o que separa sem destoar. */
  const pageEdge = grained(0xe0cda6, 0.92, 0.02, "bone", 0.004);
  const pageEdgeDark = grained(0xc9b48c, 0.94, 0.02, "bone", 0.005);

  /* As folgas são medidas do eixo do livro, porque é aí que a perspectiva actua.
     `halfOffset` é o deslocamento lateral de cada metade. */
  const halfOffset = PAGE_WIDTH / 2 + 0.012;
  const sheetOuterW = halfOffset + PAGE_WIDTH / 2;
  const sheetOuterH = PAGE_HEIGHT / 2;
  const blockOverhangW = outerExtentFor(sheetOuterW, BLOCK_DEPTH / 2, 0.07) - halfOffset;
  const blockOverhangH = outerExtentFor(sheetOuterH, BLOCK_DEPTH / 2, 0.05);
  const coverOverhangW = outerExtentFor(sheetOuterW, BLOCK_DEPTH + COVER_DEPTH / 2, 0.12) - halfOffset;
  const coverOverhangH = outerExtentFor(sheetOuterH, BLOCK_DEPTH + COVER_DEPTH / 2, 0.1);
  const pages = [];

  [-1, 1].forEach((side) => {
    const half = new THREE.Group();
    half.position.x = side * halfOffset;
    half.rotation.y = -side * PAGE_SPLAY;
    root.add(half);

    /* Folga do bloco em relação à folha impressa. Tem de ser generosa porque é
       ela que faz a folha ler como assente sobre as outras. */
    const halfW = blockOverhangW;
    const halfH = blockOverhangH;

    /* ---- bloco de folhas ----
       Era uma caixa. Um bloco de folhas tem corte arredondado do lado de fora e
       as folhas nunca estão perfeitamente alinhadas, por isso os anéis levam
       jitter: é o que dá a estriação que se lê como papel empilhado. */
    const blockRings = [
      { z: 0.004, w: 1.0, h: 1.0 },
      { z: -BLOCK_DEPTH * 0.18, w: 1.0, h: 1.0 },
      { z: -BLOCK_DEPTH * 0.5, w: 1.005, h: 1.004 },
      { z: -BLOCK_DEPTH * 0.82, w: 1.0, h: 1.0 },
      { z: -BLOCK_DEPTH, w: 0.99, h: 0.995 },
      /* 12 pontos com squareness alta, não 4.
         Com 4 pontos e `start` a zero o `ring` coloca-os nos eixos e a secção
         sai em losango, não em retângulo: foi o que fez o bloco aparecer como
         dois diamantes à frente da página. Com 12 pontos e squareness 0.9 sai um
         retângulo de cantos arredondados, que é a forma de um corte de folhas. */
    ].map(({ z, w, h }) => ring(V(0, z, 0), halfW * w, halfH * h, 16, { squareness: 0.86 }));
    const pageBlock = meshOf(
      loft(blockRings, { capStart: true, capEnd: true, jitter: 0.014, seed: 5 + side }),
      /* Corte mais escuro do que a folha impressa: sem sombras próprias, é o
         contraste de valor que faz a espessura ler-se de frente. */
      pageEdgeDark,
      false,
      false,
    );
    /* Os anéis são planos de y constante, portanto o bloco nasce ao longo de +Y
       e é deitado para o eixo do livro. Tem de ser +PI/2: a -PI/2 o +Y vai para
       -Z, os anéis negativos passam para +Z e o bloco fica à FRENTE da página. */
    pageBlock.rotation.x = Math.PI / 2;
    half.add(pageBlock);

    // Corte dourado no topo, o detalhe que identifica um volume caro e velho.
    const giltEdge = meshOf(
      loft(
        [
          ring(V(0, 0, 0), halfW * 1.001, BLOCK_DEPTH * 0.5, 10, { squareness: 0.9 }),
          ring(V(0, 0.012, 0), halfW * 0.995, BLOCK_DEPTH * 0.49, 10, { squareness: 0.9 }),
        ],
        { capEnd: true },
      ),
      gilt,
      false,
      false,
    );
    giltEdge.position.set(0, halfH - 0.006, -BLOCK_DEPTH / 2);
    half.add(giltEdge);

    /* ---- capa ----
       Caixa maior por trás do bloco, mais uma moldura em relevo. A moldura era
       antes uma única placa dourada plana atrás de tudo, invisível de frente. */
    const cover = mesh(
      new THREE.BoxGeometry(coverOverhangW * 2, coverOverhangH * 2, COVER_DEPTH),
      leather,
    );
    cover.position.z = -BLOCK_DEPTH - COVER_DEPTH / 2 + 0.01;
    half.add(cover);

    const frameW = coverOverhangW;
    const frameH = coverOverhangH;
    [
      [0, frameH - 0.05, frameW - 0.03, 0.018],
      [0, -(frameH - 0.05), frameW - 0.03, 0.018],
    ].forEach(([fx, fy, fw, fh]) => {
      const bar = block(
        V(fx - fw, fy, cover.position.z - COVER_DEPTH / 2 - 0.008),
        V(fx + fw, fy, cover.position.z - COVER_DEPTH / 2 - 0.008),
        fh, 0.02, fh, 0.02,
        gilt,
      );
      half.add(bar);
    });
    [-1, 1].forEach((fy) => {
      const bar = block(
        V(side * (frameW - 0.05), fy * (frameH - 0.05), cover.position.z - COVER_DEPTH / 2 - 0.008),
        V(side * (frameW - 0.05), -fy * (frameH - 0.05), cover.position.z - COVER_DEPTH / 2 - 0.008),
        0.018, 0.02, 0.018, 0.02,
        gilt,
      );
      half.add(bar);
      void fy;
    });

    // Cantoneiras de latão nos quatro cantos da capa.
    [[-1, -1], [-1, 1], [1, -1], [1, 1]].forEach(([cx, cy]) => {
      const boss = mesh(new THREE.BoxGeometry(0.11, 0.11, COVER_DEPTH + 0.03), brass);
      boss.position.set(cx * (frameW - 0.035), cy * (frameH - 0.035), cover.position.z - 0.006);
      half.add(boss);
      const stud = mesh(new THREE.OctahedronGeometry(0.024, 0), gilt);
      stud.position.set(cx * (frameW - 0.035), cy * (frameH - 0.035), cover.position.z - COVER_DEPTH / 2 - 0.022);
      stud.scale.set(1, 1, 0.5);
      half.add(stud);
    });

    /* Folhas de baixo, curvas e progressivamente maiores.

       Erro que cometi na primeira versão: dei-lhes um `dip` MENOR do que a folha
       impressa, a pensar que folhas mais fundas na pilha curvam menos. É o
       contrário: quanto mais funda a folha, mais perto do vinco está e mais
       mergulha. Com dip menor e um offset em z pequeno, elas rompiam até 6.7 mm à
       FRENTE da folha impressa junto à goteira, e apareciam como manchas claras
       sobre a página.

       Agora o mergulho cresce e a elevação diminui com a profundidade, e o offset
       em z garante folga. O `tools/check-book-leaves.mjs` compara o z de cada
       vértice das folhas de baixo com o da impressa, no mesmo índice paramétrico,
       e falha se alguma romper à frente. */
    [
      { grow: 0.054, dip: 0.104, lift: 0.017, phase: 1.1, z: -0.032, mat: pageEdgeDark },
      { grow: 0.036, dip: 0.094, lift: 0.021, phase: 2.4, z: -0.021, mat: pageEdge },
      { grow: 0.018, dip: 0.085, lift: 0.025, phase: 0.4, z: -0.01, mat: pageEdgeDark },
    ].forEach(({ grow, dip, lift, phase, z, mat }, layerIndex) => {
      const leaf = mesh(
        curvedLeafGeometry(PAGE_WIDTH + grow, PAGE_HEIGHT + grow * 0.8, side, /* A ondulação tem de ser menor do que metade do degrau em z entre camadas.
           A 0.013 com fases diferentes, duas folhas podiam diferir 26 mm em
           ondulação contra 9 mm de degrau, e cruzavam-se. */
        { dip, lift, phase, ripple: 0.004 }),
        mat,
        false,
        false,
      );
      leaf.name = `book-leaf-${layerIndex}`;
      leaf.position.z = z;
      half.add(leaf);
    });

    const sheetTexture = createBookSheetTexture(side);
    const pageMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      map: sheetTexture,
      // O papel aberto é cenografia ilustrada. Não recebe iluminação/sombra: o
      // utilizador preferiu preservar integralmente as gravuras e o pergaminho.
      toneMapped: false,
    });
    const page = mesh(curvedLeafGeometry(PAGE_WIDTH, PAGE_HEIGHT, side), pageMaterial, false, false);
    page.name = "book-page";
    page.position.z = 0.002;
    half.add(page);

    pages.push({ side, half, pageMaterial, sheetTexture });
  });

  /* ---- lombada ----
     Era uma caixa de 7 cm de largura e 20 cm de profundidade, mais fina do que o
     bloco de folhas que devia cobrir. Agora acompanha a espessura total e leva
     nervuras em relevo, que é a assinatura de uma encadernação cosida à mão. */
  const spineDepth = BLOCK_DEPTH + COVER_DEPTH + 0.03;
  const spine = mesh(new THREE.BoxGeometry(0.15, coverOverhangH * 2, spineDepth), leather);
  spine.position.z = -spineDepth / 2 + 0.01;
  root.add(spine);

  // Nervuras: cinco travessas a atravessar a lombada.
  [-0.38, -0.19, 0, 0.19, 0.38].forEach((t) => {
    const band = mesh(new THREE.BoxGeometry(0.185, 0.055, spineDepth * 0.94), leatherWorn);
    band.position.set(0, t * coverOverhangH * 2, spine.position.z);
    root.add(band);
    const line = mesh(new THREE.BoxGeometry(0.19, 0.008, spineDepth * 0.92), gilt);
    line.position.set(0, t * coverOverhangH * 2 + 0.036, spine.position.z);
    root.add(line);
  });

  /* ---- fecho ----
     Duas correias de couro com lingueta de latão a atravessar o corte, do lado
     de fora. Num livro aberto ficam pendentes, e é o detalhe que mais depressa
     lê como "antigo" à distância. */
  [-1, 1].forEach((cy) => {
    const strapZ = -BLOCK_DEPTH - COVER_DEPTH;
    const strap = block(
      V(0, cy * (PAGE_HEIGHT * 0.24), strapZ),
      V(PAGE_WIDTH * 1.18, cy * (PAGE_HEIGHT * 0.24) - cy * 0.06, strapZ + BLOCK_DEPTH * 0.55),
      0.075, 0.022, 0.06, 0.02,
      leatherWorn,
    );
    root.add(strap);
    const tongue = mesh(new THREE.BoxGeometry(0.075, 0.09, 0.02), brass);
    tongue.position.set(PAGE_WIDTH * 1.19, cy * (PAGE_HEIGHT * 0.24) - cy * 0.065, strapZ + BLOCK_DEPTH * 0.56);
    root.add(tongue);
  });

  // Marcador de fita, a sair de dentro do bloco.
  const ribbon = block(
    V(PAGE_WIDTH * 0.42, -PAGE_HEIGHT * 0.5 + 0.02, -0.02),
    V(PAGE_WIDTH * 0.46, -PAGE_HEIGHT * 0.86, -0.05),
    0.055, 0.008, 0.045, 0.008,
    grained(0x8e2f2a, 0.9, 0.04, "cloth", 0.004),
  );
  root.add(ribbon);
  void pageEdge;

  // Luz própria: o livro flutua, por isso tem de se explicar como objeto mágico
  // e não como livro esquecido no ar.
  const aura = new THREE.PointLight(0xffcf8a, 0.85, 2.6, 1.8);
  aura.position.set(0, 0.1, 0.55);
  root.add(aura);

  const hitMaterial = new THREE.MeshBasicMaterial({ visible: false });
  const openTarget = mesh(new THREE.PlaneGeometry(1.9, PAGE_HEIGHT + 0.16), hitMaterial, false, false);
  openTarget.userData.action = "book-open";
  openTarget.position.z = 0.08;
  root.add(openTarget);

  let interactive = true;
  let hover = 0;
  let hoverTarget = 0;
  // O ritual já não anima uma folha intermédia. Conservamos apenas o pequeno
  // reforço de emissive usado enquanto o códice está aberto, sem manter um
  // estado textual do ritual dentro do objeto 3D.

  const applyInteraction = () => {
    openTarget.visible = interactive;
  };
  applyInteraction();

  return {
    targets: [openTarget],
    setInteractive(next) {
      interactive = next === true;
      if (!interactive) hoverTarget = 0;
      applyInteraction();
    },
    setRitualState() {
      // O ritual já não altera o papel: as páginas permanecem claras.
    },
    setHover(on) {
      hoverTarget = on && interactive ? 1 : 0;
    },
    update(delta, elapsed) {
      if (hover !== hoverTarget) {
        const step = Math.min(Math.abs(hoverTarget - hover), delta * 5);
        hover += hoverTarget > hover ? step : -step;
      }

      root.position.y = BOOK_ANCHOR.y + Math.sin(elapsed * 0.9) * FLOAT_AMPLITUDE + hover * 0.06;
      root.rotation.z = Math.sin(elapsed * 0.55) * 0.014;
      aura.intensity = 0.78 + Math.sin(elapsed * 1.7) * 0.1 + hover * 0.62;
    },
    dispose() {
      pages.forEach(({ sheetTexture }) => sheetTexture?.dispose());
      hitMaterial.dispose();
    },
  };
}

/**
 * O código fica ao lado do livro e não numa página: partilhá-lo é a primeira
 * coisa que um anfitrião faz, e não deve exigir uma viagem de câmara.
 */
export function createRoomCodePlaque(scene) {
  const root = new THREE.Group();
  root.position.set(1.62, 2.06, 4.42);
  root.rotation.set(-0.3, -0.22, 0);
  scene.add(root);

  const backing = mesh(new THREE.BoxGeometry(0.62, 0.4, 0.05), material(0x3a2417, 0.76, 0.1));
  backing.position.z = -0.03;
  root.add(backing);

  const faceMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.66,
    metalness: 0.12,
    emissive: new THREE.Color(0xffd79a),
    emissiveIntensity: 0.16,
  });
  const face = mesh(new THREE.PlaneGeometry(0.58, 0.36), faceMaterial, false, false);
  face.position.z = 0.002;
  face.userData.action = "copy-code";
  root.add(face);

  let texture = null;
  let hover = 0;
  let hoverTarget = 0;

  return {
    targets: [face],
    setContent(code, copied) {
      const previous = texture;
      texture = createRoomCodeTexture(code, copied);
      faceMaterial.map = texture;
      faceMaterial.needsUpdate = true;
      previous?.dispose();
    },
    setVisible(visible) {
      root.visible = visible !== false;
    },
    setHover(on) {
      hoverTarget = on ? 1 : 0;
    },
    update(delta, elapsed) {
      if (hover !== hoverTarget) {
        const step = Math.min(Math.abs(hoverTarget - hover), delta * 5);
        hover += hoverTarget > hover ? step : -step;
      }
      root.position.y = 2.06 + Math.sin(elapsed * 1.1 + 1.2) * 0.028 + hover * 0.04;
      faceMaterial.emissiveIntensity = 0.16 + hover * 0.24;
    },
    dispose() {
      texture?.dispose();
    },
  };
}
