// (담당: 병관) 데이트 구역의 원형 분수와 연못, 조경 및 사랑의 자물쇠 난간 충돌
import { CuboidCollider, CylinderCollider } from '@react-three/rapier'

const TAU = Math.PI * 2
export const FOUNTAIN_BASIN_TOP = 1.06
export const PHOTO_DECK = [
  { radius: 2.5, height: 0.12, z: -0.6, color: '#c08a5a' },
  { radius: 2.7, height: 0.10, z: -0.6, color: '#f9a8d4' },
]
const radians = (degrees = 0) => degrees * Math.PI / 180
const wrap = (angle) => ((angle % TAU) + TAU) % TAU

export function lockFenceArcs(item) {
  const gaps = [{ deg: 0, width: item.gapDeg ?? 0 }, ...(item.extraGaps ?? [])]
    .filter(({ width = 20 }) => width > 0)
    .map(({ deg, width = 20 }) => ({ center: wrap(radians(deg)), half: radians(width) / 2 }))
    .sort((a, b) => a.center - b.center)
  if (!gaps.length) return [[0, TAU]]
  return gaps.map(({ center, half }, index) => {
    const next = gaps[(index + 1) % gaps.length]
    return [center + half, next.center - next.half + (index === gaps.length - 1 ? TAU : 0)]
  })
}

export function terraceTableOffsets(width) {
  const count = Math.max(2, Math.floor(width / 3.6))
  return Array.from({ length: count }, (_, i) => width * ((i + 0.5) / count - 0.5))
}

// 현판·꽃잎처럼 얇은 장식은 통행을 막지 않고, 사람이 닿는 단단한 부분만 막아요.
export function dateColliderShapes(item) {
  const [x, z] = item.position
  const y = item.elevation ?? 0
  const yaw = radians(item.rotationDeg)
  const cos = Math.cos(yaw)
  const sin = Math.sin(yaw)
  const at = (lx, ly, lz) => [x + lx * cos + lz * sin, y + ly, z - lx * sin + lz * cos]
  const box = (px, py, pz, w, h, d, turn = 0) => ({ kind: 'box', position: at(px, py, pz), args: [w / 2, h / 2, d / 2], yaw: yaw + turn })
  const cylinder = (px, py, pz, r, h) => ({ kind: 'cylinder', position: at(px, py, pz), args: [h / 2, r] })

  if (item.style === 'couplePhotoZone') {
    return PHOTO_DECK.map(({ radius, height, z }) => cylinder(0, height / 2, z, radius, height))
  }
  if (item.style === 'fountain') {
    const radius = item.size[0] / 2
    const rim = Array.from({ length: 16 }, (_, i) => {
      const half = Math.PI / 16
      const angle = (2 * i + 1) * half
      const inner = radius * Math.cos(half)
      return box(Math.sin(angle) * inner, FOUNTAIN_BASIN_TOP / 2, Math.cos(angle) * inner, 0.12, FOUNTAIN_BASIN_TOP, 2 * radius * Math.sin(half) + 0.025, angle + Math.PI / 2)
    })
    return [cylinder(0, 0.18, 0, radius + 1, 0.36), cylinder(0, 0.35, 0, radius, 0.70), ...rim, cylinder(0, 1.17, 0, 0.36, 1.28), cylinder(0, 1.65, 0, 1, 0.25)]
  }
  if (item.style === 'cherryTree' && item.planter) return [box(0, 0.15, 0, 1, 0.30, 1)]
  if (item.style === 'terrace') {
    const [width, height] = item.size
    return terraceTableOffsets(width).flatMap((offset) => [
      cylinder(offset, height + 0.37, 0, 0.38, 0.74),
      cylinder(offset, height + 1.31, 0, 0.06, 1.14),
      ...[-0.75, 0.75].map((seat) => box(offset + seat, height + 0.24, 0, 0.4, 0.48, 0.4)),
    ])
  }
  if (item.style === 'lockFence') {
    const radius = item.radius ?? item.size[0] / 2
    const h = item.size[1]
    return lockFenceArcs(item).flatMap(([start, end]) => {
      const sweep = end - start
      const count = Math.max(0, Math.round(sweep * radius))
      return Array.from({ length: count }, (_, i) => {
        const half = sweep / count / 2
        const angle = start + (2 * i + 1) * half
        const inner = radius * Math.cos(half)
        return box(Math.sin(angle) * inner, h / 2, Math.cos(angle) * inner, 0.12, h, 2 * radius * Math.sin(half) + 0.02, angle + Math.PI / 2)
      })
    })
  }
  if (item.style !== 'landscape') return []

  return (item.features ?? []).flatMap((feature) => {
    const [px, pz] = feature.p
    const py = feature.y ?? 0
    const s = feature.s ?? 1
    switch (feature.t) {
      case 'planter': return [box(px, py + 0.30, pz, feature.w ?? 4, 0.60, feature.d ?? 1, feature.rot ?? 0)]
      case 'hedge': {
        const [ex, ez] = feature.p2
        const h = feature.h ?? 0.9
        return [box((px + ex) / 2, py + h / 2, (pz + ez) / 2, 0.75, h, Math.hypot(ex - px, ez - pz), Math.atan2(ex - px, ez - pz))]
      }
      case 'tree':
      case 'cherry': return [cylinder(px, py + 1.2 * s, pz, 0.18 * s, 2.4 * s)]
      case 'pine': return [cylinder(px, py + 0.6 * s, pz, 0.2 * s, 1.2 * s)]
      case 'bush': return [cylinder(px, py + 0.30 * s, pz, 0.50 * s, 0.60 * s)]
      case 'pond': return [cylinder(px, py + 0.14, pz, (feature.r ?? 4) + 0.16, 0.38)]
      case 'rock': return [box(px, py + 0.20 * s, pz, 1.05 * s, 0.40 * s, 0.9 * s)]
      case 'picnic': return [box(px + 0.5, py + 0.2, pz - 0.1, 0.5, 0.35, 0.35, feature.rot ?? 0), cylinder(px - 1.4, py + 1.1, pz - 0.9, 0.05, 2.2)]
      default: return []
    }
  })
}

export function BkDateColliders({ props }) {
  return props.filter((item) => item.zone === 'BK').flatMap((item) => dateColliderShapes(item).map(({ kind, position, args, yaw }, index) => (
    kind === 'cylinder' ? <CylinderCollider key={`${item.id}/${index}`} position={position} args={args} />
      : <CuboidCollider key={`${item.id}/${index}`} position={position} args={args} rotation={[0, yaw, 0]} />
  )))
}
