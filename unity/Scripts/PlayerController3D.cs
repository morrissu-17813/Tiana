using UnityEngine;
using UnityEngine.AI;
using UnityEngine.EventSystems;

namespace Tiana3D
{
    public enum CharacterClass { MagicKnight, Mage }

    /// <summary>
    /// 主角 3D 移動與操作控制器：NavMesh 點擊移動、手機滑動連續走路、空白鍵跳躍、點擊鎖定怪物
    /// </summary>
    [RequireComponent(typeof(NavMeshAgent))]
    public class PlayerController3D : MonoBehaviour
    {
        [Header("職業與基礎素質")]
        public CharacterClass charClass = CharacterClass.MagicKnight;
        public float baseMoveSpeed = 4.2f;
        public float jumpHeight = 1.6f;
        public float jumpDuration = 0.55f;

        [Header("射線圖層")]
        public LayerMask groundLayer = ~0;
        public LayerMask monsterLayer;
        public Transform visualRoot; // 掛載角色模型（跳躍時上下位移）

        [HideInInspector] public NavMeshAgent agent;
        [HideInInspector] public MonsterLairAI attackTarget;
        [HideInInspector] public float frozenTimer;
        [HideInInspector] public bool isJumping;

        private Animator animator;
        private Camera mainCam;
        private float jumpElapsed;
        private bool isDraggingGround;

        private void Awake()
        {
            agent = GetComponent<NavMeshAgent>();
            animator = GetComponentInChildren<Animator>();
            mainCam = Camera.main;
            agent.speed = baseMoveSpeed;
            agent.angularSpeed = 720f;
            agent.acceleration = 24f;
        }

        private void Update()
        {
            if (frozenTimer > 0f)
            {
                frozenTimer = Mathf.Max(0f, frozenTimer - Time.deltaTime);
                agent.isStopped = true;
                return;
            }
            agent.isStopped = false;

            HandleJump();
            HandlePointerInput();
            UpdateAnimator();
        }

        public void TriggerJump()
        {
            if (isJumping || frozenTimer > 0f) return;
            isJumping = true;
            jumpElapsed = 0f;
            if (animator != null) animator.SetTrigger("Jump");
        }

        private void HandleJump()
        {
            if (Input.GetKeyDown(KeyCode.Space)) TriggerJump();

            if (isJumping && visualRoot != null)
            {
                jumpElapsed += Time.deltaTime;
                float t = Mathf.Clamp01(jumpElapsed / jumpDuration);
                float h = Mathf.Sin(t * Mathf.PI) * jumpHeight;
                visualRoot.localPosition = new Vector3(0f, h, 0f);
                if (t >= 1f)
                {
                    isJumping = false;
                    visualRoot.localPosition = Vector3.zero;
                }
            }
        }

        private void HandlePointerInput()
        {
            if (Input.touchCount >= 2) { isDraggingGround = false; return; }
            if (EventSystem.current != null && EventSystem.current.IsPointerOverGameObject()) return;

            if (Input.GetMouseButtonDown(0))
            {
                Ray ray = mainCam.ScreenPointToRay(Input.mousePosition);
                // 優先點選怪物鎖定攻擊
                if (Physics.Raycast(ray, out RaycastHit mHit, 120f, monsterLayer))
                {
                    var mob = mHit.collider.GetComponentInParent<MonsterLairAI>();
                    if (mob != null && mob.currentHp > 0)
                    {
                        attackTarget = mob;
                        isDraggingGround = false;
                        return;
                    }
                }
                // 點擊地板移動並啟用按住滑動連續走路
                if (Physics.Raycast(ray, out RaycastHit gHit, 120f, groundLayer))
                {
                    attackTarget = null;
                    isDraggingGround = true;
                    agent.SetDestination(gHit.point);
                }
            }
            else if (Input.GetMouseButton(0) && isDraggingGround)
            {
                Ray ray = mainCam.ScreenPointToRay(Input.mousePosition);
                if (Physics.Raycast(ray, out RaycastHit gHit, 120f, groundLayer))
                {
                    agent.SetDestination(gHit.point);
                }
            }
            else if (Input.GetMouseButtonUp(0))
            {
                isDraggingGround = false;
            }
        }

        private void UpdateAnimator()
        {
            if (animator == null) return;
            animator.SetFloat("Speed", agent.velocity.magnitude);
        }
    }
}
