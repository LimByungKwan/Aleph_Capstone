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

function ColorAnswer() {
  const [colors, setColors] = useState([])
  return (
    <section className="special-narration">
      <h3>편지 봉인의 색 순서</h3>
      <p>친구가 알려 준 그림 순서를 벽화의 색으로 바꿔 보세요.</p>
      <ol className="date-letter-sequence" aria-label="입력한 색 순서" aria-live="polite">
        {[0, 1, 2].map((index) => {
          const color = LETTER_COLORS[colors[index]]
          return <li key={index} className="date-letter-color" style={{ '--letter-color': color?.swatch }}>{color?.label ?? `${index + 1}번째`}</li>
        })}
      </ol>
      <div className="special-actions">
        {Object.entries(LETTER_COLORS).map(([key, color]) => (
          <button key={key} type="button" className="ui-btn date-letter-color" style={{ '--letter-color': color.swatch }}
            disabled={colors.includes(key)} onClick={() => setColors((previous) => previous.includes(key) ? previous : [...previous, key])}>{color.label}</button>
        ))}
        <button type="button" className="ui-btn" disabled={!colors.length} onClick={() => setColors((previous) => previous.slice(0, -1))}>한 칸 지우기</button>
        <button type="button" className="ui-btn ui-btn--primary" disabled={colors.length !== 3} onClick={() => episodeRoom.letterAction('guess', colors)}>편지 열기</button>
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
  const { role, clue, received, bothRead, partnerRead, solved } = letter
  const station = LETTER_STATIONS[role]
  const [atStation, setAtStation] = useState(false)

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
        <p>{station.title}에서 내 단서를 읽어요.</p>
        <p className="special-visit" role="status">내 단서 {clue ? '✓ 읽음' : '○ 아직'} · 친구 단서 {partnerRead ? '✓ 읽음' : '○ 아직'}</p>
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
      {received && <Clue role={role === 'sequence' ? 'palette' : 'sequence'} data={received} title="친구가 보낸 단서" />}
      {letter.attempts > 0 && <p className="date-letter-retry" role="status">순서가 달라요. 단서를 다시 보고 시도해 보세요.</p>}
      {bothRead && role === 'sequence' && <p>색 담당 친구가 벽화에서 편지의 봉인을 풀고 있어요.</p>}
      {bothRead && role === 'palette' && (atStation
        ? <ColorAnswer key={letter.attempts} />
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
      <p className="special-intro">카페의 컵 받침과 벽화의 타일에 단서가 하나씩 남아 있어요. 서로 알려 주고 골목 끝 편지의 봉인을 열어 보세요.</p>
      {room?.letter
        ? <LetterRound key={room.letter.roundId} room={room} onClose={onClose} />
        : <p>{online ? '접속한 친구를 초대하면 두 사람에게 서로 다른 역할이 주어져요.' : '멀티 서버에 연결되면 친구를 초대할 수 있어요.'}</p>}
      {!room && saved && <LetterPostcard ending={saved.ending} />}
    </>
  )
}
