import { Grid } from '@react-three/drei'
import { SHOW_GRID } from '../config.js'
import { SEASON_LOOK, useSeason } from '../seasons.js'

// 바닥 판 + (켜져 있으면) 1m 격자
// ground = { size: [가로, 세로], center: [x, z], color }
export default function Ground({ ground }) {
  const season = useSeason()
  const [width, depth] = ground.size
  const [cx, cz] = ground.center ?? [0, 0]
  return (
    <group position={[cx, 0, cz]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[width, depth]} />
        <meshStandardMaterial color={season === 'spring' ? ground.color : SEASON_LOOK[season].ground} />
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
          fadeDistance={160}
          fadeStrength={1}
        />
      )}
    </group>
  )
}
