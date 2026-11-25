import { useMemo } from 'react'
import { GEO, Instances, mat } from '../kit.jsx'

const WOOD = mat('#fff', { roughness:.83 })

function flightParts(steps, landing) {
  const first = steps[0]
  const last = steps.at(-1)
  const alongX = first.x !== last.x
  const direction = Math.sign(alongX ? last.x-first.x : last.z-first.z)
  const position = alongX ? (along,y,cross) => [along,y,cross] : (along,y,cross) => [cross,y,along]
  const size = alongX ? (along,h,cross) => [along,h,cross] : (along,h,cross) => [cross,h,along]
  const at = alongX ? (step) => step.x : (step) => step.z
  const run = alongX ? (step) => step.w : (step) => step.d
  const cross = alongX ? first.z : first.x
  const width = alongX ? first.d : first.w
  const start = at(first)-direction*run(first)/2
  const end = at(last)+direction*run(last)/2

  function inclined(a, y, b, upperY, offset, thickness, breadth, color) {
    const slope = Math.atan2(upperY-y,b-a)
    return {
      p:position((a+b)/2,(y+upperY)/2,cross+offset),
      r:alongX ? [0,0,slope] : [-slope,0,0],
      s:size(Math.hypot(b-a,upperY-y),thickness,breadth),
      c:color,
    }
  }

  const treads = steps.flatMap((step, i) => {
    const front = at(step)-direction*(run(step)/2-.021)
    const rise = step.top - (steps[i-1]?.top ?? first.base)
    return [
      { p:position(at(step),step.top-.029,cross), s:size(run(step),.058,width), c:step.color },
      { p:position(front,step.top-rise/2,cross), s:size(.042,rise,width-.032), c:'#694b38' },
      { p:position(front,step.top-.014,cross), s:size(.048,.032,width), c:'#b28a63' },
    ]
  })
  const stringers = [-width/2+.12,0,width/2-.12].map(offset =>
    inclined(start,first.base+.105,end,last.top-.126,offset,.23,.17,'#59402f'))

  const railing = width/2-.041
  const height = .74
  const posts = steps.filter((_, i) => i%3 === 0).map(step => ({
    p:position(at(step),step.top+height/2,cross+railing),
    s:size(.075,height,.055),c:'#624533',
  }))
  return [
    ...treads,
    ...stringers,
    ...posts,
    { p:position(end,landing.top+height/2,cross+railing), s:size(.087,height,.082), c:'#664936' },
    inclined(at(first),first.top+height,end,landing.top+height,railing,.076,.075,'#79593e'),
  ]
}

export default function TimberStairs({ steps, landing }) {
  const parts = useMemo(() => flightParts(steps, landing), [steps,landing])
  return <Instances geometry={GEO.box} material={WOOD} items={parts} castShadow />
}
