import { layout } from '../../data/mapData.js'
import { THRONE_ROOM_POSITION } from '../../../components/movieZone/palaceInteriorLayout.js'
import * as palace from './hj/gyeongbokLayout.js'
import * as park from './hj/themeParkLayout.js'
import { BUGAK_DEPTH, OBS, PASS, TRAIL_PTS } from './hj/HjBugaksan.jsx'

const props = new Map(layout.props.map((item) => [item.style, item]))

function section(style, footprint, places, scale = [1, 1]) {
  const item = props.get(style)
  if (!item) return null
  const [sx, sz] = scale
  const yaw = (item.rotationDeg ?? 0) * Math.PI / 180
  const cos = Math.cos(yaw)
  const sin = Math.sin(yaw)
  const [x, z] = item.position
  const project = ([dx, dz]) => [x + dx * sx * cos + dz * sz * sin, z - dx * sx * sin + dz * sz * cos]
  const [left, top, right, bottom] = footprint
  const corners = [[left, top], [right, top], [right, bottom], [left, bottom]].map(project)
  return {
    item, scale,
    bounds: [
      Math.min(...corners.map(([px]) => px)), Math.min(...corners.map(([, pz]) => pz)),
      Math.max(...corners.map(([px]) => px)), Math.max(...corners.map(([, pz]) => pz)),
    ],
    places: places.map(({ name, point, size, rotationDeg = 0 }) => ({
      name, point: project(point), zone: item.zone,
      size: size && [size[0] * sx, size[1] * sz],
      rotationDeg: (item.rotationDeg ?? 0) + rotationDeg,
    })),
  }
}

export const palaceSite = {
  name: '근정전',
  point: [THRONE_ROOM_POSITION[0], THRONE_ROOM_POSITION[2]],
  size: [palace.THRONE_FOOTPRINT.w, palace.THRONE_FOOTPRINT.d],
}
export const palaceSites = [
  { name: palace.GWANGHWAMUN.title, point: [0, palace.GWANGHWAMUN.az], size: [palace.GWANGHWAMUN.width, palace.GWANGHWAMUN.depth] },
  ...palace.HALLS.map(({ title, ax, az, w, d, rotation }) => ({
    name: title, point: [ax, az], size: [w, d], rotationDeg: rotation,
  })),
  { name: '경회루', point: [palace.GYEONGHOERU.ax, palace.GYEONGHOERU.az], size: [palace.GYEONGHOERU.w, palace.GYEONGHOERU.d] },
  { name: '향원정', point: [palace.HYANGWON.ax, palace.HYANGWON.az], size: [2 * palace.HYANGWON.R, 2 * palace.HYANGWON.R] },
]
const { minX, maxX, minZ, maxZ } = palace.BOUNDS
const palaceItem = props.get('hjGyeongbokPalace')
export const palaceMap = palaceItem && section(
  'hjGyeongbokPalace', [minX, minZ - palace.PALACE_ORIGIN_Z, maxX, maxZ - palace.PALACE_ORIGIN_Z],
  [palaceSite, ...palaceSites.map(({ point: [x, z], ...site }) => ({ ...site, point: [x, z - palace.PALACE_ORIGIN_Z] }))],
  [palaceItem.size[0] / palace.PALACE_MODEL_WIDTH, palaceItem.size[2] / palace.PALACE_MODEL_DEPTH],
)

export const parkRides = [
  ['관람차', park.RIDES.wheel], ['회전목마', park.RIDES.carousel], ['회전그네', park.RIDES.swing],
  ['열기구 마당', park.BALLOON_FIELD],
]
export const parkMap = section('hjThemePark', [-park.PARK.w / 2, -park.PARK.d / 2, park.PARK.w / 2, park.PARK.d / 2], [
  { name: '해월 드림파크 입구', point: [park.ENTRANCE.gateX, park.ENTRANCE.gateZ] },
  ...parkRides.map(([name, { x, z, r }]) => ({ name, point: [x, z], size: [r * 2, r * 2] })),
  { name: '사파리 지프 정류장', point: [park.SAFARI_BOARD.x, park.SAFARI_BOARD.z] },
])

const mountainItem = props.get('hjBugaksan')
export const mountainMap = mountainItem && section('hjBugaksan',
  [-mountainItem.size[0] / 2, 0, mountainItem.size[0] / 2, BUGAK_DEPTH], [
    { name: '북악산 정상 전망대', point: [OBS.x, OBS.z], size: [OBS.r * 2, OBS.r * 2] },
    { name: '북악산 등산로 입구', point: TRAIL_PTS[0] },
  ],
)
export const mountainFeatures = { depth: BUGAK_DEPTH, pass: PASS, viewpoint: OBS, trail: TRAIL_PTS }

const buildingStyles = /^(hjModernBuilding|hjSeoulStation|hjGovernmentGeneral|hjClockTower|hjMarketStall|hjTunnelPortal|jmEatery|jmFieldHut|jmPinkHouse|jmVerandaShop|jmYutoya|jmShed|kpopDome|auditionGate)$/
export const mapPropBuildings = layout.props.filter(({ style }) => buildingStyles.test(style))
const landmarkNames = { hjClockTower: '경성 시계탑', jmYutoya: '유토야 온천장', kpopDome: 'K-POP 공연장' }
export const mapBuildingName = (item) => item.mapName ?? item.name ?? item.signs?.find((sign) => sign.text)?.text
  ?? item.title ?? landmarkNames[item.style]

export const sectionPlaces = [palaceMap, parkMap, mountainMap].filter(Boolean).flatMap(({ places }) => places)
export const filmAreaLabels = [
  ['경복궁', palaceMap?.bounds],
  ['해월 드림파크', parkMap?.bounds],
  ['1930 경성 거리', props.get('hjGovernmentGeneral') && [
    -30, props.get('hjSeoulStation')?.position[1] ?? 240, 30, props.get('hjGovernmentGeneral').position[1],
  ]],
].flatMap(([name, bounds]) => {
  if (!bounds) return []
  const [left, top, right, bottom] = bounds
  return [{ name, point: [(left + right) / 2, (top + bottom) / 2], color: '#c99562' }]
})
