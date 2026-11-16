// 맵 화면을 조절하는 스위치 모음. true/false나 숫자만 바꾸면 돼요.

export const SHOW_GRID = true // 레벨 디자인용 1m 격자
export const SHOW_ZONES = true // 구역(A~D) 바닥 색 띠와 이름표
export const SHOW_PLACE_LABELS = true // 상호작용 지점 이름표

// 태양 방향 (하늘 색과 그림자 방향이 같이 바뀜)
export const SUN_POSITION = [30, 40, 20]

// 처음 카메라 위치와 바라보는 곳
export const CAMERA_START = [-28, 42, 34]
export const CAMERA_TARGET = [0, 0, -2]

// 상호작용 지점 타입별 색
export const PLACE_COLORS = {
  spot: '#ff8c42', // 촬영지: 주황
  cafe: '#8b5a2b', // 카페: 갈색
  npc: '#3b82f6', // NPC: 파랑
}
