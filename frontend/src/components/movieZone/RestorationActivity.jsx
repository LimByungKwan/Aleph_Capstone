import { useEffect, useRef, useState } from 'react'
import RestorationIllustration from './RestorationIllustration.jsx'
import { useSpecialAccess } from './specialAccessStore.js'

const wrap = (degrees) => ((degrees+180)%360+360)%360-180

function AngleScan({ location, restored, onRestore }) {
  const yaw = useSpecialAccess((s) => s.viewYaw)
  const aim = useSpecialAccess((s) => s.aim)
  const [index, setIndex] = useState(0)
  const [started, setStarted] = useState(false)
  const drag = useRef(null)
  const targets = location.scanTargets
  const target = targets[index]
  const error = Math.abs(wrap(yaw-target.yaw))
  const pointProgress = Math.max(0,1-error/155)
  const value = restored ? 100 : Math.floor(100*(index + (started ? pointProgress : 0))/targets.length)

  useEffect(() => {
    if (restored || !started || error > 10) return
    if (index === targets.length-1) onRestore()
    else {
      setIndex(index+1)
      setStarted(false)
    }
  }, [restored,started,error,index,targets.length,onRestore])

  const turn = (degrees) => {
    setStarted(true)
    aim(wrap(degrees))
  }
  return (
    <>
      <p>{location.actionCue}</p>
      <div className="restoration-angle">
        <div className="restoration-compass" aria-hidden="true">
          <span style={{ transform:`rotate(${wrap(target.yaw-yaw)}deg)` }}>↑</span>
        </div>
        <div className="restoration-drag" tabIndex={0} aria-label="카메라 시점 조작. 좌우 방향키로 회전."
          onPointerDown={(event) => {
            if (event.button !== 0) return
            event.currentTarget.setPointerCapture(event.pointerId)
            drag.current = { x:event.clientX, yaw }
          }} onPointerMove={(event) => {
            if (drag.current && event.currentTarget.hasPointerCapture(event.pointerId)) {
              turn(drag.current.yaw + (event.clientX-drag.current.x)*.85)
            }
          }} onLostPointerCapture={() => { drag.current = null }}
          onKeyDown={(event) => {
            if (!['ArrowLeft','ArrowRight'].includes(event.key)) return
            event.preventDefault()
            turn(yaw+(event.key === 'ArrowRight' ? 15 : -15))
          }}>
          좌우로 드래그하거나 방향키를 눌러 시점 돌리기
        </div>
      </div>
      <div className="restoration-line">
        <strong>시점 스캔 진행도: {value}%</strong>
        <span>{index+1} / {targets.length} · {target.label}</span>
      </div>
      <progress aria-label="시점 스캔 진행도" max={100} value={value} />
      <button type="button" className="ui-btn" onClick={() => turn(target.yaw)} disabled={restored}>시점 자동 정렬</button>
      {restored && <p className="restoration-success" role="status">{location.completionMessage}</p>}
    </>
  )
}

// [7. 유지보수] 슬라이더 손잡이와 그림 경계선이 같은 방향으로 움직입니다.
function EraSlider({ location, restored, onRestore }) {
  const [value, setValue] = useState(restored ? 100 : 0)
  const progress = value >= 95 ? 100 : value

  return (
    <>
      <p>그림의 손잡이를 왼쪽으로 밀어 복원된 모습을 드러내세요.</p>
      <div className="restoration-line">
        <small>기록을 참고한 가상 비교 도해</small>
        <output htmlFor="restoration-range" aria-live="off">복원 {progress}%</output>
      </div>
      <div className="restoration-compare" style={{ '--divider': `${100 - progress}%` }}>
        <RestorationIllustration id={location.id} />
        <div className="restoration-reveal"><RestorationIllustration id={location.id} restored /></div>
        <span className="restoration-divider" aria-hidden="true" />
        <span className="restoration-handle" aria-hidden="true">‹ ›</span>
        <input
          id="restoration-range" type="range" dir="rtl" min={0} max={100} value={value}
          aria-label="시대 복원 슬라이더" aria-valuetext={`복원 ${progress}%`}
          aria-describedby="restoration-comparison-labels"
          onChange={(event) => {
            const next = Number(event.currentTarget.value)
            setValue(next)
            if (next >= 95 && !restored) onRestore()
          }}
        />
      </div>
      <div className="restoration-captions" id="restoration-comparison-labels">
        <span><b>복원 전</b> {location.sliderBeforeLabel}</span>
        <span><b>복원 후</b> {location.sliderAfterLabel}</span>
      </div>
      {restored && (
        <p className="restoration-success" role="status">{location.completionMessage}</p>
      )}
    </>
  )
}

function FactCheck({ location, restored, onRestore }) {
  const [hint, setHint] = useState(false)
  return (
    <>
      <p>{location.actionCue}</p>
      <ul className="restoration-evidence">
        {location.factOptions.map(({ id, text, is_error }, i) => (
          <li key={id}>
            <button type="button" data-fiction={restored && is_error} disabled={restored} onClick={() => {
              if (is_error) onRestore()
              else setHint(true)
            }}><span aria-hidden="true">{i+1}.</span> {text}</button>
          </li>
        ))}
      </ul>
      {restored
        ? <p className="restoration-success" role="status">{location.completionMessage}</p>
        : hint && <p role="status">이 기록은 공식 자료와 일치하는 실제 역사입니다. 드라마적 연출을 찾아보세요!</p>}
    </>
  )
}

const ACTIVITIES = { angle_scan:AngleScan, era_slider:EraSlider, fact_check:FactCheck }
export default function RestorationActivity(props) {
  const Activity = ACTIVITIES[props.location.mechanicType]
  return <section className="restoration-panel"><h3>역사 복원 인터랙션</h3><Activity {...props} /></section>
}
