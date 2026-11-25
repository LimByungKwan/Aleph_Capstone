import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { Box, GEO, Instances, mat, texMat } from '../kit.jsx'
import { getSignTexture } from '../textures.js'
import {
  getAshlarTexture,
  getDancheongTexture,
  getLatticeTexture,
  getRailPanelTexture,
  getBrickBandTexture,
  getGreenWindowTexture,
  getOctagonWindowTexture,
  getPinkPanelTexture,
  getSagwaeTexture,
  getRoofTileTexture,
  getTransomLatticeTexture,
} from './hjTextures.js'
import HjPalaceInterior from './HjPalaceInterior.jsx'
import HallFurniture from './HjHallFurniture.jsx'
import { getCofferCeilingTexture, getMaruTexture, getMatFloorTexture } from './hjTextures.js'

// [3. 개발 > 프론트엔드] 조선 궁궐 전각 부품 (혜진 영화·드라마 구역 · 경복궁)
// 실제 목조 건축 순서대로 쌓아요 (아래 → 위):
//   기단(장대석) → 주춧돌 → 둥근 기둥 → 창호(띠살문·머름·교창) → 창방(단청) → 평방 → 공포(다포)
//   → 서까래·부연 → 기와지붕(팔작·우진각·맞배, 용마루·추녀마루·잡상·취두, 합각)
// 모든 전각은 앞이 -z 쪽이에요 (광화문 쪽을 바라봄). 큰 반복 부품은 Instances 로 한 번에 그려요.

const RED = '#8c382b'
const GREEN = '#2f6b58'
const GREEN_LIGHT = '#3f7d6a'
const BLUE = '#2a4f8a'
const VERMILION = '#c8423a'
const STONE = '#cbc3b0'
const STONE_LIGHT = '#ddd6c5'
const PLASTER = '#efe7d4'
const PARTS = mat('#ffffff', { roughness: 0.88 })
const GEO_COL = new THREE.CylinderGeometry(1, 1, 1, 12)
export const GEO_COL12 = GEO_COL
export const GEO_HEX = new THREE.CylinderGeometry(1, 1, 1, 6)

// 색 묶음: 단청 칠한 궁궐(PAINT) · 칠하지 않은 나무색 백골집(WOOD, 건청궁 같은 사대부집 양식)
const PAINT = { col: RED, frame: RED, b1: GREEN_LIGHT, b2: GREEN, b3: BLUE, tip: VERMILION, soffit: GREEN, r1: GREEN, r2: GREEN_LIGHT, r3: '#24503f', r4: '#2b5d4a' }
const WOOD = { col: '#8a6446', frame: '#7a573c', b1: '#9a7452', b2: '#8a6446', b3: '#7d5a3e', tip: '#6e4f36', soffit: '#a5815c', r1: '#8f6b4b', r2: '#9b7756', r3: '#a07b58', r4: '#8a6446' }
const TIMBER = mat(RED, { roughness: 0.8 })

// ── 텍스처 재질 (길이마다 반복 수가 달라서 복제본을 캐시) ──
const repeatCache = new Map()
function repeated(base, key, rx, ry = 1) {
  if (!base) return null
  const k = `${key}|${rx.toFixed(1)}|${ry.toFixed(1)}`
  let t = repeatCache.get(k)
  if (!t) {
    t = base.clone()
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    t.repeat.set(rx, ry)
    t.needsUpdate = true
    repeatCache.set(k, t)
  }
  return t
}
const texOr = (tex, color, opts) => (tex ? texMat(tex, opts) : mat(color))
export const dancheongMat = (len) => texOr(repeated(getDancheongTexture(), 'dc', Math.max(1, Math.round(len / 2))), GREEN)
export const ashlarMat = (len, h = 0.5) => texOr(repeated(getAshlarTexture(), 'as', Math.max(1, Math.round(len / 3)), Math.max(1, Math.round(h / 0.5))), STONE)
// 창살 재질. kind: tti 띠살 · bit 빗살 · jeongja 정자살 · fret 번개살(경회루)
export const latticeMat = (kind = 'tti', bar, frame) =>
  texOr(getLatticeTexture(kind, bar, frame), '#e9dfc8', { emissive: '#ffcf8a', emissiveIntensity: 0.18 })
// 벽 재질 (사진 기반 무늬 — hjTextures.js)
const WALL_TEX = {
  sagwae: [getSagwaeTexture, '#d8d0bd'],
  band: [getBrickBandTexture, '#55595d'],
  pink: [getPinkPanelTexture, '#e39a86'],
  window: [getGreenWindowTexture, '#3f8a6a'],
  octagon: [getOctagonWindowTexture, '#e39a86'],
}
export const wallMat = (kind) => texOr(WALL_TEX[kind][0](), WALL_TEX[kind][1])
const transomMat = () => texOr(repeated(getTransomLatticeTexture(), 'tr', 2), '#e9dfc8', { emissive: '#ffcf8a', emissiveIntensity: 0.15 })
let roofMaterial = null
function roofMat() {
  if (roofMaterial) return roofMaterial
  const tile = getRoofTileTexture()
  roofMaterial = tile
    ? new THREE.MeshStandardMaterial({ map: tile, side: THREE.DoubleSide, roughness: 0.86 })
    : new THREE.MeshStandardMaterial({ color: '#4d575e', side: THREE.DoubleSide, roughness: 0.86 })
  return roofMaterial
}

// 두 점 사이를 잇는 길쭉한 상자 (마루·난간대). 상자의 긴 축은 x
function beam(a, b, thick, tall, c) {
  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  const dz = b[2] - a[2]
  const len = Math.hypot(dx, dy, dz)
  return {
    p: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2],
    s: [len, tall, thick],
    r: [0, Math.atan2(-dz, dx), Math.atan2(dy, Math.hypot(dx, dz))],
    c,
  }
}

// ── 기와지붕 ──────────────────────────────────────
// type: 'hipgable' 팔작(옆에 세모난 합각) · 'hip' 우진각(네 면 모두 비탈) · 'gable' 맞배(앞뒤 두 면)
const ROOF_P = 1.45 // 지붕면이 오목하게 휘는 정도
export function roofShape(W, D, type) {
  const a = Math.min(0.85, Math.max(0.15, 1 - D / W)) // 옆 비탈 기울기를 앞 비탈과 비슷하게
  const gb = 0.45 // 팔작지붕 합각 아래 끝 높이(비율)
  const xg = type === 'hipgable' ? 1 - gb * (1 - a) : type === 'gable' ? 1 : a
  return { a, gb, xg }
}
function roofBase(ax, az, type, a, gb) {
  if (type === 'gable') return 1 - az
  if (type === 'hip') return 1 - Math.max(az, (ax - a) / (1 - a))
  const end = (1 - ax) / (1 - a)
  return end >= gb - 1e-6 ? 1 - az : Math.min(1 - az, end)
}
// 처마 끝이 버선코처럼 들리는 양 (네 귀퉁이에서 가장 많이)
function eaveLift(ax, az, type, rise) {
  const k = type === 'gable' ? 0.05 : 0.3
  return rise * (k * Math.pow(ax * az, 5) + 0.04 * Math.pow(ax, 4) * Math.pow(az, 10))
}
function roofHeightAt(x, z, rise, type, a, gb) {
  const ax = Math.min(1, Math.abs(x))
  const az = Math.min(1, Math.abs(z))
  return rise * Math.pow(Math.max(0, roofBase(ax, az, type, a, gb)), ROOF_P) + eaveLift(ax, az, type, rise)
}

function buildRoof(W, D, rise, type) {
  const { a, gb, xg } = roofShape(W, D, type)
  const nx = Math.max(10, Math.ceil(W * 2.4))
  const nz = Math.max(4, Math.ceil(D * 1.2))
  const xs = new Set()
  for (let i = 0; i <= nx; i += 1) xs.add(Number((-1 + (2 * i) / nx).toFixed(5)))
  const cut = type === 'hipgable' ? xg : null
  if (cut) for (const s of [-1, 1]) { xs.add(s * (cut - 1e-4)); xs.add(s * (cut + 1e-4)) }
  if (type === 'hip') for (const s of [-1, 1]) xs.add(s * a)
  const xl = [...xs].sort((p, q) => p - q)
  const zl = []
  for (let j = 0; j <= nz * 2; j += 1) zl.push(-1 + j / nz)
  const pos = []
  const uv = []
  const idx = []
  for (const z of zl) {
    for (const x of xl) {
      const X = (x * W) / 2
      const Z = (z * D) / 2
      pos.push(X, roofHeightAt(x, z, rise, type, a, gb), Z)
      uv.push(X / 0.42, Z / 0.5)
    }
  }
  const cols = xl.length
  for (let j = 1; j < zl.length; j += 1) {
    for (let i = 1; i < cols; i += 1) {
      // 팔작지붕의 합각 자리(수직으로 꺾이는 좁은 틈)는 비워 두고 합각 판으로 막아요
      if (cut && Math.abs(Math.abs(xl[i - 1] + xl[i]) / 2 - cut) < 2e-4) continue
      const p = j * cols + i
      const q = p - cols
      idx.push(q - 1, p - 1, q, q, p - 1, p)
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  g.setIndex(idx)
  g.computeVertexNormals()
  return g
}

// 합각(팔작지붕 옆 세모 벽) 또는 맞배지붕 박공 벽
function gableGeometry(W, D, rise, type) {
  const { gb } = roofShape(W, D, type)
  const foot = type === 'gable' ? 0 : gb
  const zf = 1 - foot // 정규화
  const yb = rise * Math.pow(foot, ROOF_P)
  const shape = new THREE.Shape()
  const n = 14
  shape.moveTo((-zf * D) / 2, yb)
  for (let i = 0; i <= n; i += 1) {
    const z = -zf + (2 * zf * i) / n
    shape.lineTo((z * D) / 2, rise * Math.pow(1 - Math.abs(z), ROOF_P) - 0.03)
  }
  shape.lineTo((zf * D) / 2, yb)
  shape.closePath()
  return new THREE.ShapeGeometry(shape)
}

export function HanokRoof({ width: W, depth: D, rise, type = 'hipgable', y = 0, ridge = true, japsang = 0, gableInset = 0, plain = false }) {
  const pal = plain ? WOOD : PAINT
  const geometry = useMemo(() => buildRoof(W, D, rise, type), [W, D, rise, type])
  const gable = useMemo(() => (type === 'hip' ? null : gableGeometry(W, D, rise, type)), [W, D, rise, type])
  useEffect(() => () => { geometry.dispose(); gable?.dispose() }, [geometry, gable])
  const { boxes, rafters, gableX } = useMemo(() => {
    const { a, gb, xg } = roofShape(W, D, type)
    const h = (x, z) => roofHeightAt(x, z, rise, type, a, gb)
    const k = Math.min(1.3, Math.max(0.5, rise / 2.4)) // 마루 굵기
    const list = []
    const tiles = []
    // 용마루 (양성바름 흰 줄 + 검은 기와 덮개) + 양 끝 취두
    const half = (type === 'gable' ? 1 : xg) * (W / 2) - (type === 'gable' ? 0.1 : 0)
    if (ridge) {
      list.push({ p: [0, rise + 0.1 * k, 0], s: [half * 2, 0.26 * k, 0.34 * k], c: '#dcd6c8' })
      list.push({ p: [0, rise + 0.26 * k, 0], s: [half * 2 + 0.12, 0.09 * k, 0.24 * k], c: '#40474d' })
      for (const s of [-1, 1]) {
        list.push({ p: [s * half, rise + 0.34 * k, 0], s: [0.34 * k, 0.62 * k, 0.42 * k], c: '#3a4146' })
        list.push({ p: [s * (half - 0.12 * k), rise + 0.7 * k, 0], s: [0.12 * k, 0.16 * k, 0.3 * k], c: '#3a4146' })
      }
    } else {
      // 무량각(강녕전·교태전): 용마루 없이 둥근 곡와로 덮어요
      list.push({ p: [0, rise + 0.02, 0], s: [half * 2, 0.12, 0.55], c: '#4a5258' })
    }
    // 추녀마루 (지붕 네 귀로 내려가는 마루) + 잡상
    if (type !== 'gable') {
      for (const sx of [-1, 1]) {
        for (const sz of [-1, 1]) {
          const from = type === 'hip' ? [a, 0] : [xg, 1 - gb]
          const pts = []
          for (let t = 0; t <= 3; t += 1) {
            const nxp = from[0] + ((1 - from[0]) * t) / 3
            const nzp = from[1] + ((1 - from[1]) * t) / 3
            const fx = Math.min(nxp, 0.985)
            const fz = Math.min(nzp, 0.985)
            pts.push([(sx * fx * W) / 2, h(fx, fz) + 0.07 * k, (sz * fz * D) / 2])
          }
          for (let t = 1; t < pts.length; t += 1) {
            list.push(beam(pts[t - 1], pts[t], 0.22 * k, 0.2 * k, '#d6d0c2'))
            const top = beam(pts[t - 1], pts[t], 0.15 * k, 0.08 * k, '#40474d')
            top.p[1] += 0.12 * k
            list.push(top)
          }
          // 잡상: 추녀마루 아래쪽에 줄지어 앉은 작은 토우
          for (let i = 0; i < japsang; i += 1) {
            const t = 0.55 + (0.35 * i) / Math.max(1, japsang - 1)
            const nxp = from[0] + (1 - from[0]) * t
            const nzp = from[1] + (1 - from[1]) * t
            list.push({ p: [(sx * nxp * W) / 2, h(nxp, nzp) + 0.27 * k, (sz * nzp * D) / 2], s: [0.1 * k, 0.17 * k, 0.12 * k], c: '#5a5f62' })
          }
        }
      }
    }
    // 내림마루 (합각·박공 위 가장자리를 따라)
    const gx = type === 'gable' ? W / 2 - gableInset : (xg * W) / 2
    if (type !== 'hip') {
      const foot = type === 'gable' ? 0 : gb
      for (const sx of [-1, 1]) {
        for (const sz of [-1, 1]) {
          const pts = []
          for (let t = 0; t <= 3; t += 1) {
            const nzp = ((1 - foot) * t) / 3
            pts.push([sx * (gx + 0.04), rise * Math.pow(1 - nzp, ROOF_P) + 0.02, (sz * nzp * D) / 2])
          }
          for (let t = 1; t < pts.length; t += 1) list.push(beam(pts[t - 1], pts[t], 0.14 * k, 0.16 * k, '#2c3236'))
        }
      }
    }
    // 서까래(둥근) + 부연(네모): 처마 끝을 따라 촘촘히
    const step = 0.3
    const addEdge = (alongX, sOut) => {
      const len = alongX ? W : D
      const n = Math.floor((len - 0.6) / step)
      for (let i = 0; i <= n; i += 1) {
        const u = -len / 2 + 0.3 + i * step
        const nx = alongX ? (2 * u) / W : sOut
        const nz = alongX ? sOut : (2 * u) / D
        if (type === 'gable' && !alongX) continue
        const y = h(nx, nz) - 0.07
        if (alongX) {
          tiles.push({ p: [u, y, sOut * (D / 2 - 0.16)], s: [0.06, 0.36, 0.06], r: [Math.PI / 2, 0, 0], c: i % 2 ? pal.r1 : pal.r2 })
          if (!plain) tiles.push({ p: [u, y, sOut * (D / 2 + 0.025)], s: [0.064, 0.012, 0.064], r: [Math.PI / 2, 0, 0], c: i % 2 ? '#ef8f70' : '#f2b24c' })
          list.push({ p: [u, y + 0.08, sOut * (D / 2 - 0.05)], s: [0.08, 0.07, 0.26], c: i % 2 ? pal.r3 : pal.r4 })
        } else {
          tiles.push({ p: [sOut * (W / 2 - 0.16), y, u], s: [0.06, 0.36, 0.06], r: [0, 0, Math.PI / 2], c: i % 2 ? pal.r1 : pal.r2 })
          if (!plain) tiles.push({ p: [sOut * (W / 2 + 0.025), y, u], s: [0.064, 0.012, 0.064], r: [0, 0, Math.PI / 2], c: i % 2 ? '#ef8f70' : '#f2b24c' })
          list.push({ p: [sOut * (W / 2 - 0.05), y + 0.08, u], s: [0.26, 0.07, 0.08], c: i % 2 ? pal.r3 : pal.r4 })
        }
      }
    }
    addEdge(true, -1)
    addEdge(true, 1)
    if (type !== 'gable') {
      addEdge(false, -1)
      addEdge(false, 1)
    }
    return { boxes: list, rafters: tiles, gableX: gx }
  }, [W, D, rise, type, ridge, japsang, gableInset, pal, plain])
  return (
    <group position-y={y}>
      <mesh geometry={geometry} material={roofMat()} castShadow />
      {/* 처마 안쪽 (초록 단청 반자) */}
      <Box p={[0, -0.1, 0]} s={[W * 0.95, 0.06, D * 0.9]} c={pal.soffit} />
      <Instances geometry={GEO.box} material={PARTS} items={boxes} />
      <Instances geometry={GEO.cyl8} material={PARTS} items={rafters} />
      {gable &&
        [-1, 1].map((s) => (
          <mesh key={s} geometry={gable} position={[s * (gableX + 0.02), 0, 0]} rotation-y={Math.PI / 2} material={mat('#7e3b2e', { double: true })} />
        ))}
    </group>
  )
}

// ── 공포(다포): 기둥 위·사이에 층층이 내민 나무 받침 ──
function bracketItems(list, x, z, yb, out, alongX, ornate, pal = PAINT) {
  const S = (sx, sy, sz) => (alongX ? [sx, sy, sz] : [sz, sy, sx])
  const P = (ox, oy, oz) => (alongX ? [x + ox, yb + oy, z + oz] : [x + oz, yb + oy, z + ox])
  list.push({ p: P(0, 0.06, 0), s: S(0.24, 0.12, 0.24), c: pal.b1 })
  list.push({ p: P(0, 0.16, 0), s: S(0.56, 0.09, 0.13), c: pal.b2 })
  list.push({ p: P(0, 0.16, out * 0.16), s: S(0.12, 0.09, 0.5), c: pal.b3 })
  if (!ornate) return
  list.push({ p: P(0, 0.26, 0), s: S(0.82, 0.09, 0.13), c: pal.b1 })
  list.push({ p: P(0, 0.26, out * 0.27), s: S(0.12, 0.09, 0.76), c: pal.b2 })
  list.push({ p: P(0, 0.26, out * 0.66), s: S(0.13, 0.1, 0.1), c: pal.tip })
  list.push({ p: P(0, 0.36, 0), s: S(1.02, 0.09, 0.13), c: pal.b3 })
  list.push({ p: P(0, 0.36, out * 0.38), s: S(0.12, 0.09, 0.98), c: pal.b1 })
}

// ── 전각 한 채 ─────────────────────────────────────
// mode: 'closed' 닫힌 전각(앞 띠살문·옆뒤 회벽) · 'open' 기둥만(누각·문루) · 'gate' 대문(가운데 칸 판문)
//       'corridor' 행각(가운데 벽, 양쪽 기둥) · 'interior' 근정전처럼 실내가 따로 있는 전각(앞 창호만, 문 자리 비움)
export function HanokHall({
  position = [0, 0, 0],
  rotation = 0,
  width,
  depth,
  height,
  bays,
  sideBays,
  base = 0.45,
  mode = 'closed',
  roof = 'hipgable',
  upper = false,
  ridge = true,
  woldae = 0,
  title,
  japsang = 0,
  ornate = true,
  doorWidth = 0,
  facade, // interior 모드: 실내 벽 바깥 면 {x, zFront, zBack}
  lattice = 'tti', // 정면 창살 무늬
  plain = false, // true: 단청 없는 나무색 백골집
  nakyang = false, // true: 칸마다 위쪽에 낙양각(초록 테 장식) — 경회루처럼 열린 누각
  enterable = false, // true: 가운데 칸 문을 열어 두고 안에 마루·천장·살림을 채워요 (closed 모드)
  furnish = 'room', // 실내 살림: throne 편전 · room 침전 · kitchen 소주방
  doorClosed = false, // true면 가운데 문짝 두 짝을 닫아요 (E로 열고 닫기, 닫히면 못 지나가요)
  allWindows = false, // true면 옆·뒤 벽도 회벽 대신 창호 (사정전)
  latticeBar, // 창살 색 (없으면 기본)
  merumColor = '#ebe2cd', // 머름(창 아래 판벽) 색 — 사정전은 초록
}) {
  const pal = plain ? WOOD : PAINT
  const nb = bays ?? Math.max(3, Math.round(width / 2.2) | 1)
  const ns = sideBays ?? Math.max(2, Math.round(depth / 2.1))
  const colR = 0.11 + height * 0.016
  const W2 = width / 2 - 0.1
  const D2 = depth / 2 - 0.1
  const y0 = base
  const bh = ornate ? 0.5 : 0.3 // 공포 높이
  const ov = Math.min(1.7, Math.max(0.75, depth * 0.2 + 0.25)) // 처마 내민 길이
  const RW = 2 * W2 + 2 * ov
  const RD = 2 * D2 + 2 * ov
  const rise = RD * (upper ? 0.2 : 0.26)
  const roofY = y0 + height + bh
  const xsF = Array.from({ length: nb + 1 }, (_, i) => -W2 + (i * 2 * W2) / nb)
  const zsS = Array.from({ length: ns + 1 }, (_, j) => -D2 + (j * 2 * D2) / ns)
  // 위층 (2층 전각·문루)
  const Wu = width * 0.72
  const Du = depth * 0.66
  const hu = height * 0.42
  const yU0 = roofY + rise * 0.34
  const ovU = ov * 0.9
  const RWu = Wu - 0.2 + 2 * ovU
  const RDu = Du - 0.2 + 2 * ovU

  const parts = useMemo(() => {
    const cols = []
    const box = []
    const lattice = []
    const transom = []
    const stone = [] // 사괘석 화방벽
    const band = [] // 전돌 띠
    const pinkPanels = [] // 분홍 판벽
    const windowPanels = [] // 초록 창
    const octPanels = [] // 팔각 교창
    const addColumn = (x, z, y, hgt, r = colR) => {
      cols.push({ p: [x, y + hgt / 2, z], s: [r, hgt, r], c: pal.col })
      box.push({ p: [x, y + 0.07, z], s: [r * 2.7, 0.14, r * 2.7], c: STONE })
    }
    // 기둥
    const colPts = []
    for (const z of [-D2, D2]) for (const x of xsF) colPts.push([x, z])
    if (mode !== 'corridor') for (const x of [-W2, W2]) for (const z of zsS.slice(1, -1)) colPts.push([x, z])
    if (mode === 'gate') for (const x of xsF) colPts.push([x, 0])
    for (const [x, z] of colPts) addColumn(x, z, y0, height)

    const doorTop = height * 0.72
    const transTop = height * 0.86
    // 창호 한 칸 채우기 (고정 좌표, 칸 가운데, 칸 너비, 문인지). alongX=false면 옆벽(x 고정, z 방향)
    //  문: 바닥까지 긴 문짝 / 창: 아래 머름(판벽) + 위 창, 그 위 교창(빗살) + 회벽 + 인방(가로 틀)
    const fillFront = (z, xc, bw, door, yBase = y0, alongX = true) => {
      const P = (u, y, d = 0) => (alongX ? [u, y, z + d] : [z + d, y, u])
      const Sz = (l, h, t) => (alongX ? [l, h, t] : [t, h, l])
      const inward = alongX ? (z < 0 ? 1 : -1) : z < 0 ? 1 : -1
      const panelH = door ? doorTop - 0.08 : (doorTop - 0.08) * 0.68
      const mh = door ? 0 : doorTop - 0.08 - panelH
      const n = bw > 2.2 ? 4 : bw > 1.2 ? 3 : 2
      for (let i = 0; i < n; i += 1) {
        const pu = xc - bw / 2 + ((i + 0.5) * bw) / n
        lattice.push({ p: P(pu, yBase + 0.08 + mh + panelH / 2), s: Sz(bw / n - 0.02, panelH, 0.05) })
      }
      if (mh > 0) {
        // 머름: 창 아래 낮은 판벽 (판 + 틀 + 머름동자)
        box.push({ p: P(xc, yBase + 0.08 + mh / 2), s: Sz(bw, mh, 0.08), c: merumColor })
        for (let i = 1; i < 4; i += 1) box.push({ p: P(xc - bw / 2 + (i * bw) / 4, yBase + 0.08 + mh / 2, -0.05 * inward), s: Sz(0.06, mh, 0.03), c: pal.frame })
      }
      transom.push({ p: P(xc, yBase + (doorTop + transTop) / 2), s: Sz(bw, transTop - doorTop - 0.06, 0.05) })
      box.push({ p: P(xc, yBase + (transTop + height - 0.26) / 2), s: Sz(bw, height - 0.26 - transTop, 0.1), c: PLASTER })
      for (const yy of [0.08, doorTop, transTop]) box.push({ p: P(xc, yBase + yy, -0.02 * inward), s: Sz(bw, 0.09, 0.13), c: pal.frame })
    }
    // 벽 한 칸 (사진 기반): 아래 사괘석 화방벽(네모 화강석 + 흰 줄눈) → 어두운 전돌 띠 → 위 분홍 판벽·초록 창·팔각 교창
    //  upper: 'panel' 분홍 판벽 · 'window' 초록 창 두 짝 · 'octagon' 팔각 빗살 교창
    const fillWall = (x, z, len, alongX, hgt = height, upper = 'panel') => {
      const S = (l, h, t) => (alongX ? [l, h, t] : [t, h, l])
      const stoneH = hgt * 0.5
      const bandH = 0.13
      const upY0 = y0 + 0.08 + stoneH + bandH
      const upH = hgt - 0.3 - (upY0 - y0)
      stone.push({ p: [x, y0 + 0.08 + stoneH / 2, z], s: S(len, stoneH, 0.24) })
      band.push({ p: [x, y0 + 0.08 + stoneH + bandH / 2, z], s: S(len, bandH, 0.22) })
      const list = upper === 'window' ? windowPanels : upper === 'octagon' ? octPanels : pinkPanels
      list.push({ p: [x, upY0 + upH / 2, z], s: S(len, upH, 0.16) })
      box.push({ p: [x, y0 + 0.04, z], s: S(len + 0.04, 0.08, 0.28), c: '#cfc7b4' }) // 받침 장대석
      // 위 판벽 아래·위 붉은 인방
      for (const yy of [upY0, y0 + hgt - 0.3]) box.push({ p: [x, yy, z], s: S(len, 0.09, 0.2), c: pal.frame })
    }
    if (mode === 'closed') {
      const doorBays = nb >= 5 ? 3 : nb
      xsF.slice(0, -1).forEach((x, i) => {
        const bw = xsF[i + 1] - x - colR * 2
        const xc = x + (xsF[i + 1] - x) / 2
        const door = Math.abs(i - (nb - 1) / 2) < doorBays / 2
        if (enterable && i === (nb - 1) / 2) {
          // 들어가는 문: 문지방 + 안쪽으로 활짝 열어 접어 둔 문짝 두 짝 + 위 교창·회벽은 그대로
          box.push({ p: [xc, y0 + 0.04, -D2], s: [bw, 0.08, 0.16], c: pal.frame })
          for (const sgn of [-1, 1]) {
            if (doorClosed) {
              // 닫힌 문: 두 짝이 문틀 안을 가득 막아요 (가운데 문고리)
              lattice.push({ p: [xc + sgn * (bw / 4), y0 + 0.08 + (doorTop - 0.08) / 2, -D2], s: [bw / 2 - 0.02, doorTop - 0.08, 0.05] })
              box.push({ p: [xc + sgn * 0.07, y0 + doorTop * 0.5, -D2 - 0.05], s: [0.04, 0.12, 0.04], c: '#3a3028' })
            } else {
              lattice.push({ p: [xc + sgn * (bw / 2 - 0.04), y0 + 0.08 + (doorTop - 0.08) / 2, -D2 + bw / 4 + 0.05], s: [0.05, doorTop - 0.08, bw / 2 - 0.06] })
            }
          }
          transom.push({ p: [xc, y0 + (doorTop + transTop) / 2, -D2], s: [bw, transTop - doorTop - 0.06, 0.05] })
          box.push({ p: [xc, y0 + (transTop + height - 0.26) / 2, -D2], s: [bw, height - 0.26 - transTop, 0.1], c: PLASTER })
          for (const yy of [doorTop, transTop]) box.push({ p: [xc, y0 + yy, -D2 - 0.02], s: [bw, 0.09, 0.13], c: pal.frame })
          return
        }
        fillFront(-D2, xc, bw, door)
      })
      if (allWindows) {
        // 사방 창호 (사정전처럼 네 벽이 모두 창)
        xsF.slice(0, -1).forEach((x, i) => fillFront(D2, x + (xsF[i + 1] - x) / 2, xsF[i + 1] - x - colR * 2, false))
        for (const sx of [-W2, W2]) zsS.slice(0, -1).forEach((z, j) => fillFront(sx, z + (zsS[j + 1] - z) / 2, zsS[j + 1] - z - colR * 2, false, y0, false))
      } else {
        xsF.slice(0, -1).forEach((x, i) => fillWall(x + (xsF[i + 1] - x) / 2, D2, xsF[i + 1] - x - colR * 2, true, height, i % 2 ? 'panel' : 'window'))
        for (const sx of [-W2, W2]) zsS.slice(0, -1).forEach((z, j) => fillWall(sx, z + (zsS[j + 1] - z) / 2, zsS[j + 1] - z - colR * 2, false))
      }
    }
    if (mode === 'interior' && facade) {
      // 근정전: 실내 벽 바로 바깥에 창호를 덧대요 (가운데 문 자리 비움)
      const { x: fx, zFront, zBack } = facade
      const half = doorWidth / 2
      for (const side of [-1, 1]) {
        const span = fx - half
        const n = Math.max(1, Math.round(span / 2.2))
        for (let i = 0; i < n; i += 1) {
          const bw = span / n
          fillFront(zFront - 0.04, side * (half + bw * (i + 0.5)), bw - 0.06, true)
        }
      }
      fillWall(0, zBack + 0.05, fx * 2, true, 3.44)
      for (const sx of [-1, 1]) fillWall(sx * (fx + 0.05), (zFront + zBack) / 2, zBack - zFront, false, 3.44)
    }
    if (mode === 'corridor') {
      xsF.slice(0, -1).forEach((x, i) => fillWall(x + (xsF[i + 1] - x) / 2, 0, xsF[i + 1] - x - colR * 2, true, height, ['window', 'panel', 'octagon'][i % 3]))
    }
    if (mode === 'gate') {
      // 가운데 칸 판문 (열어서 기둥 쪽으로 접어 둔 모습)
      xsF.slice(0, -1).forEach((x, i) => {
        if (Math.abs(i - (nb - 1) / 2) > 0.6) {
          fillWall(x + (xsF[i + 1] - x) / 2, 0, xsF[i + 1] - x - colR * 2, true)
          return
        }
        const bw = xsF[i + 1] - x - colR * 2
        for (const s of [-1, 1]) {
          box.push({ p: [x + (xsF[i + 1] - x) / 2 + s * (bw / 2 - 0.05), y0 + (height * 0.8) / 2, -bw / 4], s: [0.08, height * 0.8, bw / 2], c: '#9a3f30' })
        }
      })
    }

    // 창방(단청 띠)·평방은 따로 그리고, 여기서는 공포
    const yb = y0 + height + 0.07
    const per = ornate ? 2 : 0
    const line = (xs, z, out, alongX) => {
      xs.forEach((x, i) => {
        bracketItems(box, alongX ? x : z, alongX ? z : x, yb, out, alongX, ornate, pal)
        if (i < xs.length - 1) {
          for (let k = 1; k <= per; k += 1) {
            const xm = x + ((xs[i + 1] - x) * k) / (per + 1)
            bracketItems(box, alongX ? xm : z, alongX ? z : xm, yb, out, alongX, ornate, pal)
          }
        }
      })
    }
    line(xsF, -D2, -1, true)
    line(xsF, D2, 1, true)
    line(zsS, -W2, -1, false)
    line(zsS, W2, 1, false)
    // 공포 위 도리
    box.push({ p: [0, roofY - 0.08, -D2], s: [W2 * 2 + 0.6, 0.14, 0.26], c: pal.b2 })
    box.push({ p: [0, roofY - 0.08, D2], s: [W2 * 2 + 0.6, 0.14, 0.26], c: pal.b2 })
    box.push({ p: [-W2, roofY - 0.08, 0], s: [0.26, 0.14, D2 * 2 + 0.6], c: pal.b2 })
    box.push({ p: [W2, roofY - 0.08, 0], s: [0.26, 0.14, D2 * 2 + 0.6], c: pal.b2 })
    // 낙양각: 열린 칸 위쪽 네 귀에 드리운 초록 테 장식 (흰 테두리)
    if (nakyang) {
      const top = y0 + height - 0.26
      const deco = (a, b, z, alongX) => {
        const len = b - a - colR * 2
        const mid = (a + b) / 2
        const P = (u, y, d = 0) => (alongX ? [mid + u, y, z + d] : [z + d, y, mid + u])
        const S = (l, h, t) => (alongX ? [l, h, t] : [t, h, l])
        box.push({ p: P(0, top - 0.08, 0), s: S(len, 0.14, 0.07), c: '#3f8f7e' })
        box.push({ p: P(0, top - 0.16, 0), s: S(len, 0.03, 0.08), c: '#f1ece0' })
        for (const sgn of [-1, 1]) {
          box.push({ p: P(sgn * (len / 2 - 0.05), top - 0.5, 0), s: S(0.1, 0.8, 0.07), c: '#3f8f7e' })
          box.push({ p: P(sgn * (len / 2 - 0.12), top - 0.5, 0), s: S(0.03, 0.8, 0.08), c: '#f1ece0' })
          // 귀에 비스듬한 구름 받침
          const ax = alongX ? mid + sgn * (len / 2 - 0.08) : z
          const az = alongX ? z : mid + sgn * (len / 2 - 0.08)
          const bx = alongX ? mid + sgn * (len / 2 - 0.45) : z
          const bz = alongX ? z : mid + sgn * (len / 2 - 0.45)
          box.push(beam([ax, top - 0.55, az], [bx, top - 0.16, bz], 0.07, 0.1, '#3f8f7e'))
        }
      }
      for (const z of [-D2, D2]) xsF.slice(0, -1).forEach((x, i) => deco(x, xsF[i + 1], z, true))
      for (const x of [-W2, W2]) zsS.slice(0, -1).forEach((z, j) => deco(z, zsS[j + 1], x, false))
    }

    // 위층
    if (upper) {
      const nU = Math.max(3, nb - 2)
      const Wu2 = Wu / 2 - 0.1
      const Du2 = Du / 2 - 0.1
      const xsU = Array.from({ length: nU + 1 }, (_, i) => -Wu2 + (i * 2 * Wu2) / nU)
      for (const z of [-Du2, Du2]) for (const x of xsU) cols.push({ p: [x, yU0 + hu / 2, z], s: [colR * 0.85, hu, colR * 0.85], c: RED })
      for (const x of [-Wu2, Wu2]) cols.push({ p: [x, yU0 + hu / 2, 0], s: [colR * 0.85, hu, colR * 0.85], c: RED })
      // 위층 벽: 아래 회벽 + 위 교창(빗살창) 띠
      for (const z of [-Du2, Du2]) {
        box.push({ p: [0, yU0 + hu * 0.2, z], s: [Wu2 * 2, hu * 0.4, 0.12], c: PLASTER })
        transom.push({ p: [0, yU0 + hu * 0.62, z * 1.002], s: [Wu2 * 2, hu * 0.4, 0.06] })
        box.push({ p: [0, yU0 + hu * 0.41, z], s: [Wu2 * 2, 0.08, 0.16], c: RED })
      }
      for (const x of [-Wu2, Wu2]) {
        box.push({ p: [x, yU0 + hu * 0.2, 0], s: [0.12, hu * 0.4, Du2 * 2], c: PLASTER })
        box.push({ p: [x, yU0 + hu * 0.62, 0], s: [0.08, hu * 0.4, Du2 * 2], c: '#e9dfc8' })
      }
      const ybU = yU0 + hu + 0.07
      xsU.forEach((x) => {
        bracketItems(box, x, -Du2, ybU, -1, true, ornate)
        bracketItems(box, x, Du2, ybU, 1, true, ornate)
      })
      for (const x of [-Wu2, Wu2]) bracketItems(box, x, 0, ybU, x < 0 ? -1 : 1, false, ornate)
    }

    // 기단·계단·월대 (장대석은 따로 그림)
    if (base > 0) {
      box.push({ p: [0, base + 0.02, 0], s: [W2 * 2 + 1.3, 0.05, D2 * 2 + 1.3], c: STONE_LIGHT })
      const n = Math.max(1, Math.ceil(base / 0.16))
      const front = -(D2 + 0.65) - woldae
      const stairXs = woldae > 0 ? [0, -W2 * 0.55, W2 * 0.55] : [0]
      for (const sx of stairXs) {
        const sw = Math.min(3, (W2 * 2) / nb + 0.4)
        for (let k = 0; k < n; k += 1) {
          box.push({ p: [sx, (base * (k + 1)) / (n + 1) / 2, front - 0.3 * (n - k) + 0.15], s: [sw, (base * (k + 1)) / (n + 1), 0.3], c: STONE })
        }
        // 소맷돌 (계단 양옆 경사 돌)
        for (const s of [-1, 1]) box.push(beam([sx + s * (sw / 2 + 0.1), 0.05, front - 0.3 * n], [sx + s * (sw / 2 + 0.1), base, front], 0.18, 0.18, STONE_LIGHT))
      }
      if (woldae > 0) box.push({ p: [0, base + 0.02, -(D2 + 0.65) - woldae / 2], s: [W2 * 1.72 + 0.1, 0.05, woldae + 0.1], c: STONE_LIGHT })
    }
    return { cols, box, lattice, transom, stone, band, pinkPanels, windowPanels, octPanels }
  }, [nb, ns, colR, W2, D2, y0, height, mode, ornate, upper, base, woldae, doorWidth, facade, roofY, Wu, Du, hu, yU0, xsF, zsS, pal, nakyang, enterable, doorClosed, allWindows, merumColor])

  // 현판
  const plaque = title ? (
    <mesh
      position={[0, upper ? yU0 + hu * 0.66 : y0 + height + 0.32, upper ? -Du / 2 - 0.12 : -D2 - 0.42]}
      rotation-y={Math.PI}
    >
      <planeGeometry args={[Math.min(3.2, Math.max(1.3, width * 0.2)), Math.min(3.2, Math.max(1.3, width * 0.2)) / 3.4]} />
      <meshBasicMaterial map={getSignTexture(title, '#262520', '#e7c97a')} />
    </mesh>
  ) : null

  return (
    <group position={position} rotation-y={rotation}>
      {/* 기단: 장대석 */}
      {base > 0 && <mesh geometry={GEO.box} material={ashlarMat(W2 * 2 + 1.2, base)} position={[0, base / 2, 0]} scale={[W2 * 2 + 1.2, base, D2 * 2 + 1.2]} />}
      {woldae > 0 && (
        <mesh geometry={GEO.box} material={ashlarMat(W2 * 1.72, base)} position={[0, base / 2, -(D2 + 0.65) - woldae / 2]} scale={[W2 * 1.72, base, woldae]} />
      )}
      <Instances geometry={GEO_COL} material={PARTS} items={parts.cols} />
      <Instances geometry={GEO.box} material={PARTS} items={parts.box} />
      {mode === 'interior' && <HjPalaceInterior timber={TIMBER} />}
      <Instances geometry={GEO.box} material={plain ? latticeMat(lattice, '#5e4030', '#6b4a32') : latticeMat(lattice, latticeBar, latticeBar ? '#6b3326' : undefined)} items={parts.lattice} />
      <Instances geometry={GEO.box} material={transomMat()} items={parts.transom} />
      <Instances geometry={GEO.box} material={wallMat('sagwae')} items={parts.stone} />
      <Instances geometry={GEO.box} material={wallMat('band')} items={parts.band} />
      <Instances geometry={GEO.box} material={wallMat('pink')} items={parts.pinkPanels} />
      <Instances geometry={GEO.box} material={wallMat('window')} items={parts.windowPanels} />
      <Instances geometry={GEO.box} material={wallMat('octagon')} items={parts.octPanels} />
      {/* 창방(단청) + 평방 */}
      {[-D2, D2].map((z) => (
        <mesh key={`cb${z}`} geometry={GEO.box} material={plain ? mat(pal.b1) : dancheongMat(W2 * 2)} position={[0, y0 + height - 0.13, z]} scale={[W2 * 2 + colR * 2, 0.26, 0.22]} />
      ))}
      {[-W2, W2].map((x) => (
        <mesh key={`cs${x}`} geometry={GEO.box} material={plain ? mat(pal.b1) : dancheongMat(D2 * 2)} position={[x, y0 + height - 0.13, 0]} scale={[0.22, 0.26, D2 * 2 + colR * 2]} />
      ))}
      <Box p={[0, y0 + height + 0.03, -D2]} s={[W2 * 2 + 0.3, 0.12, 0.32]} c={pal.b1} />
      <Box p={[0, y0 + height + 0.03, D2]} s={[W2 * 2 + 0.3, 0.12, 0.32]} c={pal.b1} />
      <HanokRoof
        width={RW}
        depth={RD}
        rise={rise}
        type={upper ? 'hip' : roof}
        y={roofY}
        ridge={upper ? false : ridge}
        japsang={upper ? 0 : japsang}
        gableInset={ov}
        plain={plain}
      />
      {upper && (
        <>
          {[-1, 1].map((s) => (
            <mesh key={`ub${s}`} geometry={GEO.box} material={dancheongMat(Wu)} position={[0, yU0 + hu - 0.12, (s * (Du / 2 - 0.1))]} scale={[Wu, 0.22, 0.2]} />
          ))}
          <HanokRoof width={RWu} depth={RDu} rise={RDu * 0.27} type={roof} y={yU0 + hu + bh} ridge={ridge} japsang={japsang} gableInset={ovU} />
        </>
      )}
      {plaque}
      {enterable && mode === 'closed' && <HallInside W2={W2} D2={D2} y0={y0} height={height} plain={plain} furnish={furnish} doorW={(2 * W2) / nb} />}
    </group>
  )
}

// ── 돌난간 (월대·축대·돌다리): 돌기둥 + 하엽 동자 + 둥근 난간대 ──
export function StoneRail({ segments, y = 0, h = 0.62, gap = 1.35 }) {
  const { box, caps } = useMemo(() => {
    const list = []
    const balls = []
    for (const [x0, z0, x1, z1] of segments) {
      const len = Math.hypot(x1 - x0, z1 - z0)
      const n = Math.max(1, Math.round(len / gap))
      for (let i = 0; i <= n; i += 1) {
        const t = i / n
        const x = x0 + (x1 - x0) * t
        const z = z0 + (z1 - z0) * t
        list.push({ p: [x, y + h / 2, z], s: [0.17, h, 0.17], c: '#e4ddcc' })
        balls.push({ p: [x, y + h + 0.06, z], s: [0.09, 0.09, 0.09], c: '#e9e3d4' })
        if (i < n) {
          const xm = x0 + (x1 - x0) * (t + 0.5 / n)
          const zm = z0 + (z1 - z0) * (t + 0.5 / n)
          list.push({ p: [xm, y + h * 0.55, zm], s: [0.12, h * 0.25, 0.12], c: '#d8d0bd' }) // 하엽 동자
        }
      }
      list.push(beam([x0, y + h * 0.78, z0], [x1, y + h * 0.78, z1], 0.1, 0.09, '#e7e0d0'))
      list.push(beam([x0, y + 0.08, z0], [x1, y + 0.08, z1], 0.16, 0.16, '#cfc7b4'))
      list.push(beam([x0, y + h * 0.3, z0], [x1, y + h * 0.3, z1], 0.05, h * 0.3, '#ddd5c3'))
    }
    return { box: list, caps: balls }
  }, [segments, y, h, gap])
  return (
    <>
      <Instances geometry={GEO.box} material={PARTS} items={box} />
      <Instances geometry={GEO.sphere} material={PARTS} items={caps} />
    </>
  )
}

// ── 붉은 나무 난간 (누각 마루 둘레, 계자난간 느낌) ──
// panel: true면 칸마다 분홍 청판(안상 구멍) + 난간대 받침(초록 하엽) — 경회루·향원정 계자난간
export function WoodRail({ segments, y = 0, h = 0.75, panel = false }) {
  const { items, panels } = useMemo(() => {
    const list = []
    const pans = []
    for (const [x0, z0, x1, z1] of segments) {
      const len = Math.hypot(x1 - x0, z1 - z0)
      const n = Math.max(1, Math.round(len / 0.9))
      for (let i = 0; i <= n; i += 1) {
        const t = i / n
        const px = x0 + (x1 - x0) * t
        const pz = z0 + (z1 - z0) * t
        list.push({ p: [px, y + h / 2, pz], s: [0.07, h, 0.07], c: RED })
        if (panel) list.push({ p: [px, y + h - 0.1, pz], s: [0.11, 0.1, 0.11], c: '#7fc4a8' })
        if (panel && i < n) {
          const a = [px, y + h * 0.42, pz]
          const t2 = (i + 1) / n
          const b = [x0 + (x1 - x0) * t2, y + h * 0.42, z0 + (z1 - z0) * t2]
          const pnl = beam(a, b, 0.03, h * 0.46, undefined)
          pnl.s[0] -= 0.08
          pans.push(pnl)
        }
      }
      list.push(beam([x0, y + h, z0], [x1, y + h, z1], 0.09, 0.07, RED))
      list.push(beam([x0, y + 0.12, z0], [x1, y + 0.12, z1], 0.09, 0.07, RED))
      if (panel) list.push(beam([x0, y + h * 0.72, z0], [x1, y + h * 0.72, z1], 0.07, 0.05, RED))
      else list.push(beam([x0, y + h * 0.5, z0], [x1, y + h * 0.5, z1], 0.03, h * 0.42, GREEN))
    }
    return { items: list, panels: pans }
  }, [segments, y, h, panel])
  return (
    <>
      <Instances geometry={GEO.box} material={PARTS} items={items} />
      {panel && <Instances geometry={GEO.box} material={texOr(getRailPanelTexture(), '#d98b78')} items={panels} />}
    </>
  )
}

// ── 육각 지붕 (향원정): 가운데가 뾰족하고 여섯 귀가 들린 지붕. inner>0이면 가운데가 빈 고리(아래층 처마) ──
function buildHexRoof(R, rise, inner) {
  const radial = 9
  const ang = 6 * 8
  const pos = []
  const uv = []
  const idx = []
  for (let j = 0; j <= radial; j += 1) {
    const t = inner + ((1 - inner) * j) / radial
    for (let i = 0; i <= ang; i += 1) {
      const th = (i / ang) * Math.PI * 2
      const local = (((th % (Math.PI / 3)) + Math.PI / 3) % (Math.PI / 3)) - Math.PI / 6
      const r = (R * Math.cos(Math.PI / 6)) / Math.cos(local) // 육각형 둘레
      const corner = Math.abs(local) / (Math.PI / 6) // 1 = 육각형 꼭짓점(귀)
      const y = rise * Math.pow(1 - t, 1.6) + rise * 0.32 * Math.pow(t, 6) * Math.pow(corner, 3)
      pos.push(Math.cos(th) * r * t, y, Math.sin(th) * r * t)
      uv.push((th * R) / 0.42, (t * R) / 0.5)
    }
  }
  for (let j = 1; j <= radial; j += 1) {
    for (let i = 1; i <= ang; i += 1) {
      const p = j * (ang + 1) + i
      const q = p - ang - 1
      idx.push(q - 1, q, p - 1, q, p, p - 1)
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  g.setIndex(idx)
  g.computeVertexNormals()
  return g
}

export function HexRoof({ R, rise, inner = 0, y = 0, finial = false }) {
  const geometry = useMemo(() => buildHexRoof(R, rise, inner), [R, rise, inner])
  useEffect(() => () => geometry.dispose(), [geometry])
  const ridges = useMemo(() => {
    const list = []
    for (let k = 0; k < 6; k += 1) {
      const th = (k * Math.PI) / 3 // 귀(꼭짓점) 방향
      const pts = []
      for (let s = 0; s <= 3; s += 1) {
        const t = inner + ((1 - inner) * s) / 3
        const r = R * t * 0.985
        const y0 = rise * Math.pow(1 - t, 1.6) + rise * 0.32 * Math.pow(t, 6)
        pts.push([Math.cos(th) * r, y0 + 0.06, Math.sin(th) * r])
      }
      for (let s = 1; s < pts.length; s += 1) list.push(beam(pts[s - 1], pts[s], 0.14, 0.14, '#d9d3c5'))
      // 귀 서까래 끝
      list.push({ p: [Math.cos(th) * R * 0.97, rise * 0.32 - 0.02, Math.sin(th) * R * 0.97], s: [0.14, 0.14, 0.14], c: VERMILION })
    }
    return list
  }, [R, rise, inner])
  // 귀는 0°·60°·120°… 방향 (향원정 기둥도 같은 방향에 세워요)
  return (
    <group position-y={y}>
      <mesh geometry={geometry} material={roofMat()} rotation-y={0} />
      {inner === 0 && <mesh geometry={GEO_HEX} material={mat(GREEN)} position={[0, -0.08, 0]} scale={[R * 0.92, 0.06, R * 0.92]} rotation-y={Math.PI / 6} />}
      <Instances geometry={GEO.box} material={PARTS} items={ridges} />
      {finial && (
        <>
          {/* 절병통: 꼭대기 장식 병 */}
          <mesh geometry={GEO.cyl8} material={mat('#3d4449')} position={[0, rise + 0.12, 0]} scale={[0.16, 0.24, 0.16]} />
          <mesh geometry={GEO.sphere} material={mat('#3d4449')} position={[0, rise + 0.34, 0]} scale={[0.17, 0.15, 0.17]} />
          <mesh geometry={GEO.sphere} material={mat('#3d4449')} position={[0, rise + 0.56, 0]} scale={[0.12, 0.12, 0.12]} />
          <mesh geometry={GEO.cone} material={mat('#3d4449')} position={[0, rise + 0.76, 0]} scale={[0.07, 0.22, 0.07]} />
        </>
      )}
    </group>
  )
}

// ── 버드나무 (경회루 연못가): 늘어진 가지 ──
const WILLOW_LEAF = mat('#9cbc63', { roughness: 0.9 })
const WILLOW_TRUNK = mat('#6e5a45', { roughness: 0.95 })
export function Willows({ spots }) {
  const { trunks, strands, crowns } = useMemo(() => {
    const t = []
    const s = []
    const c = []
    spots.forEach(([x, z, k = 1], n) => {
      t.push({ p: [x, 1.4 * k, z], s: [0.18 * k, 2.8 * k, 0.18 * k], r: [0, 0, ((n % 3) - 1) * 0.08] })
      c.push({ p: [x, 3.1 * k, z], s: [1.5 * k, 0.7 * k, 1.5 * k] })
      for (let i = 0; i < 26; i += 1) {
        const a = i * 2.4 + n
        const r = (0.5 + ((i * 7) % 10) / 12) * k
        const len = (1.3 + ((i * 3) % 5) * 0.25) * k
        s.push({ p: [x + Math.cos(a) * r, 3.0 * k - len / 2, z + Math.sin(a) * r], s: [0.05, len, 0.18], r: [0, a, 0] })
      }
    })
    return { trunks: t, strands: s, crowns: c }
  }, [spots])
  return (
    <>
      <Instances geometry={GEO.cyl8} material={WILLOW_TRUNK} items={trunks} />
      <Instances geometry={GEO.box} material={WILLOW_LEAF} items={strands} />
      <Instances geometry={GEO.sphere} material={WILLOW_LEAF} items={crowns} />
    </>
  )
}

// ── 들어갈 수 있는 전각의 안쪽: 우물마루 바닥 + 천장(단청 우물반자 / 백골집은 나무 판) + 살림 + 카메라 가림막 ──
// 카메라 가림막(camera-blocker)은 보이지 않는 상자예요. 안에 있을 때 카메라가 벽·지붕 밖으로 나가지 않게 해요.
const insideCache = new Map()
function insideMat(get, key, rx, ry, color) {
  const k = key + '|' + rx.toFixed(1) + '|' + ry.toFixed(1)
  if (insideCache.has(k)) return insideCache.get(k)
  const base = get()
  let m
  if (!base) m = mat(color, { double: true })
  else {
    const t = base.clone()
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    t.repeat.set(rx, ry)
    t.needsUpdate = true
    m = new THREE.MeshStandardMaterial({ map: t, roughness: 0.85, side: THREE.DoubleSide })
  }
  insideCache.set(k, m)
  return m
}
const HIDDEN = new THREE.MeshBasicMaterial({ visible: false })
function HallInside({ W2, D2, y0, height, plain, furnish, doorW }) {
  const fw = W2 * 2 - 0.3
  const fd = D2 * 2 - 0.3
  const ceilY = y0 + height - 0.3
  const floor = furnish === 'throne' ? insideMat(getMatFloorTexture, 'mat', fw / 1.8, fd / 1.8, '#d9cfa8') : insideMat(getMaruTexture, 'maru', fw / 2, fd / 2, '#8a7d6b')
  const ceil = plain ? mat('#b08a62', { double: true }) : insideMat(getCofferCeilingTexture, 'coffer', fw / 1.2, fd / 1.2, '#2f6b58')
  const blockers = [
    [0, ceilY + 0.15, 0, W2 * 2 + 0.4, 0.3, D2 * 2 + 0.4],
    [0, y0 + height / 2, D2 + 0.05, W2 * 2, height, 0.2],
    [-W2 - 0.05, y0 + height / 2, 0, 0.2, height, D2 * 2],
    [W2 + 0.05, y0 + height / 2, 0, 0.2, height, D2 * 2],
    [-(W2 + doorW / 2) / 2, y0 + height / 2, -D2 - 0.05, W2 - doorW / 2, height, 0.2],
    [(W2 + doorW / 2) / 2, y0 + height / 2, -D2 - 0.05, W2 - doorW / 2, height, 0.2],
  ]
  return (
    <>
      <mesh position={[0, y0 + 0.05, 0]} rotation-x={-Math.PI / 2} material={floor}>
        <planeGeometry args={[fw, fd]} />
      </mesh>
      <mesh position={[0, ceilY, 0]} rotation-x={Math.PI / 2} material={ceil}>
        <planeGeometry args={[fw, fd]} />
      </mesh>
      <HallFurniture kind={furnish} W2={W2} D2={D2} y0={y0} height={height} />
      {blockers.map(([x, y, z, sx, sy, sz], i) => (
        <mesh key={i} name="camera-blocker" geometry={GEO.box} material={HIDDEN} position={[x, y, z]} scale={[sx, sy, sz]} />
      ))}
    </>
  )
}
