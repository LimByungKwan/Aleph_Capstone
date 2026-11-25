// (담당: 병관) 카메라에 가까운 장소 이름표만 표시해 산책 화면을 정리합니다.
import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'

export function usePlaceLabelVisibility([x, y, z], isGuide) {
  const label = useRef(null)
  const range = isGuide ? 34 : 26
  useFrame(({ camera }) => {
    const node = label.current
    if (!node) return
    const { x: cx, y: cy, z: cz } = camera.position
    const limit = node.hidden ? range : range + 2
    const hidden = (x - cx) ** 2 + (y - cy) ** 2 + (z - cz) ** 2 > limit ** 2
    if (node.hidden !== hidden) node.hidden = hidden
  })
  return label
}
