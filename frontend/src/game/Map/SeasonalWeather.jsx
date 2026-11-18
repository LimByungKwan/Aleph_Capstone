import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { DynamicDrawUsage } from 'three'
import { useSeason } from '../seasons.js'

const WEATHER = {
  spring: { count: 48, size: 0.16, color: '#f5afc8', speed: 0.65 },
  autumn: { count: 48, size: 0.19, color: '#c87331', speed: 1.1 },
  winter: { count: 96, size: 0.14, color: '#ffffff', speed: 0.95 },
}

export default function SeasonalWeather({ playerRef }) {
  const season = useSeason()
  const weather = WEATHER[season]
  return weather ? <FallingParticles key={season} weather={weather} playerRef={playerRef} /> : null
}

function FallingParticles({ playerRef, weather }) {
  const points = useRef(null)
  const { count, size, color, speed } = weather
  const positions = useMemo(() => new Float32Array(count * 3), [count])
  const seeds = useMemo(() => Float32Array.from({ length: count * 3 }, () => Math.random()), [count])

  useFrame(({ clock }) => {
    const mesh = points.current
    const position = playerRef.current?.currPos
    if (!mesh) return
    mesh.visible = Boolean(position)
    if (!position) return
    mesh.position.set(position.x, position.y, position.z)
    const time = clock.elapsedTime
    for (let index = 0; index < positions.length; index += 3) {
      positions[index] = (seeds[index] - 0.5) * 26 + Math.sin(time + index) * 0.8
      positions[index + 1] = 8 - ((time * speed + seeds[index + 1] * 10) % 10)
      positions[index + 2] = (seeds[index + 2] - 0.5) * 26
    }
    mesh.geometry.attributes.position.needsUpdate = true
  })

  return (
    <points ref={points} visible={false} frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} usage={DynamicDrawUsage} />
      </bufferGeometry>
      <pointsMaterial color={color} size={size} transparent opacity={0.82} depthWrite={false} />
    </points>
  )
}
