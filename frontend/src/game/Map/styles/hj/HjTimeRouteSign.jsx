import { useMemo } from 'react'
import * as THREE from 'three'

const signs = new Map()

function routeTexture(outbound) {
  if (signs.has(outbound)) return signs.get(outbound)
  const canvas = document.createElement('canvas')
  canvas.width = 1024
  canvas.height = 224
  const ctx = canvas.getContext('2d')
  const ink = outbound ? '#fff2d4' : '#302c28'
  ctx.fillStyle = outbound ? '#222a29' : '#efe5ce'
  ctx.fillRect(0, 0, 1024, 224)
  ctx.strokeStyle = outbound ? '#c8b590' : '#625744'
  ctx.lineWidth = 6
  ctx.strokeRect(6, 6, 1012, 212)
  ctx.lineWidth = 2
  ctx.strokeRect(15, 15, 994, 194)
  ctx.fillStyle = ink
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const stations = [
    ['경성(1930년)', '京城  ·  KEIJŌ'],
    ['서울(2026년)', '서울  ·  SEOUL'],
  ]
  if (!outbound) stations.reverse()
  stations.forEach(([station, legend], i) => {
    const x = i === 0 ? 257 : 767
    ctx.font = 'bold 60px "Batang", "Noto Serif KR", serif'
    ctx.fillText(station, x, 91, 415)
    ctx.font = '32px "Batang", Georgia, serif'
    ctx.fillText(legend, x, 158)
  })
  ctx.font = 'bold 70px sans-serif'
  ctx.fillText('→', 512, 95)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  signs.set(outbound, texture)
  return texture
}

// 양면에 글자를 따로 그려 선로 쪽에서도 진행 순서를 그대로 읽을 수 있다.
export function HjTimeRouteSign({ fromGyeongseong = false, width }) {
  const texture = useMemo(() => routeTexture(fromGyeongseong), [fromGyeongseong])
  const height = width * 224 / 1024
  return (
    <group>
      <mesh>
        <boxGeometry args={[width + 0.03, height + 0.03, 0.08]} />
        <meshStandardMaterial color="#514737" />
      </mesh>
      {[1, -1].map(side => (
        <mesh key={side} position-z={side * 0.042} rotation-y={side === 1 ? 0 : Math.PI}>
          <planeGeometry args={[width, height]} />
          <meshBasicMaterial map={texture} toneMapped={false} />
        </mesh>
      ))}
    </group>
  )
}
