import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { hipRoofGeometry } from './geometry.js'
import { Ball, Box, Cyl, GEO, Instances, mat, texMat } from './kit.jsx'
import { canvasTexture, getJpSignTexture, GlowMaterial, JP_FONT } from './jm_landmarks.jsx'
import { JmGrandBridge } from './jm_kyoto.jsx'
import { WadeSplash } from './jm_water.jsx'
import { rebuild as rebuildMerged } from './jm_perf.jsx'

// 애니메이션 구역(JM) 큰 여관 「湯灯屋」 (11/25 다시 지음) — 담당: 지민
// 참고: 지민이 보낸 사진들
//   외관: 붉은 벽 + 회색 격자창, 층마다 초록 기와 처마, 정면 가운데 둥근 박공(가라하후) 현관과 금색 현판, 지붕 위 누각·금 장식, 굴뚝, 큰 소나무
//   안: 가운데가 꼭대기까지 뚫린 높은 홀, 홀 뒤 가운데 화려한 누각(보라 휘장·붉은 문·초록 둥근 지붕·금 현판·붉은 기둥·용 장식),
//       층마다 붉은 난간 회랑 + 금색 꽃 패널, 금 원형 격자 천장과 둥근 등 샹들리에, 홀을 가로지르는 붉은 아치 다리, (11/25) 1층 로비 + 뒤채 목욕탕(번대·나무 패 판·나무 욕조), 2~4층 연회장, 꼭대기 주인 집무실
// 간판 글자는 우리 것(湯灯屋·天楽·帳場·宴会場·大湯·番台·主人の間 등)만 쓰고, 캐릭터는 넣지 않음
// 걷는 판정(바닥판·벽·난간·계단·누각·가구)은 생성 스크립트(gen-jm-kyoto.mjs 7-5)가 item.yutoya와 같은 값으로 깔고, 여기서는 그림만
// 로컬 좌표: 건물 가운데, +z = 정면, y = 앞마당 바닥

// (11/26 지민 요청: 너무 빨강빨강) 영화 속 온천장처럼 채도를 낮춘 녹슨 벽돌빛 · 짙은 나무빛 붉은색
const RED = '#a9553f'
const RED_DARK = '#6a3428'
const VERM = '#b04a32'
const GREEN = '#3f7a5c'
const GREEN_DARK = '#2c5a43'
const GOLD = '#d4a83e'
const DARK = '#2a1a14'
const WOOD = '#8a5a3a'
const STONE = '#9d978c'

const range = (n) => Array.from({ length: n }, (_, i) => i)
// 사각형 r([x0, z0, x1, z1])에서 구멍들을 뺀 조각들 (생성 스크립트 rectSub와 같은 식)
function rectHoles(r, holes = []) {
  let out = [r]
  for (const h of holes) {
    out = out.flatMap(([x0, z0, x1, z1]) => {
      const [a0, b0, a1, b1] = [Math.max(x0, h[0]), Math.max(z0, h[1]), Math.min(x1, h[2]), Math.min(z1, h[3])]
      if (a0 >= a1 || b0 >= b1) return [[x0, z0, x1, z1]]
      const pcs = []
      if (z0 < b0) pcs.push([x0, z0, x1, b0])
      if (b1 < z1) pcs.push([x0, b1, x1, z1])
      if (x0 < a0) pcs.push([x0, b0, a0, b1])
      if (a1 < x1) pcs.push([a1, b0, x1, b1])
      return pcs
    })
  }
  return out
}
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
      ctx.fillStyle = i % 2 ? '#2f7a5c' : '#9e4634'
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
  ['#a44c38', '#e48a8a'],
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
// (11/25 밤 지민 요청: 입구 그림이 이상함) 바깥 격자창 = 안에서 불이 비치는 장지문 (크림색 종이 + 짙은 나무 살 + 굵은 틀)
function latticeTexture() {
  const tex = canvasTexture('yu-lattice-shoji', 128, 128, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h)
    g.addColorStop(0, '#f6dfa8')
    g.addColorStop(1, '#eccb86')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, w, h)
    ctx.fillStyle = '#3a2416'
    // 가는 살: 가로 3칸 × 세로 4칸
    for (let i = 1; i < 3; i++) ctx.fillRect((i * w) / 3 - 2, 0, 4, h)
    for (let i = 1; i < 4; i++) ctx.fillRect(0, (i * h) / 4 - 2, w, 4)
    // 굵은 틀
    ctx.fillRect(0, 0, w, 8)
    ctx.fillRect(0, h - 8, w, 8)
    ctx.fillRect(0, 0, 8, h)
    ctx.fillRect(w - 8, 0, 8, h)
  })
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  return tex
}
const SHOJI_GLOW = { emissive: '#ffffff', emissiveIntensity: 0.35 }
// 현관 노렌: 남색 천에 흰 「ゆ」+ 아래 「온천」, 세 갈래로 갈라져 바람에 살짝 흔들림
function norenTexture() {
  return canvasTexture('yu-noren-ko', 384, 256, (ctx, w, h) => {
    ctx.fillStyle = '#1f3a6e'
    ctx.fillRect(0, 0, w, h)
    ctx.fillStyle = 'rgba(255,255,255,0.12)'
    ctx.fillRect(0, 0, w, 18)
    ctx.fillStyle = '#f5f0e6'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.font = `bold 150px ${JP_FONT}`
    ctx.fillText('ゆ', w / 2, h * 0.46)
    ctx.font = 'bold 34px "Malgun Gothic", sans-serif'
    ctx.fillText('온천', w / 2, h * 0.86)
  })
}
function NorenSplit({ w, h, y, z }) {
  const base = useMemo(() => norenTexture(), [])
  const parts = useMemo(() => [0, 1, 2].map((i) => {
    const t = base.clone()
    t.needsUpdate = true
    t.repeat.set(1 / 3, 1)
    t.offset.set(i / 3, 0)
    return new THREE.MeshStandardMaterial({ map: t, side: THREE.DoubleSide, roughness: 0.9, emissive: '#ffffff', emissiveMap: t, emissiveIntensity: 0.25 })
  }), [base])
  const refs = useRef([])
  useFrame(({ clock }) => {
    refs.current.forEach((m, i) => {
      if (m) m.rotation.x = Math.sin(clock.elapsedTime * 1.3 + i * 1.1) * 0.05
    })
  })
  const pw = w / 3 - 0.04
  return (
    <group position={[0, y, z]} userData={{ noMerge: true }}>
      {parts.map((m, i) => (
        <group key={i} ref={(el) => (refs.current[i] = el)} position={[(i - 1) * (w / 3), 0, 0]}>
          <mesh position={[0, -h / 2, 0]} material={m}>
            <planeGeometry args={[pw, h]} />
          </mesh>
        </group>
      ))}
      <Box p={[0, 0.04, 0]} s={[w + 0.3, 0.08, 0.08]} c="#2a1a12" />
    </group>
  )
}
// 카메라가 radius보다 멀 때만 보임 (NearOnly의 반대): 멀리서는 문 안이 따뜻한 빛으로, 가까이 가면 진짜 로비가 보임
function FarOnly({ radius, children }) {
  const ref = useRef(null)
  const acc = useRef(1)
  const v = useMemo(() => new THREE.Vector3(), [])
  useFrame(({ camera }, dt) => {
    if (camera.userData.showFullMap && ref.current) {
      ref.current.visible = false
      acc.current = 1
      return
    }
    acc.current += dt
    if (acc.current < 0.25 || !ref.current) return
    acc.current = 0
    ref.current.parent.getWorldPosition(v)
    ref.current.visible = v.distanceTo(camera.position) > radius
  })
  return <group ref={ref} userData={{ noMerge: true }}>{children}</group>
}
const ENTRY_GLOW = new THREE.MeshStandardMaterial({ color: '#7a4a24', emissive: '#f0a85a', emissiveIntensity: 0.55, roughness: 1 })

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
    ctx.fillStyle = '#ab5038'
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
export function Karahafu({ w, h, depth, color = GREEN, p = [0, 0, 0], board = true, sign }) {
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

// (11/26 점검: 여관 겉모습 퀄리티) 처마를 모서리까지 이어진 한 덩어리 고리로 — 전엔 판 4장을 따로 기울여 모서리가 벌어져 보였음
//   윗면: 초록 기와(골 무늬) / 밑면: 짙은 서까래 색 / 바깥 끝: 처마 끝 판
function tileTexture() {
  return canvasTexture('yu:roofTile', 64, 64, (ctx, w, h) => {
    ctx.fillStyle = '#3f7a5c'
    ctx.fillRect(0, 0, w, h)
    ctx.fillStyle = 'rgba(255,255,255,0.10)'
    ctx.fillRect(0, 0, w * 0.32, h)
    ctx.fillStyle = 'rgba(0,0,0,0.28)'
    ctx.fillRect(w * 0.78, 0, w * 0.22, h)
  })
}
function eaveRingGeometry(w, d, out, drop, flip = false) {
  const a = [w / 2, d / 2]
  const b = [w / 2 + out, d / 2 + out]
  // 네 변: [안쪽 두 점, 바깥 두 점] (위에서 보아 반시계)
  const sides = [
    [[-a[0], a[1]], [a[0], a[1]], [b[0], b[1]], [-b[0], b[1]]],
    [[a[0], a[1]], [a[0], -a[1]], [b[0], -b[1]], [b[0], b[1]]],
    [[a[0], -a[1]], [-a[0], -a[1]], [-b[0], -b[1]], [b[0], -b[1]]],
    [[-a[0], -a[1]], [-a[0], a[1]], [-b[0], b[1]], [-b[0], -b[1]]],
  ]
  const pos = []
  const uv = []
  const idx = []
  sides.forEach((q, si) => {
    const base = pos.length / 3
    q.forEach(([x, z], k) => {
      pos.push(x, k < 2 ? 0 : -drop, z)
      const along = si % 2 === 0 ? x : z
      uv.push(along / 0.42, k < 2 ? 1 : 0)
    })
    if (flip) idx.push(base, base + 2, base + 1, base, base + 3, base + 2)
    else idx.push(base, base + 1, base + 2, base, base + 2, base + 3)
  })
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  g.setIndex(idx)
  g.computeVertexNormals()
  return g
}
function YuEave({ w, d, y, out = 1.1 }) {
  const drop = out * 0.45
  const top = useMemo(() => eaveRingGeometry(w, d, out, drop), [w, d, out, drop])
  const under = useMemo(() => eaveRingGeometry(w, d, out, drop, true), [w, d, out, drop])
  const tile = useMemo(() => {
    const t = tileTexture().clone()
    t.wrapS = THREE.RepeatWrapping
    t.needsUpdate = true
    return t
  }, [])
  const fascia = useMemo(() => {
    const bw = w + out * 2
    const bd = d + out * 2
    return [
      { p: [0, -drop - 0.06, bd / 2], s: [bw + 0.1, 0.16, 0.1] },
      { p: [0, -drop - 0.06, -bd / 2], s: [bw + 0.1, 0.16, 0.1] },
      { p: [bw / 2, -drop - 0.06, 0], s: [0.1, 0.16, bd + 0.1] },
      { p: [-bw / 2, -drop - 0.06, 0], s: [0.1, 0.16, bd + 0.1] },
    ]
  }, [w, d, out, drop])
  return (
    <group position={[0, y, 0]}>
      <mesh geometry={top}>
        <meshStandardMaterial map={tile} roughness={0.7} />
      </mesh>
      <mesh geometry={under} position={[0, -0.08, 0]}>
        <meshStandardMaterial color="#3a2418" roughness={1} />
      </mesh>
      <Instances geometry={GEO.box} material={mat(GREEN_DARK, { flat: true })} items={fascia} />
    </group>
  )
}

// (11/26 점검: 여관 겉모습 퀄리티) 밋밋한 붉은 벽 → 층마다 짙은 나무 띠 + 일정 간격 붉은 기둥, 1층 처마 밑 붉은 초롱 줄, 옆면 층 난간
const LANTERN_M = mat('#a26a5b', { emissive: '#ff6a3a', emissiveIntensity: 0.9 })
function YuWallDetail({ W, D, Y }) {
  const { lv, base } = Y
  const R = lv[5]
  const front = D / 2
  const parts = useMemo(() => {
    const posts = []
    const beams = []
    const lamps = []
    const caps = []
    const rails = []
    const step = 4.2
    // 기둥: 앞(가운데 내민 칸 |x| < 5.4 비움)·뒤·옆
    for (let x = -W / 2 + step; x < W / 2 - 0.5; x += step) {
      if (Math.abs(x) > 5.4) posts.push({ p: [x, (base + R) / 2, front + 0.09], s: [0.32, R - base, 0.14] })
      posts.push({ p: [x, (base + R) / 2, -front - 0.09], s: [0.32, R - base, 0.14] })
    }
    for (let z = -D / 2 + step; z < D / 2 - 0.5; z += step) for (const sx of [-1, 1]) posts.push({ p: [sx * (W / 2 + 0.09), (base + R) / 2, z], s: [0.14, R - base, 0.32] })
    // 층 띠: 처마 바로 위 짙은 나무
    for (let k = 1; k <= 4; k++) {
      const y = lv[k] + 0.2
      for (const sz of [-1, 1]) beams.push({ p: [0, y, sz * (front + 0.11)], s: [W + 0.3, 0.26, 0.1] })
      for (const sx of [-1, 1]) beams.push({ p: [sx * (W / 2 + 0.11), y, 0], s: [0.1, 0.26, D + 0.3] })
    }
    // 1층 처마 밑 초롱 (앞·옆)
    const ly = lv[1] - 1.25
    for (let x = -W / 2 + 2; x <= W / 2 - 2; x += 3) {
      if (Math.abs(x) < 5.6) continue
      lamps.push({ p: [x, ly, front + 1.05], s: [0.34, 0.44, 0.34] })
      caps.push({ p: [x, ly + 0.3, front + 1.05], s: [0.26, 0.08, 0.26] }, { p: [x, ly - 0.3, front + 1.05], s: [0.26, 0.08, 0.26] }, { p: [x, ly + 0.62, front + 1.05], s: [0.02, 0.6, 0.02] })
    }
    for (let z = -D / 2 + 3; z <= D / 2 - 3; z += 3.4) for (const sx of [-1, 1]) {
      lamps.push({ p: [sx * (W / 2 + 1.05), ly, z], s: [0.34, 0.44, 0.34] })
      caps.push({ p: [sx * (W / 2 + 1.05), ly + 0.3, z], s: [0.26, 0.08, 0.26] }, { p: [sx * (W / 2 + 1.05), ly - 0.3, z], s: [0.26, 0.08, 0.26] }, { p: [sx * (W / 2 + 1.05), ly + 0.62, z], s: [0.02, 0.6, 0.02] })
    }
    // 옆면 2·4층 난간 (앞면은 원래 있음)
    for (const k of [2, 4]) for (const sx of [-1, 1]) {
      const x = sx * (W / 2 + 0.55)
      rails.push({ p: [x, lv[k] + 1.0, 0], s: [0.1, 0.1, D - 1] }, { p: [x, lv[k] + 0.5, 0], s: [0.06, 0.06, D - 1] })
      for (let z = -D / 2 + 0.6; z <= D / 2 - 0.6; z += 1.5) rails.push({ p: [x, lv[k] + 0.5, z], s: [0.1, 1.0, 0.1] })
    }
    return { posts, beams, lamps, caps, rails }
  }, [W, D, lv, base, R, front])
  const decks = useMemo(() => [2, 4].flatMap((k) => [-1, 1].map((sx) => ({ p: [sx * (W / 2 + 0.35), lv[k] + 0.05, 0], s: [0.8, 0.1, D - 1] }))), [W, D, lv])
  return (
    <group>
      <Instances geometry={GEO.box} material={mat(RED_DARK, { roughness: 0.8 })} items={parts.posts} />
      <Instances geometry={GEO.box} material={mat(DARK, { roughness: 0.9 })} items={parts.beams} />
      <Instances geometry={GEO.sphere} material={LANTERN_M} items={parts.lamps} />
      <Instances geometry={GEO.box} material={mat('#1c1410')} items={parts.caps} />
      <Instances geometry={GEO.box} material={mat(VERM, { roughness: 0.6 })} items={parts.rails} />
      <Instances geometry={GEO.box} material={mat(WOOD)} items={decks} />
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
// 카메라가 가까울 때만 보이는 묶음 (0.25초마다 거리 확인). 큰 건물 안쪽처럼 늘 그려지는 큰 소품의 렉 줄이기용
// (11/26 최적화) 묶음 안의 안 움직이는 부품도 재질별로 합쳐 그림 (jm_perf rebuild) — 예전엔 noMerge라 여관 안 수천 개 부품이 하나하나 그려졌음
//   합친 메시는 이 묶음 안에 두어서 거리별 숨기기는 그대로. 움직이는 부품은 userData.noMerge로 빼야 함
export function NearOnly({ radius, children, merge = true }) {
  const ref = useRef(null)
  const root = useRef(null)
  const holder = useRef(null)
  const tmp = useMemo(() => ({ p: null, next: 0 }), [])
  useFrame(({ camera, clock }) => {
    const g = ref.current
    if (camera.userData.showFullMap && g) {
      g.visible = true
      tmp.next = 0
      return
    }
    if (!g || clock.elapsedTime < tmp.next) return
    tmp.next = clock.elapsedTime + 0.25
    tmp.p = tmp.p ?? g.position.clone()
    g.getWorldPosition(tmp.p)
    g.visible = camera.position.distanceTo(tmp.p) < radius
  })
  useLayoutEffect(() => {
    if (merge && root.current && holder.current) rebuildMerged(root.current, holder.current)
  })
  useLayoutEffect(() => () => {
    for (const c of [...(holder.current?.children ?? [])]) c.geometry.dispose()
  }, [])
  // noMerge: 맵의 메시 합치기(jm_perf withMerge)가 바깥에서 이 묶음을 통째로 합치지 않게 → 거리별로 숨기기가 동작
  return (
    <group ref={ref} userData={{ noMerge: true }}>
      <group ref={root}>{children}</group>
      <group ref={holder} />
    </group>
  )
}

export function JmYutoya({ item }) {
  const [W, , D] = item.size
  const Y = item.yutoya
  const sign = item.signs?.[0]?.text ?? '湯灯屋'
  return (
    <group>
      <YuExterior W={W} D={D} Y={Y} sign={sign} />
      <YuFacadeExtras W={W} D={D} Y={Y} sign={sign} />
      <YuWallDetail W={W} D={D} Y={Y} />
      {/* (렉 줄이기) 안쪽(로비·층·연회장·목욕탕·집무실·승강로)은 카메라가 75m 안일 때만 그림 */}
      <NearOnly radius={75}>
        <YuGroundHall W={W} D={D} Y={Y} />
        <YuFloors W={W} D={D} Y={Y} />
        <YuPavilion Y={Y} />
        <YuGuestShaft Y={Y} />
        <YuInnerBridge Y={Y} />
        <YuBathWing Y={Y} />
        <YuBanquetRooms W={W} D={D} Y={Y} />
        <YuOffice W={W} D={D} Y={Y} />
      </NearOnly>
    </group>
  )
}

// ── (11/25 지민이 보낸 온천장 사진·영상 참고) 정면·옆면 덧붙임 ──
// 현관 위 큰 나무 현판, 정면 가운데 금 난간 발코니 + 보라 휘장, 벽 여기저기 튀어나온 격자 창 상자(작은 초록 지붕),
// 현관 양옆 초록 기와 얹은 격자 담, 벽을 타고 내려오는 흰 관
function YuFacadeExtras({ W, D, Y, sign }) {
  const { lv, base, door, doorH } = Y
  const front = D / 2
  const lattice = useMemo(() => latticeTexture(), [])
  const bays = useMemo(() => {
    const out = []
    // [x, y, z, 회전, 폭] — 앞면(+z), 옆면(±x)
    out.push([-(W / 2 - 4.2), lv[1] + 1.4, front, 0, 3.4], [W / 2 - 5.5, lv[2] + 1.3, front, 0, 4.2], [-(W / 2 - 7.5), lv[3] + 1.3, front, 0, 3.0], [W / 2 - 3.6, lv[3] + 1.2, front, 0, 2.8])
    out.push([W / 2, lv[1] + 1.5, 4, Math.PI / 2, 4.4], [W / 2, lv[2] + 1.2, -8, Math.PI / 2, 3.2], [-W / 2, lv[1] + 1.3, -5, -Math.PI / 2, 4.0], [-W / 2, lv[3] + 1.2, 6, -Math.PI / 2, 3.4])
    return out
  }, [W, lv, front])
  return (
    <group>
      {/* 현관 위 큰 나무 현판 */}
      <group position={[0, lv[1] - 1.5, front + 0.15]}>
        <Box p={[0, 0, 0]} s={[5.6, 1.6, 0.2]} c="#4a2f1f" />
        <mesh position={[0, 0, 0.11]}>
          <planeGeometry args={[5.1, 1.2]} />
          <GlowMaterial glow={0.4} map={getJpSignTexture(sign, '#6b4a2e', '#f3e2b8', 5.1 / 1.2)} />
        </mesh>
        <Box p={[0, 0.85, 0.05]} s={[6.0, 0.14, 0.3]} m={GOLD_M} />
      </group>
      {/* 정면 가운데 발코니: 금 난간 + 보라 휘장 (3층) */}
      <group position={[0, lv[2], front + 1.2]}>
        <Box p={[0, 0.05, 0.5]} s={[8.4, 0.12, 1.1]} c="#3a2618" />
        <Box p={[0, 1.0, 1.0]} s={[8.4, 0.1, 0.1]} m={GOLD_M} />
        <Box p={[0, 0.15, 1.0]} s={[8.4, 0.12, 0.12]} m={GOLD_M} />
        {range(13).map((i) => (
          <Box key={i} p={[-4.1 + (i * 8.2) / 12, 0.55, 1.0]} s={[0.07, 0.8, 0.07]} m={GOLD_M} />
        ))}
        {range(7).map((i) => (
          <Box key={`c${i}`} p={[-3.6 + i * 1.2, 2.0, 0.06 + (i % 2) * 0.05]} s={[1.1, 2.4, 0.06]} m={i % 2 ? CURTAIN_DARK : CURTAIN} />
        ))}
        <Box p={[0, 3.25, 0.1]} s={[8.2, 0.3, 0.08]} m={CURTAIN} />
      </group>
      {/* 튀어나온 격자 창 상자 */}
      {bays.map(([x, y, z, r, bw], i) => (
        <group key={i} position={[x, y, z]} rotation={[0, r, 0]}>
          <Box p={[0, 0, 0.5]} s={[bw, 1.7, 1.0]} c="#4a3426" />
          <mesh position={[0, 0.05, 1.01]}>
            <planeGeometry args={[bw - 0.3, 1.3]} />
            <primitive object={texMat(tiled(lattice, Math.max(1, Math.round(bw / 0.9)), 2), SHOJI_GLOW)} attach="material" />
          </mesh>
          <Box p={[0, 1.0, 0.6]} s={[bw + 0.4, 0.14, 1.5]} c={GREEN} r={[0.22, 0, 0]} />
          <Box p={[0, -0.9, 0.55]} s={[bw + 0.1, 0.12, 1.1]} c="#2b1d14" />
        </group>
      ))}
      {/* 현관 양옆 격자 담 (초록 기와) */}
      {[-1, 1].map((s) => (
        <group key={s} position={[s * (door / 2 + 2.6 + 5.6), base, front + 2.2]}>
          <Box p={[0, 0.3, 0]} s={[11.2, 0.6, 0.5]} c={STONE} />
          <mesh position={[0, 1.4, 0.26]}>
            <planeGeometry args={[11, 1.6]} />
            <primitive object={texMat(tiled(lattice, 12, 2), SHOJI_GLOW)} attach="material" />
          </mesh>
          <Box p={[0, 1.4, 0]} s={[11.2, 1.6, 0.2]} c="#e6e0d2" />
          <Box p={[0, 2.35, 0]} s={[11.6, 0.3, 0.9]} c={GREEN} />
          {[-5.5, 0, 5.5].map((x) => (
            <Box key={x} p={[x, 1.1, 0]} s={[0.3, 2.2, 0.3]} c={RED_DARK} />
          ))}
        </group>
      ))}
      {/* 벽 타고 내려오는 흰 관 (옆면) */}
      {[[-W / 2 - 0.25, -9], [W / 2 + 0.25, 10], [-W / 2 - 0.25, 11]].map(([x, z], i) => (
        <group key={`p${i}`}>
          <Cyl p={[x, (base + lv[4]) / 2, z]} rad={0.14} h={lv[4] - base} c="#d6d1c6" />
          {[lv[1], lv[3]].map((y) => (
            <Box key={y} p={[x, y, z]} s={[0.4, 0.12, 0.4]} c="#9d978c" />
          ))}
        </group>
      ))}
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
      {rectHoles([-(W + 1) / 2, -(D + 1) / 2, (W + 1) / 2, (D + 1) / 2], Y.floorHoles).map(([x0, z0, x1, z1], i) => (
        <Box key={`bs${i}`} p={[(x0 + x1) / 2, base / 2, (z0 + z1) / 2]} s={[x1 - x0, base, z1 - z0]} c={STONE} />
      ))}
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
      {/* 1층 아래 짙은 나무 띠 + 모서리 기둥 — (11/27) 띠가 정문 자리까지 가로질러 입구 아래쪽을 막아서, 문 양옆 두 조각으로 나눔 */}
      {[-1, 1].map((s) => (
        <Box key={`skirt${s}`} p={[s * (door / 2 + side / 2), base + 0.5, front + 0.02]} s={[side, 1, 0.05]} c={DARK} />
      ))}
      {[-1, 1].map((sx) => [-1, 1].map((sz) => <Box key={`${sx}${sz}`} p={[sx * (W / 2 - 0.1), (base + R) / 2, sz * (front - 0.1)]} s={[0.4, R - base, 0.4]} c={RED_DARK} />))}
      {/* 격자창 */}
      {windows.map((w, i) => (
        <mesh key={i} position={w.p} rotation={[0, w.r, 0]}>
          <planeGeometry args={w.s} />
          <primitive object={texMat(tiled(lattice, Math.max(1, Math.round(w.s[0] / 0.9)), Math.max(1, Math.round(w.s[1] / 0.9))), SHOJI_GLOW)} attach="material" />
        </mesh>
      ))}
      {/* 층마다 초록 처마 + 3층·5층 앞 붉은 발코니 난간 */}
      {[1, 2, 3, 4].map((k) => (
        <YuEave key={k} w={W} d={D} y={lv[k] - 0.05} out={k === 1 ? 1.5 : 1.1} />
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
            <primitive object={texMat(tiled(lattice, 8, 2), SHOJI_GLOW)} attach="material" />
          </mesh>
        ))}
        <Karahafu p={[0, lv[2] + 0.1, 1.2]} w={8.6} h={1.5} depth={2.2} board={false} />
        <Karahafu p={[0, lv[4] - 0.05, 1.0]} w={10.4} h={2.2} depth={3.2} />
        {/* 현관 위 큰 둥근 박공 + 기둥 2개 + 금 현판 */}
        <Karahafu p={[0, base + doorH + 0.9, 1.6]} w={7.4} h={2.0} depth={3.4} />
        {[-1, 1].map((s) => (
          <group key={s}>
            <Cyl p={[s * 3.2, base + (doorH + 0.9) / 2, 3.0]} rad={0.22} h={doorH + 0.9} c={VERM} />
            <Box p={[s * 3.2, base + 0.15, 3.0]} s={[0.6, 0.3, 0.6]} c={STONE} />
          </group>
        ))}
        <Box p={[0, base + doorH + 0.85, 3.0]} s={[6.8, 0.3, 0.3]} c={VERM} />
        {/* 문 안 어둠 + ゆ 노렌 */}
        <FarOnly radius={34}>
          <mesh position={[0, base + doorH / 2, -wt - 0.05]} material={ENTRY_GLOW}>
            <planeGeometry args={[door, doorH]} />
          </mesh>
        </FarOnly>
        {/* 양옆으로 열어 둔 격자 미닫이문 + 문틀 + 문지방 */}
        {[-1, 1].map((sd) => (
          <group key={`d${sd}`}>
            <mesh position={[sd * (door / 2 + 0.55), base + doorH * 0.45, 0.06]}>
              <planeGeometry args={[1.1, doorH * 0.9]} />
              <primitive object={texMat(tiled(lattice, 1, 3), SHOJI_GLOW)} attach="material" />
            </mesh>
            <Box p={[sd * (door / 2 + 0.06), base + doorH / 2, 0.08]} s={[0.14, doorH, 0.16]} c="#2a1a12" />
          </group>
        ))}
        <Box p={[0, base + doorH + 0.05, 0.08]} s={[door + 0.4, 0.16, 0.18]} c="#2a1a12" />
        <Box p={[0, base + 0.04, 0.1]} s={[door + 0.3, 0.08, 0.3]} c="#3a2a1c" />
        <NorenSplit w={door - 0.1} h={1.2} y={base + doorH - 0.05} z={0.14} />
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
          <primitive object={texMat(tiled(lattice, 12, 3), SHOJI_GLOW)} attach="material" />
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
      {/* (11/25 오후) 굴뚝은 물가 보일러실 것 하나로 (jm_spirit.jsx JmBoilerRoom) */}
      {/* 현관 옆 큰 소나무 */}
      <Pine p={[W / 2 - 1.8, base, front + 2.6]} s={1.15} />
      <Pine p={[-(W / 2 - 1.8), base, front + 2.4]} s={1.0} flip={-1} />
    </group>
  )
}

// ── 1층 큰 홀: 나무 마루, 가운데 붉은 길과 등불, 양옆 탕 칸, 앞쪽 접수대 ──
// ── (11/26 지민이 보낸 영화 장면) 현관 안쪽 ─────────────
// 작은 문 → 어두운 돌바닥(신 벗는 곳) + 디딤돌 + 마루 턱, 붉은 칠 벽에 짙은 나무 기둥과 보, 보에 줄줄이 걸린 나무 패,
// 접수대 뒤 금 병풍(붓꽃), 벽 등, 쌓아 둔 보라 방석. 글자는 우리 것(湯灯屋)만
function entryTagTexture() {
  return canvasTexture('jmyu:entrytag', 64, 160, (ctx, w, h) => {
    ctx.fillStyle = '#e9dcc0'
    ctx.fillRect(0, 0, w, h)
    ctx.fillStyle = '#9a2a1c'
    ctx.fillRect(0, 0, w, 14)
    ctx.fillStyle = '#3a2416'
    ctx.font = `bold 30px ${JP_FONT}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ;['湯', '灯', '屋'].forEach((ch, i) => ctx.fillText(ch, w / 2, 40 + i * 38))
  })
}
function irisScreenTexture() {
  return canvasTexture('jmyu:irisscreen', 512, 256, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h)
    g.addColorStop(0, '#e9b84a')
    g.addColorStop(1, '#d49a30')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, w, h)
    for (let i = 0; i < 14; i++) {
      const x = 20 + i * 36 + Math.sin(i * 2.7) * 8
      ctx.strokeStyle = '#4f7a3a'
      ctx.lineWidth = 4
      for (let k = -1; k <= 1; k++) {
        ctx.beginPath()
        ctx.moveTo(x, h)
        ctx.quadraticCurveTo(x + k * 10, h * 0.6, x + k * 18, h * (0.35 + Math.abs(k) * 0.12))
        ctx.stroke()
      }
      if (i % 2 === 0) {
        ctx.fillStyle = i % 4 ? '#6a4aa0' : '#8a6ac8'
        for (let p = 0; p < 3; p++) {
          ctx.beginPath()
          ctx.ellipse(x + (p - 1) * 8, h * 0.32 + (p === 1 ? -8 : 0), 7, 13, (p - 1) * 0.6, 0, Math.PI * 2)
          ctx.fill()
        }
      }
    }
  })
}
function sunHillsTexture() {
  return canvasTexture('jmyu:sunhills', 256, 128, (ctx, w, h) => {
    ctx.fillStyle = '#2a3a2e'
    ctx.fillRect(0, 0, w, h)
    ctx.fillStyle = '#d9b84a'
    ctx.beginPath()
    ctx.arc(w * 0.55, h * 0.38, 26, 0, Math.PI * 2)
    ctx.fill()
    ;[[0.15, 0.3], [0.38, 0.22], [0.62, 0.32], [0.85, 0.26]].forEach(([x, y], i) => {
      ctx.fillStyle = i % 2 ? '#3f7a4a' : '#2f6a3c'
      ctx.beginPath()
      ctx.moveTo(w * (x - 0.16), h)
      ctx.quadraticCurveTo(w * x, h * y - 10, w * (x + 0.16), h)
      ctx.fill()
    })
    ctx.strokeStyle = '#c9a24a'
    ctx.lineWidth = 6
    ctx.strokeRect(3, 3, w - 6, h - 6)
  })
}
function YuEntryHall({ ix, iz, base, H, door, doorH }) {
  const tag = useMemo(() => entryTagTexture(), [])
  const iris = useMemo(() => irisScreenTexture(), [])
  const hills = useMemo(() => sunHillsTexture(), [])
  const gz = iz - 2.6 // 돌바닥 안쪽 끝 = 마루 턱
  const posts = useMemo(() => {
    const out = []
    for (let x = door / 2 + 0.25; x < ix - 0.5; x += 3.2) out.push(x, -x)
    return out
  }, [ix, door])
  return (
    <group>
      {/* 어두운 돌바닥 + 줄눈 + 마루 턱 + 디딤돌 */}
      <Box p={[0, base + 0.02, (gz + iz) / 2]} s={[door + 1.6, 0.03, iz - gz]} c="#4a4a4c" />
      {range(4).map((k) => (
        <Box key={k} p={[0, base + 0.037, gz + 0.65 * (k + 1)]} s={[door + 1.6, 0.005, 0.03]} c="#2a2a2c" />
      ))}
      {[-1, 0, 1].map((k) => (
        <Box key={`v${k}`} p={[k * 0.95, base + 0.037, (gz + iz) / 2]} s={[0.03, 0.005, iz - gz]} c="#2a2a2c" />
      ))}
      <Box p={[0, base + 0.06, gz]} s={[door + 1.7, 0.12, 0.16]} c="#4a2a18" />
      <mesh position={[-0.35, base + 0.05, gz + 0.55]} scale={[0.75, 0.05, 0.42]} geometry={GEO.sphere}>
        <meshStandardMaterial color="#b9b2a2" roughness={0.6} />
      </mesh>
      {/* 짙은 나무 기둥 + 머리 높이 보 + 아래 굽 */}
      {posts.map((x) => (
        <Box key={x} p={[x, base + H / 2, iz - 0.12]} s={[0.26, H, 0.2]} c="#3a2214" />
      ))}
      {[-1, 1].map((s) => (
        <group key={s}>
          <Box p={[s * (ix / 2 + door / 4), base + doorH + 0.35, iz - 0.12]} s={[ix - door / 2, 0.24, 0.2]} c="#3a2214" />
          <Box p={[s * (ix / 2 + door / 4), base + 0.12, iz - 0.06]} s={[ix - door / 2, 0.24, 0.1]} c="#3a2214" />
        </group>
      ))}
      {/* 보에 줄줄이 걸린 나무 패 (현관 양옆) */}
      {[-1, 1].map((s) =>
        range(8).map((k) => (
          <mesh key={`${s}${k}`} position={[s * (door / 2 + 0.6 + k * 0.32), base + doorH + 0.02, iz - 0.25]}>
            <planeGeometry args={[0.2, 0.5]} />
            <meshStandardMaterial map={tag} side={THREE.DoubleSide} />
          </mesh>
        )),
      )}
      {/* 벽 등 */}
      {posts.slice(0, 4).map((x) => (
        <group key={`l${x}`} position={[x, base + 2.6, iz - 0.3]}>
          <Box p={[0, -0.12, 0.08]} s={[0.04, 0.3, 0.16]} c="#b8913c" />
          <Ball p={[0, 0.06, -0.08]} rad={0.15} m={GLOBE} />
        </group>
      ))}
      {/* 접수대 뒤 금 병풍(붓꽃, 4폭 지그재그) */}
      <group position={[12.6, base, 11.0]}>
        {range(4).map((k) => (
          <mesh key={k} position={[(k - 1.5) * 0.88, 0.95, k % 2 ? 0.12 : 0]} rotation={[0, k % 2 ? -0.28 : 0.28, 0]}>
            <planeGeometry args={[0.9, 1.7]} />
            <meshStandardMaterial map={iris} side={THREE.DoubleSide} roughness={0.5} metalness={0.15} />
          </mesh>
        ))}
        <Box p={[0, 1.82, 0.06]} s={[3.6, 0.05, 0.08]} c="#2a1a12" />
      </group>
      {/* 접수대 앞판: 해와 산 그림 + 붉은 난간 (帳場 상자 위에 덧댐) */}
      <group position={[12.6, base, 12.4]}>
        <mesh position={[0, 0.55, 0.47]}>
          <planeGeometry args={[2.6, 0.8]} />
          <meshStandardMaterial map={hills} />
        </mesh>
        <Box p={[0, 1.5, 0.42]} s={[3.5, 0.08, 0.08]} c="#a4472f" />
        <Box p={[0, 1.25, 0.42]} s={[3.5, 0.06, 0.06]} c="#a4472f" />
        {[-1.7, -0.57, 0.57, 1.7].map((x) => (
          <group key={x}>
            <Box p={[x, 1.25, 0.42]} s={[0.08, 0.5, 0.08]} c="#a4472f" />
            <Box p={[x, 1.55, 0.42]} s={[0.12, 0.08, 0.12]} m={GOLD_M} />
          </group>
        ))}
      </group>
      {/* 쌓아 둔 보라 방석 */}
      <group position={[15.6, base, 13.6]}>
        {range(8).map((k) => (
          <Box key={k} p={[0, 0.06 + k * 0.11, 0]} s={[0.75, 0.1, 0.75]} c={k % 2 ? '#6a3a8a' : '#7a4a9a'} />
        ))}
      </group>
    </group>
  )
}
// ── (11/26 지민 요청: 영화 속 로비는 아주 작음) 작은 로비 ↔ 목욕탕 칸막이: 로비 쪽 붉은 칠 + 짙은 기둥, 목욕탕 쪽 나무판, 가운데 문에 「大湯」 노렌 ──
function YuLobbyPartition({ L, base, H }) {
  const d0 = L.door.x - L.door.w / 2
  const d1 = L.door.x + L.door.w / 2
  const pieces = [[L.x0, d0], [d1, L.x1]]
  const noren = useMemo(() => getJpSignTexture('大湯', '#1e3a6a', '#f3e6c8', L.door.w / 1.1), [L.door.w])
  return (
    <group>
      {pieces.map(([a, b]) => (
        <group key={a}>
          <Box p={[(a + b) / 2, base + H / 2, L.z + 0.07]} s={[b - a, H, 0.12]} c="#a8573c" />
          <Box p={[(a + b) / 2, base + H / 2, L.z - 0.07]} s={[b - a, H, 0.12]} c="#8a6a48" />
          {range(Math.floor((b - a) / 3.2) + 1).map((i) => (
            <Box key={i} p={[a + 0.15 + i * ((b - a - 0.3) / Math.max(1, Math.floor((b - a) / 3.2))), base + H / 2, L.z + 0.16]} s={[0.24, H, 0.1]} c="#3a2214" />
          ))}
          <Box p={[(a + b) / 2, base + 0.12, L.z + 0.15]} s={[b - a, 0.24, 0.08]} c="#3a2214" />
        </group>
      ))}
      <Box p={[L.door.x, base + L.door.h + (H - L.door.h) / 2, L.z]} s={[L.door.w, H - L.door.h, 0.26]} c="#a8573c" />
      {[d0, d1].map((x) => (
        <Box key={x} p={[x, base + L.door.h / 2, L.z]} s={[0.18, L.door.h, 0.34]} c="#2a1a12" />
      ))}
      <Box p={[L.door.x, base + L.door.h + 0.06, L.z]} s={[L.door.w + 0.36, 0.14, 0.36]} c="#2a1a12" />
      {[1, -1].map((sd) => (
        <mesh key={sd} position={[L.door.x, base + L.door.h - 0.55, L.z + sd * 0.2]} rotation={[0, sd > 0 ? 0 : Math.PI, 0]}>
          <planeGeometry args={[L.door.w - 0.1, 1.0]} />
          <meshStandardMaterial map={noren} side={THREE.DoubleSide} />
        </mesh>
      ))}
    </group>
  )
}
// ── (11/26) 홀 다리 밑 큰 목욕탕 ─────────────
// 영화 장면: 가운데 붉은 길 양옆으로 낮은 칸막이로 나뉜 탕 칸, 칸마다 둥글게 꺼진 큰 탕(크림색 테두리 + 노르스름한 약탕 물),
//   밧줄 감은 큰 나무 욕조, 작은 나무 들통·비누, 길 위 붉은 긴 의자(보라 방석). 걷는 판정은 생성 스크립트(YU_HALL_BATH)
const HB_RIM = mat('#e2d3b0', { roughness: 0.85 })
const HB_WATER = mat('#d6cf72', { emissive: '#8a8a2a', emissiveIntensity: 0.25, roughness: 0.15, transparent: true, opacity: 0.88 })
const HB_WOOD = mat('#9a6a3a', { roughness: 0.7 })
const HB_ROPE = mat('#c9a86a', { roughness: 0.9 })
const HB_PART = mat('#b8b48a', { roughness: 0.8 })
function HbBucket({ p, soap }) {
  return (
    <group position={p}>
      <mesh position={[0, 0.13, 0]}>
        <cylinderGeometry args={[0.17, 0.15, 0.26, 12, 1, true]} />
        <primitive object={HB_WOOD} attach="material" />
      </mesh>
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.15, 12]} />
        <primitive object={HB_WOOD} attach="material" />
      </mesh>
      {[0.06, 0.2].map((y) => (
        <mesh key={y} position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.165, 0.012, 4, 16]} />
          <primitive object={HB_ROPE} attach="material" />
        </mesh>
      ))}
      {soap && <Box p={[0, 0.06, 0]} s={[0.12, 0.05, 0.08]} c="#e8a090" />}
    </group>
  )
}
// (11/26 지민 요청) 물 효과: 두 장의 물결 노멀맵이 서로 다른 방향으로 흘러 일렁임 + 가끔 번지는 둥근 물결 + 들어가면 물 튐(WadeSplash)
function waterNormalTexture() {
  const tex = canvasTexture('jmyu:waternormal', 256, 256, (ctx, w, h) => {
    const img = ctx.createImageData(w, h)
    const H = (x, y) => {
      const u = (x / w) * Math.PI * 2
      const v = (y / h) * Math.PI * 2
      return Math.sin(u * 3 + v * 2) * 0.5 + Math.sin(u * 5 - v * 3 + 1.3) * 0.3 + Math.sin(u * 2 + v * 7 + 2.1) * 0.2 + Math.sin(u * 9 + v * 4) * 0.12
    }
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const dx = (H(x + 1, y) - H(x - 1, y)) * 6
      const dy = (H(x, y + 1) - H(x, y - 1)) * 6
      const l = Math.hypot(dx, dy, 1)
      const i = (y * w + x) * 4
      img.data[i] = ((-dx / l) * 0.5 + 0.5) * 255
      img.data[i + 1] = ((-dy / l) * 0.5 + 0.5) * 255
      img.data[i + 2] = ((1 / l) * 0.5 + 0.5) * 255
      img.data[i + 3] = 255
    }
    ctx.putImageData(img, 0, 0)
  })
  tex.colorSpace = THREE.NoColorSpace
  return tex
}
function useWaterMaterial(color, rx, rz) {
  const mats = useMemo(() => {
    const n1 = tiled(waterNormalTexture(), rx / 1.6, rz / 1.6)
    const m = new THREE.MeshStandardMaterial({ color, roughness: 0.08, metalness: 0.2, transparent: true, opacity: 0.86, normalMap: n1, normalScale: new THREE.Vector2(0.6, 0.6), emissive: color, emissiveIntensity: 0.12, depthWrite: false })
    return { m, n1 }
  }, [color, rx, rz])
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    mats.n1.offset.set(Math.sin(t * 0.13) * 0.4 + t * 0.03, Math.cos(t * 0.11) * 0.4 - t * 0.02)
    mats.m.normalScale.setScalar(0.5 + Math.sin(t * 0.9) * 0.12)
  })
  return mats.m
}
function ellipseRing(rx, rz, t, h) {
  const shape = new THREE.Shape()
  shape.absellipse(0, 0, rx + t, rz + t, 0, Math.PI * 2, false)
  const hole = new THREE.Path()
  hole.absellipse(0, 0, rx, rz, 0, Math.PI * 2, true)
  shape.holes.push(hole)
  return new THREE.ExtrudeGeometry(shape, { depth: h, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.06, bevelSegments: 2, curveSegments: 72 })
}
function ellipseDisc(rx, rz) {
  const shape = new THREE.Shape()
  shape.absellipse(0, 0, rx, rz, 0, Math.PI * 2, false)
  return new THREE.ShapeGeometry(shape, 72)
}
// 둥근 물결: 탕 안 아무 데서나 번졌다 사라짐 (탕마다 3개)
function HbRipples({ rx, rz, y }) {
  const st = useMemo(() => Array.from({ length: 3 }, (_, i) => ({ x: 0, z: 0, t0: -i * 1.3, m: new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }) })), [])
  const refs = useRef([])
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    st.forEach((r, i) => {
      const m = refs.current[i]
      if (!m) return
      let u = (t - r.t0) / 3.6
      if (u > 1 || u < 0) {
        r.t0 = t
        const a = Math.random() * Math.PI * 2
        const k = Math.sqrt(Math.random()) * 0.7
        r.x = Math.cos(a) * rx * k
        r.z = Math.sin(a) * rz * k
        u = 0
      }
      const sc = 0.2 + u * 1.8
      m.position.set(r.x, y + 0.01, r.z)
      m.scale.set(sc, sc, 1)
      r.m.opacity = 0.35 * (1 - u)
    })
  })
  return st.map((r, i) => <mesh key={i} ref={(el) => (refs.current[i] = el)} geometry={RIPPLE_GEO} material={r.m} rotation={[-Math.PI / 2, 0, 0]} userData={{ noMerge: true }} />)
}
// 실제처럼 피어오르는 김: 물 위 낮게 깔려 천천히 도는 안개 + 위로 솟으며 퍼지고 옅어지는 큰 김 덩어리 (탕 넓이만큼 많이)
// (11/26 최적화) 김 덩어리마다 스프라이트(그리기 1번씩, 탕 하나에 20~26번) → 탕마다 인스턴스 한 덩어리(그리기 1번)
//   카메라를 바라보는 판(빌보드)을 셰이더에서 만들고, 덩어리마다 투명도·회전은 인스턴스 속성으로
const STEAM_VERT = /* glsl */ `
attribute float aOpacity;
attribute float aRot;
varying vec2 vUv;
varying float vOp;
void main() {
  vUv = uv;
  vOp = aOpacity;
  vec4 c = modelViewMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
  float sx = length(instanceMatrix[0].xyz);
  float sy = length(instanceMatrix[1].xyz);
  float cs = cos(aRot), sn = sin(aRot);
  vec2 p = vec2(position.x * cs - position.y * sn, position.x * sn + position.y * cs);
  c.xy += p * vec2(sx, sy);
  gl_Position = projectionMatrix * c;
}`
const STEAM_FRAG = /* glsl */ `
uniform sampler2D map;
uniform vec3 color;
varying vec2 vUv;
varying float vOp;
void main() {
  vec4 t = texture2D(map, vUv);
  gl_FragColor = vec4(color * t.rgb, t.a * vOp);
  if (gl_FragColor.a < 0.004) discard;
}`
let steamMat = null
function steamMaterial() {
  if (steamMat) return steamMat
  steamMat = new THREE.ShaderMaterial({
    uniforms: { map: { value: steamTexture() }, color: { value: new THREE.Color('#fffaf0') } },
    vertexShader: STEAM_VERT, fragmentShader: STEAM_FRAG, transparent: true, depthWrite: false,
  })
  return steamMat
}
function HbSteam({ rx, rz, y, rise = 6.5 }) {
  const puffs = useMemo(() => {
    const n = Math.min(22, Math.max(8, Math.round(rx * rz * 0.9)))
    const out = []
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + i * 0.7
      const k = Math.sqrt(((i * 0.618) % 1)) * 0.75
      out.push({ kind: 'rise', x: Math.cos(a) * rx * k, z: Math.sin(a) * rz * k, phase: (i * 0.37) % 1, seed: i * 1.7, size: 2.0 + ((i * 0.29) % 1) * 1.8, speed: 0.07 + ((i * 0.13) % 1) * 0.05 })
    }
    for (let i = 0; i < 4; i++) out.push({ kind: 'mist', x: 0, z: 0, phase: i / 4, seed: 50 + i * 2.3, size: Math.max(rx, rz) * 1.5, speed: 0.03 })
    return out
  }, [rx, rz])
  const n = puffs.length
  const ref = useRef(null)
  const attrs = useMemo(() => ({ op: new THREE.InstancedBufferAttribute(new Float32Array(n), 1), rot: new THREE.InstancedBufferAttribute(new Float32Array(n), 1) }), [n])
  const geo = useMemo(() => {
    const g = new THREE.PlaneGeometry(1, 1)
    g.setAttribute('aOpacity', attrs.op)
    g.setAttribute('aRot', attrs.rot)
    return g
  }, [attrs])
  const tmp = useMemo(() => ({ m: new THREE.Matrix4(), p: new THREE.Vector3(), q: new THREE.Quaternion(), s: new THREE.Vector3() }), [])
  useFrame(({ clock }) => {
    const mesh = ref.current
    if (!mesh) return
    const t = clock.elapsedTime
    puffs.forEach((p, i) => {
      let op
      if (p.kind === 'mist') {
        const a = t * 0.05 + p.seed
        tmp.p.set(Math.cos(a) * rx * 0.3, y + 0.35 + Math.sin(t * 0.3 + p.seed) * 0.08, Math.sin(a) * rz * 0.3)
        tmp.s.set(p.size, p.size * 0.35, 1)
        op = 0.32 + Math.sin(t * 0.4 + p.seed) * 0.08
        attrs.rot.array[i] = 0
      } else {
        const u = (t * p.speed + p.phase) % 1
        const swayX = Math.sin(t * 0.6 + p.seed) * 0.6 * u + Math.sin(t * 0.23 + p.seed * 2) * 0.3
        const swayZ = Math.cos(t * 0.5 + p.seed) * 0.5 * u
        tmp.p.set(p.x + swayX, y + 0.3 + u * rise, p.z + swayZ)
        const sc = p.size * (0.45 + u * 1.6)
        tmp.s.set(sc, sc, 1)
        op = 0.5 * Math.sin(Math.PI * Math.min(1, u * 1.4)) * (1 - u * 0.5)
        attrs.rot.array[i] = p.seed + t * 0.05 * (i % 2 ? 1 : -1)
      }
      tmp.m.compose(tmp.p, tmp.q, tmp.s)
      mesh.setMatrixAt(i, tmp.m)
      attrs.op.array[i] = op
    })
    mesh.instanceMatrix.needsUpdate = true
    attrs.op.needsUpdate = true
    attrs.rot.needsUpdate = true
  })
  return <instancedMesh ref={ref} args={[geo, steamMaterial(), n]} frustumCulled={false} renderOrder={2} userData={{ noMerge: true }} />
}
function HbTub({ x, z, rx, rz, rim, water, i }) {
  const geo = useMemo(() => ({ ring: ellipseRing(rx, rz, 0.4, rim), disc: ellipseDisc(rx, rz) }), [rx, rz, rim])
  const wmat = useWaterMaterial('#8ed6cc', rx, rz) // 지민 요청: 녹색 기가 도는 하늘색
  return (
    <group position={[x, 0, z]}>
      <mesh geometry={geo.ring} rotation={[-Math.PI / 2, 0, 0]} material={HB_RIM} />
      <mesh geometry={geo.disc} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
        <meshStandardMaterial color="#4f8f8a" roughness={0.6} />
      </mesh>
      <mesh geometry={geo.disc} rotation={[-Math.PI / 2, 0, 0]} position={[0, water, 0]} material={wmat} userData={{ noMerge: true }} />
      <HbRipples rx={rx} rz={rz} y={water} />
      <WadeSplash w={rx * 1.6} len={rz * 1.6} y={water} />
      <HbSteam rx={rx} rz={rz} y={water} />
      <HbBucket p={[rx + 0.9, 0, 0.6]} soap={i % 2 === 0} />
      <HbBucket p={[rx * 0.4, 0, rz + 0.9]} />
    </group>
  )
}
function YuHallBaths({ HB, base }) {
  const rim = HB.rim ?? 0.5
  const water = HB.water ?? 0.4
  const ph = HB.part?.h ?? 2.4
  return (
    <group position={[0, base, 0]}>
      {/* (11/26 지민 요청: 사진처럼 칸막이, 신들 기준이라 사람보다 높게) 연두빛 판 + 나무 기둥·갓 */}
      {(HB.part?.segs ?? []).map(([x0, z0, x1, z1], i) => {
        const len = Math.hypot(x1 - x0, z1 - z0)
        const alongX = Math.abs(x1 - x0) > Math.abs(z1 - z0)
        const n = Math.max(1, Math.round(len / 1.8))
        return (
          <group key={`pt${i}`} position={[(x0 + x1) / 2, 0, (z0 + z1) / 2]} rotation={[0, alongX ? 0 : Math.PI / 2, 0]}>
            <mesh position={[0, ph / 2, 0]} scale={[len, ph, 0.15]} geometry={GEO.box} material={HB_PART} />
            <Box p={[0, ph + 0.04, 0]} s={[len + 0.1, 0.08, 0.26]} c="#8a6a48" />
            <Box p={[0, 0.12, 0]} s={[len, 0.24, 0.2]} c="#6a4a30" />
            {range(n + 1).map((k) => (
              <Box key={k} p={[-len / 2 + (k * len) / n, ph / 2, 0]} s={[0.12, ph, 0.22]} c="#8a6a48" />
            ))}
          </group>
        )
      })}
      {HB.tubs.map(([x, z, rx, rz], i) => (
        <HbTub key={i} x={x} z={z} rx={rx} rz={rz ?? rx} rim={rim} water={water} i={i} />
      ))}
      {/* 밟고 오르는 돌 */}
      {(HB.steps ?? []).map(([x, z], i) => (
        <mesh key={`s${i}`} position={[x, 0.15, z]} scale={[0.55, 0.15, 0.55]} geometry={GEO.sphere}>
          <meshStandardMaterial color="#b9b2a2" roughness={0.7} flatShading />
        </mesh>
      ))}
      {/* 밧줄 감은 큰 나무 욕조 (물 + 띠 두 줄 + 받침 돌) */}
      {HB.barrels.map(([x, z, r], i) => (
        <group key={`b${i}`} position={[x, 0, z]}>
          <mesh position={[0, 0.12, 0]}>
            <cylinderGeometry args={[r + 0.12, r + 0.16, 0.24, 28]} />
            <primitive object={HB_RIM} attach="material" />
          </mesh>
          <mesh position={[0, 0.55, 0]}>
            <cylinderGeometry args={[r, r * 0.92, 0.65, 28, 1, true]} />
            <meshStandardMaterial color="#8a5a30" roughness={0.7} side={THREE.DoubleSide} />
          </mesh>
          {[0.4, 0.75].map((y) => (
            <mesh key={y} position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[r * (1.0 - (0.8 - y) * 0.1) + 0.01, 0.04, 6, 32]} />
              <primitive object={HB_ROPE} attach="material" />
            </mesh>
          ))}
          <mesh position={[0, 0.78, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[r - 0.04, 28]} />
            <meshStandardMaterial color="#8ed6cc" emissive="#2f6a64" emissiveIntensity={0.25} roughness={0.08} />
          </mesh>
          <HbSteam rx={r * 0.8} rz={r * 0.8} y={0.78} rise={4} />
          <HbBucket p={[r + 0.5, 0, -0.2]} soap />
        </group>
      ))}
      {/* 길 위 붉은 긴 의자 + 보라 방석 */}
      {HB.benches.map(([x, z, len], i) => (
        <group key={`n${i}`} position={[x, 0, z]}>
          <Box p={[0, 0.38, 0]} s={[0.62, 0.1, len]} c="#a4472f" />
          <Box p={[0, 0.17, 0]} s={[0.5, 0.34, len - 0.2]} c="#8f241e" />
          {[-1, 0, 1].map((k) => (
            <Box key={k} p={[0, 0.45, k * (len / 3)]} s={[0.48, 0.05, len / 3 - 0.12]} c="#7a4a9a" />
          ))}
        </group>
      ))}
    </group>
  )
}
function YuGroundHall({ W, D, Y }) {
  const { base, wt, pav, lv, bath } = Y
  const ix = W / 2 - wt
  const iz = D / 2 - wt
  const H = lv[1] - base
  const planks = useMemo(() => tiled(plankTexture(), (ix * 2) / 1.6, (iz * 2) / 1.6), [ix, iz])
  const pine = useMemo(() => pineMuralTexture(), [])
  const lamps = useMemo(() => {
    const out = []
    for (let z = 6.6; z > pav.z1 + 0.6; z -= 2.2) for (const s of [-1, 1]) out.push([s * 1.55, z])
    return out
  }, [iz, pav.z1])
  return (
    <group>
      {/* 마루 */}
      {rectHoles([-ix, -iz, ix, iz], Y.floorHoles).map(([x0, z0, x1, z1], i) => (
        <mesh key={`fl${i}`} position={[(x0 + x1) / 2, base + 0.01, (z0 + z1) / 2]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[x1 - x0, z1 - z0]} />
          <primitive object={texMat(tiled(plankTexture(), (x1 - x0) / 1.6, (z1 - z0) / 1.6))} attach="material" />
        </mesh>
      ))}
      {/* 가운데 붉은 길 + 금 테 */}
      {/* 붉은 길은 현관 돌바닥(마루 턱 iz-2.6) 안쪽부터 */}
      <Box p={[0, base + 0.03, (iz - 2.7 + pav.z1) / 2]} s={[2.2, 0.02, iz - 2.7 - pav.z1]} c="#8f2a24" />
      {[-1, 1].map((s) => (
        <Box key={s} p={[s * 1.12, base + 0.035, (iz - 2.7 + pav.z1) / 2]} s={[0.06, 0.02, iz - 2.7 - pav.z1]} m={GOLD_M} />
      ))}
      {/* (11/26 지민 요청) 붉은 길 위·옆 장식(흰 공 등불 기둥)은 뺌 */}
      {/* (11/26 지민이 보낸 영화 장면) 다리 밑 신들의 큰 목욕탕 — 남탕·여탕 구분 없음 */}
      {Y.hallBath && <YuHallBaths HB={Y.hallBath} base={base} />}
      {/* 목욕탕 문 위 간판 (로비 쪽) */}
      <mesh position={[bath.x1 + 0.2, base + bath.door.h + 0.7, bath.door.z]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[1.8, 0.65]} />
        <GlowMaterial glow={0.5} map={getJpSignTexture('大湯', '#1e3a8a', '#f5f0e6', 1.8 / 0.65)} side={THREE.DoubleSide} />
      </mesh>
      {/* 앞쪽: 신발장 2개 + 접수대(帳場) */}
      {[-1, 1].map((s) => (
        <group key={s} position={[s * 3.2, base, iz - 0.6]}>
          <Box p={[0, 0.65, 0]} s={[1.6, 1.3, 0.5]} c="#5a3d2a" />
          {range(3).map((r) =>
            range(4).map((c) => <Box key={`${r}${c}`} p={[-0.57 + c * 0.38, 0.25 + r * 0.38, -0.26]} s={[0.3, 0.3, 0.02]} c="#3a281c" />),
          )}
        </group>
      ))}
      <group position={[12.6, base, 12.4]}>
        <Box p={[0, 0.5, 0]} s={[3.4, 1, 0.9]} c="#4a2f1f" />
        <Box p={[0, 1.03, 0]} s={[3.6, 0.06, 1.0]} c="#2b1d14" />
        <Box p={[0, 0.5, 0.46]} s={[3.2, 0.7, 0.02]} m={GOLD_M} />
        <mesh position={[0, 3.2, 0]}>
          <planeGeometry args={[1.6, 0.6]} />
          <GlowMaterial glow={0.5} map={getJpSignTexture('帳場', '#3d2a1e', '#f3e6c8', 1.6 / 0.6)} side={THREE.DoubleSide} />
        </mesh>
      </group>
      {/* 동쪽 벽 아래 긴 의자 */}
      {[-3, 3].map((z) => (
        <group key={z} position={[ix - 0.5, base, z]}>
          <Box p={[0, 0.42, 0]} s={[0.5, 0.08, 2.6]} c="#9a7650" />
          {[-1, 1].map((s) => (
            <Box key={s} p={[0, 0.2, s * 1.1]} s={[0.42, 0.4, 0.1]} c="#5a3d2a" />
          ))}
        </group>
      ))}
      {/* 동쪽 벽 소나무 벽화 (서쪽은 목욕탕 벽, YuBathWing) + 뒷벽 나무판·문 */}
      <mesh position={[ix - 0.01, base + H * 0.45, 0]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[iz * 2 - 0.4, H * 0.8]} />
        <primitive object={texMat(pine)} attach="material" />
      </mesh>
      <Box p={[0, base + H / 2, -iz + 0.02]} s={[ix * 2, H, 0.02]} c="#6b4630" />
      {[8].map((x) => (
        <group key={x} position={[x, base, -iz + 0.05]}>
          <Box p={[0, 1.2, 0]} s={[1.8, 2.4, 0.04]} c="#3a281c" />
          <Box p={[0, 1.2, 0.03]} s={[0.04, 2.3, 0.02]} m={GOLD_M} />
        </group>
      ))}
      {/* 앞벽 안쪽: (11/26 영화 장면) 붉은 칠 벽 + 짙은 나무 기둥·보 + 보에 걸린 나무 패 줄 + 벽 등 */}
      {[-1, 1].map((s) => (
        <Box key={s} p={[s * (ix / 2 + Y.door / 4), base + H / 2, iz - 0.02]} s={[ix - Y.door / 2, H, 0.02]} c="#a8573c" />
      ))}
      <YuEntryHall ix={ix} iz={iz} base={base} H={H} door={Y.door} doorH={Y.doorH} />
      {Y.lobby && <YuLobbyPartition L={Y.lobby} base={base} H={H} />}
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
      {/* (11/25) 5층은 집무실 벽지(YuOffice)라 2~4층만 */}
      {[1, 2, 3].map((k) => {
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
  const cw = (Y.guest?.w ?? 2.8) + 0.2
  const side = (w - cw) / 2
  return (
    <group>
      {/* (11/25) 몸체 속은 손님용 엘리베이터 승강로: 양옆 짙은 나무 덩어리 + 층마다 앞·뒤 판 (1층은 앞, 2~4층은 뒤가 열림) */}
      {[-1, 1].map((s) => (
        <Box key={s} p={[s * (cw / 2 + side / 2), (base + top) / 2, cz]} s={[side, top - base, pav.z1 - pav.z0 - 0.2]} c="#5e2a1f" />
      ))}
      <Box p={[0, (base + 3.6 + lv[1]) / 2, f - 0.15]} s={[cw, lv[1] - base - 3.6, 0.3]} c={DARK} />
      <Box p={[0, (base + lv[1]) / 2, pav.z0 + 0.15]} s={[cw, lv[1] - base, 0.3]} c={DARK} />
      {[1, 2, 3].map((k) => (
        <group key={k}>
          {/* (11/26 여관 점검) 홀 쪽 앞면이 짙은 검은 판이라 홀 가운데 구멍처럼 보였음 → 붉은 칠 + 금 테 + 안쪽 짙은 붉은 판 */}
          <Box p={[0, (lv[k] + lv[k + 1]) / 2, f - 0.15]} s={[cw, lv[k + 1] - lv[k], 0.3]} c="#8a4232" />
          <Box p={[0, (lv[k] + lv[k + 1]) / 2, f + 0.01]} s={[cw - 0.7, lv[k + 1] - lv[k] - 1.0, 0.04]} c="#7a2218" />
          {[lv[k] + 0.25, lv[k + 1] - 0.25].map((y) => (
            <Box key={y} p={[0, y, f + 0.02]} s={[cw, 0.14, 0.06]} m={GOLD_M} />
          ))}
          {[-1, 1].map((s) => (
            <Box key={s} p={[s * (cw / 2 - 0.07), (lv[k] + lv[k + 1]) / 2, f + 0.02]} s={[0.14, lv[k + 1] - lv[k], 0.06]} m={GOLD_M} />
          ))}
          <Box p={[0, lv[k] + 3.6 + (lv[k + 1] - lv[k] - 3.6) / 2, pav.z0 + 0.15]} s={[cw, lv[k + 1] - lv[k] - 3.6, 0.3]} c={DARK} />
          {/* 뒤 회랑 쪽 금 문틀 + 층 현판 */}
          {[-1, 1].map((s) => (
            <Box key={s} p={[s * (cw / 2 + 0.06), lv[k] + 1.8, pav.z0 - 0.02]} s={[0.14, 3.6, 0.12]} m={GOLD_M} />
          ))}
          <Box p={[0, lv[k] + 3.65, pav.z0 - 0.02]} s={[cw + 0.4, 0.16, 0.14]} m={GOLD_M} />
        </group>
      ))}
      {[-1, 1].map((s) => (
        <Box key={`gf${s}`} p={[s * (cw / 2 + 0.06), base + 1.8, f + 0.02]} s={[0.14, 3.6, 0.12]} m={GOLD_M} />
      ))}
      {/* (11/26) 손님용 엘리베이터는 로비로 옮김 → 누각 문은 모두 닫힌 붉은 문 (장식) */}
      <ClosedDoors x={0} y={base} z={f - 0.12} cw={cw} />
      {[1, 2, 3].map((k) => (
        <ClosedDoors key={`gd${k}`} x={0} y={lv[k]} z={pav.z0 + 0.12} cw={cw} />
      ))}
      <Box p={[0, base + 3.65, f + 0.02]} s={[cw + 0.4, 0.16, 0.14]} m={GOLD_M} />
      {/* 아래: 보라 휘장 + 매듭 (가운데 엘리베이터 문 자리는 비움) */}
      {folds.filter((i) => Math.abs(-w / 2 + 0.55 + (i * (w - 1.1)) / 8) > cw / 2 + 0.2).map((i) => (
        <Box key={i} p={[-w / 2 + 0.55 + (i * (w - 1.1)) / 8, base + 1.4, f + 0.05 + (i % 2) * 0.06]} s={[0.62, 2.8, 0.06]} m={i % 2 ? CURTAIN_DARK : CURTAIN} />
      ))}
      <Box p={[0, base + 3.95, f + 0.14]} s={[w - 0.4, 0.35, 0.05]} m={CURTAIN} />
      {/* 발코니 판 + 금 장식 */}
      <Box p={[0, base + 4.0, f + 0.5]} s={[w + 0.4, 0.4, 1.4]} c="#5a3a24" />
      <Box p={[0, base + 4.0, f + 1.21]} s={[w + 0.4, 0.3, 0.04]} m={GOLD_M} />
      {range(5).map((i) => (
        <Box key={i} p={[-w / 2 + 0.4 + (i * (w - 0.8)) / 4, base + 4.0, f + 1.24]} s={[0.3, 0.3, 0.03]} c="#7a2218" />
      ))}
      {/* 가운데: 붉은 두짝문 + 금 장식, 양옆 검은 기둥, 금 문틀 */}
      <group position={[0, base + 4.3, f + 0.02]}>
        <Box p={[0, 1.6, 0]} s={[2.8, 3.0, 0.06]} c="#a95753" />
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
            {s > 0 && <Box p={[0, 1.0, s * ((pav.z1 - pav.z0) / 2 + 0.25)]} s={[w + 0.6, 0.1, 0.1]} c={VERM} />}
            <Box p={[s * (w / 2 + 0.25), 1.0, 0]} s={[0.1, 0.1, pav.z1 - pav.z0 + 0.6]} c={VERM} />
          </group>
        ))}
        {range(7).map((i) => (
          <Box key={i} p={[-w / 2 - 0.25 + (i * (w + 0.5)) / 6, 0.5, (pav.z1 - pav.z0) / 2 + 0.25]} s={[0.1, 1.0, 0.1]} c={VERM} />
        ))}
        {/* 위에서 빛나는 등 (엘리베이터 칸 위로 올림) */}
        <Ball p={[0, 3.9, 0.9]} rad={0.3} m={GLOBE} />
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

// 손님용 엘리베이터 문짝: 붉은 옻칠 두짝문에 금 글자 「上」, 문 앞쪽으로 활짝 열려 있음 (face = 문이 보는 방향 ±z)
function upTexture() {
  return canvasTexture('jmyu:updoor-ko', 128, 256, (ctx, w, h) => {
    ctx.fillStyle = '#9a2018'
    ctx.fillRect(0, 0, w, h)
    ctx.strokeStyle = '#d4a83e'
    ctx.lineWidth = 6
    ctx.strokeRect(8, 8, w - 16, h - 16)
    ctx.fillStyle = '#e8c35a'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.font = `bold ${Math.round(w * 0.8)}px ${JP_FONT}`
    ctx.fillText('上', w / 2, h * 0.42)
    ctx.font = `bold ${Math.round(w * 0.17)}px "Malgun Gothic", sans-serif`
    ctx.fillText('위로 가는 문', w / 2, h * 0.74)
  })
}
function ClosedDoors({ x, y, z, cw }) {
  return (
    <group position={[x, y, z]}>
      <Box p={[0, 1.8, 0]} s={[cw, 3.6, 0.12]} c="#8a1c16" />
      <Box p={[0, 1.8, 0]} s={[0.05, 3.5, 0.16]} m={GOLD_M} />
      {[-1, 1].map((sd) => [1.1, 2.5].map((yy) => (
        <Box key={`${sd}${yy}`} p={[sd * cw / 4, yy, 0]} s={[cw / 2 - 0.4, 0.9, 0.15]} c="#6a1410" />
      )))}
    </group>
  )
}
// ── (11/26) 손님용 엘리베이터 승강로: 작은 로비 서쪽 끝, 1층 ~ 5층 바닥 밑. 문은 동쪽(+x) ──
function YuGuestShaft({ Y }) {
  const { guest: G, lv, base } = Y
  if (!G?.shaft) return null
  const S = G.shaft
  const top = lv[5] // (11/26) 직원용을 없애 손님용이 5층 주인의 방까지
  const cw = G.w + 0.2
  return (
    <group position={[G.x, 0, G.z]}>
      {/* 붉은 칠 벽 3면 + 모서리 금 띠 */}
      <Box p={[0, (base + top) / 2, -S]} s={[S * 2 + 0.2, top - base, 0.2]} c="#8a4232" />
      <Box p={[0, (base + top) / 2, S]} s={[S * 2 + 0.2, top - base, 0.2]} c="#8a4232" />
      <Box p={[-S, (base + top) / 2, 0]} s={[0.2, top - base, S * 2]} c="#8a4232" />
      {[-1, 1].map((sz) => (
        <Box key={sz} p={[S + 0.02, (base + top) / 2, sz * (S - 0.05)]} s={[0.16, top - base, 0.16]} m={GOLD_M} />
      ))}
      {[0, 1, 2, 3, 4].map((k) => {
        const y = k === 0 ? base : lv[k]
        const h = lv[k + 1] - (k === 0 ? base : lv[k])
        return (
          <group key={k}>
            {/* 문 위 판 + 금 문틀 + 층 현판 */}
            <Box p={[S, y + 3.6 + (h - 3.6) / 2, 0]} s={[0.2, h - 3.6, S * 2]} c="#8a4232" />
            <Box p={[S + 0.12, y + 3.65, 0]} s={[0.12, 0.16, cw + 0.4]} m={GOLD_M} />
            {[-1, 1].map((sz) => (
              <Box key={sz} p={[S + 0.12, y + 1.8, sz * (cw / 2 + 0.06)]} s={[0.12, 3.6, 0.14]} m={GOLD_M} />
            ))}
            <mesh position={[S + 0.2, y + 4.2, 0]} rotation={[0, Math.PI / 2, 0]}>
              <planeGeometry args={[1.4, 0.45]} />
              <GlowMaterial glow={0.5} map={getJpSignTexture('客用', '#2b1a12', '#e8c35a', 1.4 / 0.45)} side={THREE.DoubleSide} />
            </mesh>
          </group>
        )
      })}
    </group>
  )
}
function GuestDoors({ x, y, z, face, cw }) {
  const map = upTexture()
  const half = cw / 2
  return (
    <group position={[x, y, z]}>
      {[-1, 1].map((s) => (
        <group key={s} position={[s * half, 0, 0]} rotation={[0, face * s * -1.25, 0]}>
          <mesh position={[-s * half / 2, 1.75, face * 0.03]} rotation={[0, face > 0 ? 0 : Math.PI, 0]}>
            <planeGeometry args={[half - 0.05, 3.4]} />
            <meshStandardMaterial map={map} side={THREE.DoubleSide} roughness={0.35} metalness={0.15} />
          </mesh>
          <Box p={[-s * half / 2, 1.75, 0]} s={[half - 0.05, 3.4, 0.05]} c="#6a1410" />
        </group>
      ))}
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

// ── (11/25) 1층 로비 뒤 서쪽 문 → 뒤채 목욕탕 ─────────────
// 모티브: 영화 속 온천장의 큰 탕 (탕 앞 번대에서 약탕 패를 받아 가는 흐름, 큰 나무 욕조, 김)
//   번대(番台) 뒤 벽에 나무 패(札)가 줄줄이 걸린 판, 칸마다 큰 나무 욕조, 가운데 둥근 큰 욕조 위 물 내리는 관과 줄
// 글자는 우리 것(大湯·薬湯·番台 등)만. 걷는 판정은 생성 스크립트(bath 값과 같음)
function tagBoardTexture() {
  const names = ['薬湯', '大湯', '桜湯', '菖蒲湯', '柚子湯', '泥湯', '金湯', '銀湯', '笹湯', '松湯', '梅湯', '竹湯']
  return canvasTexture('jmyu:tags', 1024, 384, (ctx, w, h) => {
    ctx.fillStyle = '#3a2618'
    ctx.fillRect(0, 0, w, h)
    const cols = 12
    const tw = w / cols
    for (let r = 0; r < 2; r++) {
      for (let c = 0; c < cols; c++) {
        const x = c * tw + tw * 0.12
        const y = r * (h / 2) + 14
        ctx.fillStyle = (r + c) % 3 === 0 ? '#e9d3a5' : '#d9bf8a'
        ctx.fillRect(x, y, tw * 0.76, h / 2 - 28)
        ctx.fillStyle = '#7a1d12'
        ctx.beginPath()
        ctx.arc(x + tw * 0.38, y + 10, 4, 0, Math.PI * 2)
        ctx.fill()
        const text = names[(c + r * 5) % names.length]
        ctx.fillStyle = '#2a1a10'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        const chars = [...text]
        const step = (h / 2 - 50) / chars.length
        ctx.font = `bold ${Math.min(tw * 0.5, step * 0.9)}px ${JP_FONT}`
        chars.forEach((ch, i) => ctx.fillText(ch, x + tw * 0.38, y + 28 + step * (i + 0.5)))
      }
    }
  })
}

function YuBathWing({ Y }) {
  const { base, bath } = Y
  const { x0, x1, z0, z1, h, door, part, counter, tubs, center } = bath
  const cx = (x0 + x1) / 2
  const cz = (z0 + z1) / 2
  const wd = x1 - x0
  const dd = z1 - z0
  const tags = useMemo(() => tagBoardTexture(), [])
  const d0 = door.z - door.w / 2
  const d1 = door.z + door.w / 2
  const [g0, g1] = part.gap
  return (
    <group>
      {/* (11/25 오후) 본관 1층 서쪽 안으로 옮김: 로비와 나누는 벽(x1) — 문 자리만 비움, 로비 쪽은 짙은 나무 + 문 위 노렌 */}
      {[
        [(d1 + z1) / 2, z1 - d1],
        [(z0 + d0) / 2, d0 - z0],
      ].map(([z, len], i) => (
        <group key={i}>
          <Box p={[x1, base + h / 2, z]} s={[0.3, h, len]} c="#6b4630" />
          <Box p={[x1 - 0.16, base + (h - 1.6) / 2, z]} s={[0.02, h - 1.6, len]} c="#9a6a40" />
          <Box p={[x1 - 0.16, base + 0.6, z]} s={[0.03, 1.2, len]} c="#5a3d2a" />
        </group>
      ))}
      <Box p={[x1, base + door.h + (h - door.h) / 2, door.z]} s={[0.3, h - door.h, door.w]} c="#6b4630" />
      {[-1, 1].map((s) => (
        <Box key={s} p={[x1 + 0.17, base + door.h / 2, door.z + s * (door.w / 2 + 0.08)]} s={[0.1, door.h, 0.16]} c={DARK} />
      ))}
      <mesh position={[x1 + 0.17, base + door.h - 0.5, door.z]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[door.w - 0.2, 1.0]} />
        <GlowMaterial glow={0.4} map={getJpSignTexture('ゆ', '#1e3a8a', '#f5f0e6', (door.w - 0.2) / 1.0)} side={THREE.DoubleSide} />
      </mesh>
      {/* 바깥벽 안쪽 나무 판 (서쪽·앞·뒤) */}
      {[
        [x0 + 0.05, cz, 0.02, dd],
        [cx, z0 + 0.05, wd, 0.02],
        [cx, z1 - 0.05, wd, 0.02],
      ].map(([x, z, sx, sz], i) => (
        <group key={`in${i}`}>
          <Box p={[x, base + (h - 1.6) / 2 + 1.2, z]} s={[sx, h - 1.6, sz]} c="#9a6a40" />
          <Box p={[x, base + 0.6, z]} s={[sx + 0.01, 1.2, sz + 0.01]} c="#5a3d2a" />
        </group>
      ))}
      {/* 번대 자리 ↔ 탕 칸막이 (가운데 통로에 大湯 노렌) */}
      <Box p={[(x0 + g0) / 2, base + h / 2, part.z]} s={[g0 - x0, h, 0.2]} c="#6b4630" />
      <Box p={[(g1 + x1) / 2, base + h / 2, part.z]} s={[x1 - g1, h, 0.2]} c="#6b4630" />
      <Box p={[(g0 + g1) / 2, base + h - 0.6, part.z]} s={[g1 - g0, 1.2, 0.2]} c="#6b4630" />
      <mesh position={[(g0 + g1) / 2, base + h - 1.7, part.z + 0.12]}>
        <planeGeometry args={[g1 - g0 - 0.1, 1.0]} />
        <GlowMaterial glow={0.4} map={getJpSignTexture('大湯', '#7a1d12', '#f5f0e6', (g1 - g0 - 0.1) / 1.0)} side={THREE.DoubleSide} />
      </mesh>
      {/* 번대: 높은 나무 접수대 + 칸막이에 걸린 약탕 패 판 + 간판 */}
      <group position={[counter.x, base, counter.z]}>
        <Box p={[0, 0.55, 0]} s={[counter.w, 1.1, counter.d]} c="#4a2f1f" />
        <Box p={[0, 1.13, 0]} s={[counter.w + 0.1, 0.06, counter.d + 0.1]} c="#2b1d14" />
        <Box p={[counter.w / 2 + 0.01, 0.6, 0]} s={[0.02, 0.8, counter.d - 0.2]} m={GOLD_M} />
        <Box p={[-0.1, 1.2, -0.4]} s={[0.5, 0.06, 0.8]} c="#e9e1cf" />
        <Box p={[-0.1, 1.2, 0.5]} s={[0.35, 0.05, 0.6]} c="#3a281c" />
        <Box p={[-0.3, 1.45, 0.9]} s={[0.25, 0.4, 0.25]} m={GLOBE} />
      </group>
      <mesh position={[x0 + 3.6, base + 2.6, part.z + 0.12]}>
        <planeGeometry args={[5.6, 2.0]} />
        <primitive object={texMat(tags, { emissive: '#ffffff', emissiveIntensity: 0.15 })} attach="material" />
      </mesh>
      <mesh position={[x0 + 3.6, base + 2.6, part.z - 0.12]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[5.6, 2.0]} />
        <primitive object={texMat(tags, { emissive: '#ffffff', emissiveIntensity: 0.15 })} attach="material" />
      </mesh>
      <mesh position={[counter.x + counter.w / 2 + 0.02, base + 3.4, counter.z]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[1.4, 0.5]} />
        <GlowMaterial glow={0.5} map={getJpSignTexture('番台', '#3d2a1e', '#f3e6c8', 1.4 / 0.5)} side={THREE.DoubleSide} />
      </mesh>
      {/* 큰 탕: 나무 욕조들 + 가운데 둥근 큰 욕조 + 물 내리는 관과 줄 + 김 */}
      {tubs.map(([x, z, s], i) => (
        <group key={i} position={[x, base, z]}>
          {/* (11/26 점검) 꽉 찬 나무 상자라 윗면이 물을 덮어 물이 안 보였음 → 속이 빈 욕조(네 벽 + 바닥) + 테 아래 물 */}
          <Box p={[0, 0.1, 0]} s={[s, 0.2, s]} c="#8a5f36" />
          {[-1, 1].map((sd) => (
            <group key={`tw${sd}`}>
              <Box p={[0, 0.45, sd * (s / 2 - 0.08)]} s={[s, 0.9, 0.16]} c="#a0703f" />
              <Box p={[sd * (s / 2 - 0.08), 0.45, 0]} s={[0.16, 0.9, s - 0.32]} c="#a0703f" />
            </group>
          ))}
          <Box p={[0, 0.77, 0]} s={[s - 0.3, 0.03, s - 0.3]} m={WATER} />
          {[0.2, 0.7].map((y) => (
            <Box key={y} p={[0, y, 0]} s={[s + 0.04, 0.06, s + 0.04]} c="#3a2a1c" />
          ))}
          <WadeSplash w={s - 0.3} len={s - 0.3} y={0.79} />
        </group>
      ))}
      <group position={[center.x, base, center.z]}>
        <Cyl p={[0, 0.5, 0]} rad={center.r} h={1.0} c="#a0703f" geo={GEO.cyl48} />
        <Cyl p={[0, 1.02, 0]} rad={center.r - 0.15} h={0.03} m={WATER} geo={GEO.cyl48} />
        {[0.2, 0.8].map((y) => (
          <Cyl key={y} p={[0, y, 0]} rad={center.r + 0.03} h={0.07} c="#3a2a1c" geo={GEO.cyl48} />
        ))}
        <Box p={[0, h - 1.0, 0]} s={[0.3, 0.3, center.r * 2 + 3]} c="#5a3d2a" />
        <Box p={[0, h - 2.0, center.r - 0.6]} s={[0.3, 1.9, 0.3]} c="#5a3d2a" />
        <Cyl p={[0.6, h - 2.4, center.r - 0.4]} rad={0.02} h={2.6} c="#d8c79a" />
        <Box p={[0.6, h - 3.8, center.r - 0.4]} s={[0.25, 0.4, 0.04]} c="#e9d3a5" />
        <PourStream x={0.6} z={center.r - 0.4} top={h - 2.4} y={1.04} />
      </group>
      <BathSteam base={base} tubs={tubs} center={center} />
      <BathRipples base={base} tubs={tubs} center={center} />
      {/* 벽 등 + 서쪽 높은 창 빛 */}
      {[[x0 + 0.2, cz - 6], [x0 + 0.2, cz + 2], [x1 - 0.3, cz - 6], [x1 - 0.3, cz - 12]].map(([x, z]) => (
        <Box key={`${x}${z}`} p={[x, base + 2.8, z]} s={[0.2, 0.45, 0.35]} m={GLOBE} />
      ))}
      <mesh position={[x0 + 0.08, base + h - 1.0, cz - 4]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[dd - 12, 1]} />
        <primitive object={SHOJI_M} attach="material" />
      </mesh>
    </group>
  )
}
// (11/25 밤 지민 요청) 탕 김: 부드러운 김 그림(스프라이트)이 물 위에서 천천히 흔들리며 올라가 퍼지고 옅어짐 → 다시 아래에서 (반복)
function steamTexture() {
  return canvasTexture('jmyu:steam', 128, 128, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h)
    for (let i = 0; i < 5; i++) {
      const x = w / 2 + Math.cos(i * 1.7) * 14
      const y = h / 2 + Math.sin(i * 2.3) * 12
      const g = ctx.createRadialGradient(x, y, 0, x, y, 44)
      g.addColorStop(0, 'rgba(255,255,255,0.55)')
      g.addColorStop(0.5, 'rgba(255,255,255,0.22)')
      g.addColorStop(1, 'rgba(255,255,255,0)')
      ctx.fillStyle = g
      ctx.fillRect(0, 0, w, h)
    }
  })
}
const STEAM_RISE = 3.4 // 김이 올라가는 높이(m)
function BathSteam({ base, tubs, center }) {
  const map = useMemo(() => steamTexture(), [])
  // 욕조마다 김 4장, 가운데 큰 욕조는 7장. 각 장은 시작 시각(phase)이 달라 끊기지 않고 계속 피어오름
  const puffs = useMemo(() => {
    const out = []
    tubs.forEach(([x, z, s], i) => { for (let k = 0; k < 4; k++) out.push({ x, z, spread: s * 0.3, y0: 0.95, size: 1.6, phase: (k + i * 0.37) / 4, seed: i * 7 + k }) })
    for (let k = 0; k < 7; k++) out.push({ x: center.x, z: center.z, spread: center.r * 0.5, y0: 1.1, size: 2.4, phase: k / 7, seed: 90 + k })
    return out.map((p) => ({ ...p, m: new THREE.SpriteMaterial({ map, transparent: true, depthWrite: false, opacity: 0 }) }))
  }, [tubs, center, map])
  const refs = useRef([])
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    puffs.forEach((p, i) => {
      const sp = refs.current[i]
      if (!sp) return
      const u = (t * 0.16 + p.phase) % 1 // 0 → 1 동안 한 번 올라감 (약 6초)
      const sway = Math.sin(t * 0.7 + p.seed) * 0.35 * u
      sp.position.set(p.x + Math.cos(p.seed) * p.spread + sway, base + p.y0 + u * STEAM_RISE, p.z + Math.sin(p.seed * 1.3) * p.spread + sway * 0.6)
      const sc = p.size * (0.5 + u * 1.3)
      sp.scale.set(sc, sc, 1)
      p.m.opacity = 0.42 * Math.sin(Math.PI * u) // 피어날 때·사라질 때 옅게
      p.m.rotation = p.seed + t * 0.08
    })
  })
  return (
    <group>
      {puffs.map((p, i) => (
        <sprite key={i} ref={(el) => (refs.current[i] = el)} material={p.m} />
      ))}
    </group>
  )
}
// 물 위 둥근 물결: 욕조마다 하나씩 가운데서 번져 나감 (반복)
const RIPPLE_GEO = new THREE.RingGeometry(0.9, 1, 32)
function BathRipples({ base, tubs, center }) {
  const rings = useMemo(() => [
    ...tubs.map(([x, z, s], i) => ({ x, z, y: 0.8, r: (s - 0.4) / 2, phase: i * 0.29 })),
    { x: center.x, z: center.z, y: 1.05, r: center.r - 0.3, phase: 0.5 },
  ].map((r) => ({ ...r, m: new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }) })), [tubs, center])
  const refs = useRef([])
  useFrame(({ clock }) => {
    rings.forEach((r, i) => {
      const m = refs.current[i]
      if (!m) return
      const u = (clock.elapsedTime * 0.35 + r.phase) % 1
      m.scale.setScalar(0.15 + u * r.r)
      r.m.opacity = 0.35 * (1 - u)
    })
  })
  return rings.map((r, i) => (
    <mesh key={i} ref={(el) => (refs.current[i] = el)} geometry={RIPPLE_GEO} material={r.m} position={[r.x, base + r.y, r.z]} rotation={[-Math.PI / 2, 0, 0]} userData={{ noMerge: true }} />
  ))
}
// 가운데 큰 욕조: 위 관에서 물줄기가 떨어지고 닿는 곳에 물방울이 조금씩 튐
const STREAM_M = new THREE.MeshStandardMaterial({ color: '#cfe8ee', transparent: true, opacity: 0.55, roughness: 0.1, depthWrite: false })
const DROP_M2 = new THREE.MeshBasicMaterial({ color: '#eef8f8', transparent: true, opacity: 0.8 })
function PourStream({ x, z, top, y }) {
  const stream = useRef(null)
  const drops = useRef(null)
  const N = 14
  const st = useMemo(() => ({ d: Array.from({ length: N }, (_, i) => ({ p: new THREE.Vector3(), v: new THREE.Vector3(), life: -i * 0.05 })), m: new THREE.Matrix4(), q: new THREE.Quaternion(), s: new THREE.Vector3() }), [])
  useFrame(({ clock }, dt) => {
    const step = Math.min(dt, 0.05)
    if (stream.current) stream.current.scale.x = stream.current.scale.z = 1 + Math.sin(clock.elapsedTime * 23) * 0.12
    const mesh = drops.current
    if (!mesh) return
    st.d.forEach((d, i) => {
      d.life -= step
      if (d.life <= 0 && d.life > -0.05) {
        d.p.set(x, y, z)
        d.v.set((Math.random() - 0.5) * 0.9, 0.6 + Math.random() * 0.6, (Math.random() - 0.5) * 0.9)
        d.life = 0.4
      }
      if (d.life > 0) {
        d.v.y -= 9.8 * step
        d.p.addScaledVector(d.v, step)
        if (d.p.y < y) d.life = 0
      }
      const sc = d.life > 0 ? 0.03 : 0
      st.s.set(sc, sc, sc)
      st.m.compose(d.p, st.q, st.s)
      mesh.setMatrixAt(i, st.m)
    })
    mesh.instanceMatrix.needsUpdate = true
  })
  const len = top - y
  return (
    <group>
      <mesh ref={stream} position={[x, y + len / 2, z]} material={STREAM_M} userData={{ noMerge: true }}>
        <cylinderGeometry args={[0.05, 0.08, len, 8, 1, true]} />
      </mesh>
      <instancedMesh ref={drops} args={[null, DROP_M2, N]} frustumCulled={false}>
        <sphereGeometry args={[1, 6, 4]} />
      </instancedMesh>
    </group>
  )
}

// ── (11/25) 2~4층 연회장: 회랑 바깥 앞뒤 띠에 방. 회랑 쪽은 그림 장지문(후스마) 벽, 방마다 한 칸이 열려 들어감 ──
// 모티브: 영화 속 온천장 연회장 (긴 복도를 따라 그림 그린 미닫이문이 줄지어 있고, 안은 상과 방석이 줄지은 넓은 다다미 방)
const ROOM_NAMES = ['松の間', '竹の間', '梅の間']
const FUSUMA_KINDS = ['wave', 'crane', 'pine', 'cloud']
function fusumaTexture(kind) {
  return canvasTexture(`jmyu:fusuma:${kind}`, 256, 512, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h)
    g.addColorStop(0, '#e8cf8a')
    g.addColorStop(1, '#d4b064')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, w, h)
    ctx.lineWidth = 6
    if (kind === 'wave') {
      ctx.strokeStyle = '#2f5d8a'
      for (let r = 0; r < 6; r++) for (let c = -1; c < 4; c++) {
        ctx.beginPath()
        ctx.arc(c * 80 + (r % 2) * 40, h - 40 - r * 34, 34, Math.PI, 0)
        ctx.stroke()
      }
    } else if (kind === 'crane') {
      for (const [x, y] of [[80, 150], [180, 260]]) {
        ctx.fillStyle = '#f7f3ea'
        ctx.beginPath()
        ctx.ellipse(x, y, 40, 16, -0.3, 0, Math.PI * 2)
        ctx.fill()
        ctx.beginPath()
        ctx.moveTo(x - 10, y)
        ctx.lineTo(x - 70, y - 50)
        ctx.lineTo(x + 20, y - 8)
        ctx.fill()
        ctx.fillStyle = '#a24a36'
        ctx.beginPath()
        ctx.arc(x + 36, y - 14, 5, 0, Math.PI * 2)
        ctx.fill()
      }
    } else if (kind === 'pine') {
      ctx.strokeStyle = '#4a3020'
      ctx.lineWidth = 14
      ctx.beginPath()
      ctx.moveTo(60, h)
      ctx.quadraticCurveTo(140, 300, 90, 120)
      ctx.stroke()
      ctx.fillStyle = '#2f5a3a'
      for (const [x, y] of [[90, 130], [160, 210], [60, 260], [150, 330]]) {
        ctx.beginPath()
        ctx.ellipse(x, y, 60, 22, 0, 0, Math.PI * 2)
        ctx.fill()
      }
    } else {
      ctx.fillStyle = 'rgba(255,255,255,0.75)'
      for (const [x, y] of [[70, 120], [170, 240], [90, 380]]) {
        ctx.beginPath()
        ctx.ellipse(x, y, 70, 22, 0, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.fillStyle = '#a24a36'
      ctx.beginPath()
      ctx.arc(190, 90, 34, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.strokeStyle = '#3a2416'
    ctx.lineWidth = 10
    ctx.strokeRect(5, 5, w - 10, h - 10)
    ctx.fillStyle = '#1a1210'
    ctx.beginPath()
    ctx.ellipse(w - 34, h / 2, 9, 22, 0, 0, Math.PI * 2)
    ctx.fill()
  })
}
function tatamiTexture() {
  return canvasTexture('jmyu:tatami', 256, 128, (ctx, w, h) => {
    ctx.fillStyle = '#c9c07a'
    ctx.fillRect(0, 0, w, h)
    ctx.strokeStyle = 'rgba(90,80,40,0.25)'
    ctx.lineWidth = 1
    for (let y = 2; y < h; y += 4) {
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(w, y)
      ctx.stroke()
    }
    ctx.fillStyle = '#2f3a2a'
    ctx.fillRect(0, 0, w, 6)
    ctx.fillRect(0, h - 6, w, 6)
  })
}
// 장지문 벽 한 면: 문 자리를 뺀 조각마다 그림 판(face 쪽에 그림), 문 자리 옆엔 열린 판 한 장(옆으로 밀린 모습)
// solid: 벽 몸통(나무 판)도 그림 (한 줄에 한 번만)
function FusumaRow({ band, y, h, doorW, face, k, solid }) {
  const xs = [band.x0, ...band.splits, band.x1]
  const panels = []
  for (let i = 0; i < xs.length - 1; i++) {
    const c = (xs[i] + xs[i + 1]) / 2
    for (const [a, b] of [[xs[i], c - doorW / 2], [c + doorW / 2, xs[i + 1]]]) {
      const n = Math.max(1, Math.round((b - a) / 1.3))
      for (let j = 0; j < n; j++) panels.push({ x: a + ((j + 0.5) * (b - a)) / n, w: (b - a) / n, kind: FUSUMA_KINDS[(i + j + k) % 4] })
    }
    panels.push({ x: c - doorW / 2 + 0.65, w: 1.3, kind: FUSUMA_KINDS[(i + k + 1) % 4], open: true })
  }
  const ph = h - 0.6
  return (
    <group>
      {panels.map((p, i) => (
        <group key={i} position={[p.x, y, band.z]}>
          <mesh position={[0, ph / 2 + 0.05, face * (p.open ? 0.24 : 0.11)]} rotation={[0, face > 0 ? 0 : Math.PI, 0]}>
            <planeGeometry args={[p.w - 0.04, ph]} />
            <primitive object={texMat(fusumaTexture(p.kind), { emissive: '#ffffff', emissiveIntensity: 0.12 })} attach="material" />
          </mesh>
          {solid && !p.open && <Box p={[0, ph / 2 + 0.05, 0]} s={[p.w, ph, 0.2]} c="#5a3d2a" />}
        </group>
      ))}
      {solid && <Box p={[(band.x0 + band.x1) / 2, y + ph + 0.3, band.z]} s={[band.x1 - band.x0, 0.6, 0.24]} c={DARK} />}
      {face !== 0 && xs.slice(0, -1).map((x, i) => (
        <mesh key={`n${i}`} position={[(x + xs[i + 1]) / 2, y + ph + 0.32, band.z + face * 0.13]} rotation={[0, face > 0 ? 0 : Math.PI, 0]}>
          <planeGeometry args={[1.5, 0.45]} />
          <GlowMaterial glow={0.5} map={getJpSignTexture(ROOM_NAMES[(k - 1) % 3], '#2b1a12', '#e8c35a', 1.5 / 0.45)} side={THREE.DoubleSide} />
        </mesh>
      ))}
    </group>
  )
}
const PAPER_LANTERN = mat('#f6e7c8', { emissive: '#ffcf8a', emissiveIntensity: 0.9 })
function YuBanquetRooms({ W, D, Y }) {
  const { lv, wt, rooms } = Y
  const ix = W / 2 - wt
  const iz = D / 2 - wt
  const rows = useMemo(() => {
    const trays = []
    const cushions = []
    const dishes = []
    const guest = { tables: [], futons: [], lamps: [] }
    for (let k = 1; k <= 3; k++) {
      const y = lv[k]
      for (const band of [rooms.front, rooms.back]) {
        const outer = band.z > 0 ? iz : -iz
        const zRow = r1((band.z + outer) / 2)
        const xs = [band.x0, ...band.splits, band.x1]
        // (11/26 지민 요청) 연회장은 2층(k=1) 한 층만 — 3·4층 방은 객실: 낮은 상 + 방석 2장 + 개어 둔 이불 + 바닥 등
        if (k > 1) {
          for (let i = 0; i < xs.length - 1; i++) {
            const x = (xs[i] + xs[i + 1]) / 2
            guest.tables.push({ p: [x, y + 0.3, zRow], s: [1.2, 0.06, 0.8] }, { p: [x, y + 0.14, zRow], s: [1.0, 0.24, 0.6] })
            for (const sd of [-1, 1]) cushions.push({ p: [x, y + 0.05, zRow + sd * 0.8], s: [0.6, 0.1, 0.55] })
            const fz = outer - Math.sign(outer) * 0.7
            for (let f = 0; f < 3; f++) guest.futons.push({ p: [xs[i + 1] - 1.4, y + 0.1 + f * 0.17, fz], s: [1.6, 0.16, 0.9], c: f % 2 ? '#e8dcc0' : '#c9d6e8' })
            guest.lamps.push({ p: [xs[i] + 0.8, y + 0.35, fz], s: [0.28, 0.6, 0.28] })
          }
          continue
        }
        for (let i = 0; i < xs.length - 1; i++) {
          const a = xs[i] + 1.2
          const b = xs[i + 1] - 1.2
          const n = Math.max(1, Math.floor((b - a) / 2.1))
          for (let j = 0; j <= n; j++) {
            const x = a + ((b - a) * j) / n
            trays.push({ p: [x, y + 0.2, zRow], s: [1.5, 0.08, 0.7] })
            for (const s of [-1, 1]) cushions.push({ p: [x, y + 0.05, zRow + s * 0.75], s: [0.6, 0.1, 0.55] })
            for (const dx of [-0.45, 0, 0.45]) dishes.push({ p: [x + dx, y + 0.26, zRow], s: [0.11, 0.04, 0.11] })
          }
        }
      }
    }
    // (11/26 점검: 연회장이 텅 비어 보임) 상 줄 위로 종이 초롱 (두 상에 하나) + 줄
    const lanterns = []
    const cords = []
    trays.forEach((t, i) => {
      if (i % 2) return
      const k = lv.findIndex((v, j) => j > 0 && v > t.p[1]) // 이 상이 놓인 층의 천장
      const top = lv[k] - 0.3
      const ly = top - 1.0
      lanterns.push({ p: [t.p[0], ly, t.p[2]], s: [0.32, 0.4, 0.32] })
      cords.push({ p: [t.p[0], (ly + top) / 2 + 0.2, t.p[2]], s: [0.02, top - ly - 0.4, 0.02] })
    })
    // (11/26) 손님용 승강로(로비 서쪽, 2~4층 앞쪽 가운데 방 구석)에 걸리는 소품은 뺌
    const G = Y.guest
    const out = (arr) => (G?.shaft ? arr.filter((t) => Math.abs(t.p[0] - G.x) > G.shaft + 0.9 || Math.abs(t.p[2] - G.z) > G.shaft + 0.7) : arr)
    const tr = out(trays)
    return { trays: tr, cushions: out(cushions), dishes: out(dishes), lanterns: out(lanterns), cords: out(cords), guest: { tables: out(guest.tables), futons: out(guest.futons), lamps: out(guest.lamps) }, legs: tr.map((t) => ({ p: [t.p[0], t.p[1] - 0.1, t.p[2]], s: [1.3, 0.12, 0.5] })) }
  }, [lv, rooms, iz, Y.guest])
  const tatami = useMemo(() => tatamiTexture(), [])
  const shaftHole = Y.guest?.shaft ? [[Y.guest.x - Y.guest.shaft + 0.1, Y.guest.z - Y.guest.shaft + 0.1, Y.guest.x + Y.guest.shaft - 0.1, Y.guest.z + Y.guest.shaft - 0.1]] : []
  return (
    <group>
      <Instances geometry={GEO.box} material={mat('#5a1e14', { roughness: 0.5 })} items={rows.trays} />
      <Instances geometry={GEO.box} material={mat('#2b1a12')} items={rows.legs} />
      <Instances geometry={GEO.box} material={mat('#8f2a24')} items={rows.cushions} />
      <Instances geometry={GEO.cyl} material={mat('#f1e8d6')} items={rows.dishes} />
      <Instances geometry={GEO.sphere} material={PAPER_LANTERN} items={rows.lanterns} />
      <Instances geometry={GEO.box} material={mat('#2b1a12')} items={rows.cords} />
      <Instances geometry={GEO.box} material={mat('#5a3a24', { roughness: 0.5 })} items={rows.guest.tables} />
      <Instances geometry={GEO.box} material={mat('#ffffff', { roughness: 0.9 })} items={rows.guest.futons} />
      <Instances geometry={GEO.box} material={mat('#fff1d6', { emissive: '#ffcf7a', emissiveIntensity: 0.9 })} items={rows.guest.lamps} />
      {[1, 2, 3].map((k) => {
        const y = lv[k]
        const h = lv[k + 1] - lv[k] - 0.25
        return (
          <group key={k}>
            {[[rooms.front, 1], [rooms.back, -1]].map(([band, sign], j) => {
              const outer = sign > 0 ? iz : -iz
              const zc = (band.z + outer) / 2
              const depth = Math.abs(outer - band.z)
              return (
                <group key={j}>
                  {/* (11/27) 손님용 엘리베이터 칸이 실제로 오르내림 → 승강로 자리(바닥판 구멍과 같은 크기)는 다다미를 비움 */}
                  {rectHoles([band.x0, Math.min(band.z, outer), band.x1, Math.max(band.z, outer)], shaftHole).map(([x0, z0, x1, z1], m) => (
                    <mesh key={m} position={[(x0 + x1) / 2, y + 0.015, (z0 + z1) / 2]} rotation={[-Math.PI / 2, 0, 0]}>
                      <planeGeometry args={[x1 - x0, z1 - z0]} />
                      <primitive object={texMat(tiled(tatami, (x1 - x0) / 1.8, (z1 - z0) / 0.9))} attach="material" />
                    </mesh>
                  ))}
                  {/* 회랑 쪽 면(현판 포함) + 방 안쪽 면 */}
                  <FusumaRow band={band} y={y} h={h} doorW={rooms.doorW} face={-sign} k={k} solid />
                  <FusumaRow band={band} y={y} h={h} doorW={rooms.doorW} face={sign} k={k + 1} />
                  {band.splits.map((x) => (
                    <group key={x}>
                      <Box p={[x, y + h / 2, zc]} s={[0.2, h, depth]} c="#6b4630" />
                      {/* (11/26 점검) 밋밋한 갈색 칸막이 → 양면에 꽃 그림 판 */}
                      {[-1, 1].map((sd) => (
                        <mesh key={sd} position={[x + sd * 0.11, y + 1.3, zc]} rotation={[0, sd * Math.PI / 2, 0]}>
                          <planeGeometry args={[Math.min(depth - 0.4, 4.2), 2.2]} />
                          <primitive object={texMat(flowerPanelTexture(1), { emissive: '#ffffff', emissiveIntensity: 0.15 })} attach="material" />
                        </mesh>
                      ))}
                    </group>
                  ))}
                  {range(Math.round((band.x1 - band.x0) / 2.6)).map((i) => (
                    <mesh key={`b${i}`} position={[band.x0 + 1.3 + i * 2.6, y + 1.3, outer - sign * (0.14 + (i % 2) * 0.1)]} rotation={[0, (sign > 0 ? Math.PI : 0) + (i % 2 ? -1 : 1) * 0.2, 0]}>
                      <planeGeometry args={[2.65, 2.2]} />
                      <primitive object={texMat(flowerPanelTexture(1), { emissive: '#ffffff', emissiveIntensity: 0.15 })} attach="material" />
                    </mesh>
                  ))}
                </group>
              )
            })}
            <Box p={[rooms.back.x1, y + h / 2, (rooms.back.z - iz) / 2]} s={[0.2, h, iz + rooms.back.z]} c="#6b4630" />
            <mesh position={[-ix + 0.08, lv[k + 1] - 0.75, -8.2]} rotation={[0, Math.PI / 2, 0]}>
              <planeGeometry args={[2.0, 0.6]} />
              <GlowMaterial glow={0.5} map={getJpSignTexture(k === 1 ? '宴会場' : '客室', '#2b1a12', '#e8c35a', 2.0 / 0.6)} side={THREE.DoubleSide} />
            </mesh>
          </group>
        )
      })}
    </group>
  )
}
const r1 = (n) => Math.round(n * 10) / 10

// ── (11/25) 꼭대기 5층: 여관 주인의 집무실 ─────────────
// 모티브: 영화 속 온천장 주인 할머니의 꼭대기 방 (서양식 호화 방: 붉은 무늬 벽지, 무늬 카펫, 금 장식, 큰 책상·높은 등받이 의자,
//   벽난로, 책장, 큰 크리스털 샹들리에, 큰 도자기 항아리, 무거운 커튼, 금빛 문). 캐릭터는 넣지 않음
function damaskTexture() {
  // (11/26 영화 장면) 어두운 붉은 바탕 + 금빛 소용돌이 덩굴(다마스크)
  return canvasTexture('jmyu:damask2', 256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#4e1016'
    ctx.fillRect(0, 0, w, h)
    const swirl = (cx, cy, sc, flip) => {
      ctx.save()
      ctx.translate(cx, cy)
      ctx.scale(sc * flip, sc)
      ctx.strokeStyle = 'rgba(205,152,64,0.85)'
      ctx.lineWidth = 7
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.moveTo(0, 60)
      ctx.bezierCurveTo(40, 30, -30, -10, 20, -50)
      ctx.bezierCurveTo(50, -75, 70, -30, 40, -20)
      ctx.stroke()
      ctx.lineWidth = 4
      ctx.beginPath()
      ctx.moveTo(10, 20)
      ctx.bezierCurveTo(-40, 10, -50, -30, -20, -40)
      ctx.stroke()
      ctx.fillStyle = 'rgba(205,152,64,0.75)'
      for (const [x, y, r] of [[40, -20, 6], [-20, -40, 5], [-10, 45, 4]]) {
        ctx.beginPath()
        ctx.arc(x, y, r, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.restore()
    }
    swirl(w * 0.3, h * 0.5, 1, 1)
    swirl(w * 0.75, h * 0.5, 1, -1)
    for (const y of [0.02, 1.0]) {
      swirl(w * 0.05, h * y, 0.8, -1)
      swirl(w * 0.55, h * y, 0.8, 1)
    }
  })
}
function carpetTexture() {
  // (11/26 영화 장면) 붉은 페르시아풍 카펫: 겹친 테두리 띠(꽃점) + 가운데 덩굴 무늬
  return canvasTexture('jmyu:carpet2', 512, 512, (ctx, w, h) => {
    ctx.fillStyle = '#6a1418'
    ctx.fillRect(0, 0, w, h)
    const band = (m, th, col) => {
      ctx.fillStyle = col
      ctx.fillRect(m, m, w - 2 * m, th)
      ctx.fillRect(m, h - m - th, w - 2 * m, th)
      ctx.fillRect(m, m, th, h - 2 * m)
      ctx.fillRect(w - m - th, m, th, h - 2 * m)
    }
    band(10, 26, '#1f2a4a')
    band(36, 6, '#d4a83e')
    band(48, 18, '#8a1c1c')
    band(70, 4, '#d4a83e')
    ctx.fillStyle = '#e8c35a'
    for (let i = 0; i < 24; i++) {
      const t = (i + 0.5) / 24
      for (const [x, y] of [[t * w, 23], [t * w, h - 23], [23, t * h], [w - 23, t * h]]) {
        ctx.beginPath()
        ctx.arc(x, y, 5, 0, Math.PI * 2)
        ctx.fill()
      }
    }
    ctx.strokeStyle = 'rgba(212,168,62,0.8)'
    ctx.lineWidth = 5
    for (let k = 0; k < 4; k++) {
      ctx.save()
      ctx.translate(w / 2, h / 2)
      ctx.rotate((k * Math.PI) / 2)
      ctx.beginPath()
      ctx.moveTo(0, 0)
      ctx.bezierCurveTo(60, -20, 120, 40, 160, -40)
      ctx.bezierCurveTo(180, -90, 120, -120, 100, -80)
      ctx.stroke()
      ctx.restore()
    }
    ctx.fillStyle = '#1f2a4a'
    ctx.beginPath()
    ctx.ellipse(w / 2, h / 2, 50, 36, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = '#e8c35a'
    ctx.stroke()
  })
}
function mosaicTexture() {
  // (11/26 영화 장면) 초록 대리석 큰 칸 + 크림색 띠 + 띠가 만나는 곳 검은 작은 칸
  return canvasTexture('jmyu:mosaic2', 512, 512, (ctx, w, h) => {
    const n = 4
    const c = w / n
    const bw = 14
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      ctx.fillStyle = (x + y) % 3 ? '#2f6a48' : '#3a7a52'
      ctx.fillRect(x * c, y * c, c, c)
      for (let k = 0; k < 6; k++) {
        ctx.fillStyle = k % 2 ? 'rgba(20,60,40,0.35)' : 'rgba(90,130,80,0.35)'
        ctx.beginPath()
        ctx.ellipse(x * c + ((k * 37) % c), y * c + ((k * 53) % c), 18 + k * 3, 8, k, 0, Math.PI * 2)
        ctx.fill()
      }
    }
    ctx.fillStyle = '#e6dcc4'
    for (let i = 0; i <= n; i++) {
      ctx.fillRect(i * c - bw / 2, 0, bw, h)
      ctx.fillRect(0, i * c - bw / 2, w, bw)
    }
    ctx.fillStyle = '#141414'
    for (let i = 0; i <= n; i++) for (let j = 0; j <= n; j++) ctx.fillRect(i * c - bw / 2, j * c - bw / 2, bw, bw)
  })
}
function zigzagTexture() {
  return canvasTexture('jmyu:zigzag', 256, 32, (ctx, w, h) => {
    ctx.fillStyle = '#efe6d2'
    ctx.fillRect(0, 0, w, h)
    ctx.fillStyle = '#9e4634'
    for (let x = 0; x < w; x += 16) {
      ctx.beginPath()
      ctx.moveTo(x, h * 0.2)
      ctx.lineTo(x + 16, h * 0.2)
      ctx.lineTo(x + 8, h * 0.8)
      ctx.fill()
    }
    ctx.fillStyle = '#d4a83e'
    ctx.fillRect(0, 0, w, 4)
    ctx.fillRect(0, h - 4, w, 4)
  })
}
function darkCofferTexture() {
  // 집무실 천장: 영화처럼 어두운 나무 격자 + 은은한 금 테 (홀 천장의 밝은 금 원 격자와 구분)
  return canvasTexture('jmyu:darkcoffer', 128, 128, (ctx, w, h) => {
    ctx.fillStyle = '#1e0f0b'
    ctx.fillRect(0, 0, w, h)
    ctx.fillStyle = '#3a1c12'
    ctx.fillRect(10, 10, w - 20, h - 20)
    ctx.strokeStyle = 'rgba(190,140,60,0.6)'
    ctx.lineWidth = 2
    ctx.strokeRect(14, 14, w - 28, h - 28)
    ctx.beginPath()
    ctx.arc(64, 64, 24, 0, Math.PI * 2)
    ctx.stroke()
    ctx.fillStyle = 'rgba(190,140,60,0.45)'
    ctx.beginPath()
    ctx.arc(64, 64, 7, 0, Math.PI * 2)
    ctx.fill()
  })
}
function marbleTexture() {
  return canvasTexture('jmyu:marble', 256, 256, (ctx, w, h) => {
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
      ctx.fillStyle = (x + y) % 2 ? '#2a2422' : '#efe6d6'
      ctx.fillRect((x * w) / 4, (y * h) / 4, w / 4, h / 4)
    }
  })
}
function paintingTexture(k) {
  return canvasTexture(`jmyu:painting:${k}`, 256, 192, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h)
    g.addColorStop(0, ['#7aa6c9', '#d9a066', '#5a7a5a'][k % 3])
    g.addColorStop(1, ['#2f4a6a', '#7a3a2a', '#2a3a2a'][k % 3])
    ctx.fillStyle = g
    ctx.fillRect(0, 0, w, h)
    ctx.fillStyle = 'rgba(255,240,200,0.6)'
    ctx.beginPath()
    ctx.arc(w * 0.7, h * 0.3, 22, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = 'rgba(20,20,20,0.5)'
    ctx.beginPath()
    ctx.moveTo(0, h)
    ctx.lineTo(w * 0.35, h * 0.45)
    ctx.lineTo(w * 0.6, h * 0.75)
    ctx.lineTo(w, h * 0.5)
    ctx.lineTo(w, h)
    ctx.fill()
  })
}
const PORCELAIN = mat('#eef2f5', { roughness: 0.25 })
const COBALT = mat('#1f3a8a', { roughness: 0.3 })
const VELVET = mat('#8a1c24', { roughness: 0.9 })
const CUSHION_COLORS = ['#e86a9a', '#f2c94c', '#7aa7e8', '#59b36b', '#b05fd0', '#f28a3a', '#ffffff']

// ── (11/25) 꼭대기 5층: 여관 주인의 방 ─────────────
// 모티브(영화 설명): 엘리베이터가 꼭대기 모자이크 바닥 방으로 열림 → 큰 문 → 문이 몇 겹 더 → 집무실, 옆에 아기 방(쿠션 더미).
//   호화로운 서양식 방: 붉은 무늬 벽지, 비싼 도자기 항아리가 줄지음, 금 장식, 큰 책상 위 금화, 벽난로, 책장, 샹들리에. 캐릭터는 넣지 않음
// 배치(생성 스크립트 YU_OFFICE와 같은 숫자): 서쪽 칸막이 x -13 | 집무실 | 안쪽 문 x 7 | 문 사이 복도 | 큰 문 x 13 | 동쪽 모자이크 방
// 아기 방 바깥 벽지: 연분홍 바탕 + 세로 줄 + 작은 꽃점 (벽 크기에 맞춰 반복)
function babyWallTexture() {
  return canvasTexture('yu:babyWall', 128, 128, (ctx, w, h) => {
    ctx.fillStyle = '#f2d6c8'
    ctx.fillRect(0, 0, w, h)
    ctx.fillStyle = '#e8bfb0'
    ctx.fillRect(w * 0.45, 0, w * 0.1, h)
    for (const [x, y, c] of [[0.2, 0.25, '#e07a8a'], [0.75, 0.7, '#7ab0d8'], [0.2, 0.75, '#f2c94c'], [0.75, 0.2, '#8ac07a']]) {
      ctx.fillStyle = c
      ctx.beginPath()
      ctx.arc(x * w, y * h, w * 0.05, 0, Math.PI * 2)
      ctx.fill()
    }
  })
}
const BABY_WALL_CACHE = new Map()
function babyWallMat(len, h) {
  const key = `${len.toFixed(1)}:${h.toFixed(1)}`
  if (!BABY_WALL_CACHE.has(key)) BABY_WALL_CACHE.set(key, texMat(tiled(babyWallTexture(), Math.max(1, Math.round(len / 0.9)), Math.max(1, Math.round(h / 0.9)))))
  return BABY_WALL_CACHE.get(key)
}
function YuOffice({ W, D, Y }) {
  const { lv, wt, office: O } = Y
  const y = lv[4]
  const h = lv[5] - lv[4]
  const ix = W / 2 - wt
  const iz = D / 2 - wt
  const coffer = useMemo(() => darkCofferTexture(), [])
  const zigzag = useMemo(() => zigzagTexture(), [])
  const damask = useMemo(() => damaskTexture(), [])
  const carpet = useMemo(() => carpetTexture(), [])
  const mosaic = useMemo(() => mosaicTexture(), [])
  const marble = useMemo(() => marbleTexture(), [])
  const books = useMemo(() => {
    const out = []
    const cols = ['#7a1d12', '#1f3a5f', '#2f4a2a', '#5a3d2a', '#7c5a1a', '#3b2a4f']
    for (const [bx, bz] of O.bookcases) for (let r = 0; r < 4; r++) for (let i = 0; i < 9; i++) {
      out.push({ p: [bx + 0.15, y + 0.45 + r * 0.62, bz - 1.05 + i * 0.25 + (r % 2) * 0.04], s: [0.32, 0.42 + ((i * 7 + r) % 3) * 0.06, 0.18], c: cols[(i + r * 2) % cols.length] })
    }
    return out
  }, [O, y])
  const coins = useMemo(() => {
    const out = []
    for (let i = 0; i < 40; i++) {
      const a = seededR(i) * Math.PI * 2
      const r = seededR(i + 50) * 0.5
      out.push({ p: [O.desk[0] + 1.2 + Math.cos(a) * r, y + 1.0 + seededR(i + 9) * 0.25, O.desk[1] + Math.sin(a) * r * 0.6], s: [0.09, 0.02, 0.09] })
    }
    return out
  }, [O, y])
  const cushions = useMemo(() => range(26).map((i) => {
    const [px, pz] = O.boh.pile
    const layer = Math.floor(i / 9)
    const a = (i % 9) / 9 * Math.PI * 2 + layer
    const r = layer === 2 ? 0.4 : 1.2 - layer * 0.4
    return { p: [px + Math.cos(a) * r, y + 0.35 + layer * 0.45, pz + Math.sin(a) * r], s: [0.75, 0.32, 0.6], c: CUSHION_COLORS[i % CUSHION_COLORS.length] }
  }), [O, y])
  const zPieces = (gap) => [[-iz, gap[0]], [gap[1], iz]]
  // 칸막이 한 줄 (양면 벽지 + 문 위 상인방)
  const Partition = ({ x, gap, color = '#3b1d12' }) => (
    <group>
      {zPieces(gap).map(([a, b]) => (
        <group key={a}>
          <Box p={[x, y + h / 2, (a + b) / 2]} s={[0.25, h, b - a]} c={color} />
          {[-1, 1].map((f) => (
            <mesh key={f} position={[x + f * 0.14, y + h / 2, (a + b) / 2]} rotation={[0, (f * Math.PI) / 2, 0]}>
              <planeGeometry args={[b - a, h]} />
              <primitive object={texMat(tiled(damask, (b - a) / 1.2, h / 1.2))} attach="material" />
            </mesh>
          ))}
        </group>
      ))}
      <Box p={[x, y + 3.6 + (h - 3.6) / 2, (gap[0] + gap[1]) / 2]} s={[0.3, h - 3.6, gap[1] - gap[0]]} c={color} />
      {/* 금빛 문틀 + 활짝 열린 붉은 두짝문 */}
      {[-1, 1].map((f) => (
        <group key={f}>
          <Box p={[x + f * 0.16, y + 1.8, gap[0] - 0.12]} s={[0.12, 3.6, 0.24]} m={GOLD_M} />
          <Box p={[x + f * 0.16, y + 1.8, gap[1] + 0.12]} s={[0.12, 3.6, 0.24]} m={GOLD_M} />
          <Box p={[x + f * 0.16, y + 3.7, (gap[0] + gap[1]) / 2]} s={[0.14, 0.24, gap[1] - gap[0] + 0.5]} m={GOLD_M} />
        </group>
      ))}
      {[[gap[0], 1], [gap[1], -1]].map(([z, s]) => (
        <group key={z} position={[x, y, z]} rotation={[0, s * 1.15, 0]}>
          <Box p={[(gap[1] - gap[0]) / 4, 1.75, 0]} s={[(gap[1] - gap[0]) / 2, 3.4, 0.08]} c="#8a1622" />
          <Box p={[(gap[1] - gap[0]) / 4, 1.75, 0.05]} s={[(gap[1] - gap[0]) / 2 - 0.25, 3.0, 0.02]} m={GOLD_M} />
        </group>
      ))}
    </group>
  )
  const B = O.boh
  return (
    <group>
      {/* 천장(금 원형 격자) + 바깥벽 붉은 무늬 벽지 */}
      <mesh position={[0, lv[5] - 0.01, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[ix * 2, iz * 2]} />
        <primitive object={texMat(tiled(coffer, (ix * 2) / 1.4, (iz * 2) / 1.4))} attach="material" />
      </mesh>
      {[
        [0, -iz + 0.06, ix * 2, 0],
        [-ix + 0.06, 0, iz * 2, Math.PI / 2],
        [ix - 0.06, 0, iz * 2, -Math.PI / 2],
        [0, iz - 0.06, ix * 2, Math.PI],
      ].map(([x, z, len, r], i) => (
        <group key={i} position={[x, y, z]} rotation={[0, r, 0]}>
          <mesh position={[0, h / 2, 0]}>
            <planeGeometry args={[len, h]} />
            <primitive object={texMat(tiled(damask, len / 1.8, h / 1.8))} attach="material" />
          </mesh>
          <Box p={[0, 0.5, 0.02]} s={[len, 1, 0.04]} c="#3b1d12" />
          <Box p={[0, 1.02, 0.04]} s={[len, 0.06, 0.06]} m={GOLD_M} />
          <Box p={[0, h - 0.25, 0.04]} s={[len, 0.3, 0.08]} m={GOLD_M} />
        </group>
      ))}
      {/* 바닥: 집무실 카펫 / 문 사이 복도 흑백 대리석 / 동쪽 모자이크 방 */}
      <mesh position={[(O.west.x + O.inner.x) / 2, y + 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[O.inner.x - O.west.x - 0.6, iz * 2 - 0.6]} />
        <primitive object={texMat(tiled(carpet, 1.4, 2))} attach="material" />
      </mesh>
      <mesh position={[(O.inner.x + O.east.x) / 2, y + 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[O.east.x - O.inner.x, iz * 2]} />
        <primitive object={texMat(tiled(marble, (O.east.x - O.inner.x) / 2.4, (iz * 2) / 2.4))} attach="material" />
      </mesh>
      <mesh position={[(O.east.x + ix) / 2, y + 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[ix - O.east.x, iz * 2]} />
        <primitive object={texMat(tiled(mosaic, (ix - O.east.x) / 3, (iz * 2) / 3))} attach="material" />
      </mesh>
      {/* 모자이크 방: 집무실 쪽 큰 문 벽을 따라 빨강·흰 톱니 띠 + 가운데 둥근 문양(湯) */}
      <mesh position={[O.east.x + 0.55, y + 0.025, 0]} rotation={[-Math.PI / 2, 0, Math.PI / 2]}>
        <planeGeometry args={[iz * 2, 0.5]} />
        <primitive object={texMat(tiled(zigzag, (iz * 2) / 4, 1))} attach="material" />
      </mesh>
      <group position={[(O.east.x + ix) / 2, y + 0.027, 4]} rotation={[-Math.PI / 2, 0, 0]}>
        <mesh>
          <ringGeometry args={[2.4, 2.7, 48]} />
          <meshStandardMaterial color="#8a2a20" />
        </mesh>
        <mesh position={[0, 0, 0.001]}>
          <circleGeometry args={[2.4, 48]} />
          <meshStandardMaterial color="#1f3a6a" />
        </mesh>
        <mesh position={[0, 0, 0.002]}>
          <planeGeometry args={[2.2, 2.2]} />
          <meshStandardMaterial map={getJpSignTexture('湯', '#1f3a6a', '#c9a24a', 1)} />
        </mesh>
      </group>
      <Partition x={O.west.x} gap={O.west.gap} />
      <Partition x={O.inner.x} gap={O.inner.gap} />
      <Partition x={O.east.x} gap={O.east.gap} />
      {/* 큰 문 왼쪽 한 짝은 닫힌 문 (모자이크 방 쪽에서 보이는 두 문) */}
      <group position={[O.east.x + 0.16, y, O.east.fakeZ]}>
        <Box p={[0, 1.9, 0]} s={[0.1, 3.8, 2.8]} c="#8a1622" />
        <Box p={[0.06, 1.9, 0]} s={[0.02, 3.3, 2.3]} m={GOLD_M} />
        <Box p={[0.08, 1.9, 0]} s={[0.03, 3.3, 0.06]} m={GOLD_M} />
        <Ball p={[0.15, 1.7, 0.5]} rad={0.12} m={GOLD_M} />
      </group>
      {/* 아기 방: 벽 2면(문 자리 비움) + 알록달록 쿠션 더미 + 공 */}
      <group>
        {/* (11/26 점검) 아무 무늬 없는 분홍 판이라 집무실 안에 빈 상자처럼 보였음 → 줄무늬·꽃점 벽지 + 금 테 + 아래 짙은 징두리판 + 문틀 */}
        <Box p={[B.x1, y + h / 2, (-iz + B.z1) / 2]} s={[0.2, h, B.z1 + iz]} m={babyWallMat(B.z1 + iz, h)} />
        {[[B.x0, B.doorX - B.doorW / 2], [B.doorX + B.doorW / 2, B.x1]].map(([a, b]) => (
          <Box key={a} p={[(a + b) / 2, y + h / 2, B.z1]} s={[b - a, h, 0.2]} m={babyWallMat(b - a, h)} />
        ))}
        <Box p={[B.doorX, y + 3.2 + (h - 3.2) / 2, B.z1]} s={[B.doorW, h - 3.2, 0.2]} m={babyWallMat(B.doorW, h - 3.2)} />
        {/* 징두리판 + 위 금 띠 (바깥 두 면) */}
        <Box p={[B.x1 + 0.12, y + 0.6, (-iz + B.z1) / 2]} s={[0.04, 1.2, B.z1 + iz]} c="#5a1018" />
        <Box p={[B.x1 + 0.14, y + 1.22, (-iz + B.z1) / 2]} s={[0.05, 0.08, B.z1 + iz]} m={GOLD_M} />
        <Box p={[B.x1 + 0.14, y + h - 0.3, (-iz + B.z1) / 2]} s={[0.06, 0.24, B.z1 + iz]} m={GOLD_M} />
        {[[B.x0, B.doorX - B.doorW / 2], [B.doorX + B.doorW / 2, B.x1]].map(([a, b]) => (
          <group key={`wd${a}`}>
            <Box p={[(a + b) / 2, y + 0.6, B.z1 + 0.12]} s={[b - a, 1.2, 0.04]} c="#5a1018" />
            <Box p={[(a + b) / 2, y + 1.22, B.z1 + 0.14]} s={[b - a, 0.08, 0.05]} m={GOLD_M} />
            <Box p={[(a + b) / 2, y + h - 0.3, B.z1 + 0.14]} s={[b - a, 0.24, 0.06]} m={GOLD_M} />
          </group>
        ))}
        {/* 문틀 (금) */}
        {[-1, 1].map((sd) => (
          <Box key={`df${sd}`} p={[B.doorX + sd * (B.doorW / 2 + 0.08), y + 1.6, B.z1 + 0.12]} s={[0.16, 3.2, 0.1]} m={GOLD_M} />
        ))}
        <Box p={[B.doorX, y + 3.25, B.z1 + 0.12]} s={[B.doorW + 0.5, 0.18, 0.12]} m={GOLD_M} />
        {cushions.map((c, i) => (
          <mesh key={i} geometry={GEO.sphere} position={c.p} scale={c.s}>
            <meshStandardMaterial color={c.c} roughness={0.9} />
          </mesh>
        ))}
        {[[-11.5, -11], [-6, -16], [-5.5, -11.5]].map(([x, z], i) => (
          <Ball key={i} p={[x, y + 0.35, z]} rad={0.35} c={CUSHION_COLORS[(i * 2 + 1) % CUSHION_COLORS.length]} />
        ))}
      </group>
      {/* 큰 책상 + 금화 더미 + 돈 자루 + 촛대 + 높은 등받이 의자 */}
      <group position={[O.desk[0], y, O.desk[1]]}>
        <Box p={[0, 0.45, 0]} s={[4.4, 0.9, 1.6]} c="#3b2216" />
        <Box p={[0, 0.93, 0]} s={[4.6, 0.08, 1.75]} c="#2a170e" />
        <Box p={[0, 0.5, 0.81]} s={[4.2, 0.6, 0.03]} m={GOLD_M} />
        <Box p={[-1.2, 1.02, 0.1]} s={[0.9, 0.04, 0.6]} c="#efe6d2" />
        <Box p={[-1.1, 1.06, 0.05]} s={[0.8, 0.04, 0.55]} c="#f7f1e3" />
        <Cyl p={[-0.2, 1.2, -0.45]} rad={0.08} h={0.4} m={GOLD_M} />
        {[-0.35, -0.2, -0.05].map((x) => (
          <group key={x}>
            <Cyl p={[x, 1.55, -0.45]} rad={0.025} h={0.3} c="#f7f1e3" />
            <Ball p={[x, 1.75, -0.45]} rad={0.035} m={GLOBE} />
          </group>
        ))}
      </group>
      <Instances geometry={GEO.cyl} material={GOLD_M} items={coins} />
      {[[O.desk[0] + 3, O.desk[1] + 0.4], [O.desk[0] + 3.4, O.desk[1] - 0.5], [O.desk[0] - 3, O.desk[1]]].map(([x, z], i) => (
        <group key={i} position={[x, y, z]}>
          <mesh position={[0, 0.4, 0]} scale={[0.4, 0.45, 0.4]}>
            <sphereGeometry args={[1, 12, 10]} />
            <meshStandardMaterial color="#c9b38a" roughness={1} />
          </mesh>
          <Cyl p={[0, 0.85, 0]} rad={0.12} h={0.12} c="#7a5a3a" />
        </group>
      ))}
      <group position={[O.chair[0], y, O.chair[1]]}>
        <Box p={[0, 0.5, 0]} s={[1.2, 0.2, 1.1]} m={VELVET} />
        <Box p={[0, 1.6, -0.5]} s={[1.2, 2.2, 0.2]} m={VELVET} />
        <Box p={[0, 2.75, -0.5]} s={[1.4, 0.2, 0.26]} m={GOLD_M} />
        {[-1, 1].map((s) => (
          <group key={s}>
            <Box p={[s * 0.62, 0.8, 0]} s={[0.12, 0.5, 1.1]} c="#5a1018" />
            <Box p={[s * 0.5, 0.2, 0.4]} s={[0.1, 0.4, 0.1]} m={GOLD_M} />
            <Box p={[s * 0.5, 0.2, -0.4]} s={[0.1, 0.4, 0.1]} m={GOLD_M} />
          </group>
        ))}
      </group>
      {/* (11/26 영화 장면) 책상 옆 놋쇠 스탠드 (원뿔 갓 아래 불빛) */}
      <group position={[O.desk[0] + 2.9, y, O.desk[1] - 0.6]}>
        <Cyl p={[0, 0.04, 0]} rad={0.28} h={0.08} m={GOLD_M} />
        <Cyl p={[0, 1.15, 0]} rad={0.035} h={2.3} m={GOLD_M} />
        {[0.7, 1.6].map((yy) => <Ball key={yy} p={[0, yy, 0]} rad={0.07} m={GOLD_M} />)}
        <Box p={[-0.35, 2.25, 0]} s={[0.7, 0.04, 0.04]} m={GOLD_M} />
        <mesh position={[-0.7, 2.0, 0]}>
          <cylinderGeometry args={[0.12, 0.42, 0.36, 16, 1, true]} />
          <meshStandardMaterial color="#f5e2a8" emissive="#ffcf7a" emissiveIntensity={0.9} side={THREE.DoubleSide} />
        </mesh>
      </group>
      {/* 벽난로(안쪽 문 칸막이에 붙음, 서쪽을 봄) + 위 금 거울 */}
      <group position={[O.fire[0], y, O.fire[1]]} rotation={[0, -Math.PI / 2, 0]}>
        {/* (11/26 영화 장면) 흰 대리석 → 어두운 돌 벽난로 + 아치 입 + 큰 불 + 놋쇠 받침 두 개 */}
        <Box p={[0, 0.85, 0]} s={[2.8, 1.7, 0.7]} c="#2e2826" />
        <Box p={[0, 1.75, 0.05]} s={[3.1, 0.14, 0.85]} c="#3e3532" />
        {[-1, 1].map((sd) => (
          <Box key={sd} p={[sd * 1.25, 0.85, 0.38]} s={[0.22, 1.7, 0.12]} c="#4a3f3a" />
        ))}
        <Box p={[0, 0.55, 0.3]} s={[1.5, 1.1, 0.12]} c="#120c0a" />
        <mesh position={[0, 0.55, 0.37]}>
          <planeGeometry args={[1.3, 0.9]} />
          <meshStandardMaterial color="#ff8a2a" emissive="#ff5a10" emissiveIntensity={1.8} />
        </mesh>
        <mesh position={[0, 1.1, 0.37]}>
          <circleGeometry args={[0.65, 24, 0, Math.PI]} />
          <meshStandardMaterial color="#ff7a20" emissive="#ff4a08" emissiveIntensity={1.4} />
        </mesh>
        {[-0.55, 0.55].map((x) => (
          <group key={x} position={[x, 0, 0.55]}>
            <Cyl p={[0, 0.3, 0]} rad={0.06} h={0.6} m={GOLD_M} />
            <mesh position={[0, 0.7, 0]} scale={[0.09, 0.2, 0.09]} geometry={GEO.sphere} material={GOLD_M} />
          </group>
        ))}
        <Box p={[0, 2.8, 0.0]} s={[1.7, 1.9, 0.06]} m={GOLD_M} />
        <Box p={[0, 2.8, 0.04]} s={[1.4, 1.6, 0.02]} c="#c9d6dc" />
        {[-1, 1].map((s) => (
          <group key={s} position={[s * 1.1, 1.75, 0.2]}>
            <Cyl p={[0, 0.2, 0]} rad={0.05} h={0.4} m={GOLD_M} />
            <Ball p={[0, 0.48, 0]} rad={0.07} m={GLOBE} />
          </group>
        ))}
      </group>
      {/* 책장 (서쪽 칸막이 집무실 쪽 면, 동쪽을 봄) */}
      {O.bookcases.map(([x, z], i) => (
        <group key={i} position={[x, y, z]}>
          <Box p={[-0.05, 1.3, 0]} s={[0.5, 2.6, 2.5]} c="#3b2216" />
          <Box p={[-0.05, 2.65, 0]} s={[0.6, 0.12, 2.65]} m={GOLD_M} />
        </group>
      ))}
      <Instances geometry={GEO.box} material={mat('#ffffff')} items={books} />
      {/* 붉은 벨벳 소파 + 낮은 탁자 위 찻잔 */}
      <group position={[O.sofa[0], y, O.sofa[1]]}>
        <Box p={[0, 0.35, 0]} s={[3.0, 0.4, 1.0]} m={VELVET} />
        <Box p={[0, 0.85, 0.4]} s={[3.0, 0.8, 0.2]} m={VELVET} />
        {[-1, 1].map((s) => (
          <Box key={s} p={[s * 1.45, 0.6, 0]} s={[0.15, 0.5, 1.0]} m={VELVET} />
        ))}
        <Box p={[0, 1.27, 0.42]} s={[3.1, 0.06, 0.26]} m={GOLD_M} />
      </group>
      <group position={[O.table[0], y, O.table[1]]}>
        <Box p={[0, 0.42, 0]} s={[1.6, 0.06, 0.9]} c="#2a170e" />
        {[-1, 1].map((sx) => [-1, 1].map((sz) => <Box key={`${sx}${sz}`} p={[sx * 0.7, 0.2, sz * 0.35]} s={[0.06, 0.4, 0.06]} m={GOLD_M} />))}
        <Cyl p={[0, 0.55, 0]} rad={0.12} h={0.2} c="#f1e8d6" />
        {[-0.4, 0.4].map((x) => (
          <Cyl key={x} p={[x, 0.49, 0.1]} rad={0.06} h={0.08} c="#f1e8d6" />
        ))}
      </group>
      {/* 앞벽 진열장 (유리 + 금 장식품) */}
      {O.cabinets.map(([x, z], i) => (
        <group key={i} position={[x, y, z]}>
          <Box p={[0, 0.95, 0]} s={[2.2, 1.9, 0.5]} c="#3b2216" />
          <Box p={[0, 1.1, -0.26]} s={[1.9, 1.3, 0.02]} m={mat('#cfe3ea', { transparent: true, opacity: 0.35, roughness: 0.1 })} />
          {[-0.6, 0, 0.6].map((dx) => (
            <Ball key={dx} p={[dx, 1.15, -0.05]} rad={0.13} m={GOLD_M} />
          ))}
          <Box p={[0, 1.95, 0]} s={[2.3, 0.1, 0.55]} m={GOLD_M} />
        </group>
      ))}
      {/* 도자기 항아리 줄 (청화 백자 + 키 큰 병) */}
      {O.vases.map(([x, z], i) => {
        const tall = i % 3 === 1
        return (
          <group key={i} position={[x, y, z]}>
            <mesh position={[0, tall ? 1.0 : 0.8, 0]} scale={tall ? [0.42, 1.0, 0.42] : [0.55, 0.8, 0.55]} material={PORCELAIN}>
              <sphereGeometry args={[1, 16, 12]} />
            </mesh>
            <mesh position={[0, tall ? 1.0 : 0.8, 0]} scale={tall ? [0.43, 0.25, 0.43] : [0.56, 0.2, 0.56]} material={COBALT}>
              <sphereGeometry args={[1, 16, 8]} />
            </mesh>
            <Cyl p={[0, tall ? 2.05 : 1.65, 0]} rad={tall ? 0.16 : 0.25} h={0.3} m={PORCELAIN} />
            <Cyl p={[0, 0.06, 0]} rad={0.5} h={0.12} c="#2a170e" />
          </group>
        )
      })}
      {/* 뒷벽 금 액자 그림 */}
      {[-9, 1, 18].map((x, i) => (
        <group key={x} position={[x, y + 2.6, -iz + 0.12]}>
          <Box p={[0, 0, 0]} s={[2.4, 1.8, 0.08]} m={GOLD_M} />
          <mesh position={[0, 0, 0.05]}>
            <planeGeometry args={[2.1, 1.5]} />
            <primitive object={texMat(paintingTexture(i))} attach="material" />
          </mesh>
        </group>
      ))}
      {/* 크리스털 샹들리에: 집무실 2개 + 모자이크 방 1개 */}
      {[[-3, -4], [-3, 9], [18.4, 2]].map(([cx, cz]) => (
        <group key={`${cx}${cz}`} position={[cx, lv[5] - 0.4, cz]}>
          <Cyl p={[0, -0.2, 0]} rad={0.04} h={0.6} m={GOLD_M} />
          {[[1.2, -0.7, 10], [0.8, -1.2, 8], [0.4, -1.6, 6]].map(([r, yy, n], j) => (
            <group key={j}>
              <Cyl p={[0, yy, 0]} rad={r} h={0.05} m={GOLD_M} />
              {range(n).map((k) => {
                const a = (k / n) * Math.PI * 2
                return <Ball key={k} p={[Math.cos(a) * r, yy - 0.25, Math.sin(a) * r]} rad={0.1} m={GLOBE} />
              })}
            </group>
          ))}
          <Ball p={[0, -2.0, 0]} rad={0.22} m={GLOBE} />
        </group>
      ))}
      {/* 앞벽 무거운 커튼 */}
      {[-18, -8, 2, 18].map((x) => (
        <group key={x} position={[x, y, iz - 0.2]}>
          {[-0.75, 0.75].map((dx) => (
            <Box key={dx} p={[dx, h / 2 - 0.2, 0]} s={[0.9, h - 0.6, 0.15]} m={CURTAIN} />
          ))}
          <Box p={[0, h - 0.5, 0.02]} s={[2.6, 0.35, 0.2]} m={CURTAIN_DARK} />
        </group>
      ))}
      {/* 서쪽 대기실 문 위 방 이름 현판 */}
      <mesh position={[O.west.x - 0.2, y + 4.1, 0]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[1.8, 0.55]} />
        <GlowMaterial glow={0.5} map={getJpSignTexture('主人の間', '#2b1a12', '#e8c35a', 1.8 / 0.55)} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[O.east.x + 0.2, y + 4.1, (O.east.gap[0] + O.east.gap[1]) / 2]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[1.8, 0.55]} />
        <GlowMaterial glow={0.5} map={getJpSignTexture('主人の間', '#2b1a12', '#e8c35a', 1.8 / 0.55)} side={THREE.DoubleSide} />
      </mesh>
    </group>
  )
}
const seededR = (i) => {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453
  return x - Math.floor(x)
}

// ── (11/25) 구석 직원용 엘리베이터 승강로: 1층 바닥 ~ 지붕 위 기계실까지 이어진 철 격자 + 놋쇠 틀 ──
// 영화 속 손잡이로 움직이는 옛 엘리베이터 느낌. 열린 쪽 = 서쪽(-x). 칸 그림은 층마다 jmElevator 소품(생성 스크립트)
const SHAFT_IRON = mat('#2a2622', { roughness: 0.55, metalness: 0.4 })
const SHAFT_LATTICE = mat('#3a3430', { roughness: 0.6, metalness: 0.3 })
function YuStaffShaft({ Y }) {
  const { elev: E, lv, base } = Y
  if (!E) return null
  const top = lv[5]
  const w = E.w + 0.3
  const x0 = E.x - w / 2
  const bars = useMemo(() => {
    const out = []
    for (const s of [-1, 1]) {
      const z = E.z + s * (w / 2)
      for (let y = base + 0.4; y < top; y += 0.9) out.push({ p: [E.x, y, z], s: [w, 0.05, 0.05] })
      for (let i = 0; i <= 6; i++) out.push({ p: [x0 + (i * w) / 6, (base + top) / 2, z], s: [0.04, top - base, 0.04] })
    }
    return out
  }, [E, w, x0, base, top])
  return (
    <group>
      {/* 네 모서리 기둥 (1층 바닥 ~ 지붕) */}
      {[-1, 1].map((sx) => [-1, 1].map((sz) => (
        <Box key={`${sx}${sz}`} p={[E.x + sx * (w / 2), (base + top) / 2, E.z + sz * (w / 2)]} s={[0.18, top - base, 0.18]} m={SHAFT_IRON} />
      )))}
      <Instances geometry={GEO.box} material={SHAFT_LATTICE} items={bars} />
      {/* 층마다 열린 쪽 문틀 + 층 다이얼 + 바닥 문턱 */}
      {[0, 1, 2, 3, 4].map((k) => (
        <group key={k} position={[x0 - 0.02, lv[k], E.z]}>
          <Box p={[0, 0.03, 0]} s={[0.3, 0.06, w]} m={GOLD_M} />
          {[-1, 1].map((s) => (
            <Box key={s} p={[0, 1.8, s * (w / 2 - 0.08)]} s={[0.14, 3.6, 0.16]} m={GOLD_M} />
          ))}
          <Box p={[0, 3.7, 0]} s={[0.18, 0.2, w + 0.2]} m={GOLD_M} />
          <mesh position={[-0.1, 4.2, 0]} rotation={[0, -Math.PI / 2, 0]}>
            <circleGeometry args={[0.4, 20, 0, Math.PI]} />
            <meshStandardMaterial color="#e8d9a8" emissive="#ffcf7a" emissiveIntensity={0.4} side={THREE.DoubleSide} />
          </mesh>
          <Box p={[-0.12, 4.35, 0]} s={[0.02, 0.3, 0.03]} c={DARK} r={[(k / 4 - 0.5) * 2.4, 0, 0]} />
        </group>
      ))}
      {/* 케이블 + 지붕 위 기계실 (도르래) */}
      {[-0.4, 0.4].map((dz) => (
        <Cyl key={dz} p={[E.x, (base + top) / 2 + 1, E.z + dz]} rad={0.025} h={top - base + 2} m={SHAFT_IRON} />
      ))}
      <group position={[E.x, top + 0.3, E.z]}>
        <Box p={[0, 1.1, 0]} s={[w + 0.6, 2.2, w + 0.6]} c="#7d2a22" />
        <mesh position={[0, 2.2, 0]} geometry={GEO.box} scale={[w + 1.2, 0.2, w + 1.2]}>
          <meshStandardMaterial color={GREEN} />
        </mesh>
        <Cyl p={[0, 1.2, w / 2 + 0.31]} rad={0.5} h={0.1} m={SHAFT_IRON} r={[Math.PI / 2, 0, 0]} />
      </group>
    </group>
  )
}

export const JM_YUTOYA_STYLES = { jmYutoya: JmYutoya }
