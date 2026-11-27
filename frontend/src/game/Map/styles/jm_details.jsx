import { useMemo } from 'react'
import * as THREE from 'three'
import { useSeason } from '../../seasons.js'
import { ICE, SeaWater, lakeGeometry, ribbonGrid } from './jm_water.jsx'

// 애니메이션 구역(JM) 전용: 영역마다 "무엇을 묘사했는지" 알아볼 수 있게 하는 세부 소품. 담당: 지민
// 대부분 충돌 없이 써도 되는 작은 소품이에요 (필요한 것만 JSON에서 collider 지정).

const range = (n) => Array.from({ length: n }, (_, i) => i)
const WOOD = '#6e4b33'
const DARK = '#3f2a1d'
const STRAW = '#d8b24a'
const SNOW = '#eef2f6'

function Box({ p, s, c, r, e }) {
  return (
    <mesh position={p} rotation={r ?? [0, 0, 0]}>
      <boxGeometry args={s} />
      <meshStandardMaterial color={c} emissive={e ?? '#000000'} emissiveIntensity={e ? 0.5 : 0} />
    </mesh>
  )
}
function Cyl({ p, r1, r2, h, c, rot, seg = 10 }) {
  return (
    <mesh position={p} rotation={rot ?? [0, 0, 0]}>
      <cylinderGeometry args={[r1, r2 ?? r1, h, seg]} />
      <meshStandardMaterial color={c} />
    </mesh>
  )
}

// ── 허수아비 (논 한가운데) ──────────────────────
export function JmScarecrow() {
  const season = useSeason()
  return (
    <group>
      <Cyl p={[0, 0.9, 0]} r1={0.04} h={1.8} c={WOOD} />
      <Box p={[0, 1.35, 0]} s={[1.3, 0.06, 0.06]} c={WOOD} />
      <Box p={[0, 1.15, 0]} s={[0.5, 0.6, 0.18]} c="#4f6d9a" />
      <mesh position={[0, 1.65, 0]}>
        <sphereGeometry args={[0.16, 10, 8]} />
        <meshStandardMaterial color="#efe6cf" />
      </mesh>
      <Cyl p={[0, 1.8, 0]} r1={0.08} r2={0.34} h={0.14} c={season === 'winter' ? SNOW : STRAW} seg={14} />
    </group>
  )
}

// ── 볏단 걸이 (가을 논 옆, 벼를 말리는 나무 틀) ──────────
// 가을에만 볏단이 걸려요. size [가로, 높이, 깊이]
export function JmRiceRack({ item }) {
  const season = useSeason()
  const [w, h] = item.size
  const posts = Math.max(2, Math.round(w / 1.5) + 1)
  return (
    <group>
      {range(posts).map((i) => (
        <Cyl key={i} p={[-w / 2 + (w * i) / (posts - 1), h / 2, 0]} r1={0.04} h={h} c={WOOD} />
      ))}
      <Cyl p={[0, h - 0.25, 0]} r1={0.03} h={w} c={WOOD} rot={[0, 0, Math.PI / 2]} />
      {season === 'autumn' &&
        range(Math.round(w / 0.35)).map((i) => (
          <mesh key={i} position={[-w / 2 + 0.2 + i * 0.35, h - 0.6, 0]}>
            <coneGeometry args={[0.16, 0.75, 6]} />
            <meshStandardMaterial color={i % 2 ? STRAW : '#c99a2e'} />
          </mesh>
        ))}
    </group>
  )
}

// ── 길가 작은 사당 (호코라) ────────────────────────
export function JmHokora() {
  const season = useSeason()
  return (
    <group>
      <Box p={[0, 0.25, 0]} s={[0.9, 0.5, 0.7]} c="#9a958c" />
      <Box p={[0, 0.85, 0]} s={[0.6, 0.7, 0.5]} c={WOOD} />
      <mesh position={[0, 1.35, 0]} rotation={[0, Math.PI / 4, 0]}>
        <coneGeometry args={[0.6, 0.4, 4]} />
        <meshStandardMaterial color={season === 'winter' ? SNOW : '#33373d'} flatShading />
      </mesh>
      <Box p={[0, 0.85, 0.26]} s={[0.3, 0.4, 0.02]} c="#a9543a" />
    </group>
  )
}

// ── 대나무 울타리 (다케가키) ─────────────────────────
// size [길이, 높이, 두께]
export function JmBambooFence({ item }) {
  const [w, h] = item.size
  const n = Math.max(4, Math.round(w / 0.12))
  return (
    <group>
      {range(n).map((i) => (
        <Cyl key={i} p={[-w / 2 + (w * (i + 0.5)) / n, h / 2, 0]} r1={0.045} h={h} c={i % 3 ? '#b7a46a' : '#a8955c'} seg={6} />
      ))}
      {[0.25, 0.75].map((t) => (
        <Box key={t} p={[0, h * t, 0.06]} s={[w, 0.05, 0.05]} c={DARK} />
      ))}
    </group>
  )
}

// ── 빨래 장대 (농가 마당) ──────────────────────────
export function JmLaundryPole({ item }) {
  const [w, h] = item.size
  const colors = ['#ffffff', '#93c5fd', '#fca5a5', '#fde68a']
  return (
    <group>
      {[-1, 1].map((s) => (
        <Cyl key={s} p={[(s * w) / 2, h / 2, 0]} r1={0.04} h={h} c={WOOD} />
      ))}
      <Cyl p={[0, h - 0.1, 0]} r1={0.02} h={w} c="#9ca3af" rot={[0, 0, Math.PI / 2]} />
      {range(4).map((i) => (
        <Box key={i} p={[-w / 2 + 0.5 + i * ((w - 1) / 3), h - 0.5, 0]} s={[0.55, 0.75, 0.02]} c={colors[i]} />
      ))}
    </group>
  )
}

// ── 농구 코트 선 (코트 바닥 위) ─────────────────────
// size [코트 가로, 0.02, 코트 세로]. JSON에 "collider": false
export function JmCourtLines({ item }) {
  const [w, , d] = item.size
  const y = 0.135
  const line = (p, s) => (
    <mesh position={[p[0], y, p[1]]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={s} />
      <meshStandardMaterial color="#ffffff" />
    </mesh>
  )
  return (
    <group>
      {line([0, -d / 2 + 0.25], [w - 0.4, 0.08])}
      {line([0, d / 2 - 0.25], [w - 0.4, 0.08])}
      {line([-w / 2 + 0.25, 0], [0.08, d - 0.4])}
      {line([w / 2 - 0.25, 0], [0.08, d - 0.4])}
      {line([0, 0], [0.08, d - 0.4])}
      <mesh position={[0, y, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[1.1, 1.18, 32]} />
        <meshStandardMaterial color="#ffffff" />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * (w / 2 - 0.25), y + 0.001, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[3.6, 3]} />
          <meshStandardMaterial color="#a8532e" transparent opacity={0.45} />
        </mesh>
      ))}
    </group>
  )
}

// ── 농구공 ─────────────────────────────────────
export function JmBall() {
  return (
    <mesh position={[0, 0.12, 0]}>
      <sphereGeometry args={[0.12, 14, 10]} />
      <meshStandardMaterial color="#e8792a" />
    </mesh>
  )
}

// ── 역 승강장 (지붕·기둥·벤치·노란 점자 블록) ─────────────
// size [길이, 높이(승강장), 폭]. JSON에 "collider": [길이, 높이, 폭]
export function JmPlatform({ item }) {
  const season = useSeason()
  const [w, h, d] = item.size
  const roofY = h + 2.6
  return (
    <group>
      <Box p={[0, h / 2, 0]} s={[w, h, d]} c="#b9b4a8" />
      <Box p={[0, h + 0.01, -d / 2 + 0.35]} s={[w, 0.02, 0.3]} c="#e7c22a" />
      {range(3).map((i) => (
        <Cyl key={i} p={[-w / 3 + (i * w) / 3, h + 1.3, d / 4]} r1={0.07} h={2.6} c="#6b7280" />
      ))}
      <Box p={[0, roofY, 0.1]} s={[w * 0.8, 0.12, d + 0.4]} c={season === 'winter' ? SNOW : '#4b5563'} />
      <Box p={[w * 0.15, h + 0.45, d / 4 + 0.3]} s={[1.6, 0.08, 0.4]} c="#2563eb" />
    </group>
  )
}

// ── 테루테루보즈 (맑음을 비는 하얀 인형 줄) ──────────────
// size [폭, 높이, 깊이]. 양 끝 기둥 사이 줄에 매달려요
export function JmTeruTeru({ item }) {
  const [w, h] = item.size
  const n = Math.max(3, Math.round(w / 0.6))
  return (
    <group>
      {[-1, 1].map((s) => (
        <Cyl key={s} p={[(s * w) / 2, h / 2, 0]} r1={0.03} h={h} c="#9ca3af" />
      ))}
      <Cyl p={[0, h - 0.05, 0]} r1={0.01} h={w} c="#555" rot={[0, 0, Math.PI / 2]} />
      {range(n).map((i) => {
        const x = -w / 2 + (w * (i + 0.5)) / n
        return (
          <group key={i} position={[x, h - 0.4, 0]}>
            <mesh>
              <sphereGeometry args={[0.1, 10, 8]} />
              <meshStandardMaterial color="#ffffff" />
            </mesh>
            <mesh position={[0, -0.15, 0]}>
              <coneGeometry args={[0.14, 0.24, 10, 1, true]} />
              <meshStandardMaterial color="#ffffff" side={THREE.DoubleSide} />
            </mesh>
          </group>
        )
      })}
    </group>
  )
}

// ── 꽃밭 (계절마다 꽃 색이 바뀜) ────────────────────────
// size [가로, 0.3, 깊이]
const FLOWERS = {
  spring: ['#f9a8d4', '#fde68a', '#ffffff'],
  summer: ['#60a5fa', '#c084fc', '#f472b6'],
  autumn: ['#f59e0b', '#d27171', '#a855f7'], // 코스모스·국화
  winter: [SNOW, '#e5e7eb'],
}
export function JmFlowerBed({ item }) {
  const season = useSeason()
  const [w, , d] = item.size
  const colors = item.white ? ['#ffffff', '#f8fafc'] : FLOWERS[season]
  const n = Math.round(w * d * 4)
  const dots = useMemo(() => {
    let s = Math.round((w * 13 + d * 7) * 1000) || 1
    const rand = () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646
    return range(n).map(() => [(rand() - 0.5) * (w - 0.3), (rand() - 0.5) * (d - 0.3), Math.floor(rand() * 3)])
  }, [w, d, n])
  return (
    <group>
      <Box p={[0, 0.12, 0]} s={[w, 0.24, d]} c="#6b4f3a" />
      <Box p={[0, 0.25, 0]} s={[w - 0.15, 0.04, d - 0.15]} c={season === 'winter' ? SNOW : '#4e7a34'} />
      {season !== 'winter' &&
        dots.map(([x, z, k], i) => (
          <mesh key={i} position={[x, 0.33, z]}>
            <sphereGeometry args={[0.07, 6, 5]} />
            <meshStandardMaterial color={colors[k % colors.length]} />
          </mesh>
        ))}
    </group>
  )
}

// ── 앉아 있는 고양이 석상 (특정 캐릭터가 아닌 평범한 고양이) ──
export function JmCatStatue() {
  const c = '#5b5f66'
  return (
    <group>
      <Box p={[0, 0.3, 0]} s={[0.6, 0.6, 0.6]} c="#9a958c" />
      <mesh position={[0, 0.82, 0]} scale={[1, 1.2, 0.9]}>
        <sphereGeometry args={[0.22, 12, 10]} />
        <meshStandardMaterial color={c} />
      </mesh>
      <mesh position={[0, 1.15, 0.03]}>
        <sphereGeometry args={[0.15, 12, 10]} />
        <meshStandardMaterial color={c} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 0.08, 1.3, 0.02]}>
          <coneGeometry args={[0.05, 0.12, 4]} />
          <meshStandardMaterial color={c} />
        </mesh>
      ))}
    </group>
  )
}

// ── 술통 더미 (양조장 앞) ─────────────────────────────
export function JmSakeBarrels() {
  const spots = [
    [-0.5, 0.35, 0],
    [0.5, 0.35, 0],
    [0, 1.02, 0],
  ]
  return (
    <group>
      {spots.map(([x, y, z], i) => (
        <group key={i} position={[x, y, z]}>
          <Cyl p={[0, 0, 0]} r1={0.34} h={0.66} c="#f2ede3" seg={16} />
          <Cyl p={[0, 0.2, 0]} r1={0.35} h={0.06} c="#1e3a5f" seg={16} />
          <Cyl p={[0, -0.2, 0]} r1={0.35} h={0.06} c="#1e3a5f" seg={16} />
        </group>
      ))}
    </group>
  )
}

// ── 데미즈야 (신사 손 씻는 곳) ──────────────────────────
export function JmChozuya({ item }) {
  const season = useSeason()
  const [w, h, d] = item.size
  return (
    <group>
      {[-1, 1].map((sx) =>
        [-1, 1].map((sz) => <Cyl key={`${sx}${sz}`} p={[(sx * (w - 0.2)) / 2, h / 2, (sz * (d - 0.2)) / 2]} r1={0.08} h={h} c="#a9543a" />),
      )}
      <Box p={[0, h + 0.1, 0]} s={[w + 0.6, 0.2, d + 0.6]} c={season === 'winter' ? SNOW : '#33373d'} />
      <Box p={[0, 0.4, 0]} s={[w * 0.6, 0.8, d * 0.5]} c="#9a958c" />
      <Box p={[0, 0.79, 0]} s={[w * 0.5, 0.02, d * 0.38]} c="#6fa8d6" />
      {range(3).map((i) => (
        <Cyl key={i} p={[-0.3 + i * 0.3, 0.88, d * 0.2]} r1={0.04} h={0.08} c={WOOD} />
      ))}
    </group>
  )
}

// ── 에마 걸이 (소원 나무판) ─────────────────────────────
export function JmEma({ item }) {
  const [w, h] = item.size
  return (
    <group>
      {[-1, 1].map((s) => (
        <Cyl key={s} p={[(s * w) / 2, h / 2, 0]} r1={0.05} h={h} c={WOOD} />
      ))}
      {[h * 0.55, h * 0.85].map((y) => (
        <group key={y}>
          <Box p={[0, y, 0]} s={[w, 0.05, 0.05]} c={DARK} />
          {range(Math.round(w / 0.3)).map((i) => (
            <Box key={i} p={[-w / 2 + 0.2 + i * 0.3, y - 0.14, 0.04]} s={[0.22, 0.16, 0.02]} c={i % 3 ? '#e0c088' : '#d4b070'} r={[0, 0, (i % 2 ? 1 : -1) * 0.1]} />
          ))}
        </group>
      ))}
    </group>
  )
}

// ── 자연스러운 호수 (불규칙한 물가 + 모래·풀 물가 + 돌 + 갈대) ──
// size [가로, 0.05, 세로] 안에 들어가는 둥근 호수. JSON에 "collider": false
export function JmLake({ item }) {
  const season = useSeason()
  const [w, , d] = item.size
  const shapes = useMemo(() => {
    const make = (sx, sz) => {
      const shape = new THREE.Shape()
      const pts = 40
      for (let i = 0; i <= pts; i++) {
        const a = (i / pts) * Math.PI * 2
        const wobble = 1 + 0.07 * Math.sin(a * 3) + 0.05 * Math.cos(a * 5)
        const x = Math.cos(a) * (w / 2) * sx * wobble
        const y = Math.sin(a) * (d / 2) * sz * wobble
        if (i === 0) shape.moveTo(x, y)
        else shape.lineTo(x, y)
      }
      return shape
    }
    // 11/25: 물은 hjSea와 똑같이 (jm_water.jsx) — 가장자리 식이 같은 고리 모양 물결 면
    const wobble = (a) => 1 + 0.07 * Math.sin(a * 3) + 0.05 * Math.cos(a * 5)
    const rings = Math.max(4, Math.ceil(Math.max(w, d) / 3))
    return { shore: make(0.98, 0.98), water: make(0.88, 0.84), surface: lakeGeometry(w, d, 0.88, 0.84, wobble, rings), deep: lakeGeometry(w, d, 0.88, 0.84, wobble, 1) }
  }, [w, d])
  const rocks = useMemo(() => range(14).map((i) => {
    const a = (i / 14) * Math.PI * 2 + 0.2
    return [Math.cos(a) * (w / 2) * 0.9, Math.sin(a) * (d / 2) * 0.87, 0.18 + (i % 3) * 0.08]
  }), [w, d])
  return (
    <group>
      <mesh position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <shapeGeometry args={[shapes.shore]} />
        <meshStandardMaterial color={season === 'winter' ? SNOW : '#cdbb8e'} />
      </mesh>
      {season === 'winter' ? (
        <mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]} material={ICE}>
          <shapeGeometry args={[shapes.water]} />
        </mesh>
      ) : (
        <SeaWater deep={shapes.deep} surface={shapes.surface} y={0.045} gap={0.04} />
      )}
      {rocks.map(([x, z, s], i) => (
        <mesh key={i} position={[x, s * 0.5, -z]}>
          <dodecahedronGeometry args={[s, 0]} />
          <meshStandardMaterial color="#8d8a84" flatShading />
        </mesh>
      ))}
      {season !== 'winter' &&
        range(18).map((i) => {
          const a = (i / 18) * Math.PI * 2
          return (
            <Cyl key={i} p={[Math.cos(a) * (w / 2) * 0.84, 0.45, -Math.sin(a) * (d / 2) * 0.8]} r1={0.02} h={0.9} c={season === 'autumn' ? '#b59a52' : '#6a8f3e'} seg={4} />
          )
        })}
    </group>
  )
}

// ── 나무 선착장 (걸어서 올라갈 수 있게 낮게) ─────────────────
export function JmPier({ item }) {
  const [w, h, d] = item.size
  const planks = Math.max(4, Math.round(d / 0.3))
  return (
    <group>
      {range(planks).map((i) => (
        <Box key={i} p={[0, h - 0.04, -d / 2 + (d * (i + 0.5)) / planks]} s={[w, 0.08, d / planks - 0.03]} c={i % 2 ? '#8b6b47' : '#7a5c3c'} />
      ))}
      {[-1, 1].map((sx) =>
        [-1, 0, 1].map((sz) => <Cyl key={`${sx}${sz}`} p={[(sx * (w - 0.1)) / 2, h / 2, (sz * (d - 0.2)) / 2]} r1={0.07} h={h + 0.3} c={DARK} />),
      )}
    </group>
  )
}

// ── 작은 나룻배 ───────────────────────────────────────
// 배 바닥(반구, 깊이 0.25)이 물(높이 0.04~0.05)보다 위에 오게 0.27에 띄움 (예전 0.12는 바닥이 물에 잠겨 보였음)
export function JmBoat() {
  return (
    <group position={[0, 0.27, 0]}>
      <mesh scale={[0.6, 0.25, 1.6]}>
        <sphereGeometry args={[1, 14, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2]} />
        <meshStandardMaterial color="#8b5a3c" side={THREE.DoubleSide} />
      </mesh>
      <Box p={[0, 0.02, 0]} s={[1, 0.05, 0.25]} c="#6b4a2f" />
    </group>
  )
}

// ── 먼 산 (호수 뒤 배경 언덕) ──────────────────────────────
// size [가로, 높이, 깊이]. JSON에 "collider": false
export function JmMound({ item }) {
  const season = useSeason()
  const [w, h, d] = item.size
  return (
    <mesh position={[0, 0, 0]} scale={[w / 2, h, d / 2]}>
      <sphereGeometry args={[1, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
      <meshStandardMaterial color={season === 'winter' ? '#e3e9ef' : season === 'autumn' ? '#9c7a3c' : '#5f8f4a'} flatShading />
    </mesh>
  )
}

// ── 타이어 그네 (비밀기지 옆) ────────────────────────────
export function JmTireSwing({ item }) {
  const [, h] = item.size
  return (
    <group>
      <Cyl p={[-1, h / 2, 0]} r1={0.08} h={h} c={WOOD} />
      <Cyl p={[1, h / 2, 0]} r1={0.08} h={h} c={WOOD} />
      <Cyl p={[0, h, 0]} r1={0.07} h={2.2} c={WOOD} rot={[0, 0, Math.PI / 2]} />
      <Cyl p={[0, h - 0.8, 0]} r1={0.015} h={1.6} c="#c2a878" />
      <mesh position={[0, h - 1.7, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.3, 0.1, 8, 18]} />
        <meshStandardMaterial color="#222" />
      </mesh>
    </group>
  )
}

// ── 강 · 산책로 (애니 구역 서쪽 빈터, K-POP 구역 북쪽) ──────────────
// item.ribbon = { points: [[x, z], ...], width } — 점은 구역 좌표, item.position은 [0, 0]
// 호수에서 흘러나온 강이 빈터를 지나 맵 서쪽 끝으로 빠져나감. 남쪽 기슭에 산책로, 북쪽 기슭에 벚꽃
// 땅을 팔 수 없어서(바닥이 평평한 충돌면) 물은 땅 높이에 깔고, 빠지지 않게 강둑을 따라 투명 벽(jmCollider)
// 가볍게: 강 = 물 1장 + 물결 1장 + 돌 둑 2장, 산책로 = 1장. 물결은 텍스처만 흘림
function ribbonGeometry(points, width, y, side = 0) {
  // side 0: 가운데 기준 폭 전체, side ±1: 가장자리 바깥쪽 띠(돌 둑)
  const pos = []
  const uv = []
  const idx = []
  let len = 0
  for (let i = 0; i < points.length; i++) {
    const a = points[Math.max(0, i - 1)]
    const b = points[Math.min(points.length - 1, i + 1)]
    const dx = b[0] - a[0]
    const dz = b[1] - a[1]
    const L = Math.hypot(dx, dz) || 1
    const nx = dz / L
    const nz = -dx / L
    if (i > 0) len += Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1])
    const [x, z] = points[i]
    let inner = -width / 2
    let outer = width / 2
    if (side) {
      inner = side * (width / 2)
      outer = side * (width / 2 + 0.7)
    }
    pos.push(x + nx * inner, y, z + nz * inner, x + nx * outer, y, z + nz * outer)
    uv.push(0, len / 4, 1, len / 4)
    if (i > 0) {
      const k = i * 2
      idx.push(k - 2, k, k - 1, k - 1, k, k + 1) // 앞면이 위를 보게 (뒷면이면 조명이 어둡게 계산됨)
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  g.setIndex(idx)
  g.computeVertexNormals()
  // 방향에 따라 뒷면이 위로 올 수 있어서 법선을 위로 고정
  const n = g.attributes.normal
  for (let i = 0; i < n.count; i++) n.setXYZ(i, 0, 1, 0)
  return g
}

let flowTexture = null
export function getFlowTexture() {
  if (flowTexture || typeof document === 'undefined') return flowTexture
  const c = document.createElement('canvas')
  c.width = 64
  c.height = 128
  const g = c.getContext('2d')
  g.strokeStyle = 'rgba(255,255,255,0.5)'
  g.lineCap = 'round'
  for (let i = 0; i < 9; i++) {
    const x = 6 + ((i * 23) % 52)
    const y = (i * 37) % 128
    g.lineWidth = 1.5
    g.beginPath()
    g.moveTo(x, y)
    g.lineTo(x + 2, y + 10 + (i % 3) * 6)
    g.stroke()
  }
  flowTexture = new THREE.CanvasTexture(c)
  flowTexture.wrapS = flowTexture.wrapT = THREE.RepeatWrapping
  return flowTexture
}

export function JmRiver({ item }) {
  const season = useSeason()
  const { points, width, bankFromX } = item.ribbon
  const geo = useMemo(() => {
    // 호수와 이어지는 어귀에서는 돌 둑을 그리지 않음 (bankFromX보다 서쪽부터 둑)
    const from = bankFromX === undefined ? 0 : Math.max(0, points.findIndex((q) => q[0] <= bankFromX))
    const bankPts = points.slice(from)
    return {
      // 11/25: 물은 hjSea와 똑같이 (jm_water.jsx) — 깊은 물 띠 + 잘게 나눈 반투명 물결 띠. 흐름 줄무늬는 뺌
      water: ribbonGeometry(points, width, 0),
      surface: ribbonGrid(points, width),
      bankL: ribbonGeometry(bankPts, width, 0.06, -1),
      bankR: ribbonGeometry(bankPts, width, 0.06, 1),
    }
  }, [points, width, bankFromX])
  const winter = season === 'winter'
  return (
    <group>
      {winter ? (
        <mesh geometry={geo.water} position={[0, 0.04, 0]} material={ICE} />
      ) : (
        <SeaWater deep={geo.water} surface={geo.surface} y={0.035} gap={0.03} far={120} />
      )}
      {[geo.bankL, geo.bankR].map((g, i) => (
        <mesh key={i} geometry={g}>
          <meshStandardMaterial color={winter ? SNOW : '#a29d93'} roughness={1} side={THREE.DoubleSide} />
        </mesh>
      ))}
    </group>
  )
}

export function JmPathRibbon({ item }) {
  const season = useSeason()
  const { points, width } = item.ribbon
  const geo = useMemo(() => ribbonGeometry(points, width, 0.03), [points, width])
  return (
    <mesh geometry={geo}>
      <meshStandardMaterial color={season === 'winter' ? '#e6e2da' : item.color ?? '#cdbb8e'} roughness={1} side={THREE.DoubleSide} />
    </mesh>
  )
}

export const JM_DETAIL_STYLES = {
  jmRiver: JmRiver,
  jmPathRibbon: JmPathRibbon,
  jmScarecrow: JmScarecrow,
  jmRiceRack: JmRiceRack,
  jmHokora: JmHokora,
  jmBambooFence: JmBambooFence,
  jmLaundryPole: JmLaundryPole,
  jmCourtLines: JmCourtLines,
  jmBall: JmBall,
  jmPlatform: JmPlatform,
  jmTeruTeru: JmTeruTeru,
  jmFlowerBed: JmFlowerBed,
  jmCatStatue: JmCatStatue,
  jmSakeBarrels: JmSakeBarrels,
  jmChozuya: JmChozuya,
  jmEma: JmEma,
  jmLake: JmLake,
  jmPier: JmPier,
  jmBoat: JmBoat,
  jmMound: JmMound,
  jmTireSwing: JmTireSwing,
}
