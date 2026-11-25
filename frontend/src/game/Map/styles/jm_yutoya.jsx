import { useMemo } from 'react'
import * as THREE from 'three'
import { hipRoofGeometry } from './geometry.js'
import { Ball, Box, Cyl, GEO, Instances, mat, texMat } from './kit.jsx'
import { canvasTexture, getJpSignTexture, GlowMaterial, JP_FONT } from './jm_landmarks.jsx'
import { JmGrandBridge } from './jm_kyoto.jsx'

// 애니메이션 구역(JM) 큰 여관 「湯灯屋」 (11/25 다시 지음) — 담당: 지민
// 참고: 지민이 보낸 사진들
//   외관: 붉은 벽 + 회색 격자창, 층마다 초록 기와 처마, 정면 가운데 둥근 박공(가라하후) 현관과 금색 현판, 지붕 위 누각·금 장식, 굴뚝, 큰 소나무
//   안: 가운데가 꼭대기까지 뚫린 높은 홀, 홀 뒤 가운데 화려한 누각(보라 휘장·붉은 문·초록 둥근 지붕·금 현판·붉은 기둥·용 장식),
//       층마다 붉은 난간 회랑 + 금색 꽃 패널, 금 원형 격자 천장과 둥근 등 샹들리에, 홀을 가로지르는 붉은 아치 다리, (11/25) 1층 로비 + 뒤채 목욕탕(번대·나무 패 판·나무 욕조), 2~4층 연회장, 꼭대기 주인 집무실
// 간판 글자는 우리 것(湯灯屋·天楽·帳場·宴会場·大湯·番台·主人の間 등)만 쓰고, 캐릭터는 넣지 않음
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
      <YuFacadeExtras W={W} D={D} Y={Y} sign={sign} />
      <YuGroundHall W={W} D={D} Y={Y} />
      <YuFloors W={W} D={D} Y={Y} />
      <YuPavilion Y={Y} />
      <YuInnerBridge Y={Y} />
      <YuBathWing Y={Y} />
      <YuBanquetRooms W={W} D={D} Y={Y} />
      <YuOffice W={W} D={D} Y={Y} />
      <YuStaffShaft Y={Y} />
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
            <primitive object={texMat(tiled(lattice, Math.max(1, Math.round(bw / 0.9)), 2))} attach="material" />
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
            <primitive object={texMat(tiled(lattice, 12, 2))} attach="material" />
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
        <Karahafu p={[0, base + doorH + 0.9, 1.6]} w={7.4} h={2.0} depth={3.4} />
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
      {/* (11/25 오후) 굴뚝은 물가 보일러실 것 하나로 (jm_spirit.jsx JmBoilerRoom) */}
      {/* 현관 옆 큰 소나무 */}
      <Pine p={[W / 2 - 1.8, base, front + 2.6]} s={1.15} />
      <Pine p={[-(W / 2 - 1.8), base, front + 2.4]} s={1.0} flip={-1} />
    </group>
  )
}

// ── 1층 큰 홀: 나무 마루, 가운데 붉은 길과 등불, 양옆 탕 칸, 앞쪽 접수대 ──
function YuGroundHall({ W, D, Y }) {
  const { base, wt, pav, lv, bath } = Y
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
      {/* (11/25) 홀 안 탕 칸막이는 없애고 1층은 로비만 — 목욕탕은 뒤 서쪽 문으로 꺾어 들어가는 뒤채 (YuBathWing) */}
      {[-1, 1].map((s) => (
        <group key={s} position={[s * 4.6, base, 2.5]}>
          <Box p={[0, 0.25, 0]} s={[1.0, 0.5, 2.6]} c="#7f1d1d" />
          <Box p={[s * 0.45, 0.6, 0]} s={[0.12, 0.7, 2.6]} c="#7f1d1d" />
          <Box p={[0, 0.52, 0]} s={[1.04, 0.04, 2.64]} m={GOLD_M} />
        </group>
      ))}
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
      <group position={[12.6, base, 11.4]}>
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
        <Box key={s} p={[s * (cw / 2 + side / 2), (base + top) / 2, cz]} s={[side, top - base, pav.z1 - pav.z0 - 0.2]} c={DARK} />
      ))}
      <Box p={[0, (base + 3.6 + lv[1]) / 2, f - 0.15]} s={[cw, lv[1] - base - 3.6, 0.3]} c={DARK} />
      <Box p={[0, (base + lv[1]) / 2, pav.z0 + 0.15]} s={[cw, lv[1] - base, 0.3]} c={DARK} />
      {[1, 2, 3].map((k) => (
        <group key={k}>
          <Box p={[0, (lv[k] + lv[k + 1]) / 2, f - 0.15]} s={[cw, lv[k + 1] - lv[k], 0.3]} c={DARK} />
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
          <Box p={[0, 0.45, 0]} s={[s, 0.9, s]} c="#a0703f" />
          <Box p={[0, 0.92, 0]} s={[s - 0.3, 0.03, s - 0.3]} m={WATER} />
          {[0.2, 0.7].map((y) => (
            <Box key={y} p={[0, y, 0]} s={[s + 0.04, 0.06, s + 0.04]} c="#3a2a1c" />
          ))}
          {range(3).map((k) => (
            <mesh key={k} position={[0.2 - k * 0.2, 1.4 + k * 0.6, 0]} material={STEAM_M} scale={[0.6 + k * 0.3, 0.35 + k * 0.1, 0.6 + k * 0.3]}>
              <sphereGeometry args={[1, 8, 6]} />
            </mesh>
          ))}
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
        {range(5).map((i) => (
          <mesh key={i} position={[0.4 - i * 0.2, 1.6 + i * 0.7, -0.3 + i * 0.1]} material={STEAM_M} scale={[0.8 + i * 0.35, 0.45 + i * 0.15, 0.8 + i * 0.35]}>
            <sphereGeometry args={[1, 10, 8]} />
          </mesh>
        ))}
      </group>
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
const STEAM_M = mat('#ffffff', { transparent: true, opacity: 0.2, roughness: 1 })

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
        ctx.fillStyle = '#c0392b'
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
      ctx.fillStyle = '#c0392b'
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
function YuBanquetRooms({ W, D, Y }) {
  const { lv, wt, rooms } = Y
  const ix = W / 2 - wt
  const iz = D / 2 - wt
  const rows = useMemo(() => {
    const trays = []
    const cushions = []
    const dishes = []
    for (let k = 1; k <= 3; k++) {
      const y = lv[k]
      for (const band of [rooms.front, rooms.back]) {
        const outer = band.z > 0 ? iz : -iz
        const zRow = r1((band.z + outer) / 2)
        const xs = [band.x0, ...band.splits, band.x1]
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
    return { trays, cushions, dishes, legs: trays.map((t) => ({ p: [t.p[0], t.p[1] - 0.1, t.p[2]], s: [1.3, 0.12, 0.5] })) }
  }, [lv, rooms, iz])
  const tatami = useMemo(() => tatamiTexture(), [])
  return (
    <group>
      <Instances geometry={GEO.box} material={mat('#5a1e14', { roughness: 0.5 })} items={rows.trays} />
      <Instances geometry={GEO.box} material={mat('#2b1a12')} items={rows.legs} />
      <Instances geometry={GEO.box} material={mat('#8f2a24')} items={rows.cushions} />
      <Instances geometry={GEO.cyl} material={mat('#f1e8d6')} items={rows.dishes} />
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
                  <mesh position={[(band.x0 + band.x1) / 2, y + 0.015, zc]} rotation={[-Math.PI / 2, 0, 0]}>
                    <planeGeometry args={[band.x1 - band.x0, depth]} />
                    <primitive object={texMat(tiled(tatami, (band.x1 - band.x0) / 1.8, depth / 0.9))} attach="material" />
                  </mesh>
                  {/* 회랑 쪽 면(현판 포함) + 방 안쪽 면 */}
                  <FusumaRow band={band} y={y} h={h} doorW={rooms.doorW} face={-sign} k={k} solid />
                  <FusumaRow band={band} y={y} h={h} doorW={rooms.doorW} face={sign} k={k + 1} />
                  {band.splits.map((x) => (
                    <Box key={x} p={[x, y + h / 2, zc]} s={[0.2, h, depth]} c="#6b4630" />
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
              <GlowMaterial glow={0.5} map={getJpSignTexture('宴会場', '#2b1a12', '#e8c35a', 2.0 / 0.6)} side={THREE.DoubleSide} />
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
  return canvasTexture('jmyu:damask', 256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#7a1622'
    ctx.fillRect(0, 0, w, h)
    ctx.strokeStyle = '#c9963e'
    ctx.fillStyle = 'rgba(201,150,62,0.55)'
    ctx.lineWidth = 3
    for (const [cx, cy] of [[w / 2, h / 2], [0, 0], [w, 0], [0, h], [w, h]]) {
      ctx.beginPath()
      ctx.ellipse(cx, cy, 34, 58, 0, 0, Math.PI * 2)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(cx, cy - 46)
      ctx.quadraticCurveTo(cx + 26, cy, cx, cy + 46)
      ctx.quadraticCurveTo(cx - 26, cy, cx, cy - 46)
      ctx.fill()
    }
  })
}
function carpetTexture() {
  return canvasTexture('jmyu:carpet', 512, 512, (ctx, w, h) => {
    ctx.fillStyle = '#5b1a1a'
    ctx.fillRect(0, 0, w, h)
    ctx.strokeStyle = '#d4a83e'
    ctx.lineWidth = 10
    ctx.strokeRect(20, 20, w - 40, h - 40)
    ctx.lineWidth = 4
    ctx.strokeRect(44, 44, w - 88, h - 88)
    ctx.fillStyle = '#1f3a5f'
    ctx.beginPath()
    ctx.ellipse(w / 2, h / 2, 150, 110, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = '#e8c35a'
    ctx.stroke()
    ctx.fillStyle = '#d4a83e'
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2
      ctx.beginPath()
      ctx.arc(w / 2 + Math.cos(a) * 110, h / 2 + Math.sin(a) * 80, 10, 0, Math.PI * 2)
      ctx.fill()
    }
  })
}
function mosaicTexture() {
  return canvasTexture('jmyu:mosaic', 512, 512, (ctx, w, h) => {
    ctx.fillStyle = '#e9dcc0'
    ctx.fillRect(0, 0, w, h)
    const cols = ['#b8352a', '#1f4a7a', '#d4a83e', '#2f6b4a', '#e9dcc0']
    const n = 16
    const c = w / n
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const d = Math.abs(x - n / 2 + 0.5) + Math.abs(y - n / 2 + 0.5)
      ctx.fillStyle = cols[Math.floor(d) % cols.length]
      ctx.fillRect(x * c + 1, y * c + 1, c - 2, c - 2)
    }
    ctx.strokeStyle = '#d4a83e'
    ctx.lineWidth = 10
    ctx.strokeRect(5, 5, w - 10, h - 10)
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
function YuOffice({ W, D, Y }) {
  const { lv, wt, office: O } = Y
  const y = lv[4]
  const h = lv[5] - lv[4]
  const ix = W / 2 - wt
  const iz = D / 2 - wt
  const coffer = useMemo(() => cofferTexture(), [])
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
            <primitive object={texMat(tiled(damask, len / 1.2, h / 1.2))} attach="material" />
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
        <primitive object={texMat(tiled(mosaic, 1, (iz * 2) / (ix - O.east.x)))} attach="material" />
      </mesh>
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
        <Box p={[B.x1, y + h / 2, (-iz + B.z1) / 2]} s={[0.2, h, B.z1 + iz]} c="#f2d6c8" />
        {[[B.x0, B.doorX - B.doorW / 2], [B.doorX + B.doorW / 2, B.x1]].map(([a, b]) => (
          <Box key={a} p={[(a + b) / 2, y + h / 2, B.z1]} s={[b - a, h, 0.2]} c="#f2d6c8" />
        ))}
        <Box p={[B.doorX, y + 3.2 + (h - 3.2) / 2, B.z1]} s={[B.doorW, h - 3.2, 0.2]} c="#f2d6c8" />
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
      {/* 벽난로(안쪽 문 칸막이에 붙음, 서쪽을 봄) + 위 금 거울 */}
      <group position={[O.fire[0], y, O.fire[1]]} rotation={[0, -Math.PI / 2, 0]}>
        <Box p={[0, 0.8, 0]} s={[2.6, 1.6, 0.7]} c="#e6dccb" />
        <Box p={[0, 1.65, 0.05]} s={[2.9, 0.14, 0.85]} c="#d6c9b2" />
        <Box p={[0, 0.6, 0.3]} s={[1.3, 1.0, 0.12]} c="#1a1110" />
        <mesh position={[0, 0.4, 0.37]}>
          <planeGeometry args={[1.0, 0.55]} />
          <meshStandardMaterial color="#ff8a2a" emissive="#ff6a10" emissiveIntensity={1.6} />
        </mesh>
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
