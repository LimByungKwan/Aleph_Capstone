// (담당: 병관) 카페와 벽화에서 서로 다른 단서를 읽어 골목 편지를 푸는 화면
import { useEffect, useState } from 'react'
import { LETTER_COLORS, LETTER_ENDINGS, LETTER_STATIONS, LETTER_STATION_RADIUS, LETTER_SYMBOLS, LETTER_TITLE } from '@shared/bk_letterPuzzle.js'
import { useUiStore } from '../../../components/movieZone/uiStore.js'
import { playerPose } from '../../../store/playerPose.js'
import { getMission, useDateMission } from './bk_dateMission.js'
import { episodeRoom, useEpisodeRoom } from './bk_episodeRoom.js'
import { useWarps } from './bk_warpStore.js'

function Clue({ role, data, title }) {
  return (
    <section className="date-letter-clue">
      <h3>{title}</h3>
      {role === 'sequence' ? (
        <ol className="date-letter-sequence" aria-label="그림 순서">
          {data.map((symbol) => <li key={symbol}><span aria-hidden="true">{LETTER_SYMBOLS[symbol].icon}</span>{LETTER_SYMBOLS[symbol].label}</li>)}
        </ol>
      ) : (
        <dl className="date-letter-key" aria-label="그림과 연결된 색">
          {Object.entries(data).map(([symbol, color]) => (
            <div key={symbol}>
              <dt><span aria-hidden="true">{LETTER_SYMBOLS[symbol].icon}</span> {LETTER_SYMBOLS[symbol].label}</dt>
              <dd className="date-letter-color" style={{ '--letter-color': LETTER_COLORS[color].swatch }}>{LETTER_COLORS[color].label}</dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  )
}

function ColorAnswer({ sequence, attempts }) {
  const [colors, setColors] = useState(() => sequence.map(() => ''))
  const [reviewedAttempts, setReviewedAttempts] = useState(attempts)
  const allSelected = colors.every(Boolean)
  const canSubmit = allSelected && new Set(colors).size === sequence.length
  const wrong = attempts > reviewedAttempts

  const chooseColor = (index, color) => {
    setColors((previous) => previous.map((value, i) => i === index ? color : value))
    setReviewedAttempts(attempts)
  }
  return (
    <section className="special-narration">
      <h3>편지 봉인의 색 순서</h3>
      <p>각 그림 아래에서 벽화 단서에 적힌 색을 고르세요.</p>
      <ol className="date-letter-sequence" aria-label="입력한 색 순서">
        {sequence.map((symbol, index) => (
          <li key={symbol}>
            <label className="date-letter-slot">
              <span>{index + 1}. <span aria-hidden="true">{LETTER_SYMBOLS[symbol].icon} </span>{LETTER_SYMBOLS[symbol].label}</span>
              <select value={colors[index]} onChange={(event) => chooseColor(index, event.target.value)}>
                <option value="">색 선택</option>
                {Object.entries(LETTER_COLORS).map(([key, color]) => <option key={key} value={key}>{color.label}</option>)}
              </select>
            </label>
          </li>
        ))}
      </ol>
      <p className="date-letter-retry" role="status">
        {wrong ? '색 순서가 달라요. 각 그림의 색을 확인하고 틀린 칸만 바꿔 보세요.' : allSelected && !canSubmit ? '세 칸에 서로 다른 색을 골라 주세요.' : ''}
      </p>
      <div className="special-actions">
        <button type="button" className="ui-btn ui-btn--primary" disabled={!canSubmit || wrong} onClick={() => episodeRoom.letterAction('guess', colors, attempts)}>편지 열기</button>
      </div>
    </section>
  )
}

function LetterPostcard({ ending }) {
  return (
    <article className="date-episode-postcard date-letter-postcard" aria-label="골목 편지 엽서">
      <h3>골목 끝에서 온 편지</h3>
      <p>{LETTER_ENDINGS[ending]}</p>
    </article>
  )
}

function LetterRound({ room, onClose }) {
  const { letter } = room
  const { role, clue, received, partnerRead, shared, solved } = letter
  const ready = Boolean(shared && received)
  const station = LETTER_STATIONS[role]
  const [atStation, setAtStation] = useState(false)
  const showAnswer = ready && role === 'palette' && atStation

  useEffect(() => {
    const check = () => {
      const [x, z] = station.point
      setAtStation(playerPose.ready && Math.hypot(playerPose.x - x, playerPose.z - z) <= LETTER_STATION_RADIUS)
    }
    check()
    const timer = setInterval(check, 250)
    return () => clearInterval(timer)
  }, [station])

  const go = (missionId, photo = false) => {
    const m = getMission(missionId)
    const stillInRound = () => useEpisodeRoom.getState().room?.letter?.roundId === letter.roundId
    const center = photo ? [m.center[0] + (role === 'sequence' ? -0.65 : 0.65), m.center[1]] : m.center
    onClose()
    useWarps.getState().goto({
      center, label: m.short, isValid: stillInRound,
      onArrive: () => stillInRound() && useDateMission.getState().openCard(photo ? 'mural' : 'episodes'),
    })
  }

  if (solved) return (
    <>
      <LetterPostcard ending={letter.ending} />
      <p role="status">두 사람의 엽서함에 편지를 넣었어요.</p>
      <div className="special-actions">
        <button type="button" className="ui-btn" onClick={() => go('mural', true)}>벽화에서 기념사진 찍기</button>
        <button type="button" className="ui-btn ui-btn--primary" disabled={letter.wantsReplay} onClick={() => episodeRoom.letterAction('replay')}>
          {letter.wantsReplay ? '친구 기다리는 중' : '역할 바꿔 다시 풀기'}
        </button>
      </div>
      {letter.partnerWantsReplay && !letter.wantsReplay && <p role="status">친구가 역할을 바꿔 다시 풀고 싶어 해요.</p>}
    </>
  )

  return (
    <>
      <section className="special-narration">
        <h3>{role === 'sequence' ? '내 역할 · 그림 순서' : '내 역할 · 그림과 색'}</h3>
        {!clue && <p>{station.title}에서 내 단서를 읽어요.</p>}
        <p className="special-visit date-letter-status" role="status">
          내 단서 {shared ? '✓ 보냄' : clue ? '읽음 · 보내기 필요' : '아직 읽기 전'}<br />
          친구 단서 {received ? '✓ 받음' : partnerRead ? '보내기를 기다리는 중' : '읽기를 기다리는 중'}
        </p>
        {!clue && (
          <div className="special-actions">
            {atStation
              ? <button type="button" className="ui-btn ui-btn--primary" onClick={() => episodeRoom.letterAction('read')}>내 단서 읽기</button>
              : <button type="button" className="ui-btn ui-btn--primary" onClick={() => go(station.mission)}>내 단서 장소로 이동</button>}
          </div>
        )}
      </section>
      {clue && (
        <>
          <Clue role={role} data={clue} title="내 단서" />
          <div className="special-actions">
            <button type="button" className="ui-btn" disabled={letter.shared} onClick={() => episodeRoom.letterAction('share')}>
              {letter.shared ? '단서를 보냈어요' : '친구에게 내 단서 보내기'}
            </button>
          </div>
        </>
      )}
      {received && !showAnswer && <Clue role={role === 'sequence' ? 'palette' : 'sequence'} data={received} title="친구가 보낸 단서" />}
      {ready && role === 'sequence' && <p>색 담당 친구가 벽화에서 편지의 봉인을 풀고 있어요.</p>}
      {ready && role === 'palette' && (showAnswer
        ? <ColorAnswer sequence={received} attempts={letter.attempts} />
        : <button type="button" className="ui-btn" onClick={() => go(station.mission)}>벽화 봉인으로 이동</button>)}
    </>
  )
}

export function LetterPanel({ room, online, onClose }) {
  const userId = useUiStore((s) => s.userId)
  const saved = useDateMission((s) => s.saved.accounts[userId]?.letterPostcard)
  return (
    <>
      <h3>{LETTER_TITLE}</h3>
      {!room?.letter && <p className="special-intro">카페의 컵 받침과 벽화의 타일에서 단서를 하나씩 찾아 서로 보내면 편지의 봉인을 풀 수 있어요.</p>}
      {room?.letter
        ? <LetterRound key={room.letter.roundId} room={room} onClose={onClose} />
        : <p>{online ? '접속한 친구를 초대하면 두 사람에게 서로 다른 역할이 주어져요.' : '멀티 서버에 연결되면 친구를 초대할 수 있어요.'}</p>}
      {!room && saved && <LetterPostcard ending={saved.ending} />}
    </>
  )
}
