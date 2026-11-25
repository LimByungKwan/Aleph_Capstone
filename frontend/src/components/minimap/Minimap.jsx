import { useEffect, useRef, useState } from 'react'
import { LETTER_STATIONS } from '@shared/bk_letterPuzzle.js'
import { layout, mapPlaces, zones } from '../../game/data/mapData.js'
import { PLACE_COLORS } from '../../game/config.js'
import { getMinimapBase, MAP_GRASS } from '../../game/Map/styles/bk_minimapMap.js'
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
// - [주변/전체]로 보기 전환, 전체 지도에서는 마우스 휠로 확대·축소

const SIZE = 200 // 미니맵 크기(px)
const ZOOMS = { near: { label: '주변', scale: 1.85 }, all: { label: '전체', scale: null } }
const MAX_OVERVIEW_ZOOM = 4
const WHEEL_HINT = '마우스 휠로 확대·축소'
const COURSE_COLOR = '#ff6fa3'
const EPISODE_COLOR = '#ffe189'
const EPISODE_STOPS = Object.fromEntries(DATE_MISSIONS.map((mission) => {
  const [x, z] = mapPoint(mission)
  return [mission.id, { name: mission.short, position: [x, 0, z] }]
}))
const STORAGE_KEY = 'scenewalk.minimap'

function drawZoneLabel(ctx, zone, x, y) {
  ctx.font = "700 10px system-ui, 'Malgun Gothic', sans-serif"
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const width = ctx.measureText(zone.name).width + 13
  const left = Math.max(5, Math.min(SIZE - width - 5, x - width / 2))
  const top = y - 19
  ctx.beginPath()
  ctx.roundRect(left, top, width, 16, 6)
  ctx.fillStyle = '#fff9ed'
  ctx.fill()
  ctx.lineWidth = 1.2
  ctx.strokeStyle = zone.color
  ctx.stroke()
  ctx.fillStyle = '#30483e'
  ctx.fillText(zone.name, left + width / 2, top + 8.5)
}

function drawDistanceScale(ctx, scale, meters) {
  const half = meters * scale / 2
  const x = SIZE / 2
  const y = SIZE - 13
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

function canvasPoint(event, canvas) {
  const { left, top, width, height } = canvas.getBoundingClientRect()
  return [(event.clientX - left) * SIZE / width, (event.clientY - top) * SIZE / height]
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
  const panelOpen = useGameStore((s) => Boolean(s.openPanel))
  const [picked, setPicked] = useState(null) // 미니맵에서 누른 워프존

  useEffect(() => save({ open, zoom }), [open, zoom])

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
    <section className="mm ui-interactive" aria-label="미니맵">
      <div className="mm__head">
        <span className="mm__title">미니맵</span>
        <div className="mm__zoom" role="group" aria-label="미니맵 확대">
          {Object.entries(ZOOMS).map(([key, z]) => (
            <button key={key} type="button" aria-pressed={zoom === key} className={zoom === key ? 'is-on' : ''} onClick={(e) => (e.currentTarget.blur(), setZoom(key))}>
              {z.label}
            </button>
          ))}
        </div>
        <button type="button" className="mm__close" aria-label="미니맵 숨기기" onClick={(e) => (e.currentTarget.blur(), setOpen(false))}>
          ✕
        </button>
      </div>
      <MinimapCanvas zoom={zoom} onPickWarp={setPicked} />
      {picked && <WarpConfirm warp={picked} onClose={() => setPicked(null)} />}
    </section>
  )
}

// 워프존 아이콘을 눌렀을 때: 로그인 안 함 / 아직 안 켜짐 / 이동할지 묻기
function WarpConfirm({ warp, onClose }) {
  const unlocked = useWarps((s) => s.unlocked.includes(warp.id))
  const loggedIn = isLoggedIn()
  const go = () => {
    useWarps.getState().warp(warp.id)
    onClose()
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

function MinimapCanvas({ zoom, onPickWarp }) {
  const canvasRef = useRef(null)
  const overviewView = useRef(null)
  const view = useRef({ toScreen: null }) // 마지막으로 그린 좌표 변환 (워프 아이콘 누르기용)
  const userId = useUiStore((s) => s.userId)
  const soloStep = useDateMission((s) => currentEpisodeStep(s.saved.accounts[userId]?.episodeBook)?.id)
  const sharedStep = useEpisodeRoom(({ room }) => {
    if (room?.letter) return room.letter.solved ? 'mural' : LETTER_STATIONS[room.letter.role]?.mission
    return room ? getDateEpisode(room.episodeId)?.steps[room.step]?.id : null
  })
  const guideEnabled = useDateMission((s) => s.episodeGuide === userId)
  const episodeStop = guideEnabled ? EPISODE_STOPS[sharedStep ?? soloStep] : undefined

  useEffect(() => {
    const canvas = canvasRef.current
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = SIZE * dpr
    canvas.height = SIZE * dpr
    const ctx = canvas.getContext('2d')
    ctx.scale(dpr, dpr)
    ctx.imageSmoothingQuality = 'high'
    const base = getMinimapBase()
    const overview = zoom === 'all'
    const fitScale = (SIZE / 2 - 5) / base.allRadius
    const fitView = { x: base.centerX, z: base.centerZ, scale: fitScale }
    if (!overview) overviewView.current = null

    const onWheel = (event) => {
      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? SIZE : 1
      if (event.deltaY === 0) return
      event.preventDefault()
      event.stopPropagation()

      const current = overviewView.current ?? fitView
      const scale = Math.min(fitScale * MAX_OVERVIEW_ZOOM, Math.max(fitScale,
        current.scale * Math.exp(-event.deltaY * unit / 400),
      ))
      if (scale === fitScale) {
        overviewView.current = null
        return
      }

      // 확대 중 마우스가 가리키는 지점은 같은 화면 위치에 두고, 중심이 지도 바깥으로 밀리지 않게 합니다.
      const [px, py] = canvasPoint(event, canvas)
      const shift = 1 / current.scale - 1 / scale
      const offsetX = current.x - fitView.x + (px - SIZE / 2) * shift
      const offsetZ = current.z - fitView.z + (py - SIZE / 2) * shift
      const radius = base.allRadius * (1 - fitScale / scale)
      const limit = Math.min(1, radius / Math.max(radius, Math.hypot(offsetX, offsetZ)))
      overviewView.current = { x: fitView.x + offsetX * limit, z: fitView.z + offsetZ * limit, scale }
    }
    if (overview) canvas.addEventListener('wheel', onWheel, { passive: false })

    let raf = 0
    let lastDraw = -Infinity

    const draw = (now) => {
      raf = requestAnimationFrame(draw)
      if (now - lastDraw < 30) return
      lastDraw = now
      const { course, index } = useCourseStore.getState()
      const me = playerPose.ready ? playerPose : { x: layout.playerStart[0], z: layout.playerStart[1], dirX: 0, dirZ: -1 }
      const { x: cx, z: cz, scale } = overview
        ? overviewView.current ?? fitView
        : { x: me.x, z: me.z, scale: ZOOMS.near.scale }
      const toScreen = (x, z) => [(x - cx) * scale + SIZE / 2, (z - cz) * scale + SIZE / 2]

      ctx.clearRect(0, 0, SIZE, SIZE)
      ctx.save()
      ctx.beginPath()
      ctx.arc(SIZE / 2, SIZE / 2, SIZE / 2, 0, Math.PI * 2)
      ctx.clip()
      ctx.fillStyle = MAP_GRASS
      ctx.fillRect(0, 0, SIZE, SIZE)

      // 정적 지도 (구역·길·건물)
      const [bx, by] = toScreen(base.minX, base.minZ)
      ctx.drawImage(base.canvas, bx, by, base.worldW * scale, base.worldH * scale)

      // 촬영지·가게 점
      const dot = overview ? 1.5 : 3
      for (const p of mapPlaces) {
        const [x, y] = toScreen(p.position[0], p.position[2])
        ctx.beginPath()
        ctx.arc(x, y, dot, 0, Math.PI * 2)
        ctx.fillStyle = PLACE_COLORS[p.type] ?? '#999'
        ctx.fill()
        ctx.lineWidth = 1
        ctx.strokeStyle = '#fffaf0'
        ctx.stroke()
      }

      // 전체 보기에서는 구역 이름을 강조하고 주변 보기에서는 길과 시설을 보여 줍니다.
      if (overview) {
        for (const zone of zones) {
          const [x, y] = toScreen(...zone.origin)
          if (Math.hypot(x - SIZE / 2, y - SIZE / 2) < SIZE / 2) drawZoneLabel(ctx, zone, x, y)
        }
      }

      // 워프존 (켜짐: 구역 색 / 꺼짐: 회색 + 자물쇠)
      const unlocked = useWarps.getState().unlocked
      for (const w of WARPS) {
        const [x, y] = toScreen(w.position[0], w.position[2])
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
      view.current.toScreen = toScreen

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
      ctx.restore()

      // 다음 목적지가 미니맵 밖이면 가장자리에 화살표
      if (remaining.length) {
        const [tx, ty] = toScreen(remaining[0].position[0], remaining[0].position[2])
        const dx = tx - SIZE / 2
        const dy = ty - SIZE / 2
        const r = SIZE / 2 - 12
        if (Math.hypot(dx, dy) > r) {
          const a = Math.atan2(dy, dx)
          ctx.save()
          ctx.translate(SIZE / 2 + Math.cos(a) * r, SIZE / 2 + Math.sin(a) * r)
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
      ctx.arc(SIZE / 2, 11, 8, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#fff'
      ctx.font = 'bold 10px system-ui, sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('N', SIZE / 2, 11.5)
      drawDistanceScale(ctx, scale, [50, 20, 10].find((meters) => meters * scale <= 40) ?? 10)

      ctx.beginPath()
      ctx.arc(SIZE / 2, SIZE / 2, SIZE / 2 - 1.25, 0, Math.PI * 2)
      ctx.lineWidth = 2
      ctx.strokeStyle = '#536e595c'
      ctx.stroke()
    }
    draw(0)
    return () => {
      cancelAnimationFrame(raf)
      if (overview) canvas.removeEventListener('wheel', onWheel)
    }
  }, [zoom, episodeStop])

  // 워프존 아이콘 찾기 (누른 곳에서 11px 안)
  const warpAt = (event) => {
    const toScreen = view.current.toScreen
    if (!toScreen) return null
    const [px, py] = canvasPoint(event, event.currentTarget)
    let best = null
    let bestD = 11
    for (const w of WARPS) {
      const [x, y] = toScreen(w.position[0], w.position[2])
      const d = Math.hypot(x - px, y - py)
      if (d < bestD && Math.hypot(x - SIZE / 2, y - SIZE / 2) < SIZE / 2) {
        bestD = d
        best = w
      }
    }
    return best
  }

  return (
    <canvas
      ref={canvasRef}
      aria-label={episodeStop ? `데이트 에피소드 길 안내 · ${episodeStop.name}` : `${ZOOMS[zoom].label} 지도`}
      title={zoom === 'all' ? WHEEL_HINT : undefined}
      className="mm__canvas"
      onClick={(e) => {
        const w = warpAt(e)
        if (w) onPickWarp(w)
      }}
      onMouseMove={(e) => (e.currentTarget.style.cursor = warpAt(e) ? 'pointer' : '')}
    />
  )
}
