import { quatFromDegrees, type Pose } from '@/lib/poses'

export type HandGesture = 'open' | 'fist' | 'point' | 'relaxed'

export type ProceduralPoseParams = {
  leftArmRaise?: number
  rightArmRaise?: number
  leftArmOut?: number
  rightArmOut?: number
  leftForeArmBend?: number
  rightForeArmBend?: number
  torsoPitch?: number
  torsoYaw?: number
  stanceWidth?: number
  leftHand?: HandGesture
  rightHand?: HandGesture
}

export function handGesturePose(hand: 'Left' | 'Right', gesture: HandGesture): Pose {
  const gestures: Record<HandGesture, Pose> = {
    open: {
      [`${hand}HandThumb1`]: quatFromDegrees(0, 0, 0),
      [`${hand}HandIndex1`]: quatFromDegrees(0, 0, 0),
      [`${hand}HandMiddle1`]: quatFromDegrees(0, 0, 0),
      [`${hand}HandRing1`]: quatFromDegrees(0, 0, 0),
      [`${hand}HandPinky1`]: quatFromDegrees(0, 0, 0),
    },
    fist: {
      [`${hand}HandThumb1`]: quatFromDegrees(18, 12, 0),
      [`${hand}HandIndex1`]: quatFromDegrees(35, 0, 0),
      [`${hand}HandMiddle1`]: quatFromDegrees(35, 0, 0),
      [`${hand}HandRing1`]: quatFromDegrees(35, 0, 0),
      [`${hand}HandPinky1`]: quatFromDegrees(35, 0, 0),
    },
    point: {
      [`${hand}HandThumb1`]: quatFromDegrees(12, 6, 0),
      [`${hand}HandIndex1`]: quatFromDegrees(0, 0, 0),
      [`${hand}HandMiddle1`]: quatFromDegrees(28, 0, 0),
      [`${hand}HandRing1`]: quatFromDegrees(28, 0, 0),
      [`${hand}HandPinky1`]: quatFromDegrees(28, 0, 0),
    },
    relaxed: {
      [`${hand}HandIndex1`]: quatFromDegrees(18, 0, 0),
      [`${hand}HandMiddle1`]: quatFromDegrees(18, 0, 0),
      [`${hand}HandRing1`]: quatFromDegrees(18, 0, 0),
      [`${hand}HandPinky1`]: quatFromDegrees(18, 0, 0),
    },
  }

  return gestures[gesture]
}

/** Build a bind-relative Mixamo pose from simple blocking parameters (degrees). */
export function buildProceduralPose(params: ProceduralPoseParams): Pose {
  const pose: Pose = {}

  const {
    leftArmRaise = 0,
    rightArmRaise = 0,
    leftArmOut = 0,
    rightArmOut = 0,
    leftForeArmBend = 0,
    rightForeArmBend = 0,
    torsoPitch = 0,
    torsoYaw = 0,
    stanceWidth = 0,
    leftHand = 'open',
    rightHand = 'open',
  } = params

  if (torsoPitch !== 0 || torsoYaw !== 0) {
    pose.Spine = quatFromDegrees(torsoPitch * 0.45, torsoYaw * 0.45, 0)
    pose.Spine1 = quatFromDegrees(torsoPitch * 0.35, torsoYaw * 0.35, 0)
    pose.Spine2 = quatFromDegrees(torsoPitch * 0.2, torsoYaw * 0.2, 0)
  }

  if (leftArmRaise !== 0 || leftArmOut !== 0) {
    pose.LeftArm = quatFromDegrees(-leftArmRaise, 0, -leftArmOut)
  }
  if (rightArmRaise !== 0 || rightArmOut !== 0) {
    pose.RightArm = quatFromDegrees(-rightArmRaise, 0, rightArmOut)
  }
  if (leftForeArmBend !== 0) {
    pose.LeftForeArm = quatFromDegrees(0, leftForeArmBend, 0)
  }
  if (rightForeArmBend !== 0) {
    pose.RightForeArm = quatFromDegrees(0, -rightForeArmBend, 0)
  }

  if (stanceWidth !== 0) {
    pose.LeftUpLeg = quatFromDegrees(0, -stanceWidth, 0)
    pose.RightUpLeg = quatFromDegrees(0, stanceWidth, 0)
  }

  Object.assign(pose, handGesturePose('Left', leftHand))
  Object.assign(pose, handGesturePose('Right', rightHand))

  return pose
}

type PresetRule = {
  name: string
  params: ProceduralPoseParams
}

const PRESET_RULES: PresetRule[] = [
  { name: 'proc_a_pose', params: { leftArmOut: 20, rightArmOut: 20 } },
  { name: 'proc_arms_forward_30', params: { leftArmRaise: 30, rightArmRaise: 30 } },
  { name: 'proc_arms_forward_60', params: { leftArmRaise: 60, rightArmRaise: 60 } },
  { name: 'proc_arms_forward_90', params: { leftArmRaise: 90, rightArmRaise: 90 } },
  { name: 'proc_arm_up_left', params: { leftArmRaise: 90, leftArmOut: 75 } },
  { name: 'proc_arm_up_right', params: { rightArmRaise: 90, rightArmOut: 75 } },
  { name: 'proc_point_right', params: { rightArmRaise: 70, rightForeArmBend: 10, rightHand: 'point' } },
  { name: 'proc_point_left', params: { leftArmRaise: 70, leftForeArmBend: 10, leftHand: 'point' } },
  { name: 'proc_fists', params: { leftHand: 'fist', rightHand: 'fist' } },
  { name: 'proc_torso_lean_fwd', params: { torsoPitch: 12 } },
  { name: 'proc_torso_lean_back', params: { torsoPitch: -10 } },
  { name: 'proc_torso_turn_left', params: { torsoYaw: 18 } },
  { name: 'proc_torso_turn_right', params: { torsoYaw: -18 } },
  { name: 'proc_stance_narrow', params: { stanceWidth: 6 } },
  { name: 'proc_stance_wide', params: { stanceWidth: 18 } },
  {
    name: 'proc_wide_point_right',
    params: {
      stanceWidth: 16,
      rightArmRaise: 75,
      rightForeArmBend: 12,
      rightHand: 'point',
      torsoYaw: -8,
    },
  },
  {
    name: 'proc_lean_fwd_point_right',
    params: {
      torsoPitch: 14,
      rightArmRaise: 68,
      rightForeArmBend: 14,
      rightHand: 'point',
    },
  },
  {
    name: 'proc_thinking',
    params: {
      rightArmRaise: 78,
      rightForeArmBend: 95,
      rightHand: 'point',
      leftArmOut: 12,
      torsoPitch: 8,
    },
  },
  {
    name: 'proc_hands_on_hips',
    params: {
      leftArmOut: 42,
      rightArmOut: 42,
      leftForeArmBend: 82,
      rightForeArmBend: 82,
      leftHand: 'fist',
      rightHand: 'fist',
      torsoPitch: 5,
    },
  },
]

export function getProceduralPoses(): Record<string, Pose> {
  const presets: Record<string, Pose> = {}
  for (const rule of PRESET_RULES) {
    presets[rule.name] = buildProceduralPose(rule.params)
  }
  return presets
}
