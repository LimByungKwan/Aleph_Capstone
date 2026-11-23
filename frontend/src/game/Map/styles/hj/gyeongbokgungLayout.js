import { STREET_BUILDINGS, STREET_FLOOR, STREET_GATE, streetColliders } from './gyeongseongLayout.js'

// [3. 개발 > 프론트엔드] 광화문·근정전 중심의 궁궐과 뒤편 경성을 잇는 관람 동선.
export const FLOOR = .105
export const AXIS = -8
export const THRONE = { name: '근정전', x: AXIS, z: -11.65, w: 15.8, d: 8.9, h: 4.25, upper: true, elevation: .95 }
export const ROOM_SCALE = [1.02, 1, 1.24]
export const MAIN_GATE = { name: '광화문', x: AXIS, z: -43.8, w: 17, d: 5.4 }
export const MAIN_ARCH_RADIUS = 1.91
export const GWANGHWAMUN_WOLDAE = { x: AXIS, z: -48.56, w: 6.4, d: 4.23, base: 0, top: .23 }
export const THRONE_DOOR_WIDTH = 3.72
export const FILM_ENTRANCE = { x: AXIS, z: -51.2, post: 3.25, boardX: AXIS + 5.92, boardZ: -50.9 }
export const HALLS = [
  THRONE,
  { name: '수정전', x: -27.6, z: -25.5, w: 8.2, d: 4.5, h: 3.12 },
  { name: '사정전', x: AXIS, z: .65, w: 10.8, d: 4.05, h: 3.38 },
  { name: '집옥재', x: -25.45, z: 7.4, w: 9.7, d: 5.3, h: 3.65, masonry: true },
  { name: '자선당', x: 18.1, z: -12.3, w: 10.2, d: 5.25, h: 3.32 },
  { name: '교태전', x: 18.25, z: 4.7, w: 11.15, d: 5.4, h: 3.44 },
]

export const PONDS = [{ x: -29.15, z: -11.9, w: 17.2, d: 18.7, entry: 1 }]
export const CHANNELS = [[-17.95,-29.2,14.2,1.8], [2.0,-29.2,14.2,1.8]]
export const POND_SURFACE = .166
export const BRIDGES = [
  { x: -21.3, z: -11.9, w: 6.2, d: 3.85, top: .28, name: '경회루 다리' },
  { x: AXIS, z: -29.2, w: 5.8, d: 3.5, top: .24, vertical: true, name: '영제교' },
]
export const DECK = { x: -29.4, z: -11.9, w: 12.55, d: 9.8, top: .44 }

export const WALLS = []
function wall(x, z, length, { vertical = false, gap = 0, type = 'gallery' } = {}) {
  if (!gap) {
    WALLS.push({ x, z, length, vertical, type })
    return
  }
  const span = (length - gap) / 2
  for (const side of [-1, 1]) {
    const off = side * (gap + span) / 2
    WALLS.push({ x: x + (vertical ? 0 : off), z: z + (vertical ? off : 0), length: span, vertical, type })
  }
}

export const GATES = [
  { name: '흥례문', x: AXIS, z: -33.4, w: 8.4, d: 3.4, upper: true },
  { name: '근정문', x: AXIS, z: -23.6, w: 7.8, d: 3.15, upper: true },
  { name: '사정문', x: AXIS, z: -3.2, w: 5.25, d: 1.6 },
  { name: '동궁', x: 18.1, z: -19.55, w: 4.45 },
  { name: '후원문', x: AXIS, z: 13.1, w: 5.2, d: 1.65 },
]

wall(-28.48, MAIN_GATE.z, 23.97, { type: 'outer' })
wall(20.45, MAIN_GATE.z, 39.9, { type: 'outer' })
wall(-40.45, -15.35, 56.85, { vertical: true, type: 'outer' })
wall(40.45, -15.35, 56.85, { vertical: true, type: 'outer' })
wall(-25.55, 13.1, 29.8, { type: 'outer' })
wall(17.55, 13.1, 45.9, { type: 'outer' })
wall(-8, -33.4, 34.7, { gap: 8.4, type: 'court' })
wall(-8, -23.6, 30.4, { gap: 7.8, type: 'court' })
wall(-20.55, -18.63, 9.95, { vertical: true, type: 'court' })
wall(-20.55, -6.65, 6.9, { vertical: true, type: 'court' })
wall(7.2, -14.9, 17.4, { vertical: true, gap: 3.4 })
wall(-9.53, -3.2, 23.9, { gap: 5.25, type: 'court' })
wall(18.1, -19.55, 19.1, { gap: 4.45 })
wall(27.65,-10.37,18.36, { vertical: true, gap: 3.2 })
wall(18.1,-1.2,19.1, { gap: 4.0 })
wall(28.6,5.05,12.5, { vertical: true, type: 'court' })

export const COURTS = [
  [AXIS,-38.4,36,9.7], [AXIS,-28.4,29.5,9.5], [AXIS,-13.5,28.8,19],
  [AXIS,4.6,20.2,13.8], [18.1,-10.4,18.7,17.9], [18.25,5.9,18.8,12.4],
  [-25.45,7.1,15.15,10.15],[-27.6,-25.2,11.8,6.9],
]
export const WALKS = [
  [AXIS,-38.8,5.5,23.9], [AXIS,-21.25,4.62,8.5],
  [3.95,-8.1,2.7,24.0], [5.15,6.25,2.66,9.0], [-1.42,10.3,14.05,2.65],
  [AXIS,14,5.1,8.2], [-8,6.19,4.2,2.4],
  [-25.87,2.45,24.7,2.35], [-24.0,-11.9,11.25,2.62], [-35.3,-1.5,2.35,17.2],
  [18.1,-18.3,3.3,8.6], [18.2,-.81,3.25,9.5], [26.6,-26.8,3.15,24.4],
  [1.0,-35.5,16.3,2.6], [16.45,-35.55,18.25,2.7], [-23.5,-35.15,16.6,2.8],
]
export const THRONE_PLATFORMS = [
  { x: AXIS, z: THRONE.z, w: 21.7, d: 14.75, top: .53 },
  { x: AXIS, z: THRONE.z + .24, w: 18.2, d: 11.85, top: .95 },
]
export const THRONE_STAIRS = Array.from({ length: 5 }, (_, index) => ({
  x: AXIS, z: THRONE.z - 9.05 + index * .59, w: 4.7, d: .69, top: .25 + index * .144,
})).concat(Array.from({ length: 4 }, (_, index) => ({
  x: AXIS, z: THRONE.z - 6.08 + index * .34, w: 4.05, d: .37, top: .61 + index * .102,
})))

export const PALACE_DRAMA_SETS = [
  { title: '홍천기', place: '집옥재', theme: '화공의 작업실', color: '#8f4039' },
  { title: '동궁', place: '자선당', theme: '달빛이 드는 세자궁', color: '#554170' },
  { title: '슈룹', place: '교태전', theme: '중전의 전각', color: '#276757' },
].map((set) => {
  const hall = HALLS.find(({ name }) => name === set.place)
  return { ...set, x: hall.x, z: hall.z, signX: hall.x + 2.7, signZ: hall.z - hall.d / 2 - .46 }
})

export const PALACE_ACTIVITIES = [
  { id: 'archery', name: '활쏘기 뜰', title: '활쏘기', x: -31.1, z: -35.25, w: 8.45, d: 7.2, elevation: FLOOR, color: '#8c5033' },
  { id: 'tuho', name: '투호 마당', title: '궁중 투호', x: 25.6, z: -35.65, w: 7.5, d: 6.9, elevation: FLOOR, color: '#38665b' },
]
export const TOUR_STOPS = [
  { ...MAIN_GATE, elevation: FLOOR, group: '궁문과 정전' },
  ...GATES.map((gate) => ({ ...gate, elevation: FLOOR, group: '궁문과 정전' })),
  ...HALLS.map((hall) => ({ ...hall, elevation: hall.elevation ?? .33, group: '주요 전각' })),
  { name: '경회루', ...DECK, elevation: DECK.top, group: '주요 전각' },
  ...PALACE_ACTIVITIES.map((activity) => ({ ...activity, group: '궁중 놀이' })),
  { name: '1938 거리 입구', x: STREET_GATE.x, z: STREET_GATE.z, w: 5.4, d: 1.55, elevation: FLOOR, group: '1938 경성 거리' },
  ...STREET_BUILDINGS.map((site) => ({ ...site, yaw: site.yaw * Math.PI / 180, elevation: site.kind === 'stop' ? FLOOR : STREET_FLOOR, group: '1938 경성 거리' })),
]

export const TOUR_ROUTES = [
  { name: '정전길', color: '#9d5541', points: [[AXIS,-47],[AXIS,-23.6],[AXIS,-20.5]] },
  { name: '경회루길', color: '#36776c', points: [[3.95,-22.25],[3.95,-3.8],[-19.55,-3.85],[-19.55,-11.9],[-29.4,-11.9]] },
  { name: '경성길', color: '#7e5535', points: [[3.95,-17.0],[3.95,10.25],[AXIS,10.25],[AXIS,16.4],[-5.1,21],[-5.1,47.6]] },
]
export const TOUR_SIGNS = [
  { x: -4.3, z: -37.1, name: '근정전 ↑', yaw: Math.PI },
  { x: 5.6, z: -20.55, name: '경성 거리 ↑', yaw: Math.PI },
  { x: 5.5, z: -2.1, name: '경회루 ←', yaw: Math.PI },
  { x: -4.65, z: 10.25, name: '경성 1938 ↑', yaw: Math.PI },
  { x: 12.8, z: -20.6, name: '동궁 ↗', yaw: Math.PI },
]

export function pondEdges({ x, z, w, d, entry, alongZ = false, bothBanks = false }) {
  const gap = 4.01
  const length = ((alongZ ? w : d) - gap) / 2
  return [
    { x: x - (alongZ ? w / 2 : 0), z: z - (alongZ ? 0 : d / 2), length: alongZ ? d : w, vertical: alongZ },
    { x: x + (alongZ ? w / 2 : 0), z: z + (alongZ ? 0 : d / 2), length: alongZ ? d : w, vertical: alongZ },
    ...[-1, 1].flatMap((bank) => {
      const edgeX = x + (alongZ ? 0 : bank * w / 2)
      const edgeZ = z - (alongZ ? bank * d / 2 : 0)
      if (!bothBanks && bank !== entry) return [{ x: edgeX, z: edgeZ, length: alongZ ? w : d, vertical: !alongZ }]
      return [-1, 1].map((side) => {
        const offset = side * (gap + length) / 2
        return { x: edgeX + (alongZ ? offset : 0), z: edgeZ + (alongZ ? 0 : offset), length, vertical: !alongZ }
      })
    }),
  ]
}

export function hallFooting({ x, z, w, d, elevation = 0.33 }) {
  return { x, z, w: w + 0.7, d: d + 0.75, top: elevation }
}

export function hallSteps({ x, z, w, d, elevation = .33 }) {
  const rises = Math.ceil((elevation - FLOOR) / .13)
  return Array.from({ length: rises - 1 }, (_, i) => ({
    x, z: z - d / 2 - .36 - (rises - i - 1) * .34 + .16,
    w: Math.min(2.85, w * .66), d: .365, top: FLOOR + (elevation - FLOOR) * (i + 1) / rises,
  }))
}

export function hallBays(width) {
  const count = Math.max(3, Math.round(width / 1.83))
  return count + (1 - count % 2)
}

// The shell and the physics use the same front opening and room measurements.
export function hallWalls(hall) {
  const { x, z, w, d, h, elevation = .33 } = hall
  const span = w * .91
  const doorway = Math.max(.83, span / hallBays(w) - .27)
  const wing = (span - doorway) / 2
  const height = h * .91
  return [
    { x, z: z + d * .448, w: span, d: .15, height, elevation },
    ...[-1, 1].flatMap((side) => [
      { x: x + side * w * .447, z, w: .15, d: d * .9, height, elevation },
      { x: x + side * (doorway + wing) / 2, z: z - d * .444, w: wing, d: .16, height, elevation },
    ]),
  ]
}

function roomColliders(add) {
  const [sx, sy, sz] = ROOM_SCALE
  const put = (x, z, w, h, d, y, blocksCamera = false) =>
    add(THRONE.x + x * sx, THRONE.z + z * sz, w * sx, h * sy, d * sz, THRONE.elevation + y * sy, blocksCamera)
  put(0, 0, 13.2, .12, 6.56, -.055)
  put(0, 3.18, 13.2, 3.44, .20, 0, true)
  const wingWidth = (13.2 - THRONE_DOOR_WIDTH) / 2
  put(0, -3.18, THRONE_DOOR_WIDTH, .83, .20, 2.615, true)
  for (const side of [-1, 1]) {
    put(side * 6.50, 0, .20, 3.44, 6.56, 0, true)
    put(side * (wingWidth + THRONE_DOOR_WIDTH) / 2, -3.18, wingWidth, 3.44, .20, 0, true)
    for (const z of [-1.83, 1.43]) put(side * 3.15, z, .52, 2.78, .52, .16)
    put(side * 2.60, -1.86, .42, .94, .41, .065)
    put(side * 2.75, 1.61, .42, .94, .41, .065)
  }
  put(0, 2.02, 5.8, .355, 2.15, .0645)
  put(0, .82, 2.0, .21, .37, .065)
  put(0, 2.95, 5.59, 2.22, .12, .43)
}

export function palaceGroundsColliders(item) {
  const boxes = []
  const [ox, oz] = item.position
  const [width, thickness, depth] = item.size
  const add = (x, z, w, h, d, elevation = FLOOR, blocksCamera = false) => {
    boxes.push({ id: item.id + '/' + boxes.length, position: [ox + x, oz + z], size: [w, h, d], elevation, blocksCamera })
  }
  const deck = ({ x, z, w, d, top }, base = FLOOR) => add(x, z, w, top - base, d, base)
  add(0, 0, width, thickness, depth, FLOOR - thickness)
  for (const side of [-1, 1]) add(FILM_ENTRANCE.x + side * FILM_ENTRANCE.post, FILM_ENTRANCE.z, .54, 3.67, .62, 0)
  add(FILM_ENTRANCE.boardX, FILM_ENTRANCE.boardZ, 2.17, 2.62, .38, 0)
  for (const { x, z, w, d } of PALACE_ACTIVITIES) {
    add(x, z + d / 2 - .55, w * .81, 1.15, .44)
  }
  for (const { x, z, length, vertical, type } of WALLS) {
    const thick = type === 'gallery' ? 1.34 : 0.56
    add(x, z, vertical ? thick : length, type === 'gallery' ? 2.12 : 1.77, vertical ? length : thick, FLOOR, true)
  }
  for (const { x, z, w, d = 1.95, yaw = 0, closed } of GATES) {
    for (const side of [-1, 1]) {
      const off = side * w * .425
      add(x + off * Math.cos(yaw), z - off * Math.sin(yaw), yaw ? d : 0.59, 2.74, yaw ? .59 : d)
    }
    if (closed) add(x, z, w, 2.7, .30, FLOOR, true)
  }
  for (const [lo, hi] of [[-8.5, -6.67], [-4.16, -MAIN_ARCH_RADIUS], [MAIN_ARCH_RADIUS, 4.16], [6.67, 8.5]]) {
    add(MAIN_GATE.x + (lo + hi) / 2, MAIN_GATE.z, hi - lo, 3.13, MAIN_GATE.d, FLOOR, true)
  }
  deck(GWANGHWAMUN_WOLDAE, 0)
  for (const side of [-1, 1]) {
    const { x,z,w,d,top } = GWANGHWAMUN_WOLDAE
    add(x + side*(w/2-.12),z,.24,.55,d,top)
  }
  for (const hall of HALLS) {
    if (hall === THRONE) continue
    deck(hallFooting(hall))
    for (const step of hallSteps(hall)) deck(step)
    for (const wall of hallWalls(hall)) add(wall.x, wall.z, wall.w, wall.height, wall.d, wall.elevation, true)
  }
  for (const platform of [...THRONE_PLATFORMS, ...THRONE_STAIRS]) deck(platform)
  roomColliders(add)
  for (const pond of PONDS) {
    for (const { x, z, length, vertical } of pondEdges(pond)) {
      add(x, z, vertical ? 0.38 : length, 0.56, vertical ? length : 0.38)
    }
  }
  for (const bridge of BRIDGES) {
    deck(bridge)
    for (const side of [-1, 1]) {
      const { x, z, w, d, vertical, top } = bridge
      add(x + (vertical ? side * (w / 2 - .08) : 0), z + (vertical ? 0 : side * (d / 2 - .08)),
        vertical ? .15 : w, .43, vertical ? d : .15, top)
    }
  }
  deck(DECK)
  streetColliders(add)
  return boxes
}
