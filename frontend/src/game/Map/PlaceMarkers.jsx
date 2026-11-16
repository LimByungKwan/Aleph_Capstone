import { Html } from '@react-three/drei'
import places from '@shared/places.json'
import Prop from './Prop.jsx'
import { PLACE_COLORS, SHOW_PLACE_LABELS } from '../config.js'
import { labelLayer } from '../labelLayer.js'

const TYPE_LABELS = { spot: '촬영지', cafe: '카페', npc: 'NPC' }

// shared/places.json을 읽어서 상호작용 지점마다
// 바닥 원(radius) + 기둥(NPC는 캡슐) + 이름표를 표시
export default function PlaceMarkers() {
  return places.map((place) => <PlaceMarker key={place.id} place={place} />)
}

function PlaceMarker({ place }) {
  const [x, y, z] = place.position
  const color = PLACE_COLORS[place.type] ?? '#999999'
  const isNpc = place.type === 'npc'
  const labelHeight = isNpc ? 2.3 : 3.4

  return (
    <group position={[x, y, z]} name={place.id}>
      {/* 상호작용 범위 원 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.2, 0]}>
        <circleGeometry args={[place.radius, 48]} />
        <meshBasicMaterial color={color} transparent opacity={0.3} depthWrite={false} />
      </mesh>

      {/* 모델이 있으면 모델, 없으면 기둥 / NPC 캡슐 */}
      {place.model ? (
        <Prop item={{ id: place.id, position: [0, 0], size: [1, 1.8, 1], rotationDeg: 0, color, model: place.model }} />
      ) : isNpc ? (
        <mesh position={[0, 0.85, 0]} castShadow>
          <capsuleGeometry args={[0.35, 1.0, 8, 16]} />
          <meshStandardMaterial color={color} />
        </mesh>
      ) : (
        <mesh position={[0, 1.5, 0]} castShadow>
          <cylinderGeometry args={[0.15, 0.15, 3, 16]} />
          <meshStandardMaterial color={color} />
        </mesh>
      )}

      {SHOW_PLACE_LABELS && (
        <Html portal={labelLayer} position={[0, labelHeight, 0]} center style={{ pointerEvents: 'none' }}>
          <div
            style={{
              padding: '3px 8px',
              borderRadius: 6,
              background: 'rgba(20, 20, 20, 0.75)',
              color: '#fff',
              fontSize: 12,
              whiteSpace: 'nowrap',
              borderLeft: `4px solid ${color}`,
            }}
          >
            <span style={{ color, fontWeight: 700, marginRight: 6 }}>{TYPE_LABELS[place.type]}</span>
            {place.name}
          </div>
        </Html>
      )}
    </group>
  )
}
