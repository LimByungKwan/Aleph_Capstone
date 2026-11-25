import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import { hipRoofGeometry } from './geometry.js'
import { Box, Cyl, Ball, GEO, Instances, mat, seeded, texMat } from './kit.jsx'
import { canvasTexture, getJpSignTexture, GlowMaterial, JP_FONT } from './jm_landmarks.jsx'
import { getTiledTexture, TILE_METERS } from './textures.js'
import { VerticalSign } from './jm_ginzan.jsx'
import { useGameStore } from '../../../store/gameStore.js'
import { useUiStore } from '../../../components/movieZone/uiStore.js'
import { useWarps } from './bk_warpStore.js'

// 애니 구역(JM) 「센과 치히로의 행방불명」 배경 마을 (11/25 지민 요청: 교토 대신 영화 속 마을로 구역 전체를 다시) — 담당: 지민
// 영화 순서: 붉은 탑 터널 → 풀밭 언덕 → 마른 강(징검돌) → 돌계단 → 텅 빈 음식점 거리(붉은 등·간판) → 붉은 다리(밑은 바다 위 철길)
//   → 온천장. 온천장 옆 바깥 계단을 내려가면 맨 아래 보일러실, 안에는 층을 오가는 엘리베이터
// 참고: 영화 장면 설명·공개 스틸 + 실제 모델로 알려진 곳(지우펀 붉은 등 골목, 도고 온천 본관, 에도도쿄 건축원 다케이 산쇼도 약방 서랍장)
// 캐릭터·영화 그림·영화 속 간판 글자는 넣지 않음. 간판은 우리가 지은 가게 이름만
// 앞면 = 로컬 +z. 걷는 판정은 생성 스크립트(gen-jm-kyoto.mjs)가 jmCollider·건물 상자로

const range = (n) => Array.from({ length: n }, (_, i) => i)

const STONE = mat('#8e877c', { roughness: 1 })
const DARK = mat('#2a1a12', { roughness: 0.9 })
const WOOD = mat('#5e4130', { roughness: 0.85 })
const IRON = mat('#23201d', { roughness: 0.55, metalness: 0.4 })
const BRASS = mat('#b8913c', { roughness: 0.4, metalness: 0.6 })
const INNER_GLOW = mat('#ffcf8a', { emissive: '#ff9a3c', emissiveIntensity: 0.9, roughness: 0.7 })
const LANTERN_RED = mat('#d23a28', { emissive: '#ff4a22', emissiveIntensity: 1.1, roughness: 0.6 })
const LANTERN_WHITE = mat('#fff1d6', { emissive: '#ffcf7a', emissiveIntensity: 1.0, roughness: 0.6 })
const LANTERN_CAP = mat('#1b1210')
const BOWL = mat('#f1e8d6', { roughness: 0.5 })
const WALL_LAMP = mat('#ff9ab8', { emissive: '#ff5a8a', emissiveIntensity: 1.4 })
const FIRE = mat('#ff8a2a', { emissive: '#ff5a10', emissiveIntensity: 2.0 })

// 건물 벽색 (붉은 칠·짙은 나무·황토·크림·초록) + 지붕색
const WALLS = ['#8f2b22', '#5a3a26', '#b88a3e', '#e3d6b8', '#3f5d4c', '#7a2f4a']
const ROOFS = ['#2e3236', '#3f6e58', '#2e3236', '#5b2b22']
const COPPER = '#5f9a84'
// (11/25 지민이 보낸 거리 장면 참고) 파스텔 서양식 외벽: 민트·황토·분홍보라·연하늘, 테라코타 기와
const PASTELS = ['#86c7a8', '#d9b45e', '#b9719a', '#9cc3d6', '#e6c88f']
const TERRACOTTA = '#b8603e'

// 층마다 불 켜진 격자창 띠 그림 (한 장을 여러 건물이 나눠 씀)
function windowStripTexture(kind) {
  return canvasTexture(`jmspirit:win:${kind}`, 512, 128, (ctx, w, h) => {
    ctx.fillStyle = '#2a1a12'
    ctx.fillRect(0, 0, w, h)
    const cols = kind === 'round' ? 4 : kind === 'arch' ? 5 : 8
    const cw = w / cols
    for (let i = 0; i < cols; i++) {
      const x = i * cw + cw * 0.1
      const g = ctx.createLinearGradient(0, 0, 0, h)
      g.addColorStop(0, '#ffe2a8')
      g.addColorStop(1, '#ffb45c')
      ctx.fillStyle = g
      if (kind === 'arch') {
        ctx.beginPath()
        ctx.moveTo(x, h * 0.92)
        ctx.lineTo(x, h * 0.42)
        ctx.arc(x + cw * 0.4, h * 0.42, cw * 0.4, Math.PI, 0)
        ctx.lineTo(x + cw * 0.8, h * 0.92)
        ctx.fill()
      } else if (kind === 'round') {
        ctx.beginPath()
        ctx.arc(x + cw * 0.4, h / 2, Math.min(cw, h) * 0.36, 0, Math.PI * 2)
        ctx.fill()
      } else ctx.fillRect(x, h * 0.14, cw * 0.8, h * 0.72)
      ctx.strokeStyle = '#3a2416'
      ctx.lineWidth = 3
      for (let k = 1; k < 3; k++) {
        ctx.beginPath()
        ctx.moveTo(x + (cw * 0.8 * k) / 3, h * 0.14)
        ctx.lineTo(x + (cw * 0.8 * k) / 3, h * 0.86)
        ctx.stroke()
      }
      ctx.beginPath()
      ctx.moveTo(x, h / 2)
      ctx.lineTo(x + cw * 0.8, h / 2)
      ctx.stroke()
    }
  })
}

// 색유리 아치 창 (마름모 색유리)
function stainedTexture() {
  return canvasTexture('jmspirit:stained', 128, 160, (ctx, w, h) => {
    ctx.fillStyle = '#2a1a12'
    ctx.fillRect(0, 0, w, h)
    ctx.save()
    ctx.beginPath()
    ctx.moveTo(6, h - 6)
    ctx.lineTo(6, w / 2)
    ctx.arc(w / 2, w / 2, w / 2 - 6, Math.PI, 0)
    ctx.lineTo(w - 6, h - 6)
    ctx.closePath()
    ctx.clip()
    const cols = ['#e8b04a', '#d94f4f', '#4f8fd9', '#59b36b', '#f2a3c0']
    for (let r = 0; r < 8; r++) for (let c = 0; c < 4; c++) {
      ctx.fillStyle = cols[(r + c * 2) % cols.length]
      ctx.beginPath()
      const cx = c * 32 + (r % 2) * 16
      const cy = r * 22
      ctx.moveTo(cx, cy - 16)
      ctx.lineTo(cx + 16, cy)
      ctx.lineTo(cx, cy + 16)
      ctx.lineTo(cx - 16, cy)
      ctx.fill()
      ctx.strokeStyle = '#2a1a12'
      ctx.lineWidth = 3
      ctx.stroke()
    }
    ctx.restore()
  })
}

// 붉은 등(초친) 하나: 몸통 + 위아래 검은 테
function Chochin({ p, r = 0.28, h = 0.62, white = false }) {
  return (
    <group position={p}>
      <mesh geometry={GEO.sphere} material={white ? LANTERN_WHITE : LANTERN_RED} scale={[r, h / 2, r]} />
      <Cyl p={[0, h / 2 - 0.02, 0]} rad={r * 0.55} h={0.08} m={LANTERN_CAP} />
      <Cyl p={[0, -h / 2 + 0.02, 0]} rad={r * 0.55} h={0.08} m={LANTERN_CAP} />
    </group>
  )
}

// ── 음식점 (텅 빈 음식점 거리) ─────────────────
// item.size [w(앞면 폭), h, d], item.floors 2|3, item.seed, item.sign { text, bg, fg }(가로 큰 간판), item.vsign(세로 간판 글자)
// item.noren(1층 노렌 짧은 글자), item.look 'wood' | 'retro'(구리 초록 서양식 앞면)
// 1층 앞면은 트여 있고 카운터에 음식 그릇, 처마 밑에 붉은 등 줄. 위층은 불 켜진 창
export function JmEatery({ item }) {
  const [w, h, d] = item.size
  const seed = item.seed ?? 0
  const floors = item.floors ?? 2
  const look = item.look ?? 'wood'
  const base = 0.3
  const roofH = look === 'retro' ? 0.8 : 1.7
  const fh = (h - base - roofH) / floors
  const front = d / 2
  const pastel = look === 'pastel'
  const wall = pastel ? PASTELS[seed % PASTELS.length] : WALLS[seed % WALLS.length]
  const roofC = pastel ? TERRACOTTA : ROOFS[seed % ROOFS.length]
  const roof = useMemo(() => hipRoofGeometry(w + 0.9, d + 0.9, roofH, 0.2), [w, d, roofH])
  const eave = useMemo(() => hipRoofGeometry(w + 0.6, 2.4, 0.55, 0.06), [w])
  const winTex = windowStripTexture(pastel ? 'arch' : seed % 3 === 0 ? 'round' : 'lattice')
  const bowls = useMemo(() => {
    const out = []
    const n = Math.max(3, Math.floor((w - 2) / 0.55))
    for (let i = 0; i < n; i++) {
      const x = -((n - 1) * 0.55) / 2 + i * 0.55
      out.push({ p: [x, base + 1.08, front - 1.25 + (i % 2) * 0.18], s: [0.17 + seeded(seed * 13 + i) * 0.06, 0.08, 0.17] })
    }
    return out
  }, [w, front, seed])
  const lanterns = Math.max(2, Math.floor(w / 1.7))
  const g1 = base + fh // 1층 천장
  return (
    <group>
      <Box p={[0, base / 2, 0]} s={[w, base, d]} m={STONE} />
      {/* 1층: 옆·뒤 벽 + 천장, 앞면은 트임 (안쪽 깊이 d-1) */}
      <Box p={[0, base + fh / 2, -0.5]} s={[w, fh, d - 1]} m={DARK} />
      <mesh position={[0, base + fh * 0.5, front - 1.02]}>
        <planeGeometry args={[w - 0.5, fh - 0.4]} />
        <primitive object={INNER_GLOW} attach="material" />
      </mesh>
      {[-1, 1].map((s) => (
        <Box key={s} p={[s * (w / 2 - 0.15), base + fh / 2, front - 0.5]} s={[0.3, fh, 1]} c={wall} />
      ))}
      {/* 카운터 + 그릇 */}
      <Box p={[0, base + 0.5, front - 1.3]} s={[w - 1.2, 1.0, 0.6]} c="#4a2f1f" />
      <Box p={[0, base + 1.02, front - 1.3]} s={[w - 1.1, 0.05, 0.75]} c="#2b1d14" />
      <Instances geometry={GEO.cyl} material={BOWL} items={bowls} />
      {pastel && (
        <group>
          {range(Math.floor(w / 2.4) + 1).map((i, _, arr) => (
            <Cyl key={i} p={[-w / 2 + 0.3 + (i * (w - 0.6)) / (arr.length - 1), base + fh / 2, front - 0.1]} rad={0.2} h={fh} c={wall} />
          ))}
          <Box p={[0, g1 - 0.35, front - 0.1]} s={[w, 0.7, 0.4]} c={wall} />
        </group>
      )}
      {/* 노렌 */}
      {item.noren && (
        <mesh position={[0, g1 - 0.55, front - 0.3]}>
          <planeGeometry args={[Math.min(w - 1.2, 3.6), 0.9]} />
          <GlowMaterial glow={0.3} map={getJpSignTexture(item.noren, ['#1e3a5f', '#7a1d12', '#f2ead8', '#2f4a2a'][seed % 4], seed % 4 === 2 ? '#2a1a10' : '#f5f0e6', Math.min(w - 1.2, 3.6) / 0.9)} side={THREE.DoubleSide} />
        </mesh>
      )}
      {/* 1층 처마 + 붉은 등 줄 */}
      <mesh geometry={eave} position={[0, g1, front]}>
        <meshStandardMaterial color={roofC} flatShading side={THREE.DoubleSide} />
      </mesh>
      {range(lanterns).map((i) => (
        <Chochin key={i} p={[-w / 2 + 0.6 + (i * (w - 1.2)) / Math.max(1, lanterns - 1), g1 - 0.25, front + 0.9]} white={(i + seed) % 4 === 3} />
      ))}
      {/* 위층 몸통 + 창 띠 + 발코니 */}
      <Box p={[0, g1 + (fh * (floors - 1)) / 2, -0.1]} s={[w - 0.1, fh * (floors - 1), d - 0.2]} c={wall} />
      {range(floors - 1).map((k) => {
        const y = g1 + fh * k + fh * 0.5
        return (
          <group key={k}>
            <mesh position={[0, y, front - 0.19]}>
              <planeGeometry args={[w - 1, fh * 0.48]} />
              <primitive object={texMat(winTex, { emissive: '#ffffff', emissiveIntensity: 0.55 })} attach="material" />
            </mesh>
            <Box p={[0, g1 + fh * k + 0.08, front - 0.1]} s={[w, 0.16, 0.25]} c="#2b1d14" />
            {(seed + k) % 2 === 0 && (
              <group position={[0, g1 + fh * k, front + 0.3]}>
                <Box p={[0, 0.05, -0.2]} s={[w - 1.6, 0.1, 0.8]} c="#4a2f1f" />
                <Box p={[0, 0.95, 0.15]} s={[w - 1.6, 0.08, 0.08]} c="#c0392b" />
                {range(Math.round((w - 1) / 0.7)).map((i, _, arr) => (
                  <Box key={i} p={[-(w - 1.6) / 2 + (i * (w - 1.6)) / Math.max(1, arr.length - 1), 0.5, 0.15]} s={[0.07, 0.9, 0.07]} c="#c0392b" />
                ))}
              </group>
            )}
          </group>
        )
      })}
      {/* 가로 큰 간판 (1층 처마 위) */}
      {item.sign && (
        <group position={[0, g1 + 1.3, front + 0.4]}>
          <Box p={[0, 0, -0.06]} s={[Math.min(w - 0.6, 5.6) + 0.2, 1.2, 0.1]} m={DARK} />
          <mesh>
            <planeGeometry args={[Math.min(w - 0.6, 5.6), 1.0]} />
            <GlowMaterial glow={0.6} map={getJpSignTexture(item.sign.text, item.sign.bg ?? '#f4ead2', item.sign.fg ?? '#2a1a10', Math.min(w - 0.6, 5.6))} />
          </mesh>
        </group>
      )}
      {item.vsign && <VerticalSign text={item.vsign} p={[(seed % 2 ? 1 : -1) * (w / 2 + 0.3), g1 + fh * 0.7, front + 0.9]} h={Math.min(3.4, fh * (floors - 1) + 0.6)} bg={seed % 3 === 1 ? '#7a1d12' : '#f4ead2'} fg={seed % 3 === 1 ? '#fdf6e3' : '#2a1a10'} />}
      {/* 지붕: 기와 / 서양식 앞면(구리 초록 판 + 위 장식) */}
      {pastel ? (
        <group>
          <mesh geometry={roof} position={[0, h - roofH, -0.3]}>
            <meshStandardMaterial color={roofC} flatShading side={THREE.DoubleSide} />
          </mesh>
          <Box p={[0, h - roofH + 0.9, front - 0.1]} s={[w + 0.1, 1.8, 0.3]} c={wall} />
          <mesh position={[0, h - roofH + 1.8, front - 0.1]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[w * 0.28, w * 0.28, 0.3, 20, 1, false, -Math.PI / 2, Math.PI]} />
            <meshStandardMaterial color={wall} />
          </mesh>
          <mesh position={[0, h - roofH + 1.75, front + 0.06]}>
            <circleGeometry args={[0.45, 20]} />
            <meshStandardMaterial color="#ffe2a8" emissive="#ffb45c" emissiveIntensity={0.7} />
          </mesh>
          {[-1, 1].map((sx) => (
            <Box key={sx} p={[sx * w * 0.3, h - roofH + 1.2, front + 0.08]} s={[0.5, 0.5, 0.06]} r={[0, 0, Math.PI / 4]} c="#f0e6c8" />
          ))}
        </group>
      ) : look === 'retro' ? (
        <group>
          <Box p={[0, h - roofH / 2, -0.1]} s={[w, roofH, d - 0.2]} c="#3a3430" />
          <Box p={[0, h - 0.2, front + 0.02]} s={[w + 0.2, 2.6, 0.3]} c={COPPER} />
          <Box p={[0, h + 1.15, front + 0.02]} s={[w * 0.4, 0.5, 0.3]} c={COPPER} />
          <Box p={[0, h + 0.85, front + 0.2]} s={[w + 0.3, 0.12, 0.12]} m={BRASS} />
          <Ball p={[0, h + 1.5, front + 0.02]} rad={0.25} m={BRASS} />
        </group>
      ) : (
        <mesh geometry={roof} position={[0, h - roofH, 0]}>
          <meshStandardMaterial color={roofC} flatShading side={THREE.DoubleSide} />
        </mesh>
      )}
      {/* (11/25 거리 장면 참고) 분홍빛 벽 등 (까치발) + 파스텔 집은 2층 색유리 아치 창·꼬마전구 줄 */}
      {[-1, 1].map((s) => (
        <group key={`wl${s}`} position={[s * (w / 2 - 1.1), g1 + 0.9, front + 0.1]}>
          <Box p={[0, 0, 0.25]} s={[0.05, 0.05, 0.5]} m={IRON} />
          <Box p={[0, -0.25, 0.5]} s={[0.26, 0.42, 0.26]} m={WALL_LAMP} />
          <Box p={[0, -0.02, 0.5]} s={[0.32, 0.05, 0.32]} m={IRON} />
        </group>
      ))}
      {pastel && floors > 1 && (
        <group position={[0, g1 + fh * 0.5, front - 0.15]}>
          <mesh>
            <planeGeometry args={[1.6, 2.0]} />
            <meshStandardMaterial map={stainedTexture()} emissiveMap={stainedTexture()} emissive="#ffffff" emissiveIntensity={0.8} />
          </mesh>
          <Box p={[0, 0, -0.03]} s={[1.8, 2.2, 0.06]} c="#3a2416" />
        </group>
      )}
      {pastel && range(Math.round(w / 0.6)).map((i) => (
        <Ball key={`sl${i}`} p={[-w / 2 + 0.3 + i * 0.6, h - roofH + 0.05 - Math.sin((i / Math.round(w / 0.6)) * Math.PI) * 0.25, front + 0.25]} rad={0.07} m={LANTERN_RED} />
      ))}
      {/* 문 옆 큰 등 한 쌍 */}
      {[-1, 1].map((s) => (
        <group key={s} position={[s * (w / 2 - 0.45), base, front + 0.25]}>
          <Cyl p={[0, 0.9, 0]} rad={0.04} h={1.8} m={DARK} />
          <Chochin p={[0, 1.55, 0.15]} r={0.34} h={0.85} white={seed % 2 === 1} />
        </group>
      ))}
    </group>
  )
}

// ── 거리를 가로지르는 등 줄 ───────────────────
// item.size [len, h]: 로컬 x 방향으로 len, 높이 h에 늘어진 줄 + 1.4m마다 등
export function JmLanternLine({ item }) {
  const [len, h] = item.size
  const n = Math.max(2, Math.round(len / 1.4))
  const parts = useMemo(() => {
    const pts = []
    for (let i = 0; i <= n; i++) {
      const t = i / n
      pts.push([-len / 2 + len * t, h - Math.sin(Math.PI * t) * 0.6])
    }
    return pts
  }, [len, h, n])
  return (
    <group>
      {parts.slice(0, -1).map(([x, y], i) => {
        const [x2, y2] = parts[i + 1]
        const L = Math.hypot(x2 - x, y2 - y)
        return <Box key={i} p={[(x + x2) / 2, (y + y2) / 2, 0]} s={[L, 0.03, 0.03]} r={[0, 0, Math.atan2(y2 - y, x2 - x)]} m={DARK} />
      })}
      {parts.slice(1, -1).map(([x, y], i) => (
        <Chochin key={i} p={[x, y - 0.45, 0]} r={0.24} h={0.5} white={i % 3 === 1} />
      ))}
    </group>
  )
}

// ── 마을 입구 문 (돌계단 위) ───────────────────
// item.size [w, h, d], item.signs[0].text: 가운데 현판
export function JmTownGate({ item }) {
  const [w, h] = item.size
  const text = item.signs?.[0]?.text ?? '灯籠横丁'
  const roof = useMemo(() => hipRoofGeometry(w + 1.6, 2.4, 1.1, 0.2), [w])
  return (
    <group>
      {[-1, 1].map((s) => (
        <group key={s} position={[s * (w / 2 - 0.4), 0, 0]}>
          <Box p={[0, 0.3, 0]} s={[1.1, 0.6, 1.1]} m={STONE} />
          <Cyl p={[0, h / 2, 0]} rad={0.34} h={h} c="#b8352a" />
          <Chochin p={[0, 2.4, 0.6]} r={0.38} h={0.95} />
        </group>
      ))}
      <Box p={[0, h - 1.2, 0]} s={[w, 0.4, 0.5]} c="#b8352a" />
      <Box p={[0, h - 0.2, 0]} s={[w + 0.8, 0.5, 0.7]} c="#2a1a12" />
      <mesh geometry={roof} position={[0, h, 0]}>
        <meshStandardMaterial color="#2e3236" flatShading side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, h - 2.2, 0.27]}>
        <planeGeometry args={[3.4, 1.2]} />
        <GlowMaterial glow={0.6} map={getJpSignTexture(text, '#2a1a12', '#f2c94c', 3.4 / 1.2)} side={THREE.DoubleSide} />
      </mesh>
      {range(4).map((i) => (
        <Chochin key={i} p={[-w / 2 + 1.6 + (i * (w - 3.2)) / 3, h - 1.75, 0.35]} r={0.3} h={0.6} white={i % 2 === 1} />
      ))}
    </group>
  )
}

// ── 바다 위 철길 (다리 밑 골짜기: 밤이면 물이 차오른 바다 위를 달리는 전차 길) ──
// item.size [폭, _, 길이] (로컬 z 방향 길이), item.train: 세워 둔 전차 한 량 위치(로컬 z) 또는 없음
export function JmSeaRail({ item }) {
  const [, , len] = item.size
  const sleepers = useMemo(() => {
    const out = []
    const n = Math.round(len / 0.9)
    for (let i = 0; i < n; i++) out.push({ p: [0, 0.18, -len / 2 + (i + 0.5) * (len / n)], s: [2.3, 0.1, 0.24] })
    return out
  }, [len])
  const poles = useMemo(() => range(Math.floor(len / 14) + 1).map((i) => -len / 2 + i * 14), [len])
  return (
    <group position={[0, item.submerged ? -0.32 : 0, 0]}>
      <Box p={[0, 0.06, 0]} s={[3.0, 0.12, len]} c="#6f6a62" />
      <Instances geometry={GEO.box} material={mat('#3b2e24')} items={sleepers} />
      {[-0.72, 0.72].map((x) => (
        <Box key={x} p={[x, 0.27, 0]} s={[0.08, 0.08, len]} m={IRON} />
      ))}
      {poles.map((z) => (
        <group key={z} position={[1.9, 0, z]}>
          <Cyl p={[0, 3, 0]} rad={0.09} h={6} c="#4a3a2c" />
          <Box p={[-0.8, 5.6, 0]} s={[1.8, 0.1, 0.1]} c="#4a3a2c" />
        </group>
      ))}
      <Box p={[1.1, 5.45, 0]} s={[0.02, 0.02, len]} m={IRON} />
      {item.train !== undefined && (
        <group position={[0, 0.3, item.train]}>
          <Box p={[0, 1.7, 0]} s={[2.5, 2.6, 11]} c="#7a2a24" />
          <Box p={[0, 0.5, 0]} s={[2.3, 0.5, 10.4]} m={IRON} />
          <Box p={[0, 3.1, 0]} s={[2.6, 0.25, 11.2]} c="#2e2a26" />
          <Box p={[0, 1.15, 0]} s={[2.54, 0.6, 11.04]} c="#e8dcc0" />
          {[-1, 1].map((s) => (
            <mesh key={s} position={[s * 1.26, 2.15, 0]} rotation={[0, (s * Math.PI) / 2, 0]}>
              <planeGeometry args={[10, 0.9]} />
              <primitive object={texMat(windowStripTexture('lattice'), { emissive: '#ffffff', emissiveIntensity: 0.7 })} attach="material" />
            </mesh>
          ))}
          {[-1, 1].map((s) => (
            <Ball key={`l${s}`} p={[0, 2.6, s * 5.52]} rad={0.18} m={LANTERN_WHITE} />
          ))}
          <Box p={[0, 3.6, 2]} s={[0.1, 0.8, 0.1]} m={IRON} />
          <Box p={[0, 4.0, 2]} s={[1.2, 0.06, 0.1]} m={IRON} />
        </group>
      )}
    </group>
  )
}

// ── 보일러실 (온천장 맨 아래, 바깥 계단으로 내려감) ──
// item.size [w, h, d], 앞(+z) = 물가 쪽. item.boiler = { door: {x, w, h}, furnace: [x, z], drawers: [x, z, w], deck: [x, z, w, d], chimney: [x, z, h] }
// 모티브: 영화 속 보일러실 (큰 화덕, 천장까지 닿는 약초 서랍장과 사다리, 석탄 더미, 천장 관). 캐릭터는 넣지 않음
const HERBS = ['薬草', '甘草', '桂皮', '生姜', '陳皮', '薄荷', '菖蒲', '柚子', '蓬', '笹', '松葉', '桜皮']
function drawerTexture() {
  return canvasTexture('jmspirit:drawers', 1024, 640, (ctx, w, h) => {
    ctx.fillStyle = '#3a2416'
    ctx.fillRect(0, 0, w, h)
    const cols = 16
    const rows = 10
    const cw = w / cols
    const rh = h / rows
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = c * cw
        const y = r * rh
        ctx.fillStyle = (r + c) % 2 ? '#7a5232' : '#6b462a'
        ctx.fillRect(x + 3, y + 3, cw - 6, rh - 6)
        ctx.fillStyle = '#e9d8b0'
        ctx.fillRect(x + cw * 0.2, y + rh * 0.15, cw * 0.6, rh * 0.38)
        ctx.fillStyle = '#2a1a10'
        ctx.font = `bold ${Math.round(rh * 0.24)}px ${JP_FONT}`
        ctx.fillText(HERBS[(r * 7 + c * 3) % HERBS.length], x + cw / 2, y + rh * 0.34)
        ctx.fillStyle = '#c9a24a'
        ctx.beginPath()
        ctx.arc(x + cw / 2, y + rh * 0.72, rh * 0.08, 0, Math.PI * 2)
        ctx.fill()
      }
    }
  })
}
function flagTexture() {
  return canvasTexture('jmspirit:flag', 192, 300, (ctx, w, h) => {
    ctx.fillStyle = '#f2ede2'
    ctx.fillRect(0, 0, w, h)
    ctx.strokeStyle = '#1a1210'
    ctx.lineWidth = 10
    ctx.beginPath()
    ctx.arc(w / 2, h * 0.45, w * 0.36, 0, Math.PI * 2)
    ctx.stroke()
    ctx.fillStyle = '#1a1210'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.font = `bold ${Math.round(w * 0.42)}px ${JP_FONT}`
    ctx.fillText('湯', w / 2, h * 0.46)
  })
}
export function JmBoilerRoom({ item }) {
  const [w, h, d] = item.size
  const B = item.boiler
  const front = d / 2
  const drawers = useMemo(() => drawerTexture(), [])
  const roof = useMemo(() => hipRoofGeometry(w + 1, d + 1, 1.4, 0.2), [w, d])
  const coal = useMemo(() => range(28).map((i) => ({ p: [B.furnace[0] + 3.2 + (seeded(i) - 0.5) * 2.4, 0.15 + seeded(i + 40) * 0.35, B.furnace[1] + 1.8 + (seeded(i + 80) - 0.5) * 1.6], s: [0.35, 0.3, 0.35] })), [B])
  const [dx, dz, dw] = B.drawers
  const [kx, kz, kw, kd] = B.deck
  return (
    <group>
      {/* 바닥 + 벽(앞면은 문만 비움) + 지붕 */}
      <Box p={[0, 0.05, 0]} s={[w, 0.1, d]} c="#4a4038" />
      <Box p={[0, h / 2, -front + 0.2]} s={[w, h, 0.4]} m={STONE} />
      {[-1, 1].map((s) => (
        <Box key={s} p={[s * (w / 2 - 0.2), h / 2, 0]} s={[0.4, h, d]} c="#b9443a" />
      ))}
      {(() => {
        const a = B.door.x - B.door.w / 2
        const b = B.door.x + B.door.w / 2
        return (
          <group>
            <Box p={[(-w / 2 + a) / 2, h / 2, front - 0.2]} s={[a + w / 2, h, 0.4]} c="#b9443a" />
            <Box p={[(b + w / 2) / 2, h / 2, front - 0.2]} s={[w / 2 - b, h, 0.4]} c="#b9443a" />
            <Box p={[B.door.x, (B.door.h + h) / 2, front - 0.2]} s={[B.door.w, h - B.door.h, 0.4]} c="#b9443a" />
            <mesh position={[B.door.x, B.door.h + 0.45, front + 0.02]}>
              <planeGeometry args={[1.4, 0.5]} />
              <GlowMaterial glow={0.5} map={getJpSignTexture('釜場', '#2a1a12', '#f3e6c8', 1.4 / 0.5)} side={THREE.DoubleSide} />
            </mesh>
          </group>
        )
      })()}
      <Box p={[0, h + 0.1, 0]} s={[w, 0.2, d]} c="#3a2a1c" />
      <mesh geometry={roof} position={[0, h + 0.2, 0]}>
        <meshStandardMaterial color="#3a3530" flatShading side={THREE.DoubleSide} />
      </mesh>
      {/* 큰 화덕: 벽돌 몸통 + 쇠 문 + 불 + 위로 올라가는 굵은 관 */}
      <group position={[B.furnace[0], 0, B.furnace[1]]}>
        <Box p={[0, 1.9, 0]} s={[5, 3.8, 2.6]} c="#6a3b2a" />
        <Box p={[0, 3.95, 0]} s={[5.3, 0.3, 2.9]} m={IRON} />
        <Box p={[0, 1.2, 1.31]} s={[2.2, 1.4, 0.06]} m={IRON} />
        <mesh position={[0, 1.15, 1.35]}>
          <planeGeometry args={[1.6, 0.9]} />
          <primitive object={FIRE} attach="material" />
        </mesh>
        {[-1.6, 0, 1.6].map((x) => (
          <Cyl key={x} p={[x, (4 + h) / 2, -0.4]} rad={0.32} h={h - 4} m={IRON} />
        ))}
        <pointLight position={[0, 1.4, 2.4]} intensity={6} distance={9} color="#ff7a2a" />
      </group>
      <Instances geometry={GEO.rock} material={mat('#1c1a18', { flat: true })} items={coal} />
      {/* 약초 서랍장 (천장까지) + 사다리 */}
      <group position={[dx, 0, dz]}>
        <Box p={[0, (h - 0.4) / 2, -0.3]} s={[dw + 0.3, h - 0.4, 0.6]} c="#2a1a10" />
        <mesh position={[0, (h - 0.4) / 2, 0.01]}>
          <planeGeometry args={[dw, h - 0.6]} />
          <primitive object={texMat(drawers, { emissive: '#ffffff', emissiveIntensity: 0.12 })} attach="material" />
        </mesh>
        {[-0.3, 0.3].map((x) => (
          <Box key={x} p={[dw / 2 - 1.4 + x, (h - 0.5) / 2, 0.55]} s={[0.07, h - 0.5, 0.07]} c="#8a6a48" r={[0.12, 0, 0]} />
        ))}
        {range(10).map((i) => (
          <Box key={i} p={[dw / 2 - 1.4, 0.4 + i * ((h - 1) / 10), 0.55 - i * 0.04]} s={[0.66, 0.05, 0.05]} c="#8a6a48" />
        ))}
      </group>
      {/* 서랍장 앞 나무 단 + 낮은 책상 */}
      <group position={[kx, 0, kz]}>
        <Box p={[0, 0.3, 0]} s={[kw, 0.6, kd]} c="#6b4a30" />
        <Box p={[0, 0.85, 0]} s={[1.6, 0.5, 0.8]} c="#3b2a1c" />
        <Box p={[-0.4, 1.12, 0]} s={[0.4, 0.06, 0.3]} c="#e9e1cf" />
      </group>
      <pointLight position={[dx, h - 1.6, dz + 2.5]} intensity={5} distance={14} color="#ffcf8a" />
      {/* 천장 관 + 매달린 등 */}
      {[-d / 4, d / 4].map((z) => (
        <Cyl key={z} p={[0, h - 0.5, z]} rad={0.18} h={w - 1} m={IRON} r={[0, 0, Math.PI / 2]} />
      ))}
      {[-w / 4, w / 4].map((x) => (
        <group key={x} position={[x, h - 1.2, 0]}>
          <Cyl p={[0, 0.5, 0]} rad={0.02} h={0.8} m={IRON} />
          <Ball p={[0, 0, 0]} rad={0.2} m={LANTERN_WHITE} />
        </group>
      ))}
      {/* 굴뚝 (온천장보다 높이) */}
      {B.chimney && (
        <group position={[B.chimney[0], 0, B.chimney[1]]}>
          <Cyl p={[0, B.chimney[2] / 2, 0]} rad={0.9} h={B.chimney[2]} c="#7d5a48" />
          {range(Math.floor(B.chimney[2] / 6)).map((i) => (
            <Cyl key={i} p={[0, 6 + i * 6, 0]} rad={0.95} h={0.25} c="#4a3a30" />
          ))}
          <Cyl p={[0, B.chimney[2] + 0.2, 0]} rad={1.05} h={0.4} c="#2e2a26" />
          {/* 깃발 (흰 천에 둥근 테 「湯」) — 우리 글자 */}
          <Box p={[1.6, B.chimney[2] - 2, 0]} s={[2.4, 0.12, 0.12]} m={IRON} />
          <mesh position={[2.3, B.chimney[2] - 3.6, 0]}>
            <planeGeometry args={[1.8, 2.8]} />
            <meshStandardMaterial map={flagTexture()} side={THREE.DoubleSide} />
          </mesh>
          {range(4).map((i) => (
            <mesh key={i} position={[0.3 * i, B.chimney[2] + 1 + i * 1.3, 0.2 * i]} scale={[0.9 + i * 0.5, 0.6 + i * 0.3, 0.9 + i * 0.5]}>
              <sphereGeometry args={[1, 10, 8]} />
              <meshStandardMaterial color="#d9d4ce" transparent opacity={0.35 - i * 0.06} />
            </mesh>
          ))}
        </group>
      )}
    </group>
  )
}

// ── 엘리베이터 (온천장 층 사이 + 보일러실) ─────
// item.size [w, h, d], 열린 쪽 = 로컬 +z. item.elevator = { me, stops: [{ key, label, pos: [월드 x, y, z], face(도) }] }
// 칸 안에서 E → 층 고르기(숫자·B 키) → 화면이 어두워지고 그 층 칸으로 순간 이동
// 이동은 병관님 워프(bk_warpStore.js goto)의 정확한 자리(exact) 요청을 씀. 워프 쪽이 아직 exact를 모르면(useWarps.exact 없음) 안내만 함
export const useJmElevator = (() => {
  let near = null
  const subs = new Set()
  return {
    get: () => near,
    set: (v) => {
      near = v
      subs.forEach((f) => f(v))
    },
    sub: (f) => {
      subs.add(f)
      return () => subs.delete(f)
    },
  }
})()

let fadeEl = null
function fade(on) {
  if (typeof document === 'undefined') return
  if (!fadeEl) {
    fadeEl = document.createElement('div')
    fadeEl.style.cssText = 'position:fixed;inset:0;background:#05060a;opacity:0;pointer-events:none;transition:opacity .35s ease;z-index:40'
    document.body.appendChild(fadeEl)
  }
  fadeEl.style.opacity = on ? '1' : '0'
}

function cageTexture() {
  return canvasTexture('jmspirit:cage', 256, 512, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h)
    ctx.strokeStyle = '#c9a24a'
    ctx.lineWidth = 6
    ctx.strokeRect(4, 4, w - 8, h - 8)
    ctx.lineWidth = 3
    for (let i = 1; i < 8; i++) {
      ctx.beginPath()
      ctx.moveTo(-h, i * 64)
      ctx.lineTo(w + h, i * 64 + w)
      ctx.moveTo(-h, i * 64 + w)
      ctx.lineTo(w + h, i * 64)
      ctx.stroke()
    }
  })
}

// (11/25 지민 요청) 키보드 메뉴 대신 영화처럼 레버로 움직임:
//   칸 안 레버 앞에서 E → 레버 잡기(캐릭터 멈춤) → W/S(↑/↓)로 레버를 밀고 당겨 층 고르기(레버가 눈금마다 기울고 위 다이얼 바늘도 따라감)
//   → E로 출발(화면 어두워짐 → 그 층 칸으로 순간 이동) / Esc로 놓기
// item.elevator.kind: 'staff'(구석, 보일러실·1~5층) | 'guest'(가운데 누각, 1~4층)
const LEVER_SPAN = (110 * Math.PI) / 180
export function JmElevator({ item }) {
  const [w, h, d] = item.size
  const E = item.elevator
  const scene = useThree((s) => s.scene)
  const anchor = useRef(null)
  const player = useRef(null)
  const next = useRef(0)
  const [near, setNear] = useState(false)
  const [grab, setGrab] = useState(false)
  const meIndex = Math.max(0, E.stops.findIndex((s) => s.key === E.me))
  const [sel, setSel] = useState(meIndex)
  const tmp = useMemo(() => ({ a: new THREE.Vector3(), b: new THREE.Vector3() }), [])
  const cage = useMemo(() => cageTexture(), [])
  const here = E.stops[meIndex]
  const n = E.stops.length
  const angleOf = (i) => -LEVER_SPAN / 2 + (n > 1 ? (i * LEVER_SPAN) / (n - 1) : 0)
  const lever = useRef(null)

  useFrame(({ clock }, dt) => {
    // 레버는 고른 눈금 각도로 부드럽게
    if (lever.current) lever.current.rotation.z += (-angleOf(grab ? sel : meIndex) - lever.current.rotation.z) * Math.min(1, dt * 10)
    const t = clock.elapsedTime
    if (t < next.current) return
    next.current = t + 0.15
    if (!player.current?.parent) player.current = scene.getObjectByName('player') ?? null
    if (!player.current || !anchor.current) return
    anchor.current.getWorldPosition(tmp.a)
    player.current.getWorldPosition(tmp.b)
    const inside = Math.abs(tmp.b.x - tmp.a.x) < w / 2 + 0.3 && Math.abs(tmp.b.z - tmp.a.z) < d / 2 + 0.3 && Math.abs(tmp.b.y - tmp.a.y) < 2.2
    if (inside !== near) {
      setNear(inside)
      if (!inside) setGrab(false)
    }
  })

  // 레버를 잡는 동안 캐릭터 멈춤 (공용 inputLocked). 놓으면 되돌림
  useEffect(() => {
    if (!grab) return undefined
    useGameStore.setState({ inputLocked: true })
    return () => {
      if (!useGameStore.getState().openPanel) useGameStore.setState({ inputLocked: false })
    }
  }, [grab])

  useEffect(() => {
    if (!near) return undefined
    const go = (stop) => {
      setGrab(false)
      if (!useWarps.getState().exact) {
        useUiStore.getState().toast('엘리베이터는 아직 운행 준비 중이에요. 옆 계단을 이용해 주세요.', 'info')
        return
      }
      fade(true)
      setTimeout(() => {
        useWarps.getState().goto({
          exact: stop.pos,
          label: stop.label,
          onArrive: () => setTimeout(() => fade(false), 350),
          onFail: () => fade(false),
        })
        setTimeout(() => fade(false), 2500)
      }, 600)
    }
    const down = (event) => {
      if (event.repeat) return
      const game = useGameStore.getState()
      if (game.openPanel) return
      if (event.code === 'KeyE') {
        if (!grab) {
          setSel(meIndex)
          setGrab(true)
        } else if (sel !== meIndex) go(E.stops[sel])
        else setGrab(false)
        return
      }
      if (!grab) return
      if (event.code === 'Escape') setGrab(false)
      else if (event.code === 'KeyW' || event.code === 'ArrowUp') setSel((v) => Math.min(n - 1, v + 1))
      else if (event.code === 'KeyS' || event.code === 'ArrowDown') setSel((v) => Math.max(0, v - 1))
    }
    window.addEventListener('keydown', down)
    return () => window.removeEventListener('keydown', down)
  }, [near, grab, sel, meIndex, n, E])

  const size = useThree((s) => s.size)
  const target = E.stops[grab ? sel : meIndex]
  const kbd = (k) => <kbd style={{ padding: '0 5px', borderRadius: 4, background: '#e8c35a', color: '#111', fontSize: 11, fontWeight: 700 }}>{k}</kbd>
  return (
    <group>
      <group ref={anchor} position={[0, 0.2, 0]} />
      {/* 바닥판 + 천장 + 세 면 놋쇠 격자 + 열린 쪽 접힌 문 */}
      <Box p={[0, 0.05, 0]} s={[w, 0.1, d]} c="#3b2a1c" />
      <Box p={[0, h - 0.1, 0]} s={[w, 0.2, d]} m={IRON} />
      {[
        [0, -d / 2, w, 0],
        [-w / 2, 0, d, Math.PI / 2],
        [w / 2, 0, d, -Math.PI / 2],
      ].map(([x, z, len, r], i) => (
        <group key={i} position={[x, 0, z]} rotation={[0, r, 0]}>
          <Box p={[0, h / 2, -0.05]} s={[len, h, 0.04]} c="#4a3426" />
          <mesh position={[0, h / 2, 0.01]}>
            <planeGeometry args={[len, h - 0.2]} />
            <meshStandardMaterial map={cage} transparent alphaTest={0.4} side={THREE.DoubleSide} metalness={0.5} roughness={0.4} />
          </mesh>
        </group>
      ))}
      {[-1, 1].map((s) => (
        <group key={s}>
          <Box p={[s * (w / 2 - 0.05), h / 2, d / 2]} s={[0.12, h, 0.12]} m={BRASS} />
          {range(5).map((i) => (
            <Box key={i} p={[s * (w / 2 - 0.18 - i * 0.05), h / 2 - 0.1, d / 2 - 0.02]} s={[0.03, h - 0.4, 0.03]} m={BRASS} />
          ))}
        </group>
      ))}
      <Box p={[0, h + 0.05, d / 2]} s={[w + 0.2, 0.15, 0.15]} m={BRASS} />
      {/* 위 층 표시 반원 다이얼 (바늘 = 고른 층) */}
      <group position={[0, h + 0.55, d / 2 + 0.05]}>
        <mesh>
          <circleGeometry args={[0.45, 24, 0, Math.PI]} />
          <meshStandardMaterial color="#e8d9a8" emissive="#ffcf7a" emissiveIntensity={0.4} side={THREE.DoubleSide} />
        </mesh>
        <group rotation={[0, 0, -angleOf(grab ? sel : meIndex)]}>
          <Box p={[0, 0.2, 0.02]} s={[0.03, 0.4, 0.02]} m={IRON} />
        </group>
      </group>
      {/* 레버: 오른쪽 안 벽, 반원 눈금판 + 놋쇠 손잡이 막대 (눈금 = 정류장) */}
      <group position={[w / 2 - 0.12, 1.15, 0.2]} rotation={[0, -Math.PI / 2, 0]}>
        <mesh position={[0, 0, -0.01]}>
          <circleGeometry args={[0.42, 24, 0, Math.PI]} />
          <meshStandardMaterial color="#3a2a1c" side={THREE.DoubleSide} />
        </mesh>
        {E.stops.map((s, i) => {
          const a = Math.PI / 2 - angleOf(i)
          return <Ball key={s.key} p={[Math.cos(a) * 0.36, Math.sin(a) * 0.36, 0]} rad={0.035} m={i === (grab ? sel : meIndex) ? LANTERN_RED : BRASS} />
        })}
        <Cyl p={[0, 0, 0.03]} rad={0.07} h={0.08} m={BRASS} r={[Math.PI / 2, 0, 0]} />
        <group ref={lever}>
          <Box p={[0, 0.25, 0.06]} s={[0.05, 0.5, 0.05]} m={BRASS} />
          <Ball p={[0, 0.52, 0.06]} rad={0.07} c="#1a1210" />
        </group>
      </group>
      {here && (
        <mesh position={[0, h + 1.2, d / 2 + 0.06]}>
          <planeGeometry args={[1.4, 0.45]} />
          <GlowMaterial glow={0.5} map={getJpSignTexture(here.sign ?? '昇降機', '#2a1a12', '#e8c35a', 1.4 / 0.45)} side={THREE.DoubleSide} />
        </mesh>
      )}
      {near && (
        <Html calculatePosition={() => [0, 0]} zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
          <div style={{ position: 'absolute', left: 0, top: 0, width: size.width, height: size.height, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', paddingBottom: 72, boxSizing: 'border-box' }}>
            <div style={{ padding: '8px 14px', borderRadius: 12, background: 'rgba(20,12,8,0.78)', color: '#fff', fontSize: 13, lineHeight: 1.7, textAlign: 'center' }}>
              <div style={{ fontWeight: 700 }}>{E.kind === 'guest' ? '손님용 엘리베이터' : '직원용 엘리베이터'} — 지금 {here?.label}</div>
              {grab ? (
                <>
                  <div>레버: <b>{target?.label}</b>{sel === meIndex ? ' (지금 층)' : ''}</div>
                  <div>{kbd('W')}/{kbd('S')} 레버 밀기·당기기 · {kbd('E')} {sel === meIndex ? '놓기' : '출발'} · {kbd('Esc')} 놓기</div>
                </>
              ) : (
                <div>{kbd('E')} 레버 잡기</div>
              )}
            </div>
          </div>
        </Html>
      )}
    </group>
  )
}

// ── 온천장 아래층 외벽 (지대 남쪽 벼랑에 붙임) ─────
// 지민이 보낸 사진처럼 온천장이 물가에서부터 솟은 붉은 건물로 보이게: 붉은 벽 2층 + 불 켜진 창 + 초록 처마 + 물가 돌 띠
// item.size [w, h, _], 앞(+z) = 골짜기 쪽. 걷는 판정 없음 (뒤는 지대 옹벽)
export function JmYuLowerFacade({ item }) {
  const [w, h] = item.size
  const winTex = windowStripTexture('lattice')
  const eave = useMemo(() => hipRoofGeometry(w + 0.8, 2.2, 0.55, 0.06), [w])
  const plants = useMemo(() => range(Math.round(w / 1.6)).map((i) => ({ p: [-w / 2 + 0.8 + i * 1.6, h + 0.35, 0.55], s: [0.5 + seeded(i) * 0.3, 0.45, 0.4] })), [w, h])
  return (
    <group>
      <Box p={[0, h / 2, 0]} s={[w, h, 0.6]} c="#8a7f6e" />
      <Box p={[0, 0.5, 0.05]} s={[w + 0.2, 1.0, 0.7]} c="#5f574b" />
      {range(Math.round(w / 3)).map((i) => (
        <Box key={`st${i}`} p={[-w / 2 + 1.5 + i * 3, h * (0.25 + (i % 3) * 0.2), 0.31]} s={[2.2 + (i % 2) * 0.6, 0.9, 0.04]} c={i % 2 ? '#7a705f' : '#968b78'} />
      ))}
      {[0.38, 0.78].map((t, i) => (
        <group key={t}>
          <mesh position={[0, h * t, 0.31]}>
            <planeGeometry args={[w - 1.5, h * 0.2]} />
            <primitive object={texMat(winTex, { emissive: '#ffffff', emissiveIntensity: 0.55 })} attach="material" />
          </mesh>
          {i === 0 && (
            <mesh geometry={eave} position={[0, h * 0.58, 0.6]}>
              <meshStandardMaterial color="#3f7a5c" flatShading side={THREE.DoubleSide} />
            </mesh>
          )}
        </group>
      ))}
      {range(Math.round(w / 6) + 1).map((i) => (
        <Box key={i} p={[-w / 2 + (i * w) / Math.round(w / 6), h / 2, 0.36]} s={[0.6, h, 0.2]} c="#6f6556" />
      ))}
      {/* (지민이 보낸 영상 참고) 벽에 붙은 나무 덧방 2채: 격자창 + 어두운 기와 + 받침 기둥 */}
      {[[-w / 2 + 5, 3.2, 6], [w / 2 - 6, 1.2, 5]].map(([x, y, aw], i) => (
        <group key={`an${i}`} position={[x, y, 0.3]}>
          <Box p={[0, 1.1, 0.7]} s={[aw, 2.2, 1.4]} c="#5a3d2a" />
          <mesh position={[0, 1.2, 1.41]}>
            <planeGeometry args={[aw - 0.6, 1.3]} />
            <primitive object={texMat(winTex, { emissive: '#ffffff', emissiveIntensity: 0.5 })} attach="material" />
          </mesh>
          <Box p={[0, 2.35, 0.8]} s={[aw + 0.5, 0.15, 1.9]} c="#2e3236" r={[0.18, 0, 0]} />
          {[-1, 1].map((s) => (
            <Box key={s} p={[s * (aw / 2 - 0.2), -y / 2, 1.2]} s={[0.18, y, 0.18]} c="#3b2a1c" />
          ))}
        </group>
      ))}
      {/* 지그재그 나무 계단 (벽 장식) + 물가로 내려가는 사다리 */}
      {range(8).map((i) => (
        <Box key={`zs${i}`} p={[-w / 2 + 9.5 + i * 0.45, 3.1 - i * 0.38, 0.75]} s={[0.5, 0.08, 0.8]} c="#7a5a3a" />
      ))}
      <Box p={[-w / 2 + 11.1, 1.75, 1.15]} s={[3.8, 0.06, 0.06]} c="#5a3d2a" r={[0, 0, -0.69]} />
      {[w / 2 - 12, w / 2 - 2.5].map((x) => (
        <group key={`ld${x}`} position={[x, 0, 0.45]}>
          {[-0.3, 0.3].map((dx) => (
            <Box key={dx} p={[dx, 1.6, 0]} s={[0.06, 3.2, 0.06]} c="#3b2a1c" />
          ))}
          {range(8).map((k) => (
            <Box key={k} p={[0, 0.3 + k * 0.38, 0]} s={[0.6, 0.05, 0.05]} c="#3b2a1c" />
          ))}
        </group>
      ))}
      {/* 벽을 타고 꺾이는 흰 관 */}
      {[[-w / 2 + 2.2, 0, 4.4], [-2, 2.4, 7], [w / 2 - 8.5, 0.8, 5]].map(([x, z0, len], i) => (
        <group key={`pp${i}`}>
          <Cyl p={[x, (z0 + h) / 2 + 0.3, 0.5]} rad={0.13} h={h - z0 + 0.6} c="#d6d1c6" />
          <Cyl p={[x + len / 2, z0 + 0.3, 0.5]} rad={0.13} h={len} c="#d6d1c6" r={[0, 0, Math.PI / 2]} />
          <Ball p={[x, z0 + 0.3, 0.5]} rad={0.17} c="#bdb7aa" />
          <Ball p={[x + len, z0 + 0.3, 0.5]} rad={0.17} c="#bdb7aa" />
          <Cyl p={[x + len, z0 / 2 + 0.15, 0.5]} rad={0.13} h={z0 + 0.3} c="#d6d1c6" />
        </group>
      ))}
      {/* 지대 끝 위 화분 줄 (사진의 층마다 초록 덤불) */}
      <Box p={[0, h + 0.1, 0.55]} s={[w, 0.2, 0.6]} c="#5a3d2a" />
      <Instances geometry={GEO.sphere} material={mat('#3f6b3a', { flat: true })} items={plants} />
    </group>
  )
}

// ── 꽃덤불 (온천장 옆 꽃밭: 수국·철쭉) ─────────
export function JmFlowerBush({ item }) {
  const [w, h, d] = item.size
  const seed = item.seed ?? 0
  const colors = [['#7aa7e8', '#9f8ee0', '#b9c8f2'], ['#e86a9a', '#f2a3c0', '#ffffff'], ['#d94f6a', '#f28aa0', '#ffd0dc']][seed % 3]
  const flowers = useMemo(() => colors.map((_, c) => range(10).map((i) => {
    const a = seeded(seed * 31 + i * 3 + c) * Math.PI * 2
    const r = 0.35 + seeded(seed + i * 7 + c * 11) * 0.5
    return { p: [Math.cos(a) * r * (w / 2), h * (0.55 + seeded(i + c * 5 + seed) * 0.4), Math.sin(a) * r * (d / 2)], s: [0.22, 0.22, 0.22] }
  })), [w, h, d, seed, colors])
  return (
    <group>
      <mesh geometry={GEO.sphere} position={[0, h * 0.45, 0]} scale={[w / 2, h * 0.5, d / 2]}>
        <meshStandardMaterial color="#3f6b3a" flatShading />
      </mesh>
      {!item.green && flowers.map((items, c) => (
        <Instances key={c} geometry={GEO.sphere} material={mat(colors[c])} items={items} />
      ))}
    </group>
  )
}

// ── 풀밭 언덕 (터널을 나오면 펼쳐지는 초록 언덕, 올라가지 않는 풍경) ──
export function JmGrassHill({ item }) {
  const [w, h, d] = item.size
  return (
    <mesh geometry={GEO.dome} scale={[w / 2, h, d / 2]}>
      <meshStandardMaterial color={item.color ?? '#6f9a4e'} flatShading roughness={1} />
    </mesh>
  )
}

// ── 바다 위 전차 한 량 (11/25 지민이 보낸 장면 참고) ─────────
// 아래 밤색 세로 나무판 + 위 크림색 창 줄, 붉은 지붕과 통풍구, 앞면은 둥근 얼굴에 큰 창 두 장 + 지붕 위 둥근 등 + 행선판
// 안: 나무 바닥, 북쪽 긴 붉은 의자, 손잡이 고리. 문은 남쪽 옆면 2곳(열려 있음). 캐릭터·승객은 넣지 않음
// item.size [w, h, len] (로컬 z = 길이 방향), item.floor 바닥 높이, item.head 1|-1 둥근 앞면 쪽, item.sign 행선판 글자
const TRAIN_RED = mat('#8a3326', { roughness: 0.8 })
const TRAIN_CREAM = mat('#e9c98a', { roughness: 0.75 })
const TRAIN_ROOF = mat('#7a2a20', { roughness: 0.7 })
const TRAIN_GLASS = mat('#bfe3ee', { transparent: true, opacity: 0.35, roughness: 0.1, double: true })
const SEAT_RED = mat('#9a2f2a', { roughness: 0.8 })
const FLOOR_WOOD = mat('#a07a50', { roughness: 0.85 })
function plankTexture() {
  return canvasTexture('jmspirit:trainplank', 256, 128, (ctx, w, h) => {
    ctx.fillStyle = '#8a3326'
    ctx.fillRect(0, 0, w, h)
    ctx.strokeStyle = 'rgba(40,10,5,0.45)'
    ctx.lineWidth = 3
    for (let x = 0; x < w; x += 12) {
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, h)
      ctx.stroke()
    }
  })
}
export function JmSeaTrain({ item }) {
  const [w, h, len] = item.size
  const fl = item.floor ?? 0.9
  const head = item.head ?? 1
  const planks = useMemo(() => plankTexture(), [])
  const lowerH = 1.3
  const bodyTop = fl + 2.6
  const doors = [-len / 2 + 2, len / 2 - 2]
  const windows = useMemo(() => {
    const out = []
    const xs = []
    for (let z = -len / 2 + 0.8; z <= len / 2 - 0.8; z += 1.05) if (doors.every((d) => Math.abs(z - d) > 0.9)) xs.push(z)
    for (const z of xs) for (const s of [-1, 1]) out.push({ z, s })
    return out
  }, [len])
  const straps = useMemo(() => range(Math.floor((len - 2) / 0.8)).map((i) => -len / 2 + 1 + i * 0.8), [len])
  return (
    <group>
      {/* 바퀴·차대 (물에 잠김) */}
      {[-len / 2 + 1.6, len / 2 - 1.6].map((z) => (
        <group key={z} position={[0, 0.35, z]}>
          <Box p={[0, 0, 0]} s={[w - 0.4, 0.5, 1.6]} m={IRON} />
          {[-1, 1].map((s) => [-0.5, 0.5].map((dz) => <Cyl key={`${s}${dz}`} p={[s * (w / 2 - 0.25), 0, dz]} rad={0.35} h={0.15} m={IRON} r={[0, 0, Math.PI / 2]} />))}
        </group>
      ))}
      {/* 바닥 */}
      <Box p={[0, fl / 2, 0]} s={[w, fl, len]} c="#3a2a20" />
      <Box p={[0, fl + 0.01, 0]} s={[w - 0.3, 0.02, len - 0.3]} m={FLOOR_WOOD} />
      {/* 옆면: 아래 나무판 + 위 크림 띠 + 창 (남쪽 옆면은 문 자리 비움) */}
      {[-1, 1].map((s) => (
        <group key={s}>
          {[[-len / 2, doors[0] - 0.6], [doors[0] + 0.6, doors[1] - 0.6], [doors[1] + 0.6, len / 2]].map(([a, b], i) => (
            <group key={i}>
              <mesh position={[s * (w / 2), fl + lowerH / 2, (a + b) / 2]} rotation={[0, (s * Math.PI) / 2, 0]}>
                <planeGeometry args={[b - a, lowerH]} />
                <meshStandardMaterial map={planks} side={THREE.DoubleSide} />
              </mesh>
              <Box p={[s * (w / 2), bodyTop - 0.2, (a + b) / 2]} s={[0.06, 0.4, b - a]} m={TRAIN_CREAM} />
            </group>
          ))}
          {s < 0 && <Box p={[-w / 2, fl + 1.6, 0]} s={[0.06, 2.0, 1.2]} m={TRAIN_CREAM} />}
          {/* 북쪽 옆면은 문 자리도 막힘(문짝) */}
          {s < 0 && doors.map((d) => <Box key={d} p={[-w / 2, fl + 1.3, d]} s={[0.08, 2.6, 1.2]} m={TRAIN_CREAM} />)}
        </group>
      ))}
      {windows.map(({ z, s }, i) => (
        <group key={i} position={[s * (w / 2), fl + lowerH + 0.55, z]}>
          <Box p={[0, 0, 0]} s={[0.07, 1.1, 0.95]} m={TRAIN_CREAM} />
          <mesh position={[s * 0.04, 0, 0]} rotation={[0, (s * Math.PI) / 2, 0]}>
            <planeGeometry args={[0.8, 0.85]} />
            <primitive object={TRAIN_GLASS} attach="material" />
          </mesh>
        </group>
      ))}
      {/* 지붕 + 통풍구 */}
      <mesh position={[0, bodyTop, 0]} scale={[w / 2 + 0.1, 0.35, len / 2 + 0.05]}>
        <sphereGeometry args={[1, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <primitive object={TRAIN_ROOF} attach="material" />
      </mesh>
      <Box p={[0, bodyTop + 0.02, 0]} s={[w + 0.15, 0.06, len + 0.1]} m={TRAIN_ROOF} />
      {[-len / 4, 0, len / 4].map((z) => (
        <Box key={z} p={[0, bodyTop + 0.38, z]} s={[0.9, 0.25, z === 0 ? 2.4 : 0.9]} m={TRAIN_ROOF} />
      ))}
      {/* 끝면: 둥근 앞면(head) / 다른 쪽은 연결 주름막 */}
      {[-1, 1].map((e) => (
        <group key={e} position={[0, 0, e * (len / 2)]}>
          {e === head ? (
            <group>
              <mesh position={[0, fl + lowerH / 2, e * 0.25]} scale={[w / 2, lowerH / 2, 0.5]}>
                <cylinderGeometry args={[1, 1, 2, 20, 1, false, e > 0 ? -Math.PI / 2 : Math.PI / 2, Math.PI]} />
                <primitive object={TRAIN_RED} attach="material" />
              </mesh>
              <mesh position={[0, fl + lowerH + 0.65, e * 0.25]} scale={[w / 2, 0.65, 0.5]}>
                <cylinderGeometry args={[1, 1, 2, 20, 1, false, e > 0 ? -Math.PI / 2 : Math.PI / 2, Math.PI]} />
                <primitive object={TRAIN_CREAM} attach="material" />
              </mesh>
              {[-0.55, 0.55].map((x) => (
                <mesh key={x} position={[x, fl + lowerH + 0.65, e * 0.72]} rotation={[0, e > 0 ? 0 : Math.PI, 0]}>
                  <planeGeometry args={[0.95, 1.0]} />
                  <primitive object={TRAIN_GLASS} attach="material" />
                </mesh>
              ))}
              <mesh position={[0, fl + 0.75, e * 0.76]} rotation={[0, e > 0 ? 0 : Math.PI, 0]}>
                <planeGeometry args={[0.55, 0.55]} />
                <GlowMaterial glow={0.5} map={getJpSignTexture(item.sign ?? '湯灯', '#f3e6c8', '#2a1a10', 1)} side={THREE.DoubleSide} />
              </mesh>
              {[-0.9, 0.9].map((x) => (
                <Ball key={x} p={[x, fl + 0.5, e * 0.7]} rad={0.09} m={LANTERN_RED} />
              ))}
              <Ball p={[0, bodyTop + 0.35, e * 0.35]} rad={0.2} m={LANTERN_WHITE} />
            </group>
          ) : (
            <group>
              <Box p={[0, fl + 1.3, 0]} s={[w, 2.6, 0.08]} m={TRAIN_CREAM} />
              <Box p={[0, fl + 1.2, e * 0.3]} s={[1.3, 2.2, 0.6]} c="#2a2420" />
            </group>
          )}
        </group>
      ))}
      {/* 안: 북쪽 긴 붉은 의자, 손잡이 고리, 천장 등 */}
      <group position={[-w / 2 + 0.55, fl, 0]}>
        <Box p={[0, 0.45, 0]} s={[0.6, 0.12, len - 5.4]} m={SEAT_RED} />
        <Box p={[-0.25, 0.85, 0]} s={[0.12, 0.7, len - 5.4]} m={SEAT_RED} />
        <Box p={[0, 0.2, 0]} s={[0.5, 0.4, len - 5.6]} c="#3a2a20" />
      </group>
      <Box p={[0, bodyTop - 0.25, 0]} s={[0.05, 0.05, len - 1]} m={BRASS} />
      {straps.map((z) => (
        <group key={z} position={[0, bodyTop - 0.25, z]}>
          <Box p={[0, -0.2, 0]} s={[0.02, 0.4, 0.02]} c="#e8dcc0" />
          <mesh position={[0, -0.48, 0]} rotation={[0, Math.PI / 2, 0]}>
            <torusGeometry args={[0.08, 0.015, 6, 12]} />
            <meshStandardMaterial color="#e8dcc0" />
          </mesh>
        </group>
      ))}
      {[-len / 4, len / 4].map((z) => (
        <Ball key={`lp${z}`} p={[0, bodyTop - 0.12, z]} rad={0.14} m={LANTERN_WHITE} />
      ))}
    </group>
  )
}

// ── 굵은 관 다리 (섬 아래 골짜기를 가로지르는 관 + 철 받침) ──
// item.size [폭, 높이, 길이] (로컬 z 방향 길이)
export function JmPipeBridge({ item }) {
  const [w, h, len] = item.size
  const n = Math.max(2, Math.round(len / 4))
  return (
    <group>
      {[-0.6, 0.6].map((x) => (
        <Cyl key={x} p={[x, h * 0.6, 0]} rad={0.55} h={len} c="#6f5a48" r={[Math.PI / 2, 0, 0]} />
      ))}
      <Box p={[0, h * 0.6 - 0.75, 0]} s={[w, 0.18, len]} m={IRON} />
      {range(n + 1).map((i) => {
        const z = -len / 2 + (i * len) / n
        return (
          <group key={i} position={[0, 0, z]}>
            <Box p={[0, h * 0.6 + 0.6, 0]} s={[w, 0.12, 0.12]} m={IRON} />
            {[-1, 1].map((s) => (
              <Box key={s} p={[s * (w / 2), h * 0.6, 0]} s={[0.12, 1.4, 0.12]} m={IRON} />
            ))}
          </group>
        )
      })}
      {[-1, 1].map((e) => (
        <Box key={e} p={[0, (h * 0.6) / 2, e * (len / 2 - 0.5)]} s={[w, h * 0.6, 0.8]} c="#7d7262" />
      ))}
    </group>
  )
}

// ── 꽃 핀 키 큰 덤불 울타리 (거리 쪽 정원: 주먹밥 장면 참고) ──
export function JmHedge({ item }) {
  const [len, h, d] = item.size
  const seed = item.seed ?? 0
  const bumps = useMemo(() => range(Math.max(3, Math.round(len / 1.1))).map((i) => ({ p: [-len / 2 + 0.55 + i * ((len - 1.1) / Math.max(1, Math.round(len / 1.1) - 1)), h * (0.55 + seeded(seed * 17 + i) * 0.2), (seeded(i + seed) - 0.5) * 0.3], s: [0.9, h * 0.55, d * 0.6] })), [len, h, d, seed])
  const flowers = useMemo(() => [['#e47fb4', 0], ['#a98be0', 1], ['#ffffff', 2]].map(([c, k]) => ({ c, items: range(Math.round(len * 1.6)).map((i) => ({ p: [-len / 2 + seeded(i * 3 + k + seed * 7) * len, 0.5 + seeded(i * 5 + k * 11 + seed) * (h - 0.4), (seeded(i * 7 + k) > 0.5 ? 1 : -1) * (d / 2 + 0.05)], s: [0.22, 0.22, 0.22] })) })), [len, h, d, seed])
  return (
    <group>
      <Box p={[0, h * 0.45, 0]} s={[len, h * 0.9, d * 0.85]} c="#5e9a44" />
      <Instances geometry={GEO.sphere} material={mat('#72ad52', { flat: true })} items={bumps} />
      {flowers.map(({ c, items }) => (
        <Instances key={c} geometry={GEO.sphere} material={mat(c, { emissive: c, emissiveIntensity: 0.35 })} items={items} />
      ))}
    </group>
  )
}

// ── 배추밭 ──
export function JmVeggiePatch({ item }) {
  const [w, , d] = item.size
  const heads = useMemo(() => {
    const out = []
    for (let r = 0; r < Math.floor(d / 1.0); r++) for (let c = 0; c < Math.floor(w / 0.9); c++) out.push({ p: [-w / 2 + 0.45 + c * 0.9, 0.3, -d / 2 + 0.5 + r * 1.0], s: [0.38, 0.3, 0.38] })
    return out
  }, [w, d])
  return (
    <group>
      <Box p={[0, 0.06, 0]} s={[w, 0.12, d]} c="#6b4a2e" />
      {range(Math.floor(d / 1.0)).map((r) => (
        <Box key={r} p={[0, 0.14, -d / 2 + 0.5 + r]} s={[w - 0.2, 0.08, 0.5]} c="#7a5634" />
      ))}
      <Instances geometry={GEO.sphere} material={mat('#9fd16a', { flat: true })} items={heads} />
    </group>
  )
}

// ── 빨간 지붕 창고 (정원 끝 작은 헛간) ──
export function JmShed({ item }) {
  const [w, h, d] = item.size
  const roof = useMemo(() => hipRoofGeometry(w + 0.6, d + 0.6, h * 0.35, 0.1), [w, d, h])
  return (
    <group>
      <Box p={[0, h * 0.33, 0]} s={[w, h * 0.66, d]} c="#8a6a48" />
      <Box p={[0, h * 0.25, d / 2 + 0.02]} s={[1.4, h * 0.5, 0.05]} c="#3b2a1c" />
      {[-1, 1].map((s) => (
        <Box key={s} p={[s * w * 0.3, h * 0.45, d / 2 + 0.02]} s={[0.7, 0.6, 0.05]} c="#e8dcc0" />
      ))}
      <mesh geometry={roof} position={[0, h * 0.66, 0]}>
        <meshStandardMaterial color="#b8352a" flatShading side={THREE.DoubleSide} />
      </mesh>
    </group>
  )
}

// ── 풀밭 돌집 (터널 뒤 풀밭에 드문드문, 회색 기와 낮은 집) ──
export function JmFieldHut({ item }) {
  const [w, h, d] = item.size
  const roof = useMemo(() => hipRoofGeometry(w + 0.8, d + 0.8, h * 0.4, 0.12), [w, d, h])
  return (
    <group>
      <Box p={[0, h * 0.3, 0]} s={[w, h * 0.6, d]} c="#a59b8a" />
      <Box p={[0, h * 0.22, d / 2 + 0.02]} s={[1.0, h * 0.44, 0.05]} c="#2a2420" />
      <mesh geometry={roof} position={[0, h * 0.6, 0]}>
        <meshStandardMaterial color="#5e615f" flatShading side={THREE.DoubleSide} />
      </mesh>
    </group>
  )
}

// ── 높은 곳 바닥 그림 (길·풀밭·흙길): item.floor = TILE_METERS 무늬 이름 또는 없음(item.color 단색) ──
export function JmFloor({ item }) {
  const [w, h, d] = item.size
  const tile = TILE_METERS[item.floor]
  const map = useMemo(() => (tile ? getTiledTexture(item.floor, w / tile, d / tile) : null), [item.floor, tile, w, d])
  return (
    <mesh position={[0, 0.03 + Math.min(h, 0.06) / 2, 0]} receiveShadow>
      <boxGeometry args={[w, Math.min(h, 0.06), d]} />
      <meshStandardMaterial map={map} color={map ? '#ffffff' : item.color ?? '#a8946e'} polygonOffset polygonOffsetFactor={-2} />
    </mesh>
  )
}

// ── 보이지 않는 벽(jmCollider): 높고 넓은 벽은 카메라 막이(camera-blocker)로도 등록 ──
// 공용 FollowCamera는 이름이 camera-blocker인 물체만 피함. 애니 구역은 건물(buildings)이 없어 카메라가 벽을 뚫던 문제 (11/25)
export function JmCollider({ item }) {
  const [w, h, d] = item.size
  const block = item.camera ?? (h >= 1.8 && Math.max(w, d) >= 1.5 && !/_rail|_pier|_pillar|_post/.test(item.id))
  if (!block) return null
  return <mesh name="camera-blocker" visible={false} geometry={GEO.box} position={[0, h / 2, 0]} scale={[w, h, d]} />
}

export const JM_SPIRIT_STYLES = {
  jmCollider: JmCollider,
  jmFloor: JmFloor,
  jmEatery: JmEatery,
  jmLanternLine: JmLanternLine,
  jmTownGate: JmTownGate,
  jmSeaRail: JmSeaRail,
  jmBoilerRoom: JmBoilerRoom,
  jmElevator: JmElevator,
  jmFlowerBush: JmFlowerBush,
  jmGrassHill: JmGrassHill,
  jmYuLowerFacade: JmYuLowerFacade,
  jmSeaTrain: JmSeaTrain,
  jmPipeBridge: JmPipeBridge,
  jmHedge: JmHedge,
  jmVeggiePatch: JmVeggiePatch,
  jmShed: JmShed,
  jmFieldHut: JmFieldHut,
}
