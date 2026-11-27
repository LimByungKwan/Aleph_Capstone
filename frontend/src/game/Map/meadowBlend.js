import { Color, Vector2 } from 'three'
import { SKY_COLORS } from '../config.js'

export function meadowBlend([width, depth], offset = [0, 0]) {
  const halfSize = new Vector2(width / 2, depth / 2)
  const center = new Vector2(...offset)
  const edgeColor = new Color(SKY_COLORS.outerGround)
  return (shader) => {
    shader.uniforms.meadowHalfSize = { value: halfSize }
    shader.uniforms.meadowCenter = { value: center }
    shader.uniforms.meadowColor = { value: edgeColor }
    shader.vertexShader = `varying vec2 vMeadowPosition;\nuniform vec2 meadowCenter;\n${shader.vertexShader}`
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvMeadowPosition = position.xz - meadowCenter;')
    shader.fragmentShader = `varying vec2 vMeadowPosition;\nuniform vec2 meadowHalfSize;\nuniform vec3 meadowColor;\n${shader.fragmentShader}`
      .replace('#include <map_fragment>', `#include <map_fragment>
        vec2 edgeDistance = meadowHalfSize - abs(vMeadowPosition);
        float meadowWeight = smoothstep(0.0, 28.0, min(edgeDistance.x, edgeDistance.y));
        diffuseColor.rgb = mix(meadowColor, diffuseColor.rgb, meadowWeight);
      `)
  }
}
