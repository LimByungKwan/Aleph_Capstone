import places from '@shared/places.json'
import { formatTime, listMyStamps } from '../../api/client.js'
import { useUiStore } from './uiStore.js'
import { LoadingBlock, Modal, TYPE_LABEL, errorText, useAsync } from './common.jsx'

// [3. 개발 > 프론트엔드] 스탬프북: 스탬프를 찍을 수 있는 모든 장소 + 내가 받은 것 표시
const STAMPABLE = places.filter((p) => p.type !== 'npc')

export default function StampBook({ onClose }) {
  const userId = useUiStore((s) => s.userId)
  const { data, loading, error, reload } = useAsync(() => listMyStamps({ userId }), [userId])
  const byPlace = new Map((data?.stamps ?? []).map((s) => [s.placeId, s]))
  const done = STAMPABLE.filter((p) => byPlace.has(p.id)).length

  return (
    <Modal title="📖 스탬프북" onClose={onClose} labelledBy="ui-stampbook-title">
      {loading && !data ? (
        <LoadingBlock rows={2} />
      ) : error ? (
        <div className="ui-alert ui-alert--error">
          {errorText(error)}{' '}
          <button type="button" className="ui-btn" onClick={reload}>
            다시 불러오기
          </button>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
            <strong>
              {done} / {STAMPABLE.length} 수집
            </strong>
            <span style={{ color: 'var(--ui-muted)' }}>{done === STAMPABLE.length ? '모든 스탬프 완성! 🎉' : '촬영지에서 E를 눌러 스탬프를 찍어요'}</span>
          </div>
          <div className="ui-progress" role="progressbar" aria-valuemin={0} aria-valuemax={STAMPABLE.length} aria-valuenow={done}>
            <span style={{ width: `${(done / STAMPABLE.length) * 100}%` }} />
          </div>

          <div className="ui-stamps">
            {STAMPABLE.map((place) => {
              const stamp = byPlace.get(place.id)
              return (
                <article key={place.id} className={`ui-stamp ${stamp ? 'ui-stamp--done' : ''}`}>
                  <div className="ui-stamp__seal" aria-hidden="true">
                    {stamp ? '방문\n인증' : '?'}
                  </div>
                  <div className="ui-stamp__name">{place.name}</div>
                  <div className="ui-stamp__meta">
                    <span className={`ui-badge ui-badge--${place.type}`}>{TYPE_LABEL[place.type]}</span>
                  </div>
                  <div className="ui-stamp__meta">{stamp ? `${formatTime(stamp.createdAt)} 획득` : '아직 못 받았어요'}</div>
                </article>
              )
            })}
          </div>
        </>
      )}
    </Modal>
  )
}
