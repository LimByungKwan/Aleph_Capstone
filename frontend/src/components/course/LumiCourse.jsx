import { useEffect, useState } from 'react'
import { recommendCourse } from '../../api/course.js'
import { currentTarget, useCourseStore } from '../../store/courseStore.js'
import { useGameStore } from '../../store/gameStore.js'
import './lumi-course.css'

// 루미 코스 추천 (담당: 병관) — 루미 대화창(DialogBox) 안에 들어가는 부분
// 취향을 입력하면 AI 서버(ai/)가 코스를 골라 주고, 지도에 다음 목적지가 표시돼요.

const EXAMPLES = ['연인이랑 야경 보는 데이트', '애니메이션 성지순례', 'K-POP 굿즈랑 무대', '드라마 촬영지 산책']
const COUNTS = [2, 3, 4, 5]

export default function LumiCourse() {
  const setCourse = useCourseStore((s) => s.setCourse)
  const clearCourse = useCourseStore((s) => s.clear)
  const target = useCourseStore(currentTarget)
  const hasCourse = useCourseStore((s) => s.course.length > 0)
  const close = useGameStore((s) => s.close)

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
      {hasCourse && target && (
        <p className="lumi-course__now">
          지금 코스: <b>{target.name}</b>(으)로 가는 중이에요.{' '}
          <button type="button" className="lumi-course__link" onClick={clearCourse}>
            코스 지우기
          </button>
        </p>
      )}
      <div className="lumi-course__chips">
        {EXAMPLES.map((example) => (
          <button key={example} type="button" className="lumi-course__chip" disabled={loading} onClick={() => (setText(example), ask(example))}>
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
          placeholder="좋아하는 작품이나 분위기를 말해 주세요"
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
    </form>
  )
}

// 화면 위쪽 가운데: 지금 가야 할 곳 (코스가 있을 때만)
export function CourseHud() {
  const course = useCourseStore((s) => s.course)
  const index = useCourseStore((s) => s.index)
  const clear = useCourseStore((s) => s.clear)
  if (!course.length) return null
  const done = index >= course.length
  const target = course[index]

  return (
    <div className="lumi-hud ui-interactive" role="status">
      <span className="lumi-hud__badge">루미 코스 {Math.min(index + 1, course.length)}/{course.length}</span>
      {done ? (
        <span className="lumi-hud__text">코스 완주! 수고하셨어요 🎉</span>
      ) : (
        <span className="lumi-hud__text">
          다음 목적지 <b>{target.name}</b> <small>{target.zoneName}</small>
        </span>
      )}
      <button type="button" className="lumi-hud__close" onClick={(e) => (e.currentTarget.blur(), clear())} aria-label="코스 지우기">
        ✕
      </button>
    </div>
  )
}
