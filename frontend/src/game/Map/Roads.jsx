import { useMemo } from 'react'
import * as THREE from 'three'
import { getRoadTextTexture, getTiledTexture, TILE_METERS } from './styles/textures.js'

const HUB_PAVING_RELIEF = { hubGranite: .075, hubLimestone: .045 }
// 길·인도·광장 바닥 (충돌 없음)
// item.style은 TILE_METERS의 바닥 무늬예요. 없으면 color 단색을 사용해요.
export function Road({ item, layer = 0 }) {
  const [x, z] = item.position
  const [w, h, d] = item.size
  const rotationY = THREE.MathUtils.degToRad(item.rotationDeg ?? 0)

  const texture = useMemo(() => {
    const tile = TILE_METERS[item.style]
    if (!tile) return null
    const map = getTiledTexture(item.style, w / tile, d / tile)
    if (item.style === 'hubLawn') map.offset.set((x - w / 2) / tile, -(z + d / 2) / tile)
    return map
  }, [item.style, w, d, x, z])
  const relief = HUB_PAVING_RELIEF[item.style]

  return (
    <mesh position={[x, h / 2 + layer * 0.006, z]} rotation={[0, rotationY, 0]} receiveShadow name={item.id}>
      <boxGeometry args={[w, h, d]} />
      <meshStandardMaterial map={texture} color={texture ? '#ffffff' : item.color}
        bumpMap={relief ? texture : null} bumpScale={relief ?? 0} />
    </mesh>
  )
}

// ── 도로 표시 (횡단보도, 차선, 글씨) ───────────
const MARK_Y = 0.03 // 아스팔트 윗면(0.02) 바로 위
const PAINT = { polygonOffset: true, polygonOffsetFactor: -2 }

export function Markings({ markings = [] }) {
  return markings.map((mark, i) => {
    if (mark.type === 'crosswalk') return <Crosswalk key={i} mark={mark} />
    if (mark.type === 'line') return <PaintLine key={i} mark={mark} />
    if (mark.type === 'text') return <RoadText key={i} mark={mark} />
    return null
  })
}

// 횡단보도: size [가로 폭, 건너는 길이]. 흰 줄이 1m 간격으로 반복
function Crosswalk({ mark }) {
  const [x, z] = mark.position
  const [width, length] = mark.size
  const stripes = Math.floor(length)
  const rotationY = THREE.MathUtils.degToRad(mark.rotationDeg ?? 0)
  return (
    <group position={[x, MARK_Y, z]} rotation={[0, rotationY, 0]}>
      {Array.from({ length: stripes }, (_, i) => (
        <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -length / 2 + 0.25 + i + (length - stripes) / 2]}>
          <planeGeometry args={[width, 0.5]} />
          <meshStandardMaterial color={mark.color ?? '#f2f2ec'} {...PAINT} />
        </mesh>
      ))}
    </group>
  )
}

// 차선: from → to. double이면 두 줄(중앙선), dashed면 점선
function PaintLine({ mark }) {
  const [x1, z1] = mark.from
  const [x2, z2] = mark.to
  const length = Math.hypot(x2 - x1, z2 - z1)
  const angle = Math.atan2(z2 - z1, x2 - x1)
  const width = mark.width ?? 0.12
  const offsets = mark.double ? [-width, width] : [0]

  const pieces = mark.dashed
    ? Array.from({ length: Math.floor(length / 6) }, (_, i) => ({ start: i * 6, len: 3 }))
    : [{ start: 0, len: length }]

  return (
    <group position={[(x1 + x2) / 2, MARK_Y, (z1 + z2) / 2]} rotation={[0, -angle, 0]}>
      {offsets.map((offset) =>
        pieces.map((piece, i) => (
          <mesh key={`${offset}-${i}`} rotation={[-Math.PI / 2, 0, 0]} position={[-length / 2 + piece.start + piece.len / 2, 0, offset]}>
            <planeGeometry args={[piece.len, width]} />
            <meshStandardMaterial color={mark.color ?? '#f2f2ec'} {...PAINT} />
          </mesh>
        )),
      )}
    </group>
  )
}

// 도로 글씨 (예: "천천히"). rotationDeg 0이면 글씨 윗부분이 북쪽(-z)을 향함
function RoadText({ mark }) {
  const [x, z] = mark.position
  const [w, d] = mark.size ?? [3, 1.5]
  const rotationY = THREE.MathUtils.degToRad(mark.rotationDeg ?? 0)
  return (
    <mesh position={[x, MARK_Y, z]} rotation={[-Math.PI / 2, 0, rotationY, 'YXZ']}>
      <planeGeometry args={[w, d]} />
      <meshStandardMaterial map={getRoadTextTexture(mark.text, mark.color)} transparent depthWrite={false} {...PAINT} />
    </mesh>
  )
}
