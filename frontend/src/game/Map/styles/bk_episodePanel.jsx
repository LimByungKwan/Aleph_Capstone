// (담당: 병관) 이번 주 데이트 에피소드 선택, 이어 하기, 엔딩 엽서
import { useEffect, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useRealtimeStore } from '../../multiplayer/realtimeStore.js'
import { DATE_EPISODES, EMPTY_EPISODE_BOOK, featuredDateEpisode, getDateEpisode } from './bk_dateEpisodes.js'
import { getMission, useDateMission } from './bk_dateMission.js'
import { episodeRoom, useEpisodeRoom } from './bk_episodeRoom.js'

export function EpisodePanel({ book = EMPTY_EPISODE_BOOK, onClose }) {
  const featured = featuredDateEpisode()
  const [selected, setSelected] = useState(book.currentId ?? featured.id)
  const [friend, setFriend] = useState('')
  const online = useRealtimeStore((s) => s.status === 'online')
  const friends = useRealtimeStore(useShallow((s) => Object.fromEntries(Object.values(s.peers).map((p) => [p.id, p.name]))))
  const { invite, outgoing, room, notice, submittedStep } = useEpisodeRoom(useShallow((s) => ({
    invite: s.invite, outgoing: s.outgoing, room: s.room, notice: s.notice, submittedStep: s.submittedStep,
  })))
  const waiting = invite || outgoing
  const sharedId = room?.episodeId ?? waiting?.episodeId
  const episode = getDateEpisode(sharedId ?? selected) ?? featured
  const run = book.runs[episode.id]
  const postcard = book.postcards[episode.id]
  const stepIndex = room?.step ?? run?.step ?? 0
  const next = (room || run) && episode.steps[stepIndex]
  const ready = !room && !waiting && run?.step === episode.steps.length
  const active = book.currentId === episode.id
  const showingGuide = useDateMission((s) => s.episodeGuide !== null)

  useEffect(() => {
    if (sharedId) setSelected(sharedId)
  }, [sharedId])

  const begin = () => useDateMission.getState().startEpisode(episode.id)
  const guide = () => {
    if (!room) begin()
    useDateMission.getState().showEpisodeGuide()
    onClose()
  }

  return (
    <div className="special-dialog__body date-episode-panel">
      {!room && !waiting && (
        <div className="special-actions" aria-label="에피소드 선택">
          {DATE_EPISODES.map((item) => (
            <button type="button" key={item.id} className="ui-btn" aria-pressed={item.id === episode.id} onClick={() => setSelected(item.id)}>
              {item.id === featured.id ? '이번 주 · ' : ''}{item.title}
            </button>
          ))}
        </div>
      )}
      {(room || waiting) && <h3>{episode.title}</h3>}
      <p className="special-intro">{episode.intro}</p>
      {notice && <p role="status">{notice}</p>}
      {room && (
        <section className="special-narration">
          <h3>{room.partner} · 함께 걷는 중</h3>
          <p role="status">나 {room.ready || submittedStep === room.step ? '✓ 완료' : '○ 진행 중'} · 친구 {room.partnerReady ? '✓ 완료' : '○ 진행 중'}</p>
          <p className="special-visit">두 사람이 모두 체험을 마치면 다음 장소가 열려요.</p>
        </section>
      )}
      {invite && (
        <section className="special-narration">
          <h3>{invite.partner} · 데이트 초대</h3>
          <div className="special-actions">
            <button type="button" className="ui-btn ui-btn--primary" onClick={() => episodeRoom.respond(true)}>수락</button>
            <button type="button" className="ui-btn" onClick={() => episodeRoom.respond(false)}>거절</button>
          </div>
        </section>
      )}
      {outgoing && <p role="status">{outgoing.partner} · 초대 응답을 기다리는 중이에요.</p>}
      <ol className="date-episode-steps">
        {episode.steps.map((step, index) => (
          <li key={step.id}>
            <strong>{index < stepIndex ? '✓ ' : ''}{getMission(step.id).short}</strong>
            <p>{step.text}</p>
          </li>
        ))}
      </ol>
      {next && !waiting && (
        <div className="special-actions">
          <button type="button" className="ui-btn ui-btn--primary" onClick={guide}>
            {room ? '함께 걷기' : active ? '이어서 하기' : '이 편 이어 하기'} · {getMission(next.id).short} 길 안내
          </button>
          {showingGuide && <button type="button" className="ui-btn" onClick={() => useDateMission.getState().showEpisodeGuide(false)}>길 안내 끄기</button>}
        </div>
      )}
      {!room && !waiting && !run && (
        <div className="special-actions">
          <button type="button" className="ui-btn ui-btn--primary" onClick={guide}>{postcard ? '다시 걷기' : '에피소드 시작'}</button>
        </div>
      )}
      {online && !room && !waiting && Object.keys(friends).length > 0 && (
        <section className="special-narration">
          <h3>친구와 함께 걷기</h3>
          <div className="special-actions">
            <select className="date-episode-friends" aria-label="초대할 친구" value={friend} onChange={(event) => setFriend(event.target.value)}>
              <option value="">친구 선택</option>
              {Object.entries(friends).map(([id, name]) => <option key={id} value={id}>{name}</option>)}
            </select>
            <button type="button" className="ui-btn" disabled={!friends[friend]} onClick={() => episodeRoom.invite(episode.id, friend)}>초대 보내기</button>
          </div>
        </section>
      )}
      {(room || outgoing) && (
        <div className="special-actions">
          <button type="button" className="ui-btn" onClick={episodeRoom.leave}>{room ? '함께 걷기 끝내기' : '초대 취소'}</button>
        </div>
      )}
      {ready && (
        <section className="special-narration">
          <h3>엽서에 남길 마지막 대사</h3>
          {run.order && <p>{run.order.drink} · {run.order.dessert}</p>}
          <div className="special-actions">
            {episode.lines.map((line) => (
              <button type="button" key={line} className="ui-btn" onClick={() => useDateMission.getState().savePostcard(episode.id, line)}>
                {line}
              </button>
            ))}
          </div>
        </section>
      )}
      {postcard && (
        <article className="date-episode-postcard" aria-label="저장된 엔딩 엽서" aria-live="polite">
          <h3>엔딩 엽서 · {episode.title}</h3>
          <p>“{postcard.line}”</p>
          {postcard.order && <p>{postcard.order.drink} · {postcard.order.dessert}</p>}
        </article>
      )}
    </div>
  )
}
