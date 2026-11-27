import * as THREE from 'three'
import { Box, Cyl, GEO, Instances, mat, seeded } from './kit.jsx'

import { BEACH_BOARDWALK, BEACH_PARASOLS, COAST_SEGMENTS, coastPoint, shoreline } from '../seabed.js'
import { coastRows } from '../coastColors.js'

function coastline() {
  const vertices = [], colors = [], indices = []
  for (let i = 0; i <= COAST_SEGMENTS; i++) {
    const { x } = coastPoint(i)
    const rows = coastRows(i)
    rows.forEach(([z,color], k) => {
      vertices.push(x,.035,z)
      colors.push(...new THREE.Color(color).toArray())
      if (i && k) {
        const a = i*rows.length+k
        indices.push(a-rows.length-1,a-rows.length,a, a-rows.length-1,a,a-1)
      }
    })
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices,3))
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors,3))
  geo.setIndex(indices)
  geo.computeVertexNormals()
  return geo
}
const shoreGeometry = coastline()
const boards = [], ripples = []
const rand = seeded(742)
for (let x = BEACH_BOARDWALK.fromX; x <= BEACH_BOARDWALK.toX; x += .53)
  boards.push({ p:[x,.09,BEACH_BOARDWALK.z], s:[.51,.18,BEACH_BOARDWALK.depth], c:rand()>.5?'#bb906a':'#c79d77' })
for (let i=0;i<190;i++) {
  const x=-44+rand()*79, edge=shoreline(x)+13
  const z=edge+rand()*(129-edge)
  if(z<129 && z>edge) ripples.push({p:[x,.078,z],s:[.5+rand()*1.8,.012,.05+rand()*.1],r:[0,rand()*.3-.15,0]})
}
const pale = mat('#b4e5df')
function Parasol({x,z,color}) {
  return <group position={[x,0,z]}>
    <Cyl p={[0,1.28,0]} rad={.055} h={2.56} c="#aa815c" />
    {Array.from({length:8},(_,i)=>
      <mesh key={i} position={[0,2.49,0]} rotation={[0,i*Math.PI/4,0]} material={mat(i%2?color:'#fff1cf',{double:true})}>
        <coneGeometry args={[1.58,.62,1,1,true,0,Math.PI/4]} />
      </mesh>)}
    {[-.9,.9].map(dx=><group key={dx} position={[dx,0,.65]}>
      <Box p={[0,.25,0]} s={[.69,.22,1.48]} c="#f5e8ce" />
      <Box p={[0,.51,-.62]} s={[.69,.10,.87]} r={[-.72,0,0]} c={color} />
    </group>)}
  </group>
}
export function SungrayBeach() {
  return <group>
    <mesh geometry={shoreGeometry} receiveShadow userData={{noShadow:true}}>
      <meshStandardMaterial vertexColors roughness={.85} />
    </mesh>
    <Instances geometry={GEO.box} items={boards} material={mat('#ffffff')} />
    <Instances geometry={GEO.box} items={ripples} material={pale} />
    {BEACH_PARASOLS.map(([x,z,color])=>
      <Parasol key={x} x={x} z={z} color={color} />)}
  </group>
}
