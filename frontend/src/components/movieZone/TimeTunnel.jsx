import { useTimeTravel } from './timeTravel.js'

// [3. 개발 > 프론트엔드] 시간 터널 화면 (혜진 영화·드라마 구역)
// 시간 열차가 터널에 들어가면: 화면이 어두워지며 빛 고리가 빨려 들어가고 연도가 바뀌어요 → 다른 세상 승강장에서 밝아져요.
// 그동안 캐릭터는 열차 자리에 앉은 채 옮겨져요 (palaceSeating.js + timeTravel.js)
const TEXT = {
  toSeoul: { from: '1930', to: '2026', title: '북악산 터널을 지나는 중…', sub: '시간 열차가 현대 서울로 달려가요' },
  toGyeongseong: { from: '2026', to: '1930', title: '시간 터널을 거슬러 가는 중…', sub: '시간 열차가 1930 경성역으로 돌아가요' },
  toAnime: { from: '경성', to: '애니', title: '🌊 바다 위를 달리는 중…', sub: '환승 열차가 바다를 건너 애니메이션 구역으로 가요' },
  fromAnime: { from: '애니', to: '경성', title: '🌊 바다를 건너 돌아가는 중…', sub: '경성 바다 환승역으로 돌아가요' },
}

export default function TimeTunnel() {
  const kind = useTimeTravel((s) => s.kind)
  const startedAt = useTimeTravel((s) => s.startedAt)
  const text = TEXT[kind]
  if (!text) return null
  return (
    <div key={startedAt} className="hj-tunnel" role="status" aria-live="polite">
      <div className="hj-tunnel__rings" aria-hidden="true">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <span key={i} style={{ animationDelay: `${i * 0.22}s` }} />
        ))}
      </div>
      <div className="hj-tunnel__text">
        <p className="hj-tunnel__title">🚂 {text.title}</p>
        <p className="hj-tunnel__years">
          <span className="hj-tunnel__from">{text.from}</span>
          <span aria-hidden="true">→</span>
          <span className="hj-tunnel__to">{text.to}</span>
        </p>
        <p className="hj-tunnel__sub">{text.sub}</p>
      </div>
    </div>
  )
}
