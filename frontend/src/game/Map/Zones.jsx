import { Html } from '@react-three/drei'
import { SHOW_ZONES } from '../config.js'
import { labelLayer } from '../labelLayer.js'

// 구역(A~D)마다 바닥에 옅은 색 띠와 이름표를 표시
// zone = { id, name, xRange: [시작x, 끝x], zRange: [시작z, 끝z], color }
export default function Zones({ zones }) {
  if (!SHOW_ZONES) return null

  return zones.map((zone) => {
    const [x1, x2] = zone.xRange
    const [z1, z2] = zone.zRange
    const cx = (x1 + x2) / 2
    const cz = (z1 + z2) / 2
    return (
      <group key={zone.id}>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[cx, 0.17, cz]}>
          <planeGeometry args={[x2 - x1, z2 - z1]} />
          <meshBasicMaterial color={zone.color} transparent opacity={0.28} depthWrite={false} />
        </mesh>
        <Html portal={labelLayer} position={[cx, 0.3, 5.6]} center style={{ pointerEvents: 'none' }}>
          <div
            style={{
              padding: '2px 8px',
              borderRadius: 6,
              background: zone.color,
              color: '#222',
              fontSize: 12,
              fontWeight: 700,
              whiteSpace: 'nowrap',
              opacity: 0.9,
            }}
          >
            {zone.name}
          </div>
        </Html>
      </group>
    )
  })
}
