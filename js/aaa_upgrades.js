/**
 * Tiana 3D — AAA 環境與視覺特效升級模組
 * 1. 寫實多層松針枝葉樹 (Alpha-Cutout Pine Fronds，告別假圓錐樹)
 * 2. 寫實地表粗糙度反光貼圖 (RoughnessMap) & 奧術魔法陣貼圖 (Rune Circle)
 * 3. 日夜動態光影系統 (黃昏 / 白天 / 深夜 / 自動日夜循環)
 * 4. AAA 級三大魔法特效 (動態閃爍分叉連鎖落雷 / 螺旋風帶龍捲風 / 熔岩火球與爆裂衝擊波)
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;

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

/* =====================================================================
 * 1. 寫實松針枝葉貼圖 (Alpha Cutout) 與樹皮貼圖
 * ===================================================================== */
export function createPineTextures() {
    // 松枝針葉 (256x256 RGBA 透明去背)
    const S = 256, rnd = makeRng(707);
    const [c, g] = makeCanvas(S);
    g.clearRect(0, 0, S, S);

    // 主枝幹
    g.strokeStyle = '#362417';
    g.lineWidth = 5;
    g.lineCap = 'round';
    g.beginPath(); g.moveTo(S * 0.5, S * 0.96); g.lineTo(S * 0.5, S * 0.14); g.stroke();

    // 側枝與密集松針簇
    const drawNeedleCluster = (bx, by, dirAngle, len, spread) => {
        const subCount = 26;
        for (let i = 0; i < subCount; i++) {
            const f = i / subCount;
            const px = bx + Math.cos(dirAngle) * len * f;
            const py = by + Math.sin(dirAngle) * len * f;
            for (const side of [-1, 1]) {
                const a = dirAngle + side * (0.48 + rnd() * spread);
                const nl = (12 + rnd() * 20) * (1 - f * 0.45);
                const hue = 98 + rnd() * 26;
                const sat = 32 + rnd() * 20;
                const lit = 14 + f * 14 + rnd() * 11;
                g.strokeStyle = `hsl(${hue},${sat}%,${lit}%)`;
                g.lineWidth = 2.0 + rnd() * 1.2;
                g.beginPath();
                g.moveTo(px, py);
                g.lineTo(px + Math.cos(a) * nl, py + Math.sin(a) * nl);
                g.stroke();
            }
        }
    };

    // 左右多對分枝
    const branches = [
        [0.86, -0.78, 86], [0.86, -2.36, 86],
        [0.72, -0.82, 92], [0.72, -2.32, 92],
        [0.58, -0.88, 82], [0.58, -2.26, 82],
        [0.44, -0.95, 68], [0.44, -2.19, 68],
        [0.31, -1.04, 52], [0.31, -2.10, 52],
        [0.20, -1.20, 34], [0.20, -1.94, 34]
    ];
    for (const [yf, ang, len] of branches) {
        const sy = S * yf;
        g.strokeStyle = '#3b2819'; g.lineWidth = 2.5;
        g.beginPath(); g.moveTo(S * 0.5, sy); g.lineTo(S * 0.5 + Math.cos(ang) * len * 0.7, sy + Math.sin(ang) * len * 0.7); g.stroke();
        drawNeedleCluster(S * 0.5, sy, ang, len, 0.35);
    }
    // 頂端主梢松針
    drawNeedleCluster(S * 0.5, S * 0.45, -Math.PI / 2, 102, 0.42);

    const frondMap = new THREE.CanvasTexture(c);
    frondMap.colorSpace = THREE.SRGBColorSpace;

    // 寫實深褐裂紋樹皮貼圖
    const [bc, bg] = makeCanvas(128, 256);
    bg.fillStyle = '#352418'; bg.fillRect(0, 0, 128, 256);
    for (let i = 0; i < 420; i++) {
        const x = rnd() * 128, y = rnd() * 256, h = 14 + rnd() * 44;
        bg.fillStyle = rnd() < 0.55 ? 'rgba(20,12,8,0.45)' : 'rgba(92,68,46,0.28)';
        bg.fillRect(x, y, 2 + rnd() * 4, h);
    }
    const barkMap = new THREE.CanvasTexture(bc);
    barkMap.wrapS = barkMap.wrapT = THREE.RepeatWrapping;
    barkMap.colorSpace = THREE.SRGBColorSpace;

    return { frondMap, barkMap };
}

/**
 * 建立一棵 AAA 級多層松針枝葉樹 (無假圓錐！由 38 片立體下垂松枝葉片與凹凸樹幹組成)
 */
export function buildRealisticPineGeo(seed) {
    const rnd = makeRng(seed);
    const fronds = [];

    // 7 層螺旋排列的下垂松枝層，由下往上逐漸收尖
    const layers = 8;
    for (let li = 0; li < layers; li++) {
        const f = li / (layers - 1); // 0=底層, 1=樹頂
        const yBase = 0.95 + f * 3.15;
        const radius = lerp(1.32, 0.24, Math.pow(f, 0.92));
        const count = Math.max(3, Math.round(lerp(7, 3, f)));
        const angleOff = li * 1.15 + rnd() * 0.5;

        for (let bi = 0; bi < count; bi++) {
            const az = angleOff + (bi / count) * TAU + (rnd() - 0.5) * 0.28;
            const len = radius * (0.85 + rnd() * 0.3);
            const wid = len * (0.72 + rnd() * 0.22);

            // 略帶弧度與自然下垂的枝葉卡面 (2x2 分段彎曲)
            const card = new THREE.PlaneGeometry(wid, len, 2, 2);
            const p = card.attributes.position;
            for (let k = 0; k < p.count; k++) {
                const vx = p.getX(k), vy = p.getY(k);
                const t = (vy + len / 2) / len; // 0=靠樹幹, 1=枝梢
                // 枝葉微拱起且末端自然下垂，兩側微捲
                const arch = Math.sin(t * Math.PI) * 0.16 - t * t * 0.28 - Math.abs(vx) * 0.14;
                p.setZ(k, arch);
            }
            // 把底部原點移到樹幹處，向外伸展並依層級調整傾角
            card.translate(0, len * 0.45, 0);
            const pitch = lerp(1.22, 0.52, f) + (rnd() - 0.5) * 0.18;
            card.rotateX(pitch);
            card.rotateZ((rnd() - 0.5) * 0.22);
            card.rotateY(az);
            card.translate(0, yBase + (rnd() - 0.5) * 0.14, 0);

            // 頂點環境遮蔽 (內部靠樹幹深墨綠，外側與高處帶陽光橄欖綠)
            const cols = [];
            const cp = card.attributes.position;
            for (let k = 0; k < cp.count; k++) {
                const dist = Math.hypot(cp.getX(k), cp.getZ(k));
                const hNorm = clamp((cp.getY(k) - 0.8) / 3.6, 0, 1);
                const shade = clamp(0.42 + (dist / 1.5) * 0.42 + hNorm * 0.28, 0.32, 1.12);
                cols.push(shade * 0.88, shade * 1.0, shade * 0.84);
            }
            card.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
            card.computeVertexNormals();
            fronds.push(card);
        }
    }

    // 樹頂垂直十字松梢
    for (let k = 0; k < 2; k++) {
        const tip = new THREE.PlaneGeometry(0.45, 0.72);
        tip.translate(0, 4.35, 0);
        tip.rotateY(k * Math.PI / 2 + rnd());
        const cols = [];
        for (let i = 0; i < tip.attributes.position.count; i++) cols.push(0.9, 1.05, 0.88);
        tip.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
        fronds.push(tip);
    }

    const leaves = mergeGeometries(fronds);

    // 粗壯微彎樹幹 + 根部外擴
    const trunk = new THREE.CylinderGeometry(0.055, 0.2, 3.6, 8, 5);
    const tp = trunk.attributes.position;
    for (let k = 0; k < tp.count; k++) {
        const vy = tp.getY(k);
        if (vy < -1.3) { // 樹根外擴
            tp.setX(k, tp.getX(k) * 1.38);
            tp.setZ(k, tp.getZ(k) * 1.38);
        }
        tp.setX(k, tp.getX(k) + Math.sin(vy * 0.9 + seed) * 0.035);
    }
    trunk.translate(0, 1.8, 0);
    trunk.computeVertexNormals();
    return { leaves, trunk };
}

/* =====================================================================
 * 2. AAA 地表反光粗糙度貼圖 & 奧術魔法陣貼圖
 * ===================================================================== */
export function genCobbleRoughnessTex(size = 256) {
    const rnd = makeRng(808);
    const [c, g] = makeCanvas(size);
    // 預設較粗糙 (白=粗，黑=濕亮反光)
    g.fillStyle = '#c8c8c8'; g.fillRect(0, 0, size, size);
    // 隨機濕潤石板與微小水漬反光區塊
    for (let i = 0; i < 45; i++) {
        const x = rnd() * size, y = rnd() * size, r = 10 + rnd() * 34;
        const gr = g.createRadialGradient(x, y, 0, x, y, r);
        const dark = 45 + Math.floor(rnd() * 70);
        gr.addColorStop(0, `rgba(${dark},${dark},${dark},0.65)`);
        gr.addColorStop(1, 'rgba(200,200,200,0)');
        g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
    }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
}

export function genRuneCircleTex(size = 512) {
    const [c, g] = makeCanvas(size);
    const cx = size / 2, cy = size / 2;
    g.clearRect(0, 0, size, size);
    g.strokeStyle = '#ffffff';
    g.shadowColor = '#ffffff';
    g.shadowBlur = 10;

    // 外環雙圓
    g.lineWidth = 5; g.beginPath(); g.arc(cx, cy, size * 0.45, 0, TAU); g.stroke();
    g.lineWidth = 2.5; g.beginPath(); g.arc(cx, cy, size * 0.39, 0, TAU); g.stroke();
    g.lineWidth = 2; g.beginPath(); g.arc(cx, cy, size * 0.24, 0, TAU); g.stroke();

    // 六芒星法陣幾何線條
    for (let rot = 0; rot < 2; rot++) {
        g.beginPath();
        for (let i = 0; i <= 3; i++) {
            const a = (i / 3) * TAU + (rot * Math.PI) / 3 - Math.PI / 2;
            const px = cx + Math.cos(a) * size * 0.385;
            const py = cy + Math.sin(a) * size * 0.385;
            if (i === 0) g.moveTo(px, py); else g.lineTo(px, py);
        }
        g.closePath(); g.stroke();
    }

    // 16 個環狀符文刻度
    g.lineWidth = 3;
    for (let i = 0; i < 16; i++) {
        const a = (i / 16) * TAU;
        const r1 = size * 0.405, r2 = size * 0.438;
        g.beginPath();
        g.moveTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
        g.lineTo(cx + Math.cos(a) * r2, cy + Math.sin(a) * r2);
        g.stroke();
        // 交錯小菱形符文
        if (i % 2 === 0) {
            const rm = size * 0.42;
            g.beginPath();
            g.arc(cx + Math.cos(a + 0.19) * rm, cy + Math.sin(a + 0.19) * rm, 4, 0, TAU);
            g.stroke();
        }
    }

    // 中央光核柔暈
    const rg = g.createRadialGradient(cx, cy, 0, cx, cy, size * 0.25);
    rg.addColorStop(0, 'rgba(255,255,255,0.45)');
    rg.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = rg;
    g.beginPath(); g.arc(cx, cy, size * 0.25, 0, TAU); g.fill();

    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
}

/* =====================================================================
 * 3. 日夜動態光影控制器 (黃昏 / 白天 / 深夜 / 自動循環)
 * ===================================================================== */
const TIME_PRESETS = {
    dusk:  { hour: 17.1, label: '黃昏', icon: '🌇', sky: 0x161c2c, fog: 0x182032, fogDensity: 0.020, sunCol: 0xffb978, sunInt: 2.05, hemiSky: 0x7a96cc, hemiGnd: 0x2f251d, hemiInt: 0.68, fillCol: 0x4c72b8, fillInt: 0.58, exp: 1.05, bloom: 0.58, torchMult: 1.15, sunOff: [26, 24, 18] },
    day:   { hour: 11.5, label: '白天', icon: '☀️', sky: 0x6f98c4, fog: 0x7ba0c4, fogDensity: 0.011, sunCol: 0xfff3d8, sunInt: 2.75, hemiSky: 0xbcd8ff, hemiGnd: 0x484e38, hemiInt: 0.95, fillCol: 0x8bb4e8, fillInt: 0.48, exp: 1.12, bloom: 0.34, torchMult: 0.35, sunOff: [20, 44, 16] },
    night: { hour: 23.2, label: '深夜', icon: '🌙', sky: 0x060912, fog: 0x080c18, fogDensity: 0.025, sunCol: 0x6e95e8, sunInt: 1.05, hemiSky: 0x263866, hemiGnd: 0x101218, hemiInt: 0.46, fillCol: 0x2a4580, fillInt: 0.42, exp: 0.96, bloom: 0.78, torchMult: 1.75, sunOff: [-22, 30, 18] }
};

export function createDayNightController({ scene, renderer, sun, hemi, fill, bloomPass, torches }) {
    const modes = ['dusk', 'day', 'night', 'auto'];
    let modeIdx = 0;
    let simHour = 17.1; // 預設 17:06 經典黃昏 (與截圖一致)
    const curSky = new THREE.Color(TIME_PRESETS.dusk.sky);
    const curFog = new THREE.Color(TIME_PRESETS.dusk.fog);
    const curSun = new THREE.Color(TIME_PRESETS.dusk.sunCol);
    const curHemiSky = new THREE.Color(TIME_PRESETS.dusk.hemiSky);
    const curHemiGnd = new THREE.Color(TIME_PRESETS.dusk.hemiGnd);
    const curFill = new THREE.Color(TIME_PRESETS.dusk.fillCol);
    const sunOffset = new THREE.Vector3(26, 24, 18);
    let torchMult = 1.15;

    function getTargetState() {
        const m = modes[modeIdx];
        if (m !== 'auto') return TIME_PRESETS[m];
        // 自動日夜循環：依據 simHour (0~24) 在 night -> day -> dusk -> night 之間內插
        const h = ((simHour % 24) + 24) % 24;
        const blend = (A, B, t) => ({
            sky: new THREE.Color(A.sky).lerp(new THREE.Color(B.sky), t).getHex(),
            fog: new THREE.Color(A.fog).lerp(new THREE.Color(B.fog), t).getHex(),
            fogDensity: lerp(A.fogDensity, B.fogDensity, t),
            sunCol: new THREE.Color(A.sunCol).lerp(new THREE.Color(B.sunCol), t).getHex(),
            sunInt: lerp(A.sunInt, B.sunInt, t),
            hemiSky: new THREE.Color(A.hemiSky).lerp(new THREE.Color(B.hemiSky), t).getHex(),
            hemiGnd: new THREE.Color(A.hemiGnd).lerp(new THREE.Color(B.hemiGnd), t).getHex(),
            hemiInt: lerp(A.hemiInt, B.hemiInt, t),
            fillCol: new THREE.Color(A.fillCol).lerp(new THREE.Color(B.fillCol), t).getHex(),
            fillInt: lerp(A.fillInt, B.fillInt, t),
            exp: lerp(A.exp, B.exp, t),
            bloom: lerp(A.bloom, B.bloom, t),
            torchMult: lerp(A.torchMult, B.torchMult, t),
            sunOff: [lerp(A.sunOff[0], B.sunOff[0], t), lerp(A.sunOff[1], B.sunOff[1], t), lerp(A.sunOff[2], B.sunOff[2], t)]
        });
        if (h >= 6 && h < 11) return blend(TIME_PRESETS.dusk, TIME_PRESETS.day, (h - 6) / 5);
        if (h >= 11 && h < 16) return TIME_PRESETS.day;
        if (h >= 16 && h < 19) return blend(TIME_PRESETS.day, TIME_PRESETS.dusk, (h - 16) / 3);
        if (h >= 19 && h < 21.5) return blend(TIME_PRESETS.dusk, TIME_PRESETS.night, (h - 19) / 2.5);
        if (h >= 4 && h < 6) return blend(TIME_PRESETS.night, TIME_PRESETS.dusk, (h - 4) / 2);
        return TIME_PRESETS.night;
    }

    function updateHud() {
        const clockEl = document.getElementById('worldClockText');
        const labelEl = document.getElementById('timeModeLabel');
        const hh = Math.floor(simHour) % 24;
        const mm = Math.floor((simHour % 1) * 60);
        if (clockEl) clockEl.textContent = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
        if (labelEl) {
            const m = modes[modeIdx];
            if (m === 'auto') labelEl.textContent = '🔄循環';
            else labelEl.textContent = `${TIME_PRESETS[m].icon}${TIME_PRESETS[m].label}`;
        }
    }

    function cycleMode() {
        modeIdx = (modeIdx + 1) % modes.length;
        const m = modes[modeIdx];
        if (m !== 'auto') simHour = TIME_PRESETS[m].hour;
        updateHud();
    }

    function update(dt) {
        if (modes[modeIdx] === 'auto') {
            simHour = (simHour + dt * 0.45) % 24; // 約 53 秒一整個日夜週期
        }
        const target = getTargetState();
        const k = clamp(dt * 3.0, 0, 1);
        curSky.lerp(new THREE.Color(target.sky), k);
        curFog.lerp(new THREE.Color(target.fog), k);
        curSun.lerp(new THREE.Color(target.sunCol), k);
        curHemiSky.lerp(new THREE.Color(target.hemiSky), k);
        curHemiGnd.lerp(new THREE.Color(target.hemiGnd), k);
        curFill.lerp(new THREE.Color(target.fillCol), k);

        scene.background.copy(curSky);
        scene.fog.color.copy(curFog);
        scene.fog.density = lerp(scene.fog.density, target.fogDensity, k);
        sun.color.copy(curSun);
        sun.intensity = lerp(sun.intensity, target.sunInt, k);
        hemi.color.copy(curHemiSky);
        hemi.groundColor.copy(curHemiGnd);
        hemi.intensity = lerp(hemi.intensity, target.hemiInt, k);
        fill.color.copy(curFill);
        fill.intensity = lerp(fill.intensity, target.fillInt, k);
        renderer.toneMappingExposure = lerp(renderer.toneMappingExposure, target.exp, k);
        bloomPass.strength = lerp(bloomPass.strength, target.bloom, k);
        torchMult = lerp(torchMult, target.torchMult, k);
        sunOffset.lerp(new THREE.Vector3(...target.sunOff), k);

        updateHud();
    }

    updateHud();
    return { cycleMode, update, getSunOffset: () => sunOffset, getTorchMult: () => torchMult };
}

/* =====================================================================
 * 4. AAA 級三大毀滅魔法 VFX 引擎
 * ===================================================================== */
export function createSpellVfxEngine({ scene, TEX, runeTex, worldY, vfxList }) {
    function buildForkedBolt(pStart, pEnd, radius, jitter, colorHex, withBranches = true) {
        const g = new THREE.Group();
        const pts = [];
        const segs = 12;
        for (let i = 0; i <= segs; i++) {
            const t = i / segs;
            const p = new THREE.Vector3().lerpVectors(pStart, pEnd, t);
            if (i > 0 && i < segs) {
                const env = Math.sin(t * Math.PI);
                p.x += (Math.random() - 0.5) * jitter * env;
                p.y += (Math.random() - 0.5) * jitter * 0.65 * env;
                p.z += (Math.random() - 0.5) * jitter * env;
            }
            pts.push(p);
        }
        const curve = new THREE.CatmullRomCurve3(pts);
        // 外層電漿光暈管 + 內核白熱雷柱
        const outerMat = new THREE.MeshBasicMaterial({
            color: new THREE.Color(colorHex).multiplyScalar(2.6),
            transparent: true, opacity: 0.78, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false
        });
        const coreMat = new THREE.MeshBasicMaterial({
            color: new THREE.Color(3.6, 4.0, 4.5),
            transparent: true, opacity: 1.0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false
        });
        g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 20, radius * 1.9, 6, false), outerMat));
        g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 20, radius * 0.65, 5, false), coreMat));

        // 隨機分叉小閃電
        if (withBranches) {
            for (let b = 0; b < 3; b++) {
                const idx = 3 + Math.floor(Math.random() * (segs - 5));
                const origin = pts[idx].clone();
                const tip = origin.clone().add(new THREE.Vector3((Math.random() - 0.5) * 1.8, -0.3 - Math.random() * 0.9, (Math.random() - 0.5) * 1.8));
                const mid = origin.clone().lerp(tip, 0.5).add(new THREE.Vector3((Math.random() - 0.5) * 0.5, (Math.random() - 0.5) * 0.3, (Math.random() - 0.5) * 0.5));
                const bCurve = new THREE.CatmullRomCurve3([origin, mid, tip]);
                g.add(new THREE.Mesh(new THREE.TubeGeometry(bCurve, 8, radius * 0.48, 4, false), outerMat));
            }
        }
        return g;
    }

    function createRuneCircle(wx, wy, radius, colorHex) {
        const mat = new THREE.MeshBasicMaterial({
            map: runeTex, color: new THREE.Color(colorHex).multiplyScalar(2.6),
            transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending,
            side: THREE.DoubleSide, depthWrite: false, toneMapped: false
        });
        const m = new THREE.Mesh(new THREE.PlaneGeometry(radius * 2, radius * 2), mat);
        m.rotation.x = -Math.PI / 2;
        m.position.set(wx, worldY(wx, wy) + 0.08, wy);
        return { m, mat };
    }

    // (1) 極道落雷：動態重繪閃爍的連鎖閃電弧 + 天降神雷 + 奧術雷電魔法陣 + 電火花
    function spawn3DLightning(wx, wy, player, monsters) {
        const group = new THREE.Group();
        const ty = worldY(wx, wy);
        const targetPos = new THREE.Vector3(wx, ty + 0.95, wy);
        const casterPos = new THREE.Vector3(player.x, worldY(player.x, player.y) + 1.3, player.y);

        // 找周圍最多 4 隻怪物進行連鎖電弧
        const chainTargets = [];
        for (const m of monsters) {
            if (m.hp <= 0 || chainTargets.length >= 4) continue;
            const d = Math.hypot(m.x - wx, m.y - wy);
            if (d > 0.25 && d <= 4.8) chainTargets.push(new THREE.Vector3(m.x, worldY(m.x, m.y) + 0.9, m.y));
        }

        const boltsHolder = new THREE.Group();
        group.add(boltsHolder);

        const rebuildBolts = () => {
            while (boltsHolder.children.length) boltsHolder.remove(boltsHolder.children[0]);
            const skyPos = new THREE.Vector3(wx + (Math.random() - 0.5) * 1.1, ty + 13.0, wy + (Math.random() - 0.5) * 1.1);
            boltsHolder.add(buildForkedBolt(skyPos, targetPos, 0.085, 1.45, 0x60a5fa, true));
            boltsHolder.add(buildForkedBolt(casterPos, targetPos, 0.055, 0.95, 0x38bdf8, true));
            for (const ct of chainTargets) {
                boltsHolder.add(buildForkedBolt(targetPos, ct, 0.042, 0.75, 0x7dd3fc, false));
            }
        };
        rebuildBolts();

        const { m: rune, mat: runeMat } = createRuneCircle(wx, wy, 2.35, 0x38bdf8);
        group.add(rune);

        const shockMat = new THREE.MeshBasicMaterial({ map: TEX.ring, color: new THREE.Color(0.8, 2.8, 4.5), transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
        const shock = new THREE.Mesh(new THREE.PlaneGeometry(3.8, 3.8), shockMat);
        shock.rotation.x = -Math.PI / 2; shock.position.set(wx, ty + 0.1, wy);
        group.add(shock);

        const flash = new THREE.PointLight(0x38bdf8, 24, 18, 1.7);
        flash.position.set(wx, ty + 2.0, wy);
        group.add(flash);

        scene.add(group);
        let flickAccum = 0;
        vfxList.push({
            group, life: 0.54, maxLife: 0.54,
            update(dt, p) {
                flickAccum += dt;
                if (flickAccum >= 0.065 && p < 0.78) { flickAccum = 0; rebuildBolts(); }
                const inv = 1 - p;
                flash.intensity = 24 * inv * inv;
                rune.rotation.z += dt * 3.2;
                rune.scale.setScalar(0.75 + p * 0.55);
                runeMat.opacity = inv * 0.95;
                shock.scale.setScalar(0.5 + p * 1.65);
                shockMat.opacity = inv;
                boltsHolder.traverse((c) => { if (c.material && c.material.transparent) c.material.opacity = inv; });
            }
        });
    }

    // (2) 龍捲風：三層氣流漩渦 + 4 條 3D 螺旋風帶 + 風系魔法陣 + 24 顆旋轉上升氣流粒子
    function spawn3DTornado(wx, wy) {
        const group = new THREE.Group();
        const ty = worldY(wx, wy);
        group.position.set(wx, ty, wy);

        const sw1 = TEX.swirl.clone(); sw1.needsUpdate = true;
        const sw2 = TEX.swirl.clone(); sw2.needsUpdate = true;
        const outerMat = new THREE.MeshBasicMaterial({ map: sw1, color: new THREE.Color(0.4, 2.6, 2.0), transparent: true, opacity: 0.72, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false, toneMapped: false });
        const innerMat = new THREE.MeshBasicMaterial({ map: sw2, color: new THREE.Color(1.4, 3.4, 2.8), transparent: true, opacity: 0.62, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false, toneMapped: false });

        const outerCone = new THREE.Mesh(new THREE.CylinderGeometry(3.1, 0.75, 5.8, 28, 1, true), outerMat);
        outerCone.position.y = 2.9;
        const innerCone = new THREE.Mesh(new THREE.CylinderGeometry(1.65, 0.35, 6.4, 20, 1, true), innerMat);
        innerCone.position.y = 3.2;
        group.add(outerCone, innerCone);

        // 4 條 3D 螺旋纏繞風帶
        const ribbonGroup = new THREE.Group();
        group.add(ribbonGroup);
        const ribbonMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.9, 3.2, 2.5), transparent: true, opacity: 0.75, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
        for (let r = 0; r < 4; r++) {
            const pts = [];
            const off = (r / 4) * TAU;
            for (let i = 0; i <= 22; i++) {
                const f = i / 22;
                const a = off + f * TAU * 2.2;
                const rad = lerp(0.55, 2.9, f);
                pts.push(new THREE.Vector3(Math.cos(a) * rad, f * 5.8, Math.sin(a) * rad));
            }
            ribbonGroup.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 28, 0.055, 5, false), ribbonMat));
        }

        // 旋轉上升氣流光點
        const debris = [];
        for (let i = 0; i < 24; i++) {
            const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.glow, color: new THREE.Color(0.8, 3.0, 2.2), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.9, toneMapped: false }));
            sp.scale.setScalar(0.22 + Math.random() * 0.24);
            group.add(sp);
            debris.push({ sp, angle: Math.random() * TAU, height: Math.random() * 5.2, spd: 6 + Math.random() * 6 });
        }

        const { m: rune, mat: runeMat } = createRuneCircle(0, 0, 3.2, 0x34d399);
        rune.position.set(0, 0.08, 0);
        group.add(rune);

        const light = new THREE.PointLight(0x34d399, 14, 15, 1.8);
        light.position.y = 2.4;
        group.add(light);

        scene.add(group);
        vfxList.push({
            group, life: 0.92, maxLife: 0.92,
            update(dt, p) {
                outerCone.rotation.y += dt * 11;
                innerCone.rotation.y -= dt * 17;
                ribbonGroup.rotation.y += dt * 13;
                rune.rotation.z -= dt * 4.5;
                sw1.offset.y -= dt * 2.4;
                sw2.offset.y -= dt * 3.8;
                for (const d of debris) {
                    d.angle += dt * d.spd;
                    d.height = (d.height + dt * 5.8) % 5.8;
                    const rad = lerp(0.7, 3.2, d.height / 5.8);
                    d.sp.position.set(Math.cos(d.angle) * rad, d.height, Math.sin(d.angle) * rad);
                }
                const s = 0.72 + Math.sin(p * Math.PI) * 0.45;
                group.scale.set(s, 1, s);
                const alpha = p < 0.18 ? p / 0.18 : (1 - p) / 0.82;
                outerMat.opacity = 0.72 * alpha;
                innerMat.opacity = 0.62 * alpha;
                ribbonMat.opacity = 0.75 * alpha;
                runeMat.opacity = 0.9 * alpha;
                light.intensity = 14 * alpha;
            }
        });
    }

    // (3) 火球術：熔岩核心火球 + 旋轉烈焰外殼 + 爆裂火焰魔法陣與衝擊穹頂
    function createFireballMesh() {
        const fg = new THREE.Group();
        fg.add(new THREE.Mesh(new THREE.SphereGeometry(0.28, 14, 12), new THREE.MeshBasicMaterial({ color: new THREE.Color(4.5, 2.4, 0.5), toneMapped: false })));
        const shell = new THREE.Mesh(new THREE.IcosahedronGeometry(0.42, 1), new THREE.MeshBasicMaterial({ color: new THREE.Color(3.4, 0.85, 0.15), wireframe: true, transparent: true, opacity: 0.75, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
        fg.add(shell);
        const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.glow, color: new THREE.Color(3.6, 1.3, 0.25), blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
        halo.scale.set(1.85, 1.85, 1);
        fg.add(halo);
        fg.add(new THREE.PointLight(0xfb923c, 13, 11, 1.8));
        fg.userData.shell = shell;
        return fg;
    }

    function spawn3DFireExplosion(wx, wy) {
        const group = new THREE.Group();
        const ty = worldY(wx, wy);
        group.position.set(wx, ty + 0.2, wy);

        // 熾白內核 + 熔岩衝擊穹頂
        const coreMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(4.2, 2.1, 0.45), transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
        const core = new THREE.Mesh(new THREE.SphereGeometry(0.65, 18, 14), coreMat);
        core.position.y = 0.45;
        group.add(core);

        const domeMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(3.2, 0.7, 0.12), transparent: true, opacity: 0.65, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false, toneMapped: false });
        const dome = new THREE.Mesh(new THREE.SphereGeometry(0.95, 16, 12, 0, TAU, 0, Math.PI * 0.55), domeMat);
        group.add(dome);

        const { m: rune, mat: runeMat } = createRuneCircle(0, 0, 2.75, 0xf97316);
        rune.position.set(0, 0.06, 0);
        group.add(rune);

        const ringMat = new THREE.MeshBasicMaterial({ map: TEX.ring, color: new THREE.Color(3.6, 1.2, 0.2), transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
        const ring = new THREE.Mesh(new THREE.PlaneGeometry(4.8, 4.8), ringMat);
        ring.rotation.x = -Math.PI / 2; ring.position.y = 0.08;
        group.add(ring);

        // 32 顆爆裂火星飛散
        const sparks = [];
        for (let i = 0; i < 32; i++) {
            const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.glow, color: new THREE.Color(3.8, 1.4 + Math.random() * 1.2, 0.25), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 1, toneMapped: false }));
            sp.scale.setScalar(0.18 + Math.random() * 0.26);
            group.add(sp);
            const a = Math.random() * TAU, spd = 2.5 + Math.random() * 5.2;
            sparks.push({ sp, vx: Math.cos(a) * spd, vy: 2.0 + Math.random() * 4.5, vz: Math.sin(a) * spd });
        }

        const light = new THREE.PointLight(0xf97316, 22, 16, 1.7);
        light.position.y = 1.2;
        group.add(light);

        scene.add(group);
        vfxList.push({
            group, life: 0.68, maxLife: 0.68,
            update(dt, p) {
                const inv = 1 - p;
                core.scale.setScalar(0.55 + p * 2.8);
                coreMat.opacity = inv * inv;
                dome.scale.setScalar(0.6 + p * 3.1);
                domeMat.opacity = inv * 0.65;
                ring.scale.setScalar(0.35 + p * 1.45);
                ringMat.opacity = inv * 0.9;
                rune.rotation.z += dt * 2.5;
                runeMat.opacity = inv * 0.9;
                light.intensity = 22 * inv * inv;
                for (const s of sparks) {
                    s.vy -= 9.5 * dt;
                    s.sp.position.x += s.vx * dt;
                    s.sp.position.y = Math.max(0.05, s.sp.position.y + s.vy * dt);
                    s.sp.position.z += s.vz * dt;
                    s.sp.material.opacity = inv;
                }
            }
        });
    }

    return { spawn3DLightning, spawn3DTornado, createFireballMesh, spawn3DFireExplosion };
}
