import * as THREE from 'three'

// [3. 개발 > 기초개발/서비스] 혜진(HJ) 영화·드라마 구역 전용 텍스처
// 이미지 파일 없이 캔버스로 그려요. 한 번 만든 건 캐시해서 재사용.
// 등장하는 작품·포스터는 모두 가상이에요 (실제 작품·배우·로고 X).

const cache = new Map()
const SERIF = '"Noto Serif KR", "Nanum Myeongjo", "Batang", serif'

function seeded(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function canvasTexture(key, width, height, draw, { repeat = false } = {}) {
  if (cache.has(key)) return cache.get(key)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) return null // 캔버스를 못 쓰는 환경이면 단색으로 표시
  draw(ctx, width, height)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 8
  if (repeat) texture.wrapS = texture.wrapT = THREE.RepeatWrapping
  cache.set(key, texture)
  return texture
}

// 붉은 벽돌 (반장 엇갈림, 낡은 얼룩). 한 장 = 가로 1m × 세로 1m
export function getRedBrickTexture() {
  return canvasTexture(
    'hj-red-brick',
    256,
    256,
    (ctx, w, h) => {
      const rand = seeded(42)
      ctx.fillStyle = '#d9cbb8' // 줄눈
      ctx.fillRect(0, 0, w, h)
      const rows = 14
      const bh = h / rows
      const bw = w / 4
      for (let r = 0; r < rows; r += 1) {
        const offset = r % 2 ? bw / 2 : 0
        for (let c = -1; c < 5; c += 1) {
          const base = new THREE.Color('#a94a35').offsetHSL((rand() - 0.5) * 0.02, 0, (rand() - 0.5) * 0.12)
          ctx.fillStyle = `#${base.getHexString()}`
          ctx.fillRect(c * bw + offset + 2, r * bh + 2, bw - 4, bh - 3)
        }
      }
      // 세월 얼룩
      for (let i = 0; i < 30; i += 1) {
        ctx.fillStyle = `rgba(60, 30, 20, ${0.04 + rand() * 0.06})`
        ctx.beginPath()
        ctx.arc(rand() * w, rand() * h, 6 + rand() * 18, 0, Math.PI * 2)
        ctx.fill()
      }
    },
    { repeat: true },
  )
}

// 가상 영화 포스터 「여름의 기억」 (정류장 뒷벽)
export function getSummerPosterTexture() {
  return canvasTexture('hj-poster-summer', 512, 720, (ctx, w, h) => {
    const sky = ctx.createLinearGradient(0, 0, 0, h)
    sky.addColorStop(0, '#8fd3e8')
    sky.addColorStop(0.55, '#fde7c4')
    sky.addColorStop(1, '#f2b48c')
    ctx.fillStyle = sky
    ctx.fillRect(0, 0, w, h)

    // 해
    const sun = ctx.createRadialGradient(w * 0.7, h * 0.32, 10, w * 0.7, h * 0.32, 120)
    sun.addColorStop(0, 'rgba(255, 246, 214, 1)')
    sun.addColorStop(1, 'rgba(255, 246, 214, 0)')
    ctx.fillStyle = sun
    ctx.fillRect(0, 0, w, h)

    // 언덕 + 정류장 실루엣
    ctx.fillStyle = '#7fae8a'
    ctx.beginPath()
    ctx.moveTo(0, h * 0.72)
    ctx.quadraticCurveTo(w * 0.4, h * 0.62, w, h * 0.7)
    ctx.lineTo(w, h)
    ctx.lineTo(0, h)
    ctx.fill()
    ctx.fillStyle = '#3f5a4e'
    ctx.fillRect(w * 0.18, h * 0.58, 8, h * 0.14) // 기둥
    ctx.fillRect(w * 0.42, h * 0.58, 8, h * 0.14)
    ctx.fillRect(w * 0.15, h * 0.56, w * 0.32, 10) // 지붕

    // 우산을 같이 쓴 두 사람 실루엣
    ctx.fillStyle = '#2c2a29'
    ;[0.62, 0.72].forEach((x) => {
      ctx.beginPath()
      ctx.arc(w * x, h * 0.6, 14, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillRect(w * x - 12, h * 0.62, 24, 70)
    })
    ctx.fillStyle = '#c86d51'
    ctx.beginPath()
    ctx.arc(w * 0.67, h * 0.585, 70, Math.PI, 0)
    ctx.fill()

    // 제목 (명조)
    ctx.fillStyle = '#2c2a29'
    ctx.textAlign = 'center'
    ctx.font = `900 64px ${SERIF}`
    ctx.fillText('여름의 기억', w / 2, h * 0.16)
    ctx.font = `500 22px ${SERIF}`
    ctx.fillText('그 정류장에서, 우리는 처음 만났다', w / 2, h * 0.22)
    ctx.font = `600 18px ${SERIF}`
    ctx.fillStyle = '#4a4542'
    ctx.fillText('가상 영화 · SceneWalk 시네마 제작', w / 2, h * 0.94)

    // 종이 테두리
    ctx.strokeStyle = '#fffdf9'
    ctx.lineWidth = 14
    ctx.strokeRect(7, 7, w - 14, h - 14)
  })
}

// 포털 바닥 소용돌이 (가운데가 밝은 나선)
export function getSwirlTexture() {
  return canvasTexture('hj-swirl', 512, 512, (ctx, w, h) => {
    const cx = w / 2
    const cy = h / 2
    const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, w / 2)
    glow.addColorStop(0, 'rgba(255, 236, 196, 0.95)')
    glow.addColorStop(0.45, 'rgba(232, 160, 110, 0.55)')
    glow.addColorStop(1, 'rgba(200, 109, 81, 0)')
    ctx.fillStyle = glow
    ctx.fillRect(0, 0, w, h)
    ctx.strokeStyle = 'rgba(255, 250, 235, 0.7)'
    ctx.lineCap = 'round'
    for (let arm = 0; arm < 4; arm += 1) {
      ctx.lineWidth = 6
      ctx.beginPath()
      for (let t = 0; t < 1; t += 0.01) {
        const angle = arm * (Math.PI / 2) + t * Math.PI * 3
        const r = t * (w / 2 - 20)
        const x = cx + Math.cos(angle) * r
        const y = cy + Math.sin(angle) * r
        if (t === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.stroke()
    }
  })
}

// 빈티지 골목 벽화 "SEOUL 1988" (가상 레트로 그래피티 — 실제 작품 로고 아님)
export function getRetroMuralTexture() {
  return canvasTexture('hj-mural-1988', 512, 640, (ctx, w, h) => {
    ctx.fillStyle = '#d9cdb8'
    ctx.fillRect(0, 0, w, h)
    // 낡은 페인트 얼룩
    const rand = seeded(1988)
    for (let i = 0; i < 40; i += 1) {
      ctx.fillStyle = `rgba(${120 + rand() * 60}, ${100 + rand() * 40}, 90, ${0.08 + rand() * 0.1})`
      ctx.beginPath()
      ctx.arc(rand() * w, rand() * h, 10 + rand() * 40, 0, Math.PI * 2)
      ctx.fill()
    }
    // 노을 원
    const sun = ctx.createLinearGradient(0, h * 0.2, 0, h * 0.6)
    sun.addColorStop(0, '#f6b26b')
    sun.addColorStop(1, '#e06c5a')
    ctx.fillStyle = sun
    ctx.beginPath()
    ctx.arc(w / 2, h * 0.42, w * 0.36, 0, Math.PI * 2)
    ctx.fill()
    // 큰 글씨 (테두리 있는 레트로 문자)
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.lineJoin = 'round'
    const shout = (text, y, size, fill) => {
      ctx.font = `900 ${size}px Impact, "Arial Black", sans-serif`
      ctx.lineWidth = size * 0.16
      ctx.strokeStyle = '#2c2a29'
      ctx.strokeText(text, w / 2, y)
      ctx.fillStyle = fill
      ctx.fillText(text, w / 2, y)
    }
    ctx.save()
    ctx.translate(w / 2, h * 0.42)
    ctx.rotate(-0.12)
    ctx.translate(-w / 2, -h * 0.42)
    shout('SEOUL', h * 0.32, 120, '#fff4e0')
    shout('1988', h * 0.5, 150, '#f2c14e')
    ctx.restore()
    ctx.font = `700 34px ${SERIF}`
    ctx.fillStyle = '#7a2e2e'
    ctx.fillText('VINTAGE ALLEY', w / 2, h * 0.74)
    // 아래쪽 줄무늬 띠
    ;['#2f6b4f', '#f2c14e', '#c86d51'].forEach((c, i) => {
      ctx.fillStyle = c
      ctx.fillRect(0, h * 0.84 + i * 22, w, 16)
    })
  })
}

// A형 입간판 글씨 (세로쓰기, 나무판)
export function getAFrameTexture(text) {
  const lines = String(text).split('\n')
  return canvasTexture(`hj-aframe-${text}`, 256, 384, (ctx, w, h) => {
    const wood = ctx.createLinearGradient(0, 0, w, 0)
    wood.addColorStop(0, '#6b4a33')
    wood.addColorStop(0.5, '#7d5a3e')
    wood.addColorStop(1, '#6b4a33')
    ctx.fillStyle = wood
    ctx.fillRect(0, 0, w, h)
    ctx.strokeStyle = '#4a3324'
    ctx.lineWidth = 12
    ctx.strokeRect(6, 6, w - 12, h - 12)
    ctx.fillStyle = '#f9f1df'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    const size = lines.length > 2 ? 52 : 60
    ctx.font = `900 ${size}px ${SERIF}`
    const total = lines.length * size * 1.25
    lines.forEach((line, i) => ctx.fillText(line, w / 2, h / 2 - total / 2 + size * 0.62 + i * size * 1.25))
  })
}

// 가로로 긴 나무 현판 (입구 게이트용). 위에 작은 부제, 아래 큰 제목
export function getWoodSignTexture(title, subtitle = '') {
  return canvasTexture(`hj-woodsign-${title}-${subtitle}`, 768, 220, (ctx, w, h) => {
    const wood = ctx.createLinearGradient(0, 0, 0, h)
    wood.addColorStop(0, '#8a5f3f')
    wood.addColorStop(0.5, '#a0714c')
    wood.addColorStop(1, '#7a5236')
    ctx.fillStyle = wood
    ctx.fillRect(0, 0, w, h)
    // 나뭇결
    const rand = seeded(5)
    ctx.strokeStyle = 'rgba(60, 35, 20, 0.18)'
    for (let i = 0; i < 14; i += 1) {
      ctx.lineWidth = 1 + rand() * 2
      ctx.beginPath()
      const y = rand() * h
      ctx.moveTo(0, y)
      ctx.bezierCurveTo(w * 0.3, y + 8, w * 0.6, y - 8, w, y + 4)
      ctx.stroke()
    }
    ctx.strokeStyle = '#4a3324'
    ctx.lineWidth = 14
    ctx.strokeRect(7, 7, w - 14, h - 14)
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    if (subtitle) {
      ctx.font = `700 34px ${SERIF}`
      ctx.fillStyle = '#f6d9b8'
      ctx.fillText(subtitle, w / 2, h * 0.3)
    }
    ctx.font = `900 ${subtitle ? 84 : 96}px ${SERIF}`
    ctx.fillStyle = '#fff6e6'
    ctx.shadowColor = 'rgba(0, 0, 0, 0.35)'
    ctx.shadowBlur = 6
    ctx.fillText(title, w / 2, subtitle ? h * 0.64 : h / 2)
  })
}

// 줄무늬 차양
export function getStripeTexture(a, b) {
  return canvasTexture(`hj-stripe-${a}-${b}`, 128, 16, (ctx, w, h) => {
    for (let i = 0; i < 8; i += 1) {
      ctx.fillStyle = i % 2 ? b : a
      ctx.fillRect((i * w) / 8, 0, w / 8, h)
    }
  })
}

// 필름 스트립 (가장자리 구멍 + 프레임 칸)
export function getFilmStripTexture() {
  return canvasTexture(
    'hj-filmstrip',
    512,
    64,
    (ctx, w, h) => {
      ctx.fillStyle = '#1f1b18'
      ctx.fillRect(0, 0, w, h)
      ctx.fillStyle = '#f9f6ee'
      for (let x = 6; x < w; x += 22) {
        ctx.fillRect(x, 5, 11, 8)
        ctx.fillRect(x, h - 13, 11, 8)
      }
      const frames = ['#f2b48c', '#8fd3e8', '#fde7c4', '#c86d51']
      for (let i = 0; i < 4; i += 1) {
        ctx.fillStyle = frames[i]
        ctx.globalAlpha = 0.85
        ctx.fillRect(i * (w / 4) + 8, 18, w / 4 - 16, h - 36)
      }
      ctx.globalAlpha = 1
    },
    { repeat: true },
  )
}

// 세로 간판 / 깃발 (1930년대 거리). 글자를 위에서 아래로 한 줄로 써요. 비율 1 : 4
export function getVerticalSignTexture(text, bg = '#2b2420', fg = '#f3dfb0', border = true) {
  return canvasTexture(`vsign:${text}:${bg}:${fg}:${border}`, 128, 512, (ctx, w, h) => {
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, w, h)
    if (border) {
      ctx.strokeStyle = fg
      ctx.globalAlpha = 0.7
      ctx.lineWidth = 6
      ctx.strokeRect(10, 10, w - 20, h - 20)
      ctx.globalAlpha = 1
    }
    const chars = [...text]
    const size = Math.min(86, Math.floor((h - 50) / Math.max(1, chars.length)))
    ctx.font = `bold ${size}px ${SERIF}`
    ctx.fillStyle = fg
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    const top = (h - size * chars.length) / 2 + size / 2
    chars.forEach((c, i) => ctx.fillText(c, w / 2, top + i * size))
  })
}

// 경성역 중앙홀 천장 스테인드글라스 (가운데 둥근 문양 + 색 유리 칸)
export function getStainedGlassTexture() {
  return canvasTexture('stainedGlass', 512, 256, (ctx, w, h) => {
    const colors = ['#e3b04b', '#c8693a', '#7aa0b8', '#d9c27a', '#9c4a3a', '#6f8f5e', '#f0d9a0']
    const rnd = seeded(19)
    const cell = 32
    for (let y = 0; y < h; y += cell) {
      for (let x = 0; x < w; x += cell) {
        ctx.fillStyle = colors[Math.floor(rnd() * colors.length)]
        ctx.fillRect(x, y, cell, cell)
      }
    }
    ctx.strokeStyle = '#2a2420'
    ctx.lineWidth = 4
    for (let x = 0; x <= w; x += cell) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke() }
    for (let y = 0; y <= h; y += cell) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke() }
    // 가운데 원 문양
    ctx.lineWidth = 8
    for (const r of [96, 64, 30]) {
      ctx.fillStyle = r === 96 ? '#f3dfa0' : r === 64 ? '#b8433a' : '#3f6f8f'
      ctx.beginPath(); ctx.arc(w / 2, h / 2, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke()
    }
    for (let i = 0; i < 8; i += 1) {
      const a = (i / 8) * Math.PI * 2
      ctx.beginPath(); ctx.moveTo(w / 2 + Math.cos(a) * 30, h / 2 + Math.sin(a) * 30); ctx.lineTo(w / 2 + Math.cos(a) * 96, h / 2 + Math.sin(a) * 96); ctx.stroke()
    }
    ctx.lineWidth = 10
    ctx.strokeRect(5, 5, w - 10, h - 10)
  })
}

// 귀빈실 벽지 (진한 바탕 + 마름모 꽃무늬)
export function getDamaskTexture() {
  return canvasTexture('damask', 256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#5a3a2c'
    ctx.fillRect(0, 0, w, h)
    ctx.fillStyle = '#c9a45e'
    for (let y = 0; y < h; y += 64) {
      for (let x = (y / 64) % 2 ? 32 : 0; x < w + 32; x += 64) {
        ctx.beginPath()
        ctx.moveTo(x, y + 8); ctx.lineTo(x + 14, y + 32); ctx.lineTo(x, y + 56); ctx.lineTo(x - 14, y + 32)
        ctx.closePath(); ctx.fill()
        ctx.beginPath(); ctx.arc(x, y + 32, 5, 0, Math.PI * 2); ctx.fillStyle = '#e6cf8f'; ctx.fill(); ctx.fillStyle = '#c9a45e'
      }
    }
  }, { repeat: true })
}

// 총독부 중앙홀 바닥: 나침반 별 무늬 대리석 (가운데 원 + 8방 별 + 테두리 띠)
export function getCompassFloorTexture() {
  return canvasTexture('compassFloor', 1024, 1024, (ctx, w, h) => {
    ctx.fillStyle = '#cfc8ba'
    ctx.fillRect(0, 0, w, h)
    const c = w / 2
    // 테두리 띠
    ctx.strokeStyle = '#5b5348'
    ctx.lineWidth = 26
    ctx.strokeRect(40, 40, w - 80, h - 80)
    ctx.fillStyle = '#8f8576'
    for (let i = 0; i < 12; i += 1) {
      ctx.fillRect(80 + i * 72, 90, 40, 40)
      ctx.fillRect(80 + i * 72, h - 130, 40, 40)
    }
    // 8방 별
    const star = (r1, r2, n, rot, color) => {
      ctx.beginPath()
      for (let i = 0; i < n * 2; i += 1) {
        const r = i % 2 ? r2 : r1
        const a = rot + (i * Math.PI) / n
        ctx.lineTo(c + Math.cos(a) * r, c + Math.sin(a) * r)
      }
      ctx.closePath()
      ctx.fillStyle = color
      ctx.fill()
    }
    star(440, 120, 4, -Math.PI / 2, '#e7e1d4')
    star(330, 110, 4, -Math.PI / 4, '#a89c88')
    // 가운데 원 문양
    for (const [r, col] of [[150, '#3e3a35'], [120, '#c9b48a'], [92, '#2f4a5a'], [60, '#d8cfbd'], [24, '#8f2a22']]) {
      ctx.beginPath(); ctx.arc(c, c, r, 0, Math.PI * 2); ctx.fillStyle = col; ctx.fill()
    }
    ctx.strokeStyle = '#d8cfbd'
    ctx.lineWidth = 5
    for (let i = 0; i < 16; i += 1) {
      const a = (i / 16) * Math.PI * 2
      ctx.beginPath(); ctx.moveTo(c + Math.cos(a) * 62, c + Math.sin(a) * 62); ctx.lineTo(c + Math.cos(a) * 118, c + Math.sin(a) * 118); ctx.stroke()
    }
  })
}

// 로비 바닥: 대각선 체크 대리석 (밝은 회색 / 어두운 회색). 한 장 = 2칸 × 2칸
export function getCheckerMarbleTexture() {
  return canvasTexture('checkerMarble', 256, 256, (ctx, w, h) => {
    const rnd = seeded(7)
    for (let y = 0; y < 2; y += 1) {
      for (let x = 0; x < 2; x += 1) {
        ctx.fillStyle = (x + y) % 2 ? '#4a4640' : '#cdc7bc'
        ctx.fillRect(x * 128, y * 128, 128, 128)
        ctx.strokeStyle = (x + y) % 2 ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)'
        ctx.lineWidth = 2
        for (let k = 0; k < 4; k += 1) {
          ctx.beginPath()
          ctx.moveTo(x * 128 + rnd() * 128, y * 128)
          ctx.bezierCurveTo(x * 128 + rnd() * 128, y * 128 + 40, x * 128 + rnd() * 128, y * 128 + 90, x * 128 + rnd() * 128, y * 128 + 128)
          ctx.stroke()
        }
      }
    }
  }, { repeat: true })
}

// 벽 대리석 판 (밝은 베이지에 결 무늬). 한 장 = 1.2m 판
export function getMarbleWallTexture() {
  return canvasTexture('marbleWall', 256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#d9d1c4'
    ctx.fillRect(0, 0, w, h)
    const rnd = seeded(11)
    ctx.strokeStyle = 'rgba(120,108,92,0.35)'
    for (let i = 0; i < 26; i += 1) {
      ctx.lineWidth = 1 + rnd() * 2
      const y = rnd() * h
      ctx.beginPath(); ctx.moveTo(0, y); ctx.bezierCurveTo(w * 0.3, y + rnd() * 30 - 15, w * 0.7, y + rnd() * 30 - 15, w, y + rnd() * 20 - 10); ctx.stroke()
    }
    ctx.strokeStyle = 'rgba(80,70,60,0.5)'
    ctx.lineWidth = 3
    ctx.strokeRect(0, 0, w, h)
  }, { repeat: true })
}

// 벽 그림 (가상의 풍경화: 붉은 산 + 꽃 핀 나무) / 벽화 (가상의 하늘·구름·사람 실루엣)
export function getLandscapePaintingTexture(kind = 'mountain') {
  return canvasTexture(`painting:${kind}`, 512, 320, (ctx, w, h) => {
    const rnd = seeded(kind.length * 13)
    if (kind === 'mural') {
      const g = ctx.createLinearGradient(0, 0, 0, h)
      g.addColorStop(0, '#d9cdb2'); g.addColorStop(1, '#a89878')
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h)
      ctx.fillStyle = 'rgba(255,255,255,0.35)'
      for (let i = 0; i < 6; i += 1) { ctx.beginPath(); ctx.ellipse(rnd() * w, rnd() * h * 0.5, 60 + rnd() * 40, 20, 0, 0, Math.PI * 2); ctx.fill() }
      ctx.fillStyle = 'rgba(70,58,44,0.6)'
      for (let i = 0; i < 5; i += 1) { const x = 80 + i * 90; ctx.fillRect(x, h * 0.55, 14, h * 0.35); ctx.beginPath(); ctx.arc(x + 7, h * 0.52, 12, 0, Math.PI * 2); ctx.fill() }
      return
    }
    const g = ctx.createLinearGradient(0, 0, 0, h)
    g.addColorStop(0, '#3a2a35'); g.addColorStop(1, '#6a4030')
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h)
    ctx.fillStyle = '#7a4a2e'
    ctx.beginPath(); ctx.moveTo(0, h * 0.6)
    for (let x = 0; x <= w; x += 32) ctx.lineTo(x, h * (0.28 + rnd() * 0.25))
    ctx.lineTo(w, h); ctx.lineTo(0, h); ctx.closePath(); ctx.fill()
    ctx.fillStyle = '#4e3a2a'; ctx.fillRect(0, h * 0.78, w, h * 0.22)
    ctx.fillStyle = '#3a2a20'; ctx.fillRect(w * 0.42, h * 0.58, 10, h * 0.25)
    ctx.fillStyle = '#e9c4cf'
    for (let i = 0; i < 70; i += 1) { ctx.beginPath(); ctx.arc(w * 0.43 + (rnd() - 0.5) * 120, h * 0.5 + (rnd() - 0.5) * 80, 6 + rnd() * 8, 0, Math.PI * 2); ctx.fill() }
    ctx.strokeStyle = '#b08a3a'; ctx.lineWidth = 14; ctx.strokeRect(7, 7, w - 14, h - 14)
  })
}

// 격자 유리 (사무실 반달 창 · 문 유리)
export function getLatticeGlassTexture() {
  return canvasTexture('latticeGlass', 256, 256, (ctx, w, h) => {
    ctx.fillStyle = 'rgba(220,228,232,0.9)'
    ctx.fillRect(0, 0, w, h)
    ctx.strokeStyle = '#f7f7f4'
    ctx.lineWidth = 5
    for (let i = 0; i <= 8; i += 1) {
      ctx.beginPath(); ctx.moveTo((i * w) / 8, 0); ctx.lineTo((i * w) / 8, h); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(0, (i * h) / 8); ctx.lineTo(w, (i * h) / 8); ctx.stroke()
    }
    ctx.strokeStyle = '#2a211b'; ctx.lineWidth = 12; ctx.strokeRect(0, 0, w, h)
  })
}

// ── 경복궁 전각용 (HjHanok.jsx) ─────────────────────────

// 단청 긴 띠 (창방·평방): 뇌록(초록) 바탕 + 양 끝 머리초(연꽃 겹원) + 가운데 금문. 가로로 반복해서 써요 (1장 = 2m)
export function getDancheongTexture() {
  return canvasTexture('dancheong', 512, 64, (ctx, w, h) => {
    ctx.fillStyle = '#2f6b58'
    ctx.fillRect(0, 0, w, h)
    // 위·아래 휘(띠 줄무늬)
    const bands = ['#f2ecd8', '#c8423a', '#2a4f8a']
    bands.forEach((c, i) => {
      ctx.fillStyle = c
      ctx.fillRect(0, i * 3, w, 3)
      ctx.fillRect(0, h - (i + 1) * 3, w, 3)
    })
    // 머리초: 연꽃 겹원 (양 끝)
    const lotus = (cx) => {
      const rings = [
        [24, '#2a4f8a'],
        [20, '#f2ecd8'],
        [16, '#c8423a'],
        [11, '#f0c040'],
        [6, '#c8423a'],
      ]
      for (const [r, c] of rings) {
        ctx.fillStyle = c
        ctx.beginPath()
        ctx.arc(cx, h / 2, r, 0, Math.PI * 2)
        ctx.fill()
      }
      // 꽃잎
      ctx.fillStyle = '#e8d9b5'
      for (let i = 0; i < 8; i += 1) {
        const a = (i / 8) * Math.PI * 2
        ctx.beginPath()
        ctx.ellipse(cx + Math.cos(a) * 18, h / 2 + Math.sin(a) * 18, 4, 2.2, a, 0, Math.PI * 2)
        ctx.fill()
      }
      // 겹친 휘 줄
      ctx.fillStyle = '#2a4f8a'
      ctx.fillRect(cx + 30, 9, 6, h - 18)
      ctx.fillStyle = '#f2ecd8'
      ctx.fillRect(cx + 38, 9, 3, h - 18)
      ctx.fillStyle = '#c8423a'
      ctx.fillRect(cx + 43, 9, 5, h - 18)
    }
    lotus(36)
    ctx.save()
    ctx.translate(w, 0)
    ctx.scale(-1, 1)
    lotus(36)
    ctx.restore()
    // 가운데 금문 (마름모 연속)
    ctx.strokeStyle = '#d8b25a'
    ctx.lineWidth = 2
    for (let x = 120; x < w - 120; x += 22) {
      ctx.beginPath()
      ctx.moveTo(x, h / 2)
      ctx.lineTo(x + 11, 16)
      ctx.lineTo(x + 22, h / 2)
      ctx.lineTo(x + 11, h - 16)
      ctx.closePath()
      ctx.stroke()
    }
  }, { repeat: true })
}

// 띠살문: 붉은 밤색 살 + 흰 창호지. 세로살이 촘촘하고 위·가운데·아래에 가로살 묶음 (1장 = 문짝 1개)
export function getDoorLatticeTexture() {
  return canvasTexture('doorLattice', 128, 256, (ctx, w, h) => {
    ctx.fillStyle = '#efe6cf'
    ctx.fillRect(0, 0, w, h)
    ctx.fillStyle = '#6e3326'
    for (let x = 10; x < w - 8; x += 9) ctx.fillRect(x, 0, 3, h)
    for (const y0 of [22, 118, 216]) {
      for (let i = 0; i < 4; i += 1) ctx.fillRect(0, y0 + i * 6, w, 3)
    }
    // 문틀
    ctx.fillStyle = '#7b3a2c'
    ctx.fillRect(0, 0, w, 8)
    ctx.fillRect(0, h - 8, w, 8)
    ctx.fillRect(0, 0, 8, h)
    ctx.fillRect(w - 8, 0, 8, h)
    ctx.fillStyle = '#4a2018'
    ctx.fillRect(w - 3, 0, 3, h)
  })
}

// 빗살·완자 교창 (문 위 가로로 긴 채광창)
export function getTransomLatticeTexture() {
  return canvasTexture('transomLattice', 256, 64, (ctx, w, h) => {
    ctx.fillStyle = '#efe6cf'
    ctx.fillRect(0, 0, w, h)
    ctx.strokeStyle = '#6e3326'
    ctx.lineWidth = 3
    for (let x = -h; x < w + h; x += 14) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + h, h); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(x + h, 0); ctx.lineTo(x, h); ctx.stroke()
    }
    ctx.fillStyle = '#7b3a2c'
    ctx.fillRect(0, 0, w, 6); ctx.fillRect(0, h - 6, w, 6)
  }, { repeat: true })
}

// 박석: 근정전 마당의 울퉁불퉁한 넓적 화강암 판석 (1장 = 4m × 4m)
export function getBakseokTexture() {
  return canvasTexture('bakseok', 512, 512, (ctx, w, h) => {
    const rnd = seeded(77)
    ctx.fillStyle = '#8f8b80'
    ctx.fillRect(0, 0, w, h)
    let y = 0
    while (y < h) {
      const rowH = 44 + rnd() * 40
      let x = -rnd() * 60
      while (x < w) {
        const sw = 60 + rnd() * 90
        const tone = 150 + rnd() * 50
        ctx.fillStyle = `rgb(${tone + 8},${tone + 4},${tone - 6})`
        ctx.beginPath()
        const j = () => (rnd() - 0.5) * 8
        ctx.moveTo(x + 3 + j(), y + 3 + j())
        ctx.lineTo(x + sw - 3 + j(), y + 3 + j())
        ctx.lineTo(x + sw - 3 + j(), y + rowH - 3 + j())
        ctx.lineTo(x + 3 + j(), y + rowH - 3 + j())
        ctx.closePath()
        ctx.fill()
        // 돌 결 얼룩
        for (let k = 0; k < 5; k += 1) {
          ctx.fillStyle = `rgba(${rnd() < 0.5 ? '90,85,75' : '230,226,215'},0.18)`
          ctx.beginPath()
          ctx.arc(x + rnd() * sw, y + rnd() * rowH, 3 + rnd() * 9, 0, Math.PI * 2)
          ctx.fill()
        }
        x += sw
      }
      y += rowH
    }
  }, { repeat: true })
}

// 장대석: 기단·월대·축대 옆면의 길쭉한 화강암 켜 (1장 = 3m × 1m)
export function getAshlarTexture() {
  return canvasTexture('ashlar', 512, 128, (ctx, w, h) => {
    const rnd = seeded(31)
    ctx.fillStyle = '#7f7a6e'
    ctx.fillRect(0, 0, w, h)
    const rows = 3
    for (let r = 0; r < rows; r += 1) {
      const y = (r * h) / rows
      let x = r % 2 ? -60 : 0
      while (x < w) {
        const bw = 110 + rnd() * 80
        const tone = 175 + rnd() * 35
        ctx.fillStyle = `rgb(${tone},${tone - 4},${tone - 14})`
        ctx.fillRect(x + 2, y + 2, bw - 4, h / rows - 4)
        x += bw
      }
    }
  }, { repeat: true })
}

// 꽃담: 침전 담·굴뚝에 쓰는 붉은 전돌 + 흰 줄눈 + 가운데 꽃무늬
export function getFlowerWallTexture() {
  return canvasTexture('flowerWall', 256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#efe5d2'
    ctx.fillRect(0, 0, w, h)
    ctx.fillStyle = '#b0503a'
    for (let y = 0; y < h; y += 16) {
      for (let x = (y / 16) % 2 ? -16 : 0; x < w; x += 32) ctx.fillRect(x + 2, y + 2, 28, 12)
    }
    ctx.fillStyle = '#efe5d2'
    ctx.beginPath(); ctx.arc(w / 2, h / 2, 54, 0, Math.PI * 2); ctx.fill()
    ctx.strokeStyle = '#8c3a2a'; ctx.lineWidth = 6
    for (let i = 0; i < 6; i += 1) {
      const a = (i / 6) * Math.PI * 2
      ctx.beginPath(); ctx.arc(w / 2 + Math.cos(a) * 22, h / 2 + Math.sin(a) * 22, 18, 0, Math.PI * 2); ctx.stroke()
    }
  })
}

// 기와: 세로로 수키와(볼록·밝음)와 암키와(오목·어두움)가 번갈아, 가로로 기와 겹친 줄 (1장 = 0.42m × 0.5m)
export function getRoofTileTexture() {
  return canvasTexture('roofTile', 64, 64, (ctx, w, h) => {
    ctx.fillStyle = '#3e474e'
    ctx.fillRect(0, 0, w, h)
    const g = ctx.createLinearGradient(0, 0, w / 2, 0)
    g.addColorStop(0, '#4f5a61')
    g.addColorStop(0.5, '#7a868c')
    g.addColorStop(1, '#4f5a61')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, w / 2, h)
    ctx.fillStyle = 'rgba(20,24,28,0.35)'
    ctx.fillRect(0, h - 6, w, 6)
    ctx.fillStyle = 'rgba(255,255,255,0.08)'
    ctx.fillRect(0, 0, w, 3)
  }, { repeat: true })
}

// ── 경복궁 실내·창호 (2차: 사진 기반 세부) ─────────────────

// 창살 무늬 (흰 창호지 + 살). kind: 'tti' 띠살 · 'bit' 빗살(사선 격자) · 'jeongja' 정자살(네모 격자)
//   · 'fret' 번개(ㄹ자)살 — 경회루 칸막이의 초록 살. bar: 살 색
export function getLatticeTexture(kind = 'tti', bar = '#6e3326', frame = '#7b3a2c') {
  return canvasTexture(`lattice-${kind}-${bar}-${frame}`, 128, 256, (ctx, w, h) => {
    ctx.fillStyle = '#f1ebda'
    ctx.fillRect(0, 0, w, h)
    ctx.fillStyle = bar
    ctx.strokeStyle = bar
    if (kind === 'tti') {
      for (let x = 10; x < w - 8; x += 9) ctx.fillRect(x, 0, 3, h)
      for (const y0 of [22, 118, 216]) for (let i = 0; i < 4; i += 1) ctx.fillRect(0, y0 + i * 6, w, 3)
    } else if (kind === 'bit') {
      ctx.lineWidth = 3
      for (let d = -h; d < w + h; d += 16) {
        ctx.beginPath(); ctx.moveTo(d, 0); ctx.lineTo(d + h, h); ctx.stroke()
        ctx.beginPath(); ctx.moveTo(d + h, 0); ctx.lineTo(d, h); ctx.stroke()
      }
    } else if (kind === 'jeongja') {
      for (let x = 14; x < w - 8; x += 18) ctx.fillRect(x, 0, 3, h)
      for (let y = 14; y < h - 8; y += 22) ctx.fillRect(0, y, w, 3)
    } else {
      // 번개살: ㄹ자가 칸마다 방향을 바꾸며 이어져요
      ctx.lineWidth = 5
      ctx.lineCap = 'square'
      const c = 32
      for (let gy = 0; gy < h / c; gy += 1) {
        for (let gx = 0; gx < w / c; gx += 1) {
          ctx.save()
          ctx.translate(gx * c + c / 2, gy * c + c / 2)
          ctx.rotate(((gx + gy) % 2) * (Math.PI / 2))
          ctx.beginPath()
          ctx.moveTo(-12, -12); ctx.lineTo(12, -12); ctx.lineTo(12, 0); ctx.lineTo(-12, 0); ctx.lineTo(-12, 12); ctx.lineTo(12, 12)
          ctx.stroke()
          ctx.restore()
        }
      }
    }
    ctx.fillStyle = frame
    ctx.fillRect(0, 0, w, 7); ctx.fillRect(0, h - 7, w, 7); ctx.fillRect(0, 0, 7, h); ctx.fillRect(w - 7, 0, 7, h)
  })
}

// 우물반자: 초록 반자틀 + 칸마다 파란 바탕 연꽃 (1장 = 2칸 × 2칸)
export function getCofferCeilingTexture() {
  return canvasTexture('cofferCeiling', 256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#2f6b58'
    ctx.fillRect(0, 0, w, h)
    for (let gy = 0; gy < 2; gy += 1) {
      for (let gx = 0; gx < 2; gx += 1) {
        const x = gx * 128
        const y = gy * 128
        ctx.fillStyle = '#c8423a'; ctx.fillRect(x + 9, y + 9, 110, 110)
        ctx.fillStyle = '#f2ecd8'; ctx.fillRect(x + 13, y + 13, 102, 102)
        ctx.fillStyle = '#1f3f78'; ctx.fillRect(x + 16, y + 16, 96, 96)
        // 귀 장식
        ctx.fillStyle = '#e9b949'
        for (const [cx, cy] of [[20, 20], [108, 20], [20, 108], [108, 108]]) {
          ctx.beginPath(); ctx.arc(x + cx, y + cy, 5, 0, Math.PI * 2); ctx.fill()
        }
        const cx = x + 64
        const cy = y + 64
        ctx.fillStyle = '#2f6b58'
        for (let i = 0; i < 8; i += 1) {
          const a = (i / 8) * Math.PI * 2
          ctx.beginPath(); ctx.ellipse(cx + Math.cos(a) * 26, cy + Math.sin(a) * 26, 11, 6, a, 0, Math.PI * 2); ctx.fill()
        }
        for (const [r, c] of [[24, '#c8423a'], [18, '#f2ecd8'], [13, '#e9b949'], [6, '#c8423a']]) {
          ctx.fillStyle = c; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill()
        }
        ctx.fillStyle = '#f2ecd8'
        for (let i = 0; i < 8; i += 1) {
          const a = (i / 8) * Math.PI * 2 + Math.PI / 8
          ctx.beginPath(); ctx.arc(cx + Math.cos(a) * 37, cy + Math.sin(a) * 37, 3, 0, Math.PI * 2); ctx.fill()
        }
      }
    }
  }, { repeat: true })
}

// 보개천장 황룡: 붉은 구름 바탕에 금빛 쌍룡 + 여의주
export function getDragonPanelTexture() {
  return canvasTexture('dragonPanel', 256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#2b1410'
    ctx.fillRect(0, 0, w, h)
    // 구름
    ctx.strokeStyle = 'rgba(200,66,58,0.75)'
    ctx.lineWidth = 4
    for (const [x, y] of [[40, 40], [210, 60], [60, 210], [200, 200], [128, 30], [128, 226]]) {
      for (let i = 0; i < 3; i += 1) { ctx.beginPath(); ctx.arc(x + i * 9, y, 9, Math.PI, 0); ctx.stroke() }
    }
    const dragon = (flip) => {
      ctx.save()
      ctx.translate(w / 2, h / 2)
      ctx.scale(flip, flip)
      ctx.lineCap = 'round'
      ctx.strokeStyle = '#7a5418'
      ctx.lineWidth = 20
      const body = () => { ctx.beginPath(); ctx.moveTo(-20, -18); ctx.bezierCurveTo(-90, -40, -100, 40, -40, 50); ctx.bezierCurveTo(10, 60, 60, 20, 95, 70); ctx.stroke() }
      body()
      ctx.strokeStyle = '#e2b544'
      ctx.lineWidth = 14
      body()
      // 비늘
      ctx.fillStyle = '#a8761f'
      for (let t = 0; t < 1; t += 0.07) {
        const x = -40 + Math.sin(t * 6) * 50 * (1 - t) + t * 120
        const y = -10 + t * 70 + Math.cos(t * 6) * 25
        ctx.beginPath(); ctx.arc(x, y, 2.2, 0, Math.PI * 2); ctx.fill()
      }
      // 머리 + 갈기 + 뿔
      ctx.fillStyle = '#e8bf4f'; ctx.beginPath(); ctx.ellipse(-12, -24, 17, 12, -0.4, 0, Math.PI * 2); ctx.fill()
      ctx.fillStyle = '#c8423a'
      for (let i = 0; i < 5; i += 1) { ctx.beginPath(); ctx.arc(-26 - i * 4, -34 + i * 5, 5, 0, Math.PI * 2); ctx.fill() }
      ctx.strokeStyle = '#e8bf4f'; ctx.lineWidth = 3
      ctx.beginPath(); ctx.moveTo(-8, -34); ctx.lineTo(4, -48); ctx.stroke()
      ctx.fillStyle = '#2b1410'; ctx.beginPath(); ctx.arc(-6, -27, 2.5, 0, Math.PI * 2); ctx.fill()
      // 발톱
      ctx.strokeStyle = '#e2b544'; ctx.lineWidth = 5
      for (const [x, y] of [[-70, 10], [30, 45]]) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 12, y + 14); ctx.stroke() }
      ctx.restore()
    }
    dragon(1)
    dragon(-1)
    // 여의주
    ctx.fillStyle = '#f6efe0'; ctx.beginPath(); ctx.arc(w / 2, h / 2, 11, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = '#e0553f'; ctx.beginPath(); ctx.arc(w / 2, h / 2, 6, 0, Math.PI * 2); ctx.fill()
    ctx.strokeStyle = '#d8b25a'; ctx.lineWidth = 8; ctx.strokeRect(4, 4, w - 8, h - 8)
  })
}

// 향원정 육각 반자: 붉은 틀 + 초록 칸마다 날아가는 새 (1장 = 2칸 × 2칸)
export function getBirdCofferTexture() {
  return canvasTexture('birdCoffer', 128, 128, (ctx, w, h) => {
    ctx.fillStyle = '#9a3a2c'
    ctx.fillRect(0, 0, w, h)
    for (let gy = 0; gy < 2; gy += 1) {
      for (let gx = 0; gx < 2; gx += 1) {
        const x = gx * 64
        const y = gy * 64
        ctx.fillStyle = '#e9e2cf'; ctx.fillRect(x + 4, y + 4, 56, 56)
        ctx.fillStyle = '#3f7a55'; ctx.fillRect(x + 7, y + 7, 50, 50)
        // 새: 몸 + 양 날개 + 붉은 머리
        ctx.fillStyle = '#f1e7c9'
        ctx.beginPath(); ctx.ellipse(x + 32, y + 33, 9, 4, -0.5, 0, Math.PI * 2); ctx.fill()
        ctx.strokeStyle = '#f1e7c9'; ctx.lineWidth = 3
        ctx.beginPath(); ctx.moveTo(x + 30, y + 31); ctx.quadraticCurveTo(x + 20, y + 14, x + 12, y + 20); ctx.stroke()
        ctx.beginPath(); ctx.moveTo(x + 34, y + 31); ctx.quadraticCurveTo(x + 46, y + 18, x + 52, y + 26); ctx.stroke()
        ctx.fillStyle = '#c8423a'; ctx.beginPath(); ctx.arc(x + 41, y + 28, 3, 0, Math.PI * 2); ctx.fill()
        ctx.strokeStyle = '#d8b25a'; ctx.lineWidth = 2
        ctx.beginPath(); ctx.moveTo(x + 24, y + 37); ctx.lineTo(x + 14, y + 46); ctx.stroke()
      }
    }
  }, { repeat: true })
}

// 우물마루: 긴 장귀틀 사이에 짧은 청판을 가로로 끼운 회갈색 나무 마루 (1장 = 2m × 2m)
export function getMaruTexture() {
  return canvasTexture('maru', 256, 256, (ctx, w, h) => {
    const rnd = seeded(5)
    ctx.fillStyle = '#7d7366'
    ctx.fillRect(0, 0, w, h)
    for (let band = 0; band < 2; band += 1) {
      const x0 = band * 128
      // 장귀틀 (세로 긴 널)
      ctx.fillStyle = '#6b6156'
      ctx.fillRect(x0, 0, 16, h)
      // 청판 (가로 짧은 널)
      for (let y = 0; y < h; y += 18) {
        const t = 118 + rnd() * 30
        ctx.fillStyle = `rgb(${t},${t - 8},${t - 18})`
        ctx.fillRect(x0 + 17, y + 1, 110, 16)
        ctx.strokeStyle = 'rgba(60,50,40,0.25)'
        ctx.lineWidth = 1
        for (let k = 0; k < 3; k += 1) {
          const gy = y + 3 + rnd() * 12
          ctx.beginPath()
          ctx.moveTo(x0 + 18, gy)
          ctx.bezierCurveTo(x0 + 50, gy + 2, x0 + 80, gy - 2, x0 + 126, gy + 1)
          ctx.stroke()
        }
      }
    }
  }, { repeat: true })
}

// 계자난간 청판: 분홍 판 + 초록 테두리 + 가운데 뚫린 안상(구름 모양 구멍)
export function getRailPanelTexture() {
  return canvasTexture('railPanel', 128, 48, (ctx, w, h) => {
    ctx.fillStyle = '#4f8a6a'
    ctx.fillRect(0, 0, w, h)
    ctx.fillStyle = '#d98b78'
    ctx.fillRect(5, 5, w - 10, h - 10)
    ctx.fillStyle = '#5a2a22'
    ctx.beginPath()
    ctx.moveTo(28, 30)
    ctx.bezierCurveTo(30, 12, 50, 14, 56, 20)
    ctx.bezierCurveTo(60, 10, 70, 10, 74, 20)
    ctx.bezierCurveTo(80, 14, 98, 12, 100, 30)
    ctx.bezierCurveTo(90, 36, 38, 36, 28, 30)
    ctx.fill()
  }, { repeat: true })
}

// 흰 창호지 문 (향원정): 얇은 나무 테 + 흰 종이
export function getPaperDoorTexture() {
  return canvasTexture('paperDoor', 64, 128, (ctx, w, h) => {
    ctx.fillStyle = '#f4f0e6'
    ctx.fillRect(0, 0, w, h)
    ctx.fillStyle = '#6b3a2a'
    ctx.fillRect(0, 0, w, 4)
    ctx.fillRect(0, h - 4, w, 4)
    ctx.fillRect(0, 0, 4, h)
    ctx.fillRect(w - 4, 0, 4, h)
    ctx.fillStyle = 'rgba(110,80,60,0.25)'
    ctx.fillRect(w / 2 - 1, 0, 2, h)
  })
}

// ── 사정전(편전) 실내 ─────────────────────────────

// 돗자리 바닥: 연한 볏짚색 왕골 결 + 파란 선두름(가장자리 천). 1장 = 돗자리 한 장(0.9m × 1.8m)
export function getMatFloorTexture() {
  return canvasTexture('matFloor', 128, 256, (ctx, w, h) => {
    const rnd = seeded(12)
    ctx.fillStyle = '#e2d7b2'
    ctx.fillRect(0, 0, w, h)
    for (let y = 0; y < h; y += 3) {
      const t = 205 + rnd() * 30
      ctx.fillStyle = `rgb(${t},${t - 10},${t - 45})`
      ctx.fillRect(0, y, w, 1)
    }
    ctx.fillStyle = '#2c4a8a'
    ctx.fillRect(0, 0, 7, h)
    ctx.fillRect(w - 7, 0, 7, h)
    ctx.fillRect(0, 0, w, 6)
    ctx.fillRect(0, h - 6, w, 6)
  }, { repeat: true })
}

// 운룡도: 붉은빛 구름 속에서 꿈틀대는 용 (편전 어좌 위 큰 그림)
export function getCloudDragonTexture() {
  return canvasTexture('cloudDragon', 512, 256, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, w, h)
    g.addColorStop(0, '#f1d9c8')
    g.addColorStop(1, '#e8c3b0')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, w, h)
    const rnd = seeded(8)
    // 구름 소용돌이
    ctx.strokeStyle = 'rgba(190,80,70,0.45)'
    ctx.lineWidth = 3
    for (let i = 0; i < 26; i += 1) {
      const x = rnd() * w
      const y = rnd() * h
      const r = 10 + rnd() * 22
      ctx.beginPath()
      ctx.arc(x, y, r, 0, Math.PI * 1.5)
      ctx.stroke()
      ctx.beginPath()
      ctx.arc(x + r * 0.7, y, r * 0.5, Math.PI, Math.PI * 2.4)
      ctx.stroke()
    }
    // 용 몸통 (S자) + 비늘 + 머리·뿔·수염 + 여의주
    ctx.lineCap = 'round'
    const body = () => {
      ctx.beginPath()
      ctx.moveTo(60, 200)
      ctx.bezierCurveTo(140, 40, 230, 220, 300, 110)
      ctx.bezierCurveTo(350, 40, 400, 120, 440, 70)
      ctx.stroke()
    }
    ctx.strokeStyle = '#a0342c'
    ctx.lineWidth = 26
    body()
    ctx.strokeStyle = '#d8735e'
    ctx.lineWidth = 18
    body()
    ctx.fillStyle = 'rgba(140,40,32,0.55)'
    for (let t = 0; t < 60; t += 1) {
      ctx.beginPath()
      ctx.arc(70 + t * 6.2, 200 - Math.sin(t / 9) * 70 - t * 1.6, 2.4, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.fillStyle = '#b8402f'
    ctx.beginPath()
    ctx.ellipse(452, 62, 26, 17, -0.4, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = '#8c2a22'
    ctx.lineWidth = 3
    for (const [dx, dy] of [[18, -30], [30, -22], [-10, 20], [6, 24]]) {
      ctx.beginPath()
      ctx.moveTo(452, 62)
      ctx.quadraticCurveTo(452 + dx * 0.6, 62 + dy * 1.3, 452 + dx * 1.6, 62 + dy)
      ctx.stroke()
    }
    // 발톱
    for (const [x, y] of [[150, 115], [260, 175], [360, 85]]) {
      ctx.beginPath()
      ctx.moveTo(x, y)
      ctx.lineTo(x - 14, y + 18)
      ctx.moveTo(x, y)
      ctx.lineTo(x + 6, y + 20)
      ctx.stroke()
    }
    ctx.fillStyle = '#f6efe0'
    ctx.beginPath()
    ctx.arc(392, 168, 13, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = '#c8423a'
    ctx.lineWidth = 2
    ctx.stroke()
    ctx.strokeStyle = '#7a2a22'
    ctx.lineWidth = 10
    ctx.strokeRect(5, 5, w - 10, h - 10)
  })
}

// ── 경복궁 벽·창 (사진 기반, HjHanok fillWall · 궁궐 담장) ─────────────────

// 사괘석 화방벽: 네모난 화강석 덩이를 줄마다 엇갈려 쌓고 흰 줄눈을 두껍게 (1장 = 벽 한 칸, 약 2m × 1m)
export function getSagwaeTexture() {
  return canvasTexture('sagwae', 512, 256, (ctx, w, h) => {
    const rnd = seeded(23)
    ctx.fillStyle = '#efe9dc' // 흰 줄눈
    ctx.fillRect(0, 0, w, h)
    const rows = 5
    const rh = h / rows
    for (let r = 0; r < rows; r += 1) {
      const y = r * rh
      let x = r % 2 ? -rh * 0.5 : 0
      while (x < w) {
        const bw = rh * (0.95 + rnd() * 0.25)
        const tone = 168 + rnd() * 34
        const warm = 4 + rnd() * 10
        ctx.fillStyle = `rgb(${tone + warm},${tone + warm * 0.4},${tone - warm * 0.5})`
        ctx.fillRect(x + 5, y + 5, bw - 10, rh - 10)
        // 화강암 알갱이
        for (let k = 0; k < 40; k += 1) {
          const d = rnd()
          ctx.fillStyle = d < 0.5 ? 'rgba(60,55,50,0.35)' : 'rgba(255,255,255,0.35)'
          ctx.fillRect(x + 6 + rnd() * (bw - 12), y + 6 + rnd() * (rh - 12), 1.6, 1.6)
        }
        // 위쪽 밝은 가장자리 (돌이 살짝 튀어나온 느낌)
        ctx.fillStyle = 'rgba(255,255,255,0.18)'
        ctx.fillRect(x + 5, y + 5, bw - 10, 3)
        ctx.fillStyle = 'rgba(0,0,0,0.12)'
        ctx.fillRect(x + 5, y + rh - 8, bw - 10, 3)
        x += bw
      }
    }
  }, { repeat: true })
}

// 전돌 띠: 화방벽 위 어두운 회색 전돌을 가로로 쌓고, 아래 가장자리를 톱니처럼 엇갈려 끝낸 띠 (1장 = 2m × 0.25m)
export function getBrickBandTexture() {
  return canvasTexture('brickBand', 512, 64, (ctx, w, h) => {
    ctx.fillStyle = '#d9d4c8'
    ctx.fillRect(0, 0, w, h)
    const rh = 12
    for (let r = 0; r < 4; r += 1) {
      for (let x = r % 2 ? -14 : 0; x < w; x += 28) {
        ctx.fillStyle = r % 2 ? '#4e5256' : '#5b5f63'
        ctx.fillRect(x + 1.5, r * rh + 1.5, 25, rh - 3)
      }
    }
    // 톱니(이빨) 줄
    for (let x = 0; x < w; x += 28) {
      ctx.fillStyle = '#55595d'
      ctx.fillRect(x + 1.5, 4 * rh + 1.5, 12, 12)
    }
  }, { repeat: true })
}

// 분홍 판벽: 분홍(주토) 벽면 + 검은 선 테두리 + 붉은 틀 (1장 = 칸 하나)
export function getPinkPanelTexture() {
  return canvasTexture('pinkPanel', 256, 128, (ctx, w, h) => {
    ctx.fillStyle = '#8f3a2c'
    ctx.fillRect(0, 0, w, h)
    ctx.fillStyle = '#e39a86'
    ctx.fillRect(8, 8, w - 16, h - 16)
    ctx.strokeStyle = '#2b2422'
    ctx.lineWidth = 2
    ctx.strokeRect(18, 16, w - 36, h - 32)
    ctx.strokeStyle = '#f7eee4'
    ctx.lineWidth = 1
    ctx.strokeRect(22, 20, w - 44, h - 40)
  })
}

// 초록 창 두 짝: 붉은 틀 안에 초록 정자살 창 (닫힌 덧창) + 양옆 분홍 판 (1장 = 칸 하나)
export function getGreenWindowTexture() {
  return canvasTexture('greenWindow', 256, 128, (ctx, w, h) => {
    ctx.fillStyle = '#8f3a2c'
    ctx.fillRect(0, 0, w, h)
    ctx.fillStyle = '#e39a86'
    ctx.fillRect(8, 8, w - 16, h - 16)
    const x0 = w * 0.3
    const x1 = w * 0.7
    ctx.fillStyle = '#8f3a2c'
    ctx.fillRect(x0 - 6, 10, x1 - x0 + 12, h - 20)
    for (const [a, b] of [[x0, (x0 + x1) / 2 - 1], [(x0 + x1) / 2 + 1, x1]]) {
      ctx.fillStyle = '#3f8a6a'
      ctx.fillRect(a, 14, b - a, h - 28)
      ctx.strokeStyle = '#1f4f3c'
      ctx.lineWidth = 2
      for (let x = a + 7; x < b - 3; x += 8) { ctx.beginPath(); ctx.moveTo(x, 16); ctx.lineTo(x, h - 16); ctx.stroke() }
      for (let y = 22; y < h - 16; y += 9) { ctx.beginPath(); ctx.moveTo(a + 2, y); ctx.lineTo(b - 2, y); ctx.stroke() }
      ctx.strokeStyle = '#5fae8a'
      ctx.lineWidth = 3
      ctx.strokeRect(a + 1.5, 15.5, b - a - 3, h - 31)
    }
    ctx.fillStyle = '#2b2422'
    ctx.fillRect((x0 + x1) / 2 - 5, h / 2 - 2, 3, 6)
    ctx.fillRect((x0 + x1) / 2 + 2, h / 2 - 2, 3, 6)
  })
}

// 팔각 교창: 분홍 벽면 가운데 팔각 붉은 테 + 빗살(사선 격자) 창 + 검은 선 테두리 (1장 = 칸 하나)
export function getOctagonWindowTexture() {
  return canvasTexture('octagonWindow', 256, 128, (ctx, w, h) => {
    ctx.fillStyle = '#8f3a2c'
    ctx.fillRect(0, 0, w, h)
    ctx.fillStyle = '#e39a86'
    ctx.fillRect(8, 8, w - 16, h - 16)
    const oct = (cx, cy, rx, ry, cut) => {
      ctx.beginPath()
      ctx.moveTo(cx - rx + cut, cy - ry)
      ctx.lineTo(cx + rx - cut, cy - ry)
      ctx.lineTo(cx + rx, cy - ry + cut)
      ctx.lineTo(cx + rx, cy + ry - cut)
      ctx.lineTo(cx + rx - cut, cy + ry)
      ctx.lineTo(cx - rx + cut, cy + ry)
      ctx.lineTo(cx - rx, cy + ry - cut)
      ctx.lineTo(cx - rx, cy - ry + cut)
      ctx.closePath()
    }
    ctx.strokeStyle = '#2b2422'
    ctx.lineWidth = 2
    oct(w / 2, h / 2, 96, 46, 22)
    ctx.stroke()
    ctx.fillStyle = '#8f3a2c'
    oct(w / 2, h / 2, 76, 34, 16)
    ctx.fill()
    ctx.save()
    oct(w / 2, h / 2, 68, 27, 13)
    ctx.clip()
    ctx.fillStyle = '#efe6cf'
    ctx.fillRect(0, 0, w, h)
    ctx.strokeStyle = '#3a2e26'
    ctx.lineWidth = 2
    for (let d = -h; d < w + h; d += 9) {
      ctx.beginPath(); ctx.moveTo(d, 0); ctx.lineTo(d + h, h); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(d + h, 0); ctx.lineTo(d, h); ctx.stroke()
    }
    ctx.restore()
  })
}
