// (담당: 병관) 게임 배치로 그린 미니맵에서 데이트 코스를 잘라 안내판의 미션 지도에 표시합니다.
import { useEffect, useRef } from 'react'
import { DATE_MISSIONS, mapPoint } from './bk_dateMission.js'
import { dateMapBounds, drawDateMapBase } from './bk_dateMapPlan.js'

const { left, top, width, height } = dateMapBounds

export function DateCourseMap({ pass, onWarp }) {
  const mapRef = useRef(null)

  useEffect(() => {
    const map = mapRef.current
    const ctx = map.getContext('2d')
    ctx.setTransform(map.width / width, 0, 0, map.height / height, 0, 0)
    drawDateMapBase(ctx)
  }, [])

  return (
    <div className="date-map__plan" role="group" aria-label="데이트 코스 지도">
      <canvas ref={mapRef} width={width * 5} height={height * 5} aria-hidden="true" />
      <span className="date-map__north" aria-label="북쪽">↑ N</span>
      <svg viewBox={`0 0 ${width} ${height}`} aria-label="지도에서 워프할 미션 선택" role="group">
        {DATE_MISSIONS.map((mission, index) => {
          const [x, z] = mapPoint(mission)
          const state = pass.stamps[mission.id] ? 'stamp' : pass.done[mission.id] ? 'done' : 'todo'
          return (
            <g key={mission.id} className="date-map__pin" data-state={state}
              transform={`translate(${x - left} ${z - top})`} role="button" tabIndex={0}
              aria-label={`지도에서 ${mission.short} 워프`} onClick={() => onWarp(mission)}
              onKeyDown={(event) => {
                if (event.key !== 'Enter' && event.key !== ' ') return
                event.preventDefault()
                event.stopPropagation()
                onWarp(mission)
              }}>
              <title>{mission.short}</title>
              <circle r="4.9" />
              <text dy=".34em">{index + 1}</text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}
