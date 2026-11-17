import { RoundedBox, useAnimations, useGLTF, useTexture } from '@react-three/drei'
import { Suspense, useEffect, useMemo } from 'react'
import { clone } from 'three/addons/utils/SkeletonUtils.js'
import * as THREE from 'three'
import { Box, Cyl, GEO, Instances, mat, texMat } from './kit.jsx'
import { getSignTexture } from './textures.js'

// ── K-POP 구역 (SG) ─────────────────────────────
// 야외무대: 뒷벽(LED 화면) + 1.5m 무대 바닥 + 트러스 타워 2개 + 상부 트러스 조명
// size = [가로, 높이, 깊이]. 앞면(+z)이 관객 쪽. 뒷벽 두께 1m, 나머지 깊이가 무대 바닥.
// 최적화: 트러스 막대 수백 개는 <Instances> 한 번으로 그림(draw call 1), 빛나는 부품·빔은 그림자 끔.
const WALL = mat('#2b1d42', { roughness: 0.6 })
const DECK = mat('#1c1b22', { roughness: 0.35, metalness: 0.3 }) // 살짝 광택 → 조명 반사
const FRAME = mat('#15131a', { roughness: 0.5, metalness: 0.4 })
const METAL = mat('#c3c6cf', { roughness: 0.35, metalness: 0.8 })
const HOUSING = mat('#18181c', { roughness: 0.5, metalness: 0.5 })
const EDGE = mat('#ffffff', { emissive: '#ffffff', emissiveIntensity: 1.5 })
const LENS = [
  mat('#ff8fd0', { emissive: '#ff5cb8', emissiveIntensity: 2 }),
  mat('#c9a6ff', { emissive: '#9b5cff', emissiveIntensity: 2 }),
]
// 조명 빔: 빛을 받지 않는 반투명 원뿔, 더하기 합성으로 겹칠수록 밝아짐
const BEAMS = ['#ff5cb8', '#9b5cff'].map(
  (color) =>
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.14,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
)
const BEAM_GEO = new THREE.ConeGeometry(1, 1, 24, 1, true) // 꼭짓점이 위(+y), 밑면 뚫림
const glow = { userData: { noShadow: true } }

const BAR = 0.08 // 트러스 막대 굵기
const SEG = 1.2 // 트러스 한 칸 길이

const wardrobeMaps = ['rose', 'iris'].map(color => import.meta.env.BASE_URL + 'models/idol-' + color + '.jpg')

function StageIdol({ face, x, costume }) {
  const { scene, animations } = useGLTF(import.meta.env.BASE_URL + 'models/sungray-idol.glb')
  const performer = useMemo(() => {
    const member = clone(scene)
    const mesh = member.getObjectByName('Sungray')
    if (costume) {
      mesh.material = mesh.material.clone()
      mesh.material.map = costume
    }
    mesh.morphTargetInfluences.fill(0)
    mesh.morphTargetInfluences[mesh.morphTargetDictionary[face]] = 1
    return member
  }, [scene, face, costume])
  useEffect(() => () => {
    if (costume) performer.getObjectByName('Sungray').material.dispose()
  }, [performer, costume])
  const { actions } = useAnimations(animations, performer)
  useEffect(() => {
    const dance = actions['Snake Hip Hop Dance']
    dance.reset().play()
    return () => { dance.stop() }
  }, [actions])
  return <primitive object={performer} position-x={x} />
}

function StageTrio() {
  const [rose, iris] = useTexture(wardrobeMaps, textures => {
    for (const texture of textures) {
      texture.flipY = false
      texture.colorSpace = THREE.SRGBColorSpace
      texture.needsUpdate = true
    }
  })
  return <>
    <StageIdol face="SoftFace" x={-2.2} costume={rose} />
    <StageIdol face="Smile" x={0} />
    <StageIdol face="AngularFace" x={2.2} costume={iris} />
  </>
}

export function Stage({ item }) {
  const [w, h, d] = item.size
  const deckH = 1.5 // 무대 바닥 높이(m). 관객석에서 공연자가 잘 보이는 높이
  const deckD = d - 1
  const wallFront = -d / 2 + 1
  const towerZ = d / 2 - 0.75
  const towerX = w / 2 - 0.75
  const trussY = h - 0.3
  const screenW = Math.min(14, w - 4)
  const lightXs = [-8, -4.8, -1.6, 1.6, 4.8, 8].map((x) => (x * (w - 6)) / 16) // 가로 22m 기준 간격을 폭에 맞춰 늘림
  const tilt = -0.35 // 빔을 관객 쪽(+z)으로 기울임
  const beamLen = (trussY - 0.9 - deckH) / Math.cos(tilt)

  const bars = [
    ...towerBars(-towerX, towerZ, h - 0.6),
    ...towerBars(towerX, towerZ, h - 0.6),
    ...beamBars(w - 1.5, trussY, towerZ),
  ]

  return (
    <group>
      <group position={[0, deckH, deckD * 0.22]}>
        <Suspense fallback={null}>
          <StageTrio />
        </Suspense>
      </group>
      {/* 뒷벽 + 상단 테두리 */}
      <RoundedBox args={[w, h, 1]} radius={0.1} smoothness={2} position={[0, h / 2, -d / 2 + 0.5]} material={WALL} />
      <Box p={[0, h - 0.1, wallFront + 0.05]} s={[w, 0.2, 0.1]} m={EDGE} {...glow} />
      {/* LED 화면 + 테두리 */}
      <Box p={[0, 5.5, wallFront + 0.04]} s={[screenW + 0.4, 6.4, 0.08]} m={FRAME} />
      <mesh geometry={GEO.plane} material={texMat(getScreenTexture(), { emissive: '#ffffff', emissiveIntensity: 1.1 })}
        position={[0, 5.5, wallFront + 0.09]} scale={[screenW, 6, 1]} {...glow} />
      {/* 무대 바닥 + 앞 테두리 조명 */}
      <RoundedBox args={[w, deckH, deckD]} radius={0.06} smoothness={2} position={[0, deckH / 2, d / 2 - deckD / 2]} material={DECK} />
      <Box p={[0, deckH - 0.15, d / 2 + 0.01]} s={[w - 0.2, 0.08, 0.04]} m={EDGE} {...glow} />
      {/* 트러스 (타워 2개 + 상부 가로대) */}
      <Instances geometry={GEO.box} material={METAL} items={bars} />
      {/* 조명 6개: 몸통 + 렌즈 + 빔 */}
      {lightXs.map((x, i) => (
        <group key={x} position={[x, trussY - 0.6, towerZ]}>
          <Cyl p={[0, 0, 0]} rad={0.28} h={0.5} m={HOUSING} />
          <Cyl p={[0, -0.27, 0]} rad={0.22} h={0.04} m={LENS[i % 2]} {...glow} />
          <mesh geometry={BEAM_GEO} material={BEAMS[i % 2]} rotation={[tilt, 0, 0]} scale={[1.6, beamLen, 1.6]}
            position={[0, -(beamLen / 2) * Math.cos(tilt), -(beamLen / 2) * Math.sin(tilt)]} {...glow} />
        </group>
      ))}
    </group>
  )
}

// 세로 트러스 타워: 모서리 기둥 4개 + 칸마다 가로대 + 앞뒤 면 대각선
function towerBars(cx, cz, height) {
  const a = 0.6 // 단면 반폭
  const bars = []
  for (const [dx, dz] of [[-a, -a], [a, -a], [-a, a], [a, a]]) {
    bars.push({ p: [cx + dx, height / 2, cz + dz], s: [BAR * 1.5, height, BAR * 1.5] })
  }
  const n = Math.floor(height / SEG)
  const diag = Math.hypot(SEG, 2 * a)
  const angle = Math.atan2(2 * a, SEG)
  for (let i = 0; i <= n; i++) {
    const y = i * SEG + 0.05
    for (const dz of [-a, a]) bars.push({ p: [cx, y, cz + dz], s: [2 * a, BAR, BAR] })
    for (const dx of [-a, a]) bars.push({ p: [cx + dx, y, cz], s: [BAR, BAR, 2 * a] })
    if (i < n) {
      const sign = i % 2 ? 1 : -1
      for (const dz of [-a, a]) bars.push({ p: [cx, y + SEG / 2, cz + dz], s: [BAR, diag, BAR], r: [0, 0, sign * angle] })
    }
  }
  return bars
}

// 가로 트러스: 길이 방향 막대 4개 + 칸마다 세로대 + 앞뒤 면 대각선
function beamBars(length, cy, cz) {
  const a = 0.3
  const bars = []
  for (const [dy, dz] of [[-a, -a], [a, -a], [-a, a], [a, a]]) {
    bars.push({ p: [0, cy + dy, cz + dz], s: [length, BAR * 1.5, BAR * 1.5] })
  }
  const n = Math.floor(length / SEG)
  const x0 = -(n * SEG) / 2
  const diag = Math.hypot(SEG, 2 * a)
  const angle = Math.atan2(2 * a, SEG)
  for (let i = 0; i <= n; i++) {
    const x = x0 + i * SEG
    for (const dz of [-a, a]) bars.push({ p: [x, cy, cz + dz], s: [BAR, 2 * a, BAR] })
    if (i < n) {
      const sign = i % 2 ? 1 : -1
      for (const dz of [-a, a]) bars.push({ p: [x + SEG / 2, cy, cz + dz], s: [diag, BAR, BAR], r: [0, 0, sign * angle] })
    }
  }
  return bars
}

// LED 화면: 보라→분홍 그라데이션 + 가상 그룹 로고 + 픽셀 격자 (캔버스로 그려서 한 번만 만듦)
let screenTexture = null
function getScreenTexture() {
  if (screenTexture) return screenTexture
  const canvas = document.createElement('canvas')
  canvas.width = 1024
  canvas.height = 440
  const ctx = canvas.getContext('2d')
  const { width: cw, height: ch } = canvas
  const bg = ctx.createLinearGradient(0, 0, cw, ch)
  bg.addColorStop(0, '#3b0f7a')
  bg.addColorStop(0.55, '#a21caf')
  bg.addColorStop(1, '#f472b6')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, cw, ch)
  const spot = ctx.createRadialGradient(cw / 2, ch / 2, 10, cw / 2, ch / 2, cw / 2)
  spot.addColorStop(0, 'rgba(255,255,255,0.35)')
  spot.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = spot
  ctx.fillRect(0, 0, cw, ch)
  ctx.font = 'bold 150px "Segoe UI", Arial, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.shadowColor = '#ffd6f0'
  ctx.shadowBlur = 30
  ctx.fillStyle = '#ffffff'
  ctx.fillText('SUNGRAY', cw / 2, ch / 2)
  ctx.shadowBlur = 0
  ctx.fillStyle = 'rgba(0,0,0,0.22)' // LED 픽셀 느낌
  for (let x = 0; x < cw; x += 8) ctx.fillRect(x, 0, 2, ch)
  for (let y = 0; y < ch; y += 8) ctx.fillRect(0, y, cw, 2)
  screenTexture = new THREE.CanvasTexture(canvas)
  screenTexture.colorSpace = THREE.SRGBColorSpace
  screenTexture.anisotropy = 8
  return screenTexture
}

// ── 1층이 유리 진열창인 가게 (생일카페·팝업스토어 공용 틀) ──────────
// 앞쪽 4m는 비워서 유리 너머로 안이 보이게 하고, 나머지는 꽉 찬 몸통. 방문자가 들어가진 않으므로 충돌은 size 그대로.
// 안쪽은 위층 그림자에 가려 어두워지기 쉬워서 내부 재질에 약한 자체 발광(lit)을 줌.
const SHOP_D = 4
const GROUND_H = 3.2
const CLEAR_GLASS = mat('#d6ecff', { transparent: true, opacity: 0.18, roughness: 0.05 })
const DARK_GLASS = mat('#2e3f4f', { roughness: 0.25, metalness: 0.1 })
const PARAPET = mat('#7d7a75')
const CEILING_LAMP = mat('#fff7e6', { emissive: '#ffe9c2', emissiveIntensity: 1.2 })
const lit = (c, k = 0.3) => mat(c, { emissive: c, emissiveIntensity: k })

export function Storefront({ item, awning, wallTexture, children, wallColor = '#f5f0ff' }) {
  const [w, h, d] = item.size
  const body = item.color ?? '#e9d5ff'
  const sign = item.signs?.[0]
  const front = d / 2
  const back = front - SHOP_D
  const upperH = h - GROUND_H
  const signW = w - 1.2
  return (
    <group>
      {/* 몸통: 뒤쪽 통짜 + 가게 위 2층 + 가게 양옆 벽 */}
      <Box p={[0, h / 2, (back - d / 2) / 2]} s={[w, h, back + d / 2]} c={body} />
      <Box p={[0, GROUND_H + upperH / 2, (front + back) / 2]} s={[w, upperH, SHOP_D]} c={body} />
      {[-1, 1].map((side) => (
        <Box key={side} p={[side * (w / 2 - 0.15), GROUND_H / 2, (front + back) / 2]} s={[0.3, GROUND_H, SHOP_D]} c={body} />
      ))}
      {/* 가게 안: 바닥, 안쪽 벽(그림), 천장 조명 */}
      <Box p={[0, 0.06, (front + back) / 2]} s={[w - 0.6, 0.12, SHOP_D]} m={lit('#e7dccb', 0.2)} />
      <mesh geometry={GEO.plane} position={[0, GROUND_H / 2, back + 0.01]} scale={[w - 0.6, GROUND_H, 1]}
        material={wallTexture ? texMat(wallTexture, { emissive: '#ffffff', emissiveIntensity: 0.35 }) : lit(wallColor)} />
      <Box p={[0, GROUND_H - 0.06, (front + back) / 2]} s={[w * 0.6, 0.04, 0.5]} m={CEILING_LAMP} {...glow} />
      <group position={[0, 0.12, (front + back) / 2]}>{children}</group>
      {/* 유리 진열창 + 아래 턱 */}
      <Box p={[0, GROUND_H / 2, front - 0.05]} s={[w - 0.6, GROUND_H, 0.05]} m={CLEAR_GLASS} />
      <Box p={[0, 0.2, front - 0.02]} s={[w - 0.6, 0.4, 0.1]} c="#3d3d3d" />
      {/* 차양 + 간판 + 2층 창 + 옥상 턱 */}
      <Box p={[0, GROUND_H + 0.25, front + 0.6]} s={[w - 0.6, 0.1, 1.25]} r={[0.35, 0, 0]} c={awning} />
      {sign?.text && (
        <mesh geometry={GEO.plane} position={[0, GROUND_H + 0.95, front + 0.03]} scale={[signW, 0.62, 1]}>
          <meshStandardMaterial map={getSignTexture(sign.text, sign.bg, sign.fg, signW / 0.62)} />
        </mesh>
      )}
      {upperH >= 3.5 && <Box p={[0, GROUND_H + 2.3, front + 0.04]} s={[w - 1, 1.4, 0.08]} m={DARK_GLASS} />}
      <Box p={[0, h - 0.17, 0]} s={[w + 0.15, 0.35, d + 0.15]} m={PARAPET} />
    </group>
  )
}

// 생일카페: 안에 카운터·케이크·테이블과 의자, 안쪽 벽에 생일 현수막
const WOOD = lit('#a47551', 0.2)
const TABLE_TOP = lit('#ffffff', 0.25)
const CHAIR = lit('#f9a8d4', 0.25)
const CAKE = lit('#fbcfe8', 0.4)

export function BdayCafe({ item }) {
  const [w, h, d] = item.size
  const umbrella = item.umbrella ?? '#f472b6'
  const tables = [-0.6, 1.6, 3.6].map((x, i) => [x, i % 2 ? -0.2 : 0.6])
  return (
    <group>
      <Storefront item={item} awning={umbrella} wallTexture={getBirthdayWallTexture()}>
        <Box p={[-w / 2 + 2.1, 0.55, -1.4]} s={[2.8, 1.1, 0.7]} m={WOOD} />
        <Cyl p={[-w / 2 + 1.6, 1.25, -1.4]} rad={0.28} h={0.3} m={CAKE} />
        <Cyl p={[-w / 2 + 1.6, 1.47, -1.4]} rad={0.2} h={0.14} m={CAKE} />
        {tables.map(([x, z]) => (
          <group key={x} position={[x, 0, z]}>
            <Cyl p={[0, 0.75, 0]} rad={0.45} h={0.05} m={TABLE_TOP} />
            <Cyl p={[0, 0.375, 0]} rad={0.05} h={0.75} c="#6b7280" />
            {[-1, 1].map((side) => (
              <group key={side} position={[side * 0.75, 0, 0]}>
                <Box p={[0, 0.45, 0]} s={[0.42, 0.08, 0.42]} m={CHAIR} />
                <Box p={[side * 0.19, 0.72, 0]} s={[0.06, 0.5, 0.42]} m={CHAIR} />
                <Box p={[0, 0.22, 0]} s={[0.05, 0.44, 0.05]} c="#6b7280" />
              </group>
            ))}
          </group>
        ))}
      </Storefront>
      {/* 옥상 파라솔 */}
      {[[-w * 0.25, -d * 0.1], [w * 0.2, d * 0.15]].map(([x, z]) => (
        <group key={x} position={[x, h, z]}>
          <Cyl p={[0, 1, 0]} rad={0.04} h={2} c="#9ca3af" />
          <mesh geometry={GEO.cone} material={mat(umbrella)} position={[0, 2.1, 0]} scale={[1.2, 0.5, 1.2]} />
        </group>
      ))}
    </group>
  )
}

// 팝업스토어: 양옆 선반에 인형, 가운데 진열대에 앨범, 안쪽 벽에 스티커 사진
const TINT = mat('#ffffff', { emissive: '#ffffff', emissiveIntensity: 0.18 }) // 인스턴스 색을 입히는 흰 재질 (그늘 속에서도 파스텔이 보이게 살짝 발광)
const DOLL_COLORS = ['#f9a8d4', '#c4b5fd', '#fde68a', '#a5f3fc', '#fecdd3', '#ddd6fe']
const ALBUM_COLORS = ['#7c3aed', '#db2777', '#f0abfc', '#1e1b4b']

export function PopupStore({ item }) {
  const [w] = item.size
  const shelfX = w / 2 - 0.6
  const shelves = []
  const dolls = []
  for (const side of [-1, 1]) {
    for (const [k, y] of [0.6, 1.2, 1.8].entries()) {
      shelves.push({ p: [side * shelfX, y, 0], s: [0.5, 0.05, 3] })
      for (const [j, z] of [-1, 0, 1].entries()) {
        const c = DOLL_COLORS[(k * 3 + j + (side > 0 ? 2 : 0)) % DOLL_COLORS.length]
        dolls.push({ p: [side * shelfX, y + 0.14, z], s: [0.14, 0.12, 0.12], c }) // 몸통
        dolls.push({ p: [side * shelfX, y + 0.33, z], s: [0.12, 0.12, 0.12], c }) // 머리
      }
    }
  }
  const albums = [-0.8, -0.3, 0.2, 0.7].map((x, i) => ({ p: [x, 0.86, 0.3], s: [0.35, 0.12, 0.35], c: ALBUM_COLORS[i] }))
  return (
    <Storefront item={item} awning={item.signs?.[0]?.awning ?? '#9b5cff'} wallTexture={getStickerWallTexture()}>
      <Instances geometry={GEO.box} material={WOOD} items={shelves} />
      <Instances geometry={GEO.sphere} material={TINT} items={dolls} />
      <Box p={[0, 0.4, 0.3]} s={[2.4, 0.8, 1.2]} m={WOOD} />
      <Instances geometry={GEO.box} material={TINT} items={albums} />
    </Storefront>
  )
}

// ── 안쪽 벽 그림 (캔버스, 한 번만 만듦) ──────────────
const KO_FONT = '"Malgun Gothic", "Apple SD Gothic Neo", "Noto Sans KR", sans-serif'
const wallCache = new Map()
function canvasTexture(key, width, height, draw) {
  if (wallCache.has(key)) return wallCache.get(key)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  draw(canvas.getContext('2d'), width, height)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  wallCache.set(key, texture)
  return texture
}

// 사진 속 얼굴: 모델이 정해지기 전이라 "사람 얼굴 사진"이라는 것만 알아보게 단순하게
function drawFace(ctx, x, y, r, hair) {
  ctx.fillStyle = '#f5d0b5'
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = hair
  ctx.beginPath()
  ctx.arc(x, y - r * 0.15, r * 1.08, Math.PI, Math.PI * 2)
  ctx.fill()
  ctx.fillRect(x - r * 1.08, y - r * 0.15, r * 0.3, r * 1.3)
  ctx.fillRect(x + r * 0.78, y - r * 0.15, r * 0.3, r * 1.3)
  ctx.fillStyle = '#3f3f46'
  ctx.beginPath()
  ctx.arc(x - r * 0.35, y + r * 0.1, r * 0.09, 0, Math.PI * 2)
  ctx.arc(x + r * 0.35, y + r * 0.1, r * 0.09, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = '#be185d'
  ctx.lineWidth = Math.max(1, r * 0.08)
  ctx.beginPath()
  ctx.arc(x, y + r * 0.3, r * 0.3, 0.2, Math.PI - 0.2)
  ctx.stroke()
}

// 팝업스토어 벽: 네 컷 스티커 사진 띠를 줄지어 붙인 벽 (희미하게)
function getStickerWallTexture() {
  return canvasTexture('sg-sticker-wall', 1024, 340, (ctx, w) => {
    ctx.fillStyle = '#f5f0ff'
    ctx.fillRect(0, 0, w, 340)
    ctx.fillStyle = '#7c3aed'
    ctx.font = `bold 34px ${KO_FONT}`
    ctx.textAlign = 'center'
    ctx.fillText('SUNGRAY PHOTO WALL', w / 2, 40)
    const pastel = ['#fce7f3', '#ede9fe', '#e0f2fe', '#fef9c3', '#dcfce7']
    const hairs = ['#3b2f2f', '#6b4f3a', '#1f1b2e', '#8b5e3c']
    ctx.globalAlpha = 0.75
    for (let i = 0; i < 12; i++) {
      ctx.save()
      ctx.translate(30 + i * 82 + 34, 60)
      ctx.rotate(((i % 3) - 1) * 0.04)
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(-34, 0, 68, 262)
      for (let f = 0; f < 4; f++) {
        const cy = 6 + f * 63
        ctx.fillStyle = pastel[(i + f) % pastel.length]
        ctx.fillRect(-29, cy, 58, 56)
        if ((i + f) % 3 === 0) {
          drawFace(ctx, -12, cy + 30, 11, hairs[(i + f) % hairs.length])
          drawFace(ctx, 12, cy + 30, 11, hairs[(i + f + 1) % hairs.length])
        } else {
          drawFace(ctx, 0, cy + 30, 15, hairs[(i + f) % hairs.length])
        }
      }
      ctx.restore()
    }
  })
}

// 생일카페 벽: 「HAPPY YUNSEUL DAY」 현수막 + 가랜드 + 액자 사진
function getBirthdayWallTexture() {
  return canvasTexture('sg-birthday-wall', 1024, 340, (ctx, w) => {
    ctx.fillStyle = '#fff1f7'
    ctx.fillRect(0, 0, w, 340)
    const flags = ['#f472b6', '#fbcfe8', '#c4b5fd', '#fde68a']
    for (let i = 0; i < 20; i++) {
      ctx.fillStyle = flags[i % flags.length]
      ctx.beginPath()
      ctx.moveTo(20 + i * 50, 20)
      ctx.lineTo(60 + i * 50, 20)
      ctx.lineTo(40 + i * 50, 56)
      ctx.fill()
    }
    ctx.fillStyle = '#db2777'
    ctx.font = `bold 64px ${KO_FONT}`
    ctx.textAlign = 'center'
    ctx.fillText('HAPPY YUNSEUL DAY', w / 2, 130)
    ctx.globalAlpha = 0.8
    for (let i = 0; i < 5; i++) {
      const x = 120 + i * 196
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(x - 60, 170, 120, 140)
      ctx.strokeStyle = '#f9a8d4'
      ctx.lineWidth = 6
      ctx.strokeRect(x - 60, 170, 120, 140)
      ctx.fillStyle = '#fce7f3'
      ctx.fillRect(x - 50, 180, 100, 120)
      drawFace(ctx, x, 240, 32, '#3b2f2f')
    }
  })
}
