import { useEffect, useRef } from 'react'
import {
  BRIDGES, CHANNELS, COURTS, PALACE_ACTIVITIES, PALACE_DRAMA_SETS, PONDS, TOUR_ROUTES, TOUR_STOPS, WALKS, WALLS,
} from '../../game/Map/styles/hj/gyeongbokgungLayout.js'
import { GYEONGSEONG_STATION, STREET, STREET_ALLEYS } from '../../game/Map/styles/hj/gyeongseongLayout.js'
import { useSettings } from '../../game/settingsStore.js'
import { palaceGrounds, usePalaceTour } from './palaceTourStore.js'
import PalaceActivityGame from './PalaceActivityGame.jsx'
import './palace-tour.css'

const GROUPS = ['궁문과 정전', '주요 전각']
const [MAP_WIDTH, , MAP_DEPTH] = palaceGrounds?.size ?? [82, 0, 104]
const FRAME_WIDTH = MAP_WIDTH + 4
const FRAME_DEPTH = MAP_DEPTH + 4

function GroundRect({ rect: [x, z, w, d] }) {
  return <rect x={x - w / 2} y={z - d / 2} width={w} height={d} rx=".35" />
}

function PlanLayer({ rectangles, style }) {
  return <g className={style}>{rectangles.map((rect, index) => <GroundRect key={index} rect={rect} />)}</g>
}

function PalacePlan({ destination, travel }) {
  return (
    <div className="palace-plan" style={{ aspectRatio: `${FRAME_WIDTH} / ${FRAME_DEPTH}` }}>
      <svg viewBox={`${-FRAME_WIDTH / 2} ${-FRAME_DEPTH / 2} ${FRAME_WIDTH} ${FRAME_DEPTH}`} aria-hidden="true">
        <g transform="scale(1 -1)">
          <rect className="palace-plan-ground" x={-MAP_WIDTH / 2} y={-MAP_DEPTH / 2} width={MAP_WIDTH} height={MAP_DEPTH} rx="1" />
          <PlanLayer rectangles={[[0, STREET.z, STREET.w, STREET.d]]} style="palace-plan-district" />
          <PlanLayer rectangles={[[STREET.x, STREET.z, STREET.roadWidth, STREET.d], ...STREET_ALLEYS]} style="palace-plan-street" />
          <PlanLayer rectangles={COURTS} style="palace-plan-court" />
          <PlanLayer rectangles={WALKS} style="palace-plan-walk" />
          <PlanLayer rectangles={[...PONDS.map(({ x, z, w, d }) => [x, z, w, d]), ...CHANNELS]} style="palace-plan-water" />
          <PlanLayer rectangles={BRIDGES.map(({ x, z, w, d }) => [x, z, w, d])} style="palace-plan-walk" />
          <g className="palace-plan-wall">
            {WALLS.map(({ x, z, vertical, length }, i) => (
              <line key={i} x1={x - (vertical ? 0 : length / 2)} x2={x + (vertical ? 0 : length / 2)}
                y1={z - (vertical ? length / 2 : 0)} y2={z + (vertical ? length / 2 : 0)} />
            ))}
          </g>
          {TOUR_ROUTES.map(({ name, points, color }) => (
            <polyline className="palace-plan-route" key={name} stroke={color} points={points.map(([x, z]) => `${x},${z}`).join(' ')} />
          ))}
          <g className="palace-plan-hall">
            {TOUR_STOPS.map(({ name, x, z, w = 3.8, d = 2.6, yaw, group }) => (
              <g key={name} data-street={group === '1938 경성 거리' ? true : undefined} onClick={() => travel(name)}>
                <title>{name}</title>
                <GroundRect rect={[x, z, yaw ? d : w, yaw ? w : d]} />
              </g>
            ))}
          </g>
        </g>
      </svg>
      {TOUR_STOPS.map(({ name, x, z, group }) => (
        <button key={name} type="button" className="palace-plan-pin" title={name} aria-label={`${name}(으)로 이동`}
          aria-current={destination === name ? 'location' : undefined}
          style={{ left: `${50 + x / FRAME_WIDTH * 100}%`, top: `${50 - z / FRAME_DEPTH * 100}%`,
            '--palace-pin-color': PALACE_DRAMA_SETS.find((scene) => scene.place === name)?.color
              ?? PALACE_ACTIVITIES.find((activity) => activity.name === name)?.color
              ?? (group === '1938 경성 거리' ? '#e2a76c' : undefined) }}
          tabIndex={-1}
          onClick={() => travel(name)} />
      ))}
    </div>
  )
}

function TourDialog({ destination, onClose, onTravel, bestScores }) {
  const dialog = useRef(null)
  useEffect(() => {
    const node = dialog.current
    node.showModal()
    return () => node.close()
  }, [])

  return (
    <dialog ref={dialog} className="palace-tour-dialog" aria-labelledby="palace-tour-title"
      onCancel={(event) => { event.preventDefault(); onClose() }}>
      <header className="palace-tour-heading">
        <div>
          <h2 id="palace-tour-title">경복궁 관람길</h2>
          <p>지도나 전각 이름을 누르면 바로 이동합니다.</p>
        </div>
        <button type="button" className="palace-tour-close" aria-label="관람 지도 닫기" onClick={onClose}>×</button>
      </header>
      <div className="palace-tour-grid">
        <figure className="palace-tour-figure">
          <PalacePlan destination={destination} travel={onTravel} />
          <figcaption>
            {TOUR_ROUTES.map(({ name, color }) => (
              <span key={name}><i style={{ backgroundColor: color }} />{name}</span>
            ))}
          </figcaption>
        </figure>
        <nav className="palace-tour-stops" aria-label="이동할 전각">
          <section>
            <h3>1938 경성 거리</h3>
            <p className="palace-set-note">후원문 너머 〈구미호뎐 1938〉 테마 거리</p>
            <div className="palace-tour-stop-list palace-street-stops">
              {TOUR_STOPS.filter(({ group, kind }) => group === '1938 경성 거리' && kind !== 'station').map(({ name }) => (
                <button key={name} type="button" aria-current={destination === name ? 'location' : undefined}
                  onClick={() => onTravel(name)}>{name}</button>
              ))}
            </div>
          </section>
          <section>
            <h3>드라마 테마 촬영지</h3>
            <p className="palace-set-note">촬영지와 작품 분위기를 참고한 가상 세트입니다.</p>
            <div className="palace-tour-stop-list palace-filming-stops">
              {PALACE_DRAMA_SETS.map(({ place, title, theme, color }) => (
                <button key={title} type="button" onClick={() => onTravel(place)} style={{ '--palace-set-color': color }}>
                  <b>{title}</b> {place}<small>{theme}</small>
                </button>
              ))}
              <button type="button" onClick={() => onTravel(GYEONGSEONG_STATION.name)} style={{ '--palace-set-color': '#42675e' }}>
                <b>100일의 거짓말</b> {GYEONGSEONG_STATION.name}<small>합천영상테마파크 참고</small>
              </button>
            </div>
          </section>
          <section>
            <h3>궁중 놀이</h3>
            <div className="palace-tour-stop-list palace-filming-stops">
              {PALACE_ACTIVITIES.map(({ id, name, title, color }) => (
                <button key={id} type="button" onClick={() => onTravel(name, true)} style={{ '--palace-set-color': color }}>
                  <b>{title}</b> {name}
                  {bestScores[id] != null && <small>최고 기록 {bestScores[id]}{id === 'archery' ? '점' : '개'}</small>}
                </button>
              ))}
            </div>
          </section>
          {GROUPS.map((group) => (
            <section key={group}>
              <h3>{group}</h3>
              <div className="palace-tour-stop-list">
                {TOUR_STOPS.filter((stop) => stop.group === group).map(({ name }) => (
                  <button type="button" key={name} aria-current={destination === name ? 'location' : undefined}
                    onClick={() => onTravel(name)}>{name}</button>
                ))}
              </div>
            </section>
          ))}
        </nav>
      </div>
    </dialog>
  )
}

export default function PalaceTour({ enabled = true }) {
  const inside = usePalaceTour((state) => state.inside)
  const nearEntrance = usePalaceTour((state) => state.nearEntrance)
  const open = usePalaceTour((state) => state.open)
  const destination = usePalaceTour((state) => state.destination)
  const setOpen = usePalaceTour((state) => state.setOpen)
  const travel = usePalaceTour((state) => state.travel)
  const nearbyActivity = usePalaceTour((state) => state.nearbyActivity)
  const activeActivity = usePalaceTour((state) => state.activeActivity)
  const openActivity = usePalaceTour((state) => state.openActivity)
  const bestScores = usePalaceTour((state) => state.bestScores)
  const night = useSettings((state) => state.timeOfDay === 'night')
  const setTimeOfDay = useSettings((state) => state.setTimeOfDay)
  const activity = PALACE_ACTIVITIES.find(({ id }) => id === nearbyActivity)

  if ((!inside && !nearEntrance) || !enabled) return null
  return (
    <>
      <div className="palace-tour-controls ui-interactive" role="group" aria-label="경복궁 관람 설정">
        <button type="button" aria-haspopup="dialog" className="palace-tour-open"
          onClick={() => setOpen(true)}>{inside ? '경복궁 관람길' : '관람 안내판 보기'}</button>
        {inside && <button type="button" aria-pressed={night} onClick={(event) => {
          event.currentTarget.blur()
          setTimeOfDay(night ? 'noon' : 'night')
        }}>{night ? '낮 보기' : '야경 보기'}</button>}
        {activity && !activeActivity && <button type="button" onClick={openActivity}>{activity.title} 시작</button>}
      </div>
      <span className="palace-tour-status" role="status">{destination ? `${destination} 도착` : ''}</span>
      {open && <TourDialog destination={destination} onClose={() => setOpen(false)} onTravel={travel} bestScores={bestScores} />}
      <PalaceActivityGame />
    </>
  )
}
