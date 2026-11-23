import { useEffect, useRef, useState } from 'react'
import { PALACE_ACTIVITIES } from '../../game/Map/styles/hj/gyeongbokgungLayout.js'
import { usePalaceTour } from './palaceTourStore.js'

const WIDTH = 440
const HEIGHT = 228
const ATTEMPTS = 5
const TARGET = { x: 220, y: 87 }
const JARS = [{ x: 236, y: 97 }, { x: 185, y: 120 }, { x: 263, y: 104 }, { x: 202, y: 89 }, { x: 230, y: 113 }]
const clamp = (value, min, max) => Math.min(max, Math.max(min, value))

function Stage({ children, type, onPointerDown }) {
  const palace = type === 'archery'
  return (
    <svg className="palace-game-stage" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} aria-hidden="true" onPointerDown={onPointerDown}>
      <rect width={WIDTH} height={HEIGHT} fill={palace ? '#c5cec0' : '#c6d4cb'} />
      <path d="M0 119H440V228H0Z" fill={palace ? '#c4a581' : '#c9bc9e'} />
      <path d="M0 115H440V127H0Z" fill="#88715b" />
      <path d="M148 124H292L424 228H16Z" fill={palace ? '#dbc3a1' : '#e3d3b4'} />
      {[23, 76, 364, 417].map((x) => <path key={x} d={`M${x} 38v87`} stroke="#754c38" strokeWidth="7" />)}
      <path d="M0 45H440" stroke="#536651" strokeWidth="10" />
      <path d="M0 34H440" stroke="#554d48" strokeWidth="10" />
      <path d="M72 207H368M99 185H341M126 164H314" stroke="#a99172" opacity=".55" />
      {children}
    </svg>
  )
}

function RecentShot({ shot, origin }) {
  if (!shot) return null
  const path = `M${origin.x} ${origin.y}Q${shot.x - 14} ${shot.y - 61} ${shot.x} ${shot.y}`
  return (
    <g key={shot.id}>
      <path d={path} className="palace-arrow-trail" pathLength="1" />
      <circle cx={shot.x} cy={shot.y} r="5" fill={shot.points ? '#255e52' : '#9c4837'} stroke="#faefd5" strokeWidth="2" />
    </g>
  )
}

function Archery({ shots, record }) {
  const [aim, setAim] = useState({ x: TARGET.x - 24, y: TARGET.y + 20 })
  const last = shots.at(-1)
  const stage = useRef(null)
  const aimAt = (event) => {
    const box = event.currentTarget.getBoundingClientRect()
    setAim({
      x: clamp((event.clientX - box.left) / box.width * WIDTH, 10, WIDTH - 10),
      y: clamp((event.clientY - box.top) / box.height * HEIGHT, 10, HEIGHT - 10),
    })
  }
  const fire = () => {
    const distance = Math.hypot(aim.x - TARGET.x, aim.y - TARGET.y)
    const points = distance <= 12 ? 10 : distance <= 23 ? 7 : distance <= 35 ? 4 : distance <= 46 ? 2 : 0
    record({ ...aim, points })
    setAim({ x: 184 + shots.length * 15, y: 107 })
    stage.current?.focus()
  }
  const keyAim = (event) => {
    const offsets = { ArrowLeft: [-5, 0], ArrowRight: [5, 0], ArrowUp: [0, -5], ArrowDown: [0, 5] }
    const offset = offsets[event.key]
    if (offset) {
      event.preventDefault()
      setAim(({ x, y }) => ({ x: clamp(x + offset[0], 10, WIDTH - 10), y: clamp(y + offset[1], 10, HEIGHT - 10) }))
    } else if ((event.code === 'Space' || event.code === 'Enter') && !event.repeat) {
      event.preventDefault()
      fire()
    }
  }

  return (
    <>
      <p>과녁을 누르거나 방향키로 조준한 뒤 <strong>활 쏘기</strong>를 누르세요.</p>
      <div ref={stage} tabIndex={0} role="group" aria-label="활쏘기 조준. 방향키로 이동하고 스페이스 키로 발사" onKeyDown={keyAim}>
        <Stage type="archery" onPointerDown={aimAt}>
          <path d="M176 144L205 108M264 144L235 108" stroke="#735640" strokeWidth="8" />
          {[[46, '#efe2c5'], [35, '#53685c'], [23, '#984939'], [12, '#e8bc6e']].map(([r, fill]) => (
            <circle key={r} cx={TARGET.x} cy={TARGET.y} r={r} fill={fill} stroke="#7d6152" strokeWidth="1.2" />
          ))}
          <RecentShot shot={last} origin={{ x: 220, y: 223 }} />
          <path d={`M${aim.x - 9} ${aim.y}h18 M${aim.x} ${aim.y - 9}v18`} stroke="#172e29" strokeWidth="2.5" />
        </Stage>
      </div>
      <div className="palace-film-actions"><button type="button" onClick={fire}>활 쏘기</button></div>
    </>
  )
}

function Tuho({ shots, record }) {
  const [direction, setDirection] = useState(50)
  const [power, setPower] = useState(42)
  const jar = JARS[shots.length]
  const last = shots.at(-1)
  const landing = { x: 110 + direction * 2.2, y: 171 - power * 1.23 }
  const throwStick = () => record({
    ...landing,
    points: Math.abs(landing.x - jar.x) < 16 && Math.abs(landing.y - jar.y) < 11 ? 1 : 0,
  })
  return (
    <>
      <p>방향과 힘을 조절해 점선 끝이 항아리 입구에 닿도록 맞추세요.</p>
      <Stage type="tuho">
        <ellipse cx={jar.x} cy={jar.y + 41} rx="34" ry="10" fill="#806d57" opacity=".36" />
        <path d={`M${jar.x - 21} ${jar.y}q-20 13 -10 34q11 17 31 16q20 1 31 -16q10 -21 -10 -34Z`}
          fill="#326555" stroke="#254c42" strokeWidth="2" />
        <path d={`M${jar.x - 31} ${jar.y + 19}q31 11 62 0M${jar.x - 27} ${jar.y + 27}q27 9 54 0`} stroke="#82a386" strokeWidth="2" fill="none" />
        <ellipse cx={jar.x} cy={jar.y} rx="22" ry="10" fill="#213f36" stroke="#97a981" strokeWidth="3" />
        <path d={`M220 222Q${landing.x - 16} ${landing.y - 59} ${landing.x} ${landing.y}`} fill="none" stroke="#664c38"
          strokeWidth="1.7" strokeDasharray="4 5" opacity=".56" />
        <circle cx={landing.x} cy={landing.y} r="4.2" fill="#f7dfb4" stroke="#674936" />
        <RecentShot shot={last} origin={{ x: 220, y: 222 }} />
      </Stage>
      <div className="palace-throw-controls">
        <label>방향 <input type="range" aria-label="투호 방향" value={direction} onChange={(event) => setDirection(Number(event.target.value))} /></label>
        <label>힘 <input type="range" aria-label="투호 힘" value={power} onChange={(event) => setPower(Number(event.target.value))} /></label>
      </div>
      <div className="palace-film-actions"><button type="button" onClick={throwStick}>던지기</button></div>
    </>
  )
}

function Activity({ activity, close, saveScore }) {
  const [shots, setShots] = useState([])
  const archery = activity.id === 'archery'
  const score = shots.reduce((total, shot) => total + shot.points, 0)
  const record = (shot) => {
    const next = [...shots, { ...shot, id: shots.length }]
    setShots(next)
    if (next.length === ATTEMPTS) saveScore(activity.id, score + shot.points)
  }
  const finished = shots.length === ATTEMPTS
  const Game = archery ? Archery : Tuho

  return (
    <section className="palace-film-game">
      <div className="palace-game-score" aria-live="polite">
        <span>{shots.length} / {ATTEMPTS}회</span>
        <strong>{archery ? `${score}점` : `${score}개 성공`}</strong>
      </div>
      {finished ? (
        <div className="palace-film-result">
          <h3>{activity.title} 결과</h3>
          <p>{archery ? `다섯 발을 쏘아 ${score}점을 얻었어요.` : `다섯 번 던져 ${score}개를 넣었어요.`}</p>
          <div className="palace-film-actions">
            <button type="button" onClick={() => setShots([])}>다시 하기</button>
            <button type="button" onClick={close}>궁궐 둘러보기</button>
          </div>
        </div>
      ) : <Game shots={shots} record={record} />}
    </section>
  )
}

// [3. 개발 > 프론트엔드] 활쏘기와 투호의 점수는 관람 세션 안에서 저장합니다.
export default function PalaceActivityGame() {
  const active = usePalaceTour((state) => state.activeActivity)
  const close = usePalaceTour((state) => state.closeActivity)
  const saveScore = usePalaceTour((state) => state.saveScore)
  const dialog = useRef(null)
  const activity = PALACE_ACTIVITIES.find(({ id }) => id === active)
  useEffect(() => {
    if (!activity) return undefined
    const node = dialog.current
    node.showModal()
    return () => node.close()
  }, [activity])
  if (!activity) return null
  return (
    <dialog ref={dialog} className="palace-tour-dialog palace-film-dialog" aria-labelledby="palace-activity-title"
      onCancel={(event) => { event.preventDefault(); close() }} style={{ '--palace-set-color': activity.color }}>
      <header className="palace-tour-heading">
        <div>
          <span className="palace-film-type">{activity.name}</span>
          <h2 id="palace-activity-title">{activity.title}</h2>
        </div>
        <button type="button" className="palace-tour-close" aria-label="놀이 닫기" onClick={close}>×</button>
      </header>
      <Activity key={activity.id} activity={activity} close={close} saveScore={saveScore} />
    </dialog>
  )
}
