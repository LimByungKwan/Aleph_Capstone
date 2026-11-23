import { useEffect, useMemo } from 'react'
import { BoxGeometry } from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'

function scaledBox({ x, z, w, d, base, top, yaw = 0 }, repeatX, repeatY) {
  const height = top - base
  const shape = new BoxGeometry(w, height, d)
  const uv = shape.getAttribute('uv')
  const spans = [[d,height], [d,height], [w,d], [w,d], [w,height], [w,height]]
  spans.forEach(([u,v], face) => {
    for (let i = face * 4; i < face * 4 + 4; i += 1) {
      uv.setXY(i, uv.getX(i) * u / repeatX, uv.getY(i) * v / repeatY)
    }
  })
  return shape.rotateY(yaw).translate(x, (base+top)/2, z)
}

export default function ArchitecturalMasonry({ parts, material, repeatX = 2.7, repeatY = 2.1 }) {
  const geometry = useMemo(() => {
    const pieces = parts.map((part) => scaledBox(part, repeatX, repeatY))
    const merged = mergeGeometries(pieces)
    pieces.forEach((piece) => piece.dispose())
    return merged
  }, [parts, repeatX, repeatY])
  useEffect(() => () => geometry.dispose(), [geometry])
  return <mesh geometry={geometry} material={material} castShadow receiveShadow />
}
