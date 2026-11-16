import { CuboidCollider, RigidBody } from '@react-three/rapier'
import * as THREE from 'three'
import layout from '../data/buildings.json'

// 눈에 보이는 모델과 별개인 "충돌 전용" 박스들.
// - JSON의 size 그대로 만들어서, 나중에 건물이 GLB로 바뀌어도 충돌 범위는 그대로예요.
// - 길·인도(roads)는 충돌 없음 → 인도 턱(0.15m)은 그냥 걸어서 넘어감
const WALL_HEIGHT = 10
const WALL_THICKNESS = 1

export default function Colliders() {
  const [groundW, groundD] = layout.ground.size
  const halfW = groundW / 2
  const halfD = groundD / 2

  return (
    <group name="colliders">
      {/* 바닥: 윗면이 y=0이 되도록 두께 1m 박스를 아래로 내림 */}
      <RigidBody type="fixed" colliders={false} name="ground">
        <CuboidCollider args={[halfW, 0.5, halfD]} position={[0, -0.5, 0]} />
      </RigidBody>

      {/* 바닥 가장자리 보이지 않는 벽 4면 */}
      <RigidBody type="fixed" colliders={false} name="boundary">
        <CuboidCollider args={[halfW, WALL_HEIGHT / 2, WALL_THICKNESS / 2]} position={[0, WALL_HEIGHT / 2, -halfD - WALL_THICKNESS / 2]} />
        <CuboidCollider args={[halfW, WALL_HEIGHT / 2, WALL_THICKNESS / 2]} position={[0, WALL_HEIGHT / 2, halfD + WALL_THICKNESS / 2]} />
        <CuboidCollider args={[WALL_THICKNESS / 2, WALL_HEIGHT / 2, halfD]} position={[-halfW - WALL_THICKNESS / 2, WALL_HEIGHT / 2, 0]} />
        <CuboidCollider args={[WALL_THICKNESS / 2, WALL_HEIGHT / 2, halfD]} position={[halfW + WALL_THICKNESS / 2, WALL_HEIGHT / 2, 0]} />
      </RigidBody>

      {/* 건물: 충돌 박스 + 카메라가 벽을 뚫지 않게 막아 주는 투명 박스 */}
      {layout.buildings.map((item) => (
        <BoxCollider key={item.id} item={item} blocksCamera />
      ))}

      {/* 소품: 충돌 박스만 (가로등 같은 얇은 기둥에 카메라가 걸리지 않게) */}
      {layout.props.map((item) => (
        <BoxCollider key={item.id} item={item} />
      ))}
    </group>
  )
}

function BoxCollider({ item, blocksCamera = false }) {
  const [x, z] = item.position
  const [w, h, d] = item.size
  const rotationY = THREE.MathUtils.degToRad(item.rotationDeg ?? 0)

  return (
    <RigidBody type="fixed" colliders={false} position={[x, h / 2, z]} rotation={[0, rotationY, 0]} name={`collider-${item.id}`}>
      <CuboidCollider args={[w / 2, h / 2, d / 2]} />
      {blocksCamera && (
        <mesh name="camera-blocker" visible={false}>
          <boxGeometry args={[w, h, d]} />
        </mesh>
      )}
    </RigidBody>
  )
}
