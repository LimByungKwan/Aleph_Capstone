import { MathUtils, Quaternion, Vector3 } from 'three'

const UP = new Vector3(0, 1, 0)
const PALM = new Vector3(0, 0, 1) // RightHand 뼈에서 손바닥이 향하는 축

// 애니메이션 믹서가 기본 자세를 갱신한 뒤 오른팔 자세를 덧씌웁니다.
export function createWavePose(model, characterId) {
  const male = characterId === 'male'
  const shoulder = model.getObjectByName('RightShoulder')
  const arm = model.getObjectByName('RightArm')
  const forearm = model.getObjectByName('RightForeArm')
  const hand = model.getObjectByName('RightHand')
  if (!shoulder || !arm || !forearm || !hand) return null

  const from = new Vector3()
  const to = new Vector3()
  const side = new Vector3()
  const axis = new Vector3()
  const target = new Vector3()
  const facing = new Vector3()
  const direction = new Vector3()
  const palm = new Vector3()
  const cross = new Vector3()
  const turn = new Quaternion()
  const worldRotation = new Quaternion()
  const parentRotation = new Quaternion()
  const baseShoulder = new Quaternion()
  const baseShoulderPosition = new Vector3()
  const chest = shoulder.parent
  const baseChest = new Quaternion()
  const baseArm = new Quaternion()
  const baseForearm = new Quaternion()
  const baseHand = new Quaternion()
  let photoWeight = 0
  let applied = false

  function applyWorldTurn(bone) {
    bone.getWorldQuaternion(worldRotation)
    bone.parent.getWorldQuaternion(parentRotation)
    bone.quaternion.copy(parentRotation.invert().multiply(turn.multiply(worldRotation)))
  }

  function aim(bone, child, direction, amount) {
    bone.getWorldPosition(from)
    child.getWorldPosition(to)
    axis.copy(to).sub(from).normalize()
    target.copy(axis).lerp(direction, amount).normalize()
    turn.setFromUnitVectors(axis, target)
    applyWorldTurn(bone)
  }

  function apply(time, amount, face = model.getWorldDirection(facing)) {
    baseChest.copy(chest.quaternion)
    baseShoulderPosition.copy(shoulder.position)
    baseShoulder.copy(shoulder.quaternion)
    baseArm.copy(arm.quaternion)
    baseForearm.copy(forearm.quaternion)
    baseHand.copy(hand.quaternion)
    applied = true
    shoulder.getWorldPosition(from)
    arm.getWorldPosition(to)
    const collarLength = from.distanceTo(to)
    side.copy(to).sub(from).setY(0).normalize()
    // 몸통과 재킷도 손을 드는 쪽을 따라가도록 가슴을 조금 기울입니다.
    turn.setFromAxisAngle(axis.crossVectors(side, UP).normalize(), 0.07 * amount)
    applyWorldTurn(chest)
    // 쇄골의 회전축 자체를 올려 팔을 들 때 어깨 끝이 목 쪽으로 올라오게 합니다.
    shoulder.getWorldPosition(from).addScaledVector(UP, collarLength * (male ? 0.32 : 0.55) * amount)
    shoulder.position.copy(chest.worldToLocal(from))
    direction.copy(side).addScaledVector(UP, 0.56).addScaledVector(face, 0.12).normalize()
    aim(shoulder, arm, direction, amount)
    direction.copy(side).addScaledVector(UP, male ? -0.24 : 0.23).addScaledVector(face, male ? 0.5 : 0.32).normalize()
    aim(arm, forearm, direction, amount)
    const swing = Math.sin(time * 6.8)
    direction.copy(UP).addScaledVector(side, 0.08 + swing * 0.17).addScaledVector(face, 0.12).normalize()
    aim(forearm, hand, direction, amount)

    forearm.getWorldPosition(from)
    hand.getWorldPosition(to)
    axis.copy(to).sub(from).normalize()
    hand.getWorldQuaternion(worldRotation)
    palm.copy(PALM).applyQuaternion(worldRotation)
    palm.addScaledVector(axis, -palm.dot(axis)).normalize()
    target.copy(face).addScaledVector(axis, -face.dot(axis)).normalize()
    const angle = Math.atan2(axis.dot(cross.crossVectors(palm, target)), palm.dot(target))
    const twistLimit = male ? 0.45 : 1.15
    turn.setFromAxisAngle(axis, MathUtils.clamp(angle, -twistLimit, twistLimit) * amount)
    applyWorldTurn(forearm)
    turn.setFromAxisAngle(face, Math.sin(time * 6.8 - 0.25) * 0.19 * amount)
    applyWorldTurn(hand)
  }

  function reset() {
    if (!applied) return
    chest.quaternion.copy(baseChest)
    shoulder.position.copy(baseShoulderPosition)
    shoulder.quaternion.copy(baseShoulder)
    arm.quaternion.copy(baseArm)
    forearm.quaternion.copy(baseForearm)
    hand.quaternion.copy(baseHand)
    applied = false
  }

  function updatePhoto(active, time, dt) {
    photoWeight = MathUtils.damp(photoWeight, active ? 1 : 0, 7, dt)
    if (photoWeight > 0.002) apply(time, photoWeight)
  }

  return { apply, reset, updatePhoto }
}
