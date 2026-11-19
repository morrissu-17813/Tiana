/**
 * Tiana 3D — AAA 環境、自然天氣、日夜循環與自然魔法特效模組
 * - 高效能多層松針枝葉樹 (優化面數與 Alpha Overdraw)
 * - 柔和自然光影日夜循環 (清晨 / 白天 / 傍晚 / 夜晚) + 不定時自然晴天／多雲／下雨 (含 3D 雨絲)
 * - 純自然寫實元素魔法特效 (無魔法陣！還原截圖中的自然連鎖雷電、狂風、火焰)
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
 * 1. 高效寫實松針枝葉貼圖與樹幹 (優化效能，不卡頓)
 * ===================================================================== */
export function createPineTextures() {
    const S = 256, rnd = makeRng(707);
    const [c, g] = makeCanvas(S);
    g.clearRect(0, 0, S, S);

    g.strokeStyle = '#362417';
    g.lineWidth = 5;
    g.lineCap = 'round';
    g.beginPath(); g.moveTo(S * 0.5, S * 0.96); g.lineTo(S * 0.5, S * 0.14); g.stroke();

    const drawNeedleCluster = (bx, by, dirAngle, len, spread) => {
        const subCount = 22;
        for (let i = 0; i < subCount; i++) {
            const f = i / subCount;
            const px = bx + Math.cos(dirAngle) * len * f;
            const py = by + Math.sin(dirAngle) * len * f;
            for (const side of [-1, 1]) {
                const a = dirAngle + side * (0.48 + rnd() * spread);
                const nl = (14 + rnd() * 20) * (1 - f * 0.42);
                const hue = 98 + rnd() * 24;
                const sat = 30 + rnd() * 18;
                const lit = 14 + f * 13 + rnd() * 10;
                g.strokeStyle = `hsl(${hue},${sat}%,${lit}%)`;
                g.lineWidth = 2.4 + rnd() * 1.2;
                g.beginPath();
                g.moveTo(px, py);
                g.lineTo(px + Math.cos(a) * nl, py + Math.sin(a) * nl);
                g.stroke();
            }
        }
    };

    const branches = [
        [0.86, -0.78, 90], [0.86, -2.36, 90],
        [0.71, -0.82, 95], [0.71, -2.32, 95],
        [0.56, -0.88, 84], [0.56, -2.26, 84],
        [0.42, -0.96, 68], [0.42, -2.18, 68],
        [0.28, -1.08, 48], [0.28, -2.06, 48]
    ];
    for (const [yf, ang, len] of branches) {
        const sy = S * yf;
        g.strokeStyle = '#3b2819'; g.lineWidth = 2.5;
        g.beginPath(); g.moveTo(S * 0.5, sy); g.lineTo(S * 0.5 + Math.cos(ang) * len * 0.7, sy + Math.sin(ang) * len * 0.7); g.stroke();
        drawNeedleCluster(S * 0.5, sy, ang, len, 0.35);
    }
    drawNeedleCluster(S * 0.5, S * 0.44, -Math.PI / 2, 102, 0.42);

    const frondMap = new THREE.CanvasTexture(c);
    frondMap.colorSpace = THREE.SRGBColorSpace;

    const [bc, bg] = makeCanvas(128, 256);
    bg.fillStyle = '#352418'; bg.fillRect(0, 0, 128, 256);
    for (let i = 0; i < 320; i++) {
        const x = rnd() * 128, y = rnd() * 256, h = 14 + rnd() * 42;
        bg.fillStyle = rnd() < 0.55 ? 'rgba(20,12,8,0.45)' : 'rgba(92,68,46,0.28)';
        bg.fillRect(x, y, 2 + rnd() * 4, h);
    }
    const barkMap = new THREE.CanvasTexture(bc);
    barkMap.wrapS = barkMap.wrapT = THREE.RepeatWrapping;
    barkMap.colorSpace = THREE.SRGBColorSpace;

    return { frondMap, barkMap };
}

/**
 * 高效能寫實松樹 (6 層共 22 片立體下垂松枝卡面 — 比原本減半面數，大幅提升 FPS！)
 */
export function buildRealisticPineGeo(seed) {
    const rnd = makeRng(seed);
    const fronds = [];
    const layers = 6;

    for (let li = 0; li < layers; li++) {
        const f = li / (layers - 1);
        const yBase = 0.95 + f * 3.1;
        const radius = lerp(1.38, 0.3, Math.pow(f, 0.9));
        const count = Math.max(3, Math.round(lerp(5, 3, f)));
        const angleOff = li * 1.25 + rnd() * 0.5;

        for (let bi = 0; bi < count; bi++) {
            const az = angleOff + (bi / count) * TAU + (rnd() - 0.5) * 0.25;
            const len = radius * (0.9 + rnd() * 0.26);
            const wid = len * (0.88 + rnd() * 0.2);

            const card = new THREE.PlaneGeometry(wid, len, 1, 2);
            const p = card.attributes.position;
            for (let k = 0; k < p.count; k++) {
                const vy = p.getY(k);
                const t = (vy + len / 2) / len;
                p.setZ(k, Math.sin(t * Math.PI) * 0.14 - t * t * 0.26);
            }
            card.translate(0, len * 0.45, 0);
            card.rotateX(lerp(1.2, 0.54, f) + (rnd() - 0.5) * 0.16);
            card.rotateY(az);
            card.translate(0, yBase + (rnd() - 0.5) * 0.14, 0);

            const cols = [];
            const cp = card.attributes.position;
            for (let k = 0; k < cp.count; k++) {
                const dist = Math.hypot(cp.getX(k), cp.getZ(k));
                const hNorm = clamp((cp.getY(k) - 0.8) / 3.6, 0, 1);
                const shade = clamp(0.42 + (dist / 1.5) * 0.4 + hNorm * 0.26, 0.34, 1.08);
                cols.push(shade * 0.88, shade, shade * 0.84);
            }
            card.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
            card.computeVertexNormals();
            fronds.push(card);
        }
    }

    const leaves = mergeGeometries(fronds);
    const trunk = new THREE.CylinderGeometry(0.055, 0.2, 3.5, 7, 3);
    const tp = trunk.attributes.position;
    for (let k = 0; k < tp.count; k++) {
        if (tp.getY(k) < -1.2) { tp.setX(k, tp.getX(k) * 1.35); tp.setZ(k, tp.getZ(k) * 1.35); }
    }
    trunk.translate(0, 1.75, 0);
    trunk.computeVertexNormals();
    return { leaves, trunk };
}

export function genCobbleRoughnessTex(size = 256) {
    const rnd = makeRng(808);
    const [c, g] = makeCanvas(size);
    g.fillStyle = '#c8c8c8'; g.fillRect(0, 0, size, size);
    for (let i = 0; i < 40; i++) {
        const x = rnd() * size, y = rnd() * size, r = 10 + rnd() * 32;
        const gr = g.createRadialGradient(x, y, 0, x, y, r);
        const dark = 52 + Math.floor(rnd() * 68);
        gr.addColorStop(0, `rgba(${dark},${dark},${dark},0.6)`);
        gr.addColorStop(1, 'rgba(200,200,200,0)');
        g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
    }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
}

/* =====================================================================
 * 2. 柔和日夜循環 (早/中/晚) + 自然隨機天氣系統 (晴天 / 多雲 / 下雨 3D 雨絲)
 * ===================================================================== */
const TIME_PRESETS = {
    morning: { hour: 7.2,  sky: 0x5c7aa3, fog: 0x6783a6, fogDensity: 0.015, sunCol: 0xffe0b8, sunInt: 1.48, hemiSky: 0xaac6ee, hemiGnd: 0x3b382d, hemiInt: 0.72, fillCol: 0x6d93c8, fillInt: 0.4,  exp: 0.98, bloom: 0.28, torchMult: 0.55, sunOff: [28, 22, 16] },
    day:     { hour: 12.5, sky: 0x688fb8, fog: 0x7398bd, fogDensity: 0.012, sunCol: 0xfff2dc, sunInt: 1.78, hemiSky: 0xb8d4f5, hemiGnd: 0x454a36, hemiInt: 0.82, fillCol: 0x7da4d6, fillInt: 0.42, exp: 1.0,  bloom: 0.22, torchMult: 0.25, sunOff: [16, 40, 14] },
    dusk:    { hour: 17.5, sky: 0x1a2133, fog: 0x1d2538, fogDensity: 0.019, sunCol: 0xffba80, sunInt: 1.45, hemiSky: 0x748fc4, hemiGnd: 0x2c241d, hemiInt: 0.6,  fillCol: 0x496ca8, fillInt: 0.45, exp: 0.96, bloom: 0.42, torchMult: 1.0,  sunOff: [26, 20, 18] },
    night:   { hour: 23.0, sky: 0x080c16, fog: 0x0a101d, fogDensity: 0.024, sunCol: 0x6a90df, sunInt: 0.76, hemiSky: 0x263864, hemiGnd: 0x101319, hemiInt: 0.44, fillCol: 0x2a457c, fillInt: 0.36, exp: 0.92, bloom: 0.52, torchMult: 1.45, sunOff: [-22, 28, 18] }
};

const WEATHERS = [
    { key: 'sunny',  label: '晴天', icon: '☀️', fogAdd: 0.0,   dim: 1.0,  rainAlpha: 0 },
    { key: 'cloudy', label: '多雲', icon: '⛅', fogAdd: 0.005, dim: 0.84, rainAlpha: 0 },
    { key: 'rain',   label: '雨天', icon: '🌧️', fogAdd: 0.010, dim: 0.68, rainAlpha: 0.48 }
];

export function createDayNightController({ scene, renderer, sun, hemi, fill, bloomPass, camTarget }) {
    const modes = ['auto', 'morning', 'day', 'dusk', 'night'];
    let modeIdx = 0; // 預設自動自然日夜循環
    let simHour = 16.8;
    let weatherIdx = 0;
    let weatherTimer = 38;
    let manualWeatherLock = false;

    const curSky = new THREE.Color(TIME_PRESETS.dusk.sky);
    const curFog = new THREE.Color(TIME_PRESETS.dusk.fog);
    const curSun = new THREE.Color(TIME_PRESETS.dusk.sunCol);
    const curHemiSky = new THREE.Color(TIME_PRESETS.dusk.hemiSky);
    const curHemiGnd = new THREE.Color(TIME_PRESETS.dusk.hemiGnd);
    const curFill = new THREE.Color(TIME_PRESETS.dusk.fillCol);
    const sunOffset = new THREE.Vector3(24, 24, 18);
    let torchMult = 1.0;

    // 輕量化 3D 下雨雨絲系統 (單一 Draw Call，效能零負擔)
    const RAIN_COUNT = 340;
    const rainPos = new Float32Array(RAIN_COUNT * 6);
    const rainVel = new Float32Array(RAIN_COUNT);
    for (let i = 0; i < RAIN_COUNT; i++) {
        const rx = (Math.random() - 0.5) * 34;
        const ry = Math.random() * 18;
        const rz = (Math.random() - 0.5) * 34;
        rainPos[i * 6] = rx; rainPos[i * 6 + 1] = ry; rainPos[i * 6 + 2] = rz;
        rainPos[i * 6 + 3] = rx - 0.14; rainPos[i * 6 + 4] = ry - 0.72; rainPos[i * 6 + 5] = rz - 0.08;
        rainVel[i] = 16 + Math.random() * 6;
    }
    const rainGeo = new THREE.BufferGeometry();
    rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
    const rainMat = new THREE.LineBasicMaterial({ color: 0x9ec5e8, transparent: true, opacity: 0, depthWrite: false });
    const rainLines = new THREE.LineSegments(rainGeo, rainMat);
    rainLines.frustumCulled = false;
    scene.add(rainLines);

    function blendPreset(A, B, t) {
        return {
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
        };
    }

    function getPeriodInfo(h) {
        if (h >= 5 && h < 9) return { icon: '🌅', text: '清晨' };
        if (h >= 9 && h < 12) return { icon: '☀️', text: '上午' };
        if (h >= 12 && h < 16.5) return { icon: '🌤️', text: '中午' };
        if (h >= 16.5 && h < 19.5) return { icon: '🌇', text: '傍晚' };
        return { icon: '🌙', text: '夜晚' };
    }

    function getTargetState() {
        const m = modes[modeIdx];
        if (m !== 'auto') return TIME_PRESETS[m];
        const h = ((simHour % 24) + 24) % 24;
        if (h >= 5 && h < 8) return blendPreset(TIME_PRESETS.night, TIME_PRESETS.morning, (h - 5) / 3);
        if (h >= 8 && h < 11.5) return blendPreset(TIME_PRESETS.morning, TIME_PRESETS.day, (h - 8) / 3.5);
        if (h >= 11.5 && h < 16) return TIME_PRESETS.day;
        if (h >= 16 && h < 18.5) return blendPreset(TIME_PRESETS.day, TIME_PRESETS.dusk, (h - 16) / 2.5);
        if (h >= 18.5 && h < 21) return blendPreset(TIME_PRESETS.dusk, TIME_PRESETS.night, (h - 18.5) / 2.5);
        return TIME_PRESETS.night;
    }

    let hudAccum = 1;
    function updateHud() {
        const clockEl = document.getElementById('worldClockText');
        const labelEl = document.getElementById('timeModeLabel');
        const weatherEl = document.getElementById('weatherModeLabel');
        const hh = Math.floor(simHour) % 24;
        const mm = Math.floor((simHour % 1) * 60);
        const period = getPeriodInfo(simHour);
        if (clockEl) clockEl.textContent = `${period.text} ${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
        if (labelEl) {
            const m = modes[modeIdx];
            labelEl.textContent = m === 'auto' ? `${period.icon}自動` : `${period.icon}固定`;
        }
        if (weatherEl) {
            const w = WEATHERS[weatherIdx];
            weatherEl.textContent = `${w.icon}${w.label}`;
        }
    }

    function cycleMode() {
        modeIdx = (modeIdx + 1) % modes.length;
        const m = modes[modeIdx];
        if (m !== 'auto') simHour = TIME_PRESETS[m].hour;
        updateHud();
    }

    function cycleWeather() {
        weatherIdx = (weatherIdx + 1) % WEATHERS.length;
        manualWeatherLock = true;
        weatherTimer = 55;
        updateHud();
    }

    function update(dt) {
        if (modes[modeIdx] === 'auto') {
            simHour = (simHour + dt * 0.22) % 24; // 自然緩慢流動，約 109 秒完整早中晚
        }

        // 不定時自然晴天／多雲／下雨變化
        weatherTimer -= dt;
        if (weatherTimer <= 0) {
            manualWeatherLock = false;
            weatherTimer = 35 + Math.random() * 35;
            const r = Math.random();
            weatherIdx = r < 0.5 ? 0 : (r < 0.78 ? 1 : 2);
            updateHud();
        }

        const w = WEATHERS[weatherIdx];
        const target = getTargetState();
        const k = clamp(dt * 2.2, 0, 1);

        const targetSky = new THREE.Color(target.sky).multiplyScalar(w.dim);
        const targetFog = new THREE.Color(target.fog).multiplyScalar(w.dim);
        curSky.lerp(targetSky, k);
        curFog.lerp(targetFog, k);
        curSun.lerp(new THREE.Color(target.sunCol), k);
        curHemiSky.lerp(new THREE.Color(target.hemiSky), k);
        curHemiGnd.lerp(new THREE.Color(target.hemiGnd), k);
        curFill.lerp(new THREE.Color(target.fillCol), k);

        scene.background.copy(curSky);
        scene.fog.color.copy(curFog);
        scene.fog.density = lerp(scene.fog.density, target.fogDensity + w.fogAdd, k);
        sun.color.copy(curSun);
        sun.intensity = lerp(sun.intensity, target.sunInt * w.dim, k);
        hemi.color.copy(curHemiSky);
        hemi.groundColor.copy(curHemiGnd);
        hemi.intensity = lerp(hemi.intensity, target.hemiInt, k);
        fill.color.copy(curFill);
        fill.intensity = lerp(fill.intensity, target.fillInt, k);
        renderer.toneMappingExposure = lerp(renderer.toneMappingExposure, target.exp, k);
        bloomPass.strength = lerp(bloomPass.strength, target.bloom, k);
        torchMult = lerp(torchMult, target.torchMult, k);
        sunOffset.lerp(new THREE.Vector3(...target.sunOff), k);

        // 更新 3D 雨絲
        rainMat.opacity = lerp(rainMat.opacity, w.rainAlpha, clamp(dt * 2.5, 0, 1));
        rainLines.visible = rainMat.opacity > 0.02;
        if (rainLines.visible) {
            rainLines.position.set(camTarget.x, camTarget.y, camTarget.z);
            const pos = rainGeo.attributes.position.array;
            for (let i = 0; i < RAIN_COUNT; i++) {
                const idx = i * 6;
                const dy = rainVel[i] * dt;
                pos[idx + 1] -= dy;
                pos[idx + 4] -= dy;
                if (pos[idx + 1] < -2) {
                    const rx = (Math.random() - 0.5) * 34;
                    const ry = 15 + Math.random() * 4;
                    const rz = (Math.random() - 0.5) * 34;
                    pos[idx] = rx; pos[idx + 1] = ry; pos[idx + 2] = rz;
                    pos[idx + 3] = rx - 0.14; pos[idx + 4] = ry - 0.72; pos[idx + 5] = rz - 0.08;
                }
            }
            rainGeo.attributes.position.needsUpdate = true;
        }

        hudAccum += dt;
        if (hudAccum >= 0.5) { hudAccum = 0; updateHud(); }
    }

    updateHud();
    return { cycleMode, cycleWeather, update, getSunOffset: () => sunOffset, getTorchMult: () => torchMult };
}

/* =====================================================================
 * 3. 純自然寫實三大魔法 VFX 引擎 (無魔法陣！還原截圖中的自然連鎖雷電與元素特效)
 * ===================================================================== */
export function createSpellVfxEngine({ scene, TEX, worldY, vfxList }) {
    function buildNaturalBolt(pStart, pEnd, radius, jitter, colorHex, withBranches = true) {
        const g = new THREE.Group();
        const pts = [];
        const segs = 11;
        for (let i = 0; i <= segs; i++) {
            const t = i / segs;
            const p = new THREE.Vector3().lerpVectors(pStart, pEnd, t);
            if (i > 0 && i < segs) {
                const env = Math.sin(t * Math.PI);
                p.x += (Math.random() - 0.5) * jitter * env;
                p.y += (Math.random() - 0.5) * jitter * 0.55 * env;
                p.z += (Math.random() - 0.5) * jitter * env;
            }
            pts.push(p);
        }
        const curve = new THREE.CatmullRomCurve3(pts);
        const outerMat = new THREE.MeshBasicMaterial({
            color: new THREE.Color(colorHex).multiplyScalar(2.4),
            transparent: true, opacity: 0.72, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false
        });
        const coreMat = new THREE.MeshBasicMaterial({
            color: new THREE.Color(3.5, 4.0, 4.5),
            transparent: true, opacity: 1.0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false
        });
        g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 16, radius * 1.75, 5, false), outerMat));
        g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 16, radius * 0.6, 4, false), coreMat));

        if (withBranches) {
            for (let b = 0; b < 3; b++) {
                const idx = 2 + Math.floor(Math.random() * (segs - 4));
                const origin = pts[idx].clone();
                const tip = origin.clone().add(new THREE.Vector3((Math.random() - 0.5) * 1.7, (Math.random() - 0.6) * 0.9, (Math.random() - 0.5) * 1.7));
                const mid = origin.clone().lerp(tip, 0.5).add(new THREE.Vector3((Math.random() - 0.5) * 0.45, (Math.random() - 0.5) * 0.3, (Math.random() - 0.5) * 0.45));
                g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([origin, mid, tip]), 6, radius * 0.45, 4, false), outerMat));
            }
        }
        return g;
    }

    // (1) 極道落雷：自然分叉連鎖電弧 (還原截圖：從劍尖／地面自然竄出藍白閃電劈向狼人群，零魔法陣！)
    function spawn3DLightning(wx, wy, player, monsters) {
        const group = new THREE.Group();
        const ty = worldY(wx, wy);
        const targetPos = new THREE.Vector3(wx, ty + 0.85, wy);
        const casterPos = new THREE.Vector3(player.x, worldY(player.x, player.y) + 1.25, player.y);

        const chainTargets = [];
        for (const m of monsters) {
            if (m.hp <= 0 || chainTargets.length >= 4) continue;
            const d = Math.hypot(m.x - wx, m.y - wy);
            if (d > 0.25 && d <= 4.8) chainTargets.push(new THREE.Vector3(m.x, worldY(m.x, m.y) + 0.85, m.y));
        }

        const boltsHolder = new THREE.Group();
        group.add(boltsHolder);

        const rebuildBolts = () => {
            while (boltsHolder.children.length) boltsHolder.remove(boltsHolder.children[0]);
            // 主角發出自然強烈主電弧劈向目標
            boltsHolder.add(buildNaturalBolt(casterPos, targetPos, 0.068, 1.05, 0x38bdf8, true));
            boltsHolder.add(buildNaturalBolt(casterPos, targetPos, 0.032, 1.45, 0x93c5fd, false));
            // 高空落雷補擊
            const skyPos = new THREE.Vector3(wx + (Math.random() - 0.5) * 1.2, ty + 11.5, wy + (Math.random() - 0.5) * 1.2);
            boltsHolder.add(buildNaturalBolt(skyPos, targetPos, 0.06, 1.35, 0x60a5fa, true));
            // 自然連鎖跳躍到附近怪物
            for (const ct of chainTargets) {
                boltsHolder.add(buildNaturalBolt(targetPos, ct, 0.044, 0.85, 0x7dd3fc, true));
            }
        };
        rebuildBolts();

        // 落地點自然濺射電火花 (18 顆)
        const sparks = [];
        for (let i = 0; i < 18; i++) {
            const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.glow, color: new THREE.Color(1.4, 3.0, 4.5), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 1, toneMapped: false }));
            sp.scale.setScalar(0.14 + Math.random() * 0.16);
            sp.position.copy(targetPos);
            group.add(sp);
            const a = Math.random() * TAU, spd = 2.0 + Math.random() * 4.5;
            sparks.push({ sp, vx: Math.cos(a) * spd, vy: 1.5 + Math.random() * 3.5, vz: Math.sin(a) * spd });
        }

        const flash = new THREE.PointLight(0x38bdf8, 18, 15, 1.8);
        flash.position.set(wx, ty + 1.8, wy);
        group.add(flash);

        scene.add(group);
        let flickAccum = 0;
        vfxList.push({
            group, life: 0.5, maxLife: 0.5,
            update(dt, p) {
                flickAccum += dt;
                if (flickAccum >= 0.065 && p < 0.78) { flickAccum = 0; rebuildBolts(); }
                const inv = 1 - p;
                flash.intensity = 18 * inv * inv;
                boltsHolder.traverse((c) => { if (c.material && c.material.transparent) c.material.opacity = inv; });
                for (const s of sparks) {
                    s.vy -= 9.0 * dt;
                    s.sp.position.x += s.vx * dt;
                    s.sp.position.y = Math.max(ty + 0.05, s.sp.position.y + s.vy * dt);
                    s.sp.position.z += s.vz * dt;
                    s.sp.material.opacity = inv;
                }
            }
        });
    }

    // (2) 龍捲風：自然狂風漏斗 + 螺旋氣流帶 + 捲起風塵粒子 (無魔法陣)
    function spawn3DTornado(wx, wy) {
        const group = new THREE.Group();
        group.position.set(wx, worldY(wx, wy), wy);

        const sw1 = TEX.swirl.clone(); sw1.needsUpdate = true;
        const outerMat = new THREE.MeshBasicMaterial({ map: sw1, color: new THREE.Color(0.7, 1.6, 1.5), transparent: true, opacity: 0.62, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false, toneMapped: false });
        const innerMat = new THREE.MeshBasicMaterial({ map: sw1, color: new THREE.Color(1.4, 2.4, 2.2), transparent: true, opacity: 0.48, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false, toneMapped: false });

        const outerCone = new THREE.Mesh(new THREE.CylinderGeometry(2.9, 0.65, 5.4, 20, 1, true), outerMat);
        outerCone.position.y = 2.7;
        const innerCone = new THREE.Mesh(new THREE.CylinderGeometry(1.45, 0.3, 6.0, 16, 1, true), innerMat);
        innerCone.position.y = 3.0;
        group.add(outerCone, innerCone);

        const ribbonGroup = new THREE.Group();
        group.add(ribbonGroup);
        const ribbonMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.0, 2.2, 2.0), transparent: true, opacity: 0.65, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
        for (let r = 0; r < 3; r++) {
            const pts = [];
            const off = (r / 3) * TAU;
            for (let i = 0; i <= 18; i++) {
                const f = i / 18;
                const a = off + f * TAU * 2.1;
                const rad = lerp(0.5, 2.7, f);
                pts.push(new THREE.Vector3(Math.cos(a) * rad, f * 5.4, Math.sin(a) * rad));
            }
            ribbonGroup.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 22, 0.048, 4, false), ribbonMat));
        }

        const debris = [];
        for (let i = 0; i < 18; i++) {
            const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.glow, color: new THREE.Color(1.1, 2.2, 1.9), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.8, toneMapped: false }));
            sp.scale.setScalar(0.18 + Math.random() * 0.22);
            group.add(sp);
            debris.push({ sp, angle: Math.random() * TAU, height: Math.random() * 5.0, spd: 6.5 + Math.random() * 5.5 });
        }

        const light = new THREE.PointLight(0x6ee7b7, 8, 12, 2);
        light.position.y = 2.2;
        group.add(light);

        scene.add(group);
        vfxList.push({
            group, life: 0.88, maxLife: 0.88,
            update(dt, p) {
                outerCone.rotation.y += dt * 11;
                innerCone.rotation.y -= dt * 16;
                ribbonGroup.rotation.y += dt * 13;
                sw1.offset.y -= dt * 2.6;
                for (const d of debris) {
                    d.angle += dt * d.spd;
                    d.height = (d.height + dt * 5.6) % 5.4;
                    const rad = lerp(0.65, 3.0, d.height / 5.4);
                    d.sp.position.set(Math.cos(d.angle) * rad, d.height, Math.sin(d.angle) * rad);
                }
                const s = 0.72 + Math.sin(p * Math.PI) * 0.42;
                group.scale.set(s, 1, s);
                const alpha = p < 0.18 ? p / 0.18 : (1 - p) / 0.82;
                outerMat.opacity = 0.62 * alpha;
                innerMat.opacity = 0.48 * alpha;
                ribbonMat.opacity = 0.65 * alpha;
                light.intensity = 8 * alpha;
            }
        });
    }

    // (3) 火球術：自然烈焰火球 + 爆裂火團與火星 (無魔法陣)
    function createFireballMesh() {
        const fg = new THREE.Group();
        fg.add(new THREE.Mesh(new THREE.SphereGeometry(0.26, 12, 10), new THREE.MeshBasicMaterial({ color: new THREE.Color(4.2, 2.1, 0.45), toneMapped: false })));
        const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.glow, color: new THREE.Color(3.4, 1.2, 0.2), blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
        halo.scale.set(1.5, 1.5, 1);
        fg.add(halo);
        fg.add(new THREE.PointLight(0xfb923c, 10, 10, 1.8));
        return fg;
    }

    function spawn3DFireExplosion(wx, wy) {
        const group = new THREE.Group();
        const ty = worldY(wx, wy);
        group.position.set(wx, ty + 0.25, wy);

        const coreMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(4.0, 1.9, 0.4), transparent: true, opacity: 0.92, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
        const core = new THREE.Mesh(new THREE.SphereGeometry(0.62, 14, 12), coreMat);
        core.position.y = 0.4;
        group.add(core);

        const domeMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(3.0, 0.65, 0.12), transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false, toneMapped: false });
        const dome = new THREE.Mesh(new THREE.SphereGeometry(0.9, 14, 10, 0, TAU, 0, Math.PI * 0.55), domeMat);
        group.add(dome);

        const sparks = [];
        for (let i = 0; i < 26; i++) {
            const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.glow, color: new THREE.Color(3.8, 1.3 + Math.random() * 1.2, 0.25), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 1, toneMapped: false }));
            sp.scale.setScalar(0.18 + Math.random() * 0.25);
            group.add(sp);
            const a = Math.random() * TAU, spd = 2.4 + Math.random() * 5.0;
            sparks.push({ sp, vx: Math.cos(a) * spd, vy: 2.0 + Math.random() * 4.2, vz: Math.sin(a) * spd });
        }

        const light = new THREE.PointLight(0xf97316, 18, 14, 1.8);
        light.position.y = 1.1;
        group.add(light);

        scene.add(group);
        vfxList.push({
            group, life: 0.62, maxLife: 0.62,
            update(dt, p) {
                const inv = 1 - p;
                core.scale.setScalar(0.55 + p * 2.6);
                coreMat.opacity = inv * inv;
                dome.scale.setScalar(0.55 + p * 2.9);
                domeMat.opacity = inv * 0.55;
                light.intensity = 18 * inv * inv;
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

    // (4) 法師技能 — 烈焰術 (直線範圍烈焰柱浪)
    function spawnFlameLine3D(sx, sy, dx, dy) {
        const group = new THREE.Group();
        const len = Math.hypot(dx, dy) || 1;
        const nx = dx / len, ny = dy / len;
        const pillars = [];
        for (let i = 1; i <= 7; i++) {
            const px = sx + nx * (i * 1.05), py = sy + ny * (i * 1.05);
            const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(3.6, 1.2 + (i % 2) * 0.5, 0.2), transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
            const cone = new THREE.Mesh(new THREE.ConeGeometry(0.62, 2.2, 10), mat);
            cone.position.set(px, worldY(px, py) + 0.9, py);
            cone.scale.set(0.2, 0.1, 0.2);
            group.add(cone);
            pillars.push({ cone, mat, delay: (i - 1) * 0.045 });
        }
        const light = new THREE.PointLight(0xf97316, 14, 14, 1.8);
        light.position.set(sx + nx * 3.5, worldY(sx, sy) + 1.6, sy + ny * 3.5);
        group.add(light);
        scene.add(group);
        vfxList.push({
            group, life: 0.72, maxLife: 0.72,
            update(dt, p) {
                const elapsed = p * 0.72;
                light.intensity = 14 * (1 - p);
                for (const pl of pillars) {
                    const lp = clamp((elapsed - pl.delay) / 0.36, 0, 1);
                    const s = Math.sin(lp * Math.PI);
                    pl.cone.scale.set(0.4 + s * 0.9, 0.2 + s * 1.25, 0.4 + s * 0.9);
                    pl.cone.rotation.y += dt * 8;
                    pl.mat.opacity = s * 0.92;
                }
            }
        });
    }

    // (5) 法師技能 — 冰錐 (單體急凍冰槍 + 冰晶爆裂)
    function spawnIceLance3D(sx, sy, tx, ty) {
        const group = new THREE.Group();
        const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.8, 3.0, 4.4), transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
        const spear = new THREE.Mesh(new THREE.ConeGeometry(0.18, 1.55, 6), mat);
        spear.rotation.x = Math.PI / 2;
        const holder = new THREE.Group();
        holder.add(spear);
        group.add(holder);
        const light = new THREE.PointLight(0x38bdf8, 12, 10, 2);
        holder.add(light);
        scene.add(group);
        vfxList.push({
            group, life: 0.42, maxLife: 0.42,
            update(dt, p) {
                const f = Math.min(1, p * 1.8);
                const cx = lerp(sx, tx, f), cy = lerp(sy, ty, f);
                holder.position.set(cx, worldY(cx, cy) + 1.2, cy);
                holder.lookAt(tx, worldY(tx, ty) + 1.1, ty);
                if (p > 0.55) {
                    const bp = (p - 0.55) / 0.45;
                    spear.scale.setScalar(1 + bp * 2.2);
                    mat.opacity = 1 - bp;
                    light.intensity = 12 * (1 - bp);
                }
            }
        });
    }

    // (6) 法師技能 — 治癒術 (柔和翠綠生命光波)
    function spawnHealAura3D(wx, wy) {
        const group = new THREE.Group();
        group.position.set(wx, worldY(wx, wy), wy);
        const sparks = [];
        for (let i = 0; i < 16; i++) {
            const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.glow, color: new THREE.Color(0.6, 3.2, 1.6), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.9, toneMapped: false }));
            sp.scale.setScalar(0.22 + Math.random() * 0.16);
            group.add(sp);
            sparks.push({ sp, a: (i / 16) * TAU, r: 0.45 + Math.random() * 0.65, y: Math.random() * 0.4 });
        }
        const light = new THREE.PointLight(0x34d399, 10, 9, 2);
        light.position.y = 1.4;
        group.add(light);
        scene.add(group);
        vfxList.push({
            group, life: 0.85, maxLife: 0.85,
            update(dt, p) {
                const inv = 1 - p;
                light.intensity = 10 * inv;
                for (const s of sparks) {
                    s.a += dt * 3.5;
                    s.y += dt * 2.6;
                    s.sp.position.set(Math.cos(s.a) * s.r, s.y, Math.sin(s.a) * s.r);
                    s.sp.material.opacity = inv;
                }
            }
        });
    }

    // (7) 法師技能 — 落石術 (天降巨岩重擊 + 暈眩震波)
    function spawnRockFall3D(wx, wy) {
        const group = new THREE.Group();
        const ty = worldY(wx, wy);
        const rockMat = new THREE.MeshStandardMaterial({ color: 0x57534e, roughness: 0.95, flatShading: true });
        const rocks = [];
        for (let i = 0; i < 6; i++) {
            const r = new THREE.Mesh(new THREE.DodecahedronGeometry(0.45 + Math.random() * 0.35, 0), rockMat);
            const ox = (Math.random() - 0.5) * 3.4, oz = (Math.random() - 0.5) * 3.4;
            const sy = ty + 7.5 + Math.random() * 3.5;
            r.position.set(wx + ox, sy, wy + oz);
            group.add(r);
            rocks.push({ r, sy, targetY: ty + 0.35, rot: 3 + Math.random() * 5 });
        }
        const shockMat = new THREE.MeshBasicMaterial({ map: TEX.ring, color: new THREE.Color(2.4, 1.7, 0.8), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
        const shock = new THREE.Mesh(new THREE.PlaneGeometry(5.6, 5.6), shockMat);
        shock.rotation.x = -Math.PI / 2; shock.position.set(wx, ty + 0.1, wy);
        group.add(shock);
        scene.add(group);
        vfxList.push({
            group, life: 0.88, maxLife: 0.88,
            update(dt, p) {
                const fallP = clamp(p / 0.38, 0, 1);
                for (const rk of rocks) {
                    rk.r.position.y = lerp(rk.sy, rk.targetY, fallP * fallP);
                    rk.r.rotation.x += dt * rk.rot; rk.r.rotation.z += dt * rk.rot;
                    if (p > 0.72) rk.r.scale.setScalar(Math.max(0.01, (1 - p) / 0.28));
                }
                if (p >= 0.36) {
                    const sp = (p - 0.36) / 0.64;
                    shock.scale.setScalar(0.35 + sp * 1.15);
                    shockMat.opacity = (1 - sp) * 0.85;
                }
            }
        });
    }

    // (8) 法師終極技能 — 雷電操術 (黑紫色毀滅大範圍雷電風暴，CD 最久、傷害最高！)
    function spawnVoidThunder3D(wx, wy, monsters) {
        const group = new THREE.Group();
        const ty = worldY(wx, wy);
        const boltsHolder = new THREE.Group();
        group.add(boltsHolder);

        const targets = [new THREE.Vector3(wx, ty + 0.6, wy)];
        for (const m of monsters) {
            if (m.hp <= 0 || targets.length >= 6) continue;
            if (Math.hypot(m.x - wx, m.y - wy) <= 4.6) targets.push(new THREE.Vector3(m.x, worldY(m.x, m.y) + 0.8, m.y));
        }
        const rebuild = () => {
            while (boltsHolder.children.length) boltsHolder.remove(boltsHolder.children[0]);
            for (const tp of targets) {
                const sky = new THREE.Vector3(tp.x + (Math.random() - 0.5) * 2.2, ty + 14, tp.z + (Math.random() - 0.5) * 2.2);
                boltsHolder.add(buildNaturalBolt(sky, tp, 0.11, 1.85, 0x9333ea, true));
                boltsHolder.add(buildNaturalBolt(sky, tp, 0.055, 2.2, 0x3b0764, false));
            }
        };
        rebuild();

        // 暗黑紫電核心爆閃
        const flash = new THREE.PointLight(0xa855f7, 26, 20, 1.6);
        flash.position.set(wx, ty + 2.4, wy);
        group.add(flash);
        scene.add(group);
        let acc = 0;
        vfxList.push({
            group, life: 0.78, maxLife: 0.78,
            update(dt, p) {
                acc += dt;
                if (acc >= 0.07 && p < 0.82) { acc = 0; rebuild(); }
                const inv = 1 - p;
                flash.intensity = 26 * inv * inv;
                boltsHolder.traverse((c) => { if (c.material && c.material.transparent) c.material.opacity = inv; });
            }
        });
    }

    return {
        spawn3DLightning, spawn3DTornado, createFireballMesh, spawn3DFireExplosion,
        spawnFlameLine3D, spawnIceLance3D, spawnHealAura3D, spawnRockFall3D, spawnVoidThunder3D
    };
}
