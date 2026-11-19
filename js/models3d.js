/**
 * Tiana 3D — 高精細暗黑奇幻雕塑建模庫 (Paladin / Werewolf / Black Dragon / Shelob / Croc / Slime)
 * 全程序化高解析 PBR 貼圖 (Albedo / Normal / Emissive / Alpha) + 多關節骨架動畫
 */
import * as THREE from 'three';

const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (t) => t * t * (3 - 2 * t);
const lerpAngle = (a, b, t) => {
    const d = ((b - a + Math.PI) % TAU + TAU) % TAU - Math.PI;
    return a + d * t;
};

function makeRng(seed) {
    return function () {
        seed |= 0; seed = seed + 0x6D2B79F5 | 0;
        let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
        t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
}

function makeCanvas(w, h = w) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    return [c, c.getContext('2d')];
}

function heightToNormalCanvas(src, strength = 2.4) {
    const w = src.width, h = src.height;
    const sd = src.getContext('2d').getImageData(0, 0, w, h).data;
    const [nc, ng] = makeCanvas(w, h);
    const out = ng.createImageData(w, h);
    const H = (x, y) => sd[(((y + h) % h) * w + ((x + w) % w)) * 4] / 255;
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const dx = (H(x + 1, y) - H(x - 1, y)) * strength;
            const dy = (H(x, y + 1) - H(x, y - 1)) * strength;
            let nx = -dx, ny = dy, nz = 1;
            const l = Math.hypot(nx, ny, nz);
            const i = (y * w + x) * 4;
            out.data[i] = (nx / l * 0.5 + 0.5) * 255;
            out.data[i + 1] = (ny / l * 0.5 + 0.5) * 255;
            out.data[i + 2] = (nz / l * 0.5 + 0.5) * 255;
            out.data[i + 3] = 255;
        }
    }
    ng.putImageData(out, 0, 0);
    return nc;
}

function canvasToTex(canvas, srgb = true, repeat = 1) {
    const t = new THREE.CanvasTexture(canvas);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    if (repeat !== 1) t.repeat.set(repeat, repeat);
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    return t;
}

function addM(parent, geo, mat, x = 0, y = 0, z = 0, cast = true) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = cast;
    m.receiveShadow = true;
    parent.add(m);
    return m;
}

function setShadows(obj, cast = true) {
    obj.traverse((c) => {
        if (c.isMesh) {
            c.castShadow = cast;
            c.receiveShadow = true;
        }
    });
}

/* =====================================================================
 * 1. 角色與怪物專屬 PBR 貼圖產生器
 * ===================================================================== */
function createModelTextures() {
    const T = {};

    // (A) 雕花戰損騎士鋼甲貼圖 (Albedo + Normal)
    {
        const S = 256, rnd = makeRng(101);
        const [dc, dg] = makeCanvas(S), [hc, hg] = makeCanvas(S);
        const grad = dg.createLinearGradient(0, 0, S, S);
        grad.addColorStop(0, '#c8d2de'); grad.addColorStop(0.5, '#96a4b8'); grad.addColorStop(1, '#bcc6d4');
        dg.fillStyle = grad; dg.fillRect(0, 0, S, S);
        hg.fillStyle = '#808080'; hg.fillRect(0, 0, S, S);

        // 裝甲分片接縫與鉚釘
        dg.strokeStyle = 'rgba(20,25,35,0.55)'; dg.lineWidth = 3;
        hg.strokeStyle = '#202020'; hg.lineWidth = 4;
        for (const y of [64, 128, 192]) {
            dg.beginPath(); dg.moveTo(0, y); dg.lineTo(S, y); dg.stroke();
            hg.beginPath(); hg.moveTo(0, y); hg.lineTo(S, y); hg.stroke();
            for (let x = 16; x < S; x += 32) {
                dg.fillStyle = '#e2e8f0'; dg.beginPath(); dg.arc(x, y - 9, 2.5, 0, TAU); dg.fill();
                hg.fillStyle = '#ffffff'; hg.beginPath(); hg.arc(x, y - 9, 3, 0, TAU); hg.fill();
            }
        }
        // 戰損刮痕
        for (let i = 0; i < 180; i++) {
            const x = rnd() * S, y = rnd() * S, len = 6 + rnd() * 24, a = rnd() * TAU;
            dg.strokeStyle = rnd() < 0.5 ? 'rgba(255,255,255,0.18)' : 'rgba(15,20,28,0.22)';
            dg.lineWidth = 0.8 + rnd() * 0.9;
            dg.beginPath(); dg.moveTo(x, y); dg.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len); dg.stroke();
            hg.strokeStyle = '#555'; hg.lineWidth = 1;
            hg.beginPath(); hg.moveTo(x, y); hg.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len); hg.stroke();
        }
        T.armorMap = canvasToTex(dc, true, 1);
        T.armorNormal = canvasToTex(heightToNormalCanvas(hc, 2.6), false, 1);
    }

    // (B) 戰損破口皇家披風貼圖 (Albedo + Alpha)
    {
        const W = 256, H = 256, rnd = makeRng(202);
        const [dc, dg] = makeCanvas(W, H), [ac, ag] = makeCanvas(W, H);
        const cg = dg.createLinearGradient(0, 0, 0, H);
        cg.addColorStop(0, '#c8c8c8'); cg.addColorStop(0.75, '#969696'); cg.addColorStop(1, '#585858');
        dg.fillStyle = cg; dg.fillRect(0, 0, W, H);
        // 織布紋理
        for (let i = 0; i < 2200; i++) {
            dg.fillStyle = rnd() < 0.5 ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.09)';
            dg.fillRect(rnd() * W, rnd() * H, 2 + rnd() * 4, 1);
        }
        // 兩側金色滾邊
        dg.fillStyle = '#e5b84b';
        dg.fillRect(4, 0, 8, H); dg.fillRect(W - 12, 0, 8, H);

        // Alpha 遮罩 (底部鋸齒破口)
        ag.fillStyle = '#ffffff'; ag.fillRect(0, 0, W, H);
        ag.fillStyle = '#000000';
        ag.beginPath();
        ag.moveTo(0, H);
        for (let x = 0; x <= W; x += 8) {
            const tear = 14 + Math.sin(x * 0.09) * 14 + rnd() * 24;
            ag.lineTo(x, H - tear);
        }
        ag.lineTo(W, H); ag.closePath(); ag.fill();

        T.capeMap = canvasToTex(dc, true);
        T.capeMap.wrapS = T.capeMap.wrapT = THREE.ClampToEdgeWrapping;
        T.capeAlpha = canvasToTex(ac, false);
        T.capeAlpha.wrapS = T.capeAlpha.wrapT = THREE.ClampToEdgeWrapping;
    }

    // (C) 皇家鳶形盾紋章貼圖
    {
        const S = 256;
        const [dc, dg] = makeCanvas(S), [hc, hg] = makeCanvas(S);
        dg.fillStyle = '#182b4d'; dg.fillRect(0, 0, S, S);
        hg.fillStyle = '#404040'; hg.fillRect(0, 0, S, S);
        // 鋼鐵外框與金飾十字
        dg.strokeStyle = '#d4a644'; dg.lineWidth = 14; dg.strokeRect(10, 10, S - 20, S - 20);
        hg.strokeStyle = '#e0e0e0'; hg.lineWidth = 14; hg.strokeRect(10, 10, S - 20, S - 20);
        dg.fillStyle = '#e2b850';
        dg.fillRect(S / 2 - 12, 24, 24, S - 48);
        dg.fillRect(36, S * 0.36 - 10, S - 72, 20);
        hg.fillStyle = '#ffffff';
        hg.fillRect(S / 2 - 12, 24, 24, S - 48);
        hg.fillRect(36, S * 0.36 - 10, S - 72, 20);
        // 中央盾徽菱形寶石
        dg.fillStyle = '#38bdf8';
        dg.beginPath(); dg.moveTo(S / 2, S * 0.24); dg.lineTo(S / 2 + 24, S * 0.36); dg.lineTo(S / 2, S * 0.48); dg.lineTo(S / 2 - 24, S * 0.36); dg.closePath(); dg.fill();
        T.shieldMap = canvasToTex(dc, true);
        T.shieldNormal = canvasToTex(heightToNormalCanvas(hc, 2.5), false);
    }

    // (D) 狼人粗糙深棕毛皮貼圖 (Albedo + Normal)
    {
        const S = 256, rnd = makeRng(303);
        const [dc, dg] = makeCanvas(S), [hc, hg] = makeCanvas(S);
        dg.fillStyle = '#2d231c'; dg.fillRect(0, 0, S, S);
        hg.fillStyle = '#303030'; hg.fillRect(0, 0, S, S);
        const cols = ['#4a392c', '#362920', '#5e4c3d', '#241b15', '#6e5e50'];
        for (let i = 0; i < 6500; i++) {
            const x = rnd() * S, y = rnd() * S, len = 6 + rnd() * 14;
            const ang = Math.PI / 2 + (rnd() - 0.5) * 0.55;
            dg.strokeStyle = cols[Math.floor(rnd() * cols.length)];
            dg.lineWidth = 1 + rnd() * 1.4;
            dg.beginPath(); dg.moveTo(x, y); dg.lineTo(x + Math.cos(ang) * len, y + Math.sin(ang) * len); dg.stroke();
            const l = 80 + Math.floor(rnd() * 150);
            hg.strokeStyle = `rgb(${l},${l},${l})`; hg.lineWidth = 1.2;
            hg.beginPath(); hg.moveTo(x, y); hg.lineTo(x + Math.cos(ang) * len, y + Math.sin(ang) * len); hg.stroke();
        }
        T.furMap = canvasToTex(dc, true, 2);
        T.furNormal = canvasToTex(heightToNormalCanvas(hc, 2.8), false, 2);
    }

    // (E) 黑曜石龍鱗 + 紫色生物發光脈絡 (Albedo + Normal + Emissive)
    {
        const S = 256, rnd = makeRng(404);
        const [dc, dg] = makeCanvas(S), [hc, hg] = makeCanvas(S), [ec, eg] = makeCanvas(S);
        dg.fillStyle = '#120e18'; dg.fillRect(0, 0, S, S);
        hg.fillStyle = '#101010'; hg.fillRect(0, 0, S, S);
        eg.fillStyle = '#000000'; eg.fillRect(0, 0, S, S);

        // 底層紫色發光裂隙
        for (let i = 0; i < 16; i++) {
            eg.strokeStyle = 'rgba(168, 85, 247, 0.75)';
            eg.lineWidth = 2 + rnd() * 3;
            eg.beginPath();
            let px = rnd() * S, py = rnd() * S;
            eg.moveTo(px, py);
            for (let k = 0; k < 5; k++) { px += (rnd() - 0.5) * 70; py += (rnd() - 0.5) * 70; eg.lineTo(px, py); }
            eg.stroke();
        }
        // 疊加黑曜石菱形龍鱗
        const step = 20;
        for (let r = -1; r <= S / (step * 0.65) + 1; r++) {
            for (let c = -1; c <= S / step + 1; c++) {
                const cx = c * step + (r % 2) * (step / 2);
                const cy = r * step * 0.65;
                const shade = 18 + Math.floor(rnd() * 18);
                dg.fillStyle = `rgb(${shade + 4},${shade},${shade + 12})`;
                dg.strokeStyle = '#09070d'; dg.lineWidth = 1.5;
                dg.beginPath();
                dg.moveTo(cx, cy - step * 0.58);
                dg.lineTo(cx + step * 0.5, cy);
                dg.lineTo(cx, cy + step * 0.58);
                dg.lineTo(cx - step * 0.5, cy);
                dg.closePath(); dg.fill(); dg.stroke();

                const gr = hg.createRadialGradient(cx, cy, 1, cx, cy, step * 0.55);
                gr.addColorStop(0, '#ffffff'); gr.addColorStop(1, '#252525');
                hg.fillStyle = gr; hg.beginPath();
                hg.moveTo(cx, cy - step * 0.52); hg.lineTo(cx + step * 0.45, cy);
                hg.lineTo(cx, cy + step * 0.52); hg.lineTo(cx - step * 0.45, cy);
                hg.closePath(); hg.fill();
            }
        }
        T.dragonMap = canvasToTex(dc, true, 2);
        T.dragonNormal = canvasToTex(heightToNormalCanvas(hc, 3.2), false, 2);
        T.dragonEmissive = canvasToTex(eg, true, 2);
    }

    // (F) 符文魔劍刀身貼圖 (鋼鐵劍刃 + 中央發光符文槽)
    {
        const W = 128, H = 512;
        const [dc, dg] = makeCanvas(W, H), [ec, eg] = makeCanvas(W, H);
        const bg = dg.createLinearGradient(0, 0, W, 0);
        bg.addColorStop(0, '#eef6ff'); bg.addColorStop(0.22, '#7c8ea3');
        bg.addColorStop(0.5, '#2b3648'); bg.addColorStop(0.78, '#7c8ea3'); bg.addColorStop(1, '#eef6ff');
        dg.fillStyle = bg; dg.fillRect(0, 0, W, H);
        // 劍刃微刮痕與鍛造紋
        dg.strokeStyle = 'rgba(255,255,255,0.22)'; dg.lineWidth = 1.5;
        for (let y = 16; y < H; y += 22) {
            dg.beginPath(); dg.moveTo(10, y); dg.lineTo(W - 10, y + 6); dg.stroke();
        }
        // 中央發光符文脈絡 (Emissive)
        eg.fillStyle = '#000000'; eg.fillRect(0, 0, W, H);
        const rg = eg.createLinearGradient(W * 0.34, 0, W * 0.66, 0);
        rg.addColorStop(0, '#000000'); rg.addColorStop(0.35, '#88d8ff');
        rg.addColorStop(0.5, '#ffffff'); rg.addColorStop(0.65, '#88d8ff'); rg.addColorStop(1, '#000000');
        eg.fillStyle = rg; eg.fillRect(W * 0.34, 24, W * 0.32, H - 56);
        // 橫向符文刻印與劍鋒微光
        eg.strokeStyle = '#ffffff'; eg.lineWidth = 3;
        for (let y = 52; y < H - 70; y += 36) {
            eg.beginPath(); eg.moveTo(W * 0.36, y); eg.lineTo(W * 0.5, y - 12); eg.lineTo(W * 0.64, y); eg.stroke();
            eg.beginPath(); eg.moveTo(W * 0.4, y + 10); eg.lineTo(W * 0.6, y + 10); eg.stroke();
        }
        // 劍刃雙緣微光
        eg.fillStyle = 'rgba(180,235,255,0.55)';
        eg.fillRect(0, 0, 8, H); eg.fillRect(W - 8, 0, 8, H);

        T.bladeMap = canvasToTex(dc, true);
        T.bladeMap.wrapS = T.bladeMap.wrapT = THREE.ClampToEdgeWrapping;
        T.bladeEmissive = canvasToTex(ec, true);
        T.bladeEmissive.wrapS = T.bladeEmissive.wrapT = THREE.ClampToEdgeWrapping;
    }

    return T;
}

/* =====================================================================
 * 2. 共用材質庫初始化
 * ===================================================================== */
export function createModelFactory(sharedTEX) {
    const T = createModelTextures();

    const M = {
        gold: new THREE.MeshStandardMaterial({ color: 0xe6b94c, metalness: 0.92, roughness: 0.22 }),
        darkSteel: new THREE.MeshStandardMaterial({ color: 0x262b34, metalness: 0.85, roughness: 0.36 }),
        leather: new THREE.MeshStandardMaterial({ color: 0x3b2416, roughness: 0.84, metalness: 0.08 }),
        skin: new THREE.MeshStandardMaterial({ color: 0xdca988, roughness: 0.62 }),
        hair: new THREE.MeshStandardMaterial({ color: 0x3a2a1e, roughness: 0.78 }),
        bone: new THREE.MeshStandardMaterial({ color: 0xded6c5, roughness: 0.45 }),
        wolfFur: new THREE.MeshStandardMaterial({ map: T.furMap, normalMap: T.furNormal, normalScale: new THREE.Vector2(1.4, 1.4), color: 0x9b8672, roughness: 0.92 }),
        wolfDark: new THREE.MeshStandardMaterial({ map: T.furMap, normalMap: T.furNormal, color: 0x52453b, roughness: 0.95 }),
        wolfSnout: new THREE.MeshStandardMaterial({ color: 0x2a201c, roughness: 0.38, metalness: 0.1 }),
        chainIron: new THREE.MeshStandardMaterial({ color: 0x4b5563, metalness: 0.85, roughness: 0.45 }),
        redGlow: new THREE.MeshBasicMaterial({ color: new THREE.Color(3.6, 0.3, 0.18), toneMapped: false }),
        purpleGlow: new THREE.MeshBasicMaterial({ color: new THREE.Color(2.5, 0.45, 4.2), toneMapped: false }),
        greenGlow: new THREE.MeshBasicMaterial({ color: new THREE.Color(0.5, 3.0, 0.9), toneMapped: false }),
        dragonBody: new THREE.MeshStandardMaterial({
            map: T.dragonMap, normalMap: T.dragonNormal, normalScale: new THREE.Vector2(1.8, 1.8),
            emissiveMap: T.dragonEmissive, emissive: new THREE.Color(0xa855f7), emissiveIntensity: 1.4,
            metalness: 0.52, roughness: 0.42
        }),
        dragonHorn: new THREE.MeshStandardMaterial({ color: 0x1e1b24, metalness: 0.65, roughness: 0.32 }),
        dragonWing: new THREE.MeshStandardMaterial({
            color: 0x1b1224, emissiveMap: T.dragonEmissive, emissive: new THREE.Color(0x7e22ce), emissiveIntensity: 0.95,
            roughness: 0.68, side: THREE.DoubleSide
        }),
        spiderShell: new THREE.MeshStandardMaterial({ color: 0x161820, metalness: 0.45, roughness: 0.25 }),
        crocScale: new THREE.MeshStandardMaterial({
            map: sharedTEX.scales.map, normalMap: sharedTEX.scales.normalMap, normalScale: new THREE.Vector2(1.5, 1.5),
            color: 0x2c4b2a, roughness: 0.6, metalness: 0.12
        }),
        crocBelly: new THREE.MeshStandardMaterial({ color: 0x767a50, roughness: 0.72 }),
        slimeOuter: new THREE.MeshPhysicalMaterial({
            color: 0x22c55e, emissive: 0x0b4a24, emissiveIntensity: 0.45,
            roughness: 0.1, metalness: 0.05, transmission: 0.62, transparent: true, opacity: 0.84
        })
    };

    /* =====================================================================
     * 3. 主角：亞丁皇家聖騎士 (Sculpted Paladin Knight)
     * ===================================================================== */
    function createKnightRig() {
        const root = new THREE.Group();
        const body = new THREE.Group();
        root.add(body);

        const armorMat = new THREE.MeshStandardMaterial({
            color: 0xcbd5e1, map: T.armorMap, normalMap: T.armorNormal, normalScale: new THREE.Vector2(1.35, 1.35),
            metalness: 0.88, roughness: 0.26
        });
        const capeMat = new THREE.MeshStandardMaterial({
            color: 0x991b1b, map: T.capeMap, alphaMap: T.capeAlpha, alphaTest: 0.35,
            roughness: 0.82, side: THREE.DoubleSide
        });
        const tabardMat = new THREE.MeshStandardMaterial({
            color: 0x1d3b8b, map: sharedTEX.cloth, roughness: 0.75, side: THREE.DoubleSide
        });
        const shieldMat = new THREE.MeshStandardMaterial({
            map: T.shieldMap, normalMap: T.shieldNormal, metalness: 0.78, roughness: 0.3
        });
        const bladeMat = new THREE.MeshStandardMaterial({
            map: T.bladeMap, emissiveMap: T.bladeEmissive,
            color: 0xdbeafe, emissive: 0x38bdf8, emissiveIntensity: 3.0,
            metalness: 0.94, roughness: 0.12, toneMapped: false
        });
        const bladeCoreMat = new THREE.MeshBasicMaterial({
            color: new THREE.Color(0.9, 2.5, 4.0), transparent: true, opacity: 0.85,
            blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false
        });

        // 雕塑骨盆與層疊裙甲 (Faulds) + 深藍戰裙 (Tabard)
        const pelvis = new THREE.Group();
        pelvis.position.y = 0.84;
        body.add(pelvis);
        addM(pelvis, new THREE.CylinderGeometry(0.21, 0.23, 0.2, 12), armorMat, 0, 0, 0);
        addM(pelvis, new THREE.CylinderGeometry(0.225, 0.225, 0.055, 12), M.gold, 0, 0.06, 0);
        // 左右裙甲片
        for (const s of [-1, 1]) {
            const tasset = addM(pelvis, new THREE.BoxGeometry(0.14, 0.26, 0.22), armorMat, s * 0.2, -0.14, 0);
            tasset.rotation.z = s * 0.16;
            addM(tasset, new THREE.BoxGeometry(0.15, 0.03, 0.23), M.gold, 0, -0.12, 0);
        }
        // 前後皇家深藍戰裙
        const frontTabard = addM(pelvis, new THREE.PlaneGeometry(0.22, 0.54, 2, 4), tabardMat, 0, -0.28, 0.16);
        frontTabard.rotation.x = -0.06;
        addM(pelvis, new THREE.PlaneGeometry(0.24, 0.5, 2, 4), tabardMat, 0, -0.27, -0.16);

        // 雕塑裝甲腿部 (大腿甲 + 金邊護膝 + 小腿護脛 + 尖頭鋼鐵戰靴)
        const makeLeg = (s) => {
            const hip = new THREE.Group();
            hip.position.set(s * 0.135, 0.78, 0);
            body.add(hip);
            // 大腿
            addM(hip, new THREE.CylinderGeometry(0.095, 0.078, 0.34, 12), armorMat, 0, -0.18, 0);
            // 護膝 (Poleyn)
            const knee = addM(hip, new THREE.SphereGeometry(0.088, 12, 10), armorMat, 0, -0.36, 0.035);
            knee.scale.set(0.95, 1.15, 1.0);
            addM(hip, new THREE.TorusGeometry(0.078, 0.014, 6, 12), M.gold, 0, -0.36, 0.03).rotation.x = Math.PI / 2;
            // 小腿護脛 (Greave)
            const shinPts = [new THREE.Vector2(0.06, 0), new THREE.Vector2(0.082, 0.14), new THREE.Vector2(0.086, 0.28), new THREE.Vector2(0.074, 0.36)];
            addM(hip, new THREE.LatheGeometry(shinPts, 12), armorMat, 0, -0.73, 0);
            // 鋼鐵戰靴 (Sabaton)
            addM(hip, new THREE.BoxGeometry(0.12, 0.09, 0.24), M.darkSteel, 0, -0.74, 0.055);
            addM(hip, new THREE.ConeGeometry(0.065, 0.12, 6), armorMat, 0, -0.75, 0.2).rotation.x = Math.PI / 2;
            return hip;
        };
        const legL = makeLeg(-1), legR = makeLeg(1);

        // 雕塑胸甲 (Cuirass) — 倒梯形英雄比例
        const torso = new THREE.Group();
        torso.position.y = 0.94;
        body.add(torso);
        const chestPts = [
            new THREE.Vector2(0.18, 0.0), new THREE.Vector2(0.21, 0.14),
            new THREE.Vector2(0.27, 0.32), new THREE.Vector2(0.29, 0.48), new THREE.Vector2(0.22, 0.58)
        ];
        const chestGeo = new THREE.LatheGeometry(chestPts, 14);
        const chest = addM(torso, chestGeo, armorMat, 0, 0, 0);
        chest.scale.set(1.08, 1.0, 0.82);

        // 防具 +10/+20/+30/+40/+50/+60 緊貼盔甲輪廓的發光外殼 (完全符合防具形狀！)
        const armorAuraMat = new THREE.MeshBasicMaterial({
            color: 0xffffff, transparent: true, opacity: 0,
            blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false, toneMapped: false
        });
        const chestAura = new THREE.Mesh(chestGeo, armorAuraMat);
        chestAura.scale.set(1.13, 1.03, 0.87);
        chestAura.visible = false;
        torso.add(chestAura);
        const armorAuraMeshes = [chestAura];

        // 胸前金飾浮雕與皇家紋章
        addM(torso, new THREE.TorusGeometry(0.21, 0.022, 8, 16), M.gold, 0, 0.56, 0).rotation.x = Math.PI / 2;
        const crest = addM(torso, new THREE.OctahedronGeometry(0.095, 1), M.gold, 0, 0.36, 0.22);
        crest.scale.set(0.9, 1.25, 0.4);
        // 胸甲斜向金邊
        for (const s of [-1, 1]) {
            const trim = addM(torso, new THREE.BoxGeometry(0.032, 0.38, 0.04), M.gold, s * 0.14, 0.32, 0.21);
            trim.rotation.z = -s * 0.22;
        }

        // 多層獅紋重型肩甲 (Ornate Layered Pauldrons) + 貼合肩甲發光外殼
        const pauldronGeo = new THREE.SphereGeometry(0.19, 14, 10, 0, TAU, 0, Math.PI * 0.62);
        for (const s of [-1, 1]) {
            const p = new THREE.Group();
            p.position.set(s * 0.34, 0.5, 0);
            torso.add(p);
            const mainDome = addM(p, pauldronGeo, armorMat, 0, 0.02, 0);
            mainDome.rotation.z = -s * 0.42;
            const pAura = new THREE.Mesh(pauldronGeo, armorAuraMat);
            pAura.position.set(0, 0.02, 0);
            pAura.rotation.z = -s * 0.42;
            pAura.scale.setScalar(1.07);
            pAura.visible = false;
            p.add(pAura);
            armorAuraMeshes.push(pAura);
            const rim = addM(p, new THREE.TorusGeometry(0.175, 0.024, 8, 16), M.gold, s * 0.02, -0.02, 0);
            rim.rotation.x = Math.PI / 2; rim.rotation.y = s * 0.42;
            // 第二層護肩片
            const lame = addM(p, new THREE.SphereGeometry(0.155, 12, 8, 0, TAU, 0, Math.PI * 0.55), armorMat, s * 0.06, -0.09, 0);
            lame.rotation.z = -s * 0.55;
            // 金色獅頭浮雕徽章
            addM(p, new THREE.DodecahedronGeometry(0.065, 0), M.gold, s * 0.13, 0.02, 0.05);
        }

        // 高分段戰損動態披風 (10x12 網格 + 底部破口)
        const capeGeo = new THREE.PlaneGeometry(0.76, 1.18, 8, 10);
        capeGeo.translate(0, -0.59, 0);
        const capeMesh = new THREE.Mesh(capeGeo, capeMat);
        capeMesh.position.set(0, 0.54, -0.21);
        capeMesh.rotation.x = 0.18;
        torso.add(capeMesh);
        const capeBasePos = new Float32Array(capeGeo.attributes.position.array);

        // 騎士頭部 (英俊短髮臉龐 + 可見金屬護頸 + 皇家額環)
        const head = new THREE.Group();
        head.position.set(0, 0.64, 0.02);
        torso.add(head);
        addM(head, new THREE.CylinderGeometry(0.085, 0.105, 0.12, 10), M.darkSteel, 0, -0.02, 0);
        addM(head, new THREE.SphereGeometry(0.13, 16, 14), M.skin, 0, 0.1, 0).scale.set(0.92, 1.06, 0.96);
        // 精緻短髮層次
        addM(head, new THREE.SphereGeometry(0.138, 14, 12, 0, TAU, 0, Math.PI * 0.58), M.hair, 0, 0.125, -0.015);
        addM(head, new THREE.BoxGeometry(0.18, 0.05, 0.06), M.hair, 0, 0.19, 0.09).rotation.x = 0.25;
        // 眉骨與雙眼
        for (const s of [-1, 1]) {
            addM(head, new THREE.SphereGeometry(0.016, 6, 6), M.darkSteel, s * 0.044, 0.11, 0.115, false);
        }
        // 金屬騎士額飾冠環
        addM(head, new THREE.TorusGeometry(0.132, 0.014, 6, 16), M.gold, 0, 0.17, 0).rotation.x = Math.PI / 2;

        // 右手 + 附魔符文聖劍 (Rune Broadsword)
        const armR = new THREE.Group();
        armR.position.set(0.35, 0.45, 0);
        torso.add(armR);
        addM(armR, new THREE.CylinderGeometry(0.075, 0.065, 0.3, 10), armorMat, 0, -0.16, 0);
        addM(armR, new THREE.SphereGeometry(0.07, 10, 8), M.gold, 0, -0.32, 0);
        const foreR = new THREE.Group();
        foreR.position.set(0, -0.32, 0);
        foreR.rotation.x = -0.45;
        armR.add(foreR);
        addM(foreR, new THREE.CylinderGeometry(0.068, 0.056, 0.28, 10), armorMat, 0, -0.14, 0);
        addM(foreR, new THREE.SphereGeometry(0.055, 8, 8), M.darkSteel, 0, -0.29, 0);

        // 多武器外型系統：單手劍 (1h_sword)、雙手巨劍 (2h_sword)、東方武士刀 (katana)、雙刃短刀 (dagger)
        const swordGroup = new THREE.Group();
        swordGroup.position.set(0, -0.3, 0.04);
        swordGroup.rotation.x = Math.PI * 0.42;
        foreR.add(swordGroup);

        const bladeAuraMat = new THREE.MeshBasicMaterial({
            color: new THREE.Color(0.55, 2.0, 3.6), transparent: true, opacity: 0.32,
            blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false, toneMapped: false
        });

        function normBladeUV(geo, maxX, maxY) {
            const uv = geo.attributes.uv, pos = geo.attributes.position;
            for (let i = 0; i < pos.count; i++) {
                uv.setXY(i, clamp((pos.getX(i) + maxX) / (maxX * 2), 0, 1), clamp(pos.getY(i) / maxY, 0, 1));
            }
        }
        function addBladeWithAura(parent, geo, sx = 1.22, sy = 1.025, sz = 2.1) {
            addM(parent, geo, bladeMat, 0, 0, 0, false);
            const aura = new THREE.Mesh(geo, bladeAuraMat);
            aura.scale.set(sx, sy, sz);
            parent.add(aura);
        }

        // (A) 單手長劍 (1h_sword)
        const w1h = new THREE.Group();
        addM(w1h, new THREE.CylinderGeometry(0.024, 0.027, 0.28, 10), M.leather, 0, -0.12, 0);
        addM(w1h, new THREE.OctahedronGeometry(0.052, 0), M.gold, 0, -0.27, 0);
        const g1Shape = new THREE.Shape();
        g1Shape.moveTo(-0.24, -0.03); g1Shape.quadraticCurveTo(0, 0.08, 0.24, -0.03);
        g1Shape.lineTo(0.2, 0.04); g1Shape.quadraticCurveTo(0, 0.12, -0.2, 0.04); g1Shape.closePath();
        const g1Geo = new THREE.ExtrudeGeometry(g1Shape, { depth: 0.045, bevelEnabled: true, bevelThickness: 0.01, bevelSize: 0.01 });
        g1Geo.center(); addM(w1h, g1Geo, M.gold, 0, 0.04, 0);
        const b1Shape = new THREE.Shape();
        b1Shape.moveTo(-0.06, 0.02); b1Shape.lineTo(0.06, 0.02); b1Shape.lineTo(0.044, 0.96); b1Shape.lineTo(0, 1.24); b1Shape.lineTo(-0.044, 0.96); b1Shape.closePath();
        const b1Geo = new THREE.ExtrudeGeometry(b1Shape, { depth: 0.016, bevelEnabled: true, bevelThickness: 0.014, bevelSize: 0.012, bevelSegments: 2 });
        b1Geo.translate(0, 0.05, -0.008); normBladeUV(b1Geo, 0.07, 1.3);
        addBladeWithAura(w1h, b1Geo);
        swordGroup.add(w1h);

        // (B) 雙手巨劍 (2h_sword) — 更長更寬的霸氣雙手大劍，拿雙手劍時自動隱藏盾牌！
        const w2h = new THREE.Group();
        addM(w2h, new THREE.CylinderGeometry(0.028, 0.032, 0.48, 10), M.leather, 0, -0.22, 0);
        for (let r = 0; r < 5; r++) addM(w2h, new THREE.TorusGeometry(0.031, 0.006, 6, 10), M.gold, 0, -0.04 - r * 0.08, 0).rotation.x = Math.PI / 2;
        addM(w2h, new THREE.OctahedronGeometry(0.068, 0), M.gold, 0, -0.47, 0);
        const g2Shape = new THREE.Shape();
        g2Shape.moveTo(-0.36, -0.05); g2Shape.quadraticCurveTo(0, 0.12, 0.36, -0.05);
        g2Shape.lineTo(0.32, 0.07); g2Shape.quadraticCurveTo(0, 0.18, -0.32, 0.07); g2Shape.closePath();
        const g2Geo = new THREE.ExtrudeGeometry(g2Shape, { depth: 0.06, bevelEnabled: true, bevelThickness: 0.014, bevelSize: 0.014 });
        g2Geo.center(); addM(w2h, g2Geo, M.gold, 0, 0.06, 0);
        addM(w2h, new THREE.OctahedronGeometry(0.068, 0), bladeCoreMat, 0, 0.06, 0, false);
        const b2Shape = new THREE.Shape();
        b2Shape.moveTo(-0.095, 0.02); b2Shape.lineTo(0.095, 0.02); b2Shape.lineTo(0.125, 0.22);
        b2Shape.lineTo(0.082, 0.34); b2Shape.lineTo(0.072, 1.48); b2Shape.lineTo(0, 1.84);
        b2Shape.lineTo(-0.072, 1.48); b2Shape.lineTo(-0.082, 0.34); b2Shape.lineTo(-0.125, 0.22); b2Shape.closePath();
        const b2Geo = new THREE.ExtrudeGeometry(b2Shape, { depth: 0.022, bevelEnabled: true, bevelThickness: 0.018, bevelSize: 0.014, bevelSegments: 2 });
        b2Geo.translate(0, 0.06, -0.011); normBladeUV(b2Geo, 0.13, 1.9);
        addBladeWithAura(w2h, b2Geo, 1.18, 1.02, 2.0);
        w2h.visible = false;
        swordGroup.add(w2h);

        // (C) 東方武士刀 / 日本劍 (katana) — 修長微彎單刃 + 圓形刀鐔
        const wKat = new THREE.Group();
        addM(wKat, new THREE.CylinderGeometry(0.022, 0.024, 0.38, 10), M.leather, 0, -0.17, 0);
        addM(wKat, new THREE.CylinderGeometry(0.095, 0.095, 0.022, 16), M.gold, 0, 0.03, 0);
        const kShape = new THREE.Shape();
        kShape.moveTo(-0.022, 0); kShape.lineTo(0.028, 0);
        kShape.quadraticCurveTo(0.065, 0.72, 0.11, 1.38);
        kShape.lineTo(0.055, 1.54);
        kShape.quadraticCurveTo(0.015, 0.76, -0.022, 0); kShape.closePath();
        const kGeo = new THREE.ExtrudeGeometry(kShape, { depth: 0.012, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.006 });
        kGeo.translate(0, 0.04, -0.006); normBladeUV(kGeo, 0.12, 1.58);
        addBladeWithAura(wKat, kGeo, 1.25, 1.02, 2.2);
        wKat.visible = false;
        swordGroup.add(wKat);

        // (D) 刺客短刀 / 匕首 (dagger) — 精悍微彎短刃
        const wDag = new THREE.Group();
        addM(wDag, new THREE.CylinderGeometry(0.02, 0.022, 0.2, 8), M.leather, 0, -0.08, 0);
        addM(wDag, new THREE.BoxGeometry(0.14, 0.03, 0.04), M.gold, 0, 0.03, 0);
        const dShape = new THREE.Shape();
        dShape.moveTo(-0.038, 0); dShape.lineTo(0.038, 0);
        dShape.quadraticCurveTo(0.06, 0.28, 0.015, 0.62);
        dShape.quadraticCurveTo(-0.045, 0.3, -0.038, 0); dShape.closePath();
        const dGeo = new THREE.ExtrudeGeometry(dShape, { depth: 0.012, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.006 });
        dGeo.translate(0, 0.04, -0.006); normBladeUV(dGeo, 0.06, 0.66);
        addBladeWithAura(wDag, dGeo, 1.25, 1.04, 2.2);
        wDag.visible = false;
        swordGroup.add(wDag);

        const weaponModels = { '1h_sword': w1h, '2h_sword': w2h, 'katana': wKat, 'dagger': wDag };

        // 緊貼劍刃邊緣的細小符文火星 (4 顆精簡高效)
        const bladeSparks = [];
        for (let i = 0; i < 4; i++) {
            const sp = new THREE.Sprite(new THREE.SpriteMaterial({
                map: sharedTEX.glow, color: new THREE.Color(0.8, 2.4, 4.0),
                blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.78, toneMapped: false
            }));
            sp.scale.set(0.075, 0.075, 1);
            swordGroup.add(sp);
            bladeSparks.push({ sp, phase: i * (TAU / 4), yBase: 0.25 + i * 0.24 });
        }

        // 雙層 3D 揮刀月牙劍氣弧 (內核白熱 + 外緣附魔色光刃)
        const slashGroup = new THREE.Group();
        slashGroup.position.set(0, 1.12, 0.28);
        root.add(slashGroup);
        const slashMat = new THREE.MeshBasicMaterial({
            color: new THREE.Color(0.6, 2.4, 4.2), transparent: true, opacity: 0,
            blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false, toneMapped: false
        });
        const slashInnerMat = new THREE.MeshBasicMaterial({
            color: new THREE.Color(2.6, 3.2, 4.0), transparent: true, opacity: 0,
            blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false, toneMapped: false
        });
        const slashArc = new THREE.Mesh(new THREE.RingGeometry(0.72, 1.88, 28, 1, -Math.PI * 0.52, Math.PI * 1.04), slashMat);
        slashArc.rotation.x = -Math.PI / 2;
        const slashInner = new THREE.Mesh(new THREE.RingGeometry(1.18, 1.65, 28, 1, -Math.PI * 0.45, Math.PI * 0.9), slashInnerMat);
        slashInner.rotation.x = -Math.PI / 2; slashInner.position.y = 0.02;
        slashGroup.add(slashArc, slashInner);

        // 左手 + 精雕皇家鳶形盾 (Kite Shield)
        const armL = new THREE.Group();
        armL.position.set(-0.35, 0.45, 0);
        torso.add(armL);
        addM(armL, new THREE.CylinderGeometry(0.075, 0.065, 0.3, 10), armorMat, 0, -0.16, 0);
        addM(armL, new THREE.SphereGeometry(0.07, 10, 8), M.gold, 0, -0.32, 0);
        const foreL = new THREE.Group();
        foreL.position.set(0, -0.32, 0);
        foreL.rotation.x = -0.75;
        armL.add(foreL);
        addM(foreL, new THREE.CylinderGeometry(0.068, 0.056, 0.28, 10), armorMat, 0, -0.14, 0);

        const shieldShape = new THREE.Shape();
        shieldShape.moveTo(0, 0.4); shieldShape.lineTo(0.28, 0.31);
        shieldShape.quadraticCurveTo(0.26, -0.06, 0, -0.46);
        shieldShape.quadraticCurveTo(-0.26, -0.06, -0.28, 0.31);
        shieldShape.closePath();
        const shieldGeo = new THREE.ExtrudeGeometry(shieldShape, { depth: 0.045, bevelEnabled: true, bevelThickness: 0.018, bevelSize: 0.018, bevelSegments: 2 });
        const shield = new THREE.Mesh(shieldGeo, shieldMat);
        shield.position.set(-0.12, -0.18, 0.14);
        shield.rotation.y = -0.6;
        foreL.add(shield);
        addM(shield, new THREE.OctahedronGeometry(0.085, 0), M.gold, 0, 0.05, 0.065);

        // 左手副手短刀 (裝備短刀時顯示雙刀流，隱藏盾牌)
        const offDagger = wDag.clone();
        offDagger.visible = false;
        offDagger.position.set(0, -0.28, 0.06);
        offDagger.rotation.x = Math.PI * 0.45;
        foreL.add(offDagger);

        // 腳底加速光環與升級光柱
        const hasteRing = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.5), new THREE.MeshBasicMaterial({ map: sharedTEX.ringDash, color: 0x34d399, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }));
        hasteRing.rotation.x = -Math.PI / 2; hasteRing.position.y = 0.04; hasteRing.visible = false;
        root.add(hasteRing);

        const braveRing = new THREE.Mesh(new THREE.PlaneGeometry(1.85, 1.85), new THREE.MeshBasicMaterial({ map: sharedTEX.ringDash, color: 0xf43f5e, transparent: true, opacity: 0.88, blending: THREE.AdditiveBlending, depthWrite: false }));
        braveRing.rotation.x = -Math.PI / 2; braveRing.position.y = 0.05; braveRing.visible = false;
        root.add(braveRing);

        const levelBeam = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.9, 6.5, 18, 1, true), new THREE.MeshBasicMaterial({ map: sharedTEX.beam, color: new THREE.Color(3.2, 2.5, 0.6), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false, toneMapped: false }));
        levelBeam.position.y = 3.25; levelBeam.visible = false;
        root.add(levelBeam);

        const swordLight = new THREE.PointLight(0x38bdf8, 1.6, 4.8, 2);
        swordLight.position.set(0.45, 1.35, 0.6);
        root.add(swordLight);

        setShadows(body, true);

        return {
            root, body, torso, head, legL, legR, armL, armR, foreR, foreL,
            shield, offDagger, weaponModels,
            capeMesh, capeBasePos, armorMat, armorAuraMat, armorAuraMeshes, capeMat, bladeMat, bladeCoreMat, bladeAuraMat,
            swordLight, bladeSparks,
            slashGroup, slashArc, slashMat, slashInnerMat, hasteRing, braveRing, levelBeam,
            yaw: 0
        };
    }

    // 武器／防具每 +10 換一個色階光芒：+10白 -> +20綠 -> +30藍 -> +40紫 -> +50紅 -> +60金
    function getEnchantTierHex(lv) {
        if (lv >= 60) return 0xfacc15; // 金色
        if (lv >= 50) return 0xef4444; // 紅色
        if (lv >= 40) return 0xa855f7; // 紫色
        if (lv >= 30) return 0x38bdf8; // 藍色
        if (lv >= 20) return 0x22c55e; // 綠色
        if (lv >= 10) return 0xf8fafc; // 白色
        return null;
    }

    function animateKnight(rig, state, t, dt) {
        const targetYaw = Math.atan2(state.dirX, state.dirY);
        rig.yaw = lerpAngle(rig.yaw, targetYaw, clamp(dt * 14, 0, 1));
        rig.root.rotation.y = rig.yaw;

        // 武器外型切換 + 依武器種類自動隱藏/顯示盾牌 (雙手劍/武士刀/短刀絕不拿盾牌！)
        const wClass = state.weaponClass || '1h_sword';
        if (rig.weaponModels) {
            for (const k in rig.weaponModels) rig.weaponModels[k].visible = (k === wClass);
        }
        if (rig.shield) rig.shield.visible = (wClass === '1h_sword');
        if (rig.offDagger) rig.offDagger.visible = (wClass === 'dagger');

        const jumpZ = state.jumpZ || 0;
        const stride = (state.isMoving && jumpZ < 0.05) ? Math.sin(state.walkCycle) : 0;
        const bob = jumpZ > 0.05 ? jumpZ : (state.isMoving ? Math.abs(Math.cos(state.walkCycle)) * 0.075 : Math.sin(t * 2.4) * 0.02);
        rig.body.position.y = bob;
        if (jumpZ > 0.05) {
            rig.legL.rotation.x = -0.45;
            rig.legR.rotation.x = 0.55;
        } else {
            rig.legL.rotation.x = stride * 0.75;
            rig.legR.rotation.x = -stride * 0.75;
        }

        // 動態披風飄揚物理
        const pos = rig.capeMesh.geometry.attributes.position;
        const spd = state.isMoving ? 1.55 : 0.45;
        for (let i = 0; i < pos.count; i++) {
            const bx = rig.capeBasePos[i * 3], by = rig.capeBasePos[i * 3 + 1], bz = rig.capeBasePos[i * 3 + 2];
            const factor = clamp(-by / 1.18, 0, 1);
            const wave = Math.sin(t * (4.2 + spd * 3.2) + bx * 5.2 + by * 4.2) * 0.14 * factor;
            const flare = Math.sin(t * 2.5 + by * 2.0) * 0.05 * factor;
            const trail = (state.isMoving ? 0.42 : 0.12) * factor * factor;
            pos.setX(i, bx * (1 + factor * 0.25) + flare);
            pos.setZ(i, bz - trail + wave);
        }
        pos.needsUpdate = true;

        // 緊貼劍刃的細緻符文火星動畫
        if (rig.bladeSparks) {
            for (const b of rig.bladeSparks) {
                const a = t * 3.8 + b.phase;
                const y = 0.2 + ((b.yBase + t * 0.35) % 1.05);
                const r = 0.052 + Math.sin(a * 1.5) * 0.018;
                b.sp.position.set(Math.cos(a) * r, y, Math.sin(a) * r * 0.6);
                const sc = 0.065 + Math.sin(t * 7 + b.phase) * 0.025;
                b.sp.scale.set(sc, sc, 1);
            }
        }

        // 英雄戰姿 + 雙段連擊揮刀與雙層月牙劍氣
        if (state.swingAnimTimer > 0) {
            const p = 1 - clamp(state.swingAnimTimer / 0.26, 0, 1);
            const comboDir = (state.swingCombo % 2 === 0) ? 1 : -1;
            rig.torso.rotation.y = lerp(-0.58 * comboDir, 0.68 * comboDir, smooth(p));
            rig.armR.rotation.x = lerp(-2.3, 0.88, smooth(p));
            rig.armR.rotation.z = lerp(-0.58 * comboDir, 0.75 * comboDir, smooth(p));
            rig.foreR.rotation.x = lerp(-0.2, -0.72, smooth(p));
            rig.armL.rotation.x = -0.4;
            const env = Math.sin(p * Math.PI);
            rig.slashMat.opacity = env * 0.92;
            rig.slashInnerMat.opacity = env * 0.95;
            rig.slashGroup.rotation.y = lerp(-1.1 * comboDir, 1.15 * comboDir, p);
            rig.slashGroup.rotation.z = comboDir * 0.22;
            rig.slashGroup.scale.setScalar(0.9 + p * 0.34);
        } else {
            rig.torso.rotation.y = lerp(rig.torso.rotation.y, 0.14, clamp(dt * 10, 0, 1));
            rig.armR.rotation.x = lerp(rig.armR.rotation.x, -0.35 - stride * 0.38, clamp(dt * 12, 0, 1));
            rig.armR.rotation.z = lerp(rig.armR.rotation.z, -0.22, clamp(dt * 12, 0, 1));
            rig.foreR.rotation.x = lerp(rig.foreR.rotation.x, -0.45, clamp(dt * 12, 0, 1));
            rig.armL.rotation.x = lerp(rig.armL.rotation.x, -0.28 + stride * 0.3, clamp(dt * 12, 0, 1));
            rig.slashMat.opacity = 0;
            rig.slashInnerMat.opacity = 0;
        }

        if (state.armorTint) rig.armorMat.color.set(state.armorTint);
        if (state.capeColor) rig.capeMat.color.set(state.capeColor);

        // 武器每 +10 階色階光芒 (+10白 / +20綠 / +30藍 / +40紫 / +50紅 / +60金)
        const wEnch = state.weaponEnchant || 0;
        const wTierHex = getEnchantTierHex(wEnch);
        const bc = new THREE.Color(wTierHex !== null ? wTierHex : (state.bladeColor || '#38bdf8'));
        const wBoost = wTierHex !== null ? (2.0 + Math.min(6, Math.floor(wEnch / 10)) * 0.35) : (1.35 + wEnch * 0.1);
        rig.bladeMat.emissive.copy(bc);
        rig.bladeMat.emissiveIntensity = wBoost;
        rig.bladeCoreMat.color.copy(bc).multiplyScalar(wBoost * 1.05);
        if (rig.bladeAuraMat) {
            rig.bladeAuraMat.color.copy(bc).multiplyScalar(wBoost * 0.9);
            rig.bladeAuraMat.opacity = wEnch >= 10 ? 0.38 : 0.24;
        }
        rig.swordLight.color.copy(bc);
        rig.slashMat.color.copy(bc).multiplyScalar(2.3);
        if (rig.bladeSparks) {
            for (const b of rig.bladeSparks) b.sp.material.color.copy(bc).multiplyScalar(2.1);
        }

        // 防具每 +10 階緊貼輪廓光芒 (+10白 / +20綠 / +30藍 / +40紫 / +50紅 / +60金)
        const aEnch = state.armorEnchant || 0;
        const aTierHex = getEnchantTierHex(aEnch);
        if (rig.armorAuraMat && rig.armorAuraMeshes) {
            const showArmorGlow = aTierHex !== null;
            for (const m of rig.armorAuraMeshes) m.visible = showArmorGlow;
            if (showArmorGlow) {
                const ac = new THREE.Color(aTierHex);
                const pulse = 0.22 + Math.sin(t * 4) * 0.06;
                rig.armorAuraMat.color.copy(ac).multiplyScalar(1.8 + Math.min(6, Math.floor(aEnch / 10)) * 0.25);
                rig.armorAuraMat.opacity = pulse;
            }
        }

        if (rig.hasteRing) { rig.hasteRing.visible = state.hasteTimer > 0; if (rig.hasteRing.visible) rig.hasteRing.rotation.z = t * 1.9; }
        if (rig.braveRing) { rig.braveRing.visible = state.braveTimer > 0; if (rig.braveRing.visible) rig.braveRing.rotation.z = -t * 2.6; }
        if (rig.levelBeam) {
            rig.levelBeam.visible = state.levelUpBeamTimer > 0;
            if (rig.levelBeam.visible) {
                rig.levelBeam.material.opacity = clamp(state.levelUpBeamTimer, 0, 1) * 0.8;
                rig.levelBeam.rotation.y = t * 2.6;
            }
        }
    }

    /* =====================================================================
     * 4. 怪物：嗜血狂野狼人 (Sculpted Savage Werewolf)
     * ===================================================================== */
    function createWerewolfRig() {
        const root = new THREE.Group();
        const body = new THREE.Group();
        root.add(body);

        // 精實駝背寬肩軀幹 (Lathe 雕塑胸廓)
        const torso = new THREE.Group();
        torso.position.set(0, 0.92, 0.1);
        torso.rotation.x = 0.42;
        body.add(torso);
        const ribPts = [new THREE.Vector2(0.16, -0.25), new THREE.Vector2(0.24, 0), new THREE.Vector2(0.35, 0.28), new THREE.Vector2(0.32, 0.48), new THREE.Vector2(0.18, 0.56)];
        const chest = addM(torso, new THREE.LatheGeometry(ribPts, 14), M.wolfFur, 0, 0, 0);
        chest.scale.set(1.12, 1.0, 0.92);
        // 寬厚肩部肌肉 + 頸背鬃毛簇
        for (const s of [-1, 1]) addM(torso, new THREE.SphereGeometry(0.2, 12, 10), M.wolfDark, s * 0.26, 0.36, 0.04);
        for (let i = 0; i < 6; i++) {
            const tuft = addM(torso, new THREE.ConeGeometry(0.095, 0.28, 6), M.wolfDark, (i % 2 ? 0.06 : -0.06), 0.46 - i * 0.1, -0.26);
            tuft.rotation.x = -1.15;
        }
        // 腰間戰損破布與斷裂鐵鏈
        addM(torso, new THREE.CylinderGeometry(0.21, 0.23, 0.14, 10), M.leather, 0, -0.18, 0);
        addM(torso, new THREE.TorusGeometry(0.21, 0.022, 6, 14), M.chainIron, 0, -0.16, 0).rotation.x = Math.PI / 2;

        // 猙獰狼頭 + 可張合咆哮下顎 + 尖耳 + 紅眼 + 獠牙
        const head = new THREE.Group();
        head.position.set(0, 0.5, 0.26);
        head.rotation.x = -0.35;
        torso.add(head);
        addM(head, new THREE.SphereGeometry(0.19, 14, 12), M.wolfFur, 0, 0.02, 0).scale.set(1.0, 0.95, 1.15);
        // 上吻部
        const snout = addM(head, new THREE.CylinderGeometry(0.065, 0.125, 0.3, 10), M.wolfDark, 0, 0.0, 0.22);
        snout.rotation.x = Math.PI / 2;
        addM(head, new THREE.SphereGeometry(0.042, 8, 8), M.wolfSnout, 0, 0.02, 0.37);
        // 可動下顎
        const jaw = new THREE.Group();
        jaw.position.set(0, -0.06, 0.1);
        head.add(jaw);
        addM(jaw, new THREE.BoxGeometry(0.12, 0.065, 0.26), M.wolfSnout, 0, -0.02, 0.12);
        for (const s of [-1, 1]) {
            addM(head, new THREE.ConeGeometry(0.02, 0.075, 5), M.bone, s * 0.055, -0.04, 0.28).rotation.x = Math.PI;
            addM(jaw, new THREE.ConeGeometry(0.017, 0.065, 5), M.bone, s * 0.045, 0.03, 0.2);
            const ear = addM(head, new THREE.ConeGeometry(0.055, 0.26, 6), M.wolfDark, s * 0.12, 0.21, -0.03);
            ear.rotation.z = -s * 0.28; ear.rotation.x = -0.15;
            addM(head, new THREE.SphereGeometry(0.028, 8, 8), M.redGlow, s * 0.085, 0.06, 0.16, false);
        }

        // 粗壯長臂 + 鐵手銬 + 四根彎曲利爪
        const makeArm = (s) => {
            const a = new THREE.Group();
            a.position.set(s * 0.38, 0.36, 0.05);
            torso.add(a);
            addM(a, new THREE.CapsuleGeometry(0.105, 0.32, 8, 10), M.wolfFur, 0, -0.18, 0.02);
            const fore = new THREE.Group();
            fore.position.set(0, -0.38, 0.04);
            fore.rotation.x = -0.52;
            a.add(fore);
            addM(fore, new THREE.CapsuleGeometry(0.088, 0.34, 8, 10), M.wolfDark, 0, -0.16, 0);
            addM(fore, new THREE.TorusGeometry(0.092, 0.02, 6, 12), M.chainIron, 0, -0.28, 0).rotation.x = Math.PI / 2;
            for (let c = -1.5; c <= 1.5; c += 1) {
                const claw = addM(fore, new THREE.ConeGeometry(0.018, 0.17, 5), M.bone, c * 0.032, -0.38, 0.07);
                claw.rotation.x = 2.45;
            }
            return a;
        };
        const armL = makeArm(-1), armR = makeArm(1);

        // 反關節狼腿 (Digitigrade Hind Legs)
        const makeLeg = (s) => {
            const hip = new THREE.Group();
            hip.position.set(s * 0.19, 0.74, -0.08);
            body.add(hip);
            addM(hip, new THREE.CapsuleGeometry(0.115, 0.28, 8, 10), M.wolfFur, 0, -0.16, 0.06).rotation.x = -0.45;
            addM(hip, new THREE.CapsuleGeometry(0.078, 0.32, 8, 10), M.wolfDark, 0, -0.44, -0.04).rotation.x = 0.55;
            addM(hip, new THREE.CapsuleGeometry(0.062, 0.18, 6, 8), M.wolfDark, 0, -0.66, 0.06).rotation.x = -0.35;
            for (let c = -1; c <= 1; c++) addM(hip, new THREE.ConeGeometry(0.016, 0.1, 5), M.bone, c * 0.04, -0.73, 0.18).rotation.x = Math.PI / 2;
            return hip;
        };
        const legL = makeLeg(-1), legR = makeLeg(1);

        // 多段蓬鬆狼尾
        const tail = new THREE.Group();
        tail.position.set(0, 0.72, -0.24);
        body.add(tail);
        addM(tail, new THREE.CapsuleGeometry(0.085, 0.34, 6, 8), M.wolfDark, 0, -0.1, -0.18).rotation.x = -1.1;
        addM(tail, new THREE.ConeGeometry(0.095, 0.44, 8), M.wolfFur, 0, -0.2, -0.48).rotation.x = -1.35;

        setShadows(body, true);
        return { root, body, torso, head, jaw, armL, armR, legL, legR, tail, yaw: 0 };
    }

    /* =====================================================================
     * 5. BOSS：黑暗之龍 Tiamat (Massive Sculpted Black Dragon)
     * ===================================================================== */
    function createDragonRig() {
        const root = new THREE.Group();
        const body = new THREE.Group();
        body.position.y = 1.95;
        root.add(body);

        // 巨大黑曜石龍軀 (Lathe 雕塑流線軀幹)
        const bodyPts = [
            new THREE.Vector2(0.18, -1.05), new THREE.Vector2(0.45, -0.55),
            new THREE.Vector2(0.7, 0.15), new THREE.Vector2(0.66, 0.72), new THREE.Vector2(0.36, 1.08)
        ];
        const torsoMesh = addM(body, new THREE.LatheGeometry(bodyPts, 16), M.dragonBody, 0, 0, 0);
        torsoMesh.rotation.x = Math.PI / 2;
        torsoMesh.scale.set(1.05, 1.0, 0.85);

        // 胸口紫色發光龍核與動態紫光
        const chestCore = addM(body, new THREE.SphereGeometry(0.42, 12, 10), M.purpleGlow, 0, -0.2, 0.5, false);
        chestCore.scale.set(0.9, 0.52, 1.15);
        const dragonLight = new THREE.PointLight(0xa855f7, 6.5, 12, 1.8);
        dragonLight.position.set(0, 0.1, 1.0);
        body.add(dragonLight);

        // 整排背脊黑曜石骨刺
        for (let i = 0; i < 8; i++) {
            const z = 0.85 - i * 0.26;
            const sc = 1.0 - Math.abs(i - 2.5) * 0.08;
            const sp = addM(body, new THREE.ConeGeometry(0.085 * sc, 0.44 * sc, 5), M.dragonHorn, 0, 0.56 - Math.abs(i - 2) * 0.03, z);
            sp.rotation.x = -0.4;
        }

        // S 型多段長頸 + 雙角猙獰龍首 + 可張開噴火下顎
        const neck = new THREE.Group();
        neck.position.set(0, 0.28, 0.98);
        body.add(neck);
        addM(neck, new THREE.CylinderGeometry(0.24, 0.34, 0.68, 12), M.dragonBody, 0, 0.24, 0.22).rotation.x = 0.75;
        addM(neck, new THREE.CylinderGeometry(0.19, 0.24, 0.62, 12), M.dragonBody, 0, 0.65, 0.56).rotation.x = 0.45;
        for (let i = 0; i < 4; i++) addM(neck, new THREE.ConeGeometry(0.055, 0.26, 5), M.dragonHorn, 0, 0.22 + i * 0.2, 0.06 + i * 0.14).rotation.x = -0.5;

        const head = new THREE.Group();
        head.position.set(0, 0.96, 0.76);
        neck.add(head);
        // 頭骨與吻部
        addM(head, new THREE.BoxGeometry(0.42, 0.3, 0.52), M.dragonBody, 0, 0.04, 0.08);
        const snout = addM(head, new THREE.CylinderGeometry(0.12, 0.22, 0.58, 8), M.dragonBody, 0, -0.02, 0.48);
        snout.rotation.x = Math.PI / 2; snout.scale.set(1.15, 1.0, 0.65);
        // 下顎 + 喉部紫光
        const jaw = new THREE.Group();
        jaw.position.set(0, -0.1, 0.14);
        head.add(jaw);
        addM(jaw, new THREE.BoxGeometry(0.28, 0.11, 0.56), M.dragonBody, 0, -0.03, 0.28);
        addM(jaw, new THREE.SphereGeometry(0.12, 8, 8), M.purpleGlow, 0, 0.04, 0.24, false);
        // 雙彎角 + 側角 + 紫色發光龍眸
        for (const s of [-1, 1]) {
            const horn1 = addM(head, new THREE.ConeGeometry(0.075, 0.78, 7), M.dragonHorn, s * 0.17, 0.34, -0.22);
            horn1.rotation.x = -0.88; horn1.rotation.z = -s * 0.32;
            const horn2 = addM(head, new THREE.ConeGeometry(0.048, 0.42, 6), M.dragonHorn, s * 0.24, 0.08, -0.12);
            horn2.rotation.x = -1.1; horn2.rotation.z = -s * 0.65;
            addM(head, new THREE.SphereGeometry(0.055, 8, 8), M.purpleGlow, s * 0.18, 0.08, 0.32, false);
            addM(head, new THREE.ConeGeometry(0.026, 0.11, 5), M.bone, s * 0.1, -0.11, 0.6).rotation.x = Math.PI;
        }

        // 巨型多關節蝙蝠翼 (上臂 + 前臂翼指骨 + 撕裂紫脈翼膜)
        const makeWing = (s) => {
            const shoulder = new THREE.Group();
            shoulder.position.set(s * 0.56, 0.36, 0.26);
            body.add(shoulder);
            // 上臂骨
            addM(shoulder, new THREE.CylinderGeometry(0.08, 0.1, 1.1, 8), M.dragonHorn, s * 0.5, 0.26, 0.08).rotation.z = -s * 1.15;
            // 外翼關節 (隨拍翅二次彎曲)
            const outer = new THREE.Group();
            outer.position.set(s * 0.98, 0.48, 0.14);
            shoulder.add(outer);
            addM(outer, new THREE.ConeGeometry(0.05, 0.24, 5), M.bone, 0, 0.14, 0.06); // 翼爪
            // 4 根翼指骨
            const fingers = [
                [s * 1.75, 0.35, 0.12],
                [s * 1.55, -0.25, -0.45],
                [s * 1.0, -0.58, -0.85],
                [s * 0.3, -0.68, -1.05]
            ];
            for (const [fx, fy, fz] of fingers) {
                const curve = new THREE.LineCurve3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(fx, fy, fz));
                addM(outer, new THREE.TubeGeometry(curve, 4, 0.036, 6, false), M.dragonHorn, 0, 0, 0);
            }
            // 外翼翼膜
            const memOut = new THREE.Shape();
            memOut.moveTo(0, 0);
            memOut.lineTo(s * 1.75, 0.35);
            memOut.quadraticCurveTo(s * 1.5, 0.0, s * 1.55, -0.25);
            memOut.quadraticCurveTo(s * 1.2, -0.35, s * 1.0, -0.58);
            memOut.quadraticCurveTo(s * 0.6, -0.5, s * 0.3, -0.68);
            memOut.quadraticCurveTo(s * 0.05, -0.45, -s * 0.42, -0.68);
            memOut.closePath();
            const outMesh = new THREE.Mesh(new THREE.ShapeGeometry(memOut), M.dragonWing);
            outMesh.rotation.x = 0.48;
            outer.add(outMesh);
            // 內翼翼膜
            const memIn = new THREE.Shape();
            memIn.moveTo(0, 0); memIn.lineTo(s * 0.98, 0.48);
            memIn.lineTo(s * 0.56, -0.25); memIn.lineTo(0, -0.45);
            memIn.closePath();
            const inMesh = new THREE.Mesh(new THREE.ShapeGeometry(memIn), M.dragonWing);
            inMesh.rotation.x = 0.35;
            shoulder.add(inMesh);

            return { shoulder, outer };
        };
        const wingL = makeWing(-1), wingR = makeWing(1);

        // 5 節可動尖刺龍尾
        const tailSegs = [];
        let prevTail = body;
        for (let i = 0; i < 5; i++) {
            const seg = new THREE.Group();
            seg.position.set(0, i === 0 ? -0.08 : -0.03, i === 0 ? -1.02 : -0.44);
            prevTail.add(seg);
            const rTop = 0.24 - i * 0.038, rBot = Math.max(0.03, rTop - 0.04);
            addM(seg, new THREE.CylinderGeometry(rBot, rTop, 0.48, 8), M.dragonBody, 0, 0, -0.22).rotation.x = Math.PI / 2;
            addM(seg, new THREE.ConeGeometry(0.045, 0.22, 4), M.dragonHorn, 0, rTop + 0.06, -0.22).rotation.x = -0.3;
            if (i === 4) addM(seg, new THREE.ConeGeometry(0.16, 0.46, 4), M.purpleGlow, 0, 0, -0.58, false).rotation.x = -Math.PI / 2;
            tailSegs.push(seg);
            prevTail = seg;
        }

        // 強壯龍爪四肢
        for (const s of [-1, 1]) {
            addM(body, new THREE.CapsuleGeometry(0.13, 0.48, 8, 10), M.dragonBody, s * 0.5, -0.56, 0.42).rotation.x = 0.35;
            addM(body, new THREE.CapsuleGeometry(0.14, 0.54, 8, 10), M.dragonBody, s * 0.52, -0.6, -0.38).rotation.x = -0.3;
            for (let c = -1; c <= 1; c++) {
                addM(body, new THREE.ConeGeometry(0.025, 0.18, 5), M.bone, s * 0.5 + c * 0.05, -0.9, 0.56).rotation.x = 2.6;
            }
        }

        setShadows(body, true);
        return { root, body, neck, head, jaw, wingL, wingR, tailSegs, yaw: 0 };
    }

    /* =====================================================================
     * 6. 夏洛柏 (巨型毒蜘蛛) / 巨大鱷魚 / 史萊姆
     * ===================================================================== */
    function createSpiderRig() {
        const root = new THREE.Group();
        const body = new THREE.Group();
        body.position.y = 0.46;
        root.add(body);
        const abd = addM(body, new THREE.SphereGeometry(0.46, 16, 14), M.spiderShell, 0, 0.16, -0.38);
        abd.scale.set(1.02, 0.85, 1.32);
        addM(body, new THREE.OctahedronGeometry(0.16, 0), M.greenGlow, 0, 0.48, -0.4, false).scale.set(0.75, 0.28, 1.45);
        addM(body, new THREE.SphereGeometry(0.26, 14, 12), M.spiderShell, 0, 0.04, 0.28);
        // 6 顆發光紅複眼 + 毒牙螯肢
        for (const [ex, ey, ez] of [[-0.1, 0.12, 0.48], [-0.035, 0.14, 0.51], [0.035, 0.14, 0.51], [0.1, 0.12, 0.48], [-0.07, 0.07, 0.5], [0.07, 0.07, 0.5]]) {
            addM(body, new THREE.SphereGeometry(0.026, 6, 6), M.redGlow, ex, ey, ez, false);
        }
        for (const s of [-1, 1]) addM(body, new THREE.ConeGeometry(0.045, 0.24, 6), M.bone, s * 0.1, -0.06, 0.54).rotation.x = 2.4;

        const legs = [];
        for (const s of [-1, 1]) {
            for (let i = 0; i < 4; i++) {
                const lg = new THREE.Group();
                lg.position.set(s * 0.22, 0.04, 0.24 - i * 0.18);
                body.add(lg);
                addM(lg, new THREE.CylinderGeometry(0.04, 0.032, 0.58, 7), M.spiderShell, s * 0.25, 0.19, 0).rotation.z = -s * 0.95;
                addM(lg, new THREE.CylinderGeometry(0.03, 0.012, 0.72, 7), M.spiderShell, s * 0.58, -0.14, 0).rotation.z = s * 0.28;
                legs.push({ g: lg, s, i });
            }
        }
        setShadows(body, true);
        return { root, body, legs, yaw: 0 };
    }

    function createCrocRig() {
        const root = new THREE.Group();
        const body = new THREE.Group();
        body.position.y = 0.28;
        root.add(body);
        addM(body, new THREE.CylinderGeometry(0.28, 0.3, 1.3, 10), M.crocScale, 0, 0.06, 0).rotation.x = Math.PI / 2;
        addM(body, new THREE.BoxGeometry(0.46, 0.1, 1.18), M.crocBelly, 0, -0.12, 0);
        for (let i = 0; i < 6; i++) {
            for (const s of [-0.1, 0.1]) addM(body, new THREE.ConeGeometry(0.055, 0.14, 4), M.crocScale, s, 0.29, 0.48 - i * 0.2);
        }
        const jaw = new THREE.Group();
        jaw.position.set(0, 0.08, 0.64);
        body.add(jaw);
        addM(jaw, new THREE.BoxGeometry(0.36, 0.14, 0.72), M.crocScale, 0, 0.04, 0.34);
        for (const s of [-1, 1]) {
            addM(jaw, new THREE.SphereGeometry(0.042, 6, 6), M.redGlow, s * 0.15, 0.13, 0.08, false);
            for (let t = 0; t < 4; t++) addM(jaw, new THREE.ConeGeometry(0.018, 0.07, 4), M.bone, s * 0.15, -0.04, 0.18 + t * 0.15).rotation.x = Math.PI;
        }
        const tail = new THREE.Group();
        tail.position.set(0, 0.02, -0.64);
        body.add(tail);
        addM(tail, new THREE.ConeGeometry(0.24, 1.28, 8), M.crocScale, 0, 0, -0.64).rotation.x = -Math.PI / 2;
        const legs = [];
        for (const [sx, sz] of [[-1, 0.4], [1, 0.4], [-1, -0.4], [1, -0.4]]) {
            const l = new THREE.Group(); l.position.set(sx * 0.32, -0.06, sz); body.add(l);
            addM(l, new THREE.CapsuleGeometry(0.085, 0.2, 6, 8), M.crocScale, sx * 0.08, -0.08, 0).rotation.z = sx * 0.45;
            legs.push(l);
        }
        setShadows(body, true);
        return { root, body, jaw, tail, legs, yaw: 0 };
    }

    function createSlimeRig() {
        const root = new THREE.Group();
        const body = new THREE.Group();
        root.add(body);
        const dome = addM(body, new THREE.SphereGeometry(0.4, 20, 14, 0, TAU, 0, Math.PI * 0.66), M.slimeOuter, 0, 0.08, 0);
        dome.scale.set(1.18, 0.96, 1.18);
        addM(body, new THREE.OctahedronGeometry(0.15, 1), M.greenGlow, 0, 0.22, 0, false);
        for (const s of [-1, 1]) addM(body, new THREE.SphereGeometry(0.042, 8, 8), M.darkSteel, s * 0.13, 0.28, 0.34, false);
        setShadows(body, true);
        return { root, body, yaw: 0 };
    }

    function createMonsterRig(m) {
        let rig;
        if (m.type === 'werewolf') rig = createWerewolfRig();
        else if (m.type === 'drake') rig = createDragonRig();
        else if (m.type === 'shelob') rig = createSpiderRig();
        else if (m.type === 'croc') rig = createCrocRig();
        else rig = createSlimeRig();

        const ringMat = new THREE.MeshBasicMaterial({ map: sharedTEX.ring, color: 0xef4444, transparent: true, opacity: 0.92, blending: THREE.AdditiveBlending, depthWrite: false });
        const ring = new THREE.Mesh(new THREE.PlaneGeometry(1.65, 1.65), ringMat);
        ring.rotation.x = -Math.PI / 2; ring.position.y = 0.04; ring.visible = false;
        rig.root.add(ring);
        rig.ring = ring; rig.ringMat = ringMat;
        rig.type = m.type;
        // 黑暗之龍 Boss 呈現壓迫感十足的巨型體型！
        rig.root.scale.setScalar(m.scale * (m.type === 'drake' ? 1.48 : 0.96));
        rig.root.userData.monsterId = m.id;
        return rig;
    }

    function animateMonster(rig, m, t, dt, isTarget, isHover) {
        const targetYaw = Math.atan2(m.dirX || 0, m.dirY || 1);
        rig.yaw = lerpAngle(rig.yaw, targetYaw, clamp(dt * 10, 0, 1));
        rig.root.rotation.y = rig.yaw;

        const lunge = m.attackAnimTimer > 0 ? Math.sin((m.attackAnimTimer / 0.35) * Math.PI) : 0;
        const hurt = m.hurtFlashTimer > 0;

        if (m.type === 'werewolf') {
            const w = Math.sin(m.walkPhase);
            rig.legL.rotation.x = w * 0.68;
            rig.legR.rotation.x = -w * 0.68;
            rig.armL.rotation.x = -0.38 - w * 0.42 - lunge * 1.55;
            rig.armR.rotation.x = -0.38 + w * 0.42 - lunge * 1.55;
            rig.jaw.rotation.x = 0.14 + Math.abs(Math.sin(t * 3 + m.id)) * 0.12 + lunge * 0.48;
            rig.body.position.z = lunge * 0.5;
            rig.tail.rotation.y = Math.sin(t * 6.5 + m.id) * 0.38;
        } else if (m.type === 'drake') {
            const flap = Math.sin(m.wingPhase * 0.8);
            rig.body.position.y = 1.95 + Math.cos(m.wingPhase * 0.8) * 0.28;
            rig.wingL.shoulder.rotation.z = flap * 0.52;
            rig.wingL.outer.rotation.z = flap * 0.42;
            rig.wingR.shoulder.rotation.z = -flap * 0.52;
            rig.wingR.outer.rotation.z = -flap * 0.42;
            rig.neck.rotation.x = lunge * 0.38 + Math.sin(t * 2 + m.id) * 0.06;
            rig.jaw.rotation.x = 0.12 + lunge * 0.68;
            rig.tailSegs.forEach((seg, i) => {
                seg.rotation.y = Math.sin(t * 3.8 + m.id - i * 0.65) * 0.24;
            });
        } else if (m.type === 'shelob') {
            rig.legs.forEach(({ g, s, i }) => {
                g.rotation.y = Math.sin(m.walkPhase + i * 1.45 + (s > 0 ? 0 : Math.PI)) * 0.34;
            });
            rig.body.position.z = lunge * 0.38;
        } else if (m.type === 'croc') {
            rig.tail.rotation.y = Math.sin(m.walkPhase * 0.72) * 0.42;
            rig.jaw.rotation.x = -lunge * 0.62;
            rig.legs.forEach((l, i) => { l.rotation.x = Math.sin(m.walkPhase + i * Math.PI * 0.5) * 0.42; });
        } else {
            const bounce = Math.abs(Math.sin(m.walkPhase * 0.6));
            rig.body.position.y = bounce * 0.24;
            rig.body.scale.set(1 + (1 - bounce) * 0.16, 0.86 + bounce * 0.28, 1 + (1 - bounce) * 0.16);
        }

        if (hurt) rig.body.scale.multiplyScalar(1.07);
        else if (m.type !== 'slime') rig.body.scale.set(1, 1, 1);

        rig.ring.visible = isTarget || isHover;
        if (rig.ring.visible) {
            rig.ringMat.color.setHex(isTarget ? 0xef4444 : 0xfacc15);
            rig.ring.rotation.z = t * 2.5;
        }
    }

    return { createKnightRig, animateKnight, createMonsterRig, animateMonster };
}
