using UnityEngine;

namespace Tiana3D
{
    public enum WeaponShape { OneHandSword, TwoHandSword, Katana, Dagger, Staff }

    /// <summary>
    /// 武器外型切換（雙手劍/武士刀/短刀/法杖自動隱藏盾牌；法師限用法杖）
    /// ＋ 武器／防具每 +10 換色階光芒（貼合模型本身 Emission，無醜橢圓光球！）
    /// </summary>
    public class EquipmentAndGlowTiers : MonoBehaviour
    {
        [Header("裝備物件掛點")]
        public GameObject shieldObject;
        public GameObject grimoireBookObject; // 法師左手魔法書
        public Renderer weaponRenderer;
        public Renderer armorRenderer;

        [Header("目前強化等級與武器類型")]
        public WeaponShape currentWeapon = WeaponShape.OneHandSword;
        public int weaponEnchant = 10;
        public int armorEnchant = 0;

        public static Color GetTierColor(int enchant)
        {
            if (enchant >= 60) return new Color(1.0f, 0.84f, 0.12f); // +60 金
            if (enchant >= 50) return new Color(0.95f, 0.25f, 0.25f); // +50 紅
            if (enchant >= 40) return new Color(0.68f, 0.32f, 0.98f); // +40 紫
            if (enchant >= 30) return new Color(0.22f, 0.74f, 0.98f); // +30 藍
            if (enchant >= 20) return new Color(0.15f, 0.82f, 0.38f); // +20 綠
            if (enchant >= 10) return new Color(0.96f, 0.98f, 1.0f);  // +10 白
            return Color.black;
        }

        private void Start() => RefreshEquipmentVisuals();

        public void RefreshEquipmentVisuals()
        {
            // 僅單手劍顯示盾牌；法杖顯示法師左手魔法書
            if (shieldObject != null) shieldObject.SetActive(currentWeapon == WeaponShape.OneHandSword);
            if (grimoireBookObject != null) grimoireBookObject.SetActive(currentWeapon == WeaponShape.Staff);

            ApplyEmissionTier(weaponRenderer, weaponEnchant, 2.2f);
            ApplyEmissionTier(armorRenderer, armorEnchant, 1.2f);
        }

        private void ApplyEmissionTier(Renderer r, int enchant, float intensity)
        {
            if (r == null) return;
            var mat = r.material;
            if (enchant >= 10)
            {
                mat.EnableKeyword("_EMISSION");
                mat.SetColor("_EmissionColor", GetTierColor(enchant) * intensity);
            }
            else
            {
                mat.DisableKeyword("_EMISSION");
                mat.SetColor("_EmissionColor", Color.black);
            }
        }
    }
}
