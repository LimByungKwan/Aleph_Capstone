import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { create } from 'zustand'
import { GEO, Instances, mat } from '../../game/Map/styles/kit.jsx'
import { getSignTexture } from '../../game/Map/styles/textures.js'
import { BUGAK_TOP } from '../../game/Map/styles/hj/HjBugaksan.jsx'
import { zoneToWorld } from './hjAreas.js'
import { registerWarpSpot } from './palaceSeating.js'
import { blastGov, govDown, useGov } from './worldEvents.js'
import { useWallet } from './wallet.js'
import { useUiStore } from './uiStore.js'

// [3. 개발 > 프론트엔드] 광복 프로젝트 — 조선총독부 철거 (혜진 영화·드라마 구역)
// 역사: 1926년 경복궁 앞을 가로막고 지어진 조선총독부 청사는 광복 50주년인 1995년 8월 15일 철거가 시작되어
//       1996년에 완전히 없어졌고, 그 자리에서 경복궁 복원이 이어졌어요. 이 프로젝트는 그 철거를 게임으로 함께 해 보는 거예요.
// 하는 법: 경성거리 곳곳의 "독립의 증거" 3개를 E로 모아요 → 총독부 앞 발파 스위치에서 E →
//          모든 사람 화면에서 총독부가 무너지고(10분 동안) 태극기 아래 광복 장면이 보여요. 끝낸 사람은 코인 10개.

// 독립의 증거 3곳 (월드 [x, 몸통 높이, z])
export const EVIDENCE = [
  { id: 'declaration', name: '독립선언서', where: '시계탑 광장 동쪽 벤치', pos: zoneToWorld(9, 82, 1.4), color: '#f4ecd2' },
  { id: 'taegeukgi', name: '태극기', where: '경성역 앞', pos: zoneToWorld(-26.5, 89, 1.4), color: '#ffffff' },
  { id: 'letter', name: '광복군 편지', where: '북악산 정상 전망대', pos: zoneToWorld(BUGAK_TOP.x + 2.2, 17.4 + BUGAK_TOP.z + 1.8, BUGAK_TOP.y + 1.15), color: '#e9d7a6' },
].filter((e) => e.pos)
const SWITCH = zoneToWorld(-7.5, 139, 1.4) // 총독부 앞마당 발파 스위치
const GOV_CENTER = zoneToWorld(0, 153, 0)

// 모은 증거 (이 화면에 저장)
const KEY = 'hj.gov.evidence.v1'
const loadFound = () => {
  try {
    return new Set(JSON.parse(globalThis.localStorage?.getItem(KEY) ?? '[]'))
  } catch {
    return new Set()
  }
}
export const useEvidence = create((set, get) => ({
  found: loadFound(),
  take(id) {
    const found = new Set(get().found).add(id)
    set({ found })
    try {
      globalThis.localStorage?.setItem(KEY, JSON.stringify([...found]))
    } catch {
      // 저장 못 해도 이번 접속 동안은 기억해요
    }
  },
  reset() {
    set({ found: new Set() })
    try {
      globalThis.localStorage?.removeItem(KEY)
    } catch {
      // 무시
    }
  },
}))
const toast = (text, tone) => useUiStore.getState().toast?.(text, tone)

// E 자리 등록 (안내 문구는 매 프레임 상황에 맞게 바꿔요)
const spots = []
for (const e of EVIDENCE) {
  const spot = {
    id: `gov_ev_${e.id}`,
    position: e.pos,
    radius: 1.6,
    prompt: `🇰🇷 ${e.name} 줍기`,
    action: () => {
      if (useEvidence.getState().found.has(e.id)) return
      useEvidence.getState().take(e.id)
      const n = useEvidence.getState().found.size
      toast(`🇰🇷 독립의 증거 "${e.name}"을(를) 찾았어요 (${n}/${EVIDENCE.length})${n === EVIDENCE.length ? ' · 총독부 앞 발파 스위치로!' : ''}`, 'success')
    },
  }
  spots.push({ spot, e })
  registerWarpSpot(spot)
}
const switchSpot = {
  id: 'gov_blast_switch',
  position: SWITCH,
  radius: 1.8,
  prompt: '광복 프로젝트 · 발파 스위치',
  action: () => {
    if (govDown()) return toast('이미 철거됐어요 · 10분 뒤 다시 서요', 'info')
    const n = useEvidence.getState().found.size
    if (n < EVIDENCE.length) {
      const left = EVIDENCE.filter((e) => !useEvidence.getState().found.has(e.id)).map((e) => `${e.name}(${e.where})`).join(', ')
      return toast(`독립의 증거 ${n}/${EVIDENCE.length} · 남은 것: ${left}`, 'info')
    }
    blastGov()
    useWallet.getState().earn(10, '광복 프로젝트 완수')
    useEvidence.getState().reset() // 다음에 또 할 수 있게
  },
}
if (SWITCH) registerWarpSpot(switchSpot)

// 태극기 그림 (가로 3 : 세로 2)
let flagTex = null
function taegeukgi() {
  if (flagTex || typeof document === 'undefined') return flagTex
  const c = document.createElement('canvas')
  c.width = 300
  c.height = 200
  const g = c.getContext('2d')
  if (!g) return null
  g.fillStyle = '#ffffff'
  g.fillRect(0, 0, 300, 200)
  const cx = 150
  const cy = 100
  const r = 50
  g.save()
  g.translate(cx, cy)
  g.rotate(Math.atan2(2, 3)) // 태극은 깃발 대각선 방향으로 기울어요
  g.fillStyle = '#0047a0'
  g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.fill()
  g.fillStyle = '#cd2e3a'
  g.beginPath(); g.arc(0, 0, r, Math.PI, 0); g.fill()
  g.beginPath(); g.arc(-r / 2, 0, r / 2, 0, Math.PI * 2); g.fill()
  g.fillStyle = '#0047a0'
  g.beginPath(); g.arc(r / 2, 0, r / 2, 0, Math.PI * 2); g.fill()
  g.restore()
  // 네 귀퉁이 괘 (건·곤·감·리를 단순한 막대로)
  g.fillStyle = '#000000'
  const bars = (x, y, ang, pattern) => {
    g.save()
    g.translate(x, y)
    g.rotate(ang)
    pattern.forEach((broken, i) => {
      const yy = -12 + i * 10
      if (broken) {
        g.fillRect(-16, yy, 14, 6)
        g.fillRect(2, yy, 14, 6)
      } else g.fillRect(-16, yy, 32, 6)
    })
    g.restore()
  }
  const a = Math.atan2(2, 3)
  bars(58, 40, a + Math.PI / 2, [0, 0, 0]) // 건
  bars(242, 160, a + Math.PI / 2, [1, 1, 1]) // 곤
  bars(242, 40, -a + Math.PI / 2, [1, 0, 1]) // 감
  bars(58, 160, -a + Math.PI / 2, [0, 1, 0]) // 리
  flagTex = new THREE.CanvasTexture(c)
  flagTex.colorSpace = THREE.SRGBColorSpace
  return flagTex
}

const GLOW = mat('#fff1c4', { emissive: '#ffd77a', emissiveIntensity: 1.1, transparent: true, opacity: 0.7 })
const FIRE = mat('#ffb347', { emissive: '#ff7a1f', emissiveIntensity: 2.0, transparent: true, opacity: 0.85 })
const DUST = mat('#b9b2a3', { transparent: true, opacity: 0.55, roughness: 1 })

// ── 3D: 독립의 증거(떠서 빛남) · 발파 스위치 · 발파 연출 · 철거 뒤 광복 장면 ──
export function GovProjectScene() {
  const items = useRef([])
  const fx = useRef(null)
  const fire = useRef([])
  const dust = useRef([])
  const after = useRef(null)
  const found = useEvidence((s) => s.found)
  const flag = taegeukgi()
  const plaque = getSignTexture('광복 · 1995년 조선총독부 철거, 경복궁을 되찾았어요', '#1f3a5f', '#ffffff', 7)
  const switchSign = getSignTexture('🇰🇷 광복 프로젝트 · 독립의 증거 3개를 모아 발파!', '#5a1f1f', '#ffe9a8', 7)
  const debris = useMemo(() => Array.from({ length: 24 }, (_, i) => ({ a: (i / 24) * Math.PI * 2, r: 4 + (i % 5), up: 6 + (i % 7) })), [])
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    // 증거: 위아래로 떠 있고 돌아요 (이미 주운 건 안 보여요)
    items.current.forEach((g, i) => {
      if (!g) return
      g.position.y = Math.sin(t * 2 + i) * 0.12
      g.rotation.y = t * 1.2
    })
    // 발파 스위치 안내 문구에 진행 상황
    switchSpot.prompt = govDown() ? '광복 프로젝트 완료 · 10분 뒤 다시 서요' : `광복 프로젝트 · 발파 스위치 (독립의 증거 ${useEvidence.getState().found.size}/${EVIDENCE.length})`
    // 발파 연출 (처음 6초): 불꽃 → 먼지 구름 → 파편
    const { blastAt } = useGov.getState()
    const dt = blastAt ? (performance.now() - blastAt) / 1000 : 99
    const show = dt < 7
    if (fx.current) fx.current.visible = show
    if (show) {
      fire.current.forEach((m, i) => {
        if (!m) return
        const k = Math.max(0, dt - i * 0.18)
        m.visible = k > 0 && k < 1.6
        m.scale.setScalar(2 + k * 9)
        m.material.opacity = Math.max(0, 0.9 - k * 0.55)
      })
      dust.current.forEach((m, i) => {
        if (!m) return
        const d = debris[i]
        const k = Math.max(0, dt - 0.3)
        m.position.set(Math.cos(d.a) * (d.r + k * 2.4), 2 + k * d.up * 0.6 - k * k * 0.6, Math.sin(d.a) * (d.r + k * 2.4))
        m.scale.setScalar(1.2 + k * 1.6)
      })
    }
    if (after.current) after.current.visible = govDown() && dt > 4
  })
  if (!GOV_CENTER || !SWITCH) return null
  return (
    <>
      {spots.map(({ e }, i) => (
        <group key={e.id} position={[e.pos[0], e.pos[1] - 0.3, e.pos[2]]} visible={!found.has(e.id)}>
          <group ref={(g) => (items.current[i] = g)}>
            {e.id === 'taegeukgi' ? (
              <mesh rotation-y={Math.PI / 2}>
                <planeGeometry args={[0.75, 0.5]} />
                <meshBasicMaterial map={flag} side={THREE.DoubleSide} />
              </mesh>
            ) : (
              <mesh geometry={GEO.cyl8} rotation-z={Math.PI / 2} scale={[0.09, 0.6, 0.09]}>
                <meshStandardMaterial color={e.color} roughness={0.8} />
              </mesh>
            )}
            <mesh geometry={GEO.sphere} material={GLOW} scale={[0.55, 0.55, 0.55]} />
          </group>
        </group>
      ))}
      {/* 발파 스위치: 나무 상자 + 붉은 손잡이 + 안내판 */}
      <group position={[SWITCH[0], 0, SWITCH[2]]}>
        <mesh geometry={GEO.box} position={[0, 0.45, 0]} scale={[0.9, 0.9, 0.6]} material={mat('#6b4a2e')} />
        <mesh geometry={GEO.box} position={[0, 1.15, 0]} scale={[0.08, 0.6, 0.08]} material={mat('#2b2a29')} />
        <mesh geometry={GEO.box} position={[0, 1.45, 0]} scale={[0.5, 0.1, 0.1]} material={mat('#c9302c')} />
        <mesh position={[0, 2.2, 0]}>
          <planeGeometry args={[3.2, 0.5]} />
          <meshBasicMaterial map={switchSign} side={THREE.DoubleSide} />
        </mesh>
      </group>
      {/* 발파 연출 */}
      <group ref={fx} position={[GOV_CENTER[0], 0, GOV_CENTER[2]]} visible={false}>
        {[0, 1, 2, 3, 4].map((i) => (
          <mesh key={i} ref={(m) => (fire.current[i] = m)} geometry={GEO.sphere} position={[(i - 2) * 4, 2 + (i % 2) * 3, (i % 3) - 1]}>
            <meshStandardMaterial color="#ffb347" emissive="#ff7a1f" emissiveIntensity={2} transparent opacity={0.85} />
          </mesh>
        ))}
        {debris.map((_, i) => (
          <mesh key={i} ref={(m) => (dust.current[i] = m)} geometry={GEO.ico} material={i % 3 ? DUST : FIRE} />
        ))}
      </group>
      {/* 철거 뒤: 잔디 + 태극기 + 안내판 + 철거 현장 울타리 */}
      <group ref={after} position={[GOV_CENTER[0], 0, GOV_CENTER[2]]} visible={false}>
        <mesh position={[0, 0.08, 0]} rotation-x={-Math.PI / 2}>
          <planeGeometry args={[26, 18]} />
          <meshStandardMaterial color="#7fae5a" roughness={1} />
        </mesh>
        <Instances
          geometry={GEO.box}
          material={mat('#ffffff')}
          items={[
            ...Array.from({ length: 14 }, (_, i) => ({ p: [-13 + i * 2, 0.6, -9.2], s: [0.12, 1.2, 0.12], c: '#d9d2c2' })),
            ...Array.from({ length: 14 }, (_, i) => ({ p: [-13 + i * 2, 0.6, 9.2], s: [0.12, 1.2, 0.12], c: '#d9d2c2' })),
            { p: [0, 1.0, -9.2], s: [26, 0.08, 0.08], c: '#c9302c' },
            { p: [0, 1.0, 9.2], s: [26, 0.08, 0.08], c: '#c9302c' },
          ]}
        />
        <mesh geometry={GEO.cyl8} position={[0, 4, -6]} scale={[0.08, 8, 0.08]} material={mat('#e8e8e8', { metalness: 0.3 })} />
        <mesh position={[0.95, 7.2, -6]}>
          <planeGeometry args={[1.8, 1.2]} />
          <meshBasicMaterial map={flag} side={THREE.DoubleSide} />
        </mesh>
        <mesh position={[0, 1.4, -8.9]} rotation-y={Math.PI}>
          <planeGeometry args={[6, 0.6]} />
          <meshBasicMaterial map={plaque} side={THREE.DoubleSide} />
        </mesh>
      </group>
    </>
  )
}

// 총독부 건물을 발파 때 가라앉히고, 철거된 동안은 숨겨요 (HjGovernmentGeneral이 씀)
export function useGovBuilding(ref) {
  useFrame(() => {
    const g = ref.current
    if (!g) return
    if (!govDown()) {
      g.visible = true
      g.position.y = 0
      g.rotation.z = 0
      return
    }
    const { blastAt } = useGov.getState()
    const t = blastAt ? (performance.now() - blastAt) / 1000 : 99
    if (t < 4.5) {
      g.visible = true
      g.position.y = -t * t * 1.1
      g.rotation.z = Math.sin(t * 3) * 0.01 + t * 0.012
    } else g.visible = false
  })
}

// 화면 가운데 배너 (발파 직후 9초)
export function GovBanner() {
  const blastAt = useGov((s) => s.blastAt)
  const [, setTick] = useState(0)
  useEffect(() => {
    if (!blastAt) return undefined
    const id = setTimeout(() => setTick((t) => t + 1), Math.max(0, 9100 - (performance.now() - blastAt)))
    return () => clearTimeout(id)
  }, [blastAt])
  const fresh = blastAt && performance.now() - blastAt < 9000
  if (!fresh) return null
  return (
    <div className="hj-enter" role="status" aria-live="polite">
      <div className="hj-enter__banner ui-interactive">
        <span className="ui-eyebrow">광복 프로젝트</span>
        <h2>🇰🇷 조선총독부가 철거되고, 경복궁을 되찾았어요!</h2>
        <p className="hj-enter__tagline">1926년 경복궁 앞을 막아 지은 조선총독부 청사는 광복 50주년 1995년 8월 15일 철거가 시작되어 경복궁 복원이 이어졌어요.</p>
        <p>10분 동안 이 자리에 태극기가 휘날려요 · 다시 하려면 독립의 증거를 또 모아요</p>
      </div>
    </div>
  )
}
