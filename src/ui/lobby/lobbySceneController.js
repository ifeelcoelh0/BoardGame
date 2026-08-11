import * as THREE from "three";
import { disposeObjectTree } from "../three/disposeThree.js";
import { createVisibilityAwareFrameLoop } from "../three/visibilityAwareFrameLoop.js";
import { getLobbySelectionInteraction } from "./lobbySelectionInteraction.js";
import { rendererPerformanceSnapshot } from "../three/rendererPerformanceSnapshot.js";
import { resolveGraphicsQualityProfile } from "../three/graphicsQualityProfiles.js";
import { material, mesh } from "./lobbyScenePrimitives.js";
import { createWoodTexture, createStoneTextures, createRugTexture } from "./lobbySceneTextures.js";
import { addOpenGameBox, addHexScatter, addDice, addPlayerProps, addCandle, addFireplace, addBackWallWeaponDisplay, addWallTorch, addBanner, addWallTrophy } from "./lobbySceneDecorations.js";
import { addSeatIndicators, createSeatActor } from "./lobbySceneActors.js";
import { updateCharacter } from "./lobbyCharacters.js";
import { addCharacterSelectionWall, GALLERY_FRAMING } from "./lobbySceneGallery.js";
import { createCharacterScroll } from "./lobbySceneScroll.js";
import { createGameBook, createRoomCodePlaque, BOOK_ANCHOR, BOOK_READ_NORMAL, BOOK_VIEW_DISTANCE } from "./lobbySceneBook.js";
import { clearCharacterDetailTextureCache } from "./lobbyCharacterTextures.js";

export function createLobbyScene(container, options = {}) {
  const graphics = resolveGraphicsQualityProfile(options.graphicsQuality);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x030203);
  scene.fog = new THREE.FogExp2(0x050304, 0.055);

  const camera = new THREE.PerspectiveCamera(39, 1, 0.1, 60);

  const renderer = new THREE.WebGLRenderer({ antialias: graphics.renderer.antialias, alpha: false, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, graphics.renderer.lobbyPixelRatioCap));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  // As sombras continuam dinâmicas, mas são atualizadas explicitamente a uma
  // cadência menor do que o render. A PointLight da lareira exige seis mapas
  // de sombra, por isso recalculá-los em cada frame era um custo desproporcional.
  renderer.shadowMap.autoUpdate = false;
  renderer.shadowMap.needsUpdate = true;
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.06;
  container.appendChild(renderer.domElement);

  const ambient = new THREE.HemisphereLight(0x2d3548, 0x020101, 0.14);
  scene.add(ambient);

  const moon = new THREE.DirectionalLight(0x7189b5, 0.42);
  moon.position.set(-4.5, 7.5, 5.5);
  scene.add(moon);

  const tableKey = new THREE.SpotLight(0xffc476, 3.6, 17, Math.PI * 0.23, 0.86, 1.45);
  tableKey.position.set(0, 8.2, 2.5);
  tableKey.target.position.set(0, 0.9, -0.15);
  tableKey.castShadow = true;
  tableKey.shadow.mapSize.set(graphics.lobby.keyShadowMap, graphics.lobby.keyShadowMap);
  tableKey.shadow.bias = -0.001;
  scene.add(tableKey, tableKey.target);

  const tableBounce = new THREE.PointLight(0xff9a45, 0.72, 5.1, 2);
  tableBounce.position.set(0, 2.3, 0.1);
  scene.add(tableBounce);

  const floorStone = createStoneTextures("floor");
  const wallStone = createStoneTextures("wall");
  const rugTex = createRugTexture();

  const floorMat = new THREE.MeshStandardMaterial({
    map: floorStone.map,
    bumpMap: floorStone.bumpMap,
    roughnessMap: floorStone.roughnessMap,
    bumpScale: 0.075,
    color: 0xd2c5b7,
    roughness: 0.96,
    metalness: 0,
  });
  const floor = mesh(new THREE.CircleGeometry(8.8, 48), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  const rugMat = new THREE.MeshStandardMaterial({
    map: rugTex.map,
    bumpMap: rugTex.bumpMap,
    roughnessMap: rugTex.roughnessMap,
    bumpScale: 0.082,
    roughness: 0.98,
    metalness: 0,
  });
  const rug = mesh(new THREE.CircleGeometry(5.35, 64), rugMat);
  rug.rotation.x = -Math.PI / 2;
  rug.position.y = 0.022;
  rug.receiveShadow = true;
  scene.add(rug);

  // Os 72 fios tinham geometria/material próprios e custavam 72 draw calls.
  // Um InstancedMesh preserva exatamente a silhueta irregular usando escalas
  // diferentes por instância, mas envia a família inteira num único draw call.
  const fringeMat = material(0x6d1717, 1);
  const fringeGeometry = new THREE.BoxGeometry(0.025, 0.018, 0.12);
  const fringe = new THREE.InstancedMesh(fringeGeometry, fringeMat, 72);
  fringe.castShadow = false;
  fringe.receiveShadow = true;
  const fringeDummy = new THREE.Object3D();
  for (let i = 0; i < 72; i += 1) {
    const a = (i / 72) * Math.PI * 2;
    const radius = 5.33 + ((i % 5) - 2) * 0.018;
    fringeDummy.position.set(Math.cos(a) * radius, 0.034, Math.sin(a) * radius);
    fringeDummy.rotation.set(0, -a, ((i % 3) - 1) * 0.07);
    fringeDummy.scale.set(1, 1, (0.12 + (i % 4) * 0.014) / 0.12);
    fringeDummy.updateMatrix();
    fringe.setMatrixAt(i, fringeDummy.matrix);
  }
  fringe.instanceMatrix.needsUpdate = true;
  scene.add(fringe);

  const rugContact = mesh(
    new THREE.RingGeometry(4.9, 5.38, 72),
    new THREE.MeshBasicMaterial({ color: 0x2b1512, transparent: true, opacity: 0.16, depthWrite: false }),
    false,
    false,
  );
  rugContact.rotation.x = -Math.PI / 2;
  rugContact.position.y = 0.006;
  scene.add(rugContact);

  const wallMat = new THREE.MeshStandardMaterial({
    map: wallStone.map,
    bumpMap: wallStone.bumpMap,
    roughnessMap: wallStone.roughnessMap,
    bumpScale: 0.068,
    color: 0xddd2c4,
    roughness: 0.97,
    metalness: 0,
  });
  const backWall = mesh(new THREE.BoxGeometry(14, 6, 0.65), wallMat, false, true);
  backWall.position.set(0, 2.8, -5.85);
  scene.add(backWall);
  const leftWall = mesh(new THREE.BoxGeometry(0.65, 6, 12), wallMat, false, true);
  leftWall.position.set(-7, 2.8, -0.3);
  scene.add(leftWall);
  const rightWall = leftWall.clone();
  rightWall.position.x = 7;
  scene.add(rightWall);


  const woodTextures = createWoodTexture();
  const tableWood = new THREE.MeshStandardMaterial({
    map: woodTextures.map,
    bumpMap: woodTextures.bumpMap,
    bumpScale: 0.055,
    color: 0xcdb79f,
    roughness: 0.84,
    metalness: 0,
  });
  tableWood.emissive = new THREE.Color(0x110603);
  tableWood.emissiveIntensity = 0.08;
  const tableEdge = material(0x8f5e24, 0.42, 0.52);
  tableEdge.emissive = new THREE.Color(0x241005);
  tableEdge.emissiveIntensity = 0.08;
  const emblemMat = material(0xb37a2f, 0.44, 0.42);

  /* A saia da mesa descia até y = 0.735 com raio 3.25. Com as cadeiras a 3.72
     isso nunca dava problema porque ninguém chegava perto, mas era também a
     razão pela qual não se podiam aproximar: os joelhos batiam no tambor. Agora
     que SEAT_RADIUS é 3.50, a saia fica com 14 cm e começa em y = 1.05, acima
     do topo da coxa (1.034), e o tampo passa a ser um tampo em vez de um
     bidão. */
  const table = mesh(new THREE.CylinderGeometry(3.02, 2.94, 0.14, 40), tableWood);
  table.position.y = 1.12;
  scene.add(table);
  const tableApronEdge = mesh(new THREE.TorusGeometry(3.03, 0.035, 4, 40), tableEdge);
  tableApronEdge.rotation.x = Math.PI / 2;
  tableApronEdge.position.y = 1.165;
  scene.add(tableApronEdge);
  const tableTop = mesh(new THREE.CircleGeometry(3.08, 48), tableWood);
  tableTop.rotation.x = -Math.PI / 2;
  tableTop.position.y = 1.19;
  scene.add(tableTop);

  const base = mesh(new THREE.CylinderGeometry(1.05, 1.4, 0.82, 14), material(0x221108, 0.95));
  base.position.y = 0.41;
  scene.add(base);

  addOpenGameBox(scene);
  addHexScatter(scene);
  addDice(scene);
  addPlayerProps(scene);

  const flames = [];
  addCandle(scene, -2.26, -0.08, flames, { height: 0.28, scale: 0.95 });
  addCandle(scene, 1.78, -0.98, flames, { height: 0.38, scale: 1.02 });
  addCandle(scene, 0.98, 1.2, flames, { height: 0.24, scale: 0.92 });
  addFireplace(scene, flames, { woodTextures, shadowMapSize: graphics.lobby.fireShadowMap });
  addBackWallWeaponDisplay(scene);
  // Os candeeiros passam para o espaço entre os estandartes e o centro,
  // evitando qualquer intersecção visual com o tecido.
  addWallTorch(scene, -2.15, 2.55, -5.18, flames);
  addWallTorch(scene, 2.15, 2.55, -5.18, flames);

  const seatActors = Array.from({ length: 4 }, (_, index) => createSeatActor(scene, index));
  const seatRimLights = seatActors.map((actor, index) => {
    const rim = new THREE.PointLight(index % 2 ? 0x8ea6cf : 0xa8bcdd, 0.58, 3.1, 2);
    const outward = actor.anchor.position.clone().setY(0).normalize();
    rim.position.copy(actor.anchor.position).add(outward.multiplyScalar(0.72));
    rim.position.y = 2.05;
    rim.visible = false;
    scene.add(rim);
    return rim;
  });

  const seatIndicators = addSeatIndicators(scene);

  addBanner(scene, -3.9, 0x253b55, 0x172436, emblemMat);
  addBanner(scene, 3.9, 0x5b241e, 0x35110f, emblemMat);
  addWallTrophy(scene, -5.55, 3.08, -5.4, "deer", { woodTextures });
  addWallTrophy(scene, 5.55, 3.02, -5.4, "boar", { woodTextures });
  const { portraitTargets, washLights, frames } = addCharacterSelectionWall(scene, options.characters ?? [], flames);
  const scroll = createCharacterScroll(scene, GALLERY_FRAMING);
  const book = createGameBook(scene);
  const codePlaque = createRoomCodePlaque(scene);

  let disposed = false;
  let cameraMove = null;
  let codexActive = false;
  let forceShadowUpdate = true;
  let shadowUpdates = 0;
  let lastShadowUpdateAt = Number.NEGATIVE_INFINITY;
  const SHADOW_UPDATE_INTERVAL = 1000 / graphics.lobby.shadowHz;
  const defaultCameraPosition = new THREE.Vector3(0, 7.85, 12.25);
  const defaultCameraTarget = new THREE.Vector3(0, 0.58, -0.62);
  // Vista frontal e perpendicular à parede da galeria. A distância deixa de ser
  // um número fixo: é calculada a partir da extensão da grelha, do fov e do
  // aspeto do ecrã, para a composição encher o plano em qualquer formato.
  const selectionCameraTarget = new THREE.Vector3(
    GALLERY_FRAMING.wallX + 0.06,
    GALLERY_FRAMING.centerY,
    GALLERY_FRAMING.centerZ,
  );
  const selectionCameraPosition = new THREE.Vector3();
  const updateSelectionCamera = () => {
    const halfFov = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
    const byHeight = GALLERY_FRAMING.height / 2 / halfFov;
    const byWidth = GALLERY_FRAMING.width / 2 / (halfFov * Math.max(camera.aspect, 0.4));
    const distance = THREE.MathUtils.clamp(Math.max(byHeight, byWidth), 4.4, 10.6);
    selectionCameraPosition.set(
      selectionCameraTarget.x + distance,
      selectionCameraTarget.y,
      selectionCameraTarget.z,
    );
  };
  updateSelectionCamera();

  let activeView = options.startAtSelection ? "selection" : "default";
  const cameraTarget = (options.startAtSelection ? selectionCameraTarget : defaultCameraTarget).clone();
  camera.position.copy(options.startAtSelection ? selectionCameraPosition : defaultCameraPosition);
  camera.lookAt(cameraTarget);
  // Estação ritual do livro: a câmara aproxima-se sobre a normal média das
  // folhas para uma leitura visual limpa antes do fade para o códice 2D.
  const bookCameraTarget = BOOK_ANCHOR.clone();
  const bookCameraPosition = BOOK_ANCHOR.clone().addScaledVector(BOOK_READ_NORMAL, BOOK_VIEW_DISTANCE);
  const tableCameraPosition = new THREE.Vector3(0, 2.42, 3.18);
  const tableCameraTarget = new THREE.Vector3(0, 1.08, -0.12);

  const resize = () => {
    if (!container.clientWidth || !container.clientHeight) return;
    const width = container.clientWidth;
    const height = container.clientHeight;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    updateSelectionCamera();
    // Redimensionar durante a seleção reenquadra em vez de cortar a grelha.
    if (activeView === "selection" && !cameraMove) {
      camera.position.copy(selectionCameraPosition);
      cameraTarget.copy(selectionCameraTarget);
    }
  };
  const observer = new ResizeObserver(resize);
  observer.observe(container);
  resize();

  const renderFrame = ({ now, delta, elapsed: t }) => {
    if (disposed) return;
    flames.forEach((entry, index) => {
      const flicker = 0.9 + Math.sin(t * (7.2 + index * 0.45) + entry.phase) * 0.1 + Math.sin(t * 13.1 + entry.phase) * 0.045;

      if (entry.flame) {
        entry.flame.scale.set(0.94 + flicker * 0.07, flicker, 0.94 + flicker * 0.07);
        entry.flame.rotation.z = Math.sin(t * 4.2 + entry.phase) * 0.055;
      }

      if (entry.kind === "candle") {
        entry.light.intensity = 1.22 + flicker * 0.48;
      } else if (entry.kind === "torch") {
        entry.light.intensity = 1.42 + flicker * 0.5;
      } else if (entry.kind === "fireplace-light") {
        entry.light.intensity = 4.1 + flicker * 0.95;
        entry.bounce.intensity = 0.8 + flicker * 0.38;
        entry.light.position.x = Math.sin(t * 1.9 + entry.phase) * 0.08;
      }
    });
    seatActors.forEach((actor) => {
      if (actor.character) updateCharacter(actor.character, t);
    });

    if (cameraMove) {
      const elapsed = t * 1000 - cameraMove.startedAt;
      const progress = Math.min(1, elapsed / cameraMove.duration);
      const eased = progress < 0.5
        ? 4 * progress * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 3) / 2;
      const oneMinus = 1 - eased;
      camera.position
        .copy(cameraMove.fromPosition).multiplyScalar(oneMinus * oneMinus)
        .addScaledVector(cameraMove.controlPosition, 2 * oneMinus * eased)
        .addScaledVector(cameraMove.toPosition, eased * eased);
      cameraTarget
        .copy(cameraMove.fromTarget).multiplyScalar(oneMinus * oneMinus)
        .addScaledVector(cameraMove.controlTarget, 2 * oneMinus * eased)
        .addScaledVector(cameraMove.toTarget, eased * eased);
      if (progress >= 1) {
        const complete = cameraMove.onComplete;
        cameraMove = null;
        complete?.();
      }
    }

    camera.lookAt(cameraTarget);
    scroll.update(delta);
    book.update(delta, t);
    codePlaque.update(delta, t);
    frames.forEach((frame) => frame.update(delta));
    seatIndicators.forEach((indicator) => indicator.update(delta, t));
    const wallDim = scroll.isOpen ? 0.34 : 1;
    washLights.forEach((wash) => {
      wash.intensity += (1.45 * wallDim - wash.intensity) * Math.min(1, delta * 6);
    });

    if (forceShadowUpdate || now - lastShadowUpdateAt >= SHADOW_UPDATE_INTERVAL) {
      renderer.shadowMap.needsUpdate = true;
      lastShadowUpdateAt = now;
      forceShadowUpdate = false;
      shadowUpdates += 1;
    }
    renderer.render(scene, camera);
  };

  const renderLoop = createVisibilityAwareFrameLoop({
    onFrame: renderFrame,
    // Câmara e abertura/assinatura do pergaminho continuam a 60 fps. Quando a
    // sala está apenas com fogo, personagens e livro em idle, 30 fps preserva
    // a leitura visual e corta aproximadamente metade dos renders completos.
    getTargetFps: () => (codexActive
      ? graphics.lobby.codexFps
      : cameraMove || scroll.isAnimating
        ? graphics.lobby.activeFps
        : graphics.lobby.idleFps),
  });

  const moveCamera = (toPosition, toTarget, duration = 1300, arcHeight = 0.7, onComplete = null) => {
    const fromPosition = camera.position.clone();
    const fromTarget = cameraTarget.clone();
    const controlPosition = fromPosition.clone().lerp(toPosition, 0.5);
    controlPosition.y += arcHeight;
    const controlTarget = fromTarget.clone().lerp(toTarget, 0.5);
    controlTarget.y += arcHeight * 0.18;
    cameraMove = {
      fromPosition,
      fromTarget,
      controlPosition,
      controlTarget,
      toPosition: toPosition.clone(),
      toTarget: toTarget.clone(),
      duration,
      startedAt: renderLoop.getStats().elapsed * 1000,
      onComplete,
    };
  };

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const updatePointer = (event) => {
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const interaction = getLobbySelectionInteraction({
      selectionEnabled: options.selectionEnabled,
      scrollOpen: scroll.isOpen,
      scrollReady: scroll.isReady,
      scrollSigning: scroll.isSigning,
    });
    // O pergaminho é um estado modal dentro da seleção. Desde o primeiro frame
    // da abertura, os retratos deixam de participar no raycast; visualmente podem
    // continuar na parede, mas já não conseguem trocar a personagem por trás.
    const targets = interaction.signatureLocked
      ? scroll.targets
      : [...book.targets, ...codePlaque.targets, ...(interaction.portraitsInteractive ? portraitTargets : [])];
    return raycaster.intersectObjects(targets, false)[0]?.object ?? null;
  };
  const isClickable = (object) => {
    if (!object) return false;
    if (object.userData.action) return true;
    return options.isCharacterAvailable?.(object.userData.characterId) !== false;
  };
  let hoveredId = null;
  const setHovered = (id) => {
    if (hoveredId === id) return;
    if (hoveredId) frames.get(hoveredId)?.setHover(false);
    hoveredId = id;
    if (hoveredId) frames.get(hoveredId)?.setHover(true);
  };
  const handlePointerMove = (event) => {
    const hit = updatePointer(event);
    const clickable = isClickable(hit);
    renderer.domElement.style.cursor = clickable ? "pointer" : "default";
    // O pergaminho aberto tapa as molduras do meio; deixar o hover aceso por
    // trás dele daria destaque a uma moldura que o jogador não está a ver.
    setHovered(clickable && !scroll.isOpen ? hit?.userData.characterId ?? null : null);
    scroll.setSignHover(hit?.userData.action === "confirm");
    book.setHover(hit?.userData.action === "book-open");
    codePlaque.setHover(hit?.userData.action === "copy-code");
    options.onCharacterHover?.(hit?.userData.character ?? null);
  };
  const handlePointerLeave = () => {
    renderer.domElement.style.cursor = "default";
    setHovered(null);
    scroll.setSignHover(false);
    book.setHover(false);
    codePlaque.setHover(false);
    options.onCharacterHover?.(null);
  };
  const handleClick = (event) => {
    const hit = updatePointer(event);
    const action = hit?.userData.action;

    // O pergaminho aberto é modal: só Assinar/Voltar respondem. Cliques na
    // parede, no livro ou no código atrás dele são deliberadamente ignorados.
    if (scroll.isOpen) {
      if (!scroll.isReady) return;
      if (action === "confirm") {
        // Assinar é confirmar. O callback só corre quando a pena acaba e a cera
        // assenta — ver o gesto depois da escolha já feita seria decorativo.
        const signedId = scroll.characterId;
        if (signedId && !scroll.isSigning) {
          options.onSignature?.();
          scroll.sign(() => options.onCharacterSelect?.(signedId));
        }
        return;
      }
      if (action === "cancel") {
        // Enquanto a mão escreve não se volta atrás: a folha já está assinada.
        if (!scroll.isSigning) options.onCharacterPreview?.(null);
      }
      return;
    }

    // O livro e a placa do código respondem fora do modo de seleção, ao
    // contrário dos retratos.
    if (action === "copy-code") {
      options.onCopyCode?.();
      return;
    }
    if (action === "book-open") {
      options.onBookOpen?.(true);
      return;
    }

    if (!options.selectionEnabled) return;

    const characterId = hit?.userData.characterId;
    if (!characterId || options.isCharacterAvailable?.(characterId) === false) {
      // Clicar fora fecha o pergaminho, como pôr um documento de lado.
      if (scroll.isOpen && !scroll.isSigning) options.onCharacterPreview?.(null);
      return;
    }
    if (characterId === scroll.characterId) return;
    options.onCharacterPreview?.(characterId);
  };
  const handleKeyDown = (event) => {
    if (event.key !== "Escape") return;
    if (scroll.isSigning) return;
    if (scroll.isOpen) options.onCharacterPreview?.(null);
    else if (options.selectionEnabled) options.onSelectionExit?.();
  };
  renderer.domElement.addEventListener("pointermove", handlePointerMove);
  renderer.domElement.addEventListener("pointerleave", handlePointerLeave);
  renderer.domElement.addEventListener("click", handleClick);
  window.addEventListener("keydown", handleKeyDown);

  return {
    setSeatCharacter(index, characterId) {
      const actor = seatActors[index];
      const rim = seatRimLights[index];
      if (!actor || !rim) return;
      actor.setCharacter(characterId ?? null);
      rim.visible = Boolean(characterId);
      forceShadowUpdate = true;
    },
    /**
     * states: { [characterId]: { status: "free" | "taken" | "local", ownerColor } }
     * A parede deixa de mentir: uma casa tomada ganha faixa, selo e retrato
     * apagado, e a casa local ganha a vela acesa.
     */
    setCharacterStates(states) {
      frames.forEach((frame, id) => {
        const entry = states?.[id];
        frame.setStatus(entry?.status ?? "free", entry?.ownerColor ?? null);
      });
    },
    setSeatState(index, state = {}) {
      const { ready = false, connected = true } = state;
      seatIndicators[index]?.setState(state);
      const rim = seatRimLights[index];
      if (!rim) return;
      rim.color.setHex(ready ? 0xffc978 : 0xa8bcdd);
      rim.intensity = connected ? (ready ? 0.92 : 0.58) : 0.2;
    },
    setCodexActive(active) {
      codexActive = active === true;
      book.setInteractive(!codexActive && activeView === "default");
    },
    setBookRitual(state) {
      book.setRitualState(state);
      book.setInteractive(state === "idle" && activeView === "default");
    },
    setRoomCode(code, copied) {
      codePlaque.setContent(code, copied);
    },
    focusBook({ reducedMotion = false, duration = 1150, onComplete = null } = {}) {
      activeView = "book";
      book.setInteractive(false);
      if (reducedMotion) {
        cameraMove = null;
        camera.position.copy(bookCameraPosition);
        cameraTarget.copy(bookCameraTarget);
        onComplete?.();
        return;
      }
      moveCamera(bookCameraPosition, bookCameraTarget, duration, 0.45, onComplete);
    },
    showCharacterPreview(character, perk) {
      scroll.show(character, perk);
    },
    hideCharacterPreview() {
      scroll.hide();
    },
    focusSelection({ reducedMotion = false, duration = 1450, onComplete = null } = {}) {
      const fromView = activeView;
      activeView = "selection";
      if (reducedMotion) {
        cameraMove = null;
        camera.position.copy(selectionCameraPosition);
        cameraTarget.copy(selectionCameraTarget);
        onComplete?.();
        return;
      }

      // Sair directamente do close-up do livro para a parede dava uma órbita
      // longa e pouco legível. Regressamos primeiro à composição do salão e só
      // depois aproximamos da galeria, como duas intenções de câmara distintas.
      if (fromView === "book") {
        const firstLeg = Math.min(760, Math.max(520, duration * 0.46));
        const secondLeg = Math.max(760, duration - firstLeg + 420);
        moveCamera(defaultCameraPosition, defaultCameraTarget, firstLeg, 0.5, () => {
          if (activeView !== "selection") return;
          moveCamera(selectionCameraPosition, selectionCameraTarget, secondLeg, 0.72, onComplete);
        });
        return;
      }

      moveCamera(selectionCameraPosition, selectionCameraTarget, duration, 0.78, onComplete);
    },
    focusTable({ reducedMotion = false, duration = 1850 } = {}) {
      activeView = "table";
      if (reducedMotion) {
        cameraMove = null;
        camera.position.copy(tableCameraPosition);
        cameraTarget.copy(tableCameraTarget);
        return;
      }
      moveCamera(tableCameraPosition, tableCameraTarget, duration, 1.05);
    },
    resetCamera({ reducedMotion = false, duration = 700, onComplete = null } = {}) {
      activeView = "default";
      if (reducedMotion) {
        cameraMove = null;
        camera.position.copy(defaultCameraPosition);
        cameraTarget.copy(defaultCameraTarget);
        book.setInteractive(true);
        onComplete?.();
        return;
      }
      moveCamera(defaultCameraPosition, defaultCameraTarget, duration, 0.8, () => {
        book.setInteractive(!codexActive);
        onComplete?.();
      });
    },
    getPerformanceSnapshot() {
      return rendererPerformanceSnapshot(renderer, {
        ...renderLoop.getStats(),
        graphicsQuality: graphics.id,
        targetIdleFps: graphics.lobby.idleFps,
        shadowHz: graphics.lobby.shadowHz,
        shadowUpdates,
        shadowUpdatesPerSecond: renderLoop.getStats().visibleElapsed > 0
          ? shadowUpdates / renderLoop.getStats().visibleElapsed
          : 0,
      });
    },
    dispose() {
      disposed = true;
      cameraMove = null;
      renderLoop.dispose();
      observer.disconnect();
      renderer.domElement.removeEventListener("pointermove", handlePointerMove);
      renderer.domElement.removeEventListener("pointerleave", handlePointerLeave);
      renderer.domElement.removeEventListener("click", handleClick);
      window.removeEventListener("keydown", handleKeyDown);
      scroll.dispose();
      book.dispose();
      codePlaque.dispose();
      seatIndicators.forEach((indicator) => indicator.dispose());
      disposeObjectTree(scene);
      // characterDetailTextures is a module cache; the scene disposer has just
      // disposed the underlying GPU textures, so clear the cache as well to
      // guarantee a clean remount instead of retaining disposed handles.
      clearCharacterDetailTextureCache();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}

