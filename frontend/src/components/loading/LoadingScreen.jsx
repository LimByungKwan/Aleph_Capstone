import { useEffect, useRef, useState } from 'react'
import { useProgress } from '@react-three/drei'
import { useLoadState } from '../../store/loadState.js'
import { wakeAiServer } from '../../api/course.js'
import './loading-screen.css'

// 첫 접속 로딩 화면 (담당: 병관)
// - 진행률: drei useProgress (GLB 모델·텍스처를 실제로 내려받은 비율)
// - 끝나는 시점: 파일 다운로드가 0.6초 동안 더 없고 + 셰이더 준비(ShaderWarmup)가 끝나면 → 부드럽게 사라짐
// - 너무 오래 걸리면(25초) 그냥 닫음 (화면이 영영 막히지 않게)

const TIPS = [
  '루미에게 "배고파", "심심해"처럼 기분을 말해 보세요. 딱 맞는 코스를 골라 줘요.',
  '촬영지 바닥의 원 안에서 E를 누르면 스탬프를 찍을 수 있어요.',
  '스탬프를 모으면 같은 작품과 이어진 가게의 쿠폰이 열려요.',
  '데이트 코스 구역 별빛 전망대에 오르면 골목 전체가 한눈에 보여요.',
  '오른쪽 아래 미니맵에 다음 목적지가 분홍 점으로 표시돼요.',
  '휴대폰에서는 왼쪽 조이스틱으로 걷고, 화면을 끌어 둘러볼 수 있어요.',
]
const ZONES = [
  { name: '애니메이션', color: '#7cc8ff' },
  { name: '데이트 코스', color: '#ff8fb8' },
  { name: '영화·드라마', color: '#ffa45c' },
  { name: 'K-POP', color: '#b18cff' },
]
const QUIET_MS = 600 // 다운로드가 이 시간 동안 없으면 "다 받음"
const MIN_SHOW_MS = 1200 // 너무 빨리 깜빡이고 사라지지 않게
const MAX_SHOW_MS = 25000
const FADE_MS = 700
// 개발할 때 디자인 확인용: 주소 끝에 ?loading 을 붙이면 로딩 화면이 사라지지 않음 (배포 사이트에서는 무시)
const KEEP_OPEN = import.meta.env.DEV && new URLSearchParams(window.location.search).has('loading')

export default function LoadingScreen() {
  const { active, progress, loaded, total } = useProgress()
  const shadersReady = useLoadState((s) => s.shadersReady)
  const [assetsDone, setAssetsDone] = useState(false)
  const [phase, setPhase] = useState('loading') // loading → fading → gone
  const [tip, setTip] = useState(() => Math.floor(Math.random() * TIPS.length))
  const shown = useRef(0)
  const peak = useRef(0)

  useEffect(() => {
    shown.current = performance.now()
    wakeAiServer() // 로딩하는 동안 AI 서버(루미)도 미리 깨움
  }, [])

  // 다운로드가 잠깐 멈춘 걸 "끝"으로 착각하지 않게, 조용한 시간이 이어질 때만 완료
  useEffect(() => {
    if (active) return setAssetsDone(false)
    const id = setTimeout(() => setAssetsDone(true), QUIET_MS)
    return () => clearTimeout(id)
  }, [active, loaded])

  useEffect(() => {
    if (phase !== 'loading' || KEEP_OPEN) return undefined
    const elapsed = performance.now() - shown.current
    const ready = assetsDone && shadersReady
    const wait = ready ? Math.max(0, MIN_SHOW_MS - elapsed) : Math.max(0, MAX_SHOW_MS - elapsed)
    const id = setTimeout(() => setPhase('fading'), wait)
    return () => clearTimeout(id)
  }, [assetsDone, shadersReady, phase])

  useEffect(() => {
    if (phase !== 'fading') return undefined
    const id = setTimeout(() => setPhase('gone'), FADE_MS)
    return () => clearTimeout(id)
  }, [phase])

  useEffect(() => {
    const id = setInterval(() => setTip((t) => (t + 1) % TIPS.length), 3200)
    return () => clearInterval(id)
  }, [])

  if (phase === 'gone') return null

  // 진행률은 뒤로 가지 않게 (새 파일이 추가되면 잠깐 줄어드는 것 방지). 셰이더 준비 중엔 99%
  const raw = total === 0 ? (assetsDone ? 100 : 5) : progress
  peak.current = Math.max(peak.current, Math.min(raw, assetsDone && shadersReady ? 100 : 99))
  const percent = Math.round(peak.current)
  const status = assetsDone && !shadersReady ? '골목에 불을 켜는 중…' : percent >= 100 ? '준비 완료!' : '골목을 꾸미는 중…'

  return (
    <div className={`ld${phase === 'fading' ? ' is-fading' : ''}`} role="status" aria-live="polite" aria-label={`SceneWalk 불러오는 중 ${percent}%`}>
      <div className="ld__sky" aria-hidden="true">
        <span className="ld__cloud ld__cloud--1" />
        <span className="ld__cloud ld__cloud--2" />
        <span className="ld__cloud ld__cloud--3" />
      </div>

      <div className="ld__card">
        <div className="ld__pins" aria-hidden="true">
          {ZONES.map((z, i) => (
            <span key={z.name} className="ld__pin" style={{ '--c': z.color, '--d': `${i * 0.18}s` }} />
          ))}
        </div>
        <h1 className="ld__title">
          Scene<span>Walk</span>
        </h1>
        <p className="ld__sub">덕질 성지를 걷는 3D 골목</p>

        <div className="ld__bar" aria-hidden="true">
          <div className="ld__fill" style={{ width: `${percent}%` }} />
          <span className="ld__walker" style={{ left: `${percent}%` }}>
            🚶
          </span>
        </div>
        <div className="ld__meta">
          <span>{status}</span>
          <span className="ld__pct">{percent}%</span>
        </div>

        <ul className="ld__zones" aria-hidden="true">
          {ZONES.map((z) => (
            <li key={z.name} style={{ '--c': z.color }}>
              {z.name}
            </li>
          ))}
        </ul>

        <p className="ld__tip" key={tip}>
          <b>루미의 팁</b> {TIPS[tip]}
        </p>
      </div>
    </div>
  )
}
