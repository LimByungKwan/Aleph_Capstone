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
