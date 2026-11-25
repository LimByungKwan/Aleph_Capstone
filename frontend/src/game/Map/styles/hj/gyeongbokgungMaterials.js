import { BufferGeometry, CanvasTexture, Color, Float32BufferAttribute, RepeatWrapping, SRGBColorSpace } from 'three'
import { seeded } from '../kit.jsx'

// [3. 개발 > 프론트엔드] 조선 궁궐 지붕의 팔작 곡선 위에 기와 골을 입힙니다.
export function tiledRoof(width, depth, rise) {
  const positions = [], uv = [], color = [], indices = []
  const columns = Math.ceil(width * 5.5), rows = Math.max(12, Math.ceil(depth * 5.5))
  const tone = new Color(), dark = new Color('#8c989f'), light = new Color('#c0c5c2')
  for (let row = 0; row <= rows; row += 1) {
    const z = row / rows * 2 - 1
    for (let col = 0; col <= columns; col += 1) {
      const x = col / columns * 2 - 1
      const longSlope = Math.abs(z)
      const shortSlope = Math.max(0, (Math.abs(x) - 0.68) / 0.32)
      const slope = Math.max(longSlope, shortSlope)
      const corner = Math.pow(Math.abs(x * z), 3.5) * rise * .24
      const y = rise * (1 - slope) ** 1.56 + corner + (col % 2) * .027 * Math.abs(z)
      positions.push(x * width / 2, y, z * depth / 2)
      uv.push(col / columns * width / 1.65, (row / rows - .5) * depth / 1.36)
      tone.copy(dark).lerp(light, .30 + Math.abs(z) * .17 + (col % 2 ? .075 : 0))
      color.push(tone.r, tone.g, tone.b)
      if (row && col) {
        const a = row * (columns + 1) + col
        const b = a - columns - 1
        indices.push(b - 1, a - 1, b, b, a - 1, a)
      }
    }
  }
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geometry.setAttribute('uv', new Float32BufferAttribute(uv, 2))
  geometry.setAttribute('color', new Float32BufferAttribute(color, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return geometry
}

function texture(width, height, paint) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  paint(canvas.getContext('2d'), width, height)
  const map = new CanvasTexture(canvas)
  map.colorSpace = SRGBColorSpace
  map.wrapS = map.wrapT = RepeatWrapping
  map.anisotropy = 8
  return map
}

function grain(ctx, w, h, seed, count, opacity = .13) {
  const random = seeded(seed)
  for (let i = 0; i < count; i += 1) {
    ctx.fillStyle = i % 2 ? `rgba(255,246,219,${random() * opacity})` : `rgba(40,29,21,${random() * opacity})`
    ctx.fillRect(random() * w, random() * h, 1 + random() * 3, 1 + random() * 2)
  }
}

function tileMap() {
  return texture(384, 256, (ctx, w, h) => {
    ctx.fillStyle = '#6b7479'
    ctx.fillRect(0, 0, w, h)
    for (let x = 0; x < w; x += 48) {
      const shading = ctx.createLinearGradient(x, 0, x + 48, 0)
      const stops = [[0, '#343a42'], [.16, '#525c61'], [.37, '#b5b8b6'], [.55, '#8d9596'],
        [.76, '#4c565d'], [1, '#434b53']]
      stops.forEach(([offset, val]) => shading.addColorStop(offset, val))
      ctx.fillStyle = shading
      ctx.fillRect(x, 0, 48, h)
    }
    for (let y = 0; y < h; y += 32) {
      ctx.fillStyle = 'rgba(32,38,45,.5)'
      ctx.fillRect(0, y, w, 3)
      ctx.fillStyle = 'rgba(184,187,179,.42)'
      ctx.fillRect(0, y + 3, w, 2)
    }
    grain(ctx, w, h, 42, 7400)
  })
}

function masonryMap() {
  return texture(384, 240, (ctx, w, h) => {
    const random = seeded(207)
    ctx.fillStyle = '#ae9e87'
    ctx.fillRect(0, 0, w, h)
    const palette = ['#916653', '#b3866d', '#a7745e', '#8d634e', '#a38170', '#7b6a5c']
    for (let row = 0; row < 8; row += 1) {
      for (let col = -1; col <= 6; col += 1) {
        const x = col * 64 + row % 2 * 32
        const stone = ctx.createLinearGradient(0, row * 30, 0, row * 30 + 29)
        stone.addColorStop(0, '#c19c7f')
        stone.addColorStop(.17, palette[Math.floor(random() * palette.length)])
        stone.addColorStop(.91, palette[Math.floor(random() * palette.length)])
        stone.addColorStop(1, '#6c5242')
        ctx.fillStyle = stone
        ctx.beginPath()
        ctx.roundRect(x + 1.5, row * 30 + 1.5, 61, 27, 2.5)
        ctx.fill()
      }
    }
    grain(ctx, w, h, 119, 10500, .24)
  })
}

function latticeMap() {
  return texture(256, 336, (ctx, w, h) => {
    const paper = ctx.createLinearGradient(0, 0, w, h)
    paper.addColorStop(0, '#fff0c9')
    paper.addColorStop(.7, '#c9cdb0')
    paper.addColorStop(1, '#e8dba9')
    ctx.fillStyle = paper
    ctx.fillRect(0, 0, w, h)
    for (let x = 16; x < w; x += 32) {
      for (let y = 18; y < h; y += 36) {
        ctx.strokeStyle = '#34594e'
        ctx.lineWidth = 3.2
        ctx.beginPath()
        ctx.moveTo(x - 16, y)
        ctx.quadraticCurveTo(x, y - 6, x, y - 18)
        ctx.quadraticCurveTo(x + 6, y, x + 16, y)
        ctx.quadraticCurveTo(x, y + 6, x, y + 18)
        ctx.quadraticCurveTo(x - 6, y, x - 16, y)
        ctx.stroke()
        ctx.fillStyle = '#a18b56'
        ctx.beginPath()
        ctx.arc(x, y, 2.55, 0, Math.PI * 2)
        ctx.fill()
      }
    }
    ctx.strokeStyle = '#294639'
    ctx.lineWidth = 21
    ctx.strokeRect(0, 0, w, h)
    ctx.lineWidth = 7.5
    ctx.beginPath()
    ctx.moveTo(w / 2, 0)
    ctx.lineTo(w / 2, h)
    ctx.moveTo(0, h * .63)
    ctx.lineTo(w, h * .63)
    ctx.stroke()
    grain(ctx, w, h, 408, 7700, .17)
  })
}

function dancheongMap() {
  return texture(384, 128, (ctx, w, h) => {
    ctx.fillStyle = '#205b53'
    ctx.fillRect(0, 0, w, h)
    for (const [y, hei, c] of [[5, 7, '#8f392d'], [14, 4, '#dcb768'], [23, 4, '#78aa7c'],
      [100, 4, '#b8a662'], [109, 7, '#884739'], [118, 7, '#2e3d64']]) {
      ctx.fillStyle = c
      ctx.fillRect(0, y, w, hei)
    }
    for (let x = 0; x <= w; x += 64) {
      ctx.lineWidth = 3
      ctx.strokeStyle = '#d3b46f'
      ctx.beginPath()
      ctx.moveTo(x - 32, 63)
      ctx.bezierCurveTo(x - 16, 90, x + 16, 37, x + 32, 63)
      ctx.stroke()
      for (let finger = 0; finger < 8; finger += 1) {
        const angle = finger * Math.PI / 4
        ctx.beginPath()
        ctx.ellipse(x + Math.cos(angle) * 13, 62 + Math.sin(angle) * 13, 10, 4.3, angle, 0, Math.PI * 2)
        ctx.fillStyle = finger % 2 ? '#e39a70' : '#72a88b'
        ctx.fill()
        ctx.strokeStyle = '#302e45'
        ctx.lineWidth = 1.5
        ctx.stroke()
      }
      ctx.beginPath()
      ctx.arc(x, 62, 5, 0, Math.PI * 2)
      ctx.fillStyle = '#ebc67d'
      ctx.fill()
    }
    grain(ctx, w, h, 195, 5200, .17)
  })
}

export function palaceMaps() {
  return { tile: tileMap(), masonry: masonryMap(), lattice: latticeMap(), dancheong: dancheongMap() }
}
