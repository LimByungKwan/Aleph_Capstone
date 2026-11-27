import { useEffect, useMemo } from 'react'
import { CuboidCollider, CylinderCollider, RigidBody, TrimeshCollider } from '@react-three/rapier'
import * as THREE from 'three'
import { GEO, Instances, mat } from '../kit.jsx'
import { getSignTexture } from '../textures.js'
import { HanokHall, ashlarMat } from './HjHanok.jsx'
import { StoneFloor } from './HjPalaceGround.jsx'
import { GATE, GATE_TOP, Sukjeongmun } from './HjSukjeongmun.jsx'

// [3. 개발 > 프론트엔드] 북악산 (style: "hjBugaksan") — 혜진 영화·드라마 구역, 사진 기반
// 경복궁 북쪽 뒤로 솟은 삼각뿔 모양 산: 짙은 초록 숲 + 군데군데 드러난 흰 화강암 바위,
// 왼쪽(서)에는 바위가 많은 인왕산, 오른쪽(동)으로 이어지는 낮은 능선, 멀리 푸르스름한 북한산 봉우리들.
// 궁궐 뒤 산(HjBugaksan)은 경복궁과 경성거리 사이 자리에 놓인 지형이에요 (아래 설명).
// MountainRange는 현대 서울(HjModernSeoul)에서도 같은 북악산 배경으로 다시 써요.

const smooth = (a, b, x) => THREE.MathUtils.smoothstep(x, a, b)
const cone = (x, z, cx, cz, rx, rz, h, p = 1.5) => h * Math.pow(Math.max(0, 1 - Math.hypot((x - cx) / rx, (z - cz) / rz)), p)

// 봉우리 목록: [cx, cz, rx, rz, 높이, 뾰족함, 바위 많음(0~1), 먼 산(0~1)]
export const BUGAK_PEAKS = [
  [12, 100, 92, 78, 96, 1.55, 0.55, 0], // 북악산 (가운데 삼각뿔)
  [70, 112, 70, 52, 52, 1.35, 0.25, 0], // 북악산 동쪽 능선
  [-128, 78, 62, 58, 72, 1.6, 0.9, 0], // 인왕산 (바위산)
  [-60, 92, 55, 45, 38, 1.3, 0.3, 0], // 사이 고개
  [150, 96, 72, 60, 48, 1.3, 0.2, 0], // 동쪽 낮은 산
  [40, 235, 120, 70, 150, 1.25, 0.6, 1], // 북한산 (멀리)
  [-80, 220, 110, 60, 118, 1.3, 0.5, 1],
  [175, 215, 90, 60, 122, 1.35, 0.55, 1],
]

// 높이 함수 (아이템 기준 x, z)
function heightAt(peaks, x, z, edgeX) {
  let h = 6 * smooth(0, 40, z) + 18 * smooth(30, 140, z) // 기슭 → 뒤로 갈수록 높은 바탕
  for (const [cx, cz, rx, rz, ph, p] of peaks) h = Math.max(h, cone(x, z, cx, cz, rx, rz, ph, p) + 4 * smooth(0, 40, z))
  h += (Math.sin(x * 0.09 + z * 0.05) * 2.2 + Math.cos(x * 0.05 - z * 0.11) * 1.8) * smooth(0, 30, z)
  h *= smooth(0, 14, z) // 맵 끝(z 0)에서는 땅 높이와 같게
  h *= 1 - smooth(edgeX * 0.82, edgeX, Math.abs(x)) * 0.85 // 양 끝은 낮게 (바깥 산과 이어지게)
  return Math.max(0, h)
}
// 이 자리 바위가 얼마나 드러나는지 (0~1)
function rockAt(peaks, x, z) {
  let rock = 0
  for (const [cx, cz, rx, rz, , , r] of peaks) {
    const k = 1 - Math.hypot((x - cx) / rx, (z - cz) / rz)
    if (k > 0) rock = Math.max(rock, r * smooth(0.25, 0.75, k))
  }
  const n = Math.sin(x * 0.31 + z * 0.17) * Math.cos(x * 0.13 - z * 0.27)
  return rock * smooth(0.15, 0.55, n + rock * 0.35)
}

const FOREST = [new THREE.Color('#3f6b3a'), new THREE.Color('#4f7d43'), new THREE.Color('#5e8a4c'), new THREE.Color('#6f9655')]
const GRANITE = new THREE.Color('#d2cdbf')
const FAR = new THREE.Color('#8fa6ad')
const FOOT = new THREE.Color('#6d8f55')

/**
 * 산줄기 지형. width × depth 땅에 peaks로 솟은 산을 그려요 (아이템 기준 x: -width/2~width/2, z: 0~depth)
 */
export function MountainRange({ peaks = BUGAK_PEAKS, width = 460, depth = 300, step = 4, trees = 700, rocks = 46 }) {
  const { geometry, treeItems, rockItems } = useMemo(() => {
    const nx = Math.round(width / step)
    const nz = Math.round(depth / step)
    const pos = []
    const col = []
    const idx = []
    const edgeX = width / 2
    let seed = 5
    const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
    for (let j = 0; j <= nz; j += 1) {
      for (let i = 0; i <= nx; i += 1) {
        const x = -width / 2 + i * step
        const z = j * step
        const h = heightAt(peaks, x, z, edgeX)
        pos.push(x, h, z)
        // 숲 색: 칸마다 짙고 옅은 초록이 섞이고, 바위 자리는 흰 화강암, 먼 산은 푸르스름하게
        const c = FOREST[Math.floor((Math.sin(x * 0.37 + z * 0.23) * 0.5 + 0.5) * 3.99)].clone()
        c.lerp(FOOT, (1 - smooth(4, 26, h)) * 0.5)
        c.lerp(GRANITE, rockAt(peaks, x, z) * smooth(18, 50, h) * 0.85)
        c.lerp(FAR, smooth(150, 230, z) * 0.6)
        col.push(c.r, c.g, c.b)
        if (i && j) {
          const a = j * (nx + 1) + i
          idx.push(a - nx - 2, a - 1, a - nx - 1, a - nx - 1, a - 1, a)
        }
      }
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
    g.setIndex(idx)
    g.computeVertexNormals()

    // 나무: 기슭~중턱 숲 (바위 자리·먼 산 제외), 둥근 잎 덩어리
    const treeItems = []
    for (let k = 0; k < trees * 3 && treeItems.length < trees; k += 1) {
      const x = (r() - 0.5) * width * 0.9
      const z = 6 + r() * 150
      const h = heightAt(peaks, x, z, edgeX)
      if (h > 70 || rockAt(peaks, x, z) > 0.35) continue
      const s = 1.6 + r() * 2.2
      treeItems.push({ p: [x, h + s * 0.55, z], s: [s, s * 1.25, s], c: FOREST[Math.floor(r() * 4)].getStyle() })
    }
    // 드러난 화강암 바위 (사진처럼 흰 바위 덩어리)
    const rockItems = []
    for (let k = 0; k < rocks * 40 && rockItems.length < rocks; k += 1) {
      const x = (r() - 0.5) * width * 0.8
      const z = 20 + r() * 140
      const h = heightAt(peaks, x, z, edgeX)
      if (h < 24 || rockAt(peaks, x, z) < 0.45) continue
      const s = 3 + r() * 6
      rockItems.push({ p: [x, h - s * 0.2, z], s: [s * 1.4, s * 0.55, s], r: [0, r() * 3, 0], c: r() > 0.5 ? '#ddd8ca' : '#c9c3b4' })
    }
    return { geometry: g, treeItems, rockItems }
  }, [peaks, width, depth, step, trees, rocks])

  return (
    <group>
      <mesh geometry={geometry}>
        <meshStandardMaterial vertexColors roughness={1} flatShading />
      </mesh>
      <Instances geometry={GEO.ico} material={LEAVES} items={treeItems} />
      <Instances geometry={GEO.rock} material={ROCK} items={rockItems} />
    </group>
  )
}
const LEAVES = mat('#ffffff', { roughness: 0.95, flat: true })
const ROCK = mat('#ffffff', { roughness: 0.9, flat: true })

// ─────────────────────────────────────────────────────────────────────────────
// [3. 개발 > 프론트엔드] 경복궁과 경성거리 사이 북악산 (style: "hjBugaksan", 사진 기반)
// 경성거리(hj_drama.json gs_*)를 북쪽으로 60m 옮겨 생긴 자리(아이템 기준 z 0 = 궁궐 뒤 길 바로 북쪽 ~ z 59 = 경성 시계탑 광장 입구)에
//  · 가운데 동쪽: 둥근 삼각뿔 북악산 봉우리(약 44m) + 꼭대기 팔각정
//  · 서쪽: 흰 화강암이 드러난 바위 봉우리(인왕산 느낌) → 바다 쪽 곶으로 낮아짐
//  · 산등성이를 따라 한양도성 성곽(여장 포함), 고갯길 위에 숙정문(돌 홍예문 + 문루)
//  · 신무문 앞에서 시계탑 광장까지 고갯길(돌길 + 양쪽 석축 + 석등), 궁궐 쪽 산자락은 장대석 석축
//  · 소나무·활엽수 숲, 비탈에 드러난 너럭바위, 서쪽 산자락으로 기찻길 터널(gs_tunnel_s)이 뚫려 있어요
// 아이템 기준 x = 구역 x, +z = 북쪽. 산은 지형 그대로 충돌(TrimeshCollider) + 석축·숙정문은 상자 충돌.
export const PASS = { x0: -2.5, x1: 11.5 } // 고갯길 (신무문 x 0, 인력거 길 x 8.6)
export const BUGAK_DEPTH = 59
const GATE_Z = 29 // 숙정문 (고갯길 위 성곽 줄)
const SUMMIT = { x: 23, z: 31 } // 북악산 꼭대기 (팔각정)
const TUNNEL = { x0: -53.5, x1: -39.7, z0: 45.6 } // 기찻길 터널 입구 (gs_tunnel_s) — 이 북쪽은 평지

// 봉우리: [cx, cz, rx, rz, 높이, 뾰족함, 바위(0~1)]
const PASS_PEAKS = [
  [SUMMIT.x, SUMMIT.z, 28, 27, 42, 1.05, 0.32], // 북악산 (대부분 숲, 군데군데 흰 바위)
  [-22, 29, 22, 23, 33, 1.3, 0.7], // 서쪽 바위 봉우리
]
const noise = (x, z) =>
  Math.sin(x * 0.21 + z * 0.13) * 1.1 + Math.cos(x * 0.11 - z * 0.27) * 1.3 + Math.sin(x * 0.53 + z * 0.41) * 0.45 + Math.cos(x * 0.07 + z * 0.05) * 1.6

function rawHeight(x, z) {
  if (z <= 0 || z >= BUGAK_DEPTH) return 0
  // 산등성이 바탕 (z 30 부근이 가장 높은 띠)
  let h = 12 * Math.max(0, 1 - ((z - 30) / 27) ** 2)
  for (const [cx, cz, rx, rz, ph, p] of PASS_PEAKS) h = Math.max(h, cone(x, z, cx, cz, rx, rz, ph, p) + 4)
  h += noise(x, z) * smooth(2, 10, h)
  // 궁궐 쪽 석축(0.8m 안쪽부터 2.6m) → 비탈, 경성 쪽은 낮게 내려와 광장과 만남
  h = Math.min(h, 2.6 + z * 2.4) * smooth(0, 0.8, z)
  h *= 1 - smooth(BUGAK_DEPTH - 9, BUGAK_DEPTH, z)
  // 양 끝 (서쪽 바다 곶 끝, 동쪽 구역 밖)
  // 서쪽은 기찻길 터널을 감쌀 만큼만 (바다 위로는 안 나가요), 동쪽은 구역 밖에서 낮아져요
  h *= smooth(-60, -50, x) * (1 - smooth(33, 44, x)) // 동쪽은 구역 끝(x 40)에서 멈춰요 — 그 너머는 해월 드림파크
  // 고갯길: 길 바닥은 0, 양쪽은 석축(3.5m)에서 다시 비탈
  const dPass = Math.max(PASS.x0 - x, x - PASS.x1)
  if (dPass < 0) return 0
  h = Math.min(h, 3.5 + dPass * 1.9)
  // 기찻길 터널: 입구 돌벽(z0+5.2~6) 뒤에서 땅이 끝나요 → 아치 구멍 앞을 산비탈이 메우지 않고 굴이 그대로 보여요
  // (땅이 내려오는 비탈은 입구 흙언덕·돌벽 안쪽에 숨겨요)
  if (x > TUNNEL.x0 - 1 && x < TUNNEL.x1 + 1) {
    if (z > TUNNEL.z0 + 3.2) return 0
    if (z > TUNNEL.z0 - 2) h = Math.min(h, 7.2)
  }
  return Math.max(0, h)
}

// ── 등산로 + 정상 전망대 ──
// 고갯길 동쪽 석축 틈(z 7.6~10.4)으로 들어가 산허리를 남북으로 지그재그 오르는 돌계단 길 → 꼭대기 전망대(팔각정)
// 계단 한 칸: 0.25m 앞으로 갈 때 최대 0.14m 오름 (캐릭터가 걸어 오를 수 있는 높이). 길 자리 땅은 계단 아래로 파내요
export const OBS = { x: 28.5, z: 30, r: 5.5 } // 정상 전망대 (실제 가장 높은 곳)
const TRAIL_PTS = [[10.8, 9], [13.4, 9], [17.5, 46], [22, 14], [26.5, 44], [OBS.x, OBS.z]]
const TRAIL_STEP = 0.25
const TRAIL_RISE = 0.14
const TRAIL = (() => {
  const pts = []
  for (let i = 1; i < TRAIL_PTS.length; i += 1) {
    const [ax, az] = TRAIL_PTS[i - 1]
    const [bx, bz] = TRAIL_PTS[i]
    const len = Math.hypot(bx - ax, bz - az)
    const n = Math.ceil(len / TRAIL_STEP)
    const yaw = Math.atan2(bx - ax, bz - az)
    for (let k = i === 1 ? 0 : 1; k <= n; k += 1) pts.push({ x: ax + ((bx - ax) * k) / n, z: az + ((bz - az) * k) / n, yaw })
  }
  const raw = pts.map((p) => rawHeight(p.x, p.z))
  const W = 12 // 앞뒤 3m 평균 (울퉁불퉁하지 않게)
  let prev = 0.08
  pts.forEach((p, i) => {
    let sum = 0
    let cnt = 0
    for (let j = Math.max(0, i - W); j <= Math.min(raw.length - 1, i + W); j += 1) {
      sum += raw[j]
      cnt += 1
    }
    const target = i === 0 ? 0.08 : sum / cnt
    prev = Math.max(prev - TRAIL_RISE, Math.min(prev + TRAIL_RISE, target))
    p.y = Math.max(0.08, prev)
    p.ground = raw[i]
  })
  return { pts, top: pts.at(-1).y }
})()
/** 정상 전망대 바닥 높이 (아이템 기준) — 안내판 이동 자리 계산에 써요 */
export const BUGAK_TOP = { x: OBS.x, z: OBS.z, y: TRAIL.top }
// 가장 가까운 등산로 칸 (거친 탐색 → 주변 정밀)
function nearestTrail(x, z) {
  const P = TRAIL.pts
  let bi = 0
  let bd = Infinity
  for (let i = 0; i < P.length; i += 6) {
    const d = (P[i].x - x) ** 2 + (P[i].z - z) ** 2
    if (d < bd) {
      bd = d
      bi = i
    }
  }
  for (let i = Math.max(0, bi - 6); i <= Math.min(P.length - 1, bi + 6); i += 1) {
    const d = (P[i].x - x) ** 2 + (P[i].z - z) ** 2
    if (d < bd) {
      bd = d
      bi = i
    }
  }
  return { d: Math.sqrt(bd), y: P[bi].y }
}
// 보이는 땅·충돌 땅: 원래 산 + 정상 평평하게 + 등산로 자리 파내기
function passHeight(x, z) {
  let h = rawHeight(x, z)
  if (h <= 0) return h
  const dO = Math.hypot(x - OBS.x, z - OBS.z)
  if (dO < OBS.r + 4) h = Math.min(h, TRAIL.top - 0.06 + smooth(OBS.r, OBS.r + 4, dO) * 30)
  if (x > 8 && x < 33 && z > 4 && z < 50) {
    const near = nearestTrail(x, z)
    if (near.d < 3.5) h = Math.min(h, near.y - 0.1 + Math.max(0, near.d - 1.15) * 1.5)
  }
  return Math.max(0, h)
}
function passRock(x, z, h) {
  let rock = 0
  for (const [cx, cz, rx, rz, , , r] of PASS_PEAKS) {
    const k = 1 - Math.hypot((x - cx) / rx, (z - cz) / rz)
    if (k > 0) rock = Math.max(rock, r * smooth(0.15, 0.7, k))
  }
  const n = Math.sin(x * 0.37 + z * 0.29) * Math.cos(x * 0.19 - z * 0.33) + Math.sin(x * 0.9 + z * 0.7) * 0.25
  return rock * smooth(0.25, 0.65, n + rock * 0.3) * smooth(10, 22, h)
}
// 산등성이(성곽 줄): x마다 가장 높은 z
const crestCache = new Map()
function crestAt(x) {
  if (crestCache.has(x)) return crestCache.get(x)
  let best = 30
  let bh = -1
  for (let z = 14; z <= 46; z += 1) {
    const h = passHeight(x, z)
    if (h > bh) {
      bh = h
      best = z
    }
  }
  const out = { z: best, h: bh }
  crestCache.set(x, out)
  return out
}

const PASS_STEP = 1.5
function makePassMesh() {
  const X0 = -61
  const X1 = 45
  const nx = Math.round((X1 - X0) / PASS_STEP)
  const nz = Math.round(BUGAK_DEPTH / PASS_STEP)
  const positions = []
  const colors = []
  const indices = []
  for (let j = 0; j <= nz; j += 1) {
    for (let i = 0; i <= nx; i += 1) {
      const x = X0 + i * PASS_STEP
      const z = Math.min(BUGAK_DEPTH, j * PASS_STEP)
      const h = passHeight(x, z)
      positions.push(x, h + (h > 0 ? 0.02 : -0.08), z)
      // 경사(옆 높이 차) → 가파른 곳일수록 바위가 드러나요
      const slope = Math.hypot(passHeight(x + 1, z) - passHeight(x - 1, z), passHeight(x, z + 1) - passHeight(x, z - 1)) / 2
      const tint = Math.sin(x * 0.29 + z * 0.41) * 0.5 + 0.5
      const c = FOREST[Math.floor(tint * 3.99)].clone()
      c.lerp(new THREE.Color('#2f5631'), smooth(14, 40, h) * 0.35) // 높은 곳 짙은 솔숲
      c.lerp(FOOT, (1 - smooth(1, 6, h)) * 0.6)
      const rock = Math.max(passRock(x, z, h), smooth(1.7, 2.6, slope) * smooth(10, 20, h) * 0.45)
      c.lerp(rock > 0.5 ? GRANITE : new THREE.Color('#b9b2a0'), Math.min(1, rock))
      if (h > 0 && h < 3.6 && Math.max(PASS.x0 - x, x - PASS.x1) < 2.2) c.set('#b8b1a2') // 고갯길 석축 윗선
      colors.push(c.r, c.g, c.b)
      if (i && j) {
        const a = j * (nx + 1) + i
        indices.push(a - nx - 2, a - 1, a - nx - 1, a - nx - 1, a - 1, a)
      }
    }
  }
  return { positions: new Float32Array(positions), colors: new Float32Array(colors), indices: new Uint32Array(indices) }
}
const passMesh = makePassMesh()

// 숙정문·석축 상자 (보이는 모양 = 충돌): [x, y, z, 가로, 높이, 세로]
const PASS_WALLS = (() => {
  const list = []
  const L = BUGAK_DEPTH - 6
  list.push([PASS.x0 - 0.45, 1.75, 3 + L / 2, 0.9, 3.5, L]) // 고갯길 서쪽 석축
  // 동쪽 석축은 등산로 들머리(z 7.6~10.4)만 비워요
  list.push([PASS.x1 + 0.45, 1.75, (3 + 7.6) / 2, 0.9, 3.5, 7.6 - 3])
  list.push([PASS.x1 + 0.45, 1.75, (10.4 + 3 + L) / 2, 0.9, 3.5, 3 + L - 10.4])
  for (const [a, b] of [[-46, PASS.x0 - 0.9], [PASS.x1 + 0.9, 44]]) list.push([(a + b) / 2, 1.3, 0.45, b - a, 2.6, 0.9]) // 궁궐 쪽 석축
  // 숙정문 석축 (HjSukjeongmun.jsx): 무지개문 3개만 비우고 기둥 돌 + 문 위 돌, 그 위 문루 바닥까지
  const mid = (PASS.x0 + PASS.x1) / 2
  // 막힌 옆문(blind)은 통째로 돌이에요 → 드나드는 가운데 문만 비워요
  const edges = [-GATE.w / 2, ...GATE.arches.filter((a) => !a.blind).flatMap((a) => [a.x - a.hw, a.x + a.hw]), GATE.w / 2]
  for (let i = 0; i < edges.length; i += 2) list.push([mid + (edges[i] + edges[i + 1]) / 2, GATE.h / 2, GATE_Z, edges[i + 1] - edges[i], GATE.h, GATE.d])
  for (const a of GATE.arches.filter((g) => !g.blind)) {
    const y0 = a.spring + a.hw * 0.8
    list.push([mid + a.x, (y0 + GATE.h) / 2, GATE_Z, a.hw * 2, GATE.h - y0, GATE.d])
  }
  list.push([mid, (GATE.h + GATE_TOP) / 2, GATE_Z, GATE.w - 0.4, GATE_TOP - GATE.h, GATE.d - 0.4])
  return list
})()

// 전망대 팔각 난간 조각 [가운데 x, z, 길이, 방향] — 등산로가 들어오는 방향의 한 칸은 비워요
const OBS_RAILS = (() => {
  const list = []
  const last = TRAIL_PTS.at(-2)
  const entry = Math.atan2(last[1] - OBS.z, last[0] - OBS.x)
  for (let i = 0; i < 8; i += 1) {
    const a0 = (i / 8) * Math.PI * 2
    const a1 = ((i + 1) / 8) * Math.PI * 2
    const am = (a0 + a1) / 2
    if (Math.abs(Math.atan2(Math.sin(am - entry), Math.cos(am - entry))) < Math.PI / 8) continue
    const x0 = OBS.x + Math.cos(a0) * OBS.r
    const z0 = OBS.z + Math.sin(a0) * OBS.r
    const x1 = OBS.x + Math.cos(a1) * OBS.r
    const z1 = OBS.z + Math.sin(a1) * OBS.r
    list.push([(x0 + x1) / 2, (z0 + z1) / 2, Math.hypot(x1 - x0, z1 - z0), -Math.atan2(z1 - z0, x1 - x0)])
  }
  return list
})()

export function HjBugaksanCollider({ item }) {
  const trimesh = useMemo(() => [passMesh.positions, passMesh.indices], [])
  return (
    <RigidBody type="fixed" colliders={false} position={[item.position[0], item.elevation ?? 0, item.position[1]]} name="HJ/bugaksan">
      <TrimeshCollider args={trimesh} />
      {PASS_WALLS.map(([x, y, z, w, h, d], i) => (
        <CuboidCollider key={i} args={[w / 2, h / 2, d / 2]} position={[x, y, z]} />
      ))}
      {/* 등산로 돌계단 (윗면 = 계단 높이) */}
      {TRAIL.pts.map((p, i) => {
        const bottom = Math.min(p.ground, p.y) - 0.35
        return <CuboidCollider key={`t${i}`} args={[0.9, (p.y - bottom) / 2, TRAIL_STEP / 2 + 0.02]} position={[p.x, (p.y + bottom) / 2, p.z]} rotation={[0, p.yaw, 0]} />
      })}
      {/* 전망대 나무 마루 바닥 (땅이 마루보다 낮은 가장자리에서도 서 있게) */}
      <CylinderCollider args={[0.1, OBS.r + 0.2]} position={[OBS.x, TRAIL.top - 0.08, OBS.z]} />
      {/* 전망대 난간 (등산로가 들어오는 칸만 비움) */}
      {OBS_RAILS.map(([x, z, len, yaw], i) => (
        <CuboidCollider key={`r${i}`} args={[len / 2, 0.6, 0.08]} position={[x, TRAIL.top + 0.6, z]} rotation={[0, yaw, 0]} />
      ))}
    </RigidBody>
  )
}

// 숲 나무 (성능): 잎은 20면체, 줄기는 뚜껑 없는 6각 기둥 — 낮은 다각형 모양은 같고 삼각형은 1/4
const LOW_LEAF = new THREE.IcosahedronGeometry(1, 0)
const LOW_TRUNK = new THREE.CylinderGeometry(1, 1, 1, 6, 1, true)
const LOW_CONE = new THREE.ConeGeometry(1, 1, 6, 1, true)
const BARK = mat('#5b4334', { roughness: 0.95 })
const NEEDLE = mat('#ffffff', { roughness: 0.95, flat: true })
const STONE_P = mat('#ffffff', { roughness: 0.9 })
const LANTERN_GLOW = mat('#fff1cf', { emissive: '#ffd590', emissiveIntensity: 0.7 })

const DECK_WOOD = mat('#9a7650', { roughness: 0.9 })
const SCOPE = new THREE.MeshStandardMaterial({ color: '#2f5f8f', roughness: 0.4, metalness: 0.4 })
function TrailSign({ position, rotation = 0, text }) {
  return (
    <group position={position} rotation-y={rotation}>
      <mesh geometry={GEO.box} position={[0, -0.75, 0]} scale={[0.1, 1.5, 0.1]} material={BARK} />
      <mesh position={[0, 0.05, 0.06]}>
        <planeGeometry args={[2.2, 0.55]} />
        <meshBasicMaterial map={getSignTexture(text, '#5a3e2b', '#f6e7c4', 4)} side={THREE.DoubleSide} />
      </mesh>
    </group>
  )
}
function ObservationDeck() {
  const y = TRAIL.top
  const rails = useMemo(() => {
    const list = []
    for (const [x, z, len, yaw] of OBS_RAILS) {
      list.push({ p: [x, y + 1.0, z], s: [len, 0.08, 0.08], r: [0, yaw, 0] })
      list.push({ p: [x, y + 0.55, z], s: [len, 0.06, 0.06], r: [0, yaw, 0] })
    }
    for (let i = 0; i < 8; i += 1) {
      const a = (i / 8) * Math.PI * 2
      list.push({ p: [OBS.x + Math.cos(a) * OBS.r, y + 0.55, OBS.z + Math.sin(a) * OBS.r], s: [0.12, 1.1, 0.12] })
    }
    return list
  }, [y])
  return (
    <>
      <mesh geometry={GEO.cyl8} material={DECK_WOOD} position={[OBS.x, y - 0.05, OBS.z]} scale={[OBS.r + 0.2, 0.14, OBS.r + 0.2]} />
      <Instances geometry={GEO.box} material={DECK_WOOD} items={rails} />
      {/* 동전 망원경 두 대: 남쪽(경복궁)·북쪽(경성거리) */}
      {[[0, -1], [0.4, 1]].map(([dx, dz], i) => (
        <group key={i} position={[OBS.x + dx * OBS.r * 0.7, y, OBS.z + dz * OBS.r * 0.72]} rotation-y={dz < 0 ? Math.PI : 0}>
          <mesh geometry={GEO.cyl8} material={SCOPE} position={[0, 0.55, 0]} scale={[0.07, 1.1, 0.07]} />
          <mesh geometry={GEO.box} material={SCOPE} position={[0, 1.2, 0.1]} rotation-x={-0.2} scale={[0.32, 0.26, 0.5]} />
          <mesh geometry={GEO.cyl8} material={mat('#1d1f22')} position={[0, 1.24, 0.37]} rotation-x={Math.PI / 2 - 0.2} scale={[0.09, 0.06, 0.09]} />
        </group>
      ))}
      <TrailSign position={[OBS.x - OBS.r * 0.55, y + 1.3, OBS.z - OBS.r * 0.55]} rotation={Math.PI * 0.75} text="북악산 정상 전망대 · 해발 342m" />
    </>
  )
}

export function HjBugaksan() {
  const model = useMemo(() => {
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(passMesh.positions, 3))
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(passMesh.colors, 3))
    geometry.setIndex(new THREE.BufferAttribute(passMesh.indices, 1))
    geometry.computeVertexNormals()

    let seed = 1394
    const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
    const trunks = []
    const pines = []
    const leafy = []
    const slabs = []
    const stones = []
    const crenels = []
    const lanterns = []
    // 숲: 소나무(층층 원뿔) 6 : 활엽수(둥근 잎) 4, 바위·고갯길·성곽 줄은 비움
    for (let k = 0; k < 5200 && pines.length + leafy.length < 1500; k += 1) {
      const x = -57 + r() * 96
      const z = 2 + r() * (BUGAK_DEPTH - 4)
      const h = passHeight(x, z)
      if (h < 2.8) continue
      if (passRock(x, z, h) > 0.4) continue
      if (x > 6 && x < 35 && z > 2 && z < 52 && nearestTrail(x, z).d < 2.6) continue // 등산로
      if (Math.hypot(x - OBS.x, z - OBS.z) < OBS.r + 2) continue // 정상 전망대
      if (Math.abs(x - (PASS.x0 + PASS.x1) / 2) < GATE.w / 2 + 1.5 && Math.abs(z - GATE_Z) < GATE.d / 2 + 2) continue // 숙정문 석축 자리
      const crest = crestAt(Math.round(x))
      if (Math.abs(z - crest.z) < 2.2) continue
      const s = 0.7 + r() * 0.9 + (1 - smooth(4, 30, h)) * 0.5
      if (r() < 0.6) {
        trunks.push({ p: [x, h + s * 0.9, z], s: [0.12 * s, 1.8 * s, 0.12 * s] })
        const col = r() > 0.5 ? '#2f5a36' : '#3b6a3e'
        pines.push({ p: [x, h + s * 2.0, z], s: [1.15 * s, 1.5 * s, 1.15 * s], c: col })
        pines.push({ p: [x, h + s * 2.9, z], s: [0.8 * s, 1.2 * s, 0.8 * s], c: col })
      } else {
        trunks.push({ p: [x, h + s * 0.6, z], s: [0.14 * s, 1.2 * s, 0.14 * s] })
        leafy.push({ p: [x, h + s * 1.7, z], s: [1.3 * s, 1.05 * s, 1.3 * s], c: FOREST[Math.floor(r() * 4)].getStyle() })
      }
    }
    // 너럭바위: 바위 많은 비탈에 비스듬히 누운 흰 화강암 판 (사진의 흰 바위 자국)
    for (let k = 0; k < 2600 && slabs.length < 120; k += 1) {
      const x = -52 + r() * 88
      const z = 4 + r() * (BUGAK_DEPTH - 8)
      const h = passHeight(x, z)
      if (h < 8 || passRock(x, z, h) < 0.45) continue
      if (Math.max(PASS.x0 - x, x - PASS.x1) < 7) continue // 고갯길 위로 튀어나오지 않게
      if (x > 6 && x < 35 && nearestTrail(x, z).d < 3) continue
      if (Math.hypot(x - OBS.x, z - OBS.z) < OBS.r + 3) continue
      const gx = (passHeight(x + 1, z) - passHeight(x - 1, z)) / 2
      const gz = (passHeight(x, z + 1) - passHeight(x, z - 1)) / 2
      const s = 1.2 + r() * 1.8
      slabs.push({ p: [x, h + 0.1, z], s: [s * 1.6, s * 0.35, s * 1.2], r: [Math.atan(gz) * 0.9, r() * 0.6, -Math.atan(gx) * 0.9], c: r() > 0.4 ? '#ddd7c8' : '#c8c1b1' })
    }
    // 한양도성 성곽: 산등성이를 따라 (고갯길 양쪽은 숙정문까지 내려와 이어져요)
    const wallPts = []
    for (let x = -50; x <= 38; x += 2) {
      if (x > PASS.x0 - 8 && x < PASS.x1 + 8) continue // 숙정문 석축(가로 22m)이 이어 줘요
      const c = crestAt(x)
      // 숙정문 가까이에서는 문 높이·자리로 내려와 붙어요
      const near = 1 - smooth(5, 16, Math.min(Math.abs(x - (PASS.x0 - 8)), Math.abs(x - (PASS.x1 + 8))))
      const z = THREE.MathUtils.lerp(c.z, GATE_Z, near)
      const h = Math.max(passHeight(x, z), THREE.MathUtils.lerp(c.h, GATE.h, near))
      // 등산로가 성곽을 넘는 자리(암문)·정상 전망대 자리는 성벽을 비워요
      const gapHere = (x > 6 && x < 35 && nearestTrail(x, z).d < 2.4) || Math.hypot(x - OBS.x, z - OBS.z) < OBS.r + 1.5
      wallPts.push([x, h, z, gapHere])
    }
    for (let i = 1; i < wallPts.length; i += 1) {
      const [x0, h0, z0, g0] = wallPts[i - 1]
      const [x1, h1, z1, g1] = wallPts[i]
      if (x1 - x0 > 3) continue // 고갯길 건너뛰기
      if (g0 || g1) continue // 암문 (등산로)·전망대
      const len = Math.hypot(x1 - x0, z1 - z0) + 0.2
      const yaw = -Math.atan2(z1 - z0, x1 - x0)
      const base = Math.min(h0, h1) - 0.6
      const top = Math.max(h0, h1) + 2.0
      stones.push({ p: [(x0 + x1) / 2, (base + top) / 2, (z0 + z1) / 2], s: [len, top - base, 1.3], r: [0, yaw, 0], c: i % 3 ? '#cbc3b2' : '#bdb5a3' })
      // 여장(톱니 모양 성가퀴): 성벽 위 작은 담 + 총구 틈
      crenels.push({ p: [(x0 + x1) / 2, top + 0.35, (z0 + z1) / 2], s: [len * 0.62, 0.7, 0.9], r: [0, yaw, 0], c: '#d6cfbf' })
      crenels.push({ p: [(x0 + x1) / 2, top + 0.76, (z0 + z1) / 2], s: [len * 0.66, 0.12, 1.0], r: [0, yaw, 0], c: '#8f877a' })
    }
    // 고갯길 석등 (양쪽 석축 앞, 6m마다)
    for (let z = 5; z < BUGAK_DEPTH - 4; z += 7) {
      for (const x of [PASS.x0 + 0.7, PASS.x1 - 0.7]) {
        lanterns.push({ p: [x, 0.35, z], s: [0.45, 0.7, 0.45], c: '#a9a294' })
        lanterns.push({ p: [x, 0.95, z], s: [0.55, 0.5, 0.55], c: '#c9c2b2' })
        lanterns.push({ p: [x, 1.32, z], s: [0.8, 0.18, 0.8], c: '#8f877a' })
      }
    }
    // 등산로: 돌계단 + 양쪽 낮은 연석 + 2m마다 나무 말뚝
    const steps = []
    const curbs = []
    const posts = []
    TRAIL.pts.forEach((p, i) => {
      const bottom = Math.min(p.ground, p.y) - 0.35
      steps.push({ p: [p.x, (p.y + bottom) / 2, p.z], s: [1.8, p.y - bottom, TRAIL_STEP + 0.03], r: [0, p.yaw, 0], c: i % 2 ? '#bdb5a3' : '#b2aa98' })
      const rx = Math.cos(p.yaw)
      const rz = -Math.sin(p.yaw)
      for (const side of [-1, 1]) {
        curbs.push({ p: [p.x + rx * side * 0.98, p.y + 0.1, p.z + rz * side * 0.98], s: [0.18, 0.22, TRAIL_STEP + 0.03], r: [0, p.yaw, 0], c: '#8f877a' })
        if (i % 8 === 0) posts.push({ p: [p.x + rx * side * 1.02, p.y + 0.5, p.z + rz * side * 1.02], s: [0.07, 1.0, 0.07], c: '#6b4a2e' })
      }
    })
    return { geometry, trunks, pines, leafy, slabs, stones, crenels, lanterns, steps, curbs, posts }
  }, [])
  useEffect(() => () => model.geometry.dispose(), [model])
  const glows = useMemo(() => model.lanterns.filter((_, i) => i % 3 === 1), [model])
  const passRects = useMemo(() => [[PASS.x0, PASS.x1, 0.9, BUGAK_DEPTH]], [])
  const mid = (PASS.x0 + PASS.x1) / 2
  return (
    <group>
      <mesh geometry={model.geometry}>
        <meshStandardMaterial vertexColors roughness={1} flatShading />
      </mesh>
      <Instances geometry={LOW_TRUNK} material={BARK} items={model.trunks} />
      <Instances geometry={LOW_CONE} material={NEEDLE} items={model.pines} />
      <Instances geometry={LOW_LEAF} material={LEAVES} items={model.leafy} />
      <Instances geometry={GEO.rock} material={ROCK} items={model.slabs} />
      <Instances geometry={GEO.box} material={STONE_P} items={model.stones} />
      <Instances geometry={GEO.box} material={STONE_P} items={model.crenels} />
      <Instances geometry={GEO.box} material={STONE_P} items={model.lanterns} />
      {/* 석등 불빛 */}
      {glows.map((l, i) => (
        <mesh key={i} geometry={GEO.box} material={LANTERN_GLOW} position={[l.p[0], l.p[1], l.p[2]]} scale={[0.3, 0.3, 0.58]} />
      ))}
      {/* 고갯길 돌길 */}
      <StoneFloor kind="paver" rects={passRects} y={0.07} />
      {/* 석축 (고갯길 양쪽 · 궁궐 쪽 산자락) */}
      {PASS_WALLS.slice(0, 5).map(([x, y, z, w, h, d], i) => (
        <mesh key={i} geometry={GEO.box} material={ashlarMat(Math.max(w, d), h)} position={[x, y, z]} scale={[w, h, d]} />
      ))}
      {/* 숙정문: 흰 화강암 석축 + 무지개문 3개 + 2층 문루 (사진 기반) */}
      <Sukjeongmun position={[mid, 0, GATE_Z]} />
      {/* 등산로: 돌계단 · 연석 · 나무 말뚝 · 들머리 안내판 */}
      <Instances geometry={GEO.box} material={STONE_P} items={model.steps} />
      <Instances geometry={GEO.box} material={STONE_P} items={model.curbs} />
      <Instances geometry={GEO.box} material={STONE_P} items={model.posts} />
      <TrailSign position={[PASS.x1 - 0.4, 1.35, 7.2]} rotation={-Math.PI / 2} text="⛰ 북악산 등산로 → 정상 전망대" />
      {/* 정상 전망대: 팔각 나무 마루 + 난간 + 망원경 + 안내판, 가운데 팔각정 */}
      <ObservationDeck />
      <group position={[OBS.x, TRAIL.top - 0.75, OBS.z]}>
        <mesh geometry={GEO.cyl8} material={ashlarMat(6, 0.8)} position={[0, 0.4, 0]} scale={[3.0, 0.8, 3.0]} />
        {Array.from({ length: 8 }, (_, i) => {
          const a = (i / 8) * Math.PI * 2 + Math.PI / 8
          return <mesh key={i} geometry={GEO.cyl8} material={mat('#8f2f24')} position={[Math.cos(a) * 2.6, 2.0, Math.sin(a) * 2.6]} scale={[0.16, 2.4, 0.16]} />
        })}
        <mesh geometry={GEO.cyl8} material={mat('#2f6b58')} position={[0, 3.3, 0]} scale={[3.1, 0.35, 3.1]} />
        <mesh geometry={GEO.cone} material={mat('#3f444a', { flat: true })} position={[0, 4.4, 0]} scale={[3.9, 1.9, 3.9]} />
        <mesh geometry={GEO.sphere} material={mat('#c9a24a')} position={[0, 5.45, 0]} scale={[0.25, 0.3, 0.25]} />
      </group>
    </group>
  )
}
