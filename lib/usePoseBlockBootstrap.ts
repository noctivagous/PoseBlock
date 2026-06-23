'use client'

import { useEffect } from 'react'
import type { CharacterModel } from '@/lib/characterModels'
import { getAllPosePresets } from '@/lib/posePresets'
import type { Pose } from '@/lib/poses'
import { useStore } from '@/lib/store'

/** Load character models and pose presets from standalone API routes. */
export function usePoseBlockBootstrap() {
  const set = useStore((s) => s.set)

  useEffect(() => {
    fetch('/api/models')
      .then((res) => res.json())
      .then((models: CharacterModel[]) => {
        set({ characterModels: models })
        const currentUrl = useStore.getState().modelUrl
        if (models.length > 0 && !models.some((m) => m.url === currentUrl)) {
          set({ modelUrl: models[0].url })
        }
      })
      .catch(() => {
        set({ characterError: 'Could not load models from /public/models' })
      })
  }, [set])

  useEffect(() => {
    fetch('/api/poses')
      .then((res) => res.json())
      .then((presets: Record<string, Pose>) => {
        set({ posePresets: presets })
        const available = getAllPosePresets(presets)
        const current = useStore.getState().basePoseId
        if (!available[current]) {
          const first = Object.keys(available)[0]
          set({ basePoseId: first ?? 't_pose' })
        }
      })
      .catch(() => {
        // Keep built-in fallback presets when external JSON presets fail to load.
      })
  }, [set])
}
