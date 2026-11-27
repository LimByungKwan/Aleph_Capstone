import { lazy, Suspense, useEffect } from 'react'
import { getAppearance, saveAppearance } from '../../api/client.js'
import { useGameStore } from '../../store/gameStore.js'
import { playerPose } from '../../store/playerPose.js'
import { inDateZone } from '../../game/Map/styles/bk_dateMission.js'
import { useUiStore } from '../movieZone/uiStore.js'

const DateCourseIntroPlayer = lazy(() => import('./DateCourseIntroPlayer.jsx'))

const PANEL = 'dateCourseIntro'
const seen = new Set()
const pendingSaves = new Set()

export function DateCourseReplay() {
  const busy = useGameStore((s) => Boolean(s.openPanel) || s.inputLocked)
  const userId = useUiStore((s) => s.userId)
  if (userId === 'guest') return null
  return <button type="button" className="ui-btn" disabled={busy}
    onClick={() => useGameStore.getState().open({ type: PANEL })}>🎬 데이트 코스 영상 다시 보기</button>
}

function closeIntro() {
  const game = useGameStore.getState()
  if (game.openPanel?.type === PANEL) game.close()
}

export default function DateCourseIntro({ enabled }) {
  const userId = useUiStore((s) => s.userId)
  const open = useGameStore((s) => s.openPanel?.type === PANEL)
  useEffect(() => closeIntro, [userId])
  useEffect(() => {
    if (!enabled || userId === 'guest') return
    let active = true
    let pending = false
    let retryAfter = 0
    const eligible = () => active && playerPose.ready && inDateZone(playerPose.x, playerPose.z)
      && !useGameStore.getState().openPanel && !useGameStore.getState().inputLocked
      && useUiStore.getState().userId === userId
    async function firstVisit() {
      if (!eligible() || seen.has(userId)) return
      const watched = (await getAppearance({ userId })).appearance?.dateCourseIntroSeen
      if (watched) {
        seen.add(userId)
        return
      }
      if (!eligible()) return
      useGameStore.getState().open({ type: PANEL })
      seen.add(userId)
      pendingSaves.add(userId)
    }
    async function tick() {
      if (seen.has(userId) && !pendingSaves.has(userId)) return clearInterval(timer)
      if (pending || Date.now() < retryAfter || (!pendingSaves.has(userId) && !eligible())) return
      pending = true
      try {
        const visitAndSave = async () => {
          if (!active || useUiStore.getState().userId !== userId) return
          await firstVisit()
          if (active && useUiStore.getState().userId === userId && pendingSaves.has(userId)) {
            await saveAppearance({ userId, patch: { dateCourseIntroSeen: true } })
            pendingSaves.delete(userId)
          }
        }
        if (navigator.locks) await navigator.locks.request('date-course-intro-' + userId, visitAndSave)
        else await visitAndSave()
      } catch (error) {
        retryAfter = Date.now() + 10000
        console.warn('데이트 코스 첫 방문 기록을 확인하거나 저장하지 못했습니다.', error)
      } finally {
        pending = false
      }
    }
    const timer = setInterval(tick, 350)
    tick()
    return () => { active = false; clearInterval(timer) }
  }, [enabled, userId])
  if (!open || userId === 'guest') return null
  return (
    <Suspense fallback={null}>
      <DateCourseIntroPlayer onClose={closeIntro} />
    </Suspense>
  )
}
