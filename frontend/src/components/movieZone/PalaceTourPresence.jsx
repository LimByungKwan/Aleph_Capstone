import { useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGameStore } from '../../store/gameStore.js'
import { usePalaceSeatStore } from './palaceSeating.js'
import { activityAt, isAtPalaceEntrance, isInPalace, palaceGrounds, usePalaceTour } from './palaceTourStore.js'

export default function PalaceTourPresence({ playerRef }) {
  useEffect(() => () => usePalaceTour.getState().setPresence(false, false, null), [])

  useFrame(({ controls }) => {
    const body = playerRef.current?.body
    if (!body || !palaceGrounds) return
    const tour = usePalaceTour.getState()
    const position = body.translation()
    const inside = isInPalace(position)
    const atEntrance = isAtPalaceEntrance(position)
    const game = useGameStore.getState()
    tour.setPresence(inside, atEntrance, inside ? activityAt(position) : null)
    if ((!inside && !atEntrance) || !tour.pending) return

    const stop = tour.pending
    const [originX, originZ] = palaceGrounds.position
    const x = originX + stop.x
    const y = stop.elevation + 1.01
    const z = originZ + stop.z
    usePalaceSeatStore.getState().reset()
    if (game.openPanel) game.close()
    if (game.nearbyPlaceId) game.setNearby(null)
    body.setTranslation({ x, y, z }, true)
    body.setLinvel({ x: 0, y: 0, z: 0 }, true)
    body.setAngvel({ x: 0, y: 0, z: 0 }, true)
    const dx = Math.sin(stop.yaw ?? 0)
    const dz = Math.cos(stop.yaw ?? 0)
    controls?.setLookAt?.(x - dx * 3.2, y + .75, z - dz * 3.2, x + dx * .38, y + .25, z + dz * .38, false)
    tour.arrive(stop)
  })
  return null
}
