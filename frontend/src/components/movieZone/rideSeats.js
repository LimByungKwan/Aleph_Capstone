import * as THREE from 'three'

// [3. 개발 > 프론트엔드] 타는 것(전차·기차) 좌석 목록 (혜진 영화·드라마 구역)
// 움직이는 전차·기차가 매 프레임 자기 좌석의 월드 위치를 여기 적어 두면,
// palaceSeating.js가 "타기(E) → 빈자리에 앉기 → 같이 움직이기 → 정차하면 내리기"를 처리해요.
//
// vehicle = {
//   id, label('전차'·'기차'), stopped(정차 중인지), w, l (차체 크기),
//   toLocal(world) → 차량 기준 좌표, exit: [x, y, z] (내릴 자리, 월드),
//   seats: [{ id, label, position:[x,y,z](앉았을 때 몸 위치), surfaceY, yaw, taken(승객이 앉아 있음) }]
// }
export const vehicles = new Map()
if (import.meta.env.DEV) window.__hjVehicles = vehicles // 개발 중 확인용

export function registerVehicle(vehicle) {
  vehicles.set(vehicle.id, vehicle)
  return () => {
    if (vehicles.get(vehicle.id) === vehicle) vehicles.delete(vehicle.id)
  }
}

const STANDING_OFFSET = 0.91 // 앉은 자리 위 몸 중심 높이 (궁궐 좌석과 같은 값)
const tmp = new THREE.Vector3()
const tmpQ = new THREE.Quaternion()
const tmpE = new THREE.Euler()

// 차량 그룹(object)과 차량 기준 좌석 정의로 좌석·내릴 자리의 월드 값을 갱신해요 (매 프레임 호출).
// localSeats: [{ id, x, y(앉는 면 높이), z, yaw, taken }]
export function updateVehicleWorld(vehicle, object, localSeats, exitLocal) {
  if (!object) return
  object.updateWorldMatrix(true, false)
  object.getWorldQuaternion(tmpQ)
  tmpE.setFromQuaternion(tmpQ, 'YXZ')
  const baseYaw = tmpE.y
  if (!vehicle.seats.length) {
    vehicle.seats = localSeats.map((s) => ({ id: `${vehicle.id}/${s.id}`, label: vehicle.label, position: [0, 0, 0], surfaceY: 0, yaw: 0, taken: Boolean(s.taken), vehicle }))
  }
  localSeats.forEach((s, i) => {
    const seat = vehicle.seats[i]
    tmp.set(s.x, s.y, s.z)
    object.localToWorld(tmp)
    seat.surfaceY = tmp.y
    seat.position[0] = tmp.x
    seat.position[1] = tmp.y + STANDING_OFFSET
    seat.position[2] = tmp.z
    seat.yaw = baseYaw + s.yaw
  })
  tmp.set(exitLocal[0], exitLocal[1], exitLocal[2])
  object.localToWorld(tmp)
  // 매 프레임 새 배열·행렬·함수를 만들면 메모리 청소(GC) 때 화면이 끊겨요 → 한 번 만들어 두고 값만 바꿔요
  if (!vehicle.exit) vehicle.exit = [0, 0, 0]
  vehicle.exit[0] = tmp.x
  vehicle.exit[1] = tmp.y
  vehicle.exit[2] = tmp.z
  if (!vehicle._inv) {
    vehicle._inv = new THREE.Matrix4()
    vehicle.toLocal = (x, y, z) => tmp.set(x, y, z).applyMatrix4(vehicle._inv)
  }
  vehicle._inv.copy(object.matrixWorld).invert()
}

// 플레이어 근처에서 탈 수 있는(정차한) 차량 찾기
export function findBoardable(x, y, z) {
  // 여러 대가 가까우면 차체 옆면에 더 가까운 차를 골라요 (섬 승강장 양쪽 기차)
  let best = null
  let bestDist = Infinity
  for (const vehicle of vehicles.values()) {
    if (!vehicle.stopped || !vehicle.toLocal) continue
    const p = vehicle.toLocal(x, y, z)
    const reach = vehicle.reach ?? 1.6 // 차체 옆으로 몇 m까지 "타기"가 뜨는지
    if (Math.abs(p.x) < vehicle.w / 2 + reach && Math.abs(p.z) < vehicle.l / 2 + 1.6 && Math.abs(p.y) < 3) {
      if (vehicle.seats.some((s) => !s.taken) && Math.abs(p.x) < bestDist) {
        best = vehicle
        bestDist = Math.abs(p.x)
      }
    }
  }
  return best
}
