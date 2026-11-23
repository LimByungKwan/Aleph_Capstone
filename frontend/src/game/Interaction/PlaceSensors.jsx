import { CylinderCollider, RigidBody } from '@react-three/rapier'
import { mapPlaces } from '../data/mapData.js'
import { useGameStore } from '../../store/gameStore.js'

// 센서 높이 (바닥에서 3m까지). 점프해도 범위 안에 있도록 넉넉하게.
const SENSOR_HALF_HEIGHT = 1.5

// places.json 각 지점에 radius 크기의 "보이지 않는 감지 원기둥"(sensor)을 세움.
// sensor는 부딪히지 않고 통과되며, 들어오고 나가는 것만 알려 줌.
export default function PlaceSensors({ playerRef }) {
  return mapPlaces.map((place) => <PlaceSensor key={place.id} place={place} playerRef={playerRef} />)
}

function PlaceSensor({ place, playerRef }) {
  const [x, y, z] = place.position

  // 들어온 게 캐릭터인지 확인 (다른 물체는 무시)
  const isPlayer = (other) => other.rigidBody && other.rigidBody.handle === playerRef.current?.body.handle

  const handleEnter = ({ other }) => {
    if (isPlayer(other)) useGameStore.getState().setNearby(place.id)
  }

  const handleExit = ({ other }) => {
    if (!isPlayer(other)) return
    // 이미 다른 지점으로 바뀌었으면 건드리지 않음
    if (useGameStore.getState().nearbyPlaceId === place.id) useGameStore.getState().setNearby(null)
  }

  return (
    <RigidBody type="fixed" colliders={false} position={[x, y + SENSOR_HALF_HEIGHT, z]} name={`sensor-${place.id}`}>
      <CylinderCollider
        args={[SENSOR_HALF_HEIGHT, place.radius]}
        sensor
        onIntersectionEnter={handleEnter}
        onIntersectionExit={handleExit}
      />
    </RigidBody>
  )
}
