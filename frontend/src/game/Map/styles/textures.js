import * as THREE from 'three'

// 인터넷에서 이미지를 받지 않고, 브라우저 캔버스에 직접 그려서 만드는 텍스처들.
// 한 번 만든 텍스처는 캐시해서 재사용해요.

const KOREAN_FONT = '"Malgun Gothic", "Apple SD Gothic Neo", "Noto Sans KR", sans-serif'
const cache = new Map()

// 매번 같은 무늬가 나오도록 하는 고정 난수
function seededRandom(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function vary(hex, random, amount) {
  const color = new THREE.Color(hex)
  color.offsetHSL(0, 0, (random() - 0.5) * amount)
  return `#${color.getHexString()}`
}

function makeCanvasTexture(key, width, height, draw, repeat = true) {
  if (cache.has(key)) return cache.get(key)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  draw(canvas.getContext('2d'), width, height)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 8
  if (repeat) texture.wrapS = texture.wrapT = THREE.RepeatWrapping
  cache.set(key, texture)
  return texture
}

// ── 바닥 무늬 (반복용) ─────────────────────────
// 각 무늬 한 장이 실제로 몇 m인지 (반복 횟수 계산에 사용)
export const TILE_METERS = { brick: 1, asphalt: 4, tile: 1, stone: 2, paver: 2 }

const PATTERNS = {
  // 붉은 보도블록 (어긋나게 쌓기)
  brick: () =>
    makeCanvasTexture('brick', 256, 256, (ctx, w, h) => {
      const random = seededRandom(7)
      ctx.fillStyle = '#7f4536'
      ctx.fillRect(0, 0, w, h)
      const rows = 8
      const cols = 4
      const bh = h / rows
      const bw = w / cols
      for (let r = 0; r < rows; r++) {
        const offset = r % 2 ? bw / 2 : 0
        for (let c = -1; c < cols; c++) {
          ctx.fillStyle = vary('#b8644d', random, 0.08)
          ctx.fillRect(c * bw + offset + 2, r * bh + 2, bw - 4, bh - 4)
        }
      }
    }),

  // 아스팔트 (잔 알갱이)
  asphalt: () =>
    makeCanvasTexture('asphalt', 512, 512, (ctx, w, h) => {
      const random = seededRandom(11)
      ctx.fillStyle = '#4a4e54'
      ctx.fillRect(0, 0, w, h)
      for (let i = 0; i < 9000; i++) {
        const g = 60 + Math.floor(random() * 50)
        ctx.fillStyle = `rgba(${g},${g + 2},${g + 6},0.6)`
        ctx.fillRect(random() * w, random() * h, 2, 2)
      }
    }),

  // 광장용 초록 타일
  tile: () =>
    makeCanvasTexture('tile', 256, 256, (ctx, w, h) => {
      const random = seededRandom(23)
      ctx.fillStyle = '#d6dfd8'
      ctx.fillRect(0, 0, w, h)
      const n = 4
      const s = w / n
      for (let y = 0; y < n; y++) {
        for (let x = 0; x < n; x++) {
          ctx.fillStyle = vary('#6d9c85', random, 0.1)
          ctx.fillRect(x * s + 3, y * s + 3, s - 6, s - 6)
        }
      }
    }),

  // 카페 거리용 분홍빛 돌 포장 (가끔 문양 돌)
  paver: () =>
    makeCanvasTexture('paver', 256, 256, (ctx, w, h) => {
      const random = seededRandom(41)
      ctx.fillStyle = '#b9a59c'
      ctx.fillRect(0, 0, w, h)
      const rows = 4
      const rh = h / rows
      for (let r = 0; r < rows; r++) {
        let x = r % 2 ? -32 : 0
        while (x < w) {
          const sw = 48 + Math.floor(random() * 3) * 16
          ctx.fillStyle = vary('#dcc8bf', random, 0.06)
          ctx.fillRect(x + 3, r * rh + 3, sw - 6, rh - 6)
          if (random() < 0.12) {
            ctx.strokeStyle = 'rgba(150,120,110,0.6)'
            ctx.lineWidth = 3
            ctx.strokeRect(x + 14, r * rh + 14, sw - 28, rh - 28)
          }
          x += sw
        }
      }
    }),

  // 돌담
  stone: () =>
    makeCanvasTexture('stone', 256, 256, (ctx, w, h) => {
      const random = seededRandom(31)
      ctx.fillStyle = '#5f5a52'
      ctx.fillRect(0, 0, w, h)
      const rows = 5
      const rh = h / rows
      for (let r = 0; r < rows; r++) {
        let x = -random() * 30
        while (x < w) {
          const sw = 34 + random() * 34
          ctx.fillStyle = vary('#a59f94', random, 0.16)
          ctx.beginPath()
          ctx.roundRect(x + 3, r * rh + 3, sw - 6, rh - 6, 10)
          ctx.fill()
          x += sw
        }
      }
    }),
}

// 반복 무늬 텍스처. repeatX/repeatY = 몇 번 반복할지
export function getTiledTexture(kind, repeatX, repeatY) {
  const texture = PATTERNS[kind]().clone()
  texture.repeat.set(repeatX, repeatY)
  texture.needsUpdate = true
  return texture
}

// ── 한 장짜리 그림 ─────────────────────────────

// 한옥 창살 (창호지 + 나무 격자)
export function getLatticeTexture() {
  return makeCanvasTexture(
    'lattice',
    128,
    256,
    (ctx, w, h) => {
      ctx.fillStyle = '#efe6d2'
      ctx.fillRect(0, 0, w, h)
      ctx.strokeStyle = '#6b4a2f'
      ctx.lineWidth = 4
      for (let x = 0; x <= w; x += w / 5) {
        ctx.beginPath()
        ctx.moveTo(x, 0)
        ctx.lineTo(x, h)
        ctx.stroke()
      }
      for (let y = 0; y <= h; y += h / 10) {
        ctx.beginPath()
        ctx.moveTo(0, y)
        ctx.lineTo(w, y)
        ctx.stroke()
      }
      ctx.lineWidth = 12
      ctx.strokeRect(0, 0, w, h)
    },
    false,
  )
}

// 막다른 골목 "날개 벽화"
export function getMuralTexture() {
  return makeCanvasTexture(
    'mural',
    1024,
    512,
    (ctx, w, h) => {
      const sky = ctx.createLinearGradient(0, 0, 0, h)
      sky.addColorStop(0, '#bfe3ff')
      sky.addColorStop(1, '#fff1d6')
      ctx.fillStyle = sky
      ctx.fillRect(0, 0, w, h)

      const colors = ['#ff9eb5', '#ffc48a', '#ffe58a', '#a7e3a1', '#8fd3ff', '#b9a5ff']
      const cx = w / 2
      const cy = h * 0.55
      for (const side of [-1, 1]) {
        for (let row = 0; row < 6; row++) {
          const length = 330 - row * 40
          for (let k = 0; k < 9; k++) {
            const angle = (-0.15 - k * 0.11) * Math.PI
            const r = 40 + row * 45
            const x = cx + side * (60 + Math.cos(angle) * -r * 0.2 + k * (length / 9))
            const y = cy - row * 40 + Math.sin(angle) * 30 + k * 6
            ctx.fillStyle = colors[(row + k) % colors.length]
            ctx.beginPath()
            ctx.ellipse(x, y, 34 - row * 2, 16, side * (0.3 + k * 0.05), 0, Math.PI * 2)
            ctx.fill()
          }
        }
      }
      ctx.fillStyle = 'rgba(255,255,255,0.85)'
      ctx.font = `bold 44px ${KOREAN_FONT}`
      ctx.textAlign = 'center'
      ctx.fillText('여기서 날아 봐!', cx, h - 40)
    },
    false,
  )
}

// 간판 (글자 + 배경색)
export function getSignTexture(text, bg = '#ffffff', fg = '#222222') {
  return makeCanvasTexture(
    `sign:${text}:${bg}:${fg}`,
    512,
    128,
    (ctx, w, h) => {
      ctx.fillStyle = bg
      ctx.fillRect(0, 0, w, h)
      ctx.strokeStyle = 'rgba(0,0,0,0.25)'
      ctx.lineWidth = 8
      ctx.strokeRect(4, 4, w - 8, h - 8)
      let size = 72
      ctx.font = `bold ${size}px ${KOREAN_FONT}`
      while (ctx.measureText(text).width > w - 40 && size > 20) {
        size -= 4
        ctx.font = `bold ${size}px ${KOREAN_FONT}`
      }
      ctx.fillStyle = fg
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(text, w / 2, h / 2 + 4)
    },
    false,
  )
}

// 줄무늬 차양 (색 + 흰색)
export function getStripeTexture(color) {
  return makeCanvasTexture(
    `stripe:${color}`,
    128,
    32,
    (ctx, w, h) => {
      const n = 8
      for (let i = 0; i < n; i++) {
        ctx.fillStyle = i % 2 ? '#fffaf5' : color
        ctx.fillRect((i * w) / n, 0, w / n, h)
      }
    },
    false,
  )
}

// 원형 광장 바닥 (동심원 + 방사선 + 초록 띠)
export function getCirclePlazaTexture() {
  return makeCanvasTexture(
    'circle-plaza',
    512,
    512,
    (ctx, w) => {
      const c = w / 2
      const rings = [
        [1.0, '#d9ccc2'],
        [0.86, '#cbbdb2'],
        [0.74, '#a9cf95'],
        [0.64, '#e3d8ce'],
        [0.5, '#cfc1b6'],
        [0.36, '#e6dcd3'],
      ]
      for (const [r, color] of rings) {
        ctx.fillStyle = color
        ctx.beginPath()
        ctx.arc(c, c, r * c, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.strokeStyle = 'rgba(140,120,110,0.45)'
      ctx.lineWidth = 3
      for (let i = 0; i < 24; i++) {
        const a = (i / 24) * Math.PI * 2
        ctx.beginPath()
        ctx.moveTo(c + Math.cos(a) * c * 0.36, c + Math.sin(a) * c * 0.36)
        ctx.lineTo(c + Math.cos(a) * c * 0.64, c + Math.sin(a) * c * 0.64)
        ctx.moveTo(c + Math.cos(a) * c * 0.74, c + Math.sin(a) * c * 0.74)
        ctx.lineTo(c + Math.cos(a) * c, c + Math.sin(a) * c)
        ctx.stroke()
      }
    },
    false,
  )
}

// 빛나는 네온 날개 (배경 투명)
export function getNeonWingsTexture() {
  return makeCanvasTexture(
    'neon-wings',
    512,
    256,
    (ctx, w, h) => {
      ctx.clearRect(0, 0, w, h)
      const cx = w / 2
      const cy = h * 0.55
      ctx.lineCap = 'round'
      for (const side of [-1, 1]) {
        for (let k = 0; k < 6; k++) {
          const len = 200 - k * 26
          const lift = 70 - k * 8
          ctx.shadowColor = '#ff7eb6'
          ctx.shadowBlur = 18
          ctx.strokeStyle = k % 2 ? '#ffc2dc' : '#fff4fa'
          ctx.lineWidth = 7
          ctx.beginPath()
          ctx.moveTo(cx + side * 14, cy - 10 + k * 12)
          ctx.quadraticCurveTo(cx + side * len * 0.55, cy - lift - k * 6, cx + side * len, cy - 40 + k * 22)
          ctx.stroke()
        }
      }
    },
    false,
  )
}

// 도로 위 글씨 (배경 투명)
export function getRoadTextTexture(text, color = '#f5f5f0') {
  return makeCanvasTexture(
    `road:${text}:${color}`,
    512,
    256,
    (ctx, w, h) => {
      ctx.clearRect(0, 0, w, h)
      ctx.fillStyle = color
      ctx.font = `bold 150px ${KOREAN_FONT}`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(text, w / 2, h / 2)
    },
    false,
  )
}
