import { Vector3 } from 'three'

// SG 체험의 E키 감지 지점 (3D 파일이 마운트될 때 등록) → KpopGuide 워프 도착점. 담당: 성근(SG)
// 워프 코드의 '빈 땅 찾기'는 지붕 있는 세트 안·기둥 옆을 피해 멀리 내려서, 좌표를 직접 넘김 (useWarps.goto의 exact)
export const sgSpots = {}

/** 지점 기준 local 만큼 떨어진 바닥 좌표 [x, y, z]. 아직 맵이 안 그려졌으면 null */
export function spotWorld(name, local = [0, 0, 0]) {
  const obj = sgSpots[name]
  if (!obj) return null
  const p = obj.localToWorld(new Vector3(...local))
  return [p.x, p.y, p.z]
}
