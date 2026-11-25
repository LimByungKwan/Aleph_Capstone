import { useMemo } from 'react'
import * as THREE from 'three'
import { hipRoofGeometry } from './geometry.js'
import { Box, Cyl, mat } from './kit.jsx'
import { canvasTexture, fitText, getJpSignTexture, GlowMaterial, JP_FONT, JP_SIGN_KO } from './jm_landmarks.jsx'
import { Karahafu } from './jm_yutoya.jsx'

// 애니 구역 서쪽 「운하 거리」(11/25) — 담당: 지민
// 참고: 지민이 보낸 온천 마을 사진들 (좁은 물길 양쪽으로 3~4층 목조 여관, 층마다 처마·나무 발코니,
//   흰 회벽 + 짙은 나무, 세로로 긴 불 켜진 간판, 지붕 위 작은 망루, 둥근 박공 현관, 쌍둥이 가스등, 물길 위 작은 다리)
// 건물·간판 글자는 모두 우리 것 (실제 여관 이름은 쓰지 않음)
// 앞면 = 로컬 +z (물길 쪽). 걷는 판정은 생성 스크립트가 건물 상자(size)로

const range = (n) => Array.from({ length: n }, (_, i) => i)

const STONE = mat('#8e877c', { roughness: 1 })
const WOOD_DARK = mat('#3b2a1f', { roughness: 0.9 })
const WOOD = mat('#5e4130', { roughness: 0.85 })
const WOOD_LIGHT = mat('#7a5a40', { roughness: 0.85 })
const PLASTER = mat('#ece3d0', { roughness: 0.95 })
const ROOF = mat('#2e3236', { flat: true, roughness: 0.8, double: true })
const SHOJI = mat('#ffe2ad', { emissive: '#ffb058', emissiveIntensity: 0.85, roughness: 0.6 })
const GLASS_WARM = mat('#ffd38a', { emissive: '#ffa640', emissiveIntensity: 1.1, roughness: 0.4 })
const LAMP_GLASS = mat('#fff3d6', { emissive: '#ffd27a', emissiveIntensity: 1.6, roughness: 0.3 })
const IRON = mat('#1f1d1b', { roughness: 0.6 })
const LANTERN_RED = mat('#d0402a', { emissive: '#ff5a2e', emissiveIntensity: 1.0 })

// 세로 간판 그림 (위에서 아래로 한 글자씩). 한국어 뜻이 있으면 맨 아래 작게
function verticalSignTexture(text, bg, fg, aspect) {
  const height = 512
  const width = Math.max(96, Math.round(height * aspect))
  const ko = JP_SIGN_KO[text]
  return canvasTexture(`jmvsign:${text}:${bg}:${fg}:${width}`, width, height, (ctx, w, h) => {
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, w, h)
    ctx.strokeStyle = 'rgba(0,0,0,0.3)'
    ctx.lineWidth = 6
    ctx.strokeRect(5, 5, w - 10, h - 10)
    ctx.fillStyle = fg
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    const chars = [...text]
    const area = ko ? h * 0.8 : h * 0.92
    const step = area / chars.length
    const size = Math.min(w * 0.72, step * 0.86)
    ctx.font = `bold ${size}px ${JP_FONT}`
    chars.forEach((ch, i) => ctx.fillText(ch, w / 2, h * 0.04 + step * (i + 0.5)))
    if (ko) {
      ctx.globalAlpha = 0.85
      fitText(ctx, ko, w * 0.86, 40, 'bold', JP_FONT, h * 0.06)
      ctx.fillText(ko, w / 2, h * 0.92)
      ctx.globalAlpha = 1
    }
  })
}

// 세로 간판: 판이 앞면과 직각으로 튀어나와 길을 따라 걸으면 읽힘 (양면)
export function VerticalSign({ text, p, h = 3.2, w = 0.62, bg = '#f4ead2', fg = '#2a1a10', glow = 0.75 }) {
  const map = verticalSignTexture(text, bg, fg, w / h)
  return (
    <group position={p}>
      <Box p={[0, h / 2 + 0.12, 0]} s={[0.1, 0.1, w + 0.5]} m={WOOD_DARK} />
      <Box p={[0, 0, 0]} s={[0.12, h + 0.12, w + 0.12]} m={WOOD_DARK} />
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 0.065, 0, 0]} rotation={[0, (s * Math.PI) / 2, 0]}>
          <planeGeometry args={[w, h]} />
          <GlowMaterial glow={glow} map={map} />
        </mesh>
      ))}
    </group>
  )
}

// 처마 띠: 앞으로 튀어나온 얇은 기와 지붕 한 줄
function Eave({ w, y, z, depth = 1.1, h = 0.45 }) {
  const geo = useMemo(() => hipRoofGeometry(w, depth * 2, h, 0.08), [w, depth, h])
  return <mesh geometry={geo} material={ROOF} position={[0, y, z]} />
}

// ── 운하 거리 여관 ─────────────────────────────
// item.size [w, h, d], item.floors(3~4), item.look: 'wood' | 'plaster' (위층 흰 회벽 많이)
// item.tower: 지붕 위 망루, item.karahafu: 현관 둥근 박공, item.arch: 2층 둥근 창, item.vsign: { text, side(-1|1), bg, fg }
// item.noren: { text, bg, fg } 1층 가게 노렌 (가게면 현관 대신 가게 앞), item.seed: 모양 바꿈
export function JmGinzanInn({ item }) {
  const [w, h, d] = item.size
  const floors = Math.max(2, item.floors ?? 3)
  const look = item.look ?? 'wood'
  const seed = item.seed ?? 0
  const base = 0.45
  const roofH = Math.min(2.6, w * 0.22)
  const towerH = item.tower ? 3.2 : 0
  const fh = (h - base - roofH - towerH) / floors
  const front = d / 2
  // 위층일수록 앞으로 조금씩 나옴 (1층은 들어가 있음)
  const out = (i) => -0.6 + Math.min(i, 2) * 0.3
  const roof = useMemo(() => hipRoofGeometry(w + 1.3, d + 1.1, roofH, 0.25), [w, d, roofH])
  const towerRoof = useMemo(() => hipRoofGeometry(3.4, 3.2, 1.3, 0.2), [])
  const wallM = look === 'plaster' ? PLASTER : WOOD
  const signSide = item.vsign?.side ?? (seed % 2 ? 1 : -1)
  const noren = item.noren
  const lattice = Math.max(6, Math.round((w - 1) / 0.32))

  return (
    <group>
      <Box p={[0, base / 2, 0]} s={[w, base, d]} m={STONE} />
      {range(floors).map((i) => {
        const y = base + i * fh
        const fz = front + out(i)
        const bodyD = d - 0.6 + out(i) * 2 - (i === 0 ? 0 : 0)
        const winW = w - 1.2
        return (
          <group key={i}>
            {/* 몸통 (앞면 위치에 맞춰 깊이 조절) */}
            <Box p={[0, y + fh / 2, fz - bodyD / 2]} s={[w - 0.2, fh, bodyD]} m={i === 0 ? WOOD_DARK : wallM} />
            {/* 기둥 */}
            {[-1, 1].map((s) => (
              <Box key={s} p={[s * (w / 2 - 0.18), y + fh / 2, fz + 0.04]} s={[0.26, fh, 0.26]} m={WOOD_DARK} />
            ))}
            {i === 0 ? (
              <group>
                {/* 1층: 따뜻한 불빛 + 촘촘한 나무 격자 (가운데 현관) */}
                <Box p={[0, y + fh * 0.45, fz + 0.02]} s={[winW, fh * 0.78, 0.05]} m={SHOJI} />
                {range(lattice).map((k) => {
                  const x = -winW / 2 + (k + 0.5) * (winW / lattice)
                  if (Math.abs(x) < 1.0) return null
                  return <Box key={k} p={[x, y + fh * 0.45, fz + 0.08]} s={[0.06, fh * 0.78, 0.06]} m={WOOD_DARK} />
                })}
                <Box p={[0, y + fh * 0.84, fz + 0.08]} s={[winW, 0.1, 0.08]} m={WOOD_DARK} />
                {/* 현관 / 가게 입구 */}
                <Box p={[0, y + 1.15, fz + 0.03]} s={[1.9, 2.3, 0.06]} m={noren ? GLASS_WARM : WOOD_DARK} />
                {noren && (
                  <mesh position={[0, y + 2.05, fz + 0.18]}>
                    <planeGeometry args={[2.2, 0.85]} />
                    <GlowMaterial glow={0.45} map={getJpSignTexture(noren.text, noren.bg ?? '#1e3a5f', noren.fg ?? '#f5efe0', 2.2 / 0.85)} side={THREE.DoubleSide} />
                  </mesh>
                )}
                {/* 처마 밑 제등 */}
                {[-1, 1].map((s) => (
                  <group key={s} position={[s * 1.45, y + fh - 0.55, fz + 0.5]}>
                    <Cyl p={[0, 0, 0]} rad={0.2} h={0.42} m={LANTERN_RED} />
                    <Cyl p={[0, 0.24, 0]} rad={0.14} h={0.05} m={IRON} />
                  </group>
                ))}
              </group>
            ) : (
              <group>
                {/* 위층: 회벽 띠 + 장지문 창 + 세로 문살 */}
                {look !== 'wood' && <Box p={[0, y + fh * 0.88, fz + 0.02]} s={[w - 0.5, fh * 0.2, 0.05]} m={PLASTER} />}
                <Box p={[0, y + fh * 0.5, fz + 0.03]} s={[winW, fh * 0.48, 0.05]} m={SHOJI} />
                {range(Math.max(4, Math.round(winW / 0.75))).map((k, _, all) => (
                  <Box key={k} p={[-winW / 2 + (k * winW) / (all.length - 1), y + fh * 0.5, fz + 0.07]} s={[0.07, fh * 0.5, 0.05]} m={WOOD_DARK} />
                ))}
                <Box p={[0, y + fh * 0.26, fz + 0.07]} s={[winW, 0.08, 0.06]} m={WOOD_DARK} />
                <Box p={[0, y + fh * 0.74, fz + 0.07]} s={[winW, 0.08, 0.06]} m={WOOD_DARK} />
                {/* 둥근 창 (2층 가운데, 회벽 위) */}
                {item.arch && i === 1 && (
                  <group position={[0, y + fh * 0.52, fz + 0.1]}>
                    <Box p={[0, 0, 0]} s={[1.6, fh * 0.56, 0.06]} m={PLASTER} />
                    <mesh position={[0, -0.1, 0.04]}>
                      <circleGeometry args={[0.62, 24, 0, Math.PI]} />
                      <meshStandardMaterial color="#ffd38a" emissive="#ffa640" emissiveIntensity={1.1} />
                    </mesh>
                    <Box p={[0, -0.45, 0.04]} s={[1.24, 0.7, 0.02]} m={GLASS_WARM} />
                    <Box p={[0, -0.25, 0.07]} s={[0.05, 1.3, 0.03]} m={WOOD_DARK} />
                  </group>
                )}
                {/* 나무 발코니 (층마다 번갈아 or 전부) */}
                {(i % 2 === 1 || look === 'wood') && (
                  <group position={[0, y, fz + 0.45]}>
                    <Box p={[0, 0.06, -0.15]} s={[w - 0.4, 0.12, 0.8]} m={WOOD} />
                    <Box p={[0, 0.95, 0.2]} s={[w - 0.4, 0.09, 0.09]} m={WOOD_DARK} />
                    <Box p={[0, 0.3, 0.2]} s={[w - 0.4, 0.06, 0.06]} m={WOOD_DARK} />
                    {range(Math.max(5, Math.round(w / 0.45))).map((k, _, all) => (
                      <Box key={k} p={[-(w - 0.5) / 2 + (k * (w - 0.5)) / (all.length - 1), 0.5, 0.2]} s={[0.05, 0.9, 0.05]} m={WOOD_LIGHT} />
                    ))}
                  </group>
                )}
              </group>
            )}
            {/* 층마다 처마 */}
            <Eave w={w + 0.6} y={y + fh - 0.08} z={fz + 0.2} depth={i === 0 ? 1.3 : 0.9} />
          </group>
        )
      })}
      {/* 현관 둥근 박공 */}
      {item.karahafu && <Karahafu w={3.6} h={1.3} depth={1.6} color="#2e3236" p={[0, base + fh + 0.05, front + out(0) + 0.9]} board={false} />}
      {/* 큰 지붕 */}
      <mesh geometry={roof} material={ROOF} position={[0, h - roofH - towerH, -0.1]} />
      {/* 망루 */}
      {item.tower && (
        <group position={[0, h - towerH - roofH * 0.35, 0]}>
          <Box p={[0, 1.15, 0]} s={[2.4, 2.3, 2.3]} m={PLASTER} />
          {[-1, 1].map((s) => (
            <Box key={s} p={[0, 1.25, s * 1.16]} s={[1.7, 1.0, 0.05]} m={GLASS_WARM} />
          ))}
          {[-1, 1].map((s) => (
            <Box key={s} p={[s * 1.21, 1.25, 0]} s={[0.05, 1.0, 1.6]} m={GLASS_WARM} />
          ))}
          <mesh geometry={towerRoof} material={ROOF} position={[0, 2.3, 0]} />
          <Cyl p={[0, 3.85, 0]} rad={0.05} h={0.6} m={IRON} />
        </group>
      )}
      {/* 세로 간판 (앞면 한쪽 끝, 길 쪽으로 튀어나옴) */}
      {item.vsign && (
        <VerticalSign
          text={item.vsign.text}
          bg={item.vsign.bg}
          fg={item.vsign.fg}
          h={Math.min(4.2, fh * 1.4)}
          p={[signSide * (w / 2 - 0.25), base + fh * 1.95, front + out(1) + 0.75]}
        />
      )}
    </group>
  )
}

// ── 쌍둥이 가스등 (물길가) ───────────────────────
// size [_, h, _]. 기둥 하나에 가로대, 양쪽에 육각 유리등
export function JmTwinLamp({ item }) {
  const h = item.size[1]
  return (
    <group>
      <Box p={[0, 0.2, 0]} s={[0.42, 0.4, 0.42]} m={IRON} />
      <Cyl p={[0, h / 2, 0]} rad={0.07} h={h} m={IRON} />
      <Box p={[0, h - 0.15, 0]} s={[1.1, 0.06, 0.06]} m={IRON} />
      {[-1, 1].map((s) => (
        <group key={s} position={[s * 0.5, h - 0.05, 0]}>
          <Cyl p={[0, 0.27, 0]} rad={0.2} h={0.44} m={LAMP_GLASS} geo={HEX} />
          <mesh position={[0, 0.58, 0]} material={IRON}>
            <coneGeometry args={[0.27, 0.2, 6]} />
          </mesh>
          <Cyl p={[0, 0.04, 0]} rad={0.15} h={0.05} m={IRON} />
        </group>
      ))}
      <Cyl p={[0, h + 0.18, 0]} rad={0.05} h={0.36} m={IRON} />
    </group>
  )
}
const HEX = new THREE.CylinderGeometry(1, 0.85, 1, 6)

// ── 물길 위 작은 다리 ───────────────────────────
// size [폭(물길 방향 직각 = x), _, 길이(z, 물길 건너는 방향)]. item.red: 붉은 난간. 밟는 면은 생성 스크립트의 길(roads)
export function JmGinzanBridge({ item }) {
  const [w, , len] = item.size
  const rail = item.red ? mat('#c8452f', { roughness: 0.6 }) : WOOD_DARK
  const posts = Math.max(3, Math.round(len / 1.2) + 1)
  return (
    <group>
      <Box p={[0, 0.07, 0]} s={[w, 0.14, len]} m={WOOD_LIGHT} />
      {range(Math.round(len / 0.35)).map((k) => (
        <Box key={k} p={[0, 0.145, -len / 2 + (k + 0.5) * 0.35]} s={[w - 0.1, 0.01, 0.03]} m={WOOD_DARK} />
      ))}
      <Box p={[0, -0.25, 0]} s={[w - 0.6, 0.4, len]} m={WOOD_DARK} />
      {[-1, 1].map((s) => (
        <group key={s} position={[s * (w / 2 - 0.08), 0.14, 0]}>
          {range(posts).map((k) => (
            <Box key={k} p={[0, 0.45, -len / 2 + (k * len) / (posts - 1)]} s={[0.13, 0.9, 0.13]} m={rail} />
          ))}
          <Box p={[0, 0.88, 0]} s={[0.12, 0.08, len]} m={rail} />
          <Box p={[0, 0.45, 0]} s={[0.07, 0.06, len]} m={rail} />
        </group>
      ))}
    </group>
  )
}

// ── 흰 회벽 담 (기와 얹은 담, 명장면 마당 둘레) ───────────────
// size [길이, 높이, 두께]
export function JmPlasterWall({ item }) {
  const [len, h, t] = item.size
  return (
    <group>
      <Box p={[0, 0.3, 0]} s={[len, 0.6, t + 0.08]} m={STONE} />
      <Box p={[0, h / 2, 0]} s={[len, h - 0.3, t]} m={PLASTER} />
      <Box p={[0, h - 0.2, 0]} s={[len + 0.3, 0.16, t + 0.7]} m={ROOF} />
      <Box p={[0, h - 0.06, 0]} s={[len + 0.2, 0.18, 0.3]} m={ROOF} />
      {range(Math.max(1, Math.floor(len / 3))).map((k, _, all) => (
        <Box key={k} p={[-len / 2 + ((k + 0.5) * len) / all.length, h / 2, 0]} s={[0.18, h - 0.3, t + 0.04]} m={WOOD_DARK} />
      ))}
    </group>
  )
}

// ── 마당 입구 문 (명장면 마당 앞, 기와 얹은 나무 문) ─────────
// size [폭, 높이, _], item.signs[0]: 문 위 현판
export function JmCourtGate({ item }) {
  const [w, h] = item.size
  const sign = item.signs?.[0]
  const roof = useMemo(() => hipRoofGeometry(w + 1.2, 1.8, 0.7, 0.15), [w])
  return (
    <group>
      {[-1, 1].map((s) => (
        <Cyl key={s} p={[(s * w) / 2, h / 2, 0]} rad={0.16} h={h} m={WOOD_DARK} />
      ))}
      <Box p={[0, h - 0.35, 0]} s={[w + 0.5, 0.25, 0.3]} m={WOOD_DARK} />
      <mesh geometry={roof} material={ROOF} position={[0, h - 0.2, 0]} />
      {sign && (
        <mesh position={[0, h - 0.85, 0.17]}>
          <planeGeometry args={[Math.min(3.4, w * 0.8), 0.55]} />
          <GlowMaterial glow={0.5} map={getJpSignTexture(sign.text, sign.bg ?? '#3d2a1e', sign.fg ?? '#f3e6c8', Math.min(3.4, w * 0.8) / 0.55)} side={THREE.DoubleSide} />
        </mesh>
      )}
    </group>
  )
}

export const JM_GINZAN_STYLES = {
  jmGinzanInn: JmGinzanInn,
  jmTwinLamp: JmTwinLamp,
  jmGinzanBridge: JmGinzanBridge,
  jmPlasterWall: JmPlasterWall,
  jmCourtGate: JmCourtGate,
}
