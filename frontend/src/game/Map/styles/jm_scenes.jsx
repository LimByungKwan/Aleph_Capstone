import { useMemo } from 'react'
import * as THREE from 'three'
import { hipRoofGeometry } from './geometry.js'
import { Ball, Box, Cyl, texMat } from './kit.jsx'
import { getJpSignTexture, GlowMaterial } from './jm_landmarks.jsx'
import { getTiledTexture } from './textures.js'

// 애니 구역(JM) 명장면 ③·⑥ (11/25 밤 지민이 장면을 다시 고름) — 담당: 지민
// ③ 「마녀 배달부 키키」 모티브: 바다가 보이는 언덕 돌길, 길 양옆 파스텔 벽·주황 지붕 집, 언덕 위 빵집(줄무늬 차양·빵 진열창)과 시계탑
// ⑥ 「귀를 기울이면」 모티브: 주택가 사이 긴 계단(가운데 쇠 난간), 전봇대·전깃줄, 계단 위 작은 광장의 골동품점(큰 괘종시계 창)·벤치·나무
// 영화 속 가게 이름·캐릭터는 쓰지 않음 (간판은 우리 글자). 로컬 +z = 골목(입구) 쪽. 걷는 판정은 생성 스크립트(gen-jm-kyoto.mjs)
// 담 없이 놓는 장면이라 네모난 바닥판 대신 가장자리가 부드러운 둥근 바닥(ScenePad)을 깜

const range = (n) => Array.from({ length: n }, (_, i) => i)

// 둥근 바닥: 타원형 얇은 판 (가장자리 쪽 색은 거리 돌바닥에 가깝게)
export function ScenePad({ w, d, color = '#8a8a72', inset = 1.5 }) {
  return (
    <group>
      <mesh position={[0, 0.015, 0]} scale={[(w - inset) / 2, 1, (d - inset) / 2]}>
        <cylinderGeometry args={[1, 1, 0.03, 40]} />
        <meshStandardMaterial color={color} roughness={1} polygonOffset polygonOffsetFactor={-1} />
      </mesh>
    </group>
  )
}

const PASTEL = ['#f2d7b0', '#e9c3c3', '#cfe0c9', '#f4e6a8', '#d6dce9', '#f0c9a0']
const ORANGE_ROOF = '#c8642f'
function EuroHouse({ p, w = 3.4, h = 8, d = 5, seed = 0, face = 1 }) {
  const roof = useMemo(() => hipRoofGeometry(w + 0.5, d + 0.5, 1.8, 0.1), [w, d])
  const wall = PASTEL[seed % PASTEL.length]
  return (
    <group position={p}>
      <Box p={[0, h / 2, 0]} s={[w, h, d]} c={wall} />
      <mesh geometry={roof} position={[0, h, 0]}>
        <meshStandardMaterial color={seed % 3 === 1 ? '#a8502a' : ORANGE_ROOF} flatShading side={THREE.DoubleSide} />
      </mesh>
      {/* 길 쪽 창 (초록 덧문) + 꽃 상자 */}
      {range(Math.floor(h / 2.6)).map((k) => (
        <group key={k} position={[face * (w / 2 + 0.02), 1.6 + k * 2.6, 0]} rotation={[0, (face * Math.PI) / 2, 0]}>
          <Box p={[0, 0, 0]} s={[0.9, 1.2, 0.04]} c="#ffe8b8" />
          {[-1, 1].map((s) => (
            <Box key={s} p={[s * 0.7, 0, 0.02]} s={[0.45, 1.2, 0.04]} c="#3f7a5c" />
          ))}
          {k === 0 && <Box p={[0, -0.75, 0.15]} s={[1.0, 0.25, 0.3]} c="#b8352a" />}
        </group>
      ))}
      <Cyl p={[w * 0.25, h + 1.3, d * 0.2]} rad={0.25} h={1.2} c="#8a5a3a" />
    </group>
  )
}

// ── ③ 빵집 언덕길 ─────────────────────────
export function BakeryHill({ w, d, slope }) {
  const { z0, z1, h } = slope
  const len = z0 - z1
  const rw = w - 7
  const tilt = Math.atan2(h, len)
  const stone = useMemo(() => getTiledTexture('stone', rw / 2, Math.hypot(len, h) / 2), [rw, len, h])
  const stoneTop = useMemo(() => getTiledTexture('stone', rw / 2, (z1 + d / 2) / 2), [rw, z1, d])
  const yAt = (z) => (z >= z0 ? 0 : z <= z1 ? h : (h * (z0 - z)) / len)
  const awning = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = 128
    c.height = 32
    const ctx = c.getContext('2d')
    for (let i = 0; i < 8; i++) {
      ctx.fillStyle = i % 2 ? '#ffffff' : '#c0392b'
      ctx.fillRect(i * 16, 0, 16, 32)
    }
    const t = new THREE.CanvasTexture(c)
    t.colorSpace = THREE.SRGBColorSpace
    return t
  }, [])
  return (
    <group>
      {/* 돌길 비탈 + 위 평지 */}
      <mesh position={[0, h / 2 + 0.04, (z0 + z1) / 2]} rotation={[-Math.PI / 2 + tilt, 0, 0]}>
        <planeGeometry args={[rw, Math.hypot(len, h)]} />
        <primitive object={texMat(stone)} attach="material" />
      </mesh>
      <mesh position={[0, h + 0.04, (z1 - d / 2) / 2]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[rw, z1 + d / 2]} />
        <primitive object={texMat(stoneTop)} attach="material" />
      </mesh>
      {/* 길 양옆 집 (비탈 따라 한 단씩 올라감) */}
      {[-1, 1].map((s) => [7, 1, -5, -10.5].map((z, k) => (
        <EuroHouse key={`${s}${k}`} p={[s * (w / 2 - 1.8), yAt(z), z]} h={8 + ((k + (s > 0 ? 1 : 0)) % 2) * 2} seed={k * 2 + (s > 0 ? 1 : 0)} face={-s} />
      )))}
      {/* 길가 가로등 + 계단식 화분 */}
      {[-1, 1].map((s) => [4, -2].map((z) => (
        <group key={`${s}${z}`} position={[s * (rw / 2 - 0.4), yAt(z), z]}>
          <Cyl p={[0, 1.6, 0]} rad={0.06} h={3.2} c="#2a2622" />
          <Ball p={[0, 3.3, 0]} rad={0.2} c="#fff2c8" />
        </group>
      )))}
      {/* 언덕 위 빵집: 2층, 줄무늬 차양, 빵 진열창, 매달린 빵 간판 */}
      <group position={[-1.5, h, -12]}>
        <Box p={[0, 3.5, -0.3]} s={[8, 7, 1.4]} c="#f4e6c8" />
        <Box p={[0, 1.4, 0.45]} s={[6.4, 2.2, 0.1]} c="#5a3d2a" />
        <mesh position={[0, 1.5, 0.52]}>
          <planeGeometry args={[5.6, 1.6]} />
          <meshStandardMaterial color="#ffe2a8" emissive="#ffb45c" emissiveIntensity={0.5} />
        </mesh>
        {range(7).map((i) => (
          <mesh key={i} position={[-2.4 + i * 0.8, 1.0, 0.6]} scale={[0.3, 0.16, 0.2]}>
            <sphereGeometry args={[1, 10, 8]} />
            <meshStandardMaterial color={i % 2 ? '#c88a3a' : '#b06a2a'} roughness={0.8} />
          </mesh>
        ))}
        <mesh position={[0, 2.8, 0.9]} rotation={[0.5, 0, 0]}>
          <planeGeometry args={[6.6, 1.2]} />
          <meshStandardMaterial map={awning} side={THREE.DoubleSide} />
        </mesh>
        <mesh position={[0, 4.3, 0.42]}>
          <planeGeometry args={[4.2, 0.9]} />
          <GlowMaterial glow={0.5} map={getJpSignTexture('海辺のパン屋', '#f4ead2', '#7a3a12', 4.2 / 0.9)} />
        </mesh>
        <group position={[3.6, 3.4, 1.0]}>
          <Box p={[0, 0, -0.4]} s={[0.06, 0.06, 0.9]} c="#2a2622" />
          <mesh position={[0, -0.35, 0]} scale={[0.35, 0.22, 0.08]}>
            <torusGeometry args={[1, 0.4, 8, 16]} />
            <meshStandardMaterial color="#c88a3a" />
          </mesh>
        </group>
        {range(4).map((i) => (
          <Box key={i} p={[-3 + i * 2, 5.6, 0.42]} s={[0.9, 1.1, 0.04]} c="#ffe8b8" />
        ))}
        <mesh position={[0, 7, -0.3]} geometry={hipRoofGeometry(8.6, 2.2, 1.4, 0.1)}>
          <meshStandardMaterial color={ORANGE_ROOF} flatShading side={THREE.DoubleSide} />
        </mesh>
      </group>
      {/* 시계탑 */}
      <group position={[w / 2 - 5.2, h, -11.2]}>
        <Box p={[0, 6.5, 0]} s={[2.4, 13, 2.4]} c="#e9dcc0" />
        <mesh position={[0, 11, 1.22]}>
          <circleGeometry args={[0.85, 28]} />
          <meshStandardMaterial color="#fffaf0" emissive="#fff2c8" emissiveIntensity={0.3} />
        </mesh>
        <Box p={[0.15, 11.2, 1.25]} s={[0.06, 0.6, 0.02]} c="#1a1210" r={[0, 0, -0.5]} />
        <Box p={[-0.1, 10.9, 1.25]} s={[0.05, 0.45, 0.02]} c="#1a1210" r={[0, 0, 1]} />
        <mesh position={[0, 13.8, 0]}>
          <coneGeometry args={[1.9, 2.4, 4]} />
          <meshStandardMaterial color="#3f6e58" flatShading />
        </mesh>
      </group>
      {/* 장면 팻말 쪽 바다 쪽 하늘빛 (난간 너머) */}
      <Box p={[0, h + 1.0, -d / 2 + 0.6]} s={[rw, 0.08, 0.08]} c="#f2ead2" />
    </group>
  )
}

// ── ⑥ 언덕 위 골동품점 계단 ─────────────────
// stair: { z0, z1, h, w, top } (② 신사 계단과 같은 값 구조). 계단 디딤판은 생성 스크립트의 계단 겉모습(A)
const JP_WALL = ['#efe9dc', '#e3dccb', '#d9d2c2', '#f2ede2']
function JpHouse({ p, w = 5, h = 6.5, d = 5, seed = 0 }) {
  const roof = useMemo(() => hipRoofGeometry(w + 0.6, d + 0.6, 1.4, 0.1), [w, d])
  return (
    <group position={p}>
      <Box p={[0, h / 2, 0]} s={[w, h, d]} c={JP_WALL[seed % JP_WALL.length]} />
      <mesh geometry={roof} position={[0, h, 0]}>
        <meshStandardMaterial color="#5e615f" flatShading side={THREE.DoubleSide} />
      </mesh>
      {[1.6, 4.4].map((y) => (
        <Box key={y} p={[0, y, d / 2 + 0.02]} s={[w * 0.5, 1.1, 0.04]} c="#bcd3dc" />
      ))}
      <Box p={[0, 3.4, d / 2 + 0.4]} s={[w * 0.7, 0.1, 0.8]} c="#8a8a8a" />
      <Box p={[w * 0.3, 5.0, d / 2 + 0.2]} s={[0.9, 0.6, 0.4]} c="#d6d6d0" />
    </group>
  )
}
export function HillStairs({ w, d, stair }) {
  const { z0, z1, h, w: sw, top } = stair
  const len = z0 - z1
  const poles = [[-sw / 2 - 1, 6], [sw / 2 + 1, -1], [-sw / 2 - 1, -6]]
  const yAt = (z) => (z >= z0 ? 0 : z <= z1 ? h : (h * (z0 - z)) / len)
  return (
    <group>
      <ScenePad w={w} d={d} color="#9a9688" />
      {/* 가운데 쇠 난간 */}
      {range(8).map((i) => {
        const z = z0 - (i * len) / 7
        return <Cyl key={i} p={[0, yAt(z) + 0.5, z]} rad={0.04} h={1.0} c="#7a7a78" />
      })}
      <mesh position={[0, h / 2 + 0.95, (z0 + z1) / 2]} rotation={[Math.atan2(h, len), 0, 0]}>
        <cylinderGeometry args={[0.035, 0.035, Math.hypot(len, h), 6]} />
        <meshStandardMaterial color="#9a9a96" metalness={0.5} roughness={0.4} />
      </mesh>
      {/* 계단 양옆 주택 (한 단씩 높아짐) */}
      {[-1, 1].map((s) => [0, 1, 2].map((k) => (
        <JpHouse key={`${s}${k}`} p={[s * (sw / 2 + 3.6), yAt(z0 - 2.5 - k * 5.2) * 0.85, z0 - 2.5 - k * 5.2]} w={5.6} h={6.5 + k * 0.6} d={4.6} seed={k + (s > 0 ? 2 : 0)} />
      )))}
      {/* 전봇대 + 전깃줄 */}
      {poles.map(([x, z], i) => (
        <Cyl key={i} p={[x, yAt(z) + 4.5, z]} rad={0.13} h={9} c="#8a8578" />
      ))}
      {poles.slice(0, -1).map(([x, z], i) => {
        const [x2, z2] = poles[i + 1]
        const a = [x, yAt(z) + 8.6, z]
        const b = [x2, yAt(z2) + 8.6, z2]
        const L = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2])
        const mid = a.map((v, j) => (v + b[j]) / 2)
        const dir = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]).normalize()
        const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir)
        return (
          <mesh key={`w${i}`} position={mid} quaternion={q}>
            <cylinderGeometry args={[0.015, 0.015, L, 4]} />
            <meshStandardMaterial color="#1a1a1a" />
          </mesh>
        )
      })}
      {/* 계단 위 광장: 골동품점(큰 괘종시계 창) + 벤치 + 나무 + 난간 */}
      <group position={[0, h, z1 - top + 1.6]}>
        <Box p={[0, 3, -0.2]} s={[7, 6, 1.6]} c="#6b4a30" />
        <mesh position={[0, 6.3, -0.2]} geometry={hipRoofGeometry(7.6, 2.2, 1.4, 0.1)}>
          <meshStandardMaterial color="#3f5d4c" flatShading side={THREE.DoubleSide} />
        </mesh>
        <mesh position={[-1.6, 2.0, 0.62]}>
          <planeGeometry args={[2.4, 2.6]} />
          <meshStandardMaterial color="#ffe2a8" emissive="#ffb45c" emissiveIntensity={0.55} />
        </mesh>
        <group position={[-1.6, 2.1, 0.66]}>
          <Box p={[0, 0, 0]} s={[0.7, 2.0, 0.06]} c="#4a2f1f" />
          <mesh position={[0, 0.5, 0.04]}>
            <circleGeometry args={[0.24, 20]} />
            <meshStandardMaterial color="#fffaf0" />
          </mesh>
          <Box p={[0, -0.3, 0.04]} s={[0.04, 0.6, 0.02]} c="#b8913c" />
        </group>
        <Box p={[1.8, 1.2, 0.62]} s={[1.2, 2.4, 0.06]} c="#3a2a1c" />
        <mesh position={[0, 4.6, 0.62]}>
          <planeGeometry args={[4.2, 0.85]} />
          <GlowMaterial glow={0.5} map={getJpSignTexture('時計の骨董店', '#2a1a12', '#e8c35a', 4.2 / 0.85)} />
        </mesh>
        <group position={[-4.5, 0, 3]}>
          <Box p={[0, 0.45, 0]} s={[1.8, 0.1, 0.5]} c="#8a6a48" />
          {[-0.75, 0.75].map((x) => (
            <Box key={x} p={[x, 0.22, 0]} s={[0.1, 0.44, 0.45]} c="#3a2a1c" />
          ))}
        </group>
        <group position={[4.6, 0, 2.5]}>
          <Cyl p={[0, 1.8, 0]} rad={0.2} h={3.6} c="#5a4636" />
          <mesh position={[0, 4.2, 0]} scale={[1.8, 1.4, 1.8]}>
            <sphereGeometry args={[1, 10, 8]} />
            <meshStandardMaterial color="#5f8f4a" flatShading />
          </mesh>
        </group>
      </group>
    </group>
  )
}

// 「초속 5센티미터」 건널목 쪽 비탈 돌길 그림 (생성 스크립트의 jm_crossing_slope와 같은 자리, 소품 기준 = 비탈 아래 끝)
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

export const JM_SCENE_STYLES = { jmSlopeRoad: JmSlopeRoad }
