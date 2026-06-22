'use client'

import type { BodyPartId } from '@/lib/bodyParts'
import type { HandGesture } from '@/lib/proceduralPoses'
import type { BoneAxis, PoseOp } from '@/lib/poseCompose'
import { useStore } from '@/lib/store'

export const NUDGE = {
  head: 5,
  armRaise: 10,
  armOut: 8,
  foreArm: 10,
  torso: 6,
  stance: 4,
  whole: 6,
} as const

export function usePoseAdjustmentActions() {
  const pushPoseOp = useStore((s) => s.pushPoseOp)
  return { pushPoseOp }
}

export function headRotate(axis: BoneAxis, degrees: number): PoseOp {
  return { type: 'rotateBone', bone: 'Head', axis, degrees }
}

export function wholeRotate(axis: BoneAxis, degrees: number): PoseOp {
  return { type: 'rotateBone', bone: 'Hips', axis, degrees }
}

export function armNudge(
  side: 'left' | 'right',
  fields: { raise?: number; out?: number; foreArm?: number }
): PoseOp {
  return { type: 'nudgeArm', side, ...fields }
}

export function handGesture(side: 'left' | 'right', gesture: HandGesture): PoseOp {
  return { type: 'setHand', side, gesture }
}

export function torsoNudge(pitch?: number, yaw?: number): PoseOp {
  return { type: 'nudgeTorso', pitch, yaw }
}

export function stanceNudge(width: number): PoseOp {
  return { type: 'nudgeStance', width }
}

export function opsForBodyPart(
  partId: BodyPartId,
  action: string
): PoseOp | null {
  switch (partId) {
    case 'head':
      if (action === 'pitch+') return headRotate('x', -NUDGE.head)
      if (action === 'pitch-') return headRotate('x', NUDGE.head)
      if (action === 'yaw+') return headRotate('y', NUDGE.head)
      if (action === 'yaw-') return headRotate('y', -NUDGE.head)
      if (action === 'roll+') return headRotate('z', NUDGE.head)
      if (action === 'roll-') return headRotate('z', -NUDGE.head)
      break
    case 'torso':
      if (action === 'pitch+') return torsoNudge(NUDGE.torso, 0)
      if (action === 'pitch-') return torsoNudge(-NUDGE.torso, 0)
      if (action === 'yaw+') return torsoNudge(0, NUDGE.torso)
      if (action === 'yaw-') return torsoNudge(0, -NUDGE.torso)
      break
    case 'leftArm':
      if (action === 'raise+') return armNudge('left', { raise: NUDGE.armRaise })
      if (action === 'raise-') return armNudge('left', { raise: -NUDGE.armRaise })
      if (action === 'out+') return armNudge('left', { out: NUDGE.armOut })
      if (action === 'out-') return armNudge('left', { out: -NUDGE.armOut })
      if (action === 'fore+') return armNudge('left', { foreArm: NUDGE.foreArm })
      if (action === 'fore-') return armNudge('left', { foreArm: -NUDGE.foreArm })
      break
    case 'rightArm':
      if (action === 'raise+') return armNudge('right', { raise: NUDGE.armRaise })
      if (action === 'raise-') return armNudge('right', { raise: -NUDGE.armRaise })
      if (action === 'out+') return armNudge('right', { out: NUDGE.armOut })
      if (action === 'out-') return armNudge('right', { out: -NUDGE.armOut })
      if (action === 'fore+') return armNudge('right', { foreArm: NUDGE.foreArm })
      if (action === 'fore-') return armNudge('right', { foreArm: -NUDGE.foreArm })
      break
    case 'leftHand':
      if (action === 'point') return handGesture('left', 'point')
      if (action === 'fist') return handGesture('left', 'fist')
      if (action === 'open') return handGesture('left', 'open')
      break
    case 'rightHand':
      if (action === 'point') return handGesture('right', 'point')
      if (action === 'fist') return handGesture('right', 'fist')
      if (action === 'open') return handGesture('right', 'open')
      break
    case 'stance':
      if (action === 'wide+') return stanceNudge(NUDGE.stance)
      if (action === 'wide-') return stanceNudge(-NUDGE.stance)
      break
    case 'whole':
      if (action === 'pitch+') return wholeRotate('x', NUDGE.whole)
      if (action === 'pitch-') return wholeRotate('x', -NUDGE.whole)
      if (action === 'yaw+') return wholeRotate('y', NUDGE.whole)
      if (action === 'yaw-') return wholeRotate('y', -NUDGE.whole)
      if (action === 'roll+') return wholeRotate('z', NUDGE.whole)
      if (action === 'roll-') return wholeRotate('z', -NUDGE.whole)
      break
  }
  return null
}
