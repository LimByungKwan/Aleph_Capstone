import { useEffect, useMemo } from 'react'
import { CatmullRomCurve3, LatheGeometry, TubeGeometry, Vector2, Vector3 } from 'three'
import { Box, Cyl, GEO, Instances, mat } from '../kit.jsx'
import { ArchOpening, StreetSign } from './GyeongseongMasonry.jsx'
import { StreetSurface } from './GyeongseongMaterial.jsx'
import { STREET_FLOOR, streetShell } from './gyeongseongLayout.js'

const STONE = '#c1b69d'
const MORTAR = '#968876'
const COPPER = '#507d72'
const TIMBER = '#67513a'
const TRIM = mat('#fff')
const DOME_PROFILE = [[2.18,0],[2.17,.25],[2.04,.59],[1.76,1.03],[1.43,1.38],[1.01,1.67],[.62,1.85],[.29,1.96],[.11,2.03],[0,2.03]]
const RIBS = Array.from({ length: 16 }, (_, index) => ({
  p:[0,0,0], r:[0,index * Math.PI/8,0], s:[1,1,1],
}))

function StationDome({ y }) {
  const shapes = useMemo(() => {
    const dome = new LatheGeometry(DOME_PROFILE.map(([r,h]) => new Vector2(r,h)), 56)
    const seam = new CatmullRomCurve3(DOME_PROFILE.map(([r,h]) => new Vector3(r + .008,h+.01,0)))
    return { dome, edge:new TubeGeometry(seam,24,.024,4,false) }
  }, [])
  useEffect(() => () => Object.values(shapes).forEach((geometry) => geometry.dispose()), [shapes])
  return (
    <group position-y={y}>
      <Cyl p={[0,.04,0]} rad={2.27} h={.17} c="#6f7869" />
      <mesh geometry={shapes.dome} material={mat(COPPER,{roughness:.60,metalness:.38})} castShadow receiveShadow />
      <Instances geometry={shapes.edge} material={mat('#74968b',{roughness:.56,metalness:.46})} items={RIBS} />
      <Cyl p={[0,2.14,0]} rad={.143} h={.26} c="#7b8263" />
      <Cyl p={[0,2.37,0]} rad={.042} h={.35} c="#959372" />
    </group>
  )
}

function StationRoof({ w, d, h }) {
  const caps = useMemo(() => {
    const parts = []
    for (const side of [-1,1]) {
      const x = side * (w/2-2.12)
      for (const facing of [-1,1]) {
        parts.push({ p:[x,h+.63,facing*1.08],s:[4.20,.119,2.39],r:[facing*.32,0,0],c:'#606860' })
      }
      parts.push({ p:[x,h+1.014,0],s:[4.24,.122,.16],c:'#6d766b' })
      for (let i=0; i<10; i+=1) {
        for (const facing of [-1,1]) parts.push({
          p:[x+(i-4.5)*.42,h+.701,facing*1.08], s:[.046,.054,2.35], r:[facing*.32,0,0], c:'#81887a',
        })
      }
    }
    return parts
  }, [w,h])
  return (
    <>
      <Box p={[0,h-.11,0]} s={[w+.32,.21,d+.25]} c={STONE} castShadow />
      <Box p={[0,h+.15,0]} s={[w+.29,.30,d+.23]} c="#696d62" castShadow />
      <Box p={[0,h+.41,0]} s={[5.23,.43,d+.19]} c="#ab9983" />
      <Cyl p={[0,h+.72,0]} rad={2.12} h={.59} c="#737b69" />
      <StationDome y={h+1.0} />
      <Instances geometry={GEO.box} material={TRIM} items={caps} castShadow />
    </>
  )
}

function StationInterior({ w, d, h, materials, scans }) {
  const counterZ = d/2 - 1.22
  const wall = d/2 - .262
  const detail = useMemo(() => {
    const woodwork = []
    for (let i = 0; i < 22; i += 1) {
      woodwork.push({ p:[(i-10.5)*.71,.64,wall-.111],s:[.038,1.02,.053],c:'#a1815d' })
    }
    for (let i = 0; i < 19; i += 1) {
      woodwork.push({ p:[(i-9)*.171,1.432,counterZ-.20],s:[.034,.83,.051],c:'#a1855e' })
    }
    for (const side of [-1,1]) {
      for (let i = 0; i < 10; i += 1) woodwork.push({
        p:[side*(w/2-.28),.68,(i-4.5)*.65],s:[.041,.94,.042],c:'#8a6e52',
      })
    }
    return woodwork
  }, [w,wall,counterZ])
  return (
    <group name="경성역 대합실">
      <StreetSurface scan={scans.stone} w={w-.29} h={d-.18} p={[0,.006,0]} rotation={[-Math.PI/2,0,0]} />
      <Box p={[0,h/2,wall-.04]} s={[w-.51,h,.071]} c="#bcad92" />
      <StreetSurface scan={scans.timber} w={w-.55} h={1.12} p={[0,.60,wall-.085]} rotation={[0,Math.PI,0]} />
      <Box p={[0,1.177,wall-.088]} s={[w-.47,.112,.17]} c="#80664a" />
      <Box p={[0,h-.91,wall-.11]} s={[w-.50,.17,.21]} c="#a29378" />
      <Instances geometry={GEO.box} material={TRIM} items={detail} />
      <Box p={[0,.985,counterZ]} s={[4.84,.13,.81]} c="#8a6d4b" />
      <Box p={[0,.48,counterZ]} s={[4.64,.93,.74]} c={TIMBER} />
      <StreetSurface scan={scans.timber} w={4.52} h={.83} p={[0,.48,counterZ-.376]} rotation={[0,Math.PI,0]} />
      <Box p={[0,1.817,counterZ-.20]} s={[3.37,.092,.099]} c="#b39670" />
      <StreetSign text="표 파는 곳" p={[0,2.055,counterZ-.277]} w={3.36} h={.40} background="#344840" />
      <Cyl p={[0,3.79,wall-.11]} rad={.42} h={.13} r={[Math.PI/2,0,0]} c="#62513e" />
      <Cyl p={[0,3.79,wall-.183]} rad={.35} h={.025} r={[Math.PI/2,0,0]} c="#efdeaf" />
      <Box p={[.06,3.87,wall-.203]} s={[.029,.20,.018]} r={[0,0,-.63]} c="#4e4333" />
      <Box p={[-.079,3.74,wall-.206]} s={[.19,.029,.018]} r={[0,0,.42]} c="#4e4333" />
      {[-1,1].map((side) => (
        <group key={side}>
          <Box p={[side*1.74,1.49,counterZ-.20]} s={[.105,.95,.12]} c={TIMBER} />
          <Box p={[side*4.85,.47,counterZ-.50]} s={[2.35,.091,.48]} c="#946d4d" />
          <Box p={[side*4.85,.74,counterZ-.27]} s={[2.36,.38,.085]} c={TIMBER} />
          <Box p={[side*4.85,.225,counterZ-.50]} s={[1.92,.42,.12]} c="#736452" />
          <Box p={[side*3.22,2.57,0]} s={[.25,.28,.25]} m={materials.lamp} />
          <Box p={[side*(w/2-.29),h/2,0]} s={[.076,h,d-.56]} c="#b3a285" />
          <StreetSurface scan={scans.timber} p={[side*(w/2-.34),.60,0]}
            w={d-.63} h={1.12} rotation={[0,-side*Math.PI/2,0]} />
          <Box p={[side*(w/2-.34),1.177,0]} s={[.16,.112,d-.56]} c="#80664a" />
          <Box p={[side*3.55,2.76,wall-.115]} s={[.24,.37,.22]} m={materials.lamp} />
          <Box p={[side*3.55,2.98,wall-.115]} s={[.32,.076,.29]} c="#6d624b" />
        </group>
      ))}
      <StreetSign text="열차 안내" p={[-5.04,2.95,wall-.104]} w={1.89} h={.35} background="#625340" />
      <StreetSign text="정문 · 경성 거리" p={[5.04,2.95,wall-.104]} w={1.88} h={.35} background="#625340" />
      <pointLight position={[0,3.38,-.15]} color="#ffcd8b" intensity={13} distance={8.5} />
    </group>
  )
}

export default function GyeongseongStation({ building, materials, scans }) {
  const { x,z,w,d,h,yaw,paint } = building
  const { opening, doorHeight, walls } = streetShell(building)
  const face = -d/2
  const wing = (w-opening)/2
  const stonework = useMemo(() => {
    const parts = []
    for (const x of [-w/2+.20,-5.29,-2.29,2.29,5.29,w/2-.20]) {
      parts.push({ p:[x,2.89,face-.10],s:[.29,5.56,.25],c:'#b5a88f' })
      for (let row=0; row<10; row+=1) parts.push({
        p:[x,.57+row*.525,face-.139],s:[row%2 ? .40 : .46,.466,.21],c:row%2 ? STONE : '#baa98e',
      })
      parts.push({ p:[x,5.53,face-.21],s:[.56,.16,.42],c:STONE })
    }
    for (const y of [3.24,5.68,5.95]) parts.push({
      p:[0,y,face-.155],s:[w+.35,.095,.35],c:STONE,
    })
    for (const side of [-1,1]) {
      for (const y of [.41,.61,2.67]) {
        parts.push({ p:[side*(opening+wing)/2,y,face-.12],s:[wing,.11,.28],c:STONE })
      }
      for (let i=0; i<11; i+=1) parts.push({
        p:[side*(2.65+i*.49),5.865,face-.227],s:[.132,.163,.134],c:'#a69c85',
      })
    }
    return parts
  }, [w,opening,wing,face])
  return (
    <group name="1932 경성역 · 100일의 거짓말 테마" position={[x,STREET_FLOOR,z]} rotation-y={yaw*Math.PI/180}>
      <Box p={[0,-.057,0]} s={[w+.20,.114,d+.20]} c={MORTAR} />
      <Box p={[0,-.073,face-.23]} s={[opening+.2,.09,.42]} c={STONE} />
      {walls.map((wall, i) => <Box key={i} p={[wall.x,wall.h/2,wall.z]} s={[wall.w,wall.h,wall.d]} c={paint} castShadow />)}
      <Box p={[0,(h+doorHeight)/2,face+.13]} s={[opening,h-doorHeight,.25]} c={paint} castShadow />
      {[-1,1].map((side) => (
        <group key={side}>
          <StreetSurface scan={scans.brick} p={[side*(opening+wing)/2,h/2,face-.014]} w={wing} h={h} rotation={[0,Math.PI,0]} />
          <StreetSurface scan={scans.brick} p={[side*(w/2+.01),h/2,0]} w={d} h={h} rotation={[0,side*Math.PI/2,0]} />
          <StreetSurface scan={scans.stone} p={[side*(opening+wing)/2,.346,face-.019]} w={wing} h={.69} rotation={[0,Math.PI,0]} />
          {[3.77,6.70].map((at) => (
            <group key={at}>
              <ArchOpening x={side*at} y={.75} face={face-.035} radius={.55} rise={1.12} material={materials.glass} />
              <ArchOpening x={side*at} y={3.63} face={face-.038} radius={.56} rise={.87} material={materials.glass} />
            </group>
          ))}
          {[-1.95,0,1.95].map((at) => (
            <group key={at} position={[side*(w/2+.022),3.12,at]} rotation-y={side*Math.PI/2}>
              <Box p={[0,.985,.05]} s={[1.18,1.42,.13]} c={STONE} />
              <Box p={[0,.985,.124]} s={[.87,1.13,.041]} m={materials.glass} />
              <Box p={[0,.985,.153]} s={[.059,1.16,.043]} c="#4d574e" />
              <Box p={[0,.47,.14]} s={[1.29,.115,.21]} c={STONE} />
            </group>
          ))}
        </group>
      ))}
      <StreetSurface scan={scans.brick} p={[0,(h+doorHeight)/2,face-.016]} w={opening} h={h-doorHeight} rotation={[0,Math.PI,0]} />
      <StreetSurface scan={scans.brick} p={[0,h/2,d/2+.01]} w={w} h={h} />
      <Instances geometry={GEO.box} material={TRIM} items={stonework} castShadow />
      <ArchOpening x={0} y={3.87} face={face-.110} radius={1.32} rise={.36} material={materials.glass} />
      <Box p={[0,3.2,face-.22]} s={[4.24,.68,.32]} c="#625848" />
      <StreetSign text="경성역" p={[0,3.2,face-.39]} w={3.99} h={.52} background="#344840" />
      <StationRoof w={w} d={d} h={h} />
      <StationInterior w={w} d={d} h={h} materials={materials} scans={scans} />
      <Box p={[-2.42,2.15,face-.231]} s={[.22,.42,.28]} m={materials.lamp} />
      <Box p={[2.42,2.15,face-.231]} s={[.22,.42,.28]} m={materials.lamp} />
    </group>
  )
}
