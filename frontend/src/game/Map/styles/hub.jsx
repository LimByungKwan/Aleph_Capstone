import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { GEO, mat } from './kit.jsx'
import { getSignTexture, getTiledTexture, TILE_METERS } from './textures.js'
import { HUB_GARDEN_BORDER, HUB_GARDEN_STONE } from '../../data/hubGardenLayout.js'
import { NIGHT_UNIFORM, colorize, nightGlow, piece } from './dateCourse.jsx'

// 중앙 광장(hub.json) 전용 스타일: 나침반 바닥 무늬, 시계탑, 나무 둘레 벤치, 방향 표지판, 안내 지도판,
// 퍼걸러 쉼터, 푸드트럭, 버스킹 무대.
// 최적화: 물체마다 조각을 모양 1개로 합치고(꼭짓점 색) 재질 1개 공유 → 물체당 그리기 호출 1~3번.
//         글씨 그림(캔버스)은 한 번만 만들어 재사용, 밤에는 불빛 부분만 밝아짐(BK 밤 조명과 같은 방식).

const C = {
  cream: '#fbf3e6',
  stone: '#c9c2b6',
  stoneDark: '#9c958b',
  coral: '#ff8a7a',
  pink: '#f9a8d4',
  wood: '#b07a4f',
  woodDark: '#7a5236',
  dark: '#3b3633',
  leaf: '#5fa24f',
  leaf2: '#7cbf63',
  mint: '#9ee6cf',
  sky: '#7dd3fc',
  lamp: '#fff1c9',
}
// 구역 색 (범례와 같게)
const ZONE = {
  JM: { color: '#7dd3fc', name: 'JM 애니메이션', area: '애니메이션' },
  BK: { color: '#f9a8d4', name: 'BK 데이트 코스', area: '데이트 코스' },
  HJ: { color: '#fdba74', name: 'HJ 영화·드라마', area: '영화·드라마' },
  SG: { color: '#c4b5fd', name: 'SG K-POP', area: 'K-POP' },
}
const FLOWERS = ['#f472b6', '#f9a8d4', '#c4b5fd', '#fde68a', '#ffffff', '#fb7185']

// 꼭짓점 색 + glow(0~) 재질. glow 부분만 스스로 빛나고, 밤에는 더 밝아짐
const HUB_MAT = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82 })
HUB_MAT.onBeforeCompile = (shader) => {
  shader.uniforms.uNight = NIGHT_UNIFORM
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', '#include <common>\nattribute float glow;\nvarying float vGlow;')
    .replace('#include <begin_vertex>', '#include <begin_vertex>\nvGlow = glow;')
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', '#include <common>\nvarying float vGlow;\nuniform float uNight;')
    .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += vColor.rgb * vGlow * (0.35 + uNight * 1.4);')
}

const range = (n) => Array.from({ length: n }, (_, i) => i)
const seeded = (seed) => {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// 조각 묶음을 (x, y, z) 위치·y회전으로 옮김
function moved(geoms, [x, y, z], rotY = 0) {
  const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rotY, 0)), new THREE.Vector3(1, 1, 1))
  geoms.forEach((g) => g.applyMatrix4(m))
  return geoms
}
function merge(parts) {
  const merged = mergeGeometries(parts)
  parts.forEach((g) => g.dispose())
  return merged
}
// 같은 모양은 한 번만 계산 (key별 캐시)
const geoCache = new Map()
function cached(key, build) {
  if (!geoCache.has(key)) geoCache.set(key, build())
  return geoCache.get(key)
}
const flowerClump = (random, [x, y, z], r, n) =>
  range(n).map(() => {
    const a = random() * Math.PI * 2
    const d = Math.sqrt(random()) * r
    return piece('ico', [x + Math.cos(a) * d, y + random() * 0.1, z + Math.sin(a) * d], [0.09, 0.09, 0.09], FLOWERS[Math.floor(random() * FLOWERS.length)], 0.1)
  })
const benchParts = (len = 1.8) => [
  piece('box', [0, 0.45, 0], [len, 0.08, 0.5], C.wood),
  piece('box', [0, 0.75, -0.23], [len, 0.45, 0.06], C.wood),
  ...[-len / 2 + 0.12, len / 2 - 0.12].map((x) => piece('box', [x, 0.22, 0], [0.08, 0.44, 0.45], C.dark)),
]

const GARDEN_BORDER = mat(HUB_GARDEN_BORDER)
const GARDEN_STONE = mat(HUB_GARDEN_STONE)
const INLAY_MAT = mat('#f7e9cb')
const BORDER_INLAY = new THREE.MeshStandardMaterial({
  color: HUB_GARDEN_BORDER, roughness: .85,
  polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -3,
})
const GROUND_DETAIL = { noShadow: true }
let paverMaterial

function gardenPavers() {
  if (!paverMaterial) {
    const map = getTiledTexture('hubLimestone', 1, 1)
    paverMaterial = new THREE.MeshStandardMaterial({ map, bumpMap: map, bumpScale: .045, roughness: .88 })
  }
  return paverMaterial
}

function promenadeStrip(points, from, to) {
  const vertices = []
  const uv = []
  const indices = []
  for (const [i, [x, z]] of points.entries()) {
    const [prevX, prevZ] = points[Math.max(0, i - 1)]
    const [nextX, nextZ] = points[Math.min(points.length - 1, i + 1)]
    const dx = nextX - prevX
    const dz = nextZ - prevZ
    const length = Math.hypot(dx, dz)
    for (const offset of [from, to]) {
      const px = x - dz / length * offset
      const pz = z + dx / length * offset
      vertices.push(px, 0, pz)
      uv.push(px / TILE_METERS.hubLimestone, -pz / TILE_METERS.hubLimestone)
    }
    if (i) {
      const n = i * 2
      indices.push(n - 2, n - 1, n, n - 1, n + 1, n)
    }
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3))
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return geometry
}

export function HubPromenade({ item }) {
  const { points, width } = item.ribbon
  const [edge, surface] = useMemo(() => {
    const outer = width / 2
    const inner = outer - .23
    return [
      merge([promenadeStrip(points, -outer, -inner), promenadeStrip(points, inner, outer)]),
      promenadeStrip(points, -inner, inner),
    ]
  }, [points, width])
  return (
    <group userData={GROUND_DETAIL}>
      <mesh geometry={edge} material={GARDEN_BORDER} position-y={.045} userData={GROUND_DETAIL} />
      <mesh geometry={surface} material={gardenPavers()} position-y={.045} userData={GROUND_DETAIL} />
    </group>
  )
}

export function HubGardenCourt({ item }) {
  const radius = item.size[0] / 2
  const geometry = cached(`garden-court:${radius}`, () => {
    const surface = new THREE.CircleGeometry(radius - .33, 64).rotateX(-Math.PI / 2)
    const uv = surface.attributes.uv
    for (let i = 0; i < uv.count; i++) {
      uv.setXY(i, surface.attributes.position.getX(i) / TILE_METERS.hubLimestone,
        -surface.attributes.position.getZ(i) / TILE_METERS.hubLimestone)
    }
    return surface
  })
  const border = cached(`garden-court-edge:${radius}`, () => new THREE.RingGeometry(radius - .33, radius, 64).rotateX(-Math.PI / 2))
  const [inner, outer] = useMemo(() => [
    new THREE.RingGeometry(radius - .65, radius - .55, 64).rotateX(-Math.PI / 2),
    new THREE.RingGeometry(radius - .21, radius - .13, 64).rotateX(-Math.PI / 2),
  ], [radius])
  return (
    <group position-y={.068}>
      <mesh geometry={border} material={GARDEN_BORDER} userData={GROUND_DETAIL} dispose={null} />
      <mesh geometry={geometry} material={gardenPavers()} userData={GROUND_DETAIL} dispose={null} />
      <mesh geometry={inner} material={BORDER_INLAY} position-y={.009} userData={GROUND_DETAIL} />
      <mesh geometry={outer} material={INLAY_MAT} position-y={.012} userData={GROUND_DETAIL} />
    </group>
  )
}

export function HubCompassBorder({ item }) {
  const radius = item.size[0] / 2
  const rings = useMemo(() => [
    new THREE.RingGeometry(radius - .59, radius, 96).rotateX(-Math.PI / 2),
    new THREE.RingGeometry(radius - .41, radius - .25, 96).rotateX(-Math.PI / 2),
  ], [radius])
  return (
    <group position-y={.132}>
      <mesh geometry={rings[0]} material={GARDEN_STONE} userData={GROUND_DETAIL} />
      <mesh geometry={rings[1]} material={BORDER_INLAY} position-y={.007} userData={GROUND_DETAIL} />
    </group>
  )
}

export function HubGardenLantern() {
  const geometry = cached('garden-lantern', () => merge([
    piece('box', [0, .075, 0], [.32, .15, .32], C.stoneDark),
    piece('box', [0, .43, 0], [.12, .69, .12], '#4e554c'),
    piece('box', [0, .78, 0], [.27, .07, .27], '#4e554c'),
    piece('box', [0, .862, 0], [.2, .12, .2], C.lamp, 1.35),
    piece('box', [0, .947, 0], [.31, .055, .31], '#4e554c'),
  ]))
  return <mesh geometry={geometry} material={HUB_MAT} dispose={null} />
}

let plantingSoil
const PLANTING_CIRCLE = new THREE.CircleGeometry(.467, 40).rotateX(-Math.PI / 2)
const PLANTING_EDGE = new THREE.RingGeometry(.467, .5, 40).rotateX(-Math.PI / 2)

export function HubPlantingBed({ item }) {
  const [w, , d] = item.size
  if (!plantingSoil) {
    const map = getTiledTexture('hubSoil', 2, 2)
    plantingSoil = new THREE.MeshStandardMaterial({ map, bumpMap: map, bumpScale: .035, roughness: .97 })
  }
  return (
    <group scale={[w, 1, d]}>
      <mesh geometry={PLANTING_CIRCLE} material={plantingSoil} userData={GROUND_DETAIL} dispose={null} />
      <mesh geometry={PLANTING_EDGE} material={GARDEN_STONE} userData={GROUND_DETAIL} dispose={null} />
    </group>
  )
}

export function HubLoungeChair({ item }) {
  const upholstery = item.color
  const geometry = cached(`lounge-chair:${upholstery}`, () => {
    const cushion = (w, h, d, rounding, color, x, y, z, tilt = 0) =>
      colorize(new RoundedBoxGeometry(w, h, d, 3, rounding).rotateX(tilt).translate(x, y, z), color)
    const seatColor = new THREE.Color(upholstery).lerp(new THREE.Color('#fff3df'), .19)
    return merge([
      cushion(.99, .22, .92, .105, upholstery, 0, .2, 0),
      cushion(.74, .24, .66, .115, seatColor, 0, .36, .08),
      cushion(.92, .58, .25, .12, upholstery, 0, .57, -.32, -.14),
      ...[-1, 1].flatMap(x => [
        cushion(.22, .26, .74, .105, upholstery, x * .4, .48, .025),
        ...[-.31, .31].map(z => piece('box', [x * .33, .066, z], [.12, .132, .12], '#635348')),
      ]),
    ])
  })
  return <mesh geometry={geometry} material={HUB_MAT} dispose={null} />
}

// ════════════════════════════════════════════
// 나침반 바닥 무늬: 광장 가운데 큰 원. 네 구역 방향으로 구역 색 화살표 (북=JM, 동=BK, 남=HJ, 서=SG)
// ════════════════════════════════════════════
let compassTexture = null
function getCompassTexture() {
  if (compassTexture) return compassTexture
  const S = 1024
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = S
  const ctx = canvas.getContext('2d')
  const c = S / 2
  const ring = (r, color, width) => {
    ctx.strokeStyle = color
    ctx.lineWidth = width
    ctx.beginPath()
    ctx.arc(c, c, r, 0, Math.PI * 2)
    ctx.stroke()
  }
  ctx.fillStyle = '#e9e1d4'
  ctx.beginPath()
  ctx.arc(c, c, c - 4, 0, Math.PI * 2)
  ctx.fill()
  // 부채꼴 돌 무늬
  for (let i = 0; i < 32; i++) {
    ctx.fillStyle = i % 2 ? '#e2d8c9' : '#ede6da'
    ctx.beginPath()
    ctx.moveTo(c, c)
    ctx.arc(c, c, c - 40, (i / 32) * Math.PI * 2, ((i + 1) / 32) * Math.PI * 2)
    ctx.fill()
  }
  ring(c - 8, '#b9a58e', 14)
  ring(c - 40, '#d4c4ae', 6)
  ring(c * 0.55, '#d4c4ae', 6)
  ring(c * 0.76, '#aa9a8366', 2.8)
  // 네 방향 화살표 (캔버스 위 = 북쪽 = -z)
  const dirs = [
    ['JM', -Math.PI / 2],
    ['BK', 0],
    ['HJ', Math.PI / 2],
    ['SG', Math.PI],
  ]
  for (const [key, a] of dirs) {
    ctx.save()
    ctx.translate(c, c)
    ctx.rotate(a)
    ctx.fillStyle = ZONE[key].color
    ctx.beginPath()
    ctx.moveTo(c - 70, 0)
    ctx.lineTo(c * 0.22, -46)
    ctx.lineTo(c * 0.22, 46)
    ctx.closePath()
    ctx.fill()
    ctx.restore()
    // 구역 이름: 시계탑(가운데)을 기준으로 회전 → 시계탑 쪽에서 바깥(그 구역 방향)을 바라보면 바로 읽힘 (글자 위쪽이 바깥을 향함)
    const r = c - 150
    ctx.save()
    ctx.translate(c + Math.cos(a) * r, c + Math.sin(a) * r)
    ctx.rotate(a + Math.PI / 2)
    ctx.fillStyle = '#5b4636'
    ctx.font = 'bold 54px sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.lineWidth = 8
    ctx.strokeStyle = 'rgba(251,243,230,0.85)'
    ctx.strokeText(ZONE[key].area, 0, 0)
    ctx.fillText(ZONE[key].area, 0, 0)
    ctx.restore()
  }
  // 대각선 작은 화살
  for (let i = 0; i < 4; i++) {
    ctx.save()
    ctx.translate(c, c)
    ctx.rotate(Math.PI / 4 + (i * Math.PI) / 2)
    ctx.fillStyle = '#c9b49a'
    ctx.beginPath()
    ctx.moveTo(c * 0.62, 0)
    ctx.lineTo(c * 0.22, -22)
    ctx.lineTo(c * 0.22, 22)
    ctx.closePath()
    ctx.fill()
    ctx.restore()
  }
  ctx.fillStyle = '#ff8a7a'
  ctx.beginPath()
  ctx.arc(c, c, 58, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#fbf3e6'
  ctx.beginPath()
  ctx.arc(c, c, 36, 0, Math.PI * 2)
  ctx.fill()
  // Fine mineral flecks tie the compass inlay to the paving without obscuring its labels.
  const grain = seeded(721)
  for (let i = 0; i < 15500; i++) {
    const x = grain() * c * 2
    const y = grain() * c * 2
    if (Math.hypot(x - c, y - c) > c - 2) continue
    ctx.fillStyle = i % 3 === 0 ? '#72664c2d' : '#fff9db4a'
    ctx.fillRect(x, y, 1 + grain() * 2, 1 + grain() * 2)
  }
  compassTexture = new THREE.CanvasTexture(canvas)
  compassTexture.colorSpace = THREE.SRGBColorSpace
  compassTexture.anisotropy = 4
  return compassTexture
}
const COMPASS_GEO = new THREE.CircleGeometry(0.5, 64).rotateX(-Math.PI / 2)
let compassMat = null

export function HubCompass({ item }) {
  const [w] = item.size
  if (!compassMat) {
    compassMat = new THREE.MeshStandardMaterial({ map: getCompassTexture(), roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -2 })
  }
  return <mesh geometry={COMPASS_GEO} material={compassMat} position={[0, 0.14, 0]} scale={[w, 1, w]} receiveShadow userData={{ noShadow: true }} />
}

// ════════════════════════════════════════════
// 시계탑: 돌 받침 + 꽃 화단 링 + 크림색 탑 + 사방 시계(실제 시각으로 움직임) + 뾰족 지붕
// ════════════════════════════════════════════
let clockTexture = null
function getClockTexture() {
  if (clockTexture) return clockTexture
  const S = 256
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = S
  const ctx = canvas.getContext('2d')
  const c = S / 2
  ctx.fillStyle = '#fffaf0'
  ctx.beginPath()
  ctx.arc(c, c, c - 6, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = '#ff8a7a'
  ctx.lineWidth = 10
  ctx.stroke()
  ctx.fillStyle = '#3b3633'
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2
    const big = i % 3 === 0
    ctx.save()
    ctx.translate(c + Math.sin(a) * (c - 26), c - Math.cos(a) * (c - 26))
    ctx.rotate(a)
    ctx.fillRect(big ? -5 : -3, -12, big ? 10 : 6, big ? 24 : 14)
    ctx.restore()
  }
  clockTexture = new THREE.CanvasTexture(canvas)
  clockTexture.colorSpace = THREE.SRGBColorSpace
  return clockTexture
}
let clockFaceMat = null
const HAND_MAT = mat('#3b3633')

const TOWER = { plinth: 0.6, shaft: 6.6, head: 2.4, ring: 4.4 }

function clockTowerGeometry() {
  return cached('clockTower', () => {
    const P = []
    const random = seeded(11)
    const top = TOWER.plinth + TOWER.shaft
    // 받침 두 단 + 계단
    P.push(colorize(new THREE.CylinderGeometry(3.0, 3.2, 0.3, 8).translate(0, 0.15, 0), C.stoneDark))
    P.push(colorize(new THREE.CylinderGeometry(2.4, 2.6, 0.3, 8).translate(0, 0.45, 0), C.stone))
    // 꽃 화단 링 (돌 테두리 + 흙 + 꽃·덤불)
    P.push(colorize(new THREE.RingGeometry(TOWER.ring - 0.7, TOWER.ring, 40).rotateX(-Math.PI / 2).translate(0, 0.32, 0), '#6b5444'))
    range(24).forEach((i) => {
      const a = (i / 24) * Math.PI * 2
      P.push(...moved([piece('box', [0, 0.16, 0], [1.2, 0.32, 0.2], C.stone)], [Math.sin(a) * TOWER.ring, 0, Math.cos(a) * TOWER.ring], a))
      P.push(...moved([piece('box', [0, 0.16, 0], [1.0, 0.32, 0.2], C.stone)], [Math.sin(a) * (TOWER.ring - 0.75), 0, Math.cos(a) * (TOWER.ring - 0.75)], a))
    })
    range(12).forEach((i) => {
      const a = ((i + 0.5) / 12) * Math.PI * 2
      const r = TOWER.ring - 0.36
      P.push(piece('ico1', [Math.sin(a) * r, 0.55, Math.cos(a) * r], [0.38, 0.3, 0.38], i % 2 ? C.leaf : C.leaf2))
      P.push(...flowerClump(random, [Math.sin(a + 0.26) * r, 0.42, Math.cos(a + 0.26) * r], 0.3, 6))
    })
    // 탑 몸통 + 모서리 띠 + 창
    P.push(piece('box', [0, TOWER.plinth + TOWER.shaft / 2, 0], [1.7, TOWER.shaft, 1.7], C.cream))
    for (const [x, z] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) P.push(piece('box', [x * 0.85, TOWER.plinth + TOWER.shaft / 2, z * 0.85], [0.2, TOWER.shaft, 0.2], C.coral))
    for (const y of [2.2, 4.6]) {
      P.push(piece('box', [0, TOWER.plinth + y, 0], [1.86, 0.16, 1.86], C.pink))
      for (let k = 0; k < 4; k++) {
        const a = (k * Math.PI) / 2
        P.push(...moved([piece('box', [0, 0, 0.86], [0.42, 0.8, 0.05], '#fff3da', 0.9)], [0, TOWER.plinth + y + 0.75, 0], a))
      }
    }
    // 시계 머리 + 지붕
    P.push(piece('box', [0, top + TOWER.head / 2, 0], [TOWER.head, TOWER.head, TOWER.head], C.cream))
    P.push(piece('box', [0, top + 0.05, 0], [TOWER.head + 0.3, 0.2, TOWER.head + 0.3], C.coral))
    P.push(piece('box', [0, top + TOWER.head, 0], [TOWER.head + 0.4, 0.22, TOWER.head + 0.4], C.coral))
    P.push(colorize(new THREE.ConeGeometry(2.0, 2.4, 4).rotateY(Math.PI / 4).translate(0, top + TOWER.head + 1.3, 0), '#56645f'))
    P.push(piece('cyl', [0, top + TOWER.head + 2.7, 0], [0.05, 0.8, 0.05], '#d4af37'))
    P.push(piece('ico1', [0, top + TOWER.head + 3.15, 0], [0.2, 0.2, 0.2], C.pink, 1.2))
    return merge(P)
  })
}

function ClockHands({ y }) {
  const hourRefs = useRef([])
  const minuteRefs = useRef([])
  const last = useRef(-1)
  useFrame(() => {
    const now = new Date()
    const minute = now.getMinutes() + now.getSeconds() / 60
    if (Math.abs(minute - last.current) < 0.2) return // 약 12초마다만 갱신
    last.current = minute
    const hour = (now.getHours() % 12) + minute / 60
    hourRefs.current.forEach((m) => m && (m.rotation.z = -(hour / 12) * Math.PI * 2))
    minuteRefs.current.forEach((m) => m && (m.rotation.z = -(minute / 60) * Math.PI * 2))
  })
  if (!clockFaceMat) clockFaceMat = nightGlow(new THREE.MeshStandardMaterial({ map: getClockTexture(), emissive: '#ffffff', emissiveMap: getClockTexture(), emissiveIntensity: 0.15 }), 0.9)
  return range(4).map((k) => (
    <group key={k} rotation={[0, (k * Math.PI) / 2, 0]}>
      <group position={[0, y, TOWER.head / 2 + 0.02]}>
        <mesh geometry={GEO.plane} material={clockFaceMat} scale={[1.8, 1.8, 1]} />
        <group ref={(el) => (hourRefs.current[k] = el)} position={[0, 0, 0.03]}>
          <mesh geometry={GEO.box} material={HAND_MAT} position={[0, 0.25, 0]} scale={[0.09, 0.5, 0.03]} />
        </group>
        <group ref={(el) => (minuteRefs.current[k] = el)} position={[0, 0, 0.05]}>
          <mesh geometry={GEO.box} material={HAND_MAT} position={[0, 0.36, 0]} scale={[0.06, 0.72, 0.03]} />
        </group>
      </group>
    </group>
  ))
}

export function HubClockTower() {
  const geometry = clockTowerGeometry()
  return (
    <group>
      <mesh geometry={geometry} material={HUB_MAT} castShadow receiveShadow />
      <ClockHands y={TOWER.plinth + TOWER.shaft + TOWER.head / 2} />
    </group>
  )
}

// ════════════════════════════════════════════
// 나무 둘레 벤치 (팔각형, 가운데는 나무가 서는 자리)
// ════════════════════════════════════════════
export function HubTreeBench({ item }) {
  const r = (item.size[0] ?? 3) / 2
  const geometry = cached(`treeBench:${r}`, () => {
    const P = []
    range(8).forEach((i) => {
      const a = (i / 8) * Math.PI * 2 + Math.PI / 8
      const side = 2 * r * Math.tan(Math.PI / 8) + 0.02
      P.push(...moved([piece('box', [0, 0.45, 0], [side, 0.08, 0.55], C.wood), piece('box', [0, 0.22, 0.12], [0.08, 0.44, 0.08], C.dark)], [Math.sin(a) * r, 0, Math.cos(a) * r], a))
      P.push(...moved([piece('box', [0, 0.72, 0], [2 * (r - 0.3) * Math.tan(Math.PI / 8), 0.4, 0.06], C.wood)], [Math.sin(a) * (r - 0.27), 0, Math.cos(a) * (r - 0.27)], a))
    })
    return merge(P)
  })
  return <mesh geometry={geometry} material={HUB_MAT} castShadow receiveShadow />
}

// ════════════════════════════════════════════
// 방향 표지판: 나무 기둥에 네 구역 방향 팻말 (실제 방위 기준, 앞뒤 모두 글씨)
// ════════════════════════════════════════════
const POST_BOARDS = [
  { key: 'JM', rot: Math.PI / 2, y: 2.75 },
  { key: 'BK', rot: 0, y: 2.35 },
  { key: 'HJ', rot: -Math.PI / 2, y: 1.95 },
  { key: 'SG', rot: Math.PI, y: 1.55 },
]
const BOARD = { len: 1.7, h: 0.32 }

export function HubSignpost() {
  const geometry = cached('signpost', () => {
    const P = [piece('cyl', [0, 1.6, 0], [0.09, 3.2, 0.09], C.woodDark), piece('cyl', [0, 0.1, 0], [0.32, 0.2, 0.32], C.stone), piece('ico1', [0, 3.28, 0], [0.13, 0.13, 0.13], C.coral)]
    for (const b of POST_BOARDS) {
      const board = [
        piece('box', [0.18 + BOARD.len / 2, 0, 0], [BOARD.len, BOARD.h, 0.06], ZONE[b.key].color),
        colorize(new THREE.ConeGeometry(BOARD.h * 0.72, 0.32, 3).rotateZ(-Math.PI / 2).rotateX(Math.PI / 2).scale(1, 1, 0.06 / (BOARD.h * 0.72)).translate(0.18 + BOARD.len + 0.14, 0, 0), ZONE[b.key].color),
      ]
      P.push(...moved(board, [0, b.y, 0], b.rot))
    }
    return merge(P)
  })
  return (
    <group>
      <mesh geometry={geometry} material={HUB_MAT} castShadow />
      {POST_BOARDS.map((b) => {
        const material = mat('#ffffff')
        const tex = signMaterial(ZONE[b.key].area, ZONE[b.key].color)
        return (
          <group key={b.key} position={[0, b.y, 0]} rotation={[0, b.rot, 0]}>
            <mesh geometry={GEO.plane} material={tex ?? material} position={[0.18 + BOARD.len / 2, 0, 0.035]} scale={[BOARD.len - 0.1, BOARD.h - 0.06, 1]} />
            <mesh geometry={GEO.plane} material={tex ?? material} position={[0.18 + BOARD.len / 2, 0, -0.035]} rotation={[0, Math.PI, 0]} scale={[BOARD.len - 0.1, BOARD.h - 0.06, 1]} />
          </group>
        )
      })}
    </group>
  )
}

const signMats = new Map()
function signMaterial(text, bg, fg = '#3b3633', aspect = BOARD.len / BOARD.h) {
  const key = `${text}|${bg}|${fg}|${aspect.toFixed(2)}`
  if (!signMats.has(key)) {
    const texture = getSignTexture(text, bg, fg, aspect)
    signMats.set(key, nightGlow(new THREE.MeshStandardMaterial({ map: texture, emissive: '#ffffff', emissiveMap: texture, emissiveIntensity: 0.1 }), 0.7))
  }
  return signMats.get(key)
}

// ════════════════════════════════════════════
// 안내 지도판: 지붕 달린 게시판 + 미니 지도(광장 가운데, 네 구역, 현재 위치)
// ════════════════════════════════════════════
let mapTexture = null
function getMapTexture() {
  if (mapTexture) return mapTexture
  const W = 512
  const H = 340
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#fffaf0'
  ctx.fillRect(0, 0, W, H)
  ctx.fillStyle = '#3b3633'
  ctx.font = 'bold 30px sans-serif'
  ctx.textAlign = 'left'
  ctx.fillText('SceneWalk 안내 지도', 20, 42)
  const cx = 300
  const cy = 190
  const u = 46
  // 길
  ctx.fillStyle = '#d6cfc4'
  ctx.fillRect(cx - 8, cy - u * 2.6, 16, u * 5.2)
  ctx.fillRect(cx - u * 2.6, cy - 8, u * 5.2, 16)
  const box = (x, y, w, h, color, label) => {
    ctx.fillStyle = color
    ctx.fillRect(x, y, w, h)
    ctx.fillStyle = '#3b3633'
    ctx.textAlign = 'center'
    // 칸 폭에 맞게 글자 크기 줄임
    let size = 20
    do {
      ctx.font = `bold ${size}px sans-serif`
      size -= 1
    } while (ctx.measureText(label).width > w - 6 && size > 10)
    ctx.fillText(label, x + w / 2, y + h / 2 + size * 0.35)
  }
  box(cx - u * 0.85, cy - u * 2.75, u * 1.7, u * 1.4, ZONE.JM.color, ZONE.JM.area)
  box(cx + u * 1.35, cy - u * 0.7, u * 1.4, u * 1.4, ZONE.BK.color, ZONE.BK.area)
  box(cx - u * 0.85, cy + u * 1.35, u * 1.7, u * 1.4, ZONE.HJ.color, ZONE.HJ.area)
  box(cx - u * 2.75, cy - u * 0.7, u * 1.4, u * 1.4, ZONE.SG.color, ZONE.SG.area)
  ctx.fillStyle = '#e9e1d4'
  ctx.fillRect(cx - u * 0.6, cy - u * 0.6, u * 1.2, u * 1.2)
  ctx.fillStyle = '#ff5c8a'
  ctx.beginPath()
  ctx.arc(cx, cy + u * 0.3, 9, 0, Math.PI * 2)
  ctx.fill()
  // 범례
  ctx.textAlign = 'left'
  ctx.font = '18px sans-serif'
  const rows = ['JM', 'BK', 'HJ', 'SG'].map((key) => [key, ZONE[key].area])
  rows.forEach(([key, label], i) => {
    ctx.fillStyle = ZONE[key].color
    ctx.fillRect(20, 82 + i * 36, 22, 22)
    ctx.fillStyle = '#3b3633'
    ctx.fillText(label, 52, 100 + i * 36)
  })
  ctx.fillStyle = '#ff5c8a'
  ctx.beginPath()
  ctx.arc(31, 245, 9, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#3b3633'
  ctx.fillText('현재 위치', 52, 251)
  mapTexture = new THREE.CanvasTexture(canvas)
  mapTexture.colorSpace = THREE.SRGBColorSpace
  return mapTexture
}
let mapMat = null

export function HubMapBoard() {
  const geometry = cached('mapBoard', () =>
    merge([
      ...[-1.35, 1.35].map((x) => piece('box', [x, 1.25, 0], [0.12, 2.5, 0.12], C.woodDark)),
      piece('box', [0, 1.55, -0.03], [2.6, 1.8, 0.08], C.woodDark),
      piece('box', [0, 2.62, 0.05], [3.0, 0.1, 0.7], C.coral),
      piece('box', [0, 2.72, 0.05], [2.6, 0.12, 0.5], C.cream),
      piece('box', [0, 2.45, 0.25], [0.5, 0.06, 0.12], C.lamp, 1.2),
      piece('box', [0, 0.45, 0.06], [2.4, 0.08, 0.2], C.wood),
    ]),
  )
  if (!mapMat) mapMat = nightGlow(new THREE.MeshStandardMaterial({ map: getMapTexture(), emissive: '#ffffff', emissiveMap: getMapTexture(), emissiveIntensity: 0.12 }), 0.75)
  return (
    <group>
      <mesh geometry={geometry} material={HUB_MAT} castShadow />
      <mesh geometry={GEO.plane} material={mapMat} position={[0, 1.55, 0.02]} scale={[2.4, 1.6, 1]} />
    </group>
  )
}

// ════════════════════════════════════════════
// 퍼걸러 쉼터: 나무 기둥 + 지붕 살 + 덩굴·꽃 + 안쪽 벤치 + 매달린 전구 (size = [가로, 높이, 깊이])
// ════════════════════════════════════════════
export function HubPergola({ item }) {
  const [w, h, d] = item.size
  const geometry = cached(`pergola:${w}:${h}:${d}`, () => {
    const P = []
    const random = seeded(Math.round(w * 13 + d * 7))
    const cols = Math.max(2, Math.round(w / 2.4) + 1)
    for (let i = 0; i < cols; i++) {
      const x = -w / 2 + (w * i) / (cols - 1)
      for (const z of [-d / 2, d / 2]) {
        P.push(piece('box', [x, h / 2, z], [0.22, h, 0.22], C.cream))
        P.push(piece('box', [x, 0.12, z], [0.4, 0.24, 0.4], C.stone))
      }
    }
    for (const z of [-d / 2, d / 2]) P.push(piece('box', [0, h - 0.1, z], [w + 0.6, 0.22, 0.18], C.wood))
    const slats = Math.round(w / 0.55)
    for (let i = 0; i <= slats; i++) P.push(piece('box', [-w / 2 + (w * i) / slats, h + 0.1, 0], [0.1, 0.16, d + 0.8], C.wood))
    // 덩굴 (지붕 위 초록 덩어리 + 꽃)
    range(Math.round(w * 1.6)).forEach(() => {
      const x = (random() - 0.5) * w
      const z = (random() - 0.5) * d
      P.push(piece('ico1', [x, h + 0.3, z], [0.45 + random() * 0.3, 0.22, 0.45 + random() * 0.3], random() < 0.5 ? C.leaf : C.leaf2))
    })
    P.push(...flowerClump(random, [0, h + 0.42, 0], Math.min(w, d) / 2, Math.round(w * 4)))
    // 기둥 감은 덩굴
    for (const x of [-w / 2, w / 2]) for (const z of [-d / 2, d / 2]) P.push(piece('ico1', [x, h * 0.55, z], [0.3, h * 0.45, 0.3], C.leaf))
    // 벤치 두 줄 (마주 보게)
    P.push(...moved(benchParts(Math.min(2.4, w - 1)), [-w / 4, 0, -d / 2 + 0.6], 0))
    P.push(...moved(benchParts(Math.min(2.4, w - 1)), [w / 4, 0, d / 2 - 0.6], Math.PI))
    P.push(piece('cyl', [0, 0.35, 0], [0.45, 0.06, 0.45], C.cream), piece('cyl', [0, 0.17, 0], [0.06, 0.34, 0.06], C.dark))
    // 매달린 전구 줄
    range(Math.round(w * 2)).forEach((i) => {
      const t = (i + 0.5) / Math.round(w * 2)
      P.push(piece('ico', [-w / 2 + w * t, h - 0.35 - Math.sin(Math.PI * t) * 0.3, 0], [0.07, 0.07, 0.07], C.lamp, 1.6))
    })
    return merge(P)
  })
  return <mesh geometry={geometry} material={HUB_MAT} castShadow receiveShadow />
}

// ════════════════════════════════════════════
// 푸드트럭: 민트색 트럭 + 열린 판매창(안쪽 불빛) + 줄무늬 차양 + 메뉴판 (앞 = +z, 판매창도 +z)
// ════════════════════════════════════════════
export function HubFoodTruck({ item }) {
  const sign = item.signs?.[0] ?? { text: 'SceneWalk 커피 · 핫도그', bg: '#ff8a7a', fg: '#ffffff' }
  const geometry = cached('foodTruck', () => {
    const P = []
    // 몸통·운전석
    P.push(piece('box', [-0.4, 1.55, 0], [3.8, 2.2, 2.1], C.mint))
    P.push(piece('box', [2.05, 1.15, 0], [1.2, 1.5, 2.0], C.mint))
    P.push(piece('box', [2.62, 1.45, 0], [0.06, 0.7, 1.7], '#bfe6ff', 0.2))
    P.push(piece('box', [-0.4, 0.42, 0], [5.0, 0.18, 2.12], C.cream))
    P.push(piece('box', [-0.4, 2.7, 0], [3.9, 0.12, 2.2], C.cream))
    // 바퀴
    for (const x of [-1.6, 1.8]) for (const z of [-1.0, 1.0]) P.push(piece('cyl', [x, 0.38, z], [0.38, 0.22, 0.38], '#2b2d30', 0, [Math.PI / 2, 0, 0]))
    // 판매창 (안쪽이 밝게) + 선반 + 컵
    P.push(piece('box', [-0.5, 1.75, 1.06], [2.4, 1.0, 0.02], '#ffe8c2', 0.9))
    P.push(piece('box', [-0.5, 1.22, 1.2], [2.6, 0.08, 0.36], C.wood))
    range(5).forEach((i) => P.push(piece('cyl', [-1.4 + i * 0.4, 1.34, 1.22], [0.07, 0.16, 0.07], i % 2 ? C.cream : C.pink)))
    // 줄무늬 차양 (기울어짐)
    range(8).forEach((i) => P.push(piece('box', [-1.85 + i * 0.41, 2.42, 1.42], [0.41, 0.05, 0.85], i % 2 ? '#ffffff' : C.coral, 0, [0.35, 0, 0])))
    // 지붕 간판 받침 + 컵 모형
    P.push(piece('box', [-0.4, 3.05, 0], [2.6, 0.6, 0.12], C.cream))
    P.push(piece('cyl', [1.25, 3.05, 0], [0.22, 0.5, 0.22], C.pink), piece('cyl', [1.25, 3.33, 0], [0.24, 0.06, 0.24], C.cream))
    // 옆 메뉴 입간판
    P.push(...moved([piece('box', [0, 0.6, 0], [0.7, 1.0, 0.05], '#2f4f3a', 0.15), piece('box', [0, 0.05, -0.2], [0.7, 0.05, 0.5], C.woodDark)], [-3.1, 0, 1.4], 0.4))
    return merge(P)
  })
  return (
    <group>
      <mesh geometry={geometry} material={HUB_MAT} castShadow receiveShadow />
      <mesh geometry={GEO.plane} material={signMaterial(sign.text, sign.bg, sign.fg, 2.5 / 0.5)} position={[-0.4, 3.05, 0.07]} scale={[2.5, 0.5, 1]} />
      <mesh geometry={GEO.plane} material={signMaterial(sign.text, sign.bg, sign.fg, 2.5 / 0.5)} position={[-0.4, 3.05, -0.07]} rotation={[0, Math.PI, 0]} scale={[2.5, 0.5, 1]} />
    </group>
  )
}

// ════════════════════════════════════════════
// 버스킹 무대: 낮은 원형 나무 무대 + 아치 프레임(전구) + 스피커 + 마이크 + 간판 (앞 = +z)
// ════════════════════════════════════════════
export function HubBuskingStage({ item }) {
  const r = item.size[0] / 2
  const stageH = item.size[1]
  const sign = item.signs?.[0] ?? { text: '버스킹 존 · 누구나 무대', bg: '#c4b5fd', fg: '#3b3633' }
  const geometry = cached(`busking:${r}:${stageH}`, () => {
    const P = []
    P.push(colorize(new THREE.CylinderGeometry(r, r + 0.1, stageH, 24).translate(0, stageH / 2, 0), C.wood))
    P.push(colorize(new THREE.CylinderGeometry(r + 0.12, r + 0.12, 0.06, 24).translate(0, stageH - 0.02, 0), C.woodDark))
    // 무대 앞 계단 한 칸
    P.push(piece('box', [0, stageH / 4, r + 0.25], [1.8, stageH / 2, 0.5], C.woodDark))
    // 아치 프레임 (뒤쪽 반원) + 전구
    const arch = new THREE.TorusGeometry(r - 0.3, 0.09, 6, 24, Math.PI)
    P.push(colorize(arch.translate(0, stageH + 0.6, -r * 0.55), C.coral))
    for (const x of [-(r - 0.3), r - 0.3]) P.push(piece('box', [x, stageH + 0.3, -r * 0.55], [0.16, 0.6, 0.16], C.coral))
    range(16).forEach((i) => {
      const a = (i / 15) * Math.PI
      P.push(piece('ico', [Math.cos(a) * (r - 0.3), stageH + 0.6 + Math.sin(a) * (r - 0.3), -r * 0.55 + 0.1], [0.08, 0.08, 0.08], C.lamp, 1.6))
    })
    // 스피커 두 개 + 마이크 + 의자
    for (const x of [-r + 0.7, r - 0.7]) {
      P.push(piece('box', [x, stageH + 0.55, -0.4], [0.6, 1.1, 0.5], '#2b2d30'))
      P.push(piece('cyl', [x, stageH + 0.75, -0.14], [0.17, 0.02, 0.17], '#555', 0, [Math.PI / 2, 0, 0]))
      P.push(piece('cyl', [x, stageH + 0.35, -0.14], [0.12, 0.02, 0.12], '#555', 0, [Math.PI / 2, 0, 0]))
    }
    P.push(piece('cyl', [0, stageH + 0.75, 0.6], [0.02, 1.5, 0.02], '#2b2d30'), piece('ico', [0, stageH + 1.52, 0.6], [0.06, 0.08, 0.06], '#9ca3af'))
    P.push(piece('box', [0.9, stageH + 0.45, 0.1], [0.45, 0.06, 0.45], C.pink), piece('box', [0.9, stageH + 0.22, 0.1], [0.06, 0.44, 0.06], C.dark))
    return merge(P)
  })
  return (
    <group>
      <mesh geometry={geometry} material={HUB_MAT} castShadow receiveShadow />
      <mesh geometry={GEO.plane} material={signMaterial(sign.text, sign.bg, sign.fg, 2.6 / 0.42)} position={[0, stageH + 0.6 + r - 0.05, -r * 0.55 + 0.02]} scale={[2.6, 0.42, 1]} />
    </group>
  )
}
