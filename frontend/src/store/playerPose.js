// 미니맵이 읽는 캐릭터 위치·카메라 방향 (담당: 병관)
// 매 프레임 바뀌는 값이라 zustand 대신 그냥 객체에 씀 → 화면이 다시 그려지지 않아 가벼움
// 쓰는 곳: game/Map/CourseMarker.jsx 의 PlayerPoseTracker / 읽는 곳: components/minimap/Minimap.jsx
export const playerPose = {
  ready: false, // 플레이 중이라 캐릭터가 있으면 true
  x: 0,
  z: 14,
  dirX: 0, // 카메라가 보는 방향 (바닥 평면, 길이 1)
  dirZ: -1,
}

// 캐릭터에서 목적지까지 남은 거리 (바닥 기준 m, 높이 차이는 뺌). 캐릭터가 없으면 null
export function distanceTo(position) {
  if (!playerPose.ready || !position) return null
  return Math.hypot(position[0] - playerPose.x, position[2] - playerPose.z)
}

// 화면에 보여 줄 글자: 10m 아래는 "곧 도착", 1km 넘으면 km
export function formatDistance(meters) {
  if (meters == null) return ''
  if (meters < 10) return '곧 도착'
  if (meters >= 1000) return `${(meters / 1000).toFixed(1)}km`
  return `${Math.round(meters)}m`
}
