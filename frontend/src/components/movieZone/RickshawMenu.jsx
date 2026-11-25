import { useEffect, useState } from 'react'
import { usePalaceSeatStore } from './palaceSeating.js'
import './rickshaw.css'

// [3. 개발 > 프론트엔드] 인력거 목적지 고르기 + 인력거꾼 말풍선 (혜진 영화·드라마 구역)
// 인력거에 앉으면 "어디까지 모실까요?" → 목적지 버튼 → 인력거가 그곳까지 달려가요 (HjRickshawRide.jsx).
// 숫자키 1~5로도 고를 수 있어요.
export default function RickshawMenu() {
  const seated = usePalaceSeatStore((s) => s.seated)
  const vehicle = seated?.vehicle?.destinations ? seated.vehicle : null
  const [, setTick] = useState(0)
  // 인력거 상태(달리는 중·도착·말)는 3D 쪽에서 바뀌니 0.25초마다 다시 그려요
  useEffect(() => {
    if (!vehicle) return undefined
    const id = setInterval(() => setTick((t) => t + 1), 250)
    return () => clearInterval(id)
  }, [vehicle])

  const choices = vehicle && vehicle.stopped && !vehicle.trip ? vehicle.destinations.filter((d) => d.id !== vehicle.node) : []
  useEffect(() => {
    if (!choices.length) return undefined
    const onKey = (e) => {
      const n = Number(e.key)
      if (n >= 1 && n <= choices.length) {
        e.preventDefault()
        vehicle.request = choices[n - 1].id
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  if (!vehicle) return null
  const asking = choices.length > 0
  return (
    <div className="rk-panel ui-interactive" role="dialog" aria-label="인력거">
      <p className="rk-say">
        <span className="rk-who">인력거꾼</span>
        {asking && !vehicle.say?.includes('도착') ? '어디까지 모실까요?' : vehicle.say ?? '어디까지 모실까요?'}
      </p>
      {asking && (
        <>
          {vehicle.say?.includes('도착') && <p className="rk-sub">다른 곳으로 더 가시겠어요?</p>}
          <div className="rk-choices">
            {choices.map((d, i) => (
              <button
                key={d.id}
                type="button"
                className="rk-choice"
                onClick={(e) => {
                  e.currentTarget.blur()
                  vehicle.request = d.id
                }}
              >
                <kbd>{i + 1}</kbd> {d.name}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
