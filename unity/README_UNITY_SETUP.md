# Tiana 3D — Unity (URP) 匯出 WebGL 上 GitHub Pages 整合指南

本資料夾直接放在 `Tiana` Repository 內，方便你建立 Unity URP 專案後直接拖入核心 C# 腳本，並匯出 WebGL 取代或並行於目前的網頁版。

## 已準備好的核心 C# 腳本（`unity/Scripts/`）

| 腳本 | 功能說明 |
|---|---|
| `IsometricCameraFollow.cs` | 45° 天堂立體俯視鏡頭（FOV 32）、滾輪縮放、手機雙指縮放、右鍵旋轉、暴擊震動 |
| `PlayerController3D.cs` | Unity NavMesh 點擊移動、手機按住滑動走路、空白鍵跳躍、點擊鎖定怪物 |
| `CombatAndSkills.cs` | **魔騎士**（落雷/龍捲/火球）與 **法師**（烈焰/冰錐冰凍1秒/治癒/落石暈眩2秒/雷電操術黑紫高傷）＋ 3D 閃爍連鎖落雷 ＋ 自動狩獵 AI |
| `MonsterLairAI.cs` | 生態巢穴群聚巡邏、自動重生、末日水龍地面行走冰凍控制 |
| `EquipmentAndGlowTiers.cs` | 單手劍配盾 / 雙手劍武士刀短刀法杖自動隱藏盾牌 / 法師左手魔法書 ＋ `+10 白 → +20 綠 → +30 藍 → +40 紫 → +50 紅 → +60 金` 貼合模型 Emission 光芒 |

## 快速上手 5 步驟

1. **安裝 Unity Hub 與 Unity 6 LTS**（安裝模組務必勾選 **Web Build Support**）。
2. 在 Unity Hub 建立 **Universal 3D (URP)** 專案，把本資料夾下的 `unity/Scripts/` 整個拖進 Unity 的 `Assets/`。
3. 到 Unity Asset Store 免費匯入：
   - 場景：`Medieval Village`、`Fantasy Forest`、`Rock and Boulders`
   - 角色與巨龍：`RPG Hero PBR HP Polyart`、`Dragon the Soul Eater`、`Werewolf`
   - 若材質變亮粉紅：執行 `Window -> Rendering -> Render Pipeline Converter -> Material Upgrade`。
4. 光影與尋路：
   - `Global Volume` 加入 **Tonemapping (ACES)** 與 **Bloom (Threshold 0.9, Intensity 0.6)**。
   - 安裝 `AI Navigation`，在地面掛載 `NavMesh Surface` 按 `Bake`。
5. **匯出 WebGL 放上 `Tiana` GitHub Pages（防卡 90% 關鍵）**：
   - `Build Profiles` 切換到 **Web**。
   - `Player Settings -> Publishing Settings -> Compression Format` 改為 **Disabled**（或勾選 **Decompression Fallback**）。
   - Build 輸出的 `index.html`、`Build/`、`TemplateData/` 放到 `Tiana` repo 根目錄（或 `/webgl/` 子資料夾）並 push 即可！
