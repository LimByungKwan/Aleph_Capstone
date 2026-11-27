import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { CuboidCollider, RigidBody } from '@react-three/rapier'
import * as THREE from 'three'
import { GEO, Instances, mat } from '../kit.jsx'
import { getSignTexture } from '../textures.js'
import { SeatedPerson } from './HjPeople.jsx'
import { registerVehicle, updateVehicleWorld } from '../../../../components/movieZone/rideSeats.js'
import { sharedSeconds } from '../../../../components/movieZone/hjSync.js'
import { zoneToWorld } from '../../../../components/movieZone/hjAreas.js'
import { registerWarpSpot, requestPalaceWarp } from '../../../../components/movieZone/palaceSeating.js'
import { useTimeTravel } from '../../../../components/movieZone/timeTravel.js'

// [3. 개발 > 프론트엔드] 바다 환승역 + 애니메이션 구역 환승 열차 (혜진 영화·드라마 구역)
// 경성역 섬 승강장 남쪽 끝 건널목 → 바다 위 나무 길 → 바다 환승역 부두. 부두 옆 물에 잠긴 선로 위에
// "물빛 환승 열차"가 서 있다가(E로 타기, 기차표 1장) 서쪽 바다로 물을 가르며 달려가요 →
// 바다 끝에서 "바다 건너는 중" 화면 → 애니메이션 구역 바다 열차 안에 내려요 (돌아올 땐 그 열차 안에서 E).
// 좌표는 구역 기준 (hj_drama.json과 같은 기준) → zoneToWorld로 월드.

export const TRANSFER = {
  trackZ: 100.5, // 바다 선로 (구역 기준 z)
  stationX: -68, // 열차가 서는 자리 (가운데 x)
  farX: -165, // 바다 멀리 (여기서 사라졌다 다시 나와요)
  clipX: -127, // 이보다 서쪽이면 숨김 (바다 끝 안개 너머)
  deckY: 0.42, // 나무 길·부두 윗면
}
// 내리는 자리 (palaceSeating이 y에 +1)
export const TRANSFER_ARRIVE = zoneToWorld(-60, TRANSFER.trackZ + 4.6, TRANSFER.deckY)
// 애니메이션 구역 바다 열차 안 (jm_anime.json jm_train_b: 구역 기준 [-74,-130], 바닥 높이 0.9, 원점 [0,-85])
export const ANIME_ARRIVE = [-74, 0.9, -85 - 130.2]

// 나무 길·부두 (보이는 모양 = 충돌): [x0, x1, z0, z1] 구역 기준
const DECKS = [
  [-53.6, -48.1, 77, 79.6], // 섬 승강장 → 2번 선로 건널목 (선로 위 판자)
  [-56.4, -53.4, 76, 107.5], // 바다 위 나무 길 (북쪽으로)
  [-80, -53.4, 103.4, 107.5], // 바다 환승역 부두
]

const P = mat('#ffffff', { roughness: 0.85 })
const BODY_RED = '#7c2f2c'
const BODY_CREAM = '#efe6cf'
const ROOF = '#3d6b5a'
const GLASS = mat('#2f4a55', { transparent: true, opacity: 0.55, roughness: 0.1 })
const LAMP = mat('#fff3c4', { emissive: '#ffd77a', emissiveIntensity: 1.0 })
const SPRAY = mat('#e8f8ff', { transparent: true, opacity: 0.55, roughness: 0.2 })

// ── 부두·나무 길·물에 잠긴 선로 ──
function Piers() {
  const { planks, posts, rails, sleepers } = useMemo(() => {
    const planks = []
    const posts = []
    const rails = []
    const sleepers = []
    const y = TRANSFER.deckY
    for (const [x0, x1, z0, z1] of DECKS) {
      const alongZ = z1 - z0 > x1 - x0
      const n = Math.floor((alongZ ? z1 - z0 : x1 - x0) / 0.5)
      for (let i = 0; i < n; i += 1) {
        const t = (i + 0.5) / n
        planks.push(alongZ
          ? { p: [(x0 + x1) / 2, y - 0.05, z0 + (z1 - z0) * t], s: [x1 - x0, 0.1, 0.46], c: i % 2 ? '#8a6440' : '#7a5636' }
          : { p: [x0 + (x1 - x0) * t, y - 0.05, (z0 + z1) / 2], s: [0.46, 0.1, z1 - z0], c: i % 2 ? '#8a6440' : '#7a5636' })
      }
      // 물 속 기둥 + 난간 말뚝
      const step = 3
      for (let x = x0 + 0.3; x <= x1 - 0.2; x += step) for (const z of [z0 + 0.2, z1 - 0.2]) posts.push({ p: [x, y / 2 - 0.2, z], s: [0.18, y + 0.4, 0.18], c: '#5a4030' })
      for (let z = z0 + 0.3; z <= z1 - 0.2; z += step) for (const x of [x0 + 0.2, x1 - 0.2]) posts.push({ p: [x, y / 2 - 0.2, z], s: [0.18, y + 0.4, 0.18], c: '#5a4030' })
    }
    // 바다 쪽 난간 (부두 남쪽 = 선로 쪽은 열차 타는 곳이라 비워요)
    for (let x = -79.6; x <= -53.8; x += 1.6) posts.push({ p: [x, TRANSFER.deckY + 0.5, 107.3], s: [0.08, 1.0, 0.08], c: '#6b4a2e' })
    rails.push({ p: [-66.7, TRANSFER.deckY + 0.95, 107.3], s: [25.8, 0.07, 0.07], c: '#6b4a2e' })
    for (let z = 77; z <= 103; z += 1.6) posts.push({ p: [-56.2, TRANSFER.deckY + 0.5, z], s: [0.08, 1.0, 0.08], c: '#6b4a2e' })
    rails.push({ p: [-56.2, TRANSFER.deckY + 0.95, 90], s: [0.07, 0.07, 26], c: '#6b4a2e' })
    // 물에 잠긴 선로: 수면(0.11) 바로 아래 → 물 위를 달리는 것처럼 보여요
    for (const dz of [-0.72, 0.72]) rails.push({ p: [(-54 + TRANSFER.farX) / 2, 0.07, TRANSFER.trackZ + dz], s: [Math.abs(TRANSFER.farX + 54), 0.1, 0.09], c: '#6d7177' })
    for (let x = -54.5; x >= -128; x -= 1.1) sleepers.push({ p: [x, 0.02, TRANSFER.trackZ], s: [0.26, 0.08, 2.4], c: '#5a4636' })
    return { planks, posts, rails, sleepers }
  }, [])
  const sign = getSignTexture('🌊 바다 환승역 · 애니메이션 구역행 (기차표 1장)', '#1f4f6b', '#f6efdc', 6)
  const sign2 = getSignTexture('🌊 바다 환승역 → 이쪽 (애니메이션 구역 환승)', '#1f4f6b', '#f6efdc', 6)
  return (
    <>
      <Instances geometry={GEO.box} material={P} items={planks} />
      <Instances geometry={GEO.box} material={P} items={posts} />
      <Instances geometry={GEO.box} material={P} items={rails} />
      <Instances geometry={GEO.box} material={P} items={sleepers} />
      {/* 역 이름판 (부두 가운데) · 건널목 안내판 */}
      <group position={[-66, TRANSFER.deckY + 2.4, 106.8]}>
        <mesh geometry={GEO.box} position={[-2.6, -1.2, 0]} scale={[0.1, 2.4, 0.1]} material={mat('#3b3b3b')} />
        <mesh geometry={GEO.box} position={[2.6, -1.2, 0]} scale={[0.1, 2.4, 0.1]} material={mat('#3b3b3b')} />
        <mesh>
          <planeGeometry args={[5.6, 0.9]} />
          <meshBasicMaterial map={sign} side={THREE.DoubleSide} />
        </mesh>
      </group>
      <group position={[-47.4, 2.0, 79.8]} rotation-y={Math.PI / 2}>
        <mesh geometry={GEO.box} position={[0, -1, 0]} scale={[0.08, 2, 0.08]} material={mat('#3b3b3b')} />
        <mesh position={[0, 0.2, 0.05]}>
          <planeGeometry args={[3.2, 0.5]} />
          <meshBasicMaterial map={sign2} side={THREE.DoubleSide} />
        </mesh>
      </group>
    </>
  )
}

// ── 물빛 환승 열차 (두 칸, 양쪽 운전석) ──
const CAR = 11
const W = 2.6
const FLOOR = 0.9
const SEATS = (() => {
  const list = []
  for (const cx of [-CAR / 2 - 0.3, CAR / 2 + 0.3]) {
    for (let i = 0; i < 4; i += 1) {
      const x = cx - 3.6 + i * 2.4
      for (const side of [-1, 1]) list.push({ id: `${cx > 0 ? 'b' : 'a'}${i}${side > 0 ? 'n' : 's'}`, x, y: FLOOR + 0.45, z: side * 0.85, yaw: side > 0 ? Math.PI : 0, taken: false })
    }
  }
  return list
})()
function CarBody({ cx }) {
  const items = useMemo(() => {
    const b = []
    b.push({ p: [cx, FLOOR - 0.35, 0], s: [CAR, 0.5, W - 0.2], c: '#3a3d42' })
    b.push({ p: [cx, FLOOR - 0.04, 0], s: [CAR, 0.08, W - 0.1], c: '#8a6440' })
    for (const s of [-1, 1]) {
      b.push({ p: [cx, FLOOR + 0.5, s * (W / 2 - 0.05)], s: [CAR, 1.0, 0.1], c: BODY_RED })
      b.push({ p: [cx, FLOOR + 2.15, s * (W / 2 - 0.05)], s: [CAR, 0.5, 0.1], c: BODY_CREAM })
      for (let k = -2; k <= 2; k += 1) b.push({ p: [cx + k * (CAR / 5), FLOOR + 1.45, s * (W / 2 - 0.05)], s: [0.2, 0.9, 0.11], c: BODY_CREAM })
    }
    for (const e of [-1, 1]) b.push({ p: [cx + e * (CAR / 2 - 0.05), FLOOR + 1.2, 0], s: [0.1, 2.4, W], c: BODY_RED })
    b.push({ p: [cx, FLOOR + 2.5, 0], s: [CAR + 0.2, 0.2, W + 0.2], c: ROOF })
    b.push({ p: [cx, FLOOR + 2.7, 0], s: [CAR - 1, 0.2, W - 0.8], c: ROOF })
    // 긴 나무 의자 (양쪽 벽을 따라 마주 보게)
    for (const s of [-1, 1]) {
      b.push({ p: [cx, FLOOR + 0.25, s * 0.95], s: [CAR - 1.2, 0.45, 0.5], c: '#6b3a2a' })
      b.push({ p: [cx, FLOOR + 0.75, s * 1.15], s: [CAR - 1.2, 0.6, 0.08], c: '#6b3a2a' })
    }
    // 바퀴 뭉치 (물속)
    for (const dx of [-CAR / 2 + 2, CAR / 2 - 2]) b.push({ p: [cx + dx, 0.35, 0], s: [2.2, 0.5, W - 0.6], c: '#2a2c30' })
    return b
  }, [cx])
  return (
    <>
      <Instances geometry={GEO.box} material={P} items={items} />
      {[-1, 1].map((s) => (
        <mesh key={s} geometry={GEO.box} material={GLASS} position={[cx, FLOOR + 1.45, s * (W / 2 - 0.04)]} scale={[CAR - 0.3, 0.9, 0.04]} />
      ))}
      {/* 지붕 위 집전기(마름모) */}
      <mesh geometry={GEO.box} material={mat('#2b2a29')} position={[cx, FLOOR + 3.1, 0]} rotation-x={Math.PI / 4} scale={[0.06, 0.7, 0.7]} />
    </>
  )
}
const SCHED = { IN: 16, DWELL: 22, OUT: 16, GAP: 6 }
function SeaTrain() {
  const ref = useRef(null)
  const sprays = useRef([])
  // 열차가 x 방향으로 길어요: findBoardable은 x를 '폭(w)+닿는 거리', z를 '길이(l)'로 재요 → w에 열차 길이, l에 부두까지 닿는 폭
  const vehicle = useMemo(() => ({ id: 'hj_sea_transfer', label: '애니 환승 열차', stopped: true, w: CAR * 2 + 0.6, l: 9, reach: 0, seats: [] }), [])
  useEffect(() => registerVehicle(vehicle), [vehicle])
  const base = useMemo(() => zoneToWorld(0, TRANSFER.trackZ, 0), [])
  useFrame(() => {
    const g = ref.current
    if (!g || !base) return
    const { IN, DWELL, OUT, GAP } = SCHED
    const t = sharedSeconds() % (IN + DWELL + OUT + GAP)
    let x = TRANSFER.farX
    let stopped = false
    let leaving = false
    let shown = true
    if (t < IN) {
      const k = t / IN
      x = TRANSFER.farX + (TRANSFER.stationX - TRANSFER.farX) * (1 - (1 - k) * (1 - k))
    } else if (t < IN + DWELL) {
      x = TRANSFER.stationX
      stopped = true
    } else if (t < IN + DWELL + OUT) {
      const k = (t - IN - DWELL) / OUT
      x = TRANSFER.stationX + (TRANSFER.farX - TRANSFER.stationX) * k * k
      leaving = true
    } else shown = false
    g.position.set(x, 0, 0)
    g.visible = shown && x > TRANSFER.clipX
    // 물보라: 달릴 때 앞뒤로 튀어요
    const moving = !stopped && shown
    sprays.current.forEach((m, i) => {
      if (!m) return
      m.visible = moving
      const u = (sharedSeconds() * 2 + i * 0.37) % 1
      m.scale.setScalar(0.3 + u * 0.6)
      m.position.y = 0.15 + u * 0.5
    })
    vehicle.stopped = stopped
    updateVehicleWorld(vehicle, g, SEATS, [0, TRANSFER.deckY, 3.4]) // 내리는 자리: 부두 (선로 북쪽 3.4m)
    // 바다 끝(안개 너머)으로 들어가면 → "바다 건너는 중" → 애니메이션 구역 바다 열차 안
    const gone = shown && x < TRANSFER.clipX + 4 && leaving
    vehicle.forceExit = gone ? ANIME_ARRIVE : null
    vehicle.exitTransition = gone ? 'toAnime' : null
  })
  const people = SEATS.filter((s) => s.taken)
  return (
    <group position={base ? [base[0], 0, base[2]] : [0, 0, 0]}>
      <group ref={ref}>
        <CarBody cx={-CAR / 2 - 0.3} />
        <CarBody cx={CAR / 2 + 0.3} />
        {/* 앞뒤 전조등 + 행선판 */}
        {[-1, 1].map((e) => (
          <group key={e} position={[e * (CAR + 0.65), FLOOR + 1.0, 0]}>
            <mesh geometry={GEO.sphere} material={LAMP} position={[0, 0.2, 0]} scale={[0.12, 0.18, 0.18]} />
            <mesh position={[e * 0.02, 1.25, 0]} rotation-y={e > 0 ? Math.PI / 2 : -Math.PI / 2}>
              <planeGeometry args={[1.8, 0.36]} />
              <meshBasicMaterial map={getSignTexture('애니메이션 구역', '#1d1f22', '#ffd77a', 5)} />
            </mesh>
          </group>
        ))}
        {/* 물보라 */}
        {[-1, 1].flatMap((e, ei) => [-0.9, 0.9].map((z, zi) => (
          <mesh key={`${e}${z}`} ref={(m) => (sprays.current[ei * 2 + zi] = m)} geometry={GEO.sphere} material={SPRAY} position={[e * (CAR + 0.4), 0.2, z]} />
        )))}
        {people.map((s, i) => (
          <SeatedPerson key={s.id} look={i * 5 + 4} position={[s.x, s.y, s.z]} yaw={s.yaw} />
        ))}
      </group>
    </group>
  )
}

// ── 충돌: 나무 길·부두 바닥 + 2번 선로 옆 둑(가운데 건널목만 비움) ──
export function SeaTransferColliders() {
  const boxes = useMemo(() => {
    const list = []
    for (const [x0, x1, z0, z1] of DECKS) list.push([(x0 + x1) / 2, TRANSFER.deckY / 2, (z0 + z1) / 2, x1 - x0, TRANSFER.deckY, z1 - z0])
    // 부두 바다 쪽 난간·나무 길 바다 쪽 난간 (떨어지지 않게)
    list.push([-66.7, 1.0, 107.6, 26.6, 1.2, 0.2])
    list.push([-56.5, 1.0, 90, 0.2, 1.2, 28])
    return list
  }, [])
  const origin = useMemo(() => zoneToWorld(0, 0, 0), [])
  if (!origin) return null
  return (
    <RigidBody type="fixed" colliders={false} position={[origin[0], 0, origin[2]]} name="HJ/sea_transfer">
      {boxes.map(([x, y, z, w, h, d], i) => (
        <CuboidCollider key={i} args={[w / 2, h / 2, d / 2]} position={[x, y, z]} />
      ))}
    </RigidBody>
  )
}

export default function HjSeaTransfer() {
  const origin = useMemo(() => zoneToWorld(0, 0, 0), [])
  if (!origin) return null
  return (
    <>
      <group position={[origin[0], 0, origin[2]]}>
        <Piers />
      </group>
      <SeaTrain />
    </>
  )
}

// 돌아오기: 애니메이션 구역 바다 열차 안 앞쪽에서 E → "바다를 건너 돌아가는 중" → 경성 바다 환승역 부두 (무료)
registerWarpSpot({
  id: 'anime_back_to_gyeongseong',
  position: [ANIME_ARRIVE[0] + 2, ANIME_ARRIVE[1] + 1, ANIME_ARRIVE[2]],
  radius: 2.4,
  prompt: '🌊 경성 바다 환승역으로 돌아가기',
  action: () => {
    const started = performance.now()
    useTimeTravel.setState({ kind: 'fromAnime', startedAt: started })
    setTimeout(() => TRANSFER_ARRIVE && requestPalaceWarp([TRANSFER_ARRIVE[0], TRANSFER_ARRIVE[1] + 1, TRANSFER_ARRIVE[2]]), 1100)
    setTimeout(() => {
      if (useTimeTravel.getState().startedAt === started) useTimeTravel.getState().clear()
    }, 3200)
  },
})
