import { useEffect } from 'react'
import { mapPlaces } from '../../game/data/mapData.js'
import { listMyStamps } from '../../api/client.js'
import { useUiStore } from './uiStore.js'
import { useAsync } from './common.jsx'
import { useZoneEntryStore } from './zoneEntryStore.js'
import { areaById } from './hjAreas.js'
import { usePalaceGuide } from './palaceGuide.js'

// [3. 개발 > 프론트엔드] 영화·드라마 구역 입장 환영 (혜진 구역 전용)
// 게이트 통과/클릭 → 따뜻한 종이색(#F9F6EE) 페이드 + "🎬 영화·드라마 세트장에 입장하셨습니다!" 배너
// + 이 구역 스탬프 현황 체크 + 짧은 입장 효과음(브라우저 소리 합성, 파일 없음). 4.5초 뒤 자동으로 닫혀요.
const SHOW_MS = 4500
const HJ_SPOTS = mapPlaces.filter((p) => p.zone === 'HJ' && p.type === 'spot')

export default function EntranceWelcome() {
  const welcomeAt = useZoneEntryStore((s) => s.welcomeAt)
  const dismiss = useZoneEntryStore((s) => s.dismissWelcome)
  const areaWelcome = useZoneEntryStore((s) => s.areaWelcome)
  const dismissArea = useZoneEntryStore((s) => s.dismissArea)
  if (welcomeAt) return <Welcome key={welcomeAt} onClose={dismiss} />
  const area = areaWelcome && areaById(areaWelcome.id)
  if (area) return <Welcome key={areaWelcome.at} area={area} onClose={dismissArea} />
  return null
}

// area가 있으면 세트장 안 작은 구역(경복궁·경성거리) 입장 카드, 없으면 세트장 전체 입장 배너
function Welcome({ area = null, onClose }) {
  const showGuide = usePalaceGuide((s) => s.show)
  const userId = useUiStore((s) => s.userId)
  const openModal = useUiStore((s) => s.openModal)
  const { data } = useAsync(() => listMyStamps({ userId }), [userId])
  const got = HJ_SPOTS.filter((p) => data?.stamps.some((s) => s.placeId === p.id)).length

  useEffect(() => {
    playChime()
    const id = setTimeout(onClose, SHOW_MS)
    return () => clearTimeout(id)
  }, [onClose])

  return (
    <div className="hj-enter" role="status" aria-live="polite">
      {!area && <div className="hj-enter__fade" />}
      <div className="hj-enter__banner ui-interactive">
        <span className="ui-eyebrow">{area ? area.eyebrow : 'Movie · Drama Set'}</span>
        <h2>{area ? `${area.emoji} ${area.name}에 입장하셨습니다!` : '🎬 영화·드라마 세트장에 입장하셨습니다!'}</h2>
        {area && <p className="hj-enter__tagline">{area.tagline}</p>}
        <p>
          이 구역 촬영지 스탬프 <strong>{data ? `${got} / ${HJ_SPOTS.length}` : '…'}</strong>
          {data && got < HJ_SPOTS.length ? ' · 남은 촬영지를 찾아보세요' : data ? ' · 모두 모았어요! 🎉' : ''}
        </p>
        <div className="hj-enter__actions">
          <button type="button" className="ui-btn" onClick={() => (openModal('stampbook'), onClose())}>
            📖 스탬프북
          </button>
          {area && (
            <button type="button" className="ui-btn" onClick={() => (showGuide(area.id), onClose())}>
              🪧 안내판
            </button>
          )}
          <button type="button" className="ui-btn ui-btn--ink" onClick={onClose}>
            둘러보기
          </button>
        </div>
      </div>
    </div>
  )
}

// 입장 효과음: 짧은 3음 차임 (Web Audio로 합성 — 오디오 파일·외부 요청 없음)
function playChime() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext
    if (!Ctx) return
    const ctx = new Ctx()
    ;[523.25, 659.25, 783.99].forEach((freq, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      const t0 = ctx.currentTime + i * 0.14
      osc.type = 'sine'
      osc.frequency.value = freq
      gain.gain.setValueAtTime(0, t0)
      gain.gain.linearRampToValueAtTime(0.12, t0 + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.6)
      osc.connect(gain).connect(ctx.destination)
      osc.start(t0)
      osc.stop(t0 + 0.65)
    })
    setTimeout(() => ctx.close(), 1200)
  } catch {
    // 소리를 못 내는 환경이면 조용히 넘어감
  }
}
