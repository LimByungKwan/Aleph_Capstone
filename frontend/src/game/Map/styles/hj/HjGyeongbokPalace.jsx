import { useMemo } from 'react'
import { useSeason } from '../../../seasons.js'
import {
  BufferGeometry,
  CanvasTexture,
  CustomBlending,
  DoubleSide,
  ExtrudeGeometry,
  Float32BufferAttribute,
  FrontSide,
  MeshBasicMaterial,
  MeshStandardMaterial,
  OneMinusSrcAlphaFactor,
  Path,
  RepeatWrapping,
  SRGBColorSpace,
  Shape,
  ShapeGeometry,
  SrcAlphaFactor,
} from 'three'
import { Box, Cyl, GEO, Instances, mat, texMat } from '../kit.jsx'
import { TiledRoof, arches } from './HjPalace.jsx'
import { Deumu, Haetae } from './HjGyeongbok.jsx'
import HjThroneHall from './HjThroneHall.jsx'
import { Samdo, StoneFloor } from './HjPalaceGround.jsx'
import { useHallDoors, usePalaceGuide } from '../../../../components/movieZone/palaceGuide.js'
import { GEO_COL12, GEO_HEX, HanokHall, HexRoof, StoneRail, Willows, WoodRail, ashlarMat, dancheongMat, latticeMat } from './HjHanok.jsx'
import { getSagwaeTexture, getBirdCofferTexture, getCofferCeilingTexture, getFlowerWallTexture, getMaruTexture, getPaperDoorTexture } from './hjTextures.js'
import { THRONE_DOOR_WIDTH } from './gyeongbokgungLayout.js'
import { THRONE_ROOM_POSITION } from '../../../../components/movieZone/palaceInteriorLayout.js'
import {
  AMISAN,
  BOUNDS,
  CORRIDORS,
  COURT,
  GWANGHWAMUN,
  GEUNJEONG_UPPER_RAILS,
  GUIDE_BOARD,
  GYEONGHOERU,
  GYEONGHOERU_STAIR,
  HAETAE,
  HALLS,
  HYANGWON,
  HYANGWON_HOLE,
  HYANGWON_STAIR,
  HYANGWON_UPPER_OPEN,
  HYANGWON_Y1,
  PALACE_ORIGIN_Z,
  PONDS,
  PUMGYE_ROWS,
  TREES,
  WALLS,
  WALL_H,
  WALL_T,
  WILLOWS,
  gyeonghoeruDeckRails,
  gyeonghoeruInnerRing,
  gyeonghoeruPillars,
  gyeonghoeruRails,
} from './gyeongbokLayout.js'

// [3. 개발 > 프론트엔드] 압축 경복궁 (style: "hjGyeongbokPalace") — 혜진 영화·드라마 구역
// 배치는 gyeongbokLayout.js 한 곳에서 정해요. 전각 구조(기단·기둥·창호·단청·공포·지붕)는 HjHanok.jsx.
// 충돌 박스는 hj_drama.json의 gb_* 항목이에요. 배치를 바꾸면 frontend 폴더에서
//   node scripts/hj-gyeongbok-colliders.mjs
// 로 다시 만들어요.
//
// 좌표: 아이템 기준(근정전 실내·착석이 쓰는 좌표) = 배치 파일의 A 좌표 - PALACE_ORIGIN_Z.
const PLASTER = '#e3d7bd'
const STONE = '#c9c0ab'
const STONE_LIGHT = '#ddd6c5'
const STONE_DARK = '#a79f8c'
const GROUND_Y = 0.17 // 마당 바닥 높이
const WATER_Y = -0.5 // 연못 물 높이 (마당보다 낮게 꺼져 있어요)
const PARTS = mat('#ffffff', { roughness: 0.9 })
const WATER = mat('#3f7f86', { roughness: 0.08, metalness: 0.35, emissive: '#16424a', emissiveIntensity: 0.3 })
const LOTUS = mat('#5f8a4d', { roughness: 0.8 })
const LANTERN = mat('#ffdf9b', { emissive: '#fbad55', emissiveIntensity: 0.9 })
// 연못: 공용 잔디 바닥(높이 0)이 꺼진 물을 덮지 않게, 물속 부품을 먼저 그리고(UNDERWATER)
// 연못 위에 깊이만 쓰는 투명 뚜껑(POND_LID)을 그 다음에 그려요 → 잔디는 그 자리에서 깊이 검사에 져서 안 그려져요
const MIRROR = -3 // 물에 비친 모습 (가장 먼저)
const UNDERWATER = -2
const POND_LID = -1
const LID = new MeshBasicMaterial({ colorWrite: false })
const HIDDEN = new MeshBasicMaterial({ visible: false }) // 카메라 가림막 (안 보임)

export default function HjGyeongbokPalace({ item }) {
  const [w, h, d] = item.size
  const closedDoors = useHallDoors((s) => s.closed) // 전각 문 열림·닫힘 (E로 바꿔요)
  return (
    <group scale={[w / 53, h / 9, d / 53]}>
      {/* ── 근정전 (아이템 기준 좌표: 실내·착석 기능과 같은 좌표계) ── */}
      <Geunjeongjeon />

      {/* ── 나머지 궁궐 (배치 파일 A 좌표) ── */}
      <group position={[0, 0, -PALACE_ORIGIN_Z]}>
        <Grounds />
        <Court />
        <Gwanghwamun />
        {WALLS.map((wall, i) => (
          <Wall key={i} from={[wall[0], wall[1]]} to={[wall[2], wall[3]]} />
        ))}
        {HALLS.map((hall) => (
          <HanokHall
            key={hall.id}
            position={[hall.ax, GROUND_Y, hall.az]}
            rotation={((hall.rotation ?? 0) * Math.PI) / 180}
            width={hall.w}
            depth={hall.d}
            height={hall.h}
            bays={hall.bays}
            sideBays={hall.sideBays}
            base={hall.base ?? 0.45}
            mode={hall.mode ?? 'closed'}
            roof={hall.roof}
            upper={hall.upper}
            ridge={hall.ridge ?? true}
            woldae={hall.woldae ?? 0}
            ornate={hall.ornate ?? true}
            japsang={hall.japsang ?? 0}
            plain={hall.plain ?? false}
            lattice={hall.lattice ?? 'tti'}
            enterable={Boolean(hall.solid)}
            furnish={hall.furnish ?? 'room'}
            doorClosed={Boolean(closedDoors[hall.id])}
            allWindows={hall.windows === 'all'}
            latticeBar={hall.latticeBar}
            merumColor={hall.merumColor ?? '#ebe2cd'}
            title={hall.title}
          />
        ))}
        {CORRIDORS.map((c) => (
          <HanokHall
            key={c.id}
            position={[c.ax, GROUND_Y, c.az]}
            rotation={((c.rotation ?? 0) * Math.PI) / 180}
            width={c.w}
            depth={c.d}
            height={c.h}
            bays={Math.max(2, Math.round(c.w / 2.4))}
            sideBays={1}
            base={0.15}
            mode="corridor"
            roof="gable"
            ornate={false}
          />
        ))}
        {PONDS.map((pond) => (
          <Pond key={pond.id} {...pond} reflect={pond.id === 'hyangwon_pond'} avoid={pond.id === 'hyangwon_pond' ? HYANGWON_LOTUS_AVOID : []} />
        ))}
        <Gyeonghoeru />
        <Hyangwonjeong />
        <Willows spots={WILLOWS} />
        <Amisan />
        <PumgyeRows />
        {HAETAE.map(([ax, az], i) => (
          <Haetae key={i} position={[ax, 0, az]} flip={ax > 0 ? -1 : 1} />
        ))}
        <Lanterns />
        <GuideBoard />
        <Pines />
      </group>
    </group>
  )
}

// ── 근정전: 2단 월대(장대석 + 돌난간 + 답도 계단) 위 중층 전각 ──
// 충돌 박스(gb_core_*)와 같은 자리에 맞춰 그려요. 실내(어좌·방석)는 HjPalaceInterior가 그려요.
const THRONE_FACADE = { x: 6.6, zFront: -3.28, zBack: 3.28 }
const LOWER_RAILS = [
  [-8.52, 6.48, -8.52, 18.69],
  [8.52, 6.48, 8.52, 18.69],
  [-8.52, 6.48, -2.75, 6.48],
  [2.75, 6.48, 8.52, 6.48],
]
function Geunjeongjeon() {
  const steps = [0.23, 0.36, 0.49, 0.62, 0.75]
  return (
    <>
      {/* 아랫단·윗단 월대 (장대석 옆면) */}
      <mesh geometry={GEO.box} material={ashlarMat(18, 0.61)} position={[0, 0.47, 13.3]} scale={[18, 0.61, 14.2]} />
      <Box p={[0, 0.785, 13.3]} s={[18.1, 0.03, 14.3]} c={STONE_LIGHT} />
      <mesh geometry={GEO.box} material={ashlarMat(15.8, 0.3)} position={[0, 0.81, 13.6]} scale={[15.8, 0.22, 12.3]} />
      <Box p={[0, 0.925, 13.6]} s={[15.9, 0.02, 12.4]} c="#d7cfbd" />
      {/* 앞 계단 + 소맷돌 + 가운데 답도(봉황 새긴 경사 판석) */}
      {steps.map((stepH, index) => (
        <Box key={stepH} p={[0, stepH / 2, 4.58 + index * 0.36]} s={[4.75, stepH, 0.37]} c={PLASTER} />
      ))}
      <Box p={[0, 0.5, 5.3]} s={[1.3, 0.05, 1.95]} r={[-0.36, 0, 0]} c="#e8e1cf" />
      {[-1, 1].map((s) => (
        <Box key={s} p={[s * 2.48, 0.45, 5.3]} s={[0.22, 0.22, 2.05]} r={[-0.36, 0, 0]} c={STONE_LIGHT} />
      ))}
      <StoneRail segments={LOWER_RAILS} y={0.775} h={0.6} />
      <StoneRail segments={GEUNJEONG_UPPER_RAILS} y={0.92} h={0.6} />
      {/* 월대 모서리 돌짐승 (십이지신상 자리) */}
      {[
        [-8.52, 6.48],
        [8.52, 6.48],
        [-7.75, 7.6],
        [7.75, 7.6],
      ].map(([x, z]) => (
        <group key={`${x}${z}`} position={[x, x * x > 70 ? 1.43 : 1.58, z]}>
          <Box p={[0, 0.1, 0]} s={[0.26, 0.22, 0.34]} c="#cfc7b4" />
          <Box p={[0, 0.26, -0.12]} s={[0.18, 0.16, 0.16]} c="#cfc7b4" />
        </group>
      ))}
      <HanokHall
        position={THRONE_ROOM_POSITION}
        width={14.2}
        depth={8.1}
        height={3.8}
        bays={5}
        sideBays={5}
        base={0}
        mode="interior"
        roof="hipgable"
        upper
        japsang={7}
        doorWidth={THRONE_DOOR_WIDTH}
        facade={THRONE_FACADE}
        lattice="bit"
        title="근정전"
      />
      <group position={THRONE_ROOM_POSITION}>
        <HjThroneHall />
      </group>
      <Deumu />
      <pointLight position={[0, 3.6, 8.7]} color="#ffd293" intensity={27} distance={13} />
    </>
  )
}

// 향원정 연못 연꽃을 피하지 않을 자리 (섬·다리) [x, z, 반지름]
const HYANGWON_LOTUS_AVOID = [
  [HYANGWON.ax, HYANGWON.az, HYANGWON.islandR + 0.35],
  [HYANGWON.ax, HYANGWON.az + 3.4, 0.9],
  [HYANGWON.ax, HYANGWON.az + 4.6, 0.9],
]

// 큰 네모에서 연못 자리를 뺀 조각들 (바닥을 연못 구멍만 비우고 깔려고)
function cutRects([x0, x1, z0, z1], holes) {
  const xs = [...new Set([x0, x1, ...holes.flatMap((r) => [r[0], r[1]])])].filter((x) => x >= x0 && x <= x1).sort((a, b) => a - b)
  const zs = [...new Set([z0, z1, ...holes.flatMap((r) => [r[2], r[3]])])].filter((z) => z >= z0 && z <= z1).sort((a, b) => a - b)
  const out = []
  for (let i = 0; i < xs.length - 1; i += 1) {
    let start = null
    for (let j = 0; j < zs.length - 1; j += 1) {
      const cx = (xs[i] + xs[i + 1]) / 2
      const cz = (zs[j] + zs[j + 1]) / 2
      const inHole = holes.some((r) => cx > r[0] && cx < r[1] && cz > r[2] && cz < r[3])
      if (!inHole && start === null) start = zs[j]
      if ((inHole || j === zs.length - 2) && start !== null) {
        const end = inHole ? zs[j] : zs[j + 1]
        out.push([xs[i], xs[i + 1], start, end])
        start = null
      }
    }
  }
  return out
}

// 바닥: 장대석 받침 + 마당은 네모 화강석 포석, 근정전 마당은 불규칙 박석, 가운데 삼도, 후원은 잔디 (HjPalaceGround.jsx)
const LAWN_Z = 46.3 // 침전 뒤 담장 너머 후원 (잔디)
function Grounds() {
  const { minX, maxX, minZ, maxZ } = BOUNDS
  const ponds = useMemo(() => PONDS.map((p) => [p.ax - p.w / 2, p.ax + p.w / 2, p.az - p.d / 2, p.az + p.d / 2]), [])
  const base = useMemo(
    () =>
      cutRects([minX - 0.6, maxX + 0.6, minZ - 0.6, maxZ + 0.6], ponds).map(([a, b, c, e]) => ({
        p: [(a + b) / 2, -0.12, (c + e) / 2],
        s: [b - a, 0.36, e - c],
        c: '#8b9273',
      })),
    [minX, maxX, minZ, maxZ, ponds],
  )
  // 포석: 연못·근정전 마당·후원 잔디 자리는 빼요 (겹쳐 깜빡이지 않게)
  const paved = useMemo(
    () => cutRects([minX - 0.6, maxX + 0.6, minZ - 0.6, maxZ + 0.6], [...ponds, COURT, [minX - 1, maxX + 1, LAWN_Z, maxZ + 1]]),
    [minX, maxX, minZ, maxZ, ponds],
  )
  const backLawn = useMemo(() => {
    const holes = PONDS.map((p) => [p.ax - p.w / 2 - 0.4, p.ax + p.w / 2 + 0.4, p.az - p.d / 2 - 0.4, p.az + p.d / 2 + 0.4])
    return cutRects([minX - 0.6, maxX + 0.6, LAWN_Z, maxZ + 0.6], holes).map(([a, b, c, e]) => ({ p: [(a + b) / 2, 0.15, (c + e) / 2], s: [b - a, 0.04, e - c], c: '#9fb07c' }))
  }, [minX, maxX, maxZ])
  return (
    <>
      <Instances geometry={GEO.box} material={PARTS} items={base} />
      <StoneFloor kind="paver" rects={paved} y={0.1675} />
      <Instances geometry={GEO.box} material={PARTS} items={backLawn} />
      {/* 삼도: 광화문 → 근정전 계단 (가운데 어도가 높고, 긴 장대석 테두리로 나뉜 세 길) */}
      <Samdo z0={GWANGHWAMUN.az} z1={COURT[3]} y={0.17} />
    </>
  )
}

// 근정전 마당 박석 (크기·모양이 제각각인 넓적한 화강암 판석, 줄눈에 흙과 풀)
function Court() {
  const rects = useMemo(() => [COURT], [])
  return <StoneFloor kind="bakseok" rects={rects} y={0.172} />
}

// 광화문: 무지개문 3개가 뚫린 장대석 석축 + 여장(작은 담) + 2층 문루(우진각)
function Gwanghwamun() {
  const { az, depth, title } = GWANGHWAMUN
  const crenels = useMemo(() => {
    const list = []
    for (const s of [-1, 1]) {
      for (let i = 0; i < 14; i += 1) list.push({ p: [-6.3 + i * 0.97, 3.27, az + s * (depth / 2 - 0.12)], s: [0.7, 0.42, 0.24], c: '#d9d1bd' })
    }
    return list
  }, [az, depth])
  return (
    <>
      <mesh position={[0, 0.17, az - depth / 2]} material={ashlarMat(13.3, 3)}>
        <extrudeGeometry args={[arches, { depth, bevelEnabled: false, curveSegments: 16 }]} />
      </mesh>
      {/* 무지개문 안쪽 천장 (단청 대신 짙은 초록) */}
      {[
        [-3.9, 1.07],
        [0, 1.45],
        [3.9, 1.07],
      ].map(([x, r]) => (
        <Box key={x} p={[x, 0.17 + 2.65 - 0.02, az]} s={[r * 1.6, 0.04, depth - 0.02]} c="#2f5b4c" />
      ))}
      <Instances geometry={GEO.box} material={PARTS} items={crenels} />
      <HanokHall position={[0, 3.22, az]} width={12} depth={4.4} height={2.3} bays={3} sideBays={2} base={0} mode="open" roof="hip" upper japsang={7} title={title} />
      <pointLight position={[0, 3.6, az + 2.5]} color="#ffbb72" intensity={20} distance={12} />
    </>
  )
}

// 담장: 사괘석 벽 + 장대석 아랫단 + 기와 지붕
function Wall({ from, to }) {
  const [x0, z0] = from
  const [x1, z1] = to
  const length = Math.hypot(x1 - x0, z1 - z0)
  const angle = Math.atan2(-(z1 - z0), x1 - x0) // 담장 길이 방향 = 로컬 x
  return (
    <group position={[(x0 + x1) / 2, 0, (z0 + z1) / 2]} rotation-y={angle}>
      {/* 사괘석 담장: 네모 화강석 덩이를 엇갈려 쌓고 흰 줄눈 (사진 기반) */}
      <mesh geometry={GEO.box} material={repeatMat(getSagwaeTexture, Math.max(1, Math.round(length / 2)), Math.max(1, Math.round(WALL_H)))} position={[0, WALL_H / 2, 0]} scale={[length, WALL_H, WALL_T]} />
      <mesh geometry={GEO.box} material={ashlarMat(length, 0.7)} position={[0, 0.35, 0]} scale={[length + 0.05, 0.7, WALL_T + 0.08]} />
      <TiledRoof width={length + 0.3} depth={WALL_T + 0.6} rise={0.4} y={WALL_H + 0.1} />
    </group>
  )
}

// 연못: 마당보다 꺼진 물 + 장대석 호안(물가 돌벽) + 갑석 테두리 + 연잎
// reflect: 향원정 연못처럼 물에 정자가 비치게 — 물을 반투명하게 하고, 그 아래 거꾸로 뒤집은 정자(MIRROR)를 먼저 그려요.
//          물 밑은 깊고 어두운 못(뒤집힌 하늘 대신)이라 비친 모습만 또렷이 보여요. 연꽃도 피워요.
const REFLECT_WATER = new MeshStandardMaterial({
  color: '#2f5a5c',
  roughness: 0.05,
  metalness: 0.1,
  opacity: 0.38,
  blending: CustomBlending,
  blendSrc: SrcAlphaFactor,
  blendDst: OneMinusSrcAlphaFactor,
  emissive: '#0f2f33',
  emissiveIntensity: 0.25,
})
const LOTUS_PINK = mat('#f2a7bd', { roughness: 0.6 })
// 겨울 얼음: 희푸른 얼음판 (눈 덮개 셰이더가 위에 눈을 얹어요)
const ICE = new MeshStandardMaterial({ color: '#cfe1e8', roughness: 0.25, metalness: 0.05 })
const LOTUS_HEART = mat('#f6d76b', { emissive: '#c99a20', emissiveIntensity: 0.25 })
function Pond({ ax, az, w, d, reflect = false, avoid = [] }) {
  const winter = useSeason() === 'winter' // 겨울엔 연못이 얼고 연꽃은 져요
  const { coping, pads, petals, hearts, stems } = useMemo(() => {
    const c = [
      { p: [ax, GROUND_Y + 0.03, az - d / 2], s: [w + 0.5, 0.08, 0.5], c: STONE_LIGHT },
      { p: [ax, GROUND_Y + 0.03, az + d / 2], s: [w + 0.5, 0.08, 0.5], c: STONE_LIGHT },
      { p: [ax - w / 2, GROUND_Y + 0.03, az], s: [0.5, 0.08, d], c: STONE_LIGHT },
      { p: [ax + w / 2, GROUND_Y + 0.03, az], s: [0.5, 0.08, d], c: STONE_LIGHT },
    ]
    const clear = (x, z) => avoid.every(([cx, cz, r]) => Math.hypot(x - cx, z - cz) > r)
    const list = []
    const pet = []
    const hrt = []
    const stm = []
    const count = reflect ? 46 : 22
    for (let i = 0; i < count; i += 1) {
      const a = i * 2.39
      const r = 0.45 + ((i * 7) % 11) / 22
      const x = ax + Math.cos(a) * r * w * 0.46
      const z = az + Math.sin(a) * r * d * 0.46
      if (!clear(x, z)) continue
      const size = 0.28 + ((i * 5) % 7) * 0.05
      list.push({ p: [x, WATER_Y + 0.045, z], s: [size, 0.015, size], r: [0, a, 0] })
      // 연꽃: 연잎 몇 장마다 분홍 꽃 한 송이 (꽃잎 8장 + 노란 꽃술), 가끔 봉오리
      if (reflect && i % 3 === 0) {
        const fx = x + 0.15
        const fz = z - 0.1
        const fy = WATER_Y + 0.18
        stm.push({ p: [fx, WATER_Y + 0.09, fz], s: [0.012, 0.18, 0.012] })
        for (let k = 0; k < 8; k += 1) {
          const t = (k / 8) * Math.PI * 2
          pet.push({ p: [fx + Math.cos(t) * 0.07, fy + 0.04, fz + Math.sin(t) * 0.07], s: [0.05, 0.09, 0.03], r: [Math.sin(t) * 0.6, -t, Math.cos(t) * 0.6] })
        }
        hrt.push({ p: [fx, fy + 0.05, fz], s: [0.04, 0.03, 0.04] })
      } else if (reflect && i % 5 === 1) {
        stm.push({ p: [x - 0.1, WATER_Y + 0.15, z + 0.12], s: [0.012, 0.3, 0.012] })
        pet.push({ p: [x - 0.1, WATER_Y + 0.33, z + 0.12], s: [0.05, 0.09, 0.05] })
      }
    }
    return { coping: c, pads: list, petals: pet, hearts: hrt, stems: stm }
  }, [ax, az, w, d, reflect, avoid])
  const wallH = GROUND_Y - (WATER_Y - 0.6)
  const wallY = (GROUND_Y + WATER_Y - 0.6) / 2
  const walls = [
    [ax, az - d / 2 + 0.15, w, 0.3],
    [ax, az + d / 2 - 0.15, w, 0.3],
    [ax - w / 2 + 0.15, az, 0.3, d],
    [ax + w / 2 - 0.15, az, 0.3, d],
  ]
  return (
    <>
      {/* 비치는 연못: 물 아래 깊은 못 (뒤집힌 정자보다 먼저/함께 그려요) */}
      {reflect && (
        <group renderOrder={MIRROR}>
          <Box p={[ax, WATER_Y - 7, az]} s={[w, 0.2, d]} c="#14272a" />
          {walls.map(([x, z, sx, sz]) => (
            <Box key={`deep${x}${z}`} p={[x, WATER_Y - 3.5, z]} s={[sx, 7, sz]} c="#1c3133" />
          ))}
        </group>
      )}
      {/* 물속(마당보다 낮은 것)은 먼저 그리고, 그 위에 보이지 않는 뚜껑으로 공용 잔디 바닥을 가려요 */}
      <group renderOrder={UNDERWATER}>
        {!reflect && <Box p={[ax, WATER_Y - 0.6, az]} s={[w, 0.1, d]} c="#26352f" />}
        <Box p={[ax, WATER_Y, az]} s={[w - 0.05, 0.06, d - 0.05]} m={winter ? ICE : reflect ? REFLECT_WATER : WATER} />
        {walls.map(([x, z, sx, sz]) =>
          reflect ? (
            <mesh key={`${x}${z}`} geometry={GEO.box} material={ashlarMat(Math.max(sx, sz), GROUND_Y - WATER_Y)} position={[x, (GROUND_Y + WATER_Y) / 2, z]} scale={[sx, GROUND_Y - WATER_Y, sz]} />
          ) : (
            <mesh key={`${x}${z}`} geometry={GEO.box} material={ashlarMat(Math.max(sx, sz), wallH)} position={[x, wallY, z]} scale={[sx, wallH, sz]} />
          ),
        )}
        {!winter && (
          <>
            <Instances geometry={GEO.cyl8} material={LOTUS} items={pads} />
            <Instances geometry={GEO.cyl8} material={LOTUS} items={stems} />
            <Instances geometry={GEO.sphere} material={LOTUS_PINK} items={petals} />
            <Instances geometry={GEO.sphere} material={LOTUS_HEART} items={hearts} />
          </>
        )}
      </group>
      <group renderOrder={POND_LID}>
        <mesh geometry={GEO.box} material={LID} position={[ax, 0.02, az]} scale={[w - 0.02, 0.001, d - 0.02]} />
      </group>
      <Instances geometry={GEO.box} material={PARTS} items={coping} />
    </>
  )
}

// ── 경회루: 축대 + 돌기둥 48개 + 2층 누각(걸어서 올라가요) + 팔작지붕 + 돌다리 3개 ──
// 2층: 우물마루 바닥 · 계자난간(분홍 청판 + 안상) · 낙양각 · 안쪽 칸(내진)의 초록 번개살 칸막이
//      · 들어 올려 매단 문짝(들어열개) · 안쪽 우물반자 천장 · 단청 퇴보
function Gyeonghoeru() {
  const G = GYEONGHOERU
  const S = GYEONGHOERU_STAIR
  const [P0, P1] = G.platform
  const pond = PONDS[0]
  const deckY = G.pillarH + 0.32
  const bankX = pond.ax + pond.w / 2 - G.ax // 동쪽 물가 (경회루 기준)
  const inner = useMemo(() => gyeonghoeruInnerRing(), [])
  const { square, round, caps, stairs, bridgeParts, piers, ring, fret, hung, beams } = useMemo(() => {
    const sq = []
    const rd = []
    const cp = []
    for (const [x, z, outer] of gyeonghoeruPillars()) {
      const lx = x - G.ax
      const lz = z - G.az
      if (outer) sq.push({ p: [lx, G.pillarH / 2, lz], s: [0.44, G.pillarH, 0.44], c: '#d9d2c1' })
      else rd.push({ p: [lx, G.pillarH / 2, lz], s: [0.23, G.pillarH, 0.23], c: '#d9d2c1' })
      cp.push({ p: [lx, G.pillarH - 0.06, lz], s: [0.56, 0.12, 0.56], c: '#cfc7b4' })
    }
    // 나무 계단 (축대 남·북 끝 → 2층 마루). 계단 디딤판 = 충돌 박스 계단과 같은 높이
    const st = []
    const run = (S.xBottom - S.xTop) / S.steps
    const riseStep = deckY / S.steps
    for (const s of [-1, 1]) {
      const z = s * S.zOff
      for (let k = 0; k < S.steps; k += 1) {
        st.push({ p: [S.xBottom - (k + 0.5) * run, (k + 1) * riseStep - 0.03, z], s: [run + 0.02, 0.06, S.width], c: '#8a5a3c' })
      }
      const len = Math.hypot(S.xBottom - S.xTop, deckY)
      // 계단 꼭대기 끝 붉은 난간 기둥
      st.push({ p: [S.xTop - 0.08, deckY + 0.4, z], s: [0.1, 0.8, S.width + 0.1], c: '#8c382b' })
      for (const e of [-1, 1]) {
        st.push({ p: [(S.xBottom + S.xTop) / 2, deckY / 2, z + e * (S.width / 2 + 0.04)], s: [len, 0.24, 0.07], r: [0, 0, -Math.atan2(deckY, S.xBottom - S.xTop)], c: '#8c382b' })
        st.push({ p: [(S.xBottom + S.xTop) / 2, deckY / 2 + 0.8, z + e * (S.width / 2 + 0.04)], s: [len, 0.06, 0.06], r: [0, 0, -Math.atan2(deckY, S.xBottom - S.xTop)], c: '#8c382b' })
      }
    }
    // 돌다리 3개 (축대 동쪽 → 물가)
    const br = []
    const pr = [] // 다리 받침 (물속)
    const len = bankX - P0 / 2 + 0.3
    const cx = P0 / 2 + len / 2 - 0.15
    for (const b of G.bridges) {
      br.push({ p: [cx, -0.1, b], s: [len, 0.22, G.bridgeW], c: '#cdc5b2' })
      for (const t of [-0.25, 0.25]) pr.push({ p: [cx + t * len, -0.6, b], s: [0.5, 1.0, G.bridgeW - 0.3], c: STONE_DARK })
    }
    // 2층 안쪽 칸: 붉은 기둥 + 문지방
    const rg = []
    const ft = [] // 번개살 칸막이 (초록)
    for (const [x, z] of inner.cols) rg.push({ p: [x - G.ax, deckY + G.upperH / 2, z - G.az], s: [0.13, G.upperH, 0.13], c: '#8c382b' })
    for (const { a, b } of inner.bays) {
      const alongX = a[1] === b[1]
      const L = Math.abs(alongX ? b[0] - a[0] : b[1] - a[1]) - 0.26
      const mx = (a[0] + b[0]) / 2
      const mz = (a[1] + b[1]) / 2
      const P = (u, y) => (alongX ? [mx + u, deckY + y, mz] : [mx, deckY + y, mz + u])
      const Sz = (l, h, t) => (alongX ? [l, h, t] : [t, h, l])
      rg.push({ p: P(0, 0.04), s: Sz(L, 0.08, 0.16), c: '#8c382b' }) // 문지방
      rg.push({ p: P(0, 1.58), s: Sz(L, 0.1, 0.14), c: '#8c382b' }) // 중인방
      ft.push({ p: P(0, (1.64 + G.upperH - 0.28) / 2), s: Sz(L, G.upperH - 0.28 - 1.64, 0.05) }) // 위 교창
      for (const sgn of [-1, 1]) ft.push({ p: P(sgn * (L / 2 - 0.17), 0.82), s: Sz(0.34, 1.48, 0.05) }) // 양옆 좁은 칸막이
    }
    // 들어열개: 문짝을 위로 들어 올려 걸쇠에 매단 모습 (바깥 둘레 칸 천장 밑, 흰 종이 + 초록 테 + 쇠막대)
    const hg = []
    const [x0, x1, z0, z1] = inner.rect
    const ringX = G.w / 2 - 0.1 - x1 // 바깥 둘레 폭
    const zs = Array.from({ length: 8 }, (_, j) => -(G.d / 2 - 0.1) + (j * (G.d - 0.2)) / 7)
    const xs = Array.from({ length: 6 }, (_, i) => -(G.w / 2 - 0.1) + (i * (G.w - 0.2)) / 5)
    const hangY = deckY + G.upperH - 0.42
    const panel = (x, z, sx, sz) => {
      hg.push({ p: [x, hangY, z], s: [sx, 0.04, sz], c: '#f1ece0' })
      hg.push({ p: [x, hangY + 0.03, z], s: [sx + 0.04, 0.03, 0.05], c: '#4f8a6a' })
      hg.push({ p: [x, hangY + 0.03, z], s: [0.05, 0.03, sz + 0.04], c: '#4f8a6a' })
      for (const s of [-1, 1]) hg.push({ p: [x + (sx > sz ? s * sx * 0.35 : 0), hangY + 0.22, z + (sx > sz ? 0 : s * sz * 0.35)], s: [0.015, 0.4, 0.015], c: '#2b2b2b' })
    }
    for (let j = 0; j < 7; j += 1) {
      const zc = (zs[j] + zs[j + 1]) / 2
      for (const s of [-1, 1]) panel(s * (x1 + ringX / 2), zc, ringX * 0.7, zs[j + 1] - zs[j] - 0.3)
    }
    for (let i = 1; i < 4; i += 1) {
      const xc = (xs[i] + xs[i + 1]) / 2
      for (const s of [-1, 1]) panel(xc, s * (z1 + (G.d / 2 - 0.1 - z1) / 2), xs[i + 1] - xs[i] - 0.3, (G.d / 2 - 0.1 - z1) * 0.7)
    }
    // 퇴보: 바깥 기둥 → 안쪽 기둥을 잇는 단청 들보
    const bm = []
    for (const z of zs.slice(1, -1)) for (const s of [-1, 1]) bm.push({ p: [s * (x1 + ringX / 2), deckY + G.upperH - 0.16, z], s: [ringX, 0.26, 0.22] })
    for (const x of xs.slice(1, -1)) for (const s of [-1, 1]) bm.push({ p: [x, deckY + G.upperH - 0.16, s * (z1 + (G.d / 2 - 0.1 - z1) / 2)], s: [0.22, 0.26, G.d / 2 - 0.1 - z1] })
    void x0
    void z0
    return { square: sq, round: rd, caps: cp, stairs: st, bridgeParts: br, piers: pr, ring: rg, fret: ft, hung: hg, beams: bm }
  }, [G, S, deckY, P0, bankX, inner])
  const rails = useMemo(() => gyeonghoeruRails().map(([a, b, c, e]) => [a - G.ax, b - G.az, c - G.ax, e - G.az]), [G])
  const bridgeRails = useMemo(() => {
    const segs = []
    for (const b of G.bridges) for (const s of [-1, 1]) segs.push([P0 / 2, b + s * (G.bridgeW / 2 - 0.1), bankX, b + s * (G.bridgeW / 2 - 0.1)])
    return segs
  }, [G, P0, bankX])
  const deckRails = useMemo(() => gyeonghoeruDeckRails().map(([a, b, c, e]) => [a - G.ax, b - G.az, c - G.ax, e - G.az]), [G])
  const maru = useMemo(() => repeatMat(getMaruTexture, (G.w + 0.5) / 2, (G.d + 0.5) / 2), [G])
  const coffer = useMemo(() => {
    const [x0, x1, z0, z1] = inner.rect
    return { mat: repeatMat(getCofferCeilingTexture, (x1 - x0) / 1.2, (z1 - z0) / 1.2, true), w: x1 - x0, d: z1 - z0 }
  }, [inner])
  return (
    <group position={[G.ax, GROUND_Y, G.az]}>
      {/* 축대: 물에서 솟은 장대석 섬 */}
      <group renderOrder={UNDERWATER}>
        <mesh geometry={GEO.box} material={ashlarMat(P1, 1.3)} position={[0, -0.62, 0]} scale={[P0, 1.24, P1]} />
        <Instances geometry={GEO.box} material={PARTS} items={piers} />
      </group>
      <Box p={[0, 0.01, 0]} s={[P0 + 0.12, 0.04, P1 + 0.12]} c={STONE_LIGHT} />
      <StoneRail segments={rails} y={0.02} h={0.62} />
      {/* 돌기둥: 바깥 네모 24 + 안쪽 둥근 24 */}
      <Instances geometry={GEO.box} material={PARTS} items={square} />
      <Instances geometry={GEO.cyl} material={PARTS} items={round} />
      <Instances geometry={GEO.box} material={PARTS} items={caps} />
      {/* 마루 (아래는 짙은 나무, 위는 우물마루) + 마루 귀틀(단청) */}
      <Box p={[0, G.pillarH + 0.16, 0]} s={[G.w + 0.5, 0.3, G.d + 0.5]} c="#6d4b37" />
      <mesh position={[0, deckY + 0.002, 0]} rotation-x={-Math.PI / 2} material={maru}>
        <planeGeometry args={[G.w + 0.5, G.d + 0.5]} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={`x${s}`} geometry={GEO.box} material={dancheongMat(G.d)} position={[s * (G.w / 2 + 0.26), G.pillarH + 0.16, 0]} scale={[0.08, 0.3, G.d + 0.5]} />
      ))}
      {[-1, 1].map((s) => (
        <mesh key={`z${s}`} geometry={GEO.box} material={dancheongMat(G.w)} position={[0, G.pillarH + 0.16, s * (G.d / 2 + 0.26)]} scale={[G.w + 0.5, 0.3, 0.08]} />
      ))}
      <WoodRail segments={deckRails} y={deckY} h={0.72} panel />
      <Instances geometry={GEO.box} material={PARTS} items={stairs} />
      {/* 2층 안쪽 칸 + 번개살 칸막이 + 들어열개 + 퇴보 + 우물반자 */}
      <Instances geometry={GEO_COL12} material={PARTS} items={ring.filter((it) => it.s[1] > 1)} />
      <Instances geometry={GEO.box} material={PARTS} items={ring.filter((it) => it.s[1] <= 1)} />
      <Instances geometry={GEO.box} material={latticeMat('fret', '#3f7d5f', '#4f8a6a')} items={fret} />
      <Instances geometry={GEO.box} material={PARTS} items={hung} />
      <Instances geometry={GEO.box} material={dancheongMat(1.8)} items={beams} />
      <mesh position={[0, deckY + G.upperH - 0.02, 0]} rotation-x={Math.PI / 2} material={coffer.mat}>
        <planeGeometry args={[coffer.w, coffer.d]} />
      </mesh>
      {/* 위층 누각 (정면 7칸 × 옆 5칸, 동쪽을 바라봄) */}
      <HanokHall
        position={[0, deckY, 0]}
        rotation={-Math.PI / 2}
        width={G.d}
        depth={G.w}
        height={G.upperH}
        bays={7}
        sideBays={5}
        base={0}
        mode="open"
        roof="hipgable"
        japsang={7}
        nakyang
        title="경회루"
      />
      {/* 돌다리 */}
      <Instances geometry={GEO.box} material={PARTS} items={bridgeParts} />
      <StoneRail segments={bridgeRails} y={0.01} h={0.5} gap={1.1} />
      <pointLight position={[0, deckY + 1.4, 0]} color="#ffd49a" intensity={14} distance={11} />
    </group>
  )
}

// ── 향원정: 둥근 섬 위 육각 2층 정자 + 북쪽 나무다리(취향교) ──
// 1층: 남쪽 문으로 들어가요 (우물마루 · 흰 창호지 창 · 초록 머름 · 새 그림 반자)
// 2층: 1층 북쪽 벽을 따라 놓인 나무 계단으로 올라가요. 북·남 면이 열려 있어 난간 두른 툇마루로 나갈 수 있어요
// 연못에는 정자가 거꾸로 비쳐 보여요 (Pond reflect + 아래쪽 뒤집힌 정자)
function Hyangwonjeong() {
  const Y = HYANGWON
  const pond = PONDS[1]
  const bankZ = pond.az + pond.d / 2 - Y.az
  // 물에 비친 정자: 물 높이를 거울면으로 위아래를 뒤집어 그려요 (정자 기준 좌표의 물 높이 = WATER_Y - GROUND_Y)
  const mirrorY = 2 * (WATER_Y + 0.03 - GROUND_Y)
  return (
    <group position={[Y.ax, GROUND_Y, Y.az]}>
      {/* 섬: 돌 호안(물 위 부분) + 잔디 */}
      <group renderOrder={UNDERWATER}>
        <mesh geometry={GEO.cyl48} material={mat('#a59c88')} position={[0, (WATER_Y - GROUND_Y) / 2, 0]} scale={[Y.islandR, GROUND_Y - WATER_Y, Y.islandR]} />
        <HyangwonBridgePosts bankZ={bankZ} />
      </group>
      <HyangwonBody bankZ={bankZ} />
      <group renderOrder={MIRROR} position-y={mirrorY} scale={[1, -1, 1]}>
        <mesh geometry={GEO.cyl48} material={mat('#a59c88')} position={[0, (WATER_Y - GROUND_Y) / 2, 0]} scale={[Y.islandR, GROUND_Y - WATER_Y, Y.islandR]} />
        <HyangwonBody bankZ={bankZ} mirror />
      </group>
    </group>
  )
}

function HyangwonBridgePosts({ bankZ }) {
  const Y = HYANGWON
  const items = useMemo(() => {
    const z0 = Y.islandR - 0.2
    const z1 = bankZ + 0.3
    const list = []
    for (const t of [0.25, 0.5, 0.75]) {
      for (const s of [-1, 1]) list.push({ p: [s * (Y.bridgeW / 2 - 0.1), -0.4, z0 + (z1 - z0) * t], s: [0.12, 1.0, 0.12], c: '#5b4433' })
    }
    return list
  }, [Y, bankZ])
  return <Instances geometry={GEO.box} material={PARTS} items={items} />
}

// 육각형(꼭짓점 0°·60°…) 모양 + 네모 구멍 → 판 (2층 마루·1층 천장)
function hexPlate(r, hole) {
  const shape = new Shape()
  for (let k = 0; k <= 6; k += 1) {
    const a = (k * Math.PI) / 3
    // 모양 평면 (x, y) → 정자 (x, -z) : rotation-x = -π/2 로 눕혀요
    if (k === 0) shape.moveTo(Math.cos(a) * r, -Math.sin(a) * r)
    else shape.lineTo(Math.cos(a) * r, -Math.sin(a) * r)
  }
  if (hole) {
    const [x0, x1, z0, z1] = hole
    const h = new Path()
    h.moveTo(x0, -z0)
    h.lineTo(x0, -z1)
    h.lineTo(x1, -z1)
    h.lineTo(x1, -z0)
    h.closePath()
    shape.holes.push(h)
  }
  return shape
}

function HyangwonBody({ bankZ, mirror = false }) {
  const Y = HYANGWON
  const R = Y.R
  const h1 = Y.h1
  const h2 = Y.h2
  const y0 = Y.base
  const y1 = HYANGWON_Y1
  const S = HYANGWON_STAIR
  const parts = useMemo(() => {
    const cols = []
    const box = []
    const lattice = []
    const paper = []
    for (let k = 0; k < 6; k += 1) {
      const th = (k * Math.PI) / 3
      cols.push({ p: [Math.cos(th) * R, y0 + h1 / 2, Math.sin(th) * R], s: [0.1, h1, 0.1], c: '#8c382b' })
      cols.push({ p: [Math.cos(th) * R * 0.9, y1 + h2 / 2, Math.sin(th) * R * 0.9], s: [0.09, h2, 0.09], c: '#8c382b' })
      // 면 (두 기둥 사이)
      const ph = th + Math.PI / 6
      const ap = R * Math.cos(Math.PI / 6)
      const side = R - 0.22
      const rot = [0, Math.PI / 2 - ph, 0]
      const at = (dist, y) => [Math.cos(ph) * dist, y, Math.sin(ph) * dist]
      const along = (dist, off, y) => [Math.cos(ph) * dist - Math.sin(ph) * off, y, Math.sin(ph) * dist + Math.cos(ph) * off]
      box.push({ p: at(ap, y0 + h1 - 0.24), s: [side, 0.28, 0.1], r: rot, c: '#efe7d4' })
      box.push({ p: at(ap, y0 + h1 - 0.06), s: [R + 0.1, 0.14, 0.14], r: rot, c: '#2f6b58' }) // 창방
      const winH = h1 - 0.5 - 0.42
      if (k === Y.doorFace) {
        box.push({ p: at(ap, y0 + 0.03), s: [side, 0.06, 0.12], r: rot, c: '#8c382b' })
        for (const s of [-1, 1]) {
          const hinge = along(ap + 0.02, s * (side / 2), 0)
          paper.push({ p: [hinge[0] + Math.cos(ph) * 0.25, y0 + 0.95, hinge[2] + Math.sin(ph) * 0.25], s: [0.04, 1.7, 0.5], r: [0, Math.PI / 2 - ph, 0] })
        }
      } else {
        box.push({ p: at(ap, y0 + 0.28), s: [side, 0.46, 0.08], r: rot, c: '#3f7a55' })
        box.push({ p: at(ap - 0.045, y0 + 0.28), s: [side * 0.8, 0.28, 0.02], r: rot, c: '#c86a52' })
        for (const s of [-1, 1]) lattice.push({ p: along(ap, s * side * 0.25, y0 + 0.51 + winH / 2), s: [side * 0.48, winH, 0.05], r: rot })
      }
      // 2층: 열린 면(북·남)은 창호지 문을 밖으로 열어 두고, 나머지는 창호
      const ap2 = R * 0.9 * Math.cos(Math.PI / 6) - 0.02
      const side2 = R * 0.9 - 0.2
      if (HYANGWON_UPPER_OPEN.includes(k)) {
        box.push({ p: at(ap2, y1 + 0.03), s: [side2, 0.06, 0.1], r: rot, c: '#8c382b' })
        for (const s of [-1, 1]) {
          const hinge = [Math.cos(ph) * ap2 - Math.sin(ph) * s * (side2 / 2), 0, Math.sin(ph) * ap2 + Math.cos(ph) * s * (side2 / 2)]
          paper.push({ p: [hinge[0] + Math.cos(ph) * 0.22, y1 + 0.85, hinge[2] + Math.sin(ph) * 0.22], s: [0.04, 1.5, 0.44], r: [0, Math.PI / 2 - ph, 0] })
        }
      } else {
        box.push({ p: at(ap2, y1 + 0.2), s: [side2, 0.36, 0.08], r: rot, c: '#3f7a55' })
        lattice.push({ p: at(ap2, y1 + 0.4 + (h2 - 0.75) / 2), s: [side2, h2 - 0.75, 0.05], r: rot })
      }
      box.push({ p: at(ap2, y1 + h2 - 0.2), s: [side2, 0.26, 0.08], r: rot, c: '#efe7d4' })
      box.push({ p: at(ap2, y1 + h2 - 0.05), s: [R * 0.9 + 0.1, 0.14, 0.14], r: rot, c: '#2f6b58' })
      box.push({ p: [Math.cos(th) * R * 0.9, y1 + h2 + 0.08, Math.sin(th) * R * 0.9], s: [0.2, 0.14, 0.2], c: '#3f7d6a' })
      box.push({ p: [Math.cos(th) * R * 0.98, y1 + h2 + 0.18, Math.sin(th) * R * 0.98], s: [0.36, 0.08, 0.12], r: [0, -th, 0], c: '#2a4f8a' })
    }
    // 남쪽 디딤돌
    const apBase = (R + 0.42) * Math.cos(Math.PI / 6)
    box.push({ p: [0, 0.1, -(apBase + 0.22)], s: [0.95, 0.2, 0.42], c: STONE })
    // 안쪽 나무 계단 (1층 → 2층): 디딤판 + 양옆 옆판 + 손잡이
    if (!mirror) {
      const run = (S.xBottom - S.xTop) / S.steps
      const rise = (y1 - y0) / S.steps
      for (let k = 0; k < S.steps; k += 1) {
        box.push({ p: [S.xBottom - (k + 0.5) * run, y0 + (k + 1) * rise - 0.025, S.z], s: [run + 0.02, 0.05, S.width], c: '#8a6448' })
      }
      const len = Math.hypot(S.xBottom - S.xTop, y1 - y0)
      const tilt = [0, 0, -Math.atan2(y1 - y0, S.xBottom - S.xTop)]
      for (const e of [-1, 1]) box.push({ p: [(S.xBottom + S.xTop) / 2, (y0 + y1) / 2, S.z + e * (S.width / 2 + 0.03)], s: [len, 0.2, 0.05], r: tilt, c: '#6b4a32' })
      box.push({ p: [(S.xBottom + S.xTop) / 2, (y0 + y1) / 2 + 0.75, S.z - S.width / 2 - 0.03], s: [len, 0.05, 0.05], r: tilt, c: '#8c382b' })
    }
    // 취향교: 살짝 굽은 나무다리 (섬 북쪽 → 북쪽 물가)
    const z0 = Y.islandR - 0.2
    const z1 = bankZ + 0.3
    const n = 9
    const arch = (t) => 0.12 * Math.sin(Math.PI * t)
    for (let i = 0; i < n; i += 1) {
      const t0 = i / n
      const t1 = (i + 1) / n
      const za = z0 + (z1 - z0) * t0
      const zb = z0 + (z1 - z0) * t1
      box.push({ p: [0, 0.04 + (arch(t0) + arch(t1)) / 2, (za + zb) / 2], s: [Y.bridgeW, 0.08, zb - za + 0.02], r: [-Math.atan2(arch(t1) - arch(t0), zb - za), 0, 0], c: '#8a6448' })
      for (const s of [-1, 1]) {
        box.push({ p: [s * (Y.bridgeW / 2 - 0.04), 0.4 + arch(t0), za], s: [0.07, 0.72, 0.07], c: '#8c382b' })
        box.push({ p: [s * (Y.bridgeW / 2 - 0.04), 0.76 + (arch(t0) + arch(t1)) / 2, (za + zb) / 2], s: [0.06, 0.06, zb - za + 0.04], r: [-Math.atan2(arch(t1) - arch(t0), zb - za), 0, 0], c: '#8c382b' })
      }
    }
    return { cols, box, lattice, paper }
  }, [R, h1, h2, y0, y1, Y, S, bankZ, mirror])
  const hexRail = useMemo(() => {
    const segs = []
    const r = R + 0.22
    for (let k = 0; k < 6; k += 1) {
      const a = (k * Math.PI) / 3
      const b = ((k + 1) * Math.PI) / 3
      segs.push([Math.cos(a) * r, Math.sin(a) * r, Math.cos(b) * r, Math.sin(b) * r])
    }
    return segs
  }, [R])
  // 2층 마루(계단 구멍) + 1층 천장(새 그림 반자, 계단 구멍) + 2층 천장(육각 반자)
  const { deckGeo, ceil1Geo, ceil2Geo } = useMemo(() => {
    const deck = new ExtrudeGeometry(hexPlate(R + 0.28, HYANGWON_HOLE), { depth: 0.16, bevelEnabled: false })
    const c1 = new ShapeGeometry(hexPlate(R * 0.98, HYANGWON_HOLE))
    const pos = []
    const uv = []
    const r2 = R * 0.88
    for (let k = 0; k < 6; k += 1) {
      const a = (k * Math.PI) / 3
      const b = ((k + 1) * Math.PI) / 3
      for (const [x, y, z] of [
        [0, y1 + h2 + 0.12, 0],
        [Math.cos(a) * r2, y1 + h2 - 0.14, Math.sin(a) * r2],
        [Math.cos(b) * r2, y1 + h2 - 0.14, Math.sin(b) * r2],
      ]) {
        pos.push(x, y, z)
        uv.push(x / 0.6, z / 0.6)
      }
    }
    const c2 = new BufferGeometry()
    c2.setAttribute('position', new Float32BufferAttribute(pos, 3))
    c2.setAttribute('uv', new Float32BufferAttribute(uv, 2))
    c2.computeVertexNormals()
    return { deckGeo: deck, ceil1Geo: c1, ceil2Geo: c2 }
  }, [R, y1, h2])
  const floorMat = repeatMat(getMaruTexture, 0.8, 0.8, true)
  const birdMat = repeatMat(getBirdCofferTexture, 1.6, 1.6, true)
  return (
    <>
      <mesh geometry={GEO.cyl48} material={mat('#8eaa66')} position={[0, 0.01, 0]} scale={[Y.islandR - 0.08, 0.04, Y.islandR - 0.08]} />
      {/* 육각 기단 + 1층 마루 */}
      <mesh geometry={GEO_HEX} material={mat(STONE)} position={[0, y0 / 2, 0]} scale={[R + 0.42, y0 - 0.02, R + 0.42]} rotation-y={Math.PI / 6} />
      <mesh geometry={GEO_HEX} material={mat(STONE_LIGHT)} position={[0, y0 - 0.01, 0]} scale={[R + 0.46, 0.04, R + 0.46]} rotation-y={Math.PI / 6} />
      {!mirror && (
        <mesh geometry={GEO_HEX} material={floorMat} position={[0, y0 + 0.012, 0]} scale={[R * 0.99, 0.01, R * 0.99]} rotation-y={Math.PI / 6} />
      )}
      <Instances geometry={GEO.cyl8} material={PARTS} items={parts.cols} />
      <Instances geometry={GEO.box} material={PARTS} items={parts.box} />
      <Instances geometry={GEO.box} material={latticeMat('jeongja', '#6b3a2a', '#6b3a2a')} items={parts.lattice} />
      <Instances geometry={GEO.box} material={repeatMat(getPaperDoorTexture, 1, 1)} items={parts.paper} />
      {/* 1층 천장 (새 그림 반자) · 1층 처마 고리 */}
      {!mirror && <mesh geometry={ceil1Geo} material={birdMat} position-y={y0 + h1 - 0.12} rotation-x={-Math.PI / 2} />}
      <HexRoof R={R + 0.95} rise={0.55} inner={0.63} y={y0 + h1 - 0.2} />
      {/* 2층 마루 (우물마루 윗면, 계단 구멍) + 툇마루 난간 + 2층 천장 */}
      <mesh geometry={deckGeo} material={mat('#6d4b37')} position-y={y1 - 0.16} rotation-x={-Math.PI / 2} />
      {!mirror && <mesh geometry={ceil1Geo} material={floorMat} position-y={y1 + 0.003} rotation-x={-Math.PI / 2} scale={[(R + 0.26) / (R * 0.98), (R + 0.26) / (R * 0.98), 1]} />}
      <WoodRail segments={hexRail} y={y1} h={0.55} panel />
      {!mirror && <mesh geometry={ceil2Geo} material={birdMat} />}
      {/* 2층 지붕 + 절병통 */}
      <HexRoof R={R + 1.2} rise={1.45} y={y1 + h2 + 0.26} finial />
      {/* 다리 양끝 등 (밤에 은은하게) */}
      {[Y.islandR - 0.2, bankZ + 0.3].map((z) =>
        [-1, 1].map((s) => <Box key={`${z}${s}`} p={[s * (Y.bridgeW / 2 - 0.04), 0.86, z]} s={[0.14, 0.18, 0.14]} m={LANTERN} />),
      )}
      {!mirror && <pointLight position={[0, y1 + 0.6, 0]} color="#ffc977" intensity={10} distance={8} />}
      {!mirror && <HyangwonBlockers />}
    </>
  )
}

// 향원정 안에 있을 때 카메라가 벽·천장 밖으로 나가지 않게 하는 보이지 않는 가림막
function HyangwonBlockers() {
  const Y = HYANGWON
  const list = useMemo(() => {
    const out = []
    const ap = Y.R * Math.cos(Math.PI / 6)
    for (let k = 0; k < 6; k += 1) {
      const ph = (k * Math.PI) / 3 + Math.PI / 6
      if (k !== Y.doorFace) out.push({ p: [Math.cos(ph) * ap, Y.base + Y.h1 / 2, Math.sin(ph) * ap], r: Math.PI / 2 - ph, s: [Y.R - 0.1, Y.h1, 0.12] })
    }
    out.push({ p: [0, HYANGWON_Y1 + Y.h2 + 0.3, 0], r: 0, s: [Y.R * 2, 0.2, Y.R * 2] })
    return out
  }, [Y])
  return list.map((b, i) => <mesh key={i} name="camera-blocker" geometry={GEO.box} material={HIDDEN} position={b.p} rotation-y={b.r} scale={b.s} />)
}

// 텍스처 반복 재질 (캐시)
const repeatCache = new Map()
function repeatMat(get, rx, ry, double = false) {
  const key = `${get.name}|${rx.toFixed(2)}|${ry.toFixed(2)}|${double}`
  if (repeatCache.has(key)) return repeatCache.get(key)
  const base = get()
  let m
  if (!base) m = mat('#8a7d6b', { double })
  else {
    const t = base.clone()
    t.wrapS = t.wrapT = RepeatWrapping
    t.repeat.set(rx, ry)
    t.needsUpdate = true
    m = new MeshStandardMaterial({ map: t, roughness: 0.85, side: double ? DoubleSide : FrontSide })
  }
  repeatCache.set(key, m)
  return m
}

// 아미산: 교태전 뒤 계단식 꽃동산 + 꽃담 육각 굴뚝 4개
function Amisan() {
  const { ax, az, w, d, h } = AMISAN
  const flower = useMemo(() => {
    const t = getFlowerWallTexture()
    return t ? texMat(t) : mat('#a0503c')
  }, [])
  return (
    <group position={[ax, 0, az]}>
      <mesh geometry={GEO.box} material={ashlarMat(w, h * 0.5)} position={[0, h * 0.25, 0]} scale={[w, h * 0.5, d]} />
      <Box p={[0, h * 0.65, 0.3]} s={[w - 1, h * 0.3, d - 0.8]} c="#7d9a5a" />
      {[-3, -1, 1, 3].map((x) => (
        <group key={x} position={[x, h, 0.2]}>
          <mesh geometry={GEO_HEX} material={flower} position={[0, 0.75, 0]} scale={[0.36, 1.5, 0.36]} />
          <Box p={[0, 1.56, 0]} s={[0.84, 0.1, 0.84]} c="#4a4f57" />
          <Box p={[0, 1.7, 0]} s={[0.5, 0.2, 0.5]} c="#4a4f57" />
        </group>
      ))}
      {[-2, 0, 2].map((x) => (
        <Cyl key={`f${x}`} p={[x, h * 0.85, 0.4]} rad={0.35} h={0.3} c="#d77a8f" geo={GEO.cyl8} />
      ))}
    </group>
  )
}

// 품계석: 근정문 ~ 근정전 계단 사이 가운데 길 양옆 (정1품 ~ 정7품)
function PumgyeRows() {
  const items = useMemo(() => {
    const { axOffset, fromAz, toAz, count } = PUMGYE_ROWS
    const list = []
    for (let i = 0; i < count; i += 1) {
      const az = fromAz + ((toAz - fromAz) / (count - 1)) * i
      for (const side of [-1, 1]) {
        list.push({ p: [side * axOffset, 0.24, az], s: [0.5, 0.12, 0.4], c: STONE_DARK })
        list.push({ p: [side * axOffset, 0.52, az], s: [0.3, 0.5, 0.2], c: STONE })
        list.push({ p: [side * axOffset, 0.8, az], s: [0.24, 0.08, 0.16], c: STONE_DARK })
      }
    }
    return list
  }, [])
  return <Instances geometry={GEO.box} material={PARTS} items={items} />
}

// 마당 석등 (가운데 길 양옆)
function Lanterns() {
  const items = useMemo(() => {
    const list = []
    for (const az of [-23, -16]) {
      for (const side of [-1, 1]) list.push({ p: [side * 2.6, 0.45, az], s: [0.3, 0.4, 0.3] })
    }
    return list
  }, [])
  return <Instances geometry={GEO.box} material={LANTERN} items={items} />
}

// 후원 소나무: 줄기 + 층층이 쌓인 잎
const PINE_LEAF = mat('#3f6b45', { roughness: 0.85, flat: true })
const PINE_TRUNK = mat('#7a5a44', { roughness: 0.95 })
function Pines() {
  const { trunks, leaves } = useMemo(() => {
    const trunkList = []
    const leafList = []
    for (const [ax, az, k] of TREES) {
      trunkList.push({ p: [ax, 1.0 * k, az], s: [0.16 * k, 2.0 * k, 0.16 * k], r: [0, 0, (ax % 3) * 0.03] })
      leafList.push({ p: [ax, 2.1 * k, az], s: [1.25 * k, 0.5 * k, 1.25 * k] })
      leafList.push({ p: [ax + 0.2, 2.75 * k, az - 0.1], s: [0.9 * k, 0.4 * k, 0.9 * k] })
      leafList.push({ p: [ax - 0.1, 3.3 * k, az + 0.1], s: [0.55 * k, 0.32 * k, 0.55 * k] })
    }
    return { trunks: trunkList, leaves: leafList }
  }, [])
  return (
    <>
      <Instances geometry={GEO.cyl8} material={PINE_TRUNK} items={trunks} />
      <Instances geometry={GEO.sphere} material={PINE_LEAF} items={leaves} />
    </>
  )
}

// ── 관람 안내판: 광화문 앞. 누르면 전각 목록이 떠서 고른 곳으로 바로 가요 (PalaceGuideMenu) ──
function guideBoardTexture() {
  if (typeof document === 'undefined') return null
  const canvas = document.createElement('canvas')
  canvas.width = 768
  canvas.height = 440
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.fillStyle = '#f1e6cc'
  ctx.fillRect(0, 0, 768, 440)
  ctx.strokeStyle = '#5b3a28'
  ctx.lineWidth = 14
  ctx.strokeRect(7, 7, 754, 426)
  ctx.fillStyle = '#3a2a20'
  ctx.font = 'bold 50px "Noto Serif KR", "Nanum Myeongjo", serif'
  ctx.fillText('경복궁 관람 안내', 36, 74)
  ctx.font = '26px "Noto Sans KR", sans-serif'
  ctx.fillStyle = '#8c382b'
  ctx.fillText('눌러서 가고 싶은 전각으로 바로 이동해요', 38, 116)
  // 작은 배치도 (위가 북쪽)
  const { minX, maxX, minZ, maxZ } = BOUNDS
  const mx = 430
  const my = 30
  const mw = 300
  const mh = 380
  const X = (ax) => mx + ((ax - minX) / (maxX - minX)) * mw
  const Y = (az) => my + mh - ((az - minZ) / (maxZ - minZ)) * mh
  ctx.fillStyle = '#e3d6b6'
  ctx.fillRect(mx, my, mw, mh)
  ctx.strokeStyle = '#7a5a40'
  ctx.lineWidth = 4
  ctx.strokeRect(mx, my, mw, mh)
  ctx.fillStyle = '#5c8fa3'
  for (const p of PONDS) ctx.fillRect(X(p.ax - p.w / 2), Y(p.az + p.d / 2), (p.w / (maxX - minX)) * mw, (p.d / (maxZ - minZ)) * mh)
  ctx.fillStyle = '#8c382b'
  for (const h of HALLS) {
    if (h.rotation) continue
    ctx.fillRect(X(h.ax - h.w / 2), Y(h.az + h.d / 2), (h.w / (maxX - minX)) * mw, (h.d / (maxZ - minZ)) * mh)
  }
  ctx.fillStyle = '#c99a45'
  ctx.fillRect(X(-7.1), Y(-14 + 17), (14.2 / (maxX - minX)) * mw, (8.1 / (maxZ - minZ)) * mh)
  // 현재 위치
  ctx.fillStyle = '#d6453a'
  ctx.beginPath()
  ctx.arc(X(GUIDE_BOARD.ax), Y(GUIDE_BOARD.az) - 6, 9, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#3a2a20'
  ctx.font = '22px "Noto Sans KR", sans-serif'
  ctx.fillText('● 지금 여기', 600, 428)
  // 목록 미리보기
  ctx.font = '25px "Noto Sans KR", sans-serif'
  const names = ['근정전 · 어좌', '경회루 · 2층 누각', '향원정', '사정전 · 강녕전', '교태전 · 자경전', '건청궁 · 자선당']
  names.forEach((n, i) => {
    ctx.fillStyle = '#5b3a28'
    ctx.fillText(`${i + 1}. ${n}`, 44, 172 + i * 42)
  })
  const t = new CanvasTexture(canvas)
  t.colorSpace = SRGBColorSpace
  return t
}

function GuideBoard() {
  const { ax, az, w } = GUIDE_BOARD
  const map = useMemo(() => guideBoardTexture(), [])
  const open = (e) => {
    e.stopPropagation()
    usePalaceGuide.getState().show()
  }
  const hover = (on) => () => {
    document.body.style.cursor = on ? 'pointer' : ''
  }
  return (
    <group position={[ax, GROUND_Y, az]}>
      {/* 돌 받침 + 나무 기둥 두 개 + 작은 기와 지붕 */}
      {[-1, 1].map((s) => (
        <group key={s}>
          <Box p={[s * (w / 2 + 0.08), 0.12, 0]} s={[0.36, 0.24, 0.36]} c={STONE} />
          <Box p={[s * (w / 2 + 0.08), 1.2, 0]} s={[0.14, 2.2, 0.14]} c="#6b4a32" />
        </group>
      ))}
      <TiledRoof width={w + 0.9} depth={0.7} rise={0.22} y={2.35} />
      <Box p={[0, 1.45, 0.02]} s={[w + 0.12, 1.6, 0.08]} c="#5b3a28" />
      <mesh position={[0, 1.45, -0.03]} rotation-y={Math.PI} onClick={open} onPointerOver={hover(true)} onPointerOut={hover(false)}>
        <planeGeometry args={[w, 1.5]} />
        <meshBasicMaterial map={map} color={map ? '#ffffff' : '#f1e6cc'} />
      </mesh>
      {/* 누를 수 있다는 표시: 아래 빛나는 띠 */}
      <Box p={[0, 0.58, -0.05]} s={[w * 0.6, 0.08, 0.02]} m={LANTERN} />
    </group>
  )
}
