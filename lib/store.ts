import { create } from 'zustand'
import type { BodyPartId } from '@/lib/bodyParts'
import type { CharacterModel } from '@/lib/characterModels'
import { appendPoseOp, type PoseOp } from '@/lib/poseCompose'
import type { Pose } from '@/lib/poses'

export type InteractionMode = 'transform' | 'pose'

export type StoreState = {
  modelUrl: string
  characterModels: CharacterModel[]
  posePresets: Record<string, Pose>
  basePoseId: string
  poseAdjustments: PoseOp[]
  poseAdjustmentPast: PoseOp[][]
  poseAdjustmentFuture: PoseOp[][]
  interactionMode: InteractionMode
  selectedBodyPart: BodyPartId | null
  backdropUrl: string
  frameWidth: number
  frameHeight: number
  characterX: number
  characterY: number
  characterZ: number
  characterRotationX: number
  characterRotationY: number
  characterScale: number
  characterError: string | null
  set: (partial: Partial<StoreState>) => void
  pushPoseOp: (op: PoseOp) => void
  pushPoseOps: (ops: PoseOp[]) => void
  undoPoseAdjustment: () => void
  redoPoseAdjustment: () => void
  resetPoseAdjustments: () => void
  setBasePoseId: (id: string) => void
}

export const useStore = create<StoreState>((set, get) => ({
  modelUrl: '',
  characterModels: [],
  posePresets: {},
  basePoseId: 't_pose',
  poseAdjustments: [],
  poseAdjustmentPast: [],
  poseAdjustmentFuture: [],
  interactionMode: 'transform',
  selectedBodyPart: null,
  backdropUrl: '/default_backdrop.jpg',
  frameWidth: 16,
  frameHeight: 9,
  characterX: 0,
  characterY: 0,
  characterZ: 0,
  characterRotationX: 0,
  characterRotationY: 0,
  characterScale: 1,
  characterError: null,
  set: (partial) => set(partial),
  pushPoseOp: (op) => {
    const { poseAdjustments, poseAdjustmentPast } = get()
    set({
      poseAdjustmentPast: [...poseAdjustmentPast, poseAdjustments],
      poseAdjustments: appendPoseOp(poseAdjustments, op),
      poseAdjustmentFuture: [],
    })
  },
  pushPoseOps: (ops) => {
    if (ops.length === 0) return
    const { poseAdjustments, poseAdjustmentPast } = get()
    let next = poseAdjustments
    for (const op of ops) {
      next = appendPoseOp(next, op)
    }
    set({
      poseAdjustmentPast: [...poseAdjustmentPast, poseAdjustments],
      poseAdjustments: next,
      poseAdjustmentFuture: [],
    })
  },
  undoPoseAdjustment: () => {
    const { poseAdjustments, poseAdjustmentPast, poseAdjustmentFuture } = get()
    if (poseAdjustmentPast.length === 0) return
    const previous = poseAdjustmentPast[poseAdjustmentPast.length - 1]
    set({
      poseAdjustments: previous,
      poseAdjustmentPast: poseAdjustmentPast.slice(0, -1),
      poseAdjustmentFuture: [poseAdjustments, ...poseAdjustmentFuture],
    })
  },
  redoPoseAdjustment: () => {
    const { poseAdjustments, poseAdjustmentPast, poseAdjustmentFuture } = get()
    if (poseAdjustmentFuture.length === 0) return
    const next = poseAdjustmentFuture[0]
    set({
      poseAdjustments: next,
      poseAdjustmentPast: [...poseAdjustmentPast, poseAdjustments],
      poseAdjustmentFuture: poseAdjustmentFuture.slice(1),
    })
  },
  resetPoseAdjustments: () => {
    const { poseAdjustments, poseAdjustmentPast } = get()
    if (poseAdjustments.length === 0) return
    set({
      poseAdjustmentPast: [...poseAdjustmentPast, poseAdjustments],
      poseAdjustments: [],
      poseAdjustmentFuture: [],
    })
  },
  setBasePoseId: (id) => {
    set({
      basePoseId: id,
      poseAdjustments: [],
      poseAdjustmentPast: [],
      poseAdjustmentFuture: [],
      selectedBodyPart: null,
    })
  },
}))
