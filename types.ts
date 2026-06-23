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
  children?: ReactNode
}
