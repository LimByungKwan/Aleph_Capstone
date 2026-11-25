import { useMemo } from 'react'
import { Box, Cyl, GEO, Instances, mat } from '../kit.jsx'
import { getTiledTexture } from '../textures.js'
import { Pavilion, TiledRoof, arches } from './HjPalace.jsx'
import { PalaceTerrace } from './HjPalaceDetails.jsx'
import { Deumu, Haetae } from './HjGyeongbok.jsx'
import { THRONE_ROOM_POSITION } from '../../../../components/movieZone/palaceInteriorLayout.js'
import {
  AMISAN,
  BACK_PATH,
  BOUNDS,
  BRIDGE,
  CORRIDORS,
  GWANGHWAMUN,
  HAETAE,
  HALLS,
  PALACE_ORIGIN_Z,
  POND_PAVILIONS,
  PONDS,
  PUMGYE_ROWS,
  TREES,
  WALLS,
  WALL_H,
  WALL_T,
} from './gyeongbokLayout.js'

// [3. 개발 > 프론트엔드] 압축 경복궁 (style: "hjGyeongbokgung") — 혜진 영화·드라마 구역
// 배치는 gyeongbokLayout.js 한 곳에서 정해요. 3D 모양은 여기서, 충돌 박스는 hj_drama.json의 gb_* 항목이에요.
//
// 충돌 박스 다시 만들기 (배치를 바꿨을 때): frontend 폴더에서
//   node scripts/hj-gyeongbok-colliders.mjs
// → hj_drama.json의 gb_* 항목을 새 배치로 바꿔 줘요.
//
// 좌표: 아이템 기준(근정전 실내·착석이 쓰는 좌표) = 배치 파일의 A 좌표 - PALACE_ORIGIN_Z.
const PLASTER = '#e3d7bd'
const STONE = '#c9c0ab'
const STONE_DARK = '#a79f8c'
const FLOOR = '#d8cdb5'
const PARTS = mat('#ffffff', { roughness: 0.9 })
const WATER = mat('#4f8fa8', { roughness: 0.15, metalness: 0.25, emissive: '#1d4a5e', emissiveIntensity: 0.25 })
const LOTUS = mat('#5f8a4d', { roughness: 0.8 })
const LANTERN = mat('#ffdf9b', { emissive: '#fbad55', emissiveIntensity: 0.72 })

export default function HjGyeongbokgung({ item }) {
  const [w, h, d] = item.size
  return (
    <group scale={[w / 53, h / 9, d / 53]}>
      {/* ── 근정전 (아이템 기준 좌표: 실내·착석 기능과 같은 좌표계) ── */}
      <Geunjeongjeon />

      {/* ── 나머지 궁궐 (배치 파일 A 좌표) ── */}
      <group position={[0, 0, -PALACE_ORIGIN_Z]}>
        <Grounds />
        <Gwanghwamun />
        {WALLS.map((wall, i) => (
          <Wall key={i} from={[wall[0], wall[1]]} to={[wall[2], wall[3]]} />
        ))}
        {HALLS.map((hall) => (
          <Pavilion
            key={hall.id}
            position={[hall.ax, 0.17, hall.az]}
            width={hall.w}
            depth={hall.d}
            height={hall.h}
            open={hall.open}
            upper={hall.upper}
            ornate={hall.ornate}
            rotation={((hall.rotation ?? 0) * Math.PI) / 180}
            title={hall.title}
          />
        ))}
        {CORRIDORS.map((c) => (
          <Pavilion key={c.id} position={[c.ax, 0.17, c.az]} width={c.w} depth={c.d} height={c.h} rotation={((c.rotation ?? 0) * Math.PI) / 180} />
        ))}
        {PONDS.map((pond) => (
          <Pond key={pond.id} {...pond} />
        ))}
        {POND_PAVILIONS.map((p) => (
          <PondPavilion key={p.id} {...p} />
        ))}
        <Amisan />
        <PumgyeRows />
        {HAETAE.map(([ax, az], i) => (
          <Haetae key={i} position={[ax, 0, az]} flip={ax > 0 ? -1 : 1} />
        ))}
        <Lanterns />
        <Bridge />
        <Pines />
      </group>
    </group>
  )
}

// 근정전 + 2단 월대 + 앞 계단 + 드므 (예전 해월정전 자리 좌표 그대로)
function Geunjeongjeon() {
  return (
    <>
      <Box p={[0, 0.47, 13.3]} s={[18, 0.61, 14.2]} c="#b6ad98" />
      <Box p={[0, 0.81, 13.6]} s={[15.8, 0.22, 12.3]} c="#d7cfbd" />
      {[0.23, 0.36, 0.49, 0.62, 0.75].map((stepH, index) => (
        <Box key={stepH} p={[0, stepH / 2, 4.58 + index * 0.36]} s={[4.75, stepH, 0.37]} c={PLASTER} />
      ))}
      <Pavilion position={THRONE_ROOM_POSITION} width={14.2} depth={8.1} height={3.8} upper ornate interior title="근정전" />
      <PalaceTerrace />
      <Deumu />
      <pointLight position={[0, 3.6, 8.7]} color="#ffd293" intensity={27} distance={13} />
    </>
  )
}

// 바닥: 궁궐 마당 + 가운데 박석길(광화문 → 근정전 계단)
function Grounds() {
  const { minX, maxX, minZ, maxZ } = BOUNDS
  const causeway = useMemo(() => getTiledTexture('stone', 2.5, 11), [])
  const cw = maxX - minX
  const cd = maxZ - minZ
  return (
    <>
      <Box p={[(minX + maxX) / 2, -0.12, (minZ + maxZ) / 2]} s={[cw + 1.2, 0.36, cd + 1.2]} c="#8b9273" />
      <Box p={[(minX + maxX) / 2, 0.14, (minZ + maxZ) / 2]} s={[cw, 0.055, cd]} c={FLOOR} />
      <mesh position={[0, 0.172, (GWANGHWAMUN.az + -9.4) / 2]} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[4.9, -9.4 - GWANGHWAMUN.az]} />
        <meshStandardMaterial map={causeway} color="#aeb4a9" roughness={0.91} />
      </mesh>
      {/* 근정전 뒤 ~ 신무문 가운데 길 */}
      <Box p={[0, 0.165, (BACK_PATH.fromAz + BACK_PATH.toAz) / 2]} s={[2.6, 0.03, BACK_PATH.toAz - BACK_PATH.fromAz]} c="#bdb39d" />
      {/* 후원 잔디 (침전 뒤 담장 ~ 뒤 담장) */}
      <Box p={[(minX + maxX) / 2, 0.15, (44 + maxZ) / 2]} s={[cw - 0.4, 0.04, maxZ - 44 - 0.6]} c="#9fb07c" />
    </>
  )
}

// 광화문: 무지개문 3개가 뚫린 석축 + 2층 문루
function Gwanghwamun() {
  const { az, depth, title } = GWANGHWAMUN
  return (
    <>
      <mesh position={[0, 0.17, az - depth / 2]}>
        <extrudeGeometry args={[arches, { depth, bevelEnabled: false, curveSegments: 16 }]} />
        <meshStandardMaterial color={PLASTER} roughness={0.9} />
      </mesh>
      <Pavilion position={[0, 3.2, az]} width={15} depth={4.8} height={2.55} upper title={title} />
      <pointLight position={[0, 3.6, az + 2.5]} color="#ffbb72" intensity={20} distance={12} />
    </>
  )
}

// 담장: 회벽 + 기와 지붕
function Wall({ from, to }) {
  const [x0, z0] = from
  const [x1, z1] = to
  const length = Math.hypot(x1 - x0, z1 - z0)
  const angle = Math.atan2(-(z1 - z0), x1 - x0) // 담장 길이 방향 = 로컬 x
  return (
    <group position={[(x0 + x1) / 2, 0, (z0 + z1) / 2]} rotation-y={angle}>
      <Box p={[0, WALL_H / 2, 0]} s={[length, WALL_H, WALL_T]} c={PLASTER} />
      <Box p={[0, 0.35, 0]} s={[length + 0.05, 0.7, WALL_T + 0.08]} c={STONE_DARK} />
      <TiledRoof width={length + 0.3} depth={WALL_T + 0.6} rise={0.4} y={WALL_H + 0.1} />
    </group>
  )
}

// 연못: 물 + 돌 테두리 + 연잎
function Pond({ ax, az, w, d }) {
  const parts = useMemo(() => {
    const pieces = []
    const edge = (cx, cz, len, alongX) => {
      const count = Math.ceil(len / 0.6)
      for (let i = 0; i < count; i += 1) {
        const off = (i + 0.5) * (len / count) - len / 2
        pieces.push({
          p: [cx + (alongX ? off : 0), 0.3, cz + (alongX ? 0 : off)],
          s: alongX ? [len / count - 0.03, 0.3, 0.4] : [0.4, 0.3, len / count - 0.03],
          c: ['#b2a68f', '#cac1ac', '#9d9686'][i % 3],
        })
      }
    }
    edge(ax, az - d / 2, w + 0.4, true)
    edge(ax, az + d / 2, w + 0.4, true)
    edge(ax - w / 2, az, d, false)
    edge(ax + w / 2, az, d, false)
    return pieces
  }, [ax, az, w, d])
  const pads = useMemo(() => {
    const list = []
    for (let i = 0; i < 14; i += 1) {
      const a = i * 2.39
      const r = 0.35 + ((i * 7) % 10) / 22
      list.push({ p: [ax + Math.cos(a) * r * w * 0.45, 0.2, az + Math.sin(a) * r * d * 0.45], s: [0.38, 0.02, 0.38] })
    }
    return list
  }, [ax, az, w, d])
  return (
    <>
      <Box p={[ax, 0.12, az]} s={[w, 0.12, d]} m={WATER} />
      <Instances geometry={GEO.box} material={PARTS} items={parts} />
      <Instances geometry={GEO.cyl8} material={LOTUS} items={pads} />
    </>
  )
}

// 연못 위 누각: 네모 돌기둥 받침(podium) 위에 2층 누각
function PondPavilion({ ax, az, w, d, h, podium, upper, ornate, title }) {
  const pillars = useMemo(() => {
    const list = []
    const cols = Math.max(3, Math.round(w / 1.1))
    const rows = Math.max(3, Math.round(d / 1.1))
    for (let i = 0; i < cols; i += 1) {
      for (let j = 0; j < rows; j += 1) {
        list.push({
          p: [ax + (i / (cols - 1) - 0.5) * (w - 0.5), 0.15 + podium / 2, az + (j / (rows - 1) - 0.5) * (d - 0.5)],
          s: [0.32, podium, 0.32],
          c: '#d2cab7',
        })
      }
    }
    return list
  }, [ax, az, w, d, podium])
  return (
    <>
      <Instances geometry={GEO.box} material={PARTS} items={pillars} />
      <Box p={[ax, 0.15 + podium + 0.1, az]} s={[w + 0.3, 0.2, d + 0.3]} c={STONE} />
      <Pavilion position={[ax, 0.35 + podium, az]} width={w} depth={d} height={h} open upper={upper} ornate={ornate} title={title} />
      <pointLight position={[ax, podium + 2, az]} color="#ffd49a" intensity={12} distance={9} />
    </>
  )
}

// 아미산: 계단식 꽃동산 + 붉은 벽돌 육각 굴뚝 4개
function Amisan() {
  const { ax, az, w, d, h } = AMISAN
  return (
    <group position={[ax, 0, az]}>
      <Box p={[0, h * 0.25, 0]} s={[w, h * 0.5, d]} c={STONE_DARK} />
      <Box p={[0, h * 0.65, 0.3]} s={[w - 1, h * 0.3, d - 0.8]} c="#7d9a5a" />
      {[-3, -1, 1, 3].map((x) => (
        <group key={x} position={[x, h, 0.2]}>
          <Cyl p={[0, 0.7, 0]} rad={0.32} h={1.4} c="#a0503c" geo={GEO.cyl8} />
          <Box p={[0, 1.5, 0]} s={[0.8, 0.18, 0.8]} c="#4a4f57" />
        </group>
      ))}
      {[-2, 0, 2].map((x) => (
        <Cyl key={`f${x}`} p={[x, h * 0.85, 0.4]} rad={0.35} h={0.3} c="#d77a8f" geo={GEO.cyl8} />
      ))}
    </group>
  )
}

// 품계석: 근정문 ~ 근정전 계단 사이 가운데 길 양옆
function PumgyeRows() {
  const items = useMemo(() => {
    const { axOffset, fromAz, toAz, count } = PUMGYE_ROWS
    const list = []
    for (let i = 0; i < count; i += 1) {
      const az = fromAz + ((toAz - fromAz) / (count - 1)) * i
      for (const side of [-1, 1]) {
        list.push({ p: [side * axOffset, 0.42, az], s: [0.34, 0.5, 0.22], c: STONE })
        list.push({ p: [side * axOffset, 0.69, az], s: [0.26, 0.06, 0.16], c: STONE_DARK })
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
    for (const az of [-28.5, -20]) {
      for (const side of [-1, 1]) list.push({ p: [side * 2.1, 0.45, az], s: [0.3, 0.4, 0.3] })
    }
    return list
  }, [])
  return <Instances geometry={GEO.box} material={LANTERN} items={items} />
}

// 향원정 다리(취향교): 붉은 난간이 있는 좁은 나무다리
function Bridge() {
  const { ax, fromAz, toAz, width } = BRIDGE
  const len = toAz - fromAz
  const mid = (fromAz + toAz) / 2
  return (
    <group position={[ax, 0, mid]}>
      <Box p={[0, 0.55, 0]} s={[width, 0.12, len]} c="#8a6a48" />
      {[-1, 1].map((side) => (
        <Box key={side} p={[side * (width / 2), 0.78, 0]} s={[0.07, 0.07, len]} c="#904033" />
      ))}
      {[-1, 1].map((side) =>
        [-0.45, 0, 0.45].map((t) => (
          <Box key={`${side}${t}`} p={[side * (width / 2), 0.35, t * len]} s={[0.09, 0.6, 0.09]} c="#904033" />
        )),
      )}
    </group>
  )
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
