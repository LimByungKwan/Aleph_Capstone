// (담당: 병관) 미니맵의 구역 이름과 가리킨 장소의 이름을 실제 배치 데이터에서 찾습니다.
import { layout, mapPlaces, southGroundExtension, zones } from '../../data/mapData.js'
import { HALLS, MAIN_GATE } from './hj/gyeongbokgungLayout.js'
import { STREET_BUILDINGS } from './hj/gyeongseongLayout.js'
import { DATE_MISSIONS, mapPoint } from './bk_dateMission.js'
import { WINE_BAR_ID, WINE_MISSION_ID } from './bk_wineTastingData.js'
import { minimapZoneBounds } from './bk_minimapMap.js'

const items = new Map([...layout.buildings, ...layout.props, ...layout.terrain].map((item) => [item.id, item]))
const missionItems = {
  fountain: 'BK/fountain_plaza', claw: 'BK/claw_booth', tarot: 'BK/tarot_booth', photo: 'BK/couple_photo',
  telescope: 'BK/tower', cafe: 'BK/b_cafe', mural: 'BK/b_wings', [WINE_MISSION_ID]: WINE_BAR_ID,
}
const placeAliases = new Set(['spot_bk_claw', 'spot_bk_fountain', 'spot_bk_tower', 'cafe_soran', 'spot_mural'])
function placeLabel(name, item, type, zone = item.zone) {
  return { name, point: item.position, size: item.size, rotationDeg: item.rotationDeg, type, zone }
}

export const minimapLandmarks = DATE_MISSIONS.map((mission) => {
  const item = items.get(missionItems[mission.id]) ?? { position: mapPoint(mission) }
  return placeLabel(mission.short, item, mission.id === 'cafe' ? 'cafe' : 'spot', 'BK')
})
const pavilion = items.get('BK/sunset_pavilion')
if (pavilion) minimapLandmarks.push(placeLabel('노을등 정자', pavilion, 'spot'))
const boardwalk = items.get('BK/boardwalk')?.points
if (boardwalk?.length) minimapLandmarks.push({ name: '전망대 산책로', point: boardwalk[Math.floor(boardwalk.length / 2)], type: 'spot', zone: 'BK' })
minimapLandmarks.push(...mapPlaces.filter((place) => !placeAliases.has(place.id)).map((place) => ({
  name: place.name, point: [place.position[0], place.position[2]], type: place.type, zone: place.zone,
})))

const missionBuildingIds = new Set(Object.values(missionItems))
const shopLabels = layout.buildings.flatMap((item) => {
  if (missionBuildingIds.has(item.id)) return []
  const name = item.mapName ?? item.name ?? item.signs?.find((sign) => sign.text)?.text
  return typeof name === 'string' && name.trim() ? [placeLabel(name.trim(), item)] : []
})
if (southGroundExtension) {
  const [x, z] = southGroundExtension.position
  const angle = (southGroundExtension.rotationDeg ?? 0) * Math.PI / 180
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  shopLabels.push(...[MAIN_GATE, ...HALLS, ...STREET_BUILDINGS].map((site) => ({
    name: site.name, point: [x + site.x * cos + site.z * sin, z - site.x * sin + site.z * cos],
    size: [site.w, site.d], rotationDeg: (southGroundExtension.rotationDeg ?? 0) + (site.yaw ?? 0), zone: 'HJ',
  })))
}

const placeTargets = [...minimapLandmarks, ...shopLabels].map((place) => {
  const yaw = (place.rotationDeg ?? 0) * Math.PI / 180
  return { ...place, cos: Math.cos(yaw), sin: Math.sin(yaw) }
})

export const placesByMapZone = Object.fromEntries(zones.map((zone) => {
  const [left, top, right, bottom] = minimapZoneBounds(zone)
  const names = new Set()
  const places = placeTargets.filter(({ zone: id, name, point: [x, z] }) => {
    if (id !== zone.zoneId || names.has(name) || x < left || x > right || z < top || z > bottom) return false
    names.add(name)
    return true
  })
  return [zone.zoneId, places]
}))

export function pickMinimapPlace(x, y, { contains, scale, toScreen }) {
  if (!contains(x, y) || scale < 0.65) return null
  let closest = null
  let bestDistance = Infinity
  for (const place of placeTargets) {
    if (!place.type && scale < 1.1) continue
    const [px, py] = toScreen(...place.point)
    const dx = x - px
    const dy = y - py
    const distance = dx * dx + dy * dy
    if (distance >= bestDistance || !contains(px, py)) continue
    const insideBuilding = place.size
      && Math.abs(dx * place.cos - dy * place.sin) <= place.size[0] * scale / 2 + 2
      && Math.abs(dx * place.sin + dy * place.cos) <= place.size.at(-1) * scale / 2 + 2
    if (distance > 49 && !insideBuilding) continue
    closest = place
    bestDistance = distance
  }
  return closest
}

const zoneLabels = zones.map(({ name, origin, color }) => ({ name, point: origin, color }))
const widthCache = new Map()
const FONT = "650 11px system-ui, 'Malgun Gothic', sans-serif"
const GAP = 3
const HEIGHT = 16

function positionLabel(contains, x, y, width, occupied) {
  const left = x - width / 2
  const offsets = [[left, y - HEIGHT - 5], [left, y + 5], [x + 5, y - HEIGHT / 2], [x - width - 5, y - HEIGHT / 2]]
  return offsets.find(([lx, top]) => {
    const right = lx + width
    const bottom = top + HEIGHT
    if (![[lx, top], [lx, bottom], [right, top], [right, bottom]].every(([px, py]) => contains(px, py, 2))) return false
    return !occupied.some(([ax, ay, aw, ah]) =>
      lx < ax + aw + GAP && right + GAP > ax && top < ay + ah + GAP && bottom + GAP > ay,
    )
  })
}

export function drawMinimapZones(ctx, { contains, toScreen, occupied }) {
  ctx.save()
  ctx.font = FONT
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  for (const { name, point, color } of zoneLabels) {
    const [x, y] = toScreen(...point)
    if (!contains(x, y, 2)) continue
    if (!widthCache.has(name)) widthCache.set(name, Math.ceil(ctx.measureText(name).width) + 10)
    const width = widthCache.get(name)
    const position = positionLabel(contains, x, y, width, occupied)
    if (!position) continue
    const [left, top] = position
    occupied.push([left, top, width, HEIGHT])
    ctx.beginPath()
    ctx.roundRect(left, top, width, HEIGHT, 5)
    ctx.fillStyle = '#fff9ed'
    ctx.fill()
    ctx.lineWidth = 1
    ctx.strokeStyle = color
    ctx.stroke()
    ctx.fillStyle = '#30483e'
    ctx.fillText(name, left + width / 2, top + HEIGHT / 2 + 0.5)
  }
  ctx.restore()
}

export function drawMinimapPlaceHint(ctx, name, x, y, width, height) {
  ctx.save()
  ctx.font = "700 12px system-ui, 'Malgun Gothic', sans-serif"
  const boxWidth = Math.min(width - 8, Math.ceil(ctx.measureText(name).width) + 20)
  const boxHeight = 26
  const left = Math.max(4, x + 14 + boxWidth <= width - 4 ? x + 14 : x - boxWidth - 10)
  const top = Math.max(4, y + 14 + boxHeight <= height - 4 ? y + 14 : y - boxHeight - 10)
  ctx.beginPath()
  ctx.roundRect(left, top, boxWidth, boxHeight, 7)
  ctx.fillStyle = '#253c33'
  ctx.fill()
  ctx.lineWidth = 1.2
  ctx.strokeStyle = '#8ba894'
  ctx.stroke()
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = '#fffdf9'
  ctx.fillText(name, left + boxWidth / 2, top + boxHeight / 2, boxWidth - 14)
  ctx.restore()
}
