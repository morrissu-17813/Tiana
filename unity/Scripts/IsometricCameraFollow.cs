using UnityEngine;

namespace Tiana3D
{
    /// <summary>
    /// 45° 天堂電影級俯視跟隨鏡頭：支援滑鼠滾輪縮放、手機雙指縮放、右鍵旋轉與暴擊震動
    /// </summary>
    public class IsometricCameraFollow : MonoBehaviour
    {
        [Header("跟隨目標與視角設定")]
        public Transform target;
        public float distance = 18.0f;
        public float minDistance = 10.0f;
        public float maxDistance = 28.0f;
        public float pitchAngle = 45.0f;
        public float yawAngle = 45.0f;
        public float followSmooth = 8.0f;
        public Vector3 targetOffset = new Vector3(0f, 1.2f, 0f);

        private float shakeTimer;
        private float shakeIntensity;
        private float lastPinchDist;

        private void Start()
        {
            if (TryGetComponent<Camera>(out var cam))
            {
                cam.fieldOfView = 32f; // 窄 FOV 呈現經典立體縮景感
            }
        }

        public void TriggerShake(float intensity = 0.25f, float duration = 0.16f)
        {
            shakeIntensity = Mathf.Max(shakeIntensity, intensity);
            shakeTimer = Mathf.Max(shakeTimer, duration);
        }

        private void LateUpdate()
        {
            if (target == null) return;

            // 1. 滑鼠滾輪縮放
            float scroll = Input.GetAxis("Mouse ScrollWheel");
            if (Mathf.Abs(scroll) > 0.001f)
            {
                distance = Mathf.Clamp(distance - scroll * 10f, minDistance, maxDistance);
            }

            // 2. 手機雙指捏合縮放
            if (Input.touchCount == 2)
            {
                Touch t0 = Input.GetTouch(0);
                Touch t1 = Input.GetTouch(1);
                float curDist = Vector2.Distance(t0.position, t1.position);
                if (lastPinchDist > 0f)
                {
                    distance = Mathf.Clamp(distance - (curDist - lastPinchDist) * 0.03f, minDistance, maxDistance);
                }
                lastPinchDist = curDist;
            }
            else
            {
                lastPinchDist = 0f;
            }

            // 3. 滑鼠右鍵拖曳水平旋轉視角
            if (Input.GetMouseButton(1))
            {
                yawAngle += Input.GetAxis("Mouse X") * 3.5f;
            }

            Quaternion rot = Quaternion.Euler(pitchAngle, yawAngle, 0f);
            Vector3 desiredFocus = target.position + targetOffset;
            Vector3 desiredPos = desiredFocus - (rot * Vector3.forward * distance);

            if (shakeTimer > 0f)
            {
                shakeTimer -= Time.deltaTime;
                desiredPos += Random.insideUnitSphere * shakeIntensity;
            }

            transform.position = Vector3.Lerp(transform.position, desiredPos, Time.deltaTime * followSmooth);
            transform.LookAt(desiredFocus);
        }
    }
}
