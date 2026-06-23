'use client'

import dynamic from 'next/dynamic'
import { useCallback, useEffect, useRef } from 'react'
import { ExportButton } from '@/components/ExportButton'
import { PoseAdjustToolbar } from '@/components/PoseAdjustToolbar'
import { PreviewFrame } from '@/components/PreviewFrame'
import { Toolbar } from '@/components/Toolbar'
import type { CharacterModel } from '@/lib/characterModels'
import { getAllPosePresets } from '@/lib/posePresets'
import type { Pose } from '@/lib/poses'
import { useStore } from '@/lib/store'

const Scene = dynamic(() => import('@/components/Scene').then((m) => m.Scene), {
  ssr: false,
})

export default function Home() {
  const set = useStore((s) => s.set)
  const characterError = useStore((s) => s.characterError)
  const characterModels = useStore((s) => s.characterModels)
  const fileInputRef = useRef<HTMLInputElement>(null)

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

  const handleBackdropUpload = useCallback(
    (file: File) => {
      const url = URL.createObjectURL(file)
      set({ backdropUrl: url })
    },
    [set]
  )

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleBackdropUpload(file)
  }

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files?.[0]
    if (file?.type.startsWith('image/')) handleBackdropUpload(file)
  }

  return (
    <main className="flex h-screen w-screen overflow-hidden bg-zinc-950">
      <div
        className="relative min-w-0 flex-1"
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDrop}
      >
        <PreviewFrame>
          <Scene />
        </PreviewFrame>

        {characterError && (
          <div className="absolute inset-x-4 top-1/2 z-20 mx-auto max-w-md -translate-y-1/2 rounded-lg bg-red-900/90 p-4 text-center text-white">
            <p className="font-medium">{characterError}</p>
            <button
              type="button"
              className="mt-2 text-sm underline"
              onClick={() => {
                const first = characterModels[0]
                set({
                  characterError: null,
                  modelUrl: first?.url ?? '',
                })
              }}
            >
              Retry
            </button>
          </div>
        )}
      </div>

      <aside className="flex w-96 shrink-0 flex-col gap-3 overflow-y-auto border-l border-white/10 bg-zinc-900/80 p-4 text-white">
        <div className="flex flex-col gap-1">
          <h1 className="text-lg font-semibold">PoseBlock</h1>
          <p className="text-xs text-white/60">
            Drag the mannequin to move it. Use bounding-box controls to rotate,
            change depth, or scale. Export composites the backdrop with the 3D overlay.
          </p>
        </div>

        <Toolbar />
        <PoseAdjustToolbar />

        <div className="mt-auto flex flex-col gap-2 pt-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={onFileChange}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="w-full rounded bg-zinc-800 px-3 py-2 text-sm text-white hover:bg-zinc-700"
          >
            Upload frame
          </button>
          <ExportButton />
        </div>
      </aside>
    </main>
  )
}
