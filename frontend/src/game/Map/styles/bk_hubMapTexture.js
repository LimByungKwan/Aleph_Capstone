import { CanvasTexture, SRGBColorSpace } from 'three'
import { zones } from '../../data/mapData.js'
import { getMinimapBase, MAP_GRASS, minimapZoneBounds } from './bk_minimapMap.js'
import { palaceMap } from './bk_minimapSections.js'

const WIDTH = 1200
const HEIGHT = 800
const INK = '#253e35'
const FONT = '"Malgun Gothic", "Apple SD Gothic Neo", "Noto Sans KR", sans-serif'
const MAP = { x: 24, y: 117, width: 770, height: 657 }
const highlights = {
  JM: '유토야 온천장',
  BK: '전망대 · 커플 포토존',
  HJ: '경복궁 · 경성 거리',
  SG: '야외무대 · 선셋 데크',
}

function roundRect(ctx, x, y, w, h, r, fill) {
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, r)
  ctx.fillStyle = fill
  ctx.fill()
}

function text(ctx, value, x, y, size, color, weight = 700) {
  ctx.font = `${weight} ${size}px ${FONT}`
  ctx.fillStyle = color
  ctx.fillText(value, x, y)
}

function drawMap(ctx, position) {
  const base = getMinimapBase()
  const [west, , east] = base.zoneBounds
  // 안내판은 광장에서 이어지는 길과 주요 시설을 가까이 보여 줍니다.
  const north = Math.min(...zones.map(({ origin, size }) => origin[1] - size[1] / 2)) - 12
  const south = Math.max(palaceMap?.bounds[3] ?? 0, ...zones.map((zone) => (
    zone.zoneId === 'HJ' ? zone.origin[1] : minimapZoneBounds(zone)[3]
  )))
  const { x, y, width, height } = MAP
  const scale = Math.min((width - 48) / (east - west), (height - 44) / (south - north))
  const toX = (worldX) => x + width / 2 + (worldX - (west + east) / 2) * scale
  const toY = (worldZ) => y + height / 2 + (worldZ - (north + south) / 2) * scale
  const frame = new Path2D()
  frame.roundRect(x, y, width, height, 22)
  ctx.save()
  ctx.fillStyle = MAP_GRASS
  ctx.fill(frame)
  ctx.clip(frame)
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(base.canvas, toX(base.minX), toY(base.minZ), base.worldW * scale, base.worldH * scale)

  const cx = x + 47
  ctx.beginPath()
  ctx.moveTo(cx, y + 27)
  ctx.lineTo(cx + 13, y + 52)
  ctx.lineTo(cx, y + 45)
  ctx.lineTo(cx - 13, y + 52)
  ctx.closePath()
  ctx.fillStyle = INK
  ctx.fill()
  text(ctx, 'N', cx - 8, y + 74, 23, INK)

  const px = toX(position[0])
  const py = toY(position[1])
  roundRect(ctx, px - 120, py + 14, 112, 40, 12, '#fffaf1')
  text(ctx, '현재 위치', px - 110, py + 41, 22, INK)
  ctx.beginPath()
  ctx.moveTo(px, py + 1)
  ctx.quadraticCurveTo(px - 27, py - 27, px - 10, py - 37)
  ctx.bezierCurveTo(px + 7, py - 47, px + 29, py - 32, px + 13, py - 13)
  ctx.closePath()
  ctx.fillStyle = '#b92555'
  ctx.fill()
  ctx.strokeStyle = '#fff9ee'
  ctx.lineWidth = 3
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(px, py - 25, 5, 0, Math.PI * 2)
  ctx.fillStyle = '#fff9ee'
  ctx.fill()
  ctx.restore()

  ctx.strokeStyle = '#83937c'
  ctx.lineWidth = 2
  ctx.stroke(frame)
}

let texture
export function getHubMapTexture(position) {
  if (texture) return texture
  const canvas = document.createElement('canvas')
  canvas.width = WIDTH
  canvas.height = HEIGHT
  const ctx = canvas.getContext('2d')

  ctx.fillStyle = '#fcf6e9'
  ctx.fillRect(0, 0, WIDTH, HEIGHT)
  ctx.fillStyle = INK
  ctx.fillRect(0, 0, WIDTH, 94)
  ctx.fillStyle = '#cc9e67'
  ctx.fillRect(0, 94, WIDTH, 5)
  text(ctx, 'SceneWalk 안내 지도', 32, 65, 46, '#fff6e7')
  ctx.textAlign = 'right'
  text(ctx, '중앙 광장', WIDTH - 32, 63, 32, '#ffe1b8')
  ctx.textAlign = 'left'
  drawMap(ctx, position)

  zones.forEach(({ name, zoneId, color }, i) => {
    const y = 128 + 126 * i
    roundRect(ctx, 814, y, 360, 112, 16, '#f2e9d9')
    roundRect(ctx, 834, y + 22, 10, 68, 5, color)
    text(ctx, name, 863, y + 49, 34, INK)
    if (highlights[zoneId]) text(ctx, highlights[zoneId], 863, y + 84, 24, '#494e47', 500)
  })
  roundRect(ctx, 814, 673, 360, 82, 17, INK)
  roundRect(ctx, 830, 689, 50, 49, 9, '#fff2da')
  text(ctx, 'E', 845, 725, 31, INK)
  text(ctx, '전체 지도 열기', 898, 725, 32, '#fff2da')
  texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  texture.anisotropy = 4
  return texture
}
