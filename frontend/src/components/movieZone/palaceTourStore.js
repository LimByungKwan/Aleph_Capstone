import { create } from 'zustand'
import { southGroundExtension } from '../../game/data/mapData.js'
import { FILM_ENTRANCE, MAIN_GATE, PALACE_ACTIVITIES, TOUR_STOPS } from '../../game/Map/styles/hj/gyeongbokgungLayout.js'

export const palaceGrounds = southGroundExtension?.id === 'HJ/gyeongbokgung' ? southGroundExtension : null

export const usePalaceTour = create((set, get) => ({
  inside: false,
  nearEntrance: false,
  open: false,
  pending: null,
  destination: null,
  nearbyActivity: null,
  activeActivity: null,
  bestScores: {},
  setPresence: (inside, nearEntrance, nearbyActivity) => {
    const state = get()
    if (inside === state.inside && nearEntrance === state.nearEntrance && nearbyActivity === state.nearbyActivity) return
    if (!inside && !nearEntrance) {
      set({ inside, nearEntrance, nearbyActivity: null, activeActivity: null, open: false, pending: null, destination: null })
      return
    }
    const activeActivity = nearbyActivity === state.activeActivity ? state.activeActivity : null
    set({ inside, nearEntrance, nearbyActivity, activeActivity })
  },
  setOpen: (open) => set({ open: open && (get().inside || get().nearEntrance) && !get().activeActivity }),
  travel: (name, play = false) => {
    const stop = TOUR_STOPS.find((place) => place.name === name)
    const { inside, nearEntrance, activeActivity } = get()
    if (!stop || (!inside && !nearEntrance) || activeActivity) return
    set({ pending: { ...stop, play }, open: false })
  },
  arrive: (stop) => {
    const activity = PALACE_ACTIVITIES.find(({ name }) => name === stop.name)?.id ?? null
    set({ pending: null, destination: stop.name, nearbyActivity: activity, activeActivity: stop.play ? activity : null })
  },
  openActivity: () => {
    const { nearbyActivity, open } = get()
    if (nearbyActivity && !open) set({ activeActivity: nearbyActivity })
  },
  closeActivity: () => set({ activeActivity: null }),
  saveScore: (id, score) => set((state) => ({
    bestScores: { ...state.bestScores, [id]: Math.max(score, state.bestScores[id] ?? 0) },
  })),
}))

export function isInPalace({ x, y, z }) {
  if (!palaceGrounds || y < -.3) return false
  const [originX, originZ] = palaceGrounds.position
  const [width, , depth] = palaceGrounds.size
  return Math.abs(x - originX) < width / 2 && z - originZ <= depth / 2 && z - originZ >= MAIN_GATE.z - 1.35
}

export function isAtPalaceEntrance({ x, y, z }) {
  if (!palaceGrounds || y < -.3 || y > 3.5) return false
  const [originX, originZ] = palaceGrounds.position
  return Math.abs(x - originX - FILM_ENTRANCE.x) <= 7.1
    && Math.abs(z - originZ - FILM_ENTRANCE.z) <= 7
}

export function activityAt({ x, y, z }) {
  if (!palaceGrounds || y < .55 || y > 2.6) return null
  const [originX, originZ] = palaceGrounds.position
  return PALACE_ACTIVITIES.find((activity) => Math.abs(x - originX - activity.x) < activity.w / 2
    && Math.abs(z - originZ - activity.z) < activity.d / 2)?.id ?? null
}
