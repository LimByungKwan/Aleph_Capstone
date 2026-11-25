import { useMemo } from 'react'
import { Ball, Box, Cone, Cyl, GEO, Instances, mat } from '../kit.jsx'
import { getSignTexture } from '../textures.js'
import {
  getCheckerMarbleTexture,
  getCompassFloorTexture,
  getLandscapePaintingTexture,
  getLatticeGlassTexture,
  getMarbleWallTexture,
} from './hjTextures.js'
import { Wall } from './HjSeoulStation.jsx'
import {
  GOV,
  LANDING,
  LINTELS,
  LOBBY_CABINET,
  LOBBY_CASE,
  LOBBY_DAIS,
  OFFICE_CABINETS,
  OFFICE_DESKS,
  PORTICO,
  STAIRS,
  WALLS,
} from './govLayout.js'

// [3. 개발 > 프론트엔드] 조선총독부 청사 (style: "hjGovernmentGeneral") — 들어갈 수 있는 청사 (혜진 영화·드라마 구역)
// 겉: 화강암 4층 본관, 양 끝 높은 동, 네모 기둥 현관과 앞 계단, 둥근 천장 위 천창 줄과 가운데 돔
// 안(1층): 현관 홀(샹들리에·벽등) → 중앙홀(나침반 무늬 대리석 바닥, 양쪽 계단과 2층 발코니, 벽화 3점, 벽 등롱, 천창)
//          왼쪽 로비(체크 대리석 바닥, 넓은 낮은 계단, 격자 유리문, 장식장과 램프 2개, 풍경화, 진열장, 우물 반자 천장)
//          오른쪽 사무실(시계 3개, 서류장과 서류 더미, 책상·타자기·전화·스탠드, 격자 반달 창 칸막이, 매달린 등)
// 배치는 govLayout.js, 충돌 박스는 hj_drama.json의 gs_gg_* (scripts/hj-government-colliders.mjs로 생성)

const GRANITE = '#cfc8b8'
const GRANITE_DARK = '#aaa292'
const CREAM = '#ece6da'
const DARK_WOOD = '#2a211b'
const WOOD = '#6b4a33'
const COPPER = '#4f8a78'
const IRON = '#2d2b29'
const BRASS = '#b08a3a'
const WINDOW_LIT = mat('#ffe2ae', { emissive: '#ffc27a', emissiveIntensity: 0.55 })
const WINDOW_DARK = mat('#5d6f7a', { roughness: 0.3, metalness: 0.2 })
const DAYLIGHT = mat('#f4efe2', { emissive: '#fff3d6', emissiveIntensity: 0.7 })
const LAMP = mat('#fff3d8', { emissive: '#ffd9a0', emissiveIntensity: 1.2 })
const PARTS = mat('#ffffff', { roughness: 0.85 })

const { w, d, h, body, hallW, hallH, roomH, T, floor: FL, vestZ } = GOV
const FZ = d / 2 - T / 2
const SX = w / 2 - T / 2
const HX = hallW / 2
const R = HX - T / 2
const IN = (v) => v - T / 2 - 0.02 // 벽 안쪽 면

export default function HjGovernmentGeneral({ item }) {
  const [sw, sh, sd] = item.size
  return (
    <group scale={[sw / w, sh / h, sd / d]}>
      <Shell title={item.title} />
      <Portico />
      <Hall />
      <Lobby />
      <Office />
    </group>
  )
}

// 실내 쪽 벽 재질: 사무실(x > 중앙홀)은 크림 칠, 나머지는 대리석 판
function wallInner(x0, x1) {
  return Math.min(x0, x1) >= HX - 0.01 ? { innerColor: '#efe8da' } : { innerColor: CREAM, innerMap: getMarbleWallTexture() }
}

// ── 겉모양: 벽 + 창 + 지붕 + 둥근 천장 + 돔 ──
function Shell({ title }) {
  const windows = useMemo(() => {
    const lit = []
    const dark = []
    const inside = []
    const cols = Math.round(w / 1.25)
    for (const face of [1, -1]) {
      for (let f = 0; f < 4; f += 1) {
        for (let i = 0; i < cols; i += 1) {
          const x = (i + 0.5 - cols / 2) * (w / cols)
          if (face > 0 && f === 0 && Math.abs(x) < 5.6) continue // 현관 자리
          if (Math.abs(x) < HX - 0.3 && f < 2 && face < 0) continue // 중앙홀 뒤 벽 (안쪽 발코니)
          const y = FL + 0.9 + f * ((body - FL - 0.6) / 4)
          ;((i + f) % 3 === 0 ? lit : dark).push({ p: [x, y + 0.75, face * (d / 2 + 0.03)], s: [0.5, 1.3, 0.05] })
          if (f === 0 && Math.abs(x) > HX + 0.6) inside.push({ p: [x, y + 0.9, face * IN(FZ)], s: [0.6, 1.7, 0.04] })
        }
      }
    }
    return { lit, dark, inside }
  }, [])
  return (
    <group>
      {WALLS.map(([x0, z0, x1, z1, hgt, inner], i) => (
        <Wall key={i} x0={x0} z0={z0} x1={x1} z1={z1} y1={hgt} inner={inner} outer={GRANITE} T={T} {...wallInner(x0, x1)} />
      ))}
      {LINTELS.map(([x0, z0, x1, z1, y0, y1, inner], i) => (
        <Wall key={`l${i}`} x0={x0} z0={z0} x1={x1} z1={z1} y0={y0} y1={y1} inner={inner} outer={GRANITE} T={T} {...wallInner(x0, x1)} />
      ))}
      {/* 기단 (1층 바닥) */}
      <Box p={[0, FL / 2, 0]} s={[w + 0.4, FL, d + 0.4]} c={GRANITE_DARK} />
      <Instances geometry={GEO.box} material={WINDOW_LIT} items={windows.lit} />
      <Instances geometry={GEO.box} material={WINDOW_DARK} items={windows.dark} />
      <Instances geometry={GEO.box} material={DAYLIGHT} items={windows.inside} />
      {/* 층 띠 + 처마 */}
      {[1, -1].map((face) =>
        [FL + 4.6, body - 0.2].map((y) => <Box key={`${face}${y}`} p={[0, y, face * (d / 2 + 0.08)]} s={[w + 0.2, 0.2, 0.2]} c={GRANITE_DARK} />),
      )}
      {/* 날개 천장(1층) + 지붕 */}
      {[-1, 1].map((s) => (
        <group key={s}>
          <Box p={[s * (HX + (w / 2 - HX) / 2), FL + roomH + 0.12, 0]} s={[w / 2 - HX, 0.25, d]} c={CREAM} />
          <Box p={[s * (HX + (w / 2 - HX) / 2), body + 0.15, 0]} s={[w / 2 - HX + 0.3, 0.3, d + 0.3]} c={GRANITE_DARK} />
          <Box p={[s * (HX + (w / 2 - HX) / 2), body + 0.5, d / 2]} s={[w / 2 - HX, 0.5, 0.25]} c={GRANITE} />
          {/* 양 끝 높은 동 (앞뒤) */}
          {[1, -1].map((face) => (
            <group key={face}>
              <Box p={[s * (w / 2 - 1.4), (body + 1.4) / 2, face * (d / 2 + 0.2)]} s={[2.8, body + 1.4, 0.4]} c={GRANITE} />
              <Box p={[s * (w / 2 - 1.4), body + 1.5, face * (d / 2 - 1.2)]} s={[3.0, 0.4, 3.2]} c={GRANITE_DARK} />
            </group>
          ))}
        </group>
      ))}
      {/* 중앙홀 둥근 천장 겉 + 천창 줄 + 앞 높은 동 + 돔 */}
      <mesh position={[0, hallH, 0]} rotation={[Math.PI / 2, 0, 0]} material={mat('#8a8f92')}>
        <cylinderGeometry args={[R + 0.2, R + 0.2, d - 0.1, 28, 1, true, Math.PI / 2, Math.PI]} />
      </mesh>
      {[-5, -2.5, 0, 2.5, 5].map((z) => (
        <Box key={z} p={[0, hallH + R + 0.18, z]} s={[2.4, 0.2, 1.4]} m={mat('#c9d9df', { emissive: '#8fb0bf', emissiveIntensity: 0.3 })} />
      ))}
      {[1, -1].map((face) => (
        <mesh key={face} position={[0, hallH, face * (FZ + T / 2 + 0.01)]} rotation-y={face > 0 ? 0 : Math.PI} material={mat(GRANITE)}>
          <circleGeometry args={[R + 0.25, 28, 0, Math.PI]} />
        </mesh>
      ))}
      <Box p={[0, hallH + 1.6, d / 2 + 0.3]} s={[hallW + 0.6, 3.2, 0.6]} c={GRANITE} />
      <mesh position={[0, hallH + 1.5, d / 2 + 0.61]}>
        <planeGeometry args={[4.6, 0.7]} />
        <meshStandardMaterial map={getSignTexture(title ?? '조선총독부', '#2b2a27', '#e6dcc4')} />
      </mesh>
      <Cyl p={[0, hallH + R + 1.0, -2.5]} rad={2.6} h={2.0} c={GRANITE} geo={GEO.cyl48} />
      <Instances
        geometry={GEO.cyl8}
        material={mat(GRANITE_DARK)}
        items={Array.from({ length: 14 }, (_, i) => {
          const a = (i / 14) * Math.PI * 2
          return { p: [Math.sin(a) * 2.75, hallH + R + 1.0, -2.5 + Math.cos(a) * 2.75], s: [0.14, 2.0, 0.14] }
        })}
      />
      <mesh geometry={GEO.dome} material={mat(COPPER, { roughness: 0.5, metalness: 0.35 })} position={[0, hallH + R + 2.0, -2.5]} scale={[2.8, 2.6, 2.8]} />
      <Cyl p={[0, hallH + R + 4.9, -2.5]} rad={0.45} h={0.7} c={GRANITE} geo={GEO.cyl8} />
      <Cone p={[0, hallH + R + 5.6, -2.5]} rad={0.5} h={0.7} c={COPPER} />
    </group>
  )
}

// ── 정문 기둥 현관: 기단 + 앞 계단 + 네모 기둥 4개 + 지붕 + 샹들리에 + 벽등 ──
function Portico() {
  const { pillars, z, depth, steps, rise, run } = PORTICO
  const pw = hallW - 1
  return (
    <group>
      <Box p={[0, FL / 2, z]} s={[pw, FL, depth]} c={GRANITE_DARK} />
      {Array.from({ length: steps }, (_, i) => (
        <Box key={i} p={[0, (rise * (i + 1)) / 2, z + depth / 2 + (steps - i - 0.5) * run]} s={[pw - 1, rise * (i + 1), run]} c={GRANITE} />
      ))}
      {pillars.map((x) => (
        <group key={x} position={[x, FL, z + depth / 2 - 0.6]}>
          <Box p={[0, 0.2, 0]} s={[1.1, 0.4, 1.1]} c={GRANITE_DARK} />
          <Box p={[0, 3.2, 0]} s={[0.85, 6.0, 0.85]} c={GRANITE} />
          <Box p={[0, 6.3, 0]} s={[1.1, 0.3, 1.1]} c={GRANITE_DARK} />
        </group>
      ))}
      <Box p={[0, FL + 6.7, z]} s={[pw + 0.4, 0.5, depth + 0.4]} c={GRANITE} />
      <Box p={[0, FL + 6.42, z]} s={[pw - 0.6, 0.06, depth - 0.4]} c={CREAM} />
      <Chandelier position={[0, FL + 5.2, z]} />
      {[-3.3, 3.3].map((x) => (
        <Sconce key={x} position={[x, FL + 2.6, d / 2 + 0.05]} />
      ))}
      {/* 정문 양옆 유리문 (보기용) */}
      {[-3.3, 3.3].map((x) => (
        <Box key={`g${x}`} p={[x, FL + 1.7, d / 2 + 0.03]} s={[1.6, 3.2, 0.05]} m={WINDOW_LIT} />
      ))}
    </group>
  )
}

function Chandelier({ position, rings = 2 }) {
  const items = useMemo(() => {
    const list = []
    for (let r = 0; r < rings; r += 1) {
      const n = 6 + r * 4
      for (let i = 0; i < n; i += 1) {
        const a = (i / n) * Math.PI * 2
        list.push({ p: [Math.cos(a) * (0.35 + r * 0.35), -r * 0.25, Math.sin(a) * (0.35 + r * 0.35)], s: [0.12, 0.2, 0.12] })
      }
    }
    return list
  }, [rings])
  return (
    <group position={position}>
      <Cyl p={[0, 0.7, 0]} rad={0.02} h={1.2} c={BRASS} geo={GEO.cyl8} />
      <Cyl p={[0, 0.05, 0]} rad={0.25} h={0.2} c={BRASS} geo={GEO.cyl8} />
      <Instances geometry={GEO.sphere} material={LAMP} items={items} />
    </group>
  )
}

function Sconce({ position, rotation = 0 }) {
  return (
    <group position={position} rotation-y={rotation}>
      <Box p={[0, 0, 0.05]} s={[0.12, 0.5, 0.08]} c={BRASS} />
      <Box p={[0, 0, 0.14]} s={[0.22, 0.55, 0.14]} m={LAMP} />
    </group>
  )
}

// ── 중앙홀 ──
function Hall() {
  const compass = getCompassFloorTexture()
  const mural = getLandscapePaintingTexture('mural')
  const stepH = STAIRS.rise
  const landY = FL + LANDING.h
  const steps = useMemo(() => {
    const list = []
    for (const x of STAIRS.xs) {
      for (let i = 0; i < STAIRS.steps; i += 1) {
        const top = stepH * (i + 1)
        list.push({ p: [x, FL + top / 2, STAIRS.fromZ - (i + 0.5) * STAIRS.run], s: [STAIRS.width, top, STAIRS.run], c: i % 2 ? '#d6cfc2' : '#ddd6ca' })
      }
    }
    return list
  }, [stepH])
  const balusters = useMemo(() => {
    const list = []
    // 발코니 앞 난간
    for (let x = -3.5; x <= 3.5; x += 0.35) list.push({ p: [x, landY + 0.45, -FZ + T / 2 + LANDING.depth - 0.1], s: [0.09, 0.8, 0.09] })
    // 계단 안쪽 난간
    for (const sx of STAIRS.xs) {
      const ix = sx - Math.sign(sx) * (STAIRS.width / 2 - 0.05)
      for (let i = 0; i < STAIRS.steps; i += 2) list.push({ p: [ix, FL + stepH * (i + 1) + 0.45, STAIRS.fromZ - (i + 0.5) * STAIRS.run], s: [0.08, 0.8, 0.08] })
    }
    return list
  }, [stepH, landY])
  const stairLen = STAIRS.steps * STAIRS.run
  const slope = Math.atan2(STAIRS.steps * stepH, stairLen)
  return (
    <group>
      {/* 바닥: 대리석 + 가운데 나침반 무늬 */}
      <Box p={[0, FL + 0.01, 0]} s={[hallW - T, 0.02, d - T * 2]} c="#d9d2c4" />
      <mesh position={[0, FL + 0.045, -0.4]} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[9.6, 9.6]} />
        <meshStandardMaterial map={compass} roughness={0.35} />
      </mesh>
      {/* 둥근 천장 안 + 갈빗대 + 천창 */}
      <mesh position={[0, hallH, 0]} rotation={[Math.PI / 2, 0, 0]} material={mat(CREAM, { double: true })}>
        <cylinderGeometry args={[R, R, d - T * 2, 28, 1, true, Math.PI / 2, Math.PI]} />
      </mesh>
      {[-6, -3.6, -1.2, 1.2, 3.6, 6].map((z) => (
        <mesh key={z} position={[0, hallH, z]} material={mat('#d8cfbd')}>
          <torusGeometry args={[R - 0.06, 0.12, 6, 24, Math.PI]} />
        </mesh>
      ))}
      {[-5, -2.5, 0, 2.5, 5].map((z) => (
        <mesh key={`s${z}`} position={[0, hallH + R - 0.1, z]} rotation-x={Math.PI / 2} material={DAYLIGHT}>
          <planeGeometry args={[2.2, 1.2]} />
        </mesh>
      ))}
      {/* 앞뒤 반원 벽 안쪽: 뒤에는 벽화 3점 */}
      {[1, -1].map((face) => (
        <mesh key={face} position={[0, hallH, face * IN(FZ)]} rotation-y={face > 0 ? Math.PI : 0} material={mat(CREAM, { double: true })}>
          <circleGeometry args={[R, 28, 0, Math.PI]} />
        </mesh>
      ))}
      <group position={[0, 0, -IN(FZ) + 0.02]}>
        <mesh position={[0, hallH + 1.3, 0]}>
          <planeGeometry args={[3.2, 2.2]} />
          <meshStandardMaterial map={mural} />
        </mesh>
        {[-1, 1].map((s) => (
          <mesh key={s} position={[s * 3.6, hallH + 0.9, 0]}>
            <circleGeometry args={[1.5, 16, s < 0 ? 0 : Math.PI / 2, Math.PI / 2]} />
            <meshStandardMaterial map={mural} />
          </mesh>
        ))}
        <Box p={[0, hallH - 0.1, 0.05]} s={[hallW - 1, 0.35, 0.12]} c="#d8cfbd" />
      </group>
      {/* 2층 발코니 (계단참) + 아래 가운데 출입구 */}
      <Box p={[0, landY - 0.15, -FZ + T / 2 + LANDING.depth / 2]} s={[hallW - T, 0.3, LANDING.depth]} c="#d6cfc2" />
      <Box p={[0, FL + LANDING.h / 2 - 0.15, -FZ + T / 2 + LANDING.depth / 2]} s={[2.6, LANDING.h - 0.3, LANDING.depth - 0.4]} c="#cbc3b4" />
      <Box p={[0, FL + 1.3, -FZ + T / 2 + LANDING.depth + 0.01]} s={[1.6, 2.4, 0.04]} c={DARK_WOOD} />
      <Box p={[0, landY + 0.9, -FZ + T / 2 + LANDING.depth - 0.1]} s={[7.2, 0.1, 0.18]} c="#d6cfc2" />
      <Box p={[0, landY + 0.06, -IN(FZ) + 0.02]} s={[2.4, 3.0, 0.04]} c={DARK_WOOD} />
      {[-1, 1].map((s) => (
        <Box key={s} p={[s * 3.0, landY + 1.6, -IN(FZ) + 0.02]} s={[1.6, 2.4, 0.04]} m={DAYLIGHT} />
      ))}
      {/* 계단 + 난간 손잡이 */}
      <Instances geometry={GEO.box} material={PARTS} items={steps} />
      <Instances geometry={GEO.box} material={mat('#efe9dd')} items={balusters} />
      {STAIRS.xs.map((x) => {
        const ix = x - Math.sign(x) * (STAIRS.width / 2 - 0.05)
        return (
          <group key={x}>
            <Box p={[ix, FL + (STAIRS.steps * stepH) / 2 + 0.9, STAIRS.fromZ - stairLen / 2]} s={[0.12, 0.1, Math.hypot(stairLen, STAIRS.steps * stepH)]} r={[slope, 0, 0]} c="#d6cfc2" />
            <Box p={[ix, FL + 0.55, STAIRS.fromZ + 0.1]} s={[0.4, 1.1, 0.4]} c="#d6cfc2" />
          </group>
        )
      })}
      {/* 큰 네모 기둥 (발코니 앞 · 현관 쪽) */}
      {[[-2.9, -FZ + T / 2 + LANDING.depth + 0.4], [2.9, -FZ + T / 2 + LANDING.depth + 0.4], [-HX + 0.55, vestZ - 0.5], [HX - 0.55, vestZ - 0.5]].map(([x, z]) => (
        <group key={`${x}${z}`} position={[x, FL, z]}>
          <Box p={[0, 0.3, 0]} s={[1.0, 0.6, 1.0]} c="#bfb6a6" />
          <Box p={[0, (hallH - FL) / 2, 0]} s={[0.8, hallH - FL, 0.8]} c="#e2dbcd" />
          <Box p={[0, hallH - FL - 0.4, 0]} s={[1.05, 0.3, 1.05]} c="#bfb6a6" />
        </group>
      ))}
      {/* 벽 등롱 + 부조 판 */}
      {[-1, 1].map((s) =>
        [3.6, -3.4].map((z) => (
          <group key={`${s}${z}`}>
            <Sconce position={[s * IN(HX), FL + 3.4, z]} rotation={s > 0 ? -Math.PI / 2 : Math.PI / 2} />
            <Box p={[s * (IN(HX) - 0.03), FL + 6.4, z]} s={[0.06, 2.6, 1.6]} c="#e3dccd" />
            <Box p={[s * (IN(HX) - 0.06), FL + 6.4, z]} s={[0.04, 1.8, 0.9]} c="#cfc5b2" />
          </group>
        )),
      )}
      {/* 현관 홀: 칸막이 위 띠 + 샹들리에 */}
      <Box p={[0, FL + 4.4, vestZ]} s={[hallW - T, 0.4, 0.5]} c="#d8cfbd" />
      <Chandelier position={[0, FL + 3.9, (vestZ + FZ) / 2]} rings={2} />
      <pointLight position={[0, hallH - 1, -1]} color="#ffe6bf" intensity={12} distance={14} decay={2} />
    </group>
  )
}

// ── 로비 (왼쪽 날개) ──
function Lobby() {
  const x0 = -(HX + (w / 2 - HX) / 2)
  const rw = w / 2 - HX - T
  const checker = useMemo(() => {
    const t = getCheckerMarbleTexture()?.clone()
    if (t) {
      t.repeat.set(rw / 1.6, (d - T * 2) / 1.6)
      t.needsUpdate = true
    }
    return t
  }, [rw])
  const lattice = getLatticeGlassTexture()
  const painting = getLandscapePaintingTexture('mountain')
  const { z0, depth, steps, rise, run } = LOBBY_DAIS
  const daisH = steps * rise
  const coffers = useMemo(() => {
    const list = []
    for (let i = 1; i < 3; i += 1) list.push({ p: [x0 - rw / 2 + (rw / 3) * i, FL + roomH - 0.15, 0], s: [0.3, 0.3, d - T * 2] })
    for (let k = 1; k < 6; k += 1) list.push({ p: [x0, FL + roomH - 0.15, -d / 2 + T + ((d - T * 2) / 6) * k], s: [rw, 0.3, 0.3] })
    return list
  }, [x0, rw])
  return (
    <group>
      <mesh position={[x0, FL + 0.02, 0]} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[rw, d - T * 2]} />
        <meshStandardMaterial map={checker} roughness={0.3} />
      </mesh>
      <Instances geometry={GEO.box} material={mat('#e9e3d6')} items={coffers} />
      {/* 넓은 낮은 계단 → 뒤쪽 단 */}
      <Box p={[x0, FL + daisH / 2, z0 + depth / 2]} s={[rw, daisH, depth]} c="#bdb5a6" />
      {Array.from({ length: steps }, (_, i) => (
        <Box key={i} p={[x0, FL + (rise * (i + 1)) / 2, z0 + depth + (steps - i - 0.5) * run]} s={[rw, rise * (i + 1), run]} c={i % 2 ? '#c9c1b2' : '#d3cbbd'} />
      ))}
      {/* 단 뒤 벽: 격자 유리 나무문 (보기용) */}
      <group position={[x0, FL + daisH, -IN(FZ) + 0.03]}>
        <Box p={[0, 1.6, 0]} s={[3.4, 3.2, 0.08]} c={DARK_WOOD} />
        {[-1.05, -0.35, 0.35, 1.05].map((x) => (
          <mesh key={x} position={[x, 1.6, 0.05]}>
            <planeGeometry args={[0.6, 2.8]} />
            <meshStandardMaterial map={lattice} emissive="#ffffff" emissiveMap={lattice} emissiveIntensity={0.25} />
          </mesh>
        ))}
      </group>
      {/* 끝 벽: 대리석 기둥 2개 + 벽등 + 풍경화 + 검은 장식장과 램프 2개 + 위 가로 창 */}
      <group position={[-IN(SX), FL, 0]} rotation-y={Math.PI / 2}>
        {[-1.6, 1.6].map((x) => (
          <group key={x}>
            <Box p={[x, 2.2, 0.08]} s={[0.9, 4.4, 0.16]} c="#d9d1c4" />
            <Box p={[x, 2.0, 0.17]} s={[0.5, 3.0, 0.02]} c="#6a4f45" />
            <Sconce position={[x, 2.6, 0.18]} />
          </group>
        ))}
        <mesh position={[0, 2.7, 0.04]}>
          <planeGeometry args={[2.0, 1.3]} />
          <meshStandardMaterial map={painting} />
        </mesh>
        <Box p={[0, 3.6, 0.05]} s={[2.4, 0.18, 0.06]} c={BRASS} />
        {[-3.4, 3.4].map((x) => (
          <group key={`t${x}`}>
            <Box p={[x, 3.6, 0.04]} s={[1.8, 0.9, 0.05]} m={DAYLIGHT} />
            <Box p={[x, 3.15, 0.06]} s={[1.9, 0.08, 0.06]} c={DARK_WOOD} />
          </group>
        ))}
      </group>
      <group position={[LOBBY_CABINET[0], FL, LOBBY_CABINET[1]]}>
        <Box p={[0, 0.5, 0]} s={[LOBBY_CABINET[2], 1.0, LOBBY_CABINET[3]]} c="#1a1715" />
        <Box p={[0, 1.02, 0]} s={[LOBBY_CABINET[2] + 0.06, 0.05, LOBBY_CABINET[3] + 0.06]} c="#2a2522" />
        {[-0.7, 0.7].map((z) => (
          <group key={z} position={[0, 1.05, z]}>
            <Cyl p={[0, 0.2, 0]} rad={0.05} h={0.4} c={IRON} geo={GEO.cyl8} />
            <Cone p={[0, 0.5, 0]} rad={0.18} h={0.25} m={LAMP} />
          </group>
        ))}
      </group>
      {/* 진열장 */}
      <group position={[LOBBY_CASE[0], FL, LOBBY_CASE[1]]}>
        {[-1, 1].flatMap((sx) => [-1, 1].map((sz) => <Box key={`${sx}${sz}`} p={[sx * (LOBBY_CASE[2] / 2 - 0.05), 0.4, sz * (LOBBY_CASE[3] / 2 - 0.05)]} s={[0.06, 0.8, 0.06]} c="#1a1715" />))}
        <Box p={[0, 0.85, 0]} s={[LOBBY_CASE[2], 0.12, LOBBY_CASE[3]]} c="#1a1715" />
        <Box p={[0, 0.93, 0]} s={[LOBBY_CASE[2] - 0.1, 0.04, LOBBY_CASE[3] - 0.1]} m={mat('#c9d6dc', { transparent: true, opacity: 0.5 })} />
        <Box p={[0, 0.93, 0]} s={[0.6, 0.02, 0.3]} c="#f1ece0" />
      </group>
      <Chandelier position={[x0, FL + roomH - 0.9, 0.8]} rings={2} />
      {[-4.6, 4.2].map((z) => (
        <Sconce key={z} position={[-HX - T / 2 - 0.02, FL + 2.6, z]} rotation={-Math.PI / 2} />
      ))}
      <pointLight position={[x0, FL + roomH - 1.2, 0]} color="#ffe2b0" intensity={6} distance={10} decay={2} />
    </group>
  )
}

// ── 사무실 (오른쪽 날개) ──
function Office() {
  const x0 = HX + (w / 2 - HX) / 2
  const rw = w / 2 - HX - T
  const lattice = getLatticeGlassTexture()
  const papers = useMemo(() => {
    const list = []
    OFFICE_CABINETS.forEach(([x, z, cw, cd], k) => {
      for (let i = 0; i < 4; i += 1) {
        list.push({ p: [x + ((i % 2) - 0.5) * cw * 0.45, FL + 1.65 + Math.floor(i / 2) * 0.16 + (k % 2) * 0.05, z + ((i % 2) - 0.5) * cd * 0.2], s: [cw * 0.42, 0.14, cd * 0.7], c: ['#d9c9a4', '#cbb58a', '#e6dcc4'][(i + k) % 3] })
      }
    })
    return list
  }, [])
  return (
    <group>
      <Box p={[x0, FL + 0.015, 0]} s={[rw, 0.03, d - T * 2]} c="#8f8a80" />
      {/* 푸른 회색 징두리 판 + 검은 띠 */}
      {[1, -1].map((face) => (
        <group key={face}>
          <Box p={[x0, FL + 0.75, face * (IN(FZ) - 0.03)]} s={[rw, 1.5, 0.06]} c="#6f8590" />
          <Box p={[x0, FL + 1.52, face * (IN(FZ) - 0.05)]} s={[rw, 0.06, 0.08]} c={DARK_WOOD} />
        </group>
      ))}
      <Box p={[IN(SX) - 0.03, FL + 0.75, 0]} s={[0.06, 1.5, d - T * 2]} c="#6f8590" />
      <Box p={[IN(SX) - 0.05, FL + 1.52, 0]} s={[0.08, 0.06, d - T * 2]} c={DARK_WOOD} />
      {/* 시계 3개 (끝 벽) */}
      {[['London', 2.6], ['Tokyo', 1.2], ['New York', -0.2]].map(([city, z], i) => (
        <group key={city} position={[IN(SX) - 0.06, FL + 3.0 - i * 0.12, z]} rotation-y={-Math.PI / 2}>
          <Cyl p={[0, 0, 0]} rad={0.32} h={0.06} c="#2a211b" r={[Math.PI / 2, 0, 0]} />
          <Cyl p={[0, 0, 0.035]} rad={0.27} h={0.02} c="#f1ece0" r={[Math.PI / 2, 0, 0]} />
          <Box p={[0, 0.08, 0.05]} s={[0.03, 0.18, 0.01]} c={IRON} />
          <Box p={[0.06 + i * 0.02, 0, 0.05]} s={[0.14, 0.03, 0.01]} c={IRON} />
          <mesh position={[0, -0.5, 0.01]}>
            <planeGeometry args={[0.6, 0.14]} />
            <meshStandardMaterial map={getSignTexture(city, '#2a211b', '#efe8da')} />
          </mesh>
        </group>
      ))}
      {/* 서류장 + 서류 더미 */}
      {OFFICE_CABINETS.map(([x, z, cw, cd]) => (
        <group key={`${x}${z}`} position={[x, FL, z]}>
          <Box p={[0, 0.78, 0]} s={[cw, 1.56, cd]} c="#1f2a3a" />
          {[0.4, 0.8, 1.2].map((y) => (
            <Box key={y} p={[0, y, (z > 0 ? -1 : 1) * (cd / 2 + 0.005)]} s={[cw - 0.2, 0.03, 0.01]} c="#9aa3ad" />
          ))}
        </group>
      ))}
      <Instances geometry={GEO.box} material={PARTS} items={papers} />
      {/* 책상 + 타자기 + 전화 + 스탠드 */}
      {OFFICE_DESKS.map(([x, z, dw, dd], i) => (
        <group key={`${x}${z}`} position={[x, FL, z]}>
          <Box p={[0, 0.74, 0]} s={[dw, 0.06, dd]} c={WOOD} />
          <Box p={[-dw / 2 + 0.25, 0.37, 0]} s={[0.45, 0.72, dd - 0.06]} c="#5a3d2a" />
          <Box p={[dw / 2 - 0.05, 0.37, 0]} s={[0.06, 0.72, dd - 0.06]} c="#5a3d2a" />
          {i === 0 && (
            <group position={[0.2, 0.77, 0]}>
              <Box p={[0, 0.08, 0]} s={[0.45, 0.16, 0.35]} c="#1c1c1c" />
              <Cyl p={[0, 0.2, -0.1]} rad={0.05} h={0.5} c="#1c1c1c" r={[0, 0, Math.PI / 2]} />
              <Box p={[0, 0.28, -0.12]} s={[0.3, 0.2, 0.01]} c="#f6f2e8" />
            </group>
          )}
          <Box p={[-0.45, 0.82, -0.1]} s={[0.2, 0.1, 0.16]} c="#111" />
          <Cyl p={[-0.45, 0.9, -0.1]} rad={0.03} h={0.2} c="#111" r={[0, 0, Math.PI / 2]} />
          <group position={[dw / 2 - 0.3, 0.77, -dd / 2 + 0.2]}>
            <Cyl p={[0, 0.02, 0]} rad={0.09} h={0.04} c="#111" />
            <Cyl p={[0, 0.2, 0]} rad={0.015} h={0.36} c="#111" geo={GEO.cyl8} />
            <Cone p={[0.05, 0.4, 0.05]} rad={0.1} h={0.12} m={LAMP} />
          </group>
          <Box p={[0.1, 0.78, 0.2]} s={[0.4, 0.02, 0.3]} c="#efe8da" />
        </group>
      ))}
      {/* 칸막이 위 격자 반달 창 */}
      {[1, -1].map((face) => (
        <mesh key={face} position={[x0, FL + roomH - 0.8, -3.2 + face * (T / 2 + 0.015)]} rotation-y={face > 0 ? 0 : Math.PI}>
          <planeGeometry args={[rw - 0.4, 1.2]} />
          <meshStandardMaterial map={lattice} />
        </mesh>
      ))}
      {/* 뒤 작은 방 창 커튼(흰 얇은 천) */}
      {[x0 - 1.2, x0 + 1.2].map((x) => (
        <Box key={x} p={[x, FL + 2.4, -IN(FZ) + 0.12]} s={[1.1, 3.2, 0.04]} m={mat('#f4f1ea', { transparent: true, opacity: 0.7 })} />
      ))}
      {/* 매달린 등 */}
      {[2.2, -5.4].map((z) => (
        <group key={z} position={[x0, FL + roomH - 1.0, z]}>
          <Cyl p={[0, 0.5, 0]} rad={0.015} h={1.0} c={IRON} geo={GEO.cyl8} />
          <Cone p={[0, 0, 0]} rad={0.28} h={0.3} c="#d8d2c4" />
          <Ball p={[0, -0.12, 0]} rad={0.12} m={LAMP} />
        </group>
      ))}
      <pointLight position={[x0, FL + roomH - 1.4, 1]} color="#ffdcae" intensity={5} distance={9} decay={2} />
    </group>
  )
}
