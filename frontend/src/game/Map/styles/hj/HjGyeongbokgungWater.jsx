import { useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { CanvasTexture, PlaneGeometry, RepeatWrapping } from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { GEO, Instances, mat, seeded } from '../kit.jsx'
import { CHANNELS, PONDS, POND_SURFACE } from './gyeongbokgungLayout.js'

const POND_PLANES = [
  ...PONDS.map(({ x, z, w, d }) => [x,z,w,d]),
  ...CHANNELS,
]
const AQUATIC = mat('#fff', { roughness:.79 })
const PETALS = mat('#fff', { emissive:'#5e4831', emissiveIntensity:.16 })

// [3. 개발 > 렌더링] 수면 광택은 반복 요철로 만들고, 반사 전용 장면 렌더는 생략합니다.
function pondRipples() {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 128
  const ctx = canvas.getContext('2d')
  const pixels = ctx.createImageData(128,128)
  for (let y = 0; y < 128; y += 1) {
    for (let x = 0; x < 128; x += 1) {
      const u = x * Math.PI/64, v = y * Math.PI/64
      const value = 128 + 23*Math.sin(5*v+Math.sin(2*u)) + 11*Math.sin(7*v-2*u)
      const at = (y*128+x)*4
      pixels.data.set([value,value,value,255],at)
    }
  }
  ctx.putImageData(pixels,0,0)
  const map = new CanvasTexture(canvas)
  map.wrapS = map.wrapT = RepeatWrapping
  return map
}

function PalacePondWater() {
  const { geometry, ripples } = useMemo(() => {
    const patches = POND_PLANES.map(([x,z,w,d]) => {
      const patch = new PlaneGeometry(w,d).rotateX(-Math.PI/2).translate(x,POND_SURFACE,z)
      const uv = patch.getAttribute('uv')
      for (let i = 0; i < uv.count; i += 1) uv.setXY(i, uv.getX(i)*w/6, uv.getY(i)*d/4)
      return patch
    })
    const geometry = mergeGeometries(patches)
    patches.forEach(patch => patch.dispose())
    return { geometry,ripples:pondRipples() }
  }, [])
  useEffect(() => () => { geometry.dispose(); ripples.dispose() }, [geometry,ripples])
  useFrame(({ clock }) => {
    ripples.offset.set(clock.elapsedTime*.019,clock.elapsedTime*.026)
  })
  return (
    <mesh geometry={geometry} userData={{ noShadow:true }}>
      <meshStandardMaterial color="#527b77" emissive="#244f50" emissiveIntensity={.24}
        bumpMap={ripples} bumpScale={.038} roughness={.23} metalness={.19} />
    </mesh>
  )
}

export function GyeongbokgungWater() {
  const { leaves, flowers } = useMemo(() => {
    const rng = seeded(491)
    const leaves = [], flowers = []
    for (const [cx, cz, count] of [[-35.6,-18.4,23],[-35.5,-5.5,22],[-22.55,-18.25,18],[-23.3,-5.75,17]]) {
      for (let i = 0; i < count; i += 1) {
        const x = cx + (rng() - .5) * 3.4
        const z = cz + (rng() - .5) * 2.7
        const size = .08 + rng() * .13
        leaves.push({ p: [x, POND_SURFACE + .016 + (i % 7) * .001, z],
          s: [size, .017, size * .87], r: [0, rng() * Math.PI, 0],
          c: ['#64784b', '#819052', '#446152', '#556d39'][i % 4] })
        if (i % 6 === 0) flowers.push({ p: [x, POND_SURFACE + .055, z], s: [.085, .043, .084], c: '#e5bfaa' })
      }
    }
    return { leaves, flowers }
  }, [])
  return (
    <>
      <PalacePondWater />
      <Instances geometry={GEO.cyl8} material={AQUATIC} items={leaves} />
      <Instances geometry={GEO.sphere} material={PETALS} items={flowers} />
    </>
  )
}
