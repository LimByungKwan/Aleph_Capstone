import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { hipRoofGeometry } from './geometry.js'
import { Box, Cyl, mat } from './kit.jsx'
import { getJpSignTexture, GlowMaterial } from './jm_landmarks.jsx'

// 애니메이션 구역(JM) — 교토 온천 마을 「유아카리초(湯灯町)」 스타일. 담당: 지민
// 분위기 참고: 교토 옛 거리(산넨자카·기온·후시미 이나리·기요미즈 무대) + 강을 끼고 여러 층 목조 여관이 늘어선 온천 거리.
// 특정 작품의 건물·캐릭터를 그대로 옮기지 않고, 일본 목조 건축의 공통 요소(붉은 기둥·기와·장지문 불빛·제등)로만 만들어요.
// 약속은 다른 JM 스타일과 같음: size [가로, 높이, 깊이] 상자 안, 앞면 +z, rotationDeg로 방향.

const VERMILION = '#c8452f'
const DARK_WOOD = '#3d2a1e'
const WOOD = '#6b4630'
const ROOF = '#2f3338'
const PLASTER = '#efe6d2'
const STONE = '#9d978c'

const range = (n) => Array.from({ length: n }, (_, i) => i)

// 밤에 따뜻하게 빛나는 장지문·창 (재질은 캐시돼서 모든 여관이 같이 씀 → 합쳐 그리기에 유리)
const SHOJI = mat('#ffe7b8', { emissive: '#ffb45e', emissiveIntensity: 0.75, roughness: 0.6 })
const LANTERN = mat('#e0412c', { emissive: '#ff6a35', emissiveIntensity: 0.9 })
const LAMP_GLOW = mat('#fff1cf', { emissive: '#ffcf7a', emissiveIntensity: 1.3 })
const WATER = mat('#3f7f8c', { emissive: '#163a44', emissiveIntensity: 0.35, roughness: 0.15, metalness: 0.2 })

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

// ── 언덕 위 큰 온천 여관 (마을의 상징) ─────────────
// 3단으로 위로 갈수록 좁아지는 목조 건물. 1층 앞은 붉은 기둥 회랑, 맨 뒤에 굴뚝.
// size 예: [34, 12, 20]. 굴뚝·꼭대기 장식은 size 높이보다 조금 더 올라가요 (충돌은 size 그대로)
export function JmGrandRyokan({ item }) {
  const [w, h, d] = item.size
  const sign = item.signs?.[0]
  const tiers = [
    { sw: 1, sd: 1, fh: h * 0.3 },
    { sw: 0.78, sd: 0.72, fh: h * 0.24 },
    { sw: 0.52, sd: 0.48, fh: h * 0.2 },
  ]
  let y = 0.6
  const parts = tiers.map((t) => {
    const part = { ...t, y, tw: w * t.sw, td: d * t.sd }
    y += t.fh
    return part
  })
  const roofs = useMemo(
    () => parts.map((p, i) => hipRoofGeometry(p.tw + 1.6, p.td + 1.6, i === parts.length - 1 ? h * 0.16 : 1.1, 0.35)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [w, d, h],
  )

  return (
    <group>
      {/* 돌 기단 + 앞 계단 */}
      <Box p={[0, 0.3, 0]} s={[w + 1, 0.6, d + 1]} c={STONE} />
      {range(3).map((i) => (
        <Box key={i} p={[0, 0.1 + i * 0.2, d / 2 + 1.6 - i * 0.4]} s={[8, 0.2, 0.4]} c="#b5ad9f" />
      ))}
      {parts.map((p, i) => {
        const fz = p.td / 2
        const bandW = p.tw - 1.4
        return (
          <group key={i}>
            <Box p={[0, p.y + p.fh / 2, 0]} s={[p.tw, p.fh, p.td]} c={i === 0 ? DARK_WOOD : WOOD} />
            {/* 장지문 불빛 2줄 */}
            {[0.3, 0.68].map((t) => (
              <Box key={t} p={[0, p.y + p.fh * t, fz + 0.03]} s={[bandW, p.fh * 0.26, 0.05]} m={SHOJI} />
            ))}
            {range(Math.round(bandW / 1.1)).map((k, _, all) => (
              <Box key={k} p={[-bandW / 2 + (k * bandW) / (all.length - 1), p.y + p.fh / 2, fz + 0.08]} s={[0.1, p.fh * 0.9, 0.08]} c={DARK_WOOD} />
            ))}
            {/* 옆면 창 */}
            {[-1, 1].map((side) => (
              <Box key={side} p={[side * (p.tw / 2 + 0.03), p.y + p.fh * 0.5, 0]} s={[0.05, p.fh * 0.3, p.td - 2]} m={SHOJI} />
            ))}
            {/* 발코니 난간 (2단부터) */}
            {i > 0 && <Box p={[0, p.y + 0.9, fz + 0.7]} s={[p.tw - 0.6, 0.1, 0.1]} c={VERMILION} />}
            {i > 0 && <Box p={[0, p.y + 0.05, fz + 0.4]} s={[p.tw - 0.6, 0.1, 0.8]} c={WOOD} />}
            <mesh geometry={roofs[i]} position={[0, p.y + p.fh, 0]}>
              <meshStandardMaterial color={ROOF} flatShading side={THREE.DoubleSide} />
            </mesh>
            {/* 처마 끝 제등 줄 */}
            {range(Math.round(p.tw / 2.6)).map((k, _, all) => (
              <HangingLantern key={k} p={[-p.tw / 2 + 1 + (k * (p.tw - 2)) / Math.max(1, all.length - 1), p.y + p.fh - 0.6, fz + 1]} scale={i === 0 ? 1.2 : 1} />
            ))}
          </group>
        )
      })}
      {/* 1층 붉은 기둥 회랑 */}
      {range(9).map((k) => (
        <Cyl key={k} p={[-w / 2 + 1 + (k * (w - 2)) / 8, 0.6 + parts[0].fh / 2, d / 2 + 0.9]} rad={0.22} h={parts[0].fh} c={VERMILION} />
      ))}
      <Box p={[0, 0.6 + parts[0].fh - 0.15, d / 2 + 0.9]} s={[w - 1.6, 0.3, 0.35]} c={VERMILION} />
      {/* 정면 큰 현판 */}
      {sign && (
        <group position={[0, parts[1].y + parts[1].fh * 0.95, parts[1].td / 2 + 0.7]}>
          <Box p={[0, 0, -0.06]} s={[5.4, 1.7, 0.1]} c={DARK_WOOD} />
          <mesh>
            <planeGeometry args={[5, 1.4]} />
            <GlowMaterial glow={0.8} map={getJpSignTexture(sign.text, sign.bg ?? '#f3dfb2', sign.fg ?? '#7a1d12', 5 / 1.4)} side={THREE.DoubleSide} />
          </mesh>
        </group>
      )}
      {/* 지붕 꼭대기 장식 */}
      <Cyl p={[0, y + h * 0.16 + 0.5, 0]} rad={0.25} h={1} c="#c9a245" />
      {/* 굴뚝 (온천 보일러) */}
      <group position={[w * 0.38, 0, -d * 0.32]}>
        <Cyl p={[0, (h + 6) / 2, 0]} rad={0.8} h={h + 6} c="#7d6c5e" />
        <Cyl p={[0, h + 6, 0]} rad={0.95} h={0.5} c="#3d3530" />
        {range(4).map((k) => (
          <Cyl key={k} p={[0, 3 + k * ((h + 2) / 4), 0]} rad={0.84} h={0.18} c="#4b403a" />
        ))}
      </group>
    </group>
  )
}

// ── 돌 축대 수로 ──────────────────────────────
// size [폭, _, 길이]. 물은 땅(0) 바로 위, 양옆에 낮은 돌 난간. 충돌은 JSON의 collider로 (다리 자리는 따로 비움)
export function JmCanal({ item }) {
  const [w, , len] = item.size
  const curb = item.curb ?? true
  return (
    <group>
      <Box p={[0, 0.02, 0]} s={[w, 0.04, len]} c="#4a443d" />
      <Box p={[0, 0.06, 0]} s={[w - 0.5, 0.02, len]} m={WATER} />
      {curb &&
        [-1, 1].map((side) => (
          <group key={side}>
            <Box p={[side * (w / 2 - 0.2), 0.22, 0]} s={[0.4, 0.44, len]} c={STONE} />
            <Box p={[side * (w / 2 - 0.2), 0.46, 0]} s={[0.5, 0.06, len]} c="#b9b2a5" />
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
        <group key={side} position={[(side * w) / 2, 0, side * 1.3]} rotation={[0, side > 0 ? Math.PI : 0, 0]}>
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
  jmStoneMonument: JmStoneMonument,
}
