import * as THREE from "three";
import { material, mesh } from "./lobbyScenePrimitives.js";
import { createCharacterScrollTexture, scrollCopyFor } from "./lobbySceneTextures.js";
import { SIGNATURE_STRIP, paintSignatureStrip } from "./lobbyScrollArt.js";

/* ============================================================================
   PERGAMINHO DE CONFIRMAÇÃO

   Passo intermédio da seleção: clicar num retrato abre este pergaminho à frente
   da parede com o dossiê da casa e o personagem de corpo inteiro. Selar
   confirma, voltar cancela.

   Vive na cena e não em DOM de propósito — o objetivo do lobby é reduzir
   painéis, e um painel HTML por cima da parede seria trocar o problema de sítio.

   O desenrolar não escala a textura, recorta-a: repeat.y e offset.y acompanham
   a altura visível, para o texto não aparecer esmagado durante a animação.
   ========================================================================== */

const SCROLL_WIDTH = 1.9;
const SCROLL_HEIGHT = 2.53;
const ROD_LENGTH = SCROLL_WIDTH + 0.22;
const TOP_Y = SCROLL_HEIGHT / 2;
const OPEN_SPEED = 2.6;
const READY_AT = 0.86;
/* Tempos da assinatura, em segundos. A pena escreve, descansa um instante, e só
   depois a cera cai — é a pausa que faz o gesto ler como dois atos. */
const WRITE_TIME = 1.05;
const SEAL_DELAY = 0.16;
const SEAL_TIME = 0.42;
const AFTER_SEAL = 0.34;

export function createCharacterScroll(scene, framing) {
  const group = new THREE.Group();
  group.position.set(framing.wallX + 2.4, framing.centerY, framing.centerZ);
  group.rotation.y = Math.PI / 2;
  group.visible = false;

  const parchmentMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.94,
    metalness: 0,
    side: THREE.FrontSide,
    transparent: true,
    opacity: 1,
  });
  const parchment = mesh(new THREE.PlaneGeometry(SCROLL_WIDTH, SCROLL_HEIGHT), parchmentMaterial, false, false);
  group.add(parchment);

  const rodMaterial = material(0x5a3a1e, 0.78, 0.08);
  const capMaterial = material(0xbf9750, 0.32, 0.7);
  const buildRod = () => {
    const rod = new THREE.Group();
    const bar = mesh(new THREE.CylinderGeometry(0.055, 0.055, ROD_LENGTH, 10), rodMaterial, false, false);
    bar.rotation.z = Math.PI / 2;
    rod.add(bar);
    [-1, 1].forEach((side) => {
      const cap = mesh(new THREE.SphereGeometry(0.075, 10, 8), capMaterial, false, false);
      cap.position.x = (side * ROD_LENGTH) / 2;
      rod.add(cap);
    });
    return rod;
  };

  const topRod = buildRod();
  topRod.position.y = TOP_Y + 0.05;
  group.add(topRod);

  const bottomRod = buildRod();
  group.add(bottomRod);

  // Rodapé: linha de assinatura à direita, nota de "voltar" à esquerda, ambas
  // sobre as palavras já pintadas na textura. Acompanham a vara de baixo.
  const footer = new THREE.Group();
  group.add(footer);

  /* Faixa da assinatura: um canvas próprio, redesenhado só durante a animação.
     O selo é pintado neste mesmo canvas de propósito. Antes era um cilindro com
     um toro e uma esfera por cima do papel, e por muito bem iluminado que
     estivesse leu-se sempre como objeto pousado à frente do documento — não
     como cera prensada nele. */
  const signatureCanvas = document.createElement("canvas");
  signatureCanvas.width = SIGNATURE_STRIP.canvasWidth;
  signatureCanvas.height = SIGNATURE_STRIP.canvasHeight;
  const signatureCtx = signatureCanvas.getContext("2d");
  const signatureTexture = new THREE.CanvasTexture(signatureCanvas);
  signatureTexture.encoding = THREE.sRGBEncoding;
  signatureTexture.anisotropy = 4;

  const signaturePlane = mesh(
    new THREE.PlaneGeometry(SIGNATURE_STRIP.planeWidth, SIGNATURE_STRIP.planeHeight),
    new THREE.MeshBasicMaterial({ map: signatureTexture, transparent: true, depthWrite: false }),
    false,
    false,
  );
  signaturePlane.position.set(SIGNATURE_STRIP.footerX, SIGNATURE_STRIP.footerY, 0.014);
  footer.add(signaturePlane);

  let signatureName = "";
  let signHover = 0;
  const redrawSignature = (progress, sealProgress) => {
    paintSignatureStrip(signatureCtx, {
      name: signatureName,
      progress,
      sealProgress,
      hover: signHover,
    });
    signatureTexture.needsUpdate = true;
  };

  const hitMaterial = new THREE.MeshBasicMaterial({ visible: false });
  const sealTarget = mesh(
    new THREE.PlaneGeometry(SIGNATURE_STRIP.planeWidth, SIGNATURE_STRIP.planeHeight),
    hitMaterial,
    false,
    false,
  );
  sealTarget.position.set(SIGNATURE_STRIP.footerX, SIGNATURE_STRIP.footerY, 0.07);
  sealTarget.userData.action = "confirm";
  sealTarget.userData.tooltip = "Sign to seal your choice";
  footer.add(sealTarget);

  const cancelTarget = mesh(new THREE.PlaneGeometry(0.62, 0.12), hitMaterial, false, false);
  cancelTarget.position.set(-0.48, 0.178, 0.07);
  cancelTarget.userData.action = "cancel";
  cancelTarget.userData.tooltip = "Return to the wall";
  footer.add(cancelTarget);

  // Luz própria: sem ela o pergaminho ficava à mercê das velas da parede, que
  // estão atrás dele.
  const readingLight = new THREE.SpotLight(0xfff0cf, 0, 6.4, Math.PI * 0.34, 0.6, 1.3);
  readingLight.position.set(group.position.x + 1.9, framing.centerY + 1.5, framing.centerZ + 0.4);
  readingLight.target.position.copy(group.position);
  scene.add(readingLight, readingLight.target);

  scene.add(group);

  const textureCache = new Map();
  let openness = 0;
  let target = 0;
  let currentCharacter = null;

  /* Estado da assinatura. `signElapsed` é o relógio do gesto todo — escrever,
     prensar e a pausa final — e só no fim se chama o callback. Confirmar
     imediatamente no clique fazia a animação acontecer depois da decisão já
     estar tomada, o que é o mesmo que não a ter. */
  let signing = false;
  let signElapsed = 0;
  let signDone = null;

  const signPhases = () => {
    const write = Math.min(1, signElapsed / WRITE_TIME);
    const sealStart = WRITE_TIME + SEAL_DELAY;
    const seal = signElapsed <= sealStart ? 0 : Math.min(1, (signElapsed - sealStart) / SEAL_TIME);
    return { write, seal, finished: signElapsed >= sealStart + SEAL_TIME + AFTER_SEAL };
  };

  const applyOpenness = () => {
    const k = Math.max(openness, 0.001);
    parchment.scale.y = k;
    parchment.position.y = TOP_Y - (SCROLL_HEIGHT * k) / 2;
    if (parchmentMaterial.map) {
      parchmentMaterial.map.repeat.y = k;
      parchmentMaterial.map.offset.y = 1 - k;
    }
    bottomRod.position.y = TOP_Y - SCROLL_HEIGHT * k;
    footer.position.y = TOP_Y - SCROLL_HEIGHT * k;
    footer.visible = openness > READY_AT;
    readingLight.intensity = 1.5 * openness;
  };

  applyOpenness();

  return {
    get isOpen() {
      return target > 0;
    },
    get isReady() {
      return openness > READY_AT;
    },
    get characterId() {
      return currentCharacter?.id ?? null;
    },
    get isSigning() {
      return signing;
    },
    get isAnimating() {
      return signing || openness !== target;
    },
    targets: [sealTarget, cancelTarget],
    /* Passar o rato pela linha realça o convite a assinar. */
    setSignHover(on) {
      const next = on && !signing ? 1 : 0;
      if (next === signHover) return;
      signHover = next;
      if (!signing) redrawSignature(0, 0);
    },
    sign(onComplete) {
      if (signing || !currentCharacter) return false;
      signing = true;
      signElapsed = 0;
      signHover = 0;
      signDone = onComplete ?? null;
      redrawSignature(0, 0);
      return true;
    },
    show(character, perk) {
      if (!character) return;
      currentCharacter = character;
      let texture = textureCache.get(character.id);
      if (!texture) {
        texture = createCharacterScrollTexture(character, perk);
        textureCache.set(character.id, texture);
      }
      parchmentMaterial.map = texture;
      parchmentMaterial.needsUpdate = true;
      /* Cada personagem assina com o seu próprio nome, e a folha abre sempre
         por assinar. */
      signing = false;
      signElapsed = 0;
      signDone = null;
      signHover = 0;
      // O nome assinado tem de ser o mesmo que o documento declara em cima,
      // senão a assinatura parece de outra pessoa.
      signatureName = scrollCopyFor(character).name;
      redrawSignature(0, 0);
      group.visible = true;
      target = 1;
      applyOpenness();
    },
    hide() {
      target = 0;
      signing = false;
      signDone = null;
    },
    update(delta) {
      if (signing) {
        signElapsed += delta;
        const { write, seal, finished } = signPhases();
        redrawSignature(write, seal);
        if (finished) {
          signing = false;
          const done = signDone;
          signDone = null;
          done?.();
        }
      }
      if (openness === target) return;
      const step = OPEN_SPEED * delta;
      openness = openness < target ? Math.min(target, openness + step) : Math.max(target, openness - step);
      if (openness === 0) {
        group.visible = false;
        currentCharacter = null;
      }
      applyOpenness();
    },
    dispose() {
      textureCache.forEach((texture) => texture.dispose());
      textureCache.clear();
      signatureTexture.dispose();
      signDone = null;
      signing = false;
    },
  };
}
