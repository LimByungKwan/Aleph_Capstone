import { useEffect, useMemo, useRef } from 'react'
import { Html } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { CanvasTexture, DynamicDrawUsage, Vector3 } from 'three'
import places from '@shared/places.json'
import { useGameStore } from '../../../../store/gameStore.js'
import { labelLayer } from '../../../labelLayer.js'
import { Box, Cyl } from '../kit.jsx'

// [3. 개발 > 프론트엔드] 영화·드라마 구역 촬영 소품과 클릭 진입점.
const hjPlaces = Object.fromEntries(places.filter((place) => place.zone === 'HJ').map((place) => [place.id, place]))

export function HjStoryCue({ item }) {
  const place = hjPlaces[item.placeId]
  const canInteract = useGameStore((state) => state.nearbyPlaceId === item.placeId && !state.openPanel)
  if (!place || !canInteract) return null
  return (
    <Html portal={labelLayer} position={[0.52, 2.15, 0.30]} center zIndexRange={[12, 0]}>
      <button type="button" className="hj-story-cue" onClick={(event) => {
        event.stopPropagation()
        event.currentTarget.blur()
        const game = useGameStore.getState()
        if (!game.openPanel && game.nearbyPlaceId === place.id) game.open({ type: place.type, placeId: place.id })
      }}>
        {item.text}
      </button>
    </Html>
  )
}

export function HjBlueGate({ item }) {
  const [width, height] = item.size
  return (
    <group>
      <Box p={[0, 0.12, 0]} s={[width + 0.24, 0.24, 0.62]} c="#8e8479" />
      {[-1, 1].map((side) => (
        <group key={side} position={[side * width * 0.48, 0, 0]}>
          <Box p={[0, height * 0.47, 0]} s={[0.27, height * 0.94, 0.52]} c="#978373" />
          <Box p={[0, height * 0.96, 0]} s={[0.38, 0.13, 0.65]} c="#75685f" />
        </group>
      ))}
      {[-1, 1].map((side) => (
        <group key={side} position={[side * width * 0.22, 0, 0]}>
          <Box p={[0, height * 0.43, 0]} s={[width * 0.435, height * 0.78, 0.16]} c="#376d99" />
          {[0.36, 0.67].map((t) => <Box key={t} p={[0, t * height, 0.09]} s={[width * 0.39, 0.07, 0.037]} c="#284d72" />)}
          <Box p={[side * -0.39, height * 0.48, 0.12]} s={[0.12, 0.06, 0.09]} c="#c99659" />
        </group>
      ))}
      <Box p={[0, height * 0.86, 0]} s={[width * 0.93, 0.14, 0.38]} c="#284d72" />
    </group>
  )
}

export function HjHanokBench({ item }) {
  const [width, height, depth] = item.size
  return (
    <group>
      {[-0.39, 0.39].map((side) => <Box key={side} p={[width * side, height * 0.45, 0]} s={[0.16, height * 0.9, depth * 0.8]} c="#6e4933" />)}
      {[-1, 0, 1].map((row) => <Box key={row} p={[0, height - 0.045, depth * row * 0.29]} s={[width, 0.09, depth * 0.28]} c={row === 0 ? '#af7a53' : '#966141'} />)}
    </group>
  )
}

const STEAM_COUNT = 16
function steamTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 32
  const ctx = canvas.getContext('2d')
  const spot = ctx.createRadialGradient(16, 16, 1, 16, 16, 16)
  spot.addColorStop(0, 'rgba(255,245,227,0.65)')
  spot.addColorStop(0.42, 'rgba(255,245,227,0.25)')
  spot.addColorStop(1, 'rgba(255,245,227,0)')
  ctx.fillStyle = spot
  ctx.fillRect(0, 0, 32, 32)
  return new CanvasTexture(canvas)
}

export function HjSnackSteam() {
  const points = useRef(null)
  const location = useMemo(() => new Vector3(), [])
  const texture = useMemo(steamTexture, [])
  const positions = useMemo(() => new Float32Array(STEAM_COUNT * 3), [])
  useEffect(() => () => texture.dispose(), [texture])

  useFrame(({ camera, clock }) => {
    if (!points.current) return
    points.current.getWorldPosition(location)
    points.current.visible = camera.position.distanceToSquared(location) < 900
    if (!points.current.visible) return
    for (let i = 0; i < STEAM_COUNT; i += 1) {
      const life = (clock.elapsedTime * 0.41 + i / STEAM_COUNT) % 1
      positions[i * 3] = (i % 2 ? -0.29 : 0.29) + Math.sin(i * 2 + life * 5) * life * 0.25
      positions[i * 3 + 1] = 1.02 + life * 1.08
      positions[i * 3 + 2] = Math.cos(i * 3 + life * 4) * life * 0.17
    }
    points.current.geometry.attributes.position.needsUpdate = true
  })

  return (
    <group>
      <Box p={[0, 0.46, 0]} s={[1.36, 0.91, 0.66]} c="#684834" />
      <Box p={[0, 0.92, 0]} s={[1.46, 0.09, 0.74]} c="#b38a63" />
      {[-0.29, 0.29].map((x) => <Cyl key={x} p={[x, 1.01, 0]} rad={0.24} h={0.16} c="#525458" />)}
      <points ref={points} visible={false} frustumCulled={false}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[positions, 3]} usage={DynamicDrawUsage} />
        </bufferGeometry>
        <pointsMaterial map={texture} size={0.55} transparent depthWrite={false} opacity={0.65} />
      </points>
    </group>
  )
}
