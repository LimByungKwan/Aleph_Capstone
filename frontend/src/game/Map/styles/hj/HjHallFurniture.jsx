import { useMemo } from 'react'
import * as THREE from 'three'
import { GEO, Instances, mat, texMat } from '../kit.jsx'
import { getCloudDragonTexture, getDancheongTexture } from './hjTextures.js'
import { pyeonjeonSpots } from './gyeongbokLayout.js'
import Kitchen from './HjKitchen.jsx'

// [3. 개발 > 프론트엔드] 경복궁 전각 실내 살림 (혜진 영화·드라마 구역)
// 들어갈 수 있는 전각(HanokHall enterable)의 안쪽을 채워요. 전각 기준 좌표(앞 -z, 바닥 y0).
// kind: 'throne' 편전(사정전: 어좌 + 일월오봉도) · 'room' 침전·생활 공간(보료·안석·병풍·문갑·경상·등잔)
//       · 'kitchen' 소주방(수라간: 부뚜막·아궁이·가마솥·찬장·선반·소반·옹기 — HjKitchen.jsx)

const PARTS = mat('#ffffff', { roughness: 0.85 })
const cache = new Map()
function paint(key, w, h, draw) {
  if (cache.has(key)) return cache.get(key)
  if (typeof document === 'undefined') return null
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  draw(ctx, w, h)
  const t = new THREE.CanvasTexture(canvas)
  t.colorSpace = THREE.SRGBColorSpace
  const m = new THREE.MeshStandardMaterial({ map: t, roughness: 0.85 })
  cache.set(key, m)
  return m
}

// 일월오봉도: 해·달·다섯 봉우리·소나무·물결
function sunMoonScreen() {
  return paint('sunMoon', 512, 220, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h)
    g.addColorStop(0, '#1d2f55')
    g.addColorStop(1, '#3d6a66')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, w, h)
    ctx.fillStyle = '#e5694a'
    ctx.beginPath(); ctx.arc(w * 0.22, h * 0.2, 16, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = '#ece6cc'
    ctx.beginPath(); ctx.arc(w * 0.78, h * 0.2, 16, 0, Math.PI * 2); ctx.fill()
    for (let i = 0; i < 5; i += 1) {
      const x = ((i + 1) * w) / 6
      const top = [0.5, 0.38, 0.3, 0.38, 0.5][i] * h
      ctx.fillStyle = i % 2 ? '#3b6f5c' : '#4f8a6b'
      ctx.beginPath(); ctx.moveTo(x - 70, h * 0.8); ctx.lineTo(x, top); ctx.lineTo(x + 70, h * 0.8); ctx.closePath(); ctx.fill()
      ctx.strokeStyle = '#c9b27a'; ctx.lineWidth = 2; ctx.stroke()
    }
    // 봉우리 사이 폭포 (흰 줄기)
    ctx.strokeStyle = '#eef3ee'
    ctx.lineWidth = 3
    for (const x of [w * 0.42, w * 0.58]) {
      ctx.beginPath(); ctx.moveTo(x, h * 0.45); ctx.lineTo(x + 2, h * 0.8); ctx.stroke()
    }
    // 양 끝 붉은 줄기 소나무
    for (const x of [w * 0.07, w * 0.93]) {
      ctx.fillStyle = '#9a3a2a'
      ctx.fillRect(x - 4, h * 0.35, 8, h * 0.47)
      for (let k = 0; k < 4; k += 1) {
        ctx.fillStyle = k % 2 ? '#2f5f48' : '#3f7a55'
        ctx.beginPath()
        ctx.ellipse(x + (k % 2 ? 12 : -12), h * (0.38 + k * 0.08), 26 - k * 3, 8, 0, 0, Math.PI * 2)
        ctx.fill()
      }
    }
    for (let y = h * 0.8; y < h * 0.92; y += 6) {
      ctx.strokeStyle = '#a9c4ae'
      ctx.beginPath()
      for (let x = 0; x <= w; x += 6) ctx.lineTo(x, y + Math.sin(x / 14 + y) * 3)
      ctx.stroke()
    }
    // 아래 파란 띠
    ctx.fillStyle = '#23458a'
    ctx.fillRect(0, h * 0.92, w, h * 0.08)
    ctx.strokeStyle = '#c99a45'; ctx.lineWidth = 8; ctx.strokeRect(0, 0, w, h)
  })
}

// 화조 병풍: 8폭, 칸마다 꽃가지와 새
function flowerScreen() {
  return paint('flowerScreen', 512, 160, (ctx, w, h) => {
    ctx.fillStyle = '#efe6cf'
    ctx.fillRect(0, 0, w, h)
    for (let i = 0; i < 8; i += 1) {
      const x = (i * w) / 8
      ctx.strokeStyle = '#5b3a28'; ctx.lineWidth = 4; ctx.strokeRect(x + 2, 2, w / 8 - 4, h - 4)
      ctx.strokeStyle = '#6b4a32'; ctx.lineWidth = 2
      ctx.beginPath(); ctx.moveTo(x + 14, h - 14); ctx.quadraticCurveTo(x + 30, h * 0.5, x + 50, h * 0.25); ctx.stroke()
      for (let k = 0; k < 5; k += 1) {
        ctx.fillStyle = ['#d9566e', '#e98aa0', '#f1c14f'][k % 3]
        ctx.beginPath(); ctx.arc(x + 18 + k * 7, h - 30 - k * 18, 5, 0, Math.PI * 2); ctx.fill()
      }
      ctx.fillStyle = '#3f6a8a'
      ctx.beginPath(); ctx.ellipse(x + 44, h * 0.3, 7, 4, -0.4, 0, Math.PI * 2); ctx.fill()
    }
  })
}

export default function HallFurniture({ kind = 'room', W2, D2, y0, height = 3 }) {
  if (kind === 'throne') return <Pyeonjeon W2={W2} D2={D2} y0={y0} height={height} />
  if (kind === 'kitchen') return <Kitchen W2={W2} D2={D2} y0={y0} />
  return <Furniture kind={kind} W2={W2} D2={D2} y0={y0} />
}

function Furniture({ kind, W2, D2, y0 }) {
  const items = useMemo(() => {
    const list = []
    const b = (p, s, c, r) => list.push({ p: [p[0], y0 + p[1], p[2]], s, c, r })
    const back = D2 - 0.35
    if (kind === 'throne') {
      // 어좌 단 + 의자 (뒤에 일월오봉도)
      b([0, 0.15, back - 0.7], [2.6, 0.3, 1.4], '#8f3a2c')
      b([0, 0.34, back - 0.7], [2.7, 0.06, 1.5], '#c99a45')
      b([0, 0.6, back - 0.6], [0.9, 0.5, 0.6], '#9e4839')
      b([0, 1.05, back - 0.32], [0.95, 0.9, 0.1], '#8d3f31')
      b([0, 1.52, back - 0.32], [1.05, 0.08, 0.16], '#c99a45')
      for (const s of [-1, 1]) b([s * 0.5, 0.75, back - 0.6], [0.08, 0.3, 0.55], '#743c2b')
      b([0, 0.07, back - 1.6], [1.2, 0.14, 0.4], '#8f3a2c') // 계단
      // 신하 자리 방석
      for (const s of [-1, 1]) for (let k = 0; k < 2; k += 1) b([s * 1.6, 0.04, -D2 * 0.2 - k * 1.0], [0.7, 0.08, 0.6], '#843c35')
      return list
    }
    // 침전·생활 공간
    b([0, 0.05, back - 0.9], [1.9, 0.1, 1.3], '#a33b33') // 보료
    b([0, 0.12, back - 0.9], [1.7, 0.04, 1.1], '#2a4f8a')
    b([0, 0.3, back - 0.4], [1.2, 0.34, 0.22], '#c84a3a') // 안석 (등받이)
    for (const s of [-1, 1]) b([s * 0.75, 0.2, back - 0.75], [0.18, 0.24, 0.6], '#c84a3a') // 장침
    b([0, 0.22, back - 1.95], [0.9, 0.06, 0.45], '#6b4a32') // 경상 (낮은 책상)
    for (const sx of [-0.38, 0.38]) b([sx, 0.1, back - 1.95], [0.06, 0.2, 0.36], '#5e4030')
    // 문갑·사방탁자
    b([-W2 + 0.55, 0.4, back - 0.1], [0.9, 0.8, 0.4], '#7a573c')
    b([-W2 + 0.55, 0.86, back - 0.1], [0.95, 0.04, 0.45], '#5e4030')
    b([W2 - 0.5, 0.75, back - 0.1], [0.7, 1.5, 0.4], '#6b4a32')
    for (let r = 1; r < 4; r += 1) b([W2 - 0.5, r * 0.38, back - 0.1], [0.72, 0.03, 0.42], '#4f3626')
    b([W2 - 0.5, 0.95, back - 0.1], [0.2, 0.2, 0.2], '#e9e4d6') // 백자
    // 등잔
    b([-1.3, 0.35, back - 1.6], [0.06, 0.7, 0.06], '#4f3626')
    b([-1.3, 0.72, back - 1.6], [0.16, 0.04, 0.16], '#ffd890')
    return list
  }, [kind, W2, D2, y0])
  const screenMat = kind === 'throne' ? sunMoonScreen() : kind === 'room' ? flowerScreen() : null
  const back = D2 - 0.2
  return (
    <>
      <Instances geometry={GEO.box} material={PARTS} items={items} />
      {screenMat && (
        <group position={[0, y0 + (kind === 'throne' ? 1.35 : 0.75), back]}>
          <mesh rotation-y={Math.PI} material={screenMat}>
            <planeGeometry args={kind === 'throne' ? [3.2, 1.9] : [2.8, 1.1]} />
          </mesh>
          <mesh position={[0, 0, 0.03]} material={mat('#3c2a20')} scale={kind === 'throne' ? [3.35, 2.05, 0.05] : [2.9, 1.2, 0.05]} geometry={GEO.box} />
        </group>
      )}
    </>
  )
}

// ── 사정전 편전: 임금이 신하들과 나랏일을 의논하던 곳 (사진 기반) ──
// 뒤 가운데: 붉은 두 기둥 사이 어탑(붉은 단 + 초록 청판 + 난간) 위 용상, 그 뒤 일월오봉도, 기둥 위 들보 너머 운룡도
// 바닥: 파란 선두름 돗자리 · 안쪽 높은 붉은 기둥 4개 · 단청 대들보 · 천장 둘레 공포 줄
// 소품: 서안(붉은 책상) · 등롱 · 촛대 · 청화백자 꽃병 · 일산(붉은 양산) · 교의(접이 의자) · 방석
const LAMP = mat('#fff1c8', { emissive: '#ffcf80', emissiveIntensity: 0.9 })
const CANDLE = mat('#fbf7ea', { emissive: '#fff1d0', emissiveIntensity: 0.4 })
const RED = '#b8352a'
const RED_DARK = '#8f2a22'
const GOLD = '#d4a640'
const GREEN = '#2f6b58'
let dragonMat = null
let beamMat = null
function Pyeonjeon({ W2, D2, y0, height }) {
  const SP = pyeonjeonSpots(W2, D2) // 용상·서안·의자 자리 (앉기 기능과 같은 값)
  const back = SP.back // 뒤 벽 바로 앞
  const ceil = height - 0.3
  const { boxes, cols, jars } = useMemo(() => {
    const list = []
    const cyl = []
    const round = []
    const b = (p, s, c, r) => list.push({ p: [p[0], y0 + p[1], p[2]], s, c, r })
    // 안쪽 높은 기둥 4개 + 주춧돌
    for (const x of [-W2 * 0.45, W2 * 0.45]) {
      for (const z of [-D2 * 0.45, D2 * 0.25]) {
        cyl.push({ p: [x, y0 + ceil / 2, z], s: [0.17, ceil, 0.17], c: '#8a3326' })
        b([x, 0.04, z], [0.46, 0.08, 0.46], '#9c9584')
      }
    }
    // 어좌 뒤 붉은 두 기둥 + 위 들보 (그 위에 운룡도)
    for (const s of [-1, 1]) cyl.push({ p: [s * 2.0, y0 + ceil / 2, back - 0.25], s: [0.15, ceil, 0.15], c: '#a8332a' })
    b([0, 2.45, back - 0.25], [4.3, 0.22, 0.24], '#a8332a')
    // 어탑: 붉은 단 + 앞·옆 초록 청판 + 금 띠 + 위 난간 (가운데 앞 계단)
    const pz = SP.pz
    b([0, 0.22, pz], [2.8, 0.44, 1.45], RED_DARK)
    b([0, 0.46, pz], [2.9, 0.05, 1.55], GOLD)
    for (let i = 0; i < 6; i += 1) {
      const x = -1.15 + i * 0.46
      if (Math.abs(x) < 0.4) continue
      b([x, 0.22, pz - 0.73], [0.36, 0.24, 0.02], '#3f8a6a')
    }
    for (const s of [-1, 1]) for (let i = 0; i < 3; i += 1) b([s * 1.41, 0.22, pz - 0.45 + i * 0.45], [0.02, 0.24, 0.34], '#3f8a6a')
    const railY = 0.49
    const rail = (x0, z0, x1, z1) => {
      const len = Math.hypot(x1 - x0, z1 - z0)
      const n = Math.max(1, Math.round(len / 0.35))
      for (let i = 0; i <= n; i += 1) {
        const x = x0 + ((x1 - x0) * i) / n
        const z = z0 + ((z1 - z0) * i) / n
        b([x, railY + 0.17, z], [0.05, 0.34, 0.05], RED)
        b([x, railY + 0.36, z], [0.07, 0.05, 0.07], GOLD)
      }
      const alongX = Math.abs(x1 - x0) > Math.abs(z1 - z0)
      b([(x0 + x1) / 2, railY + 0.3, (z0 + z1) / 2], alongX ? [len, 0.04, 0.06] : [0.06, 0.04, len], RED)
      b([(x0 + x1) / 2, railY + 0.12, (z0 + z1) / 2], alongX ? [len, 0.14, 0.02] : [0.02, 0.14, len], '#3f8a6a')
    }
    rail(-1.4, pz - 0.7, -0.45, pz - 0.7)
    rail(0.45, pz - 0.7, 1.4, pz - 0.7)
    rail(-1.4, pz - 0.7, -1.4, pz + 0.7)
    rail(1.4, pz - 0.7, 1.4, pz + 0.7)
    for (let k = 0; k < 3; k += 1) b([0, 0.07 + k * 0.14, pz - 0.95 + k * 0.17], [0.8, 0.14, 0.2], RED)
    for (const s of [-1, 1]) b([s * 0.43, 0.42, pz - 0.82], [0.05, 0.06, 0.55], RED, [0.55, 0, 0])
    // 용상: 앉을 수 있어요 (E). 좌판은 엉덩이 뒤쪽으로만 깊어서, 앉으면 무릎·종아리가 앞으로 나와 보여요
    const T = SP.throne
    const pt = SP.platformTop
    b([0, T.top - 0.05, T.z + 0.17], [1.0, 0.1, 0.5], RED) // 좌판
    b([0, (pt + T.top - 0.1) / 2, T.z + 0.32], [0.95, T.top - 0.1 - pt, 0.2], RED_DARK) // 좌판 받침 (뒤쪽만)
    b([0, T.top + 0.42, T.z + 0.44], [1.1, 0.8, 0.08], RED) // 등판
    for (let gy = 0; gy < 3; gy += 1) for (let gx = 0; gx < 4; gx += 1) b([-0.39 + gx * 0.26, T.top + 0.16 + gy * 0.24, T.z + 0.39], [0.2, 0.18, 0.02], gy === 1 && (gx === 1 || gx === 2) ? GOLD : '#d24a3a')
    b([0, T.top + 0.86, T.z + 0.44], [1.2, 0.08, 0.12], GOLD)
    for (const s of [-1, 1]) {
      b([s * 0.52, T.top + 0.16, T.z + 0.2], [0.07, 0.3, 0.45], RED)
      b([s * 0.52, T.top + 0.33, T.z + 0.2], [0.1, 0.05, 0.5], GOLD)
    }
    // 등롱: 어탑 양옆 (검은 받침 + 빛나는 네모 등은 따로)
    for (const s of [-1, 1]) {
      b([s * 1.75, 0.04, pz - 0.6], [0.4, 0.08, 0.4], '#2c2620')
      b([s * 1.75, 0.5, pz - 0.6], [0.05, 0.9, 0.05], '#2c2620')
      b([s * 1.75, 1.3, pz - 0.6], [0.36, 0.06, 0.36], '#2c2620')
      b([s * 1.75, 0.92, pz - 0.6], [0.38, 0.05, 0.38], '#2c2620')
    }
    // 촛대: 키 큰 검은 기둥 + 흰 초 (초는 따로)
    for (const s of [-1, 1]) {
      b([s * 3.0, 0.03, pz - 1.3], [0.36, 0.06, 0.36], '#3a2a20')
      b([s * 3.0, 0.75, pz - 1.3], [0.06, 1.45, 0.06], '#5a2a22')
      b([s * 3.0, 1.48, pz - 1.3], [0.16, 0.03, 0.16], GOLD)
    }
    // 청화백자 꽃병 (붉은 받침 위) — 둥근 병은 따로
    for (const s of [-1, 1]) {
      b([s * (W2 - 0.7), 0.25, back - 0.5], [0.5, 0.5, 0.5], RED)
      round.push({ p: [s * (W2 - 0.7), y0 + 0.78, back - 0.5], s: [0.26, 0.3, 0.26], c: '#eef0f2' })
      round.push({ p: [s * (W2 - 0.7), y0 + 0.78, back - 0.5], s: [0.27, 0.06, 0.27], c: '#2c4a8a' })
      for (let k = 0; k < 6; k += 1) {
        const a = k * 1.05
        round.push({ p: [s * (W2 - 0.7) + Math.cos(a) * 0.18, y0 + 1.18 + (k % 2) * 0.08, back - 0.5 + Math.sin(a) * 0.18], s: [0.09, 0.09, 0.09], c: k % 2 ? '#d9566e' : '#c8423a' })
      }
      round.push({ p: [s * (W2 - 0.7), y0 + 1.12, back - 0.5], s: [0.22, 0.12, 0.22], c: '#3f7a55' })
    }
    // 일산: 붉은 천 양산 (왼쪽 앞)
    const ux = -W2 * 0.7
    const uz = -D2 * 0.2
    b([ux, 0.04, uz], [0.4, 0.08, 0.4], '#2c2620')
    b([ux, 1.05, uz], [0.05, 2.1, 0.05], RED)
    round.push({ p: [ux, y0 + 2.0, uz], s: [0.42, 0.22, 0.42], c: '#d42a22' })
    for (let k = 0; k < 10; k += 1) {
      const a = (k / 10) * Math.PI * 2
      b([ux + Math.cos(a) * 0.4, 1.78, uz + Math.sin(a) * 0.4], [0.16, 0.36, 0.03], '#c4241e', [0, -a, 0])
    }
    // 신하 방석 (붉은 테 + 파란 바탕)
    for (const s of [-1, 1]) {
      for (let k = 0; k < 3; k += 1) {
        b([s * 1.9, 0.03, -D2 * 0.1 - k * 0.9], [0.62, 0.05, 0.5], '#c43a32')
        b([s * 1.9, 0.06, -D2 * 0.1 - k * 0.9], [0.5, 0.02, 0.38], '#2a4f8a')
      }
    }
    // 천장 둘레 안쪽 공포 줄 (초록·붉은 첨차가 층층이)
    const ring = (len, fixed, alongX, sign) => {
      const n = Math.floor(len / 0.45)
      for (let i = 0; i <= n; i += 1) {
        const u = -len / 2 + (i * len) / n
        for (let layer = 0; layer < 3; layer += 1) {
          const y = ceil - 0.42 + layer * 0.12
          const out = 0.12 + layer * 0.1
          const p = alongX ? [u, y, fixed - sign * out] : [fixed - sign * out, y, u]
          list.push({ p: [p[0], y0 + p[1], p[2]], s: alongX ? [0.14, 0.09, 0.22 + layer * 0.2] : [0.22 + layer * 0.2, 0.09, 0.14], c: layer === 1 ? '#c8423a' : layer ? '#2a4f8a' : GREEN })
        }
      }
    }
    ring(W2 * 2 - 0.4, D2 - 0.1, true, 1)
    ring(W2 * 2 - 0.4, -D2 + 0.1, true, -1)
    ring(D2 * 2 - 0.4, W2 - 0.1, false, 1)
    ring(D2 * 2 - 0.4, -W2 + 0.1, false, -1)
    return { boxes: list, cols: cyl, jars: round }
  }, [W2, D2, y0, ceil, back])
  if (!dragonMat) {
    const t = getCloudDragonTexture()
    dragonMat = t ? texMat(t, { emissive: '#ffffff', emissiveIntensity: 0.35 }) : mat('#e8c3b0')
    const d = getDancheongTexture()
    if (d) {
      const c = d.clone()
      c.repeat.set(3, 1)
      c.needsUpdate = true
      beamMat = texMat(c)
    } else beamMat = mat(GREEN)
  }
  const pz = back - 1.0
  return (
    <>
      <Instances geometry={GEO.box} material={PARTS} items={boxes} />
      <Instances geometry={GEO.cyl8} material={PARTS} items={cols} />
      <Instances geometry={GEO.sphere} material={PARTS} items={jars} />
      {/* 단청 대들보 두 줄 (안쪽 기둥 위를 가로질러) */}
      {[-D2 * 0.45, D2 * 0.25].map((z) => (
        <mesh key={z} geometry={GEO.box} material={beamMat} position={[0, y0 + ceil - 0.5, z]} scale={[W2 * 2, 0.32, 0.3]} />
      ))}
      {/* 일월오봉도 (어탑 뒤) + 운룡도 (들보 위) */}
      <group position={[0, y0 + 1.42, back]}>
        <mesh rotation-y={Math.PI} material={sunMoonScreen()}>
          <planeGeometry args={[3.7, 1.95]} />
        </mesh>
        <mesh position={[0, 0, 0.03]} material={mat('#3c2a20')} scale={[3.85, 2.08, 0.05]} geometry={GEO.box} />
      </group>
      <mesh position={[0, y0 + (2.56 + ceil - 0.62) / 2 + 0.02, back - 0.26]} rotation-y={Math.PI} material={dragonMat}>
        <planeGeometry args={[3.9, Math.max(0.5, ceil - 0.62 - 2.56)]} />
      </mesh>
      {/* 등롱 불빛 · 촛불 */}
      {[-1, 1].map((s) => (
        <group key={s}>
          <mesh geometry={GEO.box} material={LAMP} position={[s * 1.75, y0 + 1.11, pz - 0.6]} scale={[0.3, 0.34, 0.3]} />
          <mesh geometry={GEO.cyl8} material={CANDLE} position={[s * 3.0, y0 + 1.62, pz - 1.3]} scale={[0.04, 0.24, 0.04]} />
        </group>
      ))}
    </>
  )
}
