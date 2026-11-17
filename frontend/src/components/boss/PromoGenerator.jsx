import { useState } from 'react'
import { SHOP_OFFERS } from '../../api/mockDb.js'
import { formatTime, generatePromo, getShopPromo, saveShopPromo } from '../../api/client.js'
import { useUiStore } from '../movieZone/uiStore.js'
import { LoadingBlock, errorText, useAsync } from '../movieZone/common.jsx'
import { PROMO_GUIDE, checkPromoRules } from './promoRules.js'
import { TARGET_OPTIONS, TONE_OPTIONS } from './promoMock.js'

// [3. 개발 > 프론트엔드] ✨ 감성 골목 홍보문구 공방 (사장님 화면 — 우리 서비스 차별점)
// 왼쪽: 손님 유형 · 분위기 · 가게 정보 / 오른쪽: 캡션 3안(탭으로 전환) + 해시태그 + 릴스 대본
// [대표 문구로 등록]하면 3D 맵의 가게 대화창에 그 문구가 떠요.
export default function PromoGenerator({ shop, ownerId }) {
  const offer = SHOP_OFFERS[shop?.id]
  const toast = useUiStore((s) => s.toast)
  const bumpData = useUiStore((s) => s.bumpData)

  const [form, setForm] = useState({
    target: 'couple',
    tone: 'warm',
    shopName: shop?.name ?? '',
    workTitle: shop?.work ?? '',
    menu: offer?.menu ?? '',
    offer: offer?.perk ?? '',
    includeReels: false,
  })
  const [nameTouched, setNameTouched] = useState(false)
  const [state, setState] = useState({ loading: false, error: null, result: null })
  const [pick, setPick] = useState(0)
  const [saving, setSaving] = useState(false)
  const saved = useAsync(() => getShopPromo({ shopId: shop?.id }), [shop?.id])

  const set = (key) => (event) => {
    const value = event.target.type === 'checkbox' ? event.target.checked : event.target.value
    setForm((f) => ({ ...f, [key]: value }))
  }

  const nameError = nameTouched && !form.shopName.trim() ? '가게 이름을 입력해 주세요.' : null
  const inputWarnings = checkPromoRules(form.shopName, form.menu, form.offer, form.workTitle)
  const result = state.result
  const caption = result?.captions[pick] ?? ''
  const fullText = result ? `${caption}\n\n${result.hashtags.join(' ')}` : ''

  const generate = async () => {
    setNameTouched(true)
    if (!form.shopName.trim()) return
    setState((s) => ({ ...s, loading: true, error: null }))
    try {
      const next = await generatePromo({ ownerId, ...form })
      setState({ loading: false, error: null, result: next })
      setPick(0)
    } catch (error) {
      setState((s) => ({ ...s, loading: false, error: errorText(error) }))
    }
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(fullText)
      toast(`📋 캡션 ${pick + 1}안과 해시태그를 복사했어요.`, 'ok')
    } catch {
      toast('복사하지 못했어요. 글을 드래그해서 직접 복사해 주세요.', 'error')
    }
  }

  const register = async () => {
    setSaving(true)
    try {
      await saveShopPromo({ ownerId, text: caption, tag: result.tag })
      toast('📢 대표 문구로 등록했어요. 3D 골목 가게 대화창에 보여요.', 'ok')
      bumpData()
    } catch (error) {
      toast(errorText(error), 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="ui-studio">
      <header className="ui-studio__head">
        <div>
          <span className="ui-eyebrow">AI Studio Assistant</span>
          <h2>✨ 감성 골목 홍보문구 공방</h2>
        </div>
        <span className="ui-chip">🎞️ SceneWalk 문구 생성기 v1.0</span>
      </header>

      <div className="ui-studio__grid">
        {/* ── 왼쪽: 설정 ── */}
        <form
          className="ui-studio__panel"
          onSubmit={(e) => {
            e.preventDefault()
            generate()
          }}
          noValidate
        >
          <h3>방문객 맞춤 문구 설정</h3>

          <div className="ui-field">
            <label htmlFor="promo-target">어떤 손님을 초대하고 싶나요?</label>
            <select id="promo-target" value={form.target} onChange={set('target')}>
              {TARGET_OPTIONS.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          <div className="ui-field">
            <span className="ui-label" id="promo-tone-label">
              문구 분위기
            </span>
            <div className="ui-tone-grid" role="group" aria-labelledby="promo-tone-label">
              {TONE_OPTIONS.map((t) => (
                <button key={t.value} type="button" aria-pressed={form.tone === t.value} onClick={() => setForm((f) => ({ ...f, tone: t.value }))}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <details className="ui-details" open={Boolean(nameError)}>
            <summary>🏪 가게 정보 ({form.shopName || '이름 없음'} · {form.offer || '혜택 없음'})</summary>
            <div className="ui-field">
              <label htmlFor="promo-shop">가게 이름</label>
              <input id="promo-shop" value={form.shopName} onChange={set('shopName')} onBlur={() => setNameTouched(true)} aria-invalid={Boolean(nameError)} />
              {nameError && <span className="ui-field__error">{nameError}</span>}
            </div>
            <div className="ui-field">
              <label htmlFor="promo-work">연계 작품 (가상 작품명)</label>
              <input id="promo-work" value={form.workTitle} onChange={set('workTitle')} />
            </div>
            <div className="ui-field">
              <label htmlFor="promo-menu">대표 메뉴</label>
              <input id="promo-menu" value={form.menu} onChange={set('menu')} />
            </div>
            <div className="ui-field" style={{ marginBottom: 0 }}>
              <label htmlFor="promo-offer">쿠폰 혜택</label>
              <input id="promo-offer" value={form.offer} onChange={set('offer')} />
              <span className="ui-field__hint">예: 음료 10% 할인</span>
            </div>
          </details>

          <label className="ui-check">
            <input type="checkbox" checked={form.includeReels} onChange={set('includeReels')} /> 릴스 대본도 만들기 (15초)
          </label>

          <ul className="ui-rules" aria-label="문구 규칙">
            {PROMO_GUIDE.map((rule) => (
              <li key={rule}>🚫 {rule}</li>
            ))}
          </ul>
          {inputWarnings.map((w) => (
            <div key={w} className="ui-alert">
              ⚠️ {w}
            </div>
          ))}

          <button type="submit" className="ui-btn ui-btn--ink" style={{ width: '100%', minHeight: 50 }} disabled={state.loading}>
            {state.loading ? '🪄 문구를 짓는 중…' : result ? '🪄 다시 만들기' : '🪄 홍보문구 만들기'}
          </button>
        </form>

        {/* ── 오른쪽: 결과 카드 ── */}
        <section className="ui-result" aria-live="polite" aria-busy={state.loading}>
          {state.error && <div className="ui-alert ui-alert--error">{state.error}</div>}

          {!result && !state.loading && (
            <div className="ui-empty" style={{ position: 'relative' }}>
              <p style={{ margin: '0 0 8px', fontFamily: 'var(--ui-serif)', fontSize: 18, color: 'var(--ui-text)' }}>아직 지은 문구가 없어요</p>
              왼쪽에서 손님과 분위기를 고르고 [홍보문구 만들기]를 누르면 캡션 3안과 해시태그가 나와요.
            </div>
          )}
          {state.loading && !result && <LoadingBlock rows={3} />}

          {result && (
            <>
              <div className="ui-result__top">
                <span className="ui-result__tag">🏷️ {result.tag}</span>
                <div className="ui-mini-tabs" role="tablist" aria-label="캡션 선택">
                  {result.captions.map((_, i) => (
                    <button key={i} type="button" role="tab" aria-selected={pick === i} onClick={() => setPick(i)}>
                      {i + 1}안
                    </button>
                  ))}
                </div>
              </div>

              <blockquote className="ui-quote">{caption}</blockquote>

              {result.warnings.map((w) => (
                <div key={w} className="ui-alert">
                  ⚠️ {w}
                </div>
              ))}

              <div className="ui-tags" aria-label="해시태그">
                {result.hashtags.map((tag) => (
                  <span key={tag}>{tag}</span>
                ))}
              </div>

              {result.reels && (
                <div>
                  <div className="ui-label" style={{ fontWeight: 700, fontSize: 13, marginBottom: 6 }}>
                    🎬 릴스 대본 (15초)
                  </div>
                  <div className="ui-reels">{result.reels}</div>
                </div>
              )}

              <div className="ui-result__actions">
                <button type="button" className="ui-btn ui-btn--sage" onClick={copy}>
                  📋 문구 복사하기
                </button>
                <button type="button" className="ui-btn ui-btn--primary" onClick={register} disabled={saving || result.warnings.length > 0}>
                  {saving ? '등록 중…' : '📢 대표 문구로 등록'}
                </button>
              </div>
            </>
          )}

          {saved.data?.shopPromo && (
            <div className="ui-saved" style={{ position: 'relative' }}>
              <strong>지금 가게 대표 문구</strong> · {formatTime(saved.data.shopPromo.savedAt)} 등록
              <br />
              {saved.data.shopPromo.text}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
