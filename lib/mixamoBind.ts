import * as THREE from 'three'
import referenceBindData from '@/poses/mixamo-reference-bind.json'
import {
  canonicalBoneName,
  clearBindPoseCache,
  findSkeletonBone,
  updateSkeleton,
} from '@/lib/poses'

type BindQuat = [number, number, number, number]

const REFERENCE_BIND = referenceBindData.bind as Record<string, BindQuat>

/**
 * Mixamo FBX loads with identity local bone rotations (T-pose bind), while GLB
 * encodes Mixamo's rest pose in each bone's local quaternion. Pose presets store
 * deltas from the GLB bind, so align imported skeletons before applying poses.
 */
export function alignSkeletonToMixamoBind(skeleton: THREE.Skeleton): number {
  let aligned = 0

  for (const [boneName, bindQuat] of Object.entries(REFERENCE_BIND)) {
    const bone = findSkeletonBone(skeleton, boneName)
    if (!bone) continue
    bone.quaternion.fromArray(bindQuat).normalize()
    aligned += 1
  }

  if (aligned > 0) {
    updateSkeleton(skeleton)
    clearBindPoseCache(skeleton)
  }

  return aligned
}

export function getReferenceBindBoneNames(): string[] {
  return Object.keys(REFERENCE_BIND)
}

export function getReferenceBindQuaternion(boneName: string): THREE.Quaternion | null {
  const bindQuat = REFERENCE_BIND[canonicalBoneName(boneName)]
  if (!bindQuat) return null
  return new THREE.Quaternion().fromArray(bindQuat).normalize()
}
