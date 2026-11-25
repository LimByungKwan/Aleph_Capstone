import { useEffect, useMemo } from 'react'
import { MeshStandardMaterial, RepeatWrapping, SRGBColorSpace, TextureLoader } from 'three'
import { GEO } from '../kit.jsx'
import brickColor from './street-textures/red_brick_diffuse.webp'
import brickNormal from './street-textures/red_brick_nor_gl.webp'
import stoneColor from './street-textures/large_sandstone_blocks_01_diffuse.webp'
import stoneNormal from './street-textures/large_sandstone_blocks_01_nor_gl.webp'
import timberColor from './street-textures/fine_grained_wood_diffuse.webp'
import timberNormal from './street-textures/fine_grained_wood_nor_gl.webp'

// [3. 개발 > 프론트엔드] Poly Haven 사진 기반 재질. (CC0, https://polyhaven.com/license)
const SCANS = {
  brick: [brickColor, brickNormal, 2, 2, '#dbb5a0', .89, .88],
  stone: [stoneColor, stoneNormal, 2.8, 2.8, '#e9e0cf', .91, .62],
  timber: [timberColor, timberNormal, .72, .72, '#c6a888', .76, .46],
}

export function useStreetScans() {
  const scans = useMemo(() => {
    const loader = new TextureLoader()
    return Object.fromEntries(Object.entries(SCANS).map(([name, [colorUrl, normalUrl, u, v, color, roughness, depth]]) => {
      const map = loader.load(colorUrl)
      const normalMap = loader.load(normalUrl)
      map.colorSpace = SRGBColorSpace
      for (const texture of [map, normalMap]) {
        texture.wrapS = texture.wrapT = RepeatWrapping
        texture.anisotropy = 4
      }
      const material = new MeshStandardMaterial({ map, normalMap, color, roughness })
      material.normalScale.set(depth, depth)
      return [name, { material, u, v }]
    }))
  }, [])
  useEffect(() => () => {
    for (const { material } of Object.values(scans)) {
      material.map.dispose()
      material.normalMap.dispose()
      material.dispose()
    }
  }, [scans])
  return scans
}

export function StreetSurface({ scan, p, w, h, rotation = [0, 0, 0] }) {
  const { material, u, v } = scan
  const geometry = useMemo(() => {
    const plane = GEO.plane.clone()
    const uv = plane.attributes.uv
    for (let i = 0; i < uv.count; i += 1) uv.setXY(i, uv.getX(i) * w / u, uv.getY(i) * h / v)
    return plane
  }, [w, h, u, v])
  useEffect(() => () => geometry.dispose(), [geometry])
  return <mesh position={p} rotation={rotation} scale={[w,h,1]} geometry={geometry} material={material} receiveShadow />
}
