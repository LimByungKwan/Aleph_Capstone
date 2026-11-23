import { CanvasTexture, MeshStandardMaterial, RepeatWrapping, SRGBColorSpace } from 'three'
import { seeded } from '../kit.jsx'

// [3. 개발 > 렌더링] 벽돌·화강석은 256px 타일을 반복해 외부 모델이나 이미지 로딩이 필요 없습니다.
function paintedSurface(seed, draw) {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 256
  const ctx = canvas.getContext('2d')
  const random = seeded(seed)
  draw(ctx, random)
  for (let i = 0; i < 3600; i += 1) {
    ctx.fillStyle = i % 2 ? 'rgba(255,248,229,.12)' : 'rgba(43,36,33,.12)'
    ctx.fillRect(random() * 256, random() * 256, 1 + random() * 2, 1)
  }
  const map = new CanvasTexture(canvas)
  map.colorSpace = SRGBColorSpace
  map.wrapS = map.wrapT = RepeatWrapping
  map.anisotropy = 4
  return map
}

function masonry(seed, columns, rows, mortar, palette, relief) {
  const map = paintedSurface(seed, (ctx, random) => {
    ctx.fillStyle = mortar
    ctx.fillRect(0, 0, 256, 256)
    const width = 256 / columns
    const height = 256 / rows
    for (let row = 0; row < rows; row += 1) {
      const y = row * height
      for (let col = 0; col < columns; col += 1) {
        const x = (col - (row % 2) * .5) * width
        const fill = ctx.createLinearGradient(0, y, 0, y + height)
        fill.addColorStop(0, palette[0])
        fill.addColorStop(.18, palette[1 + Math.floor(random() * (palette.length - 2))])
        fill.addColorStop(1, palette.at(-1))
        ctx.fillStyle = fill
        for (const offset of [0, 256]) ctx.fillRect(x + offset + 1.35, y + 1.4, width - 2.7, height - 2.8)
      }
    }
  })
  return new MeshStandardMaterial({ map, bumpMap:map, bumpScale:relief, roughness:.88 })
}

function timber() {
  const map = paintedSurface(33, (ctx, random) => {
    ctx.fillStyle = '#974636'
    ctx.fillRect(0, 0, 256, 256)
    for (let i = 0; i < 68; i += 1) {
      ctx.fillStyle = i % 2 ? '#542f2530' : '#f7b27d38'
      ctx.fillRect(random() * 256, 0, .35 + random() * 2, 256)
    }
  })
  return new MeshStandardMaterial({ map, bumpMap:map, bumpScale:.012, roughness:.78 })
}

export function specialArchitectureMaterials() {
  return {
    woldae_stone: masonry(41, 3, 6, '#827b70', ['#d3c9b9','#b6ac9b','#c4bdae','#a29d94','#968e81'], .04),
    colonial_stone: masonry(79, 4, 6, '#a4a198', ['#e1ddce','#c8c4b9','#b8b6ae','#d0ccc2','#aaa89e'], .026),
    red_brick: masonry(65, 5, 10, '#bba897', ['#a77460','#884837','#985340','#a56650','#733e33'], .034),
    timber: timber(),
  }
}
