import { useEffect, useMemo } from 'react'
import { BufferGeometry, CanvasTexture, Euler, Float32BufferAttribute, MeshBasicMaterial, Quaternion, Vector3 } from 'three'
import { Box, GEO, Instances, mat, seeded } from '../kit.jsx'
import { StreetSign } from './GyeongseongMasonry.jsx'
import { STREET, STREET_CARS, STREET_MARKET, STREET_TREES } from './gyeongseongLayout.js'

const STANDARD = mat('#fff')
const LEAVES = mat('#fff', { flat: true })
const TIMBER = '#69513d'
const ASPHALT = .167
const UP = new Vector3(0, 1, 0)
const POLES = [[-14.1, 18.2, 7.1], [-2.1, 26.5, 6.7], [-13.8, 34.4, 6.45], [-2.2, 42.65, 6.14], [-13.7, 49, 5.85]]

function rod(items, from, to, width, color, tip = width) {
  const start = new Vector3(...from)
  const end = new Vector3(...to)
  const direction = new Vector3().subVectors(end, start)
  const rotation = new Euler().setFromQuaternion(new Quaternion().setFromUnitVectors(UP, direction.clone().normalize()))
  items.push({ p:start.lerp(end,.5).toArray(), s:[width,direction.length(),tip], r:[rotation.x,rotation.y,rotation.z], c:color })
}

function shadowTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 64
  const context = canvas.getContext('2d')
  const ink = context.createRadialGradient(32, 32, 4, 32, 32, 31)
  ink.addColorStop(0, 'rgba(43,33,24,.67)')
  ink.addColorStop(.42, 'rgba(43,33,24,.42)')
  ink.addColorStop(1, 'rgba(43,33,24,0)')
  context.fillStyle = ink
  context.fillRect(0, 0, 64, 64)
  return new CanvasTexture(canvas)
}

function makeWires() {
  const positions = []
  for (let pole = 1; pole < POLES.length; pole += 1) {
    const start = POLES[pole - 1]
    const end = POLES[pole]
    for (const side of [-1, 0, 1]) {
      const point = (t) => [
        start[0] + (end[0] - start[0]) * t + side * .47,
        start[2] + (end[2] - start[2]) * t - .35 - Math.sin(Math.PI * t) * .46,
        start[1] + (end[1] - start[1]) * t,
      ]
      for (let segment = 0; segment < 18; segment += 1) positions.push(...point(segment / 18), ...point((segment + 1) / 18))
    }
  }
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  return geometry
}

function plantStreet(seed) {
  const random = seeded(seed)
  const trunks = []
  const branches = []
  const leaves = []
  const colors = ['#385e36','#4b733e','#527944','#749053','#315d3f','#617f42']
  for (const [x, z, size] of STREET_TREES) {
    const y = ASPHALT
    const p = (a, b, c) => [x + a * size, y + b * size, z + c * size]
    rod(trunks, p(0,0,0), p(.22,2.15,.12), .19 * size, '#66503e')
    rod(trunks, p(.22,2.07,.12), p(.06,4.08,.2), .125 * size, '#756044')
    for (let arm = 0; arm < 8; arm += 1) {
      const angle = arm * 2.4
      const dx = Math.cos(angle) * (1.2 + random() * .65)
      const dz = Math.sin(angle) * (1.1 + random() * .71)
      const top = 3.1 + random() * 1.6
      rod(branches, p(.17,1.75 + arm*.23,.15), p(dx,top,dz), .055 * size, '#735c3e')
      for (let cluster = 0; cluster < 13; cluster += 1) {
        const t = random() * Math.PI * 2
        const span = random() * 1.05
        leaves.push({
          p:p(dx*.72 + Math.cos(t)*span, top + random()*.88, dz*.77 + Math.sin(t)*span),
          s:[(.32 + random()*.57)*size,(.29 + random()*.45)*size,(.34 + random()*.5)*size],
          r:[random(),t,random()*.7], c:colors[Math.floor(random()*colors.length)],
        })
      }
    }
  }
  return { trunks, branches, leaves }
}

function marketProps() {
  const random = seeded(679)
  const wood = []
  const awnings = []
  const produce = []
  const shades = ['#a55338','#c58744','#96783d','#b59a65','#526d47']
  const shadows = []
  for (const { x, z, color, accent } of STREET_MARKET) {
    wood.push(
      { p:[x,.67,z],s:[2.12,.12,1.31],c:'#8b6e4b' },
      { p:[x,1.26,z],s:[1.99,.98,.065],c:'#66513d' },
      { p:[x,.35,z],s:[1.98,.48,1.03],c:'#94744e' },
    )
    for (const side of [-1,1]) for (const at of [-.56,.56]) wood.push(
      { p:[x+side,1.26,z+at],s:[.085,2.19,.087],c:TIMBER },
      { p:[x+side*.78,.78,z+at*.64],s:[.53,.24,.43],c:'#aa885d' },
    )
    for (let stripe = 0; stripe < 10; stripe += 1) {
      const u = x + (stripe-4.5)*.233
      awnings.push(
        { p:[u,2.29,z],s:[.231,.042,1.74],r:[-.18,0,0],c:stripe % 2 ? color : accent },
        { p:[u,2.05,z-.867],s:[.23,.21,.036],c:stripe % 2 ? color : accent },
      )
    }
    for (let box = 0; box < 3; box += 1) {
      const dx = x + (box - 1) * .57
      wood.push({ p:[dx,.79,z-.31],s:[.49,.12,.31],c:'#b29469' })
      for (let item = 0; item < 10; item += 1) produce.push({
        p:[dx+(random()-.5)*.4,.888+random()*.027,z-.3+(random()-.5)*.24],
        s:[.05,.05,.055],c:shades[(produce.length+box) % shades.length],
      })
    }
    shadows.push({ p:[x,.195,z], s:[3.4,2.2,1],r:[-Math.PI/2,0,0] })
  }
  return { wood, awnings, produce, shadows }
}

function periodVehicles() {
  const body = []
  const rounded = []
  const wheels = []
  const glass = []
  const lamps = []
  const shadows = []
  for (const { x,z,color,turn } of STREET_CARS) {
    const sign = turn ? -1 : 1
    const part = (items, p, s, c, r) => items.push({ p:[x+p[0]*sign,ASPHALT+p[1],z+p[2]*sign],s,c,r })
    for (const [p, s, c] of [
      [[0,.49,0],[1.32,.33,3.52],color],
      [[0,.73,.59],[1.35,.49,2.23],color],
      [[0,.83,-1.16],[.81,.54,1.03],color],
      [[0,1.02,-1.70],[.73,.55,.09],'#665946'],
      [[0,1.01,-1.76],[.56,.46,.027],'#3c3932'],
      [[0,.51,-1.84],[1.59,.07,.089],'#9b9787'],
      [[0,.61,1.77],[1.56,.08,.083],'#9b9787'],
      [[0,1.63,.48],[1.18,.15,1.70],color],
    ]) part(body,p,s,c)
    for (const side of [-1, 1]) {
      for (const axle of [-1.13,1.12]) {
        part(wheels,[side*.66,.36,axle],[.33,.19,.33],'#282627',[0,0,Math.PI/2])
        part(wheels,[side*.76,.36,axle],[.152,.04,.152],'#a69676',[0,0,Math.PI/2])
        part(rounded,[side*.66,.548,axle],[.203,.181,.62],color)
      }
      part(body,[side*.57,1.32,.48],[.076,.57,1.66],color)
      part(glass,[side*.618,1.31,.48],[.025,.37,1.39])
      part(body,[side*.63,1.31,.54],[.039,.40,.07],'#5c594d')
      part(lamps,[side*.593,.95,-1.42],[.136,.136,.092])
      part(body,[side*.67,.37,.13],[.32,.078,1.45],'#45413a')
    }
    part(glass,[0,1.31,-.34],[1.02,.37,.04])
    part(glass,[0,1.31,1.31],[1.0,.36,.045])
    part(body,[0,1.31,-.367],[.044,.39,.056],'#4c4b42')
    for (let bar = -3; bar <= 3; bar += 1) part(body,[bar*.073,1.01,-1.781],[.016,.42,.019],'#a99b7d')
    shadows.push({ p:[x,.183,z],s:[2.7,4.4,1],r:[-Math.PI/2,0,0] })
  }
  return { body, rounded, wheels, glass, lamps, shadows }
}

export default function GyeongseongStreetLife({ materials }) {
  const display = useMemo(() => {
    const town = plantStreet(4924)
    const stalls = marketProps()
    const cars = periodVehicles()
    const poles = []
    const brackets = []
    for (const [x,z,h] of POLES) {
      poles.push({ p:[x, h*.51,z],s:[.108,h,.113],c:'#735c46' })
      brackets.push({ p:[x,h-.38,z],s:[1.67,.12,.119],c:'#675447' })
      for (const side of [-1,0,1]) poles.push({ p:[x+side*.47,h-.25,z],s:[.055,.14,.055],c:'#dbd0b8' })
    }
    return {
      box:[...stalls.wood,...stalls.awnings,...cars.body,...brackets],
      cylinder:[...town.trunks,...town.branches,...poles,...cars.wheels],
      round:[...stalls.produce,...cars.rounded],
      glass:cars.glass,
      lamps:cars.lamps,
      leaves:town.leaves,
      shadows:[...stalls.shadows,...cars.shadows, ...STREET_TREES.map(([x,z,scale]) => ({
        p:[x-.54,.198,z+.5],s:[4.7*scale,4.3*scale,1],r:[-Math.PI/2,0,0],
      }))],
      wires:makeWires(),
      shadow:shadowTexture(),
    }
  }, [])
  useEffect(() => () => { display.wires.dispose(); display.shadow.dispose() }, [display])
  return (
    <group name="경성 시장과 거리 풍경">
      <Instances geometry={GEO.box} material={STANDARD} items={display.box} castShadow />
      <Instances geometry={GEO.cyl8} material={STANDARD} items={display.cylinder} />
      <Instances geometry={GEO.sphere} material={STANDARD} items={display.round} />
      <Instances geometry={GEO.box} material={materials.carGlass} items={display.glass} />
      <Instances geometry={GEO.sphere} material={materials.lamp} items={display.lamps} />
      <Instances geometry={GEO.ico} material={LEAVES} items={display.leaves} castShadow />
      <ContactShadows map={display.shadow} items={display.shadows} />
      <lineSegments geometry={display.wires}>
        <lineBasicMaterial color="#4e4842" transparent opacity={.79} />
      </lineSegments>
      <FarStreet />
    </group>
  )
}

function ContactShadows({ map, items }) {
  const material = useMemo(() => new MeshBasicMaterial({
    map, transparent:true, depthWrite:false, polygonOffset:true, polygonOffsetFactor:-2,
  }), [map])
  useEffect(() => () => material.dispose(), [material])
  return <Instances geometry={GEO.plane} material={material} items={items} />
}

function FarStreet() {
  const skyline = [
    [-18.68,6.14,4.72,'#aa9981'], [-13.0,4.9,3.86,'#b2a78d'], [-7.2,5.7,4.19,'#a9977d'],
    [0.95,4.25,3.15,'#bcb09a'], [7.05,5.3,4.61,'#a19a87'], [12.8,6.0,4.22,'#a8967f'],
  ]
  const horizon = skyline.flatMap(([x,w,h,color]) => [
    { p:[x,h/2,50.51],s:[w,h,.61],c:color },
    { p:[x,h+.08,50.51],s:[w+.24,.16,.84],c:'#766d5c' },
    { p:[x+.78,h+.31,50.58],s:[.30,.62,.32],c:'#87735d' },
    { p:[x,h-.27,50.14],s:[w+.16,.12,.15],c:'#c0b19a' },
    ...[-1,0,1].flatMap((bay) => [
      { p:[x + bay*w*.28,h-.87,50.187],s:[.47,.66,.04],c:'#5b625b' },
      { p:[x + bay*w*.28,h-1.22,50.14],s:[.6,.10,.13],c:'#d0bea1' },
    ]),
  ])
  return (
    <group name="전차길 끝 벽">
      <Instances geometry={GEO.box} material={STANDARD} items={horizon} />
      <Box p={[STREET.x, 1.61, 50.34]} s={[8.45, 3.0, .50]} c="#a69b83" />
      <Box p={[STREET.x, 3.16, 50.34]} s={[8.7, .16, .61]} c="#cabca0" />
      <Box p={[STREET.x, 1.37, 50.09]} s={[2.92, 2.53, .15]} c="#5c6553" />
      {[-3.25,-1.67,1.67,3.25].map((x) => (
        <Box key={x} p={[STREET.x + x, 1.58, 50.065]} s={[.24,2.8,.28]} c="#c5b79a" />
      ))}
      <StreetSign text="경성 전차 차고" p={[STREET.x, 2.77, 49.92]} w={3.13} h={.41} background="#504b3b" />
    </group>
  )
}
