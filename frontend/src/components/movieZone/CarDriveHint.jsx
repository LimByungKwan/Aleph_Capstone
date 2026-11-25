import { useEffect, useState } from 'react'
import { usePalaceSeatStore } from './palaceSeating.js'
import './rickshaw.css'

// [3. 개발 > 프론트엔드] 자동차 운전 안내 (혜진 영화·드라마 구역) — 운전석에 앉아 있을 때만 보여요
export default function CarDriveHint() {
  const seated = usePalaceSeatStore((s) => s.seated)
  const car = seated?.vehicle?.driving ? seated.vehicle : null
  const [, setTick] = useState(0)
  useEffect(() => {
    if (!car) return undefined
    const id = setInterval(() => setTick((t) => t + 1), 200)
    return () => clearInterval(id)
  }, [car])
  if (!car) return null
  const kmh = Math.round(Math.abs(car.speed ?? 0) * 3.6)
  return (
    <div className="rk-panel rk-drive" role="status" aria-label="자동차 운전">
      <p className="rk-say">
        <span className="rk-who">운전 중</span>
        {kmh} km/h {car.speed < -0.2 ? '(후진)' : ''}
      </p>
      <p className="rk-sub">
        <kbd>W</kbd> 앞으로 · <kbd>S</kbd> 브레이크·뒤로 · <kbd>A</kbd>
        <kbd>D</kbd> 핸들 · 멈춘 뒤 <kbd>E</kbd> 내리기
      </p>
    </div>
  )
}
