import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { registerVehicle, updateVehicleWorld } from '../../../../components/movieZone/rideSeats.js'
import { usePalaceSeatStore } from '../../../../components/movieZone/palaceSeating.js'
import { HjVintageCar } from './HjGyeongseongStreet.jsx'
import { circleFree } from './driveArea.js'
import { remoteVehicle, sendVehicle } from '../../../../components/movieZone/hjSync.js'

// [3. 개발 > 프론트엔드] 직접 운전하는 클래식 자동차 (style: "hjDrivableCar") — 혜진 영화·드라마 구역
// 차 옆에서 E → 운전석에 앉아요. 운전 중에는 W/↑ 앞으로, S/↓ 브레이크·뒤로, A/D/←/→ 핸들.
// 멈춘 뒤 E로 내려요. 길(driveArea.js)을 벗어나거나 건물·가로등 같은 충돌 박스에 닿으면 부딪혀 멈춰요.
// item.yaw: 처음 바라보는 방향(라디안, 0 = +z). item.color: 차 색.
// item.size[2]는 20으로 둬요 (큰 소품으로 분류돼 멀리 달려가도 숨겨지지 않게)

const ACCEL = 5.5 // m/s²
const BRAKE = 9
const DRAG = 2.2 // 페달을 놓으면 서서히 멈춤
const MAX_FWD = 12 // m/s (약 43km/h)
const MAX_REV = 3.5
const WHEELBASE = 2.7
const MAX_STEER = 0.55
const CAR_Y = 0.1 // 길 바닥 위
const R = 0.9 // 차 앞·뒤 부딪힘 원 반지름
const AXLE = 1.25 // 차 가운데에서 앞·뒤 원까지
const SEAT = [{ id: 'driver', x: -0.35, y: 0.82, z: -0.32, yaw: 0 }] // 낮은 운전석 (머리가 지붕 아래로)

// 운전 키 (드라이브 중일 때만 씀)
const keys = new Set()
if (typeof window !== 'undefined') {
  window.addEventListener('keydown', (e) => keys.add(e.code))
  window.addEventListener('keyup', (e) => keys.delete(e.code))
  window.addEventListener('blur', () => keys.clear())
}
const pressed = (...codes) => codes.some((c) => keys.has(c))

export default function HjDrivableCar({ item }) {
  const [bx, bz] = item.position
  const ref = useRef(null)
  const st = useRef({ x: bx, z: bz, yaw: item.yaw ?? 0, speed: 0, steer: 0, idle: 0 })
  const vehicle = useMemo(() => ({ id: item.id, label: '자동차', stopped: true, w: 1.8, l: 4.4, reach: 1.4, seats: [], driving: true }), [item.id])
  useEffect(() => registerVehicle(vehicle), [vehicle])

  useFrame((_, delta) => {
    const s = st.current
    const dt = Math.min(delta, 0.1)
    const driving = usePalaceSeatStore.getState().seated?.vehicle === vehicle
    // [멀티] 다른 사람이 운전 중이면 그 사람 화면이 보낸 위치를 따라가요 (그동안은 못 타요)
    const remote = driving ? null : remoteVehicle(item.id)
    if (remote) {
      // 0.1초마다 오는 위치로 툭툭 튀지 않게 부드럽게 따라가요 (멀리 떨어져 있으면 바로 옮김)
      const far = Math.hypot(remote.p[0] - s.x, remote.p[2] - s.z) > 8
      const k = far ? 1 : 1 - Math.exp(-12 * dt)
      s.x += (remote.p[0] - s.x) * k
      s.z += (remote.p[2] - s.z) * k
      const dyaw = Math.atan2(Math.sin(remote.r - s.yaw), Math.cos(remote.r - s.yaw))
      s.yaw += dyaw * k
      s.speed = 0
      s.idle = 0
      if (ref.current) {
        ref.current.position.set(s.x - bx, CAR_Y, s.z - bz)
        ref.current.rotation.y = s.yaw
      }
      vehicle.stopped = false
      updateVehicleWorld(vehicle, ref.current, SEAT, [-1.7, 0.1, -0.3])
      return
    }
    // 아무도 안 탄 채 40초가 지나면 처음 자리로 천천히 돌아가요 (새로 들어온 사람·새로고침한 화면과 자리가 같아지게)
    if (!driving) {
      s.idle += dt
      if (s.idle > 40 && (Math.abs(s.x - bx) > 0.05 || Math.abs(s.z - bz) > 0.05)) {
        s.x = bx
        s.z = bz
        s.yaw = item.yaw ?? 0
        s.speed = 0
      }
    } else s.idle = 0
    const up = driving && pressed('KeyW', 'ArrowUp')
    const down = driving && pressed('KeyS', 'ArrowDown')
    const left = driving && pressed('KeyA', 'ArrowLeft')
    const right = driving && pressed('KeyD', 'ArrowRight')
    // 가속·브레이크
    if (up) s.speed += (s.speed < 0 ? BRAKE : ACCEL) * dt
    else if (down) s.speed -= (s.speed > 0 ? BRAKE : ACCEL * 0.6) * dt
    else s.speed -= Math.sign(s.speed) * Math.min(Math.abs(s.speed), DRAG * dt)
    s.speed = Math.max(-MAX_REV, Math.min(MAX_FWD, s.speed))
    // 핸들 (천천히 돌아가고 놓으면 가운데로)
    const target = (left ? 1 : 0) - (right ? 1 : 0)
    s.steer += (target * MAX_STEER - s.steer) * Math.min(1, dt * 6)
    // 다음 자리 (자전거 모델: 앞바퀴 방향으로 회전)
    const yaw = s.yaw + (s.speed / WHEELBASE) * Math.tan(s.steer) * dt
    const x = s.x + Math.sin(yaw) * s.speed * dt
    const z = s.z + Math.cos(yaw) * s.speed * dt
    const fx = Math.sin(yaw) * AXLE
    const fz = Math.cos(yaw) * AXLE
    if (Math.abs(s.speed) > 0.001) {
      if (circleFree(x + fx, z + fz, R, item.id) && circleFree(x - fx, z - fz, R, item.id)) {
        s.x = x
        s.z = z
        s.yaw = yaw
      } else {
        s.speed = -s.speed * 0.15 // 쿵! 살짝 튕기며 멈춤
      }
    }
    if (ref.current) {
      ref.current.position.set(s.x - bx, CAR_Y, s.z - bz)
      ref.current.rotation.y = s.yaw
    }
    vehicle.stopped = Math.abs(s.speed) < 0.3
    vehicle.speed = s.speed
    updateVehicleWorld(vehicle, ref.current, SEAT, [-1.7, 0.1, -0.3])
    // [멀티] 내가 운전 중이면 위치를 보내요
    if (driving) sendVehicle(item.id, [s.x, CAR_Y, s.z], s.yaw)
  })

  return (
    <group ref={ref}>
      <HjVintageCar item={{ color: item.color }} />
    </group>
  )
}
