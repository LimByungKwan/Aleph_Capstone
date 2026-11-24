import { useEffect, useState } from 'react'
import questionData from '@shared/bk_tarot/questions.json'
import { requestTarot } from '../../../api/course.js'
import { useCourseStore } from '../../../store/courseStore.js'
import { awardTarotBadges, cardById, recordReading, removeReading } from './bk_tarotRecord.js'
import { onlinePeers, tarotRoom, useTarotRoom } from './bk_tarotRoom.js'
import { useBkActivity } from './bk_activityStore.js'

// 데이트 코스 구역(BK) 커플 타로 — 두 사람이 한 기기에서 번갈아 답하는 질문 카드 화면. 담당: 병관
// 텐트(bk_tarotBooth.jsx)에서 E를 누르면 열림. 순서: 이름 → 첫 번째 사람 10문항 → 기기 넘기기 → 두 번째 사람 10문항 → 완료
// 문항마다 "나는?"(self)과 "상대는 뭐라고 할까?"(guess)를 하나씩 고름. 답은 보기 번호(0~3)로만 들고 있다가
// 다 답하면 AI 서버 /tarot로 보내 카드 3장을 받음 (TarotResult). 화면을 닫으면 답은 사라짐 (원문 저장 X — docs/bk-couple-tarot-plan.md 5장)

const QUESTIONS = questionData.questions
const PEOPLE = [
  { emoji: '🩷', color: '#f9a8d4', fallback: 'A' },
  { emoji: '💙', color: '#93c5fd', fallback: 'B' },
]
const NAME_MAX = 8
// course.js의 에러 문구는 루미 대화용이라 타로에 맞게 바꿔 보여 줌 (답은 그대로 남아 있어서 '다시 시도'만 누르면 됨)
const TAROT_ERRORS = {
  AI_OFFLINE: '타로 서버가 잠깐 쉬고 있어요. 잠시 후 [다시 시도]를 눌러 주세요. 두 사람 답은 그대로 있어요.',
  RATE_LIMITED: '카드를 너무 자주 펼쳤어요. 1분쯤 뒤에 [다시 시도]를 눌러 주세요.',
}
// 별명에 거친 말이 들어가면 화면에서도 A·B로 (서버 ai/app/safety.py가 한 번 더 걸러 냄 — 여기는 자주 쓰는 말만)
const NAME_BLOCK = ['씨발', '시발', '씨팔', 'ㅅㅂ', 'ㅆㅂ', '개새', '새끼', '병신', 'ㅂㅅ', '좆', '지랄', '미친', '느금', '섹스', 'fuck', 'shit', 'bitch', 'sex']
const isRudeName = (name) => {
  const text = name.toLowerCase().replace(/[^0-9a-z가-힣ㄱ-ㅎㅏ-ㅣ]/g, '')
  return NAME_BLOCK.some((w) => text.includes(w))
}

const emptyAnswers = () => [QUESTIONS.map(() => ({ self: null, guess: null })), QUESTIONS.map(() => ({ self: null, guess: null }))]

export function TarotSession({ onClose }) {
  const [step, setStep] = useState('intro') // 'intro' | 'answer' | 'handover' | 'done'
  const [names, setNames] = useState(['', ''])
  const [who, setWho] = useState(0) // 지금 답하는 사람 0 | 1
  const [qi, setQi] = useState(0) // 지금 문항 번호
  const [answers, setAnswers] = useState(emptyAnswers)
  const room = useTarotRoom((s) => s.room)

  const nameOf = (i) => {
    const name = names[i].trim()
    return name && !isRudeName(name) ? name : PEOPLE[i].fallback
  }
  const restart = () => {
    setStep('intro')
    setWho(0)
    setQi(0)
    setAnswers(emptyAnswers())
  }

  // 같이 보기(각자 폰)로 방이 생기면 그쪽 화면으로
  if (room) return <MultiSession onClose={onClose} />

  if (step === 'intro') {
    return (
      <div style={panel}>
        <div style={{ fontSize: 28, textAlign: 'center' }}>🔮</div>
        <div style={title}>커플 타로</div>
        <p style={para}>한 사람씩 번갈아 질문 카드 {QUESTIONS.length}장에 답해요. 카드마다 <b>나는?</b> 하나, <b>상대는 뭐라고 할까?</b> 하나를 골라요.</p>
        <p style={{ ...para, opacity: 0.85 }}>다 답하면 서로 얼마나 잘 아는지 보고 타로 카드 3장(지나온 우리 · 지금의 우리 · 다음 데이트)으로 풀어 드려요.</p>
        {PEOPLE.map((p, i) => (
          <label key={i} style={nameRow}>
            <span style={{ ...dot, background: p.color }}>{p.emoji}</span>
            <input
              style={input}
              value={names[i]}
              maxLength={NAME_MAX}
              placeholder={`${i === 0 ? '첫' : '두'} 번째 사람 별명 (비우면 ${p.fallback})`}
              onChange={(e) => setNames(names.map((n, j) => (j === i ? e.target.value : n)))}
              onKeyDown={keepKeysHere}
            />
          </label>
        ))}
        <div style={note}>재미로 보는 타로예요. 결과가 두 사람의 관계를 정하지 않아요. 실명 대신 별명을 권해요.</div>
        <div style={row}>
          <button type="button" style={ghostBtn} onClick={onClose}>닫기 <kbd style={kbd}>ESC</kbd></button>
          <button type="button" style={btn} onClick={() => setStep('answer')}>{nameOf(0)}님부터 시작 ✨</button>
        </div>
        <Together />
      </div>
    )
  }

  if (step === 'handover') {
    return (
      <div style={panel}>
        <div style={{ fontSize: 34, textAlign: 'center' }}>🔄</div>
        <div style={title}>{nameOf(0)}님 답변 끝!</div>
        <p style={{ ...para, textAlign: 'center' }}>
          이제 <b style={{ color: PEOPLE[1].color }}>{nameOf(1)}님</b> 차례예요.<br />
          서로 답을 보지 않게 화면을 넘겨 주세요 🙈
        </p>
        <div style={row}>
          <button type="button" style={btn} onClick={() => { setWho(1); setQi(0); setStep('answer') }}>{PEOPLE[1].emoji} {nameOf(1)}님 시작</button>
        </div>
      </div>
    )
  }

  if (step === 'done') {
    const toServer = (i) => ({ name: nameOf(i), self: answers[i].map((x) => x.self), guess: answers[i].map((x) => x.guess) })
    return <TarotResult a={toServer(0)} b={toServer(1)} onRestart={restart} onClose={onClose} />
  }

  // step === 'answer'
  const q = QUESTIONS[qi]
  const a = answers[who][qi]
  const partner = nameOf(1 - who)
  const pick = (part, index) => setAnswers(answers.map((list, w) => (w !== who ? list : list.map((x, i) => (i === qi ? { ...x, [part]: index } : x)))))
  const next = () => {
    if (qi < QUESTIONS.length - 1) setQi(qi + 1)
    else setStep(who === 0 ? 'handover' : 'done')
  }
  const ready = a.self !== null && a.guess !== null
  return (
    <div style={panel}>
      <div style={topRow}>
        <span style={{ ...badge, background: PEOPLE[who].color }}>{PEOPLE[who].emoji} {nameOf(who)}님 차례</span>
        <span style={{ opacity: 0.8 }}>{qi + 1} / {QUESTIONS.length}</span>
      </div>
      <div style={bar}><div style={{ ...barFill, width: `${((qi + (ready ? 1 : 0)) / QUESTIONS.length) * 100}%`, background: PEOPLE[who].color }} /></div>

      <div style={qLabel}>나는?</div>
      <div style={qText}>{q.self}</div>
      <Options options={q.options} value={a.self} color={PEOPLE[who].color} onPick={(i) => pick('self', i)} />

      <div style={{ ...qLabel, marginTop: 12 }}>{partner}님은 뭐라고 할까?</div>
      <div style={qText}>{q.guess.replaceAll('{partner}', partner)}</div>
      <Options options={q.options} value={a.guess} color={PEOPLE[1 - who].color} onPick={(i) => pick('guess', i)} />

      <div style={row}>
        <button type="button" style={ghostBtn} disabled={qi === 0} onClick={() => setQi(qi - 1)}>← 이전</button>
        <button type="button" style={{ ...btn, opacity: ready ? 1 : 0.45, cursor: ready ? 'pointer' : 'default' }} disabled={!ready} onClick={next}>
          {qi < QUESTIONS.length - 1 ? '다음 →' : who === 0 ? '다 했어요!' : '결과 보기 ✨'}
        </button>
      </div>
    </div>
  )
}

// 결과 화면: AI 서버에 두 사람 답을 보내고 카드 3장 + 해석 + 대화 질문을 보여 줌
function TarotResult({ a, b, onRestart, onClose }) {
  const [state, setState] = useState({ status: 'loading', data: null, error: '' })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let alive = true
    setState({ status: 'loading', data: null, error: '' })
    requestTarot({ a, b })
      .then((data) => alive && setState({ status: 'ok', data, error: '' }))
      .catch((err) => alive && setState({ status: 'error', data: null, error: TAROT_ERRORS[err?.code] || err?.message || '카드를 펼치지 못했어요.' }))
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt])

  if (state.status === 'loading') {
    return (
      <div style={panel}>
        <div style={{ fontSize: 34, textAlign: 'center' }}>🔮</div>
        <div style={title}>카드를 섞고 있어요…</div>
        <p style={{ ...para, textAlign: 'center', opacity: 0.8 }}>두 사람 답을 비교해서 카드 3장을 고르는 중이에요.<br />서버가 자고 있었다면 1분쯤 걸릴 수 있어요.</p>
      </div>
    )
  }
  if (state.status === 'error') {
    return (
      <div style={panel}>
        <div style={{ fontSize: 34, textAlign: 'center' }}>🌫️</div>
        <div style={title}>카드를 펼치지 못했어요</div>
        <p style={{ ...para, textAlign: 'center' }}>{state.error}</p>
        <div style={row}>
          <button type="button" style={ghostBtn} onClick={onClose}>닫기</button>
          <button type="button" style={btn} onClick={() => setAttempt(attempt + 1)}>다시 시도</button>
        </div>
      </div>
    )
  }

  return <TarotSpread r={state.data} onRestart={onRestart} onClose={onClose} />
}

// 카드 3장을 뒷면으로 깔고, 눌러서 한 장씩 뒤집기 → 다 뒤집으면 미션·대화 질문·지난번 비교가 열림
function TarotSpread({ r, onRestart, onClose }) {
  const [flipped, setFlipped] = useState([false, false, false])
  const [record, setRecord] = useState({ status: 'saving', last: null, saved: null, error: null })
  const allOpen = flipped.every(Boolean)
  const flip = (i) => setFlipped(flipped.map((f, j) => f || j === i))

  useEffect(() => {
    let alive = true
    awardTarotBadges(r)
    recordReading(r).then((res) => alive && setRecord({ status: 'done', ...res }))
    return () => {
      alive = false
    }
  }, [r])

  const forget = async () => {
    try {
      await removeReading(record.saved.id)
      setRecord({ ...record, saved: null, error: null, status: 'deleted' })
    } catch {
      setRecord({ ...record, error: '기록을 지우지 못했어요.' })
    }
  }

  return (
    <div style={panel}>
      <style>{FLIP_CSS}</style>
      <div style={{ textAlign: 'center', fontSize: 13, opacity: 0.85 }}>{r.names.a}님 × {r.names.b}님</div>
      <div style={{ textAlign: 'center', fontSize: 30, fontWeight: 800, color: '#e7c35a', margin: '2px 0' }}>{r.match}%</div>
      <div style={{ textAlign: 'center', fontSize: 12, opacity: 0.75, marginBottom: 6 }}>
        서로 맞힌 답 · {r.names.a}님 {r.hits.a}개 · {r.names.b}님 {r.hits.b}개 / {r.hits.total}
      </div>
      {!allOpen && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, opacity: 0.85 }}>
          <span>🃏 카드를 눌러 한 장씩 뒤집어 보세요</span>
          <button type="button" style={linkBtn} onClick={() => setFlipped([true, true, true])}>모두 뒤집기</button>
        </div>
      )}

      {r.cards.map((c, i) =>
        flipped[i] ? (
          <div key={c.position} className="bk-tarot-flip" style={cardBox}>
            <div style={cardHead}>
              <span style={{ fontSize: 22 }}>{c.emoji}</span>
              <span>
                <span style={{ fontSize: 11, color: '#e7c35a', fontWeight: 700 }}>{c.positionName}</span><br />
                <b>{c.name}</b>{c.reversed && <span style={revTag}>역방향 · 조언</span>}
              </span>
            </div>
            <div style={{ lineHeight: 1.5, fontSize: 13 }}>{c.meaning}</div>
            <div style={advice}>💡 {c.advice}</div>
          </div>
        ) : (
          <button key={c.position} type="button" className="bk-tarot-back" style={cardBack} onClick={() => flip(i)}>
            <span style={{ fontSize: 11, color: '#e7c35a', fontWeight: 700 }}>{c.positionName}</span>
            <span style={{ fontSize: 22, letterSpacing: 6 }}>✦ 🌙 ✦</span>
            <span style={{ fontSize: 11, opacity: 0.8 }}>눌러서 뒤집기</span>
          </button>
        ),
      )}

      {allOpen && (
        <>
          <LastTime record={record} r={r} />

          {r.course?.length > 0 ? (
            <div style={missionBox}>
              <div style={{ fontSize: 12, color: '#e7c35a', fontWeight: 700 }}>🗺️ 타로가 짜 준 오늘의 데이트 코스</div>
              <ol style={{ margin: '6px 0 8px', paddingLeft: 20, lineHeight: 1.45 }}>
                {r.course.map((c) => (
                  <li key={c.placeId} style={{ marginBottom: 4 }}>
                    <b>{c.name}</b>
                    {c.mission && <span style={missionTag}>미션</span>}
                    <div style={{ fontSize: 12, opacity: 0.85 }}>{c.reason}</div>
                  </li>
                ))}
              </ol>
              <button type="button" style={{ ...btn, width: '100%' }} onClick={() => goCourse(r, onClose)}>이 코스로 데이트 시작 (미니맵 안내) →</button>
            </div>
          ) : (
            r.mission && (
              <div style={missionBox}>
                <div style={{ fontSize: 12, color: '#e7c35a', fontWeight: 700 }}>🗺️ 오늘의 데이트 미션 · {r.mission.name}</div>
                <div style={{ margin: '4px 0 8px', lineHeight: 1.5 }}>{r.mission.text}</div>
                <button type="button" style={{ ...btn, width: '100%' }} onClick={() => goCourse(r, onClose)}>미니맵에 길 표시하고 가기 →</button>
              </div>
            )
          )}

          {r.mismatches.length > 0 && (
            <details style={{ marginTop: 8, fontSize: 13 }}>
              <summary style={{ cursor: 'pointer' }}>🙈 서로 몰랐던 점 {r.mismatches.length}개</summary>
              <ul style={{ margin: '6px 0 0', paddingLeft: 18, lineHeight: 1.5 }}>
                {r.mismatches.map((m, i) => (
                  <li key={i}>{m.question} — {m.about}님은 '{m.answer}', {m.guesser}님은 '{m.guessed}'(으)로 짐작</li>
                ))}
              </ul>
            </details>
          )}

          {r.talk.length > 0 && (
            <div style={{ marginTop: 10 }}>
              <div style={{ fontSize: 12, color: '#e7c35a', fontWeight: 700 }}>💬 오늘 나눠 볼 질문</div>
              {r.talk.map((t) => (
                <div key={t.text} style={talkBox}>
                  {t.theme && <span style={themeTag}>{t.emoji} {t.theme}</span>}
                  {t.text}
                </div>
              ))}
            </div>
          )}

          <div style={note}>
            재미로 보는 타로예요. 결과가 두 사람의 관계를 정하지 않아요.
            {record.saved && (
              <>
                {' '}
                <button type="button" style={linkBtn} onClick={forget}>기록 지우기</button>
              </>
            )}
          </div>
        </>
      )}
      <div style={row}>
        <button type="button" style={ghostBtn} onClick={onRestart}>처음부터 다시</button>
        <button type="button" style={btn} onClick={onClose}>닫기</button>
      </div>
    </div>
  )
}

// 지난번 기록과 비교 (같은 계정·브라우저의 바로 전 타로)
function LastTime({ record, r }) {
  if (record.status === 'saving') return null
  const last = record.last
  if (!last) {
    return <div style={lastBox}>📒 첫 커플 타로예요! 다음에 다시 보면 오늘과 비교해 드릴게요.</div>
  }
  const before = last.detail?.match
  const diff = typeof before === 'number' ? r.match - before : null
  const lastNext = cardById(last.cards?.[last.cards.length - 1])
  const day = (last.createdAt || '').slice(5, 10).replace('-', '/')
  return (
    <div style={lastBox}>
      <div style={{ fontSize: 12, color: '#e7c35a', fontWeight: 700 }}>📒 지난번 타로와 비교 ({day})</div>
      {diff !== null && (
        <div>
          일치도 {before}% → <b>{r.match}%</b>{' '}
          {diff > 0 ? `▲${diff} 서로 더 알게 됐어요!` : diff < 0 ? `▼${-diff} 새로 알게 된 게 생겼어요` : '그대로예요'}
        </div>
      )}
      {lastNext && <div style={{ opacity: 0.85 }}>지난번 '다음 데이트' 카드: {lastNext.emoji} {lastNext.name} → 오늘: {r.cards[2].emoji} {r.cards[2].name}</div>}
    </div>
  )
}

const FLIP_CSS = `
@keyframes bkTarotFlip { from { transform: perspective(600px) rotateY(90deg); opacity: 0.3 } to { transform: perspective(600px) rotateY(0deg); opacity: 1 } }
.bk-tarot-flip { animation: bkTarotFlip 0.45s ease-out; transform-origin: center; }
.bk-tarot-back { transition: transform 0.15s; }
.bk-tarot-back:hover { transform: translateY(-2px); }
`

// 미션 장소를 루미 코스 안내와 같은 방식으로 미니맵에 표시 (도착하면 자동으로 완료)
// 타로 코스(없으면 미션 장소 하나)를 루미 코스 안내와 같은 방식으로 미니맵에 표시 → 도착할 때마다 다음 장소, 끝까지 가면 배지
function goCourse(r, onClose) {
  const stops = r.course?.length ? r.course : [r.mission]
  useCourseStore.getState().setCourse(stops, { tarot: r.mission?.cardId ?? 'course' })
  onClose()
}

// ── 같이 보기 (멀티 접속: 각자 폰으로 A·B) ─────────────────────────
// 첫 화면 아래: 지금 접속 중인 사람 목록 → 1명 [초대]. 멀티 접속이 꺼져 있으면(혼자·mock 모드) 안 보임
function Together() {
  const spot = useBkActivity((s) => s.tarot.spot)
  const { outgoing, notice } = useTarotRoom()
  const [people, setPeople] = useState(() => onlinePeers(spot))
  useEffect(() => {
    const timer = setInterval(() => setPeople(onlinePeers(spot)), 1000) // 위치는 1초에 10번 바뀌어서 1초마다만 다시 봄
    return () => clearInterval(timer)
  }, [spot])
  if (!people.length && !outgoing && !notice) return null
  return (
    <div style={togetherBox}>
      <div style={{ fontSize: 12, color: '#e7c35a', fontWeight: 700 }}>👥 2인으로 같이 보기 · 지금 접속 중 {people.length}명</div>
      {notice && <div style={{ fontSize: 12, margin: '4px 0', color: '#fbcfe8' }}>{notice}</div>}
      {outgoing ? (
        <div style={{ fontSize: 13, marginTop: 4 }}>
          💌 {outgoing.to.name}님에게 초대를 보냈어요. 기다리는 중… ·{' '}
          <button type="button" style={linkBtn} onClick={() => tarotRoom.leave()}>취소</button>
        </div>
      ) : (
        people.map((p) => (
          <div key={p.id} style={peerRow}>
            <span>
              {p.name}
              {Number.isFinite(p.dist) && <span style={{ opacity: 0.6, fontSize: 11 }}> · {p.dist < 15 ? '텐트 앞' : `${Math.round(p.dist)}m`}</span>}
            </span>
            <button type="button" style={{ ...btn, padding: '4px 12px', fontSize: 12 }} onClick={() => tarotRoom.invite(p.id)}>같이 보자고 초대</button>
          </div>
        ))
      )}
      <div style={{ fontSize: 11, opacity: 0.7, marginTop: 4 }}>한 명을 초대해서 수락하면, 두 사람 화면에 타로가 열려 각자 답하고 같은 카드가 펼쳐져요.</div>
    </div>
  )
}

// 같이 보기 진행: 내 10문항 → 상대 기다리기 → 결과 (각자 계정에 기록)
function MultiSession({ onClose }) {
  const { room, phase, partnerDone, result, notice } = useTarotRoom()
  const [qi, setQi] = useState(0)
  const [answers, setAnswers] = useState(() => QUESTIONS.map(() => ({ self: null, guess: null })))
  const mine = PEOPLE[room.role === 'a' ? 0 : 1]
  const theirs = PEOPLE[room.role === 'a' ? 1 : 0]
  const partner = room.partner.name

  if (phase === 'result' && result) return <TarotSpread r={result} onRestart={() => tarotRoom.leave()} onClose={onClose} />

  if (phase === 'waiting' || phase === 'failed') {
    return (
      <div style={panel}>
        <div style={{ fontSize: 34, textAlign: 'center' }}>{phase === 'failed' ? '🌫️' : partnerDone ? '🔮' : '⏳'}</div>
        <div style={title}>{phase === 'failed' ? '카드를 펼치지 못했어요' : partnerDone ? '카드를 섞고 있어요…' : `${partner}님이 답하는 중이에요`}</div>
        <p style={{ ...para, textAlign: 'center', opacity: 0.85 }}>
          {phase === 'failed' ? notice : partnerDone ? '두 사람 답을 비교해서 카드 3장을 고르는 중이에요.' : '다 답하면 두 화면에 같은 카드가 펼쳐져요. 상대 답은 서로 볼 수 없어요 🙈'}
        </p>
        <div style={row}>
          <button type="button" style={ghostBtn} onClick={onClose}>그만두기</button>
          {phase === 'failed' && <button type="button" style={btn} onClick={() => tarotRoom.retry()}>다시 시도</button>}
        </div>
      </div>
    )
  }

  const q = QUESTIONS[qi]
  const a = answers[qi]
  const pick = (part, index) => setAnswers(answers.map((x, i) => (i === qi ? { ...x, [part]: index } : x)))
  const ready = a.self !== null && a.guess !== null
  const next = () => {
    if (qi < QUESTIONS.length - 1) return setQi(qi + 1)
    tarotRoom.submit(answers.map((x) => x.self), answers.map((x) => x.guess))
  }
  return (
    <div style={panel}>
      <div style={topRow}>
        <span style={{ ...badge, background: mine.color }}>{mine.emoji} {room.me.name}님 (나)</span>
        <span style={{ opacity: 0.8 }}>{partnerDone ? `✅ ${partner}님 완료 · ` : ''}{qi + 1} / {QUESTIONS.length}</span>
      </div>
      <div style={bar}><div style={{ ...barFill, width: `${((qi + (ready ? 1 : 0)) / QUESTIONS.length) * 100}%`, background: mine.color }} /></div>

      <div style={qLabel}>나는?</div>
      <div style={qText}>{q.self}</div>
      <Options options={q.options} value={a.self} color={mine.color} onPick={(i) => pick('self', i)} />

      <div style={{ ...qLabel, marginTop: 12 }}>{partner}님은 뭐라고 할까?</div>
      <div style={qText}>{q.guess.replaceAll('{partner}', partner)}</div>
      <Options options={q.options} value={a.guess} color={theirs.color} onPick={(i) => pick('guess', i)} />

      <div style={row}>
        <button type="button" style={ghostBtn} disabled={qi === 0} onClick={() => setQi(qi - 1)}>← 이전</button>
        <button type="button" style={{ ...btn, opacity: ready ? 1 : 0.45, cursor: ready ? 'pointer' : 'default' }} disabled={!ready} onClick={next}>
          {qi < QUESTIONS.length - 1 ? '다음 →' : '다 했어요! 💌'}
        </button>
      </div>
    </div>
  )
}

function Options({ options, value, color, onPick }) {
  return (
    <div style={grid}>
      {options.map((text, i) => {
        const on = value === i
        return (
          <button key={text} type="button" onClick={() => onPick(i)} style={{ ...opt, ...(on ? { background: color, color: '#2a1d47', borderColor: color, fontWeight: 700 } : null) }}>
            {text}
          </button>
        )
      })}
    </div>
  )
}

// 별명 칸에 글자를 칠 때 게임 단축키(E 등)가 같이 눌리지 않게. ESC는 그대로 보내서 화면 닫기가 되게 함
function keepKeysHere(event) {
  if (event.key !== 'Escape') event.stopPropagation()
}

const panel = { pointerEvents: 'auto', width: 'min(380px, calc(100vw - 32px))', maxHeight: 'calc(100vh - 150px)', marginTop: 40, overflowY: 'auto', padding: '16px 18px', borderRadius: 14, background: 'rgba(36,24,64,0.94)', color: '#fff', fontSize: 14, boxShadow: '0 8px 30px rgba(0,0,0,0.35)', border: '1px solid rgba(231,195,90,0.5)', boxSizing: 'border-box' }
const title = { fontWeight: 700, fontSize: 18, textAlign: 'center', margin: '4px 0 10px' }
const para = { margin: '0 0 8px', lineHeight: 1.5 }
const nameRow = { display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }
const dot = { width: 28, height: 28, borderRadius: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }
const input = { flex: 1, minWidth: 0, padding: '7px 10px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.25)', background: 'rgba(255,255,255,0.08)', color: '#fff', fontSize: 14, outline: 'none' }
const row = { display: 'flex', justifyContent: 'center', gap: 8, marginTop: 14 }
const topRow = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13 }
const badge = { padding: '3px 10px', borderRadius: 999, color: '#2a1d47', fontWeight: 700 }
const bar = { height: 4, borderRadius: 999, background: 'rgba(255,255,255,0.15)', margin: '8px 0 12px', overflow: 'hidden' }
const barFill = { height: '100%', borderRadius: 999, transition: 'width 0.2s' }
const qLabel = { fontSize: 12, color: '#e7c35a', fontWeight: 700 }
const qText = { fontSize: 15, fontWeight: 700, margin: '2px 0 8px', lineHeight: 1.4 }
const grid = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }
const opt = { padding: '8px 6px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.25)', background: 'rgba(255,255,255,0.06)', color: '#fff', fontSize: 13, cursor: 'pointer', lineHeight: 1.3 }
const note = { marginTop: 10, fontSize: 12, opacity: 0.7, textAlign: 'center' }
const btn = { padding: '7px 16px', borderRadius: 999, border: 'none', background: '#e7c35a', color: '#2a1d47', fontWeight: 700, cursor: 'pointer' }
const ghostBtn = { padding: '7px 14px', borderRadius: 999, border: '1px solid rgba(255,255,255,0.3)', background: 'transparent', color: '#fff', cursor: 'pointer' }
const cardBox = { padding: '10px 12px', borderRadius: 12, background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(231,195,90,0.3)', marginTop: 8 }
const cardHead = { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }
const revTag = { marginLeft: 6, padding: '1px 6px', borderRadius: 999, background: 'rgba(147,197,253,0.25)', fontSize: 10 }
const advice = { marginTop: 6, padding: '6px 8px', borderRadius: 8, background: 'rgba(231,195,90,0.12)', fontSize: 13, lineHeight: 1.5 }
const talkBox = { marginTop: 4, padding: '6px 10px', borderRadius: 8, background: 'rgba(255,255,255,0.08)', fontSize: 13 }
const cardBack = { width: '100%', marginTop: 8, padding: '12px', borderRadius: 12, border: '1px solid rgba(231,195,90,0.6)', background: 'linear-gradient(135deg, #4c1d95, #7c3aed 55%, #4c1d95)', color: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, cursor: 'pointer' }
const linkBtn = { padding: 0, border: 'none', background: 'none', color: '#e7c35a', textDecoration: 'underline', cursor: 'pointer', fontSize: 12 }
const lastBox = { marginTop: 10, padding: '8px 12px', borderRadius: 12, background: 'rgba(147,197,253,0.12)', border: '1px solid rgba(147,197,253,0.4)', fontSize: 13, lineHeight: 1.5 }
const themeTag = { display: 'inline-block', marginRight: 6, padding: '0 6px', borderRadius: 999, background: 'rgba(249,168,212,0.25)', fontSize: 11, fontWeight: 700 }
const togetherBox = { marginTop: 12, padding: '8px 12px', borderRadius: 12, background: 'rgba(147,197,253,0.12)', border: '1px solid rgba(147,197,253,0.45)' }
const peerRow = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6, fontSize: 13 }
const missionTag = { marginLeft: 6, padding: '0 6px', borderRadius: 999, background: '#e7c35a', color: '#2a1d47', fontSize: 10, fontWeight: 800 }
const missionBox = { marginTop: 10, padding: '10px 12px', borderRadius: 12, background: 'rgba(231,195,90,0.14)', border: '1px solid rgba(231,195,90,0.55)', fontSize: 13 }
const kbd = { padding: '0 5px', borderRadius: 4, background: '#fff', color: '#111', fontSize: 11, fontWeight: 700 }
