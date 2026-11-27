import { useEffect, useLayoutEffect, useRef } from 'react'
import { useThree } from '@react-three/fiber'
import { useLoadState } from '../store/loadState.js'

// [SG 성능 최적화] 셰이더 미리 컴파일
// three.js는 재질이 "처음 화면에 보일 때" 셰이더를 컴파일하고, 끝날 때까지 화면이 멈춘다 (걷다가 0.1~1초 끊김).
// 시작할 때 장면 전체(숨겨진 물체 포함)를 미리 컴파일해 두면 걷는 도중에는 컴파일이 일어나지 않는다.
// compileAsync는 브라우저의 병렬 컴파일(KHR_parallel_shader_compile)을 써서 기다리는 동안에도 화면이 멈추지 않는다.
// (11/27 성능) 예전엔 한 프레임 뒤에 시작해서, 그 첫 프레임이 셰이더 수백 개를 한꺼번에 동기 컴파일하며 ~2초 멈췄음
//   → 첫 로딩 때만 컴파일이 끝날 때까지 그리기를 멈춤 (로딩 화면이 덮고 있어 안 보임)
export default function ShaderWarmup({ trigger, camera }) {
  const gl = useThree((state) => state.gl)
  const scene = useThree((state) => state.scene)
  const setFrameloop = useThree((state) => state.setFrameloop)
  const first = useRef(true)
  const mapReady = useLoadState((s) => s.mapReady) // 맵 소품을 다 붙인 뒤에 한 번에 컴파일 (MapLayout이 나눠 붙임)

  // 첫 프레임이 그려지기 전에 멈춤 (layout effect는 첫 프레임보다 먼저 실행됨)
  useLayoutEffect(() => {
    if (first.current) setFrameloop('never')
  }, [setFrameloop])

  useEffect(() => {
    // 일반 effect에서 시작: 같은 커밋의 다른 effect(PointLightLock의 조명 정리 등)가 끝난 뒤라 조명 개수가 맞는 셰이더로 컴파일됨
    if (!mapReady) return
    let alive = true
    const start = performance.now()
    gl.compileAsync(scene, camera)
      .catch((error) => console.warn('[ShaderWarmup] 미리 컴파일 실패, 그리면서 컴파일함', error))
      .then(() => {
        if (first.current) {
          first.current = false
          setFrameloop('always')
        }
        // 실제로 두 프레임을 그린 뒤 로딩 화면을 걷음: 첫 그리기에 남은 셰이더 마무리(~1초 멈춤)가 로딩 화면 밑에서 일어나게
        return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
      })
      .then(() => {
        if (!alive) return
        useLoadState.getState().setShadersReady() // 첫 로딩 화면이 이걸 보고 사라짐 (병관)
        if (import.meta.env.DEV) console.info(`[ShaderWarmup] ${gl.info.programs.length}개 셰이더 준비, ${Math.round(performance.now() - start)}ms`)
      })
    return () => {
      alive = false
    }
  }, [gl, scene, camera, trigger, setFrameloop, mapReady])

  return null
}
