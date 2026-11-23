import { DECK, FLOOR, GWANGHWAMUN_WOLDAE, MAIN_GATE, THRONE } from './gyeongbokgungLayout.js'
import { GYEONGSEONG_STATION, STREET_FLOOR, STREET_GATE, STREET_PRESS } from './gyeongseongLayout.js'
import { SPECIAL_IDS } from '../../../../components/movieZone/specialLocations.js'

// [3. 개발 > 프론트엔드] 두 층의 바닥·계단·표식이 동일한 좌표를 사용합니다.
export const PAVILION_Y = 2.605
export const LOFT_Y = 2.98
export const CENTRAL_HALL = { x: 23.9, z: 19.45, w: 9.6, d: 18.1, opening: 4.65, roofY: 6.45, floor: .175 }
export const ERA_BOUNDARY = (13.1 + STREET_GATE.z) / 2

const box = (x, z, w, d, base, top, color) => ({ x, z, w, d, base, top, color })
const wood = ['#956a43', '#a47a4c', '#9a7246']

// [7. 유지보수] 계단 끝을 위층 바닥의 실제 모서리에 맞추고, 충돌도 디딤판 두께에 맞춥니다.
function joinLanding(steps, landing, axis, direction) {
  const span = axis === 'x' ? 'w' : 'd'
  const last = steps.at(-1)
  const edge = landing[axis] - direction * landing[span]/2
  const extension = Math.max(0, (edge-last[axis])*direction - last[span]/2)
  return [...steps.slice(0,-1), { ...last, [axis]:last[axis] + direction*extension/2, [span]:last[span]+extension }]
}

function treadColliders(steps) {
  return steps.map((step, i) => ({ ...step, base:(steps[i-1]?.top ?? step.base)-.038 }))
}

export const PAVILION_PLATFORMS = [
  box(DECK.x, DECK.z - 1.9875, 13.3, 4.775, 2.325, PAVILION_Y, '#99513b'),
  box(DECK.x, DECK.z + 4.255, 13.3, .24, 2.325, PAVILION_Y, '#99513b'),
  box(DECK.x - 2.55, DECK.z + 2.2675, 8.20, 3.735, 2.325, PAVILION_Y, '#99513b'),
  box(DECK.x + 6.27, DECK.z + 2.2675, .76, 3.735, 2.325, PAVILION_Y, '#99513b'),
]
export const PAVILION_STEPS = joinLanding(Array.from({ length: 17 }, (_, i) =>
  box(DECK.x + 5.75 - i * .248, DECK.z + 2.2675, .25, 3.62, DECK.top,
    DECK.top + (i + 1) * (PAVILION_Y - DECK.top) / 18, wood[i % wood.length])), PAVILION_PLATFORMS[2], 'x', -1)
export const PAVILION_SUPPORTS = Array.from({ length:14 }, (_, i) => {
  const x = DECK.x + (i%7-3)*1.87
  const z = DECK.z + (i<7 ? -3.55 : 4.48)
  return [
    box(x,z,.53,.53,DECK.top,DECK.top+.25),
    box(x,z,.37,.37,DECK.top+.25,2.325),
    box(x,z,.53,.55,2.27,2.325),
  ]
}).flat()

const stationBox = (u, v, w, d, base, top, color) =>
  box(GYEONGSEONG_STATION.x + v, GYEONGSEONG_STATION.z - u, d, w, base, top, color)
export const STATION_PLATFORMS = [
  stationBox(0, 2.06, 15.47, 2.60, LOFT_Y - .18, LOFT_Y, '#795738'),
  stationBox(-2.155, -.35, 11.16, 2.23, LOFT_Y - .18, LOFT_Y, '#795738'),
  stationBox(7.43, -.35, .62, 2.23, LOFT_Y - .18, LOFT_Y, '#795738'),
]
export const STATION_STEPS = joinLanding(Array.from({ length: 21 }, (_, i) =>
  stationBox(5.265, -3.33 + i * .195, 3.60, .199, STREET_FLOOR,
    STREET_FLOOR + (i + 1) * (LOFT_Y - STREET_FLOOR) / 22, wood[i % wood.length])), STATION_PLATFORMS[0], 'x', 1)

export const RESIDENCE = { x:21.6, z:10.42, w:9.0, d:4.20, floor:.255, opening:3.65 }
export const PRISON = { x:-29.0, z:40.25, w:11.55, d:8.65 }
export const PRESS_FLOOR = 2.49
const pressBox = (u,v,w,d,base,top,color) => box(STREET_PRESS.x+u,STREET_PRESS.z+v,w,d,base,top,color)
export const PRESS_PLATFORMS = [
  pressBox(0,1.79,8.80,3.42,PRESS_FLOOR-.16,PRESS_FLOOR,'#74573e'),
  pressBox(1.735,-.64,5.07,1.45,PRESS_FLOOR-.16,PRESS_FLOOR,'#76583f'),
]
export const PRESS_STEPS = joinLanding(Array.from({ length:17 }, (_, i) =>
  pressBox(-2.655,-3.28+i*.198,3.63,.203,STREET_FLOOR,STREET_FLOOR+(i+1)*(PRESS_FLOOR-STREET_FLOOR)/18,wood[i%3])),
PRESS_PLATFORMS[0], 'z', 1)
export const PRESS_RAILS = [
  pressBox(1.735,-1.34,5.07,.13,PRESS_FLOOR,PRESS_FLOOR+.65,'#655343'),
  pressBox(-.73,-.64,.13,1.48,PRESS_FLOOR,PRESS_FLOOR+.65,'#655343'),
  pressBox(-4.41,1.23,.16,2.60,PRESS_FLOOR,PRESS_FLOOR+.75,'#655343'),
]

const rb = (u,v,w,d,base,top,c) => box(RESIDENCE.x+v,RESIDENCE.z-u,d,w,base,top,c)
const pw = (u,v,w,d,base,top,c) => box(PRISON.x+u,PRISON.z+v,w,d,base,top,c)
export const RESIDENCE_PARTS = [
  rb(0,0,RESIDENCE.d,RESIDENCE.w,FLOOR,RESIDENCE.floor,'#ac9d83'),
  rb(0,-RESIDENCE.w/2-.53,RESIDENCE.d,1.05,FLOOR,RESIDENCE.floor,'#957152'),
  rb(0,RESIDENCE.w/2,RESIDENCE.d,.26,RESIDENCE.floor,2.98,'#d0b895'),
  ...[-1,1].flatMap((side) => [
    rb(side*(RESIDENCE.d/2-.12),0,.24,RESIDENCE.w,RESIDENCE.floor,2.98,'#c6ac8a'),
    rb(side*(RESIDENCE.d+RESIDENCE.opening)/4,-RESIDENCE.w/2,(RESIDENCE.d-RESIDENCE.opening)/2,.26,RESIDENCE.floor,2.98,'#c6ac8a'),
  ]),
]
export const PRISON_FLOOR = pw(0,0,PRISON.w,PRISON.d,FLOOR,.152,'#978778')
export const PRISON_WALLS = [
  pw(0,PRISON.d/2,PRISON.w,.34,.15,3.30,'#7e5244'),
  ...[-1,1].flatMap((side) => [
    pw(side*5.64,.13,.33,8.35,.15,2.70,'#8e6050'),
    pw(side*3.91,-PRISON.d/2,3.38,.33,.15,2.70,'#8e6050'),
    { ...pw(side*2.34,1.63,.26,4.04,.15,1.99,'#a1735b'), yaw:side * .19 },
  ]),
]
export const PRISON_TOWER = { x:PRISON.x - 4.49, z:PRISON.z + 3.08 }
const PRISON_TOWER_BASE = { ...PRISON_TOWER, w:1.44,d:1.44,base:0,top:3.12 }

export const SPECIAL_MARKS = {
  [SPECIAL_IDS.throne]: { x: THRONE.x + .57, z: THRONE.z - .28, floor: THRONE.elevation + .07, yaw: -.22, radius: .78 },
  [SPECIAL_IDS.pavilion]: { x: DECK.x - .75, z: DECK.z + .20, floor: PAVILION_Y, yaw: .18, radius: 1.08 },
  [SPECIAL_IDS.residence]: { x:RESIDENCE.x-1.15,z:RESIDENCE.z,floor:RESIDENCE.floor,yaw:Math.PI/2,radius:.82 },
  [SPECIAL_IDS.gate]: { x:MAIN_GATE.x,z:MAIN_GATE.z-3.9,floor:GWANGHWAMUN_WOLDAE.top,yaw:0,radius:1.12 },
  [SPECIAL_IDS.central]: { x: CENTRAL_HALL.x - 3.65, z: CENTRAL_HALL.z, floor: CENTRAL_HALL.floor, yaw: Math.PI/2, radius: 1.15 },
  [SPECIAL_IDS.station]: { x: GYEONGSEONG_STATION.x + .77, z: GYEONGSEONG_STATION.z, floor: LOFT_Y, yaw: .08, radius: .88 },
  [SPECIAL_IDS.press]: { x:STREET_PRESS.x-.40,z:STREET_PRESS.z+1.25,floor:PRESS_FLOOR,yaw:0,radius:.80 },
  [SPECIAL_IDS.prison]: { x:PRISON.x,z:PRISON.z-1.48,floor:.153,yaw:0,radius:.88 },
}

const { x, z, w, d, floor, opening, roofY } = CENTRAL_HALL
const centralBox = (u, v, width, depth, base, top, color) => box(x+v,z-u,depth,width,base,top,color)
const wing = (w - opening) / 2
export const CENTRAL_HALL_BASE = centralBox(0,0,w+.22,d+.20,FLOOR,floor,'#cbb999')
export const CENTRAL_WALLS = [
  centralBox(0,d/2,w,.28,floor,roofY,'#c8b9a5'),
  ...[-1,1].flatMap((side) => [
    centralBox(side*(w/2-.14),0,.28,d,floor,roofY,'#b4a38e'),
    centralBox(side*(opening+wing)/2,-d/2,wing,.28,floor,roofY,'#c6b6a0'),
  ]),
  centralBox(0,-d/2,opening,.32,3.36,roofY,'#c6b6a0'),
]

export const CENTRAL_STAIRS = Array.from({ length: 8 }, (_, index) =>
  centralBox(0, 3.62 + index * .36, 3.85, .39, floor, floor + (index + 1) * .14, '#ccbb9e'))
export const CENTRAL_LANDING = centralBox(0, 7.05, 5.6, 1.77, floor, floor + 1.12, '#d6cab5')

export const LANDING_RAILS = [
  ...[-1,1].flatMap((side) => [
    box(DECK.x, DECK.z + 4.26*side, 12.5,.13,PAVILION_Y,PAVILION_Y+.65,'#624438'),
    box(DECK.x+6.21*side, DECK.z, .135,7.3,PAVILION_Y,PAVILION_Y+.65,'#624438'),
  ]),
  stationBox(-2.155,-1.40,11.16,.11,LOFT_Y,LOFT_Y+.69,'#654932'),
  stationBox(7.43,-1.40,.62,.11,LOFT_Y,LOFT_Y+.69,'#654932'),
  ...[3.42,7.13].map((u) => stationBox(u,-.36,.11,2.25,LOFT_Y,LOFT_Y+.69,'#654932')),
]

// [3. 개발 > 프론트엔드] 실내 판정은 월드 카메라가 아닌 플레이어 높이를 사용합니다.
const interiors = [
  { ...THRONE, floor:THRONE.elevation, ceiling:4.45, lightY:3.28, lightZ:.55, power:27 },
  { ...DECK, floor:DECK.top, ceiling:5.40, lightY:4.95, power:18 },
  { ...RESIDENCE, ceiling:3.09, lightY:2.34, lightX:1.7, power:18, camera:2.15 },
  { ...MAIN_GATE, floor:FLOOR, ceiling:3.2, lightY:2.55, power:14 },
  { ...CENTRAL_HALL, w:CENTRAL_HALL.d, d:CENTRAL_HALL.w, ceiling:CENTRAL_HALL.roofY, lightY:4.85, power:39 },
  { ...GYEONGSEONG_STATION, w:GYEONGSEONG_STATION.d, d:GYEONGSEONG_STATION.w,
    floor:LOFT_Y, ceiling:6.31, lightY:5.36, lightX:1.1, power:23, camera:2.35 },
  { ...GYEONGSEONG_STATION, w:GYEONGSEONG_STATION.d, d:GYEONGSEONG_STATION.w,
    floor:STREET_FLOOR, ceiling:LOFT_Y+.52, lightY:2.64, power:10 },
  { ...STREET_PRESS, floor:PRESS_FLOOR, ceiling:5.05, lightY:4.65, lightX:1.2, power:20, camera:1.9 },
  { ...STREET_PRESS, floor:STREET_FLOOR, ceiling:PRESS_FLOOR+.52, lightY:2.10, lightX:1.4, power:18 },
  { ...PRISON, floor:.152, ceiling:3.2, lightY:2.7, lightZ:-1.45, power:16 },
]
export const specialInteriorPresence = { room:null }

export function specialInteriorAt(x,y,z) {
  return interiors.find((room) => y >= room.floor+.52 && y < room.ceiling
    && Math.abs(x-room.x)<room.w/2 && Math.abs(z-room.z)<room.d/2) ?? null
}

export function specialAccessColliders(item) {
  const [ox, oz] = item.position
  return [
    ...PAVILION_PLATFORMS, ...treadColliders(PAVILION_STEPS), ...PAVILION_SUPPORTS, ...STATION_PLATFORMS, ...treadColliders(STATION_STEPS),
    ...PRESS_PLATFORMS, ...treadColliders(PRESS_STEPS), ...PRESS_RAILS, ...RESIDENCE_PARTS, PRISON_FLOOR, PRISON_TOWER_BASE, ...PRISON_WALLS,
    CENTRAL_HALL_BASE, ...CENTRAL_WALLS, ...CENTRAL_STAIRS, CENTRAL_LANDING, ...LANDING_RAILS,
  ].map((part, index) => {
    const { x,z,w,d,base,top,yaw = 0 } = part
    return {
      id: item.id + '/special-' + index, position:[ox+x,oz+z], size:[w,top-base,d],
      elevation:base, rotationDeg:yaw * 180/Math.PI,
      blocksCamera:CENTRAL_WALLS.includes(part) || PRISON_WALLS.includes(part) || part === PRISON_TOWER_BASE
        || (RESIDENCE_PARTS.includes(part) && top>2),
    }
  })
}

export function findSpecialMark(x, y, z, previousId) {
  for (const [id, mark] of Object.entries(SPECIAL_MARKS)) {
    const span = mark.radius + (id === previousId ? .4 : 0)
    const height = y - mark.floor
    if (height > .56 && height < 1.84 && (x-mark.x)**2 + (z-mark.z)**2 <= span**2) return id
  }
  return null
}
