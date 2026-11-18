import { useMemo } from 'react'
import * as THREE from 'three'
import { hipRoofGeometry } from './geometry.js'
import { useSeason } from '../../seasons.js'
import { HoopShoot } from './jm_activities.jsx'

// 애니메이션 구역(JM) 전용: 성지 안내판(직접 그린 포스터), 일본어 간판, 작품별 랜드마크. 담당: 지민
//
// ⚠ 포스터는 실제 애니 포스터를 따라 그리지 않아요.
//   근접형 제목 + 장면의 장소(건널목·계단·도리이…) + 얼굴·옷 특징이 없는 사람 실루엣만 직접 그린 그림이에요.
//   실제 캐릭터의 모습·로고·포스터 구도는 넣지 않아요 (저작권).

// ── 글꼴 ──────────────────────────────────────
// public/fonts 의 웹폰트 (Google Fonts, SIL Open Font License).
// ⚠ 용량을 줄이려고 지금 간판·안내판에 쓰는 글자만 들어 있어요. 새 글자를 쓰면 그 글자만 기본 글꼴로 보여요.
//   글자를 추가하면 frontend/public/fonts/JM_FONTS.md 의 방법으로 다시 받아 주세요.
const JP_FONT = '"JmJp", "Yu Gothic", "Meiryo", "Hiragino Sans", sans-serif' // Zen Maru Gothic Bold
const KR_FONT = '"JmKr", "Malgun Gothic", "Apple SD Gothic Neo", sans-serif' // Gowun Dodum
const range = (n) => Array.from({ length: n }, (_, i) => i)

// ── 캔버스 텍스처 (같은 그림은 한 번만 만들어 재사용) ──
// 웹폰트가 늦게 도착하면 이미 만든 그림을 새 글꼴로 다시 그려요.
const cache = new Map()
function canvasTexture(key, width, height, draw) {
  if (cache.has(key)) return cache.get(key).texture
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  draw(canvas.getContext('2d'), width, height)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 8
  cache.set(key, { texture, canvas, draw })
  return texture
}

function redrawAll() {
  for (const { texture, canvas, draw } of cache.values()) {
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    draw(ctx, canvas.width, canvas.height)
    texture.needsUpdate = true
  }
}

if (typeof document !== 'undefined' && typeof FontFace !== 'undefined') {
  const fonts = [
    new FontFace('JmJp', 'url(/fonts/jm-zen-maru-gothic-700.woff2)', { weight: '700' }),
    new FontFace('JmKr', 'url(/fonts/jm-gowun-dodum.woff2)'),
  ]
  Promise.all(fonts.map((f) => f.load().then((loaded) => document.fonts.add(loaded))))
    .then(redrawAll)
    .catch((error) => console.warn('[JM] 웹폰트를 불러오지 못해 기본 글꼴로 표시합니다', error))
}

function fitText(ctx, text, maxWidth, startSize, weight = 'bold', family = JP_FONT, maxHeight = Infinity) {
  let size = Math.min(startSize, maxHeight)
  ctx.font = `${weight} ${size}px ${family}`
  while (ctx.measureText(text).width > maxWidth && size > 10) {
    size -= 2
    ctx.font = `${weight} ${size}px ${family}`
  }
  return size
}

// 스스로 빛나는 재질 (포스터·간판). 장면 조명이 어두워도 그림이 밝게 보여요.
// glow: 0 = 조명만 받음, 1 = 그림 색 그대로 빛남
export function GlowMaterial({ map, glow = 0.45, ...rest }) {
  return <meshStandardMaterial map={map} emissiveMap={map} emissive="#ffffff" emissiveIntensity={glow} {...rest} />
}

// 일본어 간판 (가로).
// aspect = 간판 판의 가로 ÷ 세로. 판 비율과 같은 캔버스에 그려서 글자가 늘어나거나 찌그러지지 않게 해요.
export function getJpSignTexture(text, bg = '#ffffff', fg = '#222222', aspect = 4) {
  const a = Math.round(Math.min(12, Math.max(0.5, aspect)) * 10) / 10
  const height = 160
  const width = Math.round(height * a)
  return canvasTexture(`jpsign:${text}:${bg}:${fg}:${a}`, width, height, (ctx, w, h) => {
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, w, h)
    ctx.strokeStyle = 'rgba(0,0,0,0.22)'
    ctx.lineWidth = 6
    ctx.strokeRect(6, 6, w - 12, h - 12)
    fitText(ctx, text, w * 0.86, 96, 'bold', JP_FONT, h * 0.62)
    ctx.fillStyle = fg
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(text, w / 2, h / 2 + 4)
  })
}

// 세로 글씨 판 (학교 이름·제등). aspect = 가로 ÷ 세로 (1보다 작음)
export function getJpVerticalTexture(text, bg = '#f7f3ea', fg = '#1f1f1f', aspect = 0.25, border = '#3a2a20') {
  const width = 128
  const height = Math.round(width / Math.min(1, Math.max(0.1, aspect)))
  return canvasTexture(`jpv:${text}:${bg}:${fg}:${width}x${height}`, width, height, (ctx, w, h) => {
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, w, h)
    if (border) {
      ctx.strokeStyle = border
      ctx.lineWidth = 6
      ctx.strokeRect(3, 3, w - 6, h - 6)
    }
    const chars = [...text]
    const size = Math.min(w * 0.72, (h - 30) / chars.length)
    ctx.font = `bold ${size}px ${JP_FONT}`
    ctx.fillStyle = fg
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    const top = (h - size * chars.length) / 2
    chars.forEach((c, i) => ctx.fillText(c, w / 2, top + size * (i + 0.5)))
  })
}

// 얼굴·옷 특징이 없는 사람 실루엣 (포스터용). scale 1 = 키 약 120px
function person(ctx, x, footY, scale = 1, color = 'rgba(25,25,35,0.85)', pose = 'stand') {
  const s = scale
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.arc(x, footY - 104 * s, 14 * s, 0, Math.PI * 2) // 머리
  ctx.fill()
  ctx.beginPath() // 몸
  ctx.moveTo(x - 16 * s, footY - 86 * s)
  ctx.lineTo(x + 16 * s, footY - 86 * s)
  ctx.lineTo(x + 20 * s, footY - 40 * s)
  ctx.lineTo(x - 20 * s, footY - 40 * s)
  ctx.closePath()
  ctx.fill()
  ctx.fillRect(x - 13 * s, footY - 42 * s, 10 * s, 42 * s) // 다리
  ctx.fillRect(x + 3 * s, footY - 42 * s, 10 * s, 42 * s)
  if (pose === 'reach') {
    ctx.save()
    ctx.translate(x + 14 * s, footY - 82 * s)
    ctx.rotate(-0.9)
    ctx.fillRect(0, -4 * s, 40 * s, 8 * s) // 뻗은 팔
    ctx.restore()
  }
  if (pose === 'pray') {
    ctx.fillRect(x - 4 * s, footY - 96 * s, 8 * s, 26 * s) // 모은 손
  }
  if (pose === 'umbrella') {
    // 오른팔을 앞으로 올려 우산대를 쥠 → 우산은 손에서 머리 위로
    const handX = x + 22 * s
    const handY = footY - 78 * s
    ctx.save()
    ctx.translate(x + 12 * s, footY - 84 * s)
    ctx.rotate(-0.35)
    ctx.fillRect(0, -4 * s, 14 * s, 8 * s)
    ctx.restore()
    ctx.fillStyle = '#3a2a20' // 우산대 (손에서 위로)
    ctx.fillRect(handX - 2 * s, footY - 150 * s, 4 * s, 150 * s - 78 * s + 6 * s)
    ctx.fillStyle = '#c8452f' // 빨간 우산 (머리를 덮게)
    ctx.beginPath()
    ctx.arc(handX - 6 * s, footY - 140 * s, 52 * s, Math.PI, 0)
    ctx.fill()
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.arc(handX, handY, 5 * s, 0, Math.PI * 2) // 쥔 손
    ctx.fill()
  }
}

// ── 포스터 그림 (테마별) ───────────────────────
const sky = (ctx, w, h, top, bottom, until = 1) => {
  const g = ctx.createLinearGradient(0, 0, 0, h * until)
  g.addColorStop(0, top)
  g.addColorStop(1, bottom)
  ctx.fillStyle = g
  ctx.fillRect(0, 0, w, h * until)
}
const rect = (ctx, color, x, y, w, h) => {
  ctx.fillStyle = color
  ctx.fillRect(x, y, w, h)
}
function torii(ctx, cx, baseY, width, height, color = '#c8452f') {
  const pw = width * 0.08
  rect(ctx, color, cx - width * 0.36, baseY - height, pw, height)
  rect(ctx, color, cx + width * 0.36 - pw, baseY - height, pw, height)
  rect(ctx, color, cx - width * 0.45, baseY - height * 0.78, width * 0.9, height * 0.07)
  rect(ctx, '#1f1f1f', cx - width / 2, baseY - height - height * 0.08, width, height * 0.1)
}
function crossingGate(ctx, x, baseY, h) {
  rect(ctx, '#222', x - 4, baseY - h, 8, h)
  ctx.save()
  ctx.translate(x, baseY - h * 0.55)
  for (let i = 0; i < 8; i++) rect(ctx, i % 2 ? '#f5f5f5' : '#e7c22a', i * 28, -5, 28, 10)
  ctx.restore()
  ctx.fillStyle = '#d63a3a'
  ctx.beginPath()
  ctx.arc(x - 14, baseY - h + 10, 10, 0, Math.PI * 2)
  ctx.arc(x + 14, baseY - h + 10, 10, 0, Math.PI * 2)
  ctx.fill()
}

const POSTER_ART = {
  // 바다가 보이는 건널목 (스포츠 청춘물)
  crossing: (ctx, w, h) => {
    sky(ctx, w, h, '#7cc4f2', '#d7f0ff', 0.55)
    rect(ctx, '#2f7fc1', 0, h * 0.42, w, h * 0.14) // 바다
    rect(ctx, '#e9dfc8', 0, h * 0.56, w, h * 0.44)
    rect(ctx, '#8d8478', 0, h * 0.66, w, h * 0.08)
    rect(ctx, '#5b5f66', 0, h * 0.675, w, 5)
    rect(ctx, '#5b5f66', 0, h * 0.72, w, 5)
    crossingGate(ctx, w * 0.2, h * 0.66, h * 0.22)
    ctx.strokeStyle = '#e8792a' // 농구공
    ctx.fillStyle = '#e8792a'
    ctx.beginPath()
    ctx.arc(w * 0.78, h * 0.25, 34, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = '#3a2a20'
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.moveTo(w * 0.78 - 34, h * 0.25)
    ctx.lineTo(w * 0.78 + 34, h * 0.25)
    ctx.moveTo(w * 0.78, h * 0.25 - 34)
    ctx.lineTo(w * 0.78, h * 0.25 + 34)
    ctx.stroke()
  },
  // 황혼 하늘 + 혜성 꼬리 + 돌계단 (판타지 로맨스)
  stairs: (ctx, w, h) => {
    sky(ctx, w, h, '#2b2f6b', '#f2a76b', 0.7)
    ctx.strokeStyle = 'rgba(255,255,255,0.85)'
    ctx.lineWidth = 4
    ctx.beginPath()
    ctx.moveTo(w * 0.15, h * 0.1)
    ctx.lineTo(w * 0.7, h * 0.35)
    ctx.stroke()
    ctx.fillStyle = '#fff'
    ctx.beginPath()
    ctx.arc(w * 0.7, h * 0.35, 6, 0, Math.PI * 2)
    ctx.fill()
    for (let i = 0; i < 9; i++) rect(ctx, i % 2 ? '#c9bfae' : '#b8ad9a', w * 0.25 - i * 6, h * 0.55 + i * 22, w * 0.5 + i * 12, 22)
    rect(ctx, '#6b5a48', w * 0.18, h * 0.5, 6, h * 0.5)
    rect(ctx, '#6b5a48', w * 0.8, h * 0.5, 6, h * 0.5)
  },
  // 숲속 신사 + 도리이 + 여우 가면 (요괴 판타지)
  shrine: (ctx, w, h) => {
    sky(ctx, w, h, '#2f5d3a', '#a9d18e')
    for (let i = 0; i < 7; i++) {
      ctx.fillStyle = i % 2 ? '#24502f' : '#3b7a45'
      ctx.beginPath()
      ctx.arc((w / 6) * i, h * 0.32, 70, 0, Math.PI * 2)
      ctx.fill()
    }
    rect(ctx, '#9a958c', 0, h * 0.8, w, h * 0.2)
    torii(ctx, w / 2, h * 0.82, w * 0.6, h * 0.42)
    ctx.fillStyle = '#ffffff' // 여우 가면 (단순 도형)
    ctx.beginPath()
    ctx.moveTo(w * 0.5, h * 0.62)
    ctx.lineTo(w * 0.42, h * 0.5)
    ctx.lineTo(w * 0.45, h * 0.44)
    ctx.lineTo(w * 0.5, h * 0.49)
    ctx.lineTo(w * 0.55, h * 0.44)
    ctx.lineTo(w * 0.58, h * 0.5)
    ctx.closePath()
    ctx.fill()
    ctx.fillStyle = '#c8452f'
    ctx.fillRect(w * 0.455, h * 0.52, 12, 4)
    ctx.fillRect(w * 0.525, h * 0.52, 12, 4)
  },
  // 비 + 빛줄기 + 옥상 도리이 (날씨 판타지)
  rooftop: (ctx, w, h) => {
    sky(ctx, w, h, '#4a5a6e', '#9fc3e0')
    ctx.fillStyle = 'rgba(255,240,180,0.45)'
    ctx.beginPath()
    ctx.moveTo(w * 0.55, 0)
    ctx.lineTo(w * 0.95, 0)
    ctx.lineTo(w * 0.6, h * 0.7)
    ctx.lineTo(w * 0.4, h * 0.7)
    ctx.fill()
    rect(ctx, '#7d8086', w * 0.15, h * 0.55, w * 0.7, h * 0.45)
    for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) rect(ctx, '#3a3f44', w * 0.2 + c * w * 0.16, h * 0.62 + r * h * 0.09, w * 0.1, h * 0.05)
    torii(ctx, w / 2, h * 0.55, w * 0.25, h * 0.14)
    ctx.strokeStyle = 'rgba(220,235,255,0.6)'
    ctx.lineWidth = 2
    for (let i = 0; i < 60; i++) {
      const x = (i * 97) % w
      const y = (i * 53) % (h * 0.55)
      ctx.beginPath()
      ctx.moveTo(x, y)
      ctx.lineTo(x - 6, y + 24)
      ctx.stroke()
    }
  },
  // 노을 언덕길 + 초록 지붕 골동품 가게 (청춘 성장물)
  antique: (ctx, w, h) => {
    sky(ctx, w, h, '#f6b56b', '#fde6c4', 0.6)
    ctx.fillStyle = '#7fae6a'
    ctx.beginPath()
    ctx.moveTo(0, h * 0.75)
    ctx.quadraticCurveTo(w * 0.5, h * 0.45, w, h * 0.62)
    ctx.lineTo(w, h)
    ctx.lineTo(0, h)
    ctx.fill()
    rect(ctx, '#8a5a3b', w * 0.42, h * 0.43, w * 0.22, h * 0.14)
    ctx.fillStyle = '#3f6f5a'
    ctx.beginPath()
    ctx.moveTo(w * 0.39, h * 0.43)
    ctx.lineTo(w * 0.53, h * 0.3)
    ctx.lineTo(w * 0.67, h * 0.43)
    ctx.fill()
    ctx.fillStyle = '#f3d9a4'
    ctx.beginPath()
    ctx.arc(w * 0.53, h * 0.38, 9, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#2b2b2b' // 고양이 실루엣
    ctx.beginPath()
    ctx.ellipse(w * 0.25, h * 0.8, 26, 16, 0, 0, Math.PI * 2)
    ctx.arc(w * 0.19, h * 0.75, 12, 0, Math.PI * 2)
    ctx.fill()
  },
  // 벚꽃 + 건널목 (잔잔한 로맨스)
  sakura: (ctx, w, h) => {
    sky(ctx, w, h, '#a9c9ec', '#f6e3ea')
    rect(ctx, '#8d8478', 0, h * 0.72, w, h * 0.1)
    rect(ctx, '#5b5f66', 0, h * 0.74, w, 5)
    rect(ctx, '#5b5f66', 0, h * 0.79, w, 5)
    crossingGate(ctx, w * 0.7, h * 0.72, h * 0.24)
    ctx.fillStyle = 'rgba(246,182,200,0.9)'
    for (let i = 0; i < 80; i++) {
      ctx.beginPath()
      ctx.ellipse((i * 137) % w, (i * 71) % (h * 0.95), 5, 3, i, 0, Math.PI * 2)
      ctx.fill()
    }
  },
  // 축제 제등 + 목조 거리 (미스터리 학원물)
  oldtown: (ctx, w, h) => {
    sky(ctx, w, h, '#1d2547', '#4b3a6b', 0.5)
    for (let i = 0; i < 4; i++) {
      rect(ctx, '#4a3424', i * (w / 4), h * 0.4, w / 4 - 6, h * 0.4)
      rect(ctx, '#33373d', i * (w / 4) - 8, h * 0.36, w / 4 + 10, 26)
    }
    rect(ctx, '#9a958c', 0, h * 0.8, w, h * 0.2)
    ctx.strokeStyle = '#222'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(0, h * 0.2)
    ctx.quadraticCurveTo(w / 2, h * 0.3, w, h * 0.2)
    ctx.stroke()
    for (let i = 0; i < 7; i++) {
      const x = (w / 7) * (i + 0.5)
      ctx.fillStyle = '#ff6b3d'
      ctx.beginPath()
      ctx.ellipse(x, h * 0.25 + Math.sin((i / 6) * Math.PI) * h * 0.05, 14, 20, 0, 0, Math.PI * 2)
      ctx.fill()
    }
  },
  // 여름 하늘 + 숲속 오두막 + 꽃 (우정 드라마)
  hut: (ctx, w, h) => {
    sky(ctx, w, h, '#4fa3e8', '#e3f4ff', 0.6)
    ctx.fillStyle = '#ffffff'
    ctx.beginPath()
    ctx.arc(w * 0.3, h * 0.18, 40, 0, Math.PI * 2)
    ctx.arc(w * 0.4, h * 0.15, 50, 0, Math.PI * 2)
    ctx.arc(w * 0.5, h * 0.19, 36, 0, Math.PI * 2)
    ctx.fill()
    rect(ctx, '#5f9a48', 0, h * 0.6, w, h * 0.4)
    rect(ctx, '#8b6b47', w * 0.35, h * 0.48, w * 0.3, h * 0.16)
    ctx.fillStyle = '#6b5a4a'
    ctx.beginPath()
    ctx.moveTo(w * 0.31, h * 0.49)
    ctx.lineTo(w * 0.69, h * 0.45)
    ctx.lineTo(w * 0.69, h * 0.48)
    ctx.lineTo(w * 0.31, h * 0.52)
    ctx.fill()
    ctx.fillStyle = '#ffffff'
    for (let i = 0; i < 30; i++) {
      ctx.beginPath()
      ctx.arc((i * 61) % w, h * 0.7 + ((i * 37) % (h * 0.28)), 6, 0, Math.PI * 2)
      ctx.fill()
    }
  },
  // 비 오는 숲 + 시골 버스 정류장 (가족 판타지)
  busstop: (ctx, w, h) => {
    sky(ctx, w, h, '#33503a', '#7fa088')
    for (let i = 0; i < 6; i++) {
      ctx.fillStyle = i % 2 ? '#2a4a30' : '#3d6b44'
      ctx.beginPath()
      ctx.arc((w / 5) * i, h * 0.3, 90, 0, Math.PI * 2)
      ctx.fill()
    }
    rect(ctx, '#6b6b6b', 0, h * 0.78, w, h * 0.22)
    rect(ctx, '#9ca3af', w * 0.62, h * 0.45, 6, h * 0.34)
    ctx.fillStyle = '#1d4ed8'
    ctx.beginPath()
    ctx.arc(w * 0.62 + 3, h * 0.45, 26, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = 'rgba(220,235,255,0.55)'
    ctx.lineWidth = 2
    for (let i = 0; i < 70; i++) {
      const x = (i * 89) % w
      const y = (i * 41) % h
      ctx.beginPath()
      ctx.moveTo(x, y)
      ctx.lineTo(x - 4, y + 20)
      ctx.stroke()
    }
  },
  // 호수 + 산 + 호숫가 도리이 (판타지 로맨스)
  lake: (ctx, w, h) => {
    sky(ctx, w, h, '#f29b6b', '#ffd9b0', 0.5)
    ctx.fillStyle = '#5a6f8f'
    ctx.beginPath()
    ctx.moveTo(0, h * 0.5)
    ctx.lineTo(w * 0.3, h * 0.3)
    ctx.lineTo(w * 0.6, h * 0.45)
    ctx.lineTo(w * 0.85, h * 0.28)
    ctx.lineTo(w, h * 0.4)
    ctx.lineTo(w, h * 0.5)
    ctx.fill()
    ctx.fillStyle = '#4f8fc0'
    ctx.beginPath()
    ctx.ellipse(w / 2, h * 0.62, w * 0.42, h * 0.12, 0, 0, Math.PI * 2)
    ctx.fill()
    rect(ctx, '#7fae6a', 0, h * 0.74, w, h * 0.26)
    torii(ctx, w * 0.22, h * 0.8, w * 0.2, h * 0.14)
    ctx.strokeStyle = 'rgba(255,255,255,0.9)'
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.moveTo(w * 0.9, h * 0.04)
    ctx.lineTo(w * 0.55, h * 0.22)
    ctx.stroke()
  },
}

// 테마별 실루엣 배치 (특정 캐릭터가 아니라 장면 속 "사람"만)
const POSTER_PEOPLE = {
  crossing: (ctx, w, h) => {
    person(ctx, w * 0.5, h * 0.98, 1.9, 'rgba(20,30,50,0.9)', 'reach') // 공을 향해 손을 뻗는 학생
    person(ctx, w * 0.82, h * 0.96, 1.2, 'rgba(20,30,50,0.6)')
  },
  stairs: (ctx, w, h) => {
    person(ctx, w * 0.36, h * 0.62, 1.1, 'rgba(30,20,40,0.9)', 'reach') // 계단 위
    person(ctx, w * 0.62, h * 0.99, 1.5, 'rgba(30,20,40,0.9)', 'reach') // 계단 아래, 서로 돌아봄
  },
  shrine: (ctx, w, h) => person(ctx, w * 0.3, h * 0.99, 1.5, 'rgba(25,35,25,0.85)'),
  rooftop: (ctx, w, h) => person(ctx, w * 0.5, h * 0.555, 0.6, 'rgba(20,25,40,0.95)', 'pray'), // 옥상 도리이 앞에서 기도
  antique: (ctx, w, h) => person(ctx, w * 0.4, h * 0.97, 1.4, 'rgba(60,30,20,0.85)'),
  sakura: (ctx, w, h) => {
    person(ctx, w * 0.25, h * 0.98, 1.5, 'rgba(40,30,50,0.85)') // 건널목 이쪽
    person(ctx, w * 0.88, h * 0.7, 0.9, 'rgba(40,30,50,0.55)') // 건널목 저쪽
  },
  oldtown: (ctx, w, h) => [0.2, 0.4, 0.6, 0.8].forEach((t, i) => person(ctx, w * t, h * 0.99, 1.15 + (i % 2) * 0.12, 'rgba(15,15,25,0.9)')),
  hut: (ctx, w, h) => [0.2, 0.36, 0.64, 0.8].forEach((t, i) => person(ctx, w * t, h * 0.97, 0.8 + (i % 2) * 0.15, 'rgba(30,50,30,0.85)')),
  busstop: (ctx, w, h) => person(ctx, w * 0.3, h * 0.95, 1.2, 'rgba(20,30,20,0.9)', 'umbrella'), // 우산을 들고 서 있음
  lake: (ctx, w, h) => {
    person(ctx, w * 0.6, h * 0.95, 1.2, 'rgba(40,30,30,0.85)')
    person(ctx, w * 0.72, h * 0.95, 1.1, 'rgba(40,30,30,0.85)')
  },
}

function getPosterTexture(poster) {
  const { theme = 'shrine', title = '', subtitle = '' } = poster ?? {}
  return canvasTexture(`poster:${theme}:${title}:${subtitle}`, 512, 768, (ctx, w, h) => {
    const artH = h * 0.78
    ctx.save()
    ctx.beginPath()
    ctx.rect(0, 0, w, artH)
    ctx.clip()
    ;(POSTER_ART[theme] ?? POSTER_ART.shrine)(ctx, w, artH)
    POSTER_PEOPLE[theme]?.(ctx, w, artH)
    ctx.restore()
    // 아래 제목 띠
    rect(ctx, '#fbf7ee', 0, artH, w, h - artH)
    ctx.fillStyle = '#1f1f1f'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    fitText(ctx, title, w - 40, 56, 'normal', KR_FONT)
    ctx.fillText(title, w / 2, artH + (h - artH) * 0.38)
    ctx.fillStyle = '#6b5a48'
    fitText(ctx, subtitle, w - 40, 30, 'normal', KR_FONT)
    ctx.fillText(subtitle, w / 2, artH + (h - artH) * 0.76)
    // 테두리
    ctx.strokeStyle = '#3a2a20'
    ctx.lineWidth = 10
    ctx.strokeRect(5, 5, w - 10, h - 10)
  })
}

// ── 성지 안내판 (포스터 + 다리 두 개) ────────────
// item.poster = { theme, title, subtitle }. theme: crossing | stairs | shrine | rooftop | antique | sakura | oldtown | hut | busstop | lake
// size 예: [1.6, 2.8, 0.3]  (판 높이는 가로의 1.5배)
export function JmPosterBoard({ item }) {
  const [w, h] = item.size
  const boardW = w
  const boardH = Math.min(h - 0.6, w * 1.5)
  const boardY = h - boardH / 2
  const texture = getPosterTexture(item.poster)
  return (
    <group>
      {[-1, 1].map((side) => (
        <mesh key={side} position={[(side * (boardW - 0.1)) / 2, (h - boardH) / 2 + 0.05, 0]}>
          <boxGeometry args={[0.1, h - boardH + 0.1, 0.1]} />
          <meshStandardMaterial color="#4a3424" />
        </mesh>
      ))}
      <mesh position={[0, boardY, 0]}>
        <boxGeometry args={[boardW + 0.12, boardH + 0.12, 0.08]} />
        <meshStandardMaterial color="#4a3424" />
      </mesh>
      {[1, -1].map((side) => (
        <mesh key={side} position={[0, boardY, side * 0.045]} rotation={[0, side === 1 ? 0 : Math.PI, 0]}>
          <planeGeometry args={[boardW, boardH]} />
          <GlowMaterial map={texture} glow={0.75} />
        </mesh>
      ))}
      {/* 작은 지붕 */}
      <mesh position={[0, h + 0.08, 0]}>
        <boxGeometry args={[boardW + 0.4, 0.12, 0.5]} />
        <meshStandardMaterial color="#33373d" />
      </mesh>
    </group>
  )
}

// ── 논 (계절: 봄 물 댄 논 / 여름 초록 / 가을 황금 / 겨울 눈) ──
// size [가로, 0.05, 깊이]. JSON에 "collider": false
const PADDY = { spring: '#7fa9c9', summer: '#5f9a3e', autumn: '#d8b24a', winter: '#eef2f6' }
export function JmPaddy({ item }) {
  const season = useSeason()
  const [w, , d] = item.size
  const rows = Math.max(2, Math.round(d / 0.9))
  return (
    <group>
      <mesh position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[w, d]} />
        <meshStandardMaterial color={PADDY[season]} />
      </mesh>
      {/* 논두렁 */}
      {[-1, 1].map((side) => (
        <mesh key={side} position={[0, 0.08, (side * d) / 2]}>
          <boxGeometry args={[w + 0.4, 0.16, 0.4]} />
          <meshStandardMaterial color="#8b7355" />
        </mesh>
      ))}
      {season !== 'winter' &&
        range(rows).map((i) => (
          <mesh key={i} position={[0, 0.12, -d / 2 + (d * (i + 0.5)) / rows]}>
            <boxGeometry args={[w - 0.6, 0.18, 0.12]} />
            <meshStandardMaterial color={season === 'autumn' ? '#c99a2e' : season === 'spring' ? '#9ccb6a' : '#4e8a33'} />
          </mesh>
        ))}
    </group>
  )
}

// ── 큰 녹나무 (상록수, 겨울엔 눈만 살짝) ─────────
// size 예: [9, 14, 9]. JSON에 "collider": [1.2, 5, 1.2] 권장
export function JmBigTree({ item }) {
  const season = useSeason()
  const [w, h] = item.size
  const r = w / 2
  const trunkH = h * 0.42
  const leaf = ['#2f6b34', '#3b7d3f', '#28592c']
  const blobs = [
    [0, 0.2, 0, 1],
    [0.6, 0, 0.2, 0.75],
    [-0.6, 0.05, -0.15, 0.8],
    [0.1, 0.1, 0.6, 0.7],
    [-0.15, 0.15, -0.6, 0.72],
    [0, 0.65, 0, 0.7],
  ]
  return (
    <group>
      {/* 줄기는 잎 덩어리 안쪽까지 + 굵은 가지 3개 (줄기와 잎이 떨어져 보이지 않게) */}
      <mesh position={[0, (trunkH + r * 0.5) / 2, 0]}>
        <cylinderGeometry args={[r * 0.12, r * 0.2, trunkH + r * 0.5, 9]} />
        <meshStandardMaterial color="#5a4234" />
      </mesh>
      {/* 금줄 (신목 표시) */}
      <mesh position={[0, trunkH * 0.45, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[r * 0.2, 0.08, 6, 20]} />
        <meshStandardMaterial color="#d9c48f" />
      </mesh>
      {[0, 2.1, 4.2].map((a) => (
        <mesh key={a} position={[Math.sin(a) * r * 0.25, trunkH + r * 0.2, Math.cos(a) * r * 0.25]} rotation={[Math.cos(a) * 0.9, 0, -Math.sin(a) * 0.9]}>
          <cylinderGeometry args={[r * 0.05, r * 0.08, r * 0.7, 6]} />
          <meshStandardMaterial color="#5a4234" />
        </mesh>
      ))}
      {blobs.map(([x, y, z, s], i) => (
        <mesh key={i} position={[x * r, trunkH + r * 0.35 + y * r, z * r]}>
          <icosahedronGeometry args={[s * r * 0.7, 1]} />
          <meshStandardMaterial color={season === 'winter' && i === 5 ? '#eef2f6' : leaf[i % leaf.length]} flatShading />
        </mesh>
      ))}
    </group>
  )
}

// ── 시골 농가 (큰 초가풍 지붕) ──────────────────
export function JmFarmhouse({ item }) {
  const season = useSeason()
  const [w, h, d] = item.size
  const wallH = h * 0.42
  const roofH = h - wallH
  const roof = useMemo(() => hipRoofGeometry(w + 1.6, d + 1.6, roofH, 0.1), [w, d, roofH])
  const roofColor = season === 'winter' ? '#e9edf2' : '#9c8456'
  return (
    <group>
      <mesh position={[0, wallH / 2, 0]}>
        <boxGeometry args={[w, wallH, d]} />
        <meshStandardMaterial color="#6e4b33" />
      </mesh>
      <mesh position={[0, wallH * 0.45, d / 2 + 0.02]}>
        <planeGeometry args={[w * 0.6, wallH * 0.7]} />
        <meshStandardMaterial color="#f1e6cf" />
      </mesh>
      {range(5).map((i) => (
        <mesh key={i} position={[-w * 0.3 + (w * 0.6 * i) / 4, wallH * 0.45, d / 2 + 0.04]}>
          <boxGeometry args={[0.06, wallH * 0.7, 0.04]} />
          <meshStandardMaterial color="#4a3424" />
        </mesh>
      ))}
      <mesh geometry={roof} position={[0, wallH - 0.05, 0]}>
        <meshStandardMaterial color={roofColor} flatShading side={THREE.DoubleSide} />
      </mesh>
      {/* 툇마루(엔가와) + 디딤돌 + 미닫이 창호 */}
      <mesh position={[0, 0.45, d / 2 + 0.6]}>
        <boxGeometry args={[w * 0.9, 0.12, 1.1]} />
        <meshStandardMaterial color="#8b6b47" />
      </mesh>
      {[-1, 0, 1].map((i) => (
        <mesh key={i} position={[i * w * 0.42, 0.2, d / 2 + 1.05]}>
          <boxGeometry args={[0.12, 0.4, 0.12]} />
          <meshStandardMaterial color="#4a3424" />
        </mesh>
      ))}
      <mesh position={[0, 0.12, d / 2 + 1.5]}>
        <boxGeometry args={[1, 0.24, 0.6]} />
        <meshStandardMaterial color="#9a958c" />
      </mesh>
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * w * 0.33, wallH * 0.45, d / 2 + 0.02]}>
          <planeGeometry args={[w * 0.18, wallH * 0.65]} />
          <meshStandardMaterial color="#f1e6cf" />
        </mesh>
      ))}
    </group>
  )
}

// ── 농구 골대 ──────────────────────────────────
// 앞면(+z)이 코트 쪽. size 예: [1.8, 3.6, 1.2]
export function JmHoop({ item }) {
  const [, h] = item.size
  const rimY = Math.min(3.05, h - 0.5)
  return (
    <group>
      <mesh position={[0, rimY / 2 + 0.2, -0.5]}>
        <cylinderGeometry args={[0.08, 0.1, rimY + 0.4, 8]} />
        <meshStandardMaterial color="#3d4a5c" />
      </mesh>
      <mesh position={[0, rimY + 0.4, -0.25]}>
        <boxGeometry args={[1.8, 1.05, 0.05]} />
        <meshStandardMaterial color="#f5f5f5" />
      </mesh>
      <mesh position={[0, rimY + 0.25, -0.22]}>
        <boxGeometry args={[0.6, 0.45, 0.02]} />
        <meshStandardMaterial color="#d63a3a" />
      </mesh>
      <mesh position={[0, rimY, 0.05]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.23, 0.02, 6, 20]} />
        <meshStandardMaterial color="#e8792a" />
      </mesh>
      {/* 슛 체험 (jm_activities.jsx) — 림 위치를 넘겨줌 */}
      <HoopShoot item={item} rimY={rimY} />
    </group>
  )
}

// ── 학교 정문 (문기둥 두 개 + 학교 이름판) ─────────
// item.signs[0].text = 학교 이름. size 예: [6, 2.4, 0.6]. JSON에 "collider": false (가운데로 지나감)
export function JmSchoolGate({ item }) {
  const [w, h] = item.size
  const name = item.signs?.[0]?.text ?? '高校'
  return (
    <group>
      {[-1, 1].map((side) => (
        <mesh key={side} position={[(side * (w - 0.7)) / 2, h / 2, 0]}>
          <boxGeometry args={[0.7, h, 0.7]} />
          <meshStandardMaterial color="#b9b4a8" />
        </mesh>
      ))}
      <mesh position={[-(w - 0.7) / 2, h * 0.6, 0.37]}>
        <planeGeometry args={[0.45, h * 0.7]} />
        <GlowMaterial map={getJpVerticalTexture(name, '#f7f3ea', '#1f1f1f', 0.45 / (h * 0.7))} />
      </mesh>
    </group>
  )
}

// ── 역 이름판 (두 다리 + 흰 판, 일본 역 스타일) ────────
// item.signs[0].text = 역 이름. size 예: [2.4, 2.2, 0.2]
export function JmStationSign({ item }) {
  const [w, h] = item.size
  const name = item.signs?.[0]?.text ?? '駅'
  return (
    <group>
      {[-1, 1].map((side) => (
        <mesh key={side} position={[(side * (w - 0.2)) / 2, h / 2, 0]}>
          <cylinderGeometry args={[0.04, 0.04, h, 6]} />
          <meshStandardMaterial color="#6b7280" />
        </mesh>
      ))}
      {[1, -1].map((side) => (
        <mesh key={side} position={[0, h - 0.35, side * 0.03]} rotation={[0, side === 1 ? 0 : Math.PI, 0]}>
          <planeGeometry args={[w, 0.6]} />
          <GlowMaterial map={getJpSignTexture(name, '#ffffff', '#1f2937', w / 0.6)} />
        </mesh>
      ))}
    </group>
  )
}

// ── 축제 수레 (다카야마 야타이 느낌) ────────────────
// size 예: [3, 5, 4.5]. 앞면(+z)
export function JmFloat({ item }) {
  const [w, h, d] = item.size
  const roof = useMemo(() => hipRoofGeometry(w + 0.6, d + 0.6, 0.9, 0.35), [w, d])
  return (
    <group>
      {/* 바퀴 */}
      {[-1, 1].map((sx) =>
        [-1, 1].map((sz) => (
          <mesh key={`${sx}${sz}`} position={[(sx * w) / 2, 0.5, (sz * d) / 3]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.5, 0.5, 0.2, 14]} />
            <meshStandardMaterial color="#2b2118" />
          </mesh>
        )),
      )}
      {/* 몸통 1단 (붉은 칠) + 2단 (금색 장식) */}
      <mesh position={[0, 1.4, 0]}>
        <boxGeometry args={[w - 0.2, 1.4, d - 0.4]} />
        <meshStandardMaterial color="#9b2226" />
      </mesh>
      <mesh position={[0, 2.5, 0]}>
        <boxGeometry args={[w - 0.6, 0.8, d - 1]} />
        <meshStandardMaterial color="#d4a52c" metalness={0.4} roughness={0.4} />
      </mesh>
      {/* 기둥 4개 + 지붕 */}
      {[-1, 1].map((sx) =>
        [-1, 1].map((sz) => (
          <mesh key={`p${sx}${sz}`} position={[(sx * (w - 0.8)) / 2, 2.9 + (h - 3.8) / 2, (sz * (d - 1.2)) / 2]}>
            <cylinderGeometry args={[0.06, 0.06, h - 3.8 + 0.4, 6]} />
            <meshStandardMaterial color="#1f1f1f" />
          </mesh>
        )),
      )}
      <mesh geometry={roof} position={[0, h - 0.9, 0]}>
        <meshStandardMaterial color="#26292e" flatShading side={THREE.DoubleSide} />
      </mesh>
      {/* 앞 술 장식 */}
      <mesh position={[0, 2.1, d / 2 - 0.15]}>
        <planeGeometry args={[w * 0.5, 0.5]} />
        <meshStandardMaterial color="#ffffff" side={THREE.DoubleSide} />
      </mesh>
    </group>
  )
}

// ── 여우 석상 (신사 앞 한 쌍) ──────────────────────
// size 예: [0.9, 1.8, 0.9]. item.mirror = true 면 좌우 반전 (반대쪽 석상)
export function JmFox({ item }) {
  const [w, h] = item.size
  const s = w / 0.9
  const flip = item.mirror ? -1 : 1
  const stone = '#c7c1b5'
  return (
    <group scale={[flip, 1, 1]}>
      <mesh position={[0, 0.35 * s, 0]}>
        <boxGeometry args={[w, 0.7 * s, w]} />
        <meshStandardMaterial color="#9a958c" />
      </mesh>
      {/* 앉은 몸 */}
      <mesh position={[0, 0.7 * s + 0.4 * s, 0]}>
        <cylinderGeometry args={[0.18 * s, 0.28 * s, 0.8 * s, 8]} />
        <meshStandardMaterial color={stone} />
      </mesh>
      {/* 머리 + 주둥이 + 귀 */}
      <mesh position={[0, h - 0.35 * s, 0.05 * s]}>
        <sphereGeometry args={[0.17 * s, 10, 8]} />
        <meshStandardMaterial color={stone} />
      </mesh>
      <mesh position={[0, h - 0.4 * s, 0.22 * s]} rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.08 * s, 0.22 * s, 6]} />
        <meshStandardMaterial color={stone} />
      </mesh>
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * 0.09 * s, h - 0.12 * s, 0]}>
          <coneGeometry args={[0.05 * s, 0.18 * s, 4]} />
          <meshStandardMaterial color={stone} />
        </mesh>
      ))}
      {/* 붉은 턱받이 */}
      <mesh position={[0, h - 0.6 * s, 0.12 * s]} rotation={[0.3, 0, 0]}>
        <coneGeometry args={[0.2 * s, 0.2 * s, 3]} />
        <meshStandardMaterial color="#c8452f" />
      </mesh>
      {/* 꼬리 */}
      <mesh position={[0.18 * s, 0.7 * s + 0.5 * s, -0.18 * s]} rotation={[0.4, 0, -0.5]}>
        <coneGeometry args={[0.1 * s, 0.6 * s, 6]} />
        <meshStandardMaterial color={stone} />
      </mesh>
    </group>
  )
}

// ── 작은 나무다리 (개울 위) ─────────────────────────
// size 예: [2, 0.25, 4]. 걸어서 건널 수 있게 낮게
export function JmBridge({ item }) {
  const [w, h, d] = item.size
  return (
    <group>
      <mesh position={[0, h / 2, 0]}>
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial color="#8b6b47" />
      </mesh>
      {[-1, 1].map((side) => (
        <mesh key={side} position={[(side * (w - 0.08)) / 2, h + 0.4, 0]}>
          <boxGeometry args={[0.08, 0.08, d]} />
          <meshStandardMaterial color="#5e4630" />
        </mesh>
      ))}
      {[-1, 1].map((sx) =>
        [-1, 0, 1].map((sz) => (
          <mesh key={`${sx}${sz}`} position={[(sx * (w - 0.08)) / 2, h + 0.2, (sz * (d - 0.2)) / 2]}>
            <boxGeometry args={[0.08, 0.45, 0.08]} />
            <meshStandardMaterial color="#5e4630" />
          </mesh>
        )),
      )}
    </group>
  )
}

// ── 물웅덩이 (비 오는 골목) ─────────────────────────
// size [가로, 0.02, 깊이]. JSON에 "collider": false
export function JmPuddle({ item }) {
  const [w, , d] = item.size
  return (
    <mesh position={[0, 0.04, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={[w / 2, d / 2, 1]}>
      <circleGeometry args={[1, 18]} />
      <meshStandardMaterial color="#8fb3cf" metalness={0.6} roughness={0.1} />
    </mesh>
  )
}

// ── 이자카야 붉은 등 (가게 앞 큰 제등 한 개) ─────────
// item.signs[0].text = 등에 세로로 쓰인 글씨
export function JmAkachochin({ item }) {
  const [, h] = item.size
  const text = item.signs?.[0]?.text ?? '酒'
  return (
    <group>
      <mesh position={[0, h / 2, 0]}>
        <cylinderGeometry args={[0.04, 0.04, h, 6]} />
        <meshStandardMaterial color="#3a2a20" />
      </mesh>
      <mesh position={[0, h - 0.7, 0.3]}>
        <cylinderGeometry args={[0.32, 0.32, 0.8, 16]} />
        <meshStandardMaterial color="#d93a2b" emissive="#ff5a33" emissiveIntensity={0.6} />
      </mesh>
      <mesh position={[0, h - 0.7, 0.63]}>
        <planeGeometry args={[0.3, 0.62]} />
        <GlowMaterial map={getJpVerticalTexture(text, '#d93a2b', '#111111', 0.3 / 0.62, null)} />
      </mesh>
    </group>
  )
}

export const JM_LANDMARK_STYLES = {
  jmAkachochin: JmAkachochin,
  jmPosterBoard: JmPosterBoard,
  jmPaddy: JmPaddy,
  jmBigTree: JmBigTree,
  jmFarmhouse: JmFarmhouse,
  jmHoop: JmHoop,
  jmSchoolGate: JmSchoolGate,
  jmStationSign: JmStationSign,
  jmFloat: JmFloat,
  jmFox: JmFox,
  jmBridge: JmBridge,
  jmPuddle: JmPuddle,
}
