import { zones } from '../data/mapData.js'

const [originX, originZ] = zones.find(zone => zone.zoneId === 'SG').origin
export function shoreline(x) {
  const t = (x + 45) / 85
  return 43 + 85 * t ** 7 + 1.5 * Math.sin(t * 13)
}
export const beachBounds = [originX-45, originX+40, originZ+40, originZ+130]
export function waterDepth(x,z) {
  const [left,right,start,end] = beachBounds
  if(x<left || x>right || z<start || z>end) return 0
  const shore=shoreline(x-originX)
  const edge=shore+11.5*Math.min(1,(130-shore)/23)
  const t=Math.min(1,Math.max(0,(z-originZ-edge)/8), (right-x)/5)
  return 1.18*t*t*(3-2*t)
}

// Walkable sand slopes beneath the rendered water plane.
const points=[], faces=[]
const columns=43, rows=45
for(let i=0;i<=columns;i++) for(let k=0;k<=rows;k++){
  const x=beachBounds[0]+85*i/columns, z=beachBounds[2]+90*k/rows
  points.push(x,-waterDepth(x,z),z)
  const a=i*(rows+1)+k
  if(i && k) faces.push(a-rows-2,a-rows-1,a,a-rows-2,a,a-1)
}
export const seabed=[new Float32Array(points), new Uint32Array(faces)]
