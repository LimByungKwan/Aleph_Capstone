import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { CuboidCollider, CylinderCollider, RigidBody, TrimeshCollider } from '@react-three/rapier'
import * as THREE from 'three'
import { layout } from '../data/mapData.js'
import { buildDeck, buildHill, buildPlatform, buildStairs, ringPieces, terrainHeightAt, TOWER, towerColliderPieces } from './terrain.js'
import { Ball, Cyl, GEO, Instances, mat, texMat } from './styles/kit.jsx'
import { getTiledTexture } from './styles/textures.js'
import { TowerDecor, towerDecorColliders } from './styles/dateCourse.jsx'

// 구역 파일의 "terrain" 항목을 그림: 언덕(hill), 데크 산책로(deck), 계단(stairs), 들어갈 수 있는 전망 타워(tower)
// 화면용(<Terrain />), 충돌용(<TerrainColliders />), 움직이는 엘리베이터(<Elevators />)가 같은 계산 결과를 써요.

const HILL_MATERIAL = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.95 })
const WOOD = mat('#c08a5a', { flat: true })
const WOOD_DARK = mat('#8b5e3c')
const STAIR_STONE = mat('#d8cfc6', { flat: true })
const CREAM = mat('#fbf3e6')
const CORAL = mat('#ff8a7a')
const PINK = mat('#f9a8d4')
const GLASS = mat('#e6f4ff', { transparent: true, opacity: 0.25, emissive: '#ffd9a8', emissiveIntensity: 0.25, roughness: 0.1, double: true })
const WARM_WINDOW = mat('#fff3da', { emissive: '#ffcf8a', emissiveIntensity: 0.55, roughness: 0.3 })
const DECK_FLOOR = mat('#e9dccb', { double: true })

const towerBaseY = (tower) => terrainHeightAt(layout.terrain, tower.position[0], tower.position[1])
const yawOf = (item) => THREE.MathUtils.degToRad(item.rotationDeg ?? 0)

export default function Terrain() {
  return layout.terrain.map((item) => {
    if (item.type === 'hill') return <HillMesh key={item.id} hill={item} />
    if (item.type === 'deck') return <DeckMesh key={item.id} deck={item} />
    if (item.type === 'stairs') return <StairsMesh key={item.id} stairs={item} />
    if (item.type === 'tower') return <TowerMesh key={item.id} tower={item} />
    if (item.type === 'platform') return <PlatformMesh key={item.id} platform={item} />
    return null
  })
}

// ── 테라스 단: 돌 옹벽 몸통 + 위 포장 바닥 + 난간 + 줄 전구 ──
const RAIL_MAT = mat('#3b3633')
const BULB = mat('#fff6d8', { emissive: '#ffd27a', emissiveIntensity: 1.6 })

function PlatformMesh({ platform }) {
  const { body, rails, railPosts, bulbs, lightPosts } = buildPlatform(platform)
  const [w, h, d] = body.s
  const materials = useMemo(
    () => ({
      wall: texMat(getTiledTexture('stone', Math.max(w, d) / 2, h / 2)),
      top: texMat(getTiledTexture(platform.surface ?? 'paver', w / 2, d / 2)),
    }),
    [w, h, d, platform.surface],
  )
  return (
    <group name={platform.id}>
      <mesh geometry={GEO.box} material={materials.wall} position={body.p} scale={body.s} castShadow receiveShadow />
      <mesh geometry={GEO.box} material={materials.top} position={[body.p[0], h + 0.02, body.p[2]]} scale={[w, 0.04, d]} receiveShadow />
      <Instances geometry={GEO.box} material={RAIL_MAT} items={rails} />
      <Instances geometry={GEO.box} material={RAIL_MAT} items={railPosts} />
      <Instances geometry={GEO.box} material={RAIL_MAT} items={lightPosts} />
      <Instances geometry={GEO.sphere} material={BULB} items={bulbs} />
    </group>
  )
}

function HillMesh({ hill }) {
  const { geometry } = buildHill(hill)
  return <mesh geometry={geometry} material={HILL_MATERIAL} receiveShadow name={hill.id} />
}

function DeckMesh({ deck }) {
  const { boards, rails, railPosts, supports } = buildDeck(deck, layout.terrain)
  return (
    <group name={deck.id}>
      <Instances geometry={GEO.box} material={WOOD} items={boards} castShadow />
      <Instances geometry={GEO.box} material={WOOD_DARK} items={rails} />
      <Instances geometry={GEO.box} material={WOOD_DARK} items={railPosts} />
      <Instances geometry={GEO.box} material={WOOD_DARK} items={supports} castShadow />
    </group>
  )
}

function StairsMesh({ stairs }) {
  const { steps, walls } = buildStairs(stairs)
  return (
    <group name={stairs.id}>
      <Instances geometry={GEO.box} material={STAIR_STONE} items={steps} castShadow />
      <Instances geometry={GEO.box} material={mat('#b9aea4', { flat: true })} items={walls} castShadow />
    </group>
  )
}

// ── 전망 타워 (화면) ──────────────────────────
const ringGeometry = (inner, outer) => new THREE.RingGeometry(inner, outer, 48).rotateX(-Math.PI / 2)
const tubeGeometry = (radius) => new THREE.CylinderGeometry(radius, radius, 1, 40, 1, true)

function TowerMesh({ tower }) {
  const T = TOWER
  const baseY = towerBaseY(tower)
  const top = T.deckFloor + T.deckWallHeight

  const parts = useMemo(() => {
    const door = (a) => Math.abs(Math.atan2(Math.sin(a), Math.cos(a))) < T.doorHalfAngle
    return {
      hallBase: ringPieces({ radius: T.hallRadius, thickness: 0.4, y0: 0, y1: 1, count: 28, skip: door }),
      hallGlass: ringPieces({ radius: T.hallRadius, thickness: 0.3, y0: 1, y1: 3.2, count: 28, skip: door }),
      hallTop: ringPieces({ radius: T.hallRadius, thickness: 0.4, y0: 3.2, y1: T.hallHeight, count: 28 }),
      deckMullions: ringPieces({ radius: T.deckRadius, thickness: 0.12, y0: T.deckFloor, y1: top, count: 24 }).map((m) => ({ ...m, s: [0.12, m.s[1], 0.12] })),
      columns: [0.25, 0.75, 1.25, 1.75].map((k) => ({
        p: [Math.sin(k * Math.PI) * (T.shaftRadius + 0.05), T.deckFloor / 2, Math.cos(k * Math.PI) * (T.shaftRadius + 0.05)],
        s: [0.18, T.deckFloor, 0.18],
      })),
      geo: {
        hallRoof: ringGeometry(T.shaftRadius + 0.05, T.hallRadius + 0.3),
        deckFloor: ringGeometry(T.shaftRadius + 0.05, T.deckRadius),
        tube: tubeGeometry(T.shaftRadius),
        deckWall: tubeGeometry(T.deckRadius),
        band: tubeGeometry(1),
        under: new THREE.CylinderGeometry(T.deckRadius, T.shaftRadius, 3, 40, 1, true),
      },
    }
  }, [T])
  const { geo } = parts

  return (
    <group position={[tower.position[0], baseY, tower.position[1]]} rotation={[0, yawOf(tower), 0]} name={tower.id}>
      {/* 1층 홀: 아래 크림 벽 + 따뜻한 유리창 + 위 벽, 문은 로컬 +z */}
      <Instances geometry={GEO.box} material={CREAM} items={parts.hallBase} castShadow />
      <Instances geometry={GEO.box} material={WARM_WINDOW} items={parts.hallGlass} />
      <Instances geometry={GEO.box} material={CREAM} items={parts.hallTop} castShadow />
      <mesh geometry={geo.hallRoof} material={mat('#f3e7d6', { double: true })} position={[0, T.hallHeight, 0]} castShadow />
      <mesh geometry={geo.band} material={CORAL} position={[0, T.hallHeight - 0.1, 0]} scale={[T.hallRadius + 0.32, 0.35, T.hallRadius + 0.32]} />

      {/* 엘리베이터 통로: 기둥 4개 + 유리관 + 분홍 띠 */}
      <Instances geometry={GEO.box} material={CREAM} items={parts.columns} castShadow />
      <mesh geometry={geo.tube} material={GLASS} position={[0, (T.tubeBottom + T.deckFloor) / 2, 0]} scale={[1, T.deckFloor - T.tubeBottom, 1]} />
      {[0.38, 0.6, 0.82].map((k) => T.deckFloor * k).map((y) => (
        <mesh key={y} geometry={geo.band} material={PINK} position={[0, y, 0]} scale={[T.shaftRadius + 0.08, 0.35, T.shaftRadius + 0.08]} />
      ))}

      {/* 전망대: 아래 원뿔 + 바닥 + 360° 유리벽 + 코랄 띠 + 지붕 + 안테나 */}
      <mesh geometry={geo.under} material={mat('#fbf3e6', { double: true })} position={[0, T.deckFloor - 1.5, 0]} castShadow />
      <mesh geometry={geo.deckFloor} material={DECK_FLOOR} position={[0, T.deckFloor + 0.01, 0]} />
      <mesh geometry={geo.band} material={CORAL} position={[0, T.deckFloor + 0.2, 0]} scale={[T.deckRadius + 0.05, 0.4, T.deckRadius + 0.05]} />
      <mesh geometry={geo.deckWall} material={GLASS} position={[0, T.deckFloor + T.deckWallHeight / 2, 0]} scale={[1, T.deckWallHeight, 1]} />
      <Instances geometry={GEO.box} material={CREAM} items={parts.deckMullions} />
      <mesh geometry={geo.band} material={CORAL} position={[0, top + 0.1, 0]} scale={[T.deckRadius + 0.1, 0.4, T.deckRadius + 0.1]} />
      <Cyl p={[0, top + 0.4, 0]} rad={T.deckRadius + 0.4} h={0.3} m={CREAM} geo={GEO.cyl48} />
      <mesh geometry={GEO.dome} material={CREAM} position={[0, top + 0.55, 0]} scale={[T.deckRadius - 1, 2.2, T.deckRadius - 1]} castShadow />
      <Cyl p={[0, top + 3, 0]} rad={0.35} h={0.6} m={PINK} />
      <Cyl p={[0, top + 4.6, 0]} rad={0.12} h={3.2} c="#e5e7eb" geo={GEO.cyl8} />
      <Ball p={[0, top + 6.3, 0]} rad={0.2} m={mat('#ff9fb5', { emissive: '#ff5c8a', emissiveIntensity: 1 })} />
      {/* 엘리베이터 구멍 둘레 낮은 유리 난간 */}
      <mesh geometry={geo.tube} material={GLASS} position={[0, T.deckFloor + 0.55, 0]} scale={[1, 1.1, 1]} />

      {/* 벤치·망원경·하트 프레임·매표 부스·전등·LED 띠·안내판 (BK dateCourse.jsx) */}
      <TowerDecor T={T} yaw={yawOf(tower)} />
    </group>
  )
}

// ── 충돌 ─────────────────────────────────────
// 데크·계단·테라스 단의 충돌 박스는 고정 몸체 하나에 모두 담음 (물리 계산 절약)
// 언덕(삼각형 메시)과 타워(회전된 묶음)만 따로
export function TerrainColliders() {
  const staticBoxes = useMemo(
    () =>
      layout.terrain.flatMap((item) => {
        if (item.type === 'deck') {
          const { boards, railBlocks } = buildDeck(item, layout.terrain)
          return [...boards, ...railBlocks]
        }
        if (item.type === 'stairs') {
          const { ramp, walls } = buildStairs(item)
          return [ramp, ...walls]
        }
        if (item.type === 'platform') {
          const { body, railBlocks } = buildPlatform(item)
          return [body, ...railBlocks]
        }
        return []
      }),
    [],
  )

  return (
    <>
      <BoxSet name="terrain-static" boxes={staticBoxes} />
      {layout.terrain.map((item) => {
        if (item.type === 'hill') {
          const { vertices, indices } = buildHill(item)
          return (
            <RigidBody key={item.id} type="fixed" colliders={false} name={`collider-${item.id}`}>
              <TrimeshCollider args={[vertices, indices]} />
            </RigidBody>
          )
        }
        if (item.type === 'tower') {
          return (
            <BoxSet
              key={item.id}
              name={item.id}
              boxes={[...towerColliderPieces(), ...towerDecorColliders(TOWER)]}
              position={[item.position[0], towerBaseY(item), item.position[1]]}
              rotation={[0, yawOf(item), 0]}
            />
          )
        }
        return null
      })}
    </>
  )
}

const NO_ROTATION = [0, 0, 0]

function BoxSet({ name, boxes, position, rotation }) {
  return (
    <RigidBody type="fixed" colliders={false} name={`collider-${name}`} position={position} rotation={rotation}>
      {boxes.map((box, i) => (
        <CuboidCollider key={i} args={[box.s[0] / 2, box.s[1] / 2, box.s[2] / 2]} position={box.p} rotation={box.r ?? NO_ROTATION} />
      ))}
    </RigidBody>
  )
}

// ── 엘리베이터 (타워마다 하나) ────────────────
// 발판에 서 있으면 0.6초 뒤 반대쪽(위↔아래)으로 이동. 다른 층에서 통로 가까이 오면 그 층으로 와 줌.
const LIFT_SPEED = 6 // m/s
const LIFT_WAIT = 0.6 // 초

export function Elevators({ playerRef }) {
  return layout.terrain.filter((item) => item.type === 'tower').map((tower) => <Elevator key={tower.id} tower={tower} playerRef={playerRef} />)
}

function Elevator({ tower, playerRef }) {
  const T = TOWER
  const bodyRef = useRef(null)
  const [cx, cz] = tower.position
  const baseY = towerBaseY(tower)
  const levels = [0.3, T.deckFloor] // 발판 윗면 높이 (타워 바닥 기준): 아래층, 전망대
  const state = useRef({ level: 0, y: levels[0], moving: false, waitLeave: false, timer: 0 })

  useFrame((_, delta) => {
    const body = bodyRef.current
    if (!body) return
    const s = state.current
    const dt = Math.min(delta, 0.05)
    const player = playerRef?.current
    let onLift = false
    let callLevel = -1
    if (player) {
      const p = player.currPos
      const dist = Math.hypot(p.x - cx, p.z - cz)
      const feet = p.y - baseY
      onLift = dist < T.liftRadius && feet > s.y - 0.2 && feet < s.y + 1.8
      levels.forEach((lv, i) => {
        if (i !== s.level && dist < T.shaftRadius + 1.6 && feet > lv - 0.5 && feet < lv + 2.5) callLevel = i
      })
    }

    if (s.moving) {
      const target = levels[s.level]
      const step = LIFT_SPEED * dt * Math.sign(target - s.y)
      s.y = Math.abs(target - s.y) <= Math.abs(step) ? target : s.y + step
      if (s.y === target) {
        s.moving = false
        s.waitLeave = onLift
        s.timer = 0
      }
    } else if (s.waitLeave) {
      if (!onLift) s.waitLeave = false
    } else if (onLift) {
      s.timer += dt
      if (s.timer > LIFT_WAIT) {
        s.level = 1 - s.level
        s.moving = true
      }
    } else if (callLevel !== -1) {
      s.level = callLevel
      s.moving = true
    } else {
      s.timer = 0
    }

    body.setNextKinematicTranslation({ x: cx, y: baseY + s.y - 0.15, z: cz })
  })

  return (
    <RigidBody ref={bodyRef} type="kinematicPosition" colliders={false} position={[cx, baseY + levels[0] - 0.15, cz]} name={`lift-${tower.id}`}>
      <CylinderCollider args={[0.15, T.liftRadius]} />
      <Cyl p={[0, 0, 0]} rad={T.liftRadius} h={0.3} m={CORAL} geo={GEO.cyl48} receiveShadow />
      <Cyl p={[0, 0.16, 0]} rad={T.liftRadius - 0.3} h={0.02} m={mat('#ffe4e6')} geo={GEO.cyl48} />
    </RigidBody>
  )
}
