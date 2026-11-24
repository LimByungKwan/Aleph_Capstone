import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import { useGameStore } from '../../../store/gameStore.js'
import { useCourseStore } from '../../../store/courseStore.js'
import { useBadges } from '../../../store/badges.js'
import { useUiStore } from '../../../components/movieZone/uiStore.js'
import { useBkActivity } from './bk_activityStore.js'
import { onlinePeers } from './bk_tarotRoom.js'
import { COUNTDOWN_MS, SHOTS, photoRoom, usePhotoRoom } from './bk_photoRoom.js'
import { composeFourCut } from './bk_fourCut.js'

// 커플 포토존 "인생네컷" (담당: 병관) — CouplePhotoZone(dateCourse.jsx) 안에서 그려짐 → 좌표는 포토존 기준
// 포토존 앞에서 E → [혼자 찍기] 또는 접속 중인 사람 [같이 찍자고 초대] (멀티: bk_photoRoom.js + 서버 bk_photoRooms.js)
// → 하트 앞 분홍·하늘 발자국에 각자 서면 → 카메라가 삼각대 자리로 → 두 화면에서 동시에 3·2·1 × 4컷 → 네컷 사진
// 캐릭터를 순간 이동시키지 않고 직접 걸어와 서게 함 (공용 Player.jsx 수정 없음). 찍는 동안만 두 캐릭터가 카메라를 보게 돌림

const SPOTS = { a: new THREE.Vector3(-0.45, 0, -0.9), b: new THREE.Vector3(0.45, 0, -0.9), solo: new THREE.Vector3(0, 0, -0.9) }
const SPOT_R = 0.55 // 발자국에서 이 거리 안이면 "섰음"
const NEAR_POINT = new THREE.Vector3(0, 0, 1.4) // E 안내가 뜨는 기준점 (데크 앞)
const NEAR = 3.2
const EYE = new THREE.Vector3(0, 1.4, 2.3) // 찍는 카메라: 하트 앞 두 사람이 크게 나오게 (하트는 뒤 배경)
const LOOK = new THREE.Vector3(0, 1.25, -1.2)
const COLORS = { a: '#f472b6', b: '#60a5fa', solo: '#f472b6' }
const PLACE_ID = 'BK/couple_photo'

const RING_GEO = new THREE.RingGeometry(0.32, 0.42, 32)
const ringMat = (color) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false })

// 캐릭터 그림(모델) 찾기: 공용 CharacterModel·RemotePlayer 모두 모델을 캡슐 중심에서 1m 아래(y = -1)에 둠
function findModel(root) {
  let found = null
  root?.traverse((o) => {
    if (!found && o !== root && Math.abs(o.position.y + 1) < 0.01) found = o
  })
  return found
}

export function PhotoBooth() {
  const scene = useThree((s) => s.scene)
  const camera = useThree((s) => s.camera)
  const root = useRef(null)
  const hud = useRef(null)
  const player = useRef(null)
  const lastLookup = useRef(-Infinity)
  const turned = useRef([]) // 카메라 쪽으로 돌려 둔 모델들 (끝나면 되돌림)
  const lastReady = useRef(null)
  const tmp = useMemo(() => ({ v: new THREE.Vector3(), me: new THREE.Vector3(), q: new THREE.Quaternion(), pq: new THREE.Quaternion(), m: new THREE.Matrix4() }), [])
  const phase = usePhotoRoom((s) => s.phase)
  const solo = usePhotoRoom((s) => s.solo)
  const store = () => useBkActivity.getState()

  // E로 열기 / 패널이 닫히면 정리
  useEffect(() => {
    const down = (event) => {
      const p = store().photo
      const game = useGameStore.getState()
      if (event.code === 'KeyE' && !event.repeat && p.near && !p.active && !game.openPanel && usePhotoRoom.getState().phase === 'idle') {
        store().setPhoto({ active: true })
        game.open({ type: 'bk_photo', placeId: PLACE_ID })
      }
    }
    window.addEventListener('keydown', down)
    const unsub = useGameStore.subscribe((state) => {
      if (store().photo.active && state.openPanel?.placeId !== PLACE_ID) {
        store().setPhoto({ active: false })
        const ph = usePhotoRoom.getState().phase
        if (ph === 'shooting' || ph === 'done') photoRoom.leave() // 찍는 중 ESC = 그만두기, 다 찍은 뒤 닫기 = 정리
      }
    })
    return () => {
      window.removeEventListener('keydown', down)
      unsub()
    }
  }, [])

  // 단계가 바뀔 때: 모이기 → 창 닫고 걸어오게(멀면 미니맵 안내) / 찍기 → 움직임 잠금 / 끝나면 원래대로
  useEffect(() => {
    const game = useGameStore.getState()
    if (phase === 'gather') {
      if (store().photo.active) game.close()
      const here = root.current?.localToWorld(new THREE.Vector3(0, 0, 0))
      const me = scene.getObjectByName('player')?.getWorldPosition(new THREE.Vector3())
      if (here && me && Math.hypot(here.x - me.x, here.z - me.z) > 15) {
        useCourseStore.getState().setCourse(
          [{ placeId: 'bk_couple_photo', name: '커플 포토존', zone: 'BK', zoneName: '데이트 코스 구역', type: 'spot', position: [here.x, here.y, here.z], reason: '인생네컷 같이 찍기' }],
          { photo: true },
        )
      }
    }
    if (phase === 'shooting' || phase === 'idle') {
      if (useCourseStore.getState().meta?.photo) useCourseStore.getState().clear()
    }
    if (phase === 'shooting' && !store().photo.active) {
      store().setPhoto({ active: true })
      game.open({ type: 'bk_photo', placeId: PLACE_ID })
    }
    if (phase !== 'shooting') {
      turned.current.forEach((m) => m.quaternion.identity())
      turned.current = []
    }
    if (phase === 'gather') lastReady.current = null
  }, [phase, scene])

  useFrame((state) => {
    const t = state.clock.elapsedTime
    if (hud.current?.parent) {
      // 화면 안내 기준점은 늘 카메라 앞 (drei Html은 기준점이 카메라 뒤면 숨김)
      state.camera.getWorldDirection(tmp.v)
      tmp.v.multiplyScalar(2).add(state.camera.position)
      hud.current.position.copy(hud.current.parent.worldToLocal(tmp.v))
    }
    if (!root.current) return
    if (!player.current?.parent && t - lastLookup.current > 1) {
      lastLookup.current = t
      player.current = scene.getObjectByName('player') ?? null
    }
    const ph = usePhotoRoom.getState()
    const p = store().photo
    if (player.current?.parent) {
      player.current.getWorldPosition(tmp.me)
      const local = root.current.worldToLocal(tmp.me.clone())
      // E 안내
      const near = ph.phase === 'idle' && local.distanceTo(NEAR_POINT) < NEAR && Math.abs(local.y) < 3
      if (near !== p.near) store().setPhoto({ near })
      // 모이기: 내 발자국 위에 섰는지
      if (ph.phase === 'gather' && ph.room) {
        const spot = SPOTS[ph.solo ? 'solo' : ph.room.role]
        const on = Math.hypot(local.x - spot.x, local.z - spot.z) < SPOT_R && Math.abs(local.y - 1) < 1.5
        if (on !== lastReady.current) {
          lastReady.current = on
          photoRoom.setReady(on)
        }
      }
    } else if (p.near) store().setPhoto({ near: false })

    if (ph.phase === 'shooting') {
      // 카메라: 삼각대 자리에서 하트를 봄 (3인칭 카메라 조종이 끝난 뒤 덮어씀 — 인형뽑기 클로즈업과 같음)
      root.current.localToWorld(tmp.v.copy(EYE))
      camera.position.copy(tmp.v)
      root.current.localToWorld(tmp.me.copy(LOOK))
      camera.lookAt(tmp.me)
      camera.updateMatrixWorld()
    }

    // 카메라를 보게 돌릴 캐릭터: 찍는 중이거나, 모이기 단계에서 자기 발자국에 선 사람
    // 내 캐릭터: Ecctrl이 매 프레임 돌리는 모델 칸(y=-1) 안쪽의 실제 모델 (혜진 님 궁궐 의자 앉기와 같은 자리)
    // 상대 캐릭터: RemotePlayer는 바깥 그룹만 돌려서 안쪽 모델(y=-1)
    const active = []
    if (ph.room && (ph.phase === 'shooting' || ph.phase === 'gather')) {
      const myRole = ph.solo ? 'a' : ph.room.role
      const show = (role) => ph.phase === 'shooting' || ph.ready[role]
      if (show(myRole)) active.push({ model: findModel(player.current)?.children[0] })
      if (ph.room.partner?.id && show(myRole === 'a' ? 'b' : 'a')) {
        active.push({ model: findModel(scene.getObjectByName(`remote-player-${ph.room.partner.id}`)) })
      }
    }
    // 카메라(포토존 +z 쪽)를 보게 돌림 (캐릭터 모델도 +z가 얼굴 쪽)
    root.current.getWorldQuaternion(tmp.q)
    for (const e of active) {
      if (!e.model?.parent) continue
      e.model.parent.getWorldQuaternion(tmp.pq)
      e.model.quaternion.copy(tmp.pq.invert()).multiply(tmp.q)
      if (!turned.current.includes(e.model)) turned.current.push(e.model)
    }
    turned.current = turned.current.filter((m) => {
      const keep = active.some((e) => e.model === m)
      if (!keep) m.quaternion.identity()
      return keep
    })
  })

  const spotKeys = phase === 'gather' ? (solo ? ['solo'] : ['a', 'b']) : []
  return (
    <group ref={root}>
      {spotKeys.map((k) => (
        <mesh key={k} geometry={RING_GEO} material={ringMat(COLORS[k])} position={[SPOTS[k].x, 0.16, SPOTS[k].z]} rotation={[-Math.PI / 2, 0, 0]} userData={{ noShadow: true }} />
      ))}
      {/* 찍는 동안 얼굴을 밝히는 조명 (밤에도 어둡게 안 나오게) */}
      {phase === 'shooting' && <pointLight position={[0, 2.2, 1.2]} intensity={6} distance={6} decay={1.5} color="#fff1f2" />}
      <ShotCapturer />
      <group ref={hud}>
        <PhotoHud />
      </group>
    </group>
  )
}

// 컷 신호가 오면 3·2·1 뒤 지금 화면을 그려서 저장. 마지막 컷이면 네컷으로 합침
function ShotCapturer() {
  const { gl, scene, camera } = useThree()
  const shot = usePhotoRoom((s) => s.shot)
  useEffect(() => {
    if (!shot) return undefined
    const timer = setTimeout(() => {
      const s = usePhotoRoom.getState()
      if (s.phase !== 'shooting') return
      try {
        gl.render(scene, camera)
        photoRoom.saveShot(shot.index, gl.domElement.toDataURL('image/jpeg', 0.9))
      } catch (error) {
        console.warn('[인생네컷] 찍기 실패', error)
      }
      if (shot.index === SHOTS - 1) {
        const now = usePhotoRoom.getState()
        const names = now.solo ? [] : [now.room?.me?.name, now.room?.partner?.name].filter(Boolean)
        composeFourCut(now.shots, names)
          .then((url) => {
            photoRoom.finish(url)
            if (useBadges.getState().award('four_cut')) setTimeout(() => useUiStore.getState().toast('📸 배지 획득: 인생네컷', 'ok'), 600)
          })
          .catch(() => photoRoom.leave())
      }
    }, COUNTDOWN_MS)
    return () => clearTimeout(timer)
  }, [shot, gl, scene, camera])
  return null
}

// ── 화면 (drei Html 안: R3F 훅 사용 금지) ─────────────────────────
function PhotoHud() {
  const p = useBkActivity((s) => s.photo)
  const ph = usePhotoRoom()
  const size = useThree((s) => s.size)
  const showHint = p.near && !p.active && ph.phase === 'idle' && !ph.invite
  const visible = showHint || p.active || ph.invite || ph.phase !== 'idle'
  if (!visible) return null
  return (
    <Html calculatePosition={() => [0, 0]} zIndexRange={p.active ? [16777272, 16777272] : [21, 0]} style={{ pointerEvents: 'none' }} onOcclude={keepVisible}>
      <div style={{ ...wrap, width: size.width, height: size.height }}>
        {showHint && (
          <div style={{ ...chip, marginBottom: 72 }}>
            <kbd style={kbd}>E</kbd> 인생네컷 찍기 📸
          </div>
        )}
        {ph.invite && ph.phase === 'idle' && <InviteCard invite={ph.invite} />}
        {ph.phase === 'idle' && p.active && <IntroPanel />}
        {ph.phase === 'gather' && <GatherBanner />}
        {ph.phase === 'shooting' && <Countdown shot={ph.shot} width={size.width} height={size.height} />}
        {ph.phase === 'done' && ph.result && <ResultPanel url={ph.result} />}
      </div>
    </Html>
  )
}

function IntroPanel() {
  const { outgoing, notice } = usePhotoRoom()
  const [people, setPeople] = useState(() => onlinePeers(null))
  useEffect(() => {
    const timer = setInterval(() => setPeople(onlinePeers(null)), 1000)
    return () => clearInterval(timer)
  }, [])
  return (
    <div style={{ ...panel, alignSelf: 'center' }}>
      <div style={{ fontSize: 28, textAlign: 'center' }}>📸</div>
      <div style={title}>커플 포토존 인생네컷</div>
      <p style={para}>하트 앞 발자국에 서면 삼각대 카메라가 3·2·1로 <b>4컷</b>을 찍어서 한 장의 네컷 사진으로 만들어 드려요.</p>
      {notice && <div style={{ fontSize: 12, margin: '4px 0 8px', color: '#fbcfe8' }}>{notice}</div>}
      <button type="button" style={{ ...btn, width: '100%' }} onClick={() => photoRoom.startSolo()}>혼자 찍기 🤳</button>
      <div style={togetherBox}>
        <div style={{ fontSize: 12, color: '#e7c35a', fontWeight: 700 }}>👥 같이 찍기 · 지금 접속 중 {people.length}명</div>
        {outgoing ? (
          <div style={{ fontSize: 13, marginTop: 4 }}>
            💌 {outgoing.to.name}님에게 초대를 보냈어요. 기다리는 중… ·{' '}
            <button type="button" style={linkBtn} onClick={() => photoRoom.leave()}>취소</button>
          </div>
        ) : people.length ? (
          people.map((peer) => (
            <div key={peer.id} style={peerRow}>
              <span>{peer.name}</span>
              <button type="button" style={{ ...btn, padding: '4px 12px', fontSize: 12 }} onClick={() => photoRoom.invite(peer.id)}>같이 찍자고 초대</button>
            </div>
          ))
        ) : (
          <div style={{ fontSize: 12, opacity: 0.75, marginTop: 4 }}>지금 접속한 다른 사람이 없어요.</div>
        )}
        <div style={{ fontSize: 11, opacity: 0.7, marginTop: 4 }}>수락하면 둘 다 포토존으로 와서 각자 발자국에 서면 동시에 찍혀요.</div>
      </div>
      <div style={row}>
        <button type="button" style={ghostBtn} onClick={() => useGameStore.getState().close()}>닫기 <kbd style={kbd}>ESC</kbd></button>
      </div>
    </div>
  )
}

function InviteCard({ invite }) {
  return (
    <div style={{ ...panel, width: 'min(320px, calc(100vw - 32px))', textAlign: 'center', marginBottom: 72 }}>
      <div style={{ fontSize: 22 }}>📸</div>
      <div style={{ fontWeight: 700, margin: '2px 0 4px' }}>{invite.from.name}님이 인생네컷을 같이 찍자고 해요</div>
      <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 8 }}>데이트 코스 구역 커플 포토존에서 만나요</div>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
        <button type="button" style={ghostBtn} onClick={() => photoRoom.respond(false)}>다음에</button>
        <button type="button" style={btn} onClick={() => photoRoom.respond(true)}>같이 찍기 📸</button>
      </div>
    </div>
  )
}

function GatherBanner() {
  const { room, ready, solo } = usePhotoRoom()
  const mark = (ok) => (ok ? '✅' : '⏳')
  return (
    <div style={banner}>
      <div style={{ fontWeight: 700 }}>📸 하트 앞 {solo ? '분홍' : room.role === 'a' ? '분홍' : '하늘색'} 발자국 원에 서 주세요</div>
      {!solo && (
        <div style={{ fontSize: 12, marginTop: 2 }}>
          <span style={{ color: COLORS.a }}>●</span> {room.role === 'a' ? room.me.name : room.partner.name} {mark(ready.a)} ·{' '}
          <span style={{ color: COLORS.b }}>●</span> {room.role === 'b' ? room.me.name : room.partner.name} {mark(ready.b)}
        </div>
      )}
      <div style={{ fontSize: 11, opacity: 0.75, marginTop: 2 }}>{solo ? '서면 바로 찍기 시작해요' : '둘 다 서면 동시에 찍기 시작해요'}</div>
      <button type="button" style={{ ...linkBtn, marginTop: 4 }} onClick={() => photoRoom.leave()}>그만두기</button>
    </div>
  )
}

// 3·2·1 + 찰칵(하얀 번쩍임) + 몇 번째 컷인지
function Countdown({ shot, width, height }) {
  const [now, setNow] = useState(() => performance.now())
  useEffect(() => {
    let raf = 0
    const tick = () => {
      setNow(performance.now())
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])
  if (!shot) return null
  const left = COUNTDOWN_MS - (now - shot.at)
  const flash = left <= 0 && left > -260
  return (
    <div style={{ position: 'absolute', left: 0, top: 0, width, height, pointerEvents: 'none' }}>
      <div style={{ ...frameGuide, left: width * 0.12, top: height * 0.12, width: width * 0.76, height: height * 0.7 }} />
      <div style={shotTag}>📸 {shot.index + 1} / {SHOTS}</div>
      {left > 0 && <div style={bigNumber}>{Math.ceil(left / 1000)}</div>}
      {flash && <div style={{ position: 'absolute', inset: 0, background: '#fff', opacity: 0.85 }} />}
    </div>
  )
}

function ResultPanel({ url }) {
  const [canShare, setCanShare] = useState(false)
  useEffect(() => {
    toFile(url)
      .then((file) => setCanShare(Boolean(navigator.canShare?.({ files: [file] }))))
      .catch(() => setCanShare(false))
  }, [url])
  const save = () => {
    const a = document.createElement('a')
    a.href = url
    a.download = fileName()
    a.click()
  }
  const share = async () => {
    try {
      await navigator.share({ files: [await toFile(url)], title: 'SceneWalk 인생네컷', text: '데이트 코스 커플 포토존에서 #SceneWalk' })
    } catch {
      // 공유 창을 닫은 경우
    }
  }
  return (
    <div style={{ ...panel, alignSelf: 'center', textAlign: 'center' }}>
      <div style={title}>인생네컷 완성! 💕</div>
      <img src={url} alt="인생네컷" style={{ maxWidth: '100%', maxHeight: 'calc(100vh - 290px)', borderRadius: 8, display: 'block', margin: '0 auto' }} />
      <div style={row}>
        <button type="button" style={btn} onClick={save}>💾 사진 저장</button>
        {canShare && <button type="button" style={btn} onClick={share}>📤 공유</button>}
        <button type="button" style={ghostBtn} onClick={() => useGameStore.getState().close()}>닫기</button>
      </div>
    </div>
  )
}

const fileName = () => `scenewalk-4cut-${new Date().toISOString().slice(0, 10)}.jpg`
async function toFile(url) {
  const blob = await (await fetch(url)).blob()
  return new File([blob], fileName(), { type: 'image/jpeg' })
}

const wrap = { position: 'absolute', left: 0, top: 0, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center', boxSizing: 'border-box' }
const panel = { pointerEvents: 'auto', width: 'min(380px, calc(100vw - 32px))', maxHeight: 'calc(100vh - 150px)', overflowY: 'auto', margin: 'auto 0', padding: '16px 18px', borderRadius: 14, background: 'rgba(36,24,64,0.94)', color: '#fff', fontSize: 14, boxShadow: '0 8px 30px rgba(0,0,0,0.35)', border: '1px solid rgba(244,114,182,0.6)', boxSizing: 'border-box' }
const title = { fontWeight: 700, fontSize: 18, textAlign: 'center', margin: '4px 0 10px' }
const para = { margin: '0 0 10px', lineHeight: 1.5 }
const row = { display: 'flex', justifyContent: 'center', gap: 8, marginTop: 12, flexWrap: 'wrap' }
const btn = { padding: '7px 16px', borderRadius: 999, border: 'none', background: '#f9a8d4', color: '#3b0a2a', fontWeight: 700, cursor: 'pointer' }
const ghostBtn = { padding: '7px 14px', borderRadius: 999, border: '1px solid rgba(255,255,255,0.35)', background: 'transparent', color: '#fff', cursor: 'pointer' }
const linkBtn = { padding: 0, border: 'none', background: 'none', color: '#f9a8d4', textDecoration: 'underline', cursor: 'pointer', fontSize: 12, pointerEvents: 'auto' }
const togetherBox = { marginTop: 12, padding: '8px 12px', borderRadius: 12, background: 'rgba(147,197,253,0.12)', border: '1px solid rgba(147,197,253,0.45)' }
const peerRow = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6, fontSize: 13 }
const banner = { pointerEvents: 'auto', position: 'absolute', top: 64, left: '50%', transform: 'translateX(-50%)', padding: '8px 16px', borderRadius: 14, background: 'rgba(36,24,64,0.92)', color: '#fff', fontSize: 14, textAlign: 'center', border: '1px solid rgba(244,114,182,0.6)', whiteSpace: 'nowrap' }
const chip = { padding: '6px 12px', borderRadius: 999, background: 'rgba(0,0,0,0.6)', color: '#fff', fontSize: 13 }
const kbd = { padding: '0 5px', borderRadius: 4, background: '#fff', color: '#111', fontSize: 11, fontWeight: 700 }
const frameGuide = { position: 'absolute', border: '3px dashed rgba(255,255,255,0.7)', borderRadius: 12, boxSizing: 'border-box' }
const shotTag = { position: 'absolute', top: 64, left: '50%', transform: 'translateX(-50%)', padding: '4px 14px', borderRadius: 999, background: 'rgba(244,114,182,0.9)', color: '#fff', fontWeight: 800, fontSize: 15 }
// 카운트다운 숫자는 얼굴을 가리지 않게 왼쪽에
const bigNumber = { position: 'absolute', left: '6%', top: '38%', fontSize: 72, fontWeight: 900, color: '#fff', textShadow: '0 4px 20px rgba(244,114,182,0.9)' }

function keepVisible() {}
