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
