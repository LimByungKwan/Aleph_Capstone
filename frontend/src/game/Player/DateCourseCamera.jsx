import { useLayoutEffect, useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { MathUtils, PerspectiveCamera } from 'three'
import { useSettings } from '../settingsStore.js'
import { snapTimeOfDay, blendTimeOfDay } from '../timeOfDay.js'
import { dateIntroPlayback, dateIntroShots, shotAt } from './dateIntroTimeline.js'

export default function DateCourseCamera() {
  const store = useThree((state) => state.get)
  const set = useThree((state) => state.set)
  const camera = useMemo(() => {
    const next = new PerspectiveCamera(45, 1, .2, 2400)
    next.userData.showFullMap = true
    return next
  }, [])

  useLayoutEffect(() => {
    const original = store().camera
    set({ camera })
    return () => {
      dateIntroPlayback.liveShot = null
      if (store().camera === camera) set({ camera: original })
      snapTimeOfDay(useSettings.getState().timeOfDay)
    }
  }, [camera, set, store])

  useFrame(({ size }) => {
    const time = dateIntroPlayback.media?.currentTime ?? 0
    const active = shotAt(time)
    // Set up the camera and lighting behind both title cards.
    const shot = active ?? (time < dateIntroShots[0].start ? dateIntroShots[0] : dateIntroShots.at(-1))
    const t = MathUtils.smoothstep(time, shot.start, shot.end)
    const stride = shot.end - shot.start >= 4 ? 4.6 : 1.05
    const [x, y, z] = shot.eye
    camera.position.set(x + (t - .5) * stride, y + (.5 - t) * stride * .18, z - t * stride * .35)
    camera.lookAt(...shot.target)
    camera.aspect = size.width / Math.max(1, size.height)
    const framing = Math.min(1, camera.aspect / (16 / 9))
    camera.fov = Math.min(115, MathUtils.radToDeg(2 * Math.atan(Math.tan(MathUtils.degToRad(shot.fov / 2)) / framing)))
    camera.updateProjectionMatrix()
    camera.updateMatrixWorld()

    if (shot.light === 'sunset' || shot.light === 'sunrise') {
      const darkness = shot.light === 'sunset' ? t : 1 - t
      if (darkness < .5) blendTimeOfDay('noon', 'morning', darkness * 2)
      else blendTimeOfDay('morning', 'night', darkness * 2 - 1)
    } else {
      snapTimeOfDay(shot.light === 'night' ? 'night' : 'noon')
    }
    dateIntroPlayback.liveShot = active
  }, -2)
  return null
}
