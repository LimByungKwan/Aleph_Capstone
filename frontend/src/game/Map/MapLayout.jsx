import layout from '../data/buildings.json'
import Ground from './Ground.jsx'
import Zones from './Zones.jsx'
import Prop from './Prop.jsx'
import { Markings, Road } from './Roads.jsx'

// buildings.json 하나를 읽어서 바닥, 구역, 길, 도로 표시, 건물, 소품, 시작 지점을 배치
export default function MapLayout({ showStartMarker = true }) {
  const [startX, startZ] = layout.playerStart

  return (
    <group name="map">
      <Ground ground={layout.ground} />
      <Zones zones={layout.zones} />

      {layout.roads.map((road) => (
        <Road key={road.id} item={road} />
      ))}
      <Markings markings={layout.markings} />

      {layout.buildings.map((building) => (
        <Prop key={building.id} item={building} />
      ))}
      {layout.props.map((prop) => (
        <Prop key={prop.id} item={prop} />
      ))}

      {/* 시작 지점: 반투명 초록 캡슐 (둘러보기 중에만. 플레이 중엔 캐릭터가 여기 서 있음) */}
      {showStartMarker && (
        <mesh position={[startX, 0.85, startZ]}>
          <capsuleGeometry args={[0.35, 1.0, 8, 16]} />
          <meshStandardMaterial color="#22c55e" transparent opacity={0.5} />
        </mesh>
      )}
    </group>
  )
}
