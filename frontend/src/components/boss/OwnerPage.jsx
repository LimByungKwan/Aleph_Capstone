import { useState } from 'react'
import places from '@shared/places.json'
import PromoGenerator from './PromoGenerator.jsx'
import { formatTime, getShopStats, redeemCoupon } from '../../api/client.js'
import { currentUser, useUiStore } from '../movieZone/uiStore.js'
import { LoadingBlock, errorText, useAsync } from '../movieZone/common.jsx'
import { PageShell, RoleGate, Stat } from './PageShell.jsx'

// [3. 개발 > 프론트엔드] 사장님 화면
// 1) AI 홍보문구 생성기 (캡션 3안 + 해시태그, 릴스 대본 선택) — 우리 서비스 차별점
// 2) 쿠폰 사용 처리 (우리 가게 쿠폰만, 1회만)
// 3) 가게 통계
const TABS = [
  { id: 'promo', label: '✍️ 홍보문구 생성' },
  { id: 'redeem', label: '🎟 쿠폰 사용 처리' },
  { id: 'stats', label: '📈 통계' },
]

export default function OwnerPage() {
  const [tab, setTab] = useState('promo')
  const user = currentUser(useUiStore((s) => s.userId))
  const shop = places.find((p) => p.id === user.shopId)

  return (
    <PageShell title="사장님 화면">
      <RoleGate role="owner">
        <h1>{shop?.name ?? '우리 가게'}</h1>
        <p className="ui-sub">
          {shop?.work ? `${shop.work} 연계 가게` : '촬영지 연계 가게'} · {user.name}
        </p>
        <div className="ui-tabs" role="tablist" aria-label="사장님 메뉴">
          {TABS.map((t) => (
            <button key={t.id} type="button" role="tab" className="ui-tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}>
              {t.label}
            </button>
          ))}
        </div>
        {tab === 'promo' && <PromoGenerator shop={shop} ownerId={user.id} />}
        {tab === 'redeem' && <CouponRedeem ownerId={user.id} />}
        {tab === 'stats' && <ShopStats ownerId={user.id} />}
      </RoleGate>
    </PageShell>
  )
}

// ───────────── 쿠폰 사용 처리 ─────────────
function CouponRedeem({ ownerId }) {
  const [code, setCode] = useState('')
  const [state, setState] = useState({ loading: false, error: null, done: null })
  const bumpData = useUiStore((s) => s.bumpData)

  const submit = async (event) => {
    event.preventDefault()
    setState({ loading: true, error: null, done: null })
    try {
      const { coupon } = await redeemCoupon({ ownerId, code })
      setState({ loading: false, error: null, done: coupon })
      setCode('')
      bumpData()
    } catch (error) {
      setState({ loading: false, error: errorText(error), done: null })
    }
  }

  return (
    <div className="ui-grid-2">
      <form className="ui-card" onSubmit={submit}>
        <h2>손님 쿠폰 코드 입력</h2>
        <div className="ui-field">
          <label htmlFor="redeem-code">쿠폰 코드 (6자리)</label>
          <input
            id="redeem-code"
            className="ui-mono"
            value={code}
            maxLength={6}
            autoComplete="off"
            onChange={(e) => {
              setCode(e.target.value.toUpperCase())
              if (state.error) setState((s) => ({ ...s, error: null }))
            }}
            placeholder="예: K7P2QX"
            aria-invalid={Boolean(state.error)}
            aria-describedby="redeem-msg"
          />
        </div>
        <div id="redeem-msg">
          {state.error && <div className="ui-alert ui-alert--error">{state.error}</div>}
          {state.done && (
            <div className="ui-alert ui-alert--ok">
              ✅ 사용 처리 완료 — {state.done.title} ({state.done.code})
            </div>
          )}
        </div>
        <button type="submit" className="ui-btn ui-btn--primary" style={{ width: '100%' }} disabled={state.loading || code.trim().length === 0}>
          {state.loading ? '확인 중…' : '쿠폰 사용 처리'}
        </button>
      </form>
      <div className="ui-card">
        <h2>안내</h2>
        <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.8, fontSize: 14 }}>
          <li>손님 쿠폰함에 보이는 6자리 코드를 입력해요.</li>
          <li>우리 가게 쿠폰만 사용 처리할 수 있어요.</li>
          <li>쿠폰은 1회용이라 한 번 처리하면 다시 쓸 수 없어요.</li>
        </ul>
      </div>
    </div>
  )
}

// ───────────── 가게 통계 ─────────────
function ShopStats({ ownerId }) {
  const { data, loading, error, reload } = useAsync(() => getShopStats({ ownerId }), [ownerId])
  if (loading && !data) return <LoadingBlock rows={2} />
  if (error)
    return (
      <div className="ui-alert ui-alert--error">
        {errorText(error)}{' '}
        <button type="button" className="ui-btn" onClick={reload}>
          다시 불러오기
        </button>
      </div>
    )
  const rate = data.issued ? Math.round((data.used / data.issued) * 100) : 0
  return (
    <>
      <div className="ui-stats">
        <Stat label="발급된 쿠폰" value={data.issued} />
        <Stat label="사용된 쿠폰" value={data.used} />
        <Stat label="쿠폰 사용률" value={`${rate}%`} />
        <Stat label="연계 촬영지 방문(스탬프)" value={data.visitors} />
      </div>
      <div className="ui-card">
        <h2>최근 사용 처리</h2>
        {data.recentRedemptions.length === 0 ? (
          <div className="ui-empty">아직 사용된 쿠폰이 없어요.</div>
        ) : (
          <table className="ui-table">
            <thead>
              <tr>
                <th>코드</th>
                <th>혜택</th>
                <th>사용 시각</th>
              </tr>
            </thead>
            <tbody>
              {data.recentRedemptions.map((c) => (
                <tr key={c.id}>
                  <td className="ui-mono">{c.code}</td>
                  <td>{c.title}</td>
                  <td>{formatTime(c.usedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  )
}
