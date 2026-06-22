import * as THREE from 'three'

/**
 * Pose library for Mixamo skeleton with finger rigs.
 * Each pose maps bone_name -> quaternion [x, y, z, w] in local bone space.
 */
export type Pose = Record<string, [number, number, number, number]>

function getBone(skeleton: THREE.Skeleton, boneName: string): THREE.Bone | undefined {
  // glTF stores "mixamorig:LeftArm"; GLTFLoader strips the colon → "mixamorigLeftArm"
  return (
    skeleton.getBoneByName(boneName) ??
    skeleton.getBoneByName(`mixamorig${boneName}`) ??
    skeleton.getBoneByName(`mixamorig:${boneName}`) ??
    skeleton.getBoneByName(`mixamorig_${boneName}`)
  )
}

export const POSES: Record<string, Pose> = {
  a_pose: {
    // Mixamo X-Bot bind is effectively T-pose at upper arms; A-pose is a slight downward cant.
    LeftArm: [0, 0, -0.1675421, 0.9858649],
    RightArm: [0, 0, 0.1675432, 0.9858647],
    LeftForeArm: [0, 0, 0, 1],
    RightForeArm: [0, 0, 0, 1],
    LeftHandThumb1: [0.1, 0, 0, 0.995],
    LeftHandIndex1: [0.3, 0, 0, 0.954],
    LeftHandMiddle1: [0.3, 0, 0, 0.954],
    LeftHandRing1: [0.3, 0, 0, 0.954],
    LeftHandPinky1: [0.3, 0, 0, 0.954],
    RightHandThumb1: [0.1, 0, 0, 0.995],
    RightHandIndex1: [0.3, 0, 0, 0.954],
    RightHandMiddle1: [0.3, 0, 0, 0.954],
    RightHandRing1: [0.3, 0, 0, 0.954],
    RightHandPinky1: [0.3, 0, 0, 0.954],
  },

  t_pose: {
    LeftArm: [0, 0, 0, 1],
    RightArm: [0, 0, 0, 1],
    LeftHandThumb1: [0, 0, 0, 1],
    LeftHandIndex1: [0, 0, 0, 1],
    LeftHandMiddle1: [0, 0, 0, 1],
    LeftHandRing1: [0, 0, 0, 1],
    LeftHandPinky1: [0, 0, 0, 1],
    RightHandThumb1: [0, 0, 0, 1],
    RightHandIndex1: [0, 0, 0, 1],
    RightHandMiddle1: [0, 0, 0, 1],
    RightHandRing1: [0, 0, 0, 1],
    RightHandPinky1: [0, 0, 0, 1],
  },

  pointing_right: {
    Spine: [0, 0.0871557, 0, 0.9961947],
    Spine1: [0, 0.0436194, 0, 0.9990482],
    RightArm: [0.1822355, 0.1276794, -0.6934419, 0.6830127],
    RightForeArm: [0, 0.258819, 0, 0.9659258],
    RightHand: [0, 0, 0, 1],
    RightHandThumb1: [0.2, 0.1, 0, 0.975],
    RightHandThumb2: [0.3, 0, 0, 0.954],
    RightHandThumb3: [0.3, 0, 0, 0.954],
    RightHandIndex1: [0, 0, 0, 1],
    RightHandIndex2: [0, 0, 0, 1],
    RightHandIndex3: [0, 0, 0, 1],
    RightHandMiddle1: [0.5, 0, 0, 0.866],
    RightHandMiddle2: [0.5, 0, 0, 0.866],
    RightHandMiddle3: [0.5, 0, 0, 0.866],
    RightHandRing1: [0.5, 0, 0, 0.866],
    RightHandRing2: [0.5, 0, 0, 0.866],
    RightHandRing3: [0.5, 0, 0, 0.866],
    RightHandPinky1: [0.5, 0, 0, 0.866],
    RightHandPinky2: [0.5, 0, 0, 0.866],
    RightHandPinky3: [0.5, 0, 0, 0.866],
    LeftArm: [0.1, 0, 0.3, 0.948],
    LeftForeArm: [0, 0.3, 0, 0.954],
    LeftHandIndex1: [0.3, 0, 0, 0.954],
    LeftHandMiddle1: [0.3, 0, 0, 0.954],
    Head: [0, -0.0871557, 0, 0.9961947],
  },

  pointing_left: {
    Spine: [0, -0.0871557, 0, 0.9961947],
    Spine1: [0, -0.0436194, 0, 0.9990482],
    LeftArm: [0.1822355, -0.1276794, 0.6934419, 0.6830127],
    LeftForeArm: [0, -0.258819, 0, 0.9659258],
    LeftHand: [0, 0, 0, 1],
    LeftHandThumb1: [0.2, -0.1, 0, 0.975],
    LeftHandThumb2: [0.3, 0, 0, 0.954],
    LeftHandThumb3: [0.3, 0, 0, 0.954],
    LeftHandIndex1: [0, 0, 0, 1],
    LeftHandIndex2: [0, 0, 0, 1],
    LeftHandIndex3: [0, 0, 0, 1],
    LeftHandMiddle1: [0.5, 0, 0, 0.866],
    LeftHandMiddle2: [0.5, 0, 0, 0.866],
    LeftHandMiddle3: [0.5, 0, 0, 0.866],
    LeftHandRing1: [0.5, 0, 0, 0.866],
    LeftHandRing2: [0.5, 0, 0, 0.866],
    LeftHandRing3: [0.5, 0, 0, 0.866],
    LeftHandPinky1: [0.5, 0, 0, 0.866],
    LeftHandPinky2: [0.5, 0, 0, 0.866],
    LeftHandPinky3: [0.5, 0, 0, 0.866],
    RightArm: [0.1, 0, -0.3, 0.948],
    RightForeArm: [0, -0.3, 0, 0.954],
    Head: [0, 0.0871557, 0, 0.9961947],
  },

  hands_on_hips: {
    LeftArm: [0.1913417, 0.1691444, 0.4617798, 0.8497776],
    LeftForeArm: [0, 1.0, 0, 0.1],
    RightArm: [0.1913417, -0.1691444, -0.4617798, 0.8497776],
    RightForeArm: [0, -1.0, 0, 0.1],
    LeftHandThumb1: [0.3, 0.2, 0, 0.932],
    LeftHandIndex1: [0.6, 0, 0, 0.8],
    LeftHandMiddle1: [0.6, 0, 0, 0.8],
    LeftHandRing1: [0.6, 0, 0, 0.8],
    LeftHandPinky1: [0.6, 0, 0, 0.8],
    RightHandThumb1: [0.3, -0.2, 0, 0.932],
    RightHandIndex1: [0.6, 0, 0, 0.8],
    RightHandMiddle1: [0.6, 0, 0, 0.8],
    RightHandRing1: [0.6, 0, 0, 0.8],
    RightHandPinky1: [0.6, 0, 0, 0.8],
    Spine1: [0.05, 0, 0, 0.998],
  },

  arms_crossed: {
    LeftArm: [0.3266407, 0.174011, 0.1840955, 0.9102957],
    LeftForeArm: [0.0416436, 0.6830127, 0.0416436, 0.7278399],
    RightArm: [0.3266407, -0.174011, -0.1840955, 0.9102957],
    RightForeArm: [0.0416436, -0.6830127, 0.0416436, 0.7278399],
    LeftHandIndex1: [0.2, 0, 0, 0.98],
    LeftHandMiddle1: [0.2, 0, 0, 0.98],
    RightHandIndex1: [0.2, 0, 0, 0.98],
    RightHandMiddle1: [0.2, 0, 0, 0.98],
    Spine1: [0.08, 0, 0, 0.997],
  },

  waving: {
    RightArm: [0.5, 0, -0.5, 0.707],
    RightForeArm: [0, 0, 0.258819, 0.9659258],
    RightHand: [0, 0, 0.1, 0.995],
    RightHandThumb1: [-0.1, 0.1, 0, 0.99],
    RightHandIndex1: [0, 0, -0.05, 0.999],
    RightHandMiddle1: [0, 0, 0, 1],
    RightHandRing1: [0, 0, 0.05, 0.999],
    RightHandPinky1: [0, 0, 0.1, 0.995],
    LeftArm: [0.1, 0, 0.2, 0.974],
    LeftForeArm: [0, 0.2, 0, 0.98],
    Spine: [0, -0.05, 0, 0.999],
  },

  thinking: {
    RightArm: [0.383, 0.321, -0.294, 0.812],
    RightForeArm: [0.259, 0.509, 0.259, 0.779],
    RightHand: [0.1, 0.1, 0.1, 0.985],
    RightHandIndex1: [0, 0, 0, 1],
    RightHandIndex2: [0, 0, 0, 1],
    RightHandMiddle1: [0.6, 0, 0, 0.8],
    RightHandRing1: [0.6, 0, 0, 0.8],
    RightHandPinky1: [0.6, 0, 0, 0.8],
    LeftArm: [0.15, 0, 0.25, 0.956],
    Head: [0.05, 0.08, 0, 0.996],
    Spine1: [0.06, 0, 0, 0.998],
  },

  walking: {
    LeftUpLeg: [0.383, 0, 0, 0.924],
    LeftLeg: [-0.259, 0, 0, 0.966],
    RightUpLeg: [-0.259, 0, 0, 0.966],
    RightLeg: [-0.1, 0, 0, 0.995],
    LeftArm: [-0.259, 0, 0, 0.966],
    RightArm: [0.383, 0, 0, 0.924],
    LeftHandIndex1: [0.15, 0, 0, 0.989],
    RightHandIndex1: [0.15, 0, 0, 0.989],
    Spine: [0.05, 0, 0, 0.999],
  },

  surprised: {
    LeftArm: [0.612, 0, 0.354, 0.707],
    RightArm: [0.612, 0, -0.354, 0.707],
    LeftForeArm: [0, 0.383, 0, 0.924],
    RightForeArm: [0, -0.383, 0, 0.924],
    LeftHandThumb1: [-0.2, 0.1, 0, 0.975],
    LeftHandIndex1: [0, 0, -0.1, 0.995],
    LeftHandMiddle1: [0, 0, 0, 1],
    LeftHandRing1: [0, 0, 0.1, 0.995],
    LeftHandPinky1: [0, 0, 0.2, 0.98],
    RightHandThumb1: [-0.2, -0.1, 0, 0.975],
    RightHandIndex1: [0, 0, 0.1, 0.995],
    RightHandMiddle1: [0, 0, 0, 1],
    RightHandRing1: [0, 0, -0.1, 0.995],
    RightHandPinky1: [0, 0, -0.2, 0.98],
    Spine1: [-0.1, 0, 0, 0.995],
    Head: [-0.05, 0, 0, 0.999],
  },
}

export function lerpPose(
  skeleton: THREE.Skeleton,
  targetPose: Pose,
  alpha: number = 1
) {
  const missing: string[] = []

  Object.entries(targetPose).forEach(([boneName, targetQuat]) => {
    const bone = getBone(skeleton, boneName)
    if (!bone) {
      missing.push(boneName)
      return
    }

    const q = new THREE.Quaternion().fromArray(targetQuat)
    if (alpha < 1) {
      bone.quaternion.slerp(q, alpha)
    } else {
      bone.quaternion.copy(q)
    }
  })

  if (missing.length > 0 && process.env.NODE_ENV === 'development') {
    console.warn('[poses] Missing bones:', missing)
  }

  updateSkeleton(skeleton)
}

/** Push bone quaternion changes to the GPU skinning matrices. */
export function updateSkeleton(skeleton: THREE.Skeleton) {
  const root = skeleton.bones[0]
  if (root) {
    root.updateMatrixWorld(true)
  }
  skeleton.update()
}

export function resetPose(skeleton: THREE.Skeleton) {
  lerpPose(skeleton, POSES.a_pose, 1)
}

type HandGesture = 'open' | 'fist' | 'point' | 'relaxed'

export function applyHandPose(
  skeleton: THREE.Skeleton,
  hand: 'Left' | 'Right',
  gesture: HandGesture
) {
  const gestures: Record<HandGesture, Pose> = {
    open: {
      [`${hand}HandThumb1`]: [0, 0, 0, 1],
      [`${hand}HandIndex1`]: [0, 0, 0, 1],
      [`${hand}HandMiddle1`]: [0, 0, 0, 1],
      [`${hand}HandRing1`]: [0, 0, 0, 1],
      [`${hand}HandPinky1`]: [0, 0, 0, 1],
    },
    fist: {
      [`${hand}HandThumb1`]: [0.3, 0.2, 0, 0.932],
      [`${hand}HandIndex1`]: [0.6, 0, 0, 0.8],
      [`${hand}HandMiddle1`]: [0.6, 0, 0, 0.8],
      [`${hand}HandRing1`]: [0.6, 0, 0, 0.8],
      [`${hand}HandPinky1`]: [0.6, 0, 0, 0.8],
    },
    point: {
      [`${hand}HandThumb1`]: [0.2, 0.1, 0, 0.975],
      [`${hand}HandIndex1`]: [0, 0, 0, 1],
      [`${hand}HandMiddle1`]: [0.5, 0, 0, 0.866],
      [`${hand}HandRing1`]: [0.5, 0, 0, 0.866],
      [`${hand}HandPinky1`]: [0.5, 0, 0, 0.866],
    },
    relaxed: {
      [`${hand}HandIndex1`]: [0.3, 0, 0, 0.954],
      [`${hand}HandMiddle1`]: [0.3, 0, 0, 0.954],
      [`${hand}HandRing1`]: [0.3, 0, 0, 0.954],
      [`${hand}HandPinky1`]: [0.3, 0, 0, 0.954],
    },
  }

  lerpPose(skeleton, gestures[gesture], 1)
}

export const MIXAMO_BONES = [
  'Hips',
  'Spine',
  'Spine1',
  'Spine2',
  'Neck',
  'Head',
  'HeadTop_End',
  'LeftShoulder',
  'LeftArm',
  'LeftForeArm',
  'LeftHand',
  'LeftHandThumb1',
  'LeftHandThumb2',
  'LeftHandThumb3',
  'LeftHandThumb4',
  'LeftHandIndex1',
  'LeftHandIndex2',
  'LeftHandIndex3',
  'LeftHandIndex4',
  'LeftHandMiddle1',
  'LeftHandMiddle2',
  'LeftHandMiddle3',
  'LeftHandMiddle4',
  'LeftHandRing1',
  'LeftHandRing2',
  'LeftHandRing3',
  'LeftHandRing4',
  'LeftHandPinky1',
  'LeftHandPinky2',
  'LeftHandPinky3',
  'LeftHandPinky4',
  'RightShoulder',
  'RightArm',
  'RightForeArm',
  'RightHand',
  'RightHandThumb1',
  'RightHandThumb2',
  'RightHandThumb3',
  'RightHandThumb4',
  'RightHandIndex1',
  'RightHandIndex2',
  'RightHandIndex3',
  'RightHandIndex4',
  'RightHandMiddle1',
  'RightHandMiddle2',
  'RightHandMiddle3',
  'RightHandMiddle4',
  'RightHandRing1',
  'RightHandRing2',
  'RightHandRing3',
  'RightHandRing4',
  'RightHandPinky1',
  'RightHandPinky2',
  'RightHandPinky3',
  'RightHandPinky4',
  'LeftUpLeg',
  'LeftLeg',
  'LeftFoot',
  'LeftToeBase',
  'LeftToe_End',
  'RightUpLeg',
  'RightLeg',
  'RightFoot',
  'RightToeBase',
  'RightToe_End',
] as const

export const CHARACTER_OPTIONS = [
  {
    id: 'xbot',
    label: 'X-Bot (chrome mannequin)',
    url: '/models/xbot_mixamo.glb',
  },
  {
    id: 'ybot',
    label: 'Y-Bot (placeholder — same mesh)',
    url: '/models/ybot_mixamo.glb',
  },
  {
    id: 'teen_f',
    label: 'teen_f (SAM placeholder)',
    url: '/models/teen_f_mixamo.glb',
  },
] as const
