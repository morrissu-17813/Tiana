using UnityEngine;
using UnityEngine.AI;

namespace Tiana3D
{
    /// <summary>
    /// 怪物生態群聚 AI（支援 12 座巢穴巡邏、被冰凍/暈眩控制、遠距離怪、地面行走末日水龍 Boss 與自動重生）
    /// </summary>
    [RequireComponent(typeof(NavMeshAgent))]
    public class MonsterLairAI : MonoBehaviour
    {
        [Header("怪物基本屬性")]
        public string monsterName = "嗜血狼人";
        public int maxHp = 200;
        public int currentHp;
        public float aggroRange = 8f;
        public float attackRange = 2.2f;
        public float patrolRadius = 6f;
        public float respawnSeconds = 8f;

        [Header("特殊效果")]
        public bool inflictsFreeze2s = false; // 末日水龍 Boss 勾選
        public bool inflictsPoison6s = false; // 夏洛柏勾選

        private NavMeshAgent agent;
        private Animator animator;
        private Vector3 homePos;
        private float patrolTimer;
        private float attackCd;
        private float freezeTimer;
        private float stunTimer;

        private void Awake()
        {
            agent = GetComponent<NavMeshAgent>();
            animator = GetComponentInChildren<Animator>();
            homePos = transform.position;
            currentHp = maxHp;
        }

        public void ApplyFreeze(float sec) => freezeTimer = Mathf.Max(freezeTimer, sec);
        public void ApplyStun(float sec) => stunTimer = Mathf.Max(stunTimer, sec);

        public void TakeDamage(int dmg)
        {
            if (currentHp <= 0) return;
            currentHp -= dmg;
            if (currentHp <= 0)
            {
                currentHp = 0;
                gameObject.SetActive(false);
                Invoke(nameof(Respawn), respawnSeconds);
            }
        }

        private void Respawn()
        {
            currentHp = maxHp;
            transform.position = homePos + new Vector3(Random.Range(-2f, 2f), 0f, Random.Range(-2f, 2f));
            gameObject.SetActive(true);
        }

        private void Update()
        {
            if (currentHp <= 0) return;
            if (freezeTimer > 0f) { freezeTimer -= Time.deltaTime; agent.isStopped = true; return; }
            if (stunTimer > 0f) { stunTimer -= Time.deltaTime; agent.isStopped = true; return; }
            agent.isStopped = false;

            if (attackCd > 0f) attackCd -= Time.deltaTime;
            var player = FindFirstObjectByType<PlayerController3D>();
            if (player != null)
            {
                float d = Vector3.Distance(transform.position, player.transform.position);
                if (d <= aggroRange)
                {
                    if (d > attackRange) agent.SetDestination(player.transform.position);
                    else
                    {
                        agent.ResetPath();
                        if (attackCd <= 0f)
                        {
                            attackCd = 1.5f;
                            if (animator != null) animator.SetTrigger("Attack");
                            if (inflictsFreeze2s && Random.value < 0.35f) player.frozenTimer = 2.0f;
                        }
                    }
                    if (animator != null) animator.SetFloat("Speed", agent.velocity.magnitude);
                    return;
                }
            }

            // 圍繞巢穴中心群聚巡邏
            patrolTimer -= Time.deltaTime;
            if (patrolTimer <= 0f)
            {
                patrolTimer = Random.Range(2.5f, 5.0f);
                Vector3 rnd = homePos + Random.insideUnitSphere * patrolRadius;
                rnd.y = homePos.y;
                if (NavMesh.SamplePosition(rnd, out NavMeshHit hit, patrolRadius, NavMesh.AllAreas))
                {
                    agent.SetDestination(hit.position);
                }
            }
            if (animator != null) animator.SetFloat("Speed", agent.velocity.magnitude);
        }
    }
}
