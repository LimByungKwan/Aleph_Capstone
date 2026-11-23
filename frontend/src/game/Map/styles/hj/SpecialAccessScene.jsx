import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { MathUtils } from 'three'
import { Ball, Box, Cyl, GEO, Instances, mat } from '../kit.jsx'
import { getSignTexture } from '../textures.js'
import { selectTimePass, useSpecialAccess, useTimePass } from '../../../../components/movieZone/specialAccessStore.js'
import { SPECIAL_IDS, SPECIAL_LOCATIONS } from '../../../../components/movieZone/specialLocations.js'
import { useUiStore } from '../../../../components/movieZone/uiStore.js'
import { DECK, MAIN_GATE, THRONE } from './gyeongbokgungLayout.js'
import { GYEONGSEONG_STATION, STREET_FLOOR, STREET_PRESS } from './gyeongseongLayout.js'
import {
  CENTRAL_HALL, CENTRAL_HALL_BASE, CENTRAL_LANDING, CENTRAL_STAIRS, CENTRAL_WALLS, LANDING_RAILS, PAVILION_PLATFORMS,
  PAVILION_STEPS, PAVILION_SUPPORTS, SPECIAL_MARKS, STATION_PLATFORMS, STATION_STEPS,
  PRESS_FLOOR, PRESS_PLATFORMS, PRESS_STEPS, PRESS_RAILS, PRISON, PRISON_FLOOR, PRISON_TOWER, PRISON_WALLS, RESIDENCE, RESIDENCE_PARTS,
  specialInteriorPresence,
} from './specialAccessLayout.js'
import ArchitecturalMasonry from './ArchitecturalMasonry.jsx'
import TimberStairs from './TimberStairs.jsx'
import { tiledRoof } from './gyeongbokgungMaterials.js'
import { ArchOpening } from './GyeongseongMasonry.jsx'

const SOLID = mat('#fff')
const MARK_TEXT = '출입제한 구역 — 가상 특별 개방'
const GOLD = '#c8af88'
const BRASS = mat('#b89153', { roughness:.42, metalness:.52 })
const PORCELAIN = mat('#ffdb9e', { emissive:'#ffb478', emissiveIntensity:.60 })
const WINDOW_GLASS = mat('#897861', { emissive:'#f9ae67', emissiveIntensity:.18, roughness:.44 })
const IRON = mat('#384843', { metalness:.38, roughness:.51 })
const MARBLE = mat('#fff', { roughness:.37, metalness:.11 })
const ROSE = '#7c423c'
const ENTRY_SIGNS = {
  [SPECIAL_IDS.throne]: [THRONE.x-2.82, THRONE.z-9.8, .105, 0],
  [SPECIAL_IDS.pavilion]: [DECK.x+5.95, DECK.z+.11, DECK.top, -Math.PI/2],
  [SPECIAL_IDS.residence]: [RESIDENCE.x-5.35, RESIDENCE.z+1.95, .105, Math.PI/2],
  [SPECIAL_IDS.gate]: [MAIN_GATE.x+2.55, MAIN_GATE.z-6.6, .23, 0],
  [SPECIAL_IDS.central]: [CENTRAL_HALL.x-CENTRAL_HALL.d/2-.6, CENTRAL_HALL.z+2.89, .105, Math.PI/2],
  [SPECIAL_IDS.station]: [GYEONGSEONG_STATION.x-GYEONGSEONG_STATION.d/2-.66, GYEONGSEONG_STATION.z+2.62, .105, Math.PI/2],
  [SPECIAL_IDS.press]: [STREET_PRESS.x+2.53, STREET_PRESS.z-STREET_PRESS.d/2-.58, .105, 0],
  [SPECIAL_IDS.prison]: [PRISON.x+2.88, PRISON.z-PRISON.d/2-.43, .105, 0],
}

function EntrySign({ id }) {
  const [x,z,y,yaw] = ENTRY_SIGNS[id]
  return (
    <group name={MARK_TEXT} position={[x,y,z]} rotation-y={yaw+Math.PI} onClick={(event) => {
      event.stopPropagation()
      useSpecialAccess.getState().warp(id)
    }}>
      {[-.64,.64].map((offset) => (
        <group key={offset} position-x={offset}>
          <Cyl p={[0,.049,0]} rad={.13} h={.098} m={BRASS} />
          <Cyl p={[0,.44,0]} rad={.033} h={.79} m={BRASS} />
          <Ball p={[0,.85,0]} rad={.053} m={BRASS} />
        </group>
      ))}
      <Box p={[0,.60,.024]} s={[1.34,.35,.066]} c="#d7aa60" />
      <mesh geometry={GEO.plane} position={[0,.60,.061]} scale={[1.26,.275,1]}>
        <meshBasicMaterial map={getSignTexture(MARK_TEXT,'#822f2c','#fff5d4',7)} toneMapped={false} />
      </mesh>
    </group>
  )
}

function InteriorLamp() {
  const light = useRef(null)
  const last = useRef(null)
  useFrame((_, delta) => {
    const node = light.current
    const room = specialInteriorPresence.room
    if (!node) return
    if (room && room !== last.current) {
      last.current = room
      node.position.set(room.x+(room.lightX ?? 0),room.lightY,room.z+(room.lightZ ?? 0))
      node.intensity = 0
    }
    node.intensity = MathUtils.damp(node.intensity, room?.power ?? 0, 6, delta)
  })
  return <pointLight ref={light} name="특별 관람 실내 조명" color="#ffe1b3" intensity={0} distance={8.8} />
}

function Pendant({ x = 0, z = 0, y, mountY, arms = false }) {
  const stem = mountY-y
  return (
    <group position={[x,y,z]}>
      <Cyl p={[0,stem/2,0]} rad={.025} h={stem} m={BRASS} />
      <Cyl p={[0,stem-.017,0]} rad={.097} h={.034} m={BRASS} />
      <mesh geometry={GEO.dome} scale={[.22,.14,.22]} material={BRASS} />
      <Ball p={[0,-.067,0]} rad={.105} m={PORCELAIN} />
      {arms && [-1,1].map((side) => (
        <group key={side}>
          <Box p={[side*.26,-.13,0]} s={[.50,.045,.047]} m={BRASS} />
          <Ball p={[side*.50,-.065,0]} rad={.11} m={PORCELAIN} />
        </group>
      ))}
    </group>
  )
}

function SpecialMarker({ id, short, mark: { x, z, floor, radius, yaw } }) {
  const userId = useUiStore((s) => s.userId)
  const restored = useTimePass((s) => Boolean(selectTimePass(s,userId).restored[id]))
  const enter = (event) => {
    event.stopPropagation()
    useSpecialAccess.getState().warp(id)
  }
  const side = id === SPECIAL_IDS.throne || id === SPECIAL_IDS.residence ? 1.45 : -1.52
  const signX = Math.cos(yaw)*side + Math.sin(yaw)*.56
  const signZ = -Math.sin(yaw)*side + Math.cos(yaw)*.56
  return (
    <group name={MARK_TEXT} position={[x,floor,z]}>
      <mesh position-y={.026} rotation-x={-Math.PI/2} onClick={enter}>
        <ringGeometry args={[radius-.115,radius,40]} />
        <meshBasicMaterial color={restored ? '#a7d6c2' : '#ffc36f'} toneMapped={false} />
      </mesh>
      <mesh position-y={.019} rotation-x={-Math.PI/2} onClick={enter}>
        <circleGeometry args={[radius-.10,40]} />
        <meshBasicMaterial color="#ffd891" opacity={.15} transparent depthWrite={false} />
      </mesh>
      <group position={[signX,.48,signZ]} rotation-y={yaw+Math.PI} onClick={enter}>
        <Box p={[0,-.30,0]} s={[.083,.34,.09]} c="#614638" />
        <Box p={[0,-.43,0]} s={[.28,.082,.19]} c="#a98864" />
        <Box p={[0,0,0]} s={[1.49,.29,.06]} c="#d9a958" />
        <mesh position-y={.039} position-z={.032}>
          <planeGeometry args={[1.29,.14]} />
          <meshBasicMaterial toneMapped={false} map={getSignTexture(short,'#792f29','#ffecc3',7)} />
        </mesh>
        <mesh position-y={-.075} position-z={.033}>
          <planeGeometry args={[1.42,.090]} />
          <meshBasicMaterial toneMapped={false} map={getSignTexture(MARK_TEXT,'#792f29','#fff0d4',9)} />
        </mesh>
      </group>
    </group>
  )
}

function buildPart({ x,z,w,d,base,top,color }) {
  return { p:[x,(base+top)/2,z],s:[w,top-base,d],c:color }
}

const CARPENTRY = [
  ...PAVILION_PLATFORMS, ...STATION_PLATFORMS, ...PRESS_PLATFORMS, PRISON_FLOOR, ...RESIDENCE_PARTS.slice(0,2),
].map(buildPart)
const HALL_SHELL = [CENTRAL_HALL_BASE, ...CENTRAL_WALLS, ...CENTRAL_STAIRS, CENTRAL_LANDING]
const RESIDENCE_WALLS = RESIDENCE_PARTS.slice(2).map(({ top, ...part }) => ({ ...part, top: .92 }))
const LANDING_BEAMS = [...STATION_PLATFORMS, ...PRESS_PLATFORMS].flatMap(({ x,z,w,d,base }) => (
  w >= d
    ? [-1,1].map(side => ({ p:[x,base-.031,z+side*(d/2-.055)],s:[w,.13,.11],c:'#523a2b' }))
    : [-1,1].map(side => ({ p:[x+side*(w/2-.055),base-.031,z],s:[.11,.13,d],c:'#523a2b' }))
))
const CAFE_JOIST_Y = 2.3
const PAVILION_PLANKS = PAVILION_PLATFORMS.flatMap(({ x,z,w,d,top }) => {
  const count = Math.ceil(d/.24)
  return Array.from({ length:count }, (_, i) => ({
    p:[x,top+.004,z+((i+.5)/count-.5)*d],
    s:[w-.015,.011,d/count-.017],c:['#9b7053','#a67a58','#8c654b','#906749'][i%4],
  }))
})
const BALUSTERS = [...LANDING_RAILS, ...PRESS_RAILS].flatMap(({ x,z,w,d,base,top }) => {
  const vertical = d>w
  const span = vertical ? d : w
  const count = Math.max(2,Math.ceil(span/.61))
  return [
    { p:[x,top-.05,z],s:[w+.046,.10,d+.046],c:'#493f36' },
    { p:[x,base+.14,z],s:[w,.075,d],c:'#786447' },
    ...Array.from({ length:count },(_,i) => {
      const offset = ((i+.5)/count-.5)*span
      return { p:[x+(vertical?0:offset), (base+top)/2, z+(vertical?offset:0)],
        s:[.12,top-base,.12],c:i%2 ? '#824b39' : '#95614a' }
    }),
  ]
})
const HALL_TILES = Array.from({ length: 72 }, (_, i) => ({
  p:[(i%6-2.5)*1.29,CENTRAL_HALL.floor+.014,(Math.floor(i/6)-5.5)*1.49],s:[1.277,.022,1.474],
  c:(i+Math.floor(i/6))%2 ? '#c4b79d' : '#e2d4ba',
}))

function CentralHall({ stone }) {
  const { x,z,w,d,floor,roofY } = CENTRAL_HALL
  return (
    <>
      <ArchitecturalMasonry parts={HALL_SHELL} material={stone} repeatX={3.8} repeatY={2.6} />
      <group name="옛 중앙청 가상 복원 홀" position={[x,0,z]} rotation-y={Math.PI/2}>
        <Instances geometry={GEO.box} material={MARBLE} items={HALL_TILES} />
        <Box p={[0,roofY+.13,0]} s={[w+.35,.25,d+.35]} c="#a79a84" name="camera-blocker" />
        <Box p={[0,roofY+.38,-2.2]} s={[5.52,.35,4.91]} c="#bbaf9e" />
        <Cyl p={[0,roofY+.82,-2.2]} rad={2.11} h={.59} c="#a2a298" />
        <mesh position={[0,roofY+1.10,-2.2]} geometry={GEO.dome} scale={[2.13,1.62,2.13]} material={mat('#617269',{metalness:.28,roughness:.52})} />
        <Cyl p={[0,roofY+2.79,-2.2]} rad={.18} h={.22} m={BRASS} />
        <Box p={[0,4.83,-d/2-.19]} s={[w+.11,.20,.47]} c="#ded7c7" />
        <Box p={[0,3.76,-d/2-.32]} s={[3.29,.40,.15]} c="#655546" />
        <mesh position={[0,3.76,-d/2-.401]} rotation-y={Math.PI}>
          <planeGeometry args={[3.17,.33]} />
          <meshBasicMaterial map={getSignTexture('옛 중앙청 · 가상 복원','#655546','#fff0cb',9)} />
        </mesh>
        {[-1,1].flatMap((side) => [2.68,4.29].map((offset) => (
          <group key={side*offset} position-x={side*offset}>
            <Cyl p={[0,2.43,-d/2-.28]} rad={.225} h={4.27} m={stone} />
            <Instances geometry={GEO.box} material={SOLID} items={Array.from({ length:12 },(_,i) => ({
              p:[Math.sin(i*Math.PI/6)*.222,2.52,-d/2-.28+Math.cos(i*Math.PI/6)*.222],
              s:[.024,3.85,.024],r:[0,i*Math.PI/6,0],c:'#d5ccbc',
            }))} />
            <Box p={[0,.33,-d/2-.26]} s={[.58,.27,.58]} c="#bbb6a8" />
            <Cyl p={[0,.51,-d/2-.28]} rad={.29} h={.12} c="#ddd5c3" />
            <Cyl p={[0,4.54,-d/2-.28]} rad={.27} h={.17} c="#dfd7c5" />
            <Instances geometry={GEO.box} material={SOLID} items={Array.from({ length:8 },(_,i) => ({
              p:[Math.sin(i*Math.PI/4)*.232,4.61,-d/2-.28+Math.cos(i*Math.PI/4)*.232],
              s:[.107,.15,.11],r:[.15,i*Math.PI/4,0],c:'#cdbfa7',
            }))} />
            <Box p={[0,4.74,-d/2-.28]} s={[.61,.14,.61]} c="#e7ddca" />
            <Box p={[0,1.92,d/2-.17]} s={[.86,2.35,.10]} c="#aa977e" />
            <Box p={[0,1.92,d/2-.226]} s={[.65,2.14,.08]} c="#d8c6aa" />
          </group>
        )))}
        {[-1,1].map((side) => (
          <group key={side}>
            <Box p={[side*2.77,2.49,-d/2-.41]} s={[.20,.35,.20]} m={mat('#ffd898',{emissive:'#ffb777',emissiveIntensity:.62})} />
            {[-4.9,-1.65,1.65,4.9].map((windowZ) => (
              <group key={windowZ} position={[side*(w/2-.265),1.97,windowZ]} rotation-y={side*Math.PI/2}>
                <ArchOpening x={0} y={0} face={0} radius={.56} rise={1.19} material={WINDOW_GLASS} />
              </group>
            ))}
          </group>
        ))}
        <Box p={[0,floor+.044,-3.87]} s={[1.54,.025,9.9]} c="#944f43" />
        <Pendant y={5.73} z={-.6} mountY={roofY+.005} arms />
        <Pendant y={5.73} z={5.6} mountY={roofY+.005} arms />
      </group>
    </>
  )
}

function StationLoft() {
  const { floor } = SPECIAL_MARKS[SPECIAL_IDS.station]
  const { x, z, h } = GYEONGSEONG_STATION
  const ceiling = STREET_FLOOR+h-.215-floor
  return (
    <group position={[x+2.20,floor,z]} name="경성역 2층 가상 귀빈실" rotation-y={Math.PI/2}>
      <Box p={[0,.435,1.10]} s={[13.95,.87,.12]} c="#805b43" />
      <Box p={[0,.89,1.024]} s={[13.95,.085,.17]} c="#a8855e" />
      <Box p={[0,2.93,1.13]} s={[13.95,.15,.17]} c="#c3b198" />
      <Instances geometry={GEO.box} material={SOLID} items={Array.from({length:13},(_,i) => ({
        p:[i-6,.41,1.029],s:[.83,.55,.028],c:i%2 ? '#684c3b' : '#6f503d',
      }))} />
      {[-5.2,0,5.2].map(offset => (
        <ArchOpening key={offset} x={offset} y={1.10} face={1.121} radius={.57} rise={.78} material={WINDOW_GLASS} />
      ))}
      {[-2.57,2.57].map(offset => (
        <group key={offset} position-x={offset}>
          <Box p={[0,.22,.65]} s={[1.95,.20,.72]} c="#533b34" />
          {[-.78,.78].flatMap(u => [.38,.92].map(v => (
            <Box key={u+v} p={[u,.062,v]} s={[.112,.124,.118]} c="#4b3327" />
          )))}
          <Box p={[0,.42,.61]} s={[1.68,.23,.66]} c={ROSE} />
          <Box p={[0,.71,.91]} s={[1.95,.51,.22]} c="#643e3d" />
          {[-.83,.83].map(side => <Box key={side} p={[side,.56,.56]} s={[.21,.27,.74]} c="#844b46" />)}
          {[-.59,-.29,0,.29,.59].map(tuft => (
            <Ball key={tuft} p={[tuft,.76,.792]} rad={.027} m={BRASS} />
          ))}
          <group position={[0,1.17,1.12]}>
            <ArchOpening x={0} y={0} face={0} radius={.54} rise={.74} material={WINDOW_GLASS} />
          </group>
        </group>
      ))}
      <Cyl p={[0,.48,.56]} rad={.44} h={.095} c="#876346" />
      <Cyl p={[0,.24,.56]} rad={.079} h={.48} m={BRASS} />
      <Cyl p={[0,.06,.56]} rad={.27} h={.11} c="#574333" />
      <Box p={[0,.554,.56]} s={[.25,.018,.22]} c="#dfc7a6" />
      <Box p={[0,.017,-.38]} s={[5.8,.023,1.45]} c="#89534c" />
      <Pendant y={2.22} z={-.24} mountY={ceiling} arms />
      <Pendant x={4.5} y={2.26} z={-.24} mountY={ceiling} arms />
    </group>
  )
}

function RoomName({ text, p, yaw = Math.PI, w = 2.1 }) {
  return (
    <group position={p} rotation-y={yaw}>
      <Box p={[0,0,0]} s={[w,.35,.06]} c="#ad915e" />
      <mesh position-z={.032}>
        <planeGeometry args={[w-.08,.27]} />
        <meshBasicMaterial map={getSignTexture(text,'#56392f','#fff0cc',8)} />
      </mesh>
    </group>
  )
}

function Residence({ materials, surfaces }) {
  const { x,z,w,d,floor } = RESIDENCE
  const roof = useMemo(() => tiledRoof(w+.94,d+.98,1.11), [w,d])
  useEffect(() => () => roof.dispose(), [roof])
  return (
    <>
      <ArchitecturalMasonry parts={RESIDENCE_WALLS} material={surfaces.woldae_stone} />
      <group name="건청궁 곤녕합 관람실" position={[x,0,z]}>
        <Box p={[0,3.03,0]} s={[w+.65,.20,d+.7]} c="#36413b" name="camera-blocker" />
        <mesh geometry={roof} position-y={3.14} material={materials.roof} castShadow />
        <Box p={[0,4.236,0]} s={[w*.68,.10,.105]} c="#92948e" />
        <RoomName text="건청궁 · 곤녕합" p={[-w/2-.16,2.63,0]} yaw={-Math.PI/2} />
        {[-1,1].flatMap(side => [-3,-1,1,3].map(u => (
          <group key={side*d+u} position={[u,0,side*(d/2-.16)]} rotation-y={side < 0 ? 0 : Math.PI}>
            <Box p={[0,1.54,0]} s={[1.87,1.33,.15]} c="#8a6044" />
            <mesh geometry={GEO.plane} position={[0,1.57,.089]} scale={[1.66,1.17,1]} material={materials.lattice} />
            <mesh geometry={GEO.plane} position={[0,2.65,.14]} scale={[1.94,.30,1]} material={materials.dancheong} />
            <Cyl p={[-.98,1.52,0]} rad={.11} h={2.64} m={surfaces.timber} />
          </group>
        )))}
        <Box p={[w/2-.14,1.63,0]} s={[.14,2.43,d-.22]} c="#8b6248" />
        <Instances geometry={GEO.box} material={SOLID} items={Array.from({ length:19 },(_,i) => ({
          p:[0,floor+.011,(i-9)*.208],s:[w-.21,.022,.198],
          c:['#8c6549','#91694d','#9a7050','#a37754'][i%4],
        }))} />
        <Box p={[-w/2-.49,floor+.017,0]} s={[.92,.034,d-.08]} c="#aa7950" />
        <Instances geometry={GEO.box} material={SOLID} items={Array.from({length:14}, (_, i) => ({
          p:[-w/2-.49,floor+.026,(i-6.5)*.30],s:[.93,.044,.27],c:i%2 ? '#986c4b' : '#a57751',
        }))} />
        <Box p={[2.65,floor+.15,.68]} s={[2.21,.22,.92]} c="#795036" />
        <Box p={[2.65,floor+.29,.68]} s={[2.26,.055,.97]} c="#a4774d" />
        <Box p={[2.47,floor+.34,.59]} s={[.41,.04,.34]} c="#9f5243" />
        <Pendant x={1.72} y={2.25} z={.18} mountY={2.93} />
      </group>
    </>
  )
}

function CafeStool({ x,z }) {
  return (
    <group position={[x,0,z]}>
      <Cyl p={[0,.36,0]} rad={.25} h={.095} c="#85654b" />
      <Cyl p={[0,.159,0]} rad={.06} h={.319} c="#644938" />
      <Cyl p={[0,.032,0]} rad={.18} h={.064} c="#624636" />
    </group>
  )
}

function PressRooms() {
  const roofUnder = STREET_FLOOR+STREET_PRESS.h-.075
  return (
    <>
      <group name="청운 인쇄소 2층 인쇄실" position={[STREET_PRESS.x,PRESS_FLOOR,STREET_PRESS.z]}>
        <Box p={[1.43,.30,2.64]} s={[1.78,.60,.72]} c="#534944" />
        <Box p={[1.43,.692,2.67]} s={[.95,.19,.66]} c="#717971" />
        <Cyl p={[1.46,.92,2.63]} rad={.22} h={.80} r={[0,0,Math.PI/2]} c="#544f48" />
        <Box p={[1.40,.803,2.31]} s={[.51,.037,.54]} c="#ede1c3" />
        {[.03,1.22,2.6].map((v) => <Box key={v} p={[-4.50,1.27,v]} s={[.13,2.35,.086]} c="#665f50" />)}
        {[.58,1.60,2.22].map(y => <Box key={y} p={[-4.51,y,1.61]} s={[.18,.085,2.76]} c="#695139" />)}
        <Box p={[-4.48,.53,1.61]} s={[.21,.12,2.93]} c="#b1997b" />
        <RoomName text="전차 거리" p={[-4.50,.27,1.61]} yaw={Math.PI/2} w={1.24} />
        <Cyl p={[2.04,.77,2.68]} rad={.29} h={.056} r={[0,0,Math.PI/2]} m={IRON} />
        {[-1,1].map(side => <Box key={side} p={[1.43+side*.45,.69,2.65]} s={[.086,.73,.44]} m={IRON} />)}
        <Box p={[1.38,1.08,2.66]} s={[1.12,.10,.58]} m={IRON} />
        <Box p={[2.46,.36,2.63]} s={[.87,.65,.83]} c="#976f4f" />
        <Box p={[2.46,.024,2.63]} s={[.83,.048,.79]} c="#604432" />
        <Box p={[2.48,.713,2.64]} s={[.71,.082,.65]} c="#d7c5a8" />
        <Pendant x={.67} y={2.06} z={.8} mountY={roofUnder-PRESS_FLOOR} />
        <RoomName text="등사기 · 인쇄 작업대" p={[1.4,1.48,3.38]} w={2.12} />
      </group>
      <group name="경성 모던 다방" position={[STREET_PRESS.x,STREET_FLOOR,STREET_PRESS.z]}>
        <RoomName text="모던 다방 · 2층 인쇄실 ↑" p={[0,2.12,3.13]} w={2.63} />
        {[2.23,3.49].map(u => <CafeStool key={u} x={u} z={.10} />)}
        <Cyl p={[2.86,.73,.10]} rad={.44} h={.11} c="#91684b" />
        <Cyl p={[2.86,.35,.10]} rad={.081} h={.70} c="#644938" />
        <Cyl p={[2.67,.74,-1.93]} rad={.48} h={.11} c="#97694a" />
        <Cyl p={[2.67,.38,-1.93]} rad={.083} h={.72} c="#584337" />
        {[1.92,3.36].map(u => <CafeStool key={u} x={u} z={-1.93} />)}
        <Box p={[2.53,CAFE_JOIST_Y+.07,-1.93]} s={[4.18,.14,.18]} c="#6e5038" />
        <Pendant x={2.67} y={1.90} z={-1.93} mountY={CAFE_JOIST_Y} />
        <Pendant x={2.87} y={1.90} z={.10} mountY={PRESS_FLOOR-.16-STREET_FLOOR} />
      </group>
    </>
  )
}

function PrisonYard({ brick }) {
  return (
    <>
      <ArchitecturalMasonry parts={PRISON_WALLS} material={brick} repeatX={2.4} repeatY={1.3} />
      <group name="서대문형무소 격벽장 가상 전시" position={[PRISON.x,.15,PRISON.z]}>
        <RoomName text="서대문 격벽장 · 가상 전시" p={[3.62,2.45,-PRISON.d/2-.188]} w={2.97} />
        <Box p={[0,3.16,PRISON.d/2]} s={[PRISON.w+.10,.17,.58]} c="#a69a87" />
        {[-1,1].map(side => <Box key={side} p={[side*5.64,2.57,.13]} s={[.52,.17,8.32]} c="#a69a87" />)}
        {[-3.58,0,3.58].map(center => (
          <group key={center} position={[center,0,PRISON.d/2-.19]}>
            <Box p={[0,1.42,-.055]} s={[2.25,2.31,.08]} c="#463433" />
            <Box p={[0,1.42,-.10]} s={[1.91,2.04,.048]} c="#28292a" />
            <Instances geometry={GEO.box} material={IRON} items={Array.from({length:8},(_,i) => ({
              p:[(i-3.5)*.238,1.42,-.145],s:[.042,2.05,.047],
            }))} />
            {[.54,1.45,2.35].map(y => <Box key={y} p={[0,y,-.166]} s={[2.09,.072,.049]} m={IRON} />)}
            <Box p={[0,2.66,-.098]} s={[2.31,.13,.24]} c="#ab9e8e" />
          </group>
        ))}
      </group>
      <group position={[PRISON_TOWER.x,0,PRISON_TOWER.z]} name="벽돌 감시탑">
        <Box p={[0,1.56,0]} s={[1.44,3.12,1.44]} m={brick} />
        <Box p={[0,3.18,0]} s={[2.19,.32,2.11]} c="#a59680" />
        {[-1,1].flatMap(x => [-1,1].map(z => (
          <Box key={x+z*.1} p={[x*.91,3.94,z*.86]} s={[.17,1.30,.18]} c="#54463c" />
        )))}
        <Box p={[0,3.55,0]} s={[2.05,.14,2.02]} c="#6c5947" />
        <Box p={[0,4.64,0]} s={[2.34,.20,2.27]} c="#4c4e4a" />
        <mesh geometry={GEO.cone} position={[0,4.96,0]} scale={[1.61,.57,1.61]} rotation-y={Math.PI/8} material={mat('#53524b')} />
      </group>
    </>
  )
}

export default function SpecialAccessScene({ materials, surfaces }) {
  return (
    <group name="시간 탐정 특별 개방">
      <Instances geometry={GEO.box} material={SOLID} items={CARPENTRY} castShadow />
      <Instances geometry={GEO.box} material={SOLID} items={LANDING_BEAMS} castShadow />
      <TimberStairs steps={PRESS_STEPS} landing={PRESS_PLATFORMS[0]} />
      <TimberStairs steps={STATION_STEPS} landing={STATION_PLATFORMS[0]} />
      <TimberStairs steps={PAVILION_STEPS} landing={PAVILION_PLATFORMS[2]} />
      <ArchitecturalMasonry parts={PAVILION_SUPPORTS} material={surfaces.woldae_stone} />
      <Instances geometry={GEO.box} material={SOLID} items={PAVILION_PLANKS} />
      <Instances geometry={GEO.box} material={SOLID} items={BALUSTERS} />
      <CentralHall stone={surfaces.colonial_stone} />
      <StationLoft />
      <Residence materials={materials} surfaces={surfaces} />
      <PressRooms />
      <PrisonYard brick={surfaces.red_brick} />
      <InteriorLamp />
      {SPECIAL_LOCATIONS.map(({ id }) => <EntrySign key={id} id={id} />)}
      {SPECIAL_LOCATIONS.map(({ id, short }) => <SpecialMarker key={id} id={id} short={short} mark={SPECIAL_MARKS[id]} />)}
      <group position={[DECK.x,2.61,DECK.z-2.9]}>
        <Box p={[0,.235,0]} s={[3.24,.43,.43]} c="#966744" />
        <Box p={[0,.476,0]} s={[3.4,.094,.52]} c={GOLD} />
      </group>
    </group>
  )
}
