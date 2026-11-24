import { useEffect, useRef, useState } from 'react'
import { useUiStore } from '../movieZone/uiStore.js'
import { playerPose } from '../../store/playerPose.js'
import { useGameStore } from '../../store/gameStore.js'
import { CafeOrderMenu } from '../../game/Map/styles/bk_cafeOrder.jsx'
import { MURAL_FRAME_PANEL, MuralFrameView, resetMuralFrame } from '../../game/Map/styles/bk_muralFrame.jsx'
import { currentEpisodeStep, getDateEpisode } from '../../game/Map/styles/bk_dateEpisodes.js'
import { EpisodePanel } from '../../game/Map/styles/bk_episodePanel.jsx'
import { useEpisodeRoom } from '../../game/Map/styles/bk_episodeRoom.js'
import { useWarps } from '../../game/Map/styles/bk_warpStore.js'
import { DATE_BADGE_COUNT, DATE_MISSIONS, DATE_STAMP_COUNT, getMission, inDateZone, mapPoint, openNearby, useDateMission } from '../../game/Map/styles/bk_dateMission.js'
import './dateMission.css'

// 데이트 코스 미션 화면 (담당: 병관) — 영화·드라마 구역 "시간 탐정"(혜진 님 SpecialAccess.jsx)과 같은 모양
//   위: [데이트 코스] 띠 / 오른쪽: 미션 목록(○ ◐ ✓ + 워프) / 장소 카드(설명·하는 법·📍 내 근처·스탬프) / 지도 / 완주 보상
// 모양은 cinema.css의 special-* 클래스를 그대로 써서 두 구역이 같은 느낌 (색만 dateMission.css에서 분홍으로)

const EMPTY = { done: {}, stamps: {} }
const NEAR = 10 // 이 거리(m) 안이면 [워프] 대신 [안내]
const CAFE = getMission('cafe')
const MURAL = getMission('mural')
const CAFE_ORDER_PANEL = 'bkCafeOrder'

function atCafeCounter() {
  const [x, z] = mapPoint(CAFE)
  return playerPose.ready && playerPose.z >= z - 1.2 && Math.hypot(playerPose.x - x, playerPose.z - z) <= 1.8
}

function atMuralStand() {
  const [x, z] = mapPoint(MURAL)
  return playerPose.ready && Math.hypot(playerPose.x - x, playerPose.z - z) <= 1.8
}

function openActivity(type, canStart, prepare) {
  const game = useGameStore.getState()
  if (!canStart() || game.openPanel) return false
  prepare?.()
  useDateMission.getState().close()
  game.open({ type })
  return true
}

function closeActivity(type) {
  const game = useGameStore.getState()
  if (game.openPanel?.type === type) game.close()
}

const openCafeOrder = () => openActivity(CAFE_ORDER_PANEL, atCafeCounter)
const closeCafeOrder = () => closeActivity(CAFE_ORDER_PANEL)
const openMuralFrame = () => openActivity(MURAL_FRAME_PANEL, atMuralStand, resetMuralFrame)
const closeMuralFrame = () => closeActivity(MURAL_FRAME_PANEL)

function warpTo(m) {
  useWarps.getState().goto({
    ...(m.anchor ? { anchor: m.anchor } : { center: m.center }),
    label: m.short,
    onArrive: () => useDateMission.getState().openCard(m.id),
  })
}

export default function DateMission({ enabled = true }) {
  const userId = useUiStore((s) => s.userId)
  const toast = useUiStore((s) => s.toast)
  const saved = useDateMission((s) => s.saved)
  const card = useDateMission((s) => s.card)
  const mapOpen = useDateMission((s) => s.mapOpen)
  const panelOpen = useGameStore((s) => Boolean(s.openPanel))
  const cafeOrderOpen = useGameStore((s) => s.openPanel?.type === CAFE_ORDER_PANEL)
  const muralFrameOpen = useGameStore((s) => s.openPanel?.type === MURAL_FRAME_PANEL)
  const { openCard, openMap, close } = useDateMission.getState()
  const pass = saved.accounts[userId] ?? EMPTY
  const episodeInvite = useEpisodeRoom((s) => s.invite)
  const episodeRoom = useEpisodeRoom((s) => s.room)
  const episodeInProgress = Boolean(episodeRoom || pass.episodeBook?.currentId)
  const episodeNext = episodeRoom ? getDateEpisode(episodeRoom.episodeId)?.steps[episodeRoom.step] : currentEpisodeStep(pass.episodeBook)
  const episodeLabel = episodeInvite ? '💌 데이트 초대' : episodeRoom ? '💌 함께 걷는 중'
    : episodeInProgress ? (episodeNext ? '💌 에피소드 이어 하기' : '💌 엔딩 엽서 쓰기') : '💌 데이트 에피소드'
  const [here, setHere] = useState({ inZone: false, atCafe: false, atMural: false, x: 0, z: 0 })
  const [expanded, setExpanded] = useState(() => !window.matchMedia?.('(max-width: 700px)').matches)

  // 데이트 코스 구역 안에 있는지 (0.5초마다)
  useEffect(() => {
    const tick = () => {
      const inZone = playerPose.ready && inDateZone(playerPose.x, playerPose.z)
      const atCafe = atCafeCounter()
      const atMural = atMuralStand()
      setHere((h) => (h.inZone === inZone && h.atCafe === atCafe && h.atMural === atMural && Math.abs(h.x - playerPose.x) < 2 && Math.abs(h.z - playerPose.z) < 2
        ? h : { inZone, atCafe, atMural, x: playerPose.x, z: playerPose.z }))
    }
    tick()
    const timer = setInterval(tick, 500)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    if (!enabled) {
      closeCafeOrder()
      closeMuralFrame()
      return
    }
    const onKeyDown = (event) => {
      if (event.code !== 'KeyE' || event.repeat || event.altKey || event.ctrlKey || event.metaKey) return
      if (event.target instanceof HTMLElement && event.target.closest('input, select, textarea, [contenteditable], dialog')) return
      const date = useDateMission.getState()
      if (date.card || date.mapOpen || !(openCafeOrder() || openMuralFrame())) return
      // 주문 카운터와 벽화 발자국에서는 E로 데이트 체험을 열어요.
      event.preventDefault()
      event.stopImmediatePropagation()
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [enabled])

  if (!enabled) return null
  if (muralFrameOpen) return (
    <MuralFrameView onClose={closeMuralFrame} onComplete={() => {
      useDateMission.getState().markDone('mural')
      closeMuralFrame()
      openCard('mural')
    }} />
  )
  if (!here.inZone && !card && !mapOpen && !cafeOrderOpen && !episodeInProgress && !episodeInvite) return null
  const doneCount = Object.keys(pass.done).length
  const stampCount = Object.keys(pass.stamps).length
  const near = (m) => {
    const [x, z] = mapPoint(m)
    return Math.hypot(x - here.x, z - here.z) < NEAR
  }
  const collect = (id) => {
    const count = useDateMission.getState().collect(id)
    if (count === DATE_STAMP_COUNT) openCard('reward')
    else if (count) toast?.(`🔖 데이트 스탬프 ${count} / ${DATE_STAMP_COUNT}`, 'ok')
  }
  const mission = card ? getMission(card) : null
  const atActivity = !panelOpen && (here.atCafe || here.atMural)
  const activity = here.atCafe
    ? { id: 'cafe', label: '주문하기', open: openCafeOrder }
    : { id: 'mural', label: '구도 맞추기', open: openMuralFrame }

  return (
    <>
      {here.inZone && (
        <p className="special-era" data-era="date">
          <b>[데이트 코스]</b> <span>커플 미션 {DATE_STAMP_COUNT}곳 · 스탬프 {stampCount} / {DATE_STAMP_COUNT}</span>
        </p>
      )}
      {here.inZone && (
        <aside className="special-tracker date-tracker ui-interactive" aria-label="데이트 코스 미션">
          <button className="special-tracker__toggle" type="button" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>
            데이트 코스 미션: {doneCount} / {DATE_STAMP_COUNT} 완료 <span aria-hidden="true">{expanded ? '−' : '+'}</span>
          </button>
          {expanded && (
            <div>
              <div className="restoration-line">
                <span>스탬프 {stampCount} / {DATE_STAMP_COUNT}</span>
                {stampCount >= DATE_BADGE_COUNT && <span>💗 데이트 탐험가</span>}
              </div>
              <section className="special-stop-group">
                <h3>💕 데이트 코스</h3>
                <ul>
                  {DATE_MISSIONS.map((m) => (
                    <li key={m.id}>
                      <span>
                        <span aria-label={pass.stamps[m.id] ? '획득 완료' : pass.done[m.id] ? '체험 완료' : '미완료'}>{pass.stamps[m.id] ? '✓' : pass.done[m.id] ? '◐' : '○'}</span> {m.short}
                        <small>{m.kind}</small>
                      </span>
                      <button type="button" onClick={() => (near(m) ? openCard(m.id) : warpTo(m))} aria-label={m.short + (near(m) ? ' 안내 보기' : ' 바로 이동')}>
                        {near(m) ? '안내' : '워프'}
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
              <div className="date-tracker__foot">
                <button type="button" className="ui-btn" onClick={openMap}>🗺️ 데이트 코스 지도</button>
                <button type="button" className="ui-btn" onClick={() => openCard('episodes')}>{episodeLabel}</button>
                {stampCount === DATE_STAMP_COUNT && <button type="button" className="ui-btn" onClick={() => openCard('reward')}>완주 보상 보기</button>}
              </div>
            </div>
          )}
        </aside>
      )}
      {atActivity && !episodeInvite && !card && !mapOpen && (
        <button type="button" className="ui-btn ui-interactive date-activity-prompt" onClick={activity.open}>
          <kbd>E</kbd> {here.atCafe ? '소란 커피 주문하기' : '엔딩 장면 맞추기'}
        </button>
      )}
      {(episodeInvite || (!here.inZone && episodeInProgress)) && !panelOpen && !card && !mapOpen && (
        <button type="button" className="ui-btn ui-interactive date-activity-prompt" onClick={() => openCard('episodes')}>
          {episodeInvite ? episodeLabel : episodeNext ? `💌 이어서 하기 · ${getMission(episodeNext.id).short}` : '💌 엔딩 엽서 쓰기'}
        </button>
      )}
      {cafeOrderOpen && (
        <Dialog badge="☕ 소란 커피" title="상대 취향으로 한 잔" onClose={closeCafeOrder}>
          <CafeOrderMenu key={userId} stamped={Boolean(pass.stamps.cafe)} onClose={closeCafeOrder}
            onOrder={(order) => useDateMission.getState().markDone('cafe', order)}
            onViewMission={() => { closeCafeOrder(); openCard('cafe') }} />
        </Dialog>
      )}
      {!cafeOrderOpen && mission && (
        <MissionCard key={mission.id} m={mission} done={Boolean(pass.done[mission.id])} stamped={Boolean(pass.stamps[mission.id])} count={stampCount}
          isNear={near(mission)} activity={atActivity && mission.id === activity.id ? activity : null}
          onCollect={() => collect(mission.id)} onClose={close} />
      )}
      {!cafeOrderOpen && card === 'reward' && <Reward onClose={close} />}
      {!cafeOrderOpen && card === 'episodes' && (
        <Dialog badge="💌 데이트 코스" title="데이트 에피소드" onClose={close}>
          <EpisodePanel key={userId} book={pass.episodeBook} onClose={close} />
        </Dialog>
      )}
      {!cafeOrderOpen && mapOpen && <DateMap pass={pass} onClose={close} />}
    </>
  )
}

// 영화·드라마 구역 AccessDialog와 같은 틀
function Dialog({ badge, status, done, title, children, onClose }) {
  const ref = useRef(null)
  useEffect(() => {
    const node = ref.current
    node.showModal()
    return () => node.close()
  }, [])
  return (
    <dialog className="special-dialog date-dialog ui-interactive" ref={ref} aria-labelledby="date-title"
      onCancel={(e) => (e.preventDefault(), onClose())} onKeyDown={(e) => e.stopPropagation()}>
      <header className="special-dialog__head">
        <div>
          <span className="special-tag">{badge}</span>
          {status && <span className="restoration-badge" data-restored={done}>{status}</span>}
          <h2 id="date-title">{title}</h2>
        </div>
        <button type="button" className="ui-btn" aria-label="닫기" onClick={onClose}>×</button>
      </header>
      {children}
    </dialog>
  )
}

function NearbyButtons({ keywords, showCafeDetails = false }) {
  return (
    <section className="special-narration">
      <h3>📍 내 근처에서 실제로 가 보기</h3>
      <div className="special-actions">
        {keywords.map((k) => (
          <button key={k} type="button" className="ui-btn" onClick={() => openNearby(k)}>내 근처 {k} 지도에서 보기</button>
        ))}
      </div>
      {showCafeDetails && <p className="special-visit">지도에서 카페를 고르면 영업시간을 볼 수 있어요. 홈페이지가 등록된 카페는 상세정보에서 열 수 있어요.</p>}
      <p className="special-visit">위치를 허용하면 내 주변을 검색해요. 위치는 지도 서비스에만 전달돼요. 위치를 사용할 수 없으면 일반 검색이 열려요.</p>
    </section>
  )
}

function MissionCard({ m, done, stamped, count, isNear, activity, onCollect, onClose }) {
  return (
    <Dialog badge={`${m.icon} 데이트 코스 미션 · ${m.kind}`} status={done ? '체험 완료' : '아직이에요'} done={done} title={m.short} onClose={onClose}>
      <div className="special-dialog__body">
        <p className="special-intro">{m.intro}</p>
        <section>
          <h3>어떻게 하나요?</h3>
          <p>{m.how}</p>
          {activity && <button type="button" className="ui-btn date-activity-start" onClick={activity.open}>{m.icon} {activity.label}</button>}
        </section>
        <NearbyButtons keywords={m.nearby} showCafeDetails={m.id === 'cafe'} />
      </div>
      <footer className="special-dialog__foot">
        <div className="special-actions">
          {!isNear && <button type="button" className="ui-btn" onClick={() => warpTo(m)}>🌀 이 장소로 워프</button>}
        </div>
        <div className="special-actions">
          {stamped ? (
            <>
              <span className="special-stamp-saved" role="status">✓ 데이트 스탬프 · {count} / {DATE_STAMP_COUNT}</span>
              <button type="button" className="ui-btn ui-btn--primary" onClick={onClose}>둘러보기</button>
            </>
          ) : (
            <button type="button" className="ui-btn ui-btn--primary" disabled={!done} onClick={onCollect}>
              🔖 데이트 스탬프 받기{!done && ' (체험을 먼저 끝내요)'}
            </button>
          )}
        </div>
      </footer>
    </Dialog>
  )
}

function Reward({ onClose }) {
  return (
    <Dialog badge="💕 데이트 코스 완주" title="데이트 코스 마스터!" onClose={onClose}>
      <div className="special-dialog__body">
        <p className="special-intro">데이트 코스 미션 {DATE_STAMP_COUNT}곳을 모두 마쳤어요. 이제 오늘 게임에서 한 데이트를 실제로도 이어 가 보세요!</p>
        <NearbyButtons keywords={['데이트 코스', '분위기 좋은 카페', '야경 명소']} />
      </div>
      <footer className="special-dialog__foot">
        <span />
        <button type="button" className="ui-btn ui-btn--primary" onClick={onClose}>닫기</button>
      </footer>
    </Dialog>
  )
}

// 데이트 코스 안내판 지도: 구역 모양 + 미션 위치 핀 (누르면 워프) + 목록
const MAP = { minX: 45, maxX: 125, minZ: -120, maxZ: 40, w: 160, h: 320 }
const toMap = ([x, z]) => [((x - MAP.minX) / (MAP.maxX - MAP.minX)) * MAP.w, ((z - MAP.minZ) / (MAP.maxZ - MAP.minZ)) * MAP.h]

function DateMap({ pass, onClose }) {
  const go = (m) => {
    onClose()
    warpTo(m)
  }
  return (
    <Dialog badge="🗺️ 데이트 코스 안내판" title="데이트 코스 둘러보기" onClose={onClose}>
      <div className="special-dialog__body date-map">
        <svg viewBox={`-10 -10 ${MAP.w + 20} ${MAP.h + 20}`} role="img" aria-label="데이트 코스 지도">
          <rect x="0" y="0" width={MAP.w} height={MAP.h} rx="10" className="date-map__zone" />
          <rect x="0" y={toMap([45, 0])[1] - 6} width={MAP.w} height="12" className="date-map__road" />
          <text x={MAP.w / 2} y={toMap([45, 0])[1] - 10} className="date-map__label">입구 ← 중앙 광장</text>
          <rect x={MAP.w * 0.1} y="4" width={MAP.w * 0.8} height={toMap([0, -40])[1] - 8} rx="40" className="date-map__hill" />
          <text x={MAP.w / 2} y={MAP.h * 0.06} className="date-map__label">언덕 · 전망대</text>
          {DATE_MISSIONS.map((m) => {
            const [x, y] = toMap(mapPoint(m))
            const state = pass.stamps[m.id] ? 'stamp' : pass.done[m.id] ? 'done' : 'todo'
            return (
              <g key={m.id} className="date-map__pin" data-state={state} transform={`translate(${x} ${y})`} onClick={() => go(m)} role="button" tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && go(m)} aria-label={`${m.short}로 워프`}>
                <circle r="11" />
                <text y="5">{m.icon}</text>
              </g>
            )
          })}
        </svg>
        <ol className="special-route date-map__list">
          {DATE_MISSIONS.map((m) => (
            <li key={m.id}>
              <span>
                {pass.stamps[m.id] ? '✓' : pass.done[m.id] ? '◐' : '○'} {m.icon} <b>{m.short}</b> <small>{m.kind}</small>
              </span>
              <button type="button" className="ui-btn" onClick={() => go(m)}>워프</button>
            </li>
          ))}
        </ol>
      </div>
    </Dialog>
  )
}
