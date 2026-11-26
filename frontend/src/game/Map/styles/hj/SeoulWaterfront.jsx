import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { GEO, Instances, mat } from '../kit.jsx'

// East of the square: stream, office block, riverside path and Han River.
export const CHANNELS = [[52, 64], [112, 156]]
export const BRIDGES = [[52, 64, -58, 4], [52, 64, 0, 5], [52, 64, 55, 4], [112, 156, 28, 6]]
export const BANK_END = 83
export function dryRects(left, right, near, far) {
  const rects = [[left,right,near,-BANK_END],[left,right,BANK_END,far]]
  let start = left
  for (const [a,b] of CHANNELS) {
    if (a > right || b < left) continue
    if (start < a) rects.push([start,a,-BANK_END,BANK_END])
    start = Math.max(start,b)
  }
  if (start < right) rects.push([start,right,-BANK_END,BANK_END])
  return rects.filter(([a,b,c,d]) => b>a && d>c)
}

const solids=[], greenery=[], lamps=[], stone=mat('#ffffff'), glow=mat('#ffffff',{emissive:'#72583a',emissiveIntensity:.55})
function box(x,y,z,w,h,d,c,r=0) {
  solids.push({p:[x,y,z],s:[w,h,d],c,r:[r,0,0]})
}
function light(x,y,z,w,h,d,c) { lamps.push({p:[x,y,z],s:[w,h,d],c}) }
for(const [left,right] of CHANNELS) {
  for(const edge of [left,right]) {
    const inland=edge===left?-1:1
    box(edge,-.78,0,.45,1.65,166,'#96928a')
    box(edge+inland*2,.04,0,4,.08,166,'#c1b6a4')
    for(let z=-80;z<=80;z+=4) {
      const crossing=BRIDGES.some(([a,,cz,w])=>a===left && Math.abs(z-cz)<w/2+2)
      if (!crossing) {
        box(edge,.55,z,.08,1.1,.08,'#464f50')
        box(edge,1.03,z,.07,.08,3.98,'#656b68')
      }
      if(z%8===0) {
        light(edge-inland*.23,-.35,z,.1,.18,.5,'#ffe4a2')
        if(left===52) {
          const tint=['#db5873','#d3a640','#85bb88','#b488c8'][Math.abs(z/8)%4]
          box(edge+inland*.65,1.3,z,.045,2.6,.045,'#554838')
          lamps.push({p:[edge+inland*.65,2.43,z],s:[.35,.45,.35],c:tint})
          greenery.push({p:[edge-inland*.48,-.72,z+.9],s:[.55,.45,1.15],c:'#497548'})
        }
      }
    }
  }
}
for(const [a,b,z,w] of BRIDGES) {
  const span=b-a
  box((a+b)/2,-.09,z,span+.6,.22,w,'#a09f9a')
  for(const side of [-1,1]) {
    const zz=z+side*w/2
    const deep=a>100
    const rise=deep?4.1:1.1
    box((a+b)/2,rise,zz,span,.14,.13,deep?'#6c99aa':'#735e4d')
    for(let x=a;x<b;x+=4) {
      box(x,rise/2,zz,.13,rise,.13,'#637e84')
      if(deep){
        solids.push({p:[x+2,rise/2,zz],s:[.14,Math.hypot(4,rise),.13],r:[0,0,(Math.round((x-a)/4)%2?1:-1)*Math.atan2(4,rise)],c:'#88acb5'})
        light(x, rise+.1,zz,.23,.16,.23,'#bbedff')
      }
    }
  }
}
// Admiral's bronze silhouette above the pale stepped pedestal on the plaza axis.
box(0,.20,-32,5,.40,5,'#bbb7ab')
box(0,2.45,-32,2.6,4.1,2.4,'#c8c3b2')
box(0,4.65,-32,3,.3,2.8,'#918d7a')
greenery.push({p:[0,5.8,-32],s:[.64,1.12,.43],c:'#45584f'},
  {p:[0,7.12,-32],s:[.32,.39,.32],c:'#506158'})
box(-.43,5.05,-31.8,.24,1.35,.36,'#45584f')
box(.43,5.05,-31.8,.24,1.35,.36,'#45584f')
box(.68,5.7,-31.9,.10,2.55,.13,'#817963',-.13)
for(let z=-44;z<54;z+=3) box(0,.056,z,.38,.04,2.85,'#8fa7aa')

const waterVertex = `
varying vec2 v;
void main(){ v=position.xy; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`
const waterFragment = `
uniform float time;
uniform vec3 deep, pale;
varying vec2 v;
void main(){
 float ripple=sin(v.y*3.7+v.x*.6+time*1.5+sin(v.x*.82-time*.45));
 float streak=pow(max(0.,ripple),12.)*(.5+.5*sin(v.y*.37+v.x*.8));
 float bands=.5+.5*sin(v.x*.32+sin(v.y*.16+time*.23));
 gl_FragColor=vec4(mix(deep,pale,.12+.23*bands+.35*streak),1.);
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
}`
function Water({left,right}) {
  const material=useRef(null)
  useFrame(({clock})=>{material.current.uniforms.time.value=clock.elapsedTime})
  return <mesh position={[(left+right)/2,-.85,0]} rotation-x={-Math.PI/2}>
    <planeGeometry args={[right-left,166]}/>
    <shaderMaterial ref={material} vertexShader={waterVertex} fragmentShader={waterFragment}
      uniforms={{time:{value:0},deep:{value:new THREE.Color(left===52?'#203c3a':'#1c4765')},pale:{value:new THREE.Color(left===52?'#90ac94':'#87bdd2')}}}/>
  </mesh>
}
export function SeoulWaterfront() {
  return <>
    {CHANNELS.map(([left,right])=><Water key={left} left={left} right={right}/>)}
    <Instances geometry={GEO.box} material={stone} items={solids}/>
    <Instances geometry={GEO.ico} material={stone} items={greenery}/>
    <Instances geometry={GEO.box} material={glow} items={lamps}/>
  </>
}
