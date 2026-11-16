import { Grid } from '@react-three/drei'
import { SHOW_GRID } from '../config.js'

// 바닥 판 + (켜져 있으면) 1m 격자
export default function Ground({ ground }) {
  const [width, depth] = ground.size
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[width, depth]} />
        <meshStandardMaterial color={ground.color} />
      </mesh>

      {SHOW_GRID && (
        <Grid
          args={[width, depth]}
          position={[0, 0.16, 0]}
          cellSize={1}
          cellThickness={0.5}
          cellColor="#7d7d7d"
          sectionSize={5}
          sectionThickness={1}
          sectionColor="#4a4a4a"
          fadeDistance={120}
          fadeStrength={1}
        />
      )}
    </group>
  )
}
