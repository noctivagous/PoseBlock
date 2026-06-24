import type { ReactNode } from 'react'
import type { PoseOp } from './lib/poseCompose'

/** Single mannequin instance — VideoGen adapter uses feet-anchor x/y/scale. */
export type PoseBlockInstance = {
  id: string
  modelUrl: string
  basePoseId: string
  poseAdjustments?: PoseOp[]
  /** Normalized feet-anchor X (0 = left, 1 = right). */
  x: number
  /** Normalized feet-anchor Y (0 = top, 1 = frame bottom, >1 below frame). */
  y: number
  /** Visual height multiplier at MANNEQUIN_BASE_HEIGHT_RATIO. */
  scale: number
  rotation: number
  characterZ?: number
  characterRotationX?: number
  characterRotationY?: number
  controlRig?: {
    initialized: boolean
    head: [number, number, number]
    chest: [number, number, number]
    hips: [number, number, number]
    leftHand: [number, number, number]
    rightHand: [number, number, number]
    leftFoot: [number, number, number]
    rightFoot: [number, number, number]
  }
  pins?: {
    leftHand: boolean
    rightHand: boolean
    leftFoot: boolean
    rightFoot: boolean
  }
  pinnedWorldPos?: {
    leftHand: [number, number, number]
    rightHand: [number, number, number]
    leftFoot: [number, number, number]
    rightFoot: [number, number, number]
  }
  ikBlend?: {
    leftArm: number
    rightArm: number
    leftLeg: number
    rightLeg: number
  }
}

export type PoseBlockCompositorProps = {
  className?: string
  backdropUrl?: string
  frameWidth?: number
  frameHeight?: number
  instances?: PoseBlockInstance[]
  selectedIds?: string[]
  onSelect?: (ids: string[]) => void
  onInstanceChange?: (id: string, patch: Partial<PoseBlockInstance>) => void
  enableExport?: boolean
  /** When true, canvas fills the parent and backdrop/dimension handling is left to the host app. */
  embedMode?: boolean
  children?: ReactNode
}
