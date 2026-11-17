import { Box, Cyl, GEO, Instances, mat, texMat } from './kit.jsx'
import { getSignTexture } from './textures.js'

const frame=mat('#5c4041')
const linen=mat('#fff2d6')
const bulb=mat('#ffe4aa',{emissive:'#ffbe64',emissiveIntensity:1.4})
const lamps=Array.from({length:7},(_,i)=>({p:[(i-3)*.57,2.61+.018*(i-3)**2,1.19],s:[.095,.125,.095]}))
const sticks=Array.from({length:8},(_,i)=>({p:[-.92+(i%4)*.28,1.29,.52-Math.floor(i/4)*.34],s:[.026,.59,.026],r:[0,0,-.16]}))
const palette=mat('#ffffff')
function CounterDisplay({kind}) {
  if(kind==='drink') return <>{[-.8,0,.8].map((x,i)=><group key={x}>
    <Cyl p={[x,1.35,.26]} rad={.26} h={.66} c={['#cf738b','#eab055','#77b9a3'][i]} />
    <Cyl p={[x,1.70,.26]} rad={.28} h={.055} m={linen}/>
    <Box p={[x,1.2,.54]} s={[.08,.1,.12]} m={frame}/>
  </group>)}</>
  if(kind==='fan') return <Instances geometry={GEO.sphere} material={palette} items={sticks.map((s,i)=>({p:[s.p[0]+.05,1.59,s.p[2]],s:[.11,.12,.11],c:i%2?'#d7b6ed':'#f4aabb'}))}/>
  if(kind==='cakes') return <>{[-.8,0,.8].map(x=><group key={x}>
    <Cyl p={[x,1.10,.4]} rad={.34} h={.06} m={linen}/>
    <Cyl p={[x,1.20,.4]} rad={.23} h={.16} c="#d19760"/>
    <Cyl p={[x,1.30,.4]} rad={.20} h={.07} c="#f5c4cc"/>
  </group>)}</>
  return <>
    <Box p={[0,1.08,.31]} s={[2.55,.10,.92]} c="#756567"/>
    <Instances geometry={GEO.sphere} material={palette} items={sticks.map(s=>({p:[s.p[0],1.35,s.p[2]],s:[.105,.17,.11],c:kind==='fish'?'#e6bd7c':'#ba6243'}))}/>
  </>
}
export function FestivalCart({item}) {
  const sign=item.signs[0], accent=mat(sign.bg)
  return <group>
    <Box p={[0,.54,0]} s={[3.8,.95,1.70]} m={accent}/>
    <Box p={[0,1.02,0]} s={[4,.10,1.91]} m={linen}/>
    {[-1.85,1.85].map(x=>[-.78,.78].map(z=><Box key={x+','+z} p={[x,1.83,z]} s={[.075,1.63,.075]} m={frame}/>))}
    {Array.from({length:8},(_,i)=><group key={i} position={[(i-3.5)*.53,0,0]}>
      {[-1,1].map(side=><Box key={side} p={[0,2.79,side*.59]} s={[.532,.09,1.30]} r={[side*.33,0,0]} m={i%2?linen:accent}/>)}
    </group>)}
    <Instances geometry={GEO.sphere} material={bulb} items={lamps}/>
    <mesh geometry={GEO.plane} position={[0,2.18,.85]} scale={[2.65,.52,1]} material={texMat(getSignTexture(sign.text,sign.bg,sign.fg,5.1),{emissive:'#ffffff',emissiveIntensity:.28})}/>
    <CounterDisplay kind={item.menu}/>
    {['fan','fish','grill'].includes(item.menu)&&<Instances geometry={GEO.box} material={frame} items={sticks}/>}
  </group>
}
