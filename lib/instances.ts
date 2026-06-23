import type { PoseOp } from '../lib/poseCompose'
import type { PoseBlockInstance } from '../types'

/** Max mannequins — matches VideoGen crowd limit. */
export const MAX_INSTANCES = 10

export type CharacterInstance = {
  id: string
  modelUrl: string
  basePoseId: string
  poseAdjustments: PoseOp[]
  poseAdjustmentPast: PoseOp[][]
  poseAdjustmentFuture: PoseOp[][]
  /** Normalized feet-anchor X (0 = left, 1 = right). */
  x: number
  /** Normalized feet-anchor Y (0 = top, 1 = frame bottom, >1 below frame). */
  y: number
  /** Visual height multiplier at MANNEQUIN_BASE_HEIGHT_RATIO. */
  scale: number
  /** In-plane tilt (degrees) — pivots at feet. */
  rotation: number
  characterZ: number
  characterRotationX: number
  characterRotationY: number
}

export function createInstanceId(): string {
  return `inst_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`
}

export function createInstance(
  modelUrl: string,
  partial?: Partial<Pick<CharacterInstance, 'x' | 'y' | 'scale' | 'basePoseId'>>,
): CharacterInstance {
  return {
    id: createInstanceId(),
    modelUrl,
    basePoseId: partial?.basePoseId ?? 't_pose',
    poseAdjustments: [],
    poseAdjustmentPast: [],
    poseAdjustmentFuture: [],
    x: partial?.x ?? 0.5,
    y: partial?.y ?? 1,
    scale: partial?.scale ?? 1,
    rotation: 0,
    characterZ: 0,
    characterRotationX: 0,
    characterRotationY: 0,
  }
}

export function instanceToPoseBlockExport(instance: CharacterInstance): PoseBlockInstance {
  return {
    id: instance.id,
    modelUrl: instance.modelUrl,
    basePoseId: instance.basePoseId,
    poseAdjustments: instance.poseAdjustments,
    x: instance.x,
    y: instance.y,
    scale: instance.scale,
    rotation: instance.rotation,
    characterZ: instance.characterZ,
    characterRotationX: instance.characterRotationX,
    characterRotationY: instance.characterRotationY,
  }
}
