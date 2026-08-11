import * as THREE from "three";
import { mesh } from "./lobbyScenePrimitives.js";
import { addWallTorch } from "./lobbySceneDecorations.js";
import { createPortraitTexture } from "./lobbySceneTextures.js";
import {
  POSTER_CANVAS,
  POSTER_NAILS,
  POSTER_WINDOW,
  paintClaimedStamp,
  paintWantedPoster,
  posterFamilyFor,
} from "./lobbyPosterArt.js";

const POSTER_SCALE = 0.9;
const POSTER_WIDTH = 1.12 * POSTER_SCALE;
const POSTER_HEIGHT = 1.56 * POSTER_SCALE;
const COLUMN_XS = [-2.58, -0.86, 0.86, 2.58];
const ROW_YS = [3.9, 1.82];
const POSTER_TILTS = [-0.048, 0.016, -0.022, 0.032, -0.028, 0.02, -0.016, 0.03];

export const GALLERY_FRAMING = {
  wallX: -6.61,
  centerZ: -0.18,
  centerY: (ROW_YS[0] + ROW_YS[1]) / 2,
  width: (COLUMN_XS[3] - COLUMN_XS[0]) + POSTER_WIDTH + 1.18,
  height: (ROW_YS[0] - ROW_YS[1]) + POSTER_HEIGHT + 0.92,
};

const POSTER_COPY = {
  vlad: { name: "Vlad Dracula", title: "Lord of the Night" },
  maria: { name: "Princess Maria", title: "Light of the Realm" },
  protheus: { name: "King Protheus", title: "The Old Glutton" },
  romeo: { name: "Young Romeo", title: "The Prodigy" },
  makuru: { name: "Goblin Makuru", title: "The Cunning" },
  artheria: { name: "Elf Artheria", title: "Warden of the Woods" },
  muriel: { name: "Sorceress Muriel", title: "Voice of the Arcane" },
  bones: { name: "Skeleton Bones", title: "The Returned" },
};

function copyFor(character) {
  return POSTER_COPY[character?.id] ?? {
    name: character?.n ?? "Unknown",
    title: character?.t ?? "Wanderer",
  };
}

/* A pintura vive em lobbyPosterArt.js; aqui só se monta o canvas e se espera
   pelas fontes. Sem o segundo desenho depois de `document.fonts.ready` o
   primeiro cartaz sai em Georgia, que é a fallback, e o efeito de bloco de
   madeira desaparece. */
function textureFromPainter(painter) {
  const canvas = document.createElement("canvas");
  canvas.width = POSTER_CANVAS.width;
  canvas.height = POSTER_CANVAS.height;
  const ctx = canvas.getContext("2d");
  painter(ctx);
  const texture = new THREE.CanvasTexture(canvas);
  texture.encoding = THREE.sRGBEncoding;
  texture.anisotropy = 4;
  if (document.fonts?.ready) {
    document.fonts.ready.then(() => {
      painter(ctx);
      texture.needsUpdate = true;
    }).catch(() => {});
  }
  return texture;
}

function createPosterTexture(character, index) {
  const copy = copyFor(character);
  return textureFromPainter((ctx) => paintWantedPoster(ctx, {
    name: copy.name,
    title: copy.title,
    family: posterFamilyFor(character?.id),
    id: character?.id ?? `slot${index}`,
    index,
  }));
}

let claimedTexture = null;
function getClaimedTexture() {
  if (!claimedTexture) {
    claimedTexture = textureFromPainter((ctx) => paintClaimedStamp(ctx, {
      width: POSTER_CANVAS.width,
      height: POSTER_CANVAS.height,
    }));
  }
  return claimedTexture;
}

function createPosterGeometry() {
  const geometry = new THREE.PlaneGeometry(1.1, 1.52, 14, 20);
  const positions = geometry.attributes.position;
  for (let i = 0; i < positions.count; i += 1) {
    const x = positions.getX(i);
    const y = positions.getY(i);
    let z = Math.sin((y + 0.76) * 4.7) * 0.007 + Math.sin((x + 0.55) * 5.2) * 0.005;
    /* Só está pregado em cima: os cantos de baixo levantam bastante mais, e é
       esse levantamento que dá volume ao papel sob a luz dos archotes. */
    if (Math.abs(x) > 0.4 && y > 0.58) z += 0.012;
    const bottomLift = Math.max(0, -y - 0.4) / 0.36;
    z += bottomLift * bottomLift * (0.012 + Math.abs(x) * 0.05);
    positions.setZ(i, z);
  }
  positions.needsUpdate = true;
  geometry.computeVertexNormals();
  return geometry;
}

/* Sombra de contacto. Um cartaz sem sombra própria fica com aspeto de decalque
   na textura da parede, por muito bem pintado que esteja. */
let shadowTexture = null;
function getShadowTexture() {
  if (shadowTexture) return shadowTexture;
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 160;
  const ctx = canvas.getContext("2d");
  const grad = ctx.createRadialGradient(64, 80, 10, 64, 80, 78);
  grad.addColorStop(0, "rgba(0,0,0,0.55)");
  grad.addColorStop(0.55, "rgba(0,0,0,0.3)");
  grad.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 160);
  shadowTexture = new THREE.CanvasTexture(canvas);
  return shadowTexture;
}

/* Restos de cartazes antigos arrancados. Enchem a parede entre as folhas e
   sugerem que aquele muro já teve outros nomes afixados. */
let scrapTexture = null;
function getScrapTexture() {
  if (scrapTexture) return scrapTexture;
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#d8bd8e";
  ctx.beginPath();
  ctx.moveTo(6, 4);
  ctx.lineTo(120, 12);
  ctx.lineTo(112, 74);
  ctx.lineTo(74, 58);
  ctx.lineTo(40, 92);
  ctx.lineTo(10, 62);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 0.3;
  ctx.strokeStyle = "#6d4a24";
  ctx.lineWidth = 3;
  for (let i = 0; i < 5; i += 1) {
    ctx.beginPath();
    ctx.moveTo(18, 20 + i * 9);
    ctx.lineTo(18 + 70 - i * 9, 20 + i * 9);
    ctx.stroke();
  }
  scrapTexture = new THREE.CanvasTexture(canvas);
  scrapTexture.encoding = THREE.sRGBEncoding;
  return scrapTexture;
}

function addNail(group, x, y, color = 0x6b4a2a) {
  const nail = new THREE.Group();
  nail.position.set(x, y, 0.038);
  const head = mesh(
    new THREE.CylinderGeometry(0.026, 0.03, 0.018, 10),
    new THREE.MeshStandardMaterial({ color, roughness: 0.62, metalness: 0.18 }),
  );
  head.rotation.x = Math.PI / 2;
  nail.add(head);
  const shank = mesh(
    new THREE.CylinderGeometry(0.005, 0.005, 0.06, 6),
    new THREE.MeshStandardMaterial({ color: 0x4f3521, roughness: 0.72, metalness: 0.12 }),
  );
  shank.position.z = -0.03;
  nail.add(shank);
  group.add(nail);
}

export function addCharacterSelectionWall(scene, characters, flames) {
  const gallery = new THREE.Group();
  const portraitTargets = [];
  const frames = new Map();
  gallery.position.set(GALLERY_FRAMING.wallX, 0, GALLERY_FRAMING.centerZ);
  gallery.rotation.y = Math.PI / 2;

  const posterGeo = createPosterGeometry();
  /* A janela do retrato vem do módulo de pintura: é lá que está desenhada a
     moldura impressa à volta dela, e se os dois números divergirem o retrato
     passa a flutuar dentro (ou por fora) do seu próprio cerco. */
  const portraitGeo = new THREE.PlaneGeometry(POSTER_WINDOW.planeWidth, POSTER_WINDOW.planeHeight);
  const windowY = POSTER_WINDOW.planeY;
  const shadowGeo = new THREE.PlaneGeometry(1.34, 1.78);
  const claimedGeo = new THREE.PlaneGeometry(1.1, 1.52);

  (characters ?? []).slice(0, 8).forEach((character, index) => {
    const col = index % 4;
    const row = Math.floor(index / 4);
    const poster = new THREE.Group();
    poster.position.set(COLUMN_XS[col], ROW_YS[row], 0);
    poster.scale.setScalar(POSTER_SCALE);
    poster.rotation.z = POSTER_TILTS[index] ?? 0;

    /* Sombra projetada na pedra, deslocada para baixo e para dentro: os
       archotes estão nos extremos da parede e acima da fila. */
    const shadow = mesh(
      shadowGeo,
      new THREE.MeshBasicMaterial({
        map: getShadowTexture(),
        transparent: true,
        opacity: 0.42,
        depthWrite: false,
      }),
      false,
      false,
    );
    shadow.position.set(0.03, -0.05, -0.012);
    poster.add(shadow);

    const posterMaterial = new THREE.MeshStandardMaterial({
      map: createPosterTexture(character, index),
      color: 0xffffff,
      roughness: 0.98,
      metalness: 0,
      side: THREE.DoubleSide,
      transparent: true,
      alphaTest: 0.15,
      emissive: new THREE.Color(0xffd084),
      emissiveIntensity: 0,
    });
    const posterPlane = mesh(posterGeo, posterMaterial, true, true);
    posterPlane.position.z = 0.008;
    posterPlane.userData.characterId = character?.id;
    posterPlane.userData.character = character;
    posterPlane.userData.isCharacterPortrait = true;
    portraitTargets.push(posterPlane);
    poster.add(posterPlane);

    const portraitTexture = createPortraitTexture(character);
    portraitTexture.minFilter = THREE.NearestFilter;
    portraitTexture.magFilter = THREE.NearestFilter;
    const portrait = mesh(
      portraitGeo,
      new THREE.MeshStandardMaterial({ map: portraitTexture, roughness: 0.9, metalness: 0, color: 0xf3d7ac }),
      false,
      false,
    );
    portrait.position.set(0, windowY, 0.026);
    poster.add(portrait);

    const portraitMatte = mesh(
      new THREE.PlaneGeometry(POSTER_WINDOW.planeWidth + 0.02, POSTER_WINDOW.planeHeight + 0.02),
      new THREE.MeshBasicMaterial({ color: 0x120a07, transparent: true, opacity: 0.12 }),
      false,
      false,
    );
    portraitMatte.position.set(0, windowY, 0.024);
    poster.add(portraitMatte);

    const portraitHover = mesh(
      new THREE.PlaneGeometry(POSTER_WINDOW.planeWidth + 0.06, POSTER_WINDOW.planeHeight + 0.06),
      new THREE.MeshBasicMaterial({ color: 0xf1e5c5, transparent: true, opacity: 0, depthWrite: false }),
      false,
      false,
    );
    portraitHover.position.set(0, windowY, 0.029);
    poster.add(portraitHover);

    const hoverGlow = mesh(
      new THREE.PlaneGeometry(1.12, 1.54),
      new THREE.MeshBasicMaterial({ color: 0xf0c770, transparent: true, opacity: 0, depthWrite: false }),
      false,
      false,
    );
    hoverGlow.position.set(0, 0, -0.01);
    poster.add(hoverGlow);

    /* Os pregos e os buracos rasgados na textura têm de sair da mesma tabela,
       senão o prego assenta ao lado do seu próprio buraco. */
    POSTER_NAILS.forEach((nail) => addNail(poster, nail.planeX, nail.planeY));

    /* Carimbo de reclamado. Substitui o pano com a caveira: um cartaz cujo alvo
       já foi tomado é riscado, não tapado — assim continua a dizer *quem* está
       tomado em vez de esconder a resposta debaixo do tecido. */
    const claimed = mesh(
      claimedGeo,
      /* Material iluminado, não básico: um carimbo com brilho próprio numa sala
         só com archotes lê-se como sobreposição de interface. */
      new THREE.MeshStandardMaterial({
        map: getClaimedTexture(),
        roughness: 0.96,
        metalness: 0,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      }),
      false,
      false,
    );
    claimed.position.set(0, 0, 0.032);
    claimed.visible = false;
    poster.add(claimed);

    let hover = 0;
    let hoverTarget = 0;
    let status = "free";

    frames.set(character?.id, {
      get status() { return status; },
      setStatus(next) {
        status = next;
        const taken = next === "taken";
        const local = next === "local";
        claimed.visible = taken;
        claimed.material.opacity = taken ? 0.92 : 0;
        shadow.material.opacity = taken ? 0.3 : 0.42;
        portrait.material.color.setHex(taken ? 0x9f8e7a : 0xf3d7ac);
        posterMaterial.color.setHex(taken ? 0xddd0b4 : 0xffffff);
        posterMaterial.emissiveIntensity = local ? 0.05 : 0;
        hoverGlow.material.opacity = local ? 0.08 : 0;
        portraitHover.material.opacity = local ? 0.18 : 0;
        if (taken) hoverTarget = 0;
      },
      setHover(on) {
        if (status !== "taken") hoverTarget = on ? 1 : 0;
      },
      update(delta) {
        const step = Math.min(Math.abs(hoverTarget - hover), delta * 6);
        hover += hoverTarget > hover ? step : -step;
        poster.position.z = hover * 0.026;
        poster.rotation.z = (POSTER_TILTS[index] ?? 0) + hover * 0.01;
        poster.scale.setScalar(POSTER_SCALE * (1 + hover * 0.01));
        if (status !== "local") {
          hoverGlow.material.opacity = hover * 0.045;
          portraitHover.material.opacity = hover * 0.14;
        }
      },
    });

    gallery.add(poster);
  });

  /* Vestígios de cartazes anteriores: papel rasgado e pregos que ficaram na
     pedra. Barato, e é o que faz o muro parecer usado em vez de recém-montado
     para oito folhas. */
  const scrapMaterial = new THREE.MeshStandardMaterial({
    map: getScrapTexture(),
    transparent: true,
    alphaTest: 0.2,
    roughness: 1,
    metalness: 0,
    color: 0xb9a184,
    side: THREE.DoubleSide,
  });
  [
    [-1.72, 2.94, 0.42, -0.24],
    [1.72, 2.86, 0.3, 0.36],
    [-3.5, 0.86, 0.26, 0.12],
    [0.02, 4.84, 0.34, -0.4],
    [3.46, 1.02, 0.22, 0.5],
  ].forEach(([x, y, size, spin]) => {
    const scrap = mesh(new THREE.PlaneGeometry(size, size), scrapMaterial, false, false);
    scrap.position.set(x, y, 0.004);
    scrap.rotation.z = spin;
    gallery.add(scrap);
  });
  [
    [-1.72, 3.16],
    [1.72, 3.04],
    [-3.5, 1.04],
    [0.02, 5.02],
    [3.46, 1.2],
    [-0.86, 0.6],
    [2.58, 5.02],
  ].forEach(([x, y]) => addNail(gallery, x, y, 0x51402f));

  const torchOffset = (GALLERY_FRAMING.width / 2) - 0.05;
  ROW_YS.forEach((rowY) => {
    [-1, 1].forEach((side) => {
      addWallTorch(scene, -6.48, rowY - 0.08, GALLERY_FRAMING.centerZ + side * torchOffset, flames, { rotationY: Math.PI / 2 });
    });
  });

  const washOffset = (GALLERY_FRAMING.width / 2) - 0.45;
  const washLights = [-1, 1].map((side) => {
    const wash = new THREE.SpotLight(0xffc07a, 1.08, 9.8, Math.PI * 0.32, 0.72, 1.35);
    wash.position.set(-5.95, 4.55, GALLERY_FRAMING.centerZ + side * washOffset);
    wash.target.position.set(-6.4, GALLERY_FRAMING.centerY, GALLERY_FRAMING.centerZ + side * 1.25);
    scene.add(wash, wash.target);
    return wash;
  });

  scene.add(gallery);
  return { portraitTargets, washLights, frames };
}
