import { useEffect, useRef, useState } from 'react'
import { Modal } from '../movieZone/common.jsx'
import { BADGES, useBadges } from '../../store/badges.js'
import './badge-book.css'

// 배지함 (담당: 병관) — 오른쪽 위 [🏅 배지함] 버튼 → 받은 배지와 받는 방법
// 창 모양은 스탬프북·쿠폰함과 같은 공통 Modal (혜진님 common.jsx)을 그대로 씀

export function BadgeButton({ onOpen }) {
  const earned = useBadges((s) => s.earned)
  const kinds = BADGES.filter((b) => earned.some((e) => e.id === b.id)).length
  // 새 배지를 받으면 버튼이 잠깐 반짝임
  const [fresh, setFresh] = useState(false)
  const count = useRef(earned.length)
  useEffect(() => {
    if (earned.length > count.current) {
      setFresh(true)
      const id = setTimeout(() => setFresh(false), 2400)
      count.current = earned.length
      return () => clearTimeout(id)
    }
    count.current = earned.length
    return undefined
  }, [earned.length])

  return (
    <button type="button" className={`ui-btn${fresh ? ' bb-fresh' : ''}`} onClick={(e) => (e.currentTarget.blur(), onOpen())}>
      🏅 배지함 {kinds > 0 && <span className="ui-count">{kinds}</span>}
    </button>
  )
}

export default function BadgeBook({ onClose }) {
  const earned = useBadges((s) => s.earned)
  const kinds = BADGES.filter((b) => earned.some((e) => e.id === b.id)).length

  return (
    <Modal title="🏅 배지함" onClose={onClose} labelledBy="ui-badgebook-title">
      <div className="bb-summary">
        <strong>
          {kinds} / {BADGES.length} 획득
        </strong>
        <span>{kinds === BADGES.length ? '모든 배지를 모았어요! 🎉' : '루미의 코스를 완주하면 배지를 받아요'}</span>
      </div>
      <div className="ui-progress" role="progressbar" aria-valuemin={0} aria-valuemax={BADGES.length} aria-valuenow={kinds}>
        <span style={{ width: `${(kinds / BADGES.length) * 100}%` }} />
      </div>

      <ul className="bb-grid">
        {BADGES.map((badge) => {
          const mine = earned.filter((e) => e.id === badge.id)
          const on = mine.length > 0
          return (
            <li key={badge.id} className={`bb-card${on ? ' is-on' : ''}`}>
              <span className="bb-card__icon" aria-hidden="true">
                {badge.icon}
              </span>
              <strong className="bb-card__name">{badge.name}</strong>
              <span className="bb-card__desc">{badge.desc}</span>
              <span className="bb-card__state">
                {on ? (mine.length > 1 ? `${mine.length}번 받음 · 처음 ${formatDay(mine[0].at)}` : `${formatDay(mine[0].at)} 획득`) : '아직 없어요'}
              </span>
            </li>
          )
        })}
      </ul>
      <p className="bb-note">배지는 이 브라우저에 저장돼요. 오늘의 코스 배지는 날마다 하나씩 쌓여요.</p>
    </Modal>
  )
}

function formatDay(iso) {
  if (!iso) return ''
  const [, m, d] = iso.split('-')
  return `${Number(m)}/${Number(d)}`
}
