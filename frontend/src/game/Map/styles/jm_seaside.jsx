// 애니 구역 서쪽 바닷가 산책로 소품 — 담당: 지민 (11/27)
// 애니 ↔ K-pop 사이 빈 땅: 물가 나무 데크(terrain jm_sea_walk) 끝 바다 위 정자, 바닷가 소나무, 물가 바위
// 다른 jm 스타일과 같은 약속: size [w, h, d] 안에 그림, 앞면 +z, 바닥 y = 0 (JSON elevation으로 띄움)
import { useMemo } from 'react'
import * as THREE from 'three'
import { hipRoofGeometry } from './geometry.js'

const DECK_WOOD = '#8a6a48' // 산책로 데크(jm_sea_walk color)와 같은 색
const DARK_WOOD = '#4a3424'
const ROOF = '#3d3a36'
const range = (n) => Array.from({ length: n }, (_, i) => i)

// 0 ~ 1 사이 고정 난수 (id마다 모양이 조금씩 다르게)
function seeded(text) {
  let h = 2166136261
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619)
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507)
    h = Math.imul(h ^ (h >>> 13), 3266489909)
    return ((h ^= h >>> 16) >>> 0) / 4294967296
  }
}

// ── 바다 위 정자 (참고: 데크 끝 바다 쪽 전망 정자) ──────────────
// size [w, h, d]. 바닥 윗면 y 0.26 (데크 윗면과 같은 높이). item.open = 난간을 비우는 남쪽 가운데 폭(데크가 들어오는 쪽)
// 걷는 바닥·난간 막이는 JSON의 jmCollider가 맡고, 여기서는 그림만
function JmSeaPavilion({ item }) {
  const [w, h, d] = item.size
  const open = item.open ?? 3.6
  const top = 0.26
  const pillarH = h - 1.7
  const roofGeo = useMemo(() => hipRoofGeometry(w + 1.4, d + 1.4, 1.5, 0.35), [w, d])
  const parts = useMemo(() => {
    const posts = [] // 물속 받침 기둥
    for (const x of [-w / 2 + 0.3, 0, w / 2 - 0.3]) for (const z of [-d / 2 + 0.3, 0, d / 2 - 0.3]) posts.push([x, z])
    const rails = [] // [cx, cz, 길이, 가로(true)/세로]
    const balusters = []
    const edge = (cx, cz, len, alongX) => {
      rails.push([cx, cz, len, alongX])
      const n = Math.max(1, Math.round(len / 0.55))
      for (let i = 0; i <= n; i++) {
        const t = -len / 2 + (len * i) / n
        balusters.push(alongX ? [cx + t, cz] : [cx, cz + t])
      }
    }
    const ix = w / 2 - 0.08
    const iz = d / 2 - 0.08
    edge(0, -iz, w - 0.16, true) // 북쪽(바다)
    edge(-ix, 0, d - 0.16, false)
    edge(ix, 0, d - 0.16, false)
    const stub = (w - open) / 2 - 0.08
    if (stub > 0.2) {
      edge(-w / 2 + 0.08 + stub / 2, iz, stub, true)
      edge(w / 2 - 0.08 - stub / 2, iz, stub, true)
    }
    return { posts, rails, balusters }
  }, [w, d, open])
  const pillar = w / 2 - 0.35
  return (
    <group>
      {parts.posts.map(([x, z], i) => (
        <mesh key={`p${i}`} position={[x, -0.3, z]}>
          <boxGeometry args={[0.2, 0.9, 0.2]} />
          <meshStandardMaterial color={DARK_WOOD} roughness={0.9} />
        </mesh>
      ))}
      {/* 바닥판 (옆면이 물 위로 살짝 보이는 두께) */}
      <mesh position={[0, top - 0.14, 0]} receiveShadow>
        <boxGeometry args={[w, 0.28, d]} />
        <meshStandardMaterial color={DECK_WOOD} roughness={0.85} />
      </mesh>
      {range(Math.floor(w / 0.5)).map((i) => (
        <mesh key={`b${i}`} position={[-w / 2 + 0.25 + i * 0.5, top + 0.005, 0]}>
          <boxGeometry args={[0.02, 0.01, d - 0.05]} />
          <meshStandardMaterial color="#6e5236" roughness={1} />
        </mesh>
      ))}
      {/* 기둥 4개 + 위 들보 */}
      {[-1, 1].map((sx) =>
        [-1, 1].map((sz) => (
          <mesh key={`c${sx}${sz}`} position={[sx * pillar, top + pillarH / 2, sz * pillar]} castShadow>
            <boxGeometry args={[0.2, pillarH, 0.2]} />
            <meshStandardMaterial color={DARK_WOOD} roughness={0.8} />
          </mesh>
        )),
      )}
      {[-1, 1].map((s) => (
        <group key={`beam${s}`}>
          <mesh position={[0, top + pillarH, s * pillar]}>
            <boxGeometry args={[w - 0.4, 0.22, 0.2]} />
            <meshStandardMaterial color={DARK_WOOD} roughness={0.8} />
          </mesh>
          <mesh position={[s * pillar, top + pillarH, 0]}>
            <boxGeometry args={[0.2, 0.22, d - 0.4]} />
            <meshStandardMaterial color={DARK_WOOD} roughness={0.8} />
          </mesh>
        </group>
      ))}
      {/* 사모지붕 + 꼭대기 장식 */}
      <mesh geometry={roofGeo} position={[0, top + pillarH + 0.1, 0]} castShadow>
        <meshStandardMaterial color={ROOF} roughness={0.85} flatShading side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, top + pillarH + 1.7, 0]}>
        <cylinderGeometry args={[0.06, 0.14, 0.45, 8]} />
        <meshStandardMaterial color="#b08a3c" metalness={0.4} roughness={0.5} />
      </mesh>
      {/* 난간 */}
      {parts.rails.map(([cx, cz, len, alongX], i) => (
        <group key={`r${i}`}>
          {[0.95, 0.5].map((y) => (
            <mesh key={y} position={[cx, top + y, cz]}>
              <boxGeometry args={alongX ? [len, y > 0.9 ? 0.09 : 0.05, 0.09] : [0.09, y > 0.9 ? 0.09 : 0.05, len]} />
              <meshStandardMaterial color={DECK_WOOD} roughness={0.85} />
            </mesh>
          ))}
        </group>
      ))}
      {parts.balusters.map(([x, z], i) => (
        <mesh key={`s${i}`} position={[x, top + 0.48, z]}>
          <boxGeometry args={[0.06, 0.95, 0.06]} />
          <meshStandardMaterial color={DECK_WOOD} roughness={0.85} />
        </mesh>
      ))}
      {/* 입구(남쪽) 들보에 매단 종이 등 — 가운데에 달면 벤치에 앉았을 때 바다를 가려서 앉은 사람 뒤쪽으로 */}
      <mesh position={[0, top + pillarH - 0.2, pillar]}>
        <cylinderGeometry args={[0.005, 0.005, 0.2, 4]} />
        <meshStandardMaterial color="#222" />
      </mesh>
      <mesh position={[0, top + pillarH - 0.5, pillar]} userData={{ noMerge: true }}>
        <cylinderGeometry args={[0.2, 0.2, 0.5, 12]} />
        <meshStandardMaterial color="#f7e3b5" emissive="#ffb85c" emissiveIntensity={0.55} roughness={0.9} />
      </mesh>
    </group>
  )
}

// ── 바닷가 소나무 (참고: 바닷가 흑송 — 굽은 줄기 + 납작한 구름 모양 잎 덩어리) ──
// size [w, h, d]. 잎 덩어리는 id마다 기울기·층이 조금씩 다름
const PINE_BARK = '#5a4030'
const PINE_GREENS = ['#2f5634', '#3a6640', '#284b2e']
function JmPine({ item }) {
  const [w, h] = item.size
  const shape = useMemo(() => {
    const rnd = seeded(item.id ?? 'pine')
    const lean = (rnd() - 0.5) * 0.5 // 줄기 기울기(라디안)
    const dir = rnd() * Math.PI * 2
    const lowH = h * 0.42
    const bend = [Math.cos(dir) * Math.sin(lean) * lowH, Math.sin(dir) * Math.sin(lean) * lowH]
    const pads = []
    const layers = 3 + Math.floor(rnd() * 2)
    for (let i = 0; i < layers; i++) {
      const t = i / (layers - 1)
      const a = dir + (rnd() - 0.5) * 2.2 + (i % 2 ? Math.PI * 0.6 : 0)
      const r = (1 - t) * w * 0.28 + rnd() * 0.3
      pads.push({
        p: [bend[0] * 1.6 + Math.cos(a) * r, lowH + (h - lowH - 0.4) * t + 0.2, bend[1] * 1.6 + Math.sin(a) * r],
        s: [(w * 0.42 - t * w * 0.14) * (0.85 + rnd() * 0.3), 0.42 + rnd() * 0.12, (w * 0.34 - t * w * 0.1) * (0.85 + rnd() * 0.3)],
        c: PINE_GREENS[i % PINE_GREENS.length],
      })
    }
    return { bend, lowH, pads }
  }, [item.id, w, h])
  const { bend, lowH, pads } = shape
  const upper = new THREE.Vector3(bend[0] * 0.6, h - lowH - 0.6, bend[1] * 0.6)
  const upperLen = upper.length()
  const upperQuat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), upper.clone().normalize())
  const lower = new THREE.Vector3(bend[0], lowH, bend[1])
  const lowerQuat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), lower.clone().normalize())
  return (
    <group>
      <mesh position={[bend[0] / 2, lowH / 2, bend[1] / 2]} quaternion={lowerQuat} castShadow>
        <cylinderGeometry args={[0.16, 0.24, lower.length(), 7]} />
        <meshStandardMaterial color={PINE_BARK} roughness={1} flatShading />
      </mesh>
      <mesh position={[bend[0] + upper.x / 2, lowH + upper.y / 2, bend[1] + upper.z / 2]} quaternion={upperQuat} castShadow>
        <cylinderGeometry args={[0.1, 0.16, upperLen, 6]} />
        <meshStandardMaterial color={PINE_BARK} roughness={1} flatShading />
      </mesh>
      {pads.map((pad, i) => (
        <mesh key={i} position={pad.p} scale={pad.s} castShadow>
          <icosahedronGeometry args={[1, 1]} />
          <meshStandardMaterial color={pad.c} roughness={1} flatShading />
        </mesh>
      ))}
    </group>
  )
}

// ── 물가 바위 무리 (참고: 데크 옆 갯바위) ─────────────────────
// item.rocks = [[x, z, 반지름, 높이 비율], ...] (item.position 기준). 반쯤 물에 잠긴 납작한 돌
const ROCK_COLORS = ['#8d877c', '#76716a', '#9a948a']
function JmShoreRocks({ item }) {
  const rocks = useMemo(() => {
    const rnd = seeded(item.id ?? 'rocks')
    return (item.rocks ?? []).map(([x, z, r, k = 0.6], i) => ({
      p: [x, r * k * 0.35, z],
      s: [r * (0.9 + rnd() * 0.3), r * k, r * (0.8 + rnd() * 0.3)],
      rot: [rnd() * 0.4, rnd() * Math.PI, rnd() * 0.4],
      c: ROCK_COLORS[i % ROCK_COLORS.length],
    }))
  }, [item.id, item.rocks])
  return (
    <group>
      {rocks.map((rock, i) => (
        <mesh key={i} position={rock.p} scale={rock.s} rotation={rock.rot} castShadow receiveShadow>
          <dodecahedronGeometry args={[1, 0]} />
          <meshStandardMaterial color={rock.c} roughness={1} flatShading />
        </mesh>
      ))}
    </group>
  )
}

export const JM_SEASIDE_STYLES = {
  jmSeaPavilion: JmSeaPavilion,
  jmPine: JmPine,
  jmShoreRocks: JmShoreRocks,
}
