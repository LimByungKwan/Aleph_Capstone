import { useEffect, useRef, useState } from 'react'
import { recommendCourse } from '../../api/course.js'
import { currentTarget, useCourseStore } from '../../store/courseStore.js'
import { useGameStore } from '../../store/gameStore.js'
import { useTutorial } from '../../store/tutorialStore.js'
import { distanceTo, formatDistance } from '../../store/playerPose.js'
import { BADGES, useBadges } from '../../store/badges.js'
import { unvisitedZone, useLumiMemory } from '../../store/lumiMemory.js'
import './lumi-course.css'

// 루미 코스 추천 (담당: 병관) — 루미 대화창(DialogBox) 안에 들어가는 부분
// 취향을 입력하면 AI 서버(ai/)가 코스를 골라 주고, 지도에 다음 목적지가 표시돼요.

const ZONE_INFO = {
  BK: { name: '데이트 코스 구역', short: '데이트', example: '연인이랑 야경 보는 데이트' },
  JM: { name: '애니메이션 구역', short: '애니메이션', example: '애니메이션 성지순례' },
  SG: { name: 'K-POP 구역', short: 'K-POP', example: 'K-POP 굿즈랑 무대' },
  HJ: { name: '영화·드라마 구역', short: '영화·드라마', example: '드라마 촬영지 산책' },
}
const EXAMPLES = Object.values(ZONE_INFO).map((z) => z.example)
const COUNTS = [2, 3, 4, 5]

export default function LumiCourse() {
  const setCourse = useCourseStore((s) => s.setCourse)
  const clearCourse = useCourseStore((s) => s.clear)
  const target = useCourseStore(currentTarget)
  const hasCourse = useCourseStore((s) => s.course.length > 0)
  const close = useGameStore((s) => s.close)
  const tutorialTalk = useTutorial((s) => s.step === 'talk')
  const memory = useLumiMemory()
  const suggestZone = unvisitedZone(memory)
  // 안 가 본 구역 예시를 맨 앞에 (추천 표시)
  const examples = suggestZone ? [ZONE_INFO[suggestZone].example, ...EXAMPLES.filter((e) => e !== ZONE_INFO[suggestZone].example)] : EXAMPLES

  const [text, setText] = useState('')
  const [count, setCount] = useState(3)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)
  const [slow, setSlow] = useState(false)

  // 오래 걸리면 (무료 서버가 잠에서 깨는 중) 안내 문구를 바꿈
  useEffect(() => {
    if (!loading) return setSlow(false)
    const id = setTimeout(() => setSlow(true), 6000)
    return () => clearTimeout(id)
  }, [loading])

  const ask = async (message) => {
    const trimmed = message.trim()
    if (!trimmed || loading) return
    setLoading(true)
    setError('')
    try {
      const data = await recommendCourse({ message: trimmed, count })
      setResult(data)
      setCourse(data.course)
    } catch (e) {
      setError(e.message || '코스를 고르지 못했어요.')
    } finally {
      setLoading(false)
    }
  }

  // 입력칸에서 누른 키가 게임(이동·E·미니게임)으로 새지 않게. ESC는 대화창 닫기로 보냄
  const keepKeys = (event) => {
    if (event.key !== 'Escape') event.stopPropagation()
  }

  if (result) {
    return (
      <div className="lumi-course">
        <p className="lumi-course__reply">{result.reply}</p>
        <ol className="lumi-course__list">
          {result.course.map((c, i) => (
            <li key={c.placeId}>
              <span className="lumi-course__num">{i + 1}</span>
              <span className="lumi-course__name">
                {c.name} <small>{c.zoneName}{c.type === 'cafe' ? ' · 쿠폰 가게' : ''}</small>
              </span>
              <span className="lumi-course__reason">{c.reason}</span>
            </li>
          ))}
        </ol>
        <div className="lumi-course__row">
          <button type="button" className="ui-btn ui-btn--primary" onClick={close}>
            🧭 지도 따라 출발하기
          </button>
          <button type="button" className="ui-btn" onClick={() => setResult(null)}>
            다시 추천받기
          </button>
        </div>
      </div>
    )
  }

  return (
    <form className="lumi-course" onSubmit={(e) => (e.preventDefault(), ask(text))}>
      <p className="lumi-course__hello">{greeting(memory, suggestZone)}</p>
      {hasCourse && target && (
        <p className="lumi-course__now">
          지금 코스: <b>{target.name}</b>(으)로 가는 중이에요.{' '}
          <button type="button" className="lumi-course__link" onClick={clearCourse}>
            코스 지우기
          </button>
        </p>
      )}
      {tutorialTalk && <p className="lumi-course__tut">👆 처음이시죠? 아래 예시 버튼 하나를 눌러 보세요 (루미의 안내 2/3)</p>}
      <div className={`lumi-course__chips${tutorialTalk ? ' is-tutorial' : ''}`}>
        {examples.map((example, i) => (
          <button key={example} type="button" className="lumi-course__chip" disabled={loading} onClick={() => (setText(example), ask(example))}>
            {i === 0 && suggestZone && memory.visits > 1 && <span className="lumi-course__new">추천</span>}
            {example}
          </button>
        ))}
      </div>
      <div className="lumi-course__row">
        <input
          className="lumi-course__input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={keepKeys}
          onKeyUp={keepKeys}
          maxLength={300}
          placeholder="루미에게 아무 말이나 걸어 보세요 (취향·기분·궁금한 것)"
          aria-label="루미에게 취향 말하기"
          disabled={loading}
        />
        <select className="lumi-course__count" value={count} onChange={(e) => setCount(Number(e.target.value))} onKeyDown={keepKeys} aria-label="코스 장소 수" disabled={loading}>
          {COUNTS.map((n) => (
            <option key={n} value={n}>
              {n}곳
            </option>
          ))}
        </select>
        <button type="submit" className="ui-btn ui-btn--primary" disabled={loading || !text.trim()}>
          {loading ? '고르는 중…' : '추천받기'}
        </button>
      </div>
      {loading && (
        <p className="lumi-course__hint">
          {slow ? '루미가 잠에서 깨는 중이에요. 처음 한 번은 1분 정도 걸릴 수 있어요…' : '루미가 지도를 펼쳐 코스를 고르고 있어요…'}
        </p>
      )}
      {error && <p className="lumi-course__error" role="alert">{error}</p>}
      <MyBadges />
    </form>
  )
}

// 화면 위쪽 가운데: 지금 가야 할 곳 (코스가 있을 때만)
export function CourseHud() {
  const course = useCourseStore((s) => s.course)
  const index = useCourseStore((s) => s.index)
  const clear = useCourseStore((s) => s.clear)
  const done = index >= course.length
  const target = course[index]
  const dist = useLiveDistance(done ? null : target?.position)

  return (
    <>
      <Celebration />
      {course.length > 0 && (
    <div className="lumi-hud ui-interactive" role="status">
      <span className="lumi-hud__badge">루미 코스 {Math.min(index + 1, course.length)}/{course.length}</span>
      {done ? (
        <span className="lumi-hud__text">코스 완주! 수고하셨어요 🎉</span>
      ) : (
        <span className="lumi-hud__text">
          다음 목적지 <b>{target.name}</b> <small>{target.zoneName}</small>
          {dist && <span className="lumi-hud__dist">{dist}</span>}
        </span>
      )}
      <button type="button" className="lumi-hud__close" onClick={(e) => (e.currentTarget.blur(), clear())} aria-label="코스 지우기">
        ✕
      </button>
    </div>
      )}
    </>
  )
}

// 루미 대화창 아래 "내 배지" (받은 배지는 색, 아직 못 받은 배지는 회색 + 받는 방법 안내)
function MyBadges() {
  const earned = useBadges((s) => s.earned)
  const got = (id) => earned.filter((b) => b.id === id)
  const kinds = BADGES.filter((b) => got(b.id).length).length
  return (
    <div className="lumi-badges">
      <span className="lumi-badges__title">
        🏅 내 배지 <small>{kinds}/{BADGES.length}</small>
      </span>
      <ul className="lumi-badges__list">
        {BADGES.map((b) => {
          const mine = got(b.id)
          return (
            <li key={b.id} className={mine.length ? 'is-on' : ''} title={mine.length ? `${b.name} · ${b.desc}` : `아직 없어요 · ${b.desc}`}>
              <span className="lumi-badges__icon" aria-hidden="true">
                {b.icon}
              </span>
              <span className="lumi-badges__name">{b.name}</span>
              {mine.length > 1 && <span className="lumi-badges__count">×{mine.length}</span>}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

// 코스 완주 색종이 (celebrate 값이 바뀔 때 3초 동안)
const CONFETTI_COLORS = ['#ff8fb8', '#7cc8ff', '#ffa45c', '#b18cff', '#ffd25e', '#7fd6a4']
function Celebration() {
  const celebrate = useCourseStore((s) => s.celebrate)
  const [pieces, setPieces] = useState(null)
  useEffect(() => {
    if (!celebrate) return undefined
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return undefined
    setPieces(
      Array.from({ length: 70 }, (_, i) => ({
        id: `${celebrate}-${i}`,
        left: Math.random() * 100,
        delay: Math.random() * 0.6,
        duration: 2 + Math.random() * 1.4,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        size: 6 + Math.random() * 6,
        spin: (Math.random() * 2 - 1) * 720,
      })),
    )
    const id = setTimeout(() => setPieces(null), 3600)
    return () => clearTimeout(id)
  }, [celebrate])
  if (!pieces) return null
  return (
    <div className="lumi-confetti" aria-hidden="true">
      {pieces.map((p) => (
        <span
          key={p.id}
          style={{
            left: `${p.left}%`,
            width: p.size,
            height: p.size * 0.45,
            background: p.color,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
            '--spin': `${p.spin}deg`,
          }}
        />
      ))}
    </div>
  )
}

// 남은 거리 글자 (0.25초마다 확인, 바뀔 때만 다시 그림)
export function useLiveDistance(position) {
  const [text, setText] = useState('')
  const last = useRef('')
  useEffect(() => {
    if (!position) {
      last.current = ''
      setText('')
      return undefined
    }
    const tick = () => {
      const next = formatDistance(distanceTo(position))
      if (next !== last.current) {
        last.current = next
        setText(next)
      }
    }
    tick()
    const id = setInterval(tick, 250)
    return () => clearInterval(id)
  }, [position])
  return text
}

// 루미의 첫 인사: 처음 온 사람 / 다시 온 사람 (store/lumiMemory.js)
function greeting(memory, suggestZone) {
  const { visits, lastZones } = memory
  if (visits <= 1 && !lastZones.length) return '처음 오셨네요! 반가워요 😊 좋아하는 작품이나 지금 기분을 편하게 말해 주세요.'
  const last = lastZones.map((z) => ZONE_INFO[z]?.short).filter(Boolean)
  const parts = [`또 오셨네요! ${visits}번째 방문이에요.`]
  if (last.length) parts.push(`지난번엔 ${last.slice(0, 2).join('·')} 코스였죠?`)
  parts.push(suggestZone ? `이번엔 아직 안 가 본 ${ZONE_INFO[suggestZone].name} 어때요?` : '골목을 거의 다 둘러보셨네요! 오늘 기분을 말해 주시면 새 코스를 골라 드릴게요.')
  return parts.join(' ')
}
