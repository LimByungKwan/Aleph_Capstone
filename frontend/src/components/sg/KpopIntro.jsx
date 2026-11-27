import { useEffect, useState } from 'react'
import { useGameStore } from '../../store/gameStore.js'
import { useTutorial } from '../../store/tutorialStore.js'
import { playerPose } from '../../store/playerPose.js'
import { inKpopZone } from './KpopGuide.jsx'
import { KEY_HINTS_BOTTOM } from './KeyHints.jsx'
import { useIsTouch } from '../mobile/MobileControls.jsx'

// K-POP 구역 첫 진입 30초 소개 컷신: SUNGRAY 멤버 윤슬(YUNSEUL)이 직접 나와 발랄하게 소개. 담당: 성근(SG)
// - 그림: 코드로 그린 SVG + CSS 애니메이션 (장면마다 천천히 확대·이동, 아래 자막). 그림 파일 없음
// - 목소리 없이 자막만. 장면마다 정해진 시간(dur)이 지나면 넘어감
// - 처음 한 번만(localStorage). 튜토리얼이 끝난 뒤, 구역 안에 들어오면 재생 → 끝나면 KpopGuide 안내 띠가 이어서 뜸
// - 패널로 열어 캐릭터 이동을 잠금. 건너뛰기 버튼·ESC(공용 InteractionKeys)로 닫힘
// - 다시 보기(시연용): 주소 뒤에 ?kpopIntro, 또는 콘솔 window.__sgIntro()

export const INTRO_PANEL = 'sg_intro'
const KEY = 'scenewalk.sg.kpopIntro'

// lines: 자막 줄 / idol: 윤슬이 서는 자리 [x, 발 y, 크기]
const SCENES = [
  { id: 'title', dur: 4, idol: [800, 660, 1.35], lines: ['안녕~! 나는 SUNGRAY의 윤슬이야!', '만나서 반가워!'] },
  { id: 'dome', dur: 6, idol: [1330, 820, 1.5], lines: ['여기는 바다 옆 K-POP 돔!', '밤이 되면 서치라이트랑 폭죽이 팡팡 터져'] },
  { id: 'audition', dur: 6, idol: [300, 820, 1.5], lines: ['무대 옆 오디션장에서 노래로 도전해 봐', '심사위원 쌤들이 기다리고 있어!'] },
  { id: 'fans', dur: 6, idol: [1380, 820, 1.45], lines: ['응원봉 흔들고,', '포장마차 거리에서 맛있는 것도 먹고!'] },
  { id: 'finale', dur: 5, idol: [300, 820, 1.5], lines: ['그럼, K-POP 스테이지에서 같이 놀자!', '윤슬이었어~ 안녕! 👋'] },
  { id: 'bye', dur: 4, idol: [800, 760, 1.6], smile: true, lines: ['그럼 잘 즐기길 바래~', '안녕~ 💕'] },
]

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

export default function KpopIntro() {
  const open = useGameStore((s) => s.openPanel?.type === INTRO_PANEL)
  const tutorialOff = useTutorial((s) => s.step === 'off')
  const [seen, setSeen] = useState(readSeen)
  const [inside, setInside] = useState(false)
  const panelOpen = useGameStore((s) => Boolean(s.openPanel))
  const touch = useIsTouch()

  // 0.5초마다 구역 안인지 확인. 걸어 들어오든 워프로 들어오든 같은 판정
  // 처음 들어온 순간(튜토리얼이 끝난 뒤) 한 번 자동 재생, 그 뒤엔 다시 보기 버튼으로
  useEffect(() => {
    const timer = setInterval(() => {
      const now = inKpopZone()
      setInside(now)
      const game = useGameStore.getState()
      if (seen || !tutorialOff || game.openPanel || !now) return
      saveSeen() // 열 때 기억: 보다가 새로고침해도 다시 30초를 붙잡지 않음
      setSeen(true)
      game.open({ type: INTRO_PANEL })
    }, 500)
    return () => clearInterval(timer)
  }, [seen, tutorialOff])

  // 시연용 다시 보기: 콘솔 window.__sgIntro(), 또는 주소 뒤에 ?kpopIntro (배포본에서도 동작)
  // 주소로 열면 캐릭터가 맵에 나타난 뒤(playerPose.ready) 한 번 재생
  useEffect(() => {
    const play = openIntro
    window.__sgIntro = play
    let timer
    if (new URLSearchParams(window.location.search).has('kpopIntro')) {
      timer = setInterval(() => {
        if (!playerPose.ready || useGameStore.getState().openPanel) return
        clearInterval(timer)
        play()
      }, 500)
    }
    return () => {
      clearInterval(timer)
      delete window.__sgIntro
    }
  }, [])

  if (open) return <Intro onDone={closeIntro} />
  if (!inside || panelOpen) return null
  // 왼쪽 위 키보드 안내 바로 아래 (터치 화면은 그 안내가 없어서 그 자리)
  return (
    <button type="button" style={{ ...replay, top: touch ? 64 : KEY_HINTS_BOTTOM + 8 }} onClick={(e) => (e.currentTarget.blur(), openIntro())}>
      ▶ 윤슬이 소개 다시 보기
    </button>
  )
}

const openIntro = () => useGameStore.getState().open({ type: INTRO_PANEL })

const closeIntro = () => useGameStore.getState().close() // 모듈에 둬서 Intro의 effect가 렌더마다 다시 걸리지 않게

function Intro({ onDone }) {
  const [index, setIndex] = useState(0)
  const scene = SCENES[index]
  const last = index + 1 >= SCENES.length

  // 장면마다 dur초 뒤 다음 장면, 마지막이면 닫기
  useEffect(() => {
    const timer = setTimeout(() => (last ? onDone() : setIndex((i) => i + 1)), scene.dur * 1000)
    return () => clearTimeout(timer)
  }, [scene, last, onDone])

  const Art = ART[scene.id]
  const [ix, iy, is] = scene.idol
  return (
    <div style={overlay} role="dialog" aria-label="K-POP 스테이지 소개 영상" className="kpi-anim">
      <style>{CSS}</style>
      <div style={stage}>
        <div key={scene.id} className="kpi-scene" style={{ animationDuration: `0.7s, ${scene.dur + 2}s` }}>
          <svg viewBox="0 0 1600 900" width="100%" height="100%" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
            <Defs />
            <Art />
            <Yunseul x={ix} y={iy} s={is} smile={scene.smile} />
          </svg>
        </div>
        <p key={`t-${scene.id}`} className="kpi-sub">
          <b className="kpi-name">윤슬</b>
          {scene.lines.map((line) => (
            <span key={line}>{line}</span>
          ))}
        </p>
        <div style={bar}>
          <div style={{ ...barFill, width: `${((index + 1) / SCENES.length) * 100}%` }} />
        </div>
        <button type="button" style={skip} onClick={(e) => (e.currentTarget.blur(), onDone())}>
          건너뛰기 ▶▶
        </button>
      </div>
    </div>
  )
}

// ── 윤슬 (SUNGRAY 멤버, 가상 아이돌) ──────────────────
// 이름처럼 "햇빛에 반짝이는 물결" 색 머리(하늘→분홍), 별 머리핀, 마이크. 발이 (0,0), 키 약 340
// 눈 깜빡임 + 통통 + 손 흔들기
function Yunseul({ x, y, s, smile }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <g className="kpi-hop">
        {/* 뒷머리 */}
        <path d="M-82 -190 Q-96 -300 0 -306 Q96 -300 82 -190 Q92 -120 70 -86 Q48 -110 40 -150 L-40 -150 Q-48 -110 -70 -86 Q-92 -120 -82 -190 Z" fill="url(#kpi-hair)" />
        {/* 치마 + 상의 */}
        <path d="M-50 -70 L50 -70 L84 -8 Q0 8 -84 -8 Z" fill="#ff8fc7" />
        <path d="M-84 -8 Q0 8 84 -8" stroke="#fff" strokeWidth="8" fill="none" />
        <rect x="-42" y="-138" width="84" height="76" rx="30" fill="#fff" />
        <path d="M-26 -138 L0 -108 L26 -138 Z" fill="#7dd3fc" />
        <circle cx="0" cy="-102" r="7" fill="#ff4fa3" />
        {/* 다리·신발 */}
        <rect x="-26" y="-6" width="14" height="6" fill="#ffe1cc" />
        <rect x="12" y="-6" width="14" height="6" fill="#ffe1cc" />
        <ellipse cx="-20" cy="2" rx="18" ry="8" fill="#b18cff" />
        <ellipse cx="20" cy="2" rx="18" ry="8" fill="#b18cff" />
        {/* 마이크 든 팔 (화면 왼쪽) */}
        <rect x="-62" y="-130" width="20" height="62" rx="10" fill="#fff" transform="rotate(18 -52 -130)" />
        <circle cx="-38" cy="-80" r="11" fill="#ffe1cc" />
        <rect x="-41" y="-112" width="7" height="34" rx="3" fill="#2a1f33" />
        <circle cx="-37.5" cy="-118" r="12" fill="#ff8fc7" />
        {/* 흔드는 팔 (화면 오른쪽). 위치는 바깥 g, 흔들림은 안쪽: CSS transform이 SVG transform 속성을 덮어쓰기 때문 */}
        <g transform="translate(46 -124)">
          <g className="kpi-pivot kpi-hi">
            <rect x="-9" y="-70" width="18" height="70" rx="9" fill="#fff" />
            <circle cx="0" cy="-76" r="12" fill="#ffe1cc" />
          </g>
        </g>
        {/* 얼굴 */}
        <circle cx="0" cy="-206" r="72" fill="#ffe1cc" />
        <path d="M-74 -214 Q-70 -292 0 -290 Q70 -292 74 -214 Q58 -250 30 -252 Q14 -232 0 -250 Q-14 -232 -30 -252 Q-58 -250 -74 -214 Z" fill="url(#kpi-hair)" />
        <polygon points="52,-262 58,-248 73,-247 61,-238 66,-224 52,-232 38,-224 43,-238 31,-247 46,-248" fill="#ffd166" stroke="#fff" strokeWidth="2" />
        {smile ? (
          // 눈웃음 ^^
          <path d="M-37 -196 Q-25 -216 -13 -196 M13 -196 Q25 -216 37 -196" stroke="#3b2a5a" strokeWidth="6" fill="none" strokeLinecap="round" />
        ) : (
        <g className="kpi-center kpi-blink">
          <ellipse cx="-25" cy="-200" rx="11" ry="16" fill="#3b2a5a" />
          <ellipse cx="25" cy="-200" rx="11" ry="16" fill="#3b2a5a" />
          <circle cx="-21" cy="-206" r="4" fill="#fff" />
          <circle cx="29" cy="-206" r="4" fill="#fff" />
          <circle cx="-28" cy="-193" r="2" fill="#7dd3fc" />
          <circle cx="22" cy="-193" r="2" fill="#7dd3fc" />
        </g>
        )}
        <ellipse cx="-42" cy="-176" rx="12" ry="6" fill="#ff9db5" opacity="0.7" />
        <ellipse cx="42" cy="-176" rx="12" ry="6" fill="#ff9db5" opacity="0.7" />
        {smile ? (
          <path d="M-16 -174 Q0 -150 16 -174 Z" fill="#a5475f" stroke="#a5475f" strokeWidth="3" strokeLinejoin="round" />
        ) : (
          <path d="M-10 -172 Q0 -162 10 -172" stroke="#a5475f" strokeWidth="3.5" fill="none" strokeLinecap="round" />
        )}
      </g>
    </g>
  )
}

// ── 그림 재료 ─────────────────────────────────────
function Defs() {
  return (
    <defs>
      <linearGradient id="kpi-night" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#140f3a" />
        <stop offset="1" stopColor="#53307f" />
      </linearGradient>
      <linearGradient id="kpi-spot" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#fff3c4" stopOpacity="0.05" />
        <stop offset="1" stopColor="#fff3c4" stopOpacity="0.45" />
      </linearGradient>
      <linearGradient id="kpi-led" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#ff4fa3" />
        <stop offset="1" stopColor="#7c3aed" />
      </linearGradient>
      <linearGradient id="kpi-hair" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#7dd3fc" />
        <stop offset="1" stopColor="#f9a8d4" />
      </linearGradient>
      <filter id="kpi-glow" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="7" result="b" />
        <feMerge>
          <feMergeNode in="b" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </defs>
  )
}

const STARS = Array.from({ length: 46 }, (_, i) => [(i * 397 + 53) % 1600, (i * 211 + 17) % 470, 2 + (i % 3) * 1.5, (i % 7) * 0.4])
function Stars() {
  return STARS.map(([x, y, r, d]) => (
    <circle key={`${x}-${y}`} cx={x} cy={y} r={r} fill="#fff" style={{ animation: `kpi-twinkle 2.4s ease-in-out ${d}s infinite` }} />
  ))
}

// 동글동글한 2등신 캐릭터. stick이 있으면 오른손에 응원봉을 들고 흔듦
function Chibi({ x, y, s = 1, hair = '#3b2a4a', shirt = '#ff8fc7', stick, delay = 0, bob = false }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <g className={bob ? 'kpi-bob' : undefined} style={bob ? { animationDelay: `${delay}s` } : undefined}>
        <rect x="-30" y="0" width="60" height="58" rx="26" fill={shirt} />
        <circle cx="0" cy="-30" r="36" fill="#ffe1cc" />
        <path d="M-39 -30 Q-40 -76 0 -74 Q40 -76 39 -30 Q30 -54 0 -52 Q-30 -54 -39 -30 Z" fill={hair} />
        <ellipse cx="-12" cy="-26" rx="4.5" ry="6.5" fill="#2a1f33" />
        <ellipse cx="12" cy="-26" rx="4.5" ry="6.5" fill="#2a1f33" />
        <circle cx="-10.5" cy="-28.5" r="1.6" fill="#fff" />
        <circle cx="13.5" cy="-28.5" r="1.6" fill="#fff" />
        <ellipse cx="-21" cy="-14" rx="7" ry="4" fill="#ff9db5" opacity="0.7" />
        <ellipse cx="21" cy="-14" rx="7" ry="4" fill="#ff9db5" opacity="0.7" />
        <path d="M-6 -12 Q0 -6 6 -12" stroke="#a5475f" strokeWidth="2.5" fill="none" strokeLinecap="round" />
        {stick && (
          <g transform="translate(30 14)">
            <g className="kpi-pivot" style={{ animation: `kpi-sway 0.9s ease-in-out ${delay}s infinite` }}>
              <rect x="-3.5" y="-62" width="7" height="48" rx="3.5" fill="#f1edf7" />
              <circle cx="0" cy="-74" r="15" fill={stick} filter="url(#kpi-glow)" />
              <circle cx="0" cy="-14" r="8" fill="#ffe1cc" />
            </g>
          </g>
        )}
      </g>
    </g>
  )
}

function Float({ x, y, children, delay = 0, color = '#fff', size = 48 }) {
  return (
    <text x={x} y={y} fontSize={size} fill={color} textAnchor="middle" className="kpi-float" style={{ animationDelay: `${delay}s` }}>
      {children}
    </text>
  )
}

function Firework({ x, y, color, delay, r = 90 }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <g className="kpi-center kpi-burst" style={{ animationDelay: `${delay}s` }} filter="url(#kpi-glow)">
        {Array.from({ length: 12 }, (_, k) => (
          <g key={k} transform={`rotate(${k * 30})`}>
            <line x1="0" y1={-r * 0.25} x2="0" y2={-r * 0.8} stroke={color} strokeWidth="6" strokeLinecap="round" />
            <circle cx="0" cy={-r} r="7" fill={color} />
          </g>
        ))}
      </g>
    </g>
  )
}

// ── 장면 ─────────────────────────────────────────
function TitleArt() {
  return (
    <>
      <rect width="1600" height="900" fill="#0b0820" />
      <Stars />
      <Float x={420} y={640} delay={0.3} color="#ff8fc7">♪</Float>
      <Float x={1180} y={600} delay={1.4} color="#b18cff">♫</Float>
      <Float x={760} y={700} delay={2.4} color="#5ce1ff">♪</Float>
    </>
  )
}

const BEAM_COLORS = ['#ff8fc7', '#5ce1ff', '#ffd166', '#b18cff']

function DomeArt() {
  return (
    <>
      <rect width="1600" height="900" fill="url(#kpi-night)" />
      <Stars />
      <circle cx="1330" cy="150" r="62" fill="#fff6d0" />
      <circle cx="1356" cy="134" r="56" fill="#1a1342" />
      {[150, 320, 1280, 1450].map((x, i) => (
        // 위치는 바깥 g, 흔들림(CSS transform)은 안쪽에만: CSS transform이 SVG transform 속성을 덮어쓰기 때문
        <g key={x} transform={`translate(${x} 760)`}>
          <polygon points="-34,0 34,0 170,-720 -170,-720" fill={BEAM_COLORS[i]} opacity="0.3" className="kpi-pivot" style={{ animation: `kpi-sway ${3.5 + i * 0.6}s ease-in-out ${-i}s infinite` }} />
        </g>
      ))}
      <path d="M250 770 Q250 370 800 350 Q1350 370 1350 770 Z" fill="#9d7bff" />
      <path d="M300 560 Q800 450 1300 560" stroke="#ff8fc7" strokeWidth="28" fill="none" strokeLinecap="round" />
      <path d="M270 650 Q800 560 1330 650" stroke="#fff" strokeWidth="18" fill="none" strokeLinecap="round" opacity="0.85" />
      {Array.from({ length: 10 }, (_, i) => (
        <g key={i}>
          <rect x={318 + i * 98} y="672" width="62" height="98" rx="31" fill="#5b3fb0" />
          <rect x={333 + i * 98} y="700" width="32" height="40" rx="12" fill="#ffd98a" style={{ animation: `kpi-twinkle 1.8s ease-in-out ${i * 0.2}s infinite` }} />
        </g>
      ))}
      <rect x="660" y="430" width="280" height="76" rx="38" fill="#2b1d55" />
      <text x="800" y="482" textAnchor="middle" fontSize="44" fontWeight="900" fill="#ffd6f0" filter="url(#kpi-glow)">SUNGRAY</text>
      <line x1="800" y1="350" x2="800" y2="270" stroke="#e9ddff" strokeWidth="6" />
      <path d="M800 272 L870 292 L800 312 Z" fill="#ff4fa3" />
      <rect y="770" width="1600" height="130" fill="#3b6fd8" />
      <g className="kpi-wave">
        <path d={`M0 790 ${Array.from({ length: 10 }, () => `q50 -28 100 0 q50 28 100 0`).join(' ')}`} stroke="#bfe3ff" strokeWidth="10" fill="none" strokeLinecap="round" />
        <path d={`M-100 840 ${Array.from({ length: 10 }, () => `q50 -22 100 0 q50 22 100 0`).join(' ')}`} stroke="#8ec5ff" strokeWidth="8" fill="none" strokeLinecap="round" />
      </g>
    </>
  )
}

function AuditionArt() {
  const judges = [
    { x: 560, hair: '#2d2d3a', shirt: '#6366f1', role: '프로듀서', color: '#a5b4fc' },
    { x: 800, hair: '#7a3b2e', shirt: '#ec4899', role: '보컬 트레이너', color: '#fbcfe8' },
    { x: 1040, hair: '#1f2937', shirt: '#14b8a6', role: '안무가', color: '#99f6e4' },
  ]
  return (
    <>
      <rect width="1600" height="900" fill="#1d1430" />
      <ellipse cx="800" cy="900" rx="900" ry="200" fill="#2b2045" />
      <rect x="300" y="110" width="1000" height="320" rx="28" fill="#2b1d55" />
      <rect x="330" y="140" width="940" height="260" rx="18" fill="url(#kpi-led)" opacity="0.9" />
      <text x="800" y="300" textAnchor="middle" fontSize="88" fontWeight="900" fill="#fff" filter="url(#kpi-glow)">SUNGRAY AUDITION</text>
      {Array.from({ length: 21 }, (_, i) => (
        <circle key={i} cx={320 + i * 48} cy="96" r="9" fill="#ffd166" style={{ animation: `kpi-twinkle 1s ease-in-out ${(i % 2) * 0.5}s infinite` }} />
      ))}
      {judges.map((j, i) => (
        <Chibi key={j.role} x={j.x} y={530} s={1.15} hair={j.hair} shirt={j.shirt} bob delay={i * 0.4} />
      ))}
      <rect x="400" y="575" width="800" height="150" rx="34" fill="#f4eefc" />
      {judges.map((j) => (
        <g key={`p-${j.role}`}>
          <rect x={j.x - 92} y="610" width="184" height="54" rx="14" fill="#1a1030" />
          <text x={j.x} y="647" textAnchor="middle" fontSize="28" fontWeight="800" fill={j.color}>{j.role}</text>
        </g>
      ))}
      <polygon points="740,0 860,0 1010,880 590,880" fill="url(#kpi-spot)" />
      <ellipse cx="800" cy="872" rx="210" ry="38" fill="#fff3c4" opacity="0.45" />
      <line x1="700" y1="880" x2="700" y2="730" stroke="#d4d4dc" strokeWidth="8" strokeLinecap="round" />
      <ellipse cx="700" cy="880" rx="34" ry="8" fill="#d4d4dc" />
      <circle cx="716" cy="720" r="17" fill="#2a1f33" />
      <Chibi x={800} y={790} s={1.5} hair="#5b3a29" shirt="#ffd166" />
      <Float x={860} y={640} delay={0.2} color="#ffd6f0">♪</Float>
      <Float x={720} y={620} delay={1.2} color="#fff3c4">♫</Float>
      <Float x={900} y={600} delay={2.2} color="#c4b5fd">♪</Float>
    </>
  )
}

function FansArt() {
  const stalls = [
    ['응원봉 대여', '#7c3aed'],
    ['컵홀더 음료', '#0e7490'],
    ['생일 컵케이크', '#db2777'],
    ['포토카드 쿠키', '#9333ea'],
    ['앨범 붕어빵', '#a16207'],
  ]
  const fans = [
    ['#2d2d3a', '#ff8fc7', '#ff4fa3'],
    ['#7a3b2e', '#a5b4fc', '#b18cff'],
    ['#1f2937', '#fde68a', '#5ce1ff'],
    ['#5b3a29', '#99f6e4', '#ffd166'],
    ['#3b2a4a', '#fbcfe8', '#ff4fa3'],
    ['#2d2d3a', '#c4b5fd', '#7dff9b'],
    ['#7a3b2e', '#ffb86b', '#b18cff'],
  ]
  return (
    <>
      <rect width="1600" height="900" fill="url(#kpi-night)" />
      <Stars />
      <path d="M0 150 Q400 250 800 160 Q1200 70 1600 170" stroke="#e9ddff" strokeWidth="3" fill="none" />
      {Array.from({ length: 17 }, (_, i) => {
        const t = i / 16
        const y = 150 + Math.sin(t * Math.PI * 2) * 48 + (i % 2 ? 8 : 0)
        return <circle key={i} cx={i * 100} cy={y + 22} r="11" fill={['#ffd166', '#ff8fc7', '#5ce1ff'][i % 3]} filter="url(#kpi-glow)" style={{ animation: `kpi-twinkle 1.6s ease-in-out ${i * 0.15}s infinite` }} />
      })}
      {stalls.map(([name, color], i) => {
        const x = 60 + i * 310
        return (
          <g key={name}>
            <rect x={x + 20} y="390" width="240" height="170" rx="18" fill="#f4eefc" />
            {Array.from({ length: 6 }, (_, k) => (
              <rect key={k} x={x + k * 46.7} y="330" width="46.7" height="62" fill={k % 2 ? '#fff' : color} />
            ))}
            {Array.from({ length: 6 }, (_, k) => (
              <circle key={`c${k}`} cx={x + 23 + k * 46.7} cy="392" r="23" fill={k % 2 ? '#fff' : color} />
            ))}
            <rect x={x + 40} y="430" width="200" height="50" rx="12" fill={color} />
            <text x={x + 140} y="465" textAnchor="middle" fontSize="27" fontWeight="800" fill="#fff">{name}</text>
          </g>
        )
      })}
      <rect y="600" width="1600" height="300" fill="#3a2766" />
      {fans.map(([hair, shirt, stick], i) => (
        <Chibi key={i} x={140 + i * 220} y={760 + (i % 2) * 30} s={1.35} hair={hair} shirt={shirt} stick={stick} delay={(i % 2) * 0.45} />
      ))}
      <Float x={300} y={560} delay={0.3} color="#ff8fc7">♥</Float>
      <Float x={1000} y={540} delay={1.3} color="#ffb3d9">♥</Float>
      <Float x={1350} y={580} delay={2.1} color="#ff8fc7">♥</Float>
    </>
  )
}

function FinaleArt() {
  const bursts = [
    [300, 220, '#ff4fa3', 0],
    [1280, 200, '#5ce1ff', 0.5],
    [560, 130, '#ffd166', 1],
    [1040, 140, '#b18cff', 1.4],
    [180, 420, '#7dff9b', 1.8],
    [1420, 420, '#ff7a45', 2.2],
  ]
  return (
    <>
      <rect width="1600" height="900" fill="url(#kpi-night)" />
      <Stars />
      {bursts.map(([x, y, c, d]) => (
        <Firework key={`${x}-${y}`} x={x} y={y} color={c} delay={d} />
      ))}
      <path d="M380 900 Q380 660 800 645 Q1220 660 1220 900 Z" fill="#2a1d5e" />
      <g className="kpi-bob">
        <rect x="390" y="330" width="820" height="230" rx="115" fill="#fff" stroke="#ff8fc7" strokeWidth="12" />
        <text x="800" y="460" textAnchor="middle" fontSize="116" fontWeight="900" fill="#7c3aed">K-POP STAGE</text>
        <text x="800" y="525" textAnchor="middle" fontSize="38" fontWeight="800" fill="#ff4fa3">SUNGRAY · SUNSET WAVE</text>
      </g>
      <Float x={360} y={640} delay={0.2} color="#ffd166" size={56}>✦</Float>
      <Float x={1240} y={620} delay={1.1} color="#ffd6f0" size={56}>✦</Float>
    </>
  )
}

const ART = { bye: TitleArt, title: TitleArt, dome: DomeArt, audition: AuditionArt, fans: FansArt, finale: FinaleArt }

// ── 스타일 ───────────────────────────────────────
const overlay = { position: 'fixed', inset: 0, zIndex: 16777280, // 3D 이름표(drei Html z-index 최대 16777271)보다 위
  display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#000', pointerEvents: 'auto' }
const stage = { position: 'relative', width: 'min(100vw, 177.78vh)', aspectRatio: '16 / 9', overflow: 'hidden', background: '#0b0820' }
const bar = { position: 'absolute', left: 0, right: 0, bottom: 0, height: 4, background: '#ffffff22' }
const barFill = { height: '100%', background: 'linear-gradient(90deg, #ff8fc7, #b18cff)', transition: 'width .6s ease' }
const replay = { position: 'absolute', left: 12, zIndex: 20, pointerEvents: 'auto', minHeight: 36, padding: '6px 14px', borderRadius: 999, border: '1px solid #ffffff66', background: 'linear-gradient(90deg, #ff8fc7, #b18cff)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 14px #0005' }
const skip = { position: 'absolute', top: 14, right: 14, minHeight: 40, padding: '8px 16px', borderRadius: 999, border: '1px solid #ffffff66', background: 'rgba(0,0,0,0.45)', color: '#fff', fontSize: 14, cursor: 'pointer' }

const CSS = `
.kpi-scene { position: absolute; inset: 0; animation-name: kpi-fade, kpi-kb; animation-timing-function: ease-out, linear; animation-fill-mode: both; }
.kpi-sub { position: absolute; left: 0; right: 0; bottom: 0; margin: 0; padding: 3.5em 0 6%; background: linear-gradient(to top, #000d, #0000); display: flex; flex-direction: column; align-items: center; gap: .2em;
  color: #fff; font-size: clamp(16px, 2.6vw, 34px); font-weight: 700; text-shadow: 0 2px 10px #000c, 0 0 2px #000; animation: kpi-fade .8s .4s ease-out both; }
.kpi-name { font-size: .62em; padding: .15em .8em; border-radius: 999px; background: #ff8fc7; color: #fff; text-shadow: none; margin-bottom: .2em; }
.kpi-hop { animation: kpi-bob 1.2s ease-in-out infinite; }
.kpi-hi { animation: kpi-hi .9s ease-in-out infinite; }
.kpi-blink { animation: kpi-blink 3.6s infinite; }
@keyframes kpi-hi { 0%, 100% { transform: rotate(-8deg) } 50% { transform: rotate(28deg) } }
@keyframes kpi-blink { 0%, 94%, 100% { transform: scaleY(1) } 97% { transform: scaleY(.1) } }
.kpi-pivot { transform-box: fill-box; transform-origin: 50% 100%; }
.kpi-center { transform-box: fill-box; transform-origin: center; }
.kpi-float { animation: kpi-float 3s ease-out infinite both; }
.kpi-bob { animation: kpi-bob 1.6s ease-in-out infinite; }
.kpi-burst { animation: kpi-burst 1.9s ease-out infinite both; }
.kpi-wave { animation: kpi-wave 3s linear infinite; }
@keyframes kpi-fade { from { opacity: 0 } to { opacity: 1 } }
@keyframes kpi-kb { from { transform: scale(1.02) translate(1%, 0) } to { transform: scale(1.12) translate(-1.5%, -1%) } }
@keyframes kpi-twinkle { 0%, 100% { opacity: .25 } 50% { opacity: 1 } }
@keyframes kpi-sway { 0%, 100% { transform: rotate(-14deg) } 50% { transform: rotate(14deg) } }
@keyframes kpi-float { 0% { transform: translateY(0); opacity: 0 } 20% { opacity: 1 } 100% { transform: translateY(-140px); opacity: 0 } }
@keyframes kpi-bob { 0%, 100% { transform: translateY(0) } 50% { transform: translateY(-8px) } }
@keyframes kpi-burst { 0% { transform: scale(.1); opacity: 0 } 15% { opacity: 1 } 75% { opacity: .9 } 100% { transform: scale(1); opacity: 0 } }
@keyframes kpi-wave { from { transform: translateX(0) } to { transform: translateX(-200px) } }
@media (prefers-reduced-motion: reduce) { .kpi-anim *, .kpi-anim *::before { animation-duration: .01s !important; animation-iteration-count: 1 !important; } }
`
