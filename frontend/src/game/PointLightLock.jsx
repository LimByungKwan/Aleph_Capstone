import { useEffect } from 'react'
import { useThree } from '@react-three/fiber'

// [SG 성능 최적화] 점광원 개수 고정 (로컬 검수용 실험)
// three.js는 "켜진 조명 개수"를 셰이더 코드에 넣는다 → 개수가 바뀌면 화면의 모든 재질 셰이더를 다시 컴파일해서 0.1~1초 멈춘다.
// MapLayout의 거리 숨김(DetailCell)이 랜턴·조명이 든 묶음을 숨기면 개수가 3↔11개로 바뀌므로,
// 점광원만 장면 맨 위(항상 보이는 곳)로 옮겨 개수를 고정한다. attach는 월드 위치를 그대로 유지한다.
// shortcut: 옮긴 조명은 원래 묶음이 사라져도 남는다(현재 조명은 모두 고정 위치·한 번만 생성). 팀 합의 후 MapLayout에서 조명을 숨김 대상에서 빼는 방식으로 바꾼다.
export default function PointLightLock() {
  const scene = useThree((state) => state.scene)

  useEffect(() => {
    const lights = []
    scene.traverse((object) => {
      if (object.isPointLight && object.parent !== scene) lights.push(object)
    })
    lights.forEach((light) => scene.attach(light))
    if (import.meta.env.DEV) console.info(`[PointLightLock] 점광원 ${lights.length}개 고정`)
  }, [scene])

  return null
}
