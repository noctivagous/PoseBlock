import type { ReactNode } from 'react'

/** Single mannequin instance — Phase 2 adds multi-instance; shape defined for VideoGen adapter. */
export type PoseBlockInstance = {
  id: string
  modelUrl: string
  basePoseId: string
  characterX: number
  characterY: number
  characterZ: number
  characterRotationX: number
  characterRotationY: number
  characterScale: number
}

export type PoseBlockCompositorProps = {
  className?: string
  /** Backdrop image URL. When omitted, internal store default is used (standalone). */
  backdropUrl?: string
  /** Native frame dimensions when backdrop is not loaded via img onLoad. */
  frameWidth?: number
  frameHeight?: number
  /**
   * Controlled instances (VideoGen embed). When omitted, internal Zustand store
   * drives a single character (standalone dev).
   */
  instances?: PoseBlockInstance[]
  selectedIds?: string[]
  onSelect?: (ids: string[]) => void
  onInstanceChange?: (id: string, patch: Partial<PoseBlockInstance>) => void
  /** Register full-res composite export handler (default true). */
  enableExport?: boolean
  /** Overlay slots — error banners, assignment anchors, etc. */
  children?: ReactNode
}
