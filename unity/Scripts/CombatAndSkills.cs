using System.Collections;
using UnityEngine;

namespace Tiana3D
{
    /// <summary>
    /// 戰鬥、自動狩獵與雙職業技能系統：
    /// - 魔騎士：極道落雷(5) / 龍捲風(6) / 火球術(7)
    /// - 法師：烈焰術(5) / 冰錐冰凍1秒(6) / 治癒術(7) / 落石術暈眩2秒(8) / 雷電操術黑紫高傷(9)
    /// </summary>
    public class CombatAndSkills : MonoBehaviour
    {
        [Header("核心參考")]
        public PlayerController3D controller;
        public IsometricCameraFollow camFollow;
        public Transform castOrigin; // 劍尖或法杖頂端
        public Material lightningMat; // URP Unlit Additive HDR 材質

        [Header("戰鬥參數")]
        public float baseAttackInterval = 0.84f;
        public int baseDamage = 28;
        public bool autoBattle = false;
        public bool autoMagic = true;

        private float attackCd;
        private float[] spellCd = new float[10];
        private Animator animator;

        private void Awake()
        {
            if (controller == null) controller = GetComponent<PlayerController3D>();
            animator = GetComponentInChildren<Animator>();
        }

        private void Update()
        {
            if (attackCd > 0f) attackCd -= Time.deltaTime;
            for (int i = 0; i < spellCd.Length; i++) if (spellCd[i] > 0f) spellCd[i] -= Time.deltaTime;

            if (Input.GetKeyDown(KeyCode.Z)) autoBattle = !autoBattle;
            if (Input.GetKeyDown(KeyCode.X)) autoMagic = !autoMagic;

            // 技能快捷鍵 5 ~ 9
            if (Input.GetKeyDown(KeyCode.Alpha5)) CastSkillSlot(5);
            if (Input.GetKeyDown(KeyCode.Alpha6)) CastSkillSlot(6);
            if (Input.GetKeyDown(KeyCode.Alpha7)) CastSkillSlot(7);
            if (Input.GetKeyDown(KeyCode.Alpha8) && controller.charClass == CharacterClass.Mage) CastSkillSlot(8);
            if (Input.GetKeyDown(KeyCode.Alpha9) && controller.charClass == CharacterClass.Mage) CastSkillSlot(9);

            if (autoBattle) RunAutoBattle();
            HandleTargetChaseAndAttack();
        }

        private void RunAutoBattle()
        {
            if (controller.attackTarget == null || controller.attackTarget.currentHp <= 0)
            {
                MonsterLairAI nearest = null;
                float bestDist = 30f;
                foreach (var mob in FindObjectsByType<MonsterLairAI>(FindObjectsSortMode.None))
                {
                    if (mob.currentHp <= 0) continue;
                    float d = Vector3.Distance(transform.position, mob.transform.position);
                    if (d < bestDist) { bestDist = d; nearest = mob; }
                }
                controller.attackTarget = nearest;
            }

            if (autoMagic && controller.attackTarget != null)
            {
                if (controller.charClass == CharacterClass.Mage)
                {
                    if (spellCd[9] <= 0f) CastSkillSlot(9);
                    else if (spellCd[8] <= 0f) CastSkillSlot(8);
                    else if (spellCd[5] <= 0f) CastSkillSlot(5);
                    else if (spellCd[6] <= 0f) CastSkillSlot(6);
                }
                else
                {
                    if (spellCd[5] <= 0f) CastSkillSlot(5);
                    else if (spellCd[7] <= 0f) CastSkillSlot(7);
                }
            }
        }

        private void HandleTargetChaseAndAttack()
        {
            var target = controller.attackTarget;
            if (target == null || target.currentHp <= 0 || controller.frozenTimer > 0f) return;

            float range = (controller.charClass == CharacterClass.Mage) ? 8.5f : 2.2f;
            float dist = Vector3.Distance(transform.position, target.transform.position);

            if (dist <= range)
            {
                controller.agent.ResetPath();
                Vector3 lookDir = (target.transform.position - transform.position);
                lookDir.y = 0f;
                if (lookDir.sqrMagnitude > 0.01f)
                    transform.rotation = Quaternion.Slerp(transform.rotation, Quaternion.LookRotation(lookDir), Time.deltaTime * 14f);

                if (attackCd <= 0f)
                {
                    attackCd = baseAttackInterval;
                    if (animator != null) animator.SetTrigger(controller.charClass == CharacterClass.Mage ? "Cast" : "Attack");
                    int dmg = Random.Range(baseDamage, baseDamage + 12);
                    target.TakeDamage(dmg);
                }
            }
            else
            {
                controller.agent.SetDestination(target.transform.position);
            }
        }

        public void CastSkillSlot(int slot)
        {
            if (spellCd[slot] > 0f || controller.frozenTimer > 0f) return;
            var target = controller.attackTarget;
            if (target == null && slot != 7) return;

            if (animator != null) animator.SetTrigger("Cast");

            if (controller.charClass == CharacterClass.MagicKnight)
            {
                if (slot == 5 && target != null) // 極道落雷
                {
                    spellCd[5] = 2.2f;
                    StartCoroutine(SpawnChainLightningRoutine(target.transform.position, new Color(0.35f, 0.85f, 1.5f), 68));
                }
                else if (slot == 6) // 龍捲風
                {
                    spellCd[6] = 3.2f;
                    DamageAoE(transform.position, 4.5f, 58, 0f, 0f);
                }
                else if (slot == 7 && target != null) // 火球術
                {
                    spellCd[7] = 1.8f;
                    DamageAoE(target.transform.position, 3.0f, 55, 0f, 0f);
                }
            }
            else // 皇家法師 5 大技能
            {
                if (slot == 5 && target != null) { spellCd[5] = 2.2f; DamageAoE(target.transform.position, 2.8f, 72, 0f, 0f); } // 烈焰術
                else if (slot == 6 && target != null) { spellCd[6] = 2.4f; target.TakeDamage(80); target.ApplyFreeze(1.0f); } // 冰錐 冰凍1秒
                else if (slot == 7) { spellCd[7] = 3.0f; Debug.Log("[法師] 施放治癒術"); } // 治癒術
                else if (slot == 8 && target != null) { spellCd[8] = 4.5f; DamageAoE(target.transform.position, 3.8f, 92, 0f, 2.0f); } // 落石術 暈眩2秒
                else if (slot == 9 && target != null) // 雷電操術 (黑紫大範圍高傷長CD)
                {
                    spellCd[9] = 7.5f;
                    StartCoroutine(SpawnChainLightningRoutine(target.transform.position, new Color(0.75f, 0.2f, 1.8f), 155));
                }
            }
        }

        private void DamageAoE(Vector3 center, float radius, int dmg, float freezeSec, float stunSec)
        {
            foreach (var mob in FindObjectsByType<MonsterLairAI>(FindObjectsSortMode.None))
            {
                if (mob.currentHp > 0 && Vector3.Distance(mob.transform.position, center) <= radius)
                {
                    mob.TakeDamage(dmg);
                    if (freezeSec > 0f) mob.ApplyFreeze(freezeSec);
                    if (stunSec > 0f) mob.ApplyStun(stunSec);
                }
            }
        }

        /// <summary>
        /// 3D 鋸齒閃電特效 (含動態重繪閃爍與點光源照亮地面)
        /// </summary>
        private IEnumerator SpawnChainLightningRoutine(Vector3 targetPos, Color hdrColor, int dmg)
        {
            DamageAoE(targetPos, 3.2f, dmg, 0f, 0f);
            if (camFollow != null) camFollow.TriggerShake(0.28f, 0.2f);

            GameObject fxObj = new GameObject("ChainLightning3D");
            var lr = fxObj.AddComponent<LineRenderer>();
            lr.positionCount = 12;
            lr.startWidth = 0.14f;
            lr.endWidth = 0.08f;
            lr.material = lightningMat != null ? lightningMat : new Material(Shader.Find("Universal Render Pipeline/Unlit"));
            lr.startColor = hdrColor;
            lr.endColor = Color.white;

            var flash = fxObj.AddComponent<Light>();
            flash.type = LightType.Point;
            flash.color = hdrColor;
            flash.range = 14f;
            flash.intensity = 12f;
            fxObj.transform.position = targetPos + Vector3.up * 1.5f;

            Vector3 startPos = castOrigin != null ? castOrigin.position : (transform.position + Vector3.up * 1.3f);
            float elapsed = 0f;
            while (elapsed < 0.42f)
            {
                for (int i = 0; i < lr.positionCount; i++)
                {
                    float t = i / (float)(lr.positionCount - 1);
                    Vector3 p = Vector3.Lerp(startPos, targetPos + Vector3.up * 1.0f, t);
                    if (i > 0 && i < lr.positionCount - 1) p += Random.insideUnitSphere * 0.65f;
                    lr.SetPosition(i, p);
                }
                flash.intensity = Mathf.Lerp(12f, 0f, elapsed / 0.42f);
                elapsed += 0.06f;
                yield return new WaitForSeconds(0.06f);
            }
            Destroy(fxObj);
        }
    }
}
