import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useShallow } from 'zustand/react/shallow'
import { USE_SERVER } from '../../api/session.js'
import { usePlayerCharacter } from '../Player/characterStore.js'
import { connectRealtime, disconnectRealtime, sendCharacter, sendMove, useRealtimeStore } from './realtimeStore.js'
import RemotePlayer from './RemotePlayer.jsx'

// [지민] 멀티 접속: 내 위치를 서버로 보내고, 같은 맵의 다른 사람들을 그림
// Scene.jsx의 <Physics> 안(플레이 중일 때)에 한 줄로 붙음. 다른 사람 캐릭터는 물리 충돌 없이 그림만 그림
//   (서로 밀치기·끼임 문제를 피하려고 v1은 통과 가능)

const SEND_EVERY = 0.1 // 초 (서버도 10Hz로 모아서 보냄)
const IDLE_RESEND = 2 // 가만히 있어도 2초마다 한 번 → 나중에 들어온 사람에게도 위치가 보임

export default function MultiplayerPresence({ playerRef }) {
  const { character } = usePlayerCharacter()
  // 위치는 0.1초마다 바뀌므로 여기서 구독하지 않음 (RemotePlayer가 매 프레임 직접 읽음)
  // 사람이 들어오고 나가거나 이름·캐릭터가 바뀔 때만 다시 그림
  const visible = useRealtimeStore(
    // "id|캐릭터|이름" 문자열 목록 (이름에 |가 있어도 되게 이름을 맨 뒤에)
    useShallow((s) => Object.values(s.peers).filter((p) => p.state).map((p) => `${p.id}|${p.characterId}|${p.name}`)),
  )
  const elapsed = useRef(0)
  const sinceSent = useRef(IDLE_RESEND)
  const last = useRef(null)

  useEffect(() => {
    connectRealtime(character.id)
    return () => disconnectRealtime()
    // 처음 한 번만 연결 (캐릭터 변경은 아래 effect가 따로 보냄)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    sendCharacter(character.id)
  }, [character.id])

  useFrame((_, delta) => {
    elapsed.current += delta
    sinceSent.current += delta
    if (elapsed.current < SEND_EVERY) return
    elapsed.current = 0
    const player = playerRef.current
    if (!player?.currPos) return

    const { x, y, z } = player.currPos
    const forward = player.bodyZAxis // 캐릭터 모델이 바라보는 방향(+Z)
    const r = Math.atan2(forward.x, forward.z)
    const v = player.currLinVel
    const s = v ? Math.hypot(v.x, v.z) : 0
    const g = player.isOnGround
    const prev = last.current
    const changed =
      !prev || Math.abs(prev.x - x) + Math.abs(prev.y - y) + Math.abs(prev.z - z) > 0.02 || Math.abs(prev.r - r) > 0.02 || prev.g !== g || Math.abs(prev.s - s) > 0.1
    if (!changed && sinceSent.current < IDLE_RESEND) return
    sendMove([x, y, z], r, s, g)
    last.current = { x, y, z, r, s, g }
    sinceSent.current = 0
  })

  if (!USE_SERVER) return null
  return visible.map((key) => {
    const [id, characterId, ...rest] = key.split('|')
    const name = rest.join('|')
    return <RemotePlayer key={id} id={id} name={name} characterId={characterId} />
  })
}
