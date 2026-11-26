import { useEffect, useState } from 'react'
import { useIsTouch } from '../mobile/MobileControls.jsx'

// 왼쪽 위 키보드 조작 안내. 누른 키는 실제로 눌린 것처럼 내려감. 담당: 성근(SG)
// - 키 이름은 e.code(자판 위치)로 봄 → 한글 입력 상태여도 W·A·S·D가 그대로 잡힘
// - 터치 기기는 조이스틱이 따로 있어서 숨김

const ROWS = [
  [{ code: 'KeyW', label: 'W' }, { code: 'KeyE', label: 'E', note: '상호작용' }],
  [{ code: 'KeyA', label: 'A' }, { code: 'KeyS', label: 'S' }, { code: 'KeyD', label: 'D' }],
  [{ code: 'ShiftLeft', also: 'ShiftRight', label: 'Shift', note: '달리기', wide: true }, { code: 'Space', label: 'Space', note: '점프', wide: true }],
]
const SCALE = 1.2 // 전체 배율 (키·글자·간격을 한꺼번에 키움)
const BASE_HEIGHT = 118
export const KEY_HINTS_BOTTOM = 64 + Math.round((BASE_HEIGHT - 8) * SCALE) // 이 아래에 KpopIntro 다시 보기 버튼

export default function KeyHints() {
  const touch = useIsTouch()
  const [down, setDown] = useState(() => new Set())

  useEffect(() => {
    if (touch) return undefined
    const set = (code, on) =>
      setDown((prev) => {
        if (prev.has(code) === on) return prev // 같은 상태면 다시 그리지 않음 (키를 누르고 있으면 keydown이 계속 옴)
        const next = new Set(prev)
        on ? next.add(code) : next.delete(code)
        return next
      })
    const onDown = (e) => set(e.code, true)
    const onUp = (e) => set(e.code, false)
    const clear = () => setDown(new Set()) // 창을 벗어나면 keyup을 못 받으므로 전부 뗌
    window.addEventListener('keydown', onDown)
    window.addEventListener('keyup', onUp)
    window.addEventListener('blur', clear)
    return () => {
      window.removeEventListener('keydown', onDown)
      window.removeEventListener('keyup', onUp)
      window.removeEventListener('blur', clear)
    }
  }, [touch])

  if (touch) return null
  return (
    <div style={wrap} aria-hidden="true">
      {ROWS.map((row, i) => (
        <div key={i} style={{ ...rowStyle, paddingLeft: i === 0 ? 34 : 0 }}>
          {row.map((k) => {
            const on = down.has(k.code) || down.has(k.also)
            return (
              <span key={k.code} style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: i === 0 && k.note ? 34 : 0 }}>
                <kbd style={{ ...key, ...(k.wide && { minWidth: 52 }), ...(on && pressed) }}>{k.label}</kbd>
                {k.note && <span style={note}>{k.note}</span>}
              </span>
            )
          })}
          {i === 1 && <span style={note}>이동</span>}
        </div>
      ))}
    </div>
  )
}

const wrap = { position: 'absolute', top: 64, left: 12, zIndex: 20, pointerEvents: 'none', boxSizing: 'border-box', height: BASE_HEIGHT - 8, transform: `scale(${SCALE})`, transformOrigin: 'top left', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 4, padding: '6px 10px', borderRadius: 12, background: 'rgba(24,18,43,0.55)', color: '#fff' }
const rowStyle = { display: 'flex', alignItems: 'center', gap: 4 }
const key = { boxSizing: 'border-box', minWidth: 30, height: 28, padding: '0 6px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6, border: '1px solid #cfc4e6', borderBottomWidth: 4, background: '#fbf9ff', color: '#1a1030', fontSize: 12, fontWeight: 700, fontFamily: 'inherit', transition: 'transform 60ms, border-bottom-width 60ms, background 60ms' }
const pressed = { transform: 'translateY(3px)', borderBottomWidth: 1, background: '#c4a5ff' }
const note = { fontSize: 11, color: '#e9ddff' }
