import { useEffect, useState } from 'react'
import places from '@shared/places.json'
import { useGameStore } from '../../store/gameStore.js'
import { collectStamp, getShopPromo, listMyStamps } from '../../api/client.js'
import { useUiStore } from './uiStore.js'
import { TYPE_LABEL, errorText, useAsync } from './common.jsx'
import { HJ_DIALOGUE, sceneForPlace } from './sceneData.js'
import './hj-dialogue.css'

// [3. 개발 > 프론트엔드] 대화창
// 캐릭터가 지점 근처에서 E를 누르면 gameStore.openPanel이 채워지고, 화면 아래에 이 창이 떠요.
// - 촬영지·가게: 설명 + [스탬프 찍기] (이미 받았으면 "획득 완료"로 막힘)
// - 촬영지 스탬프 → 같은 작품 가게 쿠폰 자동 발급 (client.js 규칙)
// - NPC: 대사 (코스 추천 AI는 병관님 담당 — 연결 자리만 마련)

const TYPE_SPEED_MS = 22

export default function DialogBox() {
  const openPanel = useGameStore((s) => s.openPanel)
  const close = useGameStore((s) => s.close)
  const sceneOpen = useUiStore((s) => s.modal === 'breakwater')
  const place = openPanel ? places.find((p) => p.id === openPanel.placeId) : null
  if (!place || sceneOpen) return null // 장면 화면이 열려 있으면 대화창은 숨김
  // key: 다른 지점을 열면 타자 효과·상태를 새로 시작
  return <DialogContent key={place.id} place={place} onClose={close} />
}

function DialogContent({ place, onClose }) {
  const userId = useUiStore((s) => s.userId)
  const { toast, bumpData, openModal } = useUiStore.getState()
  const isNpc = place.type === 'npc'
  const scene = sceneForPlace(place.id) // 방파제처럼 "안으로 들어가는" 촬영지
  const dialogue = HJ_DIALOGUE[place.id]
  const lines = dialogue ? dialogue.map(({ line }) => line) : isNpc ? npcLines(place) : [place.description]
  const [lineIndex, setLineIndex] = useState(0)
  const typed = useTypewriter(lines[lineIndex])
  const [busy, setBusy] = useState(false)

  const stamps = useAsync(() => listMyStamps({ userId }), [userId, place.id])
  const stamped = stamps.data?.stamps.some((s) => s.placeId === place.id)
  // 가게면 사장님이 등록한 대표 홍보문구도 보여 줌
  const promo = useAsync(() => (place.type === 'cafe' ? getShopPromo({ shopId: place.id }) : Promise.resolve({ shopPromo: null })), [place.id])
  const shopPromo = promo.data?.shopPromo

  const handleStamp = async () => {
    setBusy(true)
    try {
      const { issuedCoupons } = await collectStamp({ userId, placeId: place.id })
      toast(`🎉 '${place.name}' 스탬프를 받았어요!`, 'ok')
      issuedCoupons.forEach((c) => toast(`🎟 쿠폰이 발급됐어요: ${c.title}`, 'ok'))
      bumpData()
    } catch (error) {
      toast(errorText(error), error?.code === 'ALREADY_STAMPED' ? 'info' : 'error')
      bumpData()
    } finally {
      setBusy(false)
    }
  }

  const hasMoreLines = lineIndex < lines.length - 1

  return (
    <section className={`ui-dialog ui-interactive${dialogue ? ' hj-vn' : ''}`} role="dialog" aria-labelledby="ui-dialog-name">
      <div className="ui-dialog__head">
        <span className={`ui-badge ui-badge--${place.type}`}>{TYPE_LABEL[place.type]}</span>
        <span className="ui-dialog__name" id="ui-dialog-name">
          {place.name}
        </span>
        {stamped && <span className="ui-badge ui-badge--ok">스탬프 획득</span>}
      </div>
      {place.work && <div className="ui-dialog__work">{place.work}</div>}

      {dialogue && <span className="hj-vn__speaker">{dialogue[lineIndex].speaker}</span>}
      <p className="ui-dialog__text" aria-live="polite">
        <span className={typed.done ? '' : 'ui-caret'}>{typed.text}</span>
      </p>

      {shopPromo && typed.done && (
        <blockquote className="ui-quote" style={{ fontSize: 15, padding: '12px 16px', marginTop: 8 }}>
          <span className="ui-eyebrow" style={{ marginBottom: 4 }}>
            사장님 한마디 · {shopPromo.tag}
          </span>
          {shopPromo.text}
        </blockquote>
      )}

      <div className="ui-dialog__actions">
        <span className="ui-dialog__hint">ESC 닫기</span>
        {!typed.done && (
          <button type="button" className="ui-btn ui-btn--ghost" onClick={typed.skip}>
            건너뛰기
          </button>
        )}
        {typed.done && hasMoreLines && (
          <button type="button" className="ui-btn" onClick={() => setLineIndex((i) => i + 1)}>
            다음 ▸
          </button>
        )}
        {scene && (
          // 이 촬영지는 장면 안에서 인증샷을 찍어야 스탬프가 나와요 (gameStore 패널은 열어 둔 채 → 캐릭터 정지 유지)
          <button type="button" className="ui-btn ui-btn--primary" onClick={() => openModal(scene.id)}>
            {scene.enterLabel}
          </button>
        )}
        {!isNpc && !scene && (
          <button type="button" className="ui-btn ui-btn--primary" onClick={handleStamp}
            disabled={busy || stamped || stamps.loading || Boolean(dialogue && (hasMoreLines || !typed.done))}>
            {stamped ? '획득 완료 ✓' : busy ? '찍는 중…' : '스탬프 찍기'}
          </button>
        )}
        {place.type === 'cafe' && (
          <button type="button" className="ui-btn" onClick={() => openModal('coupons')}>
            쿠폰함 열기
          </button>
        )}
        <button type="button" className="ui-btn" onClick={onClose}>
          닫기
        </button>
      </div>
    </section>
  )
}

// NPC 대사 (병관님 코스 추천 AI가 붙으면 여기 대사를 응답으로 교체)
function npcLines(place) {
  return [
    `안녕하세요! 저는 ${place.name}예요. 이 골목엔 드라마·영화 촬영지가 숨어 있어요.`,
    '촬영지에서 스탬프를 찍으면, 같은 작품과 연결된 가게 쿠폰을 드려요.',
    '오른쪽 위 스탬프북에서 모은 스탬프를 확인할 수 있어요. 좋은 산책 되세요!',
  ]
}


// 한 글자씩 나타나는 대사 (BreakwaterScene에서도 씀)
export function useTypewriter(text) {
  const [count, setCount] = useState(0)
  useEffect(() => {
    setCount(0)
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (reduce) {
      setCount(text.length)
      return undefined
    }
    const id = setInterval(() => {
      setCount((c) => {
        if (c >= text.length) {
          clearInterval(id)
          return c
        }
        return c + 1
      })
    }, TYPE_SPEED_MS)
    return () => clearInterval(id)
  }, [text])
  return { text: text.slice(0, count), done: count >= text.length, skip: () => setCount(text.length) }
}
