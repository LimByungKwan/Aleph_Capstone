import { create } from 'zustand'
import { layout } from '../../game/data/mapData.js'
import { ROOM_SCALE, THRONE } from '../../game/Map/styles/hj/gyeongbokgungLayout.js'
import { PALACE_SEATS } from './palaceInteriorLayout.js'

const palace = layout.props.find(item => item.id === 'HJ/gyeongbokgung')
const SIT_RADIUS = 1.12
const STANDING_OFFSET = 0.91

const seats = palace ? PALACE_SEATS.map((seat) => {
  const [x, y, z] = seat.position.map((value, axis) => value * ROOM_SCALE[axis])
  const yFloor = THRONE.elevation + y
  return {
    ...seat,
    position: [
      palace.position[0] + THRONE.x + x,
      yFloor + STANDING_OFFSET,
      palace.position[1] + THRONE.z + z,
    ],
    yaw: seat.id === 'throne' ? Math.PI : 0,
    surfaceY: yFloor + seat.surfaceOffset * ROOM_SCALE[1],
  }
}) : []

export const usePalaceSeatStore = create((set, get) => ({
  nearby: null,
  seated: null,
  requested: false,
  toggle: () => {
    if (get().seated || get().nearby) set({ requested: true })
  },
  reset: () => set({ nearby: null, seated: null, requested: false }),
}))

// [3. 개발 > 프론트엔드] 착석 중에는 이동 입력만 막고 카메라와 공용 패널 상태는 그대로 둡니다.
export function updatePalaceSeating(player, locked) {
  if (!player.body) return false
  const state = usePalaceSeatStore.getState()
  const position = player.body.translation()
  let nearby = null
  let closest = SIT_RADIUS
  for (const seat of seats) {
    const [x, y, z] = seat.position
    if (Math.abs(position.y - y) > 0.62) continue
    const distance = Math.hypot(position.x - x, position.z - z)
    if (distance < closest) {
      closest = distance
      nearby = seat
    }
  }
  if (state.seated && nearby !== state.seated) {
    usePalaceSeatStore.setState({ nearby, seated: null, requested: false })
    return false
  }
  if (state.requested) {
    if (locked || !nearby || state.seated) {
      usePalaceSeatStore.setState({ nearby, seated: locked ? state.seated : null, requested: false })
      return locked && Boolean(state.seated)
    }
    const [x, y, z] = nearby.position
    player.body.setTranslation({ x, y, z }, true)
    player.body.setLinvel({ x: 0, y: 0, z: 0 }, true)
    usePalaceSeatStore.setState({ nearby, seated: nearby, requested: false })
    return true
  }
  if (state.nearby !== nearby) usePalaceSeatStore.setState({ nearby })
  return Boolean(state.seated)
}
