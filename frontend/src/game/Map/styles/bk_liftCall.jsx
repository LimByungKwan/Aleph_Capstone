import { useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import { useGameStore } from '../../../store/gameStore.js'
import { LIFT_LEVEL_NAMES, useLiftCall } from './bk_liftSync.js'

// 전망대 엘리베이터 버튼 (담당: 병관). Terrain.jsx의 Elevator가 useLiftCall 상태를 정함
//   - 발판 위(rider): "🛗 3초 후 전망층으로 출발 · 2명 탑승" + [바로 출발] (막 도착했으면 [전망층으로 출발])
//   - 문 앞, 곧 떠남(hold): "곧 출발해요" + [✋ 잠깐만요! 열림] → 3초 더 / 닫히던 문 다시 열림
//   - 다른 층에 있음(call): [🛗 엘리베이터 호출] / 오는 중(coming): "오는 중이에요…"
// 멀티면 이 버튼들이 서버로 가서 모두의 화면에 같은 결과 (shared/bk_liftCore.js)

const tmp = new THREE.Vector3()

export function LiftCallHud({ towerId }) {
  const anchor = useRef(null)
  const ui = useLiftCall()
  const panelOpen = useGameStore((s) => Boolean(s.openPanel))
  const size = useThree((s) => s.size)

  // 화면 안내 기준점은 늘 카메라 앞 (drei Html은 기준점이 카메라 뒤면 숨김)
  useFrame(({ camera }) => {
    const g = anchor.current
    if (!g?.parent) return
    camera.getWorldDirection(tmp)
    tmp.multiplyScalar(2).add(camera.position)
    g.position.copy(g.parent.worldToLocal(tmp))
  })

  const visible = ui.towerId === towerId && ui.mode && !panelOpen
  const dest = LIFT_LEVEL_NAMES[ui.to] ?? ''
  const click = (fn) => (e) => {
    e.currentTarget.blur()
    fn?.()
  }
  return (
    <group ref={anchor}>
      {visible && (
        <Html calculatePosition={() => [0, 0]} zIndexRange={[22, 0]} style={{ pointerEvents: 'none' }} onOcclude={keepVisible}>
          <div style={{ ...wrap, width: size.width, height: size.height }}>
            {ui.mode === 'rider' &&
              (ui.riders > 0 ? (
                <div style={box}>
                  <span>
                    🛗 <b>{ui.seconds}초</b> 후 {dest}으로 출발 · {ui.riders}명 탑승
                  </span>
                  <button type="button" style={btn} onClick={click(ui.actions.go)}>바로 출발 ▶</button>
                </div>
              ) : (
                <button type="button" style={btn} onClick={click(ui.actions.board)}>🛗 {dest}으로 출발</button>
              ))}
            {ui.mode === 'hold' && (
              <div style={box}>
                <span>🛗 곧 {dest}으로 출발해요{ui.riders > 0 ? ` · ${ui.riders}명 탑승` : ''}</span>
                <button type="button" style={{ ...btn, background: '#22c55e' }} onClick={click(ui.actions.hold)}>✋ 잠깐만요! 열림</button>
              </div>
            )}
            {ui.mode === 'call' && (
              <button type="button" style={btn} onClick={click(ui.actions.call)}>
                🛗 엘리베이터 호출 <span style={{ opacity: 0.8, fontWeight: 500 }}>· 지금 {LIFT_LEVEL_NAMES[1 - ui.level]}에 있어요</span>
              </button>
            )}
            {ui.mode === 'coming' && <div style={chip}>🛗 엘리베이터가 {LIFT_LEVEL_NAMES[ui.level]}으로 오는 중이에요…</div>}
          </div>
        </Html>
      )}
    </group>
  )
}

const wrap = { position: 'absolute', left: 0, top: 0, display: 'flex', justifyContent: 'center', alignItems: 'flex-end', paddingBottom: 120, boxSizing: 'border-box' }
const box = { pointerEvents: 'auto', display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px 8px 16px', borderRadius: 999, background: 'rgba(0,0,0,0.65)', color: '#fff', fontSize: 14 }
const btn = { pointerEvents: 'auto', padding: '8px 16px', borderRadius: 999, border: '2px solid #fff', background: '#ff8a7a', color: '#fff', fontSize: 14, fontWeight: 800, cursor: 'pointer', boxShadow: '0 6px 18px rgba(0,0,0,0.3)' }
const chip = { padding: '8px 16px', borderRadius: 999, background: 'rgba(0,0,0,0.6)', color: '#fff', fontSize: 14 }

function keepVisible() {}
