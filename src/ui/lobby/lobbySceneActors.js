import * as THREE from "three";
import { material, mesh } from "./lobbyScenePrimitives.js";
import { createChairWoodTextures } from "./lobbySceneTextures.js";
import { createSeatedCharacter, createLobbyChair, tintChair, updateCharacter, disposeObject, SEAT_RADIUS, SEAT_PHASE } from "./lobbyCharacters.js";

const AVATAR_VARIANTS = [
  { gender: "male", skin: 0xc58f69, cloth: 0x31506d, hair: 0x2b1a12 },
  { gender: "female", skin: 0xd3a17c, cloth: 0x5f3443, hair: 0x6f321c },
  { gender: "male", skin: 0xa96f52, cloth: 0x4c5632, hair: 0x1c1612 },
  { gender: "female", skin: 0xe0b38f, cloth: 0x34455f, hair: 0xb48a59 },
];

const HUMAN_PROFILES = [
  {
    id: "broad-guard",
    gender: "male",
    skin: 0xb87957,
    hair: 0x25170f,
    primary: 0x2d4a64,
    secondary: 0x1a2735,
    leather: 0x58351f,
    metal: 0x8b744f,
    shoulderWidth: 0.62,
    torsoScale: [1.02, 1.0, 0.96],
    headScale: [0.9, 0.92, 0.9],
    pose: "table",
    hairStyle: "short",
    beard: "full",
  },
  {
    id: "quiet-scholar",
    gender: "female",
    skin: 0xd7a47e,
    hair: 0x3c2019,
    primary: 0x6b3f57,
    secondary: 0x362131,
    leather: 0x4b2d21,
    metal: 0xb19055,
    shoulderWidth: 0.54,
    torsoScale: [0.9, 1.02, 0.92],
    headScale: [0.88, 0.94, 0.88],
    pose: "composed",
    hairStyle: "bob",
    beard: null,
  },
  {
    id: "lean-traveller",
    gender: "male",
    skin: 0x946247,
    hair: 0x171311,
    primary: 0x556245,
    secondary: 0x2c3422,
    leather: 0x654225,
    metal: 0x756d58,
    shoulderWidth: 0.56,
    torsoScale: [0.92, 1.04, 0.92],
    headScale: [0.88, 0.92, 0.88],
    pose: "relaxed",
    hairStyle: "hood",
    beard: "short",
  },
  {
    id: "watchful-rider",
    gender: "female",
    skin: 0xe0b18b,
    hair: 0x7a5a39,
    primary: 0x4e4f67,
    secondary: 0x252c3a,
    leather: 0x68402a,
    metal: 0xa78347,
    shoulderWidth: 0.55,
    torsoScale: [0.92, 1.0, 0.9],
    headScale: [0.9, 0.95, 0.9],
    pose: "alert",
    hairStyle: "ponytail",
    beard: null,
  },
];

export function addFacialDetails(headGroup, profile, skinMaterial, hairMaterial) {
  const eyeMaterial = material(0x17120f, 0.85);
  const browMaterial = material(0x241915, 0.92);

  const jaw = mesh(new THREE.BoxGeometry(0.18, 0.09, 0.15), skinMaterial);
  jaw.position.set(0, -0.13, -0.05);
  jaw.rotation.x = -0.08;
  headGroup.add(jaw);

  const cheek = mesh(new THREE.BoxGeometry(0.2, 0.12, 0.08), skinMaterial);
  cheek.position.set(0, -0.03, -0.14);
  cheek.rotation.x = -0.06;
  headGroup.add(cheek);

  [-0.165, 0.165].forEach((x) => {
    const ear = mesh(new THREE.SphereGeometry(0.028, 5, 4), skinMaterial, false, false);
    ear.position.set(x, -0.015, 0.01);
    ear.scale.set(0.75, 1.05, 0.55);
    headGroup.add(ear);
  });

  [-0.078, 0.078].forEach((x) => {
    const eye = mesh(new THREE.SphereGeometry(0.022, 6, 5), eyeMaterial, false, false);
    eye.position.set(x, 0.03, -0.225);
    eye.scale.set(1.08, 0.7, 0.45);
    headGroup.add(eye);

    const brow = mesh(new THREE.BoxGeometry(0.06, 0.012, 0.02), browMaterial, false, false);
    brow.position.set(x, 0.072, -0.195);
    brow.rotation.z = x < 0 ? 0.08 : -0.08;
    headGroup.add(brow);
  });

  const nose = mesh(new THREE.ConeGeometry(0.03, 0.09, 5), skinMaterial);
  nose.position.set(0, -0.005, -0.235);
  nose.rotation.x = -Math.PI / 2;
  headGroup.add(nose);

  const mouth = mesh(new THREE.BoxGeometry(0.075, 0.014, 0.018), material(profile.gender === "female" ? 0x8f5b56 : 0x6f473c, 0.92), false, false);
  mouth.position.set(0, -0.09, -0.205);
  headGroup.add(mouth);

  if (profile.beard) {
    const beard = mesh(new THREE.ConeGeometry(profile.beard === "full" ? 0.12 : 0.095, profile.beard === "full" ? 0.18 : 0.11, 6), hairMaterial);
    beard.position.set(0, -0.135, -0.13);
    beard.rotation.x = Math.PI;
    headGroup.add(beard);
    if (profile.beard === "full") {
      const moustache = mesh(new THREE.BoxGeometry(0.11, 0.02, 0.03), hairMaterial);
      moustache.position.set(0, -0.05, -0.215);
      headGroup.add(moustache);
    }
  }
}

export function addHair(headGroup, profile, hairMaterial) {
  if (profile.hairStyle === "hood") {
    const hood = mesh(new THREE.SphereGeometry(0.28, 8, 6, 0, Math.PI * 2, 0, Math.PI * 0.72), material(profile.secondary, 0.92));
    hood.position.y = 0.02;
    hood.scale.set(1.08, 1.04, 1.08);
    headGroup.add(hood);
    return;
  }

  const cap = mesh(new THREE.SphereGeometry(0.25, 8, 6, 0, Math.PI * 2, 0, Math.PI * 0.62), hairMaterial);
  cap.position.y = 0.05;
  headGroup.add(cap);

  if (profile.hairStyle === "short") {
    const sideburnLeft = mesh(new THREE.BoxGeometry(0.06, 0.16, 0.05), hairMaterial);
    sideburnLeft.position.set(-0.13, -0.02, -0.06);
    headGroup.add(sideburnLeft);
    const sideburnRight = mesh(new THREE.BoxGeometry(0.06, 0.16, 0.05), hairMaterial);
    sideburnRight.position.set(0.13, -0.02, -0.06);
    headGroup.add(sideburnRight);
    const back = mesh(new THREE.BoxGeometry(0.22, 0.12, 0.09), hairMaterial);
    back.position.set(0, -0.02, 0.12);
    headGroup.add(back);
  }

  if (profile.hairStyle === "bob") {
    [-0.14, 0.14].forEach((x) => {
      const side = mesh(new THREE.BoxGeometry(0.09, 0.24, 0.08), hairMaterial);
      side.position.set(x, -0.05, -0.02);
      side.rotation.z = x > 0 ? -0.05 : 0.05;
      headGroup.add(side);
    });
    const back = mesh(new THREE.BoxGeometry(0.26, 0.18, 0.1), hairMaterial);
    back.position.set(0, -0.07, 0.12);
    headGroup.add(back);
  }

  if (profile.hairStyle === "ponytail") {
    const tail = mesh(new THREE.CylinderGeometry(0.04, 0.065, 0.33, 6), hairMaterial);
    tail.position.set(0, -0.08, 0.18);
    tail.rotation.x = 0.32;
    headGroup.add(tail);
    const clasp = mesh(new THREE.TorusGeometry(0.045, 0.012, 5, 8), material(profile.metal, 0.45, 0.35));
    clasp.position.set(0, 0.0, 0.16);
    clasp.rotation.x = Math.PI / 2;
    headGroup.add(clasp);
  }
}

export function createArm(profile, side, skinMaterial, clothMaterial, leatherMaterial) {
  const arm = new THREE.Group();
  const shoulderX = side * profile.shoulderWidth * 0.5;
  arm.position.set(shoulderX, 1.38, -0.06);

  const upper = mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.42, 6), clothMaterial);
  upper.position.y = -0.18;
  arm.add(upper);

  const elbow = new THREE.Group();
  elbow.position.y = -0.38;
  arm.add(elbow);

  const cuff = mesh(new THREE.CylinderGeometry(0.084, 0.094, 0.08, 6), leatherMaterial);
  cuff.position.y = -0.02;
  elbow.add(cuff);

  const forearm = mesh(new THREE.CylinderGeometry(0.06, 0.078, 0.34, 6), skinMaterial);
  forearm.position.y = -0.18;
  elbow.add(forearm);

  const hand = mesh(new THREE.BoxGeometry(0.12, 0.08, 0.16), skinMaterial);
  hand.position.set(0, -0.36, -0.01);
  hand.rotation.x = 0.08;
  elbow.add(hand);

  if (profile.pose === "table") {
    arm.rotation.set(-0.32, side * 0.04, side * 0.16);
    elbow.rotation.set(-0.84, 0, side * 0.06);
  } else if (profile.pose === "composed") {
    arm.rotation.set(side < 0 ? -0.55 : -0.22, 0, side < 0 ? 0.34 : 0.1);
    elbow.rotation.set(side < 0 ? -0.72 : -0.38, 0, side < 0 ? 0.22 : 0.08);
  } else if (profile.pose === "relaxed") {
    arm.rotation.set(side < 0 ? -0.42 : -0.1, 0, side < 0 ? 0.2 : -0.02);
    elbow.rotation.set(side < 0 ? -0.65 : -0.12, 0, side < 0 ? 0.08 : -0.04);
  } else {
    arm.rotation.set(side > 0 ? -0.34 : -0.52, 0, side > 0 ? -0.18 : 0.24);
    elbow.rotation.set(side > 0 ? -0.82 : -0.56, 0, side > 0 ? -0.08 : 0.1);
  }

  return arm;
}

export function addLowPolyHuman(scene, slot, occupied = false) {
  const angle = [Math.PI, Math.PI / 2, 0, -Math.PI / 2][slot];
  const radius = 3.75;
  const position = new THREE.Vector3(Math.sin(angle) * radius, 0, Math.cos(angle) * radius);
  const profile = HUMAN_PROFILES[slot];

  const chair = new THREE.Group();
  chair.position.copy(position);
  chair.rotation.y = angle;
  const chairTexture = createChairWoodTextures();
  const chairWood = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: chairTexture.map,
    bumpMap: chairTexture.bumpMap,
    bumpScale: 0.055,
    roughnessMap: chairTexture.roughnessMap,
    roughness: 0.83,
    metalness: 0,
  });
  const chairWoodDark = chairWood.clone();
  chairWoodDark.color.setHex(0x7c604d);
  const chairTrim = material(0x8b6534, 0.54, 0.25);
  const wornEdge = material(0x74492a, 0.68, 0.04);
  const chairSeat = mesh(new THREE.BoxGeometry(0.96, 0.18, 0.84), chairWood);
  chairSeat.position.y = 0.8;
  chair.add(chairSeat);
  const chairBack = mesh(new THREE.BoxGeometry(0.96, 1.18, 0.17), chairWoodDark);
  chairBack.position.set(0, 1.29, 0.36);
  chair.add(chairBack);
  const backInset = mesh(new THREE.BoxGeometry(0.68, 0.72, 0.035), chairWood);
  backInset.position.set(0, 1.34, 0.262);
  chair.add(backInset);
  const backWear = mesh(new THREE.BoxGeometry(0.82, 0.035, 0.19), wornEdge);
  backWear.position.set(0, 1.86, 0.36);
  chair.add(backWear);
  const chairCrest = mesh(new THREE.BoxGeometry(0.72, 0.1, 0.205), chairTrim);
  chairCrest.position.set(0, 1.9, 0.36);
  chair.add(chairCrest);
  [-0.37, 0.37].forEach((x) => {
    const leg = mesh(new THREE.BoxGeometry(0.13, 0.84, 0.13), chairWoodDark);
    leg.position.set(x, 0.4, 0.25);
    chair.add(leg);
    const footWear = mesh(new THREE.BoxGeometry(0.145, 0.07, 0.145), wornEdge);
    footWear.position.set(x, 0.055, 0.25);
    chair.add(footWear);
  });
  [-1, 1].forEach((side) => {
    const armRest = mesh(new THREE.BoxGeometry(0.1, 0.38, 0.62), chairWood);
    armRest.position.set(side * 0.47, 0.95, 0.0);
    chair.add(armRest);
  });
  scene.add(chair);

  const human = new THREE.Group();
  human.position.copy(position);
  human.rotation.y = angle;
  human.position.x += Math.sin(angle) * -0.14;
  human.position.z += Math.cos(angle) * -0.14;
  human.scale.setScalar(1.08);

  const skin = material(profile.skin, 0.78);
  const cloth = material(profile.primary, 0.88);
  const clothDark = material(profile.secondary, 0.93);
  const leather = material(profile.leather, 0.86);
  const hair = material(profile.hair, 0.96);
  const metal = material(profile.metal, 0.46, 0.38);

  const pelvis = mesh(new THREE.BoxGeometry(0.54, 0.22, 0.42), clothDark);
  pelvis.position.set(0, 0.98, -0.02);
  human.add(pelvis);

  const torso = mesh(new THREE.CylinderGeometry(profile.gender === "female" ? 0.24 : 0.27, profile.gender === "female" ? 0.32 : 0.35, 0.68, 7), cloth);
  torso.position.set(0, 1.34, -0.06);
  torso.scale.set(...profile.torsoScale);
  human.add(torso);

  const chest = mesh(new THREE.BoxGeometry(profile.shoulderWidth * 0.9, 0.44, 0.12), leather);
  chest.position.set(0, 1.34, -0.22);
  chest.rotation.x = -0.04;
  human.add(chest);

  const belt = mesh(new THREE.BoxGeometry(0.62, 0.08, 0.44), leather);
  belt.position.set(0, 1.06, -0.03);
  human.add(belt);
  const buckle = mesh(new THREE.BoxGeometry(0.1, 0.08, 0.03), metal);
  buckle.position.set(0, 1.06, -0.25);
  human.add(buckle);

  if (slot === 0) {
    [-1, 1].forEach((side) => {
      const pauldron = mesh(new THREE.BoxGeometry(0.16, 0.12, 0.18), leather);
      pauldron.position.set(side * 0.33, 1.5, -0.05);
      pauldron.rotation.z = side * 0.18;
      human.add(pauldron);
    });
  } else if (slot === 1) {
    const pendant = mesh(new THREE.TorusGeometry(0.07, 0.012, 5, 9), metal);
    pendant.position.set(0, 1.15, -0.28);
    pendant.rotation.x = Math.PI / 2;
    human.add(pendant);
  } else if (slot === 2) {
    const scarf = mesh(new THREE.TorusGeometry(0.22, 0.045, 6, 11), clothDark);
    scarf.rotation.x = Math.PI / 2;
    scarf.position.set(0, 1.5, -0.06);
    human.add(scarf);
  } else {
    const diagonalStrap = mesh(new THREE.BoxGeometry(0.08, 0.74, 0.06), leather);
    diagonalStrap.position.set(0, 1.25, -0.28);
    diagonalStrap.rotation.z = -0.48;
    human.add(diagonalStrap);
  }

  const neck = mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.15, 6), skin);
  neck.position.set(0, 1.66, -0.05);
  human.add(neck);

  const headPivot = new THREE.Group();
  headPivot.position.set(0, 1.87, -0.03);
  headPivot.rotation.y = [0.05, -0.1, 0.08, -0.05][slot];
  human.add(headPivot);
  const head = mesh(new THREE.IcosahedronGeometry(0.24, 1), skin);
  head.scale.set(...profile.headScale);
  headPivot.add(head);
  addHair(headPivot, profile, hair);
  addFacialDetails(headPivot, profile, skin, hair);

  const leftArm = createArm(profile, -1, skin, cloth, leather);
  const rightArm = createArm(profile, 1, skin, cloth, leather);
  human.add(leftArm, rightArm);

  [-1, 1].forEach((side) => {
    const thigh = mesh(new THREE.BoxGeometry(0.16, 0.16, 0.56), clothDark);
    thigh.position.set(side * 0.17, 0.86, -0.2);
    thigh.rotation.x = -0.2;
    human.add(thigh);

    const calf = mesh(new THREE.BoxGeometry(0.15, 0.46, 0.15), clothDark);
    calf.position.set(side * 0.17, 0.56, -0.44);
    calf.rotation.x = 0.08;
    human.add(calf);

    const foot = mesh(new THREE.BoxGeometry(0.18, 0.09, 0.28), leather);
    foot.position.set(side * 0.17, 0.31, -0.47);
    foot.rotation.x = 0.08;
    human.add(foot);
  });

  human.rotation.z = [0.003, -0.008, 0.006, -0.004][slot];
  human.userData.animation = {
    torso,
    headPivot,
    leftArm,
    rightArm,
    baseTorsoY: torso.position.y,
    baseHeadY: headPivot.position.y,
    baseLeftArmX: leftArm.rotation.x,
    baseRightArmX: rightArm.rotation.x,
    phase: slot * 1.37,
    sway: [0.004, 0.003, 0.0035, 0.0045][slot],
  };
  human.visible = Boolean(occupied);
  scene.add(human);
  return { chair, human };
}


const SEAT_VISUAL_SCALE = 1.18;
// Os lugares mantêm-se a 90° uns dos outros; SEAT_PHASE roda o anel inteiro
// para que nenhum caia sobre um eixo da cena.
const SEAT_ANGLES = [Math.PI, Math.PI / 2, 0, -Math.PI / 2].map((angle) => angle + SEAT_PHASE);

export function createSeatActor(scene, slot) {
  const angle = SEAT_ANGLES[slot];
  const position = new THREE.Vector3(Math.sin(angle) * SEAT_RADIUS, 0, Math.cos(angle) * SEAT_RADIUS);

  const anchor = new THREE.Group();
  anchor.position.copy(position);
  anchor.rotation.y = angle;
  scene.add(anchor);

  const characterSlot = new THREE.Group();
  characterSlot.scale.setScalar(SEAT_VISUAL_SCALE);
  anchor.add(characterSlot);

  const chair = createLobbyChair();
  chair.scale.setScalar(SEAT_VISUAL_SCALE);
  chair.traverse((child) => {
    if (child.isMesh) child.receiveShadow = true;
  });
  anchor.add(chair);

  const actor = {
    slot,
    anchor,
    chair,
    characterSlot,
    characterId: null,
    character: null,
  };

  actor.setCharacter = (characterId) => {
    if (actor.characterId === characterId) return;
    actor.characterId = characterId;

    if (actor.character) {
      disposeObject(actor.character);
      actor.character = null;
    }
    if (characterId) {
      actor.character = createSeatedCharacter(characterId);
      characterSlot.add(actor.character);
    }
    tintChair(chair, characterId);
  };

  return actor;
}


/* ============================================================================
   INDICADOR DE PRONTO

   Um diamante suspenso sobre cada personagem, âmbar enquanto se prepara e verde
   quando fica pronto.

   Não é diegético e não tem equivalente credível numa sala medieval — foi
   tentado com uma ficha virada na mesa e o problema é de escala: a esta
   distância de câmara um disco de 10 cm não distingue nada. Um símbolo flutuante
   lê-se de imediato de qualquer ângulo, e é a troca certa: a leitura ganha mais
   do que a ficção perde.
   ========================================================================== */

const INDICATOR_Y = 2.86;
const READY_COLOR = 0x00d94f;
const READY_EMISSIVE = 0x00ff59;
const WAITING_COLOR = 0xd9a94f;

export function addSeatIndicators(scene) {
  return SEAT_ANGLES.map((angle) => {
    const indicator = new THREE.Group();
    indicator.position.set(Math.sin(angle) * SEAT_RADIUS, INDICATOR_Y, Math.cos(angle) * SEAT_RADIUS);
    indicator.visible = false;
    scene.add(indicator);

    const gemMaterial = new THREE.MeshStandardMaterial({
      color: WAITING_COLOR,
      emissive: new THREE.Color(WAITING_COLOR),
      emissiveIntensity: 0.72,
      roughness: 0.32,
      metalness: 0.1,
      transparent: true,
      opacity: 0.94,
    });
    // O indicador é informação de estado, não iluminação física. Evitar o tone
    // mapping aqui impede que um emissive verde forte seja comprimido para branco.
    gemMaterial.toneMapped = false;
    const gem = mesh(new THREE.OctahedronGeometry(0.13, 0), gemMaterial, false, false);
    gem.scale.y = 1.75;
    indicator.add(gem);

    const glow = new THREE.PointLight(WAITING_COLOR, 0.28, 1.9, 2);
    indicator.add(glow);

    let phase = Math.random() * Math.PI * 2;

    return {
      setState({ occupied = false, ready = false, connected = true } = {}) {
        indicator.visible = occupied;
        if (!occupied) return;
        const color = !connected ? 0x6b6f74 : ready ? READY_COLOR : WAITING_COLOR;
        const emissive = !connected ? 0x55595d : ready ? READY_EMISSIVE : WAITING_COLOR;
        gemMaterial.color.setHex(color);
        gemMaterial.emissive.setHex(emissive);
        gemMaterial.emissiveIntensity = connected ? (ready ? 0.9 : 0.58) : 0.16;
        glow.color.setHex(ready && connected ? READY_EMISSIVE : color);
        glow.intensity = connected ? (ready ? 1.08 : 0.26) : 0.07;
      },
      update(delta, elapsed) {
        if (!indicator.visible) return;
        phase += delta;
        gem.rotation.y += delta * 0.9;
        gem.position.y = Math.sin(elapsed * 1.6 + phase) * 0.055;
      },
      dispose() {},
    };
  });
}
