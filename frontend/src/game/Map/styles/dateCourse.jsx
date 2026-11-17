import { useMemo } from 'react'
import * as THREE from 'three'
import { hipRoofGeometry } from './geometry.js'
import { getCirclePlazaTexture, getNeonWingsTexture, getSignTexture, getStripeTexture, getTiledTexture } from './textures.js'
import { Ball, Box, Cone, Cyl, GEO, Instances, hashString, mat, seeded, texMat } from './kit.jsx'

// BK "데이트 코스" 구역용 스타일 (전망 타워, 분수, 한옥 가게, 벚꽃 등).
// 최적화: 공용 도형·재질(kit.jsx), 반복 물체는 <Instances>, 작은 물체·빛나는 재질은 그림자 끔.

const CREAM = '#fbf3e6'
const CORAL = '#ff8a7a'
const PINK = '#f9a8d4'
const WOOD = '#8b5e3c'
const ROOF = '#3d434b'
const STONE = '#a7a29a'
const DARK = '#2b2d30'

const WARM_GLASS = mat('#fff3da', { emissive: '#ffcf8a', emissiveIntensity: 0.55, roughness: 0.3 })
const TOWER_GLASS = mat('#fff4e0', { emissive: '#ffcf91', emissiveIntensity: 0.65, roughness: 0.2 })
const LANTERN = mat('#fff1c9', { emissive: '#ffc566', emissiveIntensity: 1.1 })
const BULB = mat('#fff6d8', { emissive: '#ffd27a', emissiveIntensity: 1.6 })
const WATER = mat('#8fd3f4', { emissive: '#4aa8e0', emissiveIntensity: 0.25, roughness: 0.1 })
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

function HanokRoof({ w, d, y, h, lift = 0.4 }) {
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
const BLOSSOM = ['#f9a8d4', '#fbcfe8', '#f472b6', '#fbb6d5']
const CLUSTERS = [
  [0, 0, 0, 1],
  [0.55, -0.2, 0.15, 0.75],
  [-0.5, -0.15, -0.2, 0.8],
  [0.1, 0.35, -0.35, 0.7],
  [-0.15, 0.3, 0.4, 0.65],
]

export function CherryTree({ item }) {
  const [w, h] = item.size
  const radius = w / 2
  const trunkH = h * 0.45
  const canopyY = trunkH + radius * 0.5
  return (
    <group>
      {item.planter && <Box p={[0, 0.15, 0]} s={[1, 0.3, 1]} c="#a35d47" />}
      <Cyl p={[0, trunkH / 2, 0]} rad={0.17} h={trunkH} c="#6b4f3a" geo={GEO.cyl8} />
      <Cyl p={[0.25, trunkH * 0.85, 0]} rad={0.08} h={trunkH * 0.5} r={[0, 0, -0.6]} c="#6b4f3a" geo={GEO.cyl8} />
      {CLUSTERS.map(([x, y, z, s], i) => (
        <mesh
          key={i}
          geometry={GEO.ico}
          material={mat(BLOSSOM[i % BLOSSOM.length], { flat: true })}
          position={[x * radius, canopyY + y * radius, z * radius]}
          scale={s * radius * 0.78}
        />
      ))}
    </group>
  )
}

// ── 등불 가로등 ───────────────────────────────
export function LanternLamp({ item }) {
  const [, h] = item.size
  return (
    <group>
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
        0.24,
      ),
    [item.id, radius],
  )
  return (
    <group>
      <Cyl p={[0, 0.12, 0]} rad={radius + 1} h={0.24} c="#7fb069" geo={GEO.cyl48} />
      <Cyl p={[0, 0.35, 0]} rad={radius} h={0.7} c="#ece6dd" geo={GEO.cyl48} />
      <Cyl p={[0, 0.68, 0]} rad={radius - 0.25} h={0.06} m={WATER} geo={GEO.cyl48} userData={NO_SHADOW} />
      <Cyl p={[0, 1.1, 0]} rad={0.35} h={1} c="#ece6dd" />
      <Cyl p={[0, 1.65, 0]} rad={1} h={0.25} c="#ece6dd" />
      <Cyl p={[0, 1.8, 0]} rad={0.82} h={0.05} m={WATER} userData={NO_SHADOW} />
      <Cyl p={[0, 2.05, 0]} rad={0.16} h={0.55} c="#ece6dd" />
      <Cone p={[0, 2.6, 0]} rad={0.35} h={0.6} m={SPRAY} userData={NO_SHADOW} />
      <Instances geometry={GEO.ico} material={TINTABLE} items={flowers} />
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
  const gap = THREE.MathUtils.degToRad(item.gapDeg ?? 0)
  const { posts, rails, locks } = useMemo(() => {
    const random = seeded(hashString(item.id))
    const posts = []
    const rails = []
    const locks = []
    const arc = Math.PI * 2 - gap
    const n = Math.max(3, Math.round((arc * radius) / 1.0))
    const angle = (k) => gap / 2 + (arc * k) / n
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
    return { posts, rails, locks }
  }, [item.id, radius, gap, h])
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
      <Box p={[0, h / 2, 0]} s={[w, h, d]} c="#9a6b45" />
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
  const count = Math.max(2, Math.floor(w / 3.6))
  const xs = range(count).map((i) => -w / 2 + (w * (i + 0.5)) / count)
  const { tables, chairs, posts } = useMemo(
    () => ({
      tables: xs.map((x) => ({ p: [x, h + 0.72, 0], s: [0.45, 0.05, 0.45] })),
      chairs: xs.flatMap((x) => [-0.75, 0.75].map((o) => ({ p: [x + o, h + 0.45, 0], s: [0.4, 0.06, 0.4] }))),
      posts: range(Math.round(w) + 1).map((i) => ({ p: [-w / 2 + (w * i) / Math.round(w), h + 0.25, d / 2 - 0.05], s: [0.05, 0.5, 0.05] })),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [w, h, d],
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
  const display = item.display ?? 'none'
  const brickH = 2.6

  const brickTexture = useMemo(() => (item.brick ? getTiledTexture('brick', inW / 1.2, brickH / 1.2) : null), [item.brick, inW])

  const { posts, goods, bulbs } = useMemo(() => {
    const posts = [-inW / 2, -inW / 6, inW / 6, inW / 2].flatMap((x) =>
      [front, -front].map((z) => ({ p: [x, (base + wallTop) / 2, z], s: [0.22, wallTop - base, 0.22] })),
    )
    const random = seeded(hashString(item.id))
    const goods = []
    if (display !== 'none') {
      for (const y of [base + 0.75, base + 1.35]) {
        for (let i = 0; i < 6; i++) {
          const x = -w * 0.12 - inW * 0.25 + (inW * 0.5 * (i + 0.5)) / 6
          const c = display === 'cake' ? ['#fbcfe8', '#fff7ed', '#f9a8d4', '#a16207'][Math.floor(random() * 4)] : FLOWER_COLORS[Math.floor(random() * FLOWER_COLORS.length)]
          goods.push({ p: [x, y, front + 0.14], s: display === 'cake' ? [0.14, 0.16, 0.14] : [0.13, 0.13, 0.13], c })
        }
      }
    }
    const bulbs = item.stringLights ? bulbLine([-w / 2, wallTop - 0.15, front + 0.55], [w / 2, wallTop - 0.15, front + 0.55], 14) : []
    return { posts, goods, bulbs }
  }, [item.id, item.stringLights, display, w, inW, front, wallTop])

  return (
    <group>
      <Box p={[0, base / 2, 0]} s={[w, base, d]} c={STONE} />
      {item.brick ? (
        <>
          <mesh geometry={GEO.box} material={texMat(brickTexture)} position={[0, base + brickH / 2, 0]} scale={[inW, brickH, inD]} />
          <Box p={[0, (base + brickH + wallTop) / 2, 0]} s={[inW, wallTop - base - brickH, inD]} c={wallColor} />
        </>
      ) : (
        <Box p={[0, (base + wallTop) / 2, 0]} s={[inW, wallTop - base, inD]} c={wallColor} />
      )}
      <Instances geometry={GEO.box} material={mat(WOOD)} items={posts} castShadow />
      <Box p={[0, wallTop - 0.15, front]} s={[inW + 0.3, 0.3, 0.3]} c={WOOD} />
      {/* 진열창 + 문 */}
      <Box p={[-w * 0.12, base + 1.25, front + 0.03]} s={[inW * 0.58, 1.8, 0.08]} m={WARM_GLASS} userData={NO_SHADOW} />
      <Box p={[inW / 2 - 0.85, base + 1.1, front + 0.04]} s={[1, 2.2, 0.08]} c="#6b4a2f" />
      <Box p={[inW / 2 - 0.85, base + 1.6, front + 0.09]} s={[0.6, 0.7, 0.02]} m={WARM_GLASS} userData={NO_SHADOW} />
      <Instances geometry={display === 'cake' ? GEO.cyl : GEO.ico} material={TINTABLE} items={goods} />
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
          <meshStandardMaterial map={getSignTexture(sign.text, sign.bg, sign.fg)} />
        </mesh>
      )}
      <Instances geometry={GEO.sphere} material={BULB} items={bulbs} />
      <HanokRoof w={w + 1.4} d={d + 1.4} y={wallTop - 0.05} h={roofH} />
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
      <Box p={[0, bodyH / 2, 0]} s={[w, bodyH, d]} c={item.color ?? '#f3ede3'} />
      <Box p={[0, 0.3, 0]} s={[w + 0.06, 0.6, d + 0.06]} c="#4b4440" />
      <Box p={[0, 1.75, front + 0.04]} s={[w - 1, 2.3, 0.08]} m={WARM_GLASS} userData={NO_SHADOW} />
      <mesh geometry={awningGeometry} material={ROOF_MAT} position={[0, 3.2, front + 0.35]} />
      {sign && (
        <mesh position={[0, 4.25, front + 0.05]} userData={NO_SHADOW}>
          <planeGeometry args={[w * 0.5, 0.55]} />
          <meshStandardMaterial map={getSignTexture(sign.text, sign.bg, sign.fg)} />
        </mesh>
      )}
      <Box p={[0, bodyH - 1.5, front + 0.04]} s={[w - 1.2, 1.4, 0.08]} m={WARM_GLASS} userData={NO_SHADOW} />
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
    </group>
  )
}

// ── 날개 벽화 벽 (빛나는 네온 날개) ────────────
export function NeonWings({ item }) {
  const [w, h, d] = item.size
  const capH = 0.5
  const wallH = h - capH
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
        material={texMat(getNeonWingsTexture(), { emissive: '#ffffff', emissiveIntensity: 1.4, transparent: true })}
        position={[0, wallH * 0.55, d / 2 + 0.03]}
        scale={[w * 0.75, w * 0.375, 1]}
        userData={NO_SHADOW}
      />
      {[-1, 1].map((side) => (
        <Box key={side} p={[side * w * 0.32, 0.25, d / 2 + 0.35]} s={[2.4, 0.5, 0.6]} c="#9a6b45" />
      ))}
      <Instances geometry={GEO.ico} material={TINTABLE} items={flowers} />
      <Instances geometry={GEO.box} material={mat('#6aa857', { flat: true })} items={vines} />
    </group>
  )
}
