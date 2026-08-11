import * as THREE from "three";
import { RESOURCE_DEFINITIONS as RES } from "../../game/resources.js";
import { HEX_CORNER_OFFSETS as CORNER_OFF, HEX_SIZE as SIZE } from "../../game/boardGeometry.js";
import { isClassicMode as CLASSICO, isWarMode as GUERRA } from "../../game/gameModes.js";
import { isTrollUnit as isTroll } from "../../game/warReducer.js";
import { disposeObjectTree } from "../three/disposeThree.js";
import { createVisibilityAwareFrameLoop } from "../three/visibilityAwareFrameLoop.js";
import { rendererPerformanceSnapshot } from "../three/rendererPerformanceSnapshot.js";
import { resolveGraphicsQualityProfile, scaledAmbientCount } from "../three/graphicsQualityProfiles.js";
import { assetUrl } from "../../assets/assetUrl.js";
import { gameIconEntry } from "../../assets/gameIconCatalog.js";
import { RESOURCE_ICON_BY_KEY } from "../../assets/gameUiIcons.js";
import { TERRAIN_VISUALS as TERR, CHARACTER_GLOW_COLORS as GLOW, NUMBER_PIPS as PIPS, boardCharacterVisual as charOf, shadeColor as shade } from "./boardVisualConfig.js";

const BOARD_ICON_IMAGES = new Map();
function loadBoardIcon(name, onLoad) {
    const entry = gameIconEntry(name);
    if (!entry || typeof Image === "undefined") return;
    let image = BOARD_ICON_IMAGES.get(name);
    if (!image) {
        image = new Image();
        image.decoding = "async";
        image.src = assetUrl(entry.path);
        BOARD_ICON_IMAGES.set(name, image);
    }
    if (image.complete && image.naturalWidth > 0) onLoad(image);
    else image.addEventListener("load", () => onLoad(image), { once: true });
}

function hseed(s) {
    let h = 0;
    for (let i = 0; i < s.length; i++)
        h = h * 31 + s.charCodeAt(i) | 0;
    return h >>> 0;
}
function mulberry(seed) {
    let a = seed >>> 0;
    return function () {
        a |= 0;
        a = a + 1831565813 | 0;
        let t = Math.imul(a ^ a >>> 15, 1 | a);
        t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
}
export function createBoardScene(container, gr, board, players, mode, options = {}) {
    const T = THREE;
    const graphics = resolveGraphicsQualityProfile(options.graphicsQuality);
    const ambientCount = (base, minimum = 1) => scaledAmbientCount(base, graphics, minimum);
    const world = { anims: [], fx: [], handlers: {}, dragonHex: board.dragon, disposed: false };
    const fogG = {}, fogTok = {}, fogDec = {}, dynW = {};
    const centers = {};
    board.hexes.forEach((h) => {
        const c = gr.hexMap[h.k].center;
        centers[h.k] = { x: c.x, z: c.y };
    });
    const renderer = new T.WebGLRenderer({ antialias: graphics.renderer.antialias, alpha: false, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(graphics.renderer.boardPixelRatioCap, window.devicePixelRatio || 1));
    renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(renderer.domElement);
    const scene = new T.Scene();
    scene.fog = new T.Fog(5449018, 560, 1600);
    const camera = new T.PerspectiveCamera(46, container.clientWidth / container.clientHeight, 1, 4200);
    const resize = () => {
        if (!container.clientWidth || !container.clientHeight) return;
        renderer.setSize(container.clientWidth, container.clientHeight, false);
        camera.aspect = container.clientWidth / container.clientHeight;
        camera.updateProjectionMatrix();
    };
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(container);
    resize();
    const skyCv = document.createElement("canvas");
    skyCv.width = 2;
    skyCv.height = 512;
    const sctx = skyCv.getContext("2d");
    const grd = sctx.createLinearGradient(0, 0, 0, 512);
    grd.addColorStop(0, "#120a26");
    grd.addColorStop(0.3, "#341c40");
    grd.addColorStop(0.44, "#7d3a52");
    grd.addColorStop(0.5, "#e07a4a");
    grd.addColorStop(0.55, "#f2b05a");
    grd.addColorStop(0.62, "#b05a3a");
    grd.addColorStop(1, "#241018");
    sctx.fillStyle = grd;
    sctx.fillRect(0, 0, 2, 512);
    const sky = new T.Mesh(new T.SphereGeometry(1300, 20, 14), new T.MeshBasicMaterial({ map: new T.CanvasTexture(skyCv), side: T.BackSide, fog: false }));
    sky.position.y = -30;
    scene.add(sky);
    const sunCv = document.createElement("canvas");
    sunCv.width = 128;
    sunCv.height = 128;
    const suctx = sunCv.getContext("2d");
    const sg = suctx.createRadialGradient(64, 64, 4, 64, 64, 62);
    sg.addColorStop(0, "rgba(255,246,214,1)");
    sg.addColorStop(0.28, "rgba(255,190,110,0.95)");
    sg.addColorStop(0.6, "rgba(255,130,70,0.4)");
    sg.addColorStop(1, "rgba(255,120,60,0)");
    suctx.fillStyle = sg;
    suctx.fillRect(0, 0, 128, 128);
    const sunSp = new T.Sprite(new T.SpriteMaterial({ map: new T.CanvasTexture(sunCv), transparent: true, fog: false }));
    sunSp.scale.set(300, 300, 1);
    sunSp.position.set(-640, 66, -960);
    scene.add(sunSp);
    scene.add(new T.HemisphereLight(13601386, 2363942, 0.8));
    const sun = new T.DirectionalLight(16756838, 1.05);
    sun.position.set(-240, 150, -320);
    scene.add(sun);
    const mats = {};
    const M = (c, e) => {
        const k = c + "_" + (e || 0);
        if (!mats[k])
            mats[k] = new T.MeshLambertMaterial({ color: c, emissive: e || 0, flatShading: true });
        return mats[k];
    };
    const MB = (c, op) => new T.MeshBasicMaterial({ color: c, transparent: op != null, opacity: op != null ? op : 1 });
    const MP = (c, e) => {
        const k = "P" + c + "_" + (e || 0);
        if (!mats[k])
            mats[k] = new T.MeshPhongMaterial({ color: c, emissive: e || 0, shininess: 90, flatShading: true });
        return mats[k];
    };
    const G = {
        box: new T.BoxGeometry(1, 1, 1),
        cyl: new T.CylinderGeometry(1, 1, 1, 6),
        cone: new T.ConeGeometry(1, 1, 6),
        cone4: new T.ConeGeometry(1, 1, 4),
        sph: new T.SphereGeometry(1, 6, 4),
        ico: new T.IcosahedronGeometry(1, 0),
        oct: new T.OctahedronGeometry(1, 0),
        tor: new T.TorusGeometry(1, 0.14, 6, 26),
        plane: new T.PlaneGeometry(1, 1)
    };
    function mk(gk, mat, sx, sy, sz, x, y, z, ry) {
        const o = new T.Mesh(G[gk], mat);
        o.scale.set(sx, sy, sz);
        o.position.set(x, y, z);
        if (ry)
            o.rotation.y = ry;
        return o;
    }
    const TOP = 6;
    const wgeo = new T.PlaneGeometry(1700, 1700, 38, 38);
    const sea = new T.Mesh(wgeo, M("#16324f"));
    sea.rotation.x = -Math.PI / 2;
    sea.position.y = 1;
    scene.add(sea);
    let wframe = 0;
    world.anims.push((t) => {
        const p = wgeo.attributes.position;
        for (let i = 0; i < p.count; i++) {
            const x = p.getX(i), y = p.getY(i);
            p.setZ(i, Math.sin(x * 0.045 + t * 1.2) * 0.9 + Math.cos(y * 0.04 + t * 1.05) * 0.9);
        }
        p.needsUpdate = true;
        if ((wframe++ % graphics.board.waterNormalEvery) === 0)
            wgeo.computeVertexNormals();
    });
    const shimmer = new T.Mesh(new T.PlaneGeometry(1700, 1700, 1, 1), new T.MeshBasicMaterial({ color: 3829150, transparent: true, opacity: 0.12 }));
    shimmer.rotation.x = -Math.PI / 2;
    shimmer.position.y = 1.55;
    scene.add(shimmer);
    world.anims.push((t) => {
        shimmer.position.y = 1.45 + Math.sin(t * 0.8) * 0.25;
        shimmer.material.opacity = 0.09 + (Math.sin(t * 1.7) + 1) * 0.045;
    });
    // Ambiente distante: as entidades continuam independentes visualmente, mas
    // são atualizadas em grupos em vez de acrescentarem dezenas de callbacks ao
    // hot path de cada frame. Perfis inferiores reduzem apenas decoração
    // distante, nunca peças/hexes/interação de jogo.
    const foamEntries = [];
    const foamMaterial = new T.MeshBasicMaterial({ color: 14675703, transparent: true, opacity: 0.4 });
    for (let i = 0; i < ambientCount(26, 10); i++) {
        const fm = new T.Mesh(G.cyl, foamMaterial.clone());
        const fa = Math.random() * 6.283, fr2 = 238 + Math.random() * 280;
        fm.scale.set(1.5 + Math.random() * 3.5, 0.12, 1.5 + Math.random() * 3.5);
        fm.position.set(Math.cos(fa) * fr2, 1.6, Math.sin(fa) * fr2);
        scene.add(fm);
        foamEntries.push({ fm, fa });
    }
    world.anims.push((t) => {
        foamEntries.forEach(({ fm, fa }) => {
            fm.position.y = 1.5 + Math.sin(t * 1.3 + fa * 7) * 0.5;
            fm.material.opacity = 0.2 + (Math.sin(t * 1.1 + fa * 5) + 1) * 0.16;
        });
    });
    foamMaterial.dispose();

    function makeWhale() {
        const g2 = new T.Group();
        g2.add(mk("sph", M("#31465e"), 11, 5, 5.5, 0, 0, 0));
        g2.add(mk("sph", M("#c9d8e4"), 8.5, 3, 4.6, 0.5, -1.8, 0));
        const tail = new T.Group();
        tail.position.set(-10, 0.6, 0);
        const fl = mk("plane", M("#2a3d52"), 6.5, 4.5, 1, -2.2, 0, 0);
        fl.material.side = T.DoubleSide;
        fl.rotation.x = Math.PI / 2;
        tail.add(fl);
        g2.add(tail);
        g2.add(mk("box", M("#2a3d52"), 2.6, 2.6, 0.7, 1, 4.2, 0));
        g2.userData = { tail };
        return g2;
    }
    const whaleEntries = [];
    for (let i = 0; i < ambientCount(2, 1); i++) {
        const wh = makeWhale();
        scene.add(wh);
        whaleEntries.push({ wh, R0: 335 + i * 60, ph: i * 3.1, w: 0.05 * (i ? -1 : 1) });
    }
    world.anims.push((t) => {
        whaleEntries.forEach(({ wh, R0, ph, w }) => {
            const a = t * w + ph, direction = w > 0 ? 1 : -1;
            wh.position.set(Math.cos(a) * R0, 0.4 + Math.sin(t * 0.45 + ph) * 2.6, Math.sin(a) * R0);
            wh.rotation.y = Math.atan2(-Math.cos(a) * direction, -Math.sin(a) * direction);
            wh.rotation.z = Math.sin(t * 0.45 + ph) * 0.13;
            wh.userData.tail.rotation.z = Math.sin(t * 2.3 + ph) * 0.4;
        });
    });

    function makeShark() {
        const g2 = new T.Group();
        g2.add(new T.Mesh(G.sph, new T.MeshLambertMaterial({ color: 3819088, transparent: true, opacity: 0.55 })));
        g2.children[0].scale.set(6, 1.5, 1.9);
        g2.children[0].position.y = -0.6;
        g2.add(mk("cone4", M("#39434e"), 2.3, 3.3, 0.55, 0.5, 1.6, 0));
        g2.add(mk("cone4", M("#39434e"), 1.4, 2.2, 0.45, -5, 0.7, 0));
        return g2;
    }
    const sharkEntries = [];
    for (let i = 0; i < ambientCount(3, 1); i++) {
        const sh = makeShark();
        scene.add(sh);
        sharkEntries.push({ sh, ph: i * 2.1, w: 0.12 * (i % 2 ? -1 : 1), R0: 254 + i * 17 });
    }
    world.anims.push((t) => {
        sharkEntries.forEach(({ sh, ph, w, R0 }) => {
            const a = t * w + ph, R2 = R0 + Math.sin(t * 0.9 + ph) * 9, direction = w > 0 ? 1 : -1;
            sh.position.set(Math.cos(a) * R2, 1.15, Math.sin(a) * R2);
            sh.rotation.y = Math.atan2(-Math.cos(a) * direction, -Math.sin(a) * direction);
            sh.rotation.z = Math.sin(t * 3 + ph) * 0.08;
        });
    });

    const cloudMaterial = new T.MeshLambertMaterial({ color: 15246730, transparent: true, opacity: 0.85 });
    const cloudEntries = [];
    const cloudCount = ambientCount(7, 3);
    for (let i = 0; i < cloudCount; i++) {
        const cl = new T.Group();
        const puffs = 3 + i % 3;
        for (let j = 0; j < puffs; j++) {
            const pf = new T.Mesh(G.sph, cloudMaterial);
            pf.scale.set(26 + Math.random() * 24, 8 + Math.random() * 5, 15 + Math.random() * 9);
            pf.position.set(j * 22 - puffs * 11, (Math.random() - 0.5) * 6, (Math.random() - 0.5) * 12);
            cl.add(pf);
        }
        scene.add(cl);
        cloudEntries.push({ cl, ca: i / cloudCount * 6.283, cr: 430 + Math.random() * 420, cy: 135 + Math.random() * 95, cw: 5e-3 + Math.random() * 6e-3 });
    }
    world.anims.push((t, dt) => {
        cloudEntries.forEach((entry) => {
            entry.ca += entry.cw * dt;
            entry.cl.position.set(Math.cos(entry.ca) * entry.cr, entry.cy, Math.sin(entry.ca) * entry.cr);
        });
    });

    const gullEntries = [];
    for (let i = 0; i < ambientCount(4, 2); i++) {
        const gl = new T.Group();
        gl.add(mk("sph", M("#e8e8ee"), 1.1, 0.8, 0.7, 0, 0, 0));
        const bk = mk("cone", M("#e0a13a"), 0.25, 0.8, 0.25, 1.15, 0, 0);
        bk.rotation.z = -Math.PI / 2;
        gl.add(bk);
        const wl2 = mk("plane", MB("#dfe0ea"), 2.7, 0.95, 1, -0.2, 0.15, -1.25);
        wl2.rotation.x = Math.PI / 2;
        const wr2 = mk("plane", MB("#dfe0ea"), 2.7, 0.95, 1, -0.2, 0.15, 1.25);
        wr2.rotation.x = Math.PI / 2;
        gl.add(wl2, wr2);
        gl.scale.set(1.7, 1.7, 1.7);
        scene.add(gl);
        gullEntries.push({ gl, wl2, wr2, ph: i * 1.9, R0: 205 + i * 36, w: i % 2 ? -0.15 : 0.15, gy: 64 + i * 9 });
    }
    world.anims.push((t) => {
        gullEntries.forEach(({ gl, wl2, wr2, ph, R0, w, gy }) => {
            const a = t * w + ph, direction = w > 0 ? 1 : -1;
            gl.position.set(Math.cos(a) * R0, gy + Math.sin(t * 1.4 + ph) * 4, Math.sin(a) * R0);
            gl.rotation.y = Math.atan2(-Math.cos(a) * direction, -Math.sin(a) * direction);
            wl2.rotation.z = Math.sin(t * 8 + ph) * 0.7;
            wr2.rotation.z = -Math.sin(t * 8 + ph) * 0.7;
        });
    });
    function makeFigure(opt) {
        const s = opt.s || 1, g = new T.Group();
        const legL = mk("box", M(opt.legs || opt.cloth), 1.05 * s, 2.2 * s, 1.05 * s, -0.75 * s, 1.1 * s, 0);
        const legR = legL.clone();
        legR.position.x = 0.75 * s;
        const torso = mk("box", M(opt.cloth), 2.9 * s, 3 * s, 1.8 * s, 0, 3.6 * s, 0);
        const head = mk("sph", M(opt.skin), 1.35 * s, 1.35 * s, 1.35 * s, 0, 6.1 * s, 0);
        const armL = new T.Group();
        armL.position.set(-1.85 * s, 4.9 * s, 0);
        armL.add(mk("box", M(opt.cloth), 0.85 * s, 2.5 * s, 0.85 * s, 0, -1.15 * s, 0));
        const armR = new T.Group();
        armR.position.set(1.85 * s, 4.9 * s, 0);
        armR.add(mk("box", M(opt.cloth), 0.85 * s, 2.5 * s, 0.85 * s, 0, -1.15 * s, 0));
        g.add(legL, legR, torso, head, armL, armR);
        g.userData = { armL, armR, head, s };
        return g;
    }
    function wander(obj, cx, cz, r, speed, yBase, bob) {
        let tx = cx, tz = cz;
        world.anims.push((t, dt) => {
            const dx = tx - obj.position.x, dz = tz - obj.position.z, d = Math.hypot(dx, dz);
            if (d < 1.2) {
                const a = Math.random() * 6.283, rr = 2 + Math.random() * r;
                tx = cx + Math.cos(a) * rr;
                tz = cz + Math.sin(a) * rr;
            }
            else {
                obj.position.x += dx / d * speed * dt;
                obj.position.z += dz / d * speed * dt;
                obj.rotation.y = Math.atan2(-dz, dx);
            }
            obj.position.y = yBase + (bob ? Math.abs(Math.sin(t * 5)) * 0.3 : 0);
        });
    }
    function pine(x, z, s) {
        const g = new T.Group();
        g.add(mk("cyl", M("#4a3320"), 0.7 * s, 3 * s, 0.7 * s, 0, 1.5 * s, 0));
        g.add(mk("cone", M("#1c3a22"), 3.4 * s, 5.5 * s, 3.4 * s, 0, 5 * s, 0));
        g.add(mk("cone", M("#16301c"), 2.5 * s, 4.4 * s, 2.5 * s, 0, 8 * s, 0));
        g.position.set(x, TOP, z);
        return g;
    }
    function crow(cx, cz, R, ph) {
        const g = new T.Group();
        g.add(mk("sph", M("#111116"), 0.9, 0.7, 0.6, 0, 0, 0));
        g.add(mk("cone", M("#c9922e"), 0.22, 0.7, 0.22, 0.95, 0, 0, 0)).children;
        g.children[1].rotation.z = -Math.PI / 2;
        const wl = mk("plane", MB("#15151c"), 2.1, 0.8, 1, -0.2, 0.15, -1);
        wl.rotation.x = Math.PI / 2;
        const wr = mk("plane", MB("#15151c"), 2.1, 0.8, 1, -0.2, 0.15, 1);
        wr.rotation.x = Math.PI / 2;
        g.add(wl, wr);
        g.userData = { wl, wr };
        g.scale.set(1.5, 1.5, 1.5);
        world.anims.push((t) => {
            const a = t * 0.7 + ph;
            g.position.set(cx + Math.cos(a) * R, TOP + 20 + Math.sin(t * 1.6 + ph) * 2, cz + Math.sin(a) * R);
            g.rotation.y = Math.atan2(-Math.cos(a), -Math.sin(a));
            wl.rotation.z = Math.sin(t * 9 + ph) * 0.6;
            wr.rotation.z = -Math.sin(t * 9 + ph) * 0.6;
        });
        return g;
    }
    function makeFox() {
        const g = new T.Group();
        g.add(mk("box", M("#d97b29"), 2.6, 1.2, 1.1, 0, 1.3, 0));
        g.add(mk("box", M("#e8e2d8"), 1.1, 0.6, 0.9, 0.9, 0.85, 0));
        g.add(mk("box", M("#d97b29"), 1.05, 0.95, 0.95, 1.75, 1.85, 0));
        const e1 = mk("cone4", M("#b35f1a"), 0.3, 0.6, 0.3, 1.6, 2.6, -0.3);
        const e2 = e1.clone();
        e2.position.z = 0.3;
        const tail = mk("cone", M("#d97b29"), 0.5, 1.8, 0.5, -1.9, 1.5, 0);
        tail.rotation.z = Math.PI / 2 + 0.5;
        g.add(e1, e2, tail, mk("sph", M("#f2ede4"), 0.3, 0.3, 0.3, -2.6, 1.75, 0));
        for (let i = 0; i < 4; i++)
            g.add(mk("box", M("#8a4a16"), 0.3, 0.9, 0.3, i < 2 ? 0.8 : -0.8, 0.45, i % 2 ? 0.35 : -0.35));
        return g;
    }
    function makeHorse(color, mane, still) {
        const g = new T.Group();
        g.add(mk("box", M(color), 4.2, 2.2, 1.7, 0, 3.2, 0));
        for (let i = 0; i < 4; i++)
            g.add(mk("cyl", M(color), 0.28, 2.2, 0.28, i < 2 ? 1.5 : -1.5, 1.1, i % 2 ? 0.55 : -0.55));
        const neck = new T.Group();
        neck.position.set(1.9, 4, 0);
        neck.add(mk("box", M(color), 1.1, 2.4, 0.9, 0.35, 0.9, 0));
        neck.add(mk("box", M(color), 1.7, 0.95, 0.8, 1.05, 2.05, 0));
        neck.add(mk("box", M(mane), 0.3, 2.2, 0.5, -0.25, 1.1, 0));
        neck.add(mk("cone4", M(color), 0.2, 0.5, 0.2, 0.8, 2.7, 0.25));
        neck.add(mk("cone4", M(color), 0.2, 0.5, 0.2, 0.8, 2.7, -0.25));
        neck.rotation.z = -0.35;
        g.add(neck);
        const tail = mk("cone", M(mane), 0.4, 2, 0.4, -2.3, 3.2, 0);
        tail.rotation.z = 2.4;
        g.add(tail);
        g.userData = { neck, tail };
        if (!still)
            world.anims.push((t) => {
                neck.rotation.z = -0.35 + Math.sin(t * 1.3 + g.position.x) * 0.12;
                tail.rotation.z = 2.4 + Math.sin(t * 2.1 + g.position.z) * 0.15;
            });
        return g;
    }
    function makeSkeleton() {
        const f = makeFigure({ skin: "#ddd6c2", cloth: "#cfc8b2", legs: "#c4bda6", s: 1.45 });
        f.userData.head.add(mk("sph", MB("#0a0a0a"), 0.28, 0.28, 0.28, 0.5, 0.15, -0.42));
        f.userData.head.add(mk("sph", MB("#0a0a0a"), 0.28, 0.28, 0.28, 0.5, 0.15, 0.42));
        world.anims.push((t) => {
            f.rotation.z = Math.sin(t * 2.2 + f.position.x) * 0.06;
            f.userData.armL.rotation.x = Math.sin(t * 2.2) * 0.3;
            f.userData.armR.rotation.x = -Math.sin(t * 2.2) * 0.3;
        });
        return f;
    }
    function makeDwarf() {
        const f = makeFigure({ skin: "#e8b48f", cloth: "#5a4a8a", legs: "#3a3a4a", s: 1.55 });
        f.userData.head.add(mk("cone", M("#b35f1a"), 0.9, 1.4, 0.9, 0, -0.9, 0.5));
        f.userData.head.children[f.userData.head.children.length - 1].rotation.x = 0.9;
        f.userData.head.add(mk("cone4", M("#8a6b25"), 1.1, 1.1, 1.1, 0, 1, 0));
        const pick2 = new T.Group();
        pick2.add(mk("cyl", M("#6b4a2a"), 0.18, 3.4, 0.18, 0, -1.4, 0));
        pick2.add(mk("box", M("#7d7d8a"), 2.2, 0.5, 0.5, 0, -3, 0));
        pick2.rotation.z = 1.2;
        f.userData.armR.add(pick2);
        world.anims.push((t) => {
            const sw = Math.max(0, Math.sin(t * 3));
            f.userData.armR.rotation.x = -0.4 - sw * 1.3;
        });
        return f;
    }
    function decorate(h, rng) {
        const c = centers[h.k], g = new T.Group();
        g.position.set(0, 0, 0);
        const px = (r) => c.x + (rng() * 2 - 1) * r, pz = (r) => c.z + (rng() * 2 - 1) * r;
        if (h.terr === "gelo") {
            for (let i = 0; i < 4; i++) {
                const mR = 4 + rng() * 5;
                g.add(mk("ico", M("#e4f4fb"), mR, 0.9 + rng() * 1.1, mR, px(22), TOP + 0.15, pz(22), rng() * 3));
            }
            for (let i = 0; i < 2; i++) {
                const bear = new T.Group();
                bear.add(mk("sph", M("#f4f8fa"), 2.6, 1.7, 1.5, 0, 1.6, 0));
                bear.add(mk("sph", M("#f4f8fa"), 1.1, 1, 1, 2.4, 2.3, 0));
                bear.add(mk("sph", M("#14141c"), 0.18, 0.18, 0.18, 3.35, 2.35, 0));
                bear.add(mk("sph", M("#e8eef2"), 0.32, 0.32, 0.32, 2.0, 3.05, -0.55));
                bear.add(mk("sph", M("#e8eef2"), 0.32, 0.32, 0.32, 2.0, 3.05, 0.55));
                bear.add(mk("sph", MB("#0a0a0a"), 0.12, 0.12, 0.12, 3.15, 2.55, -0.35));
                bear.add(mk("sph", MB("#0a0a0a"), 0.12, 0.12, 0.12, 3.15, 2.55, 0.35));
                const blegs = [];
                for (const lx of [-1.4, 1.4])
                    for (const lz of [-0.85, 0.85]) {
                        const hip = new T.Group();
                        hip.position.set(lx, 1.15, lz);
                        hip.add(mk("cyl", M("#e8eef2"), 0.42, 1.15, 0.42, 0, -0.57, 0));
                        bear.add(hip);
                        blegs.push(hip);
                    }
                bear.scale.set(1.85, 1.85, 1.85);
                const cx = px(6), cz = pz(6), R = 6 + rng() * 5, w0 = 0.16 + rng() * 0.1, ph = rng() * 6.28, dir = rng() < 0.5 ? 1 : -1, sp = 4.6 + rng() * 1.2;
                bear.position.set(cx, TOP, cz);
                g.add(bear);
                world.anims.push((t) => {
                    const a = ph + dir * t * w0;
                    bear.position.set(cx + Math.cos(a) * R, TOP + Math.abs(Math.sin(t * (sp / 2) + ph)) * 0.55, cz + Math.sin(a) * R);
                    const vx = -Math.sin(a) * dir, vz = Math.cos(a) * dir;
                    bear.rotation.y = Math.atan2(-vz, vx);
                    bear.rotation.z = Math.sin(t * (sp / 2) + ph) * 0.05;
                    const sw = Math.sin(t * sp + ph) * 0.5;
                    blegs[0].rotation.z = sw;
                    blegs[3].rotation.z = sw;
                    blegs[1].rotation.z = -sw;
                    blegs[2].rotation.z = -sw;
                });
            }
            for (let i = 0; i < 3; i++) {
                const pg = new T.Group(), body = new T.Group();
                body.add(mk("sph", M("#1a1c26"), 0.85, 1.35, 0.85, 0, 1.3, 0));
                body.add(mk("sph", M("#f4f8fa"), 0.6, 1, 0.55, 0, 1.15, 0.38));
                body.add(mk("sph", M("#1a1c26"), 0.5, 0.5, 0.5, 0, 2.5, 0));
                body.add(mk("sph", M("#f4f8fa"), 0.13, 0.13, 0.13, 0.19, 2.62, 0.34));
                body.add(mk("sph", M("#f4f8fa"), 0.13, 0.13, 0.13, -0.19, 2.62, 0.34));
                body.add(mk("sph", MB("#0a0a0a"), 0.07, 0.07, 0.07, 0.19, 2.62, 0.44));
                body.add(mk("sph", MB("#0a0a0a"), 0.07, 0.07, 0.07, -0.19, 2.62, 0.44));
                const beak = mk("cone", M("#e8a13a"), 0.16, 0.5, 0.16, 0, 2.45, 0.55);
                beak.rotation.x = 1.4;
                body.add(beak);
                const flL = new T.Group();
                flL.position.set(0.82, 1.5, 0);
                flL.add(mk("box", M("#1a1c26"), 0.14, 1, 0.5, 0, -0.4, 0));
                body.add(flL);
                const flR = new T.Group();
                flR.position.set(-0.82, 1.5, 0);
                flR.add(mk("box", M("#1a1c26"), 0.14, 1, 0.5, 0, -0.4, 0));
                body.add(flR);
                pg.add(body);
                pg.scale.set(2.05, 2.05, 2.05);
                const cx = px(9), cz = pz(9), R = 4 + rng() * 5, w0 = 0.24 + rng() * 0.14, ph = rng() * 6.28, dir = rng() < 0.5 ? 1 : -1;
                pg.position.set(cx, TOP, cz);
                g.add(pg);
                world.anims.push((t) => {
                    const a = ph + dir * t * w0;
                    pg.position.set(cx + Math.cos(a) * R, TOP + Math.abs(Math.sin(t * 5 + ph)) * 0.45, cz + Math.sin(a) * R);
                    const vx = -Math.sin(a) * dir, vz = Math.cos(a) * dir;
                    pg.rotation.y = Math.atan2(vx, vz);
                    body.rotation.z = Math.sin(t * 5 + ph) * 0.22;
                    const fw = Math.sin(t * 10 + ph) * 0.5;
                    flL.rotation.x = fw;
                    flR.rotation.x = -fw;
                });
            }
            return g;
        }
        if (mode === "guerra" && !(h.terr === "deserto" && h.k === board.dragon)) {
            const a0 = rng() * 6.283;
            const ex = (j, rr) => c.x + Math.cos(a0 + j * 0.55) * rr, ez = (j, rr) => c.z + Math.sin(a0 + j * 0.55) * rr;
            if (h.terr === "floresta") {
                for (let i = 0; i < 2; i++)
                    g.add(pine(ex(i, 26), ez(i, 26), 0.55 + rng() * 0.25));
            }
            else if (h.terr === "argila") {
                g.add(mk("cyl", M("#7a3a16"), 5.5, 0.4, 5.5, ex(0, 25), TOP + 0.12, ez(0, 25)));
            }
            else if (h.terr === "grutas") {
                const mound = mk("ico", M("#6f6555"), 7, 4.8, 6.2, ex(0, 25), TOP + 1.5, ez(0, 25));
                mound.rotation.y = rng() * 3;
                g.add(mound);
            }
            else if (h.terr === "prados") {
                const barn = new T.Group();
                barn.add(mk("box", M("#7a4a2a"), 6.4, 3.4, 4.6, 0, TOP + 1.7, 0));
                const rf = mk("cone4", M("#5a3220"), 4.7, 2.3, 3.8, 0, TOP + 4.5, 0);
                rf.rotation.y = Math.PI / 4;
                barn.add(rf);
                barn.position.set(ex(0, 25), 0, ez(0, 25));
                barn.rotation.y = rng() * 3;
                g.add(barn);
            }
            else if (h.terr === "montanhas") {
                const pk = mk("oct", MP("#241d33", 1312799), 3.4 + rng() * 1.4, 6.5 + rng() * 2, 3.4 + rng() * 1.4, ex(0, 25), TOP + 3.4, ez(0, 25));
                pk.rotation.y = rng() * 3;
                g.add(pk);
            }
            else if (h.terr === "deserto") {
                const tr = mk("cyl", M("#2a2018"), 0.4, 4 + rng() * 2, 0.4, ex(0, 26), TOP + 2.4, ez(0, 26));
                tr.rotation.z = (rng() - 0.5) * 0.5;
                g.add(tr);
            }
            return g;
        }
        if (h.terr === "floresta") {
            for (let i = 0; i < 7; i++)
                g.add(pine(px(26), pz(26), 0.75 + rng() * 0.7));
            g.add(crow(c.x, c.z, 13 + rng() * 5, rng() * 6));
            g.add(crow(c.x, c.z, 10 + rng() * 5, rng() * 6 + 2));
        }
        else if (h.terr === "argila") {
            for (let i = 0; i < 3; i++) {
                const m = mk("ico", M("#b06a35"), 3 + rng() * 3, 2 + rng() * 2, 3 + rng() * 3, px(24), TOP + 1, pz(24));
                m.rotation.y = rng() * 3;
                g.add(m);
            }
            const pit = mk("cyl", M("#7a3a16"), 9, 0.5, 9, px(10), TOP + 0.15, pz(10));
            g.add(pit);
            for (let i = 0; i < 2; i++) {
                const b = mk("cone", M("#6b4a2a"), 0.5, 2.2, 0.5, px(26), TOP + 1, pz(26));
                g.add(b);
            }
            const fox = makeFox();
            fox.scale.set(1.8, 1.8, 1.8);
            fox.position.set(c.x, TOP, c.z);
            g.add(fox);
            wander(fox, c.x, c.z, 20, 7, TOP, true);
        }
        else if (h.terr === "grutas") {
            const mound = mk("ico", M("#6f6555"), 15, 10, 13, c.x - 8, TOP + 3, c.z - 8);
            mound.rotation.y = rng() * 3;
            g.add(mound);
            g.add(mk("box", MB("#0c0805"), 7, 6, 3, c.x - 4, TOP + 2.5, c.z + 1));
            for (let i = 0; i < 6; i++)
                g.add(mk("oct", M("#ffd23a", 5584896), 1 + rng(), 1 + rng(), 1 + rng(), px(22), TOP + 0.8, pz(22)));
            g.add(mk("oct", M("#ffd23a", 5584896), 1.6, 1.6, 1.6, c.x - 10, TOP + 9, c.z - 10));
            const ra = { x: c.x + 2, z: c.z + 14 }, rb = { x: c.x + 16, z: c.z - 6 };
            const rlen = Math.hypot(rb.x - ra.x, rb.z - ra.z), ryaw = Math.atan2(-(rb.z - ra.z), rb.x - ra.x);
            const rmx = (ra.x + rb.x) / 2, rmz = (ra.z + rb.z) / 2;
            g.add(mk("box", M("#4a3a2a"), rlen, 0.35, 0.5, rmx, TOP + 0.3, rmz - 1.1, ryaw));
            g.add(mk("box", M("#4a3a2a"), rlen, 0.35, 0.5, rmx, TOP + 0.3, rmz + 1.1, ryaw));
            for (let i = 0; i < 5; i++) {
                const s = i / 4;
                g.add(mk("box", M("#3a2c1a"), 0.7, 0.25, 3.4, ra.x + (rb.x - ra.x) * s, TOP + 0.2, ra.z + (rb.z - ra.z) * s, ryaw));
            }
            const cart = new T.Group();
            cart.add(mk("box", M("#5a4a3a"), 4, 2.2, 3, 0, 2.4, 0));
            cart.add(mk("sph", M("#ffd23a", 5584896), 1, 0.7, 1, -0.7, 3.6, 0.4));
            cart.add(mk("sph", M("#ffd23a", 5584896), 0.9, 0.6, 0.9, 0.8, 3.6, -0.4));
            for (let i = 0; i < 4; i++)
                cart.add(mk("cyl", M("#241a0e"), 0.8, 0.4, 0.8, i < 2 ? 1.3 : -1.3, 1, i % 2 ? 1.6 : -1.6)).children;
            cart.children.forEach((ch2, idx) => {
                if (idx >= 3)
                    ch2.rotation.x = Math.PI / 2;
            });
            cart.rotation.y = ryaw;
            g.add(cart);
            world.anims.push((t) => {
                const s = (Math.sin(t * 0.9) + 1) / 2;
                cart.position.set(ra.x + (rb.x - ra.x) * s, TOP, ra.z + (rb.z - ra.z) * s);
            });
            const dw = makeDwarf();
            dw.position.set(c.x - 14, TOP, c.z + 8);
            dw.rotation.y = rng() * 6;
            g.add(dw);
        }
        else if (h.terr === "prados") {
            const barn = new T.Group();
            barn.add(mk("box", M("#7a4a2a"), 13, 6.5, 9, 0, TOP + 3.2, 0));
            const roof = mk("cone4", M("#5a3220"), 9.5, 4.5, 7.5, 0, TOP + 8.7, 0);
            roof.rotation.y = Math.PI / 4;
            barn.add(roof);
            barn.add(mk("box", MB("#241206"), 3, 4, 0.5, 0, TOP + 2, 4.6));
            barn.position.set(c.x - 10, 0, c.z - 10);
            barn.rotation.y = rng() * 1.5;
            g.add(barn);
            const fc = { x: c.x + 8, z: c.z + 8 }, fr = 13;
            for (let i = 0; i < 8; i++) {
                const a = i / 8 * 6.283;
                g.add(mk("cyl", M("#6b4a2a"), 0.3, 2.6, 0.3, fc.x + Math.cos(a) * fr, TOP + 1.3, fc.z + Math.sin(a) * fr));
            }
            for (let i = 0; i < 8; i++) {
                const a = i / 8 * 6.283, a2 = (i + 1) / 8 * 6.283;
                const x1 = fc.x + Math.cos(a) * fr, z1 = fc.z + Math.sin(a) * fr, x2 = fc.x + Math.cos(a2) * fr, z2 = fc.z + Math.sin(a2) * fr;
                g.add(mk("box", M("#6b4a2a"), Math.hypot(x2 - x1, z2 - z1), 0.35, 0.35, (x1 + x2) / 2, TOP + 2.1, (z1 + z2) / 2, Math.atan2(-(z2 - z1), x2 - x1)));
            }
            const breeds = [["#6b4423", "#241a0e"], ["#22201e", "#0c0c0c"], ["#e8e2d8", "#b8b2a8"]];
            for (let i = 0; i < 3; i++) {
                const hm = makeHorse(breeds[i][0], breeds[i][1]);
                hm.scale.set(1.55, 1.55, 1.55);
                hm.position.set(fc.x, TOP, fc.z);
                g.add(hm);
                wander(hm, fc.x, fc.z, fr - 6, 3.5, TOP, false);
            }
        }
        else if (h.terr === "montanhas") {
            for (let i = 0; i < 3; i++) {
                const p = mk("oct", MP("#241d33", 1312799), 5 + rng() * 4, 11 + rng() * 7, 5 + rng() * 4, px(18), TOP + 6, pz(18));
                p.rotation.y = rng() * 3;
                g.add(p);
            }
            for (let i = 0; i < 5; i++) {
                const s2 = mk("oct", MP("#2e2542", 1575462), 1 + rng() * 1.4, 3 + rng() * 3, 1 + rng() * 1.4, px(26), TOP + 1.5, pz(26));
                s2.rotation.y = rng() * 3;
                g.add(s2);
            }
            for (let i = 0; i < 2; i++) {
                const sk = makeSkeleton();
                sk.position.set(px(14), TOP, pz(14));
                g.add(sk);
                wander(sk, c.x, c.z, 22, 2.2, TOP, false);
            }
        }
        else if (h.terr === "deserto" && h.k !== board.dragon) {
            for (let i = 0; i < 3; i++) {
                const cone = mk("cone", M("#332320"), 7 + rng() * 7, 6 + rng() * 8, 7 + rng() * 7, px(20), TOP + 4, pz(20));
                cone.rotation.y = rng() * 3;
                g.add(cone);
                g.add(mk("cyl", MB("#c2340c"), 1.6, 0.6, 1.6, cone.position.x, cone.position.y + 4.4, cone.position.z));
            }
            for (let i = 0; i < 5; i++)
                g.add(mk("ico", M("#1d1512"), 2 + rng() * 3, 1 + rng() * 2, 2 + rng() * 3, px(26), TOP + 0.7, pz(26)));
            for (let i = 0; i < 3; i++) {
                const tr = mk("cyl", M("#2a2018"), 0.5, 6 + rng() * 4, 0.5, px(26), TOP + 3.5, pz(26));
                tr.rotation.z = (rng() - 0.5) * 0.5;
                g.add(tr);
            }
        }
        else if (h.terr === "deserto") {
            const volc = new T.Group();
            volc.add(mk("cone", M("#3a2620"), 26, 24, 26, 0, TOP + 11, 0));
            volc.add(mk("cyl", M("#241512"), 9, 3, 9, 0, TOP + 21.5, 0));
            volc.add(mk("cyl", MB("#ff6a22"), 7, 1.2, 7, 0, TOP + 22.6, 0));
            const l1 = mk("box", MB("#ff5a1f"), 2.2, 0.8, 14, 5, TOP + 14, 9);
            l1.rotation.x = 0.9;
            l1.rotation.y = -0.4;
            volc.add(l1);
            const l2 = mk("box", MB("#e8481a"), 1.8, 0.8, 12, -8, TOP + 13, -5);
            l2.rotation.x = -0.95;
            l2.rotation.y = 0.6;
            volc.add(l2);
            const lamp = new T.PointLight(16738850, 1.3, 150);
            lamp.position.set(0, TOP + 26, 0);
            volc.add(lamp);
            const smokes = [];
            for (let i = 0; i < 3; i++) {
                const sm = new T.Mesh(G.sph, new T.MeshBasicMaterial({ color: 7829367, transparent: true, opacity: 0.4 }));
                sm.scale.set(2.5, 2.5, 2.5);
                sm.position.set((rng() - 0.5) * 6, TOP + 24 + i * 5, (rng() - 0.5) * 6);
                volc.add(sm);
                smokes.push(sm);
            }
            world.anims.push((t, dt) => {
                lamp.intensity = 1.2 + Math.sin(t * 3.2) * 0.45;
                smokes.forEach((sm, i) => {
                    sm.position.y += dt * 4;
                    sm.scale.multiplyScalar(1 + dt * 0.35);
                    if (sm.position.y > TOP + 42) {
                        sm.position.y = TOP + 23;
                        sm.scale.set(2 + i, 2 + i, 2 + i);
                        sm.position.x = (Math.random() - 0.5) * 6;
                        sm.position.z = (Math.random() - 0.5) * 6;
                    }
                });
            });
            volc.position.set(c.x, 0, c.z);
            g.add(volc);
        }
        return g;
    }
    function makeSprite(draw, w, hgt) {
        const cv = document.createElement("canvas");
        cv.width = 256;
        cv.height = 256;
        const ctx = cv.getContext("2d");
        const tx = new T.CanvasTexture(cv);
        const redraw = (nextDraw = draw) => {
            ctx.clearRect(0, 0, cv.width, cv.height);
            nextDraw(ctx, cv);
            tx.needsUpdate = true;
        };
        redraw(draw);
        const sp = new T.Sprite(new T.SpriteMaterial({ map: tx, transparent: true, depthTest: false }));
        sp.renderOrder = 40;
        sp.scale.set(w, hgt, 1);
        sp.userData.redraw = redraw;
        return sp;
    }
    function tokenSprite(num) {
        const omen = (num === 2 || num === 12) && !CLASSICO(mode) && !GUERRA(mode), red = num === 6 || num === 8;
        let omenIcon = null;
        const draw = (ctx) => {
            ctx.beginPath();
            ctx.arc(128, 128, 100, 0, 6.3);
            ctx.fillStyle = "#efe3c0";
            ctx.fill();
            ctx.lineWidth = 15;
            ctx.strokeStyle = omen ? "#8d4fd3" : "#3a2c14";
            ctx.stroke();
            ctx.fillStyle = red ? "#a8232b" : omen ? "#6d2fb5" : "#241a0e";
            ctx.font = "bold 104px Georgia";
            ctx.textAlign = "center";
            ctx.fillText(num, 128, 158);
            ctx.fillStyle = "#6b5322";
            ctx.font = "44px Georgia";
            ctx.fillText("\u2022".repeat(PIPS[num]), 128, 208);
            if (omenIcon) {
                ctx.imageSmoothingEnabled = false;
                ctx.drawImage(omenIcon, 164, 48, 52, 52);
            }
        };
        const sprite = makeSprite(draw, 23, 23);
        if (omen) loadBoardIcon("RDD_ModeDragon", (image) => { omenIcon = image; sprite.userData.redraw(draw); });
        return sprite;
    }
    const FLAGS = ["#c0392b", "#2980b9", "#27ae60", "#8e44ad", "#d35400", "#16a085", "#f1c40f", "#7f8c8d", "#e84393"];
    function makeShip(flagColor, ph) {
        const g = new T.Group();
        g.add(mk("box", M("#5a3a22"), 13, 3.2, 5.4, 0, 2, 0));
        g.add(mk("box", M("#6b4a2a"), 12.4, 0.6, 4.8, 0, 3.7, 0));
        const bow = mk("cone4", M("#5a3a22"), 2.7, 4, 2.7, 7.6, 2, 0);
        bow.rotation.z = -Math.PI / 2;
        bow.rotation.y = Math.PI / 4;
        g.add(bow);
        g.add(mk("box", M("#4a2f1a"), 3.2, 2.4, 5.4, -5, 4.6, 0));
        g.add(mk("cyl", M("#3a2c1a"), 0.35, 12, 0.35, 1.5, 9, 0));
        g.add(mk("cyl", M("#3a2c1a"), 0.3, 9, 0.3, -3.5, 7.8, 0));
        const s1 = mk("plane", new T.MeshLambertMaterial({ color: 15262418, side: T.DoubleSide }), 6.5, 5.6, 1, 1.5, 10.8, 0);
        s1.rotation.y = Math.PI / 2;
        g.add(s1);
        const s2 = mk("plane", new T.MeshLambertMaterial({ color: 14603970, side: T.DoubleSide }), 5, 4, 1, -3.5, 9, 0);
        s2.rotation.y = Math.PI / 2;
        g.add(s2);
        const flag = mk("plane", new T.MeshBasicMaterial({ color: flagColor, side: T.DoubleSide }), 3.4, 2, 1, 3.3, 15.2, 0);
        g.add(flag);
        const skull = mk("plane", new T.MeshBasicMaterial({ color: 16777215, side: T.DoubleSide }), 0.9, 0.9, 1, 3.3, 15.2, 0.02);
        g.add(skull);
        const pir = makeFigure({ skin: "#e0b48a", cloth: "#3a2f3a", legs: "#241a14", s: 0.9 });
        pir.userData.head.add(mk("box", M(flagColor), 1.6, 0.5, 1.6, 0, 0.55, 0));
        pir.position.set(5.7, 4, 0);
        pir.rotation.y = Math.PI / 2;
        g.add(pir);
        world.anims.push((t) => {
            g.position.y = 1.1 + Math.sin(t * 1.15 + ph) * 0.4;
            g.rotation.z = Math.sin(t * 0.85 + ph) * 0.045;
            g.rotation.x = Math.sin(t * 1.05 + ph + 2) * 0.03;
            flag.rotation.y = Math.sin(t * 3 + ph) * 0.3;
            skull.rotation.y = flag.rotation.y;
        });
        return g;
    }
    function buildPort(pt, i) {
        const e = gr.edges[pt.e], a = gr.verts[e.a], b = gr.verts[e.b];
        const mx = (a.x + b.x) / 2, mz = (a.y + b.y) / 2;
        const len = Math.hypot(mx, mz) || 1, ox = mx / len, oz = mz / len;
        const dock = { x: mx + ox * 30, z: mz + oz * 30 };
        const grp = new T.Group();
        [[a.x, a.y], [b.x, b.y]].forEach(([vx, vz]) => {
            const dx = dock.x - vx, dz = dock.z - vz, dy = 2.8 - (TOP + 0.4);
            const L = Math.sqrt(dx * dx + dy * dy + dz * dz);
            const plank = new T.Mesh(G.box, M("#6b4a2a"));
            plank.scale.set(L, 0.9, 3.4);
            plank.position.set((vx + dock.x) / 2, (TOP + 0.4 + 2.8) / 2, (vz + dock.z) / 2);
            plank.quaternion.setFromUnitVectors(new T.Vector3(1, 0, 0), new T.Vector3(dx, dy, dz).normalize());
            grp.add(plank);
            for (const s of [0.35, 0.7]) {
                grp.add(mk("cyl", M("#4a3320"), 0.5, 6, 0.5, vx + dx * s, 2, vz + dz * s));
            }
        });
        grp.add(mk("box", M("#7a5a35"), 10, 1, 10, dock.x, 3.1, dock.z, Math.atan2(-oz, ox)));
        const ship = makeShip(FLAGS[i % FLAGS.length], i * 1.7);
        ship.scale.set(1.45, 1.45, 1.45);
        ship.position.set(mx + ox * 47, 1.1, mz + oz * 47);
        ship.rotation.y = Math.atan2(ox, oz) + Math.PI / 2;
        grp.add(ship);
        let portIcon = null;
        const drawPortLabel = (ctx) => {
            ctx.fillStyle = "rgba(20,13,7,.92)";
            ctx.strokeStyle = "#e0b23a";
            ctx.lineWidth = 9;
            ctx.beginPath();
            if (ctx.roundRect) ctx.roundRect(46, 22, 164, 212, 28);
            else ctx.rect(46, 22, 164, 212);
            ctx.fill();
            ctx.stroke();
            ctx.fillStyle = "#ffd76b";
            ctx.textAlign = "center";
            ctx.font = "bold 76px Georgia";
            ctx.fillText(pt.type === "any" ? "3:1" : "2:1", 128, 106);
            if (portIcon) {
                ctx.imageSmoothingEnabled = false;
                ctx.drawImage(portIcon, 84, 136, 88, 88);
            }
        };
        const lbl = makeSprite(drawPortLabel, 21, 21);
        const iconName = pt.type === "any" ? "RDD_Port" : RESOURCE_ICON_BY_KEY[pt.type];
        loadBoardIcon(iconName, (image) => { portIcon = image; lbl.userData.redraw(drawPortLabel); });
        lbl.position.set(mx + ox * 47, 30, mz + oz * 47);
        grp.add(lbl);
        return grp;
    }
    function makeDragon(pal) {
        pal = Object.assign({ body: "#8e1f1a", belly: "#d98a3a", head: "#a8271f", horn: "#e8dcc0", eye: "#ffd23a", w1: 7214354, w2: 5902350 }, pal || {});
        const g = new T.Group();
        g.add(mk("sph", M(pal.body), 5.4, 3.1, 3.1, 0, 0, 0));
        g.add(mk("sph", M(pal.belly), 4.4, 2.3, 2.6, 0.4, -0.9, 0));
        const neck = mk("cyl", M(pal.body), 1.5, 4.6, 1.5, 4.4, 1.6, 0);
        neck.rotation.z = -0.9;
        g.add(neck);
        g.add(mk("box", M(pal.head), 2.8, 1.7, 1.8, 6.6, 3.1, 0));
        g.add(mk("box", M(pal.head), 1.9, 0.95, 1.3, 8.4, 2.75, 0));
        g.add(mk("cone", M(pal.horn), 0.35, 1.6, 0.35, 5.9, 4.4, -0.6)).children;
        g.children[g.children.length - 1].rotation.z = 0.6;
        const h2 = mk("cone", M(pal.horn), 0.35, 1.6, 0.35, 5.9, 4.4, 0.6);
        h2.rotation.z = 0.6;
        g.add(h2);
        g.add(mk("sph", MB(pal.eye), 0.35, 0.35, 0.35, 7.4, 3.4, -0.95));
        g.add(mk("sph", MB(pal.eye), 0.35, 0.35, 0.35, 7.4, 3.4, 0.95));
        const tails = [];
        for (let i = 0; i < 3; i++) {
            const tl = mk("cone", M(pal.body), 1.3 - i * 0.35, 3.6, 1.3 - i * 0.35, -5.5 - i * 2.6, 0.4 + i * 0.5, 0);
            tl.rotation.z = 1.9 + i * 0.15;
            g.add(tl);
            tails.push(tl);
        }
        const mkWing = (sgn) => {
            const w = new T.Group();
            w.position.set(-0.5, 1.6, sgn * 1.8);
            const m1 = mk("plane", new T.MeshLambertMaterial({ color: pal.w1, side: T.DoubleSide }), 9, 4.6, 1, -1, 0, sgn * 4);
            m1.rotation.x = Math.PI / 2;
            const m2 = mk("plane", new T.MeshLambertMaterial({ color: pal.w2, side: T.DoubleSide }), 5.5, 3.2, 1, -3.5, 0, sgn * 8.2);
            m2.rotation.x = Math.PI / 2;
            w.add(m1, m2);
            return w;
        };
        const wl = mkWing(-1), wr = mkWing(1);
        g.add(wl, wr);
        g.userData = { wl, wr, tails };
        return g;
    }
    const dragon = makeDragon();
    dragon.scale.set(1.55, 1.55, 1.55);
    scene.add(dragon);
    const geloHex = board.hexes.find((h) => h.terr === "gelo");
    let ice = null;
    if (geloHex && centers[geloHex.k]) {
        ice = makeDragon({ body: "#2a6f9e", belly: "#cfeef8", head: "#2f7fb0", horn: "#eef8fc", eye: "#aef3ff", w1: 10475759, w2: 7321304 });
        ice.scale.set(1.2, 1.2, 1.2);
        scene.add(ice);
        const icPos = new T.Vector3(centers[geloHex.k].x, 9, centers[geloHex.k].z);
        world.anims.push((t, dt) => {
            const c = centers[geloHex.k];
            const ud = ice.userData;
            if (!world.geloAwake) {
                ice.position.set(c.x, 8.5 + Math.sin(t * 0.7) * 0.5, c.z);
                ice.rotation.y = 0.7;
                const sc = 1.2 + Math.sin(t * 0.7) * 0.012;
                ice.scale.set(sc, sc, sc);
                ud.wl.scale.set(0.42, 1, 0.5);
                ud.wr.scale.set(0.42, 1, 0.5);
                ud.wl.rotation.x = 0;
                ud.wr.rotation.x = 0;
                ud.wl.rotation.z = 1.25 + Math.sin(t * 0.7) * 0.03;
                ud.wr.rotation.z = -1.25 - Math.sin(t * 0.7) * 0.03;
            }
            else {
                ud.wl.scale.set(1, 1, 1);
                ud.wr.scale.set(1, 1, 1);
                ud.wl.rotation.z = 0;
                ud.wr.rotation.z = 0;
                const tx = c.x + Math.cos(t * 0.5 + 2) * 15, tz = c.z + Math.sin(t * 0.5 + 2) * 15;
                const k = Math.min(1, dt * 1.6);
                icPos.x += (tx - icPos.x) * k;
                icPos.y += (27 + Math.sin(t * 1.5) * 2.2 - icPos.y) * k;
                icPos.z += (tz - icPos.z) * k;
                ice.position.copy(icPos);
                ice.rotation.y = -(t * 0.5 + 2) - Math.PI / 2;
                ud.wl.rotation.x = Math.sin(t * 6.5) * 0.55;
                ud.wr.rotation.x = -Math.sin(t * 6.5) * 0.55;
                ud.tails.forEach((tl, i) => tl.rotation.z = 1.9 + i * 0.15 + Math.sin(t * 2.4 + i) * 0.14);
            }
        });
    }
    const dc0 = centers[board.dragon];
    const dpos = new T.Vector3(dc0.x, 30, dc0.z);
    let dlx = dc0.x, dlz = dc0.z;
    world.anims.push((t, dt) => {
        const c = centers[world.dragonHex] || dc0;
        const tx = c.x + Math.cos(t * 0.55) * 16, tz = c.z + Math.sin(t * 0.55) * 16, ty = 32 + Math.sin(t * 1.6) * 2.5;
        const k = Math.min(1, dt * 1.7);
        dpos.x += (tx - dpos.x) * k;
        dpos.y += (ty - dpos.y) * k;
        dpos.z += (tz - dpos.z) * k;
        dragon.position.copy(dpos);
        const vx = dpos.x - dlx, vz = dpos.z - dlz;
        if (Math.hypot(vx, vz) > 0.02)
            dragon.rotation.y = Math.atan2(-vz, vx);
        dlx = dpos.x;
        dlz = dpos.z;
        const fl = Math.sin(t * 6.5) * 0.55;
        dragon.userData.wl.rotation.x = fl;
        dragon.userData.wr.rotation.x = -fl;
        dragon.userData.tails.forEach((tl, i) => {
            tl.rotation.y = Math.sin(t * 2.2 + i) * 0.18;
        });
        dragon.rotation.z = Math.sin(t * 1.2) * 0.07;
    });
    function groundDetail(h, rng) {
        const c = centers[h.k], g = new T.Group(), TS = TOP + 0.18;
        const px = () => c.x + (rng() * 2 - 1) * 29, pz = () => c.z + (rng() * 2 - 1) * 29;
        const patch = (col, r) => {
            g.add(mk("cyl", M(col), r, 0.16, r, px(), TS + 0.05, pz()));
        };
        if (h.terr === "floresta") {
            for (let i = 0; i < ambientCount(4, 2); i++)
                patch("#152a12", 2.5 + rng() * 3);
            for (let i = 0; i < ambientCount(8, 3); i++)
                g.add(mk("cone", M(rng() < 0.5 ? "#2a4a24" : "#1e3a1c"), 0.5, 1 + rng() * 1.2, 0.5, px(), TS + 0.55, pz()));
            for (let i = 0; i < ambientCount(2, 1); i++) {
                const fx = px(), fz = pz();
                g.add(mk("cyl", M("#e8e0d0"), 0.22, 0.8, 0.22, fx, TS + 0.4, fz));
                g.add(mk("sph", M("#b3372a"), 0.55, 0.35, 0.55, fx, TS + 0.85, fz));
            }
            const log = mk("cyl", M("#4a3320"), 0.8, 6, 0.8, px(), TS + 0.65, pz());
            log.rotation.z = Math.PI / 2;
            log.rotation.y = rng() * 3;
            g.add(log);
        }
        else if (h.terr === "argila") {
            for (let i = 0; i < ambientCount(6, 2); i++)
                g.add(mk("box", M("#cf7f46"), 5 + rng() * 4, 0.35, 1.1, px(), TS + 0.15, pz(), rng() * 3));
            for (let i = 0; i < ambientCount(4, 2); i++)
                g.add(mk("box", M("#5a2d15"), 3 + rng() * 4, 0.14, 0.55, px(), TS + 0.06, pz(), rng() * 3));
            for (let i = 0; i < ambientCount(5, 2); i++)
                g.add(mk("ico", M("#9a5a2a"), 0.7 + rng() * 0.7, 0.5 + rng() * 0.5, 0.7 + rng() * 0.7, px(), TS + 0.35, pz(), rng() * 3));
        }
        else if (h.terr === "prados") {
            for (let i = 0; i < ambientCount(4, 2); i++)
                patch("#5f7d36", 2.5 + rng() * 3.5);
            for (let i = 0; i < ambientCount(9, 4); i++)
                g.add(mk("cone", M("#7fa04a"), 0.45, 0.9 + rng(), 0.45, px(), TS + 0.45, pz()));
            for (let i = 0; i < ambientCount(5, 2); i++) {
                const fx = px(), fz = pz();
                g.add(mk("cyl", M("#4d6b2a"), 0.08, 1, 0.08, fx, TS + 0.45, fz));
                g.add(mk("sph", M(rng() < 0.5 ? "#e8e2d8" : "#e8b923"), 0.32, 0.32, 0.32, fx, TS + 1.05, fz));
            }
        }
        else if (h.terr === "grutas") {
            for (let i = 0; i < ambientCount(4, 2); i++)
                patch("#5a4a30", 2 + rng() * 3);
            for (let i = 0; i < ambientCount(7, 3); i++)
                g.add(mk("ico", M("#5f5648"), 0.8 + rng(), 0.6 + rng() * 0.7, 0.8 + rng(), px(), TS + 0.35, pz(), rng() * 3));
            for (let i = 0; i < ambientCount(3, 1); i++)
                g.add(mk("oct", M("#ffd23a", 5584896), 0.5 + rng() * 0.5, 0.5 + rng() * 0.5, 0.5 + rng() * 0.5, px(), TS + 0.3, pz()));
        }
        else if (h.terr === "montanhas") {
            for (let i = 0; i < ambientCount(4, 2); i++)
                patch("#1e1830", 2 + rng() * 3);
            for (let i = 0; i < ambientCount(6, 2); i++) {
                const sp = mk("oct", MP("#3a2f52", 1707310), 0.4 + rng() * 0.5, 1.4 + rng() * 1.6, 0.4 + rng() * 0.5, px(), TS + 0.8, pz());
                sp.rotation.z = (rng() - 0.5) * 0.6;
                g.add(sp);
            }
            for (let i = 0; i < ambientCount(5, 2); i++)
                g.add(mk("ico", M("#241d33"), 0.7 + rng() * 0.8, 0.5 + rng() * 0.5, 0.7 + rng() * 0.8, px(), TS + 0.3, pz(), rng() * 3));
        }
        else if (h.terr === "deserto") {
            for (let i = 0; i < ambientCount(5, 2); i++)
                patch("#241512", 2.5 + rng() * 3);
            for (let i = 0; i < ambientCount(5, 2); i++)
                g.add(mk("ico", M("#2a1a14"), 0.8 + rng(), 0.6 + rng() * 0.6, 0.8 + rng(), px(), TS + 0.35, pz(), rng() * 3));
            for (let i = 0; i < ambientCount(3, 1); i++)
                g.add(mk("ico", MB("#ff5a1f"), 0.4 + rng() * 0.35, 0.3, 0.4 + rng() * 0.35, px(), TS + 0.2, pz()));
            for (let i = 0; i < ambientCount(4, 2); i++)
                g.add(mk("box", M("#0f0a08"), 4 + rng() * 4, 0.14, 0.6, px(), TS + 0.06, pz(), rng() * 3));
        }
        return g;
    }
    const TH0 = Math.PI / 2 + Math.PI / 6;
    const tileGeo = new T.CylinderGeometry(SIZE * 1, SIZE * 1.09, TOP, 6, 1, false, TH0);
    const capGeo = new T.CylinderGeometry(SIZE * 0.94, SIZE * 0.975, 1.4, 6, 1, false, TH0);
    const fogGeo = new T.CylinderGeometry(SIZE * 0.99, SIZE * 0.99, 1, 6, 1, false, TH0);
    const tint = (hex, amt, rng) => {
        const col = new T.Color(hex);
        col.offsetHSL(0, (rng() - 0.5) * 0.04, (rng() * 2 - 1) * amt);
        return col.getStyle();
    };
    const EDGE_MID = [], EDGE_YAW = [];
    for (let k2 = 0; k2 < 6; k2++) {
        const A2 = CORNER_OFF[k2], B2 = CORNER_OFF[(k2 + 1) % 6];
        EDGE_MID.push([(A2[0] + B2[0]) / 2 * 0.95, (A2[1] + B2[1]) / 2 * 0.95]);
        EDGE_YAW.push(Math.atan2(-(B2[1] - A2[1]), B2[0] - A2[0]));
    }
    board.hexes.forEach((h) => {
        const c = centers[h.k], rng = mulberry(hseed(h.k));
        const body = new T.Mesh(tileGeo, M(tint("#2a1c11", 0.05, rng)));
        body.position.set(c.x, TOP / 2, c.z);
        scene.add(body);
        const cap = new T.Mesh(capGeo, M(tint(TERR[h.terr].f[0], 0.055, rng)));
        cap.position.set(c.x, TOP - 0.55, c.z);
        scene.add(cap);
        for (let k2 = 0; k2 < 6; k2++) {
            scene.add(mk("box", M("#08080c"), SIZE * 0.8, 0.45, 0.85, c.x + EDGE_MID[k2][0], TOP + 0.2, c.z + EDGE_MID[k2][1], EDGE_YAW[k2]));
            const co = CORNER_OFF[k2];
            scene.add(mk("ico", M("#15100a"), 1.3, 1, 1.3, c.x + co[0] * 0.93, TOP + 0.3, c.z + co[1] * 0.93, rng() * 3));
        }
        const nm = 2 + Math.floor(rng() * 2);
        for (let i = 0; i < nm; i++) {
            const mR = 6 + rng() * 6;
            scene.add(mk("ico", M(tint(TERR[h.terr].f[0], 0.09, rng)), mR, 0.8 + rng() * 0.9, mR, c.x + (rng() * 2 - 1) * 23, TOP + 0.15, c.z + (rng() * 2 - 1) * 23, rng() * 3));
        }
        const gdet = groundDetail(h, rng), dec = decorate(h, rng);
        if (h.hid)
            fogDec[h.k] = [gdet, dec];
        else
            scene.add(gdet, dec);
        if (h.num) {
            const tk = tokenSprite(h.num);
            if (mode === "guerra") {
                tk.position.set(c.x, TOP + 7, c.z - 27);
                tk.scale.multiplyScalar(0.85);
            }
            else
                tk.position.set(c.x, TOP + 12, c.z);
            if (h.hid)
                fogTok[h.k] = tk;
            else
                scene.add(tk);
        }
        if (h.hid) {
            const fg = new T.Group();
            const blk = new T.Mesh(fogGeo, M("#2b2340", "#0b0716"));
            blk.scale.set(1, 16, 1);
            blk.position.y = TOP + 8;
            fg.add(blk);
            const qm = makeSprite((ctx) => {
                ctx.fillStyle = "#c9b6f0";
                ctx.font = "bold 190px Georgia";
                ctx.textAlign = "center";
                ctx.fillText("?", 128, 196);
            }, 20, 20);
            qm.position.set(0, TOP + 22, 0);
            fg.add(qm);
            fg.position.set(c.x, 0, c.z);
            scene.add(fg);
            fogG[h.k] = fg;
        }
    });
    const portMesh = board.ports.map((pt, i) => {
        const m = buildPort(pt, i);
        m.visible = !pt.hid;
        scene.add(m);
        return m;
    });
    const buildGroup = new T.Group(), roadGroup = new T.Group(), spotGroup = new T.Group();
    scene.add(buildGroup, roadGroup, spotGroup);
    const dynB = {}, dynR = {}, dynT = {}, dynU = {};
    const smokes = [], blinks = [];
    world.anims.push((t) => {
        const on = Math.sin(t * 7) > 0;
        for (const bm of blinks)
            bm.opacity = on ? 0.95 : 0.15;
        for (const s of smokes) {
            s.puffs.forEach((pf, i) => {
                const f = (t * 2.2 + i * 3.1 + s.seed) % 9;
                pf.position.y = s.baseY + f;
                const sc = 0.8 + f * 0.28;
                pf.scale.set(sc, sc, sc);
                pf.material.opacity = Math.max(0, 0.5 - f * 0.055);
                pf.position.x = s.baseX + Math.sin(t * 0.8 + i) * (0.4 + f * 0.22);
            });
        }
    });
    function popIn(m, k) {
        k = k || 1;
        m.scale.set(0.05, 0.05, 0.05);
        let t0 = 0;
        world.fx.push((dt) => {
            t0 += dt * 3;
            const s = Math.min(1, t0);
            const o = 1 + Math.sin(Math.min(1, s) * Math.PI) * 0.25 * (1 - s);
            m.scale.set(s * o * k, s * o * k, s * o * k);
            return s >= 1;
        });
    }
    function makeVillage(ch) {
        const g = new T.Group();
        g.add(mk("cyl", MB(GLOW[ch.id], 0.7), 7.2, 0.3, 7.2, 0, 0.2, 0));
        g.add(mk("box", M(ch.pc, shade(ch.pc, -150)), 7, 5, 7, 0, 2.5, 0));
        const roofG = new T.CylinderGeometry(1, 1, 1, 3, 1, false, Math.PI / 2);
        const roof = new T.Mesh(roofG, M(shade(ch.pc, -95)));
        roof.scale.set(4.4, 7.7, 4.4);
        roof.rotation.z = Math.PI / 2;
        roof.position.set(0, 7.2, 0);
        g.add(roof);
        g.add(mk("box", M(shade(ch.pc, -140)), 8, 0.4, 0.55, 0, 11.45, 0));
        g.add(mk("box", M("#4a3428"), 1.3, 3.2, 1.3, 2.1, 9.7, 1.7));
        g.add(mk("box", M("#2a1c12"), 1.75, 0.5, 1.75, 2.1, 11.4, 1.7));
        g.add(mk("box", MB("#241206"), 1.8, 2.6, 0.4, 0, 1.3, 3.6));
        g.add(mk("cyl", M("#3a2c1a"), 0.16, 3.4, 0.16, 0, 13, 0));
        g.add(mk("plane", new T.MeshBasicMaterial({ color: GLOW[ch.id], side: T.DoubleSide }), 2.2, 1.3, 1, 1.1, 13.9, 0));
        return g;
    }
    function makeWagon(ch) {
        const g = new T.Group();
        g.add(mk("box", M("#241a0e"), 9.4, 1.3, 6.2, 0, 1.5, 0));
        g.add(mk("box", M(ch.pc, shade(ch.pc, -150)), 7.4, 4.2, 5.4, -0.8, 4.1, 0));
        const cargo = mk("box", MB("#f0dfa8"), 4.6, 2.6, 4.2, -0.8, 7.4, 0);
        cargo.name = "cargo";
        g.add(cargo);
        for (const sx of [-1, 1])
            for (const sz of [-1, 1]) {
                const wh = mk("cyl", M("#0d0a06"), 2.4, 1.1, 2.4, sx * 3.4, 1.7, sz * 3.2);
                wh.rotation.z = Math.PI / 2;
                g.add(wh);
            }
        g.add(mk("cyl", M("#3a2c1a"), 0.35, 9, 0.35, 4.8, 4.5, 0));
        g.add(mk("plane", new T.MeshBasicMaterial({ color: ch.pc, side: T.DoubleSide }), 3.4, 2, 1, 6.4, 8, 0));
        return g;
    }
    function makePalace(ch) {
        const g = new T.Group();
        g.add(mk("cyl", MB(GLOW[ch.id], 0.7), 10.5, 0.3, 10.5, 0, 0.2, 0));
        g.add(mk("box", M(ch.pc, shade(ch.pc, -150)), 10, 8, 10, 0, 4, 0));
        const roof = mk("cone4", M(shade(ch.pc, -95)), 8, 5, 8, 0, 10.5, 0);
        roof.rotation.y = Math.PI / 4;
        g.add(roof);
        g.add(mk("box", M(shade(ch.pc, -120)), 10.7, 0.8, 10.7, 0, 8.15, 0));
        for (const sgn of [-1, 1]) {
            g.add(mk("cyl", M(ch.pc, shade(ch.pc, -150)), 2, 12, 2, sgn * 6.5, 6, sgn * 6.5));
            g.add(mk("cyl", M(shade(ch.pc, -60)), 2.6, 0.8, 2.6, sgn * 6.5, 12.35, sgn * 6.5));
            for (let mi = 0; mi < 4; mi++) {
                const ma = mi * Math.PI / 2 + Math.PI / 4;
                g.add(mk("box", M(shade(ch.pc, -40)), 0.95, 1.15, 0.95, sgn * 6.5 + Math.cos(ma) * 1.8, 13.3, sgn * 6.5 + Math.sin(ma) * 1.8));
            }
        }
        g.add(mk("cyl", M("#3a2c1a"), 0.22, 7, 0.22, 0, 16, 0));
        g.add(mk("plane", new T.MeshBasicMaterial({ color: GLOW[ch.id], side: T.DoubleSide }), 3.4, 1.9, 1, 1.8, 18.4, 0));
        return g;
    }
    function skinFor(ch) {
        return ch.id === "makuru" ? "#7da84a" : ch.id === "bones" ? "#ddd6c2" : "#e8b48f";
    }
    function addCrest(ch, head) {
        const id = ch.id;
        if (id === "vlad") {
            for (const sz of [-1, 1]) {
                const sp = mk("cone4", M("#141019"), 0.32, 1.25, 0.32, sz * 0.62, 1.35, 0);
                sp.rotation.z = -sz * 0.35;
                head.add(sp);
            }
        }
        else if (id === "maria") {
            const r = new T.Mesh(new T.TorusGeometry(0.95, 0.15, 4, 8), M("#e0b23a", 4729352));
            r.rotation.x = Math.PI / 2;
            r.position.y = 0.85;
            head.add(r);
        }
        else if (id === "protheus") {
            const pl = mk("cone", M("#a32828"), 0.38, 1.8, 0.38, 0, 1.55, -0.35);
            pl.rotation.x = 0.55;
            head.add(pl);
        }
        else if (id === "romeo") {
            const f = mk("cone4", M("#e8e2d8"), 0.24, 1.3, 0.24, 0.72, 1.15, 0);
            f.rotation.z = -0.6;
            head.add(f);
        }
        else if (id === "makuru") {
            head.add(mk("cone", M("#3a5a22"), 1.2, 1.8, 1.2, 0, 1.05, 0));
        }
        else if (id === "artheria") {
            const lf = mk("cone4", M("#3f7a2e"), 0.5, 1.4, 0.5, 0.2, 1.35, 0);
            lf.rotation.z = 0.8;
            head.add(lf);
        }
        else if (id === "muriel") {
            head.add(mk("oct", M("#8d4fd3", 2757696), 0.45, 0.65, 0.45, 0, 1.35, 0));
        }
        else if (id === "bones") {
            head.add(mk("sph", MB("#0a0a0a"), 0.27, 0.27, 0.27, 0.42, 0.12, -0.4));
            head.add(mk("sph", MB("#0a0a0a"), 0.27, 0.27, 0.27, 0.42, 0.12, 0.4));
        }
    }
    function makeArqueiro(ch) {
        const g = new T.Group(), pc = ch.pc, dk = shade(pc, -90);
        g.add(mk("box", M("#3a2c1a"), 0.95, 2.6, 0.95, -0.7, 1.3, 0));
        g.add(mk("box", M("#3a2c1a"), 0.95, 2.6, 0.95, 0.7, 1.3, 0));
        g.add(mk("box", M(dk), 2.6, 3.3, 1.7, 0, 4.25, 0));
        g.add(mk("box", M(pc), 2.7, 0.65, 1.8, 0, 3.05, 0));
        const armL = mk("box", M(dk), 0.8, 2.4, 0.8, -1.75, 4.7, 0.55);
        armL.rotation.x = -0.85;
        g.add(armL);
        g.add(mk("box", M(dk), 0.8, 2.4, 0.8, 1.75, 4.6, 0));
        const head = new T.Group();
        head.position.set(0, 6.75, 0);
        head.add(mk("sph", M(skinFor(ch)), 1.12, 1.12, 1.12, 0, 0, 0));
        head.add(mk("cone", M(shade(pc, -50)), 1.5, 2.1, 1.5, 0, 1, -0.12));
        addCrest(ch, head);
        g.add(head);
        const bow = new T.Group();
        bow.position.set(-1.9, 4.4, 1.7);
        const lu = mk("cyl", M("#5a4630"), 0.16, 2.7, 0.16, 0, 1.15, -0.45);
        lu.rotation.x = 0.42;
        const ld = mk("cyl", M("#5a4630"), 0.16, 2.7, 0.16, 0, -1.15, -0.45);
        ld.rotation.x = -0.42;
        bow.add(lu, ld);
        bow.add(mk("box", MB("#d8d2c2"), 0.07, 4.4, 0.07, 0, 0, -1));
        g.add(bow);
        const qv = mk("cyl", M(shade(pc, -120)), 0.62, 2.6, 0.62, 0.7, 4.6, -1.15);
        qv.rotation.x = 0.35;
        g.add(qv);
        g.add(mk("cone4", M("#c9d8e4"), 0.3, 0.9, 0.3, 0.55, 6.2, -1.55));
        g.add(mk("cone4", M("#c94b3a"), 0.3, 0.9, 0.3, 0.95, 6, -1.35));
        return g;
    }
    function makeCavaleiro(ch) {
        const g = new T.Group(), pc = ch.pc;
        const horse = makeHorse("#3a3438", "#191519", true);
        horse.scale.set(1.32, 1.32, 1.32);
        g.add(horse);
        g.add(mk("box", M(pc, shade(pc, -150)), 5.9, 1.15, 2.7, 0, 4.45, 0));
        const r = new T.Group();
        r.position.set(-0.4, 5.5, 0);
        for (const sz of [-1, 1])
            r.add(mk("box", M("#2a2430"), 0.75, 2.1, 0.75, 0.1, 0.15, sz * 1.25));
        r.add(mk("box", M("#8d8d9a"), 2.1, 2.7, 1.55, 0, 1.55, 0));
        r.add(mk("box", M(pc), 2.2, 1.5, 1.62, 0, 1.05, 0));
        r.add(mk("box", M("#8d8d9a"), 0.75, 1.9, 0.75, -1.35, 1.9, 0.35));
        const head = new T.Group();
        head.position.set(0, 3.75, 0);
        head.add(mk("sph", M("#9d9daa"), 1.05, 1.18, 1.05, 0, 0, 0));
        head.add(mk("box", MB("#101014"), 0.95, 0.3, 0.3, 0, 0.02, 0.92));
        addCrest(ch, head);
        r.add(head);
        const lance = new T.Group();
        lance.position.set(1.15, 1.7, 0.95);
        const shaft = mk("cyl", M("#6b4a2a"), 0.15, 9.5, 0.15, 0, 2.2, 0);
        lance.add(shaft);
        lance.add(mk("cone4", M("#c9d8e4"), 0.34, 1.1, 0.34, 0, 7.4, 0));
        lance.add(mk("plane", new T.MeshBasicMaterial({ color: GLOW[ch.id], side: T.DoubleSide }), 2, 1, 1, 1, 6.3, 0));
        lance.rotation.z = -0.62;
        r.add(lance);
        const sh = mk("cyl", M(pc, shade(pc, -150)), 1.35, 0.3, 1.35, 0.1, 1.6, -1.55);
        sh.rotation.x = Math.PI / 2;
        r.add(sh);
        r.add(mk("sph", M("#e0b23a"), 0.32, 0.32, 0.32, 0.1, 1.6, -1.75));
        g.add(r);
        return g;
    }
    function makeTrollBody() {
        const SK = "#6f7361", SKD = "#525747", RK = "#5b6052", RKD = "#3c4036", BEL = "#848869", MOSS = "#6f8a3c", TSK = "#ece6d0", EYE = "#ffd34a", DARK = "#1c1f18";
        const g = new T.Group();
        for (const s of [-1, 1]) {
            g.add(mk("box", M(SKD), 2.1, 0.65, 1.5, 0.35, 0.32, s * 1.15));
            for (const t of [-0.45, 0, 0.45])
                g.add(mk("cone", M(DARK), 0.24, 0.45, 0.24, 1.25, 0.35, s * 1.15 + t));
            g.add(mk("cyl", M(SKD), 1.05, 2.0, 1.05, 0, 1.5, s * 1.1));
            g.add(mk("ico", M(SKD), 1.15, 0.9, 1.15, 0.05, 2.55, s * 1.1));
            g.add(mk("cyl", M(SK), 1.3, 2.2, 1.3, 0, 3.5, s * 1.05));
        }
        g.add(mk("box", M("#4a3a26"), 2.5, 1.4, 3.3, 0, 4.6, 0));
        g.add(mk("sph", M(SK), 2.3, 1.5, 3.0, 0, 5.1, 0));
        g.add(mk("sph", M(BEL), 2.5, 1.9, 3.1, 0.25, 5.85, 0));
        g.add(mk("sph", M(SK), 2.8, 2.3, 4.0, -0.1, 6.95, 0));
        for (const c of [[-1.15, 7.2, -1.3, 0.85], [-1.05, 6.2, -1.6, 0.7], [-1.2, 7.6, 0.6, 0.65], [-1.1, 5.6, 1.2, 0.55]])
            g.add(mk("ico", M(RKD), c[3], c[3] * 1.1, c[3], c[0], c[1], c[2]));
        for (const s of [-1, 1]) {
            g.add(mk("ico", M(RK), 1.5, 1.35, 1.7, -0.1, 7.55, s * 1.95));
            g.add(mk("ico", M(RKD), 0.75, 0.7, 0.8, -0.5, 8.05, s * 1.8));
            g.add(mk("cyl", M(SK), 1.05, 2.7, 1.05, 0.05, 6.2, s * 2.3));
            g.add(mk("ico", M(SKD), 1.15, 0.95, 1.15, 0.05, 4.85, s * 2.4));
            g.add(mk("cyl", M(SKD), 1.2, 2.9, 1.2, 0.15, 3.45, s * 2.5));
            g.add(mk("ico", M(SKD), 1.35, 1.2, 1.35, 0.25, 1.9, s * 2.6));
        }
        g.add(mk("cyl", M(SKD), 1.0, 0.55, 1.0, 0.1, 8.25, 0));
        const head = new T.Group();
        head.position.set(0.3, 9.35, 0);
        head.rotation.z = -0.12;
        head.add(mk("box", M(SK), 2.4, 2.0, 2.7, 0, 0, 0));
        head.add(mk("box", M(SKD), 2.2, 0.6, 2.55, -0.1, 1.0, 0));
        head.add(mk("sph", M(MOSS), 1.3, 0.4, 1.5, -0.35, 1.25, 0));
        head.add(mk("box", M(SKD), 0.8, 0.75, 2.9, 1.3, 0.5, 0));
        for (const s of [-1, 1]) {
            head.add(mk("box", M(DARK), 0.55, 0.8, 0.85, 1.3, -0.1, s * 0.8));
            head.add(mk("sph", MB(EYE), 0.33, 0.33, 0.33, 1.62, -0.1, s * 0.8));
        }
        head.add(mk("box", M(SK), 0.85, 0.7, 0.95, 1.55, -0.7, 0));
        head.add(mk("box", M(DARK), 0.3, 0.28, 0.28, 1.85, -0.72, -0.3));
        head.add(mk("box", M(DARK), 0.3, 0.28, 0.28, 1.85, -0.72, 0.3));
        head.add(mk("box", M(SK), 1.5, 0.6, 2.25, 1.2, -1.15, 0));
        head.add(mk("box", M(SK), 1.75, 0.95, 2.4, 1.45, -1.75, 0));
        head.add(mk("box", M(DARK), 1.5, 0.22, 2.1, 1.5, -1.32, 0));
        head.add(mk("cone", M(TSK), 0.34, 1.7, 0.34, 1.9, -1.0, -0.9));
        head.add(mk("cone", M(TSK), 0.34, 1.7, 0.34, 1.9, -1.0, 0.9));
        for (const z of [-0.5, 0.05, 0.55])
            head.add(mk("cone", M("#ded8c2"), 0.2, 0.4, 0.2, 1.95, -1.15, z));
        for (const s of [-1, 1]) {
            const e = mk("cone", M(SKD), 0.5, 1.35, 0.5, -0.55, 0.35, s * 1.45);
            e.rotation.x = s * 1.25;
            head.add(e);
        }
        g.add(head);
        g.userData.head = head;
        const cl = new T.Group();
        cl.position.set(0.45, 2.2, 2.75);
        cl.rotation.x = 0.3;
        cl.add(mk("cyl", M("#57402a"), 0.55, 5.0, 0.55, 0, 2.2, 0));
        cl.add(mk("ico", M("#4b4e45"), 1.5, 1.6, 1.5, 0, 4.9, 0));
        for (let i2 = 0; i2 < 5; i2++) {
            const a = i2 * 1.256;
            const sp = mk("cone", M("#2f322a"), 0.32, 0.9, 0.32, Math.cos(a) * 1.1, 4.9, Math.sin(a) * 1.1);
            sp.rotation.z = -Math.cos(a) * 1.2;
            sp.rotation.x = Math.sin(a) * 1.2;
            cl.add(sp);
        }
        g.add(cl);
        g.add(mk("sph", M(MOSS), 1.0, 0.4, 1.2, -0.9, 7.75, -0.6));
        g.add(mk("sph", M(MOSS), 0.7, 0.32, 0.8, -0.8, 6.4, 1.4));
        return g;
    }
    function makeRaider() {
        const g = new T.Group();
        g.add(mk("cyl", M("#181008"), 11, 1.3, 11, 0, 0.65, 0));
        g.add(mk("cyl", M("#2a1c10"), 11.6, 0.45, 11.6, 0, 0.22, 0));
        const discMat = new T.MeshBasicMaterial({ color: 9310752, transparent: true, opacity: 0.85 });
        g.add(mk("cyl", discMat, 10.2, 0.45, 10.2, 0, 1.45, 0));
        const base = new T.Group();
        base.position.y = 1.6;
        const m = makeTrollBody();
        m.scale.set(1.22, 1.22, 1.22);
        base.add(m);
        g.add(base);
        g.userData.discMat = discMat;
        return g;
    }
    function makeGiantTroll() {
        const g = new T.Group();
        const body = makeTrollBody();
        body.scale.set(3.25, 3.25, 3.25);
        g.add(body);
        const rock = mk("sph", M("#6e6a64"), 8.6, 7.4, 8.0, 2, 37, 9);
        g.add(rock);
        g.add(mk("sph", M("#847f76"), 4.4, 3.8, 4.0, 0, 39.5, 7.5));
        g.add(mk("sph", M("#55514c"), 3.6, 3.0, 3.2, 4.5, 35, 11.5));
        return g;
    }
    function makeSwamp() {
        const g = new T.Group();
        const MUD = "#2b3324", MUD2 = "#222a1c", ROCK = "#4d5245", ROCKD = "#343930", WOOD = "#3a2f22", MOSS = "#6f8a3c";
        g.add(mk("cyl", M(MUD), 46, 0.6, 46, 0, 0.2, 0));
        const lakeMat = new T.MeshBasicMaterial({ color: 4491337, transparent: true, opacity: 0.92 });
        g.add(mk("cyl", lakeMat, 25, 0.4, 22, -4, 0.62, 5));
        g.add(mk("cyl", new T.MeshBasicMaterial({ color: 6202451, transparent: true, opacity: 0.55 }), 18, 0.42, 15, -4, 0.72, 5));
        for (let i2 = 0; i2 < 7; i2++) {
            const a = Math.random() * 6.283, r = 4 + Math.random() * 9;
            g.add(mk("cyl", new T.MeshBasicMaterial({ color: 8375365, transparent: true, opacity: 0.5 }), 2 + Math.random() * 3, 0.3, 2 + Math.random() * 3, -4 + Math.cos(a) * r, 0.8, 5 + Math.sin(a) * r));
        }
        const mtn = new T.Group();
        mtn.position.set(20, 0, -18);
        mtn.add(mk("cone", M(ROCK), 17, 26, 15, 0, 12.5, 0));
        mtn.add(mk("cone", M(ROCKD), 10, 15, 9, -9, 7, 6));
        mtn.add(mk("cone", M(ROCKD), 7, 10, 7, 8, 5, 7));
        mtn.add(mk("ico", M("#5b6052"), 4, 3.4, 4, 1.5, 24, -0.5));
        mtn.add(mk("sph", M(MOSS), 5, 1.2, 4.5, -3, 9, 5));
        const cave = mk("sph", M("#141812"), 5.5, 4.5, 3, 0, 4.2, 7.5);
        mtn.add(cave);
        g.add(mtn);
        for (const c of [[-26, 6, 5], [24, 16, 4], [-14, -22, 3.4], [8, 24, 3], [-30, -12, 2.6]])
            g.add(mk("ico", M(ROCKD), c[2], c[2] * 0.8, c[2], c[0], c[2] * 0.4, c[1]));
        for (let i2 = 0; i2 < 6; i2++) {
            const a = i2 * 1.05 + 0.5, r = 22 + Math.random() * 12;
            const x = Math.cos(a) * r, z = Math.sin(a) * r;
            const tr = mk("cyl", M(WOOD), 1.3, 12 + Math.random() * 7, 1.3, x, 6, z);
            tr.rotation.z = (Math.random() - 0.5) * 0.6;
            tr.rotation.x = (Math.random() - 0.5) * 0.4;
            g.add(tr);
            for (let b = 0; b < 3; b++) {
                const br = mk("box", M(WOOD), 5 + Math.random() * 3, 0.7, 0.7, x + (Math.random() - 0.5) * 4, 8 + b * 2.5, z + (Math.random() - 0.5) * 3);
                br.rotation.y = Math.random() * 3;
                br.rotation.z = (Math.random() - 0.5) * 0.9;
                g.add(br);
            }
        }
        for (let i2 = 0; i2 < 26; i2++) {
            const a = Math.random() * 6.283, r = 12 + Math.random() * 22;
            g.add(mk("cyl", M("#5c7038"), 0.22, 3 + Math.random() * 3, 0.22, Math.cos(a) * r, 1.8, Math.sin(a) * r));
        }
        for (let i2 = 0; i2 < 9; i2++) {
            const a = Math.random() * 6.283, r = Math.random() * 14;
            g.add(mk("cyl", M("#4e7a34"), 2.2 + Math.random() * 1.6, 0.18, 2.2 + Math.random() * 1.6, -4 + Math.cos(a) * r, 0.85, 5 + Math.sin(a) * r));
        }
        for (let i2 = 0; i2 < 10; i2++) {
            const a = Math.random() * 6.283, r = 14 + Math.random() * 18;
            g.add(mk("sph", M(MOSS), 1.8, 1.0, 1.8, Math.cos(a) * r, 0.9, Math.sin(a) * r));
        }
        for (const b of [[-20, 18], [16, -6], [-8, 26]]) {
            g.add(mk("cyl", M("#cfc9b4"), 0.4, 3.2, 0.4, b[0], 0.9, b[1], 1.1));
            g.add(mk("sph", M("#dcd6c0"), 1.2, 1.1, 1.2, b[0] + 2, 0.9, b[1] + 1.2));
        }
        return g;
    }
    function makeSleepingTroll() {
        const g = new T.Group();
        const SK = "#5d6252", SKD = "#464b3d", MOSS = "#6f8a3c", RKD = "#3a3d33";
        g.add(mk("sph", M(SK), 26, 11, 20, 0, 3, 0));
        for (const c of [[-7, 9, -6, 4.5], [4, 10.5, -5, 3.8], [9, 8.5, 2, 3.2], [-3, 10, 3, 3]])
            g.add(mk("ico", M(RKD), c[3], c[3] * 0.7, c[3], c[0], c[1], c[2]));
        for (const c of [[-10, 9.5, 3, 5], [2, 11, 4, 4], [10, 7.5, -4, 3.5]])
            g.add(mk("sph", M(MOSS), c[3], 1.3, c[3] * 0.85, c[0], c[1], c[2]));
        const head = new T.Group();
        head.position.set(-17, 5.5, 4);
        head.rotation.z = -0.35;
        head.rotation.y = 0.5;
        head.add(mk("box", M(SK), 10, 6.2, 9.2, 0, 0, 0));
        head.add(mk("box", M(SKD), 10.4, 1.8, 9.4, 0.3, 2.4, 0));
        head.add(mk("box", M("#2a2d24"), 2.4, 0.5, 1.2, 3.6, 0.9, -2.6));
        head.add(mk("box", M("#2a2d24"), 2.4, 0.5, 1.2, 3.6, 0.9, 2.6));
        head.add(mk("box", M(SK), 8, 3.4, 8.6, 2.6, -3.1, 0));
        head.add(mk("cone", M("#e9e3cd"), 1.1, 4.6, 1.1, 4.6, -1.2, -2.9));
        head.add(mk("cone", M("#e9e3cd"), 1.1, 4.6, 1.1, 4.6, -1.2, 2.9));
        head.add(mk("sph", M(MOSS), 3.2, 1.2, 2.8, -1.8, 3.4, 0.6));
        g.add(head);
        const arm = mk("cyl", M(SKD), 4.6, 14, 4.6, 15, 3.5, 9);
        arm.rotation.z = 1.35;
        arm.rotation.y = -0.5;
        g.add(arm);
        g.add(mk("ico", M(SKD), 4, 3.4, 4, 22, 2.2, 12));
        return g;
    }
    function makeUnit(ch, t, bone) {
        const g = new T.Group();
        g.add(mk("cyl", M("#181008"), 11, 1.3, 11, 0, 0.65, 0));
        g.add(mk("cyl", M("#2a1c10"), 11.6, 0.45, 11.6, 0, 0.22, 0));
        const discMat = new T.MeshBasicMaterial({ color: bone ? 15391952 : GLOW[ch.id], transparent: true, opacity: 0.8 });
        g.add(mk("cyl", discMat, 10.2, 0.45, 10.2, 0, 1.45, 0));
        const base = new T.Group();
        base.position.y = 1.6;
        const m = t === "cavaleiro" ? makeCavaleiro(ch) : t === "catapulta" ? makeCatapulta(ch) : makeArqueiro(ch);
        m.scale.set(1.85, 1.85, 1.85);
        if (bone)
            m.traverse((o) => {
                if (o.isMesh && o.material && o.material.color) {
                    o.material = o.material.clone();
                    o.material.color.lerp(new T.Color("#f4f0e4"), 0.9);
                }
            });
        base.add(m);
        if (bone) {
            const BW = "#f6f2e6", BD = "#dcd6c2", BK = "#14141c";
            const skull = (sx, sy, sz, sc, ry) => {
                const s = new T.Group();
                s.position.set(sx, sy, sz);
                s.scale.set(sc, sc, sc);
                if (ry)
                    s.rotation.y = ry;
                s.add(mk("sph", M(BW), 1.5, 1.55, 1.4, 0, 0, 0));
                s.add(mk("box", M(BW), 1.25, 0.85, 1.05, 0, -1.2, 0.15));
                s.add(mk("sph", MB(BK), 0.5, 0.55, 0.32, -0.55, 0.2, 1.02));
                s.add(mk("sph", MB(BK), 0.5, 0.55, 0.32, 0.55, 0.2, 1.02));
                s.add(mk("box", MB(BK), 0.26, 0.44, 0.3, 0, -0.4, 1.12));
                for (const tx of [-0.6, -0.2, 0.2, 0.6])
                    s.add(mk("box", M(BW), 0.2, 0.4, 0.22, tx, -1.15, 1.02));
                return s;
            };
            const bones = new T.Group();
            bones.add(skull(0, 8.4, 0.8, 1.7, 0));
            bones.add(mk("cyl", M(BD), 0.55, 6.4, 0.55, 0, 5, -0.5));
            for (let r = 0; r < 3; r++) {
                const yy = 6.6 - r * 1.5, ww = 4.4 - r * 0.6;
                const rl = mk("box", M(BW), ww, 0.5, 0.6, -ww * 0.42, yy, 1.2);
                rl.rotation.z = 0.42;
                bones.add(rl);
                const rr = mk("box", M(BW), ww, 0.5, 0.6, ww * 0.42, yy, 1.2);
                rr.rotation.z = -0.42;
                bones.add(rr);
            }
            bones.add(mk("box", M(BW), 5.6, 0.6, 0.7, 0, 7.1, 0));
            const al = mk("cyl", M(BD), 0.5, 5, 0.5, -3.2, 4.8, 0.2);
            al.rotation.z = 0.16;
            bones.add(al);
            const ar = mk("cyl", M(BD), 0.5, 5, 0.5, 3.2, 4.8, 0.2);
            ar.rotation.z = -0.16;
            bones.add(ar);
            bones.add(skull(-6.8, 2, 4.4, 1.45, 0.5));
            bones.add(skull(6.4, 1.9, 3.9, 1.3, -0.6));
            bones.add(skull(-0.8, 1.8, -6.6, 1.2, 3.1));
            const cb1 = mk("cyl", M(BW), 0.5, 7.5, 0.5, -5.6, 1.5, -4.2);
            cb1.rotation.set(0, 0.5, 1.3);
            bones.add(cb1);
            const cb2 = mk("cyl", M(BW), 0.5, 7.5, 0.5, 5.4, 1.5, -4.6);
            cb2.rotation.set(0, -0.5, 1.3);
            bones.add(cb2);
            g.add(bones);
        }
        g.add(base);
        g.userData.discMat = discMat;
        return g;
    }
    function makeCatapulta(ch) {
        const g = new T.Group(), wood = "#5a4630", woodD = "#3a2c1a";
        g.add(mk("box", M(wood), 8, 1, 1.1, 0, 1.7, 1.95));
        g.add(mk("box", M(wood), 8, 1, 1.1, 0, 1.7, -1.95));
        g.add(mk("box", M(woodD), 1.1, 1, 4.8, 3.1, 1.7, 0));
        g.add(mk("box", M(woodD), 1.1, 1, 4.8, -3.1, 1.7, 0));
        for (const sx of [-1, 1])
            for (const sz of [-1, 1]) {
                const wh = mk("cyl", M("#241a0e"), 1.35, 0.8, 1.35, sx * 3, 1.35, sz * 2.55);
                wh.rotation.x = Math.PI / 2;
                g.add(wh);
            }
        const drum = mk("cyl", M(woodD), 0.65, 4.6, 0.65, 0.9, 2.4, 0);
        drum.rotation.x = Math.PI / 2;
        g.add(drum);
        for (const sz of [-1, 1]) {
            const brace = mk("box", M(wood), 0.7, 3.6, 0.7, -1.2, 3.1, sz * 1.95);
            brace.rotation.z = 0.5;
            g.add(brace);
        }
        g.add(mk("box", M(woodD), 0.9, 0.8, 4.4, -2.1, 4.4, 0));
        const arm = new T.Group();
        arm.position.set(0.9, 2.4, 0);
        arm.add(mk("box", M(wood), 0.72, 7.2, 0.72, 0, 3.1, 0));
        arm.add(mk("box", M(woodD), 1.8, 1, 1.8, 0, 6.7, 0));
        arm.add(mk("ico", M("#6f6555"), 0.95, 0.95, 0.95, 0, 7.55, 0));
        arm.rotation.z = 0.9;
        g.add(arm);
        g.add(mk("cyl", M("#3a2c1a"), 0.16, 3.6, 0.16, -3.4, 3.4, 0));
        g.add(mk("plane", new T.MeshBasicMaterial({ color: GLOW[ch.id], side: T.DoubleSide }), 1.9, 1.1, 1, -2.45, 4.6, 0));
        return g;
    }
    function syncPieces(g2) {
        g2.board.hexes.forEach((h) => {
            if (!h.hid && fogG[h.k]) {
                scene.remove(fogG[h.k]);
                delete fogG[h.k];
                if (fogTok[h.k]) {
                    scene.add(fogTok[h.k]);
                    delete fogTok[h.k];
                }
                if (fogDec[h.k]) {
                    fogDec[h.k].forEach((d) => scene.add(d));
                    delete fogDec[h.k];
                }
            }
        });
        g2.board.ports.forEach((pt, i) => { if (portMesh[i])
            portMesh[i].visible = !pt.hid; });
        for (const k in dynW)
            if (!g2.wagons || !g2.wagons[k]) {
                roadGroup.remove(dynW[k].mesh);
                delete dynW[k];
            }
        let wi = 0;
        for (const k in g2.wagons || {}) {
            const w = g2.wagons[k], ch = charOf(g2.players[w.p].ch);
            if (!dynW[k]) {
                const m = makeWagon(ch);
                roadGroup.add(m);
                dynW[k] = { mesh: m, at: null, cargo: -1 };
                popIn(m, 1);
            }
            const d = dynW[k], c = centers[w.at], a = wi++ * 2.1;
            d.mesh.position.set(c.x + Math.cos(a) * 11, TOP, c.z + Math.sin(a) * 11);
            d.mesh.rotation.y = -a;
            if (d.cargo !== w.cargo) {
                const cg = d.mesh.children.find((x) => x.name === "cargo");
                if (cg)
                    cg.visible = !!w.cargo;
                d.cargo = w.cargo;
            }
        }
        for (const k in dynB) {
            const w = g2.builds[k];
            const oc = (g2.occ || {})[k] != null ? g2.occ[k] : null;
            if (!w || w.t !== dynB[k].t || w.p !== dynB[k].p || oc !== dynB[k].occ) {
                if (dynB[k].smoke) {
                    const si = smokes.indexOf(dynB[k].smoke);
                    if (si >= 0)
                        smokes.splice(si, 1);
                }
                buildGroup.remove(dynB[k].mesh);
                delete dynB[k];
            }
        }
        for (const k in g2.builds) {
            if (dynB[k])
                continue;
            const b = g2.builds[k], ch = charOf(g2.players[b.p].ch), v = gr.verts[k];
            const mesh = b.t === 1 ? makeVillage(ch) : makePalace(ch);
            mesh.position.set(v.x, TOP, v.y);
            mesh.rotation.y = hseed(k) % 628 / 100;
            const oc = (g2.occ || {})[k] != null ? g2.occ[k] : null;
            if (oc != null) {
                const och = charOf(g2.players[oc].ch);
                mesh.add(mk("cyl", new T.MeshBasicMaterial({ color: 16734763, transparent: true, opacity: 0.5 }), b.t === 2 ? 12 : 9, 0.5, b.t === 2 ? 12 : 9, 0, 0.6, 0));
                const fp = mk("cyl", M("#3a2c1a"), 0.24, 9, 0.24, b.t === 2 ? 8.5 : 5.5, 8, 0);
                mesh.add(fp);
                mesh.add(mk("plane", new T.MeshBasicMaterial({ color: GLOW[och.id], side: T.DoubleSide }), 4.2, 2.4, 1, (b.t === 2 ? 8.5 : 5.5) + 2.2, 11.4, 0));
            }
            let smoke = null;
            if (oc != null) {
                const puffs = [];
                for (let pi2 = 0; pi2 < 3; pi2++) {
                    const pf = new T.Mesh(G.sph, new T.MeshBasicMaterial({ color: 4535612, transparent: true, opacity: 0.4, depthWrite: false }));
                    pf.scale.set(1.4, 1.4, 1.4);
                    mesh.add(pf);
                    puffs.push(pf);
                }
                smoke = { puffs, baseY: b.t === 2 ? 12 : 10.5, baseX: -1.5, seed: hseed(k) % 7 };
                puffs.forEach((pf) => pf.position.set(smoke.baseX, smoke.baseY, 0.5));
                smokes.push(smoke);
            }
            buildGroup.add(mesh);
            popIn(mesh, b.t === 1 ? 1.5 : 1.42);
            dynB[k] = { t: b.t, p: b.p, occ: oc, smoke, mesh };
        }
        const catThreat = (k, u) => u.t === "catapulta" && gr.hexMap[k] && gr.hexMap[k].corners.some((v) => {
            const b = g2.builds[v];
            return b && b.p !== u.p && ((g2.occ || {})[v] == null);
        });
        for (const k in dynU) {
            const u = (g2.units || {})[k];
            if (!u || u.p !== dynU[k].p || u.t !== dynU[k].t || (u.bone || 0) !== (dynU[k].bone || 0) || (isTroll(u) ? 0 : catThreat(k, u)) !== dynU[k].thr) {
                const bi = blinks.indexOf(dynU[k].mesh.userData.discMat);
                if (bi >= 0) {
                    dynU[k].mesh.userData.discMat.opacity = 0.72;
                    blinks.splice(bi, 1);
                }
                buildGroup.remove(dynU[k].mesh);
                delete dynU[k];
            }
        }
        for (const k in g2.units || {}) {
            if (dynU[k])
                continue;
            const u = g2.units[k], c = centers[k];
            if (!c)
                continue;
            if (isTroll(u)) {
                const rm = makeRaider();
                rm.position.set(c.x, TOP, c.z);
                rm.rotation.y = hseed(k) % 628 / 100;
                buildGroup.add(rm);
                popIn(rm, 1);
                dynU[k] = { p: u.p, t: u.t, bone: 0, thr: 0, mesh: rm };
                continue;
            }
            const ch = charOf(g2.players[u.p].ch);
            const thr = catThreat(k, u);
            const mesh = makeUnit(ch, u.t, u.bone);
            if (thr) {
                const spike = mk("cone4", new T.MeshBasicMaterial({ color: 16734763 }), 1.9, 3.4, 1.9, 0, 18.5, 0);
                spike.rotation.x = Math.PI;
                mesh.add(spike);
                blinks.push(mesh.userData.discMat);
            }
            mesh.position.set(c.x, TOP, c.z);
            mesh.rotation.y = hseed(k) % 628 / 100;
            buildGroup.add(mesh);
            popIn(mesh, 1);
            dynU[k] = { p: u.p, t: u.t, bone: u.bone || 0, thr, mesh };
        }
        const TT = g2.troll;
        const gA = TT && TT.giant && !TT.defeated ? TT.giant.at : null;
        if (buildGroup.userData.giantAt !== gA) {
            if (buildGroup.userData.giant)
                buildGroup.remove(buildGroup.userData.giant);
            buildGroup.userData.giant = null;
            buildGroup.userData.giantAt = gA;
            if (gA && centers[gA]) {
                const gm = makeGiantTroll();
                gm.position.set(centers[gA].x, TOP, centers[gA].z);
                gm.rotation.y = hseed(gA) % 628 / 100;
                buildGroup.add(gm);
                popIn(gm, 1);
                buildGroup.userData.giant = gm;
            }
        }
        const lairK = TT && TT.lair ? TT.lair : null;
        if (lairK && !buildGroup.userData.lairMesh && centers[lairK]) {
            const sw = makeSwamp();
            sw.position.set(centers[lairK].x, TOP - 1, centers[lairK].z);
            buildGroup.add(sw);
            buildGroup.userData.lairMesh = sw;
        }
        const sleeping = !!(TT && TT.lair && !TT.awake);
        if (buildGroup.userData.sleepOn !== sleeping) {
            if (buildGroup.userData.sleepMesh)
                buildGroup.remove(buildGroup.userData.sleepMesh);
            buildGroup.userData.sleepMesh = null;
            buildGroup.userData.sleepOn = sleeping;
            if (sleeping && centers[lairK]) {
                const sl = makeSleepingTroll();
                sl.position.set(centers[lairK].x, TOP - 1, centers[lairK].z);
                sl.rotation.y = hseed(lairK) % 628 / 100;
                buildGroup.add(sl);
                buildGroup.userData.sleepMesh = sl;
            }
        }
        if (!GUERRA(g2.mode))
            g2.players.forEach((p, pi) => {
                const myB = Object.keys(g2.builds).filter((k) => g2.builds[k].p === pi).sort();
                const sig = p.ch + "|" + p.troops.cavaleiro + "," + p.troops.catapulta + "," + p.troops.arqueiro + "|" + myB.join(";");
                const cur = dynT[pi];
                if (cur && cur.sig === sig)
                    return;
                if (cur)
                    cur.meshes.forEach((m) => buildGroup.remove(m));
                const meshes = [];
                if (myB.length) {
                    const ch = charOf(p.ch);
                    const list = [];
                    for (let u = 0; u < Math.min(3, p.troops.cavaleiro); u++)
                        list.push("c");
                    for (let u = 0; u < Math.min(3, p.troops.catapulta); u++)
                        list.push("k");
                    for (let u = 0; u < Math.min(3, p.troops.arqueiro); u++)
                        list.push("a");
                    list.forEach((tt, u) => {
                        const k = myB[u % myB.length], v = gr.verts[k];
                        const a = hseed(k + tt) % 628 / 100 + u * 2.1;
                        const m2 = tt === "c" ? makeCavaleiro(ch) : tt === "k" ? makeCatapulta(ch) : makeArqueiro(ch);
                        m2.position.set(v.x + Math.cos(a) * 12.5, TOP, v.y + Math.sin(a) * 12.5);
                        m2.rotation.y = -a;
                        buildGroup.add(m2);
                        popIn(m2, 1);
                        meshes.push(m2);
                    });
                }
                dynT[pi] = { sig, meshes };
            });
        for (const k in dynR) {
            if (g2.roads[k] == null) {
                roadGroup.remove(dynR[k].mesh);
                delete dynR[k];
            }
        }
        for (const k in g2.roads) {
            if (dynR[k])
                continue;
            const pi = g2.roads[k], ch = charOf(g2.players[pi].ch), e = gr.edges[k];
            const a = gr.verts[e.a], b2 = gr.verts[e.b];
            const grp = new T.Group();
            const rl = Math.hypot(b2.x - a.x, b2.y - a.y) * 0.8;
            grp.add(mk("box", M("#05050a"), rl, 1.6, 3.6, 0, 0.6, 0));
            grp.add(mk("box", M(ch.pc, shade(ch.pc, -150)), rl, 1.5, 2.4, 0, 1.5, 0));
            grp.add(mk("box", MB(ch.pc), rl, 0.55, 1.7, 0, 2.3, 0));
            grp.position.set((a.x + b2.x) / 2, TOP, (a.y + b2.y) / 2);
            grp.rotation.y = Math.atan2(-(b2.y - a.y), b2.x - a.x);
            roadGroup.add(grp);
            popIn(grp, 1.3);
            dynR[k] = { mesh: grp };
        }
    }
    function spawnHarvest(g2, n) {
        g2.board.hexes.forEach((h) => {
            if (h.num !== n || h.k === g2.board.dragon)
                return;
            const res = TERR[h.terr].res;
            if (!res)
                return;
            gr.hexMap[h.k].corners.forEach((v) => {
                const b = g2.builds[v];
                if (!b)
                    return;
                const vt = gr.verts[v];
                const sp = makeSprite((ctx) => {
                    ctx.font = "148px serif";
                    ctx.textAlign = "center";
                    ctx.fillText(RES[res].i, 128, 148);
                    ctx.font = "bold 76px Georgia";
                    ctx.fillStyle = "#ffd76b";
                    ctx.strokeStyle = "#241a0e";
                    ctx.lineWidth = 9;
                    ctx.strokeText("+" + b.t, 128, 234);
                    ctx.fillText("+" + b.t, 128, 234);
                }, 13, 13);
                sp.position.set(vt.x, TOP + 10, vt.y);
                scene.add(sp);
                let life = 0;
                world.fx.push((dt) => {
                    life += dt;
                    sp.position.y += dt * 8;
                    sp.material.opacity = Math.max(0, 1 - Math.max(0, life - 1.2) / 1.2);
                    if (life > 2.5) {
                        scene.remove(sp);
                        sp.material.map.dispose();
                        sp.material.dispose();
                        return true;
                    }
                    return false;
                });
            });
        });
    }
    const spotMat = new T.MeshBasicMaterial({ color: 14725690, transparent: true, opacity: 0.85 });
    function syncSpots(sv, se, sh) {
        while (spotGroup.children.length)
            spotGroup.remove(spotGroup.children[0]);
        sv.forEach((k) => {
            const v = gr.verts[k];
            const m = new T.Mesh(G.sph, spotMat);
            m.scale.set(4.2, 4.2, 4.2);
            m.position.set(v.x, TOP + 3, v.y);
            m.userData = { kind: "vert", id: k };
            spotGroup.add(m);
        });
        se.forEach((k) => {
            const e = gr.edges[k], a = gr.verts[e.a], b = gr.verts[e.b];
            const m = new T.Mesh(G.box, spotMat);
            m.scale.set(Math.hypot(b.x - a.x, b.y - a.y) * 0.6, 2.4, 4.2);
            m.position.set((a.x + b.x) / 2, TOP + 1.6, (a.y + b.y) / 2);
            m.rotation.y = Math.atan2(-(b.y - a.y), b.x - a.x);
            m.userData = { kind: "edge", id: k };
            spotGroup.add(m);
        });
        sh.forEach((k) => {
            const c = centers[k];
            const m = new T.Mesh(G.tor, spotMat);
            m.scale.set(SIZE * 0.6, SIZE * 0.6, SIZE * 0.6);
            m.rotation.x = -Math.PI / 2;
            m.position.set(c.x, TOP + 1.4, c.z);
            m.userData = { kind: "hex", id: k };
            spotGroup.add(m);
        });
    }
    world.anims.push((t) => {
        spotMat.opacity = 0.55 + Math.sin(t * 5) * 0.3;
    });
    const FAR = board.hexes.length > 20;
    const initialCameraState = options.initialCameraState;
    let theta = Number.isFinite(initialCameraState?.theta) ? initialCameraState.theta : 0;
    let phi = Number.isFinite(initialCameraState?.phi) ? initialCameraState.phi : 0.95;
    let dist = Number.isFinite(initialCameraState?.dist) ? initialCameraState.dist : (FAR ? 740 : 340);
    const target = new T.Vector3(0, 2, 36);
    if (Array.isArray(initialCameraState?.target) && initialCameraState.target.length === 3) target.fromArray(initialCameraState.target);
    function applyCam() {
        camera.position.set(target.x + dist * Math.sin(phi) * Math.sin(theta), target.y + dist * Math.cos(phi), target.z + dist * Math.sin(phi) * Math.cos(theta));
        camera.lookAt(target);
    }
    applyCam();
    const ptrs =  new Map();
    let moved = 0, downT = 0, pinch0 = 0, lastNdc = { x: 0, y: 0 };
    const el = renderer.domElement;
    el.style.touchAction = "none";
    el.addEventListener("pointerdown", (ev) => {
        el.setPointerCapture(ev.pointerId);
        ptrs.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
        if (ptrs.size === 1) {
            moved = 0;
            downT = Date.now();
        }
        if (ptrs.size === 2) {
            const a = [...ptrs.values()];
            pinch0 = Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y);
        }
    });
    el.addEventListener("pointermove", (ev) => {
        if (!ptrs.has(ev.pointerId))
            return;
        const p = ptrs.get(ev.pointerId), dx = ev.clientX - p.x, dy = ev.clientY - p.y;
        p.x = ev.clientX;
        p.y = ev.clientY;
        moved += Math.abs(dx) + Math.abs(dy);
        if (ptrs.size === 1) {
            theta -= dx * 6e-3;
            phi = Math.max(0.3, Math.min(1.35, phi - dy * 5e-3));
            applyCam();
        }
        else if (ptrs.size === 2) {
            const a = [...ptrs.values()];
            const d = Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y);
            if (pinch0 > 0) {
                dist = Math.max(150, Math.min(FAR ? 1500 : 680, dist * pinch0 / d));
                applyCam();
            }
            pinch0 = d;
        }
    });
    const ray = new T.Raycaster();
    el.addEventListener("pointerup", (ev) => {
        ptrs.delete(ev.pointerId);
        if (moved < 9 && Date.now() - downT < 500 && ptrs.size === 0) {
            const r = el.getBoundingClientRect();
            lastNdc.x = (ev.clientX - r.left) / r.width * 2 - 1;
            lastNdc.y = -((ev.clientY - r.top) / r.height) * 2 + 1;
            ray.setFromCamera(lastNdc, camera);
            const hits = ray.intersectObjects(spotGroup.children, false);
            if (hits.length) {
                const u = hits[0].object.userData, H = world.handlers;
                if (u.kind === "vert" && H.onVert)
                    H.onVert(u.id);
                else if (u.kind === "edge" && H.onEdge)
                    H.onEdge(u.id);
                else if (u.kind === "hex" && H.onHex)
                    H.onHex(u.id);
            }
        }
    });
    el.addEventListener("pointercancel", (ev) => ptrs.delete(ev.pointerId));
    el.addEventListener("wheel", (ev) => {
        ev.preventDefault();
        dist = Math.max(150, Math.min(FAR ? 1500 : 680, dist * (1 + ev.deltaY * 12e-4)));
        applyCam();
    }, { passive: false });
    const renderLoop = createVisibilityAwareFrameLoop({
        // O tabuleiro mantém a cadência visual atual de 60 fps. O ganho aqui é
        // de lifecycle: quando a página fica escondida deixa de existir RAF,
        // atualização de animações ou render GPU.
        getTargetFps: () => graphics.board.fps,
        onFrame: ({ now, delta: dt }) => {
            if (world.disposed)
                return;
            const t = now / 1e3;
            for (const a of world.anims)
                a(t, dt);
            world.fx = world.fx.filter((f) => !f(dt));
            renderer.render(scene, camera);
        },
    });
    return {
        update(g2, sv, se, sh) {
            world.dragonHex = g2.board.dragon;
            world.geloAwake = !!(g2.gelo && g2.gelo.awake);
            syncPieces(g2);
            syncSpots(sv, se, sh);
            const storyEvent = g2.presentation?.story;
            if (storyEvent && storyEvent.kind === "dados" && storyEvent.n && storyEvent.id !== world.lastEv && Date.now() - storyEvent.id < 15e3) {
                world.lastEv = storyEvent.id;
                spawnHarvest(g2, storyEvent.n);
            }
        },
        set handlers(h) {
            world.handlers = h;
        },
        getCameraState() {
            return Object.freeze({ theta, phi, dist, target: target.toArray() });
        },
        getPerformanceSnapshot() {
            return rendererPerformanceSnapshot(renderer, {
                ...renderLoop.getStats(),
                graphicsQuality: graphics.id,
                targetFps: graphics.board.fps,
                ambientDetail: graphics.board.ambientDetail,
                waterNormalEvery: graphics.board.waterNormalEvery,
            });
        },
        dispose() {
            world.disposed = true;
            renderLoop.dispose();
            resizeObserver.disconnect();
            disposeObjectTree(scene);
            renderer.dispose();
            if (el.parentNode)
                el.parentNode.removeChild(el);
        }
    };
}
