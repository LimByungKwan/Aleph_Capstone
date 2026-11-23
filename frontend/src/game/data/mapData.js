import hub from './hub.json'
import places from '@shared/places.json'
import { terrainHeightAt } from '../Map/terrain.js'

// 맵 데이터를 한곳에 모아 주는 파일.
// - hub.json (중앙 광장 + 길)
// - zones/ 폴더의 *.json (구역마다 한 파일) ← 파일을 추가하면 자동으로 읽어요
// 구역 파일 안의 좌표는 "구역 origin 기준 상대 좌표"라서, 여기서 절대 좌표로 바꿔 합쳐요.

const zoneFiles = import.meta.glob('./zones/*.json', { eager: true, import: 'default' })

// 범례·표시 순서 (목록에 없는 구역은 뒤에 이름순)
const ZONE_ORDER = ['JM', 'BK', 'HJ', 'SG']
const orderOf = (zone) => {
  const index = ZONE_ORDER.indexOf(zone.zoneId)
  return index === -1 ? ZONE_ORDER.length : index
}

export const zones = Object.values(zoneFiles).sort(
  (a, b) => orderOf(a) - orderOf(b) || a.zoneId.localeCompare(b.zoneId),
)

// [3. 개발 > 프론트엔드] 촬영지가 재배치돼도 기존 스탬프는 공용 장소 ID로 조회합니다.
const activeIdsByZone = new Map(
  zones.filter((zone) => zone.mapPlaceIds).map((zone) => [zone.zoneId, new Set(zone.mapPlaceIds)]),
)
export const mapPlaces = places.filter((place) => activeIdsByZone.get(place.zone)?.has(place.id) ?? true)

const offsetPoint = ([x, z], [ox, oz]) => [x + ox, z + oz]

// 건물·소품·길: position을 절대 좌표로, id 앞에 구역 이름을 붙여 겹치지 않게
function placeItems(items = [], zone) {
  return items.map((item) => ({
    ...item,
    id: `${zone.zoneId}/${item.id}`,
    zone: item.zone ?? zone.zoneId,
    position: offsetPoint(item.position, zone.origin),
  }))
}

// 도로 표시: position / from / to 를 절대 좌표로
function placeMarkings(markings = [], zone) {
  return markings.map((mark) => ({
    ...mark,
    ...(mark.position && { position: offsetPoint(mark.position, zone.origin) }),
    ...(mark.from && { from: offsetPoint(mark.from, zone.origin) }),
    ...(mark.to && { to: offsetPoint(mark.to, zone.origin) }),
  }))
}

// 지형(언덕·데크): 중심·점 좌표를 절대 좌표로
function placeTerrain(terrain = [], zone) {
  const [ox, oz] = zone.origin
  return terrain.map((item) => ({
    ...item,
    id: `${zone.zoneId}/${item.id}`,
    ...(item.center && { center: offsetPoint(item.center, zone.origin) }),
    ...(item.position && { position: offsetPoint(item.position, zone.origin) }),
    ...(item.points && { points: item.points.map(([x, z, h]) => [x + ox, z + oz, h]) }),
    ...(item.from && { from: [item.from[0] + ox, item.from[1] + oz, item.from[2]] }),
    ...(item.to && { to: [item.to[0] + ox, item.to[1] + oz, item.to[2]] }),
    ...(item.rect && { rect: [item.rect[0] + ox, item.rect[1] + oz, item.rect[2] + ox, item.rect[3] + oz] }),
    ...(item.rails && {
      rails: item.rails.map((rail) => {
        const shift = rail.edge === 'north' || rail.edge === 'south' ? ox : oz
        return { ...rail, gaps: (rail.gaps ?? []).map(([a, b]) => [a + shift, b + shift]) }
      }),
    }),
  }))
}

const terrain = [...(hub.terrain ?? []), ...zones.flatMap((zone) => placeTerrain(zone.terrain, zone))]

// "onTerrain": true인 건물·소품은 언덕 높이만큼 자동으로 올려 줌 (elevation은 거기에 더하는 값)
function settle(items) {
  return items.map((item) =>
    item.onTerrain
      ? { ...item, elevation: terrainHeightAt(terrain, item.position[0], item.position[1]) + (item.elevation ?? 0) }
      : item,
  )
}

const props = settle([...hub.props, ...zones.flatMap((zone) => placeItems(zone.props, zone))])
// [3. 개발 > 프론트엔드] 남쪽 경계와 만나는 확장 지형의 중심과 크기를 물리·카메라가 함께 씁니다.
export const southGroundExtension = props.find((item) => item.extendsSouthBoundary)

// 맵 전체 (모든 좌표가 절대 좌표)
export const layout = {
  ground: hub.ground,
  playerStart: hub.playerStart,
  playerStartYawDeg: hub.playerStartYawDeg ?? 0,
  terrain,
  roads: [...hub.roads, ...zones.flatMap((zone) => placeItems(zone.roads, zone))],
  markings: [...(hub.markings ?? []), ...zones.flatMap((zone) => placeMarkings(zone.markings, zone))],
  buildings: settle([...hub.buildings, ...zones.flatMap((zone) => placeItems(zone.buildings, zone))]),
  props,
}
