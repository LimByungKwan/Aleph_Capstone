import { useEffect, useRef, useState } from 'react'
import { layout, mapPlaces, southGroundExtension, zones } from '../../game/data/mapData.js'
import { PLACE_COLORS } from '../../game/config.js'
import { CHANNELS, COURTS, HALLS, PONDS, WALKS } from '../../game/Map/styles/hj/gyeongbokgungLayout.js'
import { STREET, STREET_ALLEYS, STREET_BUILDINGS, streetFootprint } from '../../game/Map/styles/hj/gyeongseongLayout.js'
import { useCourseStore } from '../../store/courseStore.js'
import { tutorialTarget, useTutorial } from '../../store/tutorialStore.js'
import { useGameStore } from '../../store/gameStore.js'
import { playerPose } from '../../store/playerPose.js'
import './minimap.css'

// 미니맵 (담당: 병관) — 오른쪽 아래, [🗺 미니맵] 버튼으로 열고 닫음
// - 위쪽이 북쪽(애니메이션 구역). 구역 색, 길, 건물, 촬영지·가게 점
// - 내 캐릭터: 가운데 화살표 (카메라가 보는 방향)
// - 루미 코스: 지금 가야 할 한 곳만 점선 + 분홍 점. 미니맵 밖이면 가장자리에 방향 표시
// - [주변/전체]로 확대 단계 변경

const SIZE = 200 // 미니맵 크기(px)
const BASE_SCALE = 3 // 정적 지도 그림의 해상도 (px/m)
const ZOOMS = { near: { label: '주변', scale: 1.6 }, all: { label: '전체', scale: null } }
const COURSE_COLOR = '#ff6fa3'
const STORAGE_KEY = 'scenewalk.minimap'

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

  useEffect(() => save({ open, zoom }), [open, zoom])

  // 대화창이 열려 있으면 가리지 않게 잠깐 숨김
  if (panelOpen) return null

  if (!open) {
    return (
      <button type="button" className="mm-toggle ui-interactive" onClick={(e) => (e.currentTarget.blur(), setOpen(true))}>
        🗺 미니맵
      </button>
    )
  }

  return (
    <section className="mm ui-interactive" aria-label="미니맵">
      <div className="mm__head">
        <span className="mm__title">🗺 미니맵</span>
        <div className="mm__zoom" role="group" aria-label="미니맵 확대">
          {Object.entries(ZOOMS).map(([key, z]) => (
            <button key={key} type="button" className={zoom === key ? 'is-on' : ''} onClick={(e) => (e.currentTarget.blur(), setZoom(key))}>
              {z.label}
            </button>
          ))}
        </div>
        <button type="button" className="mm__close" aria-label="미니맵 숨기기" onClick={(e) => (e.currentTarget.blur(), setOpen(false))}>
          ✕
        </button>
      </div>
      <MinimapCanvas zoom={zoom} />
    </section>
  )
}

function MinimapCanvas({ zoom }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = SIZE * dpr
    canvas.height = SIZE * dpr
    const ctx = canvas.getContext('2d')
    ctx.scale(dpr, dpr)
    const base = getBaseMap()
    let raf = 0

    const draw = () => {
      raf = requestAnimationFrame(draw)
      const { course, index } = useCourseStore.getState()
      const me = playerPose.ready ? playerPose : { x: layout.playerStart[0], z: layout.playerStart[1], dirX: 0, dirZ: -1 }

      // 화면 1px당 m: 주변은 고정 배율, 전체는 맵 전체가 들어가게
      const scale = ZOOMS[zoom].scale ?? (SIZE / 2 - 4) / base.allRadius
      const [cx, cz] = ZOOMS[zoom].scale ? [me.x, me.z] : [0, 0]
      const toScreen = (x, z) => [(x - cx) * scale + SIZE / 2, (z - cz) * scale + SIZE / 2]

      ctx.clearRect(0, 0, SIZE, SIZE)
      ctx.save()
      ctx.beginPath()
      ctx.arc(SIZE / 2, SIZE / 2, SIZE / 2, 0, Math.PI * 2)
      ctx.clip()
      ctx.fillStyle = '#5a7d43'
      ctx.fillRect(0, 0, SIZE, SIZE)

      // 정적 지도 (구역·길·건물)
      const [bx, by] = toScreen(base.minX, base.minZ)
      ctx.drawImage(base.canvas, bx, by, base.worldW * scale, base.worldH * scale)

      // 구역 이름 (글자 크기는 확대와 상관없이 일정하게)
      ctx.font = "bold 11px system-ui, 'Malgun Gothic', sans-serif"
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.lineJoin = 'round'
      for (const zone of zones) {
        const [x, y] = toScreen(zone.origin[0], zone.origin[1])
        ctx.lineWidth = 3
        ctx.strokeStyle = 'rgba(0,0,0,0.55)'
        ctx.strokeText(zone.name, x, y)
        ctx.fillStyle = '#fff'
        ctx.fillText(zone.name, x, y)
      }

      // 촬영지·가게 점
      const dot = Math.max(2.5, Math.min(4, scale * 1.6))
      for (const p of mapPlaces) {
        const [x, y] = toScreen(p.position[0], p.position[2])
        ctx.beginPath()
        ctx.arc(x, y, dot, 0, Math.PI * 2)
        ctx.fillStyle = PLACE_COLORS[p.type] ?? '#999'
        ctx.fill()
        ctx.lineWidth = 1
        ctx.strokeStyle = '#fff'
        ctx.stroke()
      }

      // 루미 코스: 지금 가야 할 한 곳만 (도착하면 다음 장소로 바뀜)
      const tutorial = tutorialTarget(useTutorial.getState()) // 튜토리얼 1단계: 루미 위치
      const remaining = course.length ? course.slice(index, index + 1) : tutorial ? [tutorial] : []
      if (remaining.length) {
        ctx.setLineDash([5, 4])
        ctx.lineWidth = 2.5
        ctx.strokeStyle = COURSE_COLOR
        ctx.beginPath()
        ctx.moveTo(...toScreen(me.x, me.z))
        for (const stop of remaining) ctx.lineTo(...toScreen(stop.position[0], stop.position[2]))
        ctx.stroke()
        ctx.setLineDash([])
        remaining.forEach((stop, i) => {
          const [x, y] = toScreen(stop.position[0], stop.position[2])
          ctx.beginPath()
          ctx.arc(x, y, i === 0 ? 7 : 5, 0, Math.PI * 2)
          ctx.fillStyle = i === 0 ? COURSE_COLOR : 'rgba(255,111,163,0.55)'
          ctx.fill()
          ctx.lineWidth = 2
          ctx.strokeStyle = '#fff'
          ctx.stroke()
          ctx.fillStyle = '#fff'
          ctx.font = 'bold 9px system-ui, sans-serif'
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillText(course.length ? String(index + i + 1) : '!', x, y + 0.5) // 튜토리얼 목적지(루미)는 '!'
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
          ctx.fillStyle = COURSE_COLOR
          ctx.fill()
          ctx.lineWidth = 2
          ctx.strokeStyle = '#fff'
          ctx.stroke()
          ctx.restore()
        }
      }

      // 북쪽 표시
      ctx.fillStyle = 'rgba(20,20,20,0.6)'
      ctx.beginPath()
      ctx.arc(SIZE / 2, 11, 8, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#fff'
      ctx.font = 'bold 10px system-ui, sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('N', SIZE / 2, 11.5)
    }
    draw()
    return () => cancelAnimationFrame(raf)
  }, [zoom])

  return <canvas ref={canvasRef} className="mm__canvas" style={{ width: SIZE, height: SIZE }} />
}

// ── 정적 지도: 한 번만 그려서 재사용 ───────────────────
let baseMap = null
function getBaseMap() {
  if (baseMap) return baseMap
  const [gw, gd] = layout.ground.size
  const [gx, gz] = layout.ground.center
  const minX = gx - gw / 2
  const minZ = gz - gd / 2
  const annexSouth = southGroundExtension
    ? southGroundExtension.position[1] + southGroundExtension.size[2] / 2
    : 0
  const worldH = Math.max(gd, annexSouth - minZ)
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(gw * BASE_SCALE)
  canvas.height = Math.round(worldH * BASE_SCALE)
  const ctx = canvas.getContext('2d')
  const S = BASE_SCALE
  const px = (x) => (x - minX) * S
  const pz = (z) => (z - minZ) * S

  ctx.fillStyle = layout.ground.color ?? '#648a49'
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  // 구역 바탕 (구역 색을 옅게) + 이름
  for (const zone of zones) {
    const [ox, oz] = zone.origin
    const [w, d] = zone.size
    ctx.fillStyle = zone.color
    ctx.globalAlpha = 0.28
    ctx.fillRect(px(ox - w / 2), pz(oz - d / 2), w * S, d * S)
    ctx.globalAlpha = 1
  }
  // 중앙 광장
  ctx.fillStyle = 'rgba(255, 244, 220, 0.55)'
  ctx.fillRect(px(-25), pz(-25), 50 * S, 50 * S)

  // 길 (잔디 줄은 빼고)
  const box = (item, color) => {
    const [x, z] = item.position
    const w = item.size[0]
    const d = item.size[item.size.length - 1]
    ctx.save()
    ctx.translate(px(x), pz(z))
    ctx.rotate(((item.rotationDeg ?? 0) * Math.PI) / 180)
    ctx.fillStyle = color
    ctx.fillRect((-w / 2) * S, (-d / 2) * S, w * S, d * S)
    ctx.restore()
  }
  for (const road of layout.roads) {
    if (!road.position || !road.size || road.style === 'grass' || !road.style) continue
    box(road, road.style === 'asphalt' ? 'rgba(70, 70, 76, 0.85)' : 'rgba(235, 222, 196, 0.9)')
  }
  // 건물
  for (const building of layout.buildings) {
    if (!building.position || !building.size) continue
    box(building, 'rgba(120, 92, 78, 0.85)')
  }

  // [3. 개발 > 프론트엔드] 3D 경복궁과 같은 좌표로 연못·산책길·전각을 표시합니다.
  if (southGroundExtension) {
    const [x, z] = southGroundExtension.position
    const draw = ([dx, dz, w, d], color) => box({ position: [x + dx, z + dz], size: [w, d] }, color)
    box(southGroundExtension, '#7b8551')
    draw([0, STREET.z, STREET.w, STREET.d], '#9c876f')
    draw([STREET.x, STREET.z, STREET.roadWidth, STREET.d], '#b8aa95')
    for (const alley of STREET_ALLEYS) draw(alley, '#b8aa95')
    for (const rect of COURTS) draw(rect, '#d6c6a8')
    for (const rect of WALKS) draw(rect, '#b4ae9a')
    for (const rect of CHANNELS) draw(rect, '#80a6a3')
    for (const { x: dx, z: dz, w, d } of PONDS) draw([dx, dz, w, d], '#567e82')
    for (const { x: dx, z: dz, w, d } of HALLS) draw([dx, dz, w, d], '#4c5553')
    for (const building of STREET_BUILDINGS) draw(streetFootprint(building), '#775643')
  }

  // '전체' 보기: 광장(0,0)에서 가장 먼 구역 모서리까지 원 안에 들어가게
  const allRadius = Math.max(
    annexSouth,
    ...zones.flatMap(({ origin: [ox, oz], size: [w, d] }) => [
      Math.hypot(Math.abs(ox) + w / 2, Math.abs(oz) + d / 2) * 0.82, // 모서리는 조금 잘려도 됨 (원이라)
    ]),
  )
  baseMap = { canvas, minX, minZ, worldW: gw, worldH, allRadius }
  return baseMap
}
