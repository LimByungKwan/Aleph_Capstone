import { useEffect, useRef, useState } from 'react'
import places from '@shared/places.json'
import { useGameStore } from '../../store/gameStore.js'
import { collectStamp, listMyStamps } from '../../api/client.js'
import { useUiStore } from './uiStore.js'
import { errorText, useAsync } from './common.jsx'
import { useTypewriter } from './DialogBox.jsx'
import { SCENES } from './sceneData.js'

// [3. 개발 > 프론트엔드] 방파제 안으로 들어가기 (혜진 영화·드라마 구역)
// 1) 파도가 화면을 쓸고 지나가는 전환  2) 방파제 포토존 & 스토리 화면
// 3) 아래쪽 빈티지 대화창 (가상 작품 대사)  4) [꽃다발 인증샷] → 방파제 스탬프 획득 + 축하 연출
// 상태는 uiStore.modal('breakwater')과 이 컴포넌트 안에만 있어요 (다른 구역과 충돌 없음).
// 열려 있는 동안은 gameStore.openPanel을 유지해서 캐릭터가 움직이지 않게 해요.
const PLACE_ID = 'spot_hj_breakwater'
const WAVE_MS = 1300

export default function BreakwaterScene() {
  const modal = useUiStore((s) => s.modal)
  const openPanel = useGameStore((s) => s.openPanel)
  const open = modal === 'breakwater'

  // ESC(InteractionKeys)로 패널이 닫히면 장면도 같이 닫기
  useEffect(() => {
    if (open && !openPanel) useUiStore.getState().closeModal()
  }, [open, openPanel])

  if (!open) return null
  return <SceneContent scene={SCENES[PLACE_ID]} />
}

function SceneContent({ scene }) {
  const userId = useUiStore((s) => s.userId)
  const { toast, bumpData, closeModal, openModal } = useUiStore.getState()
  const place = places.find((p) => p.id === PLACE_ID)

  const [phase, setPhase] = useState('wave') // 'wave' → 'story'
  const [lineIndex, setLineIndex] = useState(0)
  const [photo, setPhoto] = useState(null) // { takenAt }
  const [celebrate, setCelebrate] = useState(false)
  const [busy, setBusy] = useState(false)

  const stamps = useAsync(() => listMyStamps({ userId }), [userId])
  const stamped = stamps.data?.stamps.some((s) => s.placeId === PLACE_ID)
  const current = scene.dialogue[lineIndex]
  const typed = useTypewriter(phase === 'story' ? current.line : '')

  useEffect(() => {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    const id = setTimeout(() => setPhase('story'), reduce ? 0 : WAVE_MS)
    return () => clearTimeout(id)
  }, [])

  // 인증샷이 나오면 화면이 좁아도 사진이 보이게 스크롤
  const photoRef = useRef(null)
  useEffect(() => {
    if (photo) photoRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [photo])

  const exit = () => {
    closeModal()
    useGameStore.getState().close()
  }

  const takePhoto = async () => {
    setBusy(true)
    setPhoto({ takenAt: new Date() })
    try {
      const { issuedCoupons } = await collectStamp({ userId, placeId: PLACE_ID })
      setCelebrate(true)
      toast(`🎉 ${scene.stampLabel}를 받았어요!`, 'ok')
      issuedCoupons.forEach((c) => toast(`🎟 쿠폰이 발급됐어요: ${c.title}`, 'ok'))
    } catch (error) {
      // 이미 받은 스탬프면 사진만 남기고 안내
      toast(errorText(error), error?.code === 'ALREADY_STAMPED' ? 'info' : 'error')
    } finally {
      bumpData() // 스탬프북·쿠폰함 숫자 갱신
      setBusy(false)
    }
  }

  return (
    <div className="bw ui-interactive" role="dialog" aria-modal="true" aria-labelledby="bw-title">
      {/* 파도 전환 */}
      <div className={`bw-wave ${phase === 'story' ? 'bw-wave--done' : ''}`} aria-hidden="true">
        <span className="bw-wave__band bw-wave__band--1" />
        <span className="bw-wave__band bw-wave__band--2" />
        <span className="bw-wave__band bw-wave__band--3" />
      </div>

      {phase === 'story' && (
        <div className="bw-stage">
          {/* 배경: 하늘·바다·방파제·등대 일러스트 (CSS로 그림) */}
          <div className="bw-scenery" aria-hidden="true">
            <span className="bw-sun" />
            <span className="bw-sea" />
            <span className="bw-pier" />
            <span className="bw-lighthouse">
              <i />
            </span>
          </div>

          <header className="bw-head">
            <button type="button" className="ui-btn" onClick={exit}>
              ← 골목으로 돌아가기
            </button>
            <div>
              <span className="ui-eyebrow">Breakwater Set · {place?.name}</span>
              <h2 id="bw-title">{scene.title}</h2>
              <p className="bw-work">{scene.work}</p>
            </div>
          </header>

          <div className="bw-body">
            <article className="bw-card">
              <h3>📜 명장면 스토리</h3>
              <p>{scene.story}</p>
              <button type="button" className="ui-btn ui-btn--primary bw-photo-btn" onClick={takePhoto} disabled={busy}>
                {busy ? '찰칵…' : stamped && !celebrate ? '📸 인증샷 한 장 더 남기기' : scene.photoAction}
              </button>
              {stamped && (
                <div className="bw-stamp-state">
                  ✅ {scene.stampLabel} 획득 완료 ·{' '}
                  <button type="button" className="bw-link" onClick={() => openModal('stampbook')}>
                    스탬프북 보기
                  </button>
                </div>
              )}
            </article>

            {photo && (
              <figure ref={photoRef} className={`bw-polaroid ${celebrate ? 'bw-polaroid--new' : ''}`}>
                <div className="bw-polaroid__shot" aria-hidden="true">
                  <span className="bw-sun" />
                  <span className="bw-sea" />
                  <span className="bw-lighthouse bw-lighthouse--small">
                    <i />
                  </span>
                  <span className="bw-bouquet">💐</span>
                </div>
                <figcaption>
                  {scene.photoCaption}
                  <small>
                    {photo.takenAt.getMonth() + 1}/{photo.takenAt.getDate()} · SceneWalk
                  </small>
                </figcaption>
                {celebrate && <span className="bw-seal">STAMP</span>}
              </figure>
            )}
          </div>

          {/* 아래쪽 빈티지 대화창 */}
          <section className="bw-dialogue" aria-live="polite">
            <span className="bw-dialogue__speaker">{current.speaker}</span>
            <p>
              “<span className={typed.done ? '' : 'ui-caret'}>{typed.text}</span>”
            </p>
            <div className="bw-dialogue__actions">
              <span>
                {lineIndex + 1} / {scene.dialogue.length}
              </span>
              {!typed.done ? (
                <button type="button" className="ui-btn ui-btn--ghost" onClick={typed.skip}>
                  건너뛰기
                </button>
              ) : (
                <button
                  type="button"
                  className="ui-btn"
                  onClick={() => setLineIndex((i) => (i + 1) % scene.dialogue.length)}
                >
                  {lineIndex < scene.dialogue.length - 1 ? '다음 대사 ▸' : '처음부터 ↺'}
                </button>
              )}
            </div>
          </section>

          {celebrate && <Confetti onDone={() => setCelebrate(false)} />}
        </div>
      )}
    </div>
  )
}

// 축하 꽃잎 (2.4초 뒤 사라짐)
function Confetti({ onDone }) {
  useEffect(() => {
    const id = setTimeout(onDone, 2400)
    return () => clearTimeout(id)
  }, [onDone])
  return (
    <div className="bw-confetti" aria-hidden="true">
      {Array.from({ length: 28 }, (_, i) => (
        <i key={i} style={{ '--x': `${(i * 37) % 100}%`, '--d': `${(i % 7) * 0.12}s`, '--c': ['#f4b0c6', '#c86d51', '#f2c14e', '#7fc8b4'][i % 4] }} />
      ))}
    </div>
  )
}
