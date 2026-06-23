import * as THREE from 'three'

/**
 * Pose library for Mixamo skeleton with finger rigs.
 * Each pose maps bone_name -> delta quaternion [x, y, z, w] from bind local pose.
 */
export type Pose = Record<string, [number, number, number, number]>

const DEG2RAD = Math.PI / 180

export function quatFromDegrees(
  xDeg = 0,
  yDeg = 0,
  zDeg = 0
): [number, number, number, number] {
  const quat = new THREE.Quaternion().setFromEuler(
    new THREE.Euler(xDeg * DEG2RAD, yDeg * DEG2RAD, zDeg * DEG2RAD, 'XYZ')
  )
  return [quat.x, quat.y, quat.z, quat.w]
}

const q = quatFromDegrees

const bindPoseBySkeleton = new WeakMap<THREE.Skeleton, Map<string, THREE.Quaternion>>()

export function canonicalBoneName(name: string): string {
  return name.replace(/^mixamorig[:_]?/i, '')
}

export function clearBindPoseCache(skeleton: THREE.Skeleton): void {
  bindPoseBySkeleton.delete(skeleton)
}

function getBindPose(skeleton: THREE.Skeleton): Map<string, THREE.Quaternion> {
  const cached = bindPoseBySkeleton.get(skeleton)
  if (cached) return cached

  const bind = new Map<string, THREE.Quaternion>()
  skeleton.bones.forEach((bone) => {
    bind.set(bone.name, bone.quaternion.clone())
    bind.set(canonicalBoneName(bone.name), bone.quaternion.clone())
  })
  bindPoseBySkeleton.set(skeleton, bind)
  return bind
}

export function findSkeletonBone(
  skeleton: THREE.Skeleton,
  boneName: string
): THREE.Bone | undefined {
  // glTF stores "mixamorig:LeftArm"; GLTFLoader strips the colon → "mixamorigLeftArm"
  return (
    skeleton.getBoneByName(boneName) ??
    skeleton.getBoneByName(`mixamorig${boneName}`) ??
    skeleton.getBoneByName(`mixamorig:${boneName}`) ??
    skeleton.getBoneByName(`mixamorig_${boneName}`)
  )
}

export const POSES: Record<string, Pose> = {
  t_pose: {
    LeftArm: q(0, 0, 0),
    RightArm: q(0, 0, 0),
    LeftForeArm: q(0, 0, 0),
    RightForeArm: q(0, 0, 0),
  },
}

export function lerpPose(
  skeleton: THREE.Skeleton,
  targetPose: Pose,
  alpha: number = 1
) {
  const missing: string[] = []
  const bindPose = getBindPose(skeleton)

  Object.entries(targetPose).forEach(([boneName, deltaQuat]) => {
    const bone = findSkeletonBone(skeleton, boneName)
    if (!bone) {
      missing.push(boneName)
      return
    }

    const bindQ = bindPose.get(bone.name) ?? bindPose.get(canonicalBoneName(bone.name))
    const deltaQ = new THREE.Quaternion().fromArray(deltaQuat).normalize()
    const targetLocal = bindQ ? bindQ.clone().multiply(deltaQ) : deltaQ

    if (alpha < 1) {
      bone.quaternion.slerp(targetLocal, alpha)
    } else {
      bone.quaternion.copy(targetLocal)
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
  const bindPose = getBindPose(skeleton)
  skeleton.bones.forEach((bone) => {
    const bindQ = bindPose.get(bone.name)
    if (bindQ) bone.quaternion.copy(bindQ)
  })
  updateSkeleton(skeleton)
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
