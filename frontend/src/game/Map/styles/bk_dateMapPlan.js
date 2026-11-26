import { zones } from '../../data/mapData.js'
import { getMinimapBase, minimapZoneBounds } from './bk_minimapMap.js'

const [west, north, east, south] = minimapZoneBounds(zones.find(({ zoneId }) => zoneId === 'BK'))
const margin = 5

export const dateMapBounds = {
  left: west - margin,
  top: north - margin,
  width: east - west + margin * 2,
  height: south - north + margin * 2,
}

// 지도 바탕을 월드 단위로 그려 핀 좌표에도 같은 변환을 적용할 수 있게 합니다.
export function drawDateMapBase(ctx) {
  const { left, top, width, height } = dateMapBounds
  const { canvas, minX, minZ, worldW, worldH } = getMinimapBase()
  const scaleX = canvas.width / worldW
  const scaleZ = canvas.height / worldH
  ctx.drawImage(canvas,
    (left - minX) * scaleX, (top - minZ) * scaleZ, width * scaleX, height * scaleZ,
    0, 0, width, height,
  )
}
