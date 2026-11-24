import { useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useGameStore } from '../../../store/gameStore.js'
import { useUiStore } from '../../../components/movieZone/uiStore.js'
import { GEO, mat, texMat } from './kit.jsx'
import { getSignTexture } from './textures.js'
import { UNLOCK_RANGE, WARPS, isLoggedIn, useWarps } from './bk_warpStore.js'

// 장소 근처에서 평평하고 비어 있는 자리 찾기 (바닥 높이를 재서 3×3m가 고른 곳). 못 찾으면 null
const ray = new THREE.Raycaster()
const DOWN = new THREE.Vector3(0, -1, 0)
function findSpot(scene, cx, cz) {
  const meshes = []
  scene.traverse((o) => {
    if (o.isMesh && o.visible && !o.isInstancedMesh && !o.isSkinnedMesh) meshes.push(o)
  })
  ray.far = 140
  const height = (x, z) => {
    ray.set(new THREE.Vector3(x, 70, z), DOWN)
    return ray.intersectObjects(meshes, false)[0]?.point.y ?? null
  }
  for (const r of [0, 2.5, 3.5, 4.5, 5.5, 7, 9]) {
    for (let a = 0; a < (r ? 16 : 1); a++) {
      const x = cx + Math.cos((a / 16) * Math.PI * 2) * r
      const z = cz + Math.sin((a / 16) * Math.PI * 2) * r
      const ys = []
      for (const dx of [-1, 0, 1]) for (const dz of [-1, 0, 1]) ys.push(height(x + dx, z + dz))
      if (ys.some((y) => y === null)) continue
      // 지붕 위(평평한 옥상)는 빼려고 데이트 코스 땅 높이(0~10m)만
      if (Math.max(...ys) - Math.min(...ys) < 0.15 && ys[4] < 12) return [x, ys[4], z]
    }
  }
  return null
}

// 구역 워프존 그림 + 켜기 + 순간 이동 (담당: 병관). Scene.jsx에서 playerRef를 받아 씀 (혜진 님 PalaceTourPresence와 같은 방식)
// - 꺼진 워프존: 회색 원판 + 자물쇠 / 켜진 워프존: 구역 색으로 빛나는 원판 + 빛기둥이 천천히 돔
// - 로그인한 상태로 4m 안에 들어오면 켜짐 → 알림 / 미니맵에서 고른 워프존으로 캐릭터를 옮김 (bk_warpStore.js)

const OFF = { ring: mat('#9ca3af'), base: mat('#6b7280') }
const ARRIVE_OFFSET = new THREE.Vector3(0, 1.6, 0.8) // 도착: 원판 위 조금 앞 (위치를 고를 때 빈 땅인지 잰 범위 안)

export function WarpZones({ playerRef }) {
  const scene = useThree((s) => s.scene)
  const unlocked = useWarps((s) => s.unlocked)
  const spinners = useRef([])
  const lastCheck = useRef(0)

  useFrame((state) => {
    const t = state.clock.elapsedTime
    spinners.current.forEach((m, i) => m && (m.rotation.y = t * 0.6 + i))
    const player = playerRef?.current
    if (!player?.currPos) return

    // 순간 이동 요청 처리
    const { request, done } = useWarps.getState()
    if (request && player.body && typeof request === 'object') {
      // 구역 안 장소로 (데이트 코스 미션): 기준점 근처의 빈 자리를 찾아서
      done()
      let cx
      let cz
      if (request.anchor) {
        const obj = scene.getObjectByName(request.anchor.name)
        if (obj) {
          const p = obj.localToWorld(new THREE.Vector3(...request.anchor.local))
          cx = p.x
          cz = p.z
        }
      } else if (request.center) [cx, cz] = request.center
      const spot = cx === undefined ? null : findSpot(scene, cx, cz)
      if (spot) {
        player.body.setTranslation({ x: spot[0], y: spot[1] + 1.6, z: spot[2] }, true)
        player.body.setLinvel({ x: 0, y: 0, z: 0 }, true)
        useGameStore.getState().close()
        if (request.label) useUiStore.getState().toast(`🌀 ${request.label}(으)로 이동했어요`, 'ok')
        request.onArrive?.()
      } else useUiStore.getState().toast('이동할 자리를 찾지 못했어요. 걸어서 가 주세요.', 'info')
      return
    }
    if (request && player.body) {
      const warp = WARPS.find((w) => w.id === request)
      done()
      if (warp) {
        const [x, y, z] = warp.position
        player.body.setTranslation({ x: x + ARRIVE_OFFSET.x, y: y + ARRIVE_OFFSET.y, z: z + ARRIVE_OFFSET.z }, true)
        player.body.setLinvel({ x: 0, y: 0, z: 0 }, true)
        useGameStore.getState().close()
        useUiStore.getState().toast(`🌀 ${warp.icon} ${warp.name} 구역으로 이동했어요`, 'ok')
      }
      return
    }

    // 켜기 판정 (0.3초마다)
    if (t - lastCheck.current < 0.3) return
    lastCheck.current = t
    if (!isLoggedIn()) return
    const { x, z } = player.currPos
    for (const warp of WARPS) {
      if (Math.hypot(warp.position[0] - x, warp.position[2] - z) < UNLOCK_RANGE && useWarps.getState().unlock(warp.id)) {
        useUiStore.getState().toast(`🌀 워프존 활성화: ${warp.icon} ${warp.name} — 미니맵에서 눌러 언제든 이동할 수 있어요`, 'ok')
      }
    }
  })

  return (
    <group>
      {WARPS.map((warp, i) => (
        <WarpPad key={warp.id} warp={warp} on={unlocked.includes(warp.id)} spinRef={(el) => (spinners.current[i] = el)} />
      ))}
    </group>
  )
}

function WarpPad({ warp, on, spinRef }) {
  const glow = useMemo(() => mat(warp.color, { emissive: warp.color, emissiveIntensity: 1.2 }), [warp.color])
  const beam = useMemo(() => new THREE.MeshBasicMaterial({ color: warp.color, transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide }), [warp.color])
  const sign = useMemo(
    () => texMat(getSignTexture(`${on ? '🌀' : '🔒'} 워프존 · ${warp.name}`, on ? '#1f1440' : '#374151', on ? '#ffffff' : '#d1d5db', 2.4 / 0.42), { emissive: '#ffffff', emissiveIntensity: on ? 0.4 : 0.1 }),
    [on, warp.name],
  )
  const [x, y, z] = warp.position
  return (
    <group position={[x, y, z]} name={warp.id}>
      {/* 바닥 원판 + 테두리 */}
      <mesh geometry={GEO.cyl48} material={on ? OFF.base : OFF.base} position={[0, 0.04, 0]} scale={[1.6, 0.08, 1.6]} receiveShadow />
      <mesh geometry={GEO.cyl48} material={on ? glow : OFF.ring} position={[0, 0.09, 0]} scale={[1.35, 0.02, 1.35]} />
      <mesh geometry={GEO.cyl48} material={OFF.base} position={[0, 0.1, 0]} scale={[1.05, 0.02, 1.05]} />
      {/* 켜지면 천천히 도는 빛 고리 + 빛기둥 */}
      {on && (
        <>
          <group ref={spinRef} position={[0, 0.13, 0]}>
            {[0, 1, 2, 3].map((k) => (
              <mesh key={k} geometry={GEO.box} material={glow} position={[Math.sin((k * Math.PI) / 2) * 1.2, 0, Math.cos((k * Math.PI) / 2) * 1.2]} rotation={[0, (k * Math.PI) / 2, 0]} scale={[0.5, 0.04, 0.14]} />
            ))}
          </group>
          <mesh geometry={GEO.cyl48} material={beam} position={[0, 1.6, 0]} scale={[1.1, 3.2, 1.1]} userData={{ noShadow: true }} />
        </>
      )}
      {/* 안내판 */}
      <mesh geometry={GEO.box} material={OFF.base} position={[0, 1.1, -1.75]} scale={[0.08, 2.2, 0.08]} />
      <mesh geometry={GEO.plane} material={sign} position={[0, 2.25, -1.72]} scale={[2.4, 0.42, 1]} />
    </group>
  )
}
