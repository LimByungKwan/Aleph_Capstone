import { Html, Line } from '@react-three/drei'
import * as THREE from 'three'
import { zones } from '../data/mapData.js'
import { SHOW_ZONE_OWNERS } from '../config.js'
import { labelLayer } from '../labelLayer.js'
import { useSettings } from '../settingsStore.js'

// 구역 표시 (개발용): 대표색 반투명 바닥 + 테두리 선 + 입구 아치 + 큰 이름표
// zones/*.json 파일 하나 = 구역 하나. 파일이 늘면 자동으로 표시돼요.

const FLOOR_Y = 0.19 // 보도블록(0.15) 바로 위
const ARCH_HEIGHT = 5

// 이름표 글자: SHOW_ZONE_OWNERS가 false면(발표용) 담당자 코드 없이 구역 이름만
export function zoneTitle(zone) {
  return SHOW_ZONE_OWNERS ? `${zone.zoneId} · ${zone.name}` : zone.name
}

// 켜고 끄기: 설정창(⚙)의 "구역 표시" (기본값은 config.js의 SHOW_ZONES)
export default function Zones() {
  const showZones = useSettings((state) => state.showZones)
  if (!showZones) return null
  return zones.map((zone) => <ZoneMarker key={zone.zoneId} zone={zone} />)
}

function ZoneMarker({ zone }) {
  const [ox, oz] = zone.origin
  const [w, d] = zone.size
  const border = [
    [ox - w / 2, FLOOR_Y, oz - d / 2],
    [ox + w / 2, FLOOR_Y, oz - d / 2],
    [ox + w / 2, FLOOR_Y, oz + d / 2],
    [ox - w / 2, FLOOR_Y, oz + d / 2],
    [ox - w / 2, FLOOR_Y, oz - d / 2],
  ]

  return (
    <group name={`zone-${zone.zoneId}`}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[ox, FLOOR_Y, oz]}>
        <planeGeometry args={[w, d]} />
        <meshBasicMaterial color={zone.color} transparent opacity={0.18} depthWrite={false} />
      </mesh>
      <Line points={border} color={zone.color} lineWidth={3} />
      {zone.entrance && <EntranceArch zone={zone} />}
    </group>
  )
}

// 구역 입구 아치: 길 양옆 기둥 2개 + 위 가로대 + 이름표 (충돌 없음)
function EntranceArch({ zone }) {
  const [ox, oz] = zone.origin
  const { position, rotationDeg = 0, width = 6 } = zone.entrance
  const half = width / 2 + 0.7
  return (
    <group position={[ox + position[0], 0, oz + position[1]]} rotation={[0, THREE.MathUtils.degToRad(rotationDeg), 0]}>
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * half, ARCH_HEIGHT / 2, 0]} castShadow>
          <boxGeometry args={[0.4, ARCH_HEIGHT, 0.4]} />
          <meshStandardMaterial color={zone.color} />
        </mesh>
      ))}
      <mesh position={[0, ARCH_HEIGHT, 0]} castShadow>
        <boxGeometry args={[half * 2 + 0.6, 0.5, 0.5]} />
        <meshStandardMaterial color={zone.color} />
      </mesh>
      <Html portal={labelLayer} position={[0, ARCH_HEIGHT + 1, 0]} center style={{ pointerEvents: 'none' }}>
        <div
          style={{
            padding: '6px 14px',
            borderRadius: 10,
            background: zone.color,
            color: '#1f2937',
            fontSize: 20,
            fontWeight: 800,
            whiteSpace: 'nowrap',
            boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
          }}
        >
          {zoneTitle(zone)}
        </div>
      </Html>
    </group>
  )
}
