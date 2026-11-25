import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Quaternion, Vector3 } from 'three'
import { Ball, Box, Cone, Cyl, GEO, mat } from '../kit.jsx'
import { registerVehicle, updateVehicleWorld } from '../../../../components/movieZone/rideSeats.js'
import { HjRickshaw } from './HjGyeongseong.jsx'
import { DESTINATIONS, NODES, findPath } from './rickshawRoutes.js'

// [3. 개발 > 프론트엔드] 타는 인력거 (style: "hjRickshawRide") — 혜진 영화·드라마 구역, 1930 경성 거리
// 인력거꾼이 손잡이를 잡고 서 있어요. 옆에서 E로 타면 "어디까지 모실까요?" 하고 목적지를 물어요(RickshawMenu.jsx).
// 고르면 길목(rickshawRoutes.js)을 따라 달려가 도착하면 멈추고, E로 내리거나 다른 곳을 또 고를 수 있어요.
// item.size[2]는 20으로 둬요: 큰 소품으로 분류돼 멀리(중앙 광장·애니메이션 구역) 달려가도 화면에서 숨겨지지 않아요 (MapLayout 거리 생략)
// item.home: 처음 서 있는 길목 id. item.lane: 길목에서 z로 비켜 서는 거리(m) — 인력거끼리 같은 곳에 서도 겹치지 않게
// 인력거 앞 = 차량 기준 +x

const SPEED = 5.5 // m/s (사람이 뛰어서 끄는 속도 — 애니메이션 구역까지 멀어서 조금 빠르게)
const RIDE_Y = 0.14 // 길·광장 바닥(0.06~0.12m)보다 조금 위로 → 바퀴가 바닥에 묻혀 보이지 않게
// 앉는 자리: 뒤로 기운 등받이(앞면 x ≈ -0.55)에 등이 닿도록 조금 뒤쪽에 앉혀요
const SEAT = [{ id: 'seat', x: -0.42, y: 1.0, z: 0, yaw: Math.PI / 2 }]

export default function HjRickshawRide({ item }) {
  const home = item.home ?? 'plaza'
  const lane = item.lane ?? 0
  const at = (id) => [NODES[id].pos[0], NODES[id].pos[1] + lane]
  const [bx, bz] = item.position // 이 아이템 그룹의 월드 위치 (안쪽 그룹을 월드 길목으로 옮겨요)
  const ref = useRef(null)
  const puller = useRef(null)
  const st = useRef({ node: home, path: null, seg: 0, x: at(home)[0], z: at(home)[1], yaw: item.yaw ?? 0, clock: 0 })
  const vehicle = useMemo(
    () => ({
      id: item.id,
      label: '인력거',
      stopped: true,
      w: 3.4, // 차량 기준 x(앞뒤) 길이
      l: 1.6,
      reach: 1.2,
      seats: [],
      destinations: DESTINATIONS.map((id) => ({ id, name: NODES[id].name })),
      node: home,
      trip: null,
      say: null,
      request: null,
    }),
    [item.id, home],
  )
  useEffect(() => registerVehicle(vehicle), [vehicle])

  useFrame((_, delta) => {
    const s = st.current
    const dt = Math.min(delta, 0.25) // 화면이 느려도(프레임이 적어도) 같은 속도로 달리게, 너무 큰 건너뜀만 막아요
    s.clock += dt
    // 손님이 목적지를 골랐어요
    if (vehicle.request && !s.path) {
      const to = vehicle.request
      vehicle.request = null
      const path = findPath(s.node, to)
      if (path.length > 1) {
        s.path = path
        s.seg = 0
        vehicle.stopped = false
        vehicle.trip = to
        vehicle.say = `네, ${NODES[to].name}까지 모시겠습니다!`
      } else vehicle.say = `여기가 바로 ${NODES[to].name}입니다.`
    }
    // 길목을 따라 달리기
    if (s.path) {
      const [tx, tz] = at(s.path[s.seg + 1])
      const dx = tx - s.x
      const dz = tz - s.z
      const d = Math.hypot(dx, dz)
      const step = SPEED * dt
      if (d > 0.01) {
        const target = Math.atan2(-dz, dx)
        let diff = target - s.yaw
        while (diff > Math.PI) diff -= Math.PI * 2
        while (diff < -Math.PI) diff += Math.PI * 2
        s.yaw += diff * Math.min(1, dt * 6)
      }
      if (step >= d) {
        s.x = tx
        s.z = tz
        s.seg += 1
        if (s.seg >= s.path.length - 1) {
          s.node = s.path[s.path.length - 1]
          s.path = null
          vehicle.node = s.node
          vehicle.stopped = true
          vehicle.trip = null
          vehicle.say = `${NODES[s.node].name}에 도착했습니다. 살펴 가세요!`
        }
      } else {
        s.x += (dx / d) * step
        s.z += (dz / d) * step
      }
    }
    if (ref.current) {
      ref.current.position.set(s.x - bx, RIDE_Y, s.z - bz)
      ref.current.rotation.y = s.yaw
    }
    // 인력거꾼: 달릴 때 몸이 위아래로 통통, 다리를 번갈아 내딛어요
    const p = puller.current
    if (p) {
      const run = s.path ? 1 : 0
      p.bob.position.y = run * Math.abs(Math.sin(s.clock * 9)) * 0.03
      const swing = run * Math.sin(s.clock * 9) * 0.55
      p.legL.rotation.z = swing
      p.legR.rotation.z = -swing
    }
    updateVehicleWorld(vehicle, ref.current, SEAT, [0, 0.1, 1.5])
  })

  return (
    <group ref={ref}>
      {/* 손잡이를 허리 높이로 들어 올린 모습 (바퀴 축을 중심으로 앞을 들어요) */}
      <group position={[-0.2, 0.62, 0]} rotation-z={0.22}>
        <group position={[0.2, -0.62, 0]}>
          <HjRickshaw />
        </group>
      </group>
      <Puller ref={puller} position={[1.28, 0, 0]} />
    </group>
  )
}

// ── 인력거꾼 (앞 = +x). 흰 무명 저고리 + 허리띠, 무릎 아래 걷은 바지, 짚신, 챙 넓은 밀짚모자.
//    몸을 살짝 앞으로 숙이고 두 손으로 손잡이 가로대(앞 0.34m, 높이 0.83m)를 잡아요 ──
const SKIN = '#c99a74'
const CLOTH = '#ece5d3'
const UP = new Vector3(0, 1, 0)
const q = new Quaternion()
const v = new Vector3()
function Limb({ from, to, r, c }) {
  const a = new Vector3(...from)
  const b = new Vector3(...to)
  v.subVectors(b, a)
  const len = v.length()
  q.setFromUnitVectors(UP, v.normalize())
  return <mesh geometry={GEO.cyl8} material={mat(c)} position={[(a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2]} quaternion={q.clone()} scale={[r, len, r]} />
}

const Puller = function Puller({ position, ref }) {
  const parts = useRef({})
  // 바깥(HjRickshawRide)에서 다리·몸을 움직일 수 있게 묶음을 넘겨요
  const setRef = (key) => (el) => {
    parts.current[key] = el
    if (ref) ref.current = parts.current
  }
  return (
    <group position={position}>
      {/* 다리 (엉덩이에서 흔들림) */}
      {[
        ['legL', 0.1],
        ['legR', -0.1],
      ].map(([key, z]) => (
        <group key={key} ref={setRef(key)} position={[0, 0.9, z]}>
          <Cyl p={[0, -0.22, 0]} rad={0.085} h={0.44} c={CLOTH} geo={GEO.cyl8} />
          <Cyl p={[0, -0.64, 0]} rad={0.06} h={0.42} c={SKIN} geo={GEO.cyl8} />
          <Box p={[0.05, -0.87, 0]} s={[0.24, 0.05, 0.1]} c="#b89a5a" />
        </group>
      ))}
      <group ref={setRef('bob')}>
        {/* 앞으로 숙인 윗몸 */}
        <group position={[0, 0.9, 0]} rotation-z={-0.28}>
          <Cyl p={[0, 0.3, 0]} rad={0.17} h={0.56} c={CLOTH} />
          <Cyl p={[0, 0.06, 0]} rad={0.18} h={0.1} c="#3a2a20" />
          <Cyl p={[0, 0.62, 0]} rad={0.05} h={0.1} c={SKIN} geo={GEO.cyl8} />
          {/* 머리 + 얼굴 + 밀짚모자 */}
          <group position={[0, 0.78, 0]}>
            <Ball p={[0, 0, 0]} rad={0.12} c={SKIN} />
            {[-0.045, 0.045].map((z) => (
              <Ball key={z} p={[0.105, 0.02, z]} rad={0.016} c="#1c1714" />
            ))}
            <Box p={[0.12, -0.02, 0]} s={[0.03, 0.04, 0.025]} c="#b8876a" />
            <Cyl p={[0, 0.09, 0]} rad={0.3} h={0.025} c="#c9a96b" />
            <Cone p={[0, 0.16, 0]} rad={0.14} h={0.12} c="#c9a96b" />
            <Cyl p={[0, 0.11, 0]} rad={0.145} h={0.03} c="#6b4a2e" />
          </group>
        </group>
        {/* 팔: 어깨 → 손잡이 가로대 */}
        {[0.21, -0.21].map((z) => (
          <group key={z}>
            <Limb from={[0.18, 1.42, z]} to={[0.27, 1.1, z * 1.05]} r={0.055} c={CLOTH} />
            <Limb from={[0.27, 1.1, z * 1.05]} to={[0.34, 0.85, z * 1.1]} r={0.045} c={SKIN} />
            <Ball p={[0.34, 0.83, z * 1.1]} rad={0.05} c={SKIN} />
          </group>
        ))}
      </group>
    </group>
  )
}
