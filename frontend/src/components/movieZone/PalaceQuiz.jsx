import { useEffect, useState } from 'react'
import { palaceQuestions } from './palaceQuestions.js'

import evidence from '../../data/palaceEvidence.json'
import { requestPalaceEpisode } from '../../api/course.js'

const storageKey = 'scenewalk.hj.palaceQuiz.v1'
export function readQuizProgress() {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey))
    return Array.isArray(saved) ? [...new Set(saved.filter(id => Object.hasOwn(palaceQuestions, id)))] : []
  } catch {
    return []
  }
}

export function PalaceQuiz({ stop, solved, onSolve, onClose, onGuide }) {
  const [choice, setChoice] = useState(null)
  const topics = evidence.filter(doc => doc.spot === stop.id)
  const [topic, setTopic] = useState(topics[0])
  const [lesson, setLesson] = useState(null)
  const [playing, setPlaying] = useState(false)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    let active = true
    requestPalaceEpisode(stop.id, topic.title).then(result => {
      if (active && result.evidenceId === topic.id && result.quiz?.choices?.length === 3) setLesson(result)
    }).catch(() => {
      // 로컬 자료 해설과 확인 문제는 AI 서버가 쉬는 동안에도 이용 가능하다.
    }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [stop.id, topic])
  const [attempt, setAttempt] = useState(null)
  function chooseTopic(doc) {
    if (doc.id === topic.id) return
    setTopic(doc)
    setLesson(null)
    setLoading(true)
    setPlaying(false)
    setChoice(null)
  }
  function startQuiz() {
    // 요청이 늦게 도착해도 이미 풀고 있는 문제는 바뀌지 않는다.
    const choices = [...topic.distractors]
    const answer = [...topic.id].reduce((sum,ch) => sum + ch.codePointAt(0), 0) % 3
    choices.splice(answer, 0, topic.answer)
    const sentence = topic.text.split('. ').find(line => line.includes(topic.answer))
    setAttempt(lesson?.quiz ?? {
      question: '해설 속 빈칸에 들어갈 말은 무엇일까요? ' + sentence.replace(topic.answer, '〔　〕'),
      choices, answer, explanation: topic.text, hint: '해설로 돌아가서 단서를 다시 찾아보세요.',
    })
    setChoice(null)
    setPlaying(true)
  }
  const quiz = attempt
  const correct = playing && choice === quiz?.answer
  function choose(index) {
    setChoice(index)
    if (index !== quiz.answer || solved.includes(stop.id)) return
    const next = [...new Set([...readQuizProgress(), ...solved, stop.id])]
    onSolve(next)
    try { localStorage.setItem(storageKey, JSON.stringify(next)) } catch { /* Keep progress for this visit. */ }
  }
  return (
    <section className="rk-panel rk-guide ui-interactive" role="dialog" aria-label={stop.name + ' 역사 퀴즈'}>
      <div className="rk-guide-head">
        <p className="rk-say"><span className="rk-who">{playing ? '역사 퀴즈' : '경복궁 해설사'}</span>{stop.name}</p>
        <button className="rk-close" onClick={onClose} aria-label="퀴즈 닫기" autoFocus>✕</button>
      </div>
      {!playing && <>
        <p className="rk-sub">이곳에서 어떤 이야기를 들어 볼까요?</p>
        <div className="rk-quiz-choices">{topics.map(doc => <button type="button" key={doc.id}
          aria-pressed={topic.id === doc.id} className="rk-choice" onClick={() => chooseTopic(doc)}>{doc.title}</button>)}</div>
        <p className="rk-sub" aria-live="polite">{lesson?.mode === 'ai' ? 'AI 역사 해설' : loading ? '자료 해설 · AI 서버 연결 중' : '공식 자료 해설'}</p>
        <p>{lesson?.narration || topic.text}</p>
        <button className="rk-choice" onClick={startQuiz}>이 이야기로 퀴즈 풀기</button>
      </>}
      {playing && <>
      <h3>{quiz.question}</h3>
      <div className="rk-quiz-choices">
        {quiz.choices.map((text,i) => <button key={text} className="rk-choice"
          disabled={correct} aria-pressed={choice === i} onClick={() => choose(i)}>
          <kbd>{i+1}</kbd>{text}
        </button>)}
      </div>
      <p aria-live="polite">{choice === null ? '' : correct ? '정답이에요! ' + quiz.explanation : '다시 골라 보세요. ' + quiz.hint}</p>
      <button className="rk-choice" onClick={() => setPlaying(false)}>해설 다시 보기</button>
      </>}
      <p><a style={{color:'inherit'}} href={topic.url} target="_blank" rel="noreferrer">{topic.source} ↗</a></p>
      <p className="rk-sub">{solved.length === 4 ? '네 곳의 역사 퀴즈를 모두 풀었어요!' : '경복궁 역사 퀴즈 · ' + solved.length + ' / 4곳 완료'}</p>
      {correct && <button className="rk-choice" onClick={onGuide}>관람 안내판으로</button>}
    </section>
  )
}
