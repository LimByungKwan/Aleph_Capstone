import { Box, mat } from '../kit.jsx'

const ROOM_HEIGHT = 2.72
const WALL_DEPTH = 0.2
const DOOR_WIDTH = 1.8
const LAMP = mat('#ffebc0', { emissive: '#ffbc72', emissiveIntensity: 0.75 })

// [3. 개발 > 프론트엔드] 열린 입구와 대응하는 벽 충돌 좌표는 HJ 구역 데이터에 배치.
export default function HjWalkInRoom({ width, depth, material, shop = false }) {
  const panel = (width - DOOR_WIDTH) / 2
  return (
    <group>
      <Box p={[0, 0.01, 0]} s={[width, 0.18, depth]} c={shop ? '#b29b7e' : '#a67d51'} />
      <Box name="camera-blocker" p={[0, ROOM_HEIGHT - 0.06, 0]} s={[width, 0.12, depth]} c="#dcc7aa" />
      <Box name="camera-blocker" p={[0, ROOM_HEIGHT / 2, -depth / 2 + WALL_DEPTH / 2]}
        s={[width, ROOM_HEIGHT, WALL_DEPTH]} m={material} />
      {[-1, 1].map((side) => (
        <group key={side}>
          <Box name="camera-blocker" p={[side * (width - WALL_DEPTH) / 2, ROOM_HEIGHT / 2, 0]}
            s={[WALL_DEPTH, ROOM_HEIGHT, depth]} m={material} />
          <Box name="camera-blocker" p={[side * (DOOR_WIDTH + panel) / 2, ROOM_HEIGHT / 2, depth / 2 - WALL_DEPTH / 2]}
            s={[panel, ROOM_HEIGHT, WALL_DEPTH]} m={material} />
        </group>
      ))}
      <Box name="camera-blocker" p={[0, 2.48, depth / 2 - WALL_DEPTH / 2]} s={[DOOR_WIDTH, 0.48, WALL_DEPTH]} c="#71513a" />
      <Box p={[0, 2.56, -0.4]} s={[0.68, 0.11, 0.44]} m={LAMP} />
      <pointLight position={[0, 2.35, -0.4]} color="#ffc889" intensity={16} distance={6} />
      {shop ? (
        <>
          <Box p={[width * 0.24, 0.48, -depth * 0.22]} s={[1.65, 0.85, 0.82]} c="#72513c" />
          <Box p={[width * 0.24, 0.94, -depth * 0.22]} s={[1.76, 0.12, 0.92]} c="#b39362" />
          <Box p={[-width * 0.22, 1.14, -depth * 0.37]} s={[2.24, 2.1, 0.52]} c="#74563e" />
          {[0.48, 1.01, 1.55].map((y) => (
            <group key={y}>
              <Box p={[-width * 0.22, y, -depth * 0.37 + 0.23]} s={[2.29, 0.11, 0.56]} c="#ae9269" />
              {['#c36145', '#d4b453', '#416d54', '#b89b72', '#a4503f'].map((color, i) => (
                <Box key={color} p={[-width * 0.22 + (i - 2) * 0.34, y + 0.21, -depth * 0.37 + 0.43]}
                  s={[0.19, 0.30, 0.21]} c={color} />
              ))}
            </group>
          ))}
        </>
      ) : (
        <>
          <Box p={[0, 0.112, -depth * 0.11]} s={[2.3, 0.022, 1.78]} c="#c6ab78" />
          <Box p={[0, 0.41, -depth * 0.11]} s={[1.48, 0.15, 0.8]} c="#735039" />
          {[-0.54, 0.54].map((x) => (
            <Box key={x} p={[x, 0.24, -depth * 0.11]} s={[0.16, 0.3, 0.52]} c="#735039" />
          ))}
          {[-0.69, 0.69].map((z) => (
            <Box key={z} p={[0, 0.16, -depth * 0.11 + z]} s={[0.55, 0.10, 0.42]} c="#9d594a" />
          ))}
        </>
      )}
    </group>
  )
}
