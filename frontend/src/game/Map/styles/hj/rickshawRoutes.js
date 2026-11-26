// [2. 설계 > 화면 설계] 인력거 길 (혜진 영화·드라마 구역 → 중앙 광장 → 애니메이션 구역 입구)
// 길목(노드)과 그 사이 길(엣지). 인력거는 목적지까지 길목을 따라 가장 짧은 길로 달려요.
// 좌표는 월드 좌표 [x, z]. 길·인도를 따라가고, 건물·나무·시계탑을 비켜 가도록 길목을 잡았어요.
//
//  [경성]  경성역 ─ 큰길 사거리 ─ 동대문          조선총독부
//                    │      └─ 총독부 대로 입구 ──┘
//               시계탑 광장
//                    │
//  신무문 앞 ── 궁궐 뒤 길목 ── 궁궐 북동 모서리
//                                   │ (궁궐 동쪽 길)
//  광화문 앞 ─────────────── 궁궐 남동 모서리
//      │ (영화·드라마 구역 입구 → 중앙 광장 길)
//  광장 북쪽 → 광장 동쪽(시계탑 비켜 감) → 광장 남쪽 → 애니메이션 구역 입구

export const NODES = {
  // 경성 거리
  station: { pos: [-21, 244.5], name: '경성역' }, // 역 건물 앞 기둥에 인력거꾼이 가리지 않게 조금 떨어져 서요
  cross: { pos: [8.6, 244.5], name: '큰길 사거리' },
  east: { pos: [27.5, 244.5], name: '동대문' },
  avenue: { pos: [-2.6, 246.6], name: '총독부 대로 입구' },
  gov: { pos: [-2.6, 282.5], name: '조선총독부' },
  plaza: { pos: [8.6, 235.5], name: '시계탑 광장' },
  // 궁궐 둘레
  palaceBack: { pos: [8.6, 160.6], name: '궁궐 뒤 길' },
  sinmu: { pos: [0, 160.4], name: '신무문 (경복궁 뒷문)' },
  palaceNE: { pos: [38.8, 160.6], name: '궁궐 북동 모서리' },
  palaceSE: { pos: [38.8, 48.8], name: '궁궐 남동 모서리' },
  gwanghwamun: { pos: [0, 48.8], name: '광화문 (경복궁 정문)' },
  // 중앙 광장 (시계탑을 동쪽으로 비켜 가요)
  hubNorth: { pos: [0, 26], name: '중앙 광장 북쪽' },
  hubEast: { pos: [10.5, 12], name: '중앙 광장 동쪽' },
  hub: { pos: [10.5, 0], name: '중앙 광장' },
  hubSouth: { pos: [10.5, -12], name: '중앙 광장 남쪽' },
  hubSouthGate: { pos: [0, -26], name: '애니메이션 구역 가는 길' }, // 광장 가로등을 비켜 길 가운데로
  anime: { pos: [0, -41.5], name: '애니메이션 구역 입구' },
}

const EDGES = [
  ['plaza', 'cross'],
  ['cross', 'station'],
  ['cross', 'east'],
  ['cross', 'avenue'],
  ['avenue', 'gov'],
  ['plaza', 'palaceBack'],
  ['palaceBack', 'sinmu'],
  ['palaceBack', 'palaceNE'],
  ['palaceNE', 'palaceSE'],
  ['palaceSE', 'gwanghwamun'],
  ['gwanghwamun', 'hubNorth'],
  ['hubNorth', 'hubEast'],
  ['hubEast', 'hub'],
  ['hub', 'hubSouth'],
  ['hubSouth', 'hubSouthGate'],
  ['hubSouthGate', 'anime'],
]

// 손님이 고를 수 있는 목적지 (메뉴 순서)
export const DESTINATIONS = ['station', 'gov', 'east', 'plaza', 'sinmu', 'gwanghwamun', 'hub', 'anime']

const links = {}
for (const [a, b] of EDGES) {
  ;(links[a] ??= []).push(b)
  ;(links[b] ??= []).push(a)
}
const dist = (a, b) => Math.hypot(NODES[a].pos[0] - NODES[b].pos[0], NODES[a].pos[1] - NODES[b].pos[1])

// 가장 짧은 길 (길목 id 목록). 길목이 적어서 단순 다익스트라로 충분해요
export function findPath(from, to) {
  if (from === to) return [from]
  const best = { [from]: 0 }
  const prev = {}
  const open = new Set([from])
  while (open.size) {
    let cur = null
    for (const n of open) if (cur === null || best[n] < best[cur]) cur = n
    open.delete(cur)
    if (cur === to) break
    for (const next of links[cur] ?? []) {
      const d = best[cur] + dist(cur, next)
      if (d < (best[next] ?? Infinity)) {
        best[next] = d
        prev[next] = cur
        open.add(next)
      }
    }
  }
  const path = [to]
  while (path[0] !== from) {
    const p = prev[path[0]]
    if (!p) return [from]
    path.unshift(p)
  }
  return path
}
