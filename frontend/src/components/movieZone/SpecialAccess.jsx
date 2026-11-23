import { useEffect, useRef, useState } from 'react'
import { requestLocationDocent } from '../../api/course.js'
import { useUiStore } from './uiStore.js'
import { ERA_BADGES, MECHANIC_LABELS, SEOUL_ROUTE, SPECIAL_LOCATIONS, getSpecialLocation } from './specialLocations.js'
import { ACCESS_TOAST, TIME_BADGE_COUNT, TIME_COUPON_TITLE, TIME_STAMP_COUNT, selectTimePass, timePassCount, timeRestoredCount, useSpecialAccess, useTimePass } from './specialAccessStore.js'
import RestorationActivity from './RestorationActivity.jsx'

const PERSONAS = [
  { id: 'drama', guide: 'drama_fan', label: '🎬 K-드라마 팬 모드' },
  { id: 'history', guide: 'history_explorer', label: '🏛️ 역사·건축 탐방 모드' },
  { id: 'en', guide: 'foreign_tourist_en', label: '🌏 외국인 관광객 모드 (EN)' },
]
const generatedNarrations = new Map()
const docentRequests = new Map()

function generateNarration(id) {
  if (!docentRequests.has(id)) {
    docentRequests.set(id, requestLocationDocent(id)
      .then(({ narration }) => {
        if (narration && PERSONAS.every(({ id: mode }) => typeof narration[mode] === 'string' && narration[mode].trim())) {
          generatedNarrations.set(id, narration)
          return narration
        }
        return null
      })
      .catch(() => null)
      .finally(() => docentRequests.delete(id)))
  }
  return docentRequests.get(id)
}

function NewTab({ href, children, className }) {
  return <a className={className} href={href} target="_blank" rel="noopener noreferrer">{children}</a>
}

function AccessDialog({ badge, title, children, onClose, showEntry = false, status, liveView = false }) {
  const dialog = useRef(null)
  const entered = useUiStore((s) => s.toasts.some(({ text }) => text === ACCESS_TOAST))
  useEffect(() => {
    const node = dialog.current
    node.showModal()
    return () => node.close()
  }, [])
  return (
    <dialog className={`special-dialog ui-interactive${liveView ? ' special-dialog--live' : ''}`} ref={dialog} aria-labelledby="special-title"
      onCancel={(event) => { event.preventDefault(); onClose() }}
      onKeyDown={(event) => event.stopPropagation()}>
      <header className="special-dialog__head">
        <div>
          <span className="special-tag">{badge}</span>
          {status && <span className="restoration-badge" data-restored={status === '복원 완료'}>{status}</span>}
          <h2 id="special-title">{title}</h2>
        </div>
        <button type="button" className="ui-btn" aria-label="닫기" onClick={onClose}>×</button>
      </header>
      {showEntry && entered && <div className="special-entry-toast" aria-hidden="true">{ACCESS_TOAST}</div>}
      {children}
    </dialog>
  )
}

function Docent({ location, restored, collected, count, onRestore, onCollect, onClose }) {
  const [persona, setPersona] = useState('drama')
  const { guide } = PERSONAS.find(({ id }) => id === persona)
  const lang = persona === 'en' ? 'en' : 'ko'
  const [generated, setGenerated] = useState(() => generatedNarrations.get(location.id))
  useEffect(() => {
    if (generatedNarrations.has(location.id)) return
    let open = true
    generateNarration(location.id).then((narration) => {
      if (open && narration) setGenerated(narration)
    })
    return () => { open = false }
  }, [location.id])

  const changeTab = (event, index) => {
    const offset = { ArrowLeft:-1, ArrowRight:1 }[event.key]
    if (!offset && event.key !== 'Home' && event.key !== 'End') return
    event.preventDefault()
    const next = offset ? (index+offset+PERSONAS.length)%PERSONAS.length : event.key === 'Home' ? 0 : PERSONAS.length-1
    setPersona(PERSONAS[next].id)
    event.currentTarget.parentElement.children[next]?.focus()
  }
  return (
    <AccessDialog title={location.title} badge="현실 출입제한 구역 가상 특별 개방" onClose={onClose} showEntry
      liveView={location.mechanicType === 'angle_scan'} status={restored ? '복원 완료' : '미복원'}>
      <div className="special-dialog__body">
        {location.introduction && (
          <p className="special-intro" lang={lang}>
            {location.introduction[lang]}
          </p>
        )}
        <section>
          <h3>왜 현실에선 못 들어갈까요?</h3>
          <p>{location.restrictionFact}</p>
        </section>
        <section>
          <h3>드라마 촬영지 비하인드 &amp; 대체 로케이션</h3>
          <p>{location.filmingBehind}</p>
          <p className="special-visit"><strong>방문 참고</strong> {location.realLocation}</p>
          {location.visitNote && <p className="special-visit">{location.visitNote}</p>}
        </section>
        <RestorationActivity location={location} restored={restored} onRestore={onRestore} />
        <section className="special-narration">
          <h3>AI 도슨트 해설</h3>
          <div className="special-tabs" role="tablist" aria-label="해설 관점">
            {PERSONAS.map(({ id, label }, index) => (
              <button key={id} type="button" role="tab" id={`special-tab-${id}`} aria-selected={id === persona}
                aria-controls="special-explanation" tabIndex={id === persona ? 0 : -1}
                onClick={() => setPersona(id)} onKeyDown={(event) => changeTab(event,index)}>{label}</button>
            ))}
          </div>
          <div id="special-explanation" role="tabpanel" aria-labelledby={`special-tab-${persona}`} tabIndex={0}>
            <p lang={lang}>{location.personaGuides[guide]}</p>
            {generated && (
              <details className="special-ai-summary">
                <summary>AI 자료 요약</summary>
                <p lang={lang}>{generated[persona]}</p>
              </details>
            )}
          </div>
        </section>
      </div>
      <footer className="special-dialog__foot">
        <div className="special-source-list">
          <ul className="special-sources" aria-label="도슨트 자료 출처">
            {location.sources.map((name) => <li className="special-source-pill" key={name}>{name}</li>)}
          </ul>
          <details className="special-references">
            <summary>공식 자료 열기</summary>
            <div className="special-sources">
              {location.references.map(({ name, url }) => <NewTab key={url} href={url}>{name}</NewTab>)}
            </div>
          </details>
        </div>
        <div className="special-actions">
          <NewTab className="ui-btn" href={location.kakaoMapUrl}>🗺️ 실제 촬영지 카카오맵 열기</NewTab>
          {collected ? (
            <>
              <span className="special-stamp-saved" role="status">✓ 스탬프북에 저장 · {count} / {TIME_STAMP_COUNT}</span>
              {count === TIME_BADGE_COUNT && <span className="restoration-badge" data-restored="true">🏅 시대 탐정 배지</span>}
              <button type="button" className="ui-btn ui-btn--primary" onClick={onClose}>공간 둘러보기</button>
            </>
          ) : (
            <button type="button" className="ui-btn ui-btn--primary" disabled={!restored} onClick={onCollect}>🔖 시간 탐정 스탬프 획득</button>
          )}
        </div>
      </footer>
    </AccessDialog>
  )
}

function Reward({ issued, onIssue, onClose }) {
  return (
    <AccessDialog title="시간 탐정 역사 복원 마스터 코스 완주" badge={`시간 탐정 스탬프 ${TIME_STAMP_COUNT} / ${TIME_STAMP_COUNT} 완료`} onClose={onClose}>
      <div className="special-dialog__body">
        <section>
          <h3>서울에서 이어 걷는 두 시대</h3>
          <ol className="special-route">
            <li><strong>광화문 월대 → 경복궁</strong>에서 육조거리 축, 근정전, 경회루와 건청궁을 둘러보세요. 전각 내부는 특별관람 일정을 확인하세요.</li>
            <li><strong>흥례문 → 정동길</strong>에서 복원된 궁궐의 축과 근대 거리 풍경을 비교해 보세요.</li>
            <li><strong>문화역서울284</strong>에서 붉은 벽돌 역사와 공개 중인 전시 공간을 찾아보세요.</li>
            <li><strong>서대문형무소역사관</strong>에서 격벽장 야외 전시와 수감자의 기록을 살펴보세요.</li>
          </ol>
          <p>별도 촬영 세트 방문은 합천영상테마파크나 논산 선샤인랜드 일정을 확인하세요.</p>
        </section>
        <section className="special-narration">
          <h3>{TIME_COUPON_TITLE}</h3>
          <p>완주 기념으로 쿠폰함에 보관할 수 있는 가상 티켓입니다.</p>
        </section>
      </div>
      <footer className="special-dialog__foot">
        <NewTab className="ui-btn" href={SEOUL_ROUTE}>🗺️ 경복궁 → 문화역서울284 도보 길찾기</NewTab>
        <button type="button" className="ui-btn ui-btn--primary" onClick={onIssue} disabled={issued}>
          {issued ? '✓ 가상 체험 쿠폰 발급 완료' : '제휴 한복·개화기 의상 대여점 30% 가상 체험 쿠폰 발급'}
        </button>
      </footer>
    </AccessDialog>
  )
}

export default function SpecialAccess({ enabled }) {
  const userId = useUiStore((state) => state.userId)
  const toast = useUiStore((state) => state.toast)
  const pass = useTimePass((state) => selectTimePass(state,userId))
  const era = useSpecialAccess((state) => state.era)
  const nearby = useSpecialAccess((state) => state.nearby)
  const panel = useSpecialAccess((state) => state.panel)
  const close = useSpecialAccess((state) => state.close)
  const warp = useSpecialAccess((state) => state.warp)
  const openDocent = useSpecialAccess((state) => state.openDocent)
  const openReward = useSpecialAccess((state) => state.openReward)
  const count = timePassCount(pass)
  const restoredCount = timeRestoredCount(pass)
  const [expanded, setExpanded] = useState(() => !window.matchMedia('(max-width: 700px)').matches)

  if (!era || !enabled) return null

  const location = getSpecialLocation(panel)
  const collect = () => {
    const next = useTimePass.getState().collect(userId,location.id)
    if (!next) return
    if (next === TIME_BADGE_COUNT) toast('🏅 시대 탐정 배지를 받았어요!', 'ok')
    if (next === TIME_STAMP_COUNT) openReward()
  }
  const issue = () => {
    if (useTimePass.getState().issueCoupon(userId)) toast('쿠폰함에 가상 체험 쿠폰을 넣었어요.','ok')
  }

  return (
    <>
      <p className="special-era" data-era={era}>
        <b>[가상 재구성 공간]</b> <span>{ERA_BADGES[era].join(' · ')}</span>
      </p>
      <aside className="special-tracker ui-interactive" aria-label="시간 탐정">
        <button className="special-tracker__toggle" type="button" aria-expanded={expanded} aria-controls="special-stops"
          onClick={() => setExpanded(!expanded)}>시간 탐정 역사 복원: {restoredCount} / {TIME_STAMP_COUNT} 완료 <span aria-hidden="true">{expanded ? '−' : '+'}</span></button>
        {expanded && <div id="special-stops">
          <div className="restoration-line"><span>스탬프 {count} / {TIME_STAMP_COUNT}</span>{count >= TIME_BADGE_COUNT && <span>🏅 시대 탐정</span>}</div>
          {[['joseon','조선 · 경복궁'],['colonial','일제강점기 · 경성']].map(([period,label]) => (
            <section className="special-stop-group" key={period}>
              <h3>{label}</h3>
              <ul>{SPECIAL_LOCATIONS.filter((stop) => stop.era === period).map(({ id, short, mechanicType }) => (
                <li key={id}>
                  <span><span aria-label={pass.stamps[id] ? '획득 완료' : pass.restored[id] ? '복원 완료' : '미복원'}>
                    {pass.stamps[id] ? '✓' : pass.restored[id] ? '◐' : '○'}</span> {short}<small>{MECHANIC_LABELS[mechanicType]}</small></span>
                  <button type="button" onClick={() => id === nearby ? openDocent(id) : warp(id)}
                    aria-label={short + (id === nearby ? ' 해설 다시 보기' : ' 바로 이동')}>{id === nearby ? '해설' : '워프'}</button>
                </li>
              ))}</ul>
            </section>
          ))}
          {count === TIME_STAMP_COUNT && <button type="button" className="ui-btn" onClick={openReward}>완주 보상 보기</button>}
        </div>}
      </aside>
      {panel === 'reward' && count === TIME_STAMP_COUNT && <Reward issued={Boolean(pass.couponIssuedAt)} onIssue={issue} onClose={close} />}
      {location && <Docent key={location.id} location={location} restored={Boolean(pass.restored[location.id])}
        collected={Boolean(pass.stamps[location.id])} count={count} onCollect={collect} onClose={close}
        onRestore={() => useTimePass.getState().restore(userId,location.id)} />}
    </>
  )
}
