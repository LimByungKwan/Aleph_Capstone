import { useLayoutEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { GEO } from '../kit.jsx'

const outfits = [
  ['#404f65','#b38c71','#2f2724','#c38f56'], ['#a06452','#dfb59a','#382e29','#413d44'],
  ['#82988a','#be947a','#282623','#debba1'], ['#c5ab8b','#e2bba4','#504035','#455971'],
]
const cloth=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.86})
function figure(index) {
  const [coat,skin,hair,bag]=outfits[index]
  const parts = {}
  let pieces=[]
  function piece(geo,color,x,y,z,w,h,d,rz=0) {
    const g=geo.clone().scale(w,h,d).rotateZ(rz).translate(x,y,z)
    const rgb=new THREE.Color(color)
    const colors=new Float32Array(g.attributes.position.count*3)
    for(let i=0;i<colors.length;i+=3) rgb.toArray(colors,i)
    g.setAttribute('color',new THREE.BufferAttribute(colors,3))
    pieces.push(g)
  }
  function finish(key) { parts[key]=mergeGeometries(pieces);pieces.forEach(g=>g.dispose());pieces=[] }
  const ball=(...args)=>piece(GEO.sphere,...args)
  const box=(...args)=>piece(GEO.box,...args)
  ball(coat,0,1.10,0,.23,.34,.147)
  ball(skin,0,1.46,0,.087,.12,.085)
  ball(skin,0,1.625,.012,.145,.191,.137)
  ball(hair,0,1.727,-.016,.15,.111,.14)
  if(index%2) ball(hair,0,1.60,-.092,.137,.165,.078)
  for(const s of [-1,1]){
    ball(skin,s*.137,1.62,0,.029,.042,.023)
    ball('#352e2c',s*.053,1.65,.134,.017,.012,.009)
    box('#ebe4d8',s*.057,1.37,.105,.085,.095,.026,s*.45)
  }
  ball(skin,0,1.61,.144,.024,.032,.031)
  ball('#a57265',0,1.563,.133,.037,.008,.009)
  box(bag,0,1.13,.138,.034,.49,.02,-.53)
  ball(bag,.164,.927,.105,.10,.105,.062)
  finish('body')
  ball(coat,0,-.145,0,.082,.193,.08)
  ball(skin,0,-.35,.034,.055,.118,.056)
  finish('arm')
  ball('#354151',0,-.178,0,.098,.228,.103)
  finish('thigh')
  ball('#354151',0,-.155,0,.078,.20,.083)
  ball(index%2?'#ecdfcf':'#373636',0,-.332,.055,.082,.067,.139)
  finish('shin')
  return parts
}
const figures=outfits.map((_,i)=>figure(i))
const lanes=[-41,-14.4,14.4,46,49.2,66.7,109.3]
const transform=new THREE.Object3D(), joint=new THREE.Object3D()
const base=new THREE.Matrix4(), knee=new THREE.Matrix4(), hip=new THREE.Matrix4()
const count=12
function Walkers({variant}) {
  const refs=useRef({})
  function update(t) {
    const put=(part,id,parent,x,y,z,angle=0)=>{
      joint.position.set(x,y,z); joint.rotation.set(angle,0,0); joint.updateMatrix()
      knee.multiplyMatrices(parent,joint.matrix)
      refs.current[part].setMatrixAt(id,knee)
    }
    for(let i=0;i<count;i++){
      const id=i*4+variant, direction=id%2?1:-1
      // Capsule loop: constant walking speed on straight paths and rounded turns.
      const radius=.65, straight=143, arc=Math.PI*radius, lap=2*(straight+arc)
      const speed=1.04+(id%8)*.068
      let u=(t*speed+id*23.831)%lap
      let x=radius,z,yaw
      if(u<straight){z=u; yaw=0}
      else if((u-=straight)<arc){const a=u/radius;x=radius*Math.cos(a);z=straight+radius*Math.sin(a);yaw=-a}
      else if((u-=arc)<straight){x=-radius;z=straight-u;yaw=Math.PI}
      else {const a=(u-straight)/radius;x=-radius*Math.cos(a);z=-radius*Math.sin(a);yaw=Math.PI-a}
      const step=t*speed*4.7+id
      transform.position.set(lanes[id%lanes.length]+x*direction,.105+.027*Math.cos(2*step),direction*(z-straight/2))
      transform.rotation.set(0,yaw+(direction<0?Math.PI:0),0)
      transform.scale.setScalar(.92+(id%6)*.027)
      transform.updateMatrix()
      base.copy(transform.matrix)
      refs.current.body.setMatrixAt(i,base)
      for(const side of [-1,1]){
        const k=i*2+(side+1)/2, swing=side*Math.sin(step)
        put('arm',k,base,side*.223,1.34,0,.45*swing-.1)
        put('thigh',k,base,side*.105,.81,0,-.49*swing)
        hip.copy(knee)
        put('shin',k,hip,0,-.37,0,.08+.53*Math.max(0,-side*Math.cos(step)))
      }
    }
    Object.values(refs.current).forEach(mesh=>{mesh.instanceMatrix.needsUpdate=true})
  }
  useLayoutEffect(()=>{update(0)},[variant])
  useFrame(({clock})=>update(clock.elapsedTime))
  return Object.entries(figures[variant]).map(([key,geo])=><instancedMesh key={key}
    ref={mesh=>{refs.current[key]=mesh}} args={[geo,cloth,key==='body'?count:2*count]}
    frustumCulled={false} dispose={null}/>)
}
export function SeoulPedestrians(){
  return figures.map((_,i)=><Walkers key={i} variant={i}/>)
}
