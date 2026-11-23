import { useEffect, useState } from 'react'
import { useUiStore } from '../movieZone/uiStore.js'
import { useGameStore } from '../../store/gameStore.js'
import { usePhotoStore } from '../../store/photoStore.js'
import { playerPose } from '../../store/playerPose.js'
import { isMuted, onMuteChange, setMuted, setWaterLevel, sfx } from './sound.js'

// 효과음 연결 (담당: 병관)
// - 다른 팀원 코드를 고치지 않고, 알림(toast)·인증샷·캐릭터 위치를 "지켜보다가" 소리를 냄
//   스탬프 받음 → 쾅 / 목적지 도착 → 띵 / 코스 완주·배지 → 빠라밤 / 인증샷 → 찰칵
// - 걸으면 발소리 (달리면 빠르게), 소원 분수 근처에서는 물소리
// - 대화창이 열려 있으면 발소리 멈춤

const FOUNTAIN_XZ = [63, 0] // 데이트 구역 소원 분수 (bk_date.json fountain, origin [85,-40] 기준 [-22,40])
const FOUNTAIN_RANGE = 22 // 이 거리 안에서 물소리가 들림 (m)

export default function SoundDirector() {
  // 알림 문구로 소리 고르기 (새로 생긴 알림만)
  useEffect(
    () =>
      useUiStore.subscribe((state, prev) => {
        const fresh = state.toasts.filter((t) => !prev.toasts.some((p) => p.id === t.id))
        for (const { text } of fresh) {
          if (text.includes('스탬프를 받았어요')) sfx.stamp()
          else if (text.includes('코스 완주')) sfx.fanfare()
          else if (text.includes('도착!') || text.includes('배지 획득') || text.includes('쿠폰이 발급')) sfx.arrive()
        }
      }),
    [],
  )

  // 인증샷 찰칵
  useEffect(
    () =>
      usePhotoStore.subscribe((state, prev) => {
        if (state.request !== prev.request) sfx.shutter()
      }),
    [],
  )

  // 발소리 + 분수 물소리 (캐릭터 위치 변화로 계산)
  useEffect(() => {
    let raf = 0
    let last = null
    let nextStep = 0
    let waterTick = 0
    const loop = (now) => {
      raf = requestAnimationFrame(loop)
      if (!playerPose.ready) {
        last = null
        return
      }
      const pos = { x: playerPose.x, z: playerPose.z, t: now }
      if (last) {
        const dt = (now - last.t) / 1000
        const speed = dt > 0 ? Math.hypot(pos.x - last.x, pos.z - last.z) / dt : 0
        const walking = speed > 0.8 && speed < 15 && !useGameStore.getState().openPanel // 15 넘으면 순간이동(엘리베이터·포털)
        if (walking && now >= nextStep) {
          const run = speed > 4.5
          sfx.step(run)
          nextStep = now + (run ? 300 : 470)
        }
      }
      last = pos
      if (now >= waterTick) {
        waterTick = now + 250
        const d = Math.hypot(pos.x - FOUNTAIN_XZ[0], pos.z - FOUNTAIN_XZ[1])
        setWaterLevel(1 - d / FOUNTAIN_RANGE)
      }
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [])

  return null
}

// 오른쪽 위 🔊/🔇 버튼
export function SoundToggle() {
  const [muted, setState] = useState(isMuted)
  useEffect(() => onMuteChange(setState), [])
  return (
    <button
      type="button"
      className="ui-btn"
      aria-pressed={muted}
      aria-label={muted ? '소리 켜기' : '소리 끄기'}
      title={muted ? '소리 켜기' : '소리 끄기'}
      onClick={(e) => (e.currentTarget.blur(), setMuted(!muted))}
    >
      {muted ? '🔇' : '🔊'}
    </button>
  )
}
