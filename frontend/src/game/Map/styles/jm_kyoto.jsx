import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { hipRoofGeometry } from './geometry.js'
import { Ball, Box, Cyl, GEO, Instances, mat } from './kit.jsx'
import { getJpSignTexture, GlowMaterial } from './jm_landmarks.jsx'
import { RiverBanks, RiverWater, SeaWater, seaPlane, WadeSplash } from './jm_water.jsx'

// 애니메이션 구역(JM) — 교토 온천 마을 「유아카리초(湯灯町)」 스타일. 담당: 지민
// 분위기 참고: 교토 옛 거리(산넨자카·기온·후시미 이나리·기요미즈 무대) + 강을 끼고 여러 층 목조 여관이 늘어선 온천 거리.
// 특정 작품의 건물·캐릭터를 그대로 옮기지 않고, 일본 목조 건축의 공통 요소(붉은 기둥·기와·장지문 불빛·제등)로만 만들어요.
// 약속은 다른 JM 스타일과 같음: size [가로, 높이, 깊이] 상자 안, 앞면 +z, rotationDeg로 방향.

const VERMILION = '#a9543a'
const DARK_WOOD = '#3d2a1e'
const WOOD = '#6b4630'
const ROOF = '#2f3338'
const PLASTER = '#efe6d2'
const STONE = '#9d978c'

const range = (n) => Array.from({ length: n }, (_, i) => i)

// 밤에 따뜻하게 빛나는 장지문·창 (재질은 캐시돼서 모든 여관이 같이 씀 → 합쳐 그리기에 유리)
const SHOJI = mat('#ffe7b8', { emissive: '#ffb45e', emissiveIntensity: 0.75, roughness: 0.6 })
const LANTERN = mat('#a26a5b', { emissive: '#ff6a35', emissiveIntensity: 0.9 })
const LAMP_GLOW = mat('#fff1cf', { emissive: '#ffcf7a', emissiveIntensity: 1.3 })

// 처마 밑에 매다는 붉은 제등 하나
function HangingLantern({ p, scale = 1 }) {
  return (
    <group position={p} scale={scale}>
      <Cyl p={[0, 0.32, 0]} rad={0.015} h={0.25} c={DARK_WOOD} />
      <Cyl p={[0, 0, 0]} rad={0.22} h={0.46} m={LANTERN} />
      <Cyl p={[0, 0.25, 0]} rad={0.16} h={0.05} c="#1d1d1d" />
      <Cyl p={[0, -0.25, 0]} rad={0.16} h={0.05} c="#1d1d1d" />
    </group>
  )
}

// ── 여러 층 온천 여관 ─────────────────────────
// item.floors: 층수(기본 3), item.signs[0]: 1층 노렌 글씨, item.color: 벽 나무색
// 층마다 장지문 불빛 띠 + 작은 처마 + (2층부터) 나무 난간 발코니, 맨 위는 기와 우진각 지붕
export function JmRyokan({ item }) {
  const [w, h, d] = item.size
  const floors = Math.max(1, item.floors ?? 3)
  const wall = item.color ?? WOOD
  const sign = item.signs?.[0]
  const base = 0.4
  const roofH = Math.min(2.4, h * 0.2)
  const fh = (h - base - roofH) / floors
  const front = d / 2
  const eave = useMemo(() => hipRoofGeometry(w + 0.9, 1.3, 0.42, 0.06), [w])
  const roof = useMemo(() => hipRoofGeometry(w + 1.2, d + 1.2, roofH, 0.22), [w, d, roofH])
  const noren = sign ? Math.min(3, w * 0.45) : 0

  return (
    <group>
      <Box p={[0, base / 2, 0]} s={[w, base, d]} c={STONE} />
      {range(floors).map((i) => {
        const y = base + i * fh
        const inset = i * 0.25 // 위층일수록 살짝 들어감
        const fz = front - inset
        const bandW = w - 1 - inset * 2
        return (
          <group key={i}>
            <Box p={[0, y + fh / 2, -inset / 2]} s={[w - 0.3 - inset * 2, fh, d - 0.4 - inset]} c={i === 0 ? DARK_WOOD : wall} />
            {/* 장지문 불빛 띠 */}
            <Box p={[0, y + fh * (i === 0 ? 0.45 : 0.52), fz - 0.17]} s={[bandW, fh * (i === 0 ? 0.62 : 0.5), 0.05]} m={SHOJI} />
            {/* 세로 문살 */}
            {range(Math.max(4, Math.round(bandW / 0.9))).map((k, _, all) => (
              <Box key={k} p={[-bandW / 2 + (k * bandW) / (all.length - 1), y + fh * 0.5, fz - 0.12]} s={[0.07, fh * 0.66, 0.06]} c={DARK_WOOD} />
            ))}
            {/* 양옆 기둥 */}
            {[-1, 1].map((side) => (
              <Box key={side} p={[side * (w / 2 - 0.25 - inset), y + fh / 2, fz - 0.1]} s={[0.24, fh, 0.24]} c={i === 0 ? VERMILION : DARK_WOOD} />
            ))}
            {/* 층 사이 처마 */}
            {i < floors - 1 && (
              <mesh geometry={eave} position={[0, y + fh - 0.05, fz + 0.25]}>
                <meshStandardMaterial color={ROOF} flatShading side={THREE.DoubleSide} />
              </mesh>
            )}
            {/* 2층부터 발코니 난간 */}
            {i > 0 && (
              <group position={[0, y, fz + 0.45]}>
                <Box p={[0, 0.05, -0.2]} s={[w - 0.8 - inset * 2, 0.1, 0.7]} c={WOOD} />
                <Box p={[0, 0.85, 0.12]} s={[w - 0.8 - inset * 2, 0.08, 0.08]} c={DARK_WOOD} />
                {range(Math.max(3, Math.round(w / 1.2))).map((k, _, all) => (
                  <Box key={k} p={[-(w - 0.9 - inset * 2) / 2 + (k * (w - 0.9 - inset * 2)) / (all.length - 1), 0.45, 0.12]} s={[0.06, 0.8, 0.06]} c={DARK_WOOD} />
                ))}
              </group>
            )}
          </group>
        )
      })}
      {/* 1층 처마 밑 제등 */}
      {[-0.32, 0.32].map((t) => (
        <HangingLantern key={t} p={[t * w, base + fh - 0.55, front + 0.55]} />
      ))}
      {/* 노렌 (가게 이름 천) */}
      {sign && (
        <mesh position={[0, base + fh - 0.75, front + 0.12]}>
          <planeGeometry args={[noren, 1]} />
          <GlowMaterial glow={0.5} map={getJpSignTexture(sign.text, sign.bg ?? '#3b1f16', sign.fg ?? '#fbe9c8', noren)} side={THREE.DoubleSide} />
        </mesh>
      )}
      {/* 지붕 위 세로 간판 (있으면) */}
      {sign?.roof && (
        <mesh position={[0, h - roofH * 0.35, front - 0.2]}>
          <planeGeometry args={[Math.min(4, w * 0.5), 0.9]} />
          <GlowMaterial glow={0.7} map={getJpSignTexture(sign.roof, '#f6e7c4', '#7a1d12', Math.min(4, w * 0.5) / 0.9)} side={THREE.DoubleSide} />
        </mesh>
      )}
      <mesh geometry={roof} position={[0, h - roofH, 0]}>
        <meshStandardMaterial color={ROOF} flatShading side={THREE.DoubleSide} />
      </mesh>
    </group>
  )
}

// ── 고층 여관 「湯灯屋」 (11/24, 독자 디자인) ─────────
// item.floors: [{ h, kind }] 아래층부터. 층마다 높이가 다름 (kind: lobby·rooms·bath·banquet·view)
// item.stair: 안쪽 계단 자리 { x0, x1, z, w, holeX, holeZ } — 위층 바닥은 이 자리만 뚫림 (충돌은 생성 스크립트와 같은 값)
// 걷는 판정(바닥판·벽·계단·난간)은 생성 스크립트가 jmCollider·지형 계단으로 깔고, 여기서는 그림만
// 앞(+z) 1층 가운데가 현관(GRAND_DOOR). 층마다 바깥에 처마·붉은 발코니·제등, 꼭대기에 큰 지붕
export const GRAND_DOOR = 2.4
const WALL_T = 0.25
const LOBBY_WALL = '#e9dcc0'
const BASE_H = 0.6
const FLOOR_WOOD = ['#8a6243', '#7a5a3e', '#6f4a33', '#8d6a4a', '#5e4330']
// 11/25 겉모습: 참고 사진(붉은 벽 + 초록 기와 + 금색 장식의 높은 온천 건물)처럼 — 벽은 붉게, 지붕·처마는 초록, 가운데 박공과 꼭대기 누각
const GR_RED = '#a3523f'
const GR_ROOF = '#3f6f5a'
const GR_GOLD = '#c9a245'

export function JmGrandRyokan({ item }) {
  const [w, , d] = item.size
  const sign = item.signs?.[0]
  const floors = item.floors ?? [{ h: 3.6, kind: 'lobby' }]
  const stair = item.stair
  const bases = floors.reduce((acc, f) => [...acc, acc[acc.length - 1] + f.h], [BASE_H])
  const total = bases[bases.length - 1]
  const roof = useMemo(() => hipRoofGeometry(w + 2.4, d + 2.4, 3.4, 0.35), [w, d])
  const crownRoof = useMemo(() => hipRoofGeometry(w * 0.4 + 1.8, d * 0.55 + 1.8, 1.9, 0.3), [w, d])
  const gableRoof = useMemo(() => hipRoofGeometry(7.2, 2.6, 1.4, 0.35), [])
  return (
    <group>
      {/* 돌 기단 + 앞 계단 */}
      <Box p={[0, BASE_H / 2, 0]} s={[w + 1, BASE_H, d + 1]} c={STONE} />
      {range(3).map((i) => (
        <Box key={i} p={[0, 0.1 + i * 0.2, d / 2 + 1.6 - i * 0.4]} s={[8, 0.2, 0.4]} c="#b5ad9f" />
      ))}
      {floors.map((f, k) => (
        <TowerFloor key={k} k={k} f={f} y={bases[k]} w={w} d={d} stair={stair} last={k === floors.length - 1} />
      ))}
      {/* 지붕 밑 판 + 큰 지붕 + 금색 꼭대기 장식 + 굴뚝(지붕 위만) */}
      <Box p={[0, total + 0.1, 0]} s={[w, 0.2, d]} c={DARK_WOOD} />
      <mesh geometry={roof} position={[0, total + 0.2, 0]}>
        <meshStandardMaterial color={GR_ROOF} flatShading side={THREE.DoubleSide} />
      </mesh>
      {[-1, 1].map((s) => (
        <Cyl key={s} p={[s * (w / 2 - 1.5), total + 3.9, 0]} rad={0.22} h={0.9} c={GR_GOLD} />
      ))}
      {/* 큰 지붕 위 작은 누각 (사진의 꼭대기 층) + 금색 지붕 + 꼭대기 장식 */}
      <group position={[0, total + 2.2, 0]}>
        <Box p={[0, 1.3, 0]} s={[w * 0.4, 2.6, d * 0.55]} c={GR_RED} />
        <Box p={[0, 1.35, d * 0.275 + 0.03]} s={[w * 0.4 - 0.8, 1.2, 0.05]} m={SHOJI} />
        {range(7).map((i) => (
          <Box key={i} p={[-w * 0.2 + 0.4 + (i * (w * 0.4 - 0.8)) / 6, 1.35, d * 0.275 + 0.07]} s={[0.08, 1.3, 0.05]} c={DARK_WOOD} />
        ))}
        <Box p={[0, 0.25, d * 0.275 + 0.35]} s={[w * 0.4, 0.08, 0.6]} c={WOOD} />
        <Box p={[0, 0.95, d * 0.275 + 0.62]} s={[w * 0.4, 0.08, 0.08]} c={VERMILION} />
        <mesh geometry={crownRoof} position={[0, 2.6, 0]}>
          <meshStandardMaterial color={GR_GOLD} metalness={0.35} roughness={0.45} flatShading side={THREE.DoubleSide} />
        </mesh>
        <Cyl p={[0, 4.6, 0]} rad={0.18} h={0.7} c={GR_GOLD} />
        <Ball p={[0, 5.05, 0]} rad={0.25} c={GR_GOLD} />
      </group>
      {/* 정면 가운데 박공 (처마 위로 내민 작은 지붕, 사진의 현관 위 둥근 지붕 자리) */}
      {floors.slice(0, -1).map((f, k) =>
        k % 2 === 0 ? (
          <group key={`gable${k}`} position={[0, bases[k + 1] + 0.05, d / 2 + 1.25]}>
            <mesh geometry={gableRoof}>
              <meshStandardMaterial color={GR_ROOF} flatShading side={THREE.DoubleSide} />
            </mesh>
            <Box p={[0, 0.02, 1.25]} s={[k === 0 ? 7.4 : 6.2, 0.1, 0.12]} c={GR_GOLD} />
            <Ball p={[0, 1.55, 0]} rad={0.2} c={GR_GOLD} />
          </group>
        ) : null,
      )}
      <group position={[w * 0.36, total, -d * 0.2]}>
        <Cyl p={[0, 3.4, 0]} rad={0.6} h={6.8} c="#7d6c5e" />
        <Cyl p={[0, 6.9, 0]} rad={0.75} h={0.4} c="#3d3530" />
      </group>
      {/* 2층 정면 큰 현판 */}
      {sign && floors.length > 1 && (
        <group position={[0, bases[1] + floors[1].h * 0.55, d / 2 + 1.05]}>
          <Box p={[0, 0, -0.06]} s={[5.4, 1.5, 0.1]} c={DARK_WOOD} />
          <mesh>
            <planeGeometry args={[5, 1.25]} />
            <GlowMaterial glow={0.8} map={getJpSignTexture(sign.text, sign.bg ?? '#f3dfb2', sign.fg ?? '#7a1d12', 5 / 1.25)} side={THREE.DoubleSide} />
          </mesh>
        </group>
      )}
      {/* 1층 붉은 기둥 회랑 (현관 앞 기둥은 빼서 드나드는 길을 막지 않게) */}
      {range(9).map((k) => {
        const x = -w / 2 + 1 + (k * (w - 2)) / 8
        if (Math.abs(x) < GRAND_DOOR / 2 + 0.3) return null
        return <Cyl key={k} p={[x, BASE_H + floors[0].h / 2, d / 2 + 0.9]} rad={0.22} h={floors[0].h} c={VERMILION} />
      })}
      <Box p={[0, BASE_H + floors[0].h - 0.15, d / 2 + 0.9]} s={[w - 1.6, 0.3, 0.35]} c={VERMILION} />
      {floors[0].kind === 'lobby' && <GrandRyokanLobby w={w} d={d} floor={BASE_H} ceil={BASE_H + floors[0].h} />}
    </group>
  )
}

// 처마: 벽 바깥으로 비스듬히 내민 판 4장 (안에서 보이지 않게 벽 밖에만)
function Eave({ w, d, y, out = 1.3, color = ROOF }) {
  const tilt = 0.42
  return (
    <group>
      {[-1, 1].map((s) => (
        <group key={`fz${s}`}>
          <mesh position={[0, y - Math.sin(tilt) * out * 0.5, s * (d / 2 + Math.cos(tilt) * out * 0.5)]} rotation={[s * tilt, 0, 0]}>
            <boxGeometry args={[w + out * 2, 0.12, out]} />
            <meshStandardMaterial color={color} flatShading />
          </mesh>
          <mesh position={[s * (w / 2 + Math.cos(tilt) * out * 0.5), y - Math.sin(tilt) * out * 0.5, 0]} rotation={[0, 0, -s * tilt]}>
            <boxGeometry args={[out, 0.12, d]} />
            <meshStandardMaterial color={color} flatShading />
          </mesh>
        </group>
      ))}
    </group>
  )
}

// 층 하나: 벽(겉 짙은 나무 + 안 회벽) + 바깥 장지문 불빛·살 + 처마·발코니 + 바닥판(뚫린 계단 자리) + 안 꾸밈
function TowerFloor({ k, f, y, w, d, stair, last }) {
  const h = f.h
  const first = k === 0
  const side = (w - GRAND_DOOR) / 2
  const inner = w / 2 - WALL_T
  const innerD = d / 2 - WALL_T
  const bandW = w - 1.4
  const sideBand = (bandW - GRAND_DOOR) / 2
  const glass = f.kind === 'view'
  const [hx0, hx1] = stair?.holeX ?? [0, 0]
  const [hz0, hz1] = stair?.holeZ ?? [0, 0]
  const arriveEast = (k - 1) % 2 === 0
  const railFrom = arriveEast ? hx0 : hx0 + 1.6
  const railTo = arriveEast ? hx1 - 1.4 : hx1
  const floorColor = FLOOR_WOOD[k % FLOOR_WOOD.length]
  return (
    <group>
      {/* 바닥 (1층은 마루, 위층은 계단 자리만 뚫린 바닥판 — 아래층 천장도 됨) */}
      {first || !stair ? (
        <Box p={[0, y + 0.03, 0]} s={[w - 0.1, 0.06, d - 0.1]} c={floorColor} />
      ) : (
        <group>
          <Box p={[0, y - 0.12, (hz1 + innerD) / 2]} s={[inner * 2, 0.25, innerD - hz1]} c={floorColor} />
          <Box p={[(hx1 + inner) / 2, y - 0.12, (hz0 + hz1) / 2]} s={[inner - hx1, 0.25, hz1 - hz0]} c={floorColor} />
          <Box p={[0, y - 0.255, (hz1 + innerD) / 2]} s={[inner * 2, 0.01, innerD - hz1]} c="#d9c8a6" />
          {/* 계단 구멍 가장자리 나무 난간 (도착하는 끝은 비움) */}
          <Box p={[(railFrom + railTo) / 2, y + 0.95, hz1]} s={[railTo - railFrom, 0.08, 0.1]} c="#7a5236" />
          {range(Math.max(2, Math.round((railTo - railFrom) / 1.1) + 1)).map((i, _, all) => (
            <Box key={i} p={[railFrom + ((railTo - railFrom) * i) / (all.length - 1), y + 0.48, hz1]} s={[0.08, 0.95, 0.08]} c="#5a3d2a" />
          ))}
        </group>
      )}
      {/* 벽: 겉은 짙은 나무, 안쪽 면은 밝은 회벽 */}
      <Box p={[0, y + h / 2, -d / 2 + WALL_T / 2]} s={[w, h, WALL_T]} c={GR_RED} />
      <Box p={[0, y + h / 2, -d / 2 + WALL_T + 0.01]} s={[w - 0.6, h - 0.3, 0.02]} c={LOBBY_WALL} />
      {[-1, 1].map((s) => (
        <group key={s}>
          <Box p={[s * (w / 2 - WALL_T / 2), y + h / 2, 0]} s={[WALL_T, h, d]} c={GR_RED} />
          <Box p={[s * (w / 2 - WALL_T - 0.01), y + h / 2, 0]} s={[0.02, h - 0.3, d - 0.6]} c={LOBBY_WALL} />
          {first && <Box p={[s * (GRAND_DOOR / 2 + side / 2), y + h / 2, d / 2 - WALL_T / 2]} s={[side, h, WALL_T]} c={GR_RED} />}
          {first && <Box p={[s * (GRAND_DOOR / 2 + 0.1), y + h / 2, d / 2 - WALL_T / 2]} s={[0.22, h, WALL_T + 0.1]} c={VERMILION} />}
          {/* 옆면 창 불빛 */}
          <Box p={[s * (w / 2 + 0.03), y + h * 0.5, 0]} s={[0.05, h * 0.3, d - 2]} m={SHOJI} />
        </group>
      ))}
      {first && <Box p={[0, y + h - 0.45, d / 2 - WALL_T / 2]} s={[GRAND_DOOR, 0.9, WALL_T]} c={DARK_WOOD} />}
      {first &&
        [-1, 1].map((s) => <Box key={`n${s}`} p={[s * 0.6, y + h - 1.25, d / 2 + 0.02]} s={[1.15, 0.75, 0.02]} c="#2d3a5c" />)}
      {!first && <Box p={[0, y + h / 2, d / 2 - WALL_T / 2]} s={[w, h, WALL_T]} c={GR_RED} />}
      {!first && !glass && <Box p={[0, y + h / 2, d / 2 - WALL_T - 0.01]} s={[w - 0.6, h - 0.3, 0.02]} c={LOBBY_WALL} />}
      {/* 바깥 앞면: 장지문 불빛 2줄(전망실은 큰 유리창 — 안에서도 밝게 보임) + 세로 살 */}
      {glass && <Box p={[0, y + h * 0.52, d / 2 + 0.03]} s={[bandW, h * 0.6, 0.05]} m={VIEW_GLASS} />}
      {glass && <Box p={[0, y + h * 0.52, d / 2 - WALL_T - 0.03]} s={[bandW, h * 0.6, 0.03]} m={VIEW_GLASS} />}
      {!glass &&
        [0.3, 0.68].map((t) =>
          first ? (
            [-1, 1].map((s) => (
              <Box key={`${t}${s}`} p={[s * (GRAND_DOOR / 2 + sideBand / 2), y + h * t, d / 2 + 0.03]} s={[sideBand, h * 0.26, 0.05]} m={SHOJI} />
            ))
          ) : (
            <Box key={t} p={[0, y + h * t, d / 2 + 0.03]} s={[bandW, h * 0.26, 0.05]} m={SHOJI} />
          ),
        )}
      {range(Math.round(bandW / 1.1)).map((i, _, all) => {
        const x = -bandW / 2 + (i * bandW) / (all.length - 1)
        if (first && Math.abs(x) < GRAND_DOOR / 2 + 0.1) return null
        return <Box key={`sl${i}`} p={[x, y + h / 2, d / 2 + 0.08]} s={[0.1, h * 0.9, 0.08]} c={DARK_WOOD} />
      })}
      {/* 2층부터: 붉은 발코니(바깥 장식, 들어갈 수 없음) */}
      {!first && <Box p={[0, y + 0.05, d / 2 + 0.45]} s={[w - 0.6, 0.1, 0.8]} c={WOOD} />}
      {!first && <Box p={[0, y + 0.95, d / 2 + 0.82]} s={[w - 0.6, 0.1, 0.1]} c={VERMILION} />}
      {!first &&
        range(12).map((i) => <Box key={`bp${i}`} p={[-w / 2 + 0.5 + (i * (w - 1)) / 11, y + 0.5, d / 2 + 0.82]} s={[0.08, 0.9, 0.08]} c={VERMILION} />)}
      {/* 층 위 처마 + 처마 끝 제등 (꼭대기 층은 큰 지붕이 대신) */}
      {!last && <Eave w={w} d={d} y={y + h - 0.05} out={first ? 1.5 : 1.2} color={GR_ROOF} />}
      {!last &&
        range(Math.round(w / 2.8)).map((i, _, all) => (
          <HangingLantern key={`hl${i}`} p={[-w / 2 + 1 + (i * (w - 2)) / Math.max(1, all.length - 1), y + h - 0.75, d / 2 + 1.05]} scale={first ? 1.15 : 0.95} />
        ))}
      {f.kind === 'rooms' && <FloorRooms y={y} h={h} w={w} d={d} />}
      {f.kind === 'bath' && <FloorBath y={y} h={h} w={w} />}
      {f.kind === 'banquet' && <FloorBanquet y={y} h={h} w={w} />}
      {f.kind === 'view' && <FloorView y={y} h={h} w={w} d={d} />}
    </group>
  )
}

const VIEW_GLASS = mat('#cfe6f5', { transparent: true, opacity: 0.35, emissive: '#ffe2b0', emissiveIntensity: 0.15, roughness: 0.05, double: true })
const STEAM = mat('#ffffff', { transparent: true, opacity: 0.35, roughness: 1 })
const BATH_WATER = mat('#7fc4c8', { transparent: true, opacity: 0.8, emissive: '#1d5a5e', emissiveIntensity: 0.3, roughness: 0.05, metalness: 0.2 })
const GOLD_SCREEN = mat('#d4b15a', { emissive: '#6b5214', emissiveIntensity: 0.25, roughness: 0.4, metalness: 0.3 })
const LANTERN_RED = mat('#a8532e', { emissive: '#ff9a4d', emissiveIntensity: 0.8 })

// 층 이름 간판 (계단 올라오는 쪽 천장에 매달림)
function FloorSign({ text, y, h, x = -2.6, z = -1.2 }) {
  return (
    <group position={[x, y + h - 0.6, z]}>
      <mesh>
        <planeGeometry args={[1.5, 0.55]} />
        <GlowMaterial glow={0.5} map={getJpSignTexture(text, '#3d2a1e', '#f3e6c8', 1.5 / 0.55)} side={THREE.DoubleSide} />
      </mesh>
      {[-1, 1].map((s) => (
        <Box key={s} p={[s * 0.55, 0.42, 0]} s={[0.02, 0.3, 0.02]} c="#2b1d14" />
      ))}
    </group>
  )
}

// 2층 객실: 뒷벽 미닫이 방문(번호패) 줄 + 동쪽 끝 문 열린 방(다다미·이불·상) + 복도 제등
function FloorRooms({ y, h, w, d }) {
  const back = -d / 2 + WALL_T
  const right = w / 2 - WALL_T
  return (
    <group>
      <FloorSign text="客室" y={y} h={h} />
      {range(5).map((i) => (
        <group key={i} position={[-2.6 + i * 1.9, y, back + 0.05]}>
          <Box p={[0, 1.05, 0]} s={[1.6, 2.1, 0.05]} c="#efe6cf" />
          <Box p={[0, 1.05, 0.03]} s={[0.04, 2.1, 0.02]} c={DARK_WOOD} />
          <Box p={[0, 2.15, 0.02]} s={[1.7, 0.1, 0.06]} c={DARK_WOOD} />
          <Box p={[0.55, 2.4, 0.03]} s={[0.36, 0.2, 0.02]} c="#3d2a1e" />
          <Box p={[0.55, 2.4, 0.045]} s={[0.24, 0.08, 0.01]} c="#f3e6c8" />
        </group>
      ))}
      {/* 문 열린 방 (동쪽 끝): 다다미 + 이불 + 낮은 상 + 행등 */}
      <Box p={[right - 1.6, y + 0.06, -1.6]} s={[3, 0.1, 3.8]} c={TATAMI} />
      <Box p={[right - 1.6, y + 0.115, -1.6]} s={[0.03, 0.01, 3.7]} c={TATAMI_EDGE} />
      <Box p={[right - 2.2, y + 0.2, -2.4]} s={[1.1, 0.16, 2]} c="#f5f0e6" />
      <Box p={[right - 2.2, y + 0.3, -1.65]} s={[1.1, 0.1, 0.5]} c="#9fb7d8" />
      <Box p={[right - 2.2, y + 0.29, -2.75]} s={[1.0, 0.12, 1.1]} c="#a8532e" />
      <group position={[right - 0.9, y + 0.1, -0.6]}>
        <Box p={[0, 0.25, 0]} s={[0.8, 0.05, 0.6]} c="#4a2f1f" />
        <Box p={[0, 0.12, 0]} s={[0.1, 0.24, 0.1]} c="#4a2f1f" />
        <Cyl p={[0.15, 0.32, 0]} rad={0.05} h={0.09} c="#5f7f4a" />
      </group>
      <Box p={[right - 0.45, y + 0.45, -3.2]} s={[0.32, 0.6, 0.32]} m={PAPER_GLOW} />
      {[-1.5, 2.5, 6.5].map((x) => (
        <HangingLantern key={x} p={[x, y + h - 0.7, 1.4]} scale={0.9} />
      ))}
    </group>
  )
}

// 3층 대욕장: 큰 나무 욕조(물·김) + 동쪽 벽 씻는 자리(의자·통·거울) + 대나무 칸막이
function FloorBath({ y, h, w }) {
  const right = w / 2 - WALL_T
  const tub = { x: 4.5, z: -0.8, w: 7.4, d: 4.2 }
  return (
    <group>
      <FloorSign text="大浴場" y={y} h={h} />
      <Box p={[3.5, y + 0.07, 0]} s={[13.4, 0.02, 7.2]} c="#9a958b" />
      <group position={[tub.x, y, tub.z]}>
        {[-1, 1].map((s) => (
          <group key={s}>
            <Box p={[0, 0.33, s * (tub.d / 2 - 0.12)]} s={[tub.w, 0.65, 0.24]} c="#a0764d" />
            <Box p={[s * (tub.w / 2 - 0.12), 0.33, 0]} s={[0.24, 0.65, tub.d]} c="#a0764d" />
          </group>
        ))}
        <Box p={[0, 0.25, 0]} s={[tub.w - 0.3, 0.5, tub.d - 0.3]} c="#6b4a30" />
        <Box p={[0, 0.54, 0]} s={[tub.w - 0.36, 0.02, tub.d - 0.36]} m={BATH_WATER} />
        {range(7).map((i) => (
          <mesh key={i} position={[-2.8 + i * 0.95, 1.0 + (i % 3) * 0.35, i % 2 ? 0.6 : -0.6]} material={STEAM} scale={[0.7, 0.45, 0.7]}>
            <sphereGeometry args={[1, 10, 8]} />
          </mesh>
        ))}
        <Box p={[tub.w / 2 - 0.4, 1.2, -tub.d / 2 + 0.3]} s={[0.12, 0.12, 0.9]} c="#7a8f3d" />
      </group>
      {range(4).map((i) => (
        <group key={i} position={[right - 0.5, y, -2.7 + i * 1.6]}>
          <Box p={[-0.35, 0.18, 0]} s={[0.35, 0.3, 0.3]} c="#c98a46" />
          <Cyl p={[-0.1, 0.12, 0.35]} rad={0.14} h={0.18} c="#a0764d" />
          <Box p={[0.22, 1.25, 0]} s={[0.03, 0.6, 0.45]} c="#cfe6f5" />
        </group>
      ))}
      <Box p={[-3.2, y + 0.9, 1.6]} s={[0.12, 1.8, 3.6]} c="#7a8f3d" />
      <HangingLantern p={[4.5, y + h - 0.8, 2.4]} scale={1} />
    </group>
  )
}

// 4층 연회장: 긴 낮은 상 2줄 + 방석·그릇 + 동쪽 무대(금 병풍·제등)
function FloorBanquet({ y, h, w }) {
  const right = w / 2 - WALL_T
  return (
    <group>
      <FloorSign text="宴会場" y={y} h={h} />
      <Box p={[1.6, y + 0.06, 0.6]} s={[11, 0.1, 6.2]} c={TATAMI} />
      {[-0.6, 2.2].map((z) => (
        <group key={z} position={[1.4, y + 0.1, z]}>
          <Box p={[0, 0.3, 0]} s={[8.4, 0.06, 0.8]} c="#4a2f1f" />
          {[-1, 1].map((s) => (
            <Box key={s} p={[s * 3.9, 0.14, 0]} s={[0.1, 0.28, 0.6]} c="#4a2f1f" />
          ))}
          {range(7).map((i) => (
            <group key={i}>
              {[-1, 1].map((s) => (
                <Box key={s} p={[-3.6 + i * 1.2, 0.05, s * 0.75]} s={[0.55, 0.08, 0.55]} c="#7f1d1d" />
              ))}
              <Cyl p={[-3.6 + i * 1.2, 0.36, -0.2]} rad={0.12} h={0.04} c="#9a3a30" />
              <Cyl p={[-3.6 + i * 1.2, 0.36, 0.2]} rad={0.12} h={0.04} c="#1f2937" />
            </group>
          ))}
        </group>
      ))}
      <Box p={[right - 1.85, y + 0.18, -0.6]} s={[3.2, 0.35, 5.4]} c="#6b4630" />
      {range(5).map((i) => (
        <Box key={i} p={[right - 0.12, y + 1.4, -2.6 + i * 1.0]} s={[0.04, 1.8, 0.98]} m={GOLD_SCREEN} />
      ))}
      {[-1, 1].map((s) => (
        <Cyl key={s} p={[right - 1.85, y + h - 0.8, -0.6 + s * 2]} rad={0.24} h={0.5} m={LANTERN_RED} />
      ))}
      <HangingLantern p={[1.4, y + h - 0.7, 0.8]} scale={1} />
    </group>
  )
}

// 5층 전망실: 큰 유리창 쪽을 보는 긴 의자 + 망원경 + 작은 신단 + 큰 제등
function FloorView({ y, h, w, d }) {
  const right = w / 2 - WALL_T
  const front = d / 2 - WALL_T
  return (
    <group>
      <FloorSign text="展望の間" y={y} h={h} />
      {[-0.5, 4.5].map((x) => (
        <group key={x} position={[x, y, front - 1.6]}>
          <Box p={[0, 0.42, 0]} s={[3, 0.08, 0.5]} c="#9a7650" />
          {[-1, 1].map((s) => (
            <Box key={s} p={[s * 1.3, 0.2, 0]} s={[0.1, 0.4, 0.42]} c="#5a3d2a" />
          ))}
        </group>
      ))}
      <group position={[8.5, y, front - 0.9]}>
        <Cyl p={[0, 0.6, 0]} rad={0.05} h={1.2} c="#2b2d30" />
        <mesh position={[0, 1.25, 0.15]} rotation={[-0.25, 0, 0]}>
          <cylinderGeometry args={[0.08, 0.1, 0.7, 12]} />
          <meshStandardMaterial color="#c9a245" metalness={0.5} roughness={0.4} />
        </mesh>
      </group>
      <group position={[right - 0.3, y + 1.6, -1.6]}>
        <Box p={[0, 0, 0]} s={[0.4, 0.08, 1.4]} c="#3a281c" />
        <Box p={[0, 0.3, 0]} s={[0.3, 0.5, 0.5]} c="#f5f0e6" />
        <Box p={[0, 0.6, 0]} s={[0.4, 0.1, 0.7]} c={ROOF} />
      </group>
      <Cyl p={[2, y + h - 1.0, -0.4]} rad={0.45} h={0.9} m={LANTERN_RED} />
    </group>
  )
}

// ── 큰 여관 1층 로비 ─────────────────────────
// 현관(돌바닥·신발장·슬리퍼) → 왼쪽 접수대(帳場, 열쇠판·주판·종) / 오른쪽 다다미 마루(이로리 화로·방석)
// 뒷벽: 장지문 불빛 + 도코노마(족자·꽃꽂이) / 오른쪽 벽: 온천 가는 문(ゆ 노렌) + 긴 의자·병우유 냉장고
// 충돌 있는 가구(접수대·화로·신발장·의자·냉장고)는 생성 스크립트의 GRAND_LOBBY_SOLIDS와 자리를 맞춤
const TATAMI = '#c8c38a'
const TATAMI_EDGE = '#3f4a2c'
const PAPER_GLOW = mat('#fff3d6', { emissive: '#ffcf86', emissiveIntensity: 0.9, roughness: 0.7 })
const FRIDGE_GLASS = mat('#bfe3f5', { transparent: true, opacity: 0.6, roughness: 0.1 })
const EMBER = mat('#ff6a2a', { emissive: '#ff4d12', emissiveIntensity: 1.4 })
function GrandRyokanLobby({ w, d, floor: F, ceil }) {
  const back = -d / 2 + WALL_T
  const front = d / 2 - WALL_T
  const right = w / 2 - WALL_T
  const left = -right
  const H = ceil - F
  return (
    <group>
      {/* ── 현관: 돌바닥 + 한 단 오른 마루턱 + 신발장 + 슬리퍼 ── */}
      <Box p={[0, F + 0.07, front - 0.8]} s={[GRAND_DOOR + 1.6, 0.02, 1.6]} c="#8f897f" />
      <Box p={[0, F + 0.09, front - 1.65]} s={[GRAND_DOOR + 1.6, 0.06, 0.18]} c={DARK_WOOD} />
      {range(5).map((k) => (
        <Box key={`sl${k}`} p={[-1 + k * 0.5, F + 0.1, front - 1.95]} s={[0.22, 0.04, 0.42]} c={k % 2 ? '#7c2d12' : '#1e3a5f'} />
      ))}
      {[-1, 1].map((s) => (
        <group key={`gb${s}`} position={[s * 2.6, F, front - 0.3]}>
          <Box p={[0, 0.6, 0]} s={[1.4, 1.2, 0.5]} c="#5a3d2a" />
          {range(3).map((r) =>
            range(4).map((c) => <Box key={`${r}${c}`} p={[-0.51 + c * 0.34, 0.25 + r * 0.36, -0.26]} s={[0.28, 0.28, 0.02]} c="#3a281c" />),
          )}
        </group>
      ))}

      {/* ── 왼쪽: 접수대 帳場 ── */}
      <group position={[-6, F, 0.6]}>
        <Box p={[0, 0.5, 0]} s={[3, 1, 0.7]} c="#4a2f1f" />
        <Box p={[0, 1.03, 0]} s={[3.2, 0.06, 0.85]} c="#2b1d14" />
        {/* 주판 + 장부 + 손 종 */}
        <Box p={[-0.8, 1.08, 0.05]} s={[0.6, 0.03, 0.22]} c="#3a281c" />
        {range(7).map((k) => (
          <Box key={`ab${k}`} p={[-1.05 + k * 0.08, 1.11, 0.05]} s={[0.02, 0.03, 0.2]} c="#9a7650" />
        ))}
        <Box p={[0.2, 1.08, 0.05]} s={[0.5, 0.04, 0.34]} c="#efe6cf" />
        <Cyl p={[0.9, 1.12, 0.05]} rad={0.06} h={0.08} c="#c9a245" />
        <Cyl p={[0.9, 1.2, 0.05]} rad={0.015} h={0.08} c="#2b1d14" />
        {/* 뒤쪽 열쇠판 (방 열쇠 나무패) */}
        <Box p={[0, 1.9, -0.9]} s={[2.2, 1, 0.08]} c="#5a3d2a" />
        {range(3).map((r) =>
          range(8).map((c) => <Box key={`k${r}${c}`} p={[-0.9 + c * 0.26, 2.2 - r * 0.3, -0.84]} s={[0.08, 0.2, 0.03]} c={(r + c) % 3 ? '#d8b98a' : '#9e673d'} />),
        )}
      </group>
      {/* 접수대 위 걸린 간판 */}
      <mesh position={[-6, ceil - 0.65, 0.6]}>
        <planeGeometry args={[1.6, 0.6]} />
        <GlowMaterial glow={0.5} map={getJpSignTexture('帳場', '#3d2a1e', '#f3e6c8', 1.6 / 0.6)} side={THREE.DoubleSide} />
      </mesh>
      {[-1, 1].map((s) => (
        <Box key={`hs${s}`} p={[-6 + s * 0.6, ceil - 0.2, 0.6]} s={[0.02, 0.3, 0.02]} c="#2b1d14" />
      ))}
      {/* 왼쪽 벽 금 병풍 */}
      {range(4).map((k) => (
        <Box
          key={`by${k}`}
          p={[left + 0.35 + (k % 2) * 0.12, F + 0.85, -1.7 + k * 0.62]}
          s={[0.04, 1.7, 0.62]}
          c={k % 2 ? '#d4b15a' : '#c9a245'}
        />
      ))}

      {/* ── 오른쪽: 다다미 마루 (높이 0.12) + 이로리 화로 + 방석 ── */}
      <Box p={[4.4, F + 0.06, -0.9]} s={[7, 0.12, 4.6]} c={TATAMI} />
      {range(4).map((k) => (
        <Box key={`te${k}`} p={[1.9 + k * 1.75, F + 0.125, -0.9]} s={[0.04, 0.01, 4.5]} c={TATAMI_EDGE} />
      ))}
      <Box p={[4.4, F + 0.125, -0.9]} s={[6.9, 0.01, 0.04]} c={TATAMI_EDGE} />
      <group position={[4.4, F + 0.12, -0.9]}>
        {/* 화로 테두리 + 재 + 숯불 */}
        <Box p={[0, 0.08, 0]} s={[1.4, 0.16, 1.4]} c="#3a281c" />
        <Box p={[0, 0.12, 0]} s={[1.1, 0.1, 1.1]} c="#8a8378" />
        {range(5).map((k) => (
          <mesh key={`em${k}`} position={[Math.sin(k * 2.4) * 0.22, 0.2, Math.cos(k * 2.4) * 0.22]} material={EMBER}>
            <dodecahedronGeometry args={[0.07, 0]} />
          </mesh>
        ))}
        {/* 천장에서 내려오는 자재 갈고리 + 쇠주전자 */}
        <Cyl p={[0, (H - 0.12 + 0.85) / 2, 0]} rad={0.03} h={H - 0.12 - 0.85} c="#2b1d14" />
        <Box p={[0, 1.15, 0]} s={[0.3, 0.06, 0.08]} c="#5a3d2a" />
        <mesh position={[0, 0.62, 0]}>
          <sphereGeometry args={[0.22, 14, 10]} />
          <meshStandardMaterial color="#26231f" />
        </mesh>
        <Cyl p={[0.24, 0.66, 0]} rad={0.03} h={0.16} c="#26231f" />
        {/* 방석 4장 */}
        {[[0, 1.2], [0, -1.2], [1.2, 0], [-1.2, 0]].map(([x, z]) => (
          <Box key={`z${x}${z}`} p={[x, 0.05, z]} s={[0.6, 0.08, 0.6]} c="#7f1d1d" />
        ))}
      </group>
      {/* 다다미 쪽 낮은 상 + 찻잔 */}
      <group position={[7.4, F + 0.12, -2.2]}>
        <Box p={[0, 0.3, 0]} s={[1.1, 0.06, 0.7]} c="#4a2f1f" />
        {[-1, 1].map((s) => (
          <Box key={s} p={[s * 0.45, 0.14, 0]} s={[0.08, 0.28, 0.6]} c="#4a2f1f" />
        ))}
        {[-0.2, 0.2].map((x) => (
          <Cyl key={x} p={[x, 0.38, 0]} rad={0.05} h={0.09} c="#5f7f4a" />
        ))}
      </group>

      {/* ── 뒷벽: 장지문 불빛 줄 + 도코노마 ── */}
      {[-8.5, -5.5, 7.5].map((x) => (
        <group key={`sj${x}`}>
          <Box p={[x, F + 1.5, back + 0.04]} s={[2.4, 2.2, 0.04]} m={SHOJI} />
          {range(5).map((k) => (
            <Box key={k} p={[x - 1.2 + k * 0.6, F + 1.5, back + 0.07]} s={[0.04, 2.2, 0.03]} c={DARK_WOOD} />
          ))}
          {range(3).map((k) => (
            <Box key={`h${k}`} p={[x, F + 0.55 + k * 0.95, back + 0.07]} s={[2.4, 0.04, 0.03]} c={DARK_WOOD} />
          ))}
        </group>
      ))}
      <group position={[-1.2, F, back + 0.5]}>
        <Box p={[0, 0.12, 0]} s={[2.4, 0.24, 0.9]} c="#3a281c" />
        <Box p={[-1.25, H / 2, 0]} s={[0.16, H, 0.16]} c="#7a5236" />
        {/* 족자 */}
        <Box p={[0, 1.7, -0.42]} s={[0.7, 1.5, 0.02]} c="#efe6cf" />
        <Box p={[0, 1.75, -0.4]} s={[0.05, 0.8, 0.01]} c="#2b1d14" />
        <Box p={[0.12, 1.45, -0.4]} s={[0.2, 0.2, 0.01]} c="#9a3a30" />
        {/* 꽃꽂이: 화병 + 가지 + 붉은 꽃 */}
        <Cyl p={[0.6, 0.42, 0]} rad={0.12} h={0.36} c="#2f4a5c" />
        <Box p={[0.6, 0.85, 0]} s={[0.03, 0.6, 0.03]} c="#4a3324" />
        <Box p={[0.72, 1.05, 0]} s={[0.25, 0.03, 0.03]} c="#4a3324" />
        {[[0.6, 1.15], [0.82, 1.08], [0.52, 0.95]].map(([x, y]) => (
          <mesh key={`fl${x}`} position={[x, y, 0]}>
            <sphereGeometry args={[0.06, 8, 6]} />
            <meshStandardMaterial color="#c6566e" />
          </mesh>
        ))}
      </group>

      {/* ── 오른쪽 벽: 온천 가는 문 (닫힌 미닫이 + ゆ 노렌) ── */}
      <group position={[right - 0.04, F, -1.6]}>
        <Box p={[0, 1.15, 0]} s={[0.05, 2.3, 1.8]} c="#6b4630" />
        <Box p={[-0.03, 1.15, 0]} s={[0.02, 2.2, 0.03]} c={DARK_WOOD} />
        <mesh position={[-0.06, 1.9, 0]} rotation={[0, -Math.PI / 2, 0]}>
          <planeGeometry args={[1.7, 0.75]} />
          <GlowMaterial glow={0.35} map={getJpSignTexture('ゆ', '#1e3a8a', '#f5f0e6', 1.7 / 0.75)} side={THREE.DoubleSide} />
        </mesh>
      </group>
      {/* 긴 나무 의자 + 병우유 냉장고 (현관 오른쪽 안쪽) */}
      <group position={[6.6, F, front - 0.45]}>
        <Box p={[0, 0.42, 0]} s={[2.6, 0.08, 0.5]} c="#9a7650" />
        {[-1, 1].map((s) => (
          <Box key={s} p={[s * 1.1, 0.2, 0]} s={[0.1, 0.4, 0.42]} c="#5a3d2a" />
        ))}
      </group>
      <group position={[right - 0.45, F, front - 0.5]}>
        <Box p={[0, 0.8, 0]} s={[0.7, 1.6, 0.6]} c="#e5e7eb" />
        <Box p={[-0.36, 0.95, 0]} s={[0.02, 1.1, 0.5]} m={FRIDGE_GLASS} />
        {range(2).map((r) =>
          range(3).map((c) => <Cyl key={`m${r}${c}`} p={[-0.2, 0.62 + r * 0.42, -0.15 + c * 0.15]} rad={0.04} h={0.2} c={r ? '#fde68a' : '#f8fafc'} />),
        )}
      </group>

      {/* ── 불빛: 바닥 행등(사방 종이등) + 천장 붉은 제등 ── */}
      {[[left + 0.5, 1.6], [2, back + 0.5], [right - 0.5, 1.2], [-3.4, front - 0.5]].map(([x, z]) => (
        <group key={`an${x}${z}`} position={[x, F, z]}>
          <Box p={[0, 0.06, 0]} s={[0.4, 0.12, 0.4]} c={DARK_WOOD} />
          <Box p={[0, 0.5, 0]} s={[0.34, 0.7, 0.34]} m={PAPER_GLOW} />
          <Box p={[0, 0.88, 0]} s={[0.4, 0.05, 0.4]} c={DARK_WOOD} />
        </group>
      ))}
      {[-6, 0, 4.4].map((x) => (
        <HangingLantern key={`hl${x}`} p={[x, ceil - 0.75, x === 4.4 ? 1.4 : -0.4]} scale={1.1} />
      ))}
    </group>
  )
}

// ── 돌 축대 수로 ──────────────────────────────
// size [폭, _, 길이]. 물은 땅(0) 바로 위, 양옆에 낮은 돌 난간. 충돌은 JSON의 collider로 (다리 자리는 따로 비움)
// item.natural: 골짜기 개울처럼 바닥 돌·물 위로 솟은 바위·거품을 더함 (온천 거리 수로는 깔끔하게)
// 물 위에 흐르는 물결 무늬(길이 방향 -z로 흐름) + 돌둑 안쪽 가장자리 거품 줄
const RIVER_ROCK = mat('#7d776e', { flat: true, roughness: 0.95 })
const MOSS_ROCK = mat('#6b7356', { flat: true, roughness: 1 })
const BED_STONE = mat('#5c5a52', { flat: true, roughness: 1 })
// 같은 개울은 늘 같은 자리에 바위가 놓이게 (Math.random 대신 정해진 수열)
const seeded = (n) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453
  return x - Math.floor(x)
}

export function JmCanal({ item }) {
  // (11/26) 여관 섬 둘레 바다는 자연스러운 물가의 큰 바다(jm_water.jsx JmSeaLake)가 그림 → 네모 바다 판은 걷기 막는 판정만 남기고 그리지 않음
  if (item.hideWater) return null
  return <JmCanalBody item={item} />
}
function JmCanalBody({ item }) {
  const [w, , len] = item.size
  const curb = item.curb ?? true
  const natural = item.natural ?? false
  const inner = w - 0.5
  // 11/25: 물은 hjSea와 똑같이 (jm_water.jsx) — 깊은 물 판 + 반투명 물결 면. 흐름 줄무늬·거품 띠는 뺌
  //   flowSpeed는 예전 데이터 호환용으로 받기만 함
  const water = useMemo(() => {
    const deep = new THREE.PlaneGeometry(inner, len)
    deep.rotateX(-Math.PI / 2)
    return { deep, surface: seaPlane(inner, len, Math.min(1.5, inner / 2)) }
  }, [inner, len])
  const rocks = useMemo(() => {
    if (!natural) return { up: [], bed: [] }
    const up = []
    const bed = []
    const n = Math.round(len / 3)
    for (let i = 0; i < n; i++) {
      const z = -len / 2 + ((i + 0.5) / n) * len + (seeded(i) - 0.5) * 1.2
      const x = (seeded(i + 50) - 0.5) * (inner - 0.6)
      const r = 0.14 + seeded(i + 90) * 0.22
      up.push({ p: [x, 0.04 + r * 0.25, z], r, rot: seeded(i + 7) * 6, moss: seeded(i + 31) > 0.6 })
      for (let k = 0; k < 2; k++) {
        bed.push({ p: [(seeded(i * 3 + k + 200) - 0.5) * inner, 0.055, z + (seeded(i * 5 + k) - 0.5) * 2], r: 0.12 + seeded(i + k + 400) * 0.16 })
      }
    }
    return { up, bed }
  }, [natural, len, inner])
  return (
    <group>
      <Box p={[0, 0.02, 0]} s={[w, 0.04, len]} c={item.wade ? '#57523f' : natural ? '#3e3b33' : '#4a443d'} />
      {/* 물 밑 돌: 물보다 낮게 깔아 비쳐 보이게 */}
      {!item.wade && rocks.bed.map((b, i) => (
        <mesh key={`b${i}`} position={b.p} scale={[b.r, b.r * 0.4, b.r]} material={BED_STONE}>
          <dodecahedronGeometry args={[1, 0]} />
        </mesh>
      ))}
      {item.wade ? (
        <group>
          <RiverWater w={w} len={len} y={item.depth ?? 0.3} far={60 + len / 2} still={item.view} />
          {!item.view && <WadeSplash w={w} len={len} y={item.depth ?? 0.3} />}
          {item.banks !== false && <RiverBanks w={w} len={len} depth={item.depth ?? 0.3} ends={item.ends} />}
        </group>
      ) : item.beach === 'sea' ? (
        // (11/26 지민 요청: 마을 쪽 바다도 새 물길과 같은 모양으로 이어지게) 한 색 판 → 강·물길과 같은 색 단계(물가 탁한 초록 → 가운데 짙은 청록) + 물결
        <RiverWater w={w} len={len} y={0.07} deep far={60 + len / 2} />
      ) : (
        <SeaWater deep={water.deep} surface={water.surface} y={0.045} gap={0.06} far={60 + len / 2} />
      )}
      {!item.wade && rocks.up.map((rk, i) => (
        <group key={`r${i}`} position={rk.p}>
          <mesh scale={[rk.r, rk.r * 0.55, rk.r * 0.85]} rotation={[0, rk.rot, 0]} material={rk.moss ? MOSS_ROCK : RIVER_ROCK}>
            <dodecahedronGeometry args={[1, 0]} />
          </mesh>
        </group>
      ))}
      {curb &&
        [-1, 1].map((side) => (
          <group key={side}>
            <Box p={[side * (w / 2 - 0.2), 0.22, 0]} s={[0.4, 0.44, len]} c={STONE} />
            <Box p={[side * (w / 2 - 0.2), 0.46, 0]} s={[0.5, 0.06, len]} c="#b9b2a5" />
            {/* 물 닿는 자리 이끼 띠 */}
            {natural && <Box p={[side * (w / 2 - 0.41), 0.12, 0]} s={[0.03, 0.12, len]} c="#4f6b3a" />}
          </group>
        ))}
    </group>
  )
}

// ── 가스등 (온천 거리 가로등) ──────────────────
export function JmGasLamp({ item }) {
  const [, h] = item.size
  return (
    <group>
      <Box p={[0, 0.15, 0]} s={[0.45, 0.3, 0.45]} c="#2c2a28" />
      <Cyl p={[0, h / 2, 0]} rad={0.07} h={h} c="#262422" />
      <group position={[0, h + 0.25, 0]}>
        <Box p={[0, 0, 0]} s={[0.42, 0.5, 0.42]} m={LAMP_GLOW} />
        {[-1, 1].map((sx) =>
          [-1, 1].map((sz) => <Box key={`${sx}${sz}`} p={[sx * 0.22, 0, sz * 0.22]} s={[0.05, 0.56, 0.05]} c="#1e1c1a" />),
        )}
        <mesh position={[0, 0.38, 0]}>
          <coneGeometry args={[0.38, 0.28, 4]} />
          <meshStandardMaterial color="#1e1c1a" flatShading />
        </mesh>
      </group>
    </group>
  )
}

// ── 천 개의 도리이 터널 ───────────────────────
// size [폭, 높이, 길이]. 길이 방향(z)으로 도리이가 촘촘히 이어짐. JSON "collider": false 권장 (양옆 벽은 jmCollider로)
export function JmToriiTunnel({ item }) {
  const [w, h, len] = item.size
  const count = item.count ?? Math.max(2, Math.round(len / 1.1))
  const span = w - 0.4
  return (
    <group>
      {range(count).map((i) => {
        const z = -len / 2 + (i * len) / (count - 1)
        const hh = h - (i % 2) * 0.15
        return (
          <group key={i} position={[0, 0, z]}>
            {[-1, 1].map((side) => (
              <group key={side}>
                <Cyl p={[(side * span) / 2, hh / 2, 0]} rad={0.15} h={hh} c={VERMILION} />
                <Cyl p={[(side * span) / 2, 0.22, 0]} rad={0.19} h={0.44} c="#1c1c1c" />
              </group>
            ))}
            <Box p={[0, hh - 0.95, 0]} s={[w, 0.22, 0.2]} c={VERMILION} />
            <Box p={[0, hh - 0.25, 0]} s={[w + 0.5, 0.22, 0.3]} c="#1c1c1c" />
          </group>
        )
      })}
    </group>
  )
}

// ── 건널목 (노면전차 선로를 가로지르는 골목) ─────────
// size [폭(골목), 높이, 깊이]. 양쪽 경보기 기둥 + 번갈아 깜빡이는 빨간 불 + 올라간 차단봉
// item.gap: 선로 가운데 ~ 기둥 거리 (기본 1.3 = 노면전차. 레일바이크 철길은 2.1 — 바이크 폭 1.6이라 1.3이면 지붕 기둥에 닿음)
const SIGNAL_ON = new THREE.MeshStandardMaterial({ color: '#ff2a1a', emissive: '#ff2a1a', emissiveIntensity: 1.6 })
const SIGNAL_OFF = new THREE.MeshStandardMaterial({ color: '#4a1210', emissive: '#000000' })
export function JmCrossing({ item }) {
  const [w, h] = item.size
  const lamps = useRef([])
  useFrame(({ clock }) => {
    const on = Math.floor(clock.elapsedTime * 2) % 2
    lamps.current.forEach((m, i) => {
      if (m) m.material = (i % 2) === on ? SIGNAL_ON : SIGNAL_OFF
    })
  })
  return (
    <group>
      {[-1, 1].map((side) => (
        <group key={side} position={[(side * w) / 2, 0, side * (item.gap ?? 1.3)]} rotation={[0, side > 0 ? Math.PI : 0, 0]}>
          <Cyl p={[0, h / 2, 0]} rad={0.07} h={h} c="#f1f1ee" />
          {range(5).map((k) => (
            <Cyl key={k} p={[0, 0.3 + k * 0.5, 0]} rad={0.075} h={0.25} c="#1d1d1d" />
          ))}
          {/* X자 표지 */}
          {[-1, 1].map((s) => (
            <Box key={s} p={[0, h - 0.25, 0.08]} s={[1.1, 0.16, 0.03]} r={[0, 0, s * 0.6]} c="#f5d020" />
          ))}
          {/* 경보등 두 개 */}
          <Box p={[0, h - 0.95, 0.06]} s={[0.9, 0.12, 0.06]} c="#1d1d1d" />
          {[-1, 1].map((s, k) => (
            <mesh
              key={s}
              ref={(m) => (lamps.current[(side > 0 ? 2 : 0) + k] = m)}
              position={[s * 0.36, h - 0.95, 0.12]}
              rotation={[Math.PI / 2, 0, 0]}
              material={SIGNAL_OFF}
              userData={{ noMerge: true }}
            >
              <cylinderGeometry args={[0.13, 0.13, 0.08, 14]} />
            </mesh>
          ))}
          {/* 차단기 상자 + 올라간 차단봉 */}
          <Box p={[0.45, 0.55, 0]} s={[0.4, 1.1, 0.35]} c="#e9e6dc" />
          {range(6).map((k) => (
            <Box key={k} p={[0.45, 1.3 + k * 0.42, 0]} s={[0.08, 0.42, 0.08]} c={k % 2 ? '#1d1d1d' : '#f5d020'} />
          ))}
        </group>
      ))}
    </group>
  )
}

// ── 포장마차 (야타이) ───────────────────────────
// size 예: [3, 2.6, 2]. item.signs[0]: 노렌 글씨
export function JmYatai({ item }) {
  const [w, h, d] = item.size
  const sign = item.signs?.[0]
  return (
    <group>
      <Box p={[0, 0.55, 0.1]} s={[w, 0.9, d * 0.6]} c={WOOD} />
      <Box p={[0, 1.04, 0.25]} s={[w + 0.1, 0.08, d * 0.75]} c="#8a603f" />
      {[-1, 1].map((side) => (
        <Cyl key={side} p={[side * (w / 2 - 0.2), 0.3, -d * 0.2]} rad={0.3} h={0.08} r={[0, 0, Math.PI / 2]} c={DARK_WOOD} />
      ))}
      {[-1, 1].map((sx) =>
        [-1, 1].map((sz) => <Box key={`${sx}${sz}`} p={[sx * (w / 2 - 0.08), (h + 1) / 2, sz * (d / 2 - 0.1)]} s={[0.08, h - 1, 0.08]} c={DARK_WOOD} />),
      )}
      <Box p={[0, h, 0]} s={[w + 0.4, 0.1, d + 0.3]} r={[0.12, 0, 0]} c="#6d3a2a" />
      {sign && (
        <mesh position={[0, h - 0.4, d / 2 + 0.05]}>
          <planeGeometry args={[w - 0.2, 0.6]} />
          <GlowMaterial glow={0.45} map={getJpSignTexture(sign.text, sign.bg ?? '#efe2c4', sign.fg ?? '#7a1d12', (w - 0.2) / 0.6)} side={THREE.DoubleSide} />
        </mesh>
      )}
      {[-1, 1].map((side) => (
        <HangingLantern key={side} p={[side * (w / 2 + 0.05), h - 0.55, d / 2 + 0.15]} scale={0.9} />
      ))}
    </group>
  )
}

// ── 붉은 다리 난간 ─────────────────────────────
// size [폭, _, 길이]. item.rise: 길이 방향(-z → +z)으로 올라가는 높이 (계단 다리용, 기본 0)
// 바닥(밟는 면)은 JSON의 길(roads)이나 terrain 계단이 맡고, 여기서는 난간·기둥머리 장식·아치 들보만 그림
export function JmBridgeRail({ item }) {
  const [w, , len] = item.size
  const rise = item.rise ?? 0
  const posts = Math.max(3, Math.round(len / 1.6) + 1)
  const slope = Math.atan2(rise, len)
  const railLen = Math.hypot(len, rise)
  return (
    <group>
      {[-1, 1].map((side) => (
        <group key={side} position={[(side * w) / 2, 0, 0]}>
          {range(posts).map((k) => {
            const t = k / (posts - 1)
            const z = -len / 2 + t * len
            const y = rise * t
            const end = k === 0 || k === posts - 1
            return (
              <group key={k} position={[0, y, z]}>
                <Box p={[0, 0.55, 0]} s={[0.16, 1.1, 0.16]} c={VERMILION} />
                {end && <Cyl p={[0, 1.2, 0]} rad={0.11} h={0.22} c="#c9a245" />}
              </group>
            )
          })}
          <Box p={[0, rise / 2 + 1.0, 0]} s={[0.12, 0.1, railLen]} r={[-slope, 0, 0]} c={VERMILION} />
          <Box p={[0, rise / 2 + 0.5, 0]} s={[0.08, 0.08, railLen]} r={[-slope, 0, 0]} c={VERMILION} />
          {rise === 0 && <Box p={[0, -0.05, 0]} s={[0.25, 0.3, len]} c={DARK_WOOD} />}
        </group>
      ))}
    </group>
  )
}

// ── 여관 가는 큰 붉은 다리 (11/25) ─────────────────
// 참고 사진: 붉은 난간 + 가로등 기둥이 양옆에 줄지어 선 넓은 다리, 가운데가 살짝 솟은 둥근(아치) 모양, 끝에 높은 건물이 정면으로 보이는 구도
// size [폭, _, 길이]. 소품 기준점 = 다리 양 끝의 발 딛는 면 높이(elevation), 길이 방향 = z
// item.arch: 가운데가 양 끝보다 높은 정도(m), item.piers: 교각 자리(로컬 z), item.depth: 양 끝 발 딛는 면에서 땅까지 높이
// 걷는 판정은 생성 스크립트가 아치를 따라 깐 경사로(지형 stairs smooth)와 jmCollider 난간이 맡고, 여기서는 그림만
//   (경사로의 돌 단은 이 다리 바닥판·옆 들보 안에 가려짐)
const BRIDGE_DECK = mat('#cfcac0', { roughness: 0.9 })
const BRIDGE_RED = mat('#a9543a', { roughness: 0.6 })
const BRIDGE_PIER = mat('#8f897f', { flat: true, roughness: 1 })
const BRIDGE_UNDER = mat('#5b4a3e', { flat: true, roughness: 1 })
const GLOBE = mat('#fffaf0', { emissive: '#ffe9b8', emissiveIntensity: 1.2, roughness: 0.4 })
const CAGE = mat('#2f2f2f', { roughness: 0.5 })
const BRIDGE_LAMP_GAP = 7.4
const BRIDGE_SEG = 36

export const archHeight = (arch, len, z) => arch * Math.sin((Math.PI * (z + len / 2)) / len)

export function JmGrandBridge({ item }) {
  const [w, , len] = item.size
  const arch = item.arch ?? 0
  const depth = item.depth ?? 6
  const piers = item.piers ?? []
  const half = w / 2
  const showLamps = item.lamps !== false // 여관 안 다리는 가로등 없이
  const deckMat = item.deckColor ? mat(item.deckColor, { roughness: 0.7 }) : BRIDGE_DECK
  const parts = useMemo(() => {
    const y = (z) => archHeight(arch, len, z)
    const deck = []
    const lines = []
    const reds = []
    const under = []
    const seg = len / BRIDGE_SEG
    for (let i = 0; i < BRIDGE_SEG; i++) {
      const z0 = -len / 2 + i * seg
      const z1 = z0 + seg
      const y0 = y(z0)
      const y1 = y(z1)
      const zm = (z0 + z1) / 2
      const ym = (y0 + y1) / 2
      const L = Math.hypot(seg, y1 - y0) + 0.02
      const pitch = Math.atan2(y1 - y0, seg) // +z로 갈수록 올라가면 앞이 들려야 함 → x축 회전은 -pitch
      const r = [-pitch, 0, 0]
      deck.push({ p: [0, ym - 0.2, zm], r, s: [w, 0.4, L] })
      lines.push({ p: [0, ym + 0.006, zm], r, s: [0.04, 0.01, L] })
      for (const t of [-1 / 3, 1 / 3]) lines.push({ p: [t * w, ym + 0.006, zm], r, s: [0.05, 0.01, L] })
      for (const side of [-1, 1]) {
        const x = side * (half - 0.12)
        reds.push({ p: [x, ym + 1.08, zm], r, s: [0.2, 0.14, L] }) // 손잡이
        reds.push({ p: [x, ym + 0.62, zm], r, s: [0.1, 0.1, L] }) // 가운데 가로대
        reds.push({ p: [x, ym + 0.14, zm], r, s: [0.16, 0.16, L] }) // 밑 가로대
        reds.push({ p: [side * half, ym - 0.35, zm], r, s: [0.3, 0.7, L] }) // 아치를 따라 휘는 옆 들보
        // 들보 밑 옆판(아래쪽은 평평): 경사로 돌 단을 가림
        const bottom = item.underBottom ?? -0.75
        const top = Math.min(y0, y1) - 0.5
        if (top > bottom) under.push({ p: [side * (half - 0.05), (top + bottom) / 2, zm], s: [0.2, top - bottom, seg + 0.02] })
      }
    }
    for (const side of [-1, 1]) {
      const x = side * (half - 0.12)
      const posts = Math.round(len / 1.5)
      for (let k = 0; k <= posts; k++) {
        const z = -len / 2 + (k * len) / posts
        reds.push({ p: [x, y(z) + 0.58, z], s: [0.22, 1.16, 0.22] })
      }
      const bars = Math.round(len / 0.5)
      for (let k = 0; k < bars; k++) {
        const z = -len / 2 + ((k + 0.5) * len) / bars
        reds.push({ p: [x, y(z) + 0.38, z], s: [0.05, 0.42, 0.05] })
      }
    }
    // 가로줄 이음 (판석)
    for (let z = -len / 2 + 1.8; z < len / 2; z += 1.8) lines.push({ p: [0, y(z) + 0.008, z], r: [-Math.atan((Math.PI * arch * Math.cos((Math.PI * (z + len / 2)) / len)) / len), 0, 0], s: [w - 0.6, 0.01, 0.04] })
    return { deck, lines, reds, under }
  }, [w, len, half, arch, item.underBottom])
  const lamps = showLamps ? Math.max(2, Math.round(len / BRIDGE_LAMP_GAP) + 1) : 0
  return (
    <group>
      <Instances geometry={GEO.box} material={deckMat} items={parts.deck} castShadow />
      <Instances geometry={GEO.box} material={mat('#b4aea3')} items={parts.lines} />
      <Instances geometry={GEO.box} material={BRIDGE_RED} items={parts.reds} castShadow />
      <Instances geometry={GEO.box} material={BRIDGE_UNDER} items={parts.under} />
      {/* 양 끝 기둥머리 금색 장식 */}
      {[-1, 1].flatMap((sx) => [-1, 1].map((sz) => <Cyl key={`${sx}${sz}`} p={[sx * (half - 0.12), 1.3, (sz * len) / 2]} rad={0.14} h={0.3} c="#c9a245" />))}
      {/* 가로등 기둥: 붉은 기둥 + 위쪽 가로대(끝이 살짝 들림) + 안쪽으로 매단 둥근 등 */}
      {range(lamps).flatMap((k) =>
        [-1, 1].map((side) => {
          const z = -len / 2 + 0.8 + (k * (len - 1.6)) / (lamps - 1)
          return (
            <group key={`${k}${side}`} position={[side * (half - 0.12), archHeight(arch, len, z), z]}>
              <Box p={[0, 0.2, 0]} s={[0.5, 0.4, 0.5]} c="#2b2b2b" />
              <Cyl p={[0, 2.6, 0]} rad={0.13} h={5.2} m={BRIDGE_RED} />
              <Box p={[-side * 0.45, 5.05, 0]} s={[1.3, 0.12, 0.16]} m={BRIDGE_RED} />
              <Box p={[-side * 1.12, 5.12, 0]} s={[0.22, 0.1, 0.16]} r={[0, 0, side * 0.45]} m={BRIDGE_RED} />
              <Box p={[side * 0.2, 5.12, 0]} s={[0.2, 0.1, 0.16]} r={[0, 0, -side * 0.45]} m={BRIDGE_RED} />
              <group position={[-side * 0.85, 4.35, 0]}>
                <Cyl p={[0, 0.55, 0]} rad={0.02} h={0.3} m={CAGE} />
                <Ball p={[0, 0, 0]} s={[0.3, 0.38, 0.3]} m={GLOBE} />
                {[0, Math.PI / 2].map((a) => (
                  <mesh key={a} rotation={[0, a, 0]} scale={[1, 1.27, 1]}>
                    <torusGeometry args={[0.34, 0.015, 4, 20]} />
                    <primitive object={CAGE} attach="material" />
                  </mesh>
                ))}
                <Cyl p={[0, 0.42, 0]} rad={0.12} h={0.06} m={CAGE} />
                <Cyl p={[0, -0.42, 0]} rad={0.1} h={0.05} m={CAGE} />
              </group>
            </group>
          )
        }),
      )}
      {/* 교각: 돌기둥 2개 + 붉은 가로 들보 */}
      {piers.map((z) => (
        <group key={z} position={[0, 0, z]}>
          {[-1, 1].map((side) => (
            <Box key={side} p={[side * (half - 0.7), -depth / 2 - 0.5, 0]} s={[0.9, depth - 1, 0.9]} m={BRIDGE_PIER} />
          ))}
          <Box p={[0, -0.95, 0]} s={[w - 0.4, 0.4, 0.5]} m={BRIDGE_RED} />
        </group>
      ))}
    </group>
  )
}

// ── 마을 이름 돌비석 ───────────────────────────
export function JmStoneMonument({ item }) {
  const [w, h, d] = item.size
  const text = item.signs?.[0]?.text ?? ''
  return (
    <group>
      <Box p={[0, 0.2, 0]} s={[w + 0.6, 0.4, d + 0.6]} c="#8f897f" />
      <Box p={[0, 0.4 + (h - 0.4) / 2, 0]} s={[w, h - 0.4, d]} c="#6f6b64" />
      <mesh position={[0, 0.4 + (h - 0.4) / 2, d / 2 + 0.01]}>
        <planeGeometry args={[w * 0.82, (h - 0.4) * 0.8]} />
        <meshStandardMaterial map={getJpSignTexture(text, '#5f5b55', '#f1e6cf', (w * 0.82) / ((h - 0.4) * 0.8))} />
      </mesh>
    </group>
  )
}

// ── 장면 자리 (작품이 정해지기 전 빈 마당) ─────────────
// size [가로, _, 깊이]. 돌 마당 + 나무 테두리 + 뒤쪽(-z) 간판(signs[0] 큰 글씨, signs[1] 작은 글씨) + 네 귀퉁이 등불
// 작품이 정해지면 이 마당 위에 장면 소품을 올리면 돼요. 앞(+z)에서 다가오도록 rotationDeg로 돌림
export function JmSceneSpot({ item }) {
  const [w, , d] = item.size
  const title = item.signs?.[0]?.text ?? '장면 자리'
  const sub = item.signs?.[1]?.text
  return (
    <group>
      <Box p={[0, 0.03, 0]} s={[w, 0.06, d]} c="#cdbf9f" />
      {[-1, 1].map((side) => (
        <group key={side}>
          <Box p={[0, 0.08, (side * d) / 2]} s={[w + 0.2, 0.12, 0.18]} c={DARK_WOOD} />
          <Box p={[(side * w) / 2, 0.08, 0]} s={[0.18, 0.12, d]} c={DARK_WOOD} />
        </group>
      ))}
      {[-1, 1].map((sx) =>
        [-1, 1].map((sz) => (
          <group key={`${sx}${sz}`} position={[sx * (w / 2 - 0.4), 0, sz * (d / 2 - 0.4)]}>
            <Box p={[0, 0.45, 0]} s={[0.16, 0.9, 0.16]} c={DARK_WOOD} />
            <Box p={[0, 1.05, 0]} s={[0.3, 0.32, 0.3]} m={LAMP_GLOW} />
          </group>
        )),
      )}
      <group position={[0, 0, -d / 2 + 0.6]}>
        {[-1, 1].map((side) => (
          <Box key={side} p={[side * 1.5, 1.2, 0]} s={[0.14, 2.4, 0.14]} c={DARK_WOOD} />
        ))}
        <Box p={[0, 2.5, 0]} s={[3.6, 0.14, 0.3]} c={ROOF} />
        <mesh position={[0, 1.75, 0.08]}>
          <planeGeometry args={[2.8, 0.75]} />
          <GlowMaterial glow={0.5} map={getJpSignTexture(title, '#f3e6c8', '#5b1a12', 2.8 / 0.75)} side={THREE.DoubleSide} />
        </mesh>
        {sub && (
          <mesh position={[0, 1.15, 0.08]}>
            <planeGeometry args={[2.2, 0.42]} />
            <GlowMaterial glow={0.35} map={getJpSignTexture(sub, '#3d2a1e', '#f3e6c8', 2.2 / 0.42)} side={THREE.DoubleSide} />
          </mesh>
        )}
      </group>
    </group>
  )
}

export const JM_KYOTO_STYLES = {
  jmSceneSpot: JmSceneSpot,
  jmRyokan: JmRyokan,
  jmGrandRyokan: JmGrandRyokan,
  jmCanal: JmCanal,
  jmGasLamp: JmGasLamp,
  jmToriiTunnel: JmToriiTunnel,
  jmCrossing: JmCrossing,
  jmYatai: JmYatai,
  jmBridgeRail: JmBridgeRail,
  jmGrandBridge: JmGrandBridge,
  jmStoneMonument: JmStoneMonument,
}
