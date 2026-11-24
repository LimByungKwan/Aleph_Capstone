import { useMemo } from 'react'
import { Box, mat } from './kit.jsx'

// 애니메이션 구역(JM) 계단 겉모습 시안 — 담당: 지민 (11/24)
// 걷는 판정은 지형 계단(terrain "stairs")의 경사로가 그대로 맡고, 여기서는 그 위에 단 모양만 덧입힘
// (공용 Terrain.jsx는 고치지 않음: 단을 지형 계단보다 1~2cm 크게 그려서 회색 기본 단을 덮음)
// item.position = 계단 시작점 [x, z], item.dress = { from: [0, 0, 높이], to: [상대 x, 상대 z, 높이], width, variant, stepHeight? }
// (소품 위치를 계단 자리에 둬야 거리 컬링에 맞게 그려짐)
//   variant A 자연석 / B 붉은 목조 / C 이끼 정원 / D 참배길 / E 등불 계단 — 모두 옆 가드 없음

const rand = (n) => {
  const x = Math.sin(n * 91.7 + 17.3) * 43758.5453
  return x - Math.floor(x)
}

const STONES = ['#8f8a80', '#a39d92', '#7d786f', '#99938a', '#86817a'].map((c) => mat(c, { flat: true, roughness: 0.95 }))
const MOSS = mat('#5d6b3f', { flat: true, roughness: 1 })
const ROCK = mat('#7a756c', { flat: true, roughness: 1 })
const WOOD_TREAD = mat('#7a5236', { roughness: 0.8 })
const WOOD_RISER = mat('#3a2a20', { roughness: 0.9 })
const VERMILION = mat('#c8452f', { roughness: 0.7 })
const GRAVEL = mat('#d8d2c4', { roughness: 1 })
const GARDEN_STONE = mat('#7f7a70', { flat: true, roughness: 0.95 })
const SHRUB = mat('#4f6b35', { flat: true, roughness: 1 })
const GRANITE = mat('#c9c5bd', { roughness: 0.85 })
const GRANITE_DARK = mat('#9e9a92', { roughness: 0.85 })
const NOSING = mat('#6f6b64', { roughness: 0.9 })
const LANTERN_STONE = mat('#a29d93', { flat: true })
const LANTERN_GLOW = mat('#fff1cf', { emissive: '#ffcf7a', emissiveIntensity: 1.3 })
const SLATE = mat('#4a4844', { roughness: 0.6 })
const LED = mat('#ffe2a8', { emissive: '#ffb84d', emissiveIntensity: 1.6 })

function StoneLantern({ p, scale = 1 }) {
  return (
    <group position={p} scale={scale}>
      <Box p={[0, 0.1, 0]} s={[0.55, 0.2, 0.55]} m={LANTERN_STONE} />
      <Box p={[0, 0.55, 0]} s={[0.2, 0.7, 0.2]} m={LANTERN_STONE} />
      <Box p={[0, 1.0, 0]} s={[0.45, 0.12, 0.45]} m={LANTERN_STONE} />
      <Box p={[0, 1.22, 0]} s={[0.32, 0.32, 0.32]} m={LANTERN_GLOW} />
      <Box p={[0, 1.45, 0]} s={[0.6, 0.12, 0.6]} m={LANTERN_STONE} />
      <Box p={[0, 1.58, 0]} s={[0.16, 0.16, 0.16]} m={LANTERN_STONE} />
    </group>
  )
}

export function JmStairDress({ item }) {
  const { from, to, width: w, variant = 'A', stepHeight = 0.22 } = item.dress
  const [ax, az, ah] = from
  const [bx, bz, bh] = to
  const L = Math.hypot(bx - ax, bz - az)
  const rise = bh - ah
  const yaw = Math.atan2(bx - ax, bz - az)
  const count = Math.max(1, Math.ceil(rise / stepHeight))
  const depth = L / count
  // 단 i: 앞 끝 z, 윗면 높이 (로컬: 계단 시작점 기준, +z가 올라가는 쪽)
  const steps = useMemo(
    () => Array.from({ length: count }, (_, i) => ({ z: depth * (i + 0.5), top: ah + (rise * (i + 1)) / count, i })),
    [count, depth, ah, rise],
  )
  // 계단 옆 소품(돌·등·관목)은 계단 옆 땅 높이에 붙임 = 계단이 시작하는 높이 (dress.ground로 바꿀 수 있음)
  //   예전처럼 경사 높이에 두면 계단 위쪽 옆 소품이 공중에 뜸
  const ground = item.dress.ground ?? ah

  return (
    <group position={[ax, 0, az]} rotation={[0, yaw, 0]}>
      {variant === 'A' && <NaturalStone steps={steps} w={w} depth={depth} ah={ah} L={L} ground={ground} />}
      {variant === 'B' && <RedWood steps={steps} w={w} depth={depth} ah={ah} />}
      {variant === 'C' && <MossGarden steps={steps} w={w} depth={depth} ah={ah} L={L} ground={ground} />}
      {variant === 'D' && <Approach steps={steps} w={w} depth={depth} ah={ah} L={L} bh={bh} />}
      {variant === 'E' && <LanternSteps steps={steps} w={w} depth={depth} ah={ah} L={L} ground={ground} />}
    </group>
  )
}

// A. 자연석: 단마다 크기·색이 다른 돌 2~3개, 모서리 이끼, 양옆 바닥에 막돌
function NaturalStone({ steps, w, depth, ah, L, ground }) {
  return (
    <group>
      {steps.map(({ z, top, i }) => {
        const n = 2 + Math.floor(rand(i) * 2)
        let x = -w / 2 - 0.02
        return (
          <group key={i}>
            {Array.from({ length: n }, (_, k) => {
              const share = k === n - 1 ? w / 2 + 0.02 - x : (w + 0.04) * (0.25 + rand(i * 7 + k) * 0.25)
              const cx = x + share / 2
              x += share
              const jitter = rand(i * 3 + k) * 0.03
              return <Box key={k} p={[cx, (ah + top + jitter) / 2, z]} s={[share - 0.04, top + jitter - ah + 0.02, depth + 0.02]} m={STONES[(i + k * 2) % STONES.length]} />
            })}
            {rand(i + 40) > 0.45 && <Box p={[(rand(i + 5) - 0.5) * w * 0.8, top + 0.015, z + depth / 2 - 0.08]} s={[0.5 + rand(i) * 0.6, 0.03, 0.12]} m={MOSS} />}
          </group>
        )
      })}
      {Array.from({ length: Math.round(L / 0.9) }, (_, k) => {
        const z = (k + 0.5) * 0.9
        return [-1, 1].map((side) => {
          const r = 0.18 + rand(k * 2 + side) * 0.2
          return (
            <mesh key={`${k}${side}`} position={[side * (w / 2 + 0.25 + rand(k + side) * 0.2), ground + r * 0.3, z]} scale={[r, r * 0.6, r]} material={rand(k + side * 3) > 0.6 ? MOSS : ROCK}>
              <dodecahedronGeometry args={[1, 0]} />
            </mesh>
          )
        })
      })}
    </group>
  )
}

// B. 붉은 목조: 나무 발판 + 짙은 챌판 + 양옆 주홍 옆판(발판과 같은 높이, 튀어나오지 않음)
function RedWood({ steps, w, depth, ah }) {
  return (
    <group>
      {steps.map(({ z, top, i }) => (
        <group key={i}>
          <Box p={[0, (ah + top - 0.06) / 2, z]} s={[w + 0.02, top - 0.06 - ah + 0.01, depth + 0.02]} m={WOOD_RISER} />
          <Box p={[0, top - 0.025, z + 0.03]} s={[w + 0.04, 0.07, depth + 0.06]} m={WOOD_TREAD} />
          {[-1, 1].map((side) => (
            <Box key={side} p={[side * (w / 2 + 0.06), (ah + top) / 2, z]} s={[0.1, top - ah + 0.02, depth + 0.02]} m={VERMILION} />
          ))}
        </group>
      ))}
    </group>
  )
}

// C. 이끼 정원: 가운데 돌판(폭 70%) + 양옆 흰 자갈 + 이끼·낮은 관목
function MossGarden({ steps, w, depth, ah, L, ground }) {
  const sw = w * 0.7
  return (
    <group>
      {steps.map(({ z, top, i }) => (
        <group key={i}>
          <Box p={[0, (ah + top) / 2, z]} s={[w + 0.02, top - ah + 0.005, depth + 0.02]} m={GRAVEL} />
          <Box p={[(rand(i) - 0.5) * 0.3, top + 0.02, z]} s={[sw, 0.06, depth - 0.12]} m={GARDEN_STONE} />
        </group>
      ))}
      {Array.from({ length: Math.round(L / 1.4) }, (_, k) => {
        const z = (k + 0.5) * 1.4
        return [-1, 1].map((side) => {
          const r = 0.3 + rand(k * 5 + side) * 0.25
          const moss = rand(k + side * 7) > 0.5
          return (
            <mesh key={`${k}${side}`} position={[side * (w / 2 + 0.35), ground + (moss ? 0.04 : r * 0.7), z]} scale={moss ? [r * 1.4, 0.08, r] : [r, r * 0.8, r]} material={moss ? MOSS : SHRUB}>
              <icosahedronGeometry args={[1, 0]} />
            </mesh>
          )
        })
      })}
    </group>
  )
}

// D. 참배길: 밝은 화강암 + 가운데 짙은 돌줄 + 단 끝 줄눈 + 아래·위 양옆 석등
function Approach({ steps, w, depth, ah, L, bh }) {
  return (
    <group>
      {steps.map(({ z, top, i }) => (
        <group key={i}>
          <Box p={[0, (ah + top) / 2, z]} s={[w + 0.02, top - ah + 0.01, depth + 0.02]} m={GRANITE} />
          <Box p={[0, top + 0.008, z]} s={[w * 0.28, 0.01, depth - 0.04]} m={GRANITE_DARK} />
          <Box p={[0, top + 0.006, z + depth / 2 - 0.04]} s={[w + 0.02, 0.012, 0.06]} m={NOSING} />
        </group>
      ))}
      {[-1, 1].map((side) => (
        <group key={side}>
          <StoneLantern p={[side * (w / 2 + 0.7), ah, -0.6]} />
          <StoneLantern p={[side * (w / 2 + 0.7), bh, L + 0.6]} />
        </group>
      ))}
    </group>
  )
}

// E. 등불 계단: 짙은 돌 + 챌판마다 따뜻한 불빛 줄 + 양옆 바닥 작은 등 (3단마다)
function LanternSteps({ steps, w, depth, ah, ground }) {
  return (
    <group>
      {steps.map(({ z, top, i }) => (
        <group key={i}>
          <Box p={[0, (ah + top) / 2, z]} s={[w + 0.02, top - ah + 0.01, depth + 0.02]} m={SLATE} />
          <Box p={[0, top - 0.06, z - depth / 2 - 0.005]} s={[w * 0.86, 0.03, 0.02]} m={LED} />
          {i % 3 === 1 &&
            [-1, 1].map((side) => (
              <group key={side} position={[side * (w / 2 + 0.3), ground, z]}>
                <Box p={[0, 0.2, 0]} s={[0.16, 0.4, 0.16]} m={SLATE} />
                <Box p={[0, 0.46, 0]} s={[0.2, 0.14, 0.2]} m={LED} />
              </group>
            ))}
        </group>
      ))}
    </group>
  )
}

export const JM_STAIR_STYLES = { jmStairDress: JmStairDress }
