import hub from './hub.json'

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

// 맵 전체 (모든 좌표가 절대 좌표)
export const layout = {
  ground: hub.ground,
  playerStart: hub.playerStart,
  playerStartYawDeg: hub.playerStartYawDeg ?? 0,
  roads: [...hub.roads, ...zones.flatMap((zone) => placeItems(zone.roads, zone))],
  markings: [...(hub.markings ?? []), ...zones.flatMap((zone) => placeMarkings(zone.markings, zone))],
  buildings: [...hub.buildings, ...zones.flatMap((zone) => placeItems(zone.buildings, zone))],
  props: [...hub.props, ...zones.flatMap((zone) => placeItems(zone.props, zone))],
}
