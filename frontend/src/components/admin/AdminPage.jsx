import { getAdminStats } from '../../api/client.js'
import { zones } from '../../game/data/mapData.js'
import { useUiStore } from '../movieZone/uiStore.js'
import { LoadingBlock, errorText, useAsync } from '../movieZone/common.jsx'
import { PageShell, RoleGate, Stat } from '../boss/PageShell.jsx'

// [성근] 관리자 화면 (#/admin): 접속자·스탬프·쿠폰 현황
// 그래프는 라이브러리 없이 ui.css의 .ui-bars / .ui-hbars를 씀. 구역 이름·색은 zones/*.json에서 가져옴
const HUB = { name: '중앙 광장', color: 'var(--ui-accent)' }
const zoneInfo = (zoneId) => zones.find((z) => z.zoneId === zoneId) ?? HUB

export default function AdminPage() {
  return (
    <PageShell title="관리자 화면">
      <RoleGate role="admin">
        <h1>운영 현황</h1>
        <p className="ui-sub">접속 · 스탬프 · 쿠폰 통계 (시연용 가짜 DB 기준)</p>
        <AdminStats />
      </RoleGate>
    </PageShell>
  )
}

// RoleGate 안에 따로 둬서 관리자가 아니면 통계 API를 부르지 않음
function AdminStats() {
  const adminId = useUiStore((s) => s.userId)
  const { data, loading, error, reload } = useAsync(() => getAdminStats({ adminId }), [adminId])
  if (loading && !data) return <LoadingBlock rows={3} />
  if (error)
    return (
      <div className="ui-alert ui-alert--error">
        {errorText(error)}{' '}
        <button type="button" className="ui-btn" onClick={reload}>
          다시 불러오기
        </button>
      </div>
    )

  const rate = data.couponsIssued ? Math.round((data.couponsUsed / data.couponsIssued) * 100) : 0
  const maxDay = Math.max(1, ...data.dailyVisitors.map((d) => d.count))
  const maxZone = Math.max(1, ...data.stampsByZone.map((z) => z.count))

  return (
    <>
      <div className="ui-stats">
        <Stat label="오늘 접속자" value={data.todayVisitors} />
        <Stat label="누적 스탬프" value={data.totalStamps} />
        <Stat label="쿠폰 발급" value={data.couponsIssued} />
        <Stat label="쿠폰 사용률" value={`${rate}%`} />
      </div>

      <div className="ui-card">
        <h2>최근 7일 접속자</h2>
        <div className="ui-bars" role="img" aria-label={data.dailyVisitors.map((d) => `${d.day} ${d.count}명`).join(', ')}>
          {data.dailyVisitors.map((d, i) => (
            <div key={d.day} className={i === 6 ? 'ui-bar ui-bar--today' : 'ui-bar'}>
              <span className="ui-bar__value">{d.count}</span>
              {/* 숫자·날짜 글자 자리(약 40px)를 빼고 남은 높이 안에서 비율로 */}
              <span className="ui-bar__fill" style={{ height: `calc((100% - 40px) * ${d.count / maxDay})` }} />
              <span>{i === 6 ? '오늘' : d.day.slice(5).replace('-', '/')}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="ui-grid-2">
        <div className="ui-card">
          <h2>구역별 스탬프</h2>
          {data.stampsByZone.length === 0 ? (
            <div className="ui-empty">아직 찍힌 스탬프가 없어요.</div>
          ) : (
            <div className="ui-hbars">
              {data.stampsByZone.map((z) => {
                const info = zoneInfo(z.zone)
                return (
                  <div key={z.zone} className="ui-hbar">
                    <span>{info.name}</span>
                    <span className="ui-hbar__track">
                      <span style={{ width: `${(z.count / maxZone) * 100}%`, background: info.color }} />
                    </span>
                    <b>{z.count}</b>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="ui-card">
          <h2>인기 장소 TOP 5</h2>
          {data.topPlaces.length === 0 ? (
            <div className="ui-empty">아직 찍힌 스탬프가 없어요.</div>
          ) : (
            <table className="ui-table">
              <thead>
                <tr>
                  <th>순위</th>
                  <th>장소</th>
                  <th>구역</th>
                  <th>스탬프</th>
                </tr>
              </thead>
              <tbody>
                {data.topPlaces.map((p, i) => (
                  <tr key={p.placeId}>
                    <td>{i + 1}</td>
                    <td>{p.name}</td>
                    <td>{zoneInfo(p.zone).name}</td>
                    <td>{p.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  )
}
