import * as THREE from 'three'
import { handGesturePose, type HandGesture } from '@/lib/proceduralPoses'
import { quatFromDegrees, type Pose } from '@/lib/poses'

export type BoneAxis = 'x' | 'y' | 'z'

export type PoseOp =
  | { type: 'rotateBone'; bone: string; axis: BoneAxis; degrees: number }
  | {
      type: 'nudgeArm'
      side: 'left' | 'right'
      raise?: number
      out?: number
      twist?: number      // Y-axis longitudinal twist (Turn Out / Turn In) on upper arm
      foreArm?: number    // Y-axis twist (Turn Out / Turn In) on forearm
      foreArmFlex?: number // Z-axis flex (Lift / Lower) on forearm
    }
  | { type: 'nudgeTorso'; pitch?: number; yaw?: number; roll?: number }
  | { type: 'nudgeStance'; width?: number }
  | {
      type: 'nudgeLeg'
      side: 'left' | 'right'
      part?: 'thigh' | 'lower' | 'foot'
      forward?: number
      out?: number        // Z-axis abduction for thigh; Y-axis for lower/foot
      twist?: number      // Y-axis internal/external rotation (thigh Turn Out / Turn In)
    }
  | { type: 'setHand'; side: 'left' | 'right'; gesture: HandGesture }

function quatArrayToPosePart(q: THREE.Quaternion): [number, number, number, number] {
  return [q.x, q.y, q.z, q.w]
}

function multiplyBoneDelta(
  pose: Pose,
  bone: string,
  xDeg = 0,
  yDeg = 0,
  zDeg = 0
): void {
  const existing = new THREE.Quaternion().fromArray(pose[bone] ?? quatFromDegrees())
  const increment = new THREE.Quaternion().fromArray(quatFromDegrees(xDeg, yDeg, zDeg))
  existing.multiply(increment).normalize()
  pose[bone] = quatArrayToPosePart(existing)
}

function applyRotateBone(pose: Pose, op: Extract<PoseOp, { type: 'rotateBone' }>) {
  const { bone, axis, degrees } = op
  if (axis === 'x') multiplyBoneDelta(pose, bone, degrees, 0, 0)
  if (axis === 'y') multiplyBoneDelta(pose, bone, 0, degrees, 0)
  if (axis === 'z') multiplyBoneDelta(pose, bone, 0, 0, degrees)
}

function applyNudgeArm(pose: Pose, op: Extract<PoseOp, { type: 'nudgeArm' }>) {
  const prefix = op.side === 'left' ? 'Left' : 'Right'
  const raise = op.raise ?? 0
  const out = op.out ?? 0
  const twist = op.twist ?? 0
  const foreArm = op.foreArm ?? 0
  const foreArmFlex = op.foreArmFlex ?? 0

  if (raise !== 0 || out !== 0) {
    if (op.side === 'left') {
      multiplyBoneDelta(pose, `${prefix}Arm`, -raise, 0, -out)
    } else {
      multiplyBoneDelta(pose, `${prefix}Arm`, -raise, 0, out)
    }
  }

  if (twist !== 0) {
    // Y-axis: longitudinal twist of the upper arm (Turn Out / Turn In)
    if (op.side === 'left') {
      multiplyBoneDelta(pose, `${prefix}Arm`, 0, twist, 0)
    } else {
      multiplyBoneDelta(pose, `${prefix}Arm`, 0, -twist, 0)
    }
  }

  if (foreArm !== 0) {
    // Y-axis: twist / supination of forearm (Turn Out / Turn In)
    if (op.side === 'left') {
      multiplyBoneDelta(pose, `${prefix}ForeArm`, 0, foreArm, 0)
    } else {
      multiplyBoneDelta(pose, `${prefix}ForeArm`, 0, -foreArm, 0)
    }
  }

  if (foreArmFlex !== 0) {
    // Z-axis: flexion / extension (Lift / Lower) — mirror for right side
    if (op.side === 'left') {
      multiplyBoneDelta(pose, `${prefix}ForeArm`, 0, 0, foreArmFlex)
    } else {
      multiplyBoneDelta(pose, `${prefix}ForeArm`, 0, 0, -foreArmFlex)
    }
  }
}

function applyNudgeTorso(pose: Pose, op: Extract<PoseOp, { type: 'nudgeTorso' }>) {
  const pitch = op.pitch ?? 0
  const yaw = op.yaw ?? 0
  const roll = op.roll ?? 0
  if (pitch === 0 && yaw === 0 && roll === 0) return

  multiplyBoneDelta(pose, 'Spine', pitch * 0.45, yaw * 0.45, roll * 0.45)
  multiplyBoneDelta(pose, 'Spine1', pitch * 0.35, yaw * 0.35, roll * 0.35)
  multiplyBoneDelta(pose, 'Spine2', pitch * 0.2, yaw * 0.2, roll * 0.2)
}

function applyNudgeStance(pose: Pose, op: Extract<PoseOp, { type: 'nudgeStance' }>) {
  const width = op.width ?? 0
  if (width === 0) return
  multiplyBoneDelta(pose, 'LeftUpLeg', 0, -width, 0)
  multiplyBoneDelta(pose, 'RightUpLeg', 0, width, 0)
}

function legBone(side: 'left' | 'right', part: 'thigh' | 'lower' | 'foot'): string {
  if (side === 'left') {
    if (part === 'thigh') return 'LeftUpLeg'
    if (part === 'lower') return 'LeftLeg'
    return 'LeftFoot'
  }
  if (part === 'thigh') return 'RightUpLeg'
  if (part === 'lower') return 'RightLeg'
  return 'RightFoot'
}

function applyNudgeLeg(pose: Pose, op: Extract<PoseOp, { type: 'nudgeLeg' }>) {
  const part = op.part ?? 'thigh'
  const bone = legBone(op.side, part)
  const forward = op.forward ?? 0
  const out = op.out ?? 0
  const twist = op.twist ?? 0

  if (forward !== 0 || out !== 0) {
    if (part === 'thigh') {
      // Z-axis: true abduction/adduction (leg swings sideways — Out/In)
      if (op.side === 'left') {
        multiplyBoneDelta(pose, bone, forward, 0, -out)
      } else {
        multiplyBoneDelta(pose, bone, forward, 0, out)
      }
    } else {
      // Y-axis for lower leg / foot (knee/ankle twist-out)
      if (op.side === 'left') {
        multiplyBoneDelta(pose, bone, forward, -out, 0)
      } else {
        multiplyBoneDelta(pose, bone, forward, out, 0)
      }
    }
  }

  if (twist !== 0 && part === 'thigh') {
    // Y-axis: internal/external hip rotation (Turn Out / Turn In)
    if (op.side === 'left') {
      multiplyBoneDelta(pose, bone, 0, -twist, 0)
    } else {
      multiplyBoneDelta(pose, bone, 0, twist, 0)
    }
  }
}

function applySetHand(pose: Pose, op: Extract<PoseOp, { type: 'setHand' }>) {
  const hand = op.side === 'left' ? 'Left' : 'Right'
  const gesturePose = handGesturePose(hand, op.gesture)

  for (const [bone, value] of Object.entries(gesturePose)) {
    pose[bone] = value
  }
}

export function applyOp(pose: Pose, op: PoseOp): Pose {
  switch (op.type) {
    case 'rotateBone':
      applyRotateBone(pose, op)
      break
    case 'nudgeArm':
      applyNudgeArm(pose, op)
      break
    case 'nudgeTorso':
      applyNudgeTorso(pose, op)
      break
    case 'nudgeStance':
      applyNudgeStance(pose, op)
      break
    case 'nudgeLeg':
      applyNudgeLeg(pose, op)
      break
    case 'setHand':
      applySetHand(pose, op)
      break
  }
  return pose
}

export function composePose(base: Pose, ops: PoseOp[]): Pose {
  const pose: Pose = { ...base }
  for (const op of ops) {
    applyOp(pose, op)
  }
  return pose
}

function opKey(op: PoseOp): string {
  switch (op.type) {
    case 'rotateBone':
      return `rotate:${op.bone}:${op.axis}`
    case 'nudgeArm':
      return `arm:${op.side}`
    case 'nudgeTorso':
      return 'torso'
    case 'nudgeStance':
      return 'stance'
    case 'nudgeLeg':
      return `leg:${op.side}:${op.part ?? 'thigh'}`
    case 'setHand':
      return `hand:${op.side}`
  }
}

function mergeSameOp(existing: PoseOp, incoming: PoseOp): PoseOp {
  if (existing.type !== incoming.type) return incoming

  switch (existing.type) {
    case 'rotateBone':
      return {
        ...existing,
        degrees: existing.degrees + (incoming as typeof existing).degrees,
      }
    case 'nudgeArm': {
      const next = incoming as typeof existing
      return {
        type: 'nudgeArm',
        side: existing.side,
        raise: (existing.raise ?? 0) + (next.raise ?? 0),
        out: (existing.out ?? 0) + (next.out ?? 0),
        twist: (existing.twist ?? 0) + (next.twist ?? 0),
        foreArm: (existing.foreArm ?? 0) + (next.foreArm ?? 0),
        foreArmFlex: (existing.foreArmFlex ?? 0) + (next.foreArmFlex ?? 0),
      }
    }
    case 'nudgeTorso': {
      const next = incoming as typeof existing
      return {
        type: 'nudgeTorso',
        pitch: (existing.pitch ?? 0) + (next.pitch ?? 0),
        yaw: (existing.yaw ?? 0) + (next.yaw ?? 0),
        roll: (existing.roll ?? 0) + (next.roll ?? 0),
      }
    }
    case 'nudgeStance':
      return {
        type: 'nudgeStance',
        width: (existing.width ?? 0) + (incoming as typeof existing).width!,
      }
    case 'nudgeLeg': {
      const next = incoming as typeof existing
      return {
        type: 'nudgeLeg',
        side: existing.side,
        part: existing.part ?? 'thigh',
        forward: (existing.forward ?? 0) + (next.forward ?? 0),
        out: (existing.out ?? 0) + (next.out ?? 0),
        twist: (existing.twist ?? 0) + (next.twist ?? 0),
      }
    }
    case 'setHand':
      return incoming
  }
}

/** Append an adjustment, merging with prior nudges on the same target when possible. */
export function appendPoseOp(ops: PoseOp[], incoming: PoseOp): PoseOp[] {
  const key = opKey(incoming)
  const index = ops.findIndex((op) => opKey(op) === key)
  if (index === -1) return [...ops, incoming]
  const next = [...ops]
  next[index] = mergeSameOp(next[index], incoming)
  return next
}

export function resolveBasePose(
  basePoseId: string,
  presets: Record<string, Pose>
): Pose | undefined {
  return presets[basePoseId]
}

export type PoseAdjustmentSummary = {
  head: { pitch: number; yaw: number; roll: number }
  torso: { pitch: number; yaw: number; roll: number }
  leftArm: { raise: number; out: number; twist: number; foreArm: number }
  rightArm: { raise: number; out: number; twist: number; foreArm: number }
  leftForeArm: number
  rightForeArm: number
  leftHand: string | null
  rightHand: string | null
  leftHandRot: { pitch: number; yaw: number }
  rightHandRot: { pitch: number; yaw: number }
  leftLeg: { forward: number; out: number; twist: number }
  rightLeg: { forward: number; out: number; twist: number }
  leftLowerLeg: { forward: number; out: number }
  rightLowerLeg: { forward: number; out: number }
  leftFoot: { forward: number; out: number }
  rightFoot: { forward: number; out: number }
  stance: { width: number }
  whole: { pitch: number; yaw: number; roll: number }
}

export function summarizePoseOps(ops: PoseOp[]): PoseAdjustmentSummary {
  const summary: PoseAdjustmentSummary = {
    head: { pitch: 0, yaw: 0, roll: 0 },
    torso: { pitch: 0, yaw: 0, roll: 0 },
    leftArm: { raise: 0, out: 0, twist: 0, foreArm: 0 },
    rightArm: { raise: 0, out: 0, twist: 0, foreArm: 0 },
    leftForeArm: 0,
    rightForeArm: 0,
    leftHand: null,
    rightHand: null,
    leftHandRot: { pitch: 0, yaw: 0 },
    rightHandRot: { pitch: 0, yaw: 0 },
    leftLeg: { forward: 0, out: 0, twist: 0 },
    rightLeg: { forward: 0, out: 0, twist: 0 },
    leftLowerLeg: { forward: 0, out: 0 },
    rightLowerLeg: { forward: 0, out: 0 },
    leftFoot: { forward: 0, out: 0 },
    rightFoot: { forward: 0, out: 0 },
    stance: { width: 0 },
    whole: { pitch: 0, yaw: 0, roll: 0 },
  }

  for (const op of ops) {
    switch (op.type) {
      case 'rotateBone':
        if (op.bone === 'Head') {
          if (op.axis === 'x') summary.head.pitch += op.degrees
          if (op.axis === 'y') summary.head.yaw += op.degrees
          if (op.axis === 'z') summary.head.roll += op.degrees
        }
        if (op.bone === 'Hips') {
          if (op.axis === 'x') summary.whole.pitch += op.degrees
          if (op.axis === 'y') summary.whole.yaw += op.degrees
          if (op.axis === 'z') summary.whole.roll += op.degrees
        }
        if (op.bone === 'LeftHand') {
          if (op.axis === 'x') summary.leftHandRot.pitch += op.degrees
          if (op.axis === 'y') summary.leftHandRot.yaw += op.degrees
        }
        if (op.bone === 'RightHand') {
          if (op.axis === 'x') summary.rightHandRot.pitch += op.degrees
          if (op.axis === 'y') summary.rightHandRot.yaw += op.degrees
        }
        break
      case 'nudgeArm':
        if (op.side === 'left') {
          summary.leftArm.raise += op.raise ?? 0
          summary.leftArm.out += op.out ?? 0
          summary.leftArm.twist += op.twist ?? 0
          summary.leftArm.foreArm += op.foreArm ?? 0
          summary.leftForeArm += op.foreArm ?? 0
        } else {
          summary.rightArm.raise += op.raise ?? 0
          summary.rightArm.out += op.out ?? 0
          summary.rightArm.twist += op.twist ?? 0
          summary.rightArm.foreArm += op.foreArm ?? 0
          summary.rightForeArm += op.foreArm ?? 0
        }
        break
      case 'nudgeLeg': {
        const part = op.part ?? 'thigh'
        if (op.side === 'left') {
          const leg =
            part === 'thigh'
              ? summary.leftLeg
              : part === 'lower'
                ? summary.leftLowerLeg
                : summary.leftFoot
          leg.forward += op.forward ?? 0
          leg.out += op.out ?? 0
          if (part === 'thigh') (leg as typeof summary.leftLeg).twist += op.twist ?? 0
        } else {
          const leg =
            part === 'thigh'
              ? summary.rightLeg
              : part === 'lower'
                ? summary.rightLowerLeg
                : summary.rightFoot
          leg.forward += op.forward ?? 0
          leg.out += op.out ?? 0
          if (part === 'thigh') (leg as typeof summary.rightLeg).twist += op.twist ?? 0
        }
        break
      }
      case 'nudgeTorso':
        summary.torso.pitch += op.pitch ?? 0
        summary.torso.yaw += op.yaw ?? 0
        summary.torso.roll += op.roll ?? 0
        break
      case 'nudgeStance':
        summary.stance.width += op.width ?? 0
        break
      case 'setHand':
        if (op.side === 'left') summary.leftHand = op.gesture
        else summary.rightHand = op.gesture
        break
    }
  }

  return summary
}
