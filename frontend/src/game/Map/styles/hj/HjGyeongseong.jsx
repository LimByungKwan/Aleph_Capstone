import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Ball, Box, Cone, Cyl, GEO, Instances, mat } from '../kit.jsx'
import { getSignTexture } from '../textures.js'
import { TramCar, tramSeatSlots } from './HjTramCar.jsx'
import { registerVehicle, updateVehicleWorld } from '../../../../components/movieZone/rideSeats.js'
import { sharedSeconds } from '../../../../components/movieZone/hjSync.js'

// [3. 개발 > 프론트엔드] 1930년대 경성 거리 세트 (혜진 영화·드라마 구역, 궁궐 동쪽)
// 근대 석조·벽돌 상가 · 돔 지붕 역사 · 전차와 선로 · 가스등 · 인력거 · 광고탑
// 모두 size [가로 w, 높이 h, 깊이 d] 기준, 앞면 +z. 상호·간판은 모두 가상의 이름이에요.

const STONE = '#d8cfbd'
const STONE_DARK = '#b3a993'
const BRICK = '#9a4a38'
const BRICK_DARK = '#7a3a2c'
const COPPER = '#4f8a78'
const IRON = '#2d2b29'
const WINDOW_LIT = mat('#ffe2ae', { emissive: '#ffc27a', emissiveIntensity: 0.6 })
const WINDOW_DARK = mat('#5d6f7a', { roughness: 0.3, metalness: 0.2 })
const LAMP_GLASS = mat('#fff3d0', { emissive: '#ffcf7a', emissiveIntensity: 1.5 })
const PARTS = mat('#ffffff', { roughness: 0.85 })

// ── 근대 상가 건물 (style: "hjModernBuilding") ─────────────────────────
// item.material: "stone"(석조) | "brick"(벽돌) / item.columns: true면 1층 앞 원기둥
// item.dome: 지붕 모서리 작은 돔 색 / item.signs[0]: 간판 { text, bg, fg } / item.awning: 차양 색
// item.marquee: true면 극장 간판(전구 테두리)
// item.wall: 벽 색 직접 지정(회칠 노랑·크림 등) / item.balcony: true면 2층부터 층마다 앞 발코니+난간
// item.bigDome: 지붕 가운데 큰 돔 색 (은행처럼)
export function HjModernBuilding({ item }) {
  const [w, h, d] = item.size
  const stone = item.material !== 'brick'
  const wall = item.wall ?? (stone ? STONE : BRICK)
  const trim = stone ? STONE_DARK : '#e6dccb'
  const floors = Math.max(1, Math.floor(h / 3.3))
  const sign = item.signs?.[0]
  const signTex = sign ? getSignTexture(sign.text, sign.bg ?? '#2b2420', sign.fg ?? '#f3dfb0') : null
  const winCount = Math.max(2, Math.floor(w / 1.8))
  const columnCount = Math.max(2, Math.floor(w / 2.2)) + 1 // 1층 앞 원기둥 수

  const windows = useMemo(() => {
    const lit = []
    const dark = []
    const frames = []
    for (let f = 1; f < floors; f += 1) {
      for (let i = 0; i < winCount; i += 1) {
        const x = -w / 2 + (w / winCount) * (i + 0.5)
        const y = f * 3.3 + 1.55
        ;(((i + f + w) | 0) % 3 === 0 ? lit : dark).push({ p: [x, y, d / 2 + 0.04], s: [0.85, 1.5, 0.05] })
        frames.push({ p: [x, y + 0.92, d / 2 + 0.1], s: [1.15, 0.18, 0.2], c: trim }) // 창 위 돌 장식
        frames.push({ p: [x, y - 0.85, d / 2 + 0.08], s: [1.05, 0.1, 0.16], c: trim }) // 창턱
      }
    }
    return { lit, dark, frames }
  }, [w, d, floors, winCount])

  // 발코니 난간 기둥 (한 번에 그리기)
  const balusters = useMemo(() => {
    if (!item.balcony) return []
    const list = []
    const n = Math.max(3, Math.round(w * 1.4))
    for (let f = 1; f < floors; f += 1) {
      for (let k = 0; k < n; k += 1) list.push({ p: [-w * 0.43 + (w * 0.86 * k) / (n - 1), f * 3.3 + 0.47, d / 2 + 0.87], s: [0.05, 0.8, 0.05] })
    }
    return list
  }, [item.balcony, w, d, floors])

  return (
    <group>
      <Box p={[0, h / 2, 0]} s={[w, h, d]} c={wall} />
      {balusters.length > 0 && <Instances geometry={GEO.box} material={mat('#f4efe4')} items={balusters} />}
      {/* 층 띠 + 처마 돌림띠 + 옥상 난간 */}
      {Array.from({ length: floors - 1 }, (_, i) => (
        <Box key={i} p={[0, (i + 1) * 3.3, d / 2 + 0.05]} s={[w + 0.1, 0.18, 0.14]} c={trim} />
      ))}
      <Box p={[0, h - 0.192, 0]} s={[w + 0.4, 0.416, d + 0.4]} c={trim} />
      <Box p={[0, h + 0.35, d / 2 - 0.1]} s={[w + 0.1, 0.7, 0.25]} c={wall} />
      {/* 모서리 돌기둥 (벽돌 건물은 흰 돌 모서리) */}
      {[-1, 1].map((s) => (
        <Box key={s} p={[s * (w / 2 - 0.15), (h - 0.016) / 2, d / 2 - 0.1]} s={[0.35, h - 0.016, 0.35]} c={trim} />
      ))}
      <Instances geometry={GEO.box} material={WINDOW_LIT} items={windows.lit} />
      <Instances geometry={GEO.box} material={WINDOW_DARK} items={windows.dark} />
      <Instances geometry={GEO.box} material={PARTS} items={windows.frames} />

      {/* 1층: 진열창 + 가운데 문 */}
      <Box p={[0, 1.35, d / 2 + 0.04]} s={[w - 1.2, 2.3, 0.06]} m={WINDOW_LIT} />
      <Box p={[0, 1.15, d / 2 + 0.08]} s={[1.3, 2.3, 0.06]} c="#3b2a20" />
      {item.columns &&
        Array.from({ length: columnCount }, (_, i) => {
          const x = -w / 2 + 0.6 + ((w - 1.2) / (columnCount - 1)) * i
          return (
            <group key={i}>
              <Cyl p={[x, 1.6, d / 2 + 0.45]} rad={0.2} h={3.2} c={STONE} />
              <Box p={[x, 3.25, d / 2 + 0.45]} s={[0.55, 0.16, 0.55]} c={STONE_DARK} />
            </group>
          )
        })}
      {item.columns && <Box p={[0, 3.4, d / 2 + 0.45]} s={[w - 0.6, 0.25, 0.9]} c={STONE_DARK} />}
      {item.awning && (
        <mesh position={[0, 2.75, d / 2 + 0.55]} rotation={[0.42, 0, 0]} material={mat(item.awning)}>
          <boxGeometry args={[w - 1, 0.06, 1.2]} />
        </mesh>
      )}

      {/* 간판 (극장이면 전구 테두리) */}
      {signTex && (
        <group position={[0, item.marquee ? 4.1 : 3.05, d / 2 + (item.columns ? 0.95 : 0.12)]}>
          <mesh>
            <planeGeometry args={[Math.min(w - 0.8, 6), item.marquee ? 1.1 : 0.62]} />
            <meshStandardMaterial map={signTex} emissive={item.marquee ? '#ffffff' : '#000000'} emissiveMap={signTex} emissiveIntensity={item.marquee ? 0.5 : 0} />
          </mesh>
          {item.marquee && <MarqueeBulbs width={Math.min(w - 0.8, 6) + 0.3} height={1.4} />}
        </group>
      )}

      {/* 층마다 발코니 (얇은 바닥 + 흰 난간 + 난간 기둥) */}
      {item.balcony &&
        Array.from({ length: Math.max(0, floors - 1) }, (_, i) => {
          const y = (i + 1) * 3.3 + 0.05
          return (
            <group key={`b${i}`} position={[0, y, d / 2 + 0.45]}>
              <Box p={[0, 0, 0]} s={[w * 0.86, 0.14, 0.9]} c={trim} />
              <Box p={[0, 0.85, 0.42]} s={[w * 0.86, 0.08, 0.08]} c="#f4efe4" />
            </group>
          )
        })}
      {item.bigDome && (
        <group position={[0, h, 0]}>
          <Box p={[0, 0.4, 0]} s={[w * 0.36, 0.8, w * 0.36]} c={trim} />
          <Cyl p={[0, 1.2, 0]} rad={w * 0.15} h={1} c={wall} geo={GEO.cyl48} />
          <mesh geometry={GEO.dome} material={mat(item.bigDome, { roughness: 0.5, metalness: 0.3 })} position={[0, 1.7, 0]} scale={[w * 0.16, w * 0.17, w * 0.16]} />
          <Cyl p={[0, 1.8 + w * 0.17, 0]} rad={0.25} h={0.5} c={trim} geo={GEO.cyl8} />
          <Cone p={[0, 2.35 + w * 0.17, 0]} rad={0.08} h={0.6} c={IRON} />
        </group>
      )}
      {/* 지붕 모서리 돔 */}
      {item.dome && (
        <group position={[w / 2 - 1.2, h + 0.7, d / 2 - 1.2]}>
          <Cyl p={[0, 0.5, 0]} rad={0.95} h={1} c={wall} />
          <mesh geometry={GEO.dome} material={mat(item.dome, { roughness: 0.5, metalness: 0.3 })} position={[0, 1, 0]} scale={[1.05, 1.1, 1.05]} />
          <Cone p={[0, 2.35, 0]} rad={0.08} h={0.6} c={IRON} />
        </group>
      )}
    </group>
  )
}

// 극장 간판 둘레 전구 (깜빡임)
function MarqueeBulbs({ width, height }) {
  const bulbs = useMemo(() => {
    const list = []
    const nx = Math.round(width / 0.35)
    const ny = Math.round(height / 0.35)
    for (let i = 0; i <= nx; i += 1) {
      const x = -width / 2 + (width / nx) * i
      list.push({ p: [x, height / 2, 0.05], s: [0.07, 0.07, 0.07] }, { p: [x, -height / 2, 0.05], s: [0.07, 0.07, 0.07] })
    }
    for (let j = 1; j < ny; j += 1) {
      const y = -height / 2 + (height / ny) * j
      list.push({ p: [-width / 2, y, 0.05], s: [0.07, 0.07, 0.07] }, { p: [width / 2, y, 0.05], s: [0.07, 0.07, 0.07] })
    }
    return list
  }, [width, height])
  const material = useMemo(() => new THREE.MeshStandardMaterial({ color: '#fff1c2', emissive: '#ffc85a', emissiveIntensity: 1.6, toneMapped: false }), [])
  useFrame(({ clock }) => {
    material.emissiveIntensity = 1.2 + (Math.sin(clock.elapsedTime * 6) > 0 ? 0.8 : 0)
  })
  return <Instances geometry={GEO.sphere} material={material} items={bulbs} />
}

// ── 돔 지붕 역사 (style: "hjStation") — 붉은 벽돌 + 흰 돌 띠 + 가운데 초록 돔 + 시계 ──
export function HjStation({ item }) {
  const [w, h, d] = item.size
  const wing = (w - 6) / 2
  const wingWindows = Math.max(1, Math.floor(wing / 1.6)) // 날개 건물 창 수
  const clock = useRef(null)
  useFrame(({ clock: c }) => {
    if (clock.current) clock.current.rotation.z = -c.elapsedTime * 0.05
  })
  const sign = getSignTexture(item.title ?? '경성역', '#2d3b35', '#f3e6c4')
  return (
    <group>
      {/* 양쪽 날개 건물 */}
      {[-1, 1].map((s) => (
        <group key={s} position={[s * (3 + wing / 2), 0, 0]}>
          <Box p={[0, h * 0.32, 0]} s={[wing, h * 0.64, d]} c={BRICK} />
          <Box p={[0, h * 0.64 + 0.15, 0]} s={[wing + 0.3, 0.3, d + 0.3]} c={STONE} />
          <Box p={[0, h * 0.25, d / 2 + 0.05]} s={[wing - 0.4, 0.2, 0.1]} c={STONE} />
          {Array.from({ length: wingWindows }, (_, i) => (
            <group key={i} position={[-wing / 2 + (wing / wingWindows) * (i + 0.5), 0, d / 2 + 0.05]}>
              <Box p={[0, 1.4, 0]} s={[0.9, 1.9, 0.06]} m={WINDOW_LIT} />
              <Box p={[0, h * 0.45, 0]} s={[0.8, 1.4, 0.06]} m={WINDOW_DARK} />
              <Box p={[0, 2.45, 0.05]} s={[1.1, 0.16, 0.12]} c={STONE} />
            </group>
          ))}
          <Box p={[s * 0.05, h * 0.64 + 0.6, 0]} s={[wing * 0.6, 0.8, d * 0.6]} c={COPPER} />
        </group>
      ))}
      {/* 가운데 홀 + 아치 입구 3개 */}
      <Box p={[0, h * 0.4, 0]} s={[6, h * 0.8, d + 0.6]} c={BRICK_DARK} />
      <Box p={[0, h * 0.8 + 0.15, 0]} s={[6.4, 0.3, d + 0.9]} c={STONE} />
      {[-1.8, 0, 1.8].map((x) => (
        <group key={x} position={[x, 0, d / 2 + 0.33]}>
          <Box p={[0, 1.35, 0]} s={[1.25, 2.7, 0.06]} m={WINDOW_LIT} />
          <mesh position={[0, 2.7, 0.01]} material={WINDOW_LIT}>
            <circleGeometry args={[0.62, 16, 0, Math.PI]} />
          </mesh>
          <Box p={[0, 0.06, 0.4]} s={[1.6, 0.12, 0.8]} c={STONE_DARK} />
        </group>
      ))}
      {/* 현판 + 시계 */}
      <mesh position={[0, h * 0.8 - 1.0, d / 2 + 0.32]}>
        <planeGeometry args={[4.2, 0.75]} />
        <meshStandardMaterial map={sign} />
      </mesh>
      <group position={[0, h * 0.8 + 1.2, d / 2 + 0.2]}>
        <Box p={[0, 0, -0.2]} s={[2.4, 2.2, 0.4]} c={STONE} />
        <Cyl p={[0, 0, 0.05]} rad={0.8} h={0.08} c="#f6f0df" r={[Math.PI / 2, 0, 0]} />
        <group ref={clock} position={[0, 0, 0.12]}>
          <Box p={[0, 0.3, 0]} s={[0.06, 0.6, 0.02]} c={IRON} />
        </group>
        <Box p={[0.2, 0, 0.12]} s={[0.4, 0.06, 0.02]} c={IRON} />
      </group>
      {/* 초록 돔 + 꼭대기 첨탑 */}
      <Cyl p={[0, h * 0.8 + 0.9, 0]} rad={2.4} h={1.5} c={BRICK} geo={GEO.cyl48} />
      <mesh geometry={GEO.dome} material={mat(COPPER, { roughness: 0.45, metalness: 0.35 })} position={[0, h * 0.8 + 1.65, 0]} scale={[2.6, 2.6, 2.6]} />
      <Cyl p={[0, h * 0.8 + 4.5, 0]} rad={0.5} h={0.7} c={STONE} />
      <Cone p={[0, h * 0.8 + 5.3, 0]} rad={0.15} h={1} c={IRON} />
      <pointLight position={[0, 2.5, d / 2 + 2]} color="#ffc98a" intensity={8} distance={10} decay={2} />
    </group>
  )
}

// ── 전차 선로 + 가공선 (style: "hjTramLine") — size [폭, -, 길이], 길이 방향 = z ──
// item.poleSide: 가공선 기둥 쪽 (1 = 오른쪽 기본, -1 = 왼쪽) — 복선일 때 기둥이 옆 선로를 막지 않게 바깥쪽으로
export function HjTramLine({ item }) {
  const [, , length] = item.size
  const side = item.poleSide ?? 1
  const parts = useMemo(() => {
    const ties = []
    for (let z = -length / 2 + 0.4; z < length / 2; z += 0.8) ties.push({ p: [0, 0.035, z], s: [1.9, 0.04, 0.22], c: '#5e4a3a' })
    return ties
  }, [length])
  const poles = []
  for (let z = -length / 2 + 2; z < length / 2; z += 10) poles.push(z)
  return (
    <group>
      <Instances geometry={GEO.box} material={PARTS} items={parts} />
      {[-0.72, 0.72].map((x) => (
        <Box key={x} p={[x, 0.07, 0]} s={[0.09, 0.07, length]} c="#8a8780" />
      ))}
      {/* 가공선 기둥 (가운데 섬식) + 가로대 + 전선 */}
      {poles.map((z) => (
        <group key={z} position={[0, 0, z]}>
          <Cyl p={[side * 2.4, 3.1, 0]} rad={0.09} h={6.2} c={IRON} />
          <Box p={[side * 1.2, 5.9, 0]} s={[2.5, 0.08, 0.08]} c={IRON} />
        </group>
      ))}
      <Box p={[0, 5.85, 0]} s={[0.025, 0.025, length]} c={IRON} />
    </group>
  )
}

// ── 전차 (style: "hjTram") — 선로를 따라 천천히 오가요. item.travel: [시작z, 끝z] ──
// item.phase: 출발 시각 차이(초). 22를 주면 다른 전차와 반대로 움직여요 / item.sign: 행선판 글자 / item.light: false면 앞 불빛 없음
export function HjTram({ item }) {
  const [w, h, l] = item.size
  const [z0, z1] = item.travel ?? [-20, 20]
  const ref = useRef(null)
  const seats = useMemo(() => tramSeatSlots(w, l, 0.45, Math.round((item.phase ?? 0) / 7)), [w, l, item.phase])
  // 타는 것 목록에 등록 → 정차 중일 때 옆에서 E로 타고, 정차하면 E로 내려요 (palaceSeating.js)
  const vehicle = useMemo(() => ({ id: item.id, label: '전차', stopped: true, w, l, seats: [] }), [item.id, w, l])
  useEffect(() => registerVehicle(vehicle), [vehicle])
  useFrame(({ clock }) => {
    if (!ref.current) return
    // 정류장(양 끝)에서 9초 정차 → 18초 이동 → 정차 → 되돌아옴
    const MOVE = 18
    const DWELL = 9
    const period = 2 * (MOVE + DWELL)
    // 모든 화면이 같은 시간표로 움직이게 서버 시각 기준 (혼자 모드면 내 시계)
    const t = (sharedSeconds() + (item.phase ?? 0)) % period
    let k = 0
    let stopped = true
    if (t < DWELL) k = 0
    else if (t < DWELL + MOVE) { k = (t - DWELL) / MOVE; stopped = false }
    else if (t < 2 * DWELL + MOVE) k = 1
    else { k = 1 - (t - 2 * DWELL - MOVE) / MOVE; stopped = false }
    const eased = k * k * (3 - 2 * k)
    ref.current.position.z = z0 + (z1 - z0) * eased
    vehicle.stopped = stopped
    updateVehicleWorld(vehicle, ref.current, seats, [w / 2 + 1.2, 0.1, 0])
  })
  return (
    <group ref={ref}>
      {/* 차체 + 실내 + 승객 (HjTramCar.jsx) */}
      <TramCar w={w} h={h} l={l} floorY={0.45} sign={item.sign ?? '종로 ↔ 경성역'} seats={seats} />
      {item.light !== false && <pointLight position={[0, 1.6, l / 2 + 0.6]} color="#ffe2a8" intensity={4} distance={6} decay={2} />}
    </group>
  )
}

// ── 가스등 (style: "hjGasLamp") — 검은 쇠기둥 + 네모 유리등 ──
export function HjGasLamp({ item }) {
  const [, h] = item.size
  return (
    <group>
      <Cyl p={[0, 0.25, 0]} rad={0.2} h={0.5} c={IRON} geo={GEO.cyl8} />
      <Cyl p={[0, h / 2, 0]} rad={0.06} h={h} c={IRON} geo={GEO.cyl8} />
      <Box p={[0, h - 0.6, 0]} s={[0.5, 0.06, 0.08]} c={IRON} />
      <Box p={[0, h + 0.15, 0]} s={[0.32, 0.45, 0.32]} m={LAMP_GLASS} />
      <Cone p={[0, h + 0.5, 0]} rad={0.3} h={0.28} c={IRON} />
      <Ball p={[0, h + 0.7, 0]} rad={0.06} c={IRON} />
      {item.light !== false && <pointLight position={[0, h, 0]} color="#ffc98a" intensity={3} distance={6} decay={2} />}
    </group>
  )
}

// ── 인력거 (style: "hjRickshaw") — 큰 바퀴 2개 + 접이식 덮개 좌석 + 손잡이대. x축 = 앞 ──
export function HjRickshaw() {
  return (
    <group>
      {[-0.55, 0.55].map((z) => (
        <mesh key={z} position={[-0.2, 0.62, z]} material={mat('#3b2a20')}>
          <torusGeometry args={[0.6, 0.04, 6, 24]} />
        </mesh>
      ))}
      <Cyl p={[-0.2, 0.62, 0]} rad={0.04} h={1.2} c={IRON} r={[Math.PI / 2, 0, 0]} />
      {/* 좌석 방석: 앞 끝이 무릎 바로 아래까지만 (정강이가 방석에 묻히지 않게) */}
      <Box p={[-0.32, 0.95, 0]} s={[0.58, 0.12, 1.0]} c="#7a2e2e" />
      {/* 발판: 무릎 앞 아래쪽, 발을 올려놓는 나무판 + 양옆 받침 */}
      <Box p={[0.2, 0.47, 0]} s={[0.46, 0.05, 0.86]} c="#5a3d28" />
      {[-0.42, 0.42].map((z) => (
        <Box key={`fr${z}`} p={[-0.01, 0.72, z]} s={[0.05, 0.5, 0.05]} r={[0, 0, 0.45]} c="#3a2e24" />
      ))}
      <Box p={[-0.55, 1.3, 0]} s={[0.12, 0.7, 1.0]} c="#7a2e2e" />
      {/* 덮개: 의자 뒤 틀에 붙어서 머리 위로 둥글게 올라와 앞쪽 쇠살에 걸려요 (타원 모양, 앉은 사람과 안 겹침)
          타원 가운데 (-0.4, 1.2), 가로 반지름 0.55, 세로 0.95. 뒤 끝 = 의자 뒤 (-0.94, 1.01), 앞 끝 = (0.05, 1.75) */}
      <group position={[-0.4, 1.2, 0]} scale={[0.55, 0.95, 1]}>
        <mesh rotation={[Math.PI / 2, 0, 0]} material={mat('#2a2520', { double: true })}>
          <cylinderGeometry args={[1, 1, 1.05, 18, 1, true, 2.18, 2.73]} />
        </mesh>
        {[-0.52, 0, 0.52].map((z) => (
          <group key={`hb${z}`} position={[0, 0, z]}>
            <mesh rotation={[0, 0, 0.61]} material={mat('#3a2e24')}>
              <torusGeometry args={[1, 0.03, 4, 18, 2.73]} />
            </mesh>
          </group>
        ))}
      </group>
      {/* 덮개 앞 끝을 받치는 쇠살 (의자 앞 모서리 → 덮개 앞 끝) + 뒤 끝을 의자 틀에 잇는 경첩 막대 */}
      {[-0.52, 0.52].map((z) => (
        <group key={`hs${z}`}>
          <Box p={[0.015, 1.36, z]} s={[0.035, 0.78, 0.035]} r={[0, 0, -0.09]} c="#3a2e24" />
          <Box p={[-0.75, 1.0, z]} s={[0.4, 0.05, 0.05]} c="#3a2e24" />
        </group>
      ))}
      {/* 손잡이대 */}
      {[-0.42, 0.42].map((z) => (
        <Box key={z} p={[0.75, 0.6, z]} s={[1.9, 0.06, 0.06]} c="#6b4a33" r={[0, 0, -0.18]} />
      ))}
      <Box p={[1.62, 0.43, 0]} s={[0.06, 0.06, 0.9]} c="#6b4a33" />
    </group>
  )
}

// ── 광고탑 (style: "hjAdColumn") — 원기둥에 포스터를 붙인 1930년대 거리 광고탑 ──
export function HjAdColumn({ item }) {
  const [, h] = item.size
  const posters = ['모던 극장 개봉', '축음기 대매출', '경성 백화점', '다방 신장개업']
  return (
    <group>
      <Cyl p={[0, h / 2, 0]} rad={0.6} h={h} c="#e8dcc0" />
      <Cyl p={[0, h + 0.1, 0]} rad={0.72} h={0.2} c="#2f5d4a" />
      <Cone p={[0, h + 0.5, 0]} rad={0.7} h={0.6} c="#2f5d4a" />
      {posters.map((text, i) => {
        const a = (i / posters.length) * Math.PI * 2
        return (
          <mesh key={text} position={[Math.sin(a) * 0.61, h * 0.55, Math.cos(a) * 0.61]} rotation={[0, a, 0]}>
            <planeGeometry args={[0.95, 0.5]} />
            <meshStandardMaterial map={getSignTexture(text, ['#7a2e2e', '#2f4a6b', '#b8872f', '#3f5a40'][i], '#f6eedb')} />
          </mesh>
        )
      })}
    </group>
  )
}

// ── 광장 시계탑 (style: "hjClockTower") — 돌 받침 + 네모 탑 + 4면 시계 + 구리 지붕. size [w, h, w] ──
const CLOCK_FACE = mat('#fbf3dc', { emissive: '#ffe7b0', emissiveIntensity: 0.35 })
export function HjClockTower({ item }) {
  const [w, h] = item.size
  const top = h * 0.78
  const face = Math.max(0.42, w * 0.27) // 시계판 반지름 (탑이 크면 같이 커짐)
  const cb = Math.max(1.1, face * 2.4) // 시계가 붙는 네모 칸 높이
  const cy = top + 0.2 + cb / 2
  const hand = useRef(null)
  useFrame(({ clock }) => {
    // 분침이 천천히 도는 장식 (실제 시간 아님)
    if (hand.current) hand.current.rotation.z = -clock.elapsedTime * 0.2
  })
  return (
    <group>
      <Box p={[0, 0.3, 0]} s={[w * 1.6, 0.6, w * 1.6]} c={STONE_DARK} />
      <Box p={[0, 0.7, 0]} s={[w * 1.3, 0.2, w * 1.3]} c={STONE} />
      <Box p={[0, top / 2 + 0.6, 0]} s={[w, top, w]} c={BRICK} />
      {[0.3, 0.55].map((t) => (
        <Box key={t} p={[0, 0.6 + top * t, 0]} s={[w + 0.08, 0.12, w + 0.08]} c={STONE} />
      ))}
      <Box p={[0, cy, 0]} s={[w + 0.35, cb, w + 0.35]} c={STONE} />
      {[0, 1, 2, 3].map((i) => {
        const a = (i * Math.PI) / 2
        const r = (w + 0.35) / 2 + 0.01
        return (
          <group key={i} position={[Math.sin(a) * r, cy, Math.cos(a) * r]} rotation={[0, a, 0]}>
            <mesh material={CLOCK_FACE}>
              <circleGeometry args={[face, 24]} />
            </mesh>
            <Box p={[0, face * 0.25, 0.01]} s={[face * 0.1, face * 0.52, 0.01]} c={IRON} />
            <group ref={i === 0 ? hand : undefined} position={[0, 0, 0.02]}>
              <Box p={[0, face * 0.36, 0]} s={[face * 0.07, face * 0.76, 0.01]} c={IRON} />
            </group>
          </group>
        )
      })}
      <Cone p={[0, cy + cb / 2 + 0.45 * (w / 1.6), 0]} rad={(w + 0.4) * 0.72} h={0.9 * (w / 1.6)} c={COPPER} />
      <Cyl p={[0, cy + cb / 2 + 0.9 * (w / 1.6) + 0.3, 0]} rad={0.04} h={0.6} c={IRON} geo={GEO.cyl8} />
      <pointLight position={[0, cy, 0]} color="#ffd9a0" intensity={4} distance={8} decay={2} />
    </group>
  )
}

// ── 문화주택 (style: "hjCultureHouse") — 1930년대 2층 양옥: 붉은 기와 박공지붕, 돌출 현관, 2층 발코니. 앞면 +z ──
export function HjCultureHouse({ item }) {
  const [w, h, d] = item.size
  const wall = item.wall ?? '#efe3c6'
  const roof = item.roof ?? '#9c3d2e'
  const floorH = (h * 0.68) / 2
  const roofH = h - floorH * 2
  const windows = useMemo(() => {
    const list = []
    const cols = Math.max(2, Math.round(w / 1.8))
    for (let f = 0; f < 2; f += 1) {
      for (let i = 0; i < cols; i += 1) {
        const x = (i + 0.5 - cols / 2) * (w / cols)
        if (f === 0 && Math.abs(x) < 0.9) continue // 현관 자리
        list.push({ p: [x, floorH * (f + 0.55), d / 2 + 0.02], s: [0.7, floorH * 0.5, 0.05] })
      }
    }
    return list
  }, [w, d, floorH])
  return (
    <group>
      <Box p={[0, 0.15, 0]} s={[w + 0.3, 0.3, d + 0.3]} c={STONE_DARK} />
      <Box p={[0, floorH, 0]} s={[w, floorH * 2, d]} c={wall} />
      <Box p={[0, floorH, 0]} s={[w + 0.06, 0.12, d + 0.06]} c={BRICK_DARK} />
      <Instances geometry={GEO.box} material={WINDOW_LIT} items={windows} />
      {/* 박공지붕: 앞뒤로 기운 두 판 */}
      {[-1, 1].map((s) => (
        <Box
          key={s}
          p={[0, floorH * 2 + roofH / 2, (s * d) / 4]}
          s={[w + 0.6, 0.18, Math.hypot(d / 2 + 0.3, roofH)]}
          r={[s * Math.atan2(roofH, d / 2 + 0.3), 0, 0]}
          c={roof}
        />
      ))}
      {/* 박공 벽(양옆 삼각형 대신 낮은 벽) */}
      {[-1, 1].map((s) => (
        <Box key={`g${s}`} p={[(s * w) / 2 - s * 0.05, floorH * 2 + roofH * 0.3, 0]} s={[0.1, roofH * 0.6, d * 0.55]} c={wall} />
      ))}
      <Box p={[w * 0.28, floorH * 2 + roofH * 0.6, -d * 0.15]} s={[0.45, roofH * 1.1, 0.45]} c={BRICK} />
      {/* 돌출 현관 + 기둥 + 문 */}
      <Box p={[0, floorH * 0.9, d / 2 + 0.6]} s={[1.9, 0.14, 1.2]} c={wall} />
      {[-0.8, 0.8].map((x) => (
        <Cyl key={x} p={[x, floorH * 0.45, d / 2 + 1.05]} rad={0.07} h={floorH * 0.9} c="#f6f0e2" geo={GEO.cyl8} />
      ))}
      <Box p={[0, floorH * 0.42, d / 2 + 0.03]} s={[0.9, floorH * 0.8, 0.06]} c="#6b4a33" />
      {/* 2층 발코니 난간 */}
      <Box p={[0, floorH * 2 - 0.05, d / 2 + 0.45]} s={[w * 0.55, 0.1, 0.9]} c={STONE} />
      <Box p={[0, floorH * 2 + 0.35, d / 2 + 0.88]} s={[w * 0.55, 0.06, 0.06]} c="#f6f0e2" />
      {/* 앞마당 낮은 울타리 + 화분 */}
      <Box p={[-w * 0.32, 0.35, d / 2 + 1.7]} s={[w * 0.3, 0.4, 0.1]} c="#f6f0e2" />
      <Box p={[w * 0.32, 0.35, d / 2 + 1.7]} s={[w * 0.3, 0.4, 0.1]} c="#f6f0e2" />
      <Ball p={[-w * 0.38, 0.75, d / 2 + 1.4]} rad={0.35} c="#5d8a4e" />
      <Ball p={[w * 0.38, 0.75, d / 2 + 1.4]} rad={0.35} c="#d77a8f" />
      {item.signs?.[0] && (
        <mesh position={[0, floorH * 1.55, d / 2 + 0.05]}>
          <planeGeometry args={[Math.min(w * 0.6, 2.6), 0.5]} />
          <meshStandardMaterial map={getSignTexture(item.signs[0].text, item.signs[0].bg, item.signs[0].fg)} />
        </mesh>
      )}
    </group>
  )
}

// ── 총독부 청사 (style: "hjGovernmentHall") — 1930년대 거대한 석조 관청: 좌우 대칭 날개 + 가운데 기둥 현관 + 돔 탑. 앞면 +z ──
// item.title: 현관 위 이름판 글자 (없으면 안 붙임)
const GRANITE = '#cfc8b8'
// 현관 위 삼각 박공 (밑변 1, 높이 0.22)
const PEDIMENT = new THREE.Shape()
PEDIMENT.moveTo(-0.5, 0)
PEDIMENT.lineTo(0.5, 0)
PEDIMENT.lineTo(0, 0.22)
PEDIMENT.closePath()
const GRANITE_DARK = '#aaa292'
export function HjGovernmentHall({ item }) {
  const [w, h, d] = item.size
  const body = h * 0.5 // 본관 높이
  const floors = 4
  const frontD = d * 0.34
  const backD = d * 0.28
  const wingW = w * 0.16
  const windows = useMemo(() => {
    const list = []
    const cols = Math.round(w / 1.1)
    for (let f = 0; f < floors; f += 1) {
      for (let i = 0; i < cols; i += 1) {
        const x = (i + 0.5 - cols / 2) * (w / cols)
        if (Math.abs(x) < w * 0.13) continue // 가운데 현관 자리
        list.push({ p: [x, 0.9 + (f + 0.5) * ((body - 1.2) / floors), d / 2 + 0.03], s: [0.42, ((body - 1.2) / floors) * 0.55, 0.05] })
      }
    }
    return list
  }, [w, d, body])
  const columns = useMemo(
    () => Array.from({ length: 6 }, (_, i) => ({ p: [(i - 2.5) * ((w * 0.22) / 5), 0.6 + body * 0.32, d / 2 + 1.0], s: [0.22, body * 0.64, 0.22] })),
    [w, d, body],
  )
  return (
    <group>
      {/* 기단 + 앞 계단 */}
      <Box p={[0, 0.3, 0]} s={[w + 0.8, 0.6, d + 0.8]} c={GRANITE_DARK} />
      {[0, 1, 2].map((i) => (
        <Box key={i} p={[0, 0.1 + i * 0.1, d / 2 + 1.9 - i * 0.3]} s={[w * 0.26, 0.2 + i * 0.2, 0.4]} c={GRANITE} />
      ))}
      {/* 日자 모양 본관: 앞 날개 · 뒤 날개 · 좌우 날개 · 가운데 등뼈 (안뜰 2개) */}
      <Box p={[0, 0.6 + body / 2, d / 2 - frontD / 2]} s={[w, body, frontD]} c={GRANITE} />
      <Box p={[0, 0.6 + body / 2, -d / 2 + backD / 2]} s={[w, body, backD]} c={GRANITE} />
      {[-1, 1].map((s) => (
        <Box key={s} p={[s * (w / 2 - wingW / 2), 0.6 + body / 2, 0]} s={[wingW, body, d]} c={GRANITE} />
      ))}
      <Box p={[0, 0.6 + body / 2, 0]} s={[w * 0.18, body, d]} c={GRANITE} />
      {/* 양 끝 튀어나온 모서리 동 (조금 높게) */}
      {[-1, 1].map((s) => (
        <Box key={`c${s}`} p={[s * (w / 2 - wingW / 2), 0.6 + (body + 0.6) / 2, d / 2 - frontD / 2 + 0.25]} s={[wingW + 0.2, body + 0.6, frontD + 0.5]} c={GRANITE} />
      ))}
      {/* 층 띠 + 처마 돌림띠 */}
      {[0.6 + body * 0.27, 0.6 + body + 0.05].map((y) => (
        <Box key={y} p={[0, y, d / 2 + 0.05]} s={[w + 0.15, 0.16, 0.25]} c={GRANITE_DARK} />
      ))}
      <Instances geometry={GEO.box} material={WINDOW_DARK} items={windows} />
      {/* 가운데 현관: 튀어나온 동 + 6개 큰 기둥 + 삼각 박공 */}
      <Box p={[0, 0.6 + (body + 1.2) / 2, d / 2 + 0.2]} s={[w * 0.26, body + 1.2, 0.9]} c={GRANITE} />
      <Instances geometry={GEO.cyl8} material={mat(GRANITE)} items={columns} />
      <Box p={[0, 0.6 + body * 0.66, d / 2 + 1.0]} s={[w * 0.26, 0.3, 0.7]} c={GRANITE_DARK} />
      <mesh position={[0, 0.6 + body * 0.66 + 0.15, d / 2 + 0.7]} scale={[w * 0.27, w * 0.27, 1]} material={mat(GRANITE)}>
        <extrudeGeometry args={[PEDIMENT, { depth: 0.6, bevelEnabled: false }]} />
      </mesh>
      {/* 가운데 돔 탑: 네모 받침 → 둥근 북 → 구리 돔 → 꼭대기 등 */}
      <Box p={[0, 0.6 + body + h * 0.08, 0]} s={[w * 0.2, h * 0.16, w * 0.2]} c={GRANITE} />
      <Cyl p={[0, 0.6 + body + h * 0.16 + h * 0.07, 0]} rad={w * 0.085} h={h * 0.14} c={GRANITE} />
      <Instances
        geometry={GEO.cyl8}
        material={mat(GRANITE_DARK)}
        items={Array.from({ length: 12 }, (_, i) => {
          const a = (i / 12) * Math.PI * 2
          return { p: [Math.sin(a) * w * 0.09, 0.6 + body + h * 0.23, Math.cos(a) * w * 0.09], s: [0.12, h * 0.14, 0.12] }
        })}
      />
      <mesh position={[0, 0.6 + body + h * 0.3, 0]} scale={[w * 0.09, h * 0.14, w * 0.09]} geometry={GEO.dome} material={mat(COPPER, { roughness: 0.5, metalness: 0.35 })} />
      <Cyl p={[0, 0.6 + body + h * 0.47, 0]} rad={0.35} h={0.6} c={GRANITE} geo={GEO.cyl8} />
      <Cone p={[0, 0.6 + body + h * 0.47 + 0.6, 0]} rad={0.4} h={0.6} c={COPPER} />
      {/* 지붕 위 낮은 난간 */}
      <Box p={[0, 0.6 + body + 0.25, d / 2 - 0.15]} s={[w, 0.35, 0.2]} c={GRANITE_DARK} />
      {item.title && (
        <mesh position={[0, 0.6 + body * 0.86, d / 2 + 0.66]}>
          <planeGeometry args={[Math.min(w * 0.22, 4), 0.55]} />
          <meshStandardMaterial map={getSignTexture(item.title, '#2b2a27', '#e6dcc4')} />
        </mesh>
      )}
      <pointLight position={[0, 0.6 + body * 0.4, d / 2 + 2.5]} color="#ffd9a0" intensity={6} distance={10} decay={2} />
    </group>
  )
}
