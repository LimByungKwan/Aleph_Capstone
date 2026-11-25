import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import { create } from 'zustand'
import { useGameStore } from '../../../store/gameStore.js'
import { useWarps } from './bk_warpStore.js'
import { useJmActivity } from './jm_activityStore.js'
import { Box, Cyl, mat } from './kit.jsx'
import { getJpSignTexture, GlowMaterial, JmSakuraBloom } from './jm_landmarks.jsx'
import { JmCanal, JmCrossing } from './jm_kyoto.jsx'
import { hipRoofGeometry } from './geometry.js'
import { JmBusStop } from './jm_shops.jsx'

// 애니메이션 구역(JM) 「명장면 공간」 — 담당: 지민 (11/24)
// 계단 거리 가게 문(jmPortalDoor) 앞에서 E → 화면이 잠깐 어두워지고 맵 밖(남쪽 바다 위 멀리)의 장면 공간(jmSceneRoom)으로 이동
// 장면 공간 안의 나가는 문에서 E → 들어갔던 가게 앞으로 돌아옴
// 순간 이동은 병관님 워프 기능의 goto 요청(bk_warpStore.js)을 빌려 씀 → 공용 파일(Scene.jsx·Player.jsx)을 고치지 않음
//   goto는 도착점 근처의 평평한 바닥을 위에서 재서 찾기 때문에, 장면 공간 바닥은 높이 1m의 보이는 판이고
//   공간을 감싼 하늘 돔은 안쪽 면(BackSide)만 그려서 위에서 재는 선에 걸리지 않음
// 장면 이름은 근접형 가상 작품명 (팀 규칙). 캐릭터·영화 그림은 넣지 않고 장소와 소품만 만듦

export const useJmPortal = create((set) => ({ near: null, busy: false, set: (patch) => set(patch) }))

// 화면 어둡게/밝게 (공용 UI를 고치지 않으려고 DOM에 직접 한 장 올림)
let fadeEl = null
function fade(on) {
  if (typeof document === 'undefined') return
  if (!fadeEl) {
    fadeEl = document.createElement('div')
    fadeEl.style.cssText = 'position:fixed;inset:0;background:#05060a;opacity:0;pointer-events:none;transition:opacity .35s ease;z-index:40'
    document.body.appendChild(fadeEl)
  }
  fadeEl.style.opacity = on ? '1' : '0'
}

const NEAR = 1.8 // 문 앞 이 거리 안이면 "E 들어가기"
// 장면 공간(월드 z ROOM_Z_FROM 이남)에 있는 동안은 맵 장소 이름표를 숨김
//   공용 이름표(PlaceMarkers의 drei Html, class "map-place-label")는 거리 제한 없이 화면 앞에 있으면 보여서
//   900m 떨어진 맵 이름표가 장면 하늘에 떠 보임 → 공용 파일은 고치지 않고 body에 class를 달아 CSS로만 숨김
//   (labelLayer는 3D 화면 전체를 감싸는 div라서 통째로 숨기면 안 됨)
const ROOM_Z_FROM = 700
let labelStyle = null
function setMapLabels(show) {
  if (typeof document === 'undefined') return
  if (!labelStyle) {
    labelStyle = document.createElement('style')
    labelStyle.textContent = 'body.jm-in-scene .map-place-label { visibility: hidden; }'
    document.head.appendChild(labelStyle)
  }
  document.body.classList.toggle('jm-in-scene', !show)
}

// item.portal = { to: [월드 x, 월드 z], label, title, sub, color, face(도착 후 바라볼 방향, 도), kind: 'shop' | 'gate' }
export function JmPortalDoor({ item }) {
  const portal = item.portal
  const scene = useThree((s) => s.scene)
  const getState = useThree((s) => s.get)
  const anchor = useRef(null)
  const player = useRef(null)
  const lastLookup = useRef(-Infinity)
  const nextCheck = useRef(0)
  const tmp = useMemo(() => ({ door: new THREE.Vector3(), me: new THREE.Vector3() }), [])

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    if (t < nextCheck.current) return
    nextCheck.current = t + 0.15
    if (!player.current?.parent && t - lastLookup.current > 1) {
      lastLookup.current = t
      player.current = scene.getObjectByName('player') ?? null
    }
    if (!player.current || !anchor.current) return
    anchor.current.getWorldPosition(tmp.door)
    player.current.getWorldPosition(tmp.me)
    setMapLabels(tmp.me.z < ROOM_Z_FROM)
    const near = Math.hypot(tmp.me.x - tmp.door.x, tmp.me.z - tmp.door.z) < NEAR && Math.abs(tmp.me.y - tmp.door.y) < 2.5
    const state = useJmPortal.getState()
    if (near && state.near !== item.id) state.set({ near: item.id })
    else if (!near && state.near === item.id) state.set({ near: null })
  })

  useEffect(() => {
    const down = (event) => {
      if (event.repeat || event.code !== 'KeyE') return
      const state = useJmPortal.getState()
      if (state.near !== item.id || state.busy) return
      const game = useGameStore.getState()
      if (game.openPanel || game.nearbyPlaceId || useJmActivity.getState().sit?.active) return
      state.set({ busy: true, near: null })
      fade(true)
      setTimeout(() => {
        useWarps.getState().goto({
          center: portal.to,
          label: portal.label,
          onArrive: () => {
            setMapLabels(portal.kind === 'gate')
            const controls = getState().controls
            const a = THREE.MathUtils.degToRad(portal.face ?? 0)
            if (controls?.rotateTo) controls.rotateTo(Math.atan2(-Math.sin(a), -Math.cos(a)), 1.25, false)
            setTimeout(() => {
              fade(false)
              useJmPortal.getState().set({ busy: false })
            }, 250)
          },
        })
        // goto가 자리를 못 찾으면 onArrive가 안 불림 → 화면을 되돌림
        setTimeout(() => {
          if (useJmPortal.getState().busy) {
            fade(false)
            useJmPortal.getState().set({ busy: false })
          }
        }, 2500)
      }, 380)
    }
    window.addEventListener('keydown', down)
    return () => window.removeEventListener('keydown', down)
  }, [item.id, portal, getState])

  const glow = useMemo(() => mat(portal.color ?? '#ffe6b0', { emissive: portal.color ?? '#ffcf86', emissiveIntensity: 1.3, transparent: true, opacity: 0.8, double: true }), [portal.color])
  return (
    <group>
      {/* 문 앞 감지 지점 (로컬 +z 쪽) */}
      <group ref={anchor} position={[0, 0, 1.1]} />
      {portal.kind === 'gate' ? <ExitGate glow={glow} title={portal.title} /> : <ShopDoorMark glow={glow} title={portal.title} sub={portal.sub} />}
      <PortalHud id={item.id} text={portal.kind === 'gate' ? `${portal.title ?? '돌아가기'}` : `「${portal.sub}」 들어가기`} />
    </group>
  )
}

// 가게 문: 문틀 안 은은한 빛 + 문 위 장면 현판
function ShopDoorMark({ glow, title, sub }) {
  return (
    <group>
      <mesh position={[0, 1.08, 0.04]} material={glow}>
        <planeGeometry args={[1.5, 2.1]} />
      </mesh>
      {/* 문 옆 입간판 (가게 원래 간판과 겹치지 않게 거리 쪽에 세움): 위 장면 번호·작품, 아래 장소 */}
      <group position={[1.45, 0, 0.75]} rotation={[0, -0.35, 0]}>
        {[-1, 1].map((s) => (
          <Box key={s} p={[s * 0.42, 0.55, 0]} s={[0.07, 1.1, 0.07]} c="#3a281c" />
        ))}
        <Box p={[0, 1.15, -0.02]} s={[1.1, 0.95, 0.05]} c="#2b1d14" />
        <mesh position={[0, 1.36, 0.01]}>
          <planeGeometry args={[1.0, 0.42]} />
          <GlowMaterial glow={0.7} map={getJpSignTexture(title, '#f3e6c8', '#5b1a12', 1.0 / 0.42)} side={THREE.DoubleSide} />
        </mesh>
        <mesh position={[0, 0.94, 0.01]}>
          <planeGeometry args={[1.0, 0.32]} />
          <GlowMaterial glow={0.5} map={getJpSignTexture(sub, '#3d2a1e', '#f3e6c8', 1.0 / 0.32)} side={THREE.DoubleSide} />
        </mesh>
      </group>
    </group>
  )
}

// 장면 공간의 나가는 문: 나무 문틀 + 빛나는 막 + "돌아가기" 현판 (앞 = 로컬 +z)
function ExitGate({ glow, title = '계단 거리로 돌아가기' }) {
  return (
    <group>
      {[-1, 1].map((s) => (
        <Box key={s} p={[s * 1.05, 1.4, 0]} s={[0.22, 2.8, 0.22]} c="#3a281c" />
      ))}
      <Box p={[0, 2.9, 0]} s={[2.7, 0.24, 0.3]} c="#3a281c" />
      <mesh position={[0, 1.35, 0]} material={glow}>
        <planeGeometry args={[1.88, 2.6]} />
      </mesh>
      <group position={[0, 3.35, 0.05]}>
        <Box p={[0, 0, -0.03]} s={[2.4, 0.5, 0.06]} c="#2b1d14" />
        <mesh>
          <planeGeometry args={[2.26, 0.4]} />
          <GlowMaterial glow={0.7} map={getJpSignTexture(title, '#f3e6c8', '#5b1a12', 2.26 / 0.4)} side={THREE.DoubleSide} />
        </mesh>
      </group>
    </group>
  )
}

function PortalHud({ id, text }) {
  const near = useJmPortal((s) => s.near === id)
  const size = useThree((s) => s.size)
  if (!near) return null
  return (
    <Html calculatePosition={() => [0, 0]} zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
      <div style={{ position: 'absolute', left: 0, top: 0, width: size.width, height: size.height, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', paddingBottom: 72, boxSizing: 'border-box' }}>
        <div style={{ padding: '6px 12px', borderRadius: 999, background: 'rgba(0,0,0,0.6)', color: '#fff', fontSize: 13 }}>
          <kbd style={{ padding: '0 5px', borderRadius: 4, background: '#fff', color: '#111', fontSize: 11, fontWeight: 700 }}>E</kbd> {text}
        </div>
      </div>
    </Html>
  )
}

// ── 장면 공간 ─────────────────────────────────
// item.size [가로, _, 깊이], item.room = { kind, title, sub }. 바닥 윗면 = 로컬 0 (생성 스크립트가 elevation 1로 둠)
// 하늘 돔(안쪽 면만)이 공간을 감싸서 바깥 바다·하늘 대신 장면의 하늘이 보임
const ROOM_SKY = {
  totoro: { top: '#0d1424', horizon: '#3a4a5c' },
  stairs: { top: '#3b3a7a', horizon: '#ff9a6b' },
  rock: { top: '#7d8c86', horizon: '#c9d3cc' },
  crossing: { top: '#7fb6e8', horizon: '#ffe4ef' },
  onsen: { top: '#120d22', horizon: '#5b2a3a' },
}

function SkyDome({ radius, top, horizon }) {
  const geo = useMemo(() => {
    const g = new THREE.SphereGeometry(radius, 32, 16)
    const c = new THREE.Color()
    const a = new THREE.Color(horizon)
    const b = new THREE.Color(top)
    const colors = []
    const pos = g.attributes.position
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i) / radius
      c.copy(a).lerp(b, THREE.MathUtils.clamp(y * 1.4, 0, 1))
      colors.push(c.r, c.g, c.b)
    }
    g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
    return g
  }, [radius, top, horizon])
  return (
    <mesh geometry={geo} userData={{ noMerge: true }}>
      <meshBasicMaterial vertexColors side={THREE.BackSide} fog={false} />
    </mesh>
  )
}

export function JmSceneRoom({ item }) {
  const room = item.room ?? {}
  // 실제 공간 크기는 room.w/d (소품 size는 거리 컬링용으로 16m 이하로 둠 — 16m보다 크면 맵 어디서나 늘 그려짐)
  const w = room.w ?? item.size[0]
  const d = room.d ?? item.size[2]
  const scene = useThree((s) => s.scene)
  const check = useRef({ next: 0, player: null })
  const me = useMemo(() => new THREE.Vector3(), [])
  useFrame(({ clock }) => {
    const c = check.current
    if (clock.elapsedTime < c.next) return
    c.next = clock.elapsedTime + 0.5
    if (room.inMap) return
    if (!c.player?.parent) c.player = scene.getObjectByName('player') ?? null
    if (!c.player) return
    c.player.getWorldPosition(me)
    if (me.z >= ROOM_Z_FROM) setMapLabels(false)
  })
  const sky = ROOM_SKY[room.kind] ?? { top: '#7fb6e8', horizon: '#dcefff' }
  return (
    <group>
      {/* (11/25) 맵 안 마당(inMap)은 하늘 돔 없이 마을 하늘을 그대로 씀 */}
      {!room.inMap && <SkyDome radius={Math.max(w, d) * 0.8} top={sky.top} horizon={sky.horizon} />}
      {room.kind === 'totoro' && <TotoroRainStop w={w} d={d} />}
      {room.kind === 'stairs' && <ShrineStairs w={w} d={d} stair={room.stair} />}
      {room.kind === 'rock' && <SplitRock w={w} d={d} />}
      {room.kind === 'crossing' && <SakuraCrossing w={w} d={d} />}
      {room.kind === 'onsen' && <OnsenMotif w={w} d={d} bridge={room.bridge} />}
      {/* 입구 쪽 장면 안내판 */}
      <group position={[-3.2, 0, d / 2 - 4.5]} rotation={[0, 0.35, 0]}>
        <Box p={[0, 0.9, 0]} s={[0.12, 1.8, 0.12]} c="#3a281c" />
        <Box p={[0, 1.75, 0.02]} s={[2.4, 1.0, 0.08]} c="#2b1d14" />
        <mesh position={[0, 1.95, 0.07]}>
          <planeGeometry args={[2.2, 0.42]} />
          <GlowMaterial glow={0.6} map={getJpSignTexture(room.title ?? '명장면', '#f3e6c8', '#5b1a12', 2.2 / 0.42)} side={THREE.DoubleSide} />
        </mesh>
        <mesh position={[0, 1.5, 0.07]}>
          <planeGeometry args={[2.2, 0.32]} />
          <GlowMaterial glow={0.5} map={getJpSignTexture(room.sub ?? '', '#3d2a1e', '#f3e6c8', 2.2 / 0.32)} side={THREE.DoubleSide} />
        </mesh>
      </group>
    </group>
  )
}

// ① 비 오는 밤, 숲속 시골 버스 정류장 (모티브: 「이웃집 토토로」) — 비·우산 체험은 옛 「비 오는 정류장」(RainStop) 그대로
const PADDY_WATER = mat('#2e4450', { roughness: 0.15, metalness: 0.3 })
const RICE = mat('#4f6b35', { flat: true })
const DARK_GRASS = mat('#2c3a27', { roughness: 1 })
const ROAD = mat('#5c4d3b', { roughness: 1 })
const LEAF = mat('#1f3a24', { flat: true })
const LEAF2 = mat('#284a2d', { flat: true })
const BARK = mat('#3b2c22', { flat: true })
const LAMP = mat('#fff1cf', { emissive: '#ffcf7a', emissiveIntensity: 1.6 })
const POLE = mat('#4a4038')

const rnd = (n) => {
  const x = Math.sin(n * 73.13 + 9.1) * 43758.5453
  return x - Math.floor(x)
}

function TotoroRainStop({ w, d }) {
  const forest = useMemo(() => {
    const out = []
    const ring = (n, inset) => {
      for (let i = 0; i < n; i++) {
        const t = i / n
        const side = Math.floor(t * 4)
        const u = (t * 4) % 1
        const half = [w / 2 - inset, d / 2 - inset]
        const p = [
          [-half[0] + u * 2 * half[0], -half[1]],
          [half[0], -half[1] + u * 2 * half[1]],
          [half[0] - u * 2 * half[0], half[1]],
          [-half[0], half[1] - u * 2 * half[1]],
        ][side]
        out.push({ x: p[0] + (rnd(i + inset) - 0.5) * 1.5, z: p[1] + (rnd(i * 3 + inset) - 0.5) * 1.5, h: 5 + rnd(i * 7) * 4, r: 1.4 + rnd(i * 11) * 1.2 })
      }
    }
    ring(36, 1.2)
    ring(28, 3.4)
    return out
  }, [w, d])
  return (
    <group>
      {/* 바닥: 어두운 풀밭 + 흙길(동서) + 논 4칸 */}
      <Box p={[0, -0.5, 0]} s={[w, 1, d]} m={DARK_GRASS} />
      <Box p={[0, 0.02, 1.5]} s={[w - 2, 0.04, 4]} m={ROAD} />
      {[[-8, -6], [8, -6], [-8, 9], [8, 9]].map(([x, z], i) => (
        <group key={i} position={[x, 0, z]}>
          <Box p={[0, 0.03, 0]} s={[10, 0.06, 6]} m={PADDY_WATER} />
          {[-1, 1].map((s) => (
            <Box key={s} p={[0, 0.12, s * 3.1]} s={[10.4, 0.24, 0.3]} c="#3d3426" />
          ))}
          {Array.from({ length: 6 }, (_, r) =>
            Array.from({ length: 10 }, (_, c) => <Box key={`${r}${c}`} p={[-4.5 + c, 0.22, -2.5 + r]} s={[0.12, 0.4, 0.12]} m={RICE} />),
          )}
        </group>
      ))}
      {/* 정류장 (비·우산 체험 포함) + 옆 큰 나무 + 가로등 */}
      <group position={[2.5, 0, -1.4]}>
        <JmBusStop item={{ size: [3, 2.6, 1.6], signs: [{ text: '稲荷前' }] }} />
      </group>
      <group position={[-4.5, 0, -2.2]}>
        <Cyl p={[0, 2.6, 0]} rad={0.55} h={5.2} m={BARK} />
        {[[0, 6.6, 0, 3.4], [-2, 5.6, 1, 2.4], [2.2, 5.8, -0.8, 2.6], [0.5, 8.2, 0.4, 2.4]].map(([x, y, z, r], i) => (
          <mesh key={i} position={[x, y, z]} material={i % 2 ? LEAF2 : LEAF} scale={[r, r * 0.8, r]}>
            <icosahedronGeometry args={[1, 1]} />
          </mesh>
        ))}
      </group>
      <group position={[6.6, 0, -0.6]}>
        <Cyl p={[0, 1.8, 0]} rad={0.06} h={3.6} m={POLE} />
        <Box p={[0, 3.65, 0.25]} s={[0.3, 0.12, 0.5]} m={POLE} />
        <Box p={[0, 3.52, 0.35]} s={[0.22, 0.12, 0.22]} m={LAMP} />
      </group>
      {/* 전봇대 줄 */}
      {[-14, -5, 13].map((x, i) => (
        <group key={i} position={[x, 0, 4.2]}>
          <Cyl p={[0, 3.5, 0]} rad={0.12} h={7} m={POLE} />
          <Box p={[0, 6.4, 0]} s={[1.4, 0.1, 0.1]} m={POLE} />
        </group>
      ))}
      {/* 둘레 숲 (공간 끝을 가림) */}
      {forest.map((t, i) => (
        <group key={i} position={[t.x, 0, t.z]}>
          <Cyl p={[0, 0.8, 0]} rad={0.2} h={1.6} m={BARK} />
          <mesh position={[0, 1.4 + t.h / 2, 0]} material={i % 3 ? LEAF : LEAF2}>
            <coneGeometry args={[t.r, t.h, 7]} />
          </mesh>
        </group>
      ))}
    </group>
  )
}


// ── ② 노을 지는 붉은 난간 신사 계단 (모티브: 「너의 이름은.」) ─────────
// 걷는 계단·위 마당은 생성 스크립트의 지형 계단·단(platform). 여기서는 붉은 난간(가운데 + 양옆)·양옆 집·전봇대·위 작은 도리이
// 장면의 상징이라 이 공간 계단만 붉은 난간을 둠 (맵 계단 가드 제거와는 별개)
const RED = mat('#c8452f', { roughness: 0.6 })
const HOUSE_WALLS = ['#e8e1d3', '#d9cfbf', '#cfd6d8', '#e3d6c4']
const HOUSE_ROOF = mat('#3f4448', { flat: true })
const WINDOW_WARM = mat('#ffe2b0', { emissive: '#ffb45e', emissiveIntensity: 0.8 })
const STREET = mat('#8d8a86', { roughness: 1 })

function RedRail({ x, z0, z1, h0, h1 }) {
  const len = Math.hypot(z1 - z0, h1 - h0)
  const pitch = Math.atan2(h1 - h0, z0 - z1)
  const posts = Math.max(2, Math.round(Math.abs(z1 - z0) / 1.6) + 1)
  return (
    <group>
      <mesh position={[x, (h0 + h1) / 2 + 0.95, (z0 + z1) / 2]} rotation={[pitch, 0, 0]} material={RED}>
        <boxGeometry args={[0.09, 0.09, len]} />
      </mesh>
      {Array.from({ length: posts }, (_, i) => {
        const t = i / (posts - 1)
        return <Box key={i} p={[x, h0 + (h1 - h0) * t + 0.48, z0 + (z1 - z0) * t]} s={[0.07, 0.95, 0.07]} m={RED} />
      })}
    </group>
  )
}

function ShrineStairs({ w = 36, d, stair }) {
  const { z0, z1, h, w: sw } = stair
  const houses = [-1, 1].flatMap((side) =>
    [0, 1, 2].map((k) => ({ side, k, z: z0 - 2.5 - k * 5.2, base: Math.max(0, (h * (z0 - (z0 - 2.5 - k * 5.2))) / (z0 - z1)) })),
  )
  return (
    <group>
      <Box p={[0, -0.5, 0]} s={[w, 1, d]} m={STREET} />
      {/* 붉은 난간: 가운데 1줄 + 양옆 */}
      {[0, -sw / 2 + 0.15, sw / 2 - 0.15].map((x) => (
        <RedRail key={x} x={x} z0={z0} z1={z1} h0={0} h1={h} />
      ))}
      {/* 양옆 집 (계단을 따라 층층이) */}
      {houses.map(({ side, k, z, base }) => {
        const x = side * (sw / 2 + 3.6)
        const hh = 6.5 + (k % 2) * 1.2
        return (
          <group key={`${side}${k}`} position={[x, 0, z]}>
            <Box p={[0, (base + hh) / 2, 0]} s={[5.6, base + hh, 4.6]} c={HOUSE_WALLS[(k + (side > 0 ? 1 : 0)) % HOUSE_WALLS.length]} />
            <mesh position={[0, base + hh + 0.6, 0]} rotation={[0, Math.PI / 4, 0]} material={HOUSE_ROOF}>
              <coneGeometry args={[4.4, 1.4, 4]} />
            </mesh>
            {[1.6, 4.2].map((y) => (
              <Box key={y} p={[-side * 2.81, base + y, 0]} s={[0.04, 0.9, 1.4]} m={WINDOW_WARM} />
            ))}
          </group>
        )
      })}
      {/* 전봇대 + 전선 */}
      {[z0 + 2, z0 - 6, z1 + 1].map((z, i) => (
        <group key={i} position={[sw / 2 + 0.9, 0, z]}>
          <Cyl p={[0, 4.5, 0]} rad={0.12} h={9} c="#4a4038" />
          <Box p={[0, 8.4, 0]} s={[1.6, 0.1, 0.1]} c="#4a4038" />
        </group>
      ))}
      {/* 계단 위: 작은 붉은 도리이 + 작은 사당 */}
      <group position={[0, h, z1 - 2.2]}>
        {[-1, 1].map((s) => (
          <Cyl key={s} p={[s * 1.4, 1.6, 0]} rad={0.14} h={3.2} m={RED} />
        ))}
        <Box p={[0, 3.25, 0]} s={[3.8, 0.22, 0.3]} m={RED} />
        <Box p={[0, 2.75, 0]} s={[3.1, 0.14, 0.18]} m={RED} />
      </group>
      <group position={[0, h, z1 - 4.6]}>
        <Box p={[0, 0.9, 0]} s={[1.8, 1.8, 1.4]} c="#6b4630" />
        <mesh position={[0, 2.1, 0]} rotation={[0, Math.PI / 4, 0]} material={HOUSE_ROOF}>
          <coneGeometry args={[1.6, 0.9, 4]} />
        </mesh>
      </group>
    </group>
  )
}

// ── ③ 안개 낀 숲속의 반으로 갈라진 큰 바위 (모티브: 「귀멸의 칼날」) ─────────
const MOSS_FLOOR = mat('#3f4f3a', { roughness: 1 })
const PATH_DIRT = mat('#6a5a45', { roughness: 1 })
const BOULDER = mat('#6f6c66', { flat: true, roughness: 0.95 })
const BOULDER_IN = mat('#8a857c', { flat: true, roughness: 0.9 })
const CEDAR = mat('#4a3426', { flat: true })
const CEDAR_LEAF = mat('#22382a', { flat: true })
const MIST = mat('#e8eeea', { transparent: true, opacity: 0.18, roughness: 1, double: true })
const ROPE = mat('#d8c79a', { roughness: 1 })
const PAPER = mat('#f7f4ea', { roughness: 1 })

function SplitRock({ w = 36, d }) {
  const trees = useMemo(() => {
    const out = []
    for (let i = 0; i < 46; i++) {
      const a = rnd(i) * Math.PI * 2
      const r = 8 + rnd(i + 99) * 9
      const x = Math.cos(a) * r
      const z = Math.sin(a) * r
      if (z > -2 && Math.abs(x) < 6) continue // 들어오는 길은 넓게 비움
      if (Math.hypot(x, z + 4.5) < 6) continue // 바위 둘레도 비움
      if (Math.abs(x) > w / 2 - 1.2 || Math.abs(z) > d / 2 - 1.2) continue // (11/25) 마당 담 안쪽만
      out.push({ x, z, h: 12 + rnd(i * 5) * 8, r: 0.35 + rnd(i * 3) * 0.3 })
    }
    return out
  }, [w, d])
  return (
    <group>
      <Box p={[0, -0.5, 0]} s={[w, 1, d]} m={MOSS_FLOOR} />
      <Box p={[0, 0.02, 4]} s={[2.4, 0.04, 16]} m={PATH_DIRT} />
      {/* 갈라진 바위: 두 쪽이 비스듬히 벌어짐 + 금줄(시메나와)과 종이 장식 */}
      <group position={[0, 0, -4.5]} rotation={[0, 0.5, 0]}>
        {[-1, 1].map((s) => (
          <group key={s} position={[s * 1.05, 1.35, 0]} rotation={[0, 0, s * 0.1]}>
            <mesh material={BOULDER} scale={[1.25, 1.45, 1.9]}>
              <icosahedronGeometry args={[1, 1]} />
            </mesh>
            <Box p={[-s * 0.95, 0, 0]} s={[0.08, 2.2, 2.6]} m={BOULDER_IN} />
          </group>
        ))}
        <mesh position={[0, 2.1, 0]} rotation={[Math.PI / 2, 0, 0]} material={ROPE}>
          <torusGeometry args={[2.25, 0.09, 6, 28]} />
        </mesh>
        {[-1.5, -0.5, 0.5, 1.5].map((x) => (
          <Box key={x} p={[x, 1.75, 2.15]} s={[0.16, 0.5, 0.02]} m={PAPER} />
        ))}
      </group>
      {/* 키 큰 삼나무 숲 */}
      {trees.map((t, i) => (
        <group key={i} position={[t.x, 0, t.z]}>
          <Cyl p={[0, t.h / 2, 0]} rad={t.r} h={t.h} m={CEDAR} />
          <mesh position={[0, t.h * 0.82, 0]} material={CEDAR_LEAF}>
            <coneGeometry args={[t.r * 5, t.h * 0.45, 7]} />
          </mesh>
        </group>
      ))}
      {/* 안개: 낮게 깔린 반투명 판 여러 장 */}
      {[0.4, 0.9, 1.6, 2.6].map((y, i) => (
        <mesh key={y} position={[0, y, -2 + i]} rotation={[-Math.PI / 2, 0, i * 0.4]} material={MIST}>
          <planeGeometry args={[w - 2, d - 2]} />
        </mesh>
      ))}
      <group position={[2.6, 0, 3]}>
        <Box p={[0, 0.6, 0]} s={[0.1, 1.2, 0.1]} c="#3a281c" />
        <Box p={[0, 1.25, 0]} s={[0.9, 0.5, 0.06]} c="#5a3d2a" />
      </group>
    </group>
  )
}

// ── ④ 벚꽃 날리는 철길 건널목 (모티브: 「초속 5센티미터」) ─────────
// 건널목은 옛 애니 구역 건널목(JmCrossing, 깜빡이는 경보등) 그대로, 벚나무는 강변 벚나무(JmSakuraBloom)
const SPRING_GRASS = mat('#7ea35a', { roughness: 1 })
const BALLAST = mat('#8a8580', { flat: true, roughness: 1 })
const SLEEPER = mat('#5a4636', { roughness: 0.9 })
const RAIL_STEEL = mat('#9aa0a6', { roughness: 0.3, metalness: 0.7 })
const PETAL = new THREE.MeshBasicMaterial({ color: '#f9c4d4', side: THREE.DoubleSide, transparent: true, opacity: 0.9 })
const PETALS = 260

function FallingPetals({ area = 28, top = 9 }) {
  const ref = useRef(null)
  const seeds = useMemo(() => Array.from({ length: PETALS }, (_, i) => ({ x: (rnd(i) - 0.5) * area, z: (rnd(i + 500) - 0.5) * area, y: rnd(i + 900) * top, s: 0.4 + rnd(i + 1300) * 0.6, p: rnd(i + 1700) * 6.28 })), [area, top])
  const m = useMemo(() => new THREE.Matrix4(), [])
  const q = useMemo(() => new THREE.Quaternion(), [])
  const e = useMemo(() => new THREE.Euler(), [])
  const v = useMemo(() => new THREE.Vector3(), [])
  const sc = useMemo(() => new THREE.Vector3(1, 1, 1), [])
  useFrame(({ clock }) => {
    const mesh = ref.current
    if (!mesh) return
    const t = clock.elapsedTime
    seeds.forEach((sd, i) => {
      const y = top - ((t * sd.s * 0.8 + sd.y) % top)
      v.set(sd.x + Math.sin(t * 0.7 + sd.p) * 0.8, y, sd.z + Math.cos(t * 0.5 + sd.p) * 0.6)
      q.setFromEuler(e.set(t * sd.s + sd.p, t * 0.8 + sd.p, 0))
      m.compose(v, q, sc)
      mesh.setMatrixAt(i, m)
    })
    mesh.instanceMatrix.needsUpdate = true
  })
  return (
    <instancedMesh ref={ref} args={[null, PETAL, PETALS]} frustumCulled={false}>
      <planeGeometry args={[0.09, 0.07]} />
    </instancedMesh>
  )
}

function SakuraCrossing({ w = 36, d }) {
  const trees = [[-4.5, 6], [4.5, 7.5], [-5, 0.5], [5.2, 1], [-7, -8], [6.5, -9], [-11, 3], [11, 4], [-12, -10], [12, -11]].filter(([x, z]) => Math.abs(x) < w / 2 - 2 && Math.abs(z) < d / 2 - 2)
  return (
    <group>
      <Box p={[0, -0.5, 0]} s={[w, 1, d]} m={SPRING_GRASS} />
      <Box p={[0, 0.02, 1]} s={[3.6, 0.04, d - 1]} c="#7c7a76" />
      {/* 선로 (동서) */}
      <group position={[0, 0, -3]}>
        <Box p={[0, 0.08, 0]} s={[w, 0.16, 3.4]} m={BALLAST} />
        {Array.from({ length: Math.floor(w / 0.75) }, (_, i) => (
          <Box key={i} p={[-w / 2 + 0.4 + i * 0.75, 0.2, 0]} s={[0.22, 0.1, 2.5]} m={SLEEPER} />
        ))}
        {[-0.72, 0.72].map((z) => (
          <Box key={z} p={[0, 0.3, z]} s={[w, 0.1, 0.08]} m={RAIL_STEEL} />
        ))}
        {/* 건널목 판 + 경보기 (옛 건널목 코드) */}
        <Box p={[0, 0.27, 0]} s={[3.6, 0.06, 2.4]} c="#3a3a3a" />
        <JmCrossing item={{ size: [4.4, 3.2, 1] }} />
      </group>
      {/* 벚나무 줄 */}
      {trees.map(([x, z], i) => (
        <group key={i} position={[x, 0, z]}>
          <JmSakuraBloom item={{ id: `jm_room_sakura_${i}`, size: [4, 6.5, 4], rotationDeg: i * 47 }} />
        </group>
      ))}
      <FallingPetals area={Math.min(w, d) - 2} />
    </group>
  )
}

// ── ⑤ 제등 거리 → 붉은 다리 → 옛 온천 본관 (모티브: 어느 유명 애니 온천장의 모티브로 알려진 온천 거리) ─────────
// 영화 속 건물을 옮기지 않고, 일본 옛 온천 본관·제등 찻집 거리의 공통 요소로만 만든 독자 디자인
const NIGHT_STONE = mat('#5a5550', { roughness: 1 })
const SHOP_WOOD = ['#5a2d22', '#4a3326', '#6b3a2a']
const LANTERN_RED = mat('#d23a24', { emissive: '#ff5a2e', emissiveIntensity: 1.2 })
const BATH_WOOD = mat('#4a3022', { roughness: 0.9 })
const BATH_PLASTER = mat('#e9dcc0', { roughness: 0.9 })
const NOREN_BLUE = mat('#1e3a8a', { roughness: 1 })
const STEAM = mat('#ffffff', { transparent: true, opacity: 0.22, roughness: 1 })

function LanternString({ x0, x1, y, z }) {
  const n = Math.max(3, Math.round(Math.abs(x1 - x0) / 0.9))
  return (
    <group>
      <Box p={[(x0 + x1) / 2, y + 0.35, z]} s={[Math.abs(x1 - x0), 0.02, 0.02]} c="#1c1c1c" />
      {Array.from({ length: n }, (_, i) => {
        const t = (i + 0.5) / n
        const sag = Math.sin(Math.PI * t) * 0.35
        return <Cyl key={i} p={[x0 + (x1 - x0) * t, y - sag, z]} rad={0.17} h={0.34} m={LANTERN_RED} />
      })}
    </group>
  )
}

function OnsenMotif({ w = 36, d, bridge }) {
  const roofs = useMemo(() => [hipRoofGeometry(15, 7, 2.2, 0.3), hipRoofGeometry(11, 5.4, 1.8, 0.3), hipRoofGeometry(5, 4, 2.4, 0.2)], [])
  return (
    <group>
      <Box p={[0, -0.5, 0]} s={[w, 1, d]} m={NIGHT_STONE} />
      {/* 제등 거리: 양옆 2층 찻집 + 머리 위 제등 줄 */}
      {[-1, 1].map((side) =>
        [0, 1, 2].map((k) => {
          const z = 13 - k * 4.4
          return (
            <group key={`${side}${k}`} position={[side * 5.4, 0, z]}>
              <Box p={[0, 3, 0]} s={[4.6, 6, 4]} c={SHOP_WOOD[(k + (side > 0 ? 1 : 0)) % 3]} />
              <Box p={[-side * 2.31, 1.4, 0]} s={[0.04, 1.6, 2.8]} m={WINDOW_WARM} />
              <Box p={[-side * 2.31, 4.2, 0]} s={[0.04, 1.0, 2.8]} m={WINDOW_WARM} />
              <Box p={[-side * 2.6, 3.1, 0]} s={[0.7, 0.08, 4.2]} c="#2b1d14" />
              <Cyl p={[-side * 2.7, 2.4, 1.2]} rad={0.24} h={0.5} m={LANTERN_RED} />
            </group>
          )
        }),
      )}
      {[14, 11.4, 8.8, 6.2, 3.6].map((z) => (
        <LanternString key={z} x0={-3} x1={3} y={4.3} z={z} />
      ))}
      {/* 물길 (동서, 바다 같은 물) + 붉은 다리 */}
      <group position={[0, 0, bridge.z]} rotation={[0, Math.PI / 2, 0]}>
        <JmCanal item={{ size: [bridge.water, 0.1, w - 1], natural: true }} />
      </group>
      <group position={[0, 0, bridge.z]}>
        {/* 다리 바닥: 가운데가 살짝 높은 아치 */}
        {Array.from({ length: 9 }, (_, i) => {
          const t = i / 8
          const z = -bridge.len / 2 + t * bridge.len
          const y = 0.12 + Math.sin(Math.PI * t) * 0.45
          return <Box key={i} p={[0, y, z]} s={[bridge.w, 0.18, bridge.len / 8 + 0.05]} c="#7a4a2e" />
        })}
        {[-1, 1].map((side) => (
          <group key={side}>
            {Array.from({ length: 9 }, (_, i) => {
              const t = i / 8
              const z = -bridge.len / 2 + t * bridge.len
              const y = 0.12 + Math.sin(Math.PI * t) * 0.45
              return (
                <group key={i}>
                  <Box p={[side * (bridge.w / 2 - 0.08), y + 0.5, z]} s={[0.12, 0.9, 0.12]} m={RED} />
                  {i % 4 === 0 && <Cyl p={[side * (bridge.w / 2 - 0.08), y + 1.05, z]} rad={0.09} h={0.18} c="#c9a54a" />}
                </group>
              )
            })}
            <Box p={[side * (bridge.w / 2 - 0.08), 1.25, 0]} s={[0.1, 0.1, bridge.len]} m={RED} />
          </group>
        ))}
        <LanternString x0={-bridge.w / 2} x1={bridge.w / 2} y={3.2} z={0} />
      </group>
      {/* 옛 온천 본관: 3단 목조 + 큰 노렌 + 처마 제등 + 지붕 위 작은 망루 + 김 */}
      <group position={[0, 0, bridge.z - bridge.len / 2 - 6]}>
        <Box p={[0, 2, 0]} s={[13, 4, 6]} m={BATH_WOOD} />
        <Box p={[0, 2.2, 3.02]} s={[11, 2.2, 0.04]} m={WINDOW_WARM} />
        <mesh geometry={roofs[0]} position={[0, 4, 0]}>
          <meshStandardMaterial color="#2f3338" flatShading side={THREE.DoubleSide} />
        </mesh>
        <Box p={[0, 6.3, 0]} s={[9, 2.4, 4.4]} m={BATH_PLASTER} />
        <Box p={[0, 6.3, 2.22]} s={[8, 1.1, 0.04]} m={WINDOW_WARM} />
        <mesh geometry={roofs[1]} position={[0, 7.5, 0]}>
          <meshStandardMaterial color="#2f3338" flatShading side={THREE.DoubleSide} />
        </mesh>
        <Box p={[0, 9.6, 0]} s={[3.2, 1.8, 2.6]} m={BATH_PLASTER} />
        <mesh geometry={roofs[2]} position={[0, 10.5, 0]}>
          <meshStandardMaterial color="#2f3338" flatShading side={THREE.DoubleSide} />
        </mesh>
        {/* 입구: 붉은 기둥 + 큰 노렌(ゆ) + 큰 제등 */}
        {[-1, 1].map((s) => (
          <Cyl key={s} p={[s * 1.6, 1.6, 3.4]} rad={0.16} h={3.2} m={RED} />
        ))}
        <Box p={[0, 3.25, 3.4]} s={[3.8, 0.2, 0.3]} m={RED} />
        {[-0.75, 0.75].map((x) => (
          <Box key={x} p={[x, 2.4, 3.42]} s={[1.4, 1.1, 0.02]} m={NOREN_BLUE} />
        ))}
        <mesh position={[0, 2.45, 3.45]}>
          <planeGeometry args={[1.0, 0.7]} />
          <GlowMaterial glow={0.4} map={getJpSignTexture('ゆ', '#1e3a8a', '#f5f0e6', 1.0 / 0.7)} transparent />
        </mesh>
        <Cyl p={[0, 4.4, 3.6]} rad={0.45} h={0.9} m={LANTERN_RED} />
        {[-5.5, -2.5, 2.5, 5.5].map((x) => (
          <Cyl key={x} p={[x, 3.6, 3.2]} rad={0.2} h={0.4} m={LANTERN_RED} />
        ))}
        {range5.map((i) => (
          <mesh key={i} position={[4 - i * 0.3, 11.5 + i * 0.9, -1]} material={STEAM} scale={[0.8 + i * 0.3, 0.5 + i * 0.2, 0.8 + i * 0.3]}>
            <sphereGeometry args={[1, 10, 8]} />
          </mesh>
        ))}
      </group>
    </group>
  )
}
const range5 = [0, 1, 2, 3, 4]

export const JM_PORTAL_STYLES = { jmPortalDoor: JmPortalDoor, jmSceneRoom: JmSceneRoom }
