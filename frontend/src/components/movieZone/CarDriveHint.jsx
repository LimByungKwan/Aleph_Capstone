import { useEffect, useState } from 'react'
import { usePalaceSeatStore } from './palaceSeating.js'
import './rickshaw.css'

// [3. 개발 > 프론트엔드] 자동차 운전 안내 (혜진 영화·드라마 구역) — 운전석에 앉아 있을 때만 보여요
// 화면 아래 가운데에 키보드 모양(W / A S D + E)으로 크게 보여 줘요. 누르고 있는 키는 밝게 켜져요
const KEYS = { KeyW: 'W', ArrowUp: 'W', KeyS: 'S', ArrowDown: 'S', KeyA: 'A', ArrowLeft: 'A', KeyD: 'D', ArrowRight: 'D', KeyE: 'E' }
export default function CarDriveHint() {
  const seated = usePalaceSeatStore((s) => s.seated)
  const car = seated?.vehicle?.driving ? seated.vehicle : null
  const [, setTick] = useState(0)
  const [down, setDown] = useState(() => new Set())
  useEffect(() => {
    if (!car) return undefined
    const id = setInterval(() => setTick((t) => t + 1), 200)
    const on = (e) => KEYS[e.code] && setDown((d) => new Set(d).add(KEYS[e.code]))
    const off = (e) =>
      KEYS[e.code] &&
      setDown((d) => {
        const n = new Set(d)
        n.delete(KEYS[e.code])
        return n
      })
    window.addEventListener('keydown', on)
    window.addEventListener('keyup', off)
    return () => {
      clearInterval(id)
      window.removeEventListener('keydown', on)
      window.removeEventListener('keyup', off)
    }
  }, [car])
  if (!car) return null
  const kmh = Math.round(Math.abs(car.speed ?? 0) * 3.6)
  const Key = ({ k, label }) => (
    <span className={`car-hud__key${down.has(k) ? ' is-down' : ''}`}>
      <b>{k}</b>
      <small>{label}</small>
    </span>
  )
  return (
    <div className="car-hud" role="status" aria-label="자동차 운전 조작">
      <div className="car-hud__speed">
        <strong>{kmh}</strong>
        <span>km/h{car.speed < -0.2 ? ' · 후진' : ''}</span>
      </div>
      <div className="car-hud__keys">
        <div className="car-hud__row">
          <Key k="W" label="앞으로" />
        </div>
        <div className="car-hud__row">
          <Key k="A" label="왼쪽" />
          <Key k="S" label="브레이크·뒤로" />
          <Key k="D" label="오른쪽" />
        </div>
      </div>
      <div className="car-hud__exit">
        <Key k="E" label="멈춘 뒤 내리기" />
      </div>
    </div>
  )
}
