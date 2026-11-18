import { useEffect } from 'react'
import { useThree } from '@react-three/fiber'

// [SG 성능 최적화] 셰이더 미리 컴파일
// three.js는 재질이 "처음 화면에 보일 때" 셰이더를 컴파일하고, 끝날 때까지 화면이 멈춘다 (걷다가 0.1~1초 끊김).
// 시작할 때 장면 전체(숨겨진 물체 포함)를 미리 컴파일해 두면 걷는 도중에는 컴파일이 일어나지 않는다.
// compileAsync는 브라우저의 병렬 컴파일(KHR_parallel_shader_compile)을 써서 기다리는 동안에도 화면이 멈추지 않는다.
export default function ShaderWarmup({ trigger }) {
  const gl = useThree((state) => state.gl)
  const scene = useThree((state) => state.scene)
  const camera = useThree((state) => state.camera)

  useEffect(() => {
    // 한 프레임 뒤에 실행: 같은 시점에 막 추가된 물체(캐릭터 등)까지 장면에 들어온 뒤 컴파일
    const id = requestAnimationFrame(() => {
      const start = performance.now()
      gl.compileAsync(scene, camera).then(() => {
        if (import.meta.env.DEV) console.info(`[ShaderWarmup] ${gl.info.programs.length}개 셰이더 준비, ${Math.round(performance.now() - start)}ms`)
      })
    })
    return () => cancelAnimationFrame(id)
  }, [gl, scene, camera, trigger])

  return null
}
