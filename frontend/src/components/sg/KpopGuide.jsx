import { useEffect, useState } from 'react'
import { useGameStore } from '../../store/gameStore.js'
import { useCourseStore } from '../../store/courseStore.js'
import { useTutorial } from '../../store/tutorialStore.js'
import { playerPose } from '../../store/playerPose.js'
import { layout, zones } from '../../game/data/mapData.js'
import { AUDITION_PANEL } from '../../game/Map/styles/sg_auditionStore.js'
import { CHEER_PANEL } from '../../game/Map/styles/sg_cheerStore.js'
import { useLiveDistance } from '../course/LumiCourse.jsx'
import { useIsTouch } from '../mobile/MobileControls.jsx'

// K-POP 구역 처음 들어온 사람에게 "여기서 할 수 있는 것 3가지" 안내 띠. 담당: 성근(SG)
// - 판정: 캐릭터가 sg_kpop.json의 사각형(origin이 중심, size가 가로·세로) 안에 있는지
// - 병관님 튜토리얼이 끝난(off) 뒤에만 표시 → 띠가 두 개 겹치지 않음
// - 체험 하나를 열거나 닫기를 누르면 localStorage에 기억 → 다시 안 나옴

const KEY = 'scenewalk.sg.kpopGuide'
const ZONE = zones.find((z) => z.zoneId === 'SG')
const spot = (id) => {
  const [x, z] = layout.buildings.find((p) => p.id === `SG/${id}`)?.position ?? []
  return x == null ? null : [x, 0, z] // distanceTo는 [x, y, z]를 받음
}
const SPOTS = [
  { type: AUDITION_PANEL, icon: '🎤', name: 'SUNGRAY 오디션', how: '마이크 또는 키보드로 노래 심사', at: spot('sg_audition') },
  { type: CHEER_PANEL, icon: '🪄', name: 'SUNSET WAVE 응원', how: '응원봉 리듬 게임', at: spot('sg_cheer') },
  { type: 'sg_studio', icon: '🎧', name: '물결 레코딩 스튜디오', how: '내 문장 녹음해 보기', at: spot('sg_studio') },
]
const SPOT_TYPES = SPOTS.map((s) => s.type)

function inKpopZone() {
  if (!playerPose.ready || !ZONE) return false
  const [cx, cz] = ZONE.origin
  const [w, d] = ZONE.size
  return Math.abs(playerPose.x - cx) <= w / 2 && Math.abs(playerPose.z - cz) <= d / 2
}

function readSeen() {
  try {
    return localStorage.getItem(KEY) === 'seen'
  } catch {
    return false
  }
}
function saveSeen() {
  try {
    localStorage.setItem(KEY, 'seen')
  } catch {
    // 저장이 막힌 브라우저면 이번 접속에서만 기억
  }
}

export default function KpopGuide() {
  const [seen, setSeen] = useState(readSeen)
  const [inside, setInside] = useState(false)
  const tutorialOff = useTutorial((s) => s.step === 'off')
  const openType = useGameStore((s) => s.openPanel?.type)
  const waiting = !seen && tutorialOff // 아직 안 봤고, 튜토리얼도 끝남

  // 구역 안에 있는지 0.5초마다 (playerPose는 매 프레임 바뀌는 일반 객체라 구독 대신 확인)
  useEffect(() => {
    if (!waiting) return undefined
    const tick = () => setInside(inKpopZone())
    tick()
    const timer = setInterval(tick, 500)
    return () => clearInterval(timer)
  }, [waiting])

  // 체험 하나를 열면 안내를 쓴 것으로 보고 기억
  useEffect(() => {
    if (waiting && inside && SPOT_TYPES.includes(openType)) {
      saveSeen()
      setSeen(true)
    }
  }, [waiting, inside, openType])

  const show = waiting && inside && !openType
  return show ? <Banner onClose={() => (saveSeen(), setSeen(true))} /> : null
}

function Banner({ onClose }) {
  const touch = useIsTouch()
  const hasCourse = useCourseStore((s) => s.course.length > 0)
  // 튜토리얼 띠와 같은 자리: 위쪽(코스 안내가 있으면 그 아래), 터치 화면은 조작 버튼 위
  const place = touch ? { bottom: 'calc(166px + env(safe-area-inset-bottom))' } : { top: hasCourse ? 108 : 64 }
  return (
    <div style={{ ...wrap, ...place }} role="status" aria-live="polite">
      <div style={head}>
        <strong>K-POP 스테이지에 오신 걸 환영해요!</strong>
        <button
          type="button"
          style={close}
          aria-label="안내 닫기"
          onClick={(e) => (e.currentTarget.blur(), onClose())} // 포커스가 남으면 스페이스·E 키가 버튼을 다시 누름
        >
          ✕
        </button>
      </div>
      <ul style={list}>
        {SPOTS.map((s) => (
          <SpotRow key={s.type} spot={s} touch={touch} />
        ))}
      </ul>
      <p style={foot}>가까이 가서 {touch ? 'E 버튼' : 'E'}을 누르면 시작해요</p>
    </div>
  )
}

function SpotRow({ spot: s, touch }) {
  const dist = useLiveDistance(s.at)
  return (
    <li style={item}>
      <span aria-hidden="true">{s.icon}</span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <b>{s.name}</b>
        {!touch && <span style={sub}> · {s.how}</span>}
      </span>
      {dist && <span style={sub}>{dist}</span>}
    </li>
  )
}

const wrap = { position: 'absolute', left: '50%', transform: 'translateX(-50%)', zIndex: 20, pointerEvents: 'auto', boxSizing: 'border-box', width: 'min(380px, calc(100% - 24px))', padding: '10px 12px', borderRadius: 12, border: '1px solid #756097', borderLeft: '3px solid #b18cff', background: 'rgba(24,18,43,0.92)', boxShadow: '0 4px 18px #0006', color: '#fff', fontSize: 13, lineHeight: 1.45 }
const head = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 6 }
const close = { minWidth: 32, minHeight: 32, border: 'none', borderRadius: 8, background: 'transparent', color: '#e9ddff', fontSize: 15, cursor: 'pointer' }
const list = { listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 4 }
const item = { display: 'flex', alignItems: 'center', gap: 8 }
const sub = { color: '#c9b8ec', fontSize: 12 }
const foot = { margin: '6px 0 0', color: '#c9b8ec', fontSize: 12 }
