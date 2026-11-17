import * as THREE from 'three'
import { Box, Cyl, GEO, Instances, mat, seeded } from './kit.jsx'

import { shoreline } from '../seabed.js'

function coastline() {
  const vertices = [], colors = [], indices = []
  for (let i = 0; i <= 96; i++) {
    const x = -45 + 85 * i / 96
    const shore = shoreline(x)
    const width = Math.min(1, (130 - shore) / 23)
    const rows = [
      [shore, '#c0ba9f'], [shore + 2 * width, '#e2d4ac'],
      [shore + 9 * width, '#f2d79f'], [shore + 11 * width, '#cba978'],
      [shore + (11.5 + .20 * Math.sin(i*.7)) * width, '#eefbf1'],
      [shore + 12 * width, '#94ddd0'], [shore + 19 * width, '#53b8b9'],
      [shore + (130-shore)*.30 + 15*width, '#369aa9'], [130, '#286f91'],
    ]
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
for (let x=-38;x<=13;x+=.53)
  boards.push({ p:[x,.09,44], s:[.51,.18,3], c:rand()>.5?'#bb906a':'#c79d77' })
for (let i=0;i<190;i++) {
  const x=-44+rand()*79, edge=shoreline(x)+13
  const z=edge+rand()*(129-edge)
  if(z<129 && z>edge) ripples.push({p:[x,.048,z],s:[.5+rand()*1.8,.012,.05+rand()*.1],r:[0,rand()*.3-.15,0]})
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
    {[[-32,48,'#a881bf'],[-18,49,'#57aaa6'],[-5,48,'#d48794'],[8,50,'#7597bd']].map(([x,z,color])=>
      <Parasol key={x} x={x} z={z} color={color} />)}
  </group>
}
