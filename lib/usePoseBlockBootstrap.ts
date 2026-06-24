import { useEffect } from 'react'
import type { CharacterModel } from '../lib/characterModels'
import type { PoseModel } from '../lib/poseModels'
import { getAllPosePresets } from '../lib/posePresets'
import type { Pose } from '../lib/poses'
import { useStore } from '../lib/store'

/** Load character models and pose presets from standalone API routes. */
export function usePoseBlockBootstrap() {
  const set = useStore((s) => s.set)
  const addInstance = useStore((s) => s.addInstance)

  useEffect(() => {
    fetch('/api/models')
      .then((res) => res.json())
      .then((models: CharacterModel[]) => {
        set({ characterModels: models })
        if (models.length > 0 && useStore.getState().instances.length === 0) {
          addInstance({ modelUrl: models[0].url })
        }
      })
      .catch(() => {
        set({ characterError: 'Could not load models from /public/models' })
      })
  }, [set, addInstance])

  useEffect(() => {
    fetch('/api/poses')
      .then((res) => res.json())
      .then((presets: Record<string, Pose>) => {
        set({ posePresets: presets })
        const available = getAllPosePresets(presets)
        const { instances } = useStore.getState()
        if (instances.length === 0) return
        const firstKey = Object.keys(available)[0]
        if (!firstKey) return
        set({
          instances: instances.map((inst) =>
            available[inst.basePoseId] ? inst : { ...inst, basePoseId: firstKey },
          ),
        })
      })
      .catch(() => {
        // Keep built-in fallback presets when external JSON presets fail to load.
      })
  }, [set])

  useEffect(() => {
    fetch('/api/pose-models')
      .then((res) => res.json())
      .then((models: PoseModel[]) => {
        set({ poseModels: models })
      })
      .catch(() => {
        set({ poseModels: [] })
      })
  }, [set])
}
