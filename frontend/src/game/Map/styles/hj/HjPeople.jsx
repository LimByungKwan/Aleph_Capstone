import { Ball, Box, Cyl } from '../kit.jsx'

// [3. 개발 > 프론트엔드] 1930년대 승객 인형 (혜진 영화·드라마 구역) — 전차·기차 좌석과 승강장에 둬요.
// 앞 = +z. 앉은 사람은 엉덩이(앉는 면)가 (0, 0, 0). 서 있는 사람은 발이 (0, 0, 0).
// look: 0~ 숫자 하나로 옷·모자 조합이 정해져요 (같은 자리는 늘 같은 모습).

const COATS = ['#2b2c30', '#3b3f52', '#5a4434', '#6b5a48', '#2f3d36', '#7a6a58']
const SKIN = '#e2c3a3'
const HAIR = '#1e1a17'

function outfit(look) {
  const coat = COATS[look % COATS.length]
  const hanbok = look % 5 === 2 // 한복 차림 (흰 저고리 + 치마)
  const hat = !hanbok && look % 3 !== 1 // 중절모
  return { coat, hanbok, hat, skirt: ['#3d5a7a', '#7a2e3a', '#e8e0cf'][look % 3] }
}

export function SeatedPerson({ look = 0, position, yaw = 0 }) {
  const o = outfit(look)
  return (
    <group position={position} rotation-y={yaw}>
      {/* 다리: 허벅지(앞으로) + 정강이(아래로) */}
      {o.hanbok ? (
        <Box p={[0, -0.12, 0.2]} s={[0.42, 0.5, 0.5]} c={o.skirt} />
      ) : (
        [-0.09, 0.09].map((x) => (
          <group key={x}>
            <Box p={[x, 0.07, 0.2]} s={[0.15, 0.14, 0.42]} c="#2a2a2c" />
            <Box p={[x, -0.2, 0.39]} s={[0.13, 0.42, 0.13]} c="#2a2a2c" />
            <Box p={[x, -0.42, 0.44]} s={[0.13, 0.06, 0.22]} c="#141414" />
          </group>
        ))
      )}
      {/* 몸통 + 팔 */}
      <Box p={[0, 0.35, -0.04]} s={[0.4, 0.56, 0.24]} c={o.hanbok ? '#f1ece0' : o.coat} />
      {[-1, 1].map((s) => (
        <Box key={s} p={[s * 0.23, 0.28, 0.06]} s={[0.1, 0.42, 0.12]} r={[-0.5, 0, 0]} c={o.hanbok ? '#f1ece0' : o.coat} />
      ))}
      {/* 머리 + 머리카락/모자 */}
      <Ball p={[0, 0.76, -0.03]} rad={0.13} c={SKIN} />
      {o.hat ? (
        <group position={[0, 0.88, -0.03]}>
          <Cyl p={[0, 0, 0]} rad={0.2} h={0.03} c="#1f1d1b" />
          <Cyl p={[0, 0.08, 0]} rad={0.12} h={0.14} c="#1f1d1b" />
        </group>
      ) : (
        <Ball p={[0, 0.82, -0.06]} rad={0.13} s={[0.14, 0.1, 0.14]} c={HAIR} />
      )}
    </group>
  )
}

export function StandingPerson({ look = 0, position, yaw = 0, suitcase = false }) {
  const o = outfit(look)
  return (
    <group position={position} rotation-y={yaw}>
      {o.hanbok ? (
        <Cyl p={[0, 0.45, 0]} rad={0.26} h={0.9} c={o.skirt} />
      ) : (
        [-0.1, 0.1].map((x) => <Box key={x} p={[x, 0.42, 0]} s={[0.14, 0.84, 0.16]} c="#2a2a2c" />)
      )}
      <Box p={[0, 1.1, 0]} s={[0.44, 0.62, 0.26]} c={o.hanbok ? '#f1ece0' : o.coat} />
      {!o.hanbok && <Box p={[0, 0.78, 0]} s={[0.46, 0.2, 0.28]} c={o.coat} />}
      {[-1, 1].map((s) => (
        <Box key={s} p={[s * 0.27, 1.02, 0]} s={[0.1, 0.55, 0.12]} c={o.hanbok ? '#f1ece0' : o.coat} />
      ))}
      <Ball p={[0, 1.55, 0]} rad={0.13} c={SKIN} />
      {o.hat ? (
        <group position={[0, 1.67, 0]}>
          <Cyl p={[0, 0, 0]} rad={0.2} h={0.03} c="#1f1d1b" />
          <Cyl p={[0, 0.08, 0]} rad={0.12} h={0.14} c="#1f1d1b" />
        </group>
      ) : (
        <Ball p={[0, 1.6, -0.03]} rad={0.13} s={[0.14, 0.1, 0.14]} c={HAIR} />
      )}
      {suitcase && (
        <group position={[0.36, 0, 0.05]}>
          <Box p={[0, 0.3, 0]} s={[0.14, 0.42, 0.55]} c="#6b4426" />
          <Box p={[0, 0.54, 0]} s={[0.04, 0.05, 0.16]} c="#2a1c12" />
        </group>
      )}
    </group>
  )
}
