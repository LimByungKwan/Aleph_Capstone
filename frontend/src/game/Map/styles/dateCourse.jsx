import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { hipRoofGeometry } from './geometry.js'
import { getCirclePlazaTexture, getNeonWingsTexture, getSignTexture, getStripeTexture, getTiledTexture } from './textures.js'
import { Ball, Box, Cone, Cyl, GEO, Instances, hashString, mat, seeded, texMat } from './kit.jsx'
import SeasonalTree from './SeasonalTree.jsx'
import { live } from '../../timeOfDay.js'
import { TowerTelescopes } from './bk_telescope.jsx'
import { PhotoBooth } from './bk_photoBooth.jsx'
import { FountainCoinToss } from './bk_coinToss.jsx'
import { CafeOrderCounter } from './bk_cafeOrder.jsx'
import { EpisodeScenery } from './bk_episodeScenery.jsx'
import { MuralFrameScene } from './bk_muralFrame.jsx'
import { WINE_BAR_ID, WineTastingSpot } from './bk_wineTasting.jsx'
import { FOUNTAIN_BASIN_TOP, PHOTO_DECK, lockFenceArcs, terraceTableOffsets } from './bk_dateColliders.jsx'

// BK "데이트 코스" 구역용 스타일 (전망 타워, 분수, 한옥 가게, 벚꽃 등).
// 최적화: 공용 도형·재질(kit.jsx), 반복 물체는 <Instances>, 작은 물체·빛나는 재질은 그림자 끔.

const CREAM = '#fbf3e6'
const CORAL = '#ff8a7a'
const PINK = '#f9a8d4'
const WOOD = '#8b5e3c'
const ROOF = '#3d434b'
const STONE = '#a7a29a'
const DARK = '#2b2d30'

// ── 밤 조명 ───────────────────────────────────
// 시간대가 밤이 되면(live.stars 0 → 1) 창문·실내·등불·전구가 더 밝게 빛나고, 등불 가로등 아래 바닥에 불빛이 번져요.
// 최적화: 진짜 조명(PointLight)은 쓰지 않음 → 화면 전체 조명 계산이 늘지 않음.
//         빛나는 재질 세기만 바꾸고, 바닥 불빛·빛무리는 낮에는 아예 그리지 않음. 값이 그대로면 계산도 생략.
const NIGHT_MATS = [] // [재질, 낮 세기, 밤 세기]
export const NIGHT_UNIFORM = { value: 0 } // 실내 재질(INTERIOR_MAT)용 밤 정도
let nightFrame = -1
let nightLast = -1

export function nightGlow(material, nightIntensity) {
  if (!NIGHT_MATS.some(([m]) => m === material)) {
    NIGHT_MATS.push([material, material.emissiveIntensity, nightIntensity])
    nightLast = -1 // 새 재질이 생기면 다음 프레임에 한 번 다시 맞춤
  }
  return material
}

function getGlowTexture() {
  if (getGlowTexture.cache) return getGlowTexture.cache
  const size = 128
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const ctx = canvas.getContext('2d')
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  g.addColorStop(0, 'rgba(255,255,255,1)')
  g.addColorStop(0.35, 'rgba(255,255,255,0.55)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, size, size)
  getGlowTexture.cache = new THREE.CanvasTexture(canvas)
  getGlowTexture.cache.colorSpace = THREE.SRGBColorSpace
  return getGlowTexture.cache
}

// 가로등 아래 바닥에 번지는 따뜻한 불빛 (모든 가로등이 재질 1개 공유)
const POOL_GEO = new THREE.CircleGeometry(5, 32).rotateX(-Math.PI / 2)
const POOL_MAT = new THREE.MeshBasicMaterial({
  color: '#ffb05a',
  transparent: true,
  opacity: 0,
  visible: false,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
  polygonOffset: true,
  polygonOffsetFactor: -2,
})
// 등불 둘레 빛무리 (항상 카메라를 바라보는 판)
const HALO_MAT = new THREE.SpriteMaterial({ color: '#ffc982', transparent: true, opacity: 0, visible: false, depthWrite: false, blending: THREE.AdditiveBlending })

// 한 프레임에 한 번만 (가로등 여러 개가 불러도) 밤 정도에 맞춰 재질 세기 갱신
function updateNight(frame) {
  if (frame === nightFrame) return
  nightFrame = frame
  const k = live.stars
  if (Math.abs(k - nightLast) < 0.001) return
  nightLast = k
  for (const [material, day, night] of NIGHT_MATS) material.emissiveIntensity = day + (night - day) * k
  NIGHT_UNIFORM.value = k
  if (!POOL_MAT.map) {
    POOL_MAT.map = HALO_MAT.map = getGlowTexture()
    POOL_MAT.needsUpdate = HALO_MAT.needsUpdate = true
  }
  POOL_MAT.opacity = 0.55 * k
  HALO_MAT.opacity = 0.85 * k
  POOL_MAT.visible = HALO_MAT.visible = k > 0.02
}

// BK 구역 안에 있을 때만 밤에 켜지는 따뜻한 거리 조명 (가로등·간판 불빛이 건물 벽과 길을 은은하게 비추는 느낌)
// 최적화: 방향 계산이 없는 AmbientLight 1개. 항상 달려 있어서 켜고 끌 때 셰이더를 다시 만들지 않고 세기만 바뀜.
const BK_AREA = { minX: 45, maxX: 125, minZ: -120, maxZ: 40, fade: 30 } // 월드 좌표 (zones/bk_date.json origin·size 기준)
const lookPoint = new THREE.Vector3()
function BkNightAmbient() {
  const ref = useRef(null)
  useFrame(({ camera, controls }) => {
    const light = ref.current
    if (!light) return
    if (controls?.target) lookPoint.copy(controls.target)
    else lookPoint.copy(camera.position)
    const dx = Math.max(BK_AREA.minX - lookPoint.x, 0, lookPoint.x - BK_AREA.maxX)
    const dz = Math.max(BK_AREA.minZ - lookPoint.z, 0, lookPoint.z - BK_AREA.maxZ)
    const inside = 1 - Math.min(Math.hypot(dx, dz) / BK_AREA.fade, 1)
    const wanted = 0.55 * live.stars * inside // 맵 전체 밤 조명 위에 살짝 더함 (경계에서 밝기 차이가 크지 않게)
    light.intensity += (wanted - light.intensity) * 0.08
  })
  return <ambientLight ref={ref} color="#ffcf9e" intensity={0} />
}

const WARM_GLASS = nightGlow(mat('#fff3da', { emissive: '#ffcf8a', emissiveIntensity: 0.55, roughness: 0.3 }), 1.5)
const TOWER_GLASS = nightGlow(mat('#fff4e0', { emissive: '#ffcf91', emissiveIntensity: 0.65, roughness: 0.2 }), 1.6)
export const LANTERN = nightGlow(mat('#fff1c9', { emissive: '#ffc566', emissiveIntensity: 1.1 }), 2.6)
const BULB = nightGlow(mat('#fff6d8', { emissive: '#ffd27a', emissiveIntensity: 1.6 }), 3.2)
const WATER = nightGlow(mat('#8fd3f4', { emissive: '#4aa8e0', emissiveIntensity: 0.25, roughness: 0.1 }), 0.7)
const SPRAY = mat('#e0f4ff', { transparent: true, opacity: 0.55, emissive: '#bfe6ff', emissiveIntensity: 0.4 })
const TINTABLE = mat('#ffffff', { flat: true }) // 인스턴스마다 색을 입힐 때 쓰는 흰 재질
const ROOF_MAT = mat(ROOF, { flat: true, double: true })
const NO_SHADOW = { noShadow: true }

const FLOWER_COLORS = ['#f472b6', '#f9a8d4', '#c4b5fd', '#a78bfa', '#fde68a', '#ffffff']
const range = (n) => Array.from({ length: n }, (_, i) => i)

// 지붕 모양은 크기가 같으면 재사용
const roofCache = new Map()
function roofGeometry(w, d, h, lift) {
  const key = `${w}|${d}|${h}|${lift}`
  if (!roofCache.has(key)) roofCache.set(key, hipRoofGeometry(w, d, h, lift))
  return roofCache.get(key)
}

export function HanokRoof({ w, d, y, h, lift = 0.4 }) {
  const ridge = Math.abs(w - d) + 0.6
  return (
    <group position={[0, y, 0]}>
      <mesh geometry={roofGeometry(w, d, h, lift)} material={ROOF_MAT} />
      <Box p={[0, h + 0.08, 0]} s={[ridge, 0.25, 0.3]} r={[0, d > w ? Math.PI / 2 : 0, 0]} c="#2c3036" />
    </group>
  )
}

// 꽃 여러 송이 (인스턴스 목록)
function flowerItems(seed, count, area, y, size = 0.13) {
  const random = seeded(seed)
  return range(count).map(() => {
    const [x, z] = area(random)
    const s = size * (0.7 + random() * 0.6)
    return { p: [x, y + s * 0.5, z], s: [s, s, s], c: FLOWER_COLORS[Math.floor(random() * FLOWER_COLORS.length)] }
  })
}

// 처지는 줄조명 전구 (from → to)
function bulbLine(from, to, count, sag = 0.25) {
  return range(count).map((i) => {
    const t = (i + 0.5) / count
    return {
      p: [from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t - sag * Math.sin(Math.PI * t), from[2] + (to[2] - from[2]) * t],
      s: [0.07, 0.07, 0.07],
    }
  })
}

// ── 벚꽃 나무 ─────────────────────────────────
export function CherryTree({ item }) {
  return <SeasonalTree item={item} kind="sakura" planter={item.planter} />
}

export function LanternGlow({ height, groundY = 0.03, poolScale = 1, haloSize = 2.4 }) {
  useFrame((state) => updateNight(state.gl.info.render.frame))
  return (
    <>
      <mesh geometry={POOL_GEO} material={POOL_MAT} position={[0, groundY, 0]} scale={poolScale} renderOrder={2} userData={NO_SHADOW} />
      <sprite material={HALO_MAT} position={[0, height, 0]} scale={[haloSize, haloSize, 1]} renderOrder={3} />
    </>
  )
}

// ── 등불 가로등 ───────────────────────────────
export function LanternLamp({ item }) {
  const [, h] = item.size
  return (
    <group>
      <LanternGlow height={h + 0.3} />
      <Cyl p={[0, 0.15, 0]} rad={0.14} h={0.3} c={DARK} geo={GEO.cyl8} />
      <Cyl p={[0, h / 2, 0]} rad={0.06} h={h} c={DARK} geo={GEO.cyl8} />
      <Box p={[0, h + 0.03, 0]} s={[0.46, 0.06, 0.46]} c={DARK} />
      <Box p={[0, h + 0.3, 0]} s={[0.4, 0.5, 0.4]} m={LANTERN} userData={NO_SHADOW} />
      <Cone p={[0, h + 0.66, 0]} rad={0.36} h={0.22} r={[0, Math.PI / 4, 0]} c={DARK} />
    </group>
  )
}

// ── 분수 (꽃 화단 링 포함) ─────────────────────
export function Fountain({ item }) {
  const radius = item.size[0] / 2
  const flowers = useMemo(
    () =>
      flowerItems(
        hashString(item.id),
        70,
        (random) => {
          const a = random() * Math.PI * 2
          const r = radius + 0.35 + random() * 0.55
          return [Math.cos(a) * r, Math.sin(a) * r]
        },
        0.30,
      ),
    [item.id, radius],
  )
  return (
    <group>
      <BkNightAmbient />
      <Cyl p={[0, 0.12, 0]} rad={radius + 1} h={0.24} c="#7fb069" geo={GEO.cyl48} />
      <LowStoneRim x={0} y={0.20} z={0} radius={radius + 1} height={0.16} />
      <Cyl p={[0, 0.35, 0]} rad={radius} h={0.7} c="#ece6dd" geo={GEO.cyl48} />
      <Cyl p={[0, 0.49, 0]} rad={radius + 0.018} h={0.09} c="#c9b5a3" geo={GEO.cyl48} />
      <LowStoneRim x={0} y={0.59} z={0} radius={radius} height={FOUNTAIN_BASIN_TOP - 0.59} />
      <Cyl p={[0, 0.68, 0]} rad={radius - 0.25} h={0.06} m={WATER} geo={GEO.cyl48} userData={NO_SHADOW} />
      <Cyl p={[0, 1.1, 0]} rad={0.35} h={1} c="#ece6dd" />
      <Cyl p={[0, 1.65, 0]} rad={1} h={0.25} c="#ece6dd" />
      <Cyl p={[0, 1.8, 0]} rad={0.82} h={0.05} m={WATER} userData={NO_SHADOW} />
      <Cyl p={[0, 2.05, 0]} rad={0.16} h={0.55} c="#ece6dd" />
      <Instances geometry={GEO.ico} material={TINTABLE} items={flowers} />
      <FountainWater radius={radius} />
      {/* 분수 동전 던지기 체험 (bk_coinToss.jsx) */}
      <FountainCoinToss item={item} />
    </group>
  )
}

const RIM_TOP = new THREE.RingGeometry(0.94, 1, 48).rotateX(-Math.PI / 2)
const RIM_SIDE = new THREE.CylinderGeometry(1, 1, 1, 48, 1, true)
const RIM_STONE = mat('#ccb49e', { double: true })

function LowStoneRim({ x, y, z, radius, height }) {
  return (
    <group position={[x, y, z]} userData={NO_SHADOW}>
      <mesh geometry={RIM_SIDE} material={RIM_STONE} position={[0, height / 2, 0]} scale={[radius, height, radius]} />
      <mesh geometry={RIM_TOP} material={RIM_STONE} position={[0, height, 0]} scale={[radius, 1, radius]} />
    </group>
  )
}

// ── 분수 물줄기 (흐르는 물 + 물결 + 거품) ──────
// 최적화: 물줄기 15개를 모양 하나로 합쳐 그리기 호출 1번, 흐름은 텍스처 위치만 매 프레임 이동,
//         거품은 인스턴스 1번, 그림자 없음, 이미지 파일 없이 캔버스로 무늬 생성
const FOUNTAIN = { lowerWater: 0.72, upperWater: 1.83, jetBase: 2.32, jetTop: 3.35 }

// 물줄기 무늬: 세로로 흐르는 밝은 줄 + 끊김 (투명도 맵)
let streakTexture = null
function getStreakTexture() {
  if (streakTexture) return streakTexture
  const canvas = document.createElement('canvas')
  canvas.width = 128
  canvas.height = 16
  const ctx = canvas.getContext('2d')
  const random = seeded(5)
  ctx.fillStyle = '#7a7a7a'
  ctx.fillRect(0, 0, 128, 16)
  for (let i = 0; i < 14; i++) {
    const x = random() * 128
    const len = 10 + random() * 26
    const g = 200 + Math.floor(random() * 55)
    ctx.fillStyle = `rgb(${g},${g},${g})`
    ctx.fillRect(x, 0, len, 16)
    ctx.fillRect(x - 128, 0, len, 16)
  }
  streakTexture = new THREE.CanvasTexture(canvas)
  streakTexture.wrapS = streakTexture.wrapT = THREE.RepeatWrapping
  streakTexture.repeat.set(2, 1)
  return streakTexture
}

const waterGeometryCache = new Map()
function fountainWaterGeometry(radius) {
  if (waterGeometryCache.has(radius)) return waterGeometryCache.get(radius)
  const F = FOUNTAIN
  const tubes = []
  const v = (x, y, z) => new THREE.Vector3(x, y, z)
  // 1) 가운데 위로 솟는 물기둥
  tubes.push(new THREE.TubeGeometry(new THREE.LineCurve3(v(0, F.jetBase, 0), v(0, F.jetTop, 0)), 6, 0.075, 7))
  // 2) 꼭대기에서 위 그릇으로 떨어지는 물줄기 6개
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2
    const [c, s] = [Math.cos(a), Math.sin(a)]
    const curve = new THREE.QuadraticBezierCurve3(v(0, F.jetTop, 0), v(c * 0.5, F.jetTop + 0.45, s * 0.5), v(c * 0.72, F.upperWater, s * 0.72))
    tubes.push(new THREE.TubeGeometry(curve, 12, 0.035, 5))
  }
  // 3) 위 그릇 가장자리에서 아래 수조로 넘치는 물줄기 8개
  const land = Math.min(radius - 0.45, 1.65)
  for (let i = 0; i < 8; i++) {
    const a = ((i + 0.5) / 8) * Math.PI * 2
    const [c, s] = [Math.cos(a), Math.sin(a)]
    const curve = new THREE.QuadraticBezierCurve3(v(c * 0.98, F.upperWater - 0.02, s * 0.98), v(c * (land + 0.05), F.upperWater + 0.05, s * (land + 0.05)), v(c * land, F.lowerWater, s * land))
    tubes.push(new THREE.TubeGeometry(curve, 12, 0.05, 5))
  }
  const merged = mergeGeometries(tubes)
  tubes.forEach((t) => t.dispose())
  const result = { geometry: merged, land }
  waterGeometryCache.set(radius, result)
  return result
}

const STREAM_MATERIAL = nightGlow(new THREE.MeshStandardMaterial({
  color: '#e3f6ff',
  emissive: '#a7dcff',
  emissiveIntensity: 0.45,
  roughness: 0.15,
  transparent: true,
  opacity: 0.85,
  depthWrite: false,
  side: THREE.DoubleSide,
}), 0.9)
const FOAM = mat('#ffffff', { emissive: '#e6f6ff', emissiveIntensity: 0.4, flat: true })
const RIPPLE_GEOMETRY = new THREE.RingGeometry(0.85, 1, 32).rotateX(-Math.PI / 2)

function FountainWater({ radius }) {
  const { geometry, land } = fountainWaterGeometry(radius)
  const ripples = useRef([])
  const crown = useRef(null)

  // 물결 3개는 각자 투명도가 달라야 해서 재질을 따로 (분수 하나당 3개)
  const rippleMaterials = useMemo(
    () => [0, 1, 2].map(() => new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0, depthWrite: false })),
    [],
  )
  const foam = useMemo(
    () =>
      range(8).map((i) => {
        const a = ((i + 0.5) / 8) * Math.PI * 2
        return { p: [Math.cos(a) * land, FOUNTAIN.lowerWater + 0.02, Math.sin(a) * land], s: [0.22, 0.06, 0.22] }
      }),
    [land],
  )

  useMemo(() => {
    STREAM_MATERIAL.alphaMap = getStreakTexture()
    STREAM_MATERIAL.needsUpdate = true
  }, [])

  useFrame(({ clock }, delta) => {
    const texture = STREAM_MATERIAL.alphaMap
    if (texture) texture.offset.x = (texture.offset.x - delta * 1.4) % 1 // 물이 흘러가는 방향으로 무늬 이동
    const t = clock.elapsedTime
    // 물결: 안쪽에서 바깥으로 퍼지며 사라짐 (위상 차이로 3개가 번갈아)
    ripples.current.forEach((ring, i) => {
      if (!ring) return
      const phase = (t * 0.45 + i / 3) % 1
      const isUpper = i === 0
      const base = isUpper ? 0.25 : 0.6
      const reach = isUpper ? 0.55 : radius - 0.4
      ring.scale.setScalar(base + (reach - base) * phase)
      rippleMaterials[i].opacity = 0.45 * (1 - phase)
    })
    // 꼭대기 물보라가 살짝 숨쉬듯
    if (crown.current) crown.current.scale.setScalar(0.22 + Math.sin(t * 6) * 0.025)
  })

  return (
    <group userData={NO_SHADOW}>
      <mesh geometry={geometry} material={STREAM_MATERIAL} userData={NO_SHADOW} renderOrder={1} />
      <mesh ref={crown} geometry={GEO.ico} material={SPRAY} position={[0, FOUNTAIN.jetTop + 0.05, 0]} scale={0.22} userData={NO_SHADOW} />
      <Instances geometry={GEO.ico} material={FOAM} items={foam} />
      {rippleMaterials.map((material, i) => (
        <mesh
          key={i}
          ref={(el) => (ripples.current[i] = el)}
          geometry={RIPPLE_GEOMETRY}
          material={material}
          position={[0, (i === 0 ? FOUNTAIN.upperWater : FOUNTAIN.lowerWater) + 0.01, 0]}
          userData={NO_SHADOW}
          renderOrder={2}
        />
      ))}
    </group>
  )
}

// ── 원형 광장 바닥 (충돌 없음) ─────────────────
export function RoundPlaza({ item }) {
  const [w, h] = item.size
  return (
    <mesh
      geometry={GEO.cyl48}
      material={texMat(getCirclePlazaTexture())}
      position={[0, h / 2, 0]}
      scale={[w / 2, h, w / 2]}
      userData={NO_SHADOW}
    />
  )
}

// ── 전망 타워 (가는 원통 기둥 + 둥근 유리 전망대 + 안테나) ──
export function ObservationTower() {
  const baseH = 1.6
  const shaftH = 14
  const deckY = baseH + shaftH
  const mullions = useMemo(
    () =>
      range(16).map((i) => {
        const a = (i / 16) * Math.PI * 2
        return { p: [Math.sin(a) * 2.52, deckY + 1.3, Math.cos(a) * 2.52], r: [0, a, 0], s: [0.08, 2, 0.08] }
      }),
    [deckY],
  )
  return (
    <group>
      {/* 아래 입구 건물 */}
      <Cyl p={[0, baseH / 2, 0]} rad={1.8} h={baseH} c={CREAM} />
      <Cyl p={[0, baseH - 0.1, 0]} rad={1.86} h={0.2} c={CORAL} />
      <Box p={[0, 0.8, 1.76]} s={[1, 1.4, 0.12]} m={WARM_GLASS} />
      {/* 기둥 + 분홍 띠 */}
      <Cyl p={[0, baseH + shaftH / 2, 0]} rad={0.62} h={shaftH} c={CREAM} />
      {[0.3, 0.55, 0.8].map((t) => (
        <Cyl key={t} p={[0, baseH + shaftH * t, 0]} rad={0.67} h={0.25} c={PINK} />
      ))}
      {/* 전망대 */}
      <Cone p={[0, deckY - 0.5, 0]} rad={2.6} h={1} r={[Math.PI, 0, 0]} c={CREAM} />
      <Cyl p={[0, deckY + 0.15, 0]} rad={2.7} h={0.3} c={CORAL} geo={GEO.cyl48} />
      <Cyl p={[0, deckY + 1.3, 0]} rad={2.5} h={2} m={TOWER_GLASS} geo={GEO.cyl48} userData={NO_SHADOW} />
      <Instances geometry={GEO.box} material={mat(CREAM)} items={mullions} />
      <Cyl p={[0, deckY + 2.45, 0]} rad={2.75} h={0.3} c={CORAL} geo={GEO.cyl48} />
      <mesh geometry={GEO.dome} material={mat(CREAM)} position={[0, deckY + 2.6, 0]} scale={[2.3, 1, 2.3]} />
      {/* 안테나 */}
      <Cyl p={[0, deckY + 3.8, 0]} rad={0.22} h={0.5} c={PINK} />
      <Cyl p={[0, deckY + 4.9, 0]} rad={0.1} h={2.6} c="#e5e7eb" geo={GEO.cyl8} />
      <Ball p={[0, deckY + 6.3, 0]} rad={0.16} m={mat('#ff9fb5', { emissive: '#ff5c8a', emissiveIntensity: 1 })} />
    </group>
  )
}

// ── 사랑의 자물쇠 펜스 (원형, gapDeg만큼 입구가 열림 — 입구는 로컬 +z 쪽) ──
const LOCK_COLORS = ['#f472b6', '#fb7185', '#fbbf24', '#a78bfa', '#60a5fa', '#f87171', '#fda4af']

export function LockFence({ item }) {
  const radius = item.radius ?? item.size[0] / 2
  const h = item.size[1]
  const gapKey = JSON.stringify([item.gapDeg ?? 0, item.extraGaps ?? []])
  const { posts, rails, locks } = useMemo(() => {
    const random = seeded(hashString(item.id))
    const posts = []
    const rails = []
    const locks = []
    // 충돌도 같은 호를 써서 전망대와 흔들다리 입구가 정확히 열려요.
    for (const [from, to] of lockFenceArcs(item)) {
      const arc = to - from
      if (arc <= 0.01) continue
      const n = Math.max(1, Math.round((arc * radius) / 1.0))
      const angle = (k) => from + (arc * k) / n
      for (let k = 0; k <= n; k++) {
        const a = angle(k)
        posts.push({ p: [Math.sin(a) * radius, h / 2, Math.cos(a) * radius], s: [0.07, h, 0.07] })
      }
      for (let k = 0; k < n; k++) {
        const a0 = angle(k)
        const a1 = angle(k + 1)
        const am = (a0 + a1) / 2
        const inner = radius * Math.cos((a1 - a0) / 2)
        const segLen = 2 * radius * Math.sin((a1 - a0) / 2)
        for (const y of [h, h * 0.55]) {
          rails.push({ p: [Math.sin(am) * inner, y, Math.cos(am) * inner], r: [0, am + Math.PI / 2, 0], s: [0.05, 0.05, segLen] })
        }
        const count = 3 + Math.floor(random() * 4)
        for (let l = 0; l < count; l++) {
          const a = a0 + (a1 - a0) * ((l + 0.5) / count + (random() - 0.5) * 0.1)
          const y = h * 0.55 - 0.08 - random() * 0.05
          locks.push({
            p: [Math.sin(a) * inner, y, Math.cos(a) * inner],
            r: [0, a, 0],
            s: [0.09, 0.11, 0.05],
            c: LOCK_COLORS[Math.floor(random() * LOCK_COLORS.length)],
          })
        }
      }
    }
    return { posts, rails, locks }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.id, radius, gapKey, h])
  return (
    <group>
      <Instances geometry={GEO.box} material={mat('#f5efe6')} items={posts} />
      <Instances geometry={GEO.box} material={mat('#e8dfd3')} items={rails} />
      <Instances geometry={GEO.box} material={TINTABLE} items={locks} />
    </group>
  )
}

// ── 망원경 (로컬 +z 방향을 봄) ─────────────────
export function Telescope() {
  return (
    <group>
      {[0, 2.1, 4.2].map((a) => (
        <Cyl key={a} p={[Math.sin(a) * 0.16, 0.5, Math.cos(a) * 0.16]} rad={0.03} h={1.05} r={[Math.cos(a) * 0.25, 0, -Math.sin(a) * 0.25]} c={DARK} geo={GEO.cyl8} />
      ))}
      <Box p={[0, 1.05, 0]} s={[0.16, 0.12, 0.16]} c={DARK} />
      <Cyl p={[0, 1.22, 0.1]} rad={0.11} h={0.95} r={[Math.PI / 2 - 0.25, 0, 0]} c="#c9a24a" m={mat('#c9a24a', { metalness: 0.5, roughness: 0.4 })} />
      <Cyl p={[0, 1.34, 0.55]} rad={0.15} h={0.12} r={[Math.PI / 2 - 0.25, 0, 0]} c={DARK} />
    </group>
  )
}

// ── 볼라드 (차 막는 짧은 기둥) ─────────────────
export function Bollard() {
  return (
    <group>
      <Cyl p={[0, 0.38, 0]} rad={0.12} h={0.75} c={DARK} geo={GEO.cyl8} />
      <Ball p={[0, 0.78, 0]} rad={0.13} c={DARK} />
    </group>
  )
}

// ── 꽃 화단 ──────────────────────────────────
export function FlowerBed({ item }) {
  const [w, h, d] = item.size
  const flowers = useMemo(
    () => flowerItems(hashString(item.id), Math.round(w * d * 14), (random) => [(random() - 0.5) * (w - 0.2), (random() - 0.5) * (d - 0.2)], h),
    [item.id, w, h, d],
  )
  return (
    <group>
      <Box p={[0, h / 2, 0]} s={[w, h, d]} c={item.color ?? '#9a6b45'} />
      <Box p={[0, h - 0.02, 0]} s={[w - 0.12, 0.06, d - 0.12]} c="#5b4636" />
      <Instances geometry={GEO.ico} material={TINTABLE} items={flowers} />
    </group>
  )
}

// ── 바위 ─────────────────────────────────────
export function Rock({ item }) {
  const [w, h, d] = item.size
  return (
    <mesh
      geometry={GEO.rock}
      material={mat('#b8acc0', { flat: true })}
      position={[0, h * 0.35, 0]}
      scale={[w / 2, h / 2, d / 2]}
      rotation={[0, (hashString(item.id) % 628) / 100, 0]}
    />
  )
}

// ── 야외 테라스 (나무 데크 + 파라솔 + 테이블) ───
export function Terrace({ item }) {
  const [w, h, d] = item.size
  const umbrella = item.umbrella ?? '#fffaf0'
  const xs = useMemo(() => terraceTableOffsets(w), [w])
  const { tables, chairs, posts } = useMemo(
    () => ({
      tables: xs.map((x) => ({ p: [x, h + 0.72, 0], s: [0.45, 0.05, 0.45] })),
      chairs: xs.flatMap((x) => [-0.75, 0.75].map((o) => ({ p: [x + o, h + 0.45, 0], s: [0.4, 0.06, 0.4] }))),
      posts: range(Math.round(w) + 1).map((i) => ({ p: [-w / 2 + (w * i) / Math.round(w), h + 0.25, d / 2 - 0.05], s: [0.05, 0.5, 0.05] })),
    }),
    [w, h, d, xs],
  )
  return (
    <group>
      <Box p={[0, h / 2, 0]} s={[w, h, d]} c="#b07a4f" />
      {xs.map((x) => (
        <group key={x} position={[x, h, 0]}>
          <Cyl p={[0, 1.15, 0]} rad={0.04} h={2.3} c="#e5e7eb" geo={GEO.cyl8} />
          <Cone p={[0, 2.3, 0]} rad={1.3} h={0.5} r={[0, Math.PI / 8, 0]} c={umbrella} />
          <Cyl p={[0, 0.36, 0]} rad={0.05} h={0.72} c={DARK} geo={GEO.cyl8} />
        </group>
      ))}
      <Instances geometry={GEO.cyl} material={mat('#ffffff')} items={tables} />
      <Instances geometry={GEO.box} material={mat('#8b5e3c')} items={chairs} />
      <Instances geometry={GEO.box} material={mat(DARK)} items={posts} />
      <Box p={[0, h + 0.5, d / 2 - 0.05]} s={[w, 0.05, 0.05]} c={DARK} />
    </group>
  )
}

// ════════════════════════════════════════════
// 가게 안쪽 (유리 너머로 보이는 실내)
// 최적화: 가게 하나의 바닥·가구·조명을 모양 1개로 합치고(꼭짓점 색), 재질 1개 공유 → 그리기 호출 1번
//         뒷벽 장식은 캔버스 그림 1장, 실내는 그림자 없음, 같은 종류·크기면 모양 재사용
// ════════════════════════════════════════════
const CLEAR_GLASS = mat('#d6ecff', { transparent: true, opacity: 0.16, roughness: 0.05 })

// 꼭짓점 색 + "빛나는 정도(glow)"를 받는 실내 전용 재질 (그늘에서도 파스텔이 보이게 살짝 자체 발광)
export const INTERIOR_MAT = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 })
INTERIOR_MAT.onBeforeCompile = (shader) => {
  shader.uniforms.uNight = NIGHT_UNIFORM
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', '#include <common>\nattribute float glow;\nvarying float vGlow;')
    .replace('#include <begin_vertex>', '#include <begin_vertex>\nvGlow = glow;')
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', '#include <common>\nvarying float vGlow;\nuniform float uNight;')
    .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += vColor.rgb * (0.22 + vGlow) * (1.0 + uNight * 1.6);')
}

// 실내 종류별 색
const INTERIOR_STYLE = {
  cafe: { wall: '#f6ead8', lower: '#c89f74', accent: '#5b3a29' },
  dessert: { wall: '#ffe4ef', lower: '#f9c4d8', accent: '#db2777' },
  photo: { wall: '#ece4ff', lower: '#d8ccf5', accent: '#7c3aed' },
  flower: { wall: '#e6f6ea', lower: '#b7dcc0', accent: '#2f855a' },
  brunch: { wall: '#ffe9d6', lower: '#f2c39b', accent: '#9a3412' },
  jewelry: { wall: '#e8ecf8', lower: '#c3cbe6', accent: '#be123c' },
  scent: { wall: '#f6e9ff', lower: '#e2c9f5', accent: '#a21caf' },
  tea: { wall: '#f4ecd8', lower: '#c9b28c', accent: '#166534' },
  restaurant: { wall: '#f0dcc4', lower: '#8b5e3c', accent: '#7c2d12' },
  cinemaLobby: { wall: '#3b2f5c', lower: '#2a2142', accent: '#f472b6' },
  cafe2: { wall: '#f8f6f2', lower: '#d9c3a5', accent: '#3f6212' },
  wine: { wall: '#5a2a35', lower: '#3b1c24', accent: '#fbbf24' },
  gallery: { wall: '#fbfbfa', lower: '#ececea', accent: '#f472b6' },
  popup: { wall: '#fde7f3', lower: '#e9d5ff', accent: '#9333ea' },
}
const PASTELS = ['#f9a8d4', '#c4b5fd', '#fde68a', '#a5f3fc', '#fecdd3', '#bbf7d0', '#fdba74']

// ── 뒷벽 그림 (종류별 한 번만 그림) ──
const backWallCache = new Map()
function getBackWallTexture(kind) {
  if (backWallCache.has(kind)) return backWallCache.get(kind)
  const S = INTERIOR_STYLE[kind] ?? INTERIOR_STYLE.cafe
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 256
  const ctx = canvas.getContext('2d')
  const random = seeded(hashString(kind))
  const rect = (x, y, w, h, c) => {
    ctx.fillStyle = c
    ctx.fillRect(x, y, w, h)
  }
  const circle = (x, y, r, c) => {
    ctx.fillStyle = c
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
  }
  const glowSpot = (x, y, r, c) => {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r)
    g.addColorStop(0, c)
    g.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = g
    ctx.fillRect(x - r, y - r, r * 2, r * 2)
  }
  const shelf = (x, y, w, items, itemW = 14, itemH = 20) => {
    rect(x, y, w, 6, '#8b5e3c')
    for (let i = 0; i < items; i++) rect(x + 6 + i * (w / items), y - itemH, itemW, itemH, PASTELS[Math.floor(random() * PASTELS.length)])
  }
  const frame = (x, y, w, h, inner) => {
    rect(x, y, w, h, '#ffffff')
    rect(x + 5, y + 5, w - 10, h - 10, inner)
  }

  // 공통: 벽 + 아래 판벽 + 걸레받이
  rect(0, 0, 512, 256, S.wall)
  rect(0, 176, 512, 80, S.lower)
  rect(0, 172, 512, 6, S.accent)

  switch (kind) {
    case 'cafe':
    case 'brunch':
      rect(196, 40, 120, 74, '#2f4f3a') // 메뉴 보드
      for (let i = 0; i < 4; i++) rect(210, 54 + i * 14, 60 + random() * 30, 4, '#f5f0e6')
      shelf(30, 90, 140, 6)
      shelf(30, 140, 140, 6, 18, 14)
      shelf(350, 110, 130, 5)
      circle(420, 50, 22, '#ffffff')
      circle(420, 50, 18, S.accent)
      break
    case 'dessert':
      for (let x = 0; x < 512; x += 40) rect(x, 0, 18, 172, '#fff1f6')
      shelf(40, 110, 180, 7, 20, 22)
      shelf(300, 110, 180, 7, 20, 22)
      circle(256, 60, 30, '#fbcfe8')
      circle(256, 60, 18, '#ffffff')
      break
    case 'photo': {
      const g = ctx.createLinearGradient(140, 0, 372, 0)
      g.addColorStop(0, '#fbcfe8')
      g.addColorStop(1, '#c4b5fd')
      ctx.fillStyle = g
      ctx.fillRect(140, 20, 232, 160) // 배경지
      for (let i = 0; i < 5; i++) circle(170 + random() * 170, 50 + random() * 90, 16 + random() * 12, 'rgba(255,255,255,0.55)')
      for (let i = 0; i < 6; i++) frame(20 + (i % 2) * 52, 30 + Math.floor(i / 2) * 46, 44, 40, PASTELS[i % PASTELS.length])
      for (let i = 0; i < 6; i++) frame(392 + (i % 2) * 52, 30 + Math.floor(i / 2) * 46, 44, 40, PASTELS[(i + 3) % PASTELS.length])
      break
    }
    case 'flower':
      for (let i = 0; i < 8; i++) {
        const x = 30 + i * 62
        rect(x + 14, 0, 2, 40, '#6b7280')
        circle(x + 15, 52, 20, '#4f8f45')
        circle(x + 8, 46, 8, PASTELS[i % PASTELS.length])
      }
      shelf(60, 140, 390, 12, 16, 26)
      break
    case 'jewelry':
      ctx.fillStyle = '#ffffff'
      ctx.beginPath()
      ctx.ellipse(256, 80, 54, 66, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#dbeafe'
      ctx.beginPath()
      ctx.ellipse(256, 80, 46, 58, 0, 0, Math.PI * 2)
      ctx.fill()
      for (const x of [90, 422]) {
        glowSpot(x, 70, 40, 'rgba(255,240,200,0.9)')
        frame(x - 34, 100, 68, 50, '#f5f3ff')
      }
      break
    case 'scent':
      for (const y of [70, 115, 160]) shelf(40, y, 432, 16, 10, 22)
      break
    case 'tea':
      ctx.strokeStyle = '#6b4a2f'
      ctx.lineWidth = 4
      rect(180, 30, 152, 110, '#fff8e8')
      for (let x = 180; x <= 332; x += 19) {
        ctx.beginPath()
        ctx.moveTo(x, 30)
        ctx.lineTo(x, 140)
        ctx.stroke()
      }
      for (let y = 30; y <= 140; y += 22) {
        ctx.beginPath()
        ctx.moveTo(180, y)
        ctx.lineTo(332, y)
        ctx.stroke()
      }
      shelf(30, 120, 120, 4, 22, 26)
      shelf(362, 120, 120, 4, 22, 26)
      break
    case 'restaurant':
      for (const y of [60, 110]) shelf(320, y, 160, 9, 8, 30)
      frame(60, 40, 120, 80, '#fde68a')
      for (const x of [40, 230, 300]) glowSpot(x, 60, 36, 'rgba(255,214,150,0.9)')
      break
    case 'cinemaLobby':
      for (let i = 0; i < 3; i++) {
        const x = 70 + i * 140
        rect(x, 30, 90, 130, ['#be185d', '#1d4ed8', '#7c3aed'][i])
        circle(x + 45, 80, 26, PASTELS[i])
        rect(x + 10, 130, 70, 8, '#ffffff')
      }
      rect(0, 12, 512, 5, '#f472b6')
      glowSpot(256, 14, 120, 'rgba(244,114,182,0.5)')
      break
    case 'cafe2':
      for (let x = 260; x < 512; x += 16) rect(x, 0, 10, 172, '#c89f74')
      for (let i = 0; i < 3; i++) frame(40 + i * 66, 50, 54, 64, PASTELS[i + 2])
      break
    case 'wine':
      rect(40, 20, 432, 150, '#2a1418')
      for (let r = 0; r < 6; r++) for (let c = 0; c < 18; c++) circle(58 + c * 23.5, 34 + r * 24, 7, random() < 0.5 ? '#7f1d1d' : '#14532d')
      for (const x of [60, 452]) glowSpot(x, 20, 50, 'rgba(251,191,36,0.6)')
      break
    case 'gallery':
      frame(50, 40, 120, 100, '#fbcfe8')
      circle(110, 90, 30, '#f472b6')
      frame(196, 30, 120, 120, '#e0f2fe')
      rect(220, 60, 70, 60, '#38bdf8')
      frame(342, 40, 120, 100, '#fef9c3')
      circle(402, 90, 28, '#facc15')
      for (const x of [110, 256, 402]) glowSpot(x, 10, 70, 'rgba(255,250,235,0.85)')
      break
    case 'popup':
      for (let r = 0; r < 4; r++) for (let c = 0; c < 9; c++) frame(140 + c * 36, 20 + r * 38, 30, 34, PASTELS[(r + c) % PASTELS.length])
      rect(20, 30, 100, 40, S.accent)
      rect(392 + 0, 30, 100, 40, S.accent)
      break
    default:
      shelf(40, 110, 432, 12)
  }

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 4
  backWallCache.set(kind, texture)
  return texture
}

// ── 가구 모양 합치기 ──
const UNIT = {
  box: new THREE.BoxGeometry(1, 1, 1).toNonIndexed(),
  cyl: new THREE.CylinderGeometry(1, 1, 1, 10).toNonIndexed(),
  disc: new THREE.CylinderGeometry(1, 1, 1, 48).toNonIndexed(),
  ico: new THREE.IcosahedronGeometry(1, 0),
  ico1: new THREE.IcosahedronGeometry(1, 1),
  cone: new THREE.ConeGeometry(1, 1, 7).toNonIndexed(),
  rock: new THREE.DodecahedronGeometry(1, 0),
}
const tmpM = new THREE.Matrix4()
const tmpQ = new THREE.Quaternion()
const tmpE = new THREE.Euler()
const tmpC = new THREE.Color()

// rot: y축 회전(숫자) 또는 [x, y, z] 회전
export function piece(shape, [x, y, z], [sx, sy, sz], color, glow = 0, rot = 0) {
  const g = UNIT[shape].clone()
  if (Array.isArray(rot)) tmpE.set(rot[0], rot[1], rot[2])
  else tmpE.set(0, rot, 0)
  tmpQ.setFromEuler(tmpE)
  g.applyMatrix4(tmpM.compose(new THREE.Vector3(x, y, z), tmpQ, new THREE.Vector3(sx, sy, sz)))
  tmpC.set(color)
  const n = g.attributes.position.count
  const colors = new Float32Array(n * 3)
  const glows = new Float32Array(n).fill(glow)
  for (let i = 0; i < n; i++) colors.set([tmpC.r, tmpC.g, tmpC.b], i * 3)
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  g.setAttribute('glow', new THREE.BufferAttribute(glows, 1))
  g.deleteAttribute('uv')
  return g
}

// 가게 안 가구 배치. W(폭) × H(높이) × D(깊이), 바닥 y=0, 뒷벽 z=-D/2, 유리 z=+D/2
const interiorCache = new Map()
function interiorGeometry(kind, W, H, D) {
  const key = `${kind}|${W.toFixed(2)}|${H.toFixed(2)}|${D.toFixed(2)}`
  if (interiorCache.has(key)) return interiorCache.get(key)
  const S = INTERIOR_STYLE[kind] ?? INTERIOR_STYLE.cafe
  const random = seeded(hashString(key))
  const P = []
  const back = -D / 2
  const pastel = () => PASTELS[Math.floor(random() * PASTELS.length)]

  const table = (x, z, chairColor = '#f9a8d4') => {
    P.push(piece('cyl', [x, 0.75, z], [0.42, 0.05, 0.42], '#ffffff'))
    P.push(piece('cyl', [x, 0.37, z], [0.05, 0.74, 0.05], '#6b7280'))
    for (const s of [-1, 1]) {
      P.push(piece('box', [x + s * 0.72, 0.45, z], [0.4, 0.07, 0.4], chairColor))
      P.push(piece('box', [x + s * 0.9, 0.7, z], [0.06, 0.45, 0.4], chairColor))
    }
  }
  const counter = (x, z, w, color = '#a47551') => {
    P.push(piece('box', [x, 0.5, z], [w, 1.0, 0.6], color))
    P.push(piece('box', [x, 1.03, z], [w + 0.06, 0.06, 0.66], '#f5efe6'))
  }
  const pendant = (x, z) => {
    P.push(piece('box', [x, H - 0.3, z], [0.02, 0.6, 0.02], '#3f3f46'))
    P.push(piece('cyl', [x, H - 0.66, z], [0.18, 0.14, 0.18], '#fff1c9', 1.4))
  }
  const ceilingStrip = () => P.push(piece('box', [0, H - 0.04, 0], [W * 0.6, 0.04, 0.4], '#fff7e6', 1.2))

  // 바닥
  P.push(piece('box', [0, 0.05, 0], [W, 0.1, D], S.lower))

  switch (kind) {
    case 'cafe':
    case 'brunch':
    case 'cafe2':
      counter(-W * 0.22, back + 0.55, W * 0.42)
      P.push(piece('box', [-W * 0.32, 1.25, back + 0.5], [0.45, 0.4, 0.35], '#9ca3af')) // 커피 머신
      for (let i = 0; i < 4; i++) P.push(piece('cyl', [-W * 0.18 + i * 0.25, 1.12, back + 0.6], [0.06, 0.12, 0.06], pastel()))
      table(W * 0.18, 0.1, kind === 'brunch' ? '#fdba74' : '#f9a8d4')
      if (W > 6) table(-W * 0.12, 0.6, '#c4b5fd')
      if (kind === 'cafe2') for (const x of [-W / 2 + 0.5, W / 2 - 0.5]) {
        P.push(piece('cyl', [x, 0.25, back + 0.5], [0.22, 0.5, 0.22], '#c2703d'))
        P.push(piece('ico', [x, 0.85, back + 0.5], [0.4, 0.5, 0.4], '#4f8f45'))
      }
      for (const x of [-W * 0.25, 0, W * 0.25]) pendant(x, 0)
      break
    case 'dessert':
      P.push(piece('box', [0, 0.45, back + 0.5], [W * 0.62, 0.9, 0.6], '#fff1f6', 0.3)) // 진열장
      for (let i = 0; i < 7; i++) {
        const x = -W * 0.28 + (i * W * 0.56) / 6
        P.push(piece('cyl', [x, 1.0, back + 0.5], [0.15, 0.18, 0.15], ['#fbcfe8', '#fff7ed', '#f9a8d4', '#a16207'][i % 4], 0.3))
      }
      table(W * 0.22, 0.4)
      for (const x of [-W * 0.2, W * 0.2]) pendant(x, -0.2)
      break
    case 'photo':
      for (const s of [-1, 1]) {
        P.push(piece('box', [s * W * 0.3, 0.8, back + 0.9], [0.04, 1.6, 0.04], '#3f3f46'))
        P.push(piece('box', [s * W * 0.3, 1.75, back + 0.9], [0.6, 0.6, 0.15], '#ffffff', 1.0))
      }
      P.push(piece('cyl', [0, 0.25, back + 0.9], [0.25, 0.5, 0.25], '#f472b6'))
      P.push(piece('box', [0, 1.2, D / 2 - 0.7], [0.3, 0.2, 0.2], '#1f2937'))
      P.push(piece('box', [0, 0.55, D / 2 - 0.7], [0.03, 1.1, 0.03], '#3f3f46'))
      ceilingStrip()
      break
    case 'flower':
    case 'scent':
      for (let i = 0; i < 6; i++) {
        const x = -W * 0.36 + (i * W * 0.72) / 5
        P.push(piece('cyl', [x, 0.25, back + 0.45], [0.2, 0.5, 0.2], kind === 'flower' ? '#2f6b4f' : '#e9d5ff'))
        for (let k = 0; k < 3; k++) P.push(piece('ico', [x + (random() - 0.5) * 0.2, 0.62 + random() * 0.15, back + 0.45 + (random() - 0.5) * 0.2], [0.12, 0.12, 0.12], pastel(), 0.25))
      }
      P.push(piece('box', [0, 0.4, 0.3], [W * 0.3, 0.8, 0.8], '#a47551'))
      for (let i = 0; i < 4; i++) P.push(piece('cyl', [-0.4 + i * 0.27, 0.9, 0.3], [0.06, 0.18, 0.06], pastel(), 0.3))
      ceilingStrip()
      break
    case 'jewelry':
      for (const x of [-W * 0.22, W * 0.22]) {
        P.push(piece('box', [x, 0.5, back + 0.7], [W * 0.3, 1.0, 0.6], '#f8fafc', 0.35))
        for (let k = 0; k < 4; k++) P.push(piece('ico', [x - 0.4 + k * 0.27, 1.05, back + 0.7], [0.06, 0.06, 0.06], '#fde68a', 1.2))
      }
      P.push(piece('cyl', [0, 0.3, 0.4], [0.22, 0.6, 0.22], '#be123c'))
      ceilingStrip()
      break
    case 'tea':
      for (const x of [-W * 0.2, W * 0.2]) {
        P.push(piece('box', [x, 0.2, 0.1], [1.2, 0.4, 0.8], '#8b5e3c'))
        for (const s of [-1, 1]) P.push(piece('box', [x + s * 0.85, 0.05, 0.1], [0.5, 0.1, 0.5], s > 0 ? '#86efac' : '#fde68a'))
        P.push(piece('cyl', [x, 0.48, 0.1], [0.1, 0.12, 0.1], '#f5f0e6', 0.3))
      }
      for (const x of [-W * 0.25, W * 0.25]) pendant(x, 0)
      break
    case 'restaurant':
      counter(W * 0.25, back + 0.55, W * 0.35, '#5b3a29')
      table(-W * 0.18, 0.2, '#8b5e3c')
      P.push(piece('cyl', [-W * 0.18, 0.86, 0.2], [0.05, 0.14, 0.05], '#fff1c9', 1.5)) // 촛불
      if (W > 7) {
        table(W * 0.12, 0.7, '#8b5e3c')
        P.push(piece('cyl', [W * 0.12, 0.86, 0.7], [0.05, 0.14, 0.05], '#fff1c9', 1.5))
      }
      for (const x of [-W * 0.3, 0, W * 0.3]) pendant(x, 0.2)
      break
    case 'cinemaLobby':
      counter(-W * 0.2, back + 0.6, W * 0.4, '#dc2626')
      P.push(piece('box', [-W * 0.3, 1.45, back + 0.55], [0.6, 0.8, 0.5], '#fde68a', 0.8)) // 팝콘 기계
      P.push(piece('box', [W * 0.25, 0.9, 0.2], [0.8, 1.8, 0.08], '#7c3aed', 0.3)) // 영화 입간판
      P.push(piece('box', [0, H - 0.05, back + 0.3], [W * 0.9, 0.06, 0.06], '#f472b6', 1.5)) // 네온
      break
    case 'wine':
      counter(0, back + 0.6, W * 0.6, '#3b1c24')
      for (const x of [-W * 0.2, 0, W * 0.2]) P.push(piece('cyl', [x, 0.38, back + 1.3], [0.18, 0.76, 0.18], '#d4a373'))
      for (const x of [-W * 0.38, W * 0.38]) P.push(piece('cyl', [x, 0.45, 0.4], [0.35, 0.9, 0.35], '#7c4a2d'))
      for (const x of [-W * 0.25, W * 0.25]) pendant(x, 0)
      break
    case 'gallery':
      P.push(piece('box', [W * 0.15, 0.5, 0], [0.7, 1.0, 0.7], '#ffffff'))
      P.push(piece('ico', [W * 0.15, 1.35, 0], [0.42, 0.42, 0.42], '#f472b6', 0.3))
      P.push(piece('box', [-W * 0.2, 0.25, 0.6], [1.6, 0.45, 0.45], '#d6d3d1'))
      ceilingStrip()
      break
    case 'popup':
      for (const s of [-1, 1]) {
        const x = s * W * 0.3
        P.push(piece('box', [x, 1.5, back + 0.9], [W * 0.3, 0.04, 0.04], '#9ca3af'))
        for (const s2 of [-1, 1]) P.push(piece('box', [x + s2 * W * 0.15, 0.75, back + 0.9], [0.04, 1.5, 0.04], '#9ca3af'))
        for (let k = 0; k < 5; k++) P.push(piece('box', [x - W * 0.12 + k * (W * 0.24) / 4, 1.15, back + 0.9], [0.3, 0.6, 0.05], pastel(), 0.2))
      }
      P.push(piece('box', [0, 0.4, 0.5], [W * 0.35, 0.8, 0.9], '#ffffff'))
      for (let k = 0; k < 5; k++) P.push(piece('box', [-0.6 + k * 0.3, 0.86, 0.5], [0.22, 0.1, 0.22], pastel(), 0.3))
      ceilingStrip()
      break
    default:
      ceilingStrip()
  }

  const merged = mergeGeometries(P)
  P.forEach((g) => g.dispose())
  merged.computeBoundingSphere()
  interiorCache.set(key, merged)
  return merged
}

// 유리 너머 실내 한 칸: 바닥·가구·조명(1번) + 뒷벽 그림(1번) + 유리(1번)
// 위치: 가운데 바닥 기준 (x 가운데, y 바닥, z 가운데). 앞(유리)은 +z
function ShopInterior({ kind, W, H, D, p = [0, 0, 0] }) {
  return (
    <group position={p}>
      <mesh geometry={interiorGeometry(kind, W, H, D)} material={INTERIOR_MAT} userData={NO_SHADOW} />
      <mesh
        geometry={GEO.plane}
        material={nightGlow(texMat(getBackWallTexture(kind), { emissive: '#ffffff', emissiveIntensity: 0.35 }), 1)}
        position={[0, H / 2, -D / 2 + 0.01]}
        scale={[W, H, 1]}
        userData={NO_SHADOW}
      />
      <mesh geometry={GEO.box} material={CLEAR_GLASS} position={[0, H / 2, D / 2 - 0.03]} scale={[W, H, 0.04]} userData={NO_SHADOW} />
    </group>
  )
}

// 앞쪽 1층을 파낸 건물 몸통: 뒤쪽 통짜 + 1층 위 + 양옆 벽 (+ 안쪽 실내)
// (w, h, d) 몸통 크기, y0 바닥 높이, gh 1층 높이, rd 파낸 깊이
function RecessedBody({ w, h, d, y0 = 0, gh, rd, material, kind }) {
  const front = d / 2
  const back = front - rd
  const side = 0.25
  return (
    <group>
      <mesh geometry={GEO.box} material={material} position={[0, y0 + h / 2, (back - d / 2) / 2]} scale={[w, h, back + d / 2]} castShadow receiveShadow />
      <mesh geometry={GEO.box} material={material} position={[0, y0 + gh + (h - gh) / 2, (front + back) / 2]} scale={[w, h - gh, rd]} castShadow />
      {[-1, 1].map((s) => (
        <mesh key={s} geometry={GEO.box} material={material} position={[s * (w / 2 - side / 2), y0 + gh / 2, (front + back) / 2]} scale={[side, gh, rd]} castShadow />
      ))}
      <ShopInterior kind={kind} W={w - side * 2} H={gh} D={rd} p={[0, y0, (front + back) / 2]} />
    </group>
  )
}

// ════════════════════════════════════════════
// 커플 포토존: 꽃 하트 아치 + 원형 데크 + 발자국 + 커플 그네 + 이젤 액자 + 하트 풍선 + 촬영 위치 삼각대
// 최적화: 움직이지 않는 부분은 모양 1개로 합침(그리기 호출 1번), 그네만 따로 흔들림, 충돌 없음
// 앞(+z) = 사진 찍는 쪽. 하트 아치는 로컬 z -1.5, 삼각대는 z +5.5
// ════════════════════════════════════════════
export function colorize(geometry, color, glow = 0) {
  const g = geometry.index ? geometry.toNonIndexed() : geometry
  tmpC.set(color)
  const n = g.attributes.position.count
  const colors = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) colors.set([tmpC.r, tmpC.g, tmpC.b], i * 3)
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  g.setAttribute('glow', new THREE.BufferAttribute(new Float32Array(n).fill(glow), 1))
  if (g.attributes.uv) g.deleteAttribute('uv')
  return g
}

// 하트 모양 점들 (아래 뾰족한 끝이 바닥, 폭 약 3.4m, 높이 약 3.1m)
function heartPoints(count, scale = 0.106, lift = 0.25) {
  return range(count).map((i) => {
    const t = (i / count) * Math.PI * 2
    const x = 16 * Math.sin(t) ** 3
    const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)
    return new THREE.Vector3(x * scale, (y + 17) * scale + lift, 0)
  })
}

const SWING = { x: 3.6, z: 0.4, top: 2.4 }
let photoZoneGeometry = null
function couplePhotoZoneGeometry() {
  if (photoZoneGeometry) return photoZoneGeometry
  const P = []
  const random = seeded(77)
  const heartZ = -1.5
  const blossom = ['#f9a8d4', '#fbcfe8', '#ffffff', '#f472b6', '#e9d5ff']

  // 원형 나무 데크 + 분홍 테두리
  for (const { radius, height, z, color } of PHOTO_DECK) {
    P.push(piece('disc', [0, height / 2, z], [radius, height, radius], color))
  }
  // 하트 아치: 굵은 흰 테 + 안쪽 분홍 테
  const pts = heartPoints(48)
  const outer = new THREE.CatmullRomCurve3(pts.map((p) => p.clone().setZ(heartZ)), true)
  P.push(colorize(new THREE.TubeGeometry(outer, 96, 0.1, 6, true), '#fff7fb', 0.1))
  const inner = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(p.x * 0.9, (p.y - 1.65) * 0.9 + 1.65, heartZ + 0.05)), true)
  P.push(colorize(new THREE.TubeGeometry(inner, 96, 0.05, 5, true), '#f472b6', 0.25))
  // 아치를 따라 꽃송이 + 작은 전구
  pts.forEach((p, i) => {
    const s = 0.14 + random() * 0.1
    P.push(piece('ico', [p.x + (random() - 0.5) * 0.1, p.y + (random() - 0.5) * 0.1, heartZ + 0.12], [s, s, s], blossom[i % blossom.length], 0.15))
    if (i % 3 === 0) {
      const out = p.clone().setZ(0).multiplyScalar(1.07)
      P.push(piece('ico', [out.x, out.y - 0.1, heartZ + 0.1], [0.06, 0.06, 0.06], '#fff1c9', 1.6))
    }
  })
  // 아치 아래 받침 + 양옆 꽃 화분
  P.push(piece('box', [0, 0.18, heartZ], [0.5, 0.3, 0.4], '#e7e5e4'))
  for (const s of [-1, 1]) {
    P.push(piece('cyl', [s * 2.2, 0.3, heartZ + 0.2], [0.35, 0.6, 0.35], '#f5f0e6'))
    for (let k = 0; k < 5; k++) P.push(piece('ico', [s * 2.2 + (random() - 0.5) * 0.4, 0.75 + random() * 0.25, heartZ + 0.2 + (random() - 0.5) * 0.4], [0.18, 0.18, 0.18], blossom[k % blossom.length], 0.1))
  }
  // 바닥 발자국 두 쌍 (여기 서세요)
  for (const [x, rot] of [[-0.45, 0.15], [0.45, -0.15]]) {
    for (const o of [-0.1, 0.1]) P.push(piece('box', [x + o, 0.13, -0.9 + (o > 0 ? 0.06 : 0)], [0.11, 0.01, 0.26], '#db2777', 0.3, rot))
  }
  // 커플 그네 틀 (A자 기둥 + 위 가로대). 의자와 줄은 따로 흔들림
  for (const s of [-1, 1]) {
    for (const lean of [-0.22, 0.22]) {
      P.push(piece('box', [SWING.x + s * 1.1, SWING.top / 2, SWING.z + lean * 1.1], [0.1, SWING.top + 0.1, 0.1], '#8b5e3c', 0, [lean, 0, 0]))
    }
  }
  P.push(piece('box', [SWING.x, SWING.top, SWING.z], [2.5, 0.12, 0.12], '#8b5e3c'))
  for (let k = 0; k < 7; k++) P.push(piece('ico', [SWING.x - 1.1 + k * 0.37, SWING.top + 0.12, SWING.z], [0.12, 0.12, 0.12], blossom[k % blossom.length], 0.15))
  // 이젤 + 큰 액자 (얼굴 넣고 찍는 프레임)
  const EX = -3.3
  const EZ = 0.4
  for (const [dx, dz] of [[-0.45, 0.15], [0.45, 0.15], [0, -0.35]]) {
    P.push(piece('box', [EX + dx * 0.5, 0.85, EZ + dz * 0.5], [0.06, 1.75, 0.06], '#a47551', 0, [dz * -0.5, 0, dx * 0.5]))
  }
  const FY = 1.55
  for (const [x, y, w, h] of [[0, 0.62, 1.5, 0.12], [0, -0.62, 1.5, 0.12], [-0.69, 0, 0.12, 1.36], [0.69, 0, 0.12, 1.36]]) {
    P.push(piece('box', [EX + x, FY + y, EZ + 0.1], [w, h, 0.08], '#f5d0a9', 0.15))
  }
  // 하트 풍선 다발 (왼쪽 위) + 줄 + 무게추
  const BX = -2.3
  for (let k = 0; k < 6; k++) {
    const x = BX + (random() - 0.5) * 0.8
    const y = 3.6 + random() * 0.8
    const z = heartZ + (random() - 0.5) * 0.6
    P.push(piece('ico', [x, y, z], [0.26, 0.3, 0.22], ['#f472b6', '#f9a8d4', '#c4b5fd', '#fda4af'][k % 4], 0.25))
    const mid = [(x + BX) / 2, (y + 0.9) / 2, (z + heartZ) / 2]
    const len = Math.hypot(x - BX, y - 0.9, z - heartZ)
    P.push(piece('box', mid, [0.015, len, 0.015], '#ffffff', 0, [Math.atan2(z - heartZ, y - 0.9), 0, -Math.atan2(x - BX, y - 0.9)]))
  }
  P.push(piece('box', [BX, 0.95, heartZ], [0.18, 0.18, 0.18], '#f472b6'))
  // 촬영 위치: 바닥 표시 + 삼각대 + 카메라 (하트를 바라봄)
  P.push(piece('cyl', [0, 0.03, 5.5], [0.5, 0.04, 0.5], '#f9a8d4', 0.2))
  for (const a of [0, 2.1, 4.2]) {
    P.push(piece('box', [Math.sin(a) * 0.2, 0.65, 5.5 + Math.cos(a) * 0.2], [0.04, 1.35, 0.04], '#374151', 0, [Math.cos(a) * 0.3, 0, -Math.sin(a) * 0.3]))
  }
  P.push(piece('box', [0, 1.38, 5.5], [0.32, 0.22, 0.14], '#1f2937'))
  P.push(piece('cyl', [0, 1.38, 5.4], [0.08, 0.08, 0.08], '#9ca3af', 0, [Math.PI / 2, 0, 0]))
  // 안내 팻말 기둥 (팻말 그림은 따로)
  P.push(piece('box', [1.1, 0.6, 5.5], [0.08, 1.2, 0.08], '#8b5e3c'))

  photoZoneGeometry = mergeGeometries(P)
  P.forEach((g) => g.dispose())
  photoZoneGeometry.computeBoundingSphere()
  return photoZoneGeometry
}

// 눈에 안 보이는 충돌 전용 소품 (커플 포토존처럼 모양이 복잡한 소품을 여러 상자로 막을 때). 구역 파일 style: "bkBlocker"
// 그림은 없고, 충돌은 공용 Colliders.jsx가 이 항목의 collider(또는 size)로 만듦
export function BkBlocker() {
  return null
}

const SWING_SEAT = mat('#fbcfe8')
const SWING_ROPE = mat('#f5f0e6')

export function CouplePhotoZone() {
  const swingRef = useRef(null)
  useFrame(({ clock }) => {
    if (swingRef.current) swingRef.current.rotation.x = Math.sin(clock.elapsedTime * 1.1) * 0.1 // 살랑살랑
  })
  return (
    <group>
      <mesh geometry={couplePhotoZoneGeometry()} material={INTERIOR_MAT} castShadow receiveShadow />
      {/* 인생네컷 (E → 혼자·같이 찍기) */}
      <PhotoBooth />
      {/* 흔들리는 그네: 위 가로대 높이를 축으로 회전 */}
      <group ref={swingRef} position={[SWING.x, SWING.top, SWING.z]}>
        {[-0.75, 0.75].map((x) => (
          <Box key={x} p={[x, -0.9, 0]} s={[0.03, 1.8, 0.03]} m={SWING_ROPE} userData={NO_SHADOW} />
        ))}
        <Box p={[0, -1.8, 0]} s={[1.7, 0.1, 0.55]} m={SWING_SEAT} />
        <Box p={[0, -1.55, -0.25]} s={[1.7, 0.45, 0.06]} m={SWING_SEAT} />
      </group>
      {/* 안내 팻말 */}
      <mesh position={[1.1, 1.3, 5.55]} userData={NO_SHADOW}>
        <planeGeometry args={[1.2, 0.3]} />
        <meshStandardMaterial map={getSignTexture('커플 포토존', '#fff1f5', '#db2777')} />
      </mesh>
    </group>
  )
}

// ════════════════════════════════════════════
// 조경 묶음 (landscape): 나무·덤불·꽃밭·풀숲·돌·생울타리·화분·연못 테두리·피크닉 세트
// 최적화: item 하나의 모든 조경을 모양 1개로 합쳐 그리기 호출 1번 (연못 물만 1번 더), 충돌 없음
// item.features: [{ t: 종류, p: [x, z], y: 높이(선택), s: 크기 배율, ... }] — 좌표는 item 위치 기준
// ════════════════════════════════════════════
const LANDSCAPE_MAT = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.95 })
const LEAF = ['#5fa24f', '#4f8f45', '#6fb35c', '#3f7a3a', '#7cbf63']
const PINE = ['#2f6b4a', '#3a7a55', '#285f42']
const BLOSSOM_LS = ['#f9a8d4', '#fbcfe8', '#f472b6', '#fbb6d5']

function addLandscapeFeature(P, f, random) {
  const [x, z] = f.p
  const y = f.y ?? 0
  const s = f.s ?? 1
  const pick = (list) => list[Math.floor(random() * list.length)]
  switch (f.t) {
    case 'tree':
    case 'cherry': {
      const trunkH = 2.4 * s
      P.push(piece('cyl', [x, y + trunkH / 2, z], [0.18 * s, trunkH, 0.18 * s], '#6b4f3a'))
      const colors = f.t === 'cherry' ? BLOSSOM_LS : LEAF
      for (const [dx, dy, dz, k] of [[0, 0.4, 0, 1], [0.6, 0, 0.2, 0.75], [-0.5, 0.1, -0.3, 0.8], [0.1, 0.9, -0.2, 0.65]]) {
        const r = 1.25 * s * k
        P.push(piece('ico1', [x + dx * s, y + trunkH + dy * s + 0.6 * s, z + dz * s], [r, r * 0.9, r], pick(colors)))
      }
      break
    }
    case 'pine': {
      const trunkH = 1.2 * s
      P.push(piece('cyl', [x, y + trunkH / 2, z], [0.2 * s, trunkH, 0.2 * s], '#5b4030'))
      for (let k = 0; k < 3; k++) {
        const r = (1.7 - k * 0.45) * s
        P.push(piece('cone', [x, y + trunkH + (0.9 + k * 1.15) * s, z], [r, 2.0 * s, r], PINE[k % PINE.length], 0, random() * 3))
      }
      break
    }
    case 'bush': {
      for (const [dx, dz, k] of [[0, 0, 1], [0.45, 0.2, 0.75], [-0.4, -0.15, 0.8]]) {
        const r = 0.55 * s * k
        P.push(piece('ico', [x + dx * s, y + r * 0.8, z + dz * s], [r, r * 0.85, r], pick(LEAF)))
      }
      if (f.flowers) for (let k = 0; k < 6; k++) {
        const a = random() * Math.PI * 2
        P.push(piece('ico', [x + Math.cos(a) * 0.45 * s, y + 0.55 * s + random() * 0.25 * s, z + Math.sin(a) * 0.45 * s], [0.09, 0.09, 0.09], pick(f.palette ?? FLOWER_COLORS)))
      }
      break
    }
    case 'flowers': {
      const r = f.r ?? 2.5
      const n = f.n ?? 30
      for (let k = 0; k < n; k++) {
        const a = random() * Math.PI * 2
        const d = Math.sqrt(random()) * r
        const fs = (0.09 + random() * 0.07) * (f.blossomScale ?? 1)
        const fx = x + Math.cos(a) * d
        const fz = z + Math.sin(a) * d
        if (k % 3 === 0) P.push(piece('cone', [fx, y + 0.12, fz], [0.12, 0.25, 0.12], pick(LEAF)))
        P.push(piece('ico', [fx, y + 0.2 + random() * 0.12, fz], [fs, fs, fs], pick(f.palette ?? FLOWER_COLORS)))
      }
      break
    }
    case 'grass':
      for (let k = 0; k < 3; k++) {
        P.push(piece('cone', [x + (random() - 0.5) * 0.3, y + 0.18 * s, z + (random() - 0.5) * 0.3], [0.08 * s, 0.4 * s, 0.08 * s], pick(LEAF), 0, [0.2 * (random() - 0.5), 0, 0.2 * (random() - 0.5)]))
      }
      break
    case 'rock':
      P.push(piece('rock', [x, y + 0.25 * s, z], [0.7 * s, 0.45 * s, 0.6 * s], pick(f.palette ?? ['#b8acc0', '#a99fb2', '#c4bacb']), 0, random() * 3))
      break
    case 'hedge': {
      const [x2, z2] = f.p2
      const len = Math.hypot(x2 - x, z2 - z)
      const yaw = Math.atan2(x2 - x, z2 - z)
      const h = f.h ?? 0.9
      P.push(piece('box', [(x + x2) / 2, y + h / 2, (z + z2) / 2], [0.75, h, len], '#4f8f45', 0, yaw))
      const bumps = Math.max(1, Math.round(len / 1.4))
      for (let k = 0; k < bumps; k++) {
        const t = (k + 0.5) / bumps
        P.push(piece('ico', [x + (x2 - x) * t, y + h, z + (z2 - z) * t], [0.45, 0.3, 0.45], pick(LEAF)))
      }
      break
    }
    case 'planter': {
      const w = f.w ?? 4
      const d = f.d ?? 1
      const rot = f.rot ?? 0
      const c = Math.cos(rot)
      const sn = Math.sin(rot)
      const at = (lx) => [x + lx * c, z - lx * sn]
      P.push(piece('box', [x, y + 0.3, z], [w, 0.6, d], '#9a6b45', 0, rot))
      P.push(piece('box', [x, y + 0.6, z], [w - 0.12, 0.04, d - 0.12], '#5b4636', 0, rot))
      const n = Math.max(2, Math.round(w / 0.9))
      for (let k = 0; k < n; k++) {
        const [bx, bz] = at(-w / 2 + 0.45 + (k * (w - 0.9)) / Math.max(1, n - 1))
        const r = 0.35 + random() * 0.12
        P.push(piece('ico', [bx, y + 0.75, bz], [r, r * 0.8, r], pick(LEAF)))
        P.push(piece('ico', [bx + (random() - 0.5) * 0.4, y + 0.95, bz + (random() - 0.5) * 0.3], [0.1, 0.1, 0.1], pick(FLOWER_COLORS)))
      }
      break
    }
    case 'pond': {
      const r = f.r ?? 4
      for (let k = 0; k < 14; k++) {
        const a = (k / 14) * Math.PI * 2 + random() * 0.2
        const rr = 0.4 + random() * 0.35
        P.push(piece('rock', [x + Math.cos(a) * (r + 0.2), y + 0.15, z + Math.sin(a) * (r + 0.2)], [rr, rr * 0.6, rr], pick(['#b8acc0', '#c4bacb', '#a99fb2']), 0, random() * 3))
      }
      for (let k = 0; k < 10; k++) {
        const a = random() * Math.PI * 2
        P.push(piece('cone', [x + Math.cos(a) * (r - 0.4), y + 0.5, z + Math.sin(a) * (r - 0.4)], [0.06, 1.0, 0.06], '#6b8f3a'))
      }
      for (let k = 0; k < 5; k++) {
        const a = random() * Math.PI * 2
        const d = random() * (r - 1)
        P.push(piece('cyl', [x + Math.cos(a) * d, y + 0.1, z + Math.sin(a) * d], [0.35, 0.02, 0.35], '#5fa24f'))
        if (k % 2 === 0) P.push(piece('ico', [x + Math.cos(a) * d, y + 0.16, z + Math.sin(a) * d], [0.1, 0.08, 0.1], '#fbcfe8'))
      }
      break
    }
    case 'picnic': {
      const rot = f.rot ?? 0
      for (let i = 0; i < 4; i++) {
        for (let j = 0; j < 3; j++) {
          const lx = -0.9 + i * 0.6
          const lz = -0.6 + j * 0.6
          const color = (i + j) % 2 ? (f.fabric ? '#fff8e8' : '#ffffff') : (f.fabric ?? '#f9a8d4')
          P.push(piece('box', [x + lx * Math.cos(rot) + lz * Math.sin(rot), y + 0.02, z - lx * Math.sin(rot) + lz * Math.cos(rot)], [0.6, 0.03, 0.6], color, 0, rot))
        }
      }
      P.push(piece('box', [x + 0.5, y + 0.2, z - 0.1], [0.5, 0.35, 0.35], '#b07a4f', 0, rot))
      P.push(piece('box', [x + 0.5, y + 0.45, z - 0.1], [0.4, 0.05, 0.05], '#8b5e3c', 0, rot))
      for (const [cx, cz, c] of [[-0.6, 0.3, '#c4b5fd'], [-0.1, 0.4, '#fde68a']]) P.push(piece('box', [x + cx, y + 0.1, z + cz], [0.45, 0.15, 0.45], c, 0, rot))
      for (const [cx, cz] of [[-0.3, -0.3], [0, -0.35]]) P.push(piece('cyl', [x + cx, y + 0.12, z + cz], [0.06, 0.18, 0.06], '#ffffff'))
      P.push(piece('box', [x - 1.4, y + 1.1, z - 0.9], [0.04, 2.2, 0.04], '#e5e7eb'))
      P.push(piece('cone', [x - 1.4, y + 2.25, z - 0.9], [1.3, 0.5, 1.3], f.fabric ?? '#fbcfe8'))
      break
    }
    default:
  }
}

const landscapeCache = new Map()
function landscapeGeometry(item) {
  if (landscapeCache.has(item.id)) return landscapeCache.get(item.id)
  const random = seeded(hashString(item.id))
  const P = []
  for (const f of item.features ?? []) addLandscapeFeature(P, f, random)
  const merged = mergeGeometries(P)
  P.forEach((g) => g.dispose())
  merged.computeBoundingSphere()
  landscapeCache.set(item.id, merged)
  return merged
}

export function Landscape({ item }) {
  const geometry = landscapeGeometry(item)
  const ponds = (item.features ?? []).filter((f) => f.t === 'pond')
  return (
    <group>
      <mesh geometry={geometry} material={LANDSCAPE_MAT} castShadow receiveShadow />
      {ponds.map((f, i) => (
        <group key={i}>
          <Cyl p={[f.p[0], (f.y ?? 0) + 0.05, f.p[1]]} rad={f.r ?? 4} h={0.06} m={WATER} geo={GEO.cyl48} userData={NO_SHADOW} />
          <LowStoneRim x={f.p[0]} y={f.y ?? 0} z={f.p[1]} radius={(f.r ?? 4) + 0.16} height={0.33} />
        </group>
      ))}
    </group>
  )
}

// 가게 종류 정하기: item.interior가 있으면 그걸, 없으면 모양으로 짐작
function interiorKinds(item, fallback) {
  if (item.interior) return Array.isArray(item.interior) ? item.interior : [item.interior, item.interior]
  if (item.roofProp === 'camera') return ['photo', 'photo']
  if (item.display === 'cake') return ['dessert', 'dessert']
  if (item.display === 'flower') return ['flower', 'flower']
  return [fallback, fallback]
}

// ── 한옥 가게 (디저트 가게·사진관·꽃집·한옥 카페 공용) ──
// item.awning: 줄무늬 차양 색 / item.display: "cake" | "flower" | "none"
// item.roofProp: "camera"(사진관) / item.brick: 아래 벽을 벽돌로 / item.stringLights: 처마 줄조명
export function HanokShop({ item }) {
  const [w, h, d] = item.size
  const base = 0.4
  const roofH = Math.min(2.2, h * 0.33)
  const wallTop = h - roofH
  const inW = w - 0.6
  const inD = d - 0.6
  const front = inD / 2
  const wallColor = item.color ?? '#f5ecdc'
  const sign = item.signs?.[0]

  const brickTexture = useMemo(() => (item.brick ? getTiledTexture('brick', inW / 1.2, (wallTop - base) / 1.2) : null), [item.brick, inW, wallTop])
  const [kind] = interiorKinds(item, 'cafe')
  const groundH = Math.min(2.8, wallTop - base - 0.6) // 유리 너머 실내 높이
  const recess = Math.min(3, inD * 0.45) // 파낸 깊이

  const { posts, bulbs } = useMemo(() => {
    const posts = [-inW / 2, -inW / 6, inW / 6, inW / 2].flatMap((x) =>
      [front, -front].map((z) => ({ p: [x, (base + wallTop) / 2, z], s: [0.22, wallTop - base, 0.22] })),
    )
    const bulbs = item.stringLights ? bulbLine([-w / 2, wallTop - 0.15, front + 0.55], [w / 2, wallTop - 0.15, front + 0.55], 14) : []
    return { posts, bulbs }
  }, [item.stringLights, w, inW, front, wallTop])
  const trim = useMemo(() => {
    const pieces = []
    const add = (p, s, c) => pieces.push({ p, s, c })
    const xDoor = inW / 2 - 0.85
    add([0, 0.22, front + 0.31], [w, 0.15, 0.10], '#786a5a')
    add([0, base + 0.19, front + 0.07], [inW, 0.09, 0.17], '#6e4834')
    add([0, base + 2.16, front + 0.10], [inW, 0.06, 0.14], '#a07b58')
    for (const x of [xDoor - 0.53, xDoor + 0.53]) add([x, base + 1.1, front + 0.14], [0.09, 2.23, 0.14], '#714931')
    add([xDoor - 0.26, base + 1.03, front + 0.18], [0.045, 0.14, 0.04], '#d9ab64')
    const count = Math.max(3, Math.round(inW / 0.72))
    for (let i = 0; i <= count; i++) {
      const x = inW * (i / count - 0.5)
      for (const side of [-1, 1]) add([x, wallTop - 0.19, side * (front + 0.11)], [0.10, 0.12, 0.44], '#6b4636')
      if (x < xDoor - 0.62) add([x, base + 2.43, front + 0.12], [0.042, 0.45, 0.085], '#876344')
    }
    return pieces
  }, [w, inW, front, wallTop, base])

  return (
    <group>
      <Box p={[0, base / 2, 0]} s={[w, base, d]} c={STONE} />
      {/* 벽 몸통: 앞쪽 1층을 파내서 유리 너머로 가게 안이 보이게 (벽돌집이면 벽돌 무늬) */}
      <RecessedBody
        w={inW}
        h={wallTop - base}
        d={inD}
        y0={base}
        gh={groundH}
        rd={recess}
        material={item.brick ? texMat(brickTexture) : mat(wallColor)}
        kind={kind}
      />
      <Instances geometry={GEO.box} material={mat(WOOD)} items={posts} castShadow />
      <group userData={NO_SHADOW}>
        <Instances geometry={GEO.box} material={TINTABLE} items={trim} />
      </group>
      <Box p={[0, wallTop - 0.15, front]} s={[inW + 0.3, 0.3, 0.3]} c={WOOD} />
      <Box p={[0, base + groundH + 0.08, front + 0.02]} s={[inW, 0.16, 0.12]} c={WOOD} />
      {/* 문 (유리 앞) */}
      <Box p={[inW / 2 - 0.85, base + 1.1, front + 0.04]} s={[1, 2.2, 0.08]} c="#6b4a2f" />
      <Box p={[inW / 2 - 0.85, base + 1.6, front + 0.09]} s={[0.6, 0.7, 0.02]} m={WARM_GLASS} userData={NO_SHADOW} />
      {/* 줄무늬 차양 */}
      {item.awning && (
        <mesh
          geometry={GEO.box}
          material={texMat(getStripeTexture(item.awning))}
          position={[-w * 0.05, base + 2.5, front + 0.6]}
          rotation={[0.38, 0, 0]}
          scale={[inW * 0.92, 0.08, 1.3]}
        />
      )}
      {/* 간판 */}
      {sign && (
        <mesh position={[0, base + 3.15, front + 0.05]} userData={NO_SHADOW}>
          <planeGeometry args={[inW * 0.5, 0.5]} />
          <meshStandardMaterial map={getSignTexture(sign.text, sign.bg, sign.fg, (inW * 0.5) / 0.5)} />
        </mesh>
      )}
      <Instances geometry={GEO.sphere} material={BULB} items={bulbs} />
      <HanokRoof w={w + 1.4} d={d + 1.4} y={wallTop - 0.05} h={roofH} />
      {item.id === 'BK/b_cafe' && <><CafeOrderCounter /><EpisodeScenery spot="cafe" /></>}
      {/* 사진관 지붕 위 카메라 장식 */}
      {item.roofProp === 'camera' && (
        <group position={[0, wallTop + 0.9, front - 0.5]}>
          <Box p={[0, 0, 0]} s={[1.5, 1, 0.8]} c={PINK} />
          <Cyl p={[0, 0, 0.5]} rad={0.32} h={0.35} r={[Math.PI / 2, 0, 0]} c={DARK} />
          <Box p={[0.45, 0.62, 0]} s={[0.35, 0.22, 0.3]} c="#ffffff" />
        </group>
      )}
    </group>
  )
}

// 한옥 카페 = 아래 벽돌 + 처마 줄조명이 기본인 한옥 가게
export const HanokCafe = ({ item }) => <HanokShop item={{ brick: true, stringLights: true, ...item }} />

// ── 루프탑 레스토랑 (옥상 테이블 + 줄조명 + 덩굴) ──
export function RooftopRestaurant({ item }) {
  const [w, h, d] = item.size
  const railH = 1.1
  const bodyH = h - railH
  const front = d / 2
  const sign = item.signs?.[0]
  const kinds = interiorKinds(item, 'restaurant')
  const awningGeometry = useMemo(() => roofGeometry(w + 0.6, 1.6, 0.6, 0.15), [w])

  const parts = useMemo(() => {
    const random = seeded(hashString(item.id))
    const top = bodyH + 0.15
    const posts = []
    const nx = Math.round(w / 1.2)
    const nz = Math.round(d / 1.2)
    for (let i = 0; i <= nx; i++) {
      const x = -w / 2 + (w * i) / nx
      posts.push({ p: [x, top + 0.45, front], s: [0.05, 0.9, 0.05] }, { p: [x, top + 0.45, -front], s: [0.05, 0.9, 0.05] })
    }
    for (let i = 1; i < nz; i++) {
      const z = -front + (d * i) / nz
      posts.push({ p: [w / 2, top + 0.45, z], s: [0.05, 0.9, 0.05] }, { p: [-w / 2, top + 0.45, z], s: [0.05, 0.9, 0.05] })
    }
    const tables = []
    const chairs = []
    for (const x of [-w * 0.3, 0, w * 0.3]) {
      for (const z of [-d * 0.2, d * 0.15]) {
        tables.push({ p: [x, top + 0.72, z], s: [0.45, 0.05, 0.45] })
        chairs.push({ p: [x - 0.7, top + 0.45, z], s: [0.4, 0.06, 0.4] }, { p: [x + 0.7, top + 0.45, z], s: [0.4, 0.06, 0.4] })
      }
    }
    const lightY = top + 2.2
    const corners = [
      [-w / 2 + 0.2, lightY, front - 0.2],
      [w / 2 - 0.2, lightY, front - 0.2],
      [w / 2 - 0.2, lightY, -front + 0.2],
      [-w / 2 + 0.2, lightY, -front + 0.2],
    ]
    const bulbs = corners.flatMap((c, i) => bulbLine(c, corners[(i + 1) % 4], 12, 0.35))
    const lightPosts = corners.map(([x, , z]) => ({ p: [x, top + 1.1, z], s: [0.05, 2.2, 0.05] }))
    const vines = range(8).map((i) => {
      const len = 1 + random() * 1.8
      return { p: [-w / 2 + 0.6 + (w - 1.2) * (i / 7), bodyH - len / 2, front + 0.05], s: [0.35, len, 0.08] }
    })
    const bushes = range(Math.round(w / 0.9)).map((i) => ({
      p: [-w / 2 + 0.6 + (w - 1.2) * (i / Math.max(1, Math.round(w / 0.9) - 1)), top + 0.6, front - 0.35],
      s: [0.35, 0.3, 0.3],
    }))
    return { posts, tables, chairs, bulbs, lightPosts, vines, bushes }
  }, [item.id, w, d, bodyH, front])

  return (
    <group>
      {/* 몸통: 1층 앞쪽을 파내서 유리 너머로 가게 안이 보이게 */}
      <RecessedBody w={w} h={bodyH - 0.6} d={d} y0={0.6} gh={2.55} rd={3.2} material={mat(item.color ?? '#f3ede3')} kind={kinds[0]} />
      <Box p={[0, 0.3, 0]} s={[w + 0.06, 0.6, d + 0.06]} c="#4b4440" />
      <mesh geometry={awningGeometry} material={ROOF_MAT} position={[0, 3.2, front + 0.35]} />
      {sign && (
        <mesh position={[0, 4.25, front + 0.05]} userData={NO_SHADOW}>
          <planeGeometry args={[w * 0.5, 0.55]} />
          <meshStandardMaterial map={getSignTexture(sign.text, sign.bg, sign.fg, (w * 0.5) / 0.55)} />
        </mesh>
      )}
      {/* 2층 창: 실내 그림 (따로 파내지 않고 그림 한 장으로 — 그리기 호출 늘지 않음) */}
      <mesh
        geometry={GEO.plane}
        material={nightGlow(texMat(getBackWallTexture(kinds[1]), { emissive: '#ffffff', emissiveIntensity: 0.45 }), 1.1)}
        position={[0, bodyH - 1.5, front + 0.04]}
        scale={[w - 1.2, 1.4, 1]}
        userData={NO_SHADOW}
      />
      <Box p={[0, bodyH, 0]} s={[w + 0.2, 0.2, d + 0.2]} c="#e4dccf" />
      <Box p={[0, bodyH + 0.12, 0]} s={[w - 0.2, 0.06, d - 0.2]} c="#a77a52" />
      {/* 옥상 난간 */}
      {[1, -1].map((side) => (
        <group key={side}>
          <Box p={[0, bodyH + 1.05, side * front]} s={[w, 0.07, 0.07]} c={DARK} />
          <Box p={[side * (w / 2), bodyH + 1.05, 0]} s={[0.07, 0.07, d]} c={DARK} />
        </group>
      ))}
      <Instances geometry={GEO.box} material={mat(DARK)} items={parts.posts} />
      {/* 화분 + 덩굴 */}
      <Box p={[0, bodyH + 0.4, front - 0.35]} s={[w - 0.6, 0.5, 0.45]} c={WOOD} />
      <Instances geometry={GEO.ico} material={mat('#5f9e4f', { flat: true })} items={parts.bushes} />
      <Instances geometry={GEO.box} material={mat('#6aa857', { flat: true })} items={parts.vines} />
      {/* 테이블 + 의자 */}
      <Instances geometry={GEO.cyl} material={mat('#ffffff')} items={parts.tables} />
      <Instances geometry={GEO.box} material={mat(WOOD)} items={parts.chairs} />
      {/* 줄조명 */}
      <Instances geometry={GEO.box} material={mat(DARK)} items={parts.lightPosts} />
      <Instances geometry={GEO.sphere} material={BULB} items={parts.bulbs} />
      {/* 옥상 영화관 스크린 (item.screen) */}
      {item.screen && (
        <group position={[0, bodyH + 0.15, -front + 0.5]}>
          <Box p={[0, 2.1, 0]} s={[w * 0.6, 2.6, 0.12]} m={SCREEN} userData={NO_SHADOW} />
          {[-1, 1].map((side) => (
            <Box key={side} p={[side * w * 0.31, 1.7, 0]} s={[0.12, 3.4, 0.12]} c={DARK} />
          ))}
        </group>
      )}
    </group>
  )
}

const SCREEN = nightGlow(mat('#f8fafc', { emissive: '#dbe4ff', emissiveIntensity: 0.6 }), 1.3)

// ── 날개 벽화 벽 (빛나는 네온 날개) ────────────
export function NeonWings({ item }) {
  const [w, h, d] = item.size
  const capH = 0.5
  const wallH = h - capH
  const isMural = item.id === 'BK/b_wings'
  const wingCenterY = isMural ? 0.83 : wallH * 0.55
  const wingHeight = isMural ? 2.1 : w * 0.375
  const wingZ = d / 2 + (isMural ? 0.07 : 0.03)
  const capGeometry = roofGeometry(w + 0.6, d + 0.8, capH, 0.1)
  const flowers = useMemo(
    () =>
      [-1, 1].flatMap((side, k) =>
        flowerItems(hashString(item.id) + k, 30, (random) => [side * w * 0.32 + (random() - 0.5) * 2.2, d / 2 + 0.35 + (random() - 0.5) * 0.4], 0.5),
      ),
    [item.id, w, d],
  )
  const vines = useMemo(
    () => range(10).map((i) => ({ p: [(i < 5 ? -1 : 1) * (w / 2 - 0.3 - (i % 5) * 0.35), wallH - 0.8 - (i % 3) * 0.4, d / 2 + 0.04], s: [0.3, 1.2 + (i % 3) * 0.5, 0.06] })),
    [w, d, wallH],
  )
  return (
    <group>
      <Box p={[0, 0.3, 0]} s={[w + 0.1, 0.6, d + 0.1]} c="#9a958c" />
      <Box p={[0, wallH / 2, 0]} s={[w, wallH, d]} c="#efe7da" />
      <mesh geometry={capGeometry} material={ROOF_MAT} position={[0, wallH, 0]} />
      <mesh
        geometry={GEO.plane}
        material={nightGlow(texMat(getNeonWingsTexture(), { emissive: '#ffffff', emissiveIntensity: 1.4, transparent: true }), 2.4)}
        position={[0, wingCenterY, wingZ]}
        scale={[w * 0.75, wingHeight, 1]}
        userData={NO_SHADOW}
      />
      {[-1, 1].map((side) => (
        <Box key={side} p={[side * w * 0.32, 0.25, d / 2 + 0.35]} s={[2.4, 0.5, 0.6]} c="#9a6b45" />
      ))}
      {!isMural && <Instances geometry={GEO.ico} material={TINTABLE} items={flowers} />}
      <Instances geometry={GEO.box} material={mat('#6aa857', { flat: true })} items={vines} />
      {isMural && (
        <>
          <MuralFrameScene wingWidth={w * 0.75} wingHeight={wingHeight} wingCenterY={wingCenterY} wingZ={wingZ} />
          <EpisodeScenery spot="mural" />
        </>
      )}
    </group>
  )
}

// ════════════════════════════════════════════
// 현대 건물 (평지붕, 유리, 노출 콘크리트, 철골)
// ════════════════════════════════════════════
const CONCRETE = '#c4c0b9'
const DARK_CONCRETE = '#4a4441'
const STEEL = '#3a3f45'
const GREENHOUSE_GLASS = mat('#e8fff4', { transparent: true, opacity: 0.28, roughness: 0.1, emissive: '#fff3d6', emissiveIntensity: 0.15, double: true })
nightGlow(GREENHOUSE_GLASS, 0.7)

function SignPlate({ sign, width, p }) {
  if (!sign) return null
  return (
    <mesh position={p} userData={NO_SHADOW}>
      <planeGeometry args={[width, width / 4]} />
      <meshStandardMaterial map={getSignTexture(sign.text, sign.bg, sign.fg)} />
    </mesh>
  )
}

// ── 통유리 2층 카페 (노출 콘크리트 + 우드 루버) ── item.palette: "dark"면 어두운 콘크리트(와인바 등)
export function GlassCafe({ item }) {
  const [w, h, d] = item.size
  const dark = item.palette === 'dark'
  const concrete = dark ? DARK_CONCRETE : CONCRETE
  const wood = dark ? '#7a4b32' : '#b07a4f'
  const floorH = (h - 0.3) / 2
  const front = d / 2
  const louvers = useMemo(() => {
    const n = Math.floor((w * 0.4) / 0.35)
    return range(n).map((i) => ({ p: [-w / 2 + 0.6 + i * 0.35, floorH * 1.5 + 0.15, front - 0.1], s: [0.09, floorH - 0.5, 0.14] }))
  }, [w, floorH, front])
  const columns = [-1, 1].flatMap((sx) => [-1, 1].map((sz) => ({ p: [sx * (w / 2 - 0.2), h / 2, sz * (d / 2 - 0.2)], s: [0.35, h, 0.35] })))
  const kinds = interiorKinds(item, dark ? 'wine' : 'cafe2')
  const glassZ = front - 0.35
  const roomD = Math.min(2.8, d * 0.4) // 유리 너머 실내 깊이
  const coreFront = glassZ - roomD
  const coreBack = -d / 2 + 0.2
  const innerW = w - 0.7
  return (
    <group>
      {/* 뒤쪽 노출 콘크리트 몸통 + 실내 양옆 벽 */}
      <Box p={[0, (h - 0.3) / 2, (coreFront + coreBack) / 2]} s={[innerW, h - 0.3, coreFront - coreBack]} c={concrete} />
      {[-1, 1].map((s) => (
        <Box key={s} p={[s * (innerW / 2 - 0.1), (h - 0.3) / 2 + 0.15, glassZ - roomD / 2]} s={[0.2, h - 0.3, roomD]} c={concrete} />
      ))}
      {[0, floorH, floorH * 2].map((y) => (
        <Box key={y} p={[0, y + 0.15, 0]} s={[w, 0.3, d]} c={concrete} />
      ))}
      <Instances geometry={GEO.box} material={mat(concrete)} items={columns} castShadow />
      {/* 층마다 통유리 너머 실내 */}
      {[0, 1].map((f) => (
        <ShopInterior key={f} kind={kinds[f]} W={innerW - 0.4} H={floorH - 0.3} D={roomD} p={[0, floorH * f + 0.3, glassZ - roomD / 2]} />
      ))}
      <Instances geometry={GEO.box} material={mat(wood)} items={louvers} />
      <Box p={[0, floorH * 2 + 0.6, d / 2 - 0.6]} s={[w * 0.35, 0.5, 0.6]} c="#5f9e4f" />
      <SignPlate sign={item.signs?.[0]} width={Math.min(w * 0.5, 4.2)} p={[w * 0.18, floorH + 0.15, front + 0.01]} />
      {item.id === WINE_BAR_ID && <WineTastingSpot item={item} />}
    </group>
  )
}

// ── 하얀 큐브 갤러리 ─────────────────────────
export function CubeGallery({ item }) {
  const [w, h, d] = item.size
  const front = d / 2
  return (
    <group>
      {/* 하얀 큐브: 1층 앞을 파내서 유리 너머 전시실이 보이게 */}
      <RecessedBody w={w} h={h} d={d} gh={Math.min(3.2, h * 0.55)} rd={Math.min(3, d * 0.45)} material={mat('#f7f6f2')} kind={interiorKinds(item, 'gallery')[0]} />
      <Box p={[w * 0.3, 1.2, front + 0.03]} s={[1.1, 2.4, 0.06]} c={DARK} />
      <Box p={[0, h - 0.5, front + 0.03]} s={[w, 0.12, 0.08]} c={PINK} />
      <SignPlate sign={item.signs?.[0]} width={Math.min(w * 0.4, 3)} p={[w * 0.2, h * 0.72, front + 0.02]} />
      {/* 입구 앞 작은 조각 (분홍 구) */}
      <Box p={[-w * 0.36, 0.45, front + 0.7]} s={[0.7, 0.9, 0.7]} c="#e7e5e4" />
      <Ball p={[-w * 0.36, 1.35, front + 0.7]} rad={0.45} m={mat(PINK, { flat: true })} />
    </group>
  )
}

// ── 컨테이너 2단 팝업 스토어 ──────────────────
export function ContainerPopup({ item }) {
  const [w, h, d] = item.size
  const ch = h / 2
  const cd = Math.min(d * 0.5, 3)
  const front = d / 2
  const lowerZ = front - cd / 2
  const upperZ = front - cd / 2 - 1.2
  const ribs = useMemo(() => {
    const list = []
    const n = Math.floor(w / 0.4)
    for (let i = 0; i <= n; i++) {
      const x = -w / 2 + (w * i) / n
      list.push({ p: [x * 0.9 + w * 0.05, ch * 1.5, upperZ + cd / 2 + 0.03], s: [0.06, ch - 0.25, 0.05] })
    }
    return list
  }, [w, ch, cd, upperZ])
  const kinds = interiorKinds(item, 'popup')
  return (
    <group>
      {/* 아래 컨테이너: 앞을 파내서 유리 너머 매장이 보이게 */}
      <group position={[0, 0, lowerZ]}>
        <RecessedBody w={w} h={ch} d={cd} gh={ch - 0.35} rd={cd - 0.4} material={mat(item.color ?? '#ff8a7a')} kind={kinds[0]} />
      </group>
      <Box p={[w * 0.05, ch * 1.5, upperZ]} s={[w * 0.9, ch, cd]} c={item.accent ?? '#7dd3c0'} />
      <Instances geometry={GEO.box} material={mat('#ffffff', { roughness: 0.6 })} items={ribs} />
      {/* 위 컨테이너 창: 실내 그림 한 장 */}
      <mesh
        geometry={GEO.plane}
        material={nightGlow(texMat(getBackWallTexture(kinds[1]), { emissive: '#ffffff', emissiveIntensity: 0.45 }), 1.1)}
        position={[w * 0.05, ch * 1.45, upperZ + cd / 2 + 0.07]}
        scale={[w * 0.45, ch - 0.9, 1]}
        userData={NO_SHADOW}
      />
      {/* 위층으로 가는 철제 계단 (장식) */}
      <Box p={[w / 2 - 0.6, ch * 0.75, front - 0.2]} s={[0.9, 0.08, ch * 1.6]} r={[0.75, 0, 0]} c={STEEL} />
      <SignPlate sign={item.signs?.[0]} width={Math.min(w * 0.45, 3.6)} p={[w * 0.05, ch * 1.9, upperZ + cd / 2 + 0.08]} />
    </group>
  )
}

// ── 유리 온실 식물 카페 (철골 + 유리 + 안쪽 식물) ──
export function GreenhouseCafe({ item }) {
  const [w, h, d] = item.size
  const wallH = h * 0.62
  const roofH = h - wallH
  const slope = Math.atan2(roofH, d / 2)
  const slopeLen = Math.hypot(d / 2, roofH)
  const { frame, plants, pots } = useMemo(() => {
    const random = seeded(hashString(item.id))
    const frame = []
    const nx = Math.max(2, Math.round(w / 1.5))
    const nz = Math.max(2, Math.round(d / 1.5))
    for (let i = 0; i <= nx; i++) {
      const x = -w / 2 + (w * i) / nx
      for (const z of [d / 2, -d / 2]) frame.push({ p: [x, wallH / 2, z], s: [0.08, wallH, 0.08] })
      frame.push({ p: [x, wallH + roofH / 2, d / 4], r: [slope, 0, 0], s: [0.07, 0.07, slopeLen] })
      frame.push({ p: [x, wallH + roofH / 2, -d / 4], r: [-slope, 0, 0], s: [0.07, 0.07, slopeLen] })
    }
    for (let i = 1; i < nz; i++) {
      const z = -d / 2 + (d * i) / nz
      for (const x of [w / 2, -w / 2]) frame.push({ p: [x, wallH / 2, z], s: [0.08, wallH, 0.08] })
    }
    for (const z of [d / 2, -d / 2]) frame.push({ p: [0, wallH, z], s: [w, 0.1, 0.1] })
    frame.push({ p: [0, h, 0], s: [w, 0.12, 0.12] })
    const plants = []
    const pots = []
    for (let i = 0; i < 18; i++) {
      const x = (random() - 0.5) * (w - 1.5)
      const z = (random() - 0.5) * (d - 1.5)
      const s = 0.4 + random() * 0.5
      pots.push({ p: [x, 0.25, z], s: [0.35, 0.5, 0.35] })
      plants.push({ p: [x, 0.5 + s, z], s: [s, s * 1.2, s], c: ['#4f8f45', '#5fa24f', '#7bbf5c', '#3f7a3a'][Math.floor(random() * 4)] })
    }
    return { frame, plants, pots }
  }, [item.id, w, d, h, wallH, roofH, slope, slopeLen])
  return (
    <group>
      <Box p={[0, 0.1, 0]} s={[w + 0.2, 0.2, d + 0.2]} c="#a8a29e" />
      <Box p={[0, wallH / 2, 0]} s={[w, wallH, d]} m={GREENHOUSE_GLASS} />
      <Box p={[0, wallH + roofH / 2, d / 4]} s={[w, 0.05, slopeLen]} r={[slope, 0, 0]} m={GREENHOUSE_GLASS} />
      <Box p={[0, wallH + roofH / 2, -d / 4]} s={[w, 0.05, slopeLen]} r={[-slope, 0, 0]} m={GREENHOUSE_GLASS} />
      <Instances geometry={GEO.box} material={mat(STEEL)} items={frame} />
      <Instances geometry={GEO.ico} material={TINTABLE} items={plants} />
      <Instances geometry={GEO.cyl8} material={mat('#c2703d')} items={pots} />
      <Box p={[0, 0.55, -d / 2 + 0.8]} s={[w * 0.5, 1.1, 0.7]} c="#b07a4f" />
      <SignPlate sign={item.signs?.[0]} width={Math.min(w * 0.45, 3.4)} p={[0, wallH - 0.6, d / 2 + 0.06]} />
    </group>
  )
}

// ════════════════════════════════════════════
// 전망 타워 꾸미기 (Terrain.jsx의 TowerMesh 안에서 그림, 타워 로컬 좌표: 문은 +z, 엘리베이터 출구는 전망층 -z)
// 전망층: 바닥 무늬, 바깥을 보는 벤치 4개, 망원경 2개(중앙 광장 쪽·애니 구역 쪽), 하트 포토 프레임, 화분, 사랑의 자물쇠 난간, 매달린 전등
// 1층 홀: 매표 부스, 벤치, 화분, 카펫, 입구 간판 / 바깥: 기둥 LED 띠(밤에 분홍빛), 전망층 아래 전구 링
// 최적화: 간판 말고는 전부 모양 1개로 합치고 실내 재질(INTERIOR_MAT) 공유 → 그리기 호출 약 7번, 그림자 없음
// ════════════════════════════════════════════
const TD = {
  wood: '#b07a4f',
  dark: '#3b3633',
  pot: '#c97b5a',
  soil: '#5b4636',
  leaf: '#5fa24f',
  pink: '#f9a8d4',
  coral: '#ff8a7a',
  cream: '#fbf3e6',
  inlay: '#f4c7d6',
  inlay2: '#d9b48f',
  lamp: '#fff1c9',
}
const DECK_SEATS = [0.25, 0.75, 1.25, 1.75].map((k) => k * Math.PI) // 벤치 (사이사이)
export const DECK_SCOPES = [0, 1.5 * Math.PI] // 망원경 2대: 중앙 광장 쪽(0) · 애니메이션 구역 여우 신사 쪽(1.5π). 실제로 볼 수 있음 → bk_telescope.jsx. π = 엘리베이터 출구 앞은 하트 프레임
const LED = nightGlow(mat('#ffd1e3', { emissive: '#ff7eb6', emissiveIntensity: 0.35 }), 2.6)

// 로컬 조각들을 타워 원 둘레(각도 a, 반지름 r, 높이 y)로 옮김. 조각의 +z가 바깥을 향함 (turn으로 더 돌릴 수 있음)
function atRing(geoms, a, r, y, turn = 0) {
  const m = new THREE.Matrix4().compose(
    new THREE.Vector3(Math.sin(a) * r, y, Math.cos(a) * r),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(0, a + turn, 0)),
    new THREE.Vector3(1, 1, 1),
  )
  geoms.forEach((g) => g.applyMatrix4(m))
  return geoms
}

const benchParts = () => [
  piece('box', [0, 0.45, 0], [1.8, 0.08, 0.5], TD.wood),
  piece('box', [0, 0.75, -0.23], [1.8, 0.45, 0.06], TD.wood),
  ...[-0.78, 0.78].map((x) => piece('box', [x, 0.22, 0], [0.08, 0.44, 0.45], TD.dark)),
]
const scopeParts = () => [
  piece('cyl', [0, 0.04, 0], [0.3, 0.08, 0.3], TD.dark),
  piece('cyl', [0, 0.55, 0], [0.06, 1.0, 0.06], TD.dark),
  piece('box', [0, 1.1, 0], [0.24, 0.24, 0.3], TD.pink),
  piece('cyl', [0, 1.24, 0.28], [0.11, 0.6, 0.11], TD.coral, 0, [Math.PI / 2 - 0.2, 0, 0]),
  piece('cyl', [0, 1.18, -0.08], [0.06, 0.16, 0.06], TD.dark, 0, [Math.PI / 2 - 0.2, 0, 0]),
]
const planterParts = (seed) => {
  const random = seeded(seed)
  return [
    piece('cyl', [0, 0.25, 0], [0.3, 0.5, 0.3], TD.pot),
    piece('cyl', [0, 0.49, 0], [0.27, 0.03, 0.27], TD.soil),
    piece('ico1', [0, 0.72, 0], [0.34, 0.3, 0.34], TD.leaf),
    ...range(4).map((i) => {
      const a = random() * Math.PI * 2
      return piece('ico', [Math.sin(a) * 0.22, 0.8 + random() * 0.12, Math.cos(a) * 0.22], [0.07, 0.07, 0.07], FLOWER_COLORS[i % FLOWER_COLORS.length], 0.2)
    }),
  ]
}
const flatRing = (r0, r1, y, color, flip = false) =>
  colorize(new THREE.RingGeometry(r0, r1, 48).rotateX(flip ? Math.PI / 2 : -Math.PI / 2).translate(0, y, 0), color)

const flowerItemsAt = (random, w, d) =>
  range(Math.round(w * 9)).map(() =>
    piece('ico', [(random() - 0.5) * w, random() * 0.08, (random() - 0.5) * d], [0.07, 0.07, 0.07], FLOWER_COLORS[Math.floor(random() * FLOWER_COLORS.length)], 0.15),
  )

function towerDecorGeometry(T) {
  const P = []
  const deck = T.deckFloor
  const top = T.deckFloor + T.deckWallHeight
  const random = seeded(77)

  // ── 전망층 바닥 무늬: 세 겹 원 띠 + 바퀴살 나무 줄
  P.push(flatRing(3.0, 3.25, deck + 0.025, TD.inlay2))
  P.push(flatRing(4.55, 4.75, deck + 0.025, TD.inlay))
  P.push(flatRing(6.55, 6.75, deck + 0.025, TD.inlay2))
  range(16).forEach((i) => {
    const a = ((i + 0.5) / 16) * Math.PI * 2
    P.push(...atRing([piece('box', [0, 0, 0], [0.08, 0.01, 1.2], TD.inlay2)], a, 5.65, deck + 0.025))
  })

  // ── 바깥을 보는 벤치 4개 (등받이가 안쪽)
  DECK_SEATS.forEach((a) => P.push(...atRing(benchParts(), a, 5.4, deck)))
  // ── 동전 망원경 (중앙 광장 쪽·애니 구역 쪽)
  DECK_SCOPES.forEach((a) => P.push(...atRing(scopeParts(), a, 6.25, deck)))
  // ── 화분 (벤치와 망원경 사이)
  range(8).forEach((i) => {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8 // 22.5°씩 비켜서 망원경·하트 프레임과 안 겹치게
    P.push(...atRing(planterParts(200 + i), a, 6.5, deck))
  })

  // ── 하트 포토 프레임: 엘리베이터에서 내리면 바로 정면, 뒤로 바깥 풍경
  const heart = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(heartPoints(48, 0.058, 0.12), true), 64, 0.07, 6, true)
  P.push(...atRing([colorize(heart, TD.pink, 0.55)], Math.PI, 6.2, deck, Math.PI))
  P.push(...atRing([piece('box', [0, 0.04, 0], [1.6, 0.08, 0.5], TD.cream), piece('box', [0, 0.09, 0.28], [1.2, 0.02, 0.06], TD.coral, 0.3)], Math.PI, 6.2, deck, Math.PI))

  // ── 사랑의 자물쇠 난간: 엘리베이터 구멍 둘레 유리 난간 위 손잡이 + 알록달록 자물쇠 (출구 쪽은 비움)
  const railR = T.shaftRadius + 0.08
  range(44).forEach((i) => {
    const a = (i / 44) * Math.PI * 2
    if (Math.abs(Math.atan2(Math.sin(a - Math.PI), Math.cos(a - Math.PI))) < 0.5) return
    P.push(...atRing([piece('box', [0, 0, 0], [0.38, 0.05, 0.07], TD.dark)], a, railR, deck + 1.12))
    if (random() < 0.8) {
      const color = LOCK_COLORS[Math.floor(random() * LOCK_COLORS.length)]
      P.push(...atRing([piece('box', [0, 0, 0.05], [0.09, 0.11, 0.04], color, 0.15)], a + (random() - 0.5) * 0.06, railR, deck + 1.0 - random() * 0.06))
    }
  })

  // ── 천장 + 매달린 전등 4개
  P.push(flatRing(T.shaftRadius + 0.3, T.deckRadius - 0.2, top - 0.05, TD.cream, true))
  DECK_SEATS.forEach((a) => {
    P.push(
      ...atRing(
        [
          piece('cyl', [0, -0.45, 0], [0.012, 0.9, 0.012], TD.dark),
          piece('cone', [0, -0.95, 0], [0.28, 0.22, 0.28], TD.coral),
          piece('ico1', [0, -1.08, 0], [0.12, 0.12, 0.12], TD.lamp, 1.4),
        ],
        a,
        4.3,
        top - 0.05,
      ),
    )
  })

  // ── 1층 홀: 매표 부스(문 맞은편), 벽 따라 벤치, 화분, 둥근 카펫
  P.push(
    ...atRing(
      [
        piece('box', [0, 0.55, 0], [2.4, 1.1, 0.7], TD.cream),
        piece('box', [0, 0.25, 0.36], [2.4, 0.5, 0.02], TD.coral),
        piece('box', [0, 1.13, 0.05], [2.6, 0.06, 0.85], TD.wood),
        piece('box', [0.6, 1.3, -0.1], [0.4, 0.3, 0.05], '#1f2937', 0.6),
        piece('box', [-0.7, 1.22, 0.15], [0.3, 0.12, 0.2], TD.pink),
        piece('box', [0, 2.6, -0.32], [2.6, 0.6, 0.06], TD.pink, 0.5),
      ],
      Math.PI,
      4.75,
      0,
      Math.PI,
    ),
  )
  for (const a of [Math.PI / 2, -Math.PI / 2]) P.push(...atRing(benchParts(), a, 5.3, 0, Math.PI))
  ;[0.5, -0.5, 2.3, -2.3].forEach((a, i) => P.push(...atRing(planterParts(300 + i), a, 5.2, 0)))
  P.push(flatRing(T.shaftRadius + 0.2, 4.0, 0.03, '#f6d5df'))
  // 바깥 문 옆 큰 화분
  ;[0.42, -0.42].forEach((a, i) => P.push(...atRing(planterParts(400 + i), a, 6.9, 0)))

  // ── 1층 홀 바깥: 돌 받침, 기둥, 창 가로살, 창 밑 꽃상자, 벽등, 처마 장식, 옥상 난간·화단, 문틀·차양·계단
  const H = T.hallRadius
  const nearDoor = (a, pad = 0.12) => Math.abs(Math.atan2(Math.sin(a), Math.cos(a))) < T.doorHalfAngle + pad
  const BAYS = 14
  // 돌 받침 (바닥 둘레, 문 자리는 비움)
  range(40).forEach((i) => {
    const a = ((i + 0.5) / 40) * Math.PI * 2
    if (nearDoor(a, 0)) return
    P.push(...atRing([piece('box', [0, 0.18, 0], [1.0, 0.36, 0.3], '#b9aea4')], a, H + 0.28, 0))
  })
  for (let i = 0; i < BAYS; i++) {
    const a = (i / BAYS) * Math.PI * 2 + Math.PI / BAYS // 기둥은 문 양옆으로 오게 반 칸 비켜서
    // 세로 기둥 (크림 + 코랄 머리)
    P.push(...atRing([piece('box', [0, T.hallHeight / 2, 0], [0.32, T.hallHeight - 0.1, 0.22], TD.cream), piece('box', [0, T.hallHeight - 0.25, 0.04], [0.42, 0.18, 0.26], TD.coral)], a, H + 0.24, 0))
    // 기둥 벽등 (밤에 빛남)
    if (i % 2 === 0) P.push(...atRing([piece('box', [0, 2.75, 0.1], [0.1, 0.1, 0.12], TD.dark), piece('box', [0, 2.62, 0.2], [0.16, 0.22, 0.16], TD.lamp, 1.5)], a, H + 0.24, 0))
  }
  for (let i = 0; i < BAYS; i++) {
    const a = ((i + 1) / BAYS) * Math.PI * 2 // 창 칸 가운데
    if (nearDoor(a)) continue
    const bay = 2 * (H + 0.2) * Math.tan(Math.PI / BAYS) - 0.34
    P.push(...atRing([
      piece('box', [0, 2.15, 0], [bay, 0.06, 0.06], TD.coral), // 창 가로살
      piece('box', [0, 2.15, 0], [0.06, 2.1, 0.06], TD.coral), // 창 세로살
      piece('box', [0, 0.92, 0.12], [bay * 0.8, 0.2, 0.28], TD.wood), // 꽃상자
    ], a, H + 0.2, 0))
    P.push(...atRing(flowerItemsAt(seeded(500 + i), bay * 0.75, 0.24), a, H + 0.32, 1.05))
  }
  // 처마 장식 (지붕 둘레 작은 톱니)
  range(56).forEach((i) => {
    const a = ((i + 0.5) / 56) * Math.PI * 2
    P.push(...atRing([piece('box', [0, 0, 0], [0.22, 0.14, 0.14], TD.cream)], a, H + 0.36, T.hallHeight - 0.42))
  })
  // 옥상 난간 + 옥상 화단 (밖에서 보이는 지붕 정원)
  range(36).forEach((i) => {
    const a = (i / 36) * Math.PI * 2
    P.push(...atRing([piece('box', [0, 0.32, 0], [0.06, 0.64, 0.06], TD.dark)], a, H - 0.05, T.hallHeight))
    P.push(...atRing([piece('box', [0, 0.64, 0], [2 * (H - 0.05) * Math.tan(Math.PI / 36) + 0.02, 0.06, 0.06], TD.dark)], a + Math.PI / 36, (H - 0.05) * Math.cos(Math.PI / 36), T.hallHeight))
  })
  range(12).forEach((i) => {
    const a = ((i + 0.5) / 12) * Math.PI * 2
    const r = (H + T.shaftRadius) / 2 + 0.6
    P.push(...atRing([piece('box', [0, 0.15, 0], [1.6, 0.3, 0.55], '#9c7a5b'), piece('ico1', [0, 0.42, 0], [0.7, 0.22, 0.24], TD.leaf)], a, r, T.hallHeight))
    P.push(...atRing(flowerItemsAt(seeded(600 + i), 1.4, 0.4), a, r, T.hallHeight + 0.08))
  })
  // 문: 코랄 문틀 + 줄무늬 차양 + 문 양옆 등 + 계단 두 칸
  const doorW = 2 * H * Math.sin(T.doorHalfAngle)
  P.push(...atRing([
    ...[-1, 1].map((sd) => piece('box', [sd * (doorW / 2 + 0.05), 1.6, 0.05], [0.24, 3.2, 0.34], TD.coral)),
    piece('box', [0, 3.3, 0.05], [doorW + 0.6, 0.24, 0.34], TD.coral),
    ...range(7).map((k) => piece('box', [-doorW / 2 - 0.2 + ((doorW + 0.4) * (k + 0.5)) / 7, 3.55, 0.62], [(doorW + 0.4) / 7, 0.05, 1.1], k % 2 ? '#ffffff' : TD.coral, 0, [0.32, 0, 0])),
    ...[-1, 1].map((sd) => piece('box', [sd * (doorW / 2 + 0.55), 2.4, 0.22], [0.2, 0.32, 0.2], TD.lamp, 1.5)),
    piece('box', [0, 0.05, 0.75], [doorW + 1.2, 0.1, 0.8], '#cfc6bb'),
    piece('box', [0, 0.02, 1.4], [doorW + 1.6, 0.04, 0.6], '#d8cfc6'),
  ], 0, H + 0.15, 0))

  // ── 바깥: 전망층 아래 전구 링 (빛나는 작은 공)
  range(40).forEach((i) => {
    const a = (i / 40) * Math.PI * 2
    P.push(...atRing([piece('ico', [0, 0, 0], [0.09, 0.09, 0.09], TD.lamp, 1.6)], a, T.deckRadius + 0.05, deck - 0.12))
  })

  const merged = mergeGeometries(P)
  P.forEach((g) => g.dispose())
  return merged
}

// 기둥을 따라 올라가는 LED 띠 (밤에 분홍빛으로 빛남)
function towerLedItems(T) {
  return [0.25, 0.75, 1.25, 1.75].map((k) => {
    const a = k * Math.PI
    const r = T.shaftRadius + 0.17
    const y0 = T.tubeBottom
    const y1 = T.deckFloor - 1.5
    return { p: [Math.sin(a) * r, (y0 + y1) / 2, Math.cos(a) * r], s: [0.07, y1 - y0, 0.07] }
  })
}


// ── 안테나 LED: 안테나 기둥을 감은 링 7개에 분홍 불빛이 아래→위로 흐르고, 꼭대기 등은 천천히 깜빡임
// 최적화: 링 7개는 인스턴스 1번(색만 매 프레임 바꿈), 꼭대기 등 1번 → 그리기 호출 2번
const LED_RINGS = 7
const LED_RING_GEO = new THREE.TorusGeometry(0.2, 0.045, 6, 20).rotateX(Math.PI / 2)
const LED_RING_MAT = new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: false })
const BEACON_MAT = new THREE.MeshStandardMaterial({ color: '#ff9fb5', emissive: '#ff3d7f', emissiveIntensity: 1 })
const ledOn = new THREE.Color('#ff7eb6')
const ledWhite = new THREE.Color('#fff1f7')
const ledOff = new THREE.Color('#7a5868')
const ledTmp = new THREE.Color()

function AntennaLeds({ T }) {
  const top = T.deckFloor + T.deckWallHeight
  const ringsRef = useRef(null)
  const beaconRef = useRef(null)
  const setup = (mesh) => {
    if (!mesh || ringsRef.current === mesh) return
    ringsRef.current = mesh
    const m = new THREE.Matrix4()
    for (let i = 0; i < LED_RINGS; i++) {
      mesh.setMatrixAt(i, m.makeTranslation(0, top + 3.45 + i * 0.4, 0))
      mesh.setColorAt(i, ledOff)
    }
    mesh.instanceMatrix.needsUpdate = true
    mesh.computeBoundingSphere()
  }
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    const mesh = ringsRef.current
    const night = live.stars // 밤에는 더 밝고 선명하게
    if (mesh?.instanceColor) {
      for (let i = 0; i < LED_RINGS; i++) {
        // 아래에서 위로 흐르는 불빛 (2초에 한 바퀴)
        const wave = 0.5 + 0.5 * Math.sin(t * 3.2 - i * 0.9)
        const k = 0.25 + 0.75 * wave ** 3
        ledTmp.copy(ledOff).lerp(ledOn, k).lerp(ledWhite, wave ** 8 * 0.6)
        ledTmp.multiplyScalar(0.75 + night * 0.9)
        mesh.setColorAt(i, ledTmp)
      }
      mesh.instanceColor.needsUpdate = true
    }
    // 꼭대기 등: 1.6초마다 두 번 반짝
    const phase = t % 1.6
    const blink = phase < 0.12 || (phase > 0.28 && phase < 0.4) ? 1 : 0
    BEACON_MAT.emissiveIntensity = 0.4 + blink * (1.6 + night * 1.6)
    if (beaconRef.current) beaconRef.current.scale.setScalar(0.24 + blink * 0.04)
  })
  return (
    <>
      <instancedMesh ref={setup} args={[LED_RING_GEO, LED_RING_MAT, LED_RINGS]} frustumCulled={false} />
      <mesh ref={beaconRef} geometry={GEO.sphere} material={BEACON_MAT} position={[0, top + 6.35, 0]} scale={0.24} />
    </>
  )
}

export function TowerDecor({ T }) {
  const geometry = useMemo(() => towerDecorGeometry(T), [T])
  const leds = useMemo(() => towerLedItems(T), [T])
  const entranceW = 3.0
  const entranceH = 0.45
  return (
    <group userData={NO_SHADOW}>
      <mesh geometry={geometry} material={INTERIOR_MAT} />
      <Instances geometry={GEO.box} material={LED} items={leds} />
      <AntennaLeds T={T} />
      {/* 전망층 망원경을 실제로 볼 수 있게 (E → 망원경 화면) */}
      <TowerTelescopes T={T} angles={DECK_SCOPES} />
      {/* 1층 입구 간판 (문 위, 바깥쪽) */}
      <mesh
        geometry={GEO.plane}
        material={nightGlow(texMat(getSignTexture('SKY 전망대 · 엘리베이터 탑승', TD.coral, '#ffffff', entranceW / entranceH), { emissive: '#ffffff', emissiveIntensity: 0.35 }), 1.2)}
        position={[0, T.hallHeight - 0.55, T.hallRadius + 0.46]}
        scale={[entranceW, entranceH, 1]}
      />
    </group>
  )
}

// 꾸미기 중 부딪혀야 하는 것들 (벤치·매표 부스·망원경) — Terrain.jsx의 타워 충돌에 더해짐
export function towerDecorColliders(T) {
  const boxes = []
  const at = (a, r, y, s, turn = 0) => boxes.push({ p: [Math.sin(a) * r, y, Math.cos(a) * r], r: [0, a + turn, 0], s })
  DECK_SEATS.forEach((a) => at(a, 5.4, T.deckFloor + 0.5, [1.8, 1.0, 0.55]))
  DECK_SCOPES.forEach((a) => at(a, 6.25, T.deckFloor + 0.6, [0.3, 1.2, 0.3]))
  for (const a of [Math.PI / 2, -Math.PI / 2]) at(a, 5.3, 0.5, [1.8, 1.0, 0.55], Math.PI)
  at(Math.PI, 4.75, 0.6, [2.6, 1.2, 0.85], Math.PI)
  return boxes
}

// ════════════════════════════════════════════
// 산책로 입구 아치: 거리 쪽 데크 시작점에 세우는 문틀 모양 표지판 (Terrain.jsx DeckMesh에서 deck.gate가 있으면 그림)
// 크림 기둥 2개 + 코랄 아치 + 아치 전구 + 매달린 간판(앞: gate.text, 뒤: gate.back) + 기둥 밑 화분
// 최적화: 간판 글씨 2장 말고는 모양 1개로 합침 → 그리기 호출 3번, 그림자 없음. 밤에는 전구·간판이 밝아짐
// ════════════════════════════════════════════
const GATE = { postH: 3.4, signW: 2.5, signH: 0.52, signY: 2.85 }

function deckGateGeometry(width) {
  const key = `deckGate:${width}`
  if (geoCacheBk.has(key)) return geoCacheBk.get(key)
  const P = []
  const half = width / 2 + 0.3 // 기둥 위치 (데크 폭 바깥)
  const random = seeded(909)
  for (const sx of [-1, 1]) {
    const x = sx * half
    P.push(piece('box', [x, 0.15, 0], [0.48, 0.3, 0.48], '#b9aea4'))
    P.push(piece('box', [x, GATE.postH / 2, 0], [0.26, GATE.postH, 0.26], TD.cream))
    P.push(piece('box', [x, GATE.postH - 0.05, 0], [0.38, 0.18, 0.38], TD.coral))
    P.push(piece('ico1', [x, GATE.postH + 0.14, 0], [0.13, 0.13, 0.13], TD.pink, 1.2))
    // 기둥 밑 화분 (바깥쪽)
    P.push(piece('cyl', [x + sx * 0.55, 0.22, 0], [0.26, 0.44, 0.26], TD.pot))
    P.push(piece('ico1', [x + sx * 0.55, 0.6, 0], [0.3, 0.26, 0.3], TD.leaf))
    for (let i = 0; i < 5; i++) {
      const a = random() * Math.PI * 2
      P.push(piece('ico', [x + sx * 0.55 + Math.cos(a) * 0.2, 0.7 + random() * 0.1, Math.sin(a) * 0.2], [0.07, 0.07, 0.07], FLOWER_COLORS[i % FLOWER_COLORS.length], 0.2))
    }
  }
  // 가로 들보 + 위로 볼록한 코랄 아치
  P.push(piece('box', [0, GATE.postH - 0.25, 0], [half * 2 + 0.3, 0.16, 0.2], TD.wood))
  const arch = new THREE.TorusGeometry(half, 0.08, 6, 28, Math.PI).scale(1, 0.42, 1).translate(0, GATE.postH, 0)
  P.push(colorize(arch, TD.coral))
  // 아치 따라 전구
  for (let i = 1; i < 12; i++) {
    const a = (i / 12) * Math.PI
    P.push(piece('ico', [Math.cos(a) * half, GATE.postH + Math.sin(a) * half * 0.42 - 0.1, 0.1], [0.07, 0.07, 0.07], TD.lamp, 1.6))
  }
  // 아치 꼭대기 하트 장식
  const heart = new THREE.Shape()
  heart.moveTo(0, -0.22)
  heart.bezierCurveTo(-0.38, 0.06, -0.32, 0.4, 0, 0.22)
  heart.bezierCurveTo(0.32, 0.4, 0.38, 0.06, 0, -0.22)
  P.push(colorize(new THREE.ExtrudeGeometry(heart, { depth: 0.08, bevelEnabled: false }).center().translate(0, GATE.postH + half * 0.42 + 0.22, 0), '#ff7eb6', 0.8))
  // 간판 매다는 줄 + 간판 틀
  for (const sx of [-1, 1]) P.push(piece('cyl', [sx * (GATE.signW / 2 - 0.2), (GATE.postH - 0.33 + GATE.signY + GATE.signH / 2) / 2, 0], [0.015, GATE.postH - 0.33 - GATE.signY - GATE.signH / 2, 0.015], TD.dark))
  P.push(piece('box', [0, GATE.signY, 0], [GATE.signW + 0.12, GATE.signH + 0.12, 0.08], TD.wood))
  const merged = mergeGeometries(P)
  P.forEach((g) => g.dispose())
  geoCacheBk.set(key, merged)
  return merged
}
const geoCacheBk = new Map()

export function DeckGate({ gate, position, yaw, width }) {
  const geometry = deckGateGeometry(width)
  const aspect = GATE.signW / GATE.signH
  const front = nightGlow(texMat(getSignTexture(gate.text, '#ff8a7a', '#ffffff', aspect), { emissive: '#ffffff', emissiveIntensity: 0.25 }), 0.9)
  const back = nightGlow(texMat(getSignTexture(gate.back ?? gate.text, '#ff8a7a', '#ffffff', aspect), { emissive: '#ffffff', emissiveIntensity: 0.25 }), 0.9)
  // 로컬 +z = 산책로 진행 방향 → 앞 간판은 거리 쪽(-z)을 봄
  return (
    <group position={position} rotation={[0, yaw, 0]} userData={NO_SHADOW}>
      <mesh geometry={geometry} material={INTERIOR_MAT} />
      <mesh geometry={GEO.plane} material={front} position={[0, GATE.signY, -0.045]} rotation={[0, Math.PI, 0]} scale={[GATE.signW, GATE.signH, 1]} />
      <mesh geometry={GEO.plane} material={back} position={[0, GATE.signY, 0.045]} scale={[GATE.signW, GATE.signH, 1]} />
    </group>
  )
}
