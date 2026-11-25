import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { LETTER_STATIONS } from '@shared/bk_letterPuzzle.js'
import { layout, zones } from '../../game/data/mapData.js'
import { PLACE_COLORS } from '../../game/config.js'
import { getMinimapBase, MAP_GRASS, minimapZoneBounds } from '../../game/Map/styles/bk_minimapMap.js'
import { drawMinimapPlaceHint, drawMinimapZones, minimapLandmarks, pickMinimapPlace, placesByMapZone } from '../../game/Map/styles/bk_minimapLabels.js'
import { useCourseStore } from '../../store/courseStore.js'
import { tutorialTarget, useTutorial } from '../../store/tutorialStore.js'
import { useGameStore } from '../../store/gameStore.js'
import { playerPose } from '../../store/playerPose.js'
import { WARPS, isLoggedIn, useWarps } from '../../game/Map/styles/bk_warpStore.js'
import { currentEpisodeStep, getDateEpisode } from '../../game/Map/styles/bk_dateEpisodes.js'
import { DATE_MISSIONS, mapPoint, useDateMission } from '../../game/Map/styles/bk_dateMission.js'
import { useEpisodeRoom } from '../../game/Map/styles/bk_episodeRoom.js'
import { useUiStore } from '../movieZone/uiStore.js'
import './minimap.css'

// 미니맵 (담당: 병관) — 오른쪽 아래, [🗺 미니맵] 버튼으로 열고 닫음
// - 위쪽이 북쪽(애니메이션 구역). 구역 색, 길, 건물, 촬영지·가게 점
// - 내 캐릭터: 가운데 화살표 (카메라가 보는 방향)
// - 루미 코스: 지금 가야 할 한 곳만 점선 + 분홍 점. 미니맵 밖이면 가장자리에 방향 표시
// - [주변/전체]로 보기 전환, 전체 지도는 휠로 확대·축소하고 드래그로 이동

const SIZE_STEPS = 4
const ZOOMS = { near: '주변', all: '전체' }
const MAX_OVERVIEW_ZOOM = 4
const OVERVIEW_HINT = '휠로 확대·축소 · 드래그로 지도 이동'
const DRAG_THRESHOLD = 4 // 작은 손 떨림과 워프 아이콘 클릭을 구분하는 화면 거리(px)
const COURSE_COLOR = '#ff6fa3'
const EPISODE_COLOR = '#ffe189'
const EPISODE_STOPS = Object.fromEntries(DATE_MISSIONS.map((mission) => {
  const [x, z] = mapPoint(mission)
  return [mission.id, { name: mission.short, position: [x, 0, z] }]
}))
const STORAGE_KEY = 'scenewalk.minimap'

function drawDistanceScale(ctx, width, height, scale, meters) {
  const half = meters * scale / 2
  const x = width / 2
  const y = height - 13
  ctx.beginPath()
  ctx.moveTo(x - half, y - 3)
  ctx.lineTo(x - half, y)
  ctx.lineTo(x + half, y)
  ctx.lineTo(x + half, y - 3)
  ctx.strokeStyle = '#fff9ed'
  ctx.lineWidth = 3.5
  ctx.stroke()
  ctx.strokeStyle = '#344e45'
  ctx.lineWidth = 1.4
  ctx.stroke()
  ctx.font = '700 9px system-ui, sans-serif'
  ctx.lineJoin = 'round'
  ctx.strokeStyle = '#fff9ed'
  ctx.lineWidth = 2.5
  ctx.strokeText(`${meters}m`, x, y - 8)
  ctx.fillStyle = '#344e45'
  ctx.fillText(`${meters}m`, x, y - 8)
}

function canvasPoint(event, canvas, width, height) {
  const rect = canvas.getBoundingClientRect()
  return [(event.clientX - rect.left) * width / rect.width, (event.clientY - rect.top) * height / rect.height]
}

function readSaved() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) ?? {}
  } catch {
    return {}
  }
}
function save(value) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(value))
  } catch {
    // 저장이 막힌 브라우저면 그냥 기억 못 함
  }
}

export default function Minimap() {
  const saved = readSaved()
  const [open, setOpen] = useState(saved.open ?? true)
  const [zoom, setZoom] = useState(saved.zoom === 'all' ? 'all' : 'near')
  const [sizeIndex, setSizeIndex] = useState(Number.isInteger(saved.sizeIndex) && saved.sizeIndex >= 0
    && saved.sizeIndex < SIZE_STEPS ? saved.sizeIndex : 1)
  const panelOpen = useGameStore((s) => Boolean(s.openPanel))
  const [picked, setPicked] = useState(null) // 미니맵에서 누른 워프존

  useEffect(() => save({ open, zoom, sizeIndex }), [open, zoom, sizeIndex])

  // 대화창이 열려 있으면 가리지 않게 잠깐 숨김
  if (panelOpen) return null

  if (!open) {
    return (
      <button type="button" className="mm-toggle ui-interactive" onClick={(e) => (e.currentTarget.blur(), setOpen(true))}>
        미니맵
      </button>
    )
  }

  return (
    <section className="mm ui-interactive" aria-label="미니맵" data-size={sizeIndex}>
      <div className="mm__head">
        <span className="mm__title">미니맵</span>
        <div className="mm__zoom" role="group" aria-label="미니맵 보기 모드">
          {Object.entries(ZOOMS).map(([key, label]) => (
            <button key={key} type="button" aria-pressed={zoom === key} className={zoom === key ? 'is-on' : ''} onClick={(e) => (e.currentTarget.blur(), setZoom(key))}>
              {label}
            </button>
          ))}
        </div>
        <button type="button" className="mm__close" aria-label="미니맵 숨기기" onClick={(e) => (e.currentTarget.blur(), setOpen(false))}>
          ✕
        </button>
      </div>
      <MinimapCanvas key={zoom} zoom={zoom} onPickWarp={setPicked} />
      <div className="mm__size" role="group" aria-label="미니맵 패널 크기">
        <span>크기</span>
        <button type="button" aria-label="미니맵 작게" disabled={sizeIndex === 0}
          onClick={(e) => (e.currentTarget.blur(), setSizeIndex((index) => Math.max(0, index - 1)))}>−</button>
        <button type="button" aria-label="미니맵 크게" disabled={sizeIndex === SIZE_STEPS - 1}
          onClick={(e) => (e.currentTarget.blur(), setSizeIndex((index) => Math.min(SIZE_STEPS - 1, index + 1)))}>+</button>
      </div>
      {picked && <WarpConfirm warp={picked} onClose={() => setPicked(null)} />}
    </section>
  )
}

// 워프존 아이콘을 눌렀을 때: 로그인 안 함 / 아직 안 켜짐 / 이동할지 묻기
export function WarpConfirm({ warp, onClose, onWarp = onClose }) {
  const unlocked = useWarps((s) => s.unlocked.includes(warp.id))
  const loggedIn = isLoggedIn()
  const go = () => {
    if (useWarps.getState().warp(warp.id) === null) onWarp()
    else onClose()
  }
  return (
    <div className="mm-warp" role="dialog" aria-label="워프존">
      <div className="mm-warp__title">
        {warp.icon} {warp.name} 워프존
      </div>
      {!loggedIn ? (
        <p>로그인해야 워프존으로 이동할 수 있어요.</p>
      ) : !unlocked ? (
        <p>🔒 아직 꺼져 있어요. {warp.name} 구역 입구 안쪽 워프존 근처에 한 번 가면 켜져요.</p>
      ) : (
        <p>이 지역으로 이동하겠습니까?</p>
      )}
      <div className="mm-warp__btns">
        {loggedIn && unlocked ? (
          <>
            <button type="button" onClick={onClose}>취소</button>
            <button type="button" className="is-go" onClick={go}>🌀 이동</button>
          </>
        ) : (
          <button type="button" onClick={onClose}>확인</button>
        )}
      </div>
    </div>
  )
}

export function MinimapCanvas({ zoom, onPickWarp, wide = false }) {
  const canvasRef = useRef(null)
  const [{ width, height }, setSize] = useState({ width: 0, height: 0 })
  const [zoneId, setZoneId] = useState('')
  const [zoomFactor, setZoomFactor] = useState(1)
  const mapControls = useRef(null)
  const [hovered, setHovered] = useState(null)
  const [pickedPlace, setPickedPlace] = useState(null)
  const focusedPlace = wide ? pickedPlace ?? hovered : hovered ?? pickedPlace
  const focus = useRef(null)
  const hoverHint = useRef(null)
  const overviewView = useRef(null)
  const dragged = useRef(false)
  const view = useRef(null) // 마지막으로 그린 좌표 변환 (장소와 워프 아이콘 확인용)
  const userId = useUiStore((s) => s.userId)
  const soloStep = useDateMission((s) => currentEpisodeStep(s.saved.accounts[userId]?.episodeBook)?.id)
  const sharedStep = useEpisodeRoom(({ room }) => {
    if (room?.letter) return room.letter.solved ? 'mural' : LETTER_STATIONS[room.letter.role]?.mission
    return room ? getDateEpisode(room.episodeId)?.steps[room.step]?.id : null
  })
  const guideEnabled = useDateMission((s) => s.episodeGuide === userId)
  const episodeStop = guideEnabled ? EPISODE_STOPS[sharedStep ?? soloStep] : undefined

  useEffect(() => { focus.current = focusedPlace }, [focusedPlace])

  useLayoutEffect(() => {
    const canvas = canvasRef.current
    const measure = () => {
      const rect = canvas.getBoundingClientRect()
      const width = Math.round(rect.width)
      const height = Math.round(rect.height)
      setSize((size) => size.width === width && size.height === height ? size : { width, height })
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(canvas)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!width || !height) return
    const canvas = canvasRef.current
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = Math.round(width * dpr)
    canvas.height = Math.round(height * dpr)
    const ctx = canvas.getContext('2d')
    ctx.scale(canvas.width / width, canvas.height / height)
    ctx.imageSmoothingQuality = 'high'
    const base = getMinimapBase()
    const overview = zoom === 'all'
    const centerX = width / 2
    const centerY = height / 2
    const [left, top, right, bottom] = base.playableBounds
    const fitScale = wide
      ? Math.min((width - 36) / (right - left), (height - 36) / (bottom - top))
      : (centerX - 5) / base.allRadius
    const contains = (x, y, margin = 0) => wide
      ? x >= margin && y >= margin && x <= width - margin && y <= height - margin
      : Math.hypot(x - centerX, y - centerY) <= centerX - margin
    const fitView = { x: base.centerX, z: base.centerZ, factor: 1 }
    if (!overview) overviewView.current = null
    let drag = null
    const inputs = new AbortController()

    const moveOverview = (x, z, factor) => {
      if (wide) {
        hoverHint.current = null
        overviewView.current = { x: Math.min(right, Math.max(left, x)), z: Math.min(bottom, Math.max(top, z)), factor }
        setZoomFactor(factor)
        return
      }
      const offsetX = x - fitView.x
      const offsetZ = z - fitView.z
      // 기본 배율에서도 조금 이동할 수 있고, 확대하면 더 넓은 범위를 살펴볼 수 있어요.
      const radius = base.allRadius * Math.max(0.36, 1 - 1 / factor)
      const limit = Math.min(1, radius / Math.max(radius, Math.hypot(offsetX, offsetZ)))
      overviewView.current = { x: fitView.x + offsetX * limit, z: fitView.z + offsetZ * limit, factor }
    }

    function resetOverview() {
      overviewView.current = null
      if (wide) {
        hoverHint.current = null
        setZoomFactor(1)
        setZoneId('')
        setPickedPlace(null)
      }
    }

    if (wide) {
      mapControls.current = {
        reset: resetOverview,
        zoomBy: (step) => {
          const current = overviewView.current ?? fitView
          const factor = Math.min(MAX_OVERVIEW_ZOOM, Math.max(1, current.factor * step))
          if (factor === 1) resetOverview()
          else moveOverview(current.x, current.z, factor)
        },
        zone: (zone) => {
          const [x0, z0, x1, z1] = minimapZoneBounds(zone)
          const scale = Math.min((width - 42) / (x1 - x0), (height - 42) / (z1 - z0))
          moveOverview((x0 + x1) / 2, (z0 + z1) / 2, Math.min(MAX_OVERVIEW_ZOOM, Math.max(1.35, scale / fitScale)))
        },
        place: ([x, z]) => {
          const factor = Math.max(overviewView.current?.factor ?? 1, 2.4 / fitScale)
          moveOverview(x, z, Math.min(MAX_OVERVIEW_ZOOM, factor))
        },
      }
    }

    const onWheel = (event) => {
      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? height : 1
      if (event.deltaY === 0) return
      event.preventDefault()
      event.stopPropagation()
      setHovered(null)

      const current = overviewView.current ?? fitView
      const factor = Math.min(MAX_OVERVIEW_ZOOM, Math.max(1,
        current.factor * Math.exp(-event.deltaY * unit / 400),
      ))
      if (factor === 1) {
        resetOverview()
        return
      }

      // 확대 중 마우스가 가리키는 지점은 같은 화면 위치에 두고, 중심이 지도 바깥으로 밀리지 않게 합니다.
      const [px, py] = canvasPoint(event, canvas, width, height)
      const shift = (1 / current.factor - 1 / factor) / fitScale
      moveOverview(current.x + (px - centerX) * shift, current.z + (py - centerY) * shift, factor)
    }

    const startDrag = (event) => {
      if (!event.isPrimary || event.button !== 0 || drag) return
      event.stopPropagation()
      dragged.current = false
      drag = { id: event.pointerId, startX: event.clientX, startY: event.clientY, point: canvasPoint(event, canvas, width, height) }
      canvas.setPointerCapture(event.pointerId)
    }

    const moveDrag = (event) => {
      if (drag?.id !== event.pointerId) return
      if (!dragged.current) {
        if (Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) < DRAG_THRESHOLD) return
        dragged.current = true
        setHovered(null)
        hoverHint.current = null
        canvas.dataset.dragging = ''
        canvas.style.cursor = ''
      }
      event.stopPropagation()
      const point = canvasPoint(event, canvas, width, height)
      const current = overviewView.current ?? fitView
      const scale = current.factor * fitScale
      moveOverview(current.x - (point[0] - drag.point[0]) / scale,
        current.z - (point[1] - drag.point[1]) / scale, current.factor)
      drag.point = point
    }

    const finishDrag = (event) => {
      if (drag?.id !== event.pointerId) return
      drag = null
      delete canvas.dataset.dragging
    }

    if (overview) {
      const { signal } = inputs
      canvas.addEventListener('wheel', onWheel, { passive: false, signal })
      canvas.addEventListener('pointerdown', startDrag, { signal })
      canvas.addEventListener('pointermove', moveDrag, { signal })
      canvas.addEventListener('pointerup', finishDrag, { signal })
      canvas.addEventListener('pointercancel', finishDrag, { signal })
      canvas.addEventListener('lostpointercapture', finishDrag, { signal })
    }

    let raf = 0
    let lastDraw = -Infinity

    const draw = (now) => {
      raf = requestAnimationFrame(draw)
      if (now - lastDraw < 30) return
      lastDraw = now
      const { course, index } = useCourseStore.getState()
      const me = playerPose.ready ? playerPose : { x: layout.playerStart[0], z: layout.playerStart[1], dirX: 0, dirZ: -1 }
      const { x: cx, z: cz, factor } = overview ? overviewView.current ?? fitView : { x: me.x, z: me.z }
      const scale = overview ? factor * fitScale : width * 1.85 / 200
      const toScreen = (x, z) => [(x - cx) * scale + centerX, (z - cz) * scale + centerY]

      ctx.clearRect(0, 0, width, height)
      ctx.save()
      if (!wide) {
        ctx.beginPath()
        ctx.arc(centerX, centerY, centerX, 0, Math.PI * 2)
        ctx.clip()
      }
      ctx.fillStyle = MAP_GRASS
      ctx.fillRect(0, 0, width, height)

      // 정적 지도 (구역·길·건물)
      const [bx, by] = toScreen(base.minX, base.minZ)
      ctx.drawImage(base.canvas, bx, by, base.worldW * scale, base.worldH * scale)

      // 주요 장소만 작게 점으로 표시합니다. 다른 건물은 직접 가리키면 이름을 볼 수 있어요.
      const dot = scale < 1.1 ? 1.6 : 2.4
      for (const p of minimapLandmarks) {
        const [x, y] = toScreen(...p.point)
        if (!contains(x, y)) continue
        ctx.beginPath()
        ctx.arc(x, y, dot, 0, Math.PI * 2)
        ctx.fillStyle = PLACE_COLORS[p.type] ?? '#999'
        ctx.fill()
        ctx.lineWidth = 1
        ctx.strokeStyle = '#fffaf0'
        ctx.stroke()
      }

      if (focus.current) {
        const [x, y] = toScreen(...focus.current.point)
        ctx.beginPath()
        ctx.arc(x, y, 6, 0, Math.PI * 2)
        ctx.lineWidth = 3.5
        ctx.strokeStyle = '#fffaf0'
        ctx.stroke()
        ctx.lineWidth = 1.5
        ctx.strokeStyle = '#365846'
        ctx.stroke()
      }

      const occupied = [[centerX - 10, 2, 20, 18], [centerX - 25, height - 28, 50, 18]]
      // 워프존 (켜짐: 구역 색 / 꺼짐: 회색 + 자물쇠)
      const unlocked = useWarps.getState().unlocked
      for (const w of WARPS) {
        const [x, y] = toScreen(w.position[0], w.position[2])
        occupied.push([x - 9, y - 9, 18, 18])
        const on = unlocked.includes(w.id)
        ctx.beginPath()
        ctx.arc(x, y, 8, 0, Math.PI * 2)
        ctx.fillStyle = on ? w.color : '#9ca3af'
        ctx.fill()
        ctx.lineWidth = 2
        ctx.strokeStyle = '#fff'
        ctx.stroke()
        ctx.font = '10px system-ui, sans-serif'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(on ? '🌀' : '🔒', x, y + 0.5)
      }
      view.current = { width, height, scale, toScreen, contains }

      // 루미 코스: 지금 가야 할 한 곳만 (도착하면 다음 장소로 바뀜)
      const tutorial = tutorialTarget(useTutorial.getState()) // 튜토리얼 1단계: 루미 위치
      const remaining = episodeStop ? [episodeStop] : course.length ? course.slice(index, index + 1) : tutorial ? [tutorial] : []
      const routeColor = episodeStop ? EPISODE_COLOR : COURSE_COLOR
      if (remaining.length) {
        ctx.setLineDash([5, 4])
        ctx.lineWidth = 2.5
        ctx.strokeStyle = routeColor
        ctx.beginPath()
        ctx.moveTo(...toScreen(me.x, me.z))
        for (const stop of remaining) ctx.lineTo(...toScreen(stop.position[0], stop.position[2]))
        ctx.stroke()
        ctx.setLineDash([])
        remaining.forEach((stop, i) => {
          const [x, y] = toScreen(stop.position[0], stop.position[2])
          occupied.push([x - 9, y - 9, 18, 18])
          ctx.beginPath()
          ctx.arc(x, y, i === 0 ? 7 : 5, 0, Math.PI * 2)
          ctx.fillStyle = routeColor
          ctx.fill()
          ctx.lineWidth = 2
          ctx.strokeStyle = '#fff'
          ctx.stroke()
          ctx.fillStyle = episodeStop ? '#533b17' : '#fff'
          ctx.font = 'bold 9px system-ui, sans-serif'
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillText(episodeStop ? '◆' : course.length ? String(index + i + 1) : '!', x, y + 0.5)
        })
      }

      // 내 캐릭터 (보는 방향 화살표)
      const [px, py] = toScreen(me.x, me.z)
      occupied.push([px - 10, py - 10, 20, 20])
      const angle = Math.atan2(me.dirZ, me.dirX)
      ctx.save()
      ctx.translate(px, py)
      ctx.rotate(angle)
      ctx.beginPath()
      ctx.moveTo(9, 0)
      ctx.lineTo(-6, -6)
      ctx.lineTo(-3, 0)
      ctx.lineTo(-6, 6)
      ctx.closePath()
      ctx.fillStyle = '#2563eb'
      ctx.fill()
      ctx.lineWidth = 2
      ctx.strokeStyle = '#fff'
      ctx.stroke()
      ctx.restore()
      if (overview && factor <= 1.45) drawMinimapZones(ctx, { contains, toScreen, occupied })
      ctx.restore()

      // 다음 목적지가 미니맵 밖이면 가장자리에 화살표
      if (remaining.length) {
        const [tx, ty] = toScreen(remaining[0].position[0], remaining[0].position[2])
        const dx = tx - centerX
        const dy = ty - centerY
        if (!contains(tx, ty, 12)) {
          const a = Math.atan2(dy, dx)
          const edge = wide
            ? Math.min((centerX - 12) / Math.abs(dx), (centerY - 12) / Math.abs(dy))
            : (centerX - 12) / Math.hypot(dx, dy)
          ctx.save()
          ctx.translate(centerX + dx * edge, centerY + dy * edge)
          ctx.rotate(a)
          ctx.beginPath()
          ctx.moveTo(9, 0)
          ctx.lineTo(-5, -7)
          ctx.lineTo(-5, 7)
          ctx.closePath()
          ctx.fillStyle = routeColor
          ctx.fill()
          ctx.lineWidth = 2
          ctx.strokeStyle = '#fff'
          ctx.stroke()
          ctx.restore()
        }
      }

      // 북쪽 표시와 거리 눈금
      ctx.fillStyle = '#344e45'
      ctx.beginPath()
      ctx.arc(centerX, 11, 8, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#fff'
      ctx.font = 'bold 10px system-ui, sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('N', centerX, 11.5)
      drawDistanceScale(ctx, width, height, scale, [50, 20, 10, 5].find((meters) => meters * scale <= 40) ?? 5)

      if (!wide) {
        ctx.beginPath()
        ctx.arc(centerX, centerY, centerX - 1.25, 0, Math.PI * 2)
        ctx.lineWidth = 2
        ctx.strokeStyle = '#536e595c'
        ctx.stroke()
      }
      if (wide && !drag && hoverHint.current) {
        const { name, x, y } = hoverHint.current
        drawMinimapPlaceHint(ctx, name, x, y, width, height)
      }
    }
    draw(0)
    return () => {
      cancelAnimationFrame(raf)
      inputs.abort()
      mapControls.current = null
      if (drag && canvas.hasPointerCapture(drag.id)) canvas.releasePointerCapture(drag.id)
      delete canvas.dataset.dragging
    }
  }, [zoom, width, height, episodeStop, wide])

  // 워프존 아이콘 찾기 (누른 곳에서 11px 안)
  const warpAt = (event) => {
    if (!view.current) return null
    const { width, height, toScreen, contains } = view.current
    const [px, py] = canvasPoint(event, event.currentTarget, width, height)
    let best = null
    let bestD = 11
    for (const w of WARPS) {
      const [x, y] = toScreen(w.position[0], w.position[2])
      const d = Math.hypot(x - px, y - py)
      if (d < bestD && contains(x, y)) {
        bestD = d
        best = w
      }
    }
    return best
  }

  const placeAt = (event) => {
    if (!view.current) return null
    const [x, y] = canvasPoint(event, event.currentTarget, view.current.width, view.current.height)
    return pickMinimapPlace(x, y, view.current)
  }

  const mapContent = (
    <>
      <canvas
        ref={canvasRef}
        aria-label={episodeStop ? `데이트 에피소드 길 안내 · ${episodeStop.name}` : `${ZOOMS[zoom]} 지도`}
        aria-description={zoom === 'all' ? OVERVIEW_HINT : undefined}
        className={`mm__canvas${zoom === 'all' ? ' mm__canvas--overview' : ''}${wide ? ' mm__canvas--wide' : ''}`}
        onClick={(e) => {
          if (zoom === 'all' && dragged.current) return
          const warp = warpAt(e)
          setHovered(null)
          setPickedPlace(warp ? null : placeAt(e))
          if (warp) onPickWarp(warp)
        }}
        onPointerMove={(e) => {
          const warp = warpAt(e)
          const place = warp ? null : placeAt(e)
          if (wide) {
            hoverHint.current = null
            if (place && e.pointerType === 'mouse') {
              const [x, y] = canvasPoint(e, e.currentTarget, view.current.width, view.current.height)
              hoverHint.current = { name: place.name, x, y }
            }
          }
          e.currentTarget.style.cursor = warp || place ? 'pointer' : ''
          setHovered(place)
        }}
        onPointerLeave={() => {
          hoverHint.current = null
          setHovered(null)
        }}
      />
      <div className="mm__place" data-picked={Boolean(focusedPlace)}>
        {focusedPlace ? focusedPlace.name : '장소를 눌러 이름 보기'}
      </div>
    </>
  )

  if (!wide) return mapContent

  const selectedZone = zones.find((zone) => zone.zoneId === zoneId)
  const selectZone = (zone) => {
    setHovered(null)
    setPickedPlace(null)
    if (zone) {
      mapControls.current?.zone(zone)
      setZoneId(zone.zoneId)
    } else {
      mapControls.current?.reset()
    }
  }

  return (
    <>
      <div className="world-map__toolbar">
        <div className="world-map__zones" role="group" aria-label="지도 구역">
          <button className="ui-btn" type="button" aria-pressed={!zoneId} onClick={() => selectZone(null)}>모든 구역</button>
          {zones.map((zone) => (
            <button className="ui-btn" type="button" key={zone.zoneId} aria-pressed={zoneId === zone.zoneId}
              onClick={() => selectZone(zone)}>{zone.name}</button>
          ))}
        </div>
        <div className="world-map__zoom" role="group" aria-label="전체 지도 확대·축소">
          <button className="ui-btn" type="button" aria-label="지도 축소" disabled={zoomFactor <= 1}
            onClick={() => mapControls.current?.zoomBy(1 / 1.3)}>−</button>
          <span>{Math.round(zoomFactor * 100)}%</span>
          <button className="ui-btn" type="button" aria-label="지도 확대" disabled={zoomFactor >= MAX_OVERVIEW_ZOOM}
            onClick={() => mapControls.current?.zoomBy(1.3)}>+</button>
        </div>
      </div>
      <div className="world-map__body">
        <div className="world-map__viewport">{mapContent}</div>
        <aside className="world-map__places" aria-label="구역별 장소">
          <h3>{selectedZone?.name ?? '구역별 장소'}</h3>
          {selectedZone ? (
            <ul>
              {(placesByMapZone[zoneId] ?? []).map((place) => (
                <li key={place.name}>
                  <button type="button" aria-pressed={pickedPlace === place} onClick={() => {
                    mapControls.current?.place(place.point)
                    setHovered(null)
                    setPickedPlace(place)
                  }}>{place.name}</button>
                </li>
              ))}
            </ul>
          ) : <p>위에서 구역을 고르면 장소 목록이 열려요.</p>}
        </aside>
      </div>
    </>
  )
}
