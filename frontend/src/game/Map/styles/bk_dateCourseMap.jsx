// (담당: 병관) 게임 배치로 그린 미니맵에서 데이트 코스를 잘라 안내판의 미션 지도에 표시합니다.
import { useEffect, useRef } from 'react'
import { zones } from '../../data/mapData.js'
import { DATE_MISSIONS, mapPoint } from './bk_dateMission.js'
import { getMinimapBase, minimapZoneBounds } from './bk_minimapMap.js'

const [west, north, east, south] = minimapZoneBounds(zones.find(({ zoneId }) => zoneId === 'BK'))
const margin = 5
const left = west - margin
const top = north - margin
const width = east - west + margin * 2
const height = south - north + margin * 2

export function DateCourseMap({ pass, onWarp }) {
  const mapRef = useRef(null)

  useEffect(() => {
    const map = mapRef.current
    const base = getMinimapBase()
    const scaleX = base.canvas.width / base.worldW
    const scaleZ = base.canvas.height / base.worldH
    const ctx = map.getContext('2d')
    ctx.drawImage(base.canvas,
      (left - base.minX) * scaleX, (top - base.minZ) * scaleZ, width * scaleX, height * scaleZ,
      0, 0, map.width, map.height,
    )
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
