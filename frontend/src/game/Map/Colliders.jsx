import { CuboidCollider, CylinderCollider, RigidBody, TrimeshCollider } from '@react-three/rapier'
import { beachBounds, seabed } from './seabed.js'
import * as THREE from 'three'
import { layout, southGroundExtension } from '../data/mapData.js'
import { TerrainColliders } from './Terrain.jsx'
import { GEO } from './styles/kit.jsx'
import { HjHarborCollider } from './styles/hj/HjHarbor.jsx'
import { palaceGroundsColliders } from './styles/hj/gyeongbokgungLayout.js'
import { specialAccessColliders } from './styles/hj/specialAccessLayout.js'

// 눈에 보이는 모델과 별개인 "충돌 전용" 박스들.
// - JSON의 size 그대로 만들어서, 나중에 건물이 GLB로 바뀌어도 충돌 범위는 그대로예요.
// - 길·인도·광장 바닥(roads)도 두께만큼 충돌 → 신발이 바닥 속으로 묻히지 않음
//   (턱이 0.15m 정도라 캐릭터는 그냥 걸어서 올라감)
const WALL_HEIGHT = 10
const WALL_THICKNESS = 1
// 이보다 얇은 바닥(잔디 줄·페인트 등)은 묻혀도 티가 안 나서 충돌을 안 만듦 (물리 계산 절약)
const MIN_FLOOR_THICKNESS = 0.05
// 충돌이 꺼져 있지만(collider: false) 사람이 올라서는 얇은 바닥 소품 → 바닥 충돌을 따로 만듦
const FLOOR_PROP_STYLES = ['roundPlaza', 'terrace']
const floorRoads = layout.roads.filter((item) => item.size?.[1] >= MIN_FLOOR_THICKNESS)
const floorProps = layout.props.filter((item) => FLOOR_PROP_STYLES.includes(item.style) && item.size?.[1] <= 0.4)
const harborProps = layout.props.filter((item) => item.zone === 'HJ' && (
  item.style === 'hjSea' || item.style === 'hjBreakwater' || (item.style === 'hjBoat' && item.moored)
))
const palaceBoxes = layout.props.filter((item) => item.style === 'hjGyeongbokgung')
  .flatMap((item) => [...palaceGroundsColliders(item), ...specialAccessColliders(item)])
const cameraBlockers = [...layout.buildings, ...palaceBoxes.filter((item) => item.blocksCamera)]

function southWallSegments(left, right, southEdge) {
  if (!southGroundExtension) return [[left, right]]
  const [x, z] = southGroundExtension.position
  const [w, , d] = southGroundExtension.size
  if (z - d / 2 >= southEdge || z + d / 2 <= southEdge) return [[left, right]]
  const west = Math.max(left, x - w / 2 + 0.5)
  const east = Math.min(right, x + w / 2 - 0.5)
  return west < east ? [[left, west], [east, right]].filter(([a, b]) => a < b) : [[left, right]]
}

export default function Colliders() {
  const [groundW, groundD] = layout.ground.size
  const [cx, cz] = layout.ground.center ?? [0, 0]
  const halfW = groundW / 2
  const halfD = groundD / 2
  const wallY = WALL_HEIGHT / 2
  const t = WALL_THICKNESS / 2

  return (
    <group name="colliders">
      {/* 바닥: 윗면이 y=0이 되도록 두께 1m 박스를 아래로 내림 */}
      <RigidBody type="fixed" colliders={false} name="ground">
        {[
          [cx-halfW,cx+halfW,cz-halfD,beachBounds[2]],
          [beachBounds[1],cx+halfW,beachBounds[2],cz+halfD],
        ].map(([x0,x1,z0,z1]) =>
          <CuboidCollider key={z0} args={[(x1-x0)/2,.5,(z1-z0)/2]} position={[(x0+x1)/2,-.5,(z0+z1)/2]} />)}
        <TrimeshCollider args={seabed} />
      </RigidBody>

      {/* 바닥 가장자리 보이지 않는 벽 4면 */}
      <RigidBody type="fixed" colliders={false} name="boundary">
        <CuboidCollider args={[halfW, wallY, t]} position={[cx, wallY, cz - halfD - t]} />
        {southWallSegments(cx - halfW, cx + halfW, cz + halfD).map(([from, to]) => (
          <CuboidCollider key={from} args={[(to - from) / 2, wallY, t]} position={[(from + to) / 2, wallY, cz + halfD + t]} />
        ))}
        <CuboidCollider args={[t, wallY, halfD]} position={[cx - halfW - t, wallY, cz]} />
        <CuboidCollider args={[t, wallY, halfD]} position={[cx + halfW + t, wallY, cz]} />
      </RigidBody>

      {/* 건물·소품 충돌 박스: 움직이지 않으니 몸체 하나에 모두 담음 (물리 계산 절약) */}
      <RigidBody type="fixed" colliders={false} name="static-boxes">
        {[...layout.buildings, ...layout.props, ...palaceBoxes].map((item) => (
          <BoxCollider key={item.id} item={item} />
        ))}
      </RigidBody>

      {/* 길·광장 바닥 (윗면 = 눈에 보이는 바닥 높이) */}
      <RigidBody type="fixed" colliders={false} name="floors">
        {floorRoads.map((item) => (
          <BoxCollider key={item.id} item={{ ...item, collider: undefined }} />
        ))}
        {floorProps.map((item) => (
          <FloorPropCollider key={item.id} item={item} />
        ))}
      </RigidBody>

      {harborProps.map((item) => <HjHarborCollider key={item.id} item={item} />)}

      {/* 건물: 카메라가 벽을 뚫지 않게 막아 주는 투명 박스 (소품은 제외 — 가로등 기둥에 카메라가 걸리지 않게) */}
      {cameraBlockers.map((item) => (
        <CameraBlocker key={item.id} item={item} />
      ))}

      {/* 언덕·데크 산책로 */}
      <TerrainColliders />
    </group>
  )
}

// item.collider로 충돌 박스를 따로 정할 수 있어요.
// - 없으면: size 그대로
// - [가로, 높이, 깊이]: 그 크기로 (예: 나무는 줄기만 막기)
// - false: 충돌 없음 (예: 정자·쉘터처럼 안으로 들어갈 수 있는 것)
function colliderBox(item) {
  if (item.collider === false) return null
  const [x, z] = item.position
  const [w, h, d] = item.collider ?? item.size
  const y = (item.elevation ?? 0) + h / 2
  return { position: [x, y, z], rotation: [0, THREE.MathUtils.degToRad(item.rotationDeg ?? 0), 0], size: [w, h, d] }
}

function BoxCollider({ item }) {
  const box = colliderBox(item)
  if (!box) return null
  const [w, h, d] = box.size
  return <CuboidCollider args={[w / 2, h / 2, d / 2]} position={box.position} rotation={box.rotation} />
}

// 둥근 광장은 원기둥, 나머지는 상자
function FloorPropCollider({ item }) {
  const [x, z] = item.position
  const [w, h, d] = item.size
  const y = (item.elevation ?? 0) + h / 2
  if (item.style === 'roundPlaza') return <CylinderCollider args={[h / 2, Math.min(w, d) / 2]} position={[x, y, z]} />
  return <CuboidCollider args={[w / 2, h / 2, d / 2]} position={[x, y, z]} rotation={[0, THREE.MathUtils.degToRad(item.rotationDeg ?? 0), 0]} />
}

function CameraBlocker({ item }) {
  const box = colliderBox(item)
  if (!box) return null
  return (
    <mesh name="camera-blocker" visible={false} position={box.position} rotation={box.rotation} scale={box.size} geometry={GEO.box} />
  )
}
