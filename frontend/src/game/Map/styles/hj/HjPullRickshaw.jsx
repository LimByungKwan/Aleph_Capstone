import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { GEO, mat } from '../kit.jsx'
import { registerVehicle, updateVehicleWorld } from '../../../../components/movieZone/rideSeats.js'
import { usePalaceSeatStore } from '../../../../components/movieZone/palaceSeating.js'
import { lastPlayerPosition } from '../../../../components/movieZone/hjAreas.js'
import { endPull, selfId, usePull } from '../../../../components/movieZone/worldEvents.js'
import { useRealtimeStore } from '../../../../game/multiplayer/realtimeStore.js'
import { useWallet } from '../../../../components/movieZone/wallet.js'

// [3. 개발 > 프론트엔드] 끄는 인력거 (style: "hjPullRickshaw") — 혜진 영화·드라마 구역
// 손님이 뒷자리에 E로 타고 → 근처 사람 한 명에게 "끌어 주세요" 부탁 → 수락하면 그 사람이 끌어요.
// 끄는 사람은 평소처럼 걸어 다니면 돼요: 인력거가 그 사람 바로 뒤(채 길이만큼)를 따라와요.
// 손님을 태우고 끈 거리만큼 끄는 사람에게 코인 (15m마다 1개) → 매표소에서 전차표·기차표로 바꿔요.
// 모든 화면이 "끄는 사람 위치"로 인력거 자리를 계산해서 서로 같은 자리에 보여요 (멀티: worldEvents.js)
// 아무도 안 끌고 손님도 없이 60초가 지나면 처음 자리로 돌아가요.

const SHAFT = 2.3 // 끄는 사람 ↔ 인력거 바퀴 축
const COIN_EVERY = 15 // m
const SEAT = [{ id: 'seat', x: 0, y: 0.95, z: -0.25, yaw: 0 }]
const RED = mat('#7a2a22', { roughness: 0.6 })
const BLACK = mat('#1f1d1c', { roughness: 0.5 })
const WOOD = mat('#8a6440', { roughness: 0.8 })
const HOOD = mat('#2b2a29', { roughness: 0.9, double: true })

export default function HjPullRickshaw({ item }) {
  const [bx, bz] = item.position
  const ref = useRef(null)
  const st = useRef({ x: bx, z: bz, yaw: item.yaw ?? 0, idle: 0, dist: 0, lastX: bx, lastZ: bz, rode: false })
  const vehicle = useMemo(() => ({ id: item.id, label: '끄는 인력거', stopped: true, w: 1.5, l: 2.6, reach: 1.2, seats: [], pullable: true }), [item.id])
  useEffect(() => registerVehicle(vehicle), [vehicle])

  useFrame((_, delta) => {
    const s = st.current
    const dt = Math.min(delta, 0.1)
    const pull = usePull.getState().pulls[item.id]
    const me = selfId()
    const seatedHere = usePalaceSeatStore.getState().seated?.vehicle === vehicle
    // 끄는 사람 위치: 나면 내 몸, 아니면 받은 위치(peers)
    let puller = null
    if (pull) {
      if (pull.puller === me) {
        const p = lastPlayerPosition()
        if (p) puller = { x: p.x, z: p.z }
      } else {
        const state = useRealtimeStore.getState().peers[pull.puller]?.state
        if (state) puller = { x: state[0], z: state[2] }
      }
    }
    if (puller) {
      // 인력거는 끄는 사람 쪽을 바라보고, 채 길이만큼 뒤에 따라와요
      const dx = puller.x - s.x
      const dz = puller.z - s.z
      const d = Math.hypot(dx, dz)
      if (d > 0.05) {
        const want = Math.atan2(dx, dz)
        const dy = Math.atan2(Math.sin(want - s.yaw), Math.cos(want - s.yaw))
        s.yaw += dy * Math.min(1, dt * 6)
      }
      const tx = puller.x - Math.sin(s.yaw) * SHAFT
      const tz = puller.z - Math.cos(s.yaw) * SHAFT
      const k = d > 12 ? 1 : 1 - Math.exp(-10 * dt)
      s.x += (tx - s.x) * k
      s.z += (tz - s.z) * k
      s.idle = 0
      // 끄는 사람이 나 + 손님이 있으면 거리만큼 코인
      if (pull.puller === me && pull.passenger) {
        s.dist += Math.hypot(s.x - s.lastX, s.z - s.lastZ)
        if (s.dist >= COIN_EVERY) {
          const n = Math.floor(s.dist / COIN_EVERY)
          s.dist -= n * COIN_EVERY
          useWallet.getState().earn(n, '인력거 손님 태우기')
        }
      }
    } else {
      // 아무도 안 끌고 아무도 안 탔으면 60초 뒤 처음 자리로
      s.idle = seatedHere ? 0 : s.idle + dt
      if (s.idle > 60 && (Math.abs(s.x - bx) > 0.05 || Math.abs(s.z - bz) > 0.05)) {
        s.x = bx
        s.z = bz
        s.yaw = item.yaw ?? 0
      }
    }
    // 움직이는 중에는 못 내려요 (끄는 사람이 멈추면 E로 내리기)
    const speed = Math.hypot(s.x - s.lastX, s.z - s.lastZ) / Math.max(dt, 1e-3)
    vehicle.stopped = speed < 0.4
    s.lastX = s.x
    s.lastZ = s.z
    if (ref.current) {
      ref.current.position.set(s.x - bx, 0, s.z - bz)
      ref.current.rotation.y = s.yaw
    }
    updateVehicleWorld(vehicle, ref.current, SEAT, [1.4, 0.1, -0.3])
    // 내가 손님이었는데 내렸으면 끌기 끝내요
    if (seatedHere) s.rode = true
    else if (s.rode) {
      s.rode = false
      if (pull && pull.passenger === me) endPull(item.id)
    }
  })

  return (
    <group ref={ref}>
      <RickshawModel />
    </group>
  )
}

// 1930년대 인력거: 큰 바퀴 두 개 + 붉은 좌석 상자 + 접는 검은 차양 + 앞으로 뻗은 긴 채 두 개 (+z가 앞)
function RickshawModel() {
  return (
    <group>
      {[-0.72, 0.72].map((x) => (
        <group key={x} position={[x, 0.68, 0]}>
          <mesh geometry={GEO.cyl} material={BLACK} rotation-z={Math.PI / 2} scale={[0.68, 0.06, 0.68]} />
          <mesh geometry={GEO.cyl8} material={WOOD} rotation-z={Math.PI / 2} scale={[0.1, 0.12, 0.1]} />
          {Array.from({ length: 6 }, (_, i) => (
            <mesh key={i} geometry={GEO.box} material={WOOD} rotation-x={(i / 6) * Math.PI} scale={[0.03, 1.3, 0.04]} />
          ))}
        </group>
      ))}
      <mesh geometry={GEO.box} material={RED} position={[0, 0.85, -0.25]} scale={[1.2, 0.32, 0.9]} />
      <mesh geometry={GEO.box} material={RED} position={[0, 1.3, -0.68]} scale={[1.2, 0.85, 0.1]} />
      <mesh geometry={GEO.box} material={mat('#c9a24a')} position={[0, 1.02, -0.25]} scale={[1.1, 0.06, 0.8]} />
      {/* 접는 차양 (반원통) */}
      <mesh material={HOOD} position={[0, 1.55, -0.45]} rotation={[0, 0, Math.PI / 2]} scale={[0.6, 1.25, 0.6]}>
        <cylinderGeometry args={[1, 1, 1, 12, 1, true, 0, Math.PI]} />
      </mesh>
      {/* 발판 + 채 두 개 + 채 끝 손잡이 */}
      <mesh geometry={GEO.box} material={WOOD} position={[0, 0.55, 0.35]} scale={[0.9, 0.06, 0.5]} />
      {[-0.5, 0.5].map((x) => (
        <group key={x}>
          <mesh geometry={GEO.box} material={WOOD} position={[x, 0.85, 1.2]} rotation-x={0.12} scale={[0.07, 0.07, 2.4]} />
          <mesh geometry={GEO.box} material={BLACK} position={[x, 0.7, 2.35]} scale={[0.09, 0.09, 0.25]} />
        </group>
      ))}
    </group>
  )
}
