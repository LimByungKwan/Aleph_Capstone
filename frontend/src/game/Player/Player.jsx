import { useFrame } from '@react-three/fiber'
import { useKeyboardControls } from '@react-three/drei'
import { Ecctrl } from 'ecctrl'
import * as THREE from 'three'
import { layout } from '../data/mapData.js'
import { useGameStore } from '../../store/gameStore.js'
import { PLAYER_JUMP_SPEED, PLAYER_RUN_SPEED, PLAYER_WALK_SPEED, RESPAWN_Y } from '../config.js'
import CharacterModel from './CharacterModel.jsx'

// 캐릭터 몸 크기 (지름 0.6m, 키 약 1.6m)
const CAPSULE_RADIUS = 0.3
const CAPSULE_HALF_HEIGHT = 0.5

// hub.json의 playerStart [x, z] 위, 1.5m 높이에서 떨어지며 시작
const [START_X, START_Z] = layout.playerStart
export const PLAYER_SPAWN = [START_X, 1.5, START_Z]

// 시작할 때 바라보는 방향 (hub.json의 playerStartYawDeg)
// 0 = 북쪽(-z), 90 = 서쪽(-x), -90 = 동쪽(+x), 180 = 남쪽(+z)
export const PLAYER_START_YAW = THREE.MathUtils.degToRad(layout.playerStartYawDeg)
export const PLAYER_START_FORWARD = [-Math.sin(PLAYER_START_YAW), -Math.cos(PLAYER_START_YAW)] // [x, z]

// 키 이름 ↔ 실제 키보드 키 (Scene.jsx의 KeyboardControls가 사용)
export const KEYBOARD_MAP = [
  { name: 'forward', keys: ['KeyW', 'ArrowUp'] },
  { name: 'backward', keys: ['KeyS', 'ArrowDown'] },
  { name: 'leftward', keys: ['KeyA', 'ArrowLeft'] },
  { name: 'rightward', keys: ['KeyD', 'ArrowRight'] },
  { name: 'jump', keys: ['Space'] },
  { name: 'run', keys: ['ShiftLeft', 'ShiftRight'] },
]

const NO_INPUT = { forward: false, backward: false, leftward: false, rightward: false, run: false, jump: false }

// 조작 가능한 캐릭터.
// ecctrl 2.x는 키보드를 직접 읽지 않아서, 여기서 매 프레임 키 상태를 읽어 setMovement로 넘겨 줌.
// playerRef: 카메라·센서가 캐릭터 위치를 알 수 있게 Scene에서 내려받는 ref
// showModel: 1인칭에서는 내 몸이 카메라를 가리지 않게 숨김
export default function Player({ playerRef, showModel = true }) {
  const [, getKeys] = useKeyboardControls()
  // 패널이 열려 있으면(inputLocked) 키 입력을 무시 → 캐릭터 정지
  const locked = useGameStore((state) => state.inputLocked)

  useFrame(() => {
    const player = playerRef.current
    if (!player) return

    player.setMovement(locked ? NO_INPUT : getKeys())

    // 맵 밖으로 떨어지면 시작 지점으로 리스폰
    if (player.currPos.y < RESPAWN_Y) {
      const [x, y, z] = PLAYER_SPAWN
      player.body.setTranslation({ x, y, z }, true)
      player.body.setLinvel({ x: 0, y: 0, z: 0 }, true)
    }
  })

  return (
    <Ecctrl
      ref={playerRef}
      name="player"
      position={PLAYER_SPAWN}
      capsuleRadius={CAPSULE_RADIUS}
      capsuleHalfHeight={CAPSULE_HALF_HEIGHT}
      maxWalkVel={PLAYER_WALK_SPEED}
      maxRunVel={PLAYER_RUN_SPEED}
      jumpVel={PLAYER_JUMP_SPEED}
      enableToggleRun={false}
    >
      {showModel && <CharacterModel playerRef={playerRef} />}
    </Ecctrl>
  )
}
