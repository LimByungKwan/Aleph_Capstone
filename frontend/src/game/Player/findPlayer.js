// 장면에서 캐릭터('player') 찾기 — 찾은 것은 모두가 같이 쓰고, 없을 때(둘러보기·맵 전체 보기)는 0.5초에 한 번만 장면 전체를 훑음
// (11/27 성능) 컴포넌트마다 매 프레임 따로 장면(약 3.5만 개)을 훑어서, 캐릭터가 없는 맵 전체 보기에서 프레임당 ~25ms를 썼음
let player = null
let lastSearch = -Infinity

export function findPlayer(scene) {
  if (player?.parent) return player
  const now = performance.now()
  if (now - lastSearch < 500) return null
  lastSearch = now
  player = scene.getObjectByName('player') ?? null
  return player
}
