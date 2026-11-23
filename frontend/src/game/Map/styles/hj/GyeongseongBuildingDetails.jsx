import { useMemo } from 'react'
import { Box, GEO, Instances, mat } from '../kit.jsx'
import { StreetSign } from './GyeongseongMasonry.jsx'
import { StreetSurface } from './GyeongseongMaterial.jsx'

const SOLID = mat('#fff')
const PROFILE = {
  stoneStudio: { trim:'#c4b9a3', frame:'#514d42', shutter:'#687775', base:'#a99b84' },
  restaurant: { trim:'#8d6a4d', frame:'#664a36', shutter:'#8d7453', base:'#8c8070' },
  shop: { trim:'#a48e72', frame:'#634d3a', shutter:'#687768', base:'#94745e' },
  studio: { trim:'#b0a292', frame:'#574f42', shutter:'#6d7461', base:'#895b44' },
  cinema: { trim:'#bdbaa6', frame:'#535d55', shutter:'#53706a', base:'#8e8374' },
}

function elevationParts(span, height, kind, rear) {
  const { trim, frame, shutter, base } = PROFILE[kind]
  const solid = []
  const glass = []
  const put = (x, y, z, w, h, d, c) => solid.push({ p:[x,y,z], s:[w,h,d],c })
  put(0,.26,.055,span,.45,.16,base)
  put(0,.50,.10,span+.02,.075,.14,trim)
  put(0,height-.25,.095,span,.16,.19,trim)
  const bays = Math.max(2, Math.round(span / 2.42))
  const bay = (span - .48) / bays
  const hasUpper = height >= 4.55
  const levels = hasUpper ? [1.38, height * .72] : [1.64]
  const windowHeight = kind === 'stoneStudio' ? 1.39 : kind === 'cinema' ? 1.20 : 1.06
  const windowWidth = Math.min(kind === 'restaurant' ? 1.30 : 1.12, bay * .66)
  if (hasUpper) put(0,height * .53,.088,span,.09,.167,trim)

  for (let index = 0; index < bays; index += 1) {
    const x = (index - (bays-1)/2) * bay
    for (const y of levels) {
      put(x,y,.033,windowWidth+.25,windowHeight+.26,.134,trim)
      put(x,y,.084,windowWidth+.071,windowHeight+.11,.10,frame)
      glass.push({ p:[x,y,.135],s:[windowWidth-.097,windowHeight-.104,.026] })
      put(x,y-windowHeight/2-.134,.14,windowWidth+.31,.119,.29,trim)
      put(x,y+windowHeight/2+.127,.133,windowWidth+.29,.09,.23,trim)
      put(x,y+.075,.163,windowWidth-.074,.046,.042,frame)
      const mullions = kind === 'restaurant' || kind === 'studio' ? [-.26,0,.26] : [0]
      for (const mullion of mullions) {
        put(x+mullion*windowWidth,y,.164,.039,windowHeight-.105,.041,frame)
      }
      if (kind === 'shop' || kind === 'restaurant') {
        for (const side of [-1,1]) {
          const wing = Math.min(.23, bay*.12)
          const u = x+side*(windowWidth/2+wing*.57+.051)
          put(u,y,.097,wing,windowHeight-.01,.06,shutter)
          for (const slat of [-.35,-.23,-.11,.01,.13,.25,.37]) put(u,y + slat*windowHeight,.142,wing-.035,.025,.028,frame)
        }
      }
    }
    if (kind === 'restaurant' || kind === 'cinema') {
      const postX = x + bay/2
      put(postX,height*.48,.065,.107,height*.91,.189,trim)
    }
  }
  if (!rear) {
    const x = -span/2+.27
    put(x,height*.51,.127,.081,height-.34,.092,'#665b4e')
    for (const y of [.51,height*.51,height-.59]) put(x,y,.141,.14,.069,.132,'#81735f')
    put(x,.216,.206,.081,.091,.22,'#665b4e')
  }
  return { solid, glass }
}

function Elevation({ position, yaw, span, building, materials, scans, rear = false }) {
  const { kind, h, paint } = building
  const { solid, glass } = useMemo(() => elevationParts(span,h,kind,rear), [span,h,kind,rear])
  const stone = kind === 'stoneStudio'
  const lower = stone || kind === 'studio' ? h : kind === 'restaurant' ? 1.02 : .82
  const surface = stone ? scans.stone : kind === 'restaurant' ? scans.timber : scans.brick
  return (
    <group position={position} rotation-y={yaw}>
      <StreetSurface scan={surface} p={[0,lower/2,.009]} w={span-.028} h={lower} />
      {lower < h && <mesh position={[0,(h+lower)/2,.009]} receiveShadow>
        <planeGeometry args={[span-.028,h-lower]} />
        <meshStandardMaterial map={materials.stucco} bumpMap={materials.stucco} color={paint} bumpScale={.037} roughness={.94} />
      </mesh>}
      <Instances geometry={GEO.box} material={SOLID} items={solid} />
      <Instances geometry={GEO.box} material={materials.glass} items={glass} />
    </group>
  )
}

function RoofConstruction({ building }) {
  const { h,w,d,kind } = building
  const solid = useMemo(() => {
    const roof = []
    const put = (x,y,z,a,b,c,color,r) => roof.push({ p:[x,y,z],s:[a,b,c],c:color,r })
    const trim = PROFILE[kind].trim
    if (kind === 'restaurant') {
      for (const side of [-1,1]) {
        put(0,h+.073,side*(d/2+.59),w+1.16,.092,.105,'#534133')
        const rafterCount = Math.floor(w / .40)
        for (let i = 0; i <= rafterCount; i += 1) {
          const x = (i / rafterCount - .5) * (w + .67)
          put(x,h-.053,side*(d/2+.43),.099,.125,.35,i % 3 ? '#73553e' : '#997457')
        }
      }
      return roof
    }

    if (kind === 'studio') {
      const run = d / 2 + .12
      const rise = .76
      const angle = Math.atan2(rise,run)
      const slope = Math.hypot(run,rise)
      for (const side of [-1,1]) {
        const turn = [side*angle,0,0]
        put(0,h+.15+rise/2,side*run/2,w+.24,.084,slope,'#74766b',turn)
        const seams = Math.ceil(w/.42)
        for (let i = 1; i < seams; i += 1) {
          put((i/seams-.5)*w,h+.205+rise/2,side*run/2,.041,.041,slope*.993,
            i%3 ? '#686c61' : '#848479',turn)
        }
      }
      put(0,h+rise+.185,0,w+.29,.091,.20,'#66655a')
      put(w*.29,h+.89,d*.28,.62,1.03,.61,'#986b52')
      put(w*.29,h+1.433,d*.28,.79,.10,.76,'#80745f')
      return roof
    }

    const parapet = kind === 'cinema' ? .49 : kind === 'stoneStudio' ? .33 : .19
    for (const side of [-1,1]) {
      put(0,h+parapet*.57+.12,side*(d/2-.025),w+.23,parapet,.19,trim)
      put(0,h+parapet+.14,side*(d/2-.025),w+.32,.083,.28,'#7b7466')
      put(side*(w/2-.025),h+parapet*.57+.12,0,.19,parapet,d-.19,trim)
      put(side*(w/2-.025),h+parapet+.14,0,.29,.083,d-.29,'#7b7466')
    }
    if (kind === 'cinema') {
      put(0,h+.69,-d/2+.09,w*.68,.51,.27,'#b5ae97')
      put(0,h+1.026,-d/2+.09,w*.39,.28,.29,'#c0b9a2')
      put(0,h+1.184,-d/2+.09,w*.42,.071,.37,'#928b78')
      put(0,h+.69,-d/2-.065,w*.55,.074,.075,'#527269')
    }
    const chimneyX = w*.30
    const chimneyZ = d*.27
    put(chimneyX,h+.35,chimneyZ,.61,.58,.57,'#9b6b50')
    put(chimneyX,h+.659,chimneyZ,.73,.09,.69,'#9f907b')
    put(chimneyX,h+.719,chimneyZ,.38,.046,.34,'#494942')
    for (const side of [-1,1]) {
      put(-w*.25+side*.34,h+.165,-d*.15,.083,.12,d*.52,'#716f62')
    }
    put(-w*.25,h+.247,-d*.15,.74,.12,d*.40,'#817e70',[.035,0,0])
    return roof
  }, [h,w,d,kind])
  return <Instances geometry={GEO.box} material={SOLID} items={solid} castShadow />
}

function ShopFrontDetails({ building }) {
  const { kind, w, d, name } = building
  const face = -d/2
  const width = Math.min(7.8, w-.42)
  const sides = [-1,1]
  const frame = PROFILE[kind].frame
  if (kind === 'stoneStudio') return null
  const ticket = kind === 'cinema'
  const copy = {
    '월영각':['차와 다과','한양 찻상'], '백운 여관':['객실','숙박 안내'],
    '새벽양품점':['봄맞이 양품','옷감과 단추'], '은방울 다방':['오늘의 차','조용한 다방'],
    '유성 시계점':['벽시계','수리 접수'], '청운 인쇄소':['활자 인쇄','편지지와 봉투'],
    '은하극장':['유리창 너머','금일 상영'],
  }[name]
  return (
    <>
      {sides.map((side) => (
        <group key={side}>
          <Box p={[side*(width/2-.26),2.43,face-.32]} s={[.085,.38,.62]} r={[-.36,0,0]} c={frame} />
          <Box p={[side*(w/2-.34),1.97,face-.069]} s={[.34,.083,.23]} c="#a68d70" />
          <Box p={[side*(w/2-.34),1.74,face-.069]} s={[.28,.35,.163]} c="#665245" />
          <Box p={[side*(w/2-.34),1.745,face-.166]} s={[.177,.24,.055]} c="#d6bf93" />
          {copy && <group position={[side*(w/2-.63),1.02,face-.062]}>
            <Box p={[0,0,0]} s={ticket ? [.77,1.19,.15] : [.66,.74,.082]} c={frame} />
            <StreetSign text={copy[side < 0 ? 0 : 1]} p={[0,0,ticket ? -.081 : -.046]}
              w={ticket ? .65 : .56} h={ticket ? .97 : .61}
              background={side < 0 ? '#8b5344' : '#d9c2a0'} ink={side < 0 ? '#f3deb2' : '#593e31'} />
          </group>}
        </group>
      ))}
      {ticket && <Box p={[0,2.395,face-.925]} s={[width+.13,.101,.21]} c="#9a805c" />}
    </>
  )
}

export default function GyeongseongBuildingDetails({ building, materials, scans }) {
  const { w,d,kind } = building
  return (
    <>
      <Elevation position={[-w/2,0,0]} yaw={-Math.PI/2} span={d} building={building} materials={materials} scans={scans} />
      <Elevation position={[w/2,0,0]} yaw={Math.PI/2} span={d} building={building} materials={materials} scans={scans} />
      <Elevation position={[0,0,d/2]} yaw={0} span={w} building={building} materials={materials} scans={scans} rear />
      <RoofConstruction building={building} />
      <ShopFrontDetails building={building} />
      {kind === 'cinema' && <StreetSign text="은하극장" p={[0,building.h+.79,-d/2-.064]}
        w={w*.54} h={.34} background="#9b977f" ink="#334840" />}
    </>
  )
}
