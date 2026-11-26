import { create } from 'zustand'
import { layout } from '../../game/data/mapData.js'
import { PALACE_SEATS, THRONE_ROOM_POSITION } from './palaceInteriorLayout.js'
import { findBoardable } from './rideSeats.js'
import { trackHjArea } from './hjAreas.js'

const palace = layout.props.find(item => item.id === 'HJ/haewol_palace')
const SIT_RADIUS = 1.12
const STANDING_OFFSET = 0.91

const seats = palace ? PALACE_SEATS.map((seat) => {
  const [w, h, d] = palace.size
  const [x, y, z] = seat.position.map((value, axis) => value + THRONE_ROOM_POSITION[axis])
  const yaw = (palace.rotationDeg ?? 0) * Math.PI / 180
  const [localX, localZ] = [x * w / 53, z * d / 53]
  return {
    ...seat,
    position: [
      palace.position[0] + localX * Math.cos(yaw) + localZ * Math.sin(yaw),
      (palace.elevation ?? 0) + y * h / 9 + STANDING_OFFSET,
      palace.position[1] - localX * Math.sin(yaw) + localZ * Math.cos(yaw),
    ],
    yaw: yaw + (seat.id === 'throne' ? Math.PI : 0),
    surfaceY: (palace.elevation ?? 0) + (y + seat.surfaceOffset) * h / 9,
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

// 탈것에 타 있는 동안은 몸통 위치를 물리 힘으로 못 움직이게 잠가요 (자리 위치는 매 프레임 직접 옮김)
function lockRide(player, locked) {
  player.body.lockTranslations?.(locked, true)
}

// [3. 개발 > 프론트엔드] 순간 이동 요청 (경복궁 안내판에서 전각을 고르면 그 앞으로 옮겨 줘요)
// 다음 프레임에 updatePalaceSeating이 캐릭터를 옮겨요. 앉아 있거나 탈것을 타고 있으면 무시해요.
let pendingWarp = null
export function requestPalaceWarp(position) {
  pendingWarp = position
}

// 앉는 자리 더하기 (사정전 용상·의자 등). { id, label, position:[x, 서 있을 때 몸통 y, z], yaw, surfaceY(좌판 윗면) }
export function registerPalaceSeat(seat) {
  if (!seats.some((s) => s.id === seat.id)) seats.push(seat)
}

// 오르내리는 자리 등록: { id, position:[x,y,z](캐릭터 몸통 높이), radius, prompt, warpTo:[x,y,z] }
const warpSpots = []
export function registerWarpSpot(spot) {
  if (!warpSpots.some((s) => s.id === spot.id)) warpSpots.push(spot)
}

// [3. 개발 > 프론트엔드] 착석 중에는 이동 입력만 막고 카메라와 공용 패널 상태는 그대로 둡니다.
export function updatePalaceSeating(player, locked) {
  // 맵을 다시 불러오는 동안에는 몸통(body)이 아직 없을 수 있어요 → 그 프레임은 건너뜀
  if (!player?.body) return false
  // 개발 중 확인용: 콘솔에서 window.__hjPlayer.body.setTranslation(...)으로 캐릭터를 옮길 수 있어요 (배포 빌드엔 없음)
  if (import.meta.env.DEV) window.__hjPlayer = player
  const state = usePalaceSeatStore.getState()
  if (pendingWarp) {
    if (!state.seated) {
      const [wx, wy, wz] = pendingWarp
      player.body.setTranslation({ x: wx, y: wy, z: wz }, true)
      player.body.setLinvel({ x: 0, y: 0, z: 0 }, true)
    }
    pendingWarp = null
  }
  const position = player.body.translation()
  trackHjArea(position) // 경복궁·경성거리에 들어오면 입장 카드

  // ── 전차·기차에 타고 있을 때: 좌석을 따라 같이 움직이고, 정차했을 때만 내릴 수 있어요 ──
  if (state.seated?.vehicle) {
    const seat = state.seated
    const vehicle = seat.vehicle
    // 종점(터널)에 들어가면 자동으로 역 승강장에 내려 줘요
    if (vehicle.forceExit) {
      const [fx, fy, fz] = vehicle.forceExit
      seat.taken = false
      lockRide(player, false)
      player.body.setTranslation({ x: fx, y: fy + 1, z: fz }, true)
      player.body.setLinvel({ x: 0, y: 0, z: 0 }, true)
      usePalaceSeatStore.setState({ nearby: null, seated: null, requested: false })
      return false
    }
    if (state.requested) {
      if (vehicle.stopped && vehicle.exit) {
        const [ex, ey, ez] = vehicle.exit
        seat.taken = false
        lockRide(player, false)
        player.body.setTranslation({ x: ex, y: ey + 1, z: ez }, true)
        player.body.setLinvel({ x: 0, y: 0, z: 0 }, true)
        usePalaceSeatStore.setState({ nearby: null, seated: null, requested: false })
        return false
      }
      usePalaceSeatStore.setState({ requested: false })
    }
    const [sx, sy, sz] = seat.position
    player.body.setTranslation({ x: sx, y: sy, z: sz }, true)
    player.body.setLinvel({ x: 0, y: 0, z: 0 }, true)
    return true
  }
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
  // 궁궐 좌석이 없으면, 정차한 전차·기차 옆인지 확인 (E → 빈자리에 앉기)
  if (!nearby && !state.seated) {
    const vehicle = findBoardable(position.x, position.y, position.z)
    if (vehicle) {
      vehicle.boardHint ??= { label: vehicle.label, prompt: `${vehicle.label} 타기`, board: vehicle }
      nearby = vehicle.boardHint
    }
  }
  // 오르내리는 자리 (향원정 안쪽 계단 등): 가까이 가면 "E 2층으로 올라가기" → 위층으로 옮겨 줘요
  if (!nearby && !state.seated) {
    for (const spot of warpSpots) {
      const [x, y, z] = spot.position
      if (Math.abs(position.y - y) < 0.9 && Math.hypot(position.x - x, position.z - z) < spot.radius) {
        nearby = spot
        break
      }
    }
  }
  // 문 열고 닫기처럼 그 자리에서 하는 일 (E 한 번). 한 프레임 비웠다가 다시 잡아 안내 문구가 바뀌게 해요
  if (nearby?.action && state.requested && !locked) {
    nearby.action()
    usePalaceSeatStore.setState({ nearby: null, requested: false })
    return false
  }
  if (nearby?.warpTo && state.requested && !locked) {
    const [x, y, z] = nearby.warpTo
    player.body.setTranslation({ x, y, z }, true)
    player.body.setLinvel({ x: 0, y: 0, z: 0 }, true)
    usePalaceSeatStore.setState({ nearby: null, requested: false })
    return false
  }
  if (nearby?.board && state.requested && !locked) {
    const seat = nearby.board.seats.find((s) => !s.taken)
    if (seat) {
      seat.taken = true
      lockRide(player, true)
      const [x, y, z] = seat.position
      player.body.setTranslation({ x, y, z }, true)
      player.body.setLinvel({ x: 0, y: 0, z: 0 }, true)
      usePalaceSeatStore.setState({ nearby: null, seated: seat, requested: false })
      return true
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
