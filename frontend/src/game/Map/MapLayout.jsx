import layout from '../data/buildings.json'
import Ground from './Ground.jsx'
import Zones from './Zones.jsx'
import Prop from './Prop.jsx'

// buildings.json 하나를 읽어서 바닥, 구역, 길, 건물, 소품, 시작 지점을 배치
export default function MapLayout() {
  const [startX, startZ] = layout.playerStart

  return (
    <group name="map">
      <Ground ground={layout.ground} />
      <Zones zones={layout.zones} />

      {layout.roads.map((road) => (
        <Prop key={road.id} item={road} castShadow={false} />
      ))}
      {layout.buildings.map((building) => (
        <Prop key={building.id} item={building} />
      ))}
      {layout.props.map((prop) => (
        <Prop key={prop.id} item={prop} />
      ))}

      {/* 시작 지점: 반투명 초록 캡슐 (사람 키 약 1.7m) */}
      <mesh position={[startX, 0.85, startZ]}>
        <capsuleGeometry args={[0.35, 1.0, 8, 16]} />
        <meshStandardMaterial color="#22c55e" transparent opacity={0.5} />
      </mesh>
    </group>
  )
}
