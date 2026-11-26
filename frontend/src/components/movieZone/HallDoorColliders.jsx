import { CuboidCollider, RigidBody } from '@react-three/rapier'
import { HALL_DOORS, useHallDoors } from './palaceGuide.js'

// [3. 개발 > 프론트엔드] 닫힌 전각 문의 충돌 박스 (혜진 영화·드라마 구역)
// 물리 엔진(Physics) 안에서 그려야 해서 PalaceTourPresence가 함께 그려요. 문이 닫힌 전각만 막아요.
export default function HallDoorColliders() {
  const closed = useHallDoors((s) => s.closed)
  return HALL_DOORS.filter((d) => closed[d.id]).map((d) => (
    <RigidBody key={d.id} type="fixed" colliders={false} name={`HJ/door_${d.id}`}>
      <CuboidCollider args={[d.width / 2, d.height / 2, 0.08]} position={[d.x, d.floor + d.height / 2, d.z]} />
    </RigidBody>
  ))
}
