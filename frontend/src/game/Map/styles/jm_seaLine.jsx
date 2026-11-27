import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Box, GEO, Instances, mat } from './kit.jsx'
import { JmSeaTrain } from './jm_spirit.jsx'
import { layout } from '../../data/mapData.js'
import { sharedSeconds } from '../../../components/movieZone/hjSync.js'
import { registerVehicle, updateVehicleWorld, vehicles } from '../../../components/movieZone/rideSeats.js'
import { usePalaceSeatStore } from '../../../components/movieZone/palaceSeating.js'
import { SeaRideView } from './jm_seaRide.jsx'
import { buildSeaLinePath } from './jm_seaGeometry.js'

// 애니 구역(JM) 바다 철길 — 담당: 지민 (11/26)
// 湯灯駅(애니 구역 북서쪽 바다 위 역) ↔ 바다를 크게 돌아 ↔ 북악산 터널(경복궁 구역 기차 터널 gs_tunnel_s의 북쪽 끝)
//   - 철길 한 줄, 바다 전차 1대가 왕복. 경성역 쪽으로는 나가지 않고 터널 안에서 돌아옴
//   - 터널 안에서 갈아타기: 바다 전차가 터널에 들어가는 순간 = 경복궁 남행 기차가 터널 안에서 출발하는 순간(서버 시계 기준 같은 때)
//     → 타고 있던 손님은 그 기차가 터널 밖으로 나온 뒤 그 기차 좌석으로 옮겨 앉아 경성역까지 감 (바다 쪽은 湯灯 전차, 경성 쪽은 증기기관차 모습)
//   - 경성역 → 바다 방향 갈아타기는 없음: 북쪽 터널로 들어가는 경복궁 기차는 혜진 님 「현대 서울」 시간 열차라서
//   - 혜진 구역 파일은 안 고침. 경복궁 기차 시간표 숫자(아래 HJ_*)는 hj/HjTrainCars.jsx와 같아야 해요
// item.line = { pts: [[x, z], ...] 터널 안 → 湯灯駅 쪽 끝 (아이템 기준 좌표), station: 湯灯駅 서는 점 번호, mouthZ: 터널 바다 쪽 입구 z (아이템 기준) }

const mod = (a, n) => ((a % n) + n) % n
// ── 경복궁 기차 시간표 (hj/HjTrainCars.jsx와 같은 값) ──
const HJ_PERIOD = 68
// 북쪽 터널에서 나와 경성역으로 가는 경복궁 기차: 시간표 시작점이 가장 북쪽(월드 z가 가장 작은)인 기차 (혜진 쪽이 이름·방향을 바꿔도 따라감)
const worldZ = (p, local) => p.position[1] + ((p.rotationDeg ?? 0) % 360 === 180 ? -local : local)
const HJ_SOUTH = (() => {
  const trains = layout.props.filter((p) => p.style === 'hjSteamTrain' && p.route && Math.abs(p.position[0] + 46.6) < 6)
  return [...trains].sort((a, b) => worldZ(a, a.route.start) - worldZ(b, b.route.start))[0] ?? null
})()
export const HJ_SOUTHBOUND = HJ_SOUTH?.id ?? 'HJ/gs_train_2'

// ── 바다 전차 시간표: 136초(경복궁 기차 시간표의 두 배)마다 한 바퀴 ──
// 터널 안에서 기다림(HIDE) → RUN초 달려 湯灯駅 → DWELL초 정차 → RUN초 달려 터널로 들어감(= 경복궁 남행 기차 출발 시각)
const PERIOD = HJ_PERIOD * 2
const RUN = 50
const DWELL = 22
const HIDE = PERIOD - RUN * 2 - DWELL // 14초
const HANDOFF_WINDOW = 12 // 터널에 들어간 뒤 이 시간 안에 경복궁 기차로 옮겨 앉힘
const BRAKE = 60 // 역 앞 이만큼(m)에서 서서히 멈춤 / 출발할 때 이만큼 서서히 빨라짐
const CAR_LEN = 11
const CAR_W = 2.6
const CAR_GAP = 0.2
const RAIL_Y = 0.3 // 레일 윗면 (자갈 둑이 물결 바로 위로 살짝 드러나는 높이 → 바다 위를 달리는 철길)
const POLE_X = 4.5 // 전봇대: 선로 가운데에서 떨어진 거리 (湯灯駅 승강장 반대편)

function makeSchedule(path) {
  const L = path.sStation
  const vc = (L + 2 * BRAKE) / RUN // 달리는 속도 (m/s)
  const ta = (2 * BRAKE) / vc
  const acc = vc / ta
  const trip = (t) => {
    if (t <= 0) return 0
    if (t >= RUN) return L
    if (t < ta) return 0.5 * acc * t * t
    if (t > RUN - ta) return L - 0.5 * acc * (RUN - t) ** 2
    return BRAKE + vc * (t - ta)
  }
  // 경복궁 남행 기차는 시간표 0초에 터널 안 출발점에 있음 → 그때가 내 전차 tau 0 (터널에 막 들어감)
  const shift = mod(-(HJ_SOUTH?.phase ?? 0), HJ_PERIOD)
  // S초 때 전차 상태 → { s(터널 안 0 ~ 湯灯駅 L), dir(+1 = 湯灯駅 쪽으로), stopped, hidden, tau }
  const state = (S) => {
    const tau = mod(S - shift, PERIOD)
    if (tau < HIDE) return { s: 0, dir: 1, stopped: false, hidden: true, tau }
    if (tau < HIDE + RUN) return { s: trip(tau - HIDE), dir: 1, stopped: false, tau }
    if (tau < HIDE + RUN + DWELL) return { s: L, dir: -1, stopped: true, at: 'yuto', tau }
    return { s: trip(PERIOD - tau), dir: -1, stopped: false, tau }
  }
  return { state, vc, shift }
}

// ── 바다 철길 겉모습 ──
const RAIL_M = mat('#2b2622', { roughness: 0.5, metalness: 0.45 })
const SLEEPER_M = mat('#3b2e24')
const BED_M = mat('#77716a', { roughness: 1 })
const POLE_M = mat('#4a3a2c')
const PORTAL_STONE = mat('#8e877b', { roughness: 0.95 })
const PORTAL_RED = mat('#9a3a2a', { roughness: 0.8 })
const PORTAL_DARK = new THREE.MeshBasicMaterial({ color: '#0b0a09' })
const HIDDEN = new THREE.MeshBasicMaterial({ visible: false })

// 레일·전선처럼 선을 따라가는 가는 막대 (윗면 + 양옆)
function stripGeometry(path, from, to, offset, lat, y, w, h) {
  const pos = []
  const idx = []
  const o = {}
  const n = Math.max(2, Math.ceil((to - from) / 1))
  for (let i = 0; i <= n; i++) {
    const s = from + ((to - from) * i) / n
    path.at(s, o)
    const nx = -o.dz
    const nz = o.dx
    const off = offset(s) + lat
    const cx = o.x + nx * off
    const cz = o.z + nz * off
    for (const [k, yy] of [[-1, y], [1, y], [1, y + h], [-1, y + h]]) pos.push(cx + nx * k * (w / 2), yy, cz + nz * k * (w / 2))
    if (i > 0) {
      const a = (i - 1) * 4
      const b = i * 4
      // 윗면(2-3), 바깥 옆면(1-2), 안쪽 옆면(3-0)
      for (const [p, q] of [[3, 2], [2, 1], [0, 3]]) idx.push(a + p, a + q, b + p, b + p, a + q, b + q)
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setIndex(idx)
  g.computeVertexNormals()
  return g
}

function mergeGeometries(list) {
  const pos = []
  const idx = []
  for (const g of list) {
    const base = pos.length / 3
    pos.push(...g.attributes.position.array)
    for (const i of g.index.array) idx.push(base + i)
    g.dispose()
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setIndex(idx)
  g.computeVertexNormals()
  return g
}

function SeaTrack({ path }) {
  const { rails, bed, wire, sleepers, poles, arms } = useMemo(() => {
    const from = path.trackStart
    const to = path.total
    const zero = () => 0
    const sleepers = []
    const o = {}
    const railGeos = [-0.72, 0.72].map((lat) => stripGeometry(path, from, to, zero, lat, RAIL_Y - 0.08, 0.09, 0.08))
    const bed = stripGeometry(path, from, to, zero, 0, -0.2, 3.2, 0.32) // 자갈 둑
    for (let s = from; s <= to; s += 0.9) {
      path.at(s, o)
      sleepers.push({ p: [o.x, RAIL_Y - 0.13, o.z], s: [2.3, 0.1, 0.24], r: [0, Math.atan2(o.dx, o.dz), 0] })
    }
    // 전봇대: 16m마다 한쪽에, 팔은 가운데 위 전선까지
    const poles = []
    const arms = []
    for (let s = from + 10; s <= to; s += 16) {
      path.at(s, o)
      const nx = -o.dz
      const nz = o.dx
      poles.push({ p: [o.x + nx * POLE_X, 3, o.z + nz * POLE_X], s: [0.18, 6, 0.18] })
      arms.push({ p: [o.x + (nx * POLE_X) / 2, 5.6, o.z + (nz * POLE_X) / 2], s: [POLE_X + 0.3, 0.1, 0.1], r: [0, Math.atan2(o.dx, o.dz), 0] })
    }
    const wire = stripGeometry(path, from + 4, to, zero, 0, 5.42, 0.03, 0.03)
    return { rails: mergeGeometries(railGeos), bed, wire, sleepers, poles, arms }
  }, [path])
  useEffect(() => () => { rails.dispose(); bed.dispose(); wire.dispose() }, [rails, bed, wire])
  return (
    <group>
      <mesh geometry={rails} material={RAIL_M} receiveShadow />
      <mesh geometry={bed} material={BED_M} receiveShadow />
      <Instances geometry={GEO.box} material={SLEEPER_M} items={sleepers} />
      <Instances geometry={GEO.box} material={POLE_M} items={poles} castShadow />
      <Instances geometry={GEO.box} material={POLE_M} items={arms} />
      <mesh geometry={wire} material={RAIL_M} />
    </group>
  )
}

// 북악산 기슭 터널 입구 얼굴 (바다 쪽). 앞(-z)이 바다(선이 나아가는 쪽)를 봄
function Portal({ path }) {
  const p = useMemo(() => path.at(path.sMouth, {}), [path])
  const yaw = Math.atan2(-p.dx, -p.dz)
  return (
    <group position={[p.x, 0, p.z]} rotation={[0, yaw, 0]}>
      <Box p={[0, 3.1, -0.1]} s={[9, 6.2, 0.8]} m={PORTAL_STONE} />
      <Box p={[0, 6.35, -0.15]} s={[9.6, 0.35, 1.1]} m={PORTAL_RED} />
      <Box p={[0, 2.3, -0.52]} s={[3.6, 4.6, 0.05]} m={PORTAL_DARK} />
      <mesh position={[0, 4.6, -0.52]} rotation={[0, Math.PI, 0]} material={PORTAL_DARK}>
        <circleGeometry args={[1.8, 18, 0, Math.PI]} />
      </mesh>
      <mesh position={[0, 4.6, -0.55]} rotation={[0, Math.PI, 0]} material={PORTAL_RED}>
        <ringGeometry args={[1.8, 2.25, 18, 1, 0, Math.PI]} />
      </mesh>
      {[-1, 1].map((k) => (
        <Box key={k} p={[k * 2.02, 2.3, -0.56]} s={[0.45, 4.6, 0.12]} m={PORTAL_RED} />
      ))}
    </group>
  )
}

// ── 바다 전차 (두 량, 양쪽 끝이 둥근 앞면) ──
function carSeats() {
  // 북쪽(차량 기준 -x) 긴 붉은 의자에 5자리, 문(+x) 쪽을 보고 앉음
  return [-2.2, -1.1, 0, 1.1, 2.2].map((z, i) => ({ id: `b${i}`, x: -CAR_W / 2 + 0.6, y: 0.9 + 0.51, z, yaw: Math.PI / 2, taken: false }))
}

function moveRider(seat, target) {
  const free = target?.seats?.find((s) => !s.taken)
  if (!free) return false
  seat.taken = false
  free.taken = true
  usePalaceSeatStore.setState({ seated: free, nearby: null, requested: false })
  return true
}

function SeaTrainRun({ item, path, schedule, runs }) {
  const cars = useRef([])
  const carVehicles = useMemo(
    () => [0, 1].map((c) => ({ id: `${item.id}/train/car${c}`, label: '바다 전차', stopped: false, w: CAR_W, l: CAR_LEN, reach: 3, seats: [] })),
    [item.id],
  )
  const seatDefs = useMemo(() => [carSeats(), carSeats()], [])
  useEffect(() => {
    const off = carVehicles.map((v) => registerVehicle(v))
    return () => off.forEach((f) => f())
  }, [carVehicles])
  const tmp = useMemo(() => ({ o: {} }), [])
  useFrame(() => {
    const st = schedule.state(sharedSeconds())
    for (let c = 0; c < 2; c++) {
      const g = cars.current[c]
      if (!g) continue
      // c=0: 湯灯駅 쪽 칸, c=1: 터널 쪽 칸. 터널 입구보다 안쪽에 가운데가 들어간 칸은 숨김
      const sc = st.s + (c === 0 ? 1 : -1) * (CAR_LEN / 2 + CAR_GAP / 2)
      const o = path.at(sc, tmp.o)
      g.position.set(o.x, RAIL_Y, o.z)
      g.rotation.y = Math.atan2(o.dx, o.dz)
      g.visible = !st.hidden && sc > path.sMouth
      const v = carVehicles[c]
      v.stopped = st.stopped
      updateVehicleWorld(v, g, seatDefs[c], [CAR_W / 2 + 1.7, 0.6, 0])
    }
    // 터널에 들어간 손님 → 경복궁 남행 기차로. 그 기차 객차가 아직 터널 안이면 혜진 쪽 코드가 손님을 역에 내려 버려서(forceExit)
    //   객차가 밖으로 나온 뒤(forceExit 없음) 옮김. 그동안은 터널 안 내 전차에 그대로 앉아 있음
    //   경복궁 기차가 없으면(구역을 안 불러옴 등) 그대로 타고 있다가 다시 湯灯駅으로 돌아감
    const seated = usePalaceSeatStore.getState().seated
    if (st.hidden && st.tau < HANDOFF_WINDOW && seated?.vehicle && carVehicles.includes(seated.vehicle)) {
      const hj = vehicles.get(HJ_SOUTHBOUND)
      if (hj && hj.seats.length && !hj.forceExit && !hj.stopped) moveRider(seated, hj)
    }
    // 탈 때 화면 연출(jm_seaRide.jsx)이 읽는 값
    path.at(st.s, tmp.o)
    runs[0] = { cars: cars.current, vehicles: carVehicles, st, dx: tmp.o.dx, dz: tmp.o.dz }
  })
  return (
    <>
      {[0, 1].map((c) => (
        <group key={c} ref={(el) => (cars.current[c] = el)}>
          <JmSeaTrain item={{ size: [CAR_W, 3.4, CAR_LEN], floor: 0.9, head: c === 0 ? 1 : -1, sign: item.sign ?? '湯灯' }} />
          {/* 3인칭 카메라가 차 벽·지붕을 뚫지 않게 (FollowCamera가 이름으로 찾음) */}
          {[-1, 1].map((s) => (
            <mesh key={s} name="camera-blocker" geometry={GEO.box} material={HIDDEN} position={[s * (CAR_W / 2 - 0.02), 0.9 + 1.4, 0]} scale={[0.06, 3.2, CAR_LEN]} />
          ))}
          <mesh name="camera-blocker" geometry={GEO.box} material={HIDDEN} position={[0, 0.9 + 2.9, 0]} scale={[CAR_W, 0.06, CAR_LEN]} />
        </group>
      ))}
    </>
  )
}

export function JmSeaLine({ item }) {
  const path = useMemo(() => buildSeaLinePath(item.line), [item.line])
  const schedule = useMemo(() => makeSchedule(path), [path])
  const runs = useMemo(() => [null], [])
  if (import.meta.env.DEV) window.__jmSeaLine = { path, schedule, runs }
  return (
    <group>
      <SeaTrack path={path} />
      <Portal path={path} />
      <SeaTrainRun item={item} path={path} schedule={schedule} runs={runs} />
      <SeaRideView runs={runs} path={path} />
    </group>
  )
}

// ── 땅 메우기: 바다 윤곽(jm_ocean)을 서쪽으로 민 자리에 맵 바깥 풀밭과 같은 색 땅 ──
// item.fill.pts: [[x, z], ...] 아이템 기준 다각형. 물(jmOcean)·모래가 이 위에 그려지도록 깊이를 살짝 뒤로 (jm_water.jsx OCEAN_M이 더 앞)
const FILL_M = new THREE.MeshStandardMaterial({ color: '#789957', roughness: 1, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 })
export function JmLandFill({ item }) {
  const geo = useMemo(() => {
    const shape = new THREE.Shape(item.fill.pts.map(([x, z]) => new THREE.Vector2(x, -z)))
    const g = new THREE.ShapeGeometry(shape)
    g.rotateX(-Math.PI / 2)
    return g
  }, [item.fill])
  useEffect(() => () => geo.dispose(), [geo])
  return <mesh geometry={geo} material={FILL_M} position={[0, item.fill.y ?? 0.044, 0]} receiveShadow userData={{ noMerge: true }} />
}

export const JM_SEALINE_STYLES = { jmSeaLine: JmSeaLine, jmLandFill: JmLandFill }
