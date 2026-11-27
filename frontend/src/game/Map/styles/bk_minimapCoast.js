import { beachBounds, coastPoint, COAST_SEGMENTS } from '../seabed.js'
import { coastRows } from '../coastColors.js'
import { sampleOceanBoundary } from './jm_seaGeometry.js'

export const MAP_OCEAN = '#52839b'

export function drawMinimapCoast(ctx, { ocean, harbor, bounds }) {
  const [left, top, right, bottom] = bounds
  const yaw = (ocean.rotationDeg ?? 0) * Math.PI / 180
  const cos = Math.cos(yaw)
  const sin = Math.sin(yaw)
  const [ox, oz] = ocean.position
  const coast = sampleOceanBoundary(ocean.ocean.pts, 2).map(([x, z, kind]) => [
    ox + x * cos + z * sin, oz - x * sin + z * cos, kind,
  ])
  const open = coast.findIndex(([, , kind]) => kind === 'O')
  const sand = coast.findIndex(([, , kind], i) => i > open && kind === 'B')
  const [northX, northZ] = coast[open]
  const [joinX, joinZ] = coast[sand]
  const [west, , north] = beachBounds
  const firstX = coastPoint(0).x
  const beach = Array.from({ length: COAST_SEGMENTS + 1 }, (_, i) => [
    west + coastPoint(i).x - firstX, north + coastRows(i)[4][0] - 40,
  ]).reverse()
  const [beachEast, beachSouth] = beach[0]
  const [beachWest, beachNorth] = beach.at(-1)
  const harborX = harbor.position[0] + harbor.size[0] / 2
  const harborEnd = harbor.position[1] + harbor.size[2] / 2
  const southX = harborX - 8

  const sea = new Path2D()
  const shore = new Path2D()
  for (const path of [sea, shore]) {
    path.moveTo(...coast[0].slice(0, 2))
    for (const [x, z] of coast.slice(1, open + 1)) path.lineTo(x, z)
    path.bezierCurveTo(northX - 4, northZ - 30, northX - 11, top + 24, northX - 11, top)
    if (path === sea) {
      path.lineTo(left, top)
      path.lineTo(left, bottom)
      path.lineTo(southX, bottom)
    } else {
      path.moveTo(southX, bottom)
    }
    path.bezierCurveTo(southX, harborEnd + 50, harborX, harborEnd + 18, harborX, harborEnd)
    path.quadraticCurveTo(harborX, beachSouth + 15, beachEast, beachSouth)
    for (const [x, z] of beach.slice(1)) path.lineTo(x, z)
    path.bezierCurveTo(beachWest - 5, beachNorth, joinX + 7, joinZ, joinX, joinZ)
    for (const [x, z] of coast.slice(sand + 1)) path.lineTo(x, z)
    if (path === sea) path.closePath()
    else path.lineTo(...coast[0].slice(0, 2))
  }

  // 반도와 해변의 모래는 한 선으로 잇고 항구 쪽에는 물빛만 남깁니다.
  const sandbank = new Path2D()
  sandbank.moveTo(beachEast, beachSouth)
  for (const [x, z] of beach.slice(1)) sandbank.lineTo(x, z)
  sandbank.bezierCurveTo(beachWest - 5, beachNorth, joinX + 7, joinZ, joinX, joinZ)
  for (let i = sand; i < coast.length - 1 && coast[i][2] === 'B'; i++) {
    const [x, z] = coast[i + 1]
    sandbank.lineTo(x, z)
  }

  ctx.save()
  ctx.lineCap = 'round'
  ctx.strokeStyle = '#e8d3aa'
  ctx.lineWidth = (ocean.ocean.sand ?? 8) * 1.1
  ctx.stroke(sandbank)

  const water = ctx.createLinearGradient(left, 0, right, 0)
  water.addColorStop(0, MAP_OCEAN)
  water.addColorStop(0.22, MAP_OCEAN)
  water.addColorStop(0.8, '#679eaf')
  water.addColorStop(1, '#73aab6')
  ctx.fillStyle = water
  ctx.fill(sea)
  ctx.clip(sea)

  ctx.filter = 'blur(8px)'
  ctx.strokeStyle = '#88b8be'
  ctx.lineWidth = 46
  ctx.stroke(shore)
  ctx.filter = 'blur(3px)'
  ctx.strokeStyle = '#a8ccca'
  ctx.lineWidth = 20
  ctx.stroke(shore)
  ctx.filter = 'none'
  ctx.strokeStyle = '#d9e9df'
  ctx.lineWidth = 3
  ctx.stroke(sandbank)
  ctx.restore()
}
