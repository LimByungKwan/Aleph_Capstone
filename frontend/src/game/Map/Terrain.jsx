import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { CuboidCollider, CylinderCollider, RigidBody, TrimeshCollider } from '@react-three/rapier'
import * as THREE from 'three'
import { layout } from '../data/mapData.js'
import { buildDeck, buildHill, buildPlatform, buildStairs, ringPieces, terrainHeightAt, TOWER, towerColliderPieces } from './terrain.js'
import { Cyl, GEO, Instances, mat, texMat } from './styles/kit.jsx'
import { getTiledTexture, TILE_METERS } from './styles/textures.js'
import { meadowBlend } from './meadowBlend.js'
import { DeckGate, TowerDecor, towerDecorColliders } from './styles/dateCourse.jsx'
import { registerLift, sendLift, useLiftCall } from './styles/bk_liftSync.js'
import { LiftCallHud } from './styles/bk_liftCall.jsx'

// 구역 파일의 "terrain" 항목을 그림: 언덕(hill), 데크 산책로(deck), 계단(stairs), 들어갈 수 있는 전망 타워(tower)
// 화면용(<Terrain />), 충돌용(<TerrainColliders />), 움직이는 엘리베이터(<Elevators />)가 같은 계산 결과를 써요.

const HILL_MATERIAL = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.95 })
let meadowMaterial

function getMeadowMaterial() {
  if (!meadowMaterial) {
    const { center = [0, 0], size } = layout.ground
    const tile = TILE_METERS.grass
    const grass = getTiledTexture('grass', 1 / tile, 1 / tile)
    grass.offset.set((size[0] / 2 - center[0]) / tile, (size[1] / 2 + center[1]) / tile)
    meadowMaterial = new THREE.MeshStandardMaterial({ map: grass, vertexColors: true, roughness: 1 })
    meadowMaterial.onBeforeCompile = meadowBlend(size, center)
  }
  return meadowMaterial
}
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
// [지민 11/26 최적화] 줄 전구는 지름 14cm라 공을 덜 쪼개도 똑같이 보임 (삼각형 140 → 36개, 전구 1천여 개라 약 10만 개 줄어듦)
const BULB_GEO = new THREE.SphereGeometry(1, 6, 4)

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
      <Instances geometry={BULB_GEO} material={BULB} items={bulbs} />
    </group>
  )
}

function HillMesh({ hill }) {
  const { geometry } = buildHill(hill)
  const material = hill.surface === 'meadow' ? getMeadowMaterial() : HILL_MATERIAL
  return <mesh geometry={geometry} material={material} receiveShadow name={hill.id} />
}

function DeckMesh({ deck }) {
  const { boards, rails, railPosts, supports, start } = buildDeck(deck, layout.terrain)
  return (
    <group name={deck.id}>
      {/* deck.color가 있으면 그 색 발판 (예: 흔들다리와 이어지는 데크는 다리와 같은 진한 갈색) */}
      <Instances geometry={GEO.box} material={deck.color ? mat(deck.color, { flat: true }) : WOOD} items={boards} castShadow />
      <Instances geometry={GEO.box} material={WOOD_DARK} items={rails} />
      <Instances geometry={GEO.box} material={WOOD_DARK} items={railPosts} />
      <Instances geometry={GEO.box} material={WOOD_DARK} items={supports} castShadow />
      {/* 입구 아치 + 안내 간판 (deck.gate, 모양은 dateCourse.jsx) */}
      {deck.gate && start && <DeckGate gate={deck.gate} position={start.p} yaw={start.yaw} width={deck.width ?? 2.4} />}
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
        // 문 자리(반각 liftDoorHalf)를 비운 원통 벽 (CylinderGeometry 각도 0 = +z)
        groundShaft: new THREE.CylinderGeometry(T.shaftRadius, T.shaftRadius, T.tubeBottom, 40, 1, true, T.liftDoorHalf, Math.PI * 2 - T.liftDoorHalf * 2),
        deckShaft: new THREE.CylinderGeometry(T.shaftRadius, T.shaftRadius, T.deckWallHeight, 40, 1, true, Math.PI + T.liftDoorHalf, Math.PI * 2 - T.liftDoorHalf * 2),
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
      {/* 꼭대기 깜빡이는 등 + 안테나 LED 링은 TowerDecor(dateCourse.jsx)에서 */}
      {/* 엘리베이터 통로 유리벽: 1층(바닥 ~ 통로 시작)과 전망층(바닥 ~ 천장), 문 자리만 비움 */}
      <mesh geometry={geo.groundShaft} material={GLASS} position={[0, T.tubeBottom / 2, 0]} />
      <mesh geometry={geo.deckShaft} material={GLASS} position={[0, T.deckFloor + T.deckWallHeight / 2, 0]} />
      <LiftDoor towerId={tower.id} level={0} angle={0} y={0} />
      <LiftDoor towerId={tower.id} level={1} angle={Math.PI} y={T.deckFloor} />

      {/* 벤치·망원경·하트 프레임·매표 부스·전등·LED 띠 (BK dateCourse.jsx) */}
      <TowerDecor T={T} />
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
// 진짜 엘리베이터처럼 단계별로 움직임:
//   타기(발판에 0.6초) → 문 스르륵 닫힘 → 1초 뒤 출발 → 천천히 출발해 가운데서 빠르고 도착 전 천천히(부드러운 가감속)
//   → 도착 후 1초 뒤 문 스르륵 열림. 다른 층에 있으면 문 앞에서 [엘리베이터 호출] 버튼으로 부름 (bk_liftCall.jsx)
//   여러 명: 발판에 올라서면 3초 탑승 대기(새 사람이 타면 연장, 최대 8초), [바로 출발]·[잠깐만요! 열림] (규칙: shared/bk_liftCore.js)
// 멀티: 운행 시작 신호를 서버가 모두에게 보내고(bk_liftSync.js · server/src/bk_lifts.js), 각 화면은 "시작 후 몇 초"로
//   단계를 계산 → 다른 사람이 타고 올라가도 내 화면에서 같은 엘리베이터가 같은 시간에 문 닫고 움직임
const LIFT_AVG_SPEED = 4.5 // m/s (평균 속도, 가운데에서는 이보다 빠르고 출발·도착은 느림)
const LIFT_BOARD_WAIT = 0.6 // 발판에 올라선 뒤 문이 닫히기 시작할 때까지(초)
const LIFT_DOOR_TIME = 1.1 // 문이 다 열리거나 닫히는 데 걸리는 시간(초)
const LIFT_PAUSE = 1 // 문 닫힌 뒤 출발까지, 도착 뒤 문 열리기까지(초)
// 타워 id → 엘리베이터 상태 { at, y, door, phase } (화면 쪽 LiftDoor가 읽음)
//   at: 지금 서 있는(또는 마지막으로 선) 층 0/1, door: 그 층 문이 열린 정도 0~1
const liftStates = new Map()
// 그 층 문이 얼마나 열렸는지 (0 닫힘 ~ 1 열림)
const doorAmount = (s, level) => (s && s.at === level && s.phase !== 'moving' ? (s.door ?? 0) : 0)
// 부드럽게: 처음과 끝이 느린 곡선
const smooth = (t) => t * t * (3 - 2 * t)
const easeInOut = (t) => 0.5 - 0.5 * Math.cos(Math.PI * t)

// ── 엘리베이터 문 (화면): 코랄 문틀 + 양쪽으로 미끄러지는 문짝 2장 + 위 도착 표시등
// 문짝은 유리 (통로 유리벽과 같은 느낌) + 가는 테두리로 문인 걸 알 수 있게
const DOOR_PANEL = mat('#e6f4ff', { transparent: true, opacity: 0.28, roughness: 0.1, double: true })
const DOOR_EDGE = mat('#f3ece4', { roughness: 0.4, metalness: 0.3 })
const DOOR_STRIPE = mat('#f9a8d4')
const DOOR_FRAME = mat('#ff8a7a')

function LiftDoor({ towerId, level, angle, y }) {
  const T = TOWER
  const left = useRef(null)
  const right = useRef(null)
  const open = useRef(0)
  const lampMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#fff1c9', emissive: '#ffcf6b', emissiveIntensity: 0.1 }), [])
  // 문 자리 폭(현 길이)과 위치: 통로 벽 바깥쪽에 붙임
  const width = 2 * T.shaftRadius * Math.sin(T.liftDoorHalf)
  const r = T.shaftRadius * Math.cos(T.liftDoorHalf) + 0.02
  const h = T.liftDoorHeight
  // 문짝은 통로 원을 따라(유리벽 바로 안쪽) 돌아가며 열림 → 유리벽 뒤로 숨고 바깥으로 튀어나오지 않음
  const half = T.liftDoorHalf
  const rp = T.shaftRadius - 0.12
  const panelW = 2 * rp * Math.sin(half / 2) + 0.03
  const place = (ref, side, o) => {
    const g = ref.current
    if (!g) return
    const phi = side * (half / 2 + o * half * 0.98) // 문짝 가운데 각도
    g.position.set(Math.sin(phi) * rp, y, Math.cos(phi) * rp)
    g.rotation.y = phi
  }
  useFrame(() => {
    // 엘리베이터가 정한 열림 정도를 부드러운 곡선으로 (처음·끝이 천천히)
    const o = smooth(doorAmount(liftStates.get(towerId), level))
    if (o === open.current && left.current?.userData.placed) return
    open.current = o
    place(left, -1, o)
    place(right, 1, o)
    if (left.current) left.current.userData.placed = true
    lampMat.emissiveIntensity = 0.1 + o * 1.6
  })
  return (
    <group rotation={[0, angle, 0]}>
      {/* 문짝 2장 (위치·회전은 useFrame에서 원을 따라 정함) */}
      {[left, right].map((ref, i) => (
        <group key={i} ref={ref} position={[(i ? 1 : -1) * Math.sin(half / 2) * rp, y, Math.cos(half / 2) * rp]} rotation={[0, (i ? 1 : -1) * (half / 2), 0]}>
            <mesh geometry={GEO.box} material={DOOR_PANEL} position={[0, h / 2, 0]} scale={[panelW, h, 0.05]} />
            <mesh geometry={GEO.box} material={DOOR_STRIPE} position={[0, h * 0.55, 0.03]} scale={[panelW * 0.8, 0.08, 0.01]} />
            {/* 유리 문짝 테두리 (위·아래·양옆) */}
            <mesh geometry={GEO.box} material={DOOR_EDGE} position={[0, h - 0.03, 0]} scale={[panelW, 0.06, 0.07]} />
            <mesh geometry={GEO.box} material={DOOR_EDGE} position={[0, 0.03, 0]} scale={[panelW, 0.06, 0.07]} />
            {[-1, 1].map((sd) => (
              <mesh key={sd} geometry={GEO.box} material={DOOR_EDGE} position={[sd * (panelW / 2 - 0.03), h / 2, 0]} scale={[0.06, h, 0.07]} />
            ))}
        </group>
      ))}
      <group position={[0, y, r]}>
        {/* 문틀 + 위 헤더 + 도착 표시등 */}
        {[-1, 1].map((sd) => (
          <mesh key={sd} geometry={GEO.box} material={DOOR_FRAME} position={[sd * (width / 2 + 0.08), (h + 0.3) / 2, 0]} scale={[0.16, h + 0.3, 0.2]} />
        ))}
        <mesh geometry={GEO.box} material={DOOR_FRAME} position={[0, h + 0.2, 0]} scale={[width + 0.32, 0.22, 0.2]} />
        <mesh geometry={GEO.sphere} material={lampMat} position={[0, h + 0.2, 0.12]} scale={[0.08, 0.08, 0.04]} />
      </group>
    </group>
  )
}

export function Elevators({ playerRef }) {
  return layout.terrain.filter((item) => item.type === 'tower').map((tower) => <Elevator key={tower.id} tower={tower} playerRef={playerRef} />)
}

function Elevator({ tower, playerRef }) {
  const T = TOWER
  const bodyRef = useRef(null)
  const [cx, cz] = tower.position
  const baseY = towerBaseY(tower)
  const levels = [0.3, T.deckFloor] // 발판 윗면 높이 (타워 바닥 기준): 아래층, 전망대
  // phase: 'open'(문 열림, 대기) → 'closing' → 'depart'(1초) → 'moving' → 'arrive'(1초) → 'opening' → 'open'
  const initial = () => ({ at: 0, y: levels[0], door: 1, phase: 'open', timer: 0, waitLeave: false, trip: null, boarding: null, boarded: false })
  const state = useRef(initial())
  const doorColliders = useRef([])
  const doorEnabled = useRef([null, null])
  useLayoutEffect(() => {
    liftStates.set(tower.id, state.current)
    return () => liftStates.delete(tower.id)
  }, [tower.id])
  // 문 자리 충돌 박스 (1층 = 각도 0, 전망층 = 각도 π). 문이 닫혀 있을 때만 켬
  const doorBoxes = useMemo(() => {
    const width = 2 * T.shaftRadius * Math.sin(T.liftDoorHalf)
    const r = T.shaftRadius * Math.cos(T.liftDoorHalf)
    return [
      { p: [0, T.tubeBottom / 2, r], s: [width, T.tubeBottom, 0.2] },
      { p: [0, T.deckFloor + T.deckWallHeight / 2, -r], s: [width, T.deckWallHeight, 0.2] },
    ]
  }, [T])

  // 운행표: 문 닫힘(D) → 출발 대기(P) → 이동(M) → 도착 대기(P) → 문 열림(D). 서버(bk_lifts.js tripMs)와 같은 길이
  const D = LIFT_DOOR_TIME
  const P = LIFT_PAUSE
  const M = Math.max(1.5, Math.abs(levels[1] - levels[0]) / LIFT_AVG_SPEED)
  const TOTAL = 2 * D + 2 * P + M
  const send = (t, extra = {}) => sendLift({ t, towerId: tower.id, ...extra })

  // 알림 받기 (멀티: 서버가 모두에게 / 혼자: 이 화면의 같은 규칙) → 모든 화면이 같은 장면
  useEffect(
    () =>
      registerLift(tower.id, (msg) => {
        const s = state.current
        const at = performance.now()
        if (msg.t === 'lift.trip') {
          s.trip = { from: msg.from, to: msg.to, start: at - (msg.elapsed ?? 0) }
          s.boarding = null
        } else if (msg.t === 'lift.boarding') {
          // 탑승 대기 (remaining null = 취소). 문이 닫히던 중이면 다시 열림(운행 취소)
          s.boarding = msg.remaining == null ? null : { to: msg.to, end: at + msg.remaining, riders: msg.riders }
          if (s.boarding && s.trip) s.trip = null
        } else if (msg.t === 'lift.state') {
          s.trip = msg.trip ? { from: msg.trip.from, to: msg.trip.to, start: at - msg.trip.elapsed } : null
          s.boarding = msg.boarding ? { to: msg.boarding.to, end: at + msg.boarding.remaining, riders: msg.boarding.riders } : null
          if (!msg.trip) s.at = msg.at
        }
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tower.id],
  )

  useFrame((_, delta) => {
    const body = bodyRef.current
    if (!body) return
    const s = state.current
    // 개발 중 코드가 새로고침 없이 바뀌면(HMR) 예전 모양의 상태가 남아 문이 멈출 수 있음 → 처음 상태로
    if (s.phase === undefined || s.boarded === undefined) Object.assign(s, initial())
    const dt = Math.min(delta, 0.05)
    const prevY = s.y
    const player = playerRef?.current
    let onLift = false
    let nearLevel = -1 // 엘리베이터 문 앞에 서 있는 층 (버튼용)
    if (player) {
      const p = player.currPos
      const dist = Math.hypot(p.x - cx, p.z - cz)
      const feet = p.y - baseY
      onLift = dist < T.liftRadius && feet > s.y - 0.2 && feet < s.y + 1.8
      levels.forEach((lv, i) => {
        if (dist < T.shaftRadius + 2.5 && feet > lv - 0.5 && feet < lv + 2.5) nearLevel = i
      })
    }

    if (s.trip) {
      // 운행 중: 시작한 지 몇 초인지로 단계·높이·문 열림을 계산 (모든 화면이 같은 값)
      const e = (performance.now() - s.trip.start) / 1000
      const { from, to } = s.trip
      if (e < D) Object.assign(s, { phase: 'closing', at: from, door: Math.max(0, 1 - e / D), y: levels[from] })
      else if (e < D + P) Object.assign(s, { phase: 'depart', at: from, door: 0, y: levels[from], timer: e - D })
      else if (e < D + P + M) Object.assign(s, { phase: 'moving', at: from, door: 0, y: levels[from] + (levels[to] - levels[from]) * easeInOut((e - D - P) / M) })
      else if (e < D + 2 * P + M) Object.assign(s, { phase: 'arrive', at: to, door: 0, y: levels[to], timer: e - D - P - M })
      else if (e < TOTAL) Object.assign(s, { phase: 'opening', at: to, door: Math.min(1, (e - D - 2 * P - M) / D), y: levels[to] })
      else {
        Object.assign(s, { phase: 'open', at: to, door: 1, y: levels[to], timer: 0, waitLeave: onLift }) // 타고 온 사람이 내릴 때까지 다시 출발 X
        s.trip = null
        s.boarded = false
      }
    } else {
      // 서 있음 (다시 열리는 중이면 문을 부드럽게 끝까지 엶)
      Object.assign(s, { phase: 'open', door: Math.min(1, s.door + dt / D), y: levels[s.at] })
      if (s.waitLeave && !onLift) s.waitLeave = false
      // 발판에 올라서면 탑승(대기 3초, 다른 사람이 타면 연장) / 내리면 빠짐
      if (onLift && !s.waitLeave && !s.boarded) {
        s.boarded = true
        send('lift.board')
      } else if (!onLift && s.boarded) {
        s.boarded = false
        send('lift.off')
      }
    }
    // 닫히는 문으로 뛰어든 사람 → 다시 열어 달라고 (규칙이 다시 열고 대기로)
    if (s.phase === 'closing' && onLift && !s.boarded) {
      s.boarded = true
      send('lift.board')
    }

    // 화면 버튼 상태
    const seconds = s.boarding ? Math.max(0, Math.ceil((s.boarding.end - performance.now()) / 1000)) : 0
    let mode = null
    if (onLift && !s.trip) mode = 'rider' // 발판 위: 카운트다운 + [바로 출발] (막 도착했으면 [출발])
    else if (nearLevel !== -1 && nearLevel === s.at && (s.boarding || s.phase === 'closing')) mode = 'hold' // 문 앞, 곧 떠남 → [열림]
    else if (nearLevel !== -1 && s.trip && s.trip.to === nearLevel) mode = 'coming'
    else if (nearLevel !== -1 && !onLift && (s.trip ? s.trip.to !== nearLevel : s.at !== nearLevel)) mode = 'call'
    const ui = useLiftCall.getState()
    if (ui.mode !== mode || ui.level !== nearLevel || ui.seconds !== seconds || ui.riders !== (s.boarding?.riders ?? 0) || ui.towerId !== tower.id) {
      useLiftCall.setState({
        towerId: tower.id,
        mode,
        level: nearLevel,
        seconds,
        riders: s.boarding?.riders ?? 0,
        to: s.boarding?.to ?? 1 - s.at,
        actions: {
          call: () => send('lift.call', { to: nearLevel }),
          go: () => send('lift.go'),
          hold: () => send('lift.hold'),
          board: () => {
            state.current.waitLeave = false
            state.current.boarded = true
            send('lift.board')
          },
        },
      })
    }

    body.setNextKinematicTranslation({ x: cx, y: baseY + s.y - 0.15, z: cz })

    // 캐릭터 태우기: 캐릭터는 바닥 위에 스프링처럼 떠 있어서(ecctrl) 발판이 가속·감속하면 통통 튐
    // → 출발 직전 서 있던 높이를 기억해 두고, 움직이는 동안은 그 높이·발판 속도로 같이 옮김
    const rider = player?.body
    if (rider) {
      const top = baseY + s.y
      if (s.phase === 'depart' && onLift) s.rideOffset = player.currPos.y - top
      if (s.phase === 'open' || s.phase === 'opening') s.rideOffset = null
      const carrying = (s.phase === 'moving' || (s.phase === 'arrive' && s.timer < 0.35)) && onLift && s.rideOffset != null
      if (carrying) {
        const pos = rider.translation()
        const vel = rider.linvel()
        rider.setTranslation({ x: pos.x, y: top + s.rideOffset, z: pos.z }, true)
        rider.setLinvel({ x: vel.x, y: s.phase === 'moving' && dt > 0 ? (s.y - prevY) / dt : 0, z: vel.z }, true)
      }
    }

    // 문 충돌: 문이 거의 다 열렸을 때만 끄고, 닫히기 시작하면 바로 켬
    doorColliders.current.forEach((collider, level) => {
      const enabled = doorAmount(s, level) < 0.85 || s.phase === 'closing'
      if (collider && doorEnabled.current[level] !== enabled) {
        collider.setEnabled(enabled)
        doorEnabled.current[level] = enabled
      }
    })
  })

  return (
    <>
      <RigidBody ref={bodyRef} type="kinematicPosition" colliders={false} position={[cx, baseY + levels[0] - 0.15, cz]} name={`lift-${tower.id}`}>
        <CylinderCollider args={[0.15, T.liftRadius]} />
        <Cyl p={[0, 0, 0]} rad={T.liftRadius} h={0.3} m={CORAL} geo={GEO.cyl48} receiveShadow />
        <Cyl p={[0, 0.16, 0]} rad={T.liftRadius - 0.3} h={0.02} m={mat('#ffe4e6')} geo={GEO.cyl48} />
      </RigidBody>
      <LiftCallHud towerId={tower.id} />
      <RigidBody type="fixed" colliders={false} position={[cx, baseY, cz]} rotation={[0, yawOf(tower), 0]} name={`lift-doors-${tower.id}`}>
        {doorBoxes.map((box, i) => (
          <CuboidCollider key={i} ref={(c) => (doorColliders.current[i] = c)} args={[box.s[0] / 2, box.s[1] / 2, box.s[2] / 2]} position={box.p} />
        ))}
      </RigidBody>
    </>
  )
}
