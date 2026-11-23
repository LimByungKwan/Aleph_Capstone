// [3. 개발 > 프론트엔드] 후원문에서 이어지는 1930년대 거리의 렌더링·충돌·지도 좌표.
export const STREET = { x: -8, z: 32.5, w: 80.4, d: 37, roadWidth: 8.4 }
export const STREET_GATE = { x: STREET.x, z: 16.4, post: 3.18 }
export const STREET_FLOOR = .22
export const TRAM = { x: -10.3, z: 42.5, w: 2.04, d: 6.8 }
export const STREET_CARS = [
  { x: -8.9, z: 31.7, color: '#243e48', turn: false },
  { x: -5.6, z: 42.8, color: '#474c37', turn: true },
]
export const STREET_MARKET = [
  { x: -14.7, z: 31, color: '#ad5944', accent: '#dac2a0' },
  { x: -15.1, z: 43, color: '#5a7668', accent: '#ddd0a8' },
  { x: -1.1, z: 33.8, color: '#a07b41', accent: '#e0cba0' },
  { x: 13.4, z: 33.45, color: '#ad614b', accent: '#dabc99' },
  { x: 18.2, z: 33.45, color: '#627d72', accent: '#d1c7a3' },
  { x: -27.2, z: 29.4, color: '#927347', accent: '#d0ba98' },
]
export const STREET_TREES = [[-1.15, 20, 1.18], [-1.3, 29.5, .82], [-1.55, 47.9, .75], [-28.8, 19.4, 1], [-29.5, 34.6, .86], [37.35, 19.3, 1.1], [18.1, 42.8, .92], [30.9, 45.3, 1]]
export const GYEONGSEONG_STATION = {
  name: '1932 경성역', kind: 'station', x: 33.45, z: 34.55, w: 16.2, d: 7.35, h: 6.15, yaw: 90, paint: '#9d624e',
}
export const STREET_PRESS = { name:'청운 인쇄소', kind:'studio', press:true, x:21.4, z:28.40, w:9.3, d:7.3, h:4.85, yaw:0, paint:'#a68568' }

export const STREET_BUILDINGS = [
  { name: '경성사진관', kind: 'stoneStudio', x: -18.85, z: 24.2, w: 11.5, d: 7.75, h: 7.65, yaw: -90, paint: '#b8b2a1' },
  { name: '월영각', kind: 'restaurant', x: 4.7, z: 24.7, w: 11.4, d: 8.2, h: 5.25, yaw: 90, paint: '#9f7454' },
  { name: '새벽양품점', kind: 'shop', x: -18.75, z: 36.1, w: 8.5, d: 6.4, h: 4.7, yaw: -90, paint: '#bda382' },
  { name: '은하극장', kind: 'cinema', x: 5.65, z: 43.3, w: 11.5, d: 8.4, h: 6.8, yaw: 90, paint: '#c7bdaf' },
  { name: '은방울 다방', kind: 'shop', x: -18.25, z: 46, w: 6.45, d: 6.2, h: 4.15, yaw: -90, paint: '#b1936e' },
  STREET_PRESS,
  { name: '경성 전차 정류장', kind: 'stop', x: .18, z: 36.85, w: 3.2, d: 1.25, h: 2.7, yaw: 90, paint: '#526456' },
  { name: '유성 시계점', kind: 'shop', x: -26.8, z: 23.8, w: 6.7, d: 6.2, h: 4.6, yaw: 0, paint: '#ada388' },
  { name: '백운 여관', kind: 'restaurant', x: 21.6, z: 42.15, w: 9.1, d: 7.1, h: 5.02, yaw: 0, paint: '#a39175' },
  GYEONGSEONG_STATION,
]

export const STREET_ALLEYS = [
  [-30, 26.7, 12.2, 2.75], [-35.4, 36.15, 2.8, 19.6], [-28.8, 45.4, 13.4, 2.8],
  [14.8, 34.9, 30.4, 3.6], [25.5, 42.3, 3.2, 15.0], [29.4, 47.7, 12.4, 2.8],
  [27.9, GYEONGSEONG_STATION.z, 3.80, 8.52],
  [2.89,17.36,22.3,2.40], [12.8,19.45,4.35,4.90],
]
export const ALLEY_BENCH = { x: -38.10, z: 41.05, w: .59, d: 2.04 }

export function streetShell({ w, d, h, kind, press }) {
  const opening = kind === 'station' ? 4.0 : press ? 3.75 : Math.min(2.48, w * .48)
  const doorHeight = kind === 'station' ? 2.95 : 2.48
  const wing = (w - opening) / 2
  const walls = [
    { x: 0, z: d / 2 - .13, w, d: .25, h },
    ...[-1, 1].flatMap((side) => [
      ...(side < 0 && press ? [
        { x: -w/2+.13, z:0, w:.26,d:d-.49,h:2.29 },
        { x: -w/2+.13, z:-1.81,w:.26,d:3.20,h:h-2.29,base:2.29 },
        { x: -w/2+.13, z:3.19,w:.26,d:.43,h:h-2.29,base:2.29 },
      ] : [{ x:side*(w/2-.13),z:0,w:.26,d:d-.49,h }]),
      { x: side * (opening + wing) / 2, z: -d / 2 + .13, w: wing, d: .26, h },
    ]),
  ]
  return { opening, doorHeight, walls }
}

export function streetFootprint(site) {
  return [site.x, site.z, ...(site.yaw ? [site.d, site.w] : [site.w, site.d])]
}

export function streetColliders(add) {
  for (const building of STREET_BUILDINGS) {
    if (building.kind === 'stop') continue
    const { x, z, yaw, w, d, h } = building
    const turn = Math.sign(yaw)
    const box = (u, v, width, height, depth, y, camera = false) =>
      add(x + (turn ? v * turn : u), z + (turn ? -u * turn : v),
        turn ? depth : width, height, turn ? width : depth, y, camera)
    const { walls, opening, doorHeight } = streetShell(building)
    box(0, 0, w + .20, .115, d + .20, .105)
    box(0, -d / 2 - .23, opening + .2, .09, .42, .105)
    for (const wall of walls) box(wall.x, wall.z, wall.w, wall.h, wall.d, STREET_FLOOR + (wall.base ?? 0), true)
    box(0, -d / 2 + .13, opening, h - doorHeight, .25, STREET_FLOOR + doorHeight, true)
    if (building.kind === 'station') {
      const counterZ = d / 2 - 1.22
      box(0, counterZ, 4.84, 1.04, .81, STREET_FLOOR)
      for (const side of [-1,1]) box(side*4.85, counterZ-.50, 2.36, .93, .58, STREET_FLOOR)
    }
  }
  for (const side of [-1, 1]) {
    add(STREET_GATE.x + side * STREET_GATE.post, STREET_GATE.z, .39, 3.25, .50, .105)
    add(side * (STREET.w / 2), STREET.z, .45, 1.45, STREET.d, .105)
  }
  add(TRAM.x, TRAM.z, TRAM.w, 2.82, TRAM.d, .105, true)
  for (const { x, z } of STREET_CARS) add(x, z, 1.6, 1.69, 3.8, .16, true)
  for (const { x, z } of STREET_MARKET) add(x, z, 2.1, 1, 1.32, .16)
  for (const [x, z, scale] of STREET_TREES) add(x, z, .46 * scale, 2.6 * scale, .46 * scale, .16)
  add(ALLEY_BENCH.x, ALLEY_BENCH.z, ALLEY_BENCH.w, .72, ALLEY_BENCH.d, .16)
  add(0, STREET.z + STREET.d / 2 - .35, STREET.w, 1.45, .46, .105)
}
