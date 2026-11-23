import { useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { Color, MeshStandardMaterial } from 'three'
import { live } from '../../../timeOfDay.js'
import { Box, Cyl, GEO, Instances, mat, seeded } from '../kit.jsx'
import { getTiledTexture } from '../textures.js'
import { tiledRoof } from './gyeongbokgungMaterials.js'
import { ALLEY_BENCH, STREET, STREET_ALLEYS, STREET_BUILDINGS, STREET_FLOOR, STREET_GATE, TRAM, streetShell } from './gyeongseongLayout.js'
import GyeongseongMasonry, { StreetSign } from './GyeongseongMasonry.jsx'
import GyeongseongBuildingDetails from './GyeongseongBuildingDetails.jsx'
import GyeongseongStreetLife from './GyeongseongStreetLife.jsx'
import GyeongseongStation from './GyeongseongStation.jsx'
import { StreetSurface, useStreetScans } from './GyeongseongMaterial.jsx'
import { streetRoadTexture, streetStuccoTexture } from './gyeongseongSurfaces.js'
import ArchitecturalMasonry from './ArchitecturalMasonry.jsx'

const WOOD = '#483329'
const SLATE = '#484b49'
const DETAILS = mat('#fff')
const DAY_GLASS = new Color('#3e5f63')
const NIGHT_GLASS = new Color('#cfad71')

function StreetEntry({ roofMaterial }) {
  const { x, z, post } = STREET_GATE
  const roof = useMemo(() => tiledRoof(7.7, 1.72, .52), [])
  useEffect(() => () => roof.dispose(), [roof])
  return (
    <group position={[x, .105, z]} name="1938 경성 거리 입구">
      {[-1, 1].map((side) => (
        <group key={side} position-x={side * post}>
          <Box p={[0, .14, 0]} s={[.66, .28, .65]} c="#8f8170" />
          <Box p={[0, 1.73, 0]} s={[.38, 2.96, .43]} c={WOOD} />
          <Box p={[0, 2.57, -.27]} s={[.27, .41, .35]} m={mat('#e7ca84', { emissive: '#d48749', emissiveIntensity: .4 })} />
        </group>
      ))}
      <Box p={[0, 2.91, 0]} s={[7.1, .32, .58]} c="#544135" />
      <Box p={[0, 2.78, -.25]} s={[4.62, .73, .18]} c="#6e4e35" />
      <StreetSign text="1938 경성 거리" p={[0, 2.78, -.346]} w={4.38} h={.59} />
      <mesh geometry={roof} material={roofMaterial} position-y={3.16} />
    </group>
  )
}

function ShopWindows({ building, materials }) {
  const { h, w, d, kind } = building
  const trim = []
  const lit = []
  const bays = Math.max(2, Math.floor(w / 2.6))
  for (let i = 0; i < bays; i += 1) {
    const x = (i + .5 - bays / 2) * w / bays
    if (Math.abs(x) >= 1.9) {
      trim.push({ p:[x,1.46,-d / 2 - .026], s:[1.42,1.30,.13], c:WOOD })
      lit.push({ p:[x,1.46,-d / 2 - .10], s:[1.25,1.11,.04] })
      trim.push({ p:[x,1.46,-d / 2 - .135], s:[.06,1.12,.031], c:WOOD })
      trim.push({ p:[x,1.51,-d / 2 - .14], s:[1.26,.05,.029], c:WOOD })
      trim.push({ p:[x,.78,-d / 2 - .069], s:[1.5,.13,.24], c:'#aa8f72' })
    }
    if (h < 4.48) continue
    const y = h * .72
    trim.push({ p:[x, y, -d / 2], s:[1.20,1.15,.17], c:WOOD })
    lit.push({ p:[x, y, -d / 2 - .10], s:[1.02,.93,.034] })
    for (const u of [-.19,.19]) trim.push({ p:[x + u,y,-d / 2 - .126], s:[.039,.94,.025], c:WOOD })
    trim.push({ p:[x,y + .075,-d / 2 - .127], s:[1.01,.039,.026], c:WOOD })
    trim.push({ p:[x,y - .65,-d / 2 - .081], s:[1.31,.13,.23], c:'#cfb38e' })
  }
  return (
    <>
      <Instances geometry={GEO.box} material={DETAILS} items={trim} />
      <Instances geometry={GEO.box} material={materials.glass} items={lit} />
      {kind === 'restaurant' && [-2.74, 2.74].map((x) => (
        <Cyl key={x} p={[x, 2.48, -d / 2 - .50]} rad={.14} h={.34} m={materials.redLantern} />
      ))}
    </>
  )
}

function ShopAwning({ width, face, kind }) {
  const palette = kind === 'restaurant' ? ['#a45747','#dfc3a1'] : ['#4b6661','#d9cbb0']
  const span = Math.min(7.8, width - .42)
  const size = span / 14
  const panels = Array.from({ length: 14 }, (_, i) => {
    const x = (i - 6.5) * size
    const color = palette[i % 2]
    return [
      { p:[x,2.68,face-.57],s:[size,.052,1.11],r:[-.29,0,0],c:color },
      { p:[x,2.415,face-1.106],s:[size,.255,.046],c:color },
    ]
  }).flat()
  return <Instances geometry={GEO.box} material={DETAILS} items={panels} castShadow />
}

function Shop({ building, materials, roofMaterial, scans, brick }) {
  const { x, z, yaw, w, d, h, paint, name, kind } = building
  const { opening, walls } = streetShell(building)
  const zFace = -d / 2
  const pressWalls = useMemo(() => {
    if (!building.press) return null
    const { walls, opening, doorHeight } = streetShell(building)
    return [
      ...walls.map(wall => ({ ...wall, base:wall.base ?? 0, top:(wall.base ?? 0)+wall.h })),
      { x:0,z:zFace+.13,w:opening,d:.25,base:doorHeight,top:h },
    ]
  }, [building,h,zFace])
  const roof = useMemo(() => kind === 'restaurant' ? tiledRoof(w + 1.4, d + 1.2, 1.33) : null, [w, d, kind])
  useEffect(() => () => roof?.dispose(), [roof])
  const large = kind === 'cinema' || kind === 'restaurant'
  const masonry = kind === 'stoneStudio'
  const wing = (w - opening) / 2
  const lower = kind === 'restaurant' ? .88 : kind === 'studio' ? h : 1.05
  const facadeScan = kind === 'restaurant' ? scans.timber : scans.brick
  return (
    <group name={name} position={[x, STREET_FLOOR, z]} rotation-y={yaw * Math.PI / 180}>
      <Box p={[0, -.0575, 0]} s={[w + .20,.115,d + .20]} c="#a09281" />
      <Box p={[0,-.07,-d / 2 - .23]} s={[opening+.20,.09,.42]} c="#a39480" />
      {pressWalls
        ? <ArchitecturalMasonry parts={pressWalls} material={brick} repeatX={2.42} repeatY={1.37} />
        : <>
          {walls.map((wall, index) => <Box key={index} p={[wall.x, (wall.base ?? 0) + wall.h/2, wall.z]} s={[wall.w,wall.h,wall.d]} c={paint} castShadow />)}
          <Box p={[0,(2.48 + h)/2,zFace+.13]} s={[opening,h-2.48,.25]} c={paint} castShadow />
        </>}
      {[-1,1].map((side) => (
        <group key={side}>
          <Box p={[side * (opening / 2 + .09),1.23,zFace-.045]} s={[.18,2.46,.21]} c={WOOD} />
          {!masonry && <Box p={[side * (w / 2 - .15),h * .48,zFace-.087]} s={[.31,h*.95,.22]} c="#7e5c46" />}
          {!pressWalls && !masonry && <StreetSurface scan={facadeScan} p={[side*(opening+wing)/2,lower/2,zFace-.016]}
            w={wing} h={lower} rotation={[0,Math.PI,0]} />}
          {!masonry && lower < h && (
            <mesh position={[side*(opening+wing)/2,(h+lower)/2,zFace-.015]} rotation-y={Math.PI} receiveShadow>
              <planeGeometry args={[wing,h-lower]} />
              <meshStandardMaterial map={materials.stucco} bumpMap={materials.stucco} bumpScale={.04} color={paint} roughness={.93} />
            </mesh>
          )}
          <Box p={[side * w * .29,.41,d / 2 - 1.07]} s={[w*.23,.82,.79]} c="#70513a" />
          <Box p={[side * w * .29,.86,d / 2 - 1.07]} s={[w*.25,.09,.86]} c="#9d7450" />
        </group>
      ))}
      {masonry ? <GyeongseongMasonry building={building} opening={opening} materials={materials} scans={scans} /> : (
        <>
          <ShopWindows building={building} materials={materials} />
          <ShopAwning width={w} face={zFace} kind={kind} />
          <Box p={[0,3.16,zFace-.15]} s={[Math.min(w-.65,7.1),.68,.22]} c="#906a46" />
          <StreetSign text={name} p={[0,3.16,zFace-.269]} w={Math.min(w-.88,6.88)} background={kind === 'cinema' ? '#334e4a' : '#58402e'} />
          <Box p={[0,h-.15,0]} s={[w+.48,.22,d+.42]} c={kind === 'cinema' ? '#a29986' : '#6f5949'} />
          <Box p={[0,h-.52,0]} s={[w+.21,.086,d+.21]} c="#b49b7c" />
          {roof ? <mesh geometry={roof} material={roofMaterial} position-y={h} castShadow />
            : <Box p={[0,h+.03,0]} s={[w+.33,.21,d+.31]} c={SLATE} name={building.press ? 'camera-blocker' : undefined} castShadow />}
        </>
      )}
      {kind === 'cinema' && (
        <group position={[w/2-.57,4.53,zFace-.37]}>
          <Box p={[0,0,0]} s={[.69,2.45,.47]} c="#385c56" />
          {[1,0,-1].map((v,i) => <StreetSign key={v} text={['은','하','관'][i]} p={[0,v*.67,-.239]} w={.57} h={.57} background="#385c56" />)}
        </group>
      )}
      <GyeongseongBuildingDetails building={building} materials={materials} scans={scans} />
      {large && <pointLight position={[0,2.3,d*.10]} color="#ffd197" intensity={11} distance={6.3} />}
      {!large && <Box p={[0,2.06,d / 2-.25]} s={[.22,.42,.20]} m={materials.lamp} />}
    </group>
  )
}

function TramStop({ building, materials }) {
  const { x,z,w,d,yaw,name } = building
  return (
    <group position={[x,.17,z]} rotation-y={yaw * Math.PI / 180} name={name}>
      {[-1,1].map((side) => <Box key={side} p={[side * (w/2-.3),1.19,.57]} s={[.14,2.38,.16]} c="#405246" />)}
      <Box p={[0,2.42,0]} s={[w+.32,.24,d+.22]} c="#465b50" />
      <Box p={[0,.51,.56]} s={[w-.6,.14,.42]} c="#735437" />
      <Box p={[0,1.99,-d/2-.05]} s={[w-.36,.51,.11]} c="#9e805a" />
      <StreetSign text={name} p={[0,1.99,-d/2-.112]} w={w-.55} h={.44} background="#385447" />
      <Box p={[0,2.2,.14]} s={[.24,.24,.26]} m={materials.lamp} />
    </group>
  )
}

function StreetTram({ materials }) {
  return (
    <group position={[TRAM.x,.16,TRAM.z]} name="1938 경성 전차">
      <Box p={[0,.55,0]} s={[2.04,.42,6.8]} c="#303b33" />
      <Box p={[0,1.0,0]} s={[2.0,.61,6.67]} c="#446451" />
      <Box p={[0,1.91,0]} s={[1.96,1.35,6.5]} c="#7b6047" />
      <Box p={[0,2.63,0]} s={[2.19,.24,6.96]} c="#3e4a42" />
      <Box p={[0,2.78,0]} s={[1.61,.14,6.35]} c="#697160" />
      {[-1,1].map((side) => (
        <group key={side}>
          {[-2.44,-1.22,0,1.22,2.44].map(z => (
            <Box key={z} p={[side*.993,1.92,z]} s={[.035,.66,.94]} m={materials.glass} />
          ))}
          {[-2.11,2.11].map(z => (
            <Cyl key={z} p={[side*.80,.377,z]} rad={.30} h={.21} c="#302a28" r={[0,0,Math.PI/2]} />
          ))}
          <Box p={[0,1.90,side*3.27]} s={[1.46,.65,.055]} m={materials.glass} />
          <Box p={[0,1.91,side*3.31]} s={[.071,.68,.045]} c={WOOD} />
          <Box p={[0,.92,side*3.36]} s={[.30,.26,.12]} m={materials.lamp} />
        </group>
      ))}
      <StreetSign text="경성 01" p={[0,2.44,-3.375]} w={1.18} h={.31} background="#40564a" />
    </group>
  )
}

const STREET_LAMPS = [[-13.7,22.1],[-2.5,23.75],[-13.45,29.25],[-2.5,30],[-13.3,40.85],[-2.63,44.25],[21.5,34.3]]

export default function GyeongseongStreet({ roofMaterial, brick }) {
  const scans = useStreetScans()
  const materials = useMemo(() => ({
    road: streetRoadTexture(),
    stucco: streetStuccoTexture(),
    paving: getTiledTexture('paver', 2.12, 25),
    alleyLong: getTiledTexture('stone', 2.1, 12),
    alleyCross: getTiledTexture('stone', 13, 2.3),
    glass: new MeshStandardMaterial({ color:DAY_GLASS, emissive:'#f6a85d', emissiveIntensity:0, roughness:.33, metalness:.17 }),
    carGlass: new MeshStandardMaterial({ color:'#57747b', emissive:'#233c43', emissiveIntensity:.13, roughness:.29, metalness:.36 }),
    lamp: new MeshStandardMaterial({ color:'#e7c690', emissive:'#f6a85d', emissiveIntensity:.38, roughness:.58 }),
    redLantern: new MeshStandardMaterial({ color:'#c48460', emissive:'#da594c', emissiveIntensity:.58 }),
  }), [])
  useEffect(() => () => Object.values(materials).forEach((material) => material.dispose()), [materials])
  useFrame(() => {
    materials.glass.color.copy(DAY_GLASS).lerp(NIGHT_GLASS, live.stars)
    materials.glass.emissiveIntensity = .045 + live.stars * .98
    materials.lamp.emissiveIntensity = .28 + live.stars * .87
    materials.redLantern.emissiveIntensity = .27 + live.stars * .64
  })
  const track = Array.from({ length: 63 }, (_, index) => 17.55 + index * .50)
  const curbs = [-1,1].flatMap((side) => Array.from({ length: 44 }, (_, i) => ({
    p:[STREET.x + side * (STREET.roadWidth / 2 + .07),.183,14.43 + i*.83],
    s:[.155,.052,.813], c:['#9c9283','#aaa090','#948a7b'][i % 3],
  })))
  return (
    <group name="구미호뎐 1938 테마 거리">
      <Box p={[0,.124,STREET.z]} s={[STREET.w,.036,STREET.d]} c="#ad9d83" userData={{ noShadow:true }} />
      <mesh position={[STREET.x,.168,STREET.z]} rotation-x={-Math.PI / 2} userData={{ noShadow:true }}>
        <planeGeometry args={[STREET.roadWidth,STREET.d]} />
        <meshStandardMaterial map={materials.road} bumpMap={materials.road} bumpScale={.018} roughness={.94} />
      </mesh>
      {STREET_ALLEYS.map(([x,z,w,d], index) => (
        <mesh key={`${x},${z}`} position={[x,.168 + index * .001,z]} rotation-x={-Math.PI / 2} userData={{ noShadow:true }}>
          <planeGeometry args={[w,d]} />
          <meshStandardMaterial map={index % 3 === 1 ? materials.alleyLong : materials.alleyCross}
            color="#ccb8a0" roughness={.93} />
        </mesh>
      ))}
      {[-1,1].map((side) => (
        <group key={side}>
          <Box p={[STREET.x + side * 5.22,.165,STREET.z]} s={[2.05,.043,STREET.d]} c="#aca28d" />
          <mesh position={[STREET.x + side * 5.22,.188,STREET.z]} rotation-x={-Math.PI / 2} userData={{ noShadow:true }}>
            <planeGeometry args={[2.04,STREET.d]} />
            <meshStandardMaterial map={materials.paving} color="#a8947e" roughness={.96} />
          </mesh>
          <Box p={[TRAM.x + side*.64,.179,33.25]} s={[.026,.014,31.4]} c="#695e54" />
          <Box p={[side * STREET.w / 2,.44,STREET.z]} s={[.45,.72,STREET.d]} c="#817460" />
          <Box p={[side * STREET.w / 2,.824,STREET.z]} s={[.51,.10,STREET.d]} c="#9d8b72" />
        </group>
      ))}
      <Instances geometry={GEO.box} material={DETAILS} items={curbs} />
      <Instances geometry={GEO.box} material={DETAILS} items={track.map((z) => ({ p:[TRAM.x,.172,z],s:[1.56,.005,.071],c:'#a08d74' }))} />
      <Box p={[0,.49,STREET.z+STREET.d/2-.35]} s={[STREET.w,.77,.46]} c="#7c6d58" />
      <Box p={[0,.90,STREET.z+STREET.d/2-.35]} s={[STREET.w,.13,.54]} c="#a38c70" />
      <StreetEntry roofMaterial={roofMaterial} />
      {STREET_BUILDINGS.map((building) => {
        if (building.kind === 'stop') return <TramStop key={building.name} building={building} materials={materials} />
        if (building.kind === 'station') return <GyeongseongStation key={building.name} building={building} materials={materials} scans={scans} brick={brick} />
        return <Shop key={building.name} building={building} materials={materials} roofMaterial={roofMaterial} scans={scans} brick={brick} />
      })}
      <StreetTram materials={materials} />
      {STREET_LAMPS.map(([x,z], index) => (
        <group key={x + ',' + z} position={[x,.105,z]}>
          <Cyl p={[0,.20,0]} rad={.17} h={.24} c="#524a3c" />
          <Cyl p={[0,1.48,0]} rad={.048} h={2.65} c="#3c443b" />
          <Box p={[0,2.69,0]} s={[.27,.38,.27]} m={materials.lamp} />
          <Box p={[0,2.93,0]} s={[.39,.10,.39]} c="#343e35" />
          {index % 3 === 0 && <pointLight position={[0,2.55,0]} intensity={10.5} color="#ffc787" distance={9.4} />}
        </group>
      ))}
      <GyeongseongStreetLife materials={materials} />
      <AlleyGarden materials={materials} />
    </group>
  )
}

function AlleyGarden({ materials }) {
  const planting = useMemo(() => {
    const random = seeded(5304)
    const stone = []
    const shrubs = []
    const foliage = ['#515e34','#435732','#647149','#777a4a']
    for (let index = 0; index < 28; index += 1) {
      const z = 34.45 + index * .375
      stone.push({ p:[-37.4 + Math.sin(index * .24) * .13,.224,z], s:[.24,.16,.36],c:index%3 ? '#a29479' : '#8d8270' })
      if (Math.abs(z - ALLEY_BENCH.z) < 1.37) continue
      for (let cluster = 0; cluster < 4; cluster += 1) {
        const size = .13 + random() * .19
        shrubs.push({ p:[-39.02 + random() * 1.07,.37 + size*.29,z + (random()-.5)*.54],
          s:[size,.84*size,size],c:foliage[(index + cluster) % foliage.length] })
      }
    }
    return { stone, shrubs }
  }, [])
  const { x, z, w, d } = ALLEY_BENCH

  return (
    <group name="달맞이 골목 산책길">
      <Box p={[-38.56,.185,39.56]} s={[2.14,.065,10.56]} c="#817458" />
      <Instances geometry={GEO.box} material={DETAILS} items={planting.stone} />
      <Instances geometry={GEO.ico} material={DETAILS} items={planting.shrubs} />
      {[-.72,.72].map((offset) => (
        <Box key={offset} p={[x,.35,z + offset]} s={[w*.77,.34,.20]} c="#8e8170" />
      ))}
      {[0,1,2,3].map((index) => (
        <Box key={index} p={[x + (index-1.5)*.13,.548,z]} s={[.122,.087,d]} c={index%2 ? '#805e44' : '#946e4d'} />
      ))}
      <Box p={[-38.63,.66,43.67]} s={[.31,.87,.32]} c="#7a6b57" />
      <Box p={[-38.63,1.15,43.67]} s={[.22,.25,.22]} m={materials.lamp} />
      <Box p={[-38.63,1.32,43.67]} s={[.37,.105,.37]} c="#665441" />
    </group>
  )
}
