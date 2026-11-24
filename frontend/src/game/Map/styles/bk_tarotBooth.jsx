import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import { useGameStore } from '../../../store/gameStore.js'
import { useBkActivity } from './bk_activityStore.js'
import { GEO, mat, texMat } from './kit.jsx'
import { getSignTexture } from './textures.js'
import { nightGlow } from './dateCourse.jsx'
import { TarotSession } from './bk_tarotQuestions.jsx'
import { tarotRoom, useTarotRoom } from './bk_tarotRoom.js'

// 데이트 코스 구역(BK) 커플 타로 텐트. 담당: 병관
//
// 데이트 코스 입구 바로 안쪽(소원 분수 옆)에 있는 보라색 점술 텐트. 앞에서 E → 커플 타로 화면이 열림 (ESC·닫기로 나감).
// 화면: 두 사람 질문 카드(bk_tarotQuestions.jsx). 11/26~ AI 서버 /tarot 연결 (docs/bk-couple-tarot-plan.md)
// 인형뽑기(bk_clawMachine.jsx)와 같은 방식: 공용 파일은 styles/index.js에 스타일 이름 한 줄만 등록

const C = {
  fabric: '#5b3f8c',
  fabricDark: '#3f2a66',
  stripe: '#e7c35a',
  pole: '#6b3f2a',
  stone: '#b9b4a8',
  wood: '#b07a4f',
  cloth: '#1e2a5a',
  cushionA: '#f9a8d4',
  cushionB: '#93c5fd',
}
// 텐트 크기 (앞 = +z = 손님이 서는 쪽)
const T = { r: 1.6, wallH: 2.1, roofH: 1.5 }
const BALL = mat('#d8ccff', { emissive: '#b69cff', emissiveIntensity: 0.9, transparent: true, opacity: 0.85, roughness: 0.1 })
const STAR = mat('#ffe08a', { emissive: '#ffd34d', emissiveIntensity: 1.2 })
const CARD = mat('#fbf3e6', { emissive: '#fbf3e6', emissiveIntensity: 0.15 })
const CARD_BACK = mat('#7c3aed', { emissive: '#7c3aed', emissiveIntensity: 0.2 })
const FRONT = 2.1 // 텐트 가운데에서 이만큼 앞이 손님 자리
const NEAR = 1.9 // 손님 자리에서 이 거리 안이면 "E 커플 타로"

export function TarotBooth({ item }) {
  const sign = item.signs?.[0] ?? { text: '커플 타로', bg: '#3f2a66', fg: '#ffe08a' }
  const signMat = useMemo(() => nightGlow(texMat(getSignTexture(sign.text, sign.bg, sign.fg, 1.7 / 0.4), { emissive: '#ffffff', emissiveIntensity: 0.25 }), 0.9), [sign.text, sign.bg, sign.fg])
  // 옆·뒤 천막 (앞쪽 90°는 열어 둠): 기둥 8개 중 앞 2칸 빼고 천을 둘러침
  const walls = useMemo(() => {
    const out = []
    const n = 8
    for (let i = 0; i < n; i++) {
      const a = ((i + 0.5) / n) * Math.PI * 2 // 칸 가운데 각도 (0 = 앞 +z)
      if (Math.cos(a) > 0.6) continue // 앞쪽 두 칸은 입구
      const side = 2 * T.r * Math.sin(Math.PI / n)
      out.push({ x: Math.sin(a) * T.r * 0.97, z: Math.cos(a) * T.r * 0.97, rot: a, w: side, dark: i % 2 === 0 })
    }
    return out
  }, [])
  return (
    <group userData={{ noShadow: true }}>
      {/* 돌 바닥 */}
      <mesh geometry={GEO.cyl48} material={mat(C.stone)} position={[0, 0.08, 0]} scale={[T.r + 0.35, 0.16, T.r + 0.35]} />
      <mesh geometry={GEO.cyl48} material={mat('#7a5c9e')} position={[0, 0.17, 0]} scale={[T.r - 0.1, 0.02, T.r - 0.1]} />
      {/* 천막 벽 (줄무늬처럼 두 색 번갈아) */}
      {walls.map((w, i) => (
        <mesh key={i} geometry={GEO.box} material={mat(w.dark ? C.fabricDark : C.fabric)} position={[w.x, T.wallH / 2 + 0.16, w.z]} rotation={[0, w.rot, 0]} scale={[w.w + 0.02, T.wallH, 0.05]} />
      ))}
      {/* 입구 양옆 묶은 커튼 + 기둥 */}
      {[-1, 1].map((sx) => {
        const a = sx * (Math.PI / 4)
        const x = Math.sin(a) * T.r
        const z = Math.cos(a) * T.r
        return (
          <group key={sx}>
            <mesh geometry={GEO.cyl8} material={mat(C.pole)} position={[x, T.wallH / 2 + 0.16, z]} scale={[0.06, T.wallH, 0.06]} />
            <mesh geometry={GEO.cone} material={mat(C.fabric)} position={[x - sx * 0.12, T.wallH * 0.62, z - 0.05]} rotation={[Math.PI, 0, 0]} scale={[0.28, T.wallH * 0.9, 0.2]} />
            <mesh geometry={GEO.cyl8} material={mat(C.stripe)} position={[x - sx * 0.12, T.wallH * 0.5, z - 0.05]} scale={[0.13, 0.06, 0.1]} />
          </group>
        )
      })}
      {/* 원뿔 지붕 + 금색 띠 + 꼭대기 별 */}
      <mesh geometry={GEO.cone} material={mat(C.fabric)} position={[0, T.wallH + 0.16 + T.roofH / 2, 0]} scale={[T.r + 0.3, T.roofH, T.r + 0.3]} />
      <mesh geometry={GEO.cyl} material={mat(C.stripe)} position={[0, T.wallH + 0.2, 0]} scale={[T.r + 0.32, 0.1, T.r + 0.32]} />
      <mesh geometry={GEO.cyl8} material={mat(C.pole)} position={[0, T.wallH + T.roofH + 0.35, 0]} scale={[0.03, 0.4, 0.03]} />
      <mesh geometry={GEO.ico} material={STAR} position={[0, T.wallH + T.roofH + 0.6, 0]} scale={[0.16, 0.16, 0.16]} />
      {/* 현판 (입구 위) */}
      <mesh geometry={GEO.box} material={mat(C.pole)} position={[0, T.wallH + 0.45, T.r + 0.12]} scale={[1.85, 0.5, 0.05]} />
      <mesh geometry={GEO.plane} material={signMat} position={[0, T.wallH + 0.45, T.r + 0.15]} scale={[1.7, 0.4, 1]} />
      {/* 둥근 탁자 + 남색 식탁보 + 수정구슬 + 카드 3장 */}
      <mesh geometry={GEO.cyl} material={mat(C.wood)} position={[0, 0.55, -0.2]} scale={[0.12, 0.75, 0.12]} />
      <mesh geometry={GEO.cyl} material={mat(C.cloth)} position={[0, 0.95, -0.2]} scale={[0.62, 0.06, 0.62]} />
      <mesh geometry={GEO.cyl} material={mat(C.cloth)} position={[0, 0.8, -0.2]} scale={[0.66, 0.26, 0.66]} />
      <mesh geometry={GEO.cyl8} material={mat(C.stripe)} position={[0, 1.0, -0.4]} scale={[0.1, 0.05, 0.1]} />
      <mesh geometry={GEO.sphere} material={BALL} position={[0, 1.17, -0.4]} scale={[0.17, 0.17, 0.17]} />
      {[-0.3, 0, 0.3].map((x, i) => (
        <mesh key={x} geometry={GEO.box} material={i === 1 ? CARD : CARD_BACK} position={[x, 0.99, 0.1]} rotation={[0, (i - 1) * 0.12, 0]} scale={[0.17, 0.01, 0.26]} />
      ))}
      {/* 점술사 자리 (안쪽) 방석 + 손님 두 사람 방석 (분홍·하늘) */}
      <mesh geometry={GEO.cyl} material={mat(C.fabricDark)} position={[0, 0.27, -0.95]} scale={[0.32, 0.18, 0.32]} />
      <mesh geometry={GEO.cyl} material={mat(C.cushionA)} position={[-0.35, 0.27, 0.65]} scale={[0.25, 0.16, 0.25]} />
      <mesh geometry={GEO.cyl} material={mat(C.cushionB)} position={[0.35, 0.27, 0.65]} scale={[0.25, 0.16, 0.25]} />
      <pointLight position={[0, 1.5, -0.3]} color="#c4b5fd" intensity={1.2} distance={4} decay={2} />
      <TarotInteraction item={item} />
    </group>
  )
}

// 텐트 앞인지 확인 + E로 열기 + 화면
function TarotInteraction({ item }) {
  const scene = useThree((state) => state.scene)
  const anchor = useRef(null)
  const player = useRef(null)
  const lastLookup = useRef(-Infinity)
  const tmp = useMemo(() => ({ v: new THREE.Vector3(), me: new THREE.Vector3() }), [])
  const store = () => useBkActivity.getState()

  useEffect(() => {
    const down = (event) => {
      const t = store().tarot
      const game = useGameStore.getState()
      if (event.code === 'KeyE' && !event.repeat && t.near && !t.active && !game.openPanel && !game.nearbyPlaceId) {
        store().setTarot({ active: true })
        game.open({ type: 'bk_tarot', placeId: item.id })
      }
    }
    window.addEventListener('keydown', down)
    // ESC(공용 InteractionKeys)나 다른 화면이 패널을 닫으면 타로도 닫힘 (같이 보기 중이면 상대에게 알리고 나감)
    const unsub = useGameStore.subscribe((state) => {
      const t = store().tarot
      if (t.active && state.openPanel?.placeId !== item.id) {
        store().setTarot({ active: false })
        tarotRoom.leave()
      }
    })
    // 같이 보기 방이 생기면(초대 수락) 두 사람 모두 타로 화면을 엶
    const unsubRoom = useTarotRoom.subscribe((state, prev) => {
      if (state.room && state.room !== prev.room) {
        store().setTarot({ active: true })
        useGameStore.getState().open({ type: 'bk_tarot', placeId: item.id })
      }
    })
    return () => {
      window.removeEventListener('keydown', down)
      unsub()
      unsubRoom()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.id])

  useFrame((state) => {
    const t = state.clock.elapsedTime
    const cur = store().tarot
    if (!player.current?.parent && t - lastLookup.current > 1) {
      lastLookup.current = t
      player.current = scene.getObjectByName('player') ?? null
    }
    if (anchor.current && !cur.spot) {
      // 텐트 앞 손님 자리 (월드 x·z) → 같이 볼 사람 찾기(bk_tarotRoom.js)에 씀
      anchor.current.localToWorld(tmp.v.set(0, 0, FRONT))
      store().setTarot({ spot: [tmp.v.x, tmp.v.z] })
    }
    if (player.current?.parent && anchor.current) {
      anchor.current.localToWorld(tmp.v.set(0, 0, FRONT))
      player.current.getWorldPosition(tmp.me)
      const near = Math.hypot(tmp.me.x - tmp.v.x, tmp.me.z - tmp.v.z) < NEAR && Math.abs(tmp.me.y - tmp.v.y) < 2
      if (near !== cur.near) store().setTarot({ near })
    } else if (cur.near) store().setTarot({ near: false })
  })

  return (
    <group ref={anchor}>
      {/* 화면 안내 기준점은 탁자 위 (drei Html은 기준점이 카메라 뒤면 숨김) */}
      <group position={[0, 1.2, 0]}>
        <TarotHud />
      </group>
    </group>
  )
}

function TarotHud() {
  const t = useBkActivity((state) => state.tarot)
  const invite = useTarotRoom((state) => state.invite)
  const size = useThree((state) => state.size)
  const showHint = t.near && !t.active && !invite
  if (!showHint && !t.active && !invite) return null
  return (
    // 화면이 열려 있으면 장소 이름표(drei Html 기본 z-index 최대 16777271)보다 위에
    <Html calculatePosition={() => [0, 0]} zIndexRange={t.active ? [16777272, 16777272] : [20, 0]} style={{ pointerEvents: 'none' }} onOcclude={keepVisible}>
      <div ref={wheelScroll} style={{ ...wrap, width: size.width, height: size.height, alignItems: t.active ? 'center' : 'flex-end' }}>
        {showHint && (
          <div style={chip}>
            <kbd style={kbd}>E</kbd> 커플 타로 보기 🔮
          </div>
        )}
        {invite && !t.active && <InviteCard invite={invite} />}
        {t.active && <TarotSession onClose={() => useGameStore.getState().close()} />}
      </div>
    </Html>
  )
}

// 같이 보기 초대 받기 (텐트 근처에서만 초대가 오므로 텐트 앞에서 보임)
function InviteCard({ invite }) {
  return (
    <div style={inviteBox}>
      <div style={{ fontSize: 22 }}>💌</div>
      <div style={{ fontWeight: 700, margin: '2px 0 4px' }}>{invite.from.name}님이 커플 타로를 같이 보자고 해요</div>
      <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 8 }}>각자 폰에서 질문 10개에 답하면, 같은 카드가 두 화면에 펼쳐져요</div>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
        <button type="button" style={ghost} onClick={() => tarotRoom.respond(false)}>다음에</button>
        <button type="button" style={yes} onClick={() => tarotRoom.respond(true)}>같이 보기 🔮</button>
      </div>
    </div>
  )
}
const inviteBox = { pointerEvents: 'auto', width: 'min(320px, calc(100vw - 32px))', padding: '12px 14px', borderRadius: 14, background: 'rgba(36,24,64,0.94)', color: '#fff', textAlign: 'center', fontSize: 14, border: '1px solid rgba(231,195,90,0.6)', boxShadow: '0 8px 30px rgba(0,0,0,0.35)' }
const yes = { padding: '7px 16px', borderRadius: 999, border: 'none', background: '#e7c35a', color: '#2a1d47', fontWeight: 700, cursor: 'pointer' }
const ghost = { padding: '7px 14px', borderRadius: 999, border: '1px solid rgba(255,255,255,0.35)', background: 'transparent', color: '#fff', cursor: 'pointer' }

const wrap = { position: 'absolute', left: 0, top: 0, display: 'flex', justifyContent: 'center', paddingBottom: 72, boxSizing: 'border-box' }
const chip = { padding: '6px 12px', borderRadius: 999, background: 'rgba(0,0,0,0.6)', color: '#fff', fontSize: 13 }
const kbd = { padding: '0 5px', borderRadius: 4, background: '#fff', color: '#111', fontSize: 11, fontWeight: 700 }

// 타로 창 마우스 휠 스크롤: 게임 쪽(카메라 휠 확대 등)이 휠을 가져가서 창이 안 내려가던 문제 →
// 휠이 창 위에서 돌면 가장 가까운 스크롤 되는 칸을 직접 내림 (캔버스로는 안 넘김)
function wheelScroll(el) {
  if (!el || el.dataset.wheel) return
  el.dataset.wheel = '1'
  el.addEventListener(
    'wheel',
    (event) => {
      let box = event.target instanceof Element ? event.target : null
      while (box && box !== el && !(box.scrollHeight > box.clientHeight + 1 && /(auto|scroll)/.test(getComputedStyle(box).overflowY))) box = box.parentElement
      if (!box || box === el) return
      event.preventDefault()
      event.stopPropagation()
      box.scrollTop += event.deltaMode === 1 ? event.deltaY * 16 : event.deltaY
    },
    { passive: false },
  )
}

// drei Html 화면 고정 위치가 처음 한 번 숨겨진 채로 굳지 않게 (bk_clawMachine.jsx와 같음)
function keepVisible() {}
