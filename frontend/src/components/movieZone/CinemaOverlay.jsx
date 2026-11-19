import { useEffect, useState } from 'react'
import { usePortalStore } from './portalStore.js'
import { useGameStore } from '../../store/gameStore.js'

// [3. 개발 > 프론트엔드] '영화 속으로 입장' 화면 연출 (혜진 영화·드라마 구역)
// 캐릭터가 포털 원 안에 들어오면:
//   1) 화면이 살짝 어두워지고(페이드)  2) 위아래 검은 띠(레터박스)가 내려오고
//   3) "🎞️ [영화 속으로 입장] 명장면 세트장" 제목  4) 가상 작품 명장면 소개 + 촬영 포인트 카드
// 원 밖으로 나가면 원래 화면으로 돌아와요. ESC 또는 [닫기]로 먼저 닫을 수도 있어요.
const EXIT_MS = 450

export default function CinemaOverlay() {
  const active = usePortalStore((s) => s.active)
  const dismissedId = usePortalStore((s) => s.dismissedId)
  const dismiss = usePortalStore((s) => s.dismiss)
  const visible = Boolean(active) && dismissedId !== active?.id
  const lockMovement = visible && active.retroScene

  // 사라질 때도 애니메이션이 보이도록 마지막 내용을 잠깐 유지
  const [shown, setShown] = useState(null)
  const [leaving, setLeaving] = useState(false)
  useEffect(() => {
    if (visible) {
      setShown(active)
      setLeaving(false)
      return undefined
    }
    if (!shown) return undefined
    setLeaving(true)
    const id = setTimeout(() => {
      setShown(null)
      setLeaving(false)
    }, EXIT_MS)
    return () => clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, active])

  useEffect(() => {
    if (!visible) return undefined
    const onKey = (event) => {
      if (event.key === 'Escape') dismiss()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [visible, dismiss])

  useEffect(() => {
    if (!lockMovement || useGameStore.getState().inputLocked) return undefined
    useGameStore.setState({ inputLocked: true })
    return () => {
      if (!useGameStore.getState().openPanel) useGameStore.setState({ inputLocked: false })
    }
  }, [lockMovement])

  if (!shown) return null

  if (shown.retroScene) {
    return (
      <div className={`cine ${leaving ? 'cine--leaving' : ''}`} role="dialog"
        aria-modal="true" aria-labelledby="analog-scene-title">
        <div className="cine__fade" />
        <div className="cine__stage">
          <article className="cine__card ui-interactive">
            <h2 id="analog-scene-title">{shown.title}</h2>
            <strong>{shown.speaker}</strong>
            <p>“{shown.synopsis}”</p>
            <button type="button" className="ui-btn ui-btn--ink" onClick={dismiss} autoFocus>
              둘러보기 계속하기
            </button>
          </article>
        </div>
      </div>
    )
  }

  return (
    <div className={`cine ${leaving ? 'cine--leaving' : ''}`} role="dialog" aria-modal="false" aria-labelledby="cine-title">
      <div className="cine__fade" />
      <div className="cine__bar cine__bar--top" />
      <div className="cine__bar cine__bar--bottom">
        <span className="cine__hint">포털 밖으로 나가거나 ESC를 누르면 돌아가요</span>
      </div>

      <div className="cine__stage">
        <p className="cine__eyebrow">🎞️ [영화 속으로 입장]</p>
        <h2 className="cine__title" id="cine-title">
          {shown.title ?? '명장면 세트장'}
        </h2>
        {shown.work && <p className="cine__work">{shown.work}</p>}

        {(shown.synopsis || shown.points?.length > 0) && (
          <article className="cine__card ui-interactive">
            {shown.synopsis && (
              <>
                <h3>명장면 줄거리</h3>
                <p>{shown.synopsis}</p>
              </>
            )}
            {shown.points?.length > 0 && (
              <>
                <h3>📷 촬영 포인트</h3>
                <ol>
                  {shown.points.map((point) => (
                    <li key={point}>{point}</li>
                  ))}
                </ol>
              </>
            )}
            <button type="button" className="ui-btn ui-btn--ink" onClick={dismiss}>
              닫고 골목으로 돌아가기
            </button>
          </article>
        )}
      </div>
    </div>
  )
}
