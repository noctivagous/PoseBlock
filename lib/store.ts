import { create } from 'zustand'
import type { BodyPartId } from '@/lib/bodyParts'
import type { CharacterModel } from '@/lib/characterModels'
import { appendPoseOp, type PoseOp } from '@/lib/poseCompose'
import {
  createInstance,
  MAX_INSTANCES,
  type CharacterInstance,
} from '@/lib/instances'
import type { Pose } from '@/lib/poses'

export type InteractionMode = 'transform' | 'pose'

export type StoreState = {
  instances: CharacterInstance[]
  selectedIds: string[]
  characterModels: CharacterModel[]
  posePresets: Record<string, Pose>
  interactionMode: InteractionMode
  selectedBodyPart: BodyPartId | null
  backdropUrl: string
  frameWidth: number
  frameHeight: number
  characterError: string | null
  set: (partial: Partial<StoreState>) => void
  addInstance: (partial?: Partial<Pick<CharacterInstance, 'x' | 'y' | 'scale' | 'modelUrl' | 'basePoseId'>>) => string | null
  removeInstance: (id: string) => void
  updateInstance: (id: string, patch: Partial<CharacterInstance>) => void
  selectInstance: (id: string, options?: { shiftKey?: boolean }) => void
  clearSelection: () => void
  pushPoseOp: (op: PoseOp) => void
  pushPoseOps: (ops: PoseOp[]) => void
  undoPoseAdjustment: () => void
  redoPoseAdjustment: () => void
  resetPoseAdjustments: () => void
  setBasePoseId: (id: string) => void
  primarySelectedId: () => string | null
}

function mapSelectedInstances(
  state: StoreState,
  fn: (instance: CharacterInstance) => CharacterInstance,
): CharacterInstance[] {
  const selected = new Set(state.selectedIds)
  if (selected.size === 0) return state.instances
  return state.instances.map((inst) => (selected.has(inst.id) ? fn(inst) : inst))
}

function updateInstanceById(
  instances: CharacterInstance[],
  id: string,
  patch: Partial<CharacterInstance>,
): CharacterInstance[] {
  return instances.map((inst) => (inst.id === id ? { ...inst, ...patch } : inst))
}

export const useStore = create<StoreState>((set, get) => ({
  instances: [],
  selectedIds: [],
  characterModels: [],
  posePresets: {},
  interactionMode: 'transform',
  selectedBodyPart: null,
  backdropUrl: '/default_backdrop.jpg',
  frameWidth: 16,
  frameHeight: 9,
  characterError: null,
  set: (partial) => set(partial),

  primarySelectedId: () => {
    const { selectedIds } = get()
    return selectedIds[0] ?? null
  },

  addInstance: (partial) => {
    const { instances, characterModels } = get()
    if (instances.length >= MAX_INSTANCES) return null
    const modelUrl =
      partial?.modelUrl ??
      characterModels[0]?.url ??
      ''
    if (!modelUrl) return null
    const instance = createInstance(modelUrl, partial)
    set({
      instances: [...instances, instance],
      selectedIds: [instance.id],
    })
    return instance.id
  },

  removeInstance: (id) => {
    const { instances, selectedIds } = get()
    set({
      instances: instances.filter((inst) => inst.id !== id),
      selectedIds: selectedIds.filter((sid) => sid !== id),
    })
  },

  updateInstance: (id, patch) => {
    set({ instances: updateInstanceById(get().instances, id, patch) })
  },

  selectInstance: (id, options) => {
    const { selectedIds } = get()
    if (options?.shiftKey) {
      if (selectedIds.includes(id)) {
        set({ selectedIds: selectedIds.filter((sid) => sid !== id) })
      } else {
        set({ selectedIds: [...selectedIds, id] })
      }
      return
    }
    set({ selectedIds: [id], selectedBodyPart: null })
  },

  clearSelection: () => set({ selectedIds: [], selectedBodyPart: null }),

  pushPoseOp: (op) => {
    set({
      instances: mapSelectedInstances(get(), (inst) => ({
        ...inst,
        poseAdjustmentPast: [...inst.poseAdjustmentPast, inst.poseAdjustments],
        poseAdjustments: appendPoseOp(inst.poseAdjustments, op),
        poseAdjustmentFuture: [],
      })),
    })
  },

  pushPoseOps: (ops) => {
    if (ops.length === 0) return
    set({
      instances: mapSelectedInstances(get(), (inst) => {
        let next = inst.poseAdjustments
        for (const op of ops) {
          next = appendPoseOp(next, op)
        }
        return {
          ...inst,
          poseAdjustmentPast: [...inst.poseAdjustmentPast, inst.poseAdjustments],
          poseAdjustments: next,
          poseAdjustmentFuture: [],
        }
      }),
    })
  },

  undoPoseAdjustment: () => {
    const primaryId = get().primarySelectedId()
    if (!primaryId) return
    const inst = get().instances.find((i) => i.id === primaryId)
    if (!inst || inst.poseAdjustmentPast.length === 0) return
    const previous = inst.poseAdjustmentPast[inst.poseAdjustmentPast.length - 1]
    get().updateInstance(primaryId, {
      poseAdjustments: previous,
      poseAdjustmentPast: inst.poseAdjustmentPast.slice(0, -1),
      poseAdjustmentFuture: [inst.poseAdjustments, ...inst.poseAdjustmentFuture],
    })
  },

  redoPoseAdjustment: () => {
    const primaryId = get().primarySelectedId()
    if (!primaryId) return
    const inst = get().instances.find((i) => i.id === primaryId)
    if (!inst || inst.poseAdjustmentFuture.length === 0) return
    const next = inst.poseAdjustmentFuture[0]
    get().updateInstance(primaryId, {
      poseAdjustments: next,
      poseAdjustmentPast: [...inst.poseAdjustmentPast, inst.poseAdjustments],
      poseAdjustmentFuture: inst.poseAdjustmentFuture.slice(1),
    })
  },

  resetPoseAdjustments: () => {
    set({
      instances: mapSelectedInstances(get(), (inst) => {
        if (inst.poseAdjustments.length === 0) return inst
        return {
          ...inst,
          poseAdjustmentPast: [...inst.poseAdjustmentPast, inst.poseAdjustments],
          poseAdjustments: [],
          poseAdjustmentFuture: [],
        }
      }),
    })
  },

  setBasePoseId: (id) => {
    set({
      instances: mapSelectedInstances(get(), (inst) => ({
        ...inst,
        basePoseId: id,
        poseAdjustments: [],
        poseAdjustmentPast: [],
        poseAdjustmentFuture: [],
      })),
      selectedBodyPart: null,
    })
  },
}))
