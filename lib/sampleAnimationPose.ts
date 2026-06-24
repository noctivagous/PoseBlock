import * as THREE from 'three'
import type { AnimationClip } from 'three'
import { canonicalBoneName } from './poses'
import type { Pose } from './poses'

export const DEFAULT_SAMPLE_EPSILON_DEG = 0.5
export const DEFAULT_ANIMATION_FPS = 30

export type SampleAnimationPoseOptions = {
  clip?: string | null
  frame?: number
  fps?: number
  epsilon?: number
  all?: boolean
}

function roundQuat(q: THREE.Quaternion): [number, number, number, number] {
  return [
    Number(q.x.toFixed(7)),
    Number(q.y.toFixed(7)),
    Number(q.z.toFixed(7)),
    Number(q.w.toFixed(7)),
  ]
}

function angleDegFromIdentity(q: THREE.Quaternion): number {
  const w = Math.min(1, Math.max(-1, Math.abs(q.w)))
  return (2 * Math.acos(w) * 180) / Math.PI
}

function getSkeleton(scene: THREE.Object3D): THREE.Skeleton | null {
  let skeleton: THREE.Skeleton | null = null
  scene.traverse((obj) => {
    if (!skeleton && (obj as THREE.SkinnedMesh).isSkinnedMesh) {
      skeleton = (obj as THREE.SkinnedMesh).skeleton
    }
  })
  return skeleton
}

function resolveClip(
  animations: AnimationClip[],
  clipName?: string | null,
): AnimationClip | null {
  if (animations.length === 0) return null
  if (clipName) {
    return animations.find((clip) => clip.name === clipName) ?? null
  }
  return animations[0] ?? null
}

/**
 * Sample bind-relative bone deltas from an animated scene at a frame index.
 * Caller should pass a cloned scene so the cached GLTF is not mutated.
 */
export function samplePoseFromScene(
  scene: THREE.Object3D,
  animations: AnimationClip[],
  options: SampleAnimationPoseOptions = {},
): Pose {
  const fps = options.fps ?? DEFAULT_ANIMATION_FPS
  const epsilon = options.epsilon ?? DEFAULT_SAMPLE_EPSILON_DEG
  const frame = Number.isFinite(options.frame) ? Math.max(0, Math.floor(options.frame as number)) : 0

  scene.updateMatrixWorld(true)

  const skeleton = getSkeleton(scene)
  if (!skeleton) {
    throw new Error('No skeleton found in pose model.')
  }

  const bindByCanonical = new Map<string, THREE.Quaternion>()
  for (const bone of skeleton.bones) {
    const key = canonicalBoneName(bone.name)
    if (!bindByCanonical.has(key)) {
      bindByCanonical.set(key, bone.quaternion.clone())
    }
  }

  const sampledClip = resolveClip(animations, options.clip)
  if (sampledClip) {
    let sampleTime = frame / fps
    sampleTime = Math.max(0, Math.min(sampleTime, sampledClip.duration))
    const mixer = new THREE.AnimationMixer(scene)
    const action = mixer.clipAction(sampledClip)
    action.play()
    mixer.setTime(sampleTime)
    mixer.update(0)
    scene.updateMatrixWorld(true)
  }

  skeleton.update()

  const pose: Pose = {}
  for (const bone of skeleton.bones) {
    const key = canonicalBoneName(bone.name)
    const bindQ = bindByCanonical.get(key)
    if (!bindQ) continue

    const delta = bindQ.clone().invert().multiply(bone.quaternion).normalize()
    const changed = angleDegFromIdentity(delta) > epsilon
    if (options.all || changed) pose[key] = roundQuat(delta)
  }

  return pose
}
