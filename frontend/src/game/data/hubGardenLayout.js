import { CatmullRomCurve3, Vector3 } from 'three'

export const HUB_GARDEN_STONE = '#e4d5bb'
export const HUB_GARDEN_BORDER = '#ab8171'

const promenades = {
  northwest: [[0, -38], [-8, -38], [-15, -35], [-21.5, -28.8], [-27, -27], [-35, -25], [-38, -20], [-38, 0]],
  northeast: [[0, -38], [11, -38], [20, -37.6], [24.7, -35], [26.2, -29], [31.2, -24], [31, -13], [35, -5], [38, 0]],
  southwest: [[0, 38], [-7, 38], [-13, 33.6], [-18, 32.8], [-26, 35.4], [-34, 38.8], [-39, 34], [-38.5, 22], [-38, 0]],
  southeast: [[0, 38], [10, 38], [20, 34.5], [25, 31], [29.5, 28.9], [34, 25], [38, 17], [38, 0]],
}

function promenade(id, points) {
  const curve = new CatmullRomCurve3(points.map(([x, z]) => new Vector3(x, 0, z)))
  const sampleCount = Math.ceil(curve.getLength() * 2)
  return {
    id: 'hub_promenade_' + id, style: 'hubPromenade', position: [0, 0], size: [80, .04, 80],
    collider: false, ribbon: { width: 3.25, points: curve.getSpacedPoints(sampleCount).map(({ x, z }) => [x, z]) },
  }
}

function seatingCourt(id, x, z, [sideX, sideZ], rotationDeg) {
  const place = (offset, across = 0) => [x + sideX * offset - sideZ * across, z + sideZ * offset + sideX * across]
  return [
    { id: `hub_court_${id}`, style: 'hubGardenCourt', position: [x, z], size: [8.6, .07, 8.6], collider: false },
    { id: `hub_seat_${id}`, style: 'bench', position: place(3.15), size: [2.9, .9, .65], rotationDeg, elevation: .068 },
    { id: `hub_bed_${id}`, style: 'flowerBed', position: place(4.25), size: [3.15, .46, .85], rotationDeg, color: '#a98976' },
    ...[-1, 1].map((side) => ({
      id: `hub_court_light_${id}_${side}`, style: 'hubGardenLantern', position: place(2.9, side * 2.5),
      size: [.34, .96, .34], elevation: .068,
    })),
  ]
}

const DIAGONAL = Math.SQRT1_2

const PALETTES = {
  rose: ['#f17d96', '#f7b4b5', '#fff1d5'],
  lilac: ['#9276bd', '#b29ed8', '#f2d7e9'],
  gold: ['#e8a849', '#f5d678', '#fff1be'],
}

// 석재 산책로와 기존 시설 사이의 빈 잔디를 정원으로 묶습니다.
const planting = [
  { center: [-9.6, -30.7], size: [7.7, 5.1], trees: ['linden', 'maple'], color: 'gold' },
  { center: [-30.2, -13.2], size: [7.8, 8.1], trees: ['oak', 'linden', 'maple'], color: 'lilac' },
  { center: [-35.9, -31.1], size: [6.9, 4], trees: ['maple'], color: 'gold' },
  { center: [10.8, -27.6], size: [8.6, 4.6], trees: ['maple', 'linden'], color: 'rose' },
  { center: [38.2, -10.2], size: [6.2, 6.5], trees: ['linden', 'oak'], color: 'gold' },
  { center: [39.4, -37.4], size: [7.1, 4.5], trees: ['oak'], color: 'lilac' },
  { center: [-9.3, 29.1], size: [7.7, 4.9], trees: ['linden', 'maple'], color: 'rose' },
  { center: [-29.4, 12.9], size: [7.9, 7.8], trees: ['maple', 'oak', 'linden'], color: 'gold' },
  { center: [-26.6, 40.4], size: [6.3, 2.9], trees: ['oak'], color: 'lilac' },
  { center: [8.9, 30.6], size: [7.9, 6.6], trees: ['maple', 'oak', 'linden'], color: 'rose' },
  { center: [30.5, 10.5], size: [7.4, 7.7], trees: ['linden', 'maple'], color: 'lilac' },
  { center: [37.7, 39.2], size: [5.8, 4.5], trees: [], color: 'rose' },
  ...[-1, 1].flatMap((x) => [-1, 1].map((z) => ({
    center: [x * 10.4, z * 17.2], size: [4.5, 2.55], trees: [], color: x === z ? 'lilac' : 'gold', elevation: .12,
  }))),
]

function gardenPlanting({ center: [x, z], size: [w, d], trees, color, elevation = .02 }, index) {
  const id = `hub_planting_${index}`
  const palette = PALETTES[color]
  const features = [
    ...[[-.28, .15], [.28, .14], [-.22, -.22], [.22, -.22], [0, .27]].map(([a, b]) => ({
      t: 'flowers', p: [a * w, b * d], r: Math.min(w, d) * .16, n: 16, palette, blossomScale: 1.45,
    })),
    ...[[-.35, 0], [.34, .03], [0, -.28]].map(([a, b], i) => ({
      t: 'bush', p: [a * w, b * d], s: d > 4 ? .78 + i * .12 : .56, flowers: true, palette,
    })),
    { t: 'rock', p: [-w * .13, -d * .31], s: .85 },
    { t: 'grass', p: [w * .1, -d * .3], s: 1.2 },
  ]
  const trunkSpots = trees.length === 1 ? [[0, 0]] : [[-.24, -.06], [.23, .02], [0, -.27]]
  return [
    { id, style: 'hubPlantingBed', position: [x, z], size: [w, .02, d], elevation: elevation + .009, collider: false },
    { id: id + '_plants', style: 'landscape', position: [x, z], size: [w, 1.2, d], elevation: elevation + .018, collider: false, features },
    ...trees.map((kind, i) => {
      const [a, b] = trunkSpots[i]
      const height = [5.2, 4.3, 3.6][i]
      return {
        id: `${id}_tree_${i}`, style: 'hjTree', kind, position: [x + w * a, z + d * b], elevation,
        size: [height * .64, height, height * .64], collider: [.34, 2.6, .34],
      }
    }),
  ]
}

const picnicNooks = [
  { id: 'food_truck', center: [-24, -38], angle: 20, fabric: '#a76f63', cushion: '#b98472' },
  { id: 'pond_walk', center: [38, -19], angle: -25, fabric: '#71918a', cushion: '#75998d' },
  { id: 'stage_lawn', center: [-27, 22], angle: 35, fabric: '#938198', cushion: '#a48fa6' },
  { id: 'garden_walk', center: [30.4, 20.8], angle: -35, fabric: '#b29164', cushion: '#bf9e6d' },
]

function picnicFurniture({ id, center: [x, z], angle, fabric, cushion }) {
  const yaw = angle * Math.PI / 180
  const cos = Math.cos(yaw)
  const sin = Math.sin(yaw)
  return [
    { id: `hub_picnic_${id}`, style: 'landscape', position: [x, z], size: [4.3, 2.7, 3.5],
      rotationDeg: angle, elevation: .025, collider: false,
      features: [{ t: 'picnic', p: [0, 0], fabric }],
    },
    ...[[1.8, .3], [.15, 1.75]].map(([dx, dz], i) => ({
      id: `hub_lounge_${id}_${i}`, style: 'hubLoungeChair',
      position: [x + dx * cos + dz * sin, z - dx * sin + dz * cos],
      rotationDeg: angle + Math.atan2(-dx, -dz) * 180 / Math.PI,
      size: [1.04, .83, .98], elevation: .025, color: cushion,
    })),
  ]
}

export const hubGardenProps = [
  ...Object.entries(promenades).map(([id, points]) => promenade(id, points)),
  { id: 'hub_compass_border', style: 'hubCompassBorder', position: [0, 0], size: [33, .015, 33], collider: false },
  ...seatingCourt('northwest', -21.5, -28.8, [DIAGONAL, DIAGONAL], -135),
  ...seatingCourt('northeast', 26.2, -29, [-DIAGONAL, DIAGONAL], 135),
  ...seatingCourt('southwest', -18, 32.8, [0, 1], 180),
  ...seatingCourt('southeast', 20, 34.5, [DIAGONAL, DIAGONAL], -135),
  ...planting.flatMap(gardenPlanting),
  ...picnicNooks.flatMap(picnicFurniture),
].map((item) => ({ ...item, zone: 'HUB' }))
