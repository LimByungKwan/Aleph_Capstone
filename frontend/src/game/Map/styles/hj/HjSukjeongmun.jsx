import { useMemo } from 'react'
import * as THREE from 'three'
import { GEO, Instances, mat } from '../kit.jsx'
import { HanokHall, latticeMat } from './HjHanok.jsx'

// [3. 개발 > 프론트엔드] 숙정문 (북악산 고갯길 위 성문) — 혜진 영화·드라마 구역, 사진 기반 (사람은 빼고)
//  · 흰 화강암 큰 돌을 쌓은 석축 + 무지개문(홍예) 3개: 가운데가 크고 양옆이 작아요. 홍예 둘레는 홍예석이 한 줄 둘러요
//  · 홍예 안 천장: 단청 그림(구름·봉황), 안쪽에 붉은 나무 문짝이 양쪽 벽으로 활짝 열려 있어요 (쇠못 장식·띠쇠)
//  · 석축 위: 짙은 회색 띠에 네모 무늬 판(흰 꽃무늬 원 · 격자 무늬가 번갈아) + 아래 돌 물받이(누혈)
//  · 그 위 2층 문루: 붉은 기둥, 초록 창호(띠살·격자) + 머름, 단청, 겹처마, 잡상, 위층 현판 "肅靖門"
//  · 밤에는 석축을 비추는 따뜻한 조명
// 기준: 가운데 홍예 바닥 가운데, 앞 = -z (궁궐 쪽). 충돌 박스는 HjBugaksan.jsx의 PASS_WALLS에 있어요.

export const GATE = {
  w: 22, // 석축 가로
  d: 8, // 석축 깊이 (홍예 길이)
  h: 6.2, // 석축 높이
  band: 0.9, // 무늬 띠 높이
  arches: [
    { x: -5.6, hw: 1.5, spring: 2.4, blind: true }, // 왼쪽: 막힌 문 (반지름 = hw, 꼭대기 = spring + hw)
    { x: 0, hw: 2.1, spring: 3.0 }, // 가운데: 드나드는 입구
    { x: 5.6, hw: 1.5, spring: 2.4, blind: true }, // 오른쪽: 막힌 문
  ],
}
export const GATE_TOP = GATE.h + GATE.band + 0.15 // 문루가 서는 높이

const cache = new Map()
function canvasTex(key, w, h, draw, repeat = [1, 1]) {
  const k = `${key}|${repeat.join(',')}`
  if (cache.has(k)) return cache.get(k)
  if (typeof document === 'undefined') return null
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const ctx = c.getContext('2d')
  if (!ctx) return null
  draw(ctx, w, h)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(...repeat)
  t.anisotropy = 8
  cache.set(k, t)
  return t
}

// 흰 화강암 마름돌: 한 줄 0.75m, 돌 길이 1.2~2.4m, 엇갈려 쌓기. 1장 = 가로 4m × 세로 3m
function graniteMat() {
  const t = canvasTex('sj-granite', 512, 384, (ctx, W, H) => {
    let seed = 21
    const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
    ctx.fillStyle = '#cfc8b8'
    ctx.fillRect(0, 0, W, H)
    const rowH = H / 4
    for (let row = 0; row < 4; row += 1) {
      let x = row % 2 ? -64 : 0
      while (x < W) {
        const w = 150 + r() * 160
        const v = 226 + r() * 14
        ctx.fillStyle = `rgb(${v},${v - 4},${v - 14})`
        ctx.fillRect(x + 2, row * rowH + 2, w - 4, rowH - 4)
        // 돌 결 (옅은 얼룩)
        for (let k = 0; k < 40; k += 1) {
          ctx.fillStyle = `rgba(150,140,120,${0.04 + r() * 0.06})`
          ctx.fillRect(x + 4 + r() * (w - 10), row * rowH + 4 + r() * (rowH - 10), 2 + r() * 6, 1 + r() * 3)
        }
        x += w
      }
    }
  }, [0.25, 1 / 3])
  return t ? new THREE.MeshStandardMaterial({ map: t, roughness: 0.85 }) : mat('#e8e2d4')
}

// 석축 위 무늬 띠: 짙은 회색 바탕 + 네모 판 (흰 꽃무늬 원 · 격자) 번갈아, 1장 = 2.2m (판 2개)
function bandMat(len) {
  const t = canvasTex('sj-band', 256, 104, (ctx, W, H) => {
    ctx.fillStyle = '#5b6066'
    ctx.fillRect(0, 0, W, H)
    for (let i = 0; i < 2; i += 1) {
      const x0 = i * 128 + 22
      const y0 = 14
      const s = 84
      ctx.fillStyle = '#9c5547' // 붉은 갈색 테
      ctx.fillRect(x0 - 5, y0 - 5, s + 10, s + 10)
      ctx.fillStyle = '#efe6d2'
      ctx.fillRect(x0, y0, s, s)
      if (i === 0) {
        // 흰 꽃무늬 원 (꽃잎 8장)
        ctx.fillStyle = '#d9c9a6'
        ctx.beginPath()
        ctx.arc(x0 + s / 2, y0 + s / 2, 30, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = '#fbf6ea'
        for (let k = 0; k < 8; k += 1) {
          const a = (k / 8) * Math.PI * 2
          ctx.beginPath()
          ctx.ellipse(x0 + s / 2 + Math.cos(a) * 15, y0 + s / 2 + Math.sin(a) * 15, 11, 6, a, 0, Math.PI * 2)
          ctx.fill()
        }
        ctx.fillStyle = '#c98f5a'
        ctx.beginPath()
        ctx.arc(x0 + s / 2, y0 + s / 2, 6, 0, Math.PI * 2)
        ctx.fill()
      } else {
        // 격자(창살) 무늬
        ctx.strokeStyle = '#8f8778'
        ctx.lineWidth = 4
        for (let k = 1; k < 6; k += 1) {
          ctx.beginPath(); ctx.moveTo(x0 + (k * s) / 6, y0 + 6); ctx.lineTo(x0 + (k * s) / 6, y0 + s - 6); ctx.stroke()
          ctx.beginPath(); ctx.moveTo(x0 + 6, y0 + (k * s) / 6); ctx.lineTo(x0 + s - 6, y0 + (k * s) / 6); ctx.stroke()
        }
      }
    }
  }, [len / 2.2, 1])
  return t ? new THREE.MeshStandardMaterial({ map: t, roughness: 0.8 }) : mat('#5b6066')
}

// 홍예 천장 단청: 짙은 청록 바탕에 구름 무늬 + 가운데 봉황 두 마리 (가운데 문) / 구름과 꽃 (양옆)
function ceilingMat(center) {
  const t = canvasTex(`sj-ceiling-${center ? 'c' : 's'}`, 256, 256, (ctx, W, H) => {
    const g = ctx.createLinearGradient(0, 0, W, 0)
    g.addColorStop(0, '#22433c')
    g.addColorStop(0.5, '#2c5b51')
    g.addColorStop(1, '#22433c')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, W, H)
    let seed = center ? 5 : 9
    const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
    // 구름 (흰·분홍 소용돌이)
    for (let k = 0; k < 16; k += 1) {
      const x = r() * W
      const y = r() * H
      ctx.strokeStyle = r() > 0.5 ? '#f4efe2' : '#f2b7a8'
      ctx.lineWidth = 4
      ctx.beginPath()
      ctx.arc(x, y, 10 + r() * 8, 0, Math.PI * 1.6)
      ctx.stroke()
      ctx.beginPath()
      ctx.arc(x + 16, y + 4, 7, Math.PI, Math.PI * 2.6)
      ctx.stroke()
    }
    if (center) {
      // 봉황 두 마리: 붉은 몸 + 노란·초록 꼬리깃
      for (const [cx, cy, dir] of [[W * 0.3, H * 0.5, 1], [W * 0.7, H * 0.5, -1]]) {
        ctx.fillStyle = '#c9402f'
        ctx.beginPath(); ctx.ellipse(cx, cy, 22, 12, 0.3 * dir, 0, Math.PI * 2); ctx.fill()
        ctx.fillStyle = '#e8b43c'
        ctx.beginPath(); ctx.arc(cx + 22 * dir, cy - 12, 7, 0, Math.PI * 2); ctx.fill()
        for (let k = 0; k < 5; k += 1) {
          ctx.strokeStyle = ['#e8b43c', '#3f9a6a', '#4f7fc4', '#c9402f', '#e8b43c'][k]
          ctx.lineWidth = 5
          ctx.beginPath()
          ctx.moveTo(cx - 18 * dir, cy + 4)
          ctx.quadraticCurveTo(cx - 50 * dir, cy + 30 - k * 10, cx - 80 * dir, cy + 40 - k * 16)
          ctx.stroke()
        }
      }
    } else {
      for (let k = 0; k < 6; k += 1) {
        const x = 30 + k * 40
        const y = 60 + (k % 2) * 120
        ctx.fillStyle = '#e8b43c'
        for (let p = 0; p < 6; p += 1) {
          const a = (p / 6) * Math.PI * 2
          ctx.beginPath(); ctx.ellipse(x + Math.cos(a) * 9, y + Math.sin(a) * 9, 7, 4, a, 0, Math.PI * 2); ctx.fill()
        }
        ctx.fillStyle = '#c9402f'
        ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI * 2); ctx.fill()
      }
    }
    ctx.strokeStyle = '#d8a43f'
    ctx.lineWidth = 6
    ctx.strokeRect(3, 3, W - 6, H - 6)
  })
  return t ? new THREE.MeshStandardMaterial({ map: t, roughness: 0.85, side: THREE.BackSide }) : mat('#2c5b51')
}

// 석축 모양: 네모에서 무지개문 3개를 뚫어 앞뒤로 늘려요 (ExtrudeGeometry, UV = 미터)
function baseGeometry() {
  const { w, d, h, arches } = GATE
  const s = new THREE.Shape()
  s.moveTo(-w / 2, 0)
  s.lineTo(w / 2, 0)
  s.lineTo(w / 2, h)
  s.lineTo(-w / 2, h)
  s.closePath()
  for (const a of arches) {
    const hole = new THREE.Path()
    hole.moveTo(a.x - a.hw, 0)
    hole.lineTo(a.x - a.hw, a.spring)
    hole.absarc(a.x, a.spring, a.hw, Math.PI, 0, true)
    hole.lineTo(a.x + a.hw, 0)
    hole.closePath()
    s.holes.push(hole)
  }
  const g = new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: false, curveSegments: 20 })
  g.translate(0, 0, -d / 2)
  return g
}
// 홍예석 고리 (문 둘레 돌 한 줄)
function ringGeometry(a, width = 0.42) {
  const s = new THREE.Shape()
  s.absarc(a.x, a.spring, a.hw + width, Math.PI, 0, true)
  s.lineTo(a.x + a.hw + width, a.spring - 0.25)
  s.lineTo(a.x + a.hw, a.spring - 0.25)
  s.absarc(a.x, a.spring, a.hw, 0, Math.PI, false)
  s.lineTo(a.x - a.hw - width, a.spring - 0.25)
  s.closePath()
  return new THREE.ExtrudeGeometry(s, { depth: 0.12, bevelEnabled: false, curveSegments: 20 })
}

// 홍예 모양 판 (막힌 문 메움용)
const fillCache = new Map()
function archFill(a) {
  const key = `${a.x}|${a.hw}|${a.spring}`
  if (fillCache.has(key)) return fillCache.get(key)
  const sh = new THREE.Shape()
  sh.moveTo(a.x - a.hw, 0)
  sh.lineTo(a.x - a.hw, a.spring)
  sh.absarc(a.x, a.spring, a.hw, Math.PI, 0, true)
  sh.lineTo(a.x + a.hw, 0)
  sh.closePath()
  const g = new THREE.ExtrudeGeometry(sh, { depth: 0.3, bevelEnabled: false, curveSegments: 16 })
  fillCache.set(key, g)
  return g
}
const RING = mat('#f1ece0', { roughness: 0.8 })
const DOOR = mat('#b23a2c', { roughness: 0.7 })
const BRASS = new THREE.MeshStandardMaterial({ color: '#c9a24a', roughness: 0.35, metalness: 0.6 })
const IRON = mat('#2b2a29', { roughness: 0.6 })
const P = mat('#ffffff', { roughness: 0.85 })
const UPLIGHT = mat('#fff1d0', { emissive: '#ffcf8a', emissiveIntensity: 0.9 })

export function Sukjeongmun({ position = [0, 0, 0] }) {
  const { w, d, h, band, arches } = GATE
  const base = useMemo(() => baseGeometry(), [])
  const rings = useMemo(() => arches.map((a) => ringGeometry(a, a.hw > 2 ? 0.5 : 0.4)), [arches])
  const stone = graniteMat()
  const { studs, bands, extras } = useMemo(() => {
    const studs = []
    const bands = []
    const extras = []
    for (const a of arches) {
      const leafH = a.spring + a.hw * 0.55
      if (a.blind) {
        // 막힌 옆문: 앞뒤 홍예 안쪽(0.7m 들어간 자리)에 닫힌 붉은 판문 두 짝 (뒤는 돌로 메움)
        for (const face of [-1, 1]) {
          const z = face * (d / 2 - 0.62)
          for (const side of [-1, 1]) {
            const x = a.x + side * (a.hw / 2)
            extras.push({ kind: 'door', p: [x, a.spring / 2 + 0.06, z], s: [a.hw - 0.04, a.spring, 0.12] })
            for (const yy of [0.25, 0.55, 0.85]) bands.push({ p: [x, a.spring * yy, z + face * 0.07], s: [a.hw - 0.12, 0.09, 0.02] })
            for (let row = 0; row < 6; row += 1) {
              for (let col = 0; col < 3; col += 1) {
                studs.push({ p: [x - (a.hw - 0.4) / 2 + col * ((a.hw - 0.4) / 2), 0.35 + row * (a.spring - 0.6) / 5, z + face * 0.075], s: [0.045, 0.045, 0.045] })
              }
            }
          }
        }
        for (const s of [-1, 1]) extras.push({ kind: 'key', p: [a.x, a.spring + a.hw + 0.32, s * (d / 2 + 0.07)], s: [0.55, 0.62, 0.16] })
        continue
      }
      // 문짝: 홍예 안 양쪽 벽으로 활짝 열린 붉은 판문 두 짝 (가운데 z = -0.2 근처에 경첩)
      for (const side of [-1, 1]) {
        const x = a.x + side * (a.hw - 0.09)
        const zc = -0.25 - a.hw / 2
        extras.push({ kind: 'door', p: [x, leafH / 2 + 0.06, zc], s: [0.12, leafH, a.hw - 0.05] })
        // 띠쇠 3줄 + 쇠못(정) 줄
        for (const yy of [0.25, 0.5, 0.78]) bands.push({ p: [x - side * 0.065, leafH * yy, zc], s: [0.02, 0.09, a.hw - 0.12] })
        for (let row = 0; row < 7; row += 1) {
          for (let col = 0; col < 4; col += 1) {
            studs.push({ p: [x - side * 0.075, 0.35 + row * (leafH - 0.6) / 6, zc - (a.hw - 0.3) / 2 + col * ((a.hw - 0.3) / 3)], s: [0.045, 0.045, 0.045] })
          }
        }
      }
      // 문지방 돌 + 홍예 앞뒤 바닥 디딤돌
      extras.push({ kind: 'stone', p: [a.x, 0.06, -0.25], s: [a.hw * 2, 0.12, 0.3] })
      for (const s of [-1, 1]) extras.push({ kind: 'stone', p: [a.x, 0.03, s * (d / 2 + 0.6)], s: [a.hw * 2 + 0.6, 0.06, 1.2] })
      // 홍예 꼭대기 이맛돌 (조각된 머리돌)
      for (const s of [-1, 1]) extras.push({ kind: 'key', p: [a.x, a.spring + a.hw + 0.32, s * (d / 2 + 0.07)], s: [0.55, 0.62, 0.16] })
    }
    // 석축 아래 장대석 받침 + 위 갓돌
    extras.push({ kind: 'stone', p: [0, 0.2, 0], s: [w + 0.4, 0.4, d + 0.4], hollow: true })
    // 누혈(돌 물받이): 무늬 띠 바로 아래 앞뒤로 튀어나온 짧은 돌
    for (let x = -w / 2 + 1.4; x <= w / 2 - 1.3; x += 2.2) {
      for (const s of [-1, 1]) extras.push({ kind: 'spout', p: [x, h - 0.35, s * (d / 2 + 0.22)], s: [0.32, 0.26, 0.45] })
    }
    return { studs, bands, extras }
  }, [arches, d, h, w])
  const doors = extras.filter((e) => e.kind === 'door')
  const stones = extras.filter((e) => e.kind === 'stone' && !e.hollow)
  const keys = extras.filter((e) => e.kind === 'key')
  const spouts = extras.filter((e) => e.kind === 'spout')
  // 문루 창호: 아래층 모든 칸 = 머름(초록) + 띠살 창호, 위층 = 격자 창호 두 짝씩
  const pavW = 15
  const pavD = 6.2
  const pavH = 2.6
  const windows = useMemo(() => {
    const W2 = pavW / 2 - 0.1
    const D2 = pavD / 2 - 0.1
    const nb = 5
    const colR = 0.11 + pavH * 0.016
    const xs = Array.from({ length: nb + 1 }, (_, i) => -W2 + (i * 2 * W2) / nb)
    const lower = []
    const merum = []
    for (const z of [-D2, D2]) {
      for (let i = 0; i < nb; i += 1) {
        const cx = (xs[i] + xs[i + 1]) / 2
        const bw = xs[i + 1] - xs[i] - colR * 2
        merum.push({ p: [cx, 0.3, z], s: [bw, 0.5, 0.1], c: '#3f7d5c' })
        lower.push({ p: [cx, 0.55 + (pavH - 1.0) / 2, z * 1.004], s: [bw, pavH - 1.0, 0.06] })
      }
    }
    // 위층 (HanokHall upper 치수와 같게: Wu = 0.72w, Du = 0.66d, hu = 0.42h, 높이 yU0)
    const Wu2 = (pavW * 0.72) / 2 - 0.1
    const Du2 = (pavD * 0.66) / 2 - 0.1
    const ov = Math.min(1.7, Math.max(0.75, pavD * 0.2 + 0.25))
    const RD = 2 * D2 + 2 * ov
    const yU0 = pavH + 0.5 + RD * 0.2 * 0.34
    const hu = pavH * 0.42
    const upper = []
    const xsU = Array.from({ length: 4 }, (_, i) => -Wu2 + (i * 2 * Wu2) / 3)
    for (const z of [-Du2, Du2]) {
      for (let i = 0; i < 3; i += 1) {
        const cx = (xsU[i] + xsU[i + 1]) / 2
        const bw = xsU[i + 1] - xsU[i] - 0.2
        for (const k of [-1, 1]) upper.push({ p: [cx + (k * bw) / 4, yU0 + hu * 0.42, z * 1.03], s: [bw / 2 - 0.04, hu * 0.7, 0.05] })
      }
    }
    return { lower, merum, upper }
  }, [])
  const ceilC = ceilingMat(true)
  const ceilS = ceilingMat(false)
  return (
    <group position={position}>
      {/* 석축 + 무지개문 */}
      <mesh geometry={base} material={stone} />
      {rings.map((g, i) => (
        <group key={i}>
          <mesh geometry={g} material={RING} position={[0, 0, -d / 2 - 0.12]} />
          <mesh geometry={g} material={RING} position={[0, 0, d / 2]} />
        </group>
      ))}
      {/* 막힌 옆문: 홍예 모양 돌판으로 안쪽을 메워요 (앞뒤) */}
      {arches.filter((a) => a.blind).map((a, i) => (
        <group key={`fill${i}`}>
          {[-1, 1].map((face) => (
            <mesh key={face} geometry={archFill(a)} material={stone} position={[0, 0, face * (d / 2 - 0.55) - 0.15]} />
          ))}
        </group>
      ))}
      {/* 홍예 안 천장 그림 (드나드는 가운데 문만) */}
      {arches.filter((a) => !a.blind).map((a, i) => (
        <mesh key={i} position={[a.x, a.spring, 0]} rotation={[Math.PI / 2, 0, 0]} material={a.hw > 2 ? ceilC : ceilS}>
          <cylinderGeometry args={[a.hw - 0.02, a.hw - 0.02, d - 0.04, 24, 1, true, Math.PI / 2, Math.PI]} />
        </mesh>
      ))}
      {/* 받침 장대석 (앞뒤·옆 테두리) */}
      {[[0, -d / 2 - 0.15, w + 0.5, 0.3], [0, d / 2 + 0.15, w + 0.5, 0.3]].map(([x, z, sx, sz], i) => (
        <mesh key={i} geometry={GEO.box} material={P} position={[x, 0.2, z]} scale={[sx, 0.4, sz]}>
          <meshStandardMaterial color="#bdb6a6" roughness={0.9} />
        </mesh>
      ))}
      <Instances geometry={GEO.box} material={DOOR} items={doors} />
      <Instances geometry={GEO.box} material={IRON} items={bands} />
      <Instances geometry={GEO.sphere} material={BRASS} items={studs} />
      <Instances geometry={GEO.box} material={P} items={stones.map((s) => ({ ...s, c: '#c9c2b2' }))} />
      <Instances geometry={GEO.box} material={P} items={keys.map((s) => ({ ...s, c: '#f6f1e6' }))} />
      <Instances geometry={GEO.box} material={P} items={spouts.map((s) => ({ ...s, c: '#bdb6a6' }))} />
      {/* 무늬 띠 (회색 바탕 네모 판) + 위 갓돌 */}
      <mesh geometry={GEO.box} material={bandMat(w - 0.4)} position={[0, h + band / 2, 0]} scale={[w - 0.4, band, d - 0.4]} />
      <mesh geometry={GEO.box} position={[0, h + band + 0.075, 0]} scale={[w + 0.1, 0.15, d + 0.1]}>
        <meshStandardMaterial color="#ddd6c6" roughness={0.85} />
      </mesh>
      {/* 2층 문루 */}
      <group position={[0, GATE_TOP, 0]}>
        <HanokHall width={pavW} depth={pavD} height={pavH} bays={5} sideBays={3} base={0} mode="open" roof="hip" upper japsang={7} title="肅靖門" />
        <Instances geometry={GEO.box} material={P} items={windows.merum} />
        <Instances geometry={GEO.box} material={latticeMat('tti', '#3f7d5c', '#a0392c')} items={windows.lower} />
        <Instances geometry={GEO.box} material={latticeMat('jeongja', '#3f7d5c', '#a0392c')} items={windows.upper} />
        {/* 문루 마루 (석축 위 바닥) */}
        <mesh geometry={GEO.box} position={[0, 0.03, 0]} scale={[pavW + 0.6, 0.06, pavD + 0.6]}>
          <meshStandardMaterial color="#8f7a62" roughness={0.9} />
        </mesh>
      </group>
      {/* 밤 조명: 석축을 아래에서 비추는 등 + 가운데 홍예 안 불빛 */}
      {[-9, -3, 3, 9].map((x) => (
        <mesh key={x} geometry={GEO.box} material={UPLIGHT} position={[x, 0.12, -d / 2 - 1.1]} scale={[0.5, 0.18, 0.3]} />
      ))}
    </group>
  )
}
