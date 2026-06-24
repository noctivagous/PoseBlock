import { create } from 'zustand'
import type { BodyPartId } from '../lib/bodyParts'
import type { CharacterModel } from '../lib/characterModels'
import { appendPoseOp, type PoseOp } from '../lib/poseCompose'
import type { PoseModel } from '../lib/poseModels'
import {
  createDefaultControlRig,
  createDefaultIkBlend,
  createDefaultPinnedWorldPos,
  createDefaultPins,
  createInstance,
  MAX_INSTANCES,
  type ControlRig,
  type CharacterInstance,
  type IkBlend,
  type PinKey,
  type Pins,
  type PinnedWorldPos,
  type PoseSourceMode,
} from '../lib/instances'
import type { Pose } from '../lib/poses'
import type { PoseBlockInstance } from '../types'

export type InteractionMode = 'transform' | 'pose'
export type PoseGizmoMode = 'legacy' | 'joint' | 'cylinder'
export type CharacterMode = 'preset' | 'controlRig' | 'drag'

export type StoreState = {
  instances: CharacterInstance[]
  selectedIds: string[]
  characterModels: CharacterModel[]
  posePresets: Record<string, Pose>
  poseModels: PoseModel[]
  interactionMode: InteractionMode
  poseGizmoMode: PoseGizmoMode
  mode: CharacterMode
  selectedBodyPart: BodyPartId | null
  selectedPoseBone: string | null
  modelUrl: string
  currentPose: string
  characterX: number
  characterY: number
  characterScale: number
  controlRig: ControlRig
  pins: Pins
  pinnedWorldPos: PinnedWorldPos
  ikBlend: IkBlend
  backdropUrl: string
  frameWidth: number
  frameHeight: number
  characterError: string | null
  /** Outward callback — registered by PoseBlockCompositor, called by inner components on user interaction. */
  onInstanceChange: ((id: string, patch: Partial<PoseBlockInstance>) => void) | null
  /** Outward callback — registered by PoseBlockCompositor, called by inner components on selection change. */
  onSelect: ((ids: string[]) => void) | null
  set: (partial: Partial<StoreState>) => void
  addInstance: (partial?: Partial<Pick<CharacterInstance, 'x' | 'y' | 'scale' | 'modelUrl' | 'basePoseId'>>) => string | null
  removeInstance: (id: string) => void
  updateInstance: (id: string, patch: Partial<CharacterInstance>) => void
  updateSelectedInstances: (
    patch:
      | Partial<CharacterInstance>
      | ((instance: CharacterInstance) => Partial<CharacterInstance>),
  ) => void
  selectInstance: (id: string, options?: { shiftKey?: boolean }) => void
  clearSelection: () => void
  pushPoseOp: (op: PoseOp) => void
  pushPoseOps: (ops: PoseOp[]) => void
  undoPoseAdjustment: () => void
  redoPoseAdjustment: () => void
  resetPoseAdjustments: () => void
  setBasePoseId: (id: string) => void
  setPoseSourceMode: (mode: PoseSourceMode) => void
  setAnimationPoseModel: (id: string, defaultClip?: string | null) => void
  setAnimationFrame: (frame: number) => void
  setAnimationClip: (clip: string | null) => void
  setMode: (mode: CharacterMode) => void
  setControlRig: (update: Partial<ControlRig>) => void
  setPin: (key: PinKey, value: boolean) => void
  setPinnedWorldPos: (key: PinKey, pos: [number, number, number]) => void
  setIkBlend: (key: keyof IkBlend, value: number) => void
  setInstanceControlRig: (id: string, update: Partial<ControlRig>) => void
  setInstancePin: (id: string, key: PinKey, value: boolean) => void
  setInstancePinnedWorldPos: (id: string, key: PinKey, pos: [number, number, number]) => void
  setInstanceIkBlend: (id: string, key: keyof IkBlend, value: number) => void
  setCharacterError: (error: string | null) => void
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

function instanceChangePatch(inst: CharacterInstance): Partial<PoseBlockInstance> {
  return {
    x: inst.x,
    y: inst.y,
    scale: inst.scale,
    rotation: inst.rotation,
    characterZ: inst.characterZ,
    characterRotationX: inst.characterRotationX,
    characterRotationY: inst.characterRotationY,
    basePoseId: inst.basePoseId,
    poseSourceMode: inst.poseSourceMode,
    animationPoseModelId: inst.animationPoseModelId,
    animationClip: inst.animationClip,
    animationFrame: inst.animationFrame,
    poseAdjustments: inst.poseAdjustments,
    controlRig: inst.controlRig,
    pins: inst.pins,
    pinnedWorldPos: inst.pinnedWorldPos,
    ikBlend: inst.ikBlend,
  }
}

function resetPoseAdjustments(inst: CharacterInstance): CharacterInstance {
  return {
    ...inst,
    poseAdjustments: [],
    poseAdjustmentPast: [],
    poseAdjustmentFuture: [],
    controlRig: { ...inst.controlRig, initialized: false },
    pins: createDefaultPins(),
    pinnedWorldPos: createDefaultPinnedWorldPos(),
  }
}
function notifyInstanceChange(
  cb: StoreState['onInstanceChange'],
  instances: CharacterInstance[],
  ids: string[],
): void {
  if (!cb) return
  for (const id of ids) {
    const inst = instances.find((i) => i.id === id)
    if (inst) cb(id, instanceChangePatch(inst))
  }
}

export const useStore = create<StoreState>((set, get) => ({
  instances: [],
  selectedIds: [],
  characterModels: [],
  posePresets: {},
  poseModels: [],
  interactionMode: 'transform',
  poseGizmoMode: 'legacy',
  mode: 'preset',
  selectedBodyPart: null,
  selectedPoseBone: null,
  modelUrl: '',
  currentPose: 't_pose',
  characterX: 0,
  characterY: 0,
  characterScale: 1,
  controlRig: createDefaultControlRig(),
  pins: createDefaultPins(),
  pinnedWorldPos: createDefaultPinnedWorldPos(),
  ikBlend: createDefaultIkBlend(),
  backdropUrl: '/default_backdrop.jpg',
  frameWidth: 16,
  frameHeight: 9,
  characterError: null,
  onInstanceChange: null,
  onSelect: null,
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
    const inst = get().instances.find((i) => i.id === id)
    if (inst) notifyInstanceChange(get().onInstanceChange, get().instances, [id])
  },

  updateSelectedInstances: (patchOrFn) => {
    const { instances, selectedIds } = get()
    const selected = new Set(selectedIds)
    if (selected.size === 0) return

    const next = instances.map((inst) => {
      if (!selected.has(inst.id)) return inst
      const patch = typeof patchOrFn === 'function' ? patchOrFn(inst) : patchOrFn
      return Object.keys(patch).length > 0 ? { ...inst, ...patch } : inst
    })
    set({ instances: next })
    notifyInstanceChange(get().onInstanceChange, next, selectedIds)
  },

  selectInstance: (id, options) => {
    const { selectedIds } = get()
    let nextIds: string[]
    if (options?.shiftKey) {
      if (selectedIds.includes(id)) {
        nextIds = selectedIds.filter((sid) => sid !== id)
      } else {
        nextIds = [...selectedIds, id]
      }
      set({ selectedIds: nextIds })
    } else {
      nextIds = [id]
      set({ selectedIds: nextIds, selectedBodyPart: null, selectedPoseBone: null })
    }
    const cb = get().onSelect
    if (cb) cb(nextIds)
  },

  clearSelection: () => {
    set({ selectedIds: [], selectedBodyPart: null, selectedPoseBone: null })
    const cb = get().onSelect
    if (cb) cb([])
  },

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
    const { selectedIds } = get()
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
    const cb = get().onInstanceChange
    if (cb) {
      for (const id of selectedIds) {
        const inst = get().instances.find((i) => i.id === id)
        if (inst) cb(id, { poseAdjustments: inst.poseAdjustments, basePoseId: inst.basePoseId })
      }
    }
  },

  undoPoseAdjustment: () => {
    const { selectedIds } = get()
    if (selectedIds.length === 0) return

    const changedIds: string[] = []
    const next = get().instances.map((inst) => {
      if (!selectedIds.includes(inst.id) || inst.poseAdjustmentPast.length === 0) return inst
      const previous = inst.poseAdjustmentPast[inst.poseAdjustmentPast.length - 1]
      changedIds.push(inst.id)
      return {
        ...inst,
        poseAdjustments: previous,
        poseAdjustmentPast: inst.poseAdjustmentPast.slice(0, -1),
        poseAdjustmentFuture: [inst.poseAdjustments, ...inst.poseAdjustmentFuture],
      }
    })
    if (changedIds.length === 0) return
    set({ instances: next })
    notifyInstanceChange(get().onInstanceChange, next, changedIds)
  },

  redoPoseAdjustment: () => {
    const { selectedIds } = get()
    if (selectedIds.length === 0) return

    const changedIds: string[] = []
    const next = get().instances.map((inst) => {
      if (!selectedIds.includes(inst.id) || inst.poseAdjustmentFuture.length === 0) return inst
      const redo = inst.poseAdjustmentFuture[0]
      changedIds.push(inst.id)
      return {
        ...inst,
        poseAdjustments: redo,
        poseAdjustmentPast: [...inst.poseAdjustmentPast, inst.poseAdjustments],
        poseAdjustmentFuture: inst.poseAdjustmentFuture.slice(1),
      }
    })
    if (changedIds.length === 0) return
    set({ instances: next })
    notifyInstanceChange(get().onInstanceChange, next, changedIds)
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
      instances: mapSelectedInstances(get(), (inst) =>
        resetPoseAdjustments({
          ...inst,
          basePoseId: id,
          poseSourceMode: 'preset',
        }),
      ),
      selectedBodyPart: null,
      selectedPoseBone: null,
    })
  },

  setPoseSourceMode: (mode) => {
    set({
      instances: mapSelectedInstances(get(), (inst) => ({ ...inst, poseSourceMode: mode })),
    })
    const { selectedIds } = get()
    notifyInstanceChange(get().onInstanceChange, get().instances, selectedIds)
  },

  setAnimationPoseModel: (id, defaultClip = null) => {
    set({
      instances: mapSelectedInstances(get(), (inst) =>
        resetPoseAdjustments({
          ...inst,
          poseSourceMode: 'animation',
          animationPoseModelId: id,
          animationClip: defaultClip,
          animationFrame: 0,
        }),
      ),
      selectedBodyPart: null,
      selectedPoseBone: null,
    })
    const { selectedIds } = get()
    notifyInstanceChange(get().onInstanceChange, get().instances, selectedIds)
  },

  setAnimationFrame: (frame) => {
    const nextFrame = Math.max(0, Math.floor(frame))
    set({
      instances: mapSelectedInstances(get(), (inst) => ({
        ...inst,
        animationFrame: nextFrame,
      })),
    })
    const { selectedIds } = get()
    notifyInstanceChange(get().onInstanceChange, get().instances, selectedIds)
  },

  setAnimationClip: (clip) => {
    set({
      instances: mapSelectedInstances(get(), (inst) => ({
        ...inst,
        animationClip: clip,
        animationFrame: 0,
      })),
    })
    const { selectedIds } = get()
    notifyInstanceChange(get().onInstanceChange, get().instances, selectedIds)
  },

  setMode: (mode) => set({ mode }),

  setControlRig: (update) =>
    set((state) => ({
      controlRig: { ...state.controlRig, ...update },
    })),

  setPin: (key, value) =>
    set((state) => ({
      pins: { ...state.pins, [key]: value },
    })),

  setPinnedWorldPos: (key, pos) =>
    set((state) => ({
      pinnedWorldPos: { ...state.pinnedWorldPos, [key]: pos },
    })),

  setIkBlend: (key, value) =>
    set((state) => ({
      ikBlend: { ...state.ikBlend, [key]: value },
    })),

  setInstanceControlRig: (id, update) => {
    const inst = get().instances.find((item) => item.id === id)
    if (!inst) return
    get().updateInstance(id, { controlRig: { ...inst.controlRig, ...update } })
  },

  setInstancePin: (id, key, value) => {
    const inst = get().instances.find((item) => item.id === id)
    if (!inst) return
    get().updateInstance(id, { pins: { ...inst.pins, [key]: value } })
  },

  setInstancePinnedWorldPos: (id, key, pos) => {
    const inst = get().instances.find((item) => item.id === id)
    if (!inst) return
    get().updateInstance(id, { pinnedWorldPos: { ...inst.pinnedWorldPos, [key]: pos } })
  },

  setInstanceIkBlend: (id, key, value) => {
    const inst = get().instances.find((item) => item.id === id)
    if (!inst) return
    get().updateInstance(id, { ikBlend: { ...inst.ikBlend, [key]: value } })
  },

  setCharacterError: (error) => set({ characterError: error }),
}))
