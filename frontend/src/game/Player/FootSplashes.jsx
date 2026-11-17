import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { waterDepth } from '../Map/seabed.js'

export default function FootSplashes({ playerRef }) {
  const drops=useRef(), rings=useRef()
  const state=useMemo(()=>({
    last:null, wet:false, distance:0, cursor:0, dummy:new THREE.Object3D(),
    bursts:Array.from({length:5},()=>({age:2,x:0,z:0,strength:0})),
  }),[])
  useFrame((_,dt)=>{
    const player=playerRef.current
    if(!player) return
    const {x,y,z}=player.currPos, depth=waterDepth(x,z)
    const wet=depth>.025 && y-.8<.22
    const moved=state.last?Math.hypot(x-state.last.x,z-state.last.z):0
    if(wet && moved<2) {
      state.distance+=moved
      if(!state.wet || state.distance>.92){
        const burst=state.bursts[state.cursor++ % state.bursts.length]
        const side=state.cursor%2?1:-1
        Object.assign(burst,{age:0,x:x+side*.12*(z-(state.last?.z??z))/(moved||1),z:z-side*.12*(x-(state.last?.x??x))/(moved||1),strength:Math.min(1,.38+moved/Math.max(.001,dt)*.10)})
        state.distance=0
      }
    }else state.distance=0
    state.wet=wet
    state.last??=new THREE.Vector3()
    state.last.set(x,y,z)
    const d=state.dummy
    let changed=false
    state.bursts.forEach((b,i)=>{
      if(b.age>.75) return
      changed=true
      b.age+=dt
      const t=b.age
      d.position.set(b.x,.068,b.z);d.rotation.set(-Math.PI/2,0,0)
      d.scale.setScalar(t<.75?(t+.10)*b.strength:0);d.updateMatrix();rings.current.setMatrixAt(i,d.matrix)
      for(let k=0;k<6;k++){
        const a=k*2.4+i, v=(1.45+.16*(k%3))*b.strength, h=t*(v-3.8*t)
        d.position.set(b.x+Math.cos(a)*t*.8,.07+h,b.z+Math.sin(a)*t*.8)
        d.scale.setScalar(h>0?.024*b.strength:0);d.updateMatrix();drops.current.setMatrixAt(i*6+k,d.matrix)
      }
    })
    if(changed){
      rings.current.instanceMatrix.needsUpdate=true
      drops.current.instanceMatrix.needsUpdate=true
    }
  })
  return <>
    <instancedMesh ref={drops} args={[undefined,undefined,30]} frustumCulled={false}>
      <sphereGeometry args={[1,6,4]} /><meshBasicMaterial color="#dafbf6" transparent opacity={.76} depthWrite={false}/>
    </instancedMesh>
    <instancedMesh ref={rings} args={[undefined,undefined,5]} frustumCulled={false}>
      <ringGeometry args={[.94,1,36]} /><meshBasicMaterial color="#d5f6ea" transparent opacity={.4} depthWrite={false}/>
    </instancedMesh>
  </>
}
