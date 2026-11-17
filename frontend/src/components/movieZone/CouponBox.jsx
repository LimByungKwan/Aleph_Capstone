import { useState } from 'react'
import { formatDate, formatTime, listMyCoupons } from '../../api/client.js'
import { dayKey } from '../../api/mockDb.js'
import { useUiStore } from './uiStore.js'
import { LoadingBlock, Modal, errorText, useAsync } from './common.jsx'

// [3. 개발 > 프론트엔드] 나의 골목 쿠폰함 (티켓 지갑)
// - 전체 / 사용 가능 / 사용 완료 필터
// - 사용 처리는 "해당 가게 사장님만" 가능 → 손님 화면엔 [사용하기] 버튼 대신 6자리 코드를 보여 줘요.
const FILTERS = [
  { id: 'all', label: '전체 보기' },
  { id: 'active', label: '사용 가능' },
  { id: 'used', label: '사용 완료' },
]

function couponState(coupon, today) {
  if (coupon.usedAt) return 'used'
  if (coupon.validUntil && coupon.validUntil < today) return 'expired'
  return 'active'
}

export default function CouponBox({ onClose }) {
  const userId = useUiStore((s) => s.userId)
  const openModal = useUiStore((s) => s.openModal)
  const [filter, setFilter] = useState('all')
  const { data, loading, error, reload } = useAsync(() => listMyCoupons({ userId }), [userId])

  const today = dayKey()
  const coupons = (data?.coupons ?? []).map((c) => ({ ...c, state: couponState(c, today) }))
  const shown = coupons.filter((c) => (filter === 'all' ? true : filter === 'active' ? c.state === 'active' : c.state !== 'active'))
  const counts = { all: coupons.length, active: coupons.filter((c) => c.state === 'active').length, used: coupons.filter((c) => c.state !== 'active').length }

  return (
    <Modal title="🎟️ 나의 골목 쿠폰함" onClose={onClose} labelledBy="ui-coupon-title">
      <div className="ui-wallet__head">
        <div>
          <span className="ui-eyebrow">Digital Stub Wallet</span>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--ui-muted)' }}>가게에서 코드를 사장님께 보여 주세요. 쿠폰은 한 번만 쓸 수 있어요.</p>
        </div>
        <div className="ui-segment" role="group" aria-label="쿠폰 필터">
          {FILTERS.map((f) => (
            <button key={f.id} type="button" aria-pressed={filter === f.id} onClick={() => setFilter(f.id)}>
              {f.label} {data && <span style={{ opacity: 0.6 }}>{counts[f.id]}</span>}
            </button>
          ))}
        </div>
      </div>

      {loading && !data ? (
        <LoadingBlock rows={2} />
      ) : error ? (
        <div className="ui-alert ui-alert--error">
          {errorText(error)}{' '}
          <button type="button" className="ui-btn" onClick={reload}>
            다시 불러오기
          </button>
        </div>
      ) : shown.length === 0 ? (
        <div className="ui-empty">
          {filter === 'used' ? (
            <p style={{ margin: 0 }}>아직 사용한 쿠폰이 없어요.</p>
          ) : (
            <>
              <p style={{ margin: '0 0 12px' }}>사용할 수 있는 쿠폰이 없어요. 촬영지 스탬프를 찍으면 연결된 가게 쿠폰이 들어와요.</p>
              <button type="button" className="ui-btn ui-btn--primary" onClick={() => openModal('stampbook')}>
                스탬프북 보기
              </button>
            </>
          )}
        </div>
      ) : (
        <div className="ui-tickets">
          {shown.map((coupon) => (
            <CouponTicket key={coupon.id} coupon={coupon} />
          ))}
        </div>
      )}
    </Modal>
  )
}

function CouponTicket({ coupon }) {
  const { title, discount, validUntil, shopName, code, state, usedAt, reason } = coupon
  const used = state === 'used'
  const expired = state === 'expired'

  return (
    <article className={`ui-ticket ${used ? 'ui-ticket--used' : ''} ${expired ? 'ui-ticket--expired' : ''}`}>
      <div className="ui-ticket__stub">
        <div>
          <span className="ui-ticket__brand">SCENEWALK PASS</span>
          <div className="ui-ticket__discount">{discount ?? 'GIFT'}</div>
        </div>
        <div className="ui-ticket__shop">📍 {shopName ?? '가게'}</div>
      </div>

      <div className="ui-ticket__body">
        {used && (
          <div className="ui-ticket__seal" aria-hidden="true">
            USED / 사용완료
          </div>
        )}
        {expired && (
          <div className="ui-ticket__seal ui-ticket__seal--expired" aria-hidden="true">
            기간 만료
          </div>
        )}

        <div>
          <h3 className="ui-ticket__title">{title}</h3>
          <p className="ui-ticket__meta">
            {validUntil ? `유효기간: ${formatDate(validUntil)} 까지` : '유효기간 없음'} · {reason}
          </p>
        </div>

        <div className="ui-ticket__foot">
          <span className="ui-ticket__no">NO. {coupon.id.replace(/^cp_/, '').toUpperCase().slice(0, 10)}</span>
          {used ? (
            <span className="ui-badge ui-badge--used">{formatTime(usedAt)} 사용</span>
          ) : expired ? (
            <span className="ui-badge ui-badge--used">사용 기간이 지났어요</span>
          ) : (
            <span className="ui-ticket__code">
              사장님께 보여 주세요
              <strong aria-label={`쿠폰 코드 ${code.split('').join(' ')}`}>{code}</strong>
            </span>
          )}
        </div>
      </div>
    </article>
  )
}
