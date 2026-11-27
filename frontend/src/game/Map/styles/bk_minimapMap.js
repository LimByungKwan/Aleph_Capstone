// (담당: 병관) 3D 맵과 같은 배치 데이터로 미니맵 바탕을 그려 한 번만 저장합니다.
import { Euler, Vector3 } from 'three'
import { layout, southGroundExtension, zones } from '../../data/mapData.js'
import { HUB_GARDEN_BORDER, HUB_GARDEN_STONE } from '../../data/hubGardenLayout.js'
import { coastRows } from '../coastColors.js'
import { beachBounds, coastPoint, COAST_SEGMENTS } from '../seabed.js'
import { buildDeck, TOWER } from '../terrain.js'
import { CHANNELS, COURTS, HALLS, PONDS, WALKS } from './hj/gyeongbokgungLayout.js'
import { STREET, STREET_ALLEYS, STREET_BUILDINGS, streetFootprint } from './hj/gyeongseongLayout.js'
import * as palace from './hj/gyeongbokLayout.js'
import * as park from './hj/themeParkLayout.js'
import { mapPropBuildings, mountainFeatures, mountainMap, palaceMap, palaceSite, palaceSites, parkMap, parkRides } from './bk_minimapSections.js'

const TAU = Math.PI * 2
export const MAP_GRASS = '#a8bb90'
const WATER = '#6ca7b6'
const WATER_EDGE = '#497d83'
const PATH = '#f1e4c8'
const DECK = '#c69869'
const ROOF = '#a8796b'
const ROOF_EDGE = '#664d48'
const ROAD_COLORS = {
  hubGranite: '#a8ad9c', hubLimestone: '#e0d1b8', hubLawn: '#a8c18b',
  asphalt: '#8b8d86', brick: '#d9aa93', gardenPath: '#eee2c3',
  grass: '#a0b486', stone: '#d9d7cb', paver: '#e3d2b7', tile: '#e9dabb',
}

function drawLand(ctx, groundBounds) {
  const [x0, z0, x1, z1] = groundBounds
  const meadow = ctx.createLinearGradient(x0, z0, x1, z1)
  meadow.addColorStop(0, '#c1ceaa')
  meadow.addColorStop(1, MAP_GRASS)
  ctx.fillStyle = meadow
  ctx.fillRect(x0, z0, x1 - x0, z1 - z0)

  const [west, , north] = beachBounds
  const firstX = coastPoint(0).x
  const samples = Array.from({ length: COAST_SEGMENTS + 1 }, (_, i) => ({
    x: west + coastPoint(i).x - firstX,
    rows: coastRows(i),
  }))
  // 해안 전체에 일자 띠를 칠하는 대신 실제 물가를 따라 모래와 물을 나눕니다.
  const bands = [[0, 4, '#ead4a7'], [4, 5, '#e3f1db'], [5, 7, '#91bdc0'], [7, 8, WATER]]
  for (const [start, end, color] of bands) {
    ctx.beginPath()
    samples.forEach(({ x, rows }, i) => {
      const z = north + rows[start][0] - 40
      if (i === 0) ctx.moveTo(x, z)
      else ctx.lineTo(x, z)
    })
    for (let i = samples.length - 1; i >= 0; i--) {
      const { x, rows } = samples[i]
      ctx.lineTo(x, north + rows[end][0] - 40)
    }
    ctx.closePath()
    ctx.fillStyle = color
    ctx.fill()
  }
}

function drawZones(ctx) {
  for (const { origin: [x, z], size: [w, d], color } of zones) {
    ctx.fillStyle = color
    ctx.globalAlpha = 0.27
    ctx.fillRect(x - w / 2, z - d / 2, w, d)
    ctx.globalAlpha = 0.72
    ctx.strokeStyle = color
    ctx.lineWidth = 1.1
    ctx.strokeRect(x - w / 2, z - d / 2, w, d)
    ctx.globalAlpha = 1
  }
}

function ellipse(ctx, x, z, rx, rz, fill, edge) {
  ctx.beginPath()
  ctx.ellipse(x, z, rx, rz, 0, 0, TAU)
  ctx.fillStyle = fill
  ctx.fill()
  if (edge) {
    ctx.strokeStyle = edge
    ctx.lineWidth = 0.6
    ctx.stroke()
  }
}

function box(ctx, x, z, w, d, fill, edge) {
  ctx.fillStyle = fill
  ctx.fillRect(x - w / 2, z - d / 2, w, d)
  if (edge) {
    ctx.lineWidth = 0.55
    ctx.strokeStyle = edge
    ctx.strokeRect(x - w / 2, z - d / 2, w, d)
  }
}

function drawItem(ctx, item, draw) {
  const [x, z] = item.position
  ctx.save()
  ctx.translate(x, z)
  // 3D의 +Y 회전은 위에서 본 지도에서 반대 방향입니다.
  ctx.rotate(-(item.rotationDeg ?? 0) * Math.PI / 180)
  draw(item.size[0], item.size.at(-1))
  ctx.restore()
}

function line(ctx, points, width, color) {
  if (points.length < 2) return
  ctx.beginPath()
  ctx.moveTo(points[0][0], points[0][1])
  for (const [x, z] of points.slice(1)) ctx.lineTo(x, z)
  ctx.lineWidth = width
  ctx.strokeStyle = color
  ctx.stroke()
}

function roof(ctx, w, d, color, gabled) {
  box(ctx, 0.65, 0.9, w, d, '#32443838')
  box(ctx, 0, 0, w, d, color, ROOF_EDGE)
  if (Math.min(w, d) < 2.5) return
  ctx.fillStyle = '#ffffff38'
  ctx.fillRect(-w / 2, -d / 2, w, gabled ? d / 2 : 0.65)
  if (gabled) line(ctx, [[-w / 2, 0], [w / 2, 0]], 0.38, '#664d4877')
}

const PALACE_ROOF = '#546f69'
function drawPalace(ctx, { item, scale }) {
  drawItem(ctx, item, () => {
    ctx.scale(...scale)
    ctx.save()
    ctx.translate(0, -palace.PALACE_ORIGIN_Z)
    const { minX, maxX, minZ, maxZ } = palace.BOUNDS
    const centerX = (minX + maxX) / 2
    box(ctx, centerX, (minZ + maxZ) / 2, maxX - minX, maxZ - minZ, '#e3d6bd', '#aa9473')
    box(ctx, centerX, (palace.LAWN_Z + maxZ) / 2, maxX - minX, maxZ - palace.LAWN_Z, '#a2b987')
    box(ctx, 0, (palace.LAWN_Z + maxZ) / 2, palace.GARDEN_PATH_W * 2, maxZ - palace.LAWN_Z, PATH)
    const [x0, x1, z0, z1] = palace.COURT
    box(ctx, (x0 + x1) / 2, (z0 + z1) / 2, x1 - x0, z1 - z0, '#c4b9a3', '#a6987c')
    for (const x of [-1.35, 0, 1.35]) line(ctx, [[x, palace.GWANGHWAMUN.az], [x, z1]], 0.9, '#f6ebd7')
    for (const { ax, az, w, d } of palace.PONDS) box(ctx, ax, az, w, d, WATER, WATER_EDGE)
    for (const [ax, az, size] of [...palace.TREES, ...palace.WILLOWS]) ellipse(ctx, ax, az, size * 1.45, size * 1.45, CANOPY)
    for (const [a, b, c, d] of palace.WALLS) line(ctx, [[a, b], [c, d]], palace.WALL_T, '#68685d')
    const { ax, az, platform, bridges, bridgeW } = palace.GYEONGHOERU
    const pond = palace.PONDS.find(({ id }) => id === 'gyeonghoeru_pond')
    const shore = pond.ax + pond.w / 2
    for (const offset of bridges) line(ctx, [[ax, az + offset], [shore + .25, az + offset]], bridgeW, PATH)
    box(ctx, ax, az, ...platform, '#cbbfa6')
    const garden = palace.HYANGWON
    const gardenPond = palace.PONDS.find(({ id }) => id === 'hyangwon_pond')
    line(ctx, [[garden.ax, garden.az], [garden.ax, gardenPond.az + gardenPond.d / 2]], garden.bridgeW, DECK)
    ellipse(ctx, garden.ax, garden.az, garden.islandR, garden.islandR, '#a4b97d')
    for (const { ax, az, w, d, rotation } of palace.CORRIDORS) {
      ctx.save()
      ctx.translate(ax, az)
      ctx.rotate(-(rotation ?? 0) * Math.PI / 180)
      roof(ctx, w, d, '#7c8070', true)
      ctx.restore()
    }
    for (const { point, size, rotationDeg } of palaceSites) {
      drawItem(ctx, { position: point, size, rotationDeg }, (w, d) => roof(ctx, w, d, PALACE_ROOF, true))
    }
    ctx.restore()
    drawItem(ctx, { position: palaceSite.point, size: palaceSite.size }, (w, d) => {
      box(ctx, 0, 0, w + 4, d + 5.75, '#ebe0c6', '#9f977e')
      roof(ctx, w, d, '#344f4c', true)
    })
  })
}

function fillExtent(ctx, { x0, x1, z0, z1 }, fill, edge) {
  box(ctx, (x0 + x1) / 2, (z0 + z1) / 2, x1 - x0, z1 - z0, fill, edge)
}

function drawPark(ctx, { item }) {
  drawItem(ctx, item, () => {
    box(ctx, 0, 0, park.PARK.w, park.PARK.d, '#7f9e70', '#536f51')
    fillExtent(ctx, park.ENTRANCE, PATH)
    fillExtent(ctx, park.PARKING, '#858881')
    ctx.lineCap = 'round'
    for (const path of park.PATHS) line(ctx, path, park.PATH_W, PATH)
    fillExtent(ctx, park.SAFARI, '#a9b77e', '#687f54')
    line(ctx, [...park.JEEP_ROUTE, park.JEEP_ROUTE[0]], 1.45, '#e0cfab')
    ellipse(ctx, park.LAKE.x, park.LAKE.z, park.LAKE.rx, park.LAKE.rz, WATER, WATER_EDGE)
    for (const [, { x, z, r }] of parkRides) {
      ellipse(ctx, x, z, r, r, '#e1c0a3', '#936c63')
      ellipse(ctx, x, z, Math.min(2.2, r * .3), Math.min(2.2, r * .3), '#fbefd7')
    }
  })
}

function drawMountain(ctx, { item }) {
  const { depth, pass, trail, viewpoint } = mountainFeatures
  drawItem(ctx, item, (w) => {
    for (const [left, right] of [[-w / 2, pass.x0], [pass.x1, w / 2]]) {
      const mid = (left + right) / 2
      const radius = (right - left) / 2
      for (const ring of [1, .76, .51]) ellipse(ctx, mid, depth / 2, radius * ring, depth / 2 * ring, '#8ca57b', '#718a69')
    }
    box(ctx, (pass.x0 + pass.x1) / 2, depth / 2, pass.x1 - pass.x0, depth, PATH)
    line(ctx, trail, 1.6, DECK)
    ellipse(ctx, viewpoint.x, viewpoint.z, viewpoint.r, viewpoint.r, '#d8ba90', '#927253')
  })
}

function drawSouth(ctx) {
  if (!southGroundExtension) return
  drawItem(ctx, southGroundExtension, (w, d) => {
    box(ctx, 0, 0, w, d, '#b6c29a', '#94a27d')
    box(ctx, 0, STREET.z, STREET.w, STREET.d, '#c9b49c')
    box(ctx, STREET.x, STREET.z, STREET.roadWidth, STREET.d, PATH)
    for (const rect of STREET_ALLEYS) box(ctx, ...rect, PATH)
    for (const rect of COURTS) box(ctx, ...rect, '#dfd0ae')
    for (const rect of WALKS) box(ctx, ...rect, PATH)
    for (const rect of CHANNELS) box(ctx, ...rect, WATER, WATER_EDGE)
    for (const pond of PONDS) box(ctx, pond.x, pond.z, pond.w, pond.d, WATER, WATER_EDGE)
    for (const hall of HALLS) {
      ctx.save()
      ctx.translate(hall.x, hall.z)
      roof(ctx, hall.w, hall.d, '#6c827d', true)
      ctx.restore()
    }
    for (const building of STREET_BUILDINGS) {
      const [x, z, width, depth] = streetFootprint(building)
      box(ctx, x, z, width, depth, '#ac8572', ROOF_EDGE)
    }
  })
}

function drawHills(ctx) {
  for (const hill of layout.terrain.filter(({ type }) => type === 'hill')) {
    const [x, z] = hill.center
    const [rx, rz] = hill.radius
    ellipse(ctx, x, z, rx, rz, '#a5b683', '#829a72')
    const plateau = hill.plateau ?? 0.5
    for (let i = 1; i <= 4; i++) {
      const ring = 1 - (1 - plateau) * i / 4
      ellipse(ctx, x, z, rx * ring, rz * ring, i % 2 ? '#b2c292' : '#bac99b', '#879e7588')
    }
  }
}

const euler = new Euler()
const corner = new Vector3()
function drawWalkways(ctx) {
  const decks = []
  for (const item of layout.terrain) {
    if (item.type === 'platform') {
      const [x0, z0, x1, z1] = item.rect
      box(ctx, (x0 + x1) / 2, (z0 + z1) / 2, x1 - x0, z1 - z0, '#d9c4a3', '#ad9476')
    }
    if (item.type === 'stairs') {
      const [x0, z0] = item.from
      const [x1, z1] = item.to
      const w = item.width ?? 4
      line(ctx, [[x0, z0], [x1, z1]], w + 0.8, '#a28c71')
      line(ctx, [[x0, z0], [x1, z1]], w, PATH)
    }
    if (item.type === 'deck') decks.push(...buildDeck(item, layout.terrain).boards)
  }
  // 같은 발판의 윗면을 투영합니다. 곡선, 폭과 갈림길은 3D와 같이 바뀝니다.
  if (!decks.length) return
  ctx.beginPath()
  for (const { p: [x, , z], r, s: [w, h, d] } of decks) {
    euler.set(...r)
    const corners = [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2]]
    corners.forEach(([dx, dz], i) => {
      corner.set(dx, h / 2, dz).applyEuler(euler)
      if (i === 0) ctx.moveTo(x + corner.x, z + corner.z)
      else ctx.lineTo(x + corner.x, z + corner.z)
    })
    ctx.closePath()
  }
  ctx.strokeStyle = '#876447'
  ctx.lineWidth = 0.9
  ctx.stroke()
  ctx.fillStyle = DECK
  ctx.fill()
}

function drawRoads(ctx, roads) {
  for (const road of roads) {
    if (road.style === 'grass') continue
    drawItem(ctx, road, (w, d) => {
      const edge = road.style && road.style !== 'asphalt' ? '#a8946b66' : undefined
      box(ctx, 0, 0, w, d, ROAD_COLORS[road.style] ?? road.color ?? PATH, edge)
    })
  }
}

function drawMarkings(ctx) {
  for (const mark of layout.markings) {
    if (mark.type === 'line') {
      ctx.setLineDash(mark.dashed ? [3, 3] : [])
      line(ctx, [mark.from, mark.to], Math.max(mark.width ?? 0.12, 0.25), mark.color ?? '#f6ebce')
      ctx.setLineDash([])
    }
    if (mark.type === 'crosswalk') {
      drawItem(ctx, mark, (w, d) => {
        const count = Math.floor(d)
        for (let i = 0; i < count; i++) box(ctx, 0, i - (count - 1) / 2 - 0.25, w, 0.5, mark.color ?? '#f6ebce')
      })
    }
  }
}

const CANOPY = '#729463'
const BLOSSOM = '#d3a0a7'

function drawLandscape(ctx, item) {
  drawItem(ctx, item, () => {
    for (const feature of item.features ?? []) {
      const [x, z] = feature.p
      const s = feature.s ?? 1
      if (feature.t === 'pond') {
        const r = feature.r ?? 4
        ellipse(ctx, x, z, r + 0.16, r + 0.16, WATER, WATER_EDGE)
      }
      if (feature.t === 'hedge') line(ctx, [feature.p, feature.p2], 0.9, CANOPY)
      if (feature.t === 'flowers' && feature.palette) {
        const r = feature.r ?? 2.5
        ellipse(ctx, x, z, r, r, feature.palette[0])
      }
      if (feature.t === 'picnic') box(ctx, x, z, 2.4, 1.8, feature.fabric ?? BLOSSOM, '#fff1da')
      if (['tree', 'cherry', 'pine', 'bush'].includes(feature.t)) {
        const r = (feature.t === 'bush' ? 0.65 : 1.45) * s
        ellipse(ctx, x, z, r, r, feature.t === 'cherry' ? BLOSSOM : CANOPY)
      }
      if (feature.t === 'planter') {
        ctx.save()
        ctx.translate(x, z)
        ctx.rotate(-(feature.rot ?? 0))
        box(ctx, 0, 0, feature.w ?? 4, feature.d ?? 1, BLOSSOM)
        ctx.restore()
      }
    }
  })
}

function drawProps(ctx) {
  for (const item of layout.props) {
    if (item.style === 'landscape') drawLandscape(ctx, item)
    if (item.style === 'roundPlaza') {
      drawItem(ctx, item, (w) => ellipse(ctx, 0, 0, w / 2, w / 2, PATH, '#b7a077'))
    }
    if (item.style === 'jmCanal' || item.style === 'jmLake') {
      drawItem(ctx, item, (w, d) => {
        if (item.style === 'jmLake') ellipse(ctx, 0, 0, w * 0.44, d * 0.42, WATER, WATER_EDGE)
        else box(ctx, 0, 0, w, d, WATER, WATER_EDGE)
      })
    }
    if (item.ribbon) {
      drawItem(ctx, item, () => {
        const { points, width } = item.ribbon
        if (item.style === 'hubPromenade') {
          line(ctx, points, width, HUB_GARDEN_BORDER)
          line(ctx, points, width - .46, HUB_GARDEN_STONE)
        } else {
          line(ctx, points, width, item.style === 'jmRiver' ? WATER : PATH)
        }
      })
    }
    if (item.style === 'hubGardenCourt') {
      drawItem(ctx, item, (w) => ellipse(ctx, 0, 0, w / 2, w / 2, HUB_GARDEN_STONE, HUB_GARDEN_BORDER))
    }
    if (item.style === 'hubPlantingBed') {
      drawItem(ctx, item, (w, d) => ellipse(ctx, 0, 0, w / 2, d / 2, '#8b7e5d', HUB_GARDEN_STONE))
    }
    if (item.style === 'hubLoungeChair') {
      drawItem(ctx, item, (w, d) => box(ctx, 0, 0, w, d, item.color))
    }
    if (item.style === 'hubCompassBorder') {
      ctx.beginPath()
      ctx.arc(...item.position, item.size[0] / 2 - .3, 0, TAU)
      ctx.strokeStyle = HUB_GARDEN_STONE
      ctx.lineWidth = .65
      ctx.stroke()
    }
    if (/^(tree|cherryTree|hjTree|jmBigTree|jmBamboo|jmMaple|jmSakura|jmSakuraBloom|jmGinkgo)$/.test(item.style)) {
      drawItem(ctx, item, (w, d) => {
        const cherry = /cherry|sakura/i.test(item.style)
        ellipse(ctx, 0, 0, w / 2, d / 2, cherry ? BLOSSOM : CANOPY)
      })
    }
    if (item.style === 'hjCurvedRoad' && item.points?.length >= 2) {
      drawItem(ctx, item, () => line(ctx, item.points, item.width ?? 6, PATH))
    }
    if (item.style === 'hjPlatform') drawItem(ctx, item, (w, d) => box(ctx, 0, 0, w, d, '#cdbb9e', '#8c8274'))
    if (!item.bedOnly && /^(hjRailway|hjTramLine|jmSeaRail)$/.test(item.style)) {
      drawItem(ctx, item, (w, d) => {
        for (const x of [-.65, .65]) line(ctx, [[x, -d / 2], [x, d / 2]], .32, '#6e6961')
      })
    }
  }
}

function drawLandmarks(ctx) {
  for (const item of layout.terrain) {
    if (item.type !== 'tower') continue
    const [x, z] = item.position
    ellipse(ctx, x, z, TOWER.deckRadius, TOWER.deckRadius, '#d4e2da', '#536f6b')
    ellipse(ctx, x, z, TOWER.shaftRadius, TOWER.shaftRadius, '#789595')
  }
  for (const item of layout.props) {
    if (item.style === 'fountain') {
      drawItem(ctx, item, (w) => {
        ellipse(ctx, 0, 0, w / 2 + 1, w / 2 + 1, '#f3e6cf', '#bfa884')
        ellipse(ctx, 0, 0, w / 2, w / 2, WATER, WATER_EDGE)
        ellipse(ctx, 0, 0, 0.9, 0.9, '#e9f2e8')
      })
    }
    if (/^(jmMachiya|jmGrandRyokan|jmSceneRoom|hubBuskingStage|hubClockTower|clawBooth|tarotBooth)$/.test(item.style)) {
      drawItem(ctx, item, (w, d) => roof(ctx, w, d, ROOF, true))
    }
  }
  for (const item of [...layout.buildings, ...mapPropBuildings].sort((a, b) => (a.elevation ?? 0) - (b.elevation ?? 0))) {
    drawItem(ctx, item, (w, d) => {
      const gabled = /hanok|machiya|ryokan|pavilion|jmYutoya|jmEatery/i.test(item.style)
      const color = /pavilion|glass|greenhouse/i.test(item.style) ? '#6f9390' : item.roofColor ?? ROOF
      roof(ctx, w, d, color, gabled)
    })
  }
}

function boundsAt([x, z], [w, d]) {
  return [x - w / 2, z - d / 2, x + w / 2, z + d / 2]
}

function mergeBounds(rects) {
  return [
    Math.min(...rects.map(([x]) => x)), Math.min(...rects.map(([, z]) => z)),
    Math.max(...rects.map(([, , x]) => x)), Math.max(...rects.map(([, , , z]) => z)),
  ]
}

function itemBounds(item) {
  const yaw = (item.rotationDeg ?? 0) * Math.PI / 180
  const [w, , d] = item.size
  const cos = Math.abs(Math.cos(yaw))
  const sin = Math.abs(Math.sin(yaw))
  return boundsAt(item.position, [w * cos + d * sin, w * sin + d * cos])
}

const southBounds = southGroundExtension && boundsAt(
  southGroundExtension.position, [southGroundExtension.size[0], southGroundExtension.size[2]],
)
const hjBounds = [palaceMap, parkMap, mountainMap].filter(Boolean).map(({ bounds }) => bounds)
hjBounds.push(...layout.roads.filter(({ zone, opensBoundary }) => zone === 'HJ' && opensBoundary).map(itemBounds))
if (southBounds) hjBounds.push(southBounds)
const jmExpansion = layout.props.filter(({ style }) => /^(jmFloor|jmYutoya|jmGrandBridge)$/.test(style))
export function minimapZoneBounds(zone) {
  const bounds = boundsAt(zone.origin, zone.size)
  if (zone.zoneId === 'HJ') return mergeBounds([bounds, ...hjBounds])
  if (zone.zoneId === 'JM') return mergeBounds([bounds, ...jmExpansion.map(itemBounds)])
  if (zone.zoneId === 'SG') return mergeBounds([bounds, beachBounds])
  return bounds
}

let baseMap
export function getMinimapBase() {
  if (baseMap) return baseMap
  const ground = boundsAt(layout.ground.center ?? [0, 0], layout.ground.size)
  const playable = zones.map(minimapZoneBounds)
  const playableBounds = mergeBounds(playable)
  // 남북으로 긴 지형 전체를 내려다보는 대신 실제 테마 구역과 해변을 원 안에 맞춥니다.
  const centerX = (playableBounds[0] + playableBounds[2]) / 2
  const centerZ = (playableBounds[1] + playableBounds[3]) / 2
  const allRadius = Math.max(...playable.map(([left, north, right, south]) =>
    Math.hypot(Math.max(centerX - left, right - centerX), Math.max(centerZ - north, south - centerZ)),
  ))
  const bounds = [ground, ...playable]
  const minX = Math.min(...bounds.map(([x]) => x)) - 4
  const minZ = Math.min(...bounds.map(([, z]) => z)) - 4
  const worldW = Math.max(...bounds.map(([, , x]) => x)) + 4 - minX
  const worldH = Math.max(...bounds.map(([, , , z]) => z)) + 4 - minZ
  const resolution = Math.min(4, 1600 / Math.max(worldW, worldH))
  const canvas = document.createElement('canvas')
  canvas.width = Math.ceil(worldW * resolution)
  canvas.height = Math.ceil(worldH * resolution)
  const ctx = canvas.getContext('2d')
  ctx.scale(canvas.width / worldW, canvas.height / worldH)
  ctx.translate(-minX, -minZ)
  ctx.lineJoin = 'round'
  const roads = [...layout.roads].sort((a, b) => a.size[1] - b.size[1])
  drawLand(ctx, ground)
  drawZones(ctx)
  drawSouth(ctx)
  for (const item of layout.props.filter(({ style }) => style === 'hjSea')) {
    drawItem(ctx, item, (w, d) => box(ctx, 0, 0, w, d, WATER, WATER_EDGE))
  }
  for (const item of jmExpansion.filter(({ style }) => style === 'jmFloor')) {
    drawItem(ctx, item, (w, d) => box(ctx, 0, 0, w, d, item.id.includes('path') ? PATH : '#a0b486'))
  }
  if (palaceMap) drawPalace(ctx, palaceMap)
  if (parkMap) drawPark(ctx, parkMap)
  if (mountainMap) drawMountain(ctx, mountainMap)
  drawRoads(ctx, roads.filter(({ style }) => !style))
  drawHills(ctx)
  drawRoads(ctx, roads.filter(({ style }) => style))
  drawMarkings(ctx)
  for (const item of layout.props.filter(({ style, bedOnly }) => style === 'hjRailway' && bedOnly)) {
    drawItem(ctx, item, (w, d) => box(ctx, 0, 0, w, d, '#ada393'))
  }
  drawProps(ctx)
  drawWalkways(ctx)
  drawLandmarks(ctx)

  baseMap = { canvas, minX, minZ, worldW, worldH, centerX, centerZ, allRadius, playableBounds }
  return baseMap
}
