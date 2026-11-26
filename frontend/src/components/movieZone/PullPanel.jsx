import { useEffect, useState } from 'react'
import { useRealtimeStore } from '../../game/multiplayer/realtimeStore.js'
import { usePalaceSeatStore } from './palaceSeating.js'
import { answerPull, askPull, endPull, myPull, peerName, selfId, usePull } from './worldEvents.js'
import { useWallet } from './wallet.js'
import './rickshaw.css'

// [3. 개발 > 프론트엔드] 끄는 인력거 창 (혜진 영화·드라마 구역)
//  · 손님(뒷자리에 앉음): 근처 사람 목록 → "끌어 주세요" 부탁
//  · 부탁받은 사람: "OO님이 인력거를 끌어 달래요" → 수락 / 거절
//  · 끄는 사람: 끄는 중 표시 + 받은 코인 + 그만 끌기
const NEAR_M = 30

export default function PullPanel() {
  const seated = usePalaceSeatStore((s) => s.seated)
  const pulls = usePull((s) => s.pulls)
  const ask = usePull((s) => s.ask)
  const waiting = usePull((s) => s.waiting)
  const status = useRealtimeStore((s) => s.status)
  const coins = useWallet((s) => s.coins)
  const [, setTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000)
    return () => clearInterval(id)
  }, [])
  const me = selfId()
  const rk = seated?.vehicle?.pullable ? seated.vehicle.id : null
  const pulling = myPull()

  // 부탁받았을 때 (가장 먼저 보여요)
  if (ask) {
    return (
      <div className="rk-panel rk-pull ui-interactive" role="dialog" aria-label="인력거 끌기 부탁">
        <p className="rk-say">
          <span className="rk-who">인력거</span>
          {peerName(ask.from)}님이 인력거를 끌어 달래요!
        </p>
        <p className="rk-sub">수락하면 손님 뒤로 가서 걸어가세요 · 인력거가 따라오고, 15m마다 🪙 코인 1개를 받아요</p>
        <div className="rk-choices">
          <button type="button" className="rk-choice" onClick={() => answerPull(true)}>
            <span className="rk-guide-name">수락하고 끌기<small>코인을 모아 전차표·기차표를 살 수 있어요</small></span>
          </button>
          <button type="button" className="rk-choice" onClick={() => answerPull(false)}>
            <span className="rk-guide-name">거절<small>다음에 끌게요</small></span>
          </button>
        </div>
      </div>
    )
  }
  // 내가 끄는 중
  if (pulling) {
    const p = pulls[pulling]
    return (
      <div className="rk-panel rk-pull ui-interactive" role="status" aria-label="인력거 끄는 중">
        <p className="rk-say">
          <span className="rk-who">인력거꾼</span>
          {peerName(p?.passenger)}님을 태우고 끌고 있어요 · 🪙 {coins}
        </p>
        <p className="rk-sub">걸어가면 인력거가 따라와요 · 멈추면 손님이 E로 내려요</p>
        <div className="rk-choices">
          <button type="button" className="rk-choice" onClick={() => endPull(pulling)}>
            <span className="rk-guide-name">그만 끌기<small>인력거를 그 자리에 세워요</small></span>
          </button>
        </div>
      </div>
    )
  }
  // 손님으로 앉아 있을 때
  if (rk) {
    const pull = pulls[rk]
    if (pull) {
      return (
        <div className="rk-panel rk-pull" role="status">
          <p className="rk-say">
            <span className="rk-who">인력거</span>
            {peerName(pull.puller)}님이 끌어 주고 있어요
          </p>
          <p className="rk-sub">인력거가 멈추면 E로 내려요</p>
        </div>
      )
    }
    const peers = Object.values(useRealtimeStore.getState().peers).filter((p) => {
      if (!p.state || p.id === me) return false
      const [x, , z] = p.state
      const [sx, , sz] = seated.position
      return Math.hypot(x - sx, z - sz) < NEAR_M
    })
    return (
      <div className="rk-panel rk-pull ui-interactive" role="dialog" aria-label="인력거 끌 사람 고르기">
        <p className="rk-say">
          <span className="rk-who">인력거</span>
          누구에게 끌어 달라고 할까요?
        </p>
        {status !== 'online' ? (
          <p className="rk-sub">멀티 서버에 접속해 있을 때만 다른 사람에게 부탁할 수 있어요 · E로 내리기</p>
        ) : waiting?.rk === rk ? (
          <p className="rk-sub">{peerName(waiting.to)}님의 대답을 기다려요…</p>
        ) : peers.length === 0 ? (
          <p className="rk-sub">근처({NEAR_M}m)에 다른 사람이 없어요 · 친구를 불러 보세요</p>
        ) : (
          <div className="rk-choices">
            {peers.slice(0, 6).map((p) => (
              <button key={p.id} type="button" className="rk-choice" onClick={(e) => (e.currentTarget.blur(), askPull(rk, p.id))}>
                <span className="rk-guide-name">{p.name ?? '손님'}<small>끌어 주세요 부탁하기</small></span>
              </button>
            ))}
          </div>
        )}
      </div>
    )
  }
  return null
}
