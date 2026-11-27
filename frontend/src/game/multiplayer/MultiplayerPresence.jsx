import { useEffect, useReducer, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useShallow } from 'zustand/react/shallow'
import { USE_SERVER } from '../../api/session.js'
import { usePlayerCharacter } from '../Player/characterStore.js'
import { connectRealtime, disconnectRealtime, sendCharacter, sendMove, useRealtimeStore } from './realtimeStore.js'
import RemotePlayer from './RemotePlayer.jsx'
import { Html } from '@react-three/drei'
import { labelLayer } from '../labelLayer.js'
import { ChatBubbleBox, useChatBubble } from './ChatBubble.jsx'
import { isWavingInPhoto } from '../Map/styles/bk_photoRoom.js'

// [지민] 멀티 접속: 내 위치를 서버로 보내고, 같은 맵의 다른 사람들을 <Physics> 안에 배치

const SEND_EVERY = 0.1 // 초 (서버도 10Hz로 모아서 보냄)
const IDLE_RESEND = 2 // 가만히 있어도 2초마다 한 번 → 나중에 들어온 사람에게도 위치가 보임
// 이 시간 동안 위치가 한 번도 안 오면 그 사람 캐릭터를 숨김 (창을 닫았는데 연결이 늦게 끊기는 경우 등)
// 보이는 탭은 2초마다, 가려진 탭도 혜진 님 PresenceKeepAlive가 1초마다 보내므로 실제로 접속해 있는 사람은 사라지지 않음
const STALE_MS = 8000

export default function MultiplayerPresence({ playerRef }) {
  const { character } = usePlayerCharacter()
  const [, recheck] = useReducer((n) => n + 1, 0)
  useEffect(() => {
    const timer = setInterval(recheck, 2000) // 아무도 안 움직여도 오래된 캐릭터를 걸러내게 2초마다 다시 봄
    return () => clearInterval(timer)
  }, [])
  // 위치는 0.1초마다 바뀌므로 여기서 구독하지 않음 (RemotePlayer가 매 프레임 직접 읽음)
  // 사람이 들어오고 나가거나 이름·캐릭터가 바뀔 때만 다시 그림
  const visible = useRealtimeStore(
    // "id|캐릭터|이름" 문자열 목록 (이름에 |가 있어도 되게 이름을 맨 뒤에)
    useShallow((s) => Object.values(s.peers).filter((p) => p.state && Date.now() - (p.seen ?? 0) < STALE_MS).map((p) => `${p.id}|${p.characterId}|${p.name}`)),
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
    const g = Boolean(player.body?.isKinematic()) || player.isOnGround
    const waving = isWavingInPhoto()
    const prev = last.current
    const changed =
      !prev || prev.waving !== waving || Math.abs(prev.x - x) + Math.abs(prev.y - y) + Math.abs(prev.z - z) > 0.02 || Math.abs(prev.r - r) > 0.02 || prev.g !== g || Math.abs(prev.s - s) > 0.1
    if (!changed && sinceSent.current < IDLE_RESEND) return
    sendMove([x, y, z], r, s, g, waving)
    last.current = { x, y, z, r, s, g, waving }
    sinceSent.current = 0
  })

  if (!USE_SERVER) return null
  return (
    <>
      {visible.map((key) => {
        const [id, characterId, ...rest] = key.split('|')
        const name = rest.join('|')
        return <RemotePlayer key={id} id={id} name={name} characterId={characterId} playerRef={playerRef} />
      })}
      <SelfBubble playerRef={playerRef} />
    </>
  )
}

// 내가 보낸 채팅도 내 머리 위에 말풍선으로 (서버가 돌려준 내 글)
function SelfBubble({ playerRef }) {
  const selfId = useRealtimeStore((s) => s.selfId)
  const text = useChatBubble(selfId)
  const group = useRef(null)
  useFrame(() => {
    const p = playerRef.current?.currPos
    if (p && group.current) group.current.position.set(p.x, p.y + 1.05, p.z)
  })
  if (!text) return null
  return (
    <group ref={group}>
      <Html portal={labelLayer} center style={{ pointerEvents: 'none' }}>
        <div style={{ position: 'absolute', left: '50%', bottom: 0, transform: 'translateX(-50%)' }}>
          <ChatBubbleBox text={text} />
        </div>
      </Html>
    </group>
  )
}
