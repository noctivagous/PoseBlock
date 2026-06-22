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
      foreArm?: number
    }
  | { type: 'nudgeTorso'; pitch?: number; yaw?: number }
  | { type: 'nudgeStance'; width?: number }
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
  const foreArm = op.foreArm ?? 0

  if (raise !== 0 || out !== 0) {
    if (op.side === 'left') {
      multiplyBoneDelta(pose, `${prefix}Arm`, -raise, 0, -out)
    } else {
      multiplyBoneDelta(pose, `${prefix}Arm`, -raise, 0, out)
    }
  }

  if (foreArm !== 0) {
    if (op.side === 'left') {
      multiplyBoneDelta(pose, `${prefix}ForeArm`, 0, foreArm, 0)
    } else {
      multiplyBoneDelta(pose, `${prefix}ForeArm`, 0, -foreArm, 0)
    }
  }
}

function applyNudgeTorso(pose: Pose, op: Extract<PoseOp, { type: 'nudgeTorso' }>) {
  const pitch = op.pitch ?? 0
  const yaw = op.yaw ?? 0
  if (pitch === 0 && yaw === 0) return

  multiplyBoneDelta(pose, 'Spine', pitch * 0.45, yaw * 0.45, 0)
  multiplyBoneDelta(pose, 'Spine1', pitch * 0.35, yaw * 0.35, 0)
  multiplyBoneDelta(pose, 'Spine2', pitch * 0.2, yaw * 0.2, 0)
}

function applyNudgeStance(pose: Pose, op: Extract<PoseOp, { type: 'nudgeStance' }>) {
  const width = op.width ?? 0
  if (width === 0) return
  multiplyBoneDelta(pose, 'LeftUpLeg', 0, -width, 0)
  multiplyBoneDelta(pose, 'RightUpLeg', 0, width, 0)
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
        foreArm: (existing.foreArm ?? 0) + (next.foreArm ?? 0),
      }
    }
    case 'nudgeTorso': {
      const next = incoming as typeof existing
      return {
        type: 'nudgeTorso',
        pitch: (existing.pitch ?? 0) + (next.pitch ?? 0),
        yaw: (existing.yaw ?? 0) + (next.yaw ?? 0),
      }
    }
    case 'nudgeStance':
      return {
        type: 'nudgeStance',
        width: (existing.width ?? 0) + (incoming as typeof existing).width!,
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
  torso: { pitch: number; yaw: number }
  leftArm: { raise: number; out: number; foreArm: number }
  rightArm: { raise: number; out: number; foreArm: number }
  leftHand: string | null
  rightHand: string | null
  stance: { width: number }
  whole: { pitch: number; yaw: number; roll: number }
}

export function summarizePoseOps(ops: PoseOp[]): PoseAdjustmentSummary {
  const summary: PoseAdjustmentSummary = {
    head: { pitch: 0, yaw: 0, roll: 0 },
    torso: { pitch: 0, yaw: 0 },
    leftArm: { raise: 0, out: 0, foreArm: 0 },
    rightArm: { raise: 0, out: 0, foreArm: 0 },
    leftHand: null,
    rightHand: null,
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
        break
      case 'nudgeArm':
        if (op.side === 'left') {
          summary.leftArm.raise += op.raise ?? 0
          summary.leftArm.out += op.out ?? 0
          summary.leftArm.foreArm += op.foreArm ?? 0
        } else {
          summary.rightArm.raise += op.raise ?? 0
          summary.rightArm.out += op.out ?? 0
          summary.rightArm.foreArm += op.foreArm ?? 0
        }
        break
      case 'nudgeTorso':
        summary.torso.pitch += op.pitch ?? 0
        summary.torso.yaw += op.yaw ?? 0
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
