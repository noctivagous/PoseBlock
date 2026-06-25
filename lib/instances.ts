import type { PoseOp } from '../lib/poseCompose'
import type { PoseBlockInstance } from '../types'

/** Max mannequins — matches VideoGen crowd limit. */
export const MAX_INSTANCES = 10

export type PinKey = 'leftHand' | 'rightHand' | 'leftFoot' | 'rightFoot'

export type ControlRig = {
  initialized: boolean
  head: [number, number, number]
  chest: [number, number, number]
  hips: [number, number, number]
  leftHand: [number, number, number]
  rightHand: [number, number, number]
  leftFoot: [number, number, number]
  rightFoot: [number, number, number]
}

export type Pins = Record<PinKey, boolean>
export type PinnedWorldPos = Record<PinKey, [number, number, number]>
export type IkBlend = {
  leftArm: number
  rightArm: number
  leftLeg: number
  rightLeg: number
}

export type PoseSourceMode = 'preset' | 'animation'

export function createDefaultControlRig(): ControlRig {
  return {
    initialized: false,
    head: [0, 1.65, 0],
    chest: [0, 1.3, 0],
    hips: [0, 0.9, 0],
    leftHand: [0.4, 1.2, 0.1],
    rightHand: [-0.4, 1.2, 0.1],
    leftFoot: [0.1, 0.05, 0],
    rightFoot: [-0.1, 0.05, 0],
  }
}

export function createDefaultPins(): Pins {
  return {
    leftHand: false,
    rightHand: false,
    leftFoot: false,
    rightFoot: false,
  }
}

export function createDefaultPinnedWorldPos(): PinnedWorldPos {
  return {
    leftHand: [0, 0, 0],
    rightHand: [0, 0, 0],
    leftFoot: [0, 0, 0],
    rightFoot: [0, 0, 0],
  }
}

export function createDefaultIkBlend(): IkBlend {
  return {
    leftArm: 1,
    rightArm: 1,
    leftLeg: 1,
    rightLeg: 1,
  }
}

export type CharacterInstance = {
  id: string
  modelUrl: string
  basePoseId: string
  poseSourceMode: PoseSourceMode
  animationPoseModelId: string
  animationClip: string | null
  animationFrame: number
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
  /** Roll in the view plane (degrees) — pivots at bbox bottom center. */
  characterRotationZ: number
  controlRig: ControlRig
  pins: Pins
  pinnedWorldPos: PinnedWorldPos
  ikBlend: IkBlend
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
    poseSourceMode: 'preset',
    animationPoseModelId: '',
    animationClip: null,
    animationFrame: 0,
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
    characterRotationZ: 0,
    controlRig: createDefaultControlRig(),
    pins: createDefaultPins(),
    pinnedWorldPos: createDefaultPinnedWorldPos(),
    ikBlend: createDefaultIkBlend(),
  }
}

export function cloneInstance(
  source: CharacterInstance,
  overrides?: Partial<CharacterInstance>,
): CharacterInstance {
  return {
    ...source,
    id: createInstanceId(),
    poseAdjustments: [...source.poseAdjustments],
    poseAdjustmentPast: source.poseAdjustmentPast.map((stack) => [...stack]),
    poseAdjustmentFuture: source.poseAdjustmentFuture.map((stack) => [...stack]),
    controlRig: { ...source.controlRig },
    pins: { ...source.pins },
    pinnedWorldPos: { ...source.pinnedWorldPos },
    ikBlend: { ...source.ikBlend },
    ...overrides,
  }
}

export function instanceToPoseBlockExport(instance: CharacterInstance): PoseBlockInstance {
  return {
    id: instance.id,
    modelUrl: instance.modelUrl,
    basePoseId: instance.basePoseId,
    poseSourceMode: instance.poseSourceMode,
    animationPoseModelId: instance.animationPoseModelId,
    animationClip: instance.animationClip,
    animationFrame: instance.animationFrame,
    poseAdjustments: instance.poseAdjustments,
    x: instance.x,
    y: instance.y,
    scale: instance.scale,
    rotation: instance.rotation,
    characterZ: instance.characterZ,
    characterRotationX: instance.characterRotationX,
    characterRotationY: instance.characterRotationY,
    characterRotationZ: instance.characterRotationZ,
    controlRig: instance.controlRig,
    pins: instance.pins,
    pinnedWorldPos: instance.pinnedWorldPos,
    ikBlend: instance.ikBlend,
  }
}
