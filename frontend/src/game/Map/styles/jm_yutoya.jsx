import { useMemo } from 'react'
import * as THREE from 'three'
import { hipRoofGeometry } from './geometry.js'
import { Ball, Box, Cyl, GEO, Instances, mat, texMat } from './kit.jsx'
import { canvasTexture, getJpSignTexture, GlowMaterial } from './jm_landmarks.jsx'
import { JmGrandBridge } from './jm_kyoto.jsx'

// 애니메이션 구역(JM) 큰 여관 「湯灯屋」 (11/25 다시 지음) — 담당: 지민
// 참고: 지민이 보낸 사진들
//   외관: 붉은 벽 + 회색 격자창, 층마다 초록 기와 처마, 정면 가운데 둥근 박공(가라하후) 현관과 금색 현판, 지붕 위 누각·금 장식, 굴뚝, 큰 소나무
//   안: 가운데가 꼭대기까지 뚫린 높은 홀, 홀 뒤 가운데 화려한 누각(보라 휘장·붉은 문·초록 둥근 지붕·금 현판·붉은 기둥·용 장식),
//       층마다 붉은 난간 회랑 + 금색 꽃 패널, 금 원형 격자 천장과 둥근 등 샹들리에, 홀을 가로지르는 붉은 아치 다리, 1층 탕 칸막이 사이 가운데 길, 맨 위 연회장
// 간판 글자는 우리 것(湯灯屋·天楽·帳場·宴会場)만 쓰고, 캐릭터는 넣지 않음
// 걷는 판정(바닥판·벽·난간·계단·누각·가구)은 생성 스크립트(gen-jm-kyoto.mjs 7-5)가 item.yutoya와 같은 값으로 깔고, 여기서는 그림만
// 로컬 좌표: 건물 가운데, +z = 정면, y = 앞마당 바닥

const RED = '#b9443a'
const RED_DARK = '#7d2a22'
const VERM = '#d2412a'
const GREEN = '#3f7a5c'
const GREEN_DARK = '#2c5a43'
const GOLD = '#d4a83e'
const DARK = '#2a1a14'
const WOOD = '#8a5a3a'
const STONE = '#9d978c'

const range = (n) => Array.from({ length: n }, (_, i) => i)
const GOLD_M = mat(GOLD, { metalness: 0.45, roughness: 0.4 })
const GLOBE = mat('#fff6e0', { emissive: '#ffd99a', emissiveIntensity: 1.4, roughness: 0.4 })
const SHOJI_M = mat('#ffeccc', { emissive: '#ffbf6e', emissiveIntensity: 0.6, roughness: 0.7 })
const WATER = mat('#86c9c9', { transparent: true, opacity: 0.85, emissive: '#1d5a5e', emissiveIntensity: 0.3, roughness: 0.05 })
const CURTAIN = mat('#6e2c78', { roughness: 0.9 })
const CURTAIN_DARK = mat('#4f1d58', { roughness: 0.9 })

// ── 캔버스 그림 ─────────────────────────────
// 금 원형 격자 천장 한 칸 (붉은 틀 + 금 원 + 안쪽 꽃무늬). 반복해서 깖
function cofferTexture() {
  const tex = canvasTexture('yu-coffer', 128, 128, (ctx, w, h) => {
    ctx.fillStyle = '#4a1410'
    ctx.fillRect(0, 0, w, h)
    ctx.fillStyle = '#7a2218'
    ctx.fillRect(8, 8, w - 16, h - 16)
    ctx.strokeStyle = '#d4a83e'
    ctx.lineWidth = 3
    ctx.strokeRect(10, 10, w - 20, h - 20)
    const g = ctx.createRadialGradient(64, 60, 6, 64, 64, 42)
    g.addColorStop(0, '#f6dc8a')
    g.addColorStop(1, '#b8862a')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(64, 64, 40, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = '#6b4512'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(64, 64, 32, 0, Math.PI * 2)
    ctx.stroke()
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2
      ctx.fillStyle = i % 2 ? '#2f7a5c' : '#b8322a'
      ctx.beginPath()
      ctx.ellipse(64 + Math.cos(a) * 18, 64 + Math.sin(a) * 18, 7, 4, a, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.fillStyle = '#fff2c0'
    ctx.beginPath()
    ctx.arc(64, 64, 6, 0, Math.PI * 2)
    ctx.fill()
    // 칸 모서리 금 별
    ctx.fillStyle = '#e6c25a'
    for (const [x, y] of [[0, 0], [w, 0], [0, h], [w, h]]) {
      ctx.beginPath()
      ctx.arc(x, y, 6, 0, Math.PI * 2)
      ctx.fill()
    }
  })
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  return tex
}

// 금색 꽃 패널 n칸 (회랑 앞판·연회장 띠). 칸마다 둥근 꽃 화환
const WREATH = [
  ['#c23b3b', '#e48a8a'],
  ['#3b6fc2', '#8ab0e4'],
  ['#8a3bc2', '#c89ae4'],
  ['#d9822b', '#f2c27a'],
  ['#2f8a5c', '#9ad4a8'],
]
function flowerPanelTexture(n) {
  return canvasTexture(`yu-flower:${n}`, 160 * n, 96, (ctx, w, h) => {
    ctx.fillStyle = '#3a1a10'
    ctx.fillRect(0, 0, w, h)
    for (let i = 0; i < n; i++) {
      const x0 = i * 160
      ctx.fillStyle = '#e8c45a'
      ctx.fillRect(x0 + 5, 5, 150, h - 10)
      ctx.strokeStyle = '#a77a22'
      ctx.lineWidth = 2
      ctx.strokeRect(x0 + 9, 9, 142, h - 18)
      const [c1, c2] = WREATH[i % WREATH.length]
      const cx = x0 + 80
      const cy = h / 2
      for (let k = 0; k < 14; k++) {
        const a = (k / 14) * Math.PI * 2
        ctx.fillStyle = '#4f8a3a'
        ctx.beginPath()
        ctx.ellipse(cx + Math.cos(a) * 30, cy + Math.sin(a) * 30, 8, 3.5, a + 0.8, 0, Math.PI * 2)
        ctx.fill()
      }
      for (let k = 0; k < 9; k++) {
        const a = (k / 9) * Math.PI * 2 + 0.3
        ctx.fillStyle = k % 2 ? c1 : c2
        ctx.beginPath()
        ctx.arc(cx + Math.cos(a) * 29, cy + Math.sin(a) * 29, 6.5, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.fillStyle = c1
      ctx.beginPath()
      ctx.arc(cx, cy, 9, 0, Math.PI * 2)
      ctx.fill()
    }
  })
}

// 회색 격자창 (바깥 창)
function latticeTexture() {
  const tex = canvasTexture('yu-lattice', 128, 128, (ctx, w, h) => {
    ctx.fillStyle = '#cfcabd'
    ctx.fillRect(0, 0, w, h)
    ctx.strokeStyle = '#4a4440'
    ctx.lineWidth = 4
    for (let i = 0; i <= 4; i++) {
      ctx.beginPath()
      ctx.moveTo((i * w) / 4, 0)
      ctx.lineTo((i * w) / 4, h)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(0, (i * h) / 4)
      ctx.lineTo(w, (i * h) / 4)
      ctx.stroke()
    }
  })
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  return tex
}

// 1층 옆벽 소나무 벽화
function pineMuralTexture() {
  return canvasTexture('yu-pine', 1024, 384, (ctx, w, h) => {
    ctx.fillStyle = '#e6d3a3'
    ctx.fillRect(0, 0, w, h)
    ctx.strokeStyle = 'rgba(160,120,60,0.25)'
    for (let x = 0; x < w; x += 6) {
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, h)
      ctx.stroke()
    }
    const pine = (bx, s) => {
      ctx.strokeStyle = '#6b4a2e'
      ctx.lineWidth = 22 * s
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.moveTo(bx, h)
      ctx.bezierCurveTo(bx + 60 * s, h - 120 * s, bx - 70 * s, h - 200 * s, bx + 40 * s, h - 300 * s)
      ctx.stroke()
      ctx.lineWidth = 9 * s
      for (const [dx, dy, ex, ey] of [[0, -170, 160, -210], [10, -230, -150, -260], [30, -290, 170, -320]]) {
        ctx.beginPath()
        ctx.moveTo(bx + dx * s, h + dy * s)
        ctx.quadraticCurveTo(bx + (dx + ex) * 0.5 * s, h + (dy - 40) * s, bx + ex * s, h + ey * s)
        ctx.stroke()
      }
      for (const [dx, dy, r] of [[160, -215, 70], [-150, -262, 64], [170, -322, 60], [40, -320, 58], [-40, -200, 50]]) {
        ctx.fillStyle = '#5f9a5a'
        ctx.beginPath()
        ctx.ellipse(bx + dx * s, h + dy * s, r * s, r * 0.45 * s, 0, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = '#7fb874'
        ctx.beginPath()
        ctx.ellipse(bx + dx * s, h + (dy - 8) * s, r * 0.8 * s, r * 0.28 * s, 0, 0, Math.PI * 2)
        ctx.fill()
      }
    }
    pine(260, 1)
    pine(760, 0.9)
  })
}

// 누각 꼭대기 용 장식 판 (금 바탕 + 초록 구불구불 용 + 붉은 구슬)
function dragonTexture() {
  return canvasTexture('yu-dragon', 512, 128, (ctx, w, h) => {
    ctx.fillStyle = '#c99a32'
    ctx.fillRect(0, 0, w, h)
    ctx.strokeStyle = '#7a5a14'
    ctx.lineWidth = 6
    ctx.strokeRect(6, 6, w - 12, h - 12)
    ctx.strokeStyle = '#2f7a4a'
    ctx.lineWidth = 18
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(30, 80)
    for (let x = 30; x <= w - 30; x += 8) ctx.lineTo(x, 64 + Math.sin(x / 26) * 22)
    ctx.stroke()
    ctx.strokeStyle = '#7fc48a'
    ctx.lineWidth = 5
    ctx.stroke()
    ctx.fillStyle = '#d0402e'
    ctx.beginPath()
    ctx.arc(w / 2, 52, 22, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#f2a07a'
    ctx.beginPath()
    ctx.arc(w / 2 - 6, 46, 7, 0, Math.PI * 2)
    ctx.fill()
  })
}

// 나무 마루 (판자 줄)
function plankTexture() {
  const tex = canvasTexture('yu-plank', 128, 128, (ctx, w, h) => {
    ctx.fillStyle = '#8a5a3a'
    ctx.fillRect(0, 0, w, h)
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = i % 2 ? '#93623f' : '#82543a'
      ctx.fillRect(0, (i * h) / 4 + 1, w, h / 4 - 2)
    }
    ctx.fillStyle = '#5a3a24'
    for (let i = 0; i < 4; i++) ctx.fillRect((i % 2) * 64 + 20, (i * h) / 4, 2, h / 4)
  })
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  return tex
}

// 반복 텍스처를 면 크기에 맞춰 (같은 그림을 공유하면서 반복 수만 다르게)
function tiled(base, rx, ry, ox = 0, oy = 0) {
  const t = base.clone()
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(rx, ry)
  t.offset.set(ox, oy)
  t.needsUpdate = true
  return t
}

// ── 둥근 박공(가라하후) 지붕: 앞에서 보면 가운데가 솟고 양 끝이 살짝 들린 곡선, 깊이 방향으로 뽑아냄 ──
function karahafuShape(w, h, thick) {
  const top = (u) => h * (0.86 * (1 - Math.pow(Math.abs(u), 1.7)) + 0.22 * Math.pow(Math.abs(u), 10))
  const s = new THREE.Shape()
  const n = 24
  for (let i = 0; i <= n; i++) {
    const u = -1 + (2 * i) / n
    const p = [(u * w) / 2, top(u)]
    if (i === 0) s.moveTo(...p)
    else s.lineTo(...p)
  }
  for (let i = n; i >= 0; i--) {
    const u = -1 + (2 * i) / n
    s.lineTo((u * w) / 2 * 0.96, top(u) - thick)
  }
  return { shape: s, top }
}
function Karahafu({ w, h, depth, color = GREEN, p = [0, 0, 0], board = true, sign }) {
  const { roof, face, top } = useMemo(() => {
    const { shape, top } = karahafuShape(w, h, 0.35)
    const roof = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false })
    roof.translate(0, 0, -depth / 2)
    // 박공 앞 판 (곡선 아래 면)
    const f = new THREE.Shape()
    f.moveTo(-w * 0.44, 0)
    for (let i = 0; i <= 20; i++) {
      const u = -0.88 + (1.76 * i) / 20
      f.lineTo((u * w) / 2, top(u) - 0.36)
    }
    f.lineTo(w * 0.44, 0)
    return { roof, face: new THREE.ShapeGeometry(f), top }
  }, [w, h, depth])
  return (
    <group position={p}>
      <mesh geometry={roof} castShadow>
        <meshStandardMaterial color={color} flatShading side={THREE.DoubleSide} />
      </mesh>
      {board && (
        <mesh geometry={face} position={[0, 0, depth / 2 - 0.25]}>
          <meshStandardMaterial color="#e2c06a" metalness={0.3} roughness={0.5} side={THREE.DoubleSide} />
        </mesh>
      )}
      {/* 박공 금 테두리 + 꼭대기 금 장식 */}
      <Box p={[0, top(0) + 0.05, depth / 2 + 0.02]} s={[0.5, 0.25, 0.1]} m={GOLD_M} />
      {[-1, 1].map((s) => (
        <Box key={s} p={[(s * w) / 2 * 0.95, top(0.95) - 0.1, depth / 2 + 0.02]} s={[0.3, 0.3, 0.1]} m={GOLD_M} />
      ))}
      {sign && (
        <group position={[0, h * 0.32, depth / 2 - 0.18]}>
          <Box p={[0, 0, -0.04]} s={[sign.w + 0.2, sign.h + 0.2, 0.08]} c={DARK} />
          <mesh>
            <planeGeometry args={[sign.w, sign.h]} />
            <GlowMaterial glow={0.55} map={getJpSignTexture(sign.text, '#2b1a12', '#e8c35a', sign.w / sign.h)} side={THREE.DoubleSide} />
          </mesh>
        </group>
      )}
    </group>
  )
}

// 처마 (벽 바깥으로 비스듬히 내민 판 4장)
function Eave({ w, d, y, out = 1.1, color = GREEN }) {
  const tilt = 0.42
  const m = mat(color, { flat: true })
  return (
    <group>
      {[-1, 1].map((s) => (
        <group key={s}>
          <mesh geometry={GEO.box} material={m} position={[0, y - Math.sin(tilt) * out * 0.5, s * (d / 2 + Math.cos(tilt) * out * 0.5)]} rotation={[s * tilt, 0, 0]} scale={[w + out * 2, 0.14, out]} />
          <mesh geometry={GEO.box} material={m} position={[s * (w / 2 + Math.cos(tilt) * out * 0.5), y - Math.sin(tilt) * out * 0.5, 0]} rotation={[0, 0, -s * tilt]} scale={[out, 0.14, d]} />
        </group>
      ))}
    </group>
  )
}

// 둥근 등 샹들리에 (가운데 하나 + 둘레 여럿)
function Chandelier({ p, drop = 1.6, r = 0.55, n = 6, scale = 1 }) {
  return (
    <group position={p} scale={scale}>
      <Cyl p={[0, -drop / 2, 0]} rad={0.025} h={drop} c={DARK} />
      <Cyl p={[0, -drop, 0]} rad={r} h={0.04} m={GOLD_M} />
      <Ball p={[0, -drop - 0.2, 0]} rad={0.2} m={GLOBE} />
      {range(n).map((i) => {
        const a = (i / n) * Math.PI * 2
        return <Ball key={i} p={[Math.cos(a) * r, -drop - 0.12, Math.sin(a) * r]} rad={0.16} m={GLOBE} />
      })}
    </group>
  )
}

// 큰 소나무 (구불구불한 줄기 + 납작한 구름 모양 잎 덩어리)
function Pine({ p, s = 1, flip = 1 }) {
  const trunk = mat('#5b4232', { flat: true })
  const leaf = mat('#3f7344', { flat: true })
  const leaf2 = mat('#5a9256', { flat: true })
  const pads = [[0.4, 4.2, 0, 2.2], [-1.6, 5.4, 0.3, 1.9], [1.4, 6.3, -0.2, 2.0], [-0.4, 7.4, 0.2, 1.7], [2.2, 4.8, 0.4, 1.4]]
  return (
    <group position={p} scale={[s * flip, s, s]}>
      <mesh geometry={GEO.cyl8} material={trunk} position={[0.1, 1.2, 0]} scale={[0.32, 2.4, 0.32]} rotation={[0, 0, 0.12]} />
      <mesh geometry={GEO.cyl8} material={trunk} position={[-0.1, 3.4, 0]} scale={[0.26, 2.4, 0.26]} rotation={[0, 0, -0.25]} />
      <mesh geometry={GEO.cyl8} material={trunk} position={[0.3, 5.6, 0]} scale={[0.2, 2.6, 0.2]} rotation={[0, 0, 0.18]} />
      <mesh geometry={GEO.cyl8} material={trunk} position={[1.0, 4.5, 0]} scale={[0.12, 2.2, 0.12]} rotation={[0, 0, -1.1]} />
      <mesh geometry={GEO.cyl8} material={trunk} position={[-0.9, 5.2, 0]} scale={[0.12, 2.0, 0.12]} rotation={[0, 0, 1.0]} />
      {pads.map(([x, y, z, r], i) => (
        <group key={i} position={[x, y, z]}>
          <mesh geometry={GEO.sphere} material={leaf} scale={[r, r * 0.38, r * 0.9]} />
          <mesh geometry={GEO.sphere} material={leaf2} position={[0, 0.22, 0]} scale={[r * 0.8, r * 0.22, r * 0.7]} />
        </group>
      ))}
    </group>
  )
}

// ── 본체 ───────────────────────────────────
export function JmYutoya({ item }) {
  const [W, , D] = item.size
  const Y = item.yutoya
  const sign = item.signs?.[0]?.text ?? '湯灯屋'
  return (
    <group>
      <YuExterior W={W} D={D} Y={Y} sign={sign} />
      <YuGroundHall W={W} D={D} Y={Y} />
      <YuFloors W={W} D={D} Y={Y} />
      <YuPavilion Y={Y} />
      <YuInnerBridge Y={Y} />
      <YuBanquet W={W} D={D} Y={Y} />
    </group>
  )
}

// ── 외관 ───────────────────────────────────
function YuExterior({ W, D, Y, sign }) {
  const { lv, wt, base, door, doorH } = Y
  const R = lv[5]
  const roof = useMemo(() => hipRoofGeometry(W + 2.6, D + 2.6, 4.2, 0.6), [W, D])
  const towerRoof = useMemo(() => hipRoofGeometry(15.5, 12, 3.4, 0.5), [])
  const crownRoof = useMemo(() => hipRoofGeometry(5.6, 5, 2.2, 0.35), [])
  const lattice = useMemo(() => latticeTexture(), [])
  const side = (W - door) / 2
  const front = D / 2
  const windows = useMemo(() => {
    // 층마다 바깥 격자창 띠 (앞·뒤·옆). 정면 가운데 내민 칸 자리(|x| < 4.8)는 비움
    const out = []
    for (let k = 1; k < 5; k++) {
      const y0 = lv[k]
      const h = (lv[k + 1] - lv[k]) * 0.52
      const y = y0 + (lv[k + 1] - lv[k]) * 0.5
      for (const [sx, len] of [[-(W / 2 + 4.8) / 2, W / 2 - 4.8 - 0.6], [(W / 2 + 4.8) / 2, W / 2 - 4.8 - 0.6]]) out.push({ p: [sx, y, front + 0.03], s: [len, h], r: 0 })
      out.push({ p: [0, y, -front - 0.03], s: [W - 1.2, h], r: Math.PI })
      for (const s of [-1, 1]) out.push({ p: [s * (W / 2 + 0.03), y, 0], s: [D - 1.2, h], r: (s * Math.PI) / 2 })
    }
    // 1층: 현관 양옆 창
    for (const s of [-1, 1]) out.push({ p: [s * (door / 2 + side / 2), base + 2.6, front + 0.03], s: [side - 2.2, 1.6], r: 0 })
    return out
  }, [lv, W, D, front, door, side, base])
  return (
    <group>
      {/* 돌 기단 + 앞 돌계단 */}
      <Box p={[0, base / 2, 0]} s={[W + 1, base, D + 1]} c={STONE} />
      {range(3).map((i) => (
        <Box key={i} p={[0, 0.1 + i * 0.2, front + 1.7 - i * 0.4]} s={[9, 0.2, 0.4]} c="#b5ad9f" />
      ))}
      {/* 바깥 벽 (안쪽 면은 각 층 그림이 덮음) */}
      <Box p={[0, (base + R) / 2, -front + wt / 2]} s={[W, R - base, wt]} c={RED} />
      {[-1, 1].map((s) => (
        <group key={s}>
          <Box p={[s * (W / 2 - wt / 2), (base + R) / 2, 0]} s={[wt, R - base, D]} c={RED} />
          <Box p={[s * (door / 2 + side / 2), (base + R) / 2, front - wt / 2]} s={[side, R - base, wt]} c={RED} />
        </group>
      ))}
      <Box p={[0, (base + doorH + R) / 2, front - wt / 2]} s={[door, R - base - doorH, wt]} c={RED} />
      {/* 1층 아래 짙은 나무 띠 + 모서리 기둥 */}
      <Box p={[0, base + 0.5, front + 0.02]} s={[W, 1, 0.05]} c={DARK} />
      {[-1, 1].map((sx) => [-1, 1].map((sz) => <Box key={`${sx}${sz}`} p={[sx * (W / 2 - 0.1), (base + R) / 2, sz * (front - 0.1)]} s={[0.4, R - base, 0.4]} c={RED_DARK} />))}
      {/* 격자창 */}
      {windows.map((w, i) => (
        <mesh key={i} position={w.p} rotation={[0, w.r, 0]}>
          <planeGeometry args={w.s} />
          <primitive object={texMat(tiled(lattice, Math.max(1, Math.round(w.s[0] / 0.9)), Math.max(1, Math.round(w.s[1] / 0.9))))} attach="material" />
        </mesh>
      ))}
      {/* 층마다 초록 처마 + 3층·5층 앞 붉은 발코니 난간 */}
      {[1, 2, 3, 4].map((k) => (
        <Eave key={k} w={W} d={D} y={lv[k] - 0.05} out={k === 1 ? 1.5 : 1.1} />
      ))}
      {[2, 4].map((k) => (
        <group key={`bal${k}`} position={[0, lv[k], front + 0.55]}>
          <Box p={[0, 0.05, -0.2]} s={[W - 1, 0.1, 0.8]} c={WOOD} />
          <Box p={[0, 1.0, 0.15]} s={[W - 1, 0.1, 0.1]} c={VERM} />
          <Box p={[0, 0.5, 0.15]} s={[W - 1, 0.06, 0.06]} c={VERM} />
          {range(16).map((i) => (
            <Box key={i} p={[-W / 2 + 0.6 + (i * (W - 1.2)) / 15, 0.5, 0.15]} s={[0.1, 1.0, 0.1]} c={VERM} />
          ))}
        </group>
      ))}
      {/* 정면 가운데 내민 칸 (2층~4층) + 칸 위 둥근 박공들 */}
      <group position={[0, 0, front]}>
        <Box p={[0, (lv[1] + lv[4]) / 2, 0.6]} s={[9, lv[4] - lv[1], 1.2]} c={RED} />
        {[1, 2, 3].map((k) => (
          <mesh key={k} position={[0, lv[k] + (lv[k + 1] - lv[k]) * 0.5, 1.23]}>
            <planeGeometry args={[7.6, (lv[k + 1] - lv[k]) * 0.55]} />
            <primitive object={texMat(tiled(lattice, 8, 2))} attach="material" />
          </mesh>
        ))}
        <Karahafu p={[0, lv[2] + 0.1, 1.2]} w={8.6} h={1.5} depth={2.2} board={false} />
        <Karahafu p={[0, lv[4] - 0.05, 1.0]} w={10.4} h={2.2} depth={3.2} />
        {/* 현관 위 큰 둥근 박공 + 기둥 2개 + 금 현판 */}
        <Karahafu p={[0, base + doorH + 0.9, 1.6]} w={7.4} h={2.0} depth={3.4} sign={{ text: sign, w: 3.6, h: 1.0 }} />
        {[-1, 1].map((s) => (
          <group key={s}>
            <Cyl p={[s * 3.2, base + (doorH + 0.9) / 2, 3.0]} rad={0.22} h={doorH + 0.9} c={VERM} />
            <Box p={[s * 3.2, base + 0.15, 3.0]} s={[0.6, 0.3, 0.6]} c={STONE} />
          </group>
        ))}
        <Box p={[0, base + doorH + 0.85, 3.0]} s={[6.8, 0.3, 0.3]} c={VERM} />
        {/* 문 안 어둠 + ゆ 노렌 */}
        <Box p={[0, base + doorH / 2, -wt - 0.05]} s={[door, doorH, 0.04]} c="#1a1210" />
        <mesh position={[0, base + doorH - 0.75, 0.04]}>
          <planeGeometry args={[door - 0.1, 1.3]} />
          <GlowMaterial glow={0.3} map={getJpSignTexture('ゆ', '#2b4f8a', '#f5f0e6', (door - 0.1) / 1.3)} side={THREE.DoubleSide} />
        </mesh>
      </group>
      {/* 큰 지붕 */}
      <Box p={[0, R + 0.15, 0]} s={[W, 0.3, D]} c={RED_DARK} />
      <mesh geometry={roof} position={[0, R + 0.3, 0]}>
        <meshStandardMaterial color={GREEN} flatShading side={THREE.DoubleSide} />
      </mesh>
      {/* 지붕 위 누각: 붉은 몸체 + 격자창 + 발코니 + 초록 지붕 + 금 꼭대기 */}
      <group position={[0, R + 2.6, -1]}>
        <Box p={[0, 2.4, 0]} s={[13, 4.8, 10]} c={RED} />
        <mesh position={[0, 2.6, 5.03]}>
          <planeGeometry args={[11.6, 2.4]} />
          <primitive object={texMat(tiled(lattice, 12, 3))} attach="material" />
        </mesh>
        <Box p={[0, 0.9, 5.45]} s={[13, 0.08, 0.9]} c={WOOD} />
        <Box p={[0, 1.8, 5.85]} s={[13, 0.1, 0.1]} c={VERM} />
        {range(12).map((i) => (
          <Box key={i} p={[-6.3 + (i * 12.6) / 11, 1.35, 5.85]} s={[0.08, 0.9, 0.08]} c={VERM} />
        ))}
        <mesh geometry={towerRoof} position={[0, 4.8, 0]}>
          <meshStandardMaterial color={GREEN} flatShading side={THREE.DoubleSide} />
        </mesh>
        <Karahafu p={[0, 4.6, 5.2]} w={6.4} h={1.6} depth={1.6} />
        {/* 용마루 양 끝 금 장식 */}
        {[-1, 1].map((s) => (
          <group key={s} position={[s * 1.9, 8.2, 0]}>
            <Cyl p={[0, 0.3, 0]} rad={0.25} h={0.6} m={GOLD_M} />
            <Ball p={[0, 0.75, 0]} rad={0.3} m={GOLD_M} />
          </group>
        ))}
        <group position={[0, 7.6, 0]}>
          <Box p={[0, 0.9, 0]} s={[3.6, 1.8, 3.2]} c={RED} />
          <mesh geometry={crownRoof} position={[0, 1.8, 0]}>
            <meshStandardMaterial color={GOLD} metalness={0.45} roughness={0.4} flatShading side={THREE.DoubleSide} />
          </mesh>
          <Cyl p={[0, 4.3, 0]} rad={0.15} h={0.8} m={GOLD_M} />
          <Ball p={[0, 4.85, 0]} rad={0.28} m={GOLD_M} />
        </group>
      </group>
      {/* 굴뚝 + 깃발 (건물 왼쪽 앞) */}
      <group position={[-W / 2 - 1.6, 0, front - 3]}>
        <Cyl p={[0, 15, 0]} rad={0.7} h={30} c="#8b8580" />
        <Cyl p={[0, 30.2, 0]} rad={0.85} h={0.5} c="#3d3834" />
        {[8, 16, 24].map((y) => (
          <Cyl key={y} p={[0, y, 0]} rad={0.75} h={0.2} c="#5f5a55" />
        ))}
        <Cyl p={[0.9, 20, 0]} rad={0.05} h={4} c={DARK} />
        <mesh position={[1.9, 20.9, 0]}>
          <planeGeometry args={[1.8, 1.6]} />
          <GlowMaterial glow={0.25} map={getJpSignTexture('湯', '#f5f0e6', '#2b1a12', 1.8 / 1.6)} side={THREE.DoubleSide} />
        </mesh>
      </group>
      {/* 현관 옆 큰 소나무 */}
      <Pine p={[11.2, base, front + 2.6]} s={1.15} />
      <Pine p={[-11.2, base, front + 2.4]} s={1.0} flip={-1} />
    </group>
  )
}

// ── 1층 큰 홀: 나무 마루, 가운데 붉은 길과 등불, 양옆 탕 칸, 앞쪽 접수대 ──
function YuGroundHall({ W, D, Y }) {
  const { base, wt, stalls: st, pav, lv } = Y
  const ix = W / 2 - wt
  const iz = D / 2 - wt
  const H = lv[1] - base
  const planks = useMemo(() => tiled(plankTexture(), (ix * 2) / 1.6, (iz * 2) / 1.6), [ix, iz])
  const pine = useMemo(() => pineMuralTexture(), [])
  const lamps = useMemo(() => {
    const out = []
    for (let z = iz - 2.2; z > pav.z1 + 0.6; z -= 2.2) for (const s of [-1, 1]) out.push([s * 1.55, z])
    return out
  }, [iz, pav.z1])
  const partitions = useMemo(() => {
    const items = []
    for (const s of [-1, 1]) {
      items.push({ p: [s * st.x1, base + 0.75, (st.z[0] + st.z[3]) / 2], s: [0.12, 1.5, st.z[0] - st.z[3]] })
      for (const z of st.z) items.push({ p: [(s * (st.x0 + st.x1)) / 2, base + 0.75, z], s: [st.x1 - st.x0, 1.5, 0.12] })
    }
    return items
  }, [st, base])
  return (
    <group>
      {/* 마루 */}
      <mesh position={[0, base + 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[ix * 2, iz * 2]} />
        <primitive object={texMat(planks)} attach="material" />
      </mesh>
      {/* 가운데 붉은 길 + 금 테 */}
      <Box p={[0, base + 0.03, (iz + pav.z1) / 2]} s={[2.2, 0.02, iz - pav.z1]} c="#8f2a24" />
      {[-1, 1].map((s) => (
        <Box key={s} p={[s * 1.12, base + 0.035, (iz + pav.z1) / 2]} s={[0.06, 0.02, iz - pav.z1]} m={GOLD_M} />
      ))}
      {/* 길가 등불 기둥 */}
      {lamps.map(([x, z]) => (
        <group key={`${x}${z}`} position={[x, base, z]}>
          <Cyl p={[0, 0.65, 0]} rad={0.05} h={1.3} c={DARK} />
          <Ball p={[0, 1.42, 0]} rad={0.2} m={GLOBE} />
        </group>
      ))}
      {/* 탕 칸막이 (연초록 판 + 짙은 테) + 나무 욕조 */}
      <Instances geometry={GEO.box} material={mat('#9dbf94', { roughness: 0.8 })} items={partitions} castShadow />
      <Instances geometry={GEO.box} material={mat('#4f6b45')} items={partitions.map((it) => ({ p: [it.p[0], base + 1.52, it.p[2]], s: [it.s[0] + 0.04, 0.06, it.s[2] + 0.04] }))} />
      {[-1, 1].flatMap((s) =>
        range(3).map((k) => (
          <group key={`${s}${k}`} position={[(s * (st.x0 + st.x1)) / 2 + s * 0.2, base, (st.z[k] + st.z[k + 1]) / 2]}>
            <Cyl p={[0, 0.37, 0]} rad={0.85} h={0.74} c="#a0703f" geo={GEO.cyl48} />
            <Cyl p={[0, 0.7, 0]} rad={0.78} h={0.02} m={WATER} geo={GEO.cyl48} />
            {[0.15, 0.6].map((y) => (
              <Cyl key={y} p={[0, y, 0]} rad={0.87} h={0.05} c="#3a2a1c" geo={GEO.cyl48} />
            ))}
            {/* 칸 안 작은 매트 */}
            <Box p={[-s * 1.05, 0.02, 0]} s={[0.6, 0.02, 1.4]} c="#c9b98a" />
          </group>
        )),
      )}
      {/* 앞쪽: 신발장 2개 + 접수대(帳場) */}
      {[-1, 1].map((s) => (
        <group key={s} position={[s * 3.2, base, iz - 0.6]}>
          <Box p={[0, 0.65, 0]} s={[1.6, 1.3, 0.5]} c="#5a3d2a" />
          {range(3).map((r) =>
            range(4).map((c) => <Box key={`${r}${c}`} p={[-0.57 + c * 0.38, 0.25 + r * 0.38, -0.26]} s={[0.3, 0.3, 0.02]} c="#3a281c" />),
          )}
        </group>
      ))}
      <group position={[-8.6, base, 8.4]}>
        <Box p={[0, 0.5, 0]} s={[3.4, 1, 0.9]} c="#4a2f1f" />
        <Box p={[0, 1.03, 0]} s={[3.6, 0.06, 1.0]} c="#2b1d14" />
        <Box p={[0, 0.5, 0.46]} s={[3.2, 0.7, 0.02]} m={GOLD_M} />
        <mesh position={[0, 3.2, 0]}>
          <planeGeometry args={[1.6, 0.6]} />
          <GlowMaterial glow={0.5} map={getJpSignTexture('帳場', '#3d2a1e', '#f3e6c8', 1.6 / 0.6)} side={THREE.DoubleSide} />
        </mesh>
      </group>
      {/* 서쪽 벽 아래 긴 의자 */}
      {[-4, 2].map((z) => (
        <group key={z} position={[-ix + 0.5, base, z]}>
          <Box p={[0, 0.42, 0]} s={[0.5, 0.08, 2.6]} c="#9a7650" />
          {[-1, 1].map((s) => (
            <Box key={s} p={[0, 0.2, s * 1.1]} s={[0.42, 0.4, 0.1]} c="#5a3d2a" />
          ))}
        </group>
      ))}
      {/* 옆벽 소나무 벽화 + 뒷벽 나무판·문 */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * (ix - 0.01), base + H * 0.45, 0]} rotation={[0, -s * (Math.PI / 2), 0]}>
          <planeGeometry args={[iz * 2 - 0.4, H * 0.8]} />
          <primitive object={texMat(pine)} attach="material" />
        </mesh>
      ))}
      <Box p={[0, base + H / 2, -iz + 0.02]} s={[ix * 2, H, 0.02]} c="#6b4630" />
      {[-8, 8].map((x) => (
        <group key={x} position={[x, base, -iz + 0.05]}>
          <Box p={[0, 1.2, 0]} s={[1.8, 2.4, 0.04]} c="#3a281c" />
          <Box p={[0, 1.2, 0.03]} s={[0.04, 2.3, 0.02]} m={GOLD_M} />
        </group>
      ))}
      {/* 앞벽 안쪽 */}
      {[-1, 1].map((s) => (
        <Box key={s} p={[s * (ix / 2 + Y.door / 4), base + H / 2, iz - 0.02]} s={[ix - Y.door / 2, H, 0.02]} c="#6b4630" />
      ))}
      {/* 홀 기둥 (2층~5층까지 이어짐) */}
      {Y.pillars?.map(([x, z]) => (
        <group key={`${x}${z}`}>
          <Cyl p={[x, (base + lv[4]) / 2, z]} rad={0.22} h={lv[4] - base} c={VERM} />
          <Box p={[x, base + 0.15, z]} s={[0.55, 0.3, 0.55]} c={DARK} />
        </group>
      ))}
    </group>
  )
}

// ── 2~5층 바닥판·회랑 난간·금 꽃 패널·장지문 방·천장 ──
function YuFloors({ W, D, Y }) {
  const { lv, wt, slabs, rails, void: V } = Y
  const ix = W / 2 - wt
  const iz = D / 2 - wt
  const planks = useMemo(() => plankTexture(), [])
  const coffer = useMemo(() => cofferTexture(), [])
  const parts = useMemo(() => {
    const reds = []
    const golds = []
    const bulbs = []
    const fascias = []
    for (const r of rails) {
      const [ax, az] = r.a
      const [bx, bz] = r.b
      const len = Math.hypot(bx - ax, bz - az)
      if (len < 0.2) continue
      const alongX = Math.abs(bx - ax) > Math.abs(bz - az)
      const mx = (ax + bx) / 2
      const mz = (az + bz) / 2
      const S = (a, b) => (alongX ? [a, b, 0.1] : [0.1, b, a])
      for (const [y, h] of [[1.05, 0.12], [0.58, 0.08], [0.1, 0.12]]) reds.push({ p: [mx, r.y + y, mz], s: S(len, h) })
      const posts = Math.max(1, Math.round(len / 1.3))
      for (let k = 0; k <= posts; k++) {
        const t = k / posts
        const x = ax + (bx - ax) * t
        const z = az + (bz - az) * t
        reds.push({ p: [x, r.y + 0.55, z], s: [0.14, 1.1, 0.14] })
        golds.push({ p: [x, r.y + 1.15, z], s: [0.18, 0.1, 0.18] })
      }
      const bars = Math.round(len / 0.32)
      for (let k = 0; k < bars; k++) {
        const t = (k + 0.5) / bars
        reds.push({ p: [ax + (bx - ax) * t, r.y + 0.34, az + (bz - az) * t], s: [0.04, 0.42, 0.04] })
      }
      if (r.face === 'void') {
        // 회랑 앞판(금 꽃 패널)은 바닥판 바로 밑, 홀 쪽
        fascias.push({ p: [mx, r.y - 0.25 - 0.45, mz], len, alongX, n: Math.max(1, Math.round(len / 1.6)) })
        reds.push({ p: [mx, r.y - 0.12, mz], s: alongX ? [len, 0.26, 0.22] : [0.22, 0.26, len] })
        // 회랑 처마 밑 작은 전구
        const nb = Math.max(1, Math.round(len / 2.4))
        for (let k = 0; k < nb; k++) {
          const t = (k + 0.5) / nb
          bulbs.push({ p: [ax + (bx - ax) * t, r.y - 1.3, az + (bz - az) * t], s: [0.11, 0.11, 0.11] })
        }
      }
    }
    return { reds, golds, bulbs, fascias }
  }, [rails])
  const slabBoxes = useMemo(
    () => slabs.flatMap((s) => s.rects.map(([x0, z0, x1, z1]) => ({ p: [(x0 + x1) / 2, s.y - 0.125, (z0 + z1) / 2], s: [x1 - x0, 0.25, z1 - z0], top: s.lv < 4 }))),
    [slabs],
  )
  // 5층 바닥판 밑면 = 홀·4층 회랑 천장 (금 원형 격자). 칸 1.4m, 사각형마다 이어지게 offset
  const ceiling = slabs.find((s) => s.lv === 4)
  return (
    <group>
      <Instances geometry={GEO.box} material={mat('#5a2a1e')} items={slabBoxes} />
      {slabBoxes.map((b, i) => (
        <mesh key={i} position={[b.p[0], b.p[1] + 0.128, b.p[2]]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[b.s[0], b.s[2]]} />
          <primitive object={texMat(tiled(planks, b.s[0] / 1.6, b.s[2] / 1.6))} attach="material" />
        </mesh>
      ))}
      {ceiling?.rects.map(([x0, z0, x1, z1], i) => (
        <mesh key={`c${i}`} position={[(x0 + x1) / 2, ceiling.y - 0.26, (z0 + z1) / 2]} rotation={[Math.PI / 2, 0, 0]}>
          <planeGeometry args={[x1 - x0, z1 - z0]} />
          <primitive object={texMat(tiled(coffer, (x1 - x0) / 1.4, (z1 - z0) / 1.4, x0 / 1.4, z0 / 1.4))} attach="material" />
        </mesh>
      ))}
      <Instances geometry={GEO.box} material={mat(VERM, { roughness: 0.6 })} items={parts.reds} castShadow />
      <Instances geometry={GEO.box} material={GOLD_M} items={parts.golds} />
      <Instances geometry={GEO.sphere} material={GLOBE} items={parts.bulbs} />
      {parts.fascias.map((f, i) => (
        <mesh key={i} geometry={GEO.box} position={f.p} scale={f.alongX ? [f.len, 0.9, 0.06] : [0.06, 0.9, f.len]}>
          <primitive object={texMat(flowerPanelTexture(f.n), { emissive: '#ffffff', emissiveIntensity: 0.12 })} attach="material" />
        </mesh>
      ))}
      {/* 2~5층 바깥벽 안쪽: 불 켜진 장지문 방 줄 + 짙은 살 (5층 뒷벽은 금 병풍이 대신) */}
      {[1, 2, 3, 4].map((k) => {
        const y = lv[k]
        const h = lv[k + 1] - lv[k]
        return (
          <group key={k}>
            {[
              [0, -iz + 0.03, ix * 2 - 0.6, 0],
              [0, iz - 0.03, ix * 2 - 0.6, Math.PI],
              [-ix + 0.03, 0, iz * 2 - 0.6, Math.PI / 2],
              [ix - 0.03, 0, iz * 2 - 0.6, -Math.PI / 2],
            ].map(([x, z, len, r], j) => k === 4 && j === 0 ? null : (
              <group key={j} position={[x, y, z]} rotation={[0, r, 0]}>
                <Box p={[0, h / 2, -0.01]} s={[len + 0.6, h, 0.02]} c="#6b4630" />
                <Box p={[0, h * 0.42, 0]} s={[len, h * 0.62, 0.02]} m={SHOJI_M} />
                {range(Math.round(len / 1.2) + 1).map((i) => (
                  <Box key={i} p={[-len / 2 + (i * len) / Math.round(len / 1.2), h * 0.42, 0.02]} s={[0.07, h * 0.62, 0.03]} c={DARK} />
                ))}
                <Box p={[0, h * 0.42, 0.02]} s={[len, 0.05, 0.03]} c={DARK} />
                <Box p={[0, h * 0.86, 0.01]} s={[len, h * 0.16, 0.02]} c={GOLD} />
              </group>
            ))}
          </group>
        )
      })}
      {/* 홀 샹들리에 */}
      {[[-4.2, 3], [4.2, 3], [-4.6, -5.2], [4.6, -5.2], [0, 4.8]].map(([x, z]) => (
        <Chandelier key={`${x}${z}`} p={[x, lv[4] - 0.26, z]} drop={x === 0 ? 1.2 : 2.2} r={0.7} n={7} />
      ))}
      {/* 홀 가장자리 위 금 들보 (5층 바닥판 밑) */}
      <Box p={[0, lv[4] - 0.45, V.z1]} s={[V.x1 - V.x0, 0.4, 0.3]} c={RED_DARK} />
      <Box p={[0, lv[4] - 0.45, V.z0]} s={[V.x1 - V.x0, 0.4, 0.3]} c={RED_DARK} />
    </group>
  )
}

// ── 홀 뒤 가운데 누각 ───────────────────────
function YuPavilion({ Y }) {
  const { pav, base, lv } = Y
  const cz = (pav.z0 + pav.z1) / 2
  const f = pav.z1 // 앞면
  const w = pav.x1 - pav.x0
  const top = lv[4]
  const dragon = useMemo(() => dragonTexture(), [])
  const folds = range(9)
  return (
    <group>
      {/* 몸체 (짙은 나무) */}
      <Box p={[0, (base + top) / 2, cz - 0.2]} s={[w - 0.6, top - base, pav.z1 - pav.z0 - 0.4]} c={DARK} />
      {/* 아래: 보라 휘장 + 매듭 */}
      {folds.map((i) => (
        <Box key={i} p={[-w / 2 + 0.55 + (i * (w - 1.1)) / 8, base + 1.4, f + 0.05 + (i % 2) * 0.06]} s={[0.62, 2.8, 0.06]} m={i % 2 ? CURTAIN_DARK : CURTAIN} />
      ))}
      <Box p={[0, base + 2.65, f + 0.14]} s={[w - 0.4, 0.35, 0.05]} m={CURTAIN} />
      <Cyl p={[0, base + 1.9, f + 0.2]} rad={0.08} h={0.9} m={GOLD_M} />
      {/* 발코니 판 + 금 장식 */}
      <Box p={[0, base + 3.0, f + 0.5]} s={[w + 0.4, 0.4, 1.4]} c="#5a3a24" />
      <Box p={[0, base + 3.0, f + 1.21]} s={[w + 0.4, 0.3, 0.04]} m={GOLD_M} />
      {range(5).map((i) => (
        <Box key={i} p={[-w / 2 + 0.4 + (i * (w - 0.8)) / 4, base + 3.0, f + 1.24]} s={[0.3, 0.3, 0.03]} c="#7a2218" />
      ))}
      {/* 가운데: 붉은 두짝문 + 금 장식, 양옆 검은 기둥, 금 문틀 */}
      <group position={[0, base + 3.2, f + 0.02]}>
        <Box p={[0, 1.6, 0]} s={[2.8, 3.0, 0.06]} c="#c0302a" />
        <Box p={[0, 1.6, 0.04]} s={[0.05, 3.0, 0.02]} m={GOLD_M} />
        {[-0.7, 0.7].flatMap((x) => [0.7, 1.6, 2.5].map((y) => <Box key={`${x}${y}`} p={[x, y, 0.05]} s={[0.4, 0.14, 0.03]} m={GOLD_M} />))}
        <Box p={[0, 3.2, 0.03]} s={[3.2, 0.2, 0.08]} m={GOLD_M} />
        {[-1, 1].map((s) => (
          <group key={s}>
            <Box p={[s * 1.55, 1.6, 0.02]} s={[0.12, 3.2, 0.1]} m={GOLD_M} />
            <Box p={[s * 2.55, 1.7, 0.05]} s={[0.35, 3.4, 0.35]} c="#1a1210" />
            <Box p={[s * 2.55, 3.45, 0.05]} s={[0.45, 0.15, 0.45]} m={GOLD_M} />
          </group>
        ))}
        {/* 색유리 등 */}
        <group position={[0, 2.85, 0.9]}>
          <Cyl p={[0, 0.5, 0]} rad={0.02} h={0.5} c={DARK} />
          <mesh>
            <cylinderGeometry args={[0.32, 0.22, 0.6, 8]} />
            <meshStandardMaterial color="#f2a3c0" emissive="#ff7aa8" emissiveIntensity={0.9} roughness={0.4} />
          </mesh>
          <Cyl p={[0, 0.32, 0]} rad={0.34} h={0.06} m={GOLD_M} />
        </group>
      </group>
      {/* 초록 둥근 지붕 + 금 현판 */}
      <Karahafu p={[0, base + 6.7, cz + 0.6]} w={w + 1.4} h={2.0} depth={(pav.z1 - pav.z0) + 1.6} sign={{ text: '天楽', w: 2.2, h: 0.8 }} />
      {/* 위: 붉은 난간 발코니 (3층 높이) */}
      <group position={[0, lv[2], cz]}>
        <Box p={[0, -0.1, 0]} s={[w + 0.6, 0.2, pav.z1 - pav.z0 + 0.6]} c="#5a3a24" />
        {[-1, 1].map((s) => (
          <group key={s}>
            <Box p={[0, 1.0, s * ((pav.z1 - pav.z0) / 2 + 0.25)]} s={[w + 0.6, 0.1, 0.1]} c={VERM} />
            <Box p={[s * (w / 2 + 0.25), 1.0, 0]} s={[0.1, 0.1, pav.z1 - pav.z0 + 0.6]} c={VERM} />
          </group>
        ))}
        {range(7).map((i) => (
          <Box key={i} p={[-w / 2 - 0.25 + (i * (w + 0.5)) / 6, 0.5, (pav.z1 - pav.z0) / 2 + 0.25]} s={[0.1, 1.0, 0.1]} c={VERM} />
        ))}
        {/* 위에서 빛나는 등 */}
        <Ball p={[0, 1.0, 0]} rad={0.35} m={GLOBE} />
      </group>
      {/* 붉은 기둥 4개 (3층 → 천장) + 꼭대기 용 장식 판 */}
      {[-1, 1].flatMap((sx) =>
        [-1, 1].map((sz) => (
          <Cyl key={`${sx}${sz}`} p={[sx * (w / 2 - 0.2), (lv[2] + top) / 2, cz + sz * ((pav.z1 - pav.z0) / 2 - 0.2)]} rad={0.25} h={top - lv[2]} c={VERM} />
        )),
      )}
      <group position={[0, top - 1.1, cz]}>
        <Box p={[0, 0, 0]} s={[w + 0.8, 1.6, pav.z1 - pav.z0 + 0.8]} m={GOLD_M} />
        {[-1, 1].map((s) => (
          <mesh key={s} position={[0, 0, s * ((pav.z1 - pav.z0) / 2 + 0.42)]} rotation={[0, s > 0 ? 0 : Math.PI, 0]}>
            <planeGeometry args={[w + 0.7, 1.4]} />
            <primitive object={texMat(dragon, { emissive: '#ffffff', emissiveIntensity: 0.15 })} attach="material" />
          </mesh>
        ))}
        <Box p={[0, -0.9, 0]} s={[w + 1.2, 0.2, pav.z1 - pav.z0 + 1.2]} c={DARK} />
        {/* 밑면 둥근 등 고리 */}
        {range(8).map((i) => {
          const a = (i / 8) * Math.PI * 2
          return <Ball key={i} p={[Math.cos(a) * 1.0, -1.15, Math.sin(a) * 0.8]} rad={0.13} m={GLOBE} />
        })}
        <Ball p={[0, -1.2, 0]} rad={0.2} m={GLOBE} />
      </group>
    </group>
  )
}

// ── 홀을 가로지르는 붉은 아치 다리 (2층) ─────
function YuInnerBridge({ Y }) {
  const { bridge: b, void: V, lv } = Y
  const len = V.x1 - V.x0
  const item = useMemo(() => ({ size: [b.w, 1, len], arch: b.arch, depth: 0, piers: [], lamps: false, deckColor: '#8a5a3a', underBottom: -0.4 }), [b, len])
  return (
    <group position={[(V.x0 + V.x1) / 2, lv[b.lv], b.z]} rotation={[0, Math.PI / 2, 0]}>
      <JmGrandBridge item={item} />
    </group>
  )
}

// ── 5층 연회장: 금 병풍·무대·상 줄·분홍 연꽃 샹들리에·금 원형 격자 천장 ──
function YuBanquet({ W, D, Y }) {
  const { lv, wt } = Y
  const y = lv[4]
  const h = lv[5] - lv[4]
  const ix = W / 2 - wt
  const iz = D / 2 - wt
  const coffer = useMemo(() => cofferTexture(), [])
  const trays = useMemo(() => {
    const out = []
    for (const s of [-1, 1]) for (let z = 5.5; z > -5.5; z -= 1.3) out.push({ p: [s * 4.2, y + 0.18, z], s: [0.7, 0.12, 0.5] })
    return out
  }, [y])
  return (
    <group>
      {/* 천장 */}
      <mesh position={[0, lv[5] - 0.01, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[ix * 2, iz * 2]} />
        <primitive object={texMat(tiled(coffer, (ix * 2) / 1.4, (iz * 2) / 1.4))} attach="material" />
      </mesh>
      {/* 뒷벽 금 병풍 (지그재그) */}
      {range(12).map((i) => (
        <mesh key={i} position={[-ix + 1.1 + i * ((ix * 2 - 2.2) / 11), y + 1.6, -iz + 0.5 + (i % 2) * 0.12]} rotation={[0, (i % 2 ? -1 : 1) * 0.22, 0]}>
          <planeGeometry args={[(ix * 2 - 2.2) / 11 + 0.05, 2.8]} />
          <primitive object={texMat(flowerPanelTexture(1), { emissive: '#ffffff', emissiveIntensity: 0.15 })} attach="material" />
        </mesh>
      ))}
      {/* 무대 (충돌은 생성 스크립트 jm_yutoya_stage) */}
      <Box p={[0, y + 0.225, -8.6]} s={[10, 0.45, 3.6]} c="#9a6a40" />
      <Box p={[0, y + 0.225, -6.79]} s={[10, 0.45, 0.02]} c="#7a2218" />
      {/* 무대 양옆 금 등롱 */}
      {[-1, 1].map((s) => (
        <group key={s} position={[s * 5.6, y, -7.2]}>
          <Cyl p={[0, 0.8, 0]} rad={0.06} h={1.6} m={GOLD_M} />
          <Box p={[0, 1.8, 0]} s={[0.5, 0.6, 0.5]} m={GLOBE} />
          <Box p={[0, 2.15, 0]} s={[0.7, 0.1, 0.7]} m={GOLD_M} />
        </group>
      ))}
      {/* 상 두 줄 + 방석 */}
      <Instances geometry={GEO.box} material={mat('#5a2a1e')} items={trays} />
      <Instances geometry={GEO.box} material={mat('#7f1d1d')} items={trays.map((t) => ({ p: [t.p[0] + Math.sign(t.p[0]) * 0.75, y + 0.04, t.p[2]], s: [0.55, 0.08, 0.55] }))} />
      {/* 옆벽 위 금 꽃 패널 띠 */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * (ix - 0.09), y + h - 0.45, 0]} rotation={[0, -s * (Math.PI / 2), 0]}>
          <planeGeometry args={[iz * 2 - 0.6, 0.8]} />
          <primitive object={texMat(flowerPanelTexture(10), { emissive: '#ffffff', emissiveIntensity: 0.12 })} attach="material" />
        </mesh>
      ))}
      {/* 분홍 연꽃 샹들리에 */}
      <group position={[0, lv[5] - 1.4, 0]}>
        <Cyl p={[0, 0.7, 0]} rad={0.03} h={1.4} c={DARK} />
        <Cyl p={[0, 0, 0]} rad={0.9} h={0.05} m={GOLD_M} />
        {range(8).map((i) => {
          const a = (i / 8) * Math.PI * 2
          return (
            <mesh key={i} position={[Math.cos(a) * 0.9, 0.12, Math.sin(a) * 0.9]}>
              <coneGeometry args={[0.18, 0.3, 6, 1, true]} />
              <meshStandardMaterial color="#f7b6c8" emissive="#ff8fb0" emissiveIntensity={0.9} side={THREE.DoubleSide} />
            </mesh>
          )
        })}
      </group>
      {/* 연회장 간판 */}
      <mesh position={[0, y + h - 0.6, -iz + 0.06]}>
        <planeGeometry args={[2.4, 0.7]} />
        <GlowMaterial glow={0.5} map={getJpSignTexture('宴会場', '#2b1a12', '#e8c35a', 2.4 / 0.7)} side={THREE.DoubleSide} />
      </mesh>
    </group>
  )
}

export const JM_YUTOYA_STYLES = { jmYutoya: JmYutoya }
