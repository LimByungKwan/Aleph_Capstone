import * as THREE from 'three'

// 한옥식 우진각(hip) 지붕. 네 귀퉁이 처마가 살짝 들려 올라가요.
// width × depth 바닥 크기, height 높이, lift = 귀퉁이가 들리는 정도(m)
// 바닥 중심이 (0, 0, 0)이고 위쪽(+y)으로 솟아요.
export function hipRoofGeometry(width, depth, height, lift = 0.3, segments = 8) {
  const swap = depth > width
  const long = swap ? depth : width
  const short = swap ? width : depth
  const r = (long - short) / 2 // 용마루(꼭대기 선) 길이의 절반

  // 처마선 높이: 가운데는 0, 양 끝(귀퉁이)으로 갈수록 들림
  const eaveY = (t) => lift * Math.pow(2 * t - 1, 4)

  const positions = []
  const tri = (a, b, c) => positions.push(...a, ...b, ...c)
  const ridgeLeft = [-r, height, 0]
  const ridgeRight = [r, height, 0]

  // 긴 쪽 두 면 (앞 +z, 뒤 -z)
  for (const side of [1, -1]) {
    for (let i = 0; i < segments; i++) {
      const t0 = i / segments
      const t1 = (i + 1) / segments
      const e0 = [-long / 2 + long * t0, eaveY(t0), (side * short) / 2]
      const e1 = [-long / 2 + long * t1, eaveY(t1), (side * short) / 2]
      const r0 = [-r + 2 * r * t0, height, 0]
      const r1 = [-r + 2 * r * t1, height, 0]
      if (side === 1) {
        tri(e0, e1, r1)
        tri(e0, r1, r0)
      } else {
        tri(e1, e0, r0)
        tri(e1, r0, r1)
      }
    }
  }

  // 짧은 쪽 두 면 (삼각형)
  for (const side of [1, -1]) {
    const top = side === 1 ? ridgeRight : ridgeLeft
    for (let i = 0; i < segments; i++) {
      const t0 = i / segments
      const t1 = (i + 1) / segments
      const e0 = [(side * long) / 2, eaveY(t0), -short / 2 + short * t0]
      const e1 = [(side * long) / 2, eaveY(t1), -short / 2 + short * t1]
      if (side === 1) tri(e1, e0, top)
      else tri(e0, e1, top)
    }
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.computeVertexNormals()
  if (swap) geometry.rotateY(Math.PI / 2)
  return geometry
}
