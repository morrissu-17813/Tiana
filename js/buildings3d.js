/**
 * Tiana 3D — 寫實中世紀暗黑奇幻建築建模庫
 * 告別陽春方塊屋：石砌基座、凸出木桁架二樓懸挑、斜屋簷椽木、煙囪、拱門雨遮、窗框百葉、哥德鐘樓、溫泉噴泉
 */
import * as THREE from 'three';

const TAU = Math.PI * 2;

function addM(parent, geo, mat, x = 0, y = 0, z = 0, cast = true) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = cast;
    m.receiveShadow = true;
    parent.add(m);
    return m;
}

function makeGableRoofGeo(w, d, h, overW = 0.28, overD = 0.26) {
    const W = w / 2 + overW, D = d / 2 + overD;
    // 修正雙斜坡頂面法線方向（皆朝外），確保從 45 度等距視角看雙側瓦片皆完整立體！
    const v = [
        // 北坡 (-Z) 朝上北
        -W, 0, -D, -W, h, 0,  W, h, 0,   -W, 0, -D,  W, h, 0,  W, 0, -D,
        // 南坡 (+Z) 朝上南
        -W, 0,  D,  W, 0, D,  W, h, 0,   -W, 0,  D,  W, h, 0, -W, h,  0
    ];
    const uv = [
        0, 0, 0, 1.5, 2.5, 1.5, 0, 0, 2.5, 1.5, 2.5, 0,
        0, 0, 2.5, 0, 2.5, 1.5, 0, 0, 2.5, 1.5, 0, 1.5
    ];
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.computeVertexNormals();
    return g;
}

function makeGableEndWallsGeo(w, d, h) {
    const W = w / 2, D = d / 2;
    const v = [
        -W, 0, -D, -W, 0, D, -W, h, 0,
         W, 0,  D,  W, 0, -D, W, h, 0
    ];
    const uv = [0, 0, 1, 0, 0.5, 1, 0, 0, 1, 0, 0.5, 1];
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.computeVertexNormals();
    return g;
}

export function buildAllBuildings({ scene, TEX, mapBuildings, heightMap, EH, waterMat }) {
    const wallMat = new THREE.MeshStandardMaterial({
        map: TEX.rock.map, normalMap: TEX.rock.normalMap, normalScale: new THREE.Vector2(1.4, 1.4),
        color: 0x9b9386, roughness: 0.94
    });
    const stoneTrim = new THREE.MeshStandardMaterial({
        map: TEX.road.map, normalMap: TEX.road.normalMap, color: 0x827a6f, roughness: 0.9
    });
    const plasterMat = new THREE.MeshStandardMaterial({
        map: TEX.plaster.map, normalMap: TEX.plaster.normalMap, color: 0xc2b69f, roughness: 0.95
    });
    const darkTimber = new THREE.MeshStandardMaterial({ color: 0x3b2618, roughness: 0.85 });
    const lightWood = new THREE.MeshStandardMaterial({ color: 0x5c3e26, roughness: 0.82 });
    const glassWarm = new THREE.MeshStandardMaterial({
        color: 0x4a3520, emissive: 0xd99242, emissiveIntensity: 0.85, roughness: 0.35
    });
    const ironMat = new THREE.MeshStandardMaterial({ color: 0x2a2e36, metalness: 0.82, roughness: 0.42 });

    const roofCol = { slate: 0x384354, blacksmith: 0x453e3a, magic_shop: 0x4f2a75, cottage: 0x8a3a22, chapel: 0x253e6e, keep: 0x2d394f };
    const roofMats = {};
    for (const k in roofCol) {
        roofMats[k] = new THREE.MeshStandardMaterial({
            map: TEX.roof.map, normalMap: TEX.roof.normalMap, normalScale: new THREE.Vector2(1.3, 1.3),
            color: roofCol[k], roughness: 0.78, metalness: 0.08, side: THREE.DoubleSide
        });
    }

    const animatedProps = { crystal: null, springSteams: [], forgeGlow: null };

    // 精細窗戶組件 (含木窗框、窗台與左右百葉)
    function addDetailedWindow(parent, x, y, z, rotY = 0, w = 0.32, h = 0.4) {
        const wg = new THREE.Group();
        wg.position.set(x, y, z);
        wg.rotation.y = rotY;
        parent.add(wg);
        addM(wg, new THREE.BoxGeometry(w, h, 0.05), glassWarm, 0, 0, 0, false);
        addM(wg, new THREE.BoxGeometry(w + 0.1, 0.06, 0.12), stoneTrim, 0, -h / 2 - 0.02, 0.03, false); // 窗台
        addM(wg, new THREE.BoxGeometry(w + 0.08, 0.05, 0.08), darkTimber, 0, h / 2 + 0.02, 0.02, false); // 上楣
        addM(wg, new THREE.BoxGeometry(0.03, h, 0.07), darkTimber, 0, 0, 0.02, false); // 十字窗櫺
        addM(wg, new THREE.BoxGeometry(w, 0.03, 0.07), darkTimber, 0, 0.03, 0.02, false);
        // 左右木百葉
        for (const s of [-1, 1]) {
            addM(wg, new THREE.BoxGeometry(0.09, h, 0.04), lightWood, s * (w / 2 + 0.05), 0, 0.03, false);
        }
    }

    // 精細中世紀半木構房屋 (石砌一樓基座 + 懸挑木桁架二樓 + 斜屋頂椽木 + 門廊雨遮 + 煙囪)
    function buildMedievalHouse(parent, w, d, wallH, roofKey, opts = {}) {
        const f1H = wallH * 0.52;
        const f2H = wallH * 0.55;
        // 1. 石砌基腳 + 轉角隅石
        addM(parent, new THREE.BoxGeometry(w + 0.14, 0.24, d + 0.14), stoneTrim, 0, 0.12, 0);
        addM(parent, new THREE.BoxGeometry(w, f1H, d), wallMat, 0, 0.24 + f1H / 2, 0);

        // 2. 二樓微外凸懸挑 (Medieval Jetty) + 木桁架立柱與橫樑
        const w2 = w + 0.16, d2 = d + 0.16;
        const y2Base = 0.24 + f1H;
        addM(parent, new THREE.BoxGeometry(w2 + 0.06, 0.09, d2 + 0.06), darkTimber, 0, y2Base + 0.04, 0);
        addM(parent, new THREE.BoxGeometry(w2, f2H, d2), plasterMat, 0, y2Base + 0.08 + f2H / 2, 0);

        // 四角凸出深木立柱與斜撐
        for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
            addM(parent, new THREE.BoxGeometry(0.11, f2H + 0.06, 0.11), darkTimber, sx * (w2 / 2 - 0.01), y2Base + 0.08 + f2H / 2, sz * (d2 / 2 - 0.01));
            addM(parent, new THREE.BoxGeometry(0.12, f1H, 0.12), stoneTrim, sx * (w / 2 - 0.01), 0.24 + f1H / 2, sz * (d / 2 - 0.01));
        }

        // 3. 歐式人字雙坡瓦片屋頂 + 左右粉刷山牆 + 屋脊木樑與厚實屋簷板
        const roofY = y2Base + 0.08 + f2H;
        const roofH = Math.min(wallH * 0.72, d2 * 0.58);
        addM(parent, makeGableRoofGeo(w2, d2, roofH, 0.26, 0.28), roofMats[roofKey], 0, roofY, 0);
        addM(parent, makeGableEndWallsGeo(w2 - 0.02, d2 - 0.02, roofH - 0.02), plasterMat, 0, roofY, 0);
        // 屋脊橫樑與前後屋簷封板 (完全對齊屋頂方向，不再垂直穿插！)
        addM(parent, new THREE.BoxGeometry(w2 + 0.58, 0.11, 0.14), darkTimber, 0, roofY + roofH + 0.02, 0);
        for (const sz of [-1, 1]) {
            addM(parent, new THREE.BoxGeometry(w2 + 0.56, 0.08, 0.08), darkTimber, 0, roofY + 0.02, sz * (d2 / 2 + 0.26));
        }

        // 4. 拱形木門 + 雙柱小門廊雨遮
        const frontZ = d / 2;
        addM(parent, new THREE.BoxGeometry(0.52, 0.84, 0.08), darkTimber, 0, 0.66, frontZ + 0.02);
        addM(parent, new THREE.BoxGeometry(0.4, 0.76, 0.1), lightWood, 0, 0.62, frontZ + 0.03);
        // 門廊雨遮與木柱
        const porch = addM(parent, new THREE.BoxGeometry(0.86, 0.07, 0.44), roofMats[roofKey], 0, 1.18, frontZ + 0.22);
        porch.rotation.x = 0.25;
        for (const s of [-1, 1]) addM(parent, new THREE.BoxGeometry(0.07, 0.96, 0.07), darkTimber, s * 0.36, 0.68, frontZ + 0.38);

        // 5. 前後二樓精細木窗 + 一樓側窗
        addDetailedWindow(parent, -w2 * 0.26, y2Base + f2H * 0.55, d2 / 2 + 0.02, 0);
        addDetailedWindow(parent, w2 * 0.26, y2Base + f2H * 0.55, d2 / 2 + 0.02, 0);
        addDetailedWindow(parent, 0, y2Base + f2H * 0.55, -d2 / 2 - 0.02, Math.PI);
        addDetailedWindow(parent, w2 / 2 + 0.02, y2Base + f2H * 0.55, 0, Math.PI / 2);
        addDetailedWindow(parent, -w2 / 2 - 0.02, y2Base + f2H * 0.55, 0, -Math.PI / 2);

        // 6. 石砌煙囪 (選用)
        if (opts.chimney !== false) {
            const cx = w * 0.32, cz = -d * 0.22;
            addM(parent, new THREE.BoxGeometry(0.42, roofY + roofH + 0.45, 0.42), wallMat, cx, (roofY + roofH + 0.45) / 2, cz);
            addM(parent, new THREE.BoxGeometry(0.52, 0.1, 0.52), stoneTrim, cx, roofY + roofH + 0.46, cz);
        }
        return { roofY, roofH };
    }

    // 精細石砌圓塔 (含外擴基座、城垛女牆、錐形瓦頂與旗幟)
    function buildStoneTower(parent, r, h, roofKey, x = 0, z = 0) {
        const g = new THREE.Group();
        g.position.set(x, 0, z);
        parent.add(g);
        addM(g, new THREE.CylinderGeometry(r * 1.05, r * 1.22, 0.55, 16), stoneTrim, 0, 0.275, 0);
        addM(g, new THREE.CylinderGeometry(r, r * 1.06, h, 16), wallMat, 0, 0.55 + h / 2, 0);
        addM(g, new THREE.CylinderGeometry(r * 1.18, r * 1.12, 0.28, 16), stoneTrim, 0, 0.55 + h + 0.12, 0);
        for (let i = 0; i < 8; i++) {
            const a = (i / 8) * TAU;
            addM(g, new THREE.BoxGeometry(0.22, 0.26, 0.22), stoneTrim, Math.cos(a) * r * 1.06, 0.55 + h + 0.38, Math.sin(a) * r * 1.06);
        }
        const roofH = h * 0.55;
        addM(g, new THREE.ConeGeometry(r * 1.26, roofH, 16), roofMats[roofKey] || roofMats.slate, 0, 0.55 + h + 0.26 + roofH / 2, 0);
        addM(g, new THREE.CylinderGeometry(0.025, 0.025, 0.65, 6), ironMat, 0, 0.55 + h + 0.26 + roofH + 0.3, 0, false);
        for (let i = 0; i < 3; i++) {
            const a = Math.PI * 0.25 + i * 1.1;
            addDetailedWindow(g, Math.cos(a) * r * 1.02, 0.55 + h * (0.4 + i * 0.18), Math.sin(a) * r * 1.02, Math.atan2(Math.cos(a), Math.sin(a)), 0.18, 0.34);
        }
        return g;
    }

    for (const b of mapBuildings) {
        const cx = b.x + b.w / 2, cz = b.y + b.h / 2;
        const gx = Math.min(heightMap[0].length - 1, Math.max(0, Math.floor(cx)));
        const gz = Math.min(heightMap.length - 1, Math.max(0, Math.floor(cz)));
        const g = new THREE.Group();
        g.position.set(cx, heightMap[gz][gx] * EH, cz);
        scene.add(g);

        switch (b.type) {
            case 'castle_keep': {
                addM(g, new THREE.BoxGeometry(b.w - 0.4, 0.5, b.h - 0.4), stoneTrim, 0, 0.25, 0);
                addM(g, new THREE.BoxGeometry(b.w - 0.8, 3.6, b.h - 0.7), wallMat, 0, 2.3, 0);
                const roof = addM(g, makeGableRoofGeo(b.w - 0.8, b.h - 0.7, 1.5, 0.3, 0.3), roofMats.keep, 0, 4.1, 0);
                roof.rotation.y = 0;
                for (const [ox, oz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
                    buildStoneTower(g, 0.65, 4.4, 'keep', ox * (b.w / 2 - 0.5), oz * (b.h / 2 - 0.4));
                }
                buildStoneTower(g, 0.96, 6.2, 'keep', 0, -0.25);
                // 皇家城門拱門
                addM(g, new THREE.BoxGeometry(1.15, 1.55, 0.18), stoneTrim, 0, 1.15, b.h / 2 - 0.3);
                addM(g, new THREE.BoxGeometry(0.92, 1.38, 0.22), darkTimber, 0, 1.08, b.h / 2 - 0.28);
                for (let i = -2; i <= 2; i++) addDetailedWindow(g, i * 0.95, 2.75, b.h / 2 - 0.32, 0, 0.28, 0.5);
                break;
            }
            case 'guard_tower': buildStoneTower(g, 0.88, 3.6, 'slate'); break;
            case 'gate_tower': {
                addM(g, new THREE.BoxGeometry(1.85, 0.4, 1.85), stoneTrim, 0, 0.2, 0);
                addM(g, new THREE.BoxGeometry(1.68, 3.1, 1.68), wallMat, 0, 1.95, 0);
                addM(g, new THREE.BoxGeometry(1.86, 0.22, 1.86), stoneTrim, 0, 3.56, 0);
                for (const sx of [-0.72, 0, 0.72]) for (const sz of [-0.72, 0.72]) {
                    addM(g, new THREE.BoxGeometry(0.28, 0.34, 0.28), stoneTrim, sx, 3.84, sz);
                }
                const banner = addM(g, new THREE.PlaneGeometry(0.65, 1.4), new THREE.MeshStandardMaterial({ color: 0x8a1c1c, side: THREE.DoubleSide, map: TEX.cloth, roughness: 0.85 }), 0, 2.15, 0.88, false);
                addDetailedWindow(g, 0, 2.85, 0.86, 0, 0.24, 0.42);
                break;
            }
            case 'blacksmith': {
                buildMedievalHouse(g, b.w - 0.3, b.h - 0.25, 1.45, 'blacksmith', { chimney: true });
                // 屋外打鐵棚 + 發光鍛造爐 + 鐵砧
                addM(g, new THREE.BoxGeometry(0.7, 0.5, 0.55), wallMat, -b.w * 0.35, 0.25, b.h / 2 + 0.32);
                const hearth = addM(g, new THREE.BoxGeometry(0.38, 0.16, 0.3), new THREE.MeshBasicMaterial({ color: 0xf97316 }), -b.w * 0.35, 0.52, b.h / 2 + 0.32, false);
                animatedProps.forgeGlow = hearth;
                addM(g, new THREE.BoxGeometry(0.36, 0.24, 0.2), ironMat, 0.65, 0.36, b.h / 2 + 0.36);
                addM(g, new THREE.CylinderGeometry(0.14, 0.16, 0.26, 8), darkTimber, 0.65, 0.13, b.h / 2 + 0.36);
                break;
            }
            case 'magic_shop': {
                buildMedievalHouse(g, b.w - 0.3, b.h - 0.25, 1.5, 'magic_shop', { chimney: false });
                buildStoneTower(g, 0.45, 2.2, 'magic_shop', b.w * 0.38, -b.h * 0.25);
                const crystal = addM(g, new THREE.OctahedronGeometry(0.24), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.4, 0.7, 2.6), toneMapped: false }), 0, 3.35, 0, false);
                animatedProps.crystal = crystal;
                break;
            }
            case 'cottage': {
                buildMedievalHouse(g, b.w - 0.3, b.h - 0.25, 1.35, 'cottage', { chimney: true });
                // 旅店門前招牌木架
                addM(g, new THREE.CylinderGeometry(0.04, 0.04, 1.25, 6), darkTimber, 0.85, 0.62, b.h / 2 + 0.32);
                addM(g, new THREE.BoxGeometry(0.45, 0.28, 0.04), lightWood, 1.05, 1.05, b.h / 2 + 0.32);
                break;
            }
            case 'chapel': {
                buildMedievalHouse(g, b.w - 0.3, b.h - 0.25, 1.65, 'chapel', { chimney: false });
                // 哥德式尖頂鐘樓 + 彩繪玫瑰圓窗
                addM(g, new THREE.BoxGeometry(0.84, 3.6, 0.84), wallMat, -b.w / 2 + 0.55, 1.8, 0);
                addM(g, new THREE.ConeGeometry(0.68, 1.85, 4), roofMats.chapel, -b.w / 2 + 0.55, 4.52, 0).rotation.y = Math.PI / 4;
                addM(g, new THREE.CircleGeometry(0.28, 18), new THREE.MeshBasicMaterial({ color: 0x60a5fa }), 0, 1.75, b.h / 2 + 0.1, false);
                break;
            }
            case 'fountain': {
                // 城鎮療癒溫泉噴泉 (雙層雕石池 + 發光青藍溫泉水 + 上升療癒蒸氣)
                addM(g, new THREE.CylinderGeometry(1.35, 1.48, 0.42, 16), stoneTrim, 0, 0.21, 0);
                const springWaterMat = new THREE.MeshStandardMaterial({
                    color: 0x14b8a6, emissive: 0x0d9488, emissiveIntensity: 0.75,
                    roughness: 0.12, metalness: 0.2, transparent: true, opacity: 0.9
                });
                addM(g, new THREE.CylinderGeometry(1.22, 1.22, 0.06, 20), springWaterMat, 0, 0.38, 0, false);
                addM(g, new THREE.CylinderGeometry(0.18, 0.28, 1.15, 12), stoneTrim, 0, 0.78, 0);
                addM(g, new THREE.CylinderGeometry(0.56, 0.38, 0.16, 14), stoneTrim, 0, 1.35, 0);
                addM(g, new THREE.SphereGeometry(0.18, 14, 12), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.5, 2.2, 2.4), toneMapped: false }), 0, 1.62, 0, false);
                // 6 團溫泉療癒白霧光點
                for (let i = 0; i < 6; i++) {
                    const sp = new THREE.Sprite(new THREE.SpriteMaterial({
                        map: TEX.glow, color: 0x5eead4, transparent: true, opacity: 0.45,
                        blending: THREE.AdditiveBlending, depthWrite: false
                    }));
                    sp.scale.set(0.75, 0.75, 1);
                    g.add(sp);
                    animatedProps.springSteams.push({ sp, phase: i * (TAU / 6), r: 0.35 + (i % 3) * 0.28 });
                }
                break;
            }
        }
    }

    return {
        wallMat,
        update(t) {
            if (animatedProps.crystal) {
                animatedProps.crystal.rotation.y = t * 1.4;
                animatedProps.crystal.position.y = 3.35 + Math.sin(t * 3) * 0.14;
            }
            for (const st of animatedProps.springSteams) {
                const cyc = (t * 0.55 + st.phase) % 1;
                const ang = st.phase + t * 0.6;
                st.sp.position.set(Math.cos(ang) * st.r, 0.45 + cyc * 1.45, Math.sin(ang) * st.r);
                st.sp.material.opacity = Math.sin(cyc * Math.PI) * 0.42;
                const sc = 0.55 + cyc * 0.65;
                st.sp.scale.set(sc, sc, 1);
            }
        }
    };
}
