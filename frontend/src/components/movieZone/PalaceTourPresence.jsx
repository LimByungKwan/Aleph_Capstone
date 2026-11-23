import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Vector3 } from 'three'
import { labelLayer } from '../../game/labelLayer.js'
import { useGameStore } from '../../store/gameStore.js'
import { usePalaceSeatStore } from './palaceSeating.js'
import { activityAt, isAtPalaceEntrance, isInPalace, palaceGrounds, usePalaceTour } from './palaceTourStore.js'
import { ERA_BOUNDARY, SPECIAL_MARKS, findSpecialMark, specialInteriorAt, specialInteriorPresence } from '../../game/Map/styles/hj/specialAccessLayout.js'
import { getSpecialLocation } from './specialLocations.js'
import { specialAccessAvailable, useSpecialAccess } from './specialAccessStore.js'

const cameraDirection = new Vector3()
const HIDE_PLACE_LABELS = 'data-hj-interior'

function aim(controls, { x,y,z }, yaw) {
  const distance = Math.min(3.1, controls?.maxDistance ?? 3.1)
  const dx = Math.sin(yaw)
  const dz = Math.cos(yaw)
  controls?.setLookAt?.(x-dx*distance,y+.60+distance*.138,z-dz*distance,x,y+.60,z,false)
}

function releaseRoomCamera(entry) {
  if (!entry) return
  const { controls, min, max, distance } = entry
  controls.minDistance = min
  controls.maxDistance = max
  controls.dollyTo(distance, true)
}

function moveTo(body, controls, { x, z, floor, yaw }) {
  const y = floor + 1.01
  const game = useGameStore.getState()
  usePalaceSeatStore.getState().reset()
  if (game.openPanel) game.close()
  if (game.nearbyPlaceId) game.setNearby(null)
  body.setTranslation({ x,y,z }, true)
  body.setLinvel({ x:0,y:0,z:0 }, true)
  body.setAngvel({ x:0,y:0,z:0 }, true)
  aim(controls, { x,y,z }, yaw)
}

export default function PalaceTourPresence({ playerRef }) {
  const cameraLimit = useRef(null)
  useEffect(() => () => {
    releaseRoomCamera(cameraLimit.current)
    cameraLimit.current = null
    specialInteriorPresence.room = null
    labelLayer.current?.removeAttribute(HIDE_PLACE_LABELS)
    usePalaceTour.getState().setPresence(false, false, null)
    useSpecialAccess.getState().reset()
  }, [])

  useFrame(({ controls, camera }) => {
    const body = playerRef.current?.body
    if (!body || !palaceGrounds) return
    const tour = usePalaceTour.getState()
    const position = body.translation()
    const inside = isInPalace(position)
    const atEntrance = isAtPalaceEntrance(position)
    const [originX, originZ] = palaceGrounds.position
    const access = useSpecialAccess.getState()
    const atPalace = inside || atEntrance
    const room = atPalace ? specialInteriorAt(position.x-originX, position.y, position.z-originZ) : null
    if (Boolean(specialInteriorPresence.room) !== Boolean(room)) {
      labelLayer.current?.toggleAttribute(HIDE_PLACE_LABELS, Boolean(room))
    }
    specialInteriorPresence.room = room
    if (cameraLimit.current && (cameraLimit.current.controls !== controls || !room?.camera)) {
      releaseRoomCamera(cameraLimit.current)
      cameraLimit.current = null
    }
    if (room?.camera && controls?.dollyTo) {
      cameraLimit.current ??= { controls, min:controls.minDistance, max:controls.maxDistance, distance:controls.distance }
      controls.minDistance = .9
      controls.maxDistance = room.camera
      if (controls.distance > room.camera+.03) controls.dollyTo(room.camera, true)
    }
    tour.setPresence(inside, atEntrance, inside ? activityAt(position) : null)
    if (atPalace && access.pending && !access.panel && specialAccessAvailable()) {
      const mark = SPECIAL_MARKS[access.pending]
      moveTo(body, controls, { ...mark, x:mark.x + originX, z:mark.z + originZ })
      access.arrived(access.pending, getSpecialLocation(access.pending).era)
      return
    }

    if (atPalace && tour.pending) {
      const stop = tour.pending
      moveTo(body, controls, { x:stop.x + originX, z:stop.z + originZ, floor:stop.elevation, yaw:stop.yaw ?? 0 })
      tour.arrive(stop)
      return
    }

    const z = position.z - originZ
    const era = atPalace ? (z >= ERA_BOUNDARY ? 'colonial' : 'joseon') : null
    const nearby = atPalace ? findSpecialMark(position.x-originX, position.y, z, access.nearby) : null
    access.sync(era, nearby)
    if (access.panel && getSpecialLocation(access.panel)?.mechanicType === 'angle_scan') {
      if (controls?.setLookAt && access.requestedYaw !== null) {
        aim(controls, position, access.requestedYaw * Math.PI/180)
        access.aim(null)
      }
      camera.getWorldDirection(cameraDirection)
      access.setViewYaw(Math.round(Math.atan2(cameraDirection.x,cameraDirection.z)*180/Math.PI))
    }
  })
  return null
}
