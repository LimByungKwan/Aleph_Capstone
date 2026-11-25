import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { hipRoofGeometry } from './geometry.js'
import { Ball, Box, Cyl, GEO, Instances, mat, seeded, texMat } from './kit.jsx'
import { getJpSignTexture, GlowMaterial } from './jm_landmarks.jsx'
import { getTiledTexture } from './textures.js'

// 같은 입력이면 같은 0~1 난수 (kit의 seeded는 난수 '함수'를 돌려줌 → 숫자로 한 번 뽑음)
const srand = (n) => seeded(Math.round(n * 9973) + 7)()


// 애니 구역(JM) 명장면 ②③④⑥ (11/25 밤 지민이 다시 고름: 낡은 일본 요괴 마을에 어울리는 옛 일본·신령·숲 장면) — 담당: 지민
// ② 「너의 이름은.」 모티브: 산 위 분화구 속 거대한 나무 뿌리 밑 바위 사당 (금줄·종이 장식), 이끼 돌계단
// ③ 「귀멸의 칼날」 모티브: 보라 등나무 꽃이 지붕처럼 드리운 밤 숲길, 돌등, 떨어진 꽃잎
// ④ 「원령공주」 모티브: 이끼 낀 거대한 고목 숲, 안개 낀 연못 가운데 작은 섬 (정령·캐릭터는 넣지 않음)
// ⑥ 「나츠메 우인장」 모티브: 매미 우는 여름 숲 돌계단 위 작은 붉은 도리이와 사당, 작은 과자 노점
// 영화 속 고유 이름·캐릭터는 쓰지 않음. 로컬 +z = 골목(입구) 쪽. 걷는 판정은 생성 스크립트(gen-jm-kyoto.mjs)
// 담 없이 놓는 장면이라 네모난 바닥판 대신 가장자리가 부드러운 둥근 바닥(ScenePad)을 깜

const range = (n) => Array.from({ length: n }, (_, i) => i)
const rnd = (i) => srand(i * 7.13 + 3.1)

// 둥근 바닥: 타원형 얇은 판
export function ScenePad({ w, d, color = '#8a8a72', inset = 1.5 }) {
  return (
    <mesh position={[0, 0.015, 0]} scale={[(w - inset) / 2, 1, (d - inset) / 2]}>
      <cylinderGeometry args={[1, 1, 0.03, 40]} />
      <meshStandardMaterial color={color} roughness={1} polygonOffset polygonOffsetFactor={-1} />
    </mesh>
  )
}

const BARK = mat('#4a3626', { roughness: 1 })
const BARK_OLD = mat('#5a5040', { roughness: 1, flat: true })
const LEAF = mat('#3f6e34', { roughness: 1, flat: true })
const LEAF_DEEP = mat('#2f5a2c', { roughness: 1, flat: true })
const LEAF_SUMMER = mat('#4f8a3a', { roughness: 1, flat: true })
const MOSS = mat('#5f8a3e', { roughness: 1, flat: true })
const ROCK = mat('#7d7a70', { roughness: 1, flat: true })
const ROCK_MOSS = mat('#6a7a52', { roughness: 1, flat: true })
const ROPE = mat('#d9c48a', { roughness: 0.9 })
const PAPER = mat('#f7f3ea', { roughness: 0.8, double: true })
const LANTERN_GLOW = mat('#fff1c8', { emissive: '#ffcf7a', emissiveIntensity: 1.2 })
const SHRINE_WOOD = mat('#8a6a48', { roughness: 0.9 })
const SHRINE_RED = mat('#c0392b', { roughness: 0.6 })

// 큰 나무 (줄기 + 덩어리 잎)
function Tree({ p, h = 8, r = 0.35, leaf = LEAF, crown = 2.6, s = 0 }) {
  const blobs = useMemo(() => range(5).map((i) => [(rnd(s + i) - 0.5) * crown, h * (0.78 + rnd(s + i + 9) * 0.22), (rnd(s + i + 17) - 0.5) * crown, crown * (0.55 + rnd(s + i + 31) * 0.35)]), [h, crown, s])
  return (
    <group position={p}>
      <Cyl p={[0, h * 0.42, 0]} rad={r} h={h * 0.84} m={BARK} />
      {blobs.map(([x, y, z, rr], i) => (
        <mesh key={i} geometry={GEO.ico} material={i % 2 ? leaf : LEAF_DEEP} position={[x, y, z]} scale={rr} />
      ))}
    </group>
  )
}
function StoneLantern({ p, glow = true }) {
  return (
    <group position={p}>
      <Box p={[0, 0.15, 0]} s={[0.7, 0.3, 0.7]} m={ROCK} />
      <Cyl p={[0, 0.7, 0]} rad={0.14} h={0.8} m={ROCK} />
      <Box p={[0, 1.25, 0]} s={[0.55, 0.45, 0.55]} m={glow ? LANTERN_GLOW : ROCK} />
      <mesh position={[0, 1.65, 0]} material={ROCK}>
        <coneGeometry args={[0.5, 0.4, 4]} />
      </mesh>
    </group>
  )
}
function Boulder({ p, s = 1, moss = false, seed = 0 }) {
  return <mesh geometry={GEO.rock} material={moss ? ROCK_MOSS : ROCK} position={p} scale={[s * (0.9 + rnd(seed) * 0.4), s * (0.6 + rnd(seed + 3) * 0.3), s * (0.9 + rnd(seed + 5) * 0.4)]} rotation={[0, rnd(seed + 7) * 6, 0]} />
}

// ── ② 산 위 신체 사당 ─────────────────────────
// stair: { z0, z1, h, w, top }. 계단 디딤판은 생성 스크립트의 계단 겉모습(C 이끼 정원)
export function ShintaiShrine({ w, d, stair }) {
  const { z0, z1, h, w: sw, top } = stair
  const len = z0 - z1
  const yAt = (z) => (z >= z0 ? 0 : z <= z1 ? h : (h * (z0 - z)) / len)
  const tz = z1 - top / 2 // 위 마당 가운데
  const cliffs = useMemo(() => {
    const out = []
    for (let i = 0; i < 18; i++) {
      const side = i % 2 ? 1 : -1
      const z = z0 + 1 - (i >> 1) * 1.9
      out.push({ p: [side * (sw / 2 + 1.4 + rnd(i) * 1.2), yAt(z) * 0.6, z], s: 1.4 + rnd(i + 40) * 1.1, seed: i })
    }
    return out
  }, [z0, sw])
  const shide = range(8)
  return (
    <group>
      <ScenePad w={w} d={d} color="#6f7f58" />
      {/* 계단 양옆 바위 벼랑 (산을 오르는 느낌) + 삼나무 */}
      {cliffs.map((c, i) => (
        <Boulder key={i} p={c.p} s={c.s} moss={i % 3 === 0} seed={c.seed} />
      ))}
      {[[-1, 2], [1, -1], [-1, -4], [1, 3.5]].map(([s, z], i) => (
        <Tree key={i} p={[s * (sw / 2 + 4.2), yAt(z) * 0.5, z]} h={11} r={0.4} crown={2.2} leaf={LEAF_DEEP} s={i * 11} />
      ))}
      {/* 위 마당: 분화구 테두리처럼 둘러선 이끼 바위 */}
      <group position={[0, h, tz]}>
        <ScenePad w={12} d={top} color="#6a8a4a" inset={0.4} />
        {range(14).map((i) => {
          const a = (i / 14) * Math.PI * 2
          if (Math.sin(a) > 0.7) return null // 계단 쪽은 비움
          return <Boulder key={i} p={[Math.cos(a) * 5.4, 0.3, Math.sin(a) * 2.6]} s={0.8 + rnd(i + 60) * 0.5} moss seed={i + 60} />
        })}
        {/* 거대한 나무 + 뿌리 밑 바위 사당 */}
        <group position={[0, 0, -0.5]}>
          <mesh geometry={GEO.rock} material={ROCK_MOSS} position={[0, 0.9, -0.3]} scale={[2.0, 1.4, 1.8]} />
          <Cyl p={[0, 4.5, -0.6]} rad={1.3} h={7} m={BARK_OLD} />
          {range(6).map((i) => {
            const a = (i / 6) * Math.PI * 2
            return <Cyl key={i} p={[Math.cos(a) * 1.4, 0.6, -0.6 + Math.sin(a) * 1.2]} rad={0.3} h={1.6} m={BARK_OLD} r={[Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5]} />
          })}
          {range(7).map((i) => (
            <mesh key={i} geometry={GEO.ico} material={i % 2 ? LEAF : LEAF_DEEP} position={[(rnd(i + 80) - 0.5) * 6, 8 + rnd(i + 90) * 2.5, -0.6 + (rnd(i + 99) - 0.5) * 5]} scale={2.4 + rnd(i + 70) * 1.2} />
          ))}
          {/* 금줄(시메나와) + 종이 장식(시데) */}
          <mesh position={[0, 3.2, -0.6]} rotation={[Math.PI / 2, 0, 0]} material={ROPE}>
            <torusGeometry args={[1.42, 0.12, 8, 28]} />
          </mesh>
          {shide.map((i) => {
            const a = (i / shide.length) * Math.PI * 2
            return <Box key={i} p={[Math.cos(a) * 1.48, 2.85, -0.6 + Math.sin(a) * 1.48]} s={[0.14, 0.5, 0.02]} r={[0, -a, 0]} m={PAPER} />
          })}
          {/* 작은 바위 사당 (뿌리 앞) */}
          <group position={[0, 0, 1.4]}>
            <Box p={[0, 0.25, 0]} s={[1.2, 0.5, 0.9]} m={ROCK} />
            <Box p={[0, 0.85, 0]} s={[0.8, 0.7, 0.6]} m={SHRINE_WOOD} />
            <mesh position={[0, 1.35, 0]} geometry={hipRoofGeometry(1.2, 1.0, 0.4, 0.05)}>
              <meshStandardMaterial color="#5e615f" flatShading side={THREE.DoubleSide} />
            </mesh>
            <Box p={[0, 0.85, 0.31]} s={[0.4, 0.4, 0.02]} c="#1a1210" />
            <Box p={[0, 1.15, 0.45]} s={[1.0, 0.06, 0.06]} m={ROPE} />
          </group>
        </group>
        {[-1, 1].map((s) => (
          <StoneLantern key={s} p={[s * 2.6, 0, 1.6]} />
        ))}
      </group>
    </group>
  )
}

// ── ③ 등나무 꽃 숲길 ─────────────────────────
const WISTERIA = [mat('#b48ad6', { emissive: '#6a3a9a', emissiveIntensity: 0.25 }), mat('#9a6ccc', { emissive: '#5a2a8a', emissiveIntensity: 0.25 }), mat('#d4b2ec', { emissive: '#7a4aaa', emissiveIntensity: 0.25 })]
export function WisteriaPath({ w, d }) {
  const trunks = useMemo(() => {
    const out = []
    for (const side of [-1, 1]) for (let k = 0; k < 5; k++) out.push([side * 3.4, 9 - k * 4.4])
    return out
  }, [])
  // 늘어진 꽃송이: 길 위로 맞닿는 덩굴 지붕 아래 매달린 원뿔 (색 3가지)
  const clusters = useMemo(() => [0, 1, 2].map((c) => range(110).map((i) => {
    const z = 11 - rnd(i * 3 + c) * 22
    const x = (rnd(i * 5 + c * 13) - 0.5) * 10
    const len = 0.7 + rnd(i * 7 + c) * 0.9
    const y = 4.3 - Math.abs(x) * 0.08 - len / 2
    return { p: [x, y, z], s: [0.18, len, 0.18] }
  })), [])
  const petals = useMemo(() => range(140).map((i) => ({ p: [(rnd(i + 300) - 0.5) * 9, 0.03, 11 - rnd(i + 400) * 22], s: [0.08, 0.01, 0.06] })), [])
  const flies = useRef(null)
  const flySeeds = useMemo(() => range(24).map((i) => ({ x: (rnd(i + 500) - 0.5) * 10, z: 10 - rnd(i + 600) * 20, y: 0.8 + rnd(i + 700) * 2, p: rnd(i + 800) * 6.28 })), [])
  useFrame(({ clock }) => {
    const m = flies.current
    if (!m) return
    const t = clock.elapsedTime
    const o = new THREE.Object3D()
    flySeeds.forEach((f, i) => {
      o.position.set(f.x + Math.sin(t * 0.6 + f.p) * 0.6, f.y + Math.sin(t * 1.3 + f.p) * 0.3, f.z + Math.cos(t * 0.5 + f.p) * 0.6)
      o.scale.setScalar(0.04 + 0.03 * Math.max(0, Math.sin(t * 2 + f.p)))
      o.updateMatrix()
      m.setMatrixAt(i, o.matrix)
    })
    m.instanceMatrix.needsUpdate = true
  })
  const gravel = useMemo(() => getTiledTexture('gardenPath', 1.5, d / 2.4), [d])
  return (
    <group>
      <ScenePad w={w} d={d} color="#4f5a3e" />
      <mesh position={[0, 0.035, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[3.2, d - 2]} />
        <primitive object={texMat(gravel)} attach="material" />
      </mesh>
      {/* 등나무 줄기(구불) + 길 위로 맞닿는 덩굴 시렁 */}
      {trunks.map(([x, z], i) => (
        <group key={i} position={[x, 0, z]}>
          <Cyl p={[0, 1.8, 0]} rad={0.28} h={3.6} m={BARK} r={[0, 0, (x > 0 ? -1 : 1) * 0.12]} />
          <Cyl p={[-Math.sign(x) * 1.2, 3.9, 0]} rad={0.16} h={3.0} m={BARK} r={[0, 0, Math.PI / 2]} />
          <mesh geometry={GEO.ico} material={LEAF} position={[-Math.sign(x) * 0.8, 4.4, 0]} scale={[2.4, 0.7, 2.2]} />
        </group>
      ))}
      {clusters.map((items, c) => (
        <Instances key={c} geometry={GEO.cone} material={WISTERIA[c]} items={items.map((it) => ({ ...it, r: [Math.PI, 0, 0] }))} />
      ))}
      <Instances geometry={GEO.box} material={WISTERIA[2]} items={petals} />
      {/* 돌등 줄 (길 양옆) */}
      {[-1, 1].map((s) => [6.8, 0.2, -6.4].map((z) => <StoneLantern key={`${s}${z}`} p={[s * 2.2, 0, z]} />))}
      <instancedMesh ref={flies} args={[null, mat('#e8ff9a', { emissive: '#c8ff5a', emissiveIntensity: 2 }), flySeeds.length]} frustumCulled={false}>
        <sphereGeometry args={[1, 6, 4]} />
      </instancedMesh>
      {/* 길 끝 작은 돌 표석 */}
      <group position={[0, 0, -10.5]}>
        <Box p={[0, 0.9, 0]} s={[0.7, 1.8, 0.35]} m={ROCK} />
      </group>
    </group>
  )
}

// ── ④ 이끼 숲과 신령의 연못 ─────────────────────
const POND = new THREE.MeshStandardMaterial({ color: '#3d6f6a', roughness: 0.15, metalness: 0.2, transparent: true, opacity: 0.9 })
const MIST = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.08, depthWrite: false, side: THREE.DoubleSide })
const SHAFT = new THREE.MeshBasicMaterial({ color: '#fff6d8', transparent: true, opacity: 0.07, depthWrite: false, side: THREE.DoubleSide })
export function MossForest({ w, d, pond }) {
  const giants = [[-9, -6], [10.5, 5], [-11, 6]]
  const ferns = useMemo(() => range(70).map((i) => {
    const x = (rnd(i + 900) - 0.5) * (w - 3)
    const z = (rnd(i + 950) - 0.5) * (d - 3)
    if (Math.hypot((x - pond.x) / pond.rx, (z - pond.z) / pond.rz) < 1.15) return null
    return { p: [x, 0.25, z], s: [0.45, 0.3, 0.45], r: [0, rnd(i) * 6, 0] }
  }).filter(Boolean), [w, d, pond])
  const ripple = useRef(null)
  useFrame(({ clock }) => {
    if (ripple.current) ripple.current.position.y = 0.12 + Math.sin(clock.elapsedTime * 0.8) * 0.01
  })
  return (
    <group>
      <ScenePad w={w} d={d} color="#4f7a34" />
      {/* 거대한 고목 3그루 (뿌리가 퍼진 이끼 낀 줄기) */}
      {giants.map(([x, z], i) => (
        <group key={i} position={[x, 0, z]}>
          <Cyl p={[0, 6, 0]} rad={1.15} h={12} m={BARK_OLD} />
          {range(5).map((k) => {
            const a = (k / 5) * Math.PI * 2 + i
            return <Cyl key={k} p={[Math.cos(a) * 1.3, 0.5, Math.sin(a) * 1.3]} rad={0.32} h={1.4} m={MOSS} r={[Math.sin(a) * 0.6, 0, -Math.cos(a) * 0.6]} />
          })}
          <Cyl p={[0, 1.2, 0]} rad={1.2} h={1.6} m={MOSS} />
          {range(6).map((k) => (
            <mesh key={k} geometry={GEO.ico} material={k % 2 ? LEAF_DEEP : LEAF} position={[(rnd(i * 10 + k) - 0.5) * 7, 11 + rnd(i * 10 + k + 5) * 3, (rnd(i * 10 + k + 9) - 0.5) * 7]} scale={2.8 + rnd(k + i) * 1.3} />
          ))}
        </group>
      ))}
      {/* 이끼 바위 + 고사리 */}
      {range(10).map((i) => (
        <Boulder key={i} p={[(rnd(i + 120) - 0.5) * (w - 4), 0.25, (rnd(i + 140) - 0.5) * (d - 4)]} s={0.6 + rnd(i + 160) * 0.8} moss seed={i + 120} />
      ))}
      <Instances geometry={GEO.cone} material={mat('#5f9a3a', { flat: true })} items={ferns} />
      {/* 연못: 이끼 둑 + 물 + 가운데 작은 섬과 마른 나무 */}
      <group position={[pond.x, 0, pond.z]}>
        <mesh position={[0, 0.06, 0]} scale={[pond.rx + 0.6, 1, pond.rz + 0.6]} material={MOSS}>
          <cylinderGeometry args={[1, 1, 0.12, 36]} />
        </mesh>
        <mesh ref={ripple} position={[0, 0.12, 0]} scale={[pond.rx, 1, pond.rz]} material={POND}>
          <cylinderGeometry args={[1, 1, 0.02, 36]} />
        </mesh>
        <mesh position={[1, 0.25, -0.5]} scale={[1.4, 0.4, 1.1]} material={MOSS}>
          <sphereGeometry args={[1, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
        </mesh>
        <Cyl p={[1, 1.6, -0.5]} rad={0.15} h={2.6} m={BARK_OLD} r={[0, 0, 0.15]} />
        <Cyl p={[1.5, 2.6, -0.5]} rad={0.07} h={1.2} m={BARK_OLD} r={[0, 0, -0.8]} />
        {range(3).map((i) => (
          <mesh key={i} position={[0, 0.4 + i * 0.4, 0]} rotation={[-Math.PI / 2, 0, i]} material={MIST}>
            <circleGeometry args={[pond.rx * (1.1 + i * 0.15), 24]} />
          </mesh>
        ))}
      </group>
      {/* 숲 사이 빛줄기 */}
      {[[-3, 2], [6, -4], [-6, -2]].map(([x, z], i) => (
        <mesh key={i} position={[x, 6, z]} rotation={[0.25, i, 0.15]} material={SHAFT}>
          <cylinderGeometry args={[0.6, 2.2, 12, 10, 1, true]} />
        </mesh>
      ))}
    </group>
  )
}

// ── ⑥ 여름 숲 속 작은 신사 ─────────────────────
// stair: { z0, z1, h, w, top }. 계단 디딤판은 생성 스크립트 겉모습(C)
export function NatsumeShrine({ w, d, stair }) {
  const { z0, z1, h, w: sw, top } = stair
  const len = z0 - z1
  const yAt = (z) => (z >= z0 ? 0 : z <= z1 ? h : (h * (z0 - z)) / len)
  const tz = z1 - top / 2
  return (
    <group>
      <ScenePad w={w} d={d} color="#5a7f3a" />
      {/* 계단 양옆 우거진 여름 나무 (판정 = 줄기) */}
      {[-1, 1].map((s) => [0, 1, 2].map((k) => {
        const z = z0 - 2 - k * 4.6
        return <Tree key={`${s}${k}`} p={[s * (sw / 2 + 2.4), yAt(z) * 0.8, z]} h={9 + k} r={0.32} crown={3} leaf={LEAF_SUMMER} s={k * 7 + (s > 0 ? 3 : 0)} />
      }))}
      {[-1, 1].map((s) => (
        <Boulder key={s} p={[s * (sw / 2 + 0.6), 0.2, z0 - 0.5]} s={0.6} moss seed={s + 10} />
      ))}
      {/* 위 마당: 작은 붉은 도리이 → 사당 (방울 줄, 새전함) + 옆 과자 노점 */}
      <group position={[0, h, 0]}>
        <ScenePad w={11} d={top} color="#6a8a4a" inset={0.4} />
        <group position={[0, 0, -4.2]}>
          {[-1, 1].map((s) => (
            <Cyl key={s} p={[s * 1.3, 1.5, 0]} rad={0.13} h={3} m={SHRINE_RED} />
          ))}
          <Box p={[0, 3.0, 0]} s={[3.6, 0.18, 0.24]} m={SHRINE_RED} />
          <Box p={[0, 2.55, 0]} s={[3.0, 0.12, 0.14]} m={SHRINE_RED} />
          <Box p={[0, 3.14, 0]} s={[3.9, 0.08, 0.3]} c="#2a1a12" />
        </group>
        <group position={[0, 0, tz + 0.5 - 0]}>
          <Box p={[0, 0.25, -5.6 + 5.6]} s={[2.4, 0.5, 2]} m={ROCK} />
        </group>
        <group position={[0, 0, -10.6]}>
          <Box p={[0, 0.3, 0]} s={[2.2, 0.6, 1.8]} m={ROCK} />
          <Box p={[0, 1.15, 0]} s={[1.6, 1.1, 1.3]} m={SHRINE_WOOD} />
          <mesh position={[0, 1.7, 0]} geometry={hipRoofGeometry(2.4, 2.0, 0.7, 0.08)}>
            <meshStandardMaterial color="#5e615f" flatShading side={THREE.DoubleSide} />
          </mesh>
          <Cyl p={[0, 1.6, 0.85]} rad={0.015} h={1.0} c="#c0392b" />
          <Ball p={[0, 2.05, 0.85]} rad={0.12} c="#d4a83e" />
          <Box p={[0, 0.85, 1.1]} s={[0.9, 0.5, 0.45]} c="#5a3d2a" />
          {range(5).map((i) => (
            <Box key={i} p={[-0.36 + i * 0.18, 1.11, 1.1]} s={[0.04, 0.02, 0.4]} c="#2a1a12" />
          ))}
        </group>
        {[-1, 1].map((s) => (
          <StoneLantern key={s} p={[s * 2.4, 0, -7.4]} glow={false} />
        ))}
        {/* 과자 노점 (쿠폰 가게 자리) */}
        <group position={[3.5, 0, -9]} rotation={[0, -0.6, 0]}>
          <Box p={[0, 0.5, 0]} s={[1.8, 1.0, 0.8]} c="#7a5634" />
          {[-0.8, 0.8].map((x) => (
            <Cyl key={x} p={[x, 1.3, -0.3]} rad={0.05} h={2.6} c="#5a3d2a" />
          ))}
          <Box p={[0, 2.6, -0.1]} s={[2.0, 0.08, 1.2]} c="#c0392b" />
          <mesh position={[0, 2.1, 0.32]}>
            <planeGeometry args={[1.6, 0.7]} />
            <GlowMaterial glow={0.4} map={getJpSignTexture('妖の菓子屋', '#f2ead8', '#2a1a10', 1.6 / 0.7)} side={THREE.DoubleSide} />
          </mesh>
          {range(5).map((i) => (
            <mesh key={i} position={[-0.6 + i * 0.3, 1.08, 0.1]} scale={[0.12, 0.08, 0.12]}>
              <sphereGeometry args={[1, 8, 6]} />
              <meshStandardMaterial color={i % 2 ? '#f2ead8' : '#c88a5a'} />
            </mesh>
          ))}
        </group>
      </group>
    </group>
  )
}

// 동쪽 단 → ④ 숲으로 내려가는 비탈 돌길 그림 (생성 스크립트의 jm_crossing_slope와 같은 자리, 소품 기준 = 비탈 아래 끝)
export function JmSlopeRoad({ item }) {
  const [w, h, len] = item.size
  const tilt = Math.atan2(h, len)
  const tex = useMemo(() => getTiledTexture('stone', w / 2, Math.hypot(len, h) / 2), [w, len, h])
  return (
    <group>
      <mesh position={[0, h / 2 + 0.05, -len / 2]} rotation={[-Math.PI / 2 + tilt, 0, 0]}>
        <planeGeometry args={[w, Math.hypot(len, h)]} />
        <primitive object={texMat(tex)} attach="material" />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * (w / 2 + 0.15), h / 2 + 0.4, -len / 2]} rotation={[tilt, 0, 0]}>
          <boxGeometry args={[0.3, 0.8, Math.hypot(len, h)]} />
          <meshStandardMaterial color="#9d978c" roughness={1} />
        </mesh>
      ))}
      {range(3).map((i) => (
        <group key={i} position={[(i % 2 ? 1 : -1) * (w / 2 + 0.6), (h * (i + 0.5)) / 3, -((i + 0.5) * len) / 3]}>
          <Cyl p={[0, 1.6, 0]} rad={0.05} h={3.2} c="#2a2622" />
          <Ball p={[0, 3.25, 0]} rad={0.18} c="#fff2c8" />
        </group>
      ))}
    </group>
  )
}


// ── 바닥 풀 (11/25 밤 지민 요청: 풀이 많은 장면은 바닥에 풀이 좀 있게) ──
// item.size [w, _, d] = 이 조각 크기(14m 이하로 잘라 거리 숨기기가 되게), item.grass = { origin: [조각 가운데 x, z](장면 로컬), avoid: [...], density }
//   avoid: { strip: 반폭 } (가운데 길·계단 비움) | { ellipse: [x, z, rx, rz] } (연못 비움) — 장면 로컬 좌표
const GRASS_COLORS = ['#5f8f3e', '#6f9e48', '#4f7a34']
export function JmGrassTufts({ item }) {
  const [w, , d] = item.size
  const g = item.grass ?? {}
  const [ox, oz] = g.origin ?? [0, 0]
  const groups = useMemo(() => {
    const count = Math.min(220, Math.round(w * d * (g.density ?? 1.2)))
    const out = GRASS_COLORS.map(() => [])
    let seed = Math.round((ox * 31 + oz * 17 + w * 7) * 10)
    const r = () => srand(seed++ * 0.37)
    for (let i = 0; i < count; i++) {
      const x = (r() - 0.5) * w
      const z = (r() - 0.5) * d
      const sx = x + ox
      const sz = z + oz
      if ((g.avoid ?? []).some((a) => (a.strip ? Math.abs(sx) < a.strip : Math.hypot((sx - a.ellipse[0]) / a.ellipse[2], (sz - a.ellipse[1]) / a.ellipse[3]) < 1.05))) continue
      const h = 0.25 + r() * 0.35
      for (let k = 0; k < 3; k++) {
        out[Math.floor(r() * GRASS_COLORS.length)].push({ p: [x + (r() - 0.5) * 0.2, h / 2, z + (r() - 0.5) * 0.2], s: [0.045, h, 0.045], r: [(r() - 0.5) * 0.7, 0, (r() - 0.5) * 0.7] })
      }
    }
    return out
  }, [w, d, ox, oz, g.density, g.avoid])
  // 이끼 조각 (돌바닥 위 드문드문 얇은 원판, 2색)
  const moss = useMemo(() => {
    const n = Math.round(w * d * (g.moss ?? 0))
    const out = [[], []]
    let seed = Math.round((ox * 13 + oz * 29 + d * 3) * 10) + 777
    const r = () => srand(seed++ * 0.41)
    for (let i = 0; i < n; i++) {
      const x = (r() - 0.5) * w
      const z = (r() - 0.5) * d
      const sx = 0.4 + r() * 1.3
      out[r() < 0.6 ? 0 : 1].push({ p: [x, 0.01 + (i % 4) * 0.002, z], s: [sx * 0.6, 0.02, sx * 0.6 * (0.5 + r() * 0.6)], r: [0, r() * 6, 0] })
    }
    return out
  }, [w, d, ox, oz, g.moss])
  return (
    <group>
      {groups.map((items, i) => (
        <Instances key={i} geometry={GEO.cone} material={mat(GRASS_COLORS[i], { flat: true, roughness: 1 })} items={items} />
      ))}
      {moss.map((items, i) => (
        <Instances key={`m${i}`} geometry={GEO.cyl8} material={mat(i ? '#3f4f2c' : '#4f5f34', { roughness: 1 })} items={items} />
      ))}
    </group>
  )
}

// ── (11/25 밤 지민 요청) 굽이치는 강 띠 (맵 벽 바깥, 보이기만) ──
// item.river = { points: [[x, z], ...] (소품 위치 기준), widths: [시작 폭, 끝 폭], y: [시작 물 높이, 끝 물 높이], sea: 끝 쪽을 바다색으로 }
//   가운데 점들을 부드러운 곡선으로 잇고, 흐를수록 폭이 넓어짐. 단면 = 바깥 풀밭 → 풀 둑 → 진흙 → 얕은 물 → 깊은 물 (꼭짓점 색)
const RIBBON_M = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.05 })
function riverRibbonGeometry(R) {
  const curve = new THREE.CatmullRomCurve3(R.points.map(([x, z]) => new THREE.Vector3(x, 0, z)), false, 'centripetal')
  const n = Math.max(8, Math.round(curve.getLength() / 2.5))
  const [w0, w1] = R.widths
  const [y0, y1] = R.y ?? [0.1, 0.1]
  const C = (c) => new THREE.Color(c)
  const sea = C('#286f91')
  const pos = []
  const col = []
  const idx = []
  // 단면: [가운데에서 거리(폭/2 기준 비율 또는 고정 m), 높이 더하기, 색]
  const section = (half) => [
    [half + 3.2, -0.22, C('#789957')], [half + 0.9, 0.1, C('#5f8748')], [half + 0.25, 0.04, C('#6f7a4c')], [half, 0, C('#8a7d5e')],
    [half - 0.9, 0, C('#7d9a72')], [half * 0.6, 0, C('#4f8f8f')], [half * 0.25, 0, C('#35778a')],
  ]
  const cols = 14
  for (let i = 0; i <= n; i++) {
    const t = i / n
    const p = curve.getPointAt(t)
    const tan = curve.getTangentAt(t)
    const nx = tan.z
    const nz = -tan.x
    const half = (w0 + (w1 - w0) * t) / 2
    const y = y0 + (y1 - y0) * t
    const sec = section(half)
    const full = [...sec.map(([d, dy, c]) => [-d, dy, c]), ...sec.slice().reverse().map(([d, dy, c]) => [d, dy, c])]
    const toSea = R.sea ? THREE.MathUtils.smoothstep(t, 0.8, 1) : 0
    const fromSea = R.seaStart ? 1 - THREE.MathUtils.smoothstep(t, 0, 0.12) : 0
    full.forEach(([d, dy, c], k) => {
      const wob = k > 2 && k < 11 ? 0 : Math.sin(i * 1.7 + k) * 0.25 // 둑 바깥선은 살짝 들쭉날쭉
      pos.push(p.x + nx * (d + Math.sign(d) * wob), y + dy, p.z + nz * (d + Math.sign(d) * wob))
      const cc = c.clone()
      if (k > 2 && k < 11) cc.lerp(sea, Math.max(toSea, fromSea))
      col.push(cc.r, cc.g, cc.b)
    })
    if (i) for (let k = 0; k < cols - 1; k++) {
      const a = (i - 1) * cols + k
      const b = i * cols + k
      idx.push(a, a + 1, b, a + 1, b + 1, b)
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
  g.setIndex(idx)
  g.computeVertexNormals()
  return g
}
export function JmRiverRibbon({ item }) {
  const geo = useMemo(() => riverRibbonGeometry(item.river), [item.river])
  return <mesh geometry={geo} material={RIBBON_M} frustumCulled={false} />
}

export const JM_SCENE_STYLES = { jmSlopeRoad: JmSlopeRoad, jmGrassTufts: JmGrassTufts, jmRiverRibbon: JmRiverRibbon }
