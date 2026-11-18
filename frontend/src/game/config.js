// 맵 화면을 조절하는 스위치 모음. true/false나 숫자만 바꾸면 돼요.

// ── 모드 ─────────────────────────────────────
// 처음 화면을 무엇으로 시작할지 (화면의 버튼으로 언제든 바꿀 수 있어요)
// true: 맵 전체 둘러보기로 시작 → "1인칭으로 플레이하기" 버튼으로 캐릭터 조종
// false: 바로 캐릭터 모드로 시작
export const FREE_CAMERA = false // [3. 개발 > 프론트엔드] 첫 접속은 3인칭 플레이로 시작

// 캐릭터 모드 카메라: 'first' = 1인칭(캐릭터 눈 위치), 'third' = 3인칭(뒤에서 따라감)
export const CAMERA_VIEW = 'third'

// ── 레벨 디자인 도우미 ───────────────────────
export const SHOW_GRID = false // 1m 격자 (레벨 디자인할 때 true)
export const SHOW_ZONES = true // 구역(BK/JM/HJ) 바닥·테두리·입구 아치·이름표·범례 (개발용)
export const SHOW_ZONE_OWNERS = true // false면 담당자 코드(BK/JM/HJ)를 숨기고 구역 이름만 (발표용)
export const SHOW_PLACE_LABELS = true // 상호작용 지점 이름표
export const PHYSICS_DEBUG = false // 충돌 박스·센서를 선으로 보기

// ── 캐릭터 ───────────────────────────────────
export const PLAYER_WALK_SPEED = 3 // 걷기 (m/s)
export const PLAYER_RUN_SPEED = 6 // 달리기, Shift (m/s)
export const PLAYER_JUMP_SPEED = 5 // 점프 힘
export const RESPAWN_Y = -5 // 이 높이 아래로 떨어지면 시작 지점으로

// ── 1인칭 카메라 ─────────────────────────────
export const EYE_HEIGHT = 0.6 // 캐릭터 중심에서 눈까지 높이 (눈높이 약 1.6m)
export const LOOK_SENSITIVITY = 0.004 // 마우스 드래그 회전 감도

// ── 3인칭 카메라 (CAMERA_VIEW = 'third') ─────
export const CAMERA_MIN_DISTANCE = 3
export const CAMERA_MAX_DISTANCE = 5

// ── 둘러보기 카메라 (FREE_CAMERA 모드) ───────
export const CAMERA_START = [0, 200, 170] // 광장 남쪽 위에서 맵 전체를 내려다봄
export const CAMERA_TARGET = [0, 0, 0]
export const CAMERA_MAX_ZOOM_OUT = 380

// 태양 방향 (하늘 빛번짐과 그림자 방향이 같이 바뀜)
export const SUN_POSITION = [90, 160, 60]

// ── 하늘 (파스텔) ────────────────────────────
export const SKY_COLORS = {
  top: '#4f9de8', // 머리 위 하늘
  middle: '#9ccdf8', // 중간
  horizon: '#d6eaf8', // 옅은 푸른 지평선
  sun: '#fff1c7', // 태양 빛번짐
  fog: '#d6eaf8', // 원경이 지평선에 자연스럽게 섞이는 색
  outerGround: '#c9dcb0', // 맵 바깥 풀밭
  cloudGlow: '#e5f3ff',
}
export const FOG_NEAR = 360 // 이 거리부터 안개가 시작 (m) — 맵 안은 선명하게, 바깥만 흐리게
export const FOG_FAR = 900 // 이 거리에서 완전히 지평선 색
export const SHOW_CLOUDS = true
export const CLOUDS_DRIFT = true // 구름이 천천히 흘러감
export const SHOW_MOUNTAINS = true // 맵 둘레 먼 산
export const SHADOW_AREA = 150 // 그림자가 생기는 범위 (중심에서 ±m)

// 상호작용 지점 타입별 색
export const PLACE_COLORS = {
  spot: '#ff8c42', // 촬영지: 주황
  cafe: '#8b5a2b', // 카페: 갈색
  npc: '#3b82f6', // NPC: 파랑
}
