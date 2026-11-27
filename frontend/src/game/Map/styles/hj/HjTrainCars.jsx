import NearOnly from './HjNearOnly.jsx' // 객차는 가까이 있을 때만 (성능)
import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Ball, Box, Cyl, GEO, Instances, mat } from '../kit.jsx'
import { getSignTexture } from '../textures.js'
import { getLandscapePaintingTexture, getStainedGlassTexture } from './hjTextures.js'
import { registerVehicle, updateVehicleWorld } from '../../../../components/movieZone/rideSeats.js'
import { SeatedPerson } from './HjPeople.jsx'
import { sharedSeconds } from '../../../../components/movieZone/hjSync.js'
import { SEOUL_ARRIVE } from '../../../../components/movieZone/timeTravel.js'

// [3. 개발 > 프론트엔드] 증기기관차 + 객차 2량 (style: "hjSteamTrain") — 혜진 영화·드라마 구역
// 1호 객차: 가운데 통로 + 등받이 높은 마주 보는 나무 의자, 흰 둥근 천장과 갈빗대, 매달린 등
// 2호 라운지차: 나무 판 벽과 팔각 장식, 스테인드글라스 우물 천장, 커튼, 안락의자와 작은 탁자, 스탠드, 피아노, 무늬 바닥
// 터널에서 나와 경성역에 정차(그동안 옆 승강장에서 E로 타기) → 반대편 터널로 들어가요. 앞으로만 달려요.
// 앞 = +z. item.route (아래 설명), item.phase: 출발 시각 차이(초)

const CAR_W = 2.8
const CAR_L = 12
const FLOOR = 0.9 // 객차 바닥 높이 (승강장보다 조금 높음)
const WALL_H = 2.3 // 바닥에서 지붕 시작까지
const COACH_Z = -4.2 // 1호 객차 가운데
const LOUNGE_Z = -16.8 // 2호 라운지차 가운데

const TRAIN_BLACK = mat('#22201f', { roughness: 0.55, metalness: 0.4 })
const TRAIN_RED = mat('#8f2a22', { roughness: 0.6 })
const BODY = '#5a2a22'
const WOOD = '#6b4a2e'
const WOOD_LIGHT = '#a77a4c'
const GLASS = mat('#cfe3ea', { transparent: true, opacity: 0.22, roughness: 0.05 })
const LAMP = mat('#fff3d8', { emissive: '#ffd9a0', emissiveIntensity: 1.1 })
const PARTS = mat('#ffffff', { roughness: 0.8 })
const BRASS = mat('#b8913f', { metalness: 0.7, roughness: 0.35 })
const HIDDEN = new THREE.MeshBasicMaterial({ visible: false })

// 3인칭 카메라가 객차 벽·지붕을 뚫지 않게 (FollowCamera가 이름으로 찾아요). 안에 앉아 있으면 카메라가 안쪽으로 당겨져요
function CameraBlockers({ w, l, floorY, wallH }) {
  return (
    <>
      {[-1, 1].map((s) => (
        <mesh key={s} name="camera-blocker" geometry={GEO.box} material={HIDDEN} position={[s * (w / 2 - 0.02), floorY + wallH / 2, 0]} scale={[0.06, wallH + 0.6, l]} />
      ))}
      <mesh name="camera-blocker" geometry={GEO.box} material={HIDDEN} position={[0, floorY + wallH + 0.6, 0]} scale={[w, 0.06, l]} />
    </>
  )
}

// ── 좌석 자리 (기차 기준) ──
function coachSeats() {
  // 1호 객차: 마주 보는 의자 7줄 × 양쪽 × 2자리. 짝수 줄은 앞(+z), 홀수 줄은 뒤(-z)를 봐요
  const list = []
  for (let i = 0; i < 7; i += 1) {
    const z = COACH_Z - 5.1 + i * 1.7
    const facing = i % 2 === 0 ? 1 : -1
    for (const side of [-1, 1]) {
      for (const k of [0, 1]) {
        const x = side * (0.55 + k * 0.45)
        list.push({ id: `c${i}${side > 0 ? 'r' : 'l'}${k}`, x, y: FLOOR + 0.46, z: z - facing * 0.12, yaw: facing > 0 ? 0 : Math.PI, taken: false })
      }
    }
  }
  return list
}
function loungeSeats() {
  // 2호 라운지차: 창가 안락의자 4쌍 × 양쪽 (작은 탁자를 사이에 두고 마주 봄)
  const list = []
  for (let i = 0; i < 4; i += 1) {
    const zt = LOUNGE_Z - 4.2 + i * 2.6
    for (const side of [-1, 1]) {
      for (const f of [-1, 1]) {
        list.push({ id: `l${i}${side > 0 ? 'r' : 'l'}${f > 0 ? 'b' : 'f'}`, x: side * 0.85, y: FLOOR + 0.45, z: zt - f * 0.75, yaw: f > 0 ? 0 : Math.PI, taken: false })
      }
    }
  }
  return list
}

// item.route: { start, station, end, clip: [min, max] } — 기차 기준점의 z (아이템 기준). 앞으로만 달려요:
//   start(터널 안)에서 나와 station에 정차 → end(반대편 터널 안)로 들어가 사라짐 → 잠시 뒤 start에서 다시 나옴
//   clip 바깥(터널 안)에 있는 칸은 숨겨요. 타고 있는데 객차가 터널로 들어가면 역 승강장에 내려 줘요 (종점)
// item.exitSide: 내리는 쪽 (1 = 차량 기준 +x, -1 = -x) — 승강장이 있는 쪽
const PARTS_Z = { loco: 6.3, coach: COACH_Z, lounge: LOUNGE_Z }
export function HjSteamTrain({ item }) {
  const route = item.route ?? { start: -64, station: -13, end: 68, clip: [-51, 45] }
  const exitSide = item.exitSide ?? 1
  const ref = useRef(null)
  const parts = useRef({})
  const puffs = useRef([])
  const seats = useMemo(() => [...coachSeats(), ...loungeSeats()], [])
  const vehicle = useMemo(() => ({ id: item.id, label: '기차', stopped: true, w: CAR_W, l: 46, reach: 3.6, seats: [] }), [item.id])
  useEffect(() => (item.ride === false ? undefined : registerVehicle(vehicle)), [vehicle, item.ride])
  useFrame(({ clock }) => {
    if (!ref.current) return
    // 터널에서 나와 22초 → 역 정차 16초 → 22초 달려 반대편 터널로 → 8초 뒤 다시
    const IN = 22
    const DWELL = 16
    const OUT = 22
    const GAP = 8
    const period = IN + DWELL + OUT + GAP
    // 모든 화면이 같은 시간표로 움직이게 서버 시각 기준 (혼자 모드면 내 시계)
    const t = (sharedSeconds() + (item.phase ?? 0)) % period
    let pos = route.end
    let stopped = false
    let shown = true
    if (t < IN) {
      const k = t / IN
      pos = route.start + (route.station - route.start) * (1 - (1 - k) * (1 - k)) // 역에 가까울수록 천천히
    } else if (t < IN + DWELL) {
      pos = route.station
      stopped = true
    } else if (t < IN + DWELL + OUT) {
      const k = (t - IN - DWELL) / OUT
      pos = route.station + (route.end - route.station) * k * k // 출발할 때 천천히
    } else shown = false
    ref.current.position.z = pos
    const [lo, hi] = route.clip
    for (const [name, offset] of Object.entries(PARTS_Z)) {
      const g = parts.current[name]
      if (g) g.visible = shown && pos + offset >= lo && pos + offset <= hi
    }
    vehicle.stopped = stopped
    updateVehicleWorld(vehicle, ref.current, seats, [exitSide * (CAR_W / 2 + 1.7), 0.45, COACH_Z])
    if (stopped && vehicle.exit) {
      // 새 배열을 매 프레임 만들지 않고 값만 옮겨 적어요 (GC 끊김 방지)
      vehicle.stationExit ??= [0, 0, 0]
      vehicle.stationExit[0] = vehicle.exit[0]
      vehicle.stationExit[1] = vehicle.exit[1]
      vehicle.stationExit[2] = vehicle.exit[2]
    }
    // 객차가 터널로 들어가면 타고 있던 사람은 역 승강장에 내려 줘요 (palaceSeating.js가 처리)
    const coachIn = shown && pos + COACH_Z >= lo && pos + COACH_Z <= hi
    // 시간 열차(item.destination: "seoul"): 역을 떠나 북악산 터널(gs_tunnel_s)로 들어가면 시간 터널을 지나 2026 현대 서울 승강장에 내려요
    const toSeoul = item.destination === "seoul" && pos > route.station
    vehicle.forceExit = coachIn ? null : toSeoul ? SEOUL_ARRIVE : vehicle.stationExit ?? null
    vehicle.exitTransition = !coachIn && toSeoul ? "toSeoul" : null
    puffs.current.forEach((p, i) => {
      if (!p) return
      const u = (clock.elapsedTime * 0.8 + i / 4) % 1
      p.position.y = 4.9 + u * 2.4
      p.position.z = 10.2 - u * 1.4
      p.scale.setScalar(stopped ? 0.18 + u * 0.25 : 0.4 + u * 0.8)
    })
  })
  const people = seats.filter((s) => s.taken)
  const inCoach = (s) => s.id.startsWith('c')
  return (
    <group ref={ref}>
      <group ref={(el) => (parts.current.loco = el)}>
        <Locomotive />
        {[0, 1, 2, 3].map((i) => (
          <mesh key={i} ref={(el) => (puffs.current[i] = el)} geometry={GEO.sphere} material={mat('#e9e6e0', { transparent: true, opacity: 0.6 })} position={[0, 5, 10.2]} />
        ))}
      </group>
      <group ref={(el) => (parts.current.coach = el)}>
        <NearOnly radius={150} center={[0, 0, COACH_Z]}>
          <PassengerCoach />
        </NearOnly>
        {people.filter(inCoach).map((s, i) => (
          <SeatedPerson key={s.id} look={i * 7 + 3} position={[s.x, s.y, s.z]} yaw={s.yaw} />
        ))}
      </group>
      <group ref={(el) => (parts.current.lounge = el)}>
        <NearOnly radius={150} center={[0, 0, LOUNGE_Z]}>
          <LoungeCar />
        </NearOnly>
        {people.filter((s) => !inCoach(s)).map((s, i) => (
          <SeatedPerson key={s.id} look={i * 5 + 1} position={[s.x, s.y, s.z]} yaw={s.yaw} />
        ))}
      </group>
    </group>
  )
}

// ── 기관차 + 석탄차 ──
function Locomotive() {
  return (
    <group>
      <group position={[0, 0.5, 8.6]}>
        <Box p={[0, 0.4, 0]} s={[2.4, 0.4, 7.6]} m={TRAIN_BLACK} />
        <mesh position={[0, 1.9, 0.9]} rotation={[Math.PI / 2, 0, 0]} material={TRAIN_BLACK}>
          <cylinderGeometry args={[1.0, 1.0, 5.2, 18]} />
        </mesh>
        <Cyl p={[0, 1.9, 3.52]} rad={0.9} h={0.06} c="#4a4644" r={[Math.PI / 2, 0, 0]} />
        <Cyl p={[0, 3.4, 2.6]} rad={0.32} h={1.2} m={TRAIN_BLACK} />
        <Cyl p={[0, 4.05, 2.6]} rad={0.45} h={0.2} m={TRAIN_BLACK} />
        {[0.2, 1.4].map((z) => (
          <mesh key={z} geometry={GEO.dome} material={TRAIN_BLACK} position={[0, 2.85, z]} scale={[0.42, 0.45, 0.42]} />
        ))}
        <Box p={[0, 2.4, -2.4]} s={[2.5, 2.6, 2.2]} m={TRAIN_BLACK} />
        <Box p={[0, 3.8, -2.4]} s={[2.8, 0.2, 2.6]} m={TRAIN_BLACK} />
        {[-1, 1].map((s) => (
          <Box key={s} p={[s * 1.26, 2.6, -2.4]} s={[0.04, 0.9, 1.0]} m={LAMP} />
        ))}
        <Box p={[0, 0.25, 3.95]} s={[2.3, 0.5, 0.5]} m={TRAIN_RED} />
        <Ball p={[0, 1.9, 3.58]} rad={0.18} m={mat('#fff3c4', { emissive: '#ffd27a', emissiveIntensity: 1.4 })} />
        {[-1, 1].flatMap((s) => [-1.8, 0, 1.8].map((z) => <Cyl key={`${s}${z}`} p={[s * 1.1, 0.25, z]} rad={0.65} h={0.14} m={TRAIN_RED} r={[0, 0, Math.PI / 2]} />))}
        {[-1, 1].map((s) => (
          <Box key={`rod${s}`} p={[s * 1.2, 0.25, 0]} s={[0.06, 0.1, 3.8]} c="#9a958c" />
        ))}
      </group>
      <group position={[0, 0.5, 3.9]}>
        <Box p={[0, 1.0, 0]} s={[2.4, 1.5, 2.6]} m={TRAIN_BLACK} />
        <Box p={[0, 1.8, 0]} s={[2.1, 0.2, 2.3]} c="#1a1a1a" />
        {[-1, 1].flatMap((s) => [-0.8, 0.8].map((z) => <Cyl key={`${s}${z}`} p={[s * 1.1, 0.05, z]} rad={0.42} h={0.12} m={TRAIN_BLACK} r={[0, 0, Math.PI / 2]} />))}
      </group>
    </group>
  )
}

// 객차 공통 겉모양 (바퀴·바닥·옆벽·창·지붕·끝 벽). inside: 안쪽 벽 색
function CarShell({ z, inside, upper = '#efe6d2', roofInside = '#f4f0e6', windowsEvery = 1.7 }) {
  const posts = useMemo(() => {
    const list = []
    const n = Math.round(CAR_L / windowsEvery)
    for (const s of [-1, 1]) {
      for (let i = 0; i <= n; i += 1) list.push({ p: [s * (CAR_W / 2 - 0.08), FLOOR + 1.45, -CAR_L / 2 + (CAR_L / n) * i], s: [0.12, 1.1, 0.22], c: inside })
    }
    return list
  }, [inside, windowsEvery])
  const ribs = useMemo(() => Array.from({ length: 13 }, (_, i) => ({ p: [0, FLOOR + WALL_H + 0.42, -CAR_L / 2 + 0.4 + i * ((CAR_L - 0.8) / 12)], s: [1.8, 0.06, 0.08] })), [])
  return (
    <group position={[0, 0, z]}>
      <CameraBlockers w={CAR_W} l={CAR_L} floorY={FLOOR} wallH={WALL_H} />
      {/* 아래 틀 + 바퀴 */}
      <Box p={[0, FLOOR / 2 + 0.05, 0]} s={[CAR_W - 0.4, FLOOR - 0.2, CAR_L - 1]} m={TRAIN_BLACK} />
      {[-1, 1].flatMap((sx) => [-1, 1].flatMap((sz) => [-0.7, 0.7].map((dz) => (
        <Cyl key={`${sx}${sz}${dz}`} p={[sx * 1.0, 0.45, sz * (CAR_L / 2 - 1.8) + dz]} rad={0.42} h={0.12} m={TRAIN_BLACK} r={[0, 0, Math.PI / 2]} />
      ))))}
      <Box p={[0, FLOOR - 0.03, 0]} s={[CAR_W - 0.1, 0.06, CAR_L - 0.1]} c="#5a3d28" />
      {/* 옆벽: 겉(붉은 갈색) + 안 판 + 창 */}
      {[-1, 1].map((s) => (
        <group key={s}>
          <Box p={[s * (CAR_W / 2 - 0.04), FLOOR + 0.45, 0]} s={[0.08, 0.9, CAR_L]} c={BODY} />
          <Box p={[s * (CAR_W / 2 - 0.1), FLOOR + 0.45, 0]} s={[0.04, 0.9, CAR_L - 0.1]} c={inside} />
          <Box p={[s * (CAR_W / 2 - 0.08), FLOOR + 1.45, 0]} s={[0.03, 1.1, CAR_L - 0.1]} m={GLASS} />
          <Box p={[s * (CAR_W / 2 - 0.04), FLOOR + 2.15, 0]} s={[0.08, 0.3, CAR_L]} c={BODY} />
          <Box p={[s * (CAR_W / 2 - 0.1), FLOOR + 2.15, 0]} s={[0.04, 0.3, CAR_L - 0.1]} c={upper} />
          <Box p={[s * (CAR_W / 2 + 0.01), FLOOR + 1.0, 0]} s={[0.04, 0.06, CAR_L]} c="#d8b96a" />
        </group>
      ))}
      <Instances geometry={GEO.box} material={PARTS} items={posts} />
      {/* 지붕: 안 둥근 천장(밝게) + 갈빗대 + 겉 */}
      <mesh position={[0, FLOOR + WALL_H - 1.6, 0]} rotation={[Math.PI / 2, 0, 0]} material={mat(roofInside, { double: true, emissive: roofInside, emissiveIntensity: 0.12 })}>
        <cylinderGeometry args={[2.25, 2.25, CAR_L - 0.2, 20, 1, true, Math.PI - 0.72, 1.44]} />
      </mesh>
      <mesh position={[0, FLOOR + WALL_H - 1.52, 0]} rotation={[Math.PI / 2, 0, 0]} material={mat('#3e3a38')}>
        <cylinderGeometry args={[2.25, 2.25, CAR_L, 20, 1, true, Math.PI - 0.72, 1.44]} />
      </mesh>
      <Instances geometry={GEO.box} material={mat('#e6e0d2')} items={ribs} />
      {/* 앞뒤 끝 벽 (가운데 연결문) */}
      {[1, -1].map((f) => (
        <group key={f} position={[0, 0, f * (CAR_L / 2 - 0.05)]}>
          {[-1, 1].map((k) => (
            <Box key={k} p={[k * (CAR_W / 4 + 0.2), FLOOR + WALL_H / 2 + 0.1, 0]} s={[CAR_W / 2 - 0.4, WALL_H + 0.2, 0.1]} c={BODY} />
          ))}
          <Box p={[0, FLOOR + WALL_H - 0.2, 0]} s={[0.8, 0.6, 0.1]} c={BODY} />
          <Box p={[0, FLOOR + 1.0, -f * 0.02]} s={[0.8, 2.0, 0.04]} c="#3a2a1e" />
          <Box p={[0, FLOOR + 1.45, -f * 0.03]} s={[0.4, 0.6, 0.03]} m={LAMP} />
        </group>
      ))}
    </group>
  )
}

// ── 1호 객차 ──
function PassengerCoach() {
  const benches = useMemo(() => {
    const backs = []
    const seatsTop = []
    for (let i = 0; i < 7; i += 1) {
      const z = COACH_Z - 5.1 + i * 1.7
      const facing = i % 2 === 0 ? 1 : -1
      for (const side of [-1, 1]) {
        const x = side * 0.78
        seatsTop.push({ p: [x, FLOOR + 0.4, z - facing * 0.1], s: [1.0, 0.12, 0.55], c: '#5c4a3a' })
        seatsTop.push({ p: [x, FLOOR + 0.18, z - facing * 0.1], s: [0.95, 0.36, 0.5], c: '#3a2a1e' })
        backs.push({ p: [x, FLOOR + 0.95, z - facing * 0.42], s: [1.0, 1.1, 0.1], c: '#6a5643' })
      }
    }
    return { backs, seatsTop }
  }, [])
  return (
    <group>
      <CarShell z={COACH_Z} inside="#7a6a58" />
      <Instances geometry={GEO.box} material={PARTS} items={benches.seatsTop} />
      <Instances geometry={GEO.box} material={PARTS} items={benches.backs} />
      <Box p={[0, FLOOR + 0.005, COACH_Z]} s={[0.55, 0.01, CAR_L - 0.4]} c="#c9c0ad" />
      {[-4, -1.3, 1.3, 4].map((dz) => (
        <group key={dz} position={[0, FLOOR + WALL_H + 0.15, COACH_Z + dz]}>
          <Cyl p={[0, 0.3, 0]} rad={0.015} h={0.5} c="#2d2b29" geo={GEO.cyl8} />
          <Ball p={[0, 0, 0]} rad={0.13} m={LAMP} />
        </group>
      ))}
      {/* 겉 객차 번호판 */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * (CAR_W / 2 + 0.02), FLOOR + 0.55, COACH_Z]} rotation-y={(s * Math.PI) / 2}>
          <planeGeometry args={[1.4, 0.3]} />
          <meshStandardMaterial map={getSignTexture('3등 객차', '#2a1c12', '#e9d9a8')} />
        </mesh>
      ))}
      <pointLight position={[0, FLOOR + 2.0, COACH_Z]} color="#ffe2b0" intensity={4} distance={9} decay={2} />
    </group>
  )
}

// ── 2호 라운지차 ──
function LoungeCar() {
  const glass = getStainedGlassTexture()
  const painting = getLandscapePaintingTexture('mountain')
  const coffers = useMemo(() => {
    const list = []
    for (let i = 0; i <= 12; i += 1) list.push({ p: [0, FLOOR + WALL_H + 0.38, LOUNGE_Z - CAR_L / 2 + 0.2 + i * ((CAR_L - 0.4) / 12)], s: [1.8, 0.08, 0.08] })
    for (const x of [-0.6, 0.6]) list.push({ p: [x, FLOOR + WALL_H + 0.38, LOUNGE_Z], s: [0.08, 0.08, CAR_L - 0.4] })
    return list
  }, [])
  const chairs = []
  for (let i = 0; i < 4; i += 1) {
    const zt = LOUNGE_Z - 4.2 + i * 2.6
    for (const side of [-1, 1]) {
      chairs.push({ x: side * 0.85, z: zt, side, i })
    }
  }
  return (
    <group>
      <CarShell z={LOUNGE_Z} inside={WOOD_LIGHT} upper={WOOD} roofInside="#d9b88a" windowsEvery={2.6} />
      {/* 무늬 바닥 (가운데 양탄자) */}
      <Box p={[0, FLOOR + 0.008, LOUNGE_Z]} s={[1.4, 0.016, CAR_L - 1.2]} c="#6a3a2e" />
      <Box p={[0, FLOOR + 0.024, LOUNGE_Z]} s={[1.1, 0.016, CAR_L - 1.6]} c="#8f5a3e" />
      {/* 우물 천장 + 스테인드글라스 */}
      <Instances geometry={GEO.box} material={mat('#8a6440')} items={coffers} />
      {[-3.6, -1.2, 1.2, 3.6].map((dz) => (
        <mesh key={dz} position={[0, FLOOR + WALL_H + 0.42, LOUNGE_Z + dz]} rotation-x={Math.PI / 2}>
          <planeGeometry args={[1.1, 2.0]} />
          <meshStandardMaterial map={glass} emissive="#ffffff" emissiveMap={glass} emissiveIntensity={0.7} />
        </mesh>
      ))}
      {/* 안락의자 + 작은 탁자 + 스탠드 + 커튼 */}
      {chairs.map(({ x, z, side, i }) => (
        <group key={`${side}${i}`}>
          {[-1, 1].map((f) => (
            <group key={f} position={[x, FLOOR, z - f * 0.75]} rotation-y={f > 0 ? 0 : Math.PI}>
              <Box p={[0, 0.22, 0]} s={[0.66, 0.44, 0.62]} c={WOOD} />
              <Box p={[0, 0.48, 0.02]} s={[0.6, 0.1, 0.56]} c={(i + side) % 2 ? '#2f4a7a' : '#8f3a3a'} />
              <Box p={[0, 0.85, -0.3]} s={[0.62, 0.75, 0.1]} c={(i + side) % 2 ? '#2f4a7a' : '#8f3a3a'} />
              {[-1, 1].map((k) => (
                <Box key={k} p={[k * 0.33, 0.62, 0]} s={[0.08, 0.3, 0.6]} c={WOOD} />
              ))}
            </group>
          ))}
          <group position={[x + side * 0.15, FLOOR, z]}>
            <Box p={[0, 0.66, 0]} s={[0.6, 0.05, 0.55]} c="#5a3d28" />
            <Cyl p={[0, 0.33, 0]} rad={0.04} h={0.66} c="#3a281c" geo={GEO.cyl8} />
            <Cyl p={[side * 0.18, 0.78, 0]} rad={0.02} h={0.22} m={BRASS} geo={GEO.cyl8} />
            <Ball p={[side * 0.18, 0.95, 0]} rad={0.1} m={LAMP} />
          </group>
          {[-1, 1].map((k) => (
            <Box key={`c${k}`} p={[side * (CAR_W / 2 - 0.14), FLOOR + 1.45, z + k * 0.75]} s={[0.05, 1.2, 0.25]} c="#2f5a5a" />
          ))}
        </group>
      ))}
      {/* 벽 팔각 장식 + 그림 + 벽등 */}
      {[-1, 1].map((s) => (
        <group key={s}>
          {[-2.9, -0.3, 2.3].map((dz) => (
            <group key={dz} position={[s * (CAR_W / 2 - 0.13), FLOOR + 0.55, LOUNGE_Z + dz]} rotation-y={(-s * Math.PI) / 2}>
              <mesh>
                <circleGeometry args={[0.22, 8]} />
                <meshStandardMaterial color="#4a2e1a" />
              </mesh>
              <mesh position={[0, 0, 0.01]}>
                <circleGeometry args={[0.1, 8]} />
                <meshStandardMaterial color="#b8913f" />
              </mesh>
            </group>
          ))}
          {[-4.2, 0, 4.2].map((dz) => (
            <Box key={`l${dz}`} p={[s * (CAR_W / 2 - 0.16), FLOOR + 2.05, LOUNGE_Z + dz]} s={[0.12, 0.22, 0.12]} m={LAMP} />
          ))}
        </group>
      ))}
      {/* 앞쪽 끝: 피아노 + 그림 */}
      <group position={[-0.7, FLOOR, LOUNGE_Z + CAR_L / 2 - 0.75]} rotation-y={Math.PI}>
        <Box p={[0, 0.62, 0]} s={[1.2, 1.24, 0.5]} c="#1a1715" />
        <Box p={[0, 0.78, 0.3]} s={[1.1, 0.05, 0.2]} c="#f2efe6" />
        <Box p={[0, 0.25, 0.55]} s={[0.6, 0.45, 0.35]} c="#1a1715" />
      </group>
      <mesh position={[0.6, FLOOR + 1.5, LOUNGE_Z + CAR_L / 2 - 0.13]} rotation-y={Math.PI}>
        <planeGeometry args={[0.9, 0.6]} />
        <meshStandardMaterial map={painting} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * (CAR_W / 2 + 0.02), FLOOR + 0.55, LOUNGE_Z]} rotation-y={(s * Math.PI) / 2}>
          <planeGeometry args={[1.6, 0.3]} />
          <meshStandardMaterial map={getSignTexture('특별 라운지차', '#2a1c12', '#e9d9a8')} />
        </mesh>
      ))}
      <pointLight position={[0, FLOOR + 2.0, LOUNGE_Z]} color="#ffd9a0" intensity={4} distance={9} decay={2} />
    </group>
  )
}
